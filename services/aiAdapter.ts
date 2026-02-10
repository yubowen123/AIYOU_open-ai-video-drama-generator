/**
 * AI Adapter - 提供统一的AI生成接口
 * 作为 llmProviderManager 的适配层，保持向后兼容
 */

import { llmProviderManager } from './llmProviders';
import { getUserDefaultModel } from './modelConfig';

export interface GenerateImageOptions {
    count?: number;
    aspectRatio?: string;
    style?: string;
}

/**
 * 使用当前提供商生成图片
 * @param prompt 图片生成提示词
 * @param model 模型名称（可选）
 * @param referenceImages 参考图片数组（可选）
 * @param options 生成选项（可选）
 * @returns 图片URL数组
 */
export const generateImageWithProvider = async (
    prompt: string,
    model?: string,
    referenceImages?: string[],
    options?: GenerateImageOptions
): Promise<string[]> => {
    const effectiveModel = model || getUserDefaultModel('image');


    // 如果设置了 aspectRatio，特别提示
    if (options?.aspectRatio) {
    }

    try {
        const imageUrls = await llmProviderManager.generateImages(
            prompt,
            effectiveModel,
            referenceImages,
            options
        );


        return imageUrls;
    } catch (error) {
        console.error('[aiAdapter] Image generation failed:', error);
        throw error;
    }
};

/**
 * 获取当前图片生成提供商名称
 */
export const getCurrentImageProvider = (): string => {
    return llmProviderManager.getCurrentProvider().getName();
};

/**
 * 检查当前提供商是否支持图片生成
 */
export const isImageGenerationSupported = (): boolean => {
    const provider = llmProviderManager.getCurrentProvider();
    return provider.getType() === 'gemini' || provider.getType() === 'yunwu';
};
