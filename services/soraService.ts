/**
 * Sora 2 API 服务
 * 封装 Sora 2 文/图生视频 API 调用
 * 支持多个 API 提供商（速创、云雾等）
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

import { SoraTaskGroup, SplitStoryboardShot, Sora2UserConfig } from '../types';
import { getSoraModelById, getOSSConfig, DEFAULT_SORA2_CONFIG, getSoraProvider, getProviderApiKey } from './soraConfigService';
import { getUserDefaultModel } from './modelConfig';
import { logAPICall } from './apiLogger';
import { uploadFileToOSS } from './ossService';
import { getProvider } from './soraProviders';
import type { SoraSubmitResult, SoraVideoResult, SoraSubmitParams, CallContext } from './soraProviders/types';

// 重新导出类型供外部使用
export type { SoraSubmitResult, SoraVideoResult } from './soraProviders';

/**
 * 构建 Sora 2 分镜模式提示词
 */
export function buildSoraStoryPrompt(shots: SplitStoryboardShot[]): string {
  return shots.map((shot, index) => {
    const duration = shot.duration || 5;
    const scene = shot.visualDescription || '';

    return `Shot ${index + 1}:
duration: ${duration.toFixed(1)}sec
Scene: ${scene}`;
  }).join('\n\n');
}

/**
 * 提交 Sora 2 视频生成任务
 * 自动使用当前选择的 API 提供商
 */
export async function submitSoraTask(
  soraPrompt: string,
  referenceImageUrl?: string,
  sora2Config?: { aspect_ratio: '16:9' | '9:16'; duration: '10' | '15' | '25'; hd: boolean },
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraSubmitResult> {
  // 获取当前选择的提供商
  const providerName = getSoraProvider();
  const apiKey = getProviderApiKey();

  if (!apiKey) {
    const providerDisplay = providerName === 'sutu' ? '速创' : '云雾';
    throw new Error(`请先在设置中配置 ${providerDisplay} API Key`);
  }

  // 获取提供商实例
  const provider = getProvider(providerName);

  // 构建提交参数
  const params: SoraSubmitParams = {
    prompt: soraPrompt,
    referenceImageUrl,
    config: sora2Config || DEFAULT_SORA2_CONFIG,
  };


  // 防御性检查
  if (!params.config) {
    throw new Error('params.config 是 undefined，无法提交任务');
  }

  // 调用提供商的提交方法
  return logAPICall(
    'submitSoraTask',
    () => provider.submitTask(params, apiKey, context),
    {
      provider: providerName,
      aspectRatio: params.config.aspect_ratio,
      duration: params.config.duration,
      hd: params.config.hd,
      hasReferenceImage: !!referenceImageUrl,
      promptLength: soraPrompt.length,
      promptPreview: soraPrompt.substring(0, 200) + (soraPrompt.length > 200 ? '...' : ''),
    },
    context
  );
}

/**
 * 查询 Sora 任务进度
 * 自动使用当前选择的 API 提供商
 */
export async function checkSoraTaskStatus(
  taskId: string,
  onProgress?: (progress: number) => void,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  // 获取当前选择的提供商
  const providerName = getSoraProvider();
  const apiKey = getProviderApiKey();

  if (!apiKey) {
    const providerDisplay = providerName === 'sutu' ? '速创' : '云雾';
    throw new Error(`请先在设置中配置 ${providerDisplay} API Key`);
  }

  // 获取提供商实例
  const provider = getProvider(providerName);


  // 调用提供商的查询方法（不记录到API日志面板，避免日志过多）
  return provider.checkStatus(taskId, apiKey, onProgress, context);
}

/**
 * 轮询 Sora 任务直到完成
 */
export async function pollSoraTaskUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void,
  pollingInterval: number = 10000,  // 10 秒轮询间隔
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  let attempts = 0;
  const maxAttempts = 240; // 240 次 × 10 秒 = 40 分钟


  while (attempts < maxAttempts) {
    const result = await checkSoraTaskStatus(taskId, onProgress, context);


    // ⚠️ 检查是否返回了无效状态
    if (!result.status || typeof result.status === 'undefined') {
      console.error('[Sora Service] ❌ 收到无效状态，停止轮询:', {
        attempt: attempts + 1,
        taskId,
        status: result.status,
        statusType: typeof result.status,
        rawData: result._rawData
      });
      throw new Error(`API 返回了无效状态。可能是 API Key 无效、任务 ID 不存在，或 API 响应格式已变更。`);
    }

    // 支持多种完成状态
    const isCompleted = result.status === 'completed' ||
                       result.status === 'succeeded' ||
                       result.status === 'success' ||
                       result.status === 'SUCCESS' ||  // 支持大写
                       result.status === 'done' ||
                       result.status === 'finished';

    const isError = result.status === 'error' ||
                    result.status === 'failed' ||
                    result.status === 'failure' ||
                    result.status === 'FAILED';  // 支持大写

    // ⚠️ 重要：只根据状态判断完成，不要根据进度判断
    // 进度值只是估算的，不应该作为完成条件
    // 只有状态为 completed/succeeded/done/finished 时才认为任务完成
    // 并且必须有 videoUrl 才是真正的完成
    const hasVideoUrl = !!result.videoUrl;

    if (isCompleted && hasVideoUrl) {

      // 如果没有 videoUrl，检查其他可能的字段
      if (!result.videoUrl) {
        console.warn('[Sora Service] No videoUrl found, raw result:', result);
        // 尝试从原始数据中查找
        if (result._rawData) {
        }
      }

      return { ...result, status: 'completed' as const };
    }

    if (isError) {
      return { ...result, status: 'error' as const };
    }

    attempts++;

    // 等待后重试
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
  }

  // 超时前最后尝试一次查询
  const finalResult = await checkSoraTaskStatus(taskId, undefined, context);

  if (finalResult.videoUrl || finalResult.status === 'completed') {
    return { ...finalResult, status: 'completed' as const };
  }

  throw new Error('任务超时，请稍后手动查看结果');
}

