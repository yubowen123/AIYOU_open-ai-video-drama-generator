/**
 * Kling AI 视频生成模型适配器
 * 占位符实现，后续根据 Kling API 文档补充
 */

import {
  VideoProvider,
  VideoSubmitParams,
  VideoSubmitResult,
  VideoGenerationResult,
  VideoProviderContext,
  VideoProviderError,
} from './types';

export class KlingVideoProvider implements VideoProvider {
  readonly name = 'kling' as const;
  readonly displayName = 'Kling AI';

  readonly supportedFeatures = {
    textToVideo: true,
    imageToVideo: true,
    maxDuration: 10,
    supportedRatios: ['16:9', '9:16'] as const,
  };

  /**
   * 配置转换：Kling API 格式
   */
  transformConfig(userConfig: VideoModelConfig) {
    return {
      aspect_ratio: userConfig.aspect_ratio,
      duration: parseInt(userConfig.duration),
      mode: userConfig.quality === 'pro' ? 'high_quality' : 'standard',
    };
  }

  /**
   * 提交任务到 Kling API
   */
  async submitTask(
    params: VideoSubmitParams,
    apiKey: string,
    context?: VideoProviderContext
  ): Promise<VideoSubmitResult> {
    const config = this.transformConfig(params.config);

    const requestBody = {
      prompt: params.prompt,
      ...(params.referenceImageUrl && {
        image_url: params.referenceImageUrl,
      }),
      ...config,
    };

    // 使用后端代理
    const apiUrl = 'http://localhost:3001/api/kling/create';
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
      throw new VideoProviderError(
        this.name,
        response.status,
        `提交任务失败: ${errorText}`,
        { errorText }
      );
    }

    const result: any = await response.json();

    return {
      id: result.task_id || result.id,
      status: result.status || 'queued',
      estimatedTime: this.estimateTime(config),
    };
  }

  /**
   * 查询任务状态
   */
  async checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: VideoProviderContext
  ): Promise<VideoGenerationResult> {
    const apiUrl = `http://localhost:3001/api/kling/query?id=${encodeURIComponent(taskId)}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      throw new VideoProviderError(this.name, response.status, `查询任务失败`, {});
    }

    const data: any = await response.json();

    const status = this.mapStatus(data.status);
    const progress = data.progress || 0;

    if (onProgress) {
      onProgress(progress);
    }

    return {
      taskId,
      status,
      progress,
      videoUrl: data.video_url || data.url,
      videoDuration: data.duration,
      videoResolution: data.resolution,
      error: status === 'error' ? data.error : undefined,
    };
  }

  private mapStatus(status: string): 'queued' | 'processing' | 'completed' | 'error' {
    const statusMap: Record<string, 'queued' | 'processing' | 'completed' | 'error'> = {
      'pending': 'queued',
      'queued': 'queued',
      'processing': 'processing',
      'succeeded': 'completed',
      'completed': 'completed',
      'failed': 'error',
      'error': 'error',
    };
    return statusMap[status] || 'processing';
  }

  private estimateTime(config: any): number {
    const duration = config.duration || 10;
    return duration * 15; // Kling 较慢
  }
}
