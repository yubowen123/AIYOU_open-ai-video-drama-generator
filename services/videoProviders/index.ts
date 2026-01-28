/**
 * 视频生成模型提供商注册和获取
 */

import { VideoProvider, VideoProviderType } from './types';
import { Sora2VideoProvider } from './sora2Provider';
import { KlingVideoProvider } from './klingProvider';
import { LumaVideoProvider } from './lumaProvider';
import { RunwayVideoProvider } from './runwayProvider';

// 提供商实例注册表
const providers: Record<VideoProviderType, VideoProvider> = {
  sora2: new Sora2VideoProvider(),
  kling: new KlingVideoProvider(),
  luma: new LumaVideoProvider(),
  runway: new RunwayVideoProvider(),
};

/**
 * 获取指定提供商实例
 * @param name 提供商名称
 * @returns 提供商实例
 * @throws 如果提供商不存在则抛出错误
 */
export function getVideoProvider(name: VideoProviderType | string): VideoProvider {
  const provider = providers[name as VideoProviderType];
  if (!provider) {
    throw new Error(`未知的视频生成提供商: ${name}，支持的提供商: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

/**
 * 获取所有可用的提供商列表
 */
export function getAllVideoProviders(): VideoProvider[] {
  return Object.values(providers);
}

/**
 * 获取所有提供商的名称
 */
export function getVideoProviderNames(): VideoProviderType[] {
  return Object.keys(providers) as VideoProviderType[];
}

/**
 * 检查提供商是否可用
 */
export function isVideoProviderAvailable(name: string): name is VideoProviderType {
  return name in providers;
}

// 导出类型和提供商类
export type { VideoProvider, VideoProviderType, VideoSubmitParams, VideoSubmitResult, VideoGenerationResult, VideoModelConfig } from './types';
export { Sora2VideoProvider } from './sora2Provider';
export { KlingVideoProvider } from './klingProvider';
export { LumaVideoProvider } from './lumaProvider';
export { RunwayVideoProvider } from './runwayProvider';
export { VideoProviderError } from './types';