/**
 * 完整的 Sora 视频生成流程
 */
export async function generateSoraVideo(
  taskGroup: SoraTaskGroup,
  onProgress?: (message: string, progress: number) => void,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  try {

    // 1. 检查是否已提交过任务
    if (taskGroup.soraTaskId && taskGroup.generationStatus === 'generating') {
      onProgress?.(`继续轮询任务 ${taskGroup.soraTaskId}...`, taskGroup.progress || 0);
    } else {
      // 2. 准备参考图片 URL（如果是 base64 则上传到 OSS）
      let referenceImageUrl = taskGroup.referenceImage;

      if (referenceImageUrl && referenceImageUrl.startsWith('data:')) {
        // Base64 格式，需要上传到 OSS
        onProgress?.('正在上传参考图片到 OSS...', 5);

        const ossConfig = getOSSConfig();
        if (!ossConfig) {
          throw new Error('图生视频需要配置 OSS，请先在设置中配置阿里云 OSS');
        }

        try {
          const fileName = `sora-reference-${taskGroup.id}-${Date.now()}.png`;
          referenceImageUrl = await uploadFileToOSS(referenceImageUrl, fileName, ossConfig);

          // 更新任务组的 referenceImage 为 OSS URL
          taskGroup.referenceImage = referenceImageUrl;
        } catch (error: any) {
          console.error('[Sora Service] Failed to upload reference image:', error);
          throw new Error(`参考图片上传失败: ${error.message}`);
        }
      }

      // 3. 提交新任务
      onProgress?.('正在提交 Sora 2 任务...', 10);


      if (!referenceImageUrl) {
        console.warn('[Sora Service] ⚠️ 警告: referenceImageUrl 为空，将不发送参考图到平台！');
        console.warn('[Sora Service] 💡 提示: 请先执行"融合图"操作以生成参考图');
      }

      const submitResult = await submitSoraTask(
        taskGroup.soraPrompt,
        referenceImageUrl,
        taskGroup.sora2Config,
        context
      );


      taskGroup.soraTaskId = submitResult.id;


      if (!taskGroup.soraTaskId) {
        throw new Error('提交任务后未返回有效的任务 ID');
      }

      taskGroup.generationStatus = 'generating';
    }

    // 3. 轮询直到完成
    onProgress?.('正在生成视频，请耐心等待...', 10);

    const result = await pollSoraTaskUntilComplete(
      taskGroup.soraTaskId!,
      (progress) => {
        taskGroup.progress = progress;
        onProgress?.(`视频生成中... ${progress}%`, progress);
      },
      5000,
      context
    );

    // 4. 更新状态
    if (result.status === 'completed') {
      taskGroup.generationStatus = 'completed';
      taskGroup.progress = 100;
      taskGroup.videoMetadata = {
        duration: parseFloat(result.duration || '0'),
        resolution: '1080p',
        fileSize: 0,
        createdAt: new Date()
      };
    } else if (result.status === 'error') {
      taskGroup.generationStatus = 'failed';
      // 使用具体的错误原因
      const errorReason = result.violationReason || result.quality || '生成失败，请重试';
      taskGroup.error = `生成失败: ${errorReason}`;
    }

    // ✅ 调试日志：返回前检查result.taskId

    return result;

  } catch (error: any) {
    console.error('[Sora Service] Generate video failed:', error);
    taskGroup.generationStatus = 'failed';
    taskGroup.error = error.message || '生成失败';
    throw error;
  }
}

/**
 * 批量生成多个任务组的视频
 */
export async function generateMultipleSoraVideos(
  taskGroups: SoraTaskGroup[],
  onProgress?: (taskIndex: number, message: string, progress: number) => void,
  context?: { nodeId?: string; nodeType?: string }
): Promise<Map<string, SoraVideoResult>> {
  const results = new Map<string, SoraVideoResult>();

  for (let i = 0; i < taskGroups.length; i++) {
    const taskGroup = taskGroups[i];

    try {
      onProgress?.(i, `正在生成任务组 ${taskGroup.taskNumber}...`, 0);

      const result = await generateSoraVideo(taskGroup, (msg, progress) => {
        onProgress?.(i, msg, progress);
      }, context);

      results.set(taskGroup.id, result);

      if (!result.isCompliant) {
        console.warn(`[Sora Service] Task ${taskGroup.taskNumber} violated content policy:`, result.violationReason);
      }

    } catch (error: any) {
      console.error(`[Sora Service] Task ${taskGroup.taskNumber} failed:`, error);
      results.set(taskGroup.id, {
        taskId: taskGroup.soraTaskId || taskGroup.id, // ✅ 优先使用soraTaskId
        status: 'error',
        progress: 0,
        quality: 'error',
        isCompliant: false
      });
    }
  }

  return results;
}
