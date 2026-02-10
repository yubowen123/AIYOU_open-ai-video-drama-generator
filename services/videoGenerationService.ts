/**
 * 视频生成服务 - 上层封装
 * 处理完整的视频生成流程：提交、轮询、超时处理
 * 支持多平台、多模型架构
 */

import { VideoPlatformType, VideoModelType, VideoGenerationRequest, UnifiedVideoConfig } from './videoPlatforms';
import { getPlatformProvider } from './videoPlatforms';

/**
 * 从分镜生成视频的完整流程
 *
 * @param platformCode 视频生成平台
 * @param model 视频生成模型
 * @param prompt 视频生成提示词
 * @param referenceImageUrl 参考图片URL（可选）
 * @param config 模型配置
 * @param apiKey API密钥
 * @param options 选项
 * @param subModel 子模型（可选）
 * @returns 视频生成结果
 */
export async function generateVideoFromStoryboard(
  platformCode: VideoPlatformType,
  model: VideoModelType,
  prompt: string,
  referenceImageUrl: string | undefined,
  config: UnifiedVideoConfig,
  apiKey: string,
  options: {
    onProgress?: (message: string, progress: number) => void;
    signal?: AbortSignal; // 取消信号
    timeout?: number; // 超时时间（毫秒）
    subModel?: string; // 子模型
  } = {}
): Promise<{
  videoUrl: string;
  taskId: string;
  duration: number;
  resolution: string;
}> {

  const platform = getPlatformProvider(platformCode);
  const { subModel } = options;  // 提取 subModel

  try {
    // 1. 构建请求参数
    const requestParams: VideoGenerationRequest = {
      prompt,
      referenceImageUrl,
      config
    };

    // 2. 提交任务
    options.onProgress?.('正在提交视频生成任务...', 0);

    const submitResult = await platform.submitTask(
      model,
      requestParams,
      apiKey,
      { platform: platformCode },
      subModel  // 传递 subModel
    );


    // 3. 轮询进度
    let attempts = 0;
    const maxAttempts = options.timeout
      ? Math.floor(options.timeout / 5000)
      : 120; // 默认最多120次（10分钟）

    while (attempts < maxAttempts) {
      // 检查是否被取消
      if (options.signal?.aborted) {
        throw new Error('任务已取消');
      }

      const result = await platform.checkStatus(
        model,
        submitResult.taskId,
        apiKey,
        { platform: platformCode }
      );

      // 报告进度
      options.onProgress?.(
        `正在生成视频... (${result.progress}%)`,
        result.progress
      );

      if (result.status === 'completed') {
        options.onProgress?.('视频生成完成！', 100);


        return {
          videoUrl: result.videoUrl!,
          taskId: result.taskId,
          duration: result.videoDuration || 0,
          resolution: result.videoResolution || 'unknown',
        };
      }

      if (result.status === 'error') {
        throw new Error(result.error || '视频生成失败');
      }

      // 等待5秒后重试（支持取消）
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, 5000);
        
        // 如果收到取消信号，清除定时器并拒绝
        if (options.signal) {
          const abortHandler = () => {
            clearTimeout(timeoutId);
            reject(new Error('任务已取消'));
          };
          
          if (options.signal.aborted) {
            abortHandler();
          } else {
            options.signal.addEventListener('abort', abortHandler, { once: true });
          }
        }
      });
      
      attempts++;
    }

    throw new Error('视频生成超时');

  } catch (error: any) {
    console.error('[VideoGeneration] 视频生成失败:', error);
    throw new Error(`视频生成失败: ${error.message}`);
  }
}

/**
 * 取消视频生成任务
 * 注意：目前大多数视频生成API不支持真正的取消，
 * 此函数主要用于清理状态和停止轮询
 *
 * @param platformCode 视频生成平台
 * @param model 视频生成模型
 * @param taskId 任务ID
 * @param apiKey API密钥
 */
export async function cancelVideoGeneration(
  platformCode: VideoPlatformType,
  model: VideoModelType,
  taskId: string,
  apiKey: string
): Promise<void> {
  
  // 目前云雾API等平台不支持取消任务
  // 这里只是记录日志，实际的取消通过 AbortController 实现
}
