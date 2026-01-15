/**
 * Sora 2 API 服务
 * 封装 Sora 2 文/图生视频 API 调用
 */

import { SoraTaskGroup, SplitStoryboardShot } from '../types';
import { getSoraApiKey, getSoraModelById } from './soraConfigService';
import { getUserDefaultModel } from './modelConfig';
import { logAPICall } from './apiLogger';

export interface SoraSubmitResult {
  id: string;
  object: string;
  model: string;
  status: string;
  progress: number;
  createdAt: number;
  size: string;
}

export interface SoraVideoResult {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  videoUrl?: string; // 无水印视频
  videoUrlWatermarked?: string; // 有水印视频
  duration?: string;
  quality: string;
  isCompliant: boolean;
  violationReason?: string;
}

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
 * 使用 AI 生成增强的 Sora 2 提示词
 * 包含镜头、运镜、拍摄视角等专业影视术语
 */
export async function buildEnhancedSoraPrompt(shots: SplitStoryboardShot[]): Promise<string> {
  // 构建提示词，让AI添加影视专业术语
  const shotDescriptions = shots.map((shot, index) => {
    return `镜头 ${shot.shotNumber}:
- 时长: ${shot.duration}秒
- 景别: ${shot.shotSize}
- 角度: ${shot.cameraAngle}
- 运镜: ${shot.cameraMovement}
- 场景描述: ${shot.visualDescription}
- 对话/音效: ${shot.dialogue || '无'}
- 视觉特效: ${shot.visualEffects || '无'}`;
  }).join('\n\n');

  const systemPrompt = `你是一位专业的影视导演和视频制作专家。请根据提供的分镜信息，生成适合 Sora 2 AI 视频生成的专业提示词。

要求：
1. 保留原始场景描述的核心内容
2. 添加专业影视术语（但不改变原意）：
   - 景别（大远景、远景、全景、中景、中近景、近景、特写、大特写）
   - 运镜方式（固定、横移、俯仰、横摇、升降、轨道推拉、变焦推拉、正跟随、倒跟随、环绕、滑轨横移）
   - 拍摄角度（视平、高位俯拍、低位仰拍、斜拍、越肩、鸟瞰）
   - 灯光氛围（自然光、侧光、逆光、柔光等）
   - 转场效果（淡入淡出、交叉溶解、硬切等）
3. 格式化为 Sora 2 story mode，每个镜头包含 duration 和 Scene
4. Scene 中融合：画面描述 + 镜头语言 + 氛围描述
5. 适当添加细节使画面更生动，但不要大幅改变原意

输出格式示例：
Shot 1:
duration: 3.0sec
Scene: [特写镜头] 人物面部表情细腻，使用柔光照明营造温暖氛围，缓慢推镜头突出情感

Shot 2:
duration: 4.0sec
Scene: [中景跟拍] 人物在街道行走，手持摄影机跟随，背景虚化营造景深效果，侧光增强立体感

请生成优化后的提示词：`;

  const userPrompt = `以下是需要优化的分镜信息：

${shotDescriptions}

请按照要求生成适合 Sora 2 的优化提示词。`;

  try {
    // 调用 Gemini API
    const { generateText } = await import('./geminiService');
    const enhancedPrompt = await generateText(
      systemPrompt + '\n\n' + userPrompt,
      getUserDefaultModel('text')
    );

    return enhancedPrompt;
  } catch (error) {
    console.error('[Sora Service] AI prompt enhancement failed, using basic prompt:', error);
    // 如果 AI 生成失败，回退到基础提示词
    return buildSoraStoryPrompt(shots);
  }
}

/**
 * 提交 Sora 2 视频生成任务
 */
export async function submitSoraTask(
  soraPrompt: string,
  modelId: string,
  referenceImageUrl?: string,
  isStoryMode: boolean = true,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraSubmitResult> {
  const apiKey = getSoraApiKey();
  if (!apiKey) {
    throw new Error('请先在设置中配置 Sora 2 API Key');
  }

  const model = getSoraModelById(modelId);
  if (!model) {
    throw new Error(`未找到模型: ${modelId}`);
  }

  const requestBody = {
    prompt: soraPrompt,
    model: modelId,
    size: apiKey,
    input_reference: referenceImageUrl,
    is_story: isStoryMode ? '1' : undefined
  };

  return logAPICall(
    'submitSoraTask',
    async () => {
      const response = await fetch('https://ai.yijiarj.cn/v1/videos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sora API 错误: ${response.status} - ${errorText}`);
      }

      const result: SoraSubmitResult = await response.json();
      return result;
    },
    {
      model: model.name,
      duration: model.duration,
      hasReferenceImage: !!referenceImageUrl,
      isStoryMode,
      promptLength: soraPrompt.length,
      promptPreview: soraPrompt.substring(0, 200) + (soraPrompt.length > 200 ? '...' : '')
    },
    context
  );
}

/**
 * 查询 Sora 任务进度
 */
export async function checkSoraTaskStatus(
  taskId: string,
  onProgress?: (progress: number) => void,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  const apiKey = getSoraApiKey();
  if (!apiKey) {
    throw new Error('请先在设置中配置 Sora 2 API Key');
  }

  return logAPICall(
    'checkSoraTaskStatus',
    async () => {
      const response = await fetch(`https://ai.yijiarj.cn/v1/videos/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sora API 错误: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      // 更新进度
      if (onProgress && data.progress !== undefined) {
        onProgress(data.progress);
      }

      return {
        taskId: data.id,
        status: data.status,
        progress: data.progress,
        videoUrl: data.url,
        videoUrlWatermarked: data.size,
        duration: data.seconds,
        quality: data.quality,
        isCompliant: data.quality === 'standard',
        violationReason: data.quality !== 'standard' ? data.quality : undefined
      };
    },
    {
      taskId,
      hasProgressCallback: !!onProgress
    },
    context
  );
}

/**
 * 轮询 Sora 任务直到完成
 */
export async function pollSoraTaskUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void,
  pollingInterval: number = 5000,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  let attempts = 0;
  const maxAttempts = 120; // 最多轮询 120 次（10分钟）

  while (attempts < maxAttempts) {
    const result = await checkSoraTaskStatus(taskId, onProgress, context);

    if (result.status === 'completed' || result.status === 'error') {
      console.log('[Sora Service] Task completed:', {
        taskId,
        status: result.status,
        isCompliant: result.isCompliant
      });
      return result;
    }

    attempts++;
    console.log(`[Sora Service] Polling attempt ${attempts}/${maxAttempts}, progress: ${result.progress}%`);

    // 等待后重试
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
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
      // 2. 提交新任务
      onProgress?.('正在提交 Sora 2 任务...', 0);

      const submitResult = await submitSoraTask(
        taskGroup.soraPrompt,
        taskGroup.soraModelId || 'sora-2-yijia',
        taskGroup.referenceImage,
        true,
        context
      );

      taskGroup.soraTaskId = submitResult.id;
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
      taskGroup.error = '生成失败，请重试';
    }

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
        taskId: taskGroup.id,
        status: 'error',
        progress: 0,
        quality: 'error',
        isCompliant: false
      });
    }
  }

  return results;
}
