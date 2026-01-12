/**
 * Gemini API 服务 - 带自动降级功能
 * 包装原有的 geminiService 函数，添加智能模型降级
 */

import * as GeminiService from './geminiService';
import { executeWithFallback, FallbackConfig, ModelExecutionResult } from './modelFallback';
import { getUserPriority, ModelCategory } from './modelConfig';

/**
 * 获取用户配置的优先级列表
 */
function getPriorityList(category: ModelCategory): string[] {
  return getUserPriority(category);
}

/**
 * 图片生成 - 带自动降级
 */
export async function generateImageWithFallback(
  prompt: string,
  initialModel: string,
  inputs?: string[],
  options?: any,
  context?: { nodeId?: string; nodeType?: string }
): Promise<string[]> {
  const priorityList = getPriorityList('image');
  const startIndex = priorityList.indexOf(initialModel);

  // 如果初始模型不在优先级列表中，使用默认顺序
  const models = startIndex >= 0
    ? priorityList.slice(startIndex)
    : priorityList;

  const result = await executeWithFallback<string[]>(
    async (modelId) => {
      return await GeminiService.generateImageFromText(
        prompt,
        modelId,
        inputs,
        options,
        context
      );
    },
    initialModel,
    {
      maxAttempts: models.length,
      excludedModels: [], // 不预先排除
      enableFallback: true,
      onModelFallback: (from, to, reason) => {
        console.log(`[图片生成] 模型降级: ${from} -> ${to} (${reason})`);

        // 显示降级通知给用户
        const event = new CustomEvent('model-fallback', {
          detail: {
            category: 'image',
            from,
            to,
            reason
          }
        });
        window.dispatchEvent(event);
      }
    }
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || '所有图片模型均不可用');
  }

  // 如果发生了降级，记录日志
  if (result.fallbackChain && result.fallbackChain.length > 1) {
    console.log(`[图片生成] 使用模型: ${result.model}, 尝试次数: ${result.attempts}, 降级链: ${result.fallbackChain.join(' -> ')}`);
  }

  return result.data;
}

/**
 * 视频生成 - 带自动降级
 */
export async function generateVideoWithFallback(
  prompt: string,
  initialModel: string,
  inputImage?: string,
  options?: any,
  context?: { nodeId?: string; nodeType?: string }
): Promise<string[]> {
  const priorityList = getPriorityList('video');
  const startIndex = priorityList.indexOf(initialModel);

  const models = startIndex >= 0
    ? priorityList.slice(startIndex)
    : priorityList;

  const result = await executeWithFallback<string[]>(
    async (modelId) => {
      return await GeminiService.generateVideo(
        prompt,
        modelId,
        inputImage,
        options,
        context
      );
    },
    initialModel,
    {
      maxAttempts: models.length,
      enableFallback: true,
      onModelFallback: (from, to, reason) => {
        console.log(`[视频生成] 模型降级: ${from} -> ${to} (${reason})`);

        const event = new CustomEvent('model-fallback', {
          detail: {
            category: 'video',
            from,
            to,
            reason
          }
        });
        window.dispatchEvent(event);
      }
    }
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || '所有视频模型均不可用');
  }

  if (result.fallbackChain && result.fallbackChain.length > 1) {
    console.log(`[视频生成] 使用模型: ${result.model}, 尝试次数: ${result.attempts}`);
  }

  return result.data;
}

/**
 * 文本生成（LLM）- 带自动降级
 * 用于剧本生成、角色创建等
 */
