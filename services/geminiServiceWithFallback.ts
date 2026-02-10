/**
 * Gemini API 服务 - 带自动降级功能
 * 包装 geminiService 和 aiAdapter 函数，添加智能模型降级
 * 支持 Google Gemini API 和 云雾 API
 */

import * as GeminiService from './geminiService';
import { generateImageWithProvider } from './aiAdapter';
import { executeWithFallback, FallbackConfig, ModelExecutionResult } from './modelFallback';
import { getUserPriority, ModelCategory } from './modelConfig';
import { getAIProviderType } from './aiProviders';

/**
 * 获取用户配置的优先级列表
 */
function getPriorityList(category: ModelCategory): string[] {
  return getUserPriority(category);
}

/**
 * 图片生成 - 带自动降级
 * 根据配置自动选择使用 Google API 或 云雾 API
 */
export async function generateImageWithFallback(
  prompt: string,
  initialModel: string,
  inputs?: string[],
  options?: any,
  context?: { nodeId?: string; nodeType?: string }
): Promise<string[]> {
  // 检查当前使用的 Provider
  const providerType = getAIProviderType();

  // 如果使用云雾 API，直接调用 Provider（云雾 API 有自己的降级逻辑）
  if (providerType === 'yunwu') {
    return await generateImageWithProvider(
      prompt,
      initialModel,
      inputs,
      options
    );
  }

  // 使用 Google API，启用模型降级
  const priorityList = getPriorityList('image');
  const startIndex = priorityList.indexOf(initialModel);

  // 如果初始模型不在优先级列表中，使用默认顺序
  const models = startIndex >= 0
    ? priorityList.slice(startIndex)
    : priorityList;

  const result = await executeWithFallback<string[]>(
    async (modelId) => {
      return await generateImageWithProvider(
        prompt,
        modelId,
        inputs,
        options
      );
    },
    initialModel,
    {
      maxAttempts: models.length,
      retryOnSameModel: 2, // 在同一模型上重试 2 次后，再降级到下一个模型
      excludedModels: [], // 不预先排除
      enableFallback: true,
      onModelFallback: (from, to, reason) => {

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
      retryOnSameModel: 1, // 视频生成在同一模型上重试 1 次
      enableFallback: true,
      onModelFallback: (from, to, reason) => {

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
  getClient
} from './geminiService';

// 导出类型
export type { FallbackConfig, ModelExecutionResult } from './modelFallback';
