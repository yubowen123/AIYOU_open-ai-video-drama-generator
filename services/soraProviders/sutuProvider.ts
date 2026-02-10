/**
 * 速创 API (Sinco) 适配器
 * API 文档:
 * - Sora2 提交: https://api.wuyinkeji.com/doc/60
 * - Sora2 Pro 提交: https://api.wuyinkeji.com/doc/41
 * - 结果查询: https://api.wuyinkeji.com/doc/36
 */

import {
  SoraProvider,
  SoraSubmitParams,
  SoraSubmitResult,
  SoraVideoResult,
  Sora2UserConfig,
  ProviderSpecificConfig,
  CallContext,
  SoraAPIError
} from './types';
import { logAPICall } from '../apiLogger';
import { getSoraModelName } from '../soraModelConfig';

export class SutuProvider implements SoraProvider {
  readonly name = 'sutu' as const;
  readonly displayName = '速创 API';

  /**
   * 速创 API 配置转换
   * 根据 hd 参数决定使用标准版还是 Pro 版
   */
  transformConfig(userConfig: Sora2UserConfig): ProviderSpecificConfig {
    return {
      aspect_ratio: userConfig.aspect_ratio,
      duration: userConfig.duration,
      hd: userConfig.hd,  // hd=true 使用 Pro 版，hd=false 使用标准版
    };
  }

  /**
   * 提交任务到速创 API
   * 根据 hd 参数选择使用标准版还是 Pro 版
   */
  async submitTask(
    params: SoraSubmitParams,
    apiKey: string,
    context?: CallContext
  ): Promise<SoraSubmitResult> {
    const config = this.transformConfig(params.config);

    // ✅ 使用统一的代理端点
    const submitEndpoint = 'http://localhost:3001/api/sutu/create';

    // ✅ 动态获取模型名称
    const modelName = getSoraModelName('sutu', params.config.hd);


    // 构建 application/x-www-form-urlencoded 格式
    const formData = new URLSearchParams();
    formData.append('prompt', params.prompt);

    // ✅ 动态模型名
    formData.append('model', modelName);

    // 可选：参考图片
    if (params.referenceImageUrl) {
      formData.append('url', params.referenceImageUrl);
    }

    // aspectRatio: 16:9 或 9:16
    formData.append('aspectRatio', config.aspect_ratio);

    // duration 映射
    if (config.hd) {
      // Pro 版支持 15 秒（高清）和 25 秒（标清）
      if (config.duration === '25') {
        formData.append('duration', '25');
      } else {
        // 10、15 都映射为 15 秒高清
        formData.append('duration', '15');
      }
    } else {
      // 标准版支持 10 秒和 15 秒
      if (config.duration === '15' || config.duration === '25') {
        formData.append('duration', '15');
      } else {
        formData.append('duration', '10');
      }

      // size 参数（仅标准版）
      const size = 'small';  // 速创API目前只有small有效
      formData.append('size', size);
    }

    return logAPICall(
      'sutuSubmitTask',
      async () => {

        const response = await fetch(submitEndpoint, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,  // ✅ 使用统一的请求头
            'Content-Type': 'application/x-www-form-urlencoded;charset:utf-8;'
          },
          body: formData.toString()
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new SoraAPIError(
            this.name,
            response.status,
            `提交任务失败: ${errorText}`,
            { errorText }
          );
        }

        const result: any = await response.json();

        // 检查返回格式
        if (result.code !== 200 && result.code !== 0) {
          throw new SoraAPIError(
            this.name,
            result.code || 500,
            `API错误: ${result.msg || '未知错误'}`,
            { result }
          );
        }

        const taskId = result.data?.id;
        if (!taskId) {
          throw new SoraAPIError(
            this.name,
            500,
            '响应中缺少 task_id',
            { result }
          );
        }


        return {
          id: taskId,
          status: 'queued',
          progress: 0,
          createdAt: Date.now(),
        };
      },
      {
        aspectRatio: config.aspect_ratio,
        duration: config.duration,
        hd: config.hd,
        hasReferenceImage: !!params.referenceImageUrl,
        promptLength: params.prompt.length,
        promptPreview: params.prompt.substring(0, 200) + (params.prompt.length > 200 ? '...' : ''),
      },
      { ...context, platform: this.displayName }
    );
  }

  /**
   * 查询任务状态
   */
  async checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: CallContext
  ): Promise<SoraVideoResult> {
    // ✅ 使用统一的代理端点
    const statusEndpoint = `http://localhost:3001/api/sutu/query?id=${taskId}`;

    return logAPICall(
      'sutuCheckStatus',
      async () => {

        const response = await fetch(statusEndpoint, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,  // ✅ 使用统一的请求头
            'Content-Type': 'application/x-www-form-urlencoded;charset:utf-8;'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new SoraAPIError(
            this.name,
            response.status,
            `查询任务失败: ${errorText}`,
            { errorText }
          );
        }

        const result: any = await response.json();


        // 状态映射: 0->queued, 1->completed, 2->error, 3->processing
        const statusMap: Record<number, 'queued' | 'processing' | 'completed' | 'error'> = {
          0: 'queued',       // 排队中
          1: 'completed',    // 成功
          2: 'error',        // 失败
          3: 'processing'    // 生成中
        };

        const apiStatus = result.data?.status ?? 0;
        const status = statusMap[apiStatus] || 'processing';

        // 进度估算
        let progress = 0;
        if (status === 'completed') {
          progress = 100;
        } else if (status === 'processing') {
          progress = 50;  // 生成中给50%
        }

        // 更新进度回调
        if (onProgress) {
          onProgress(progress);
        }

        // 错误状态处理
        if (status === 'error') {
          return {
            taskId,
            status: 'error',
            progress: 0,
            videoUrl: undefined,
            videoUrlWatermarked: undefined,
            duration: undefined,
            quality: 'error',
            isCompliant: false,
            violationReason: result.msg || '视频生成失败',
            _rawData: result,
          };
        }

        // 正常状态处理
        return {
          taskId,
          status,
          progress,
          videoUrl: result.data?.remote_url,
          videoUrlWatermarked: undefined,  // 速创API不返回水印视频
          duration: undefined,
          quality: 'standard',
          isCompliant: true,
          violationReason: undefined,
          _rawData: result,
        };
      },
      { taskId, hasProgressCallback: !!onProgress },
      { ...context, platform: this.displayName, logType: 'polling' }
    );
  }

}