export async function generateTextWithFallback<T = string>(
  prompt: string,
  initialModel: string,
  systemInstruction?: string,
  context?: { nodeId?: string; nodeType?: string },
  parseJson?: boolean
): Promise<T> {
  const priorityList = getPriorityList('text');
  const startIndex = priorityList.indexOf(initialModel);

  const models = startIndex >= 0
    ? priorityList.slice(startIndex)
    : priorityList;

  const result = await executeWithFallback<T>(
    async (modelId) => {
      const ai = GeminiService.getClient();

      const contents = {
        parts: [{ text: prompt }]
      };

      const config: any = {
        model: modelId,
        contents
      };

      if (systemInstruction) {
        config.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await ai.models.generateContent(config);

      if (!response.response?.candidates?.[0]) {
        throw new Error('No response from model');
      }

      const text = response.response.candidates[0].content?.parts?.[0]?.text || '';

      if (parseJson) {
        // 尝试提取 JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as T;
        }
        throw new Error('No JSON found in response');
      }

      return text as T;
    },
    initialModel,
    {
      maxAttempts: models.length,
      enableFallback: true,
      onModelFallback: (from, to, reason) => {
        console.log(`[文本生成] 模型降级: ${from} -> ${to} (${reason})`);

        const event = new CustomEvent('model-fallback', {
          detail: {
            category: 'text',
            from,
            to,
            reason
          }
        });
        window.dispatchEvent(event);
      }
    }
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || '所有文本模型均不可用');
  }

  if (result.fallbackChain && result.fallbackChain.length > 1) {
    console.log(`[文本生成] 使用模型: ${result.model}, 尝试次数: ${result.attempts}`);
  }

  return result.data;
}

/**
 * 音频生成 - 带自动降级
 */
export async function generateAudioWithFallback(
  prompt: string,
  initialModel: string,
  context?: { nodeId?: string; nodeType?: string }
): Promise<string> {
  const priorityList = getPriorityList('audio');
  const startIndex = priorityList.indexOf(initialModel);

  const models = startIndex >= 0
    ? priorityList.slice(startIndex)
    : priorityList;

  const result = await executeWithFallback<string>(
    async (modelId) => {
      return await GeminiService.generateAudio(
        prompt,
        modelId,
        context
      );
    },
    initialModel,
    {
      maxAttempts: models.length,
      enableFallback: true,
      onModelFallback: (from, to, reason) => {
        console.log(`[音频生成] 模型降级: ${from} -> ${to} (${reason})`);

        const event = new CustomEvent('model-fallback', {
          detail: {
            category: 'audio',
            from,
            to,
            reason
          }
        });
        window.dispatchEvent(event);
      }
    }
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || '所有音频模型均不可用');
  }

  if (result.fallbackChain && result.fallbackChain.length > 1) {
    console.log(`[音频生成] 使用模型: ${result.model}, 尝试次数: ${result.attempts}`);
  }

  return result.data;
}

/**
 * 视频分析 - 带自动降级
 */
export async function analyzeVideoWithFallback(
  videoBase64: string,
  prompt: string,
  initialModel: string,
  context?: { nodeId?: string; nodeType?: string }
): Promise<string> {
  const priorityList = getPriorityList('text');
  const startIndex = priorityList.indexOf(initialModel);

  const models = startIndex >= 0
    ? priorityList.slice(startIndex)
    : priorityList;

  const result = await executeWithFallback<string>(
    async (modelId) => {
      return await GeminiService.analyzeVideo(
        videoBase64,
        prompt,
        context
      );
    },
    initialModel,
    {
      maxAttempts: models.length,
      enableFallback: true,
      onModelFallback: (from, to, reason) => {
        console.log(`[视频分析] 模型降级: ${from} -> ${to} (${reason})`);
      }
    }
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || '所有文本模型均不可用');
  }

  return result.data;
}

// 导出原始服务的其他函数（不需要降级的）
export {
  generateImageFromText,
  generateVideo,
  generateAudio,
  analyzeVideo,
  editImageWithText,
  planStoryboard,
  orchestrateVideoPrompt,
  compileMultiFramePrompt,
  urlToBase64,
  extractLastFrame,
  generateScriptPlanner,
  generateScriptEpisodes,
  generateCinematicStoryboard,
  extractCharactersFromText,
  generateCharacterProfile,
  generateSupportingCharacter,
  detectTextInImage,
  analyzeDrama,
  generateStylePreset,
  getClient,
  sendChatMessage
} from './geminiService';

// 导出类型
export type { FallbackConfig, ModelExecutionResult } from './modelFallback';
