/**
 * Luma Dream Machine 视频生成模型适配器
 * 占位符实现，后续根据 Luma API 文档补充
 */

import {
  VideoProvider,
  VideoSubmitParams,
  VideoSubmitResult,
  VideoGenerationResult,
  VideoProviderContext,
  VideoProviderError,
} from './types';

export class LumaVideoProvider implements VideoProvider {
  readonly name = 'luma' as const;
  readonly displayName = 'Luma Dream Machine';

  readonly supportedFeatures = {
    textToVideo: true,
    imageToVideo: true,
    maxDuration: 5,
    supportedRatios: ['16:9'] as const, // Luma 可能只支持横屏
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
    // TODO: 实现 Luma API 调用
    throw new VideoProviderError(
      this.name,
      501,
      'Luma 适配器尚未实现，请使用 Sora2 或其他模型',
      {}
    );
  }

  async checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: VideoProviderContext
  ): Promise<VideoGenerationResult> {
    // TODO: 实现 Luma API 查询
    throw new VideoProviderError(
      this.name,
      501,
      'Luma 适配器尚未实现',
      {}
    );
  }
}
