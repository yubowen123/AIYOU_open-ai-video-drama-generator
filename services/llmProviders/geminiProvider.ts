/**
 * Gemini API 提供商实现
 * 使用 Google 官方 Gemini API
 */

import { GoogleGenAI } from '@google/genai';
import { LLMProvider, GenerateImageOptions, GenerateContentOptions } from './baseProvider';
import { LLMProviderType } from '../../types';
import { logAPICall } from '../apiLogger';

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI | null = null;

  getType(): LLMProviderType {
    return 'gemini';
  }

  getName(): string {
    return 'Gemini API (Google Official)';
  }

  /**
   * 获取 API Key
   */
  private getApiKey(): string | null {
    const userApiKey = localStorage.getItem('GEMINI_API_KEY');
    if (userApiKey && userApiKey.trim()) {
      return userApiKey.trim();
    }
    return null;
  }

  /**
   * 获取客户端实例（单例模式）
   */
  getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * 重置客户端（当 API Key 更新时调用）
   */
  resetClient(): void {
    this.client = null;
  }

  /**
   * 生成文本内容
   */
  async generateContent(
    prompt: string,
    model: string,
    options?: GenerateContentOptions
  ): Promise<string> {
    const client = this.getClient();

    const config: any = {};
    if (options?.responseMimeType) {
      config.responseMimeType = options.responseMimeType;
    }
    if (options?.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    const response = await client.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: Object.keys(config).length > 0 ? config : undefined
    });

    return response.text || '';
  }

  /**
   * 生成图片（返回图片数组）
   */
  async generateImages(
    prompt: string,
    model: string,
    referenceImages?: string[],
    options?: GenerateImageOptions
  ): Promise<string[]> {
    const client = this.getClient();

    // 构建请求内容
    const parts: any[] = [{ text: prompt }];

    // 添加参考图片
    if (referenceImages && referenceImages.length > 0) {
      for (const imageBase64 of referenceImages) {
        parts.push({
          inlineData: {
            data: imageBase64.split(',')[1] || imageBase64,
            mimeType: 'image/jpeg'
          }
        });
      }
    }

    const generationConfig: any = {
      responseModalities: ['TEXT', 'IMAGE']
    };

    // 添加宽高比和分辨率配置（Google GenAI SDK 使用 imageConfig）
    if (options?.aspectRatio || options?.resolution) {
      generationConfig.imageConfig = {};

      if (options.aspectRatio) {
        generationConfig.imageConfig.aspectRatio = options.aspectRatio;
      }

      if (options.resolution) {
        generationConfig.imageConfig.image_size = options.resolution;
      }
    }

    if (options?.count) {
      generationConfig.numberOfImages = options.count;
    }

    // 使用 logAPICall 记录API调用
    return logAPICall(
      'geminiGenerateImages',
      async () => {
        const result = await client.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: generationConfig
        });

        // 提取图片数据（支持多张图片）
        const images: string[] = [];
        if (result.candidates && result.candidates[0]) {
          const candidateParts = result.candidates[0].content?.parts || [];
          for (const part of candidateParts) {
            if (part.inlineData && part.inlineData.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              images.push(`data:${mimeType};base64,${part.inlineData.data}`);
            }
          }
        }

        if (images.length === 0) {
          throw new Error('No images generated');
        }

        return images;
      },
      {
        model,
        prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
        enhancedPrompt: prompt,
        inputImagesCount: referenceImages?.length || 0,
        generationConfig
      },
      { platform: 'Google Gemini', logType: 'submission' }
    );
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    } catch (error) {
      console.error('Failed to validate Gemini API key:', error);
      return false;
    }
  }
}
