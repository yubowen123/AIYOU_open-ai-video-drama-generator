/**
 * Runway Gen-3 视频生成模型适配器
 * 占位符实现，后续根据 Runway API 文档补充
 */

import {
  VideoProvider,
  VideoSubmitParams,
  VideoSubmitResult,
  VideoGenerationResult,
  VideoProviderContext,
  VideoProviderError,
} from './types';

export class RunwayVideoProvider implements VideoProvider {
  readonly name = 'runway' as const;
  readonly displayName = 'Runway Gen-3';

  readonly supportedFeatures = {
    textToVideo: true,
    imageToVideo: true,
    maxDuration: 10,
    supportedRatios: ['16:9', '9:16'] as const,
  };

  transformConfig(userConfig: VideoModelConfig) {
    return {
      aspect_ratio: userConfig.aspect_ratio,
      duration: parseInt(userConfig.duration),
    };
  }

  async submitTask(
    params: VideoSubmitParams,
    apiKey: string,
    context?: VideoProviderContext
  ): Promise<VideoSubmitResult> {
    // TODO: 实现 Runway API 调用
    throw new VideoProviderError(
      this.name,
      501,
      'Runway 适配器尚未实现，请使用 Sora2 或其他模型',
      {}
    );
  }

  async checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: VideoProviderContext
  ): Promise<VideoGenerationResult> {
    // TODO: 实现 Runway API 查询
    throw new VideoProviderError(
      this.name,
      501,
      'Runway 适配器尚未实现',
      {}
    );
  }
}
