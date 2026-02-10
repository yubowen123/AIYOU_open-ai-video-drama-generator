/**
 * LLM 提供商管理器
 * 统一管理多个 LLM/图片生成 API 提供商
 */

import { LLMProvider, GenerateImageOptions } from './baseProvider';
import { GeminiProvider } from './geminiProvider';
import { YunwuProvider } from './yunwuProvider';
import { LLMProviderType } from '../../types';

/**
 * LLM 提供商管理器
 */
class LLMProviderManager {
  private providers: Map<LLMProviderType, LLMProvider>;

  constructor() {
    this.providers = new Map<LLMProviderType, LLMProvider>([
      ['gemini', new GeminiProvider()],
      ['yunwu', new YunwuProvider()]
    ]);

    // 监听 API Key 更新事件
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    window.addEventListener('apiKeyUpdated', () => {
      this.resetAllClients();
    });

    window.addEventListener('llmProviderUpdated', () => {
      this.resetAllClients();
    });
  }

  /**
   * 重置所有客户端
   */
  private resetAllClients(): void {
    this.providers.forEach(provider => {
      if ('resetClient' in provider) {
        (provider as any).resetClient();
      }
    });
  }

  /**
   * 获取当前选择的提供商
   */
  getCurrentProvider(): LLMProvider {
    const providerType = this.getCurrentProviderType();
    const provider = this.providers.get(providerType);

    if (!provider) {
      throw new Error(`Unknown provider type: ${providerType}`);
    }

    return provider;
  }

  /**
   * 获取当前提供商类型
   */
  getCurrentProviderType(): LLMProviderType {
    const savedProvider = localStorage.getItem('LLM_API_PROVIDER') as LLMProviderType;
    return savedProvider || 'gemini'; // 默认使用 Gemini
  }

  /**
   * 设置当前提供商
   */
  setCurrentProvider(provider: LLMProviderType): void {
    localStorage.setItem('LLM_API_PROVIDER', provider);
    this.resetAllClients();
  }

  /**
   * 获取指定类型的提供商
   */
  getProvider(type: LLMProviderType): LLMProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Unknown provider type: ${type}`);
    }
    return provider;
  }

  /**
   * 获取所有可用提供商
   */
  getAllProviders(): Map<LLMProviderType, LLMProvider> {
    return new Map(this.providers);
  }

  /**
   * 检查当前提供商的 API Key 是否已配置
   */
  isCurrentProviderConfigured(): boolean {
    const providerType = this.getCurrentProviderType();
    const apiKeyKey = providerType === 'gemini' ? 'GEMINI_API_KEY' : 'YUNWU_API_KEY';
    const apiKey = localStorage.getItem(apiKeyKey);
    return !!(apiKey && apiKey.trim());
  }

  /**
   * 获取当前提供商的 API Key
   */
  getCurrentProviderApiKey(): string | null {
    const providerType = this.getCurrentProviderType();
    const apiKeyKey = providerType === 'gemini' ? 'GEMINI_API_KEY' : 'YUNWU_API_KEY';
    const apiKey = localStorage.getItem(apiKeyKey);
    return apiKey?.trim() || null;
  }

  // === 便捷方法：直接调用当前提供商 ===

  /**
   * 生成文本内容
   */
  async generateContent(
    prompt: string,
    model: string,
    options?: { responseMimeType?: string; systemInstruction?: string }
  ): Promise<string> {
    const provider = this.getCurrentProvider();
    return provider.generateContent(prompt, model, options);
  }

  /**
   * 生成图片
   */
  async generateImages(
    prompt: string,
    model: string,
    referenceImages?: string[],
    options?: GenerateImageOptions
  ): Promise<string[]> {
    const provider = this.getCurrentProvider();
    return provider.generateImages(prompt, model, referenceImages, options);
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(apiKey: string, providerType?: LLMProviderType): Promise<boolean> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getCurrentProvider();
    return provider.validateApiKey(apiKey);
  }
}

// 导出单例实例
export const llmProviderManager = new LLMProviderManager();

// 导出类型和类
export type { LLMProvider, GenerateImageOptions, GenerateContentOptions } from './baseProvider';
export { GeminiProvider } from './geminiProvider';
export { YunwuProvider } from './yunwuProvider';
