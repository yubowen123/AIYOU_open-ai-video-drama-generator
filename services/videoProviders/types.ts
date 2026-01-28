/**
 * 视频生成模型统一接口定义
 * 支持多个视频生成模型：Sora2、Kling、Luma、Runway
 */

/**
 * 支持的视频模型类型
 */
export type VideoProviderType = 'sora2' | 'kling' | 'luma' | 'runway';

/**
 * 用户配置（统一格式）
 */
export interface VideoModelConfig {
  aspect_ratio: '16:9' | '9:16';
  duration: '5' | '10' | '15';
  quality: 'standard' | 'pro';
}

/**
 * 提交任务参数
 */
export interface VideoSubmitParams {
  prompt: string;
  referenceImageUrl?: string;
  config: VideoModelConfig;
}

/**
 * 提交结果
 */
export interface VideoSubmitResult {
  id: string;
  status: string;
  estimatedTime?: number; // 预计生成时间（秒）
}

/**
 * 视频生成结果
 */
export interface VideoGenerationResult {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  videoUrl?: string;
  videoDuration?: number;
  videoResolution?: string;
  error?: string;
}

/**
 * 调用上下文（用于日志）
 */
export interface VideoProviderContext {
  nodeId?: string;
  nodeType?: string;
  provider: VideoProviderType;
}

/**
 * 统一的视频生成模型接口
 */
export interface VideoProvider {
  // 提供商基本信息
  readonly name: VideoProviderType;
  readonly displayName: string;

  // 支持的功能
  readonly supportedFeatures: {
    textToVideo: boolean;
    imageToVideo: boolean;
    maxDuration: number; // 最大时长（秒）
    supportedRatios: Array<'16:9' | '9:16'>;
  };

  // 配置转换
  transformConfig(userConfig: VideoModelConfig): any;

  // 提交任务
  submitTask(
    params: VideoSubmitParams,
    apiKey: string,
    context?: VideoProviderContext
  ): Promise<VideoSubmitResult>;

  // 查询状态
  checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: VideoProviderContext
  ): Promise<VideoGenerationResult>;
}

/**
 * API 错误
 */
export class VideoProviderError extends Error {
  constructor(
    public provider: VideoProviderType,
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(`[${provider.toUpperCase()} API] ${statusCode}: ${message}`);
    this.name = 'VideoProviderError';
  }
}
