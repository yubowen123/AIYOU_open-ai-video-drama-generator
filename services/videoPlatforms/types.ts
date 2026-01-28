/**
 * 多平台视频生成模型架构
 * 支持多个三方平台，每个平台支持多个视频模型
 */

/**
 * 支持的三方平台类型
 */
export type VideoPlatformType = 'yunwuapi' | 'official' | 'custom';

/**
 * 支持的视频模型类型（在 yunwuapi 平台上）
 */
export type VideoModelType =
  | 'veo'           // Veo 视频生成
  | 'luma'          // Luma Dream Machine
  | 'runway'        // Runway Gen-3
  | 'minimax'       // 海螺
  | 'volcengine'    // 豆包
  | 'grok'          // Grok
  | 'qwen'          // 通义万象
  | 'sora';         // Sora

/**
 * 统一的视频生成配置
 */
export interface UnifiedVideoConfig {
  aspect_ratio: '16:9' | '9:16';
  duration: '5' | '10' | '15' | '25';
  quality: 'standard' | 'pro' | 'hd';
}

/**
 * 视频生成请求参数
 */
export interface VideoGenerationRequest {
  prompt: string;
  referenceImageUrl?: string;
  config: UnifiedVideoConfig;
}

/**
 * 视频生成结果
 */
export interface VideoGenerationResult {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  videoUrl?: string;
  videoDuration?: number;
  videoResolution?: string;
  coverUrl?: string;
  error?: string;
}

/**
 * 平台提供商接口
 * 每个三方平台实现此接口
 */
export interface VideoPlatformProvider {
  readonly platformCode: VideoPlatformType;
  readonly platformName: string;
  readonly supportedModels: VideoModelType[];

  /**
   * 检查模型是否支持图生视频
   */
  supportsImageToVideo(model: VideoModelType): boolean;

  /**
   * 检查模型是否支持某时长
   */
  supportsDuration(model: VideoModelType, duration: string): boolean;

  /**
   * 提交视频生成任务
   */
  submitTask(
    model: VideoModelType,
    params: VideoGenerationRequest,
    apiKey: string,
    context?: any
  ): Promise<{ taskId: string }>;

  /**
   * 查询任务状态
   */
  checkStatus(
    model: VideoModelType,
    taskId: string,
    apiKey: string,
    context?: any
  ): Promise<VideoGenerationResult>;
}

/**
 * API Key 配置存储结构
 */
export interface VideoAPIKeys {
  // 平台级别的 API Key
  yunwuapi?: string;    // 云雾 API Key
  // 未来其他平台的 Key
  otherProvider?: string;
}
