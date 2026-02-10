/**
 * 大洋芋 API (Dayuapi) 适配器
 * 将大洋芋 API 封装为统一的提供商接口
 *
 * API 特点：
 * - 通过模型名称编码参数（orientation、duration、hd）
 * - 请求格式：application/json
 * - 图片通过 image_url 字段传递 URL
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

export class DayuapiProvider implements SoraProvider {
  readonly name = 'dayuapi' as const;
  readonly displayName = '大洋芋 API';

  /**
   * 根据配置生成模型名称
   *
   * 模型命名规则：[pro]-[orientation][-hd]-[duration]s
   *
   * 普通模式（3-5分钟）：
   * - sora2-landscape: 横屏 10秒
   * - sora2-portrait: 竖屏 10秒
   * - sora2-landscape-15s: 横屏 15秒
   * - sora2-portrait-15s: 竖屏 15秒
   *
   * Pro 模式（15-30分钟，高清）：
   * - sora2-pro-landscape-25s: 横屏 25秒
   * - sora2-pro-portrait-25s: 竖屏 25秒
   * - sora2-pro-landscape-hd-15s: 横屏 15秒 高清
   * - sora2-pro-portrait-hd-15s: 竖屏 15秒 高清
   *
   * 特殊规则：
   * - 25秒时强制使用 Pro 模式（无论 hd 开关）
   * - hd=true + duration=10 时映射到 15秒 高清模型
   */
  private getModelName(config: Sora2UserConfig): string {
    const { aspect_ratio, duration, hd } = config;
    const isLandscape = aspect_ratio === '16:9';
    const orientation = isLandscape ? 'landscape' : 'portrait';

    // 25秒：强制使用 Pro 模式
    if (duration === '25') {
      return `sora2-pro-${orientation}-25s`;
    }

    // 高清模式
    if (hd) {
      // 10秒和15秒都映射到15秒高清
      return `sora2-pro-${orientation}-hd-15s`;
    }

    // 普通模式
    if (duration === '10') {
      return `sora2-${orientation}`;
    } else {
      // duration === '15'
      return `sora2-${orientation}-15s`;
    }
  }

  /**
   * 配置转换：Sora2UserConfig → 模型名称
   */
  transformConfig(userConfig: Sora2UserConfig): ProviderSpecificConfig {
    return {
      model: this.getModelName(userConfig)
    };
  }

  /**
   * 提交任务到云雾 API
   */
  async submitTask(
    params: SoraSubmitParams,
    apiKey: string,
    context?: CallContext
  ): Promise<SoraSubmitResult> {
    const { model } = this.transformConfig(params.config);

    const requestBody = {
      prompt: params.prompt,
      model,
      ...(params.referenceImageUrl && {
        image_url: params.referenceImageUrl
      })
    };

    return logAPICall(
      'dayuapiSubmitTask',
      async () => {
        // 使用后端代理
        const apiUrl = 'http://localhost:3001/api/dayuapi/create';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
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


        return {
          id: result.id,
          status: result.status || 'pending',
          progress: result.progress || 0,
          createdAt: result.created_at || Date.now(),
        };
      },
      {
        model,
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
    return logAPICall(
      'dayuapiCheckStatus',
      async () => {
        // 使用后端代理
        const apiUrl = `http://localhost:3001/api/dayuapi/query?id=${encodeURIComponent(taskId)}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
          },
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

        const data: any = await response.json();


        // 状态映射：大洋芋API返回的状态值
        // API文档：https://6ibmqmipvf.apifox.cn/363035225e0
        // 返回格式：{ status: "completed", progress: 100, video_url: "..." }
        const statusMap: Record<string, 'queued' | 'processing' | 'completed' | 'error'> = {
          'pending': 'queued',
          'queued': 'queued',
          'processing': 'processing',
          'completed': 'completed',
          'failed': 'error',
          'canceled': 'error',
        };

        const status = statusMap[data.status] || 'processing';
        const progress = data.progress || 0;

        // 更新进度
        if (onProgress) {
          onProgress(progress);
        }

        // 直接从 video_url 字段提取视频URL
        let videoUrl = data.video_url;

        // 如果状态是 completed 但没有 video_url，尝试调用 /content 端点
        if (status === 'completed' && !videoUrl) {

          try {
            const contentResponse = await fetch(`http://localhost:3001/api/dayuapi/content?id=${data.id}`, {
              method: 'GET',
              headers: {
                'X-API-Key': apiKey,
              },
            });

            if (contentResponse.ok) {
              const contentData = await contentResponse.json();

              if (contentData.url) {
                videoUrl = contentData.url;
              } else {
                console.warn(`[${this.displayName}] /content 端点响应成功但仍然没有 URL`);
              }
            } else {
              console.warn(`[${this.displayName}] /content 端点调用失败:`, contentResponse.status);
            }
          } catch (error) {
            console.warn(`[${this.displayName}] 调用 /content 端点异常:`, error);
          }

          // 如果仍然没有 videoUrl，将状态改为 error
          if (!videoUrl) {
            console.error(`[${this.displayName}] 任务完成但无法获取视频 URL，标记为错误`);
            return {
              taskId: data.id,
              status: 'error',
              progress: 100,
              videoUrl: undefined,
              videoUrlWatermarked: undefined,
              duration: undefined,
              quality: 'unknown',
              isCompliant: false,
              violationReason: '视频生成完成但无法获取视频 URL，可能是 /content 端点问题',
              _rawData: data,
            };
          }
        }

        // 检查是否失败
        if (status === 'error') {
          return {
            taskId: data.id,
            status: 'error',
            progress,
            videoUrl: undefined,
            videoUrlWatermarked: undefined,
            duration: undefined,
            quality: 'unknown',
            isCompliant: false,
            violationReason: data.error || data.message || '视频生成失败',
            _rawData: data,
          };
        }


        return {
          taskId: data.id,
          status,
          progress,
          videoUrl,
          videoUrlWatermarked: undefined,
          duration: undefined,
          quality: 'standard',
          isCompliant: true,
          _rawData: data,
        };
      },
      { taskId, hasProgressCallback: !!onProgress },
      { ...context, platform: this.displayName, logType: 'polling' }
    );
  }
}
