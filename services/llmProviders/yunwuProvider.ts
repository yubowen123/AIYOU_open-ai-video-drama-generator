/**
 * 云雾 API 提供商实现
 * 使用云雾 API (https://yunwu.ai)
 * 兼容 Gemini 原生格式
 */

import { LLMProvider, GenerateImageOptions, GenerateContentOptions } from './baseProvider';
import { LLMProviderType } from '../../types';
import { logAPICall } from '../apiLogger';

export class YunwuProvider implements LLMProvider {
  private readonly BASE_URL = 'https://yunwu.ai';

  getType(): LLMProviderType {
    return 'yunwu';
  }

  getName(): string {
    return '云雾 API (Yunwu)';
  }

  /**
   * 获取 API Key
   */
  private getApiKey(): string | null {
    const userApiKey = localStorage.getItem('YUNWU_API_KEY');
    if (userApiKey && userApiKey.trim()) {
      return userApiKey.trim();
    }
    return null;
  }

  /**
   * 获取客户端实例
   * 云雾 API 不支持 GoogleGenAI SDK，返回 null
   */
  getClient(): any {
    return null;
  }

  /**
   * 构建云雾 API 请求 URL
   */
  private buildUrl(endpoint: string, apiKey: string): string {
    return `${this.BASE_URL}${endpoint}?key=${apiKey}`;
  }

  /**
   * 生成文本内容
   */
  async generateContent(
    prompt: string,
    model: string,
    options?: GenerateContentOptions
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('YUNWU_API_KEY_NOT_CONFIGURED');
    }

    const endpoint = `/v1beta/models/${model}:generateContent`;
    const url = this.buildUrl(endpoint, apiKey);

    const requestBody: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    };

    // 构建生成配置
    if (options?.responseMimeType || options?.systemInstruction) {
      requestBody.generationConfig = {};

      if (options.responseMimeType) {
        requestBody.generationConfig.responseMimeType = options.responseMimeType;
      }

      if (options.systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: options.systemInstruction }]
        };
      }
    }


    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[YunwuProvider] API Error:', error);
      throw new Error(error.error?.message || '云雾 API 内容生成失败');
    }

    const data = await response.json();

    // 提取文本响应 - 云雾API可能返回多个parts，需要过滤掉thought部分
    const parts = data.candidates?.[0]?.content?.parts || [];

    // 过滤掉thought为true的部分，只保留实际内容
    const contentParts = parts.filter((part: any) => !part.thought);

    // 拼接所有非thought部分的文本
    const text = contentParts
      .map((part: any) => part.text || '')
      .filter((t: string) => t.trim())
      .join('\n\n');

    return text;
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
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('YUNWU_API_KEY_NOT_CONFIGURED');
    }

    const endpoint = `/v1beta/models/${model}:generateContent`;
    const url = this.buildUrl(endpoint, apiKey);

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

    const requestBody: any = {
      contents: [
        {
          role: 'user',
          parts
        }
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    // 添加宽高比和分辨率配置
    if (options?.aspectRatio || options?.resolution) {
      requestBody.generationConfig.imageConfig = {};

      if (options.aspectRatio) {
        requestBody.generationConfig.imageConfig.aspectRatio = options.aspectRatio;
      }

      if (options.resolution) {
        requestBody.generationConfig.imageConfig.imageSize = options.resolution;
      }
    }

    if (options?.count) {
      requestBody.generationConfig.numberOfImages = options.count;
    }

    // 使用 logAPICall 记录API调用
    return logAPICall(
      'yunwuGenerateImages',
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || '云雾 API 图片生成失败');
        }

        const data = await response.json();

        // 提取图片数据（支持多张图片）
        const images: string[] = [];
        if (data.candidates && data.candidates[0]) {
          const parts = data.candidates[0].content?.parts || [];
          for (const part of parts) {
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
        generationConfig: {
          aspectRatio: options?.aspectRatio,
          resolution: options?.resolution,
          count: options?.count
        }
      },
      { platform: '云雾 API', logType: 'submission' }
    );
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    } catch (error) {
      console.error('Failed to validate Yunwu API key:', error);
      return false;
    }
  }
}
