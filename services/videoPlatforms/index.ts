/**
 * 视频平台提供商注册表
 * 统一管理所有视频生成平台
 */

import {
  VideoPlatformProvider,
  VideoPlatformType,
  VideoModelType
} from './types';
import { yunwuapiPlatform } from './yunwuapiProvider';

/**
 * 平台提供商注册表
 */
const platformProviders: Record<VideoPlatformType, VideoPlatformProvider> = {
  yunwuapi: yunwuapiPlatform,
  // 未来可以添加更多平台
  // official: officialPlatform,
  // custom: customPlatform
};

/**
 * 获取平台提供商
 * @param platformCode 平台代码
 * @returns 平台提供商实例
 * @throws 如果平台不存在则抛出错误
 */
export function getPlatformProvider(platformCode: VideoPlatformType): VideoPlatformProvider {
  const provider = platformProviders[platformCode];
  if (!provider) {
    throw new Error(`未知的视频生成平台: ${platformCode}`);
  }
  return provider;
}

/**
 * 获取所有已注册的平台
 * @returns 平台代码数组
 */
export function getRegisteredPlatforms(): VideoPlatformType[] {
  return Object.keys(platformProviders) as VideoPlatformType[];
}

/**
 * 获取指定平台支持的模型列表
 * @param platformCode 平台代码
 * @returns 模型类型数组
 */
export function getSupportedModels(platformCode: VideoPlatformType): VideoModelType[] {
  const provider = getPlatformProvider(platformCode);
  return provider.supportedModels;
}

/**
 * 检查平台是否支持指定模型
 * @param platformCode 平台代码
 * @param model 模型类型
 * @returns 是否支持
 */
export function isModelSupported(platformCode: VideoPlatformType, model: VideoModelType): boolean {
  try {
    const provider = getPlatformProvider(platformCode);
    return provider.supportedModels.includes(model);
  } catch {
    return false;
  }
}

/**
 * 检查模型是否支持图生视频
 * @param platformCode 平台代码
 * @param model 模型类型
 * @returns 是否支持
 */
export function supportsImageToVideo(platformCode: VideoPlatformType, model: VideoModelType): boolean {
  try {
    const provider = getPlatformProvider(platformCode);
    return provider.supportsImageToVideo(model);
  } catch {
    return false;
  }
}

/**
 * 检查模型是否支持指定时长
 * @param platformCode 平台代码
 * @param model 模型类型
 * @param duration 时长
 * @returns 是否支持
 */
export function supportsDuration(
  platformCode: VideoPlatformType,
  model: VideoModelType,
  duration: string
): boolean {
  try {
    const provider = getPlatformProvider(platformCode);
    return provider.supportsDuration(model, duration);
  } catch {
    return false;
  }
}

/**
 * 导出类型
 */
export * from './types';
export { yunwuapiPlatform } from './yunwuapiProvider';
