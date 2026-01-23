/**
 * Sora API 提供商统一类型定义
 */

// API 提供商类型
export type SoraProviderType = 'sutu' | 'yunwu';

// 用户配置（UI 层面）- 与当前系统保持一致
export interface Sora2UserConfig {
  aspect_ratio: '16:9' | '9:16';
  duration: '10' | '15' | '25';
  hd: boolean;
}

// 提交任务参数
export interface SoraSubmitParams {
  prompt: string;
  referenceImageUrl?: string;
  config: Sora2UserConfig;
}

// 提交任务结果
export interface SoraSubmitResult {
  id: string;
  status: string;
  progress: number;
  createdAt: number;
}

// 视频生成结果
export interface SoraVideoResult {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  videoUrl?: string;
  videoUrlWatermarked?: string;
  duration?: string;
  quality: string;
  isCompliant: boolean;
  violationReason?: string;
  _rawData?: any; // 用于调试
}

// 调用上下文（用于日志）
export interface CallContext {
  nodeId?: string;
  nodeType?: string;
}

// 提供商特定配置
export interface ProviderSpecificConfig {
  [key: string]: any;
}

/**
 * Sora API 提供商统一接口
 * 所有提供商必须实现此接口
 */
export interface SoraProvider {
  // 提供商名称
  readonly name: SoraProviderType;

  // 显示名称
  readonly displayName: string;

  /**
   * 将用户配置转换为提供商特定的配置
   */
  transformConfig(userConfig: Sora2UserConfig): ProviderSpecificConfig;

  /**
   * 提交视频生成任务
   * @param params 任务参数
   * @param apiKey API Key
   * @param context 调用上下文
   * @returns 提交结果
   */
  submitTask(
    params: SoraSubmitParams,
    apiKey: string,
    context?: CallContext
  ): Promise<SoraSubmitResult>;

  /**
   * 查询任务状态
   * @param taskId 任务 ID
   * @param apiKey API Key
   * @param onProgress 进度回调
   * @param context 调用上下文
   * @returns 任务状态
   */
  checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: CallContext
  ): Promise<SoraVideoResult>;
}

/**
 * API 错误
 */
export class SoraAPIError extends Error {
  constructor(
    public provider: SoraProviderType,
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(`[${provider.toUpperCase()} API] ${statusCode}: ${message}`);
    this.name = 'SoraAPIError';
  }
}
