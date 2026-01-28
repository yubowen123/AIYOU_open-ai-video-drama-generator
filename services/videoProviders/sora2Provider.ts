/**
 * Sora 2 视频生成模型适配器
 * 复用现有的 soraProviders 代码
 */

import {
  VideoProvider,
  VideoSubmitParams,
  VideoSubmitResult,
  VideoGenerationResult,
  VideoProviderContext,
  VideoModelConfig,
} from './types';
import { getProvider } from '../soraProviders';
import type { SoraProviderType } from '../soraProviders/types';

export class Sora2VideoProvider implements VideoProvider {
  readonly name = 'sora2' as const;
  readonly displayName = 'Sora 2';

  readonly supportedFeatures = {
    textToVideo: true,
    imageToVideo: true,
    maxDuration: 25,
    supportedRatios: ['16:9', '9:16'] as const,
  };

  /**
   * 配置转换：将统一格式转换为 Sora2 格式
   */
  transformConfig(userConfig: VideoModelConfig) {
    return {
      aspect_ratio: userConfig.aspect_ratio,
      duration: userConfig.duration,
      hd: userConfig.quality === 'pro',
    };
  }

  /**
   * 提交任务
   */
  async submitTask(
    params: VideoSubmitParams,
    apiKey: string,
    context?: VideoProviderContext
  ): Promise<VideoSubmitResult> {
    // 从存储中获取用户选择的 Sora2 提供商
    const { getSoraProvider } = await import('../soraConfigService');
    const providerName = getSoraProvider() as SoraProviderType;

    const soraProvider = getProvider(providerName);

    const config = this.transformConfig(params.config);

    const result = await soraProvider.submitTask(
      {
        prompt: params.prompt,
        referenceImageUrl: params.referenceImageUrl,
        config,
      },
      apiKey,
      context
    );

    return {
      id: result.id,
      status: result.status,
      estimatedTime: this.estimateTime(config),
    };
  }

  /**
   * 查询状态
   */
  async checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: VideoProviderContext
  ): Promise<VideoGenerationResult> {
    const { getSoraProvider } = await import('../soraConfigService');
    const providerName = getSoraProvider() as SoraProviderType;

    const soraProvider = getProvider(providerName);

    const result = await soraProvider.checkStatus(
      taskId,
      apiKey,
      onProgress,
      context
    );

    return {
      taskId: result.taskId,
      status: result.status,
      progress: result.progress,
      videoUrl: result.videoUrl,
      videoDuration: result.duration ? parseInt(result.duration) : undefined,
      videoResolution: this.getResolution(result),
      error: result.violationReason,
    };
  }

  private estimateTime(config: any): number {
    const duration = parseInt(config.duration);
    return duration * 10; // 粗略估算：每秒10秒生成时间
  }

  private getResolution(result: any): string {
    // 从 quality 字段推断分辨率
    return result.quality === 'standard' ? '1280x720' : '1920x1080';
  }
}
