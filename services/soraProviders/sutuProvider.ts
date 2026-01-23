/**
 * 速推 API (Sutu) 适配器
 * 将现有速推 API 逻辑封装为提供商接口
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

export class SutuProvider implements SoraProvider {
  readonly name = 'sutu' as const;
  readonly displayName = '速推 API';

  /**
   * 速推 API 配置转换
   * 速推直接使用 aspect_ratio, duration (string), hd
   */
  transformConfig(userConfig: Sora2UserConfig): ProviderSpecificConfig {
    return {
      aspect_ratio: userConfig.aspect_ratio,
      duration: userConfig.duration,  // 字符串类型
      hd: userConfig.hd,
    };
  }

  /**
   * 提交任务到速推 API
   */
  async submitTask(
    params: SoraSubmitParams,
    apiKey: string,
    context?: CallContext
  ): Promise<SoraSubmitResult> {
    const config = this.transformConfig(params.config);

    const requestBody = {
      prompt: params.prompt,
      model: 'sora-2',
      images: params.referenceImageUrl ? [params.referenceImageUrl] : [],
      ...config,
      watermark: true,
      private: true,
    };

    return logAPICall(
      'sutuSubmitTask',
      async () => {
        const apiUrl = 'http://localhost:3001/api/sora/generations';
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

        // 提取任务 ID
        const taskId = this.extractTaskId(result);
        console.log(`[${this.displayName}] 提交成功，任务 ID:`, taskId);

        // 确保 id 字段存在
        if (!result.id) {
          result.id = taskId;
        }

        return {
          id: result.id,
          status: result.status || 'queued',
          progress: result.progress || 0,
          createdAt: result.createdAt || Date.now(),
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
      context
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
      'sutuCheckStatus',
      async () => {
        const apiUrl = `http://localhost:3001/api/sora/generations/${taskId}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
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

        // 添加详细日志
        const progressNum = parseInt(String(data.progress)) || 0;
        console.log(`[${this.displayName}] API Response:`, {
          taskId,
          status: data.status,
          progress: data.progress,
          progressNum,
          hasOutput: !!data.output,
          hasUrl: !!data.url,
          hasVideoUrl: !!data.video_url,
          allFields: Object.keys(data),
          urlField: data.url,
          videoUrlField: data.video_url,
          outputUrl: data.output?.url,
        });

        // 更新进度
        if (onProgress && data.progress !== undefined) {
          onProgress(data.progress);
        }

        // 检查是否违规
        const isCompliant = data.quality === 'standard';
        const violationReason = isCompliant ? undefined : (data.quality || '内容审核未通过');

        // 处理错误状态
        if (data.status === 'error') {
          return {
            taskId: data.id,
            status: 'error',
            progress: data.progress || 0,
            videoUrl: undefined,
            videoUrlWatermarked: undefined,
            duration: undefined,
            quality: data.quality || 'unknown',
            isCompliant: false,
            violationReason: violationReason || '视频生成失败，系统重试6次后仍未成功',
          };
        }

        // 正常状态处理
        return {
          taskId: data.id || data.task_id,
          status: data.status,
          progress: progressNum,
          videoUrl: data.data?.output || data.output?.url || data.output || data.url || data.video_url || data.result?.url || data.video?.url,
          videoUrlWatermarked: data.data?.watermark_output || data.output?.watermark_url || data.watermark_url || data.watermarked_url || data.watermark?.url,
          duration: data.data?.duration || data.output?.duration || data.seconds || data.duration || data.video?.duration,
          quality: data.quality || 'standard',
          isCompliant: isCompliant,
          violationReason: violationReason,
          _rawData: data,
        };
      },
      { taskId, hasProgressCallback: !!onProgress },
      context
    );
  }

  /**
   * 从 API 响应中提取任务 ID（兼容多种格式）
   */
  private extractTaskId(result: any): string {
    if (result.id) return result.id;
    if (result.task_id) return result.task_id;
    if (result.data?.id) return result.data.id;
    if (result.data?.task_id) return result.data.task_id;
    if (result.result?.id) return result.result.id;
    if (result.result?.task_id) return result.result.task_id;

    throw new Error(`无法从 ${this.displayName} 响应中提取任务 ID: ${JSON.stringify(result)}`);
  }
}
