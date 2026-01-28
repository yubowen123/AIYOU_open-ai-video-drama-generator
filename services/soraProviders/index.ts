/**
 * Sora API 提供商注册和获取
 */

import { SoraProvider, SoraProviderType } from './types';
import { SutuProvider } from './sutuProvider';
import { YunwuProvider } from './yunwuProvider';
import { DayuapiProvider } from './dayuapiProvider';
import { KieProvider } from './kieProvider';

// 提供商实例注册表
const providers: Record<SoraProviderType, SoraProvider> = {
  sutu: new SutuProvider(),
  yunwu: new YunwuProvider(),
  dayuapi: new DayuapiProvider(),
  kie: new KieProvider(),
};

/**
 * 获取指定提供商实例
 * @param name 提供商名称
 * @returns 提供商实例
 * @throws 如果提供商不存在则抛出错误
 */
export function getProvider(name: SoraProviderType | string): SoraProvider {
  const provider = providers[name as SoraProviderType];
  if (!provider) {
    throw new Error(`未知的 API 提供商: ${name}，支持的提供商: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

/**
 * 获取所有可用的提供商列表
 */
export function getAllProviders(): SoraProvider[] {
  return Object.values(providers);
}

/**
 * 获取所有提供商的名称
 */
export function getProviderNames(): SoraProviderType[] {
  return Object.keys(providers) as SoraProviderType[];
}

/**
 * 检查提供商是否可用
 */
export function isProviderAvailable(name: string): name is SoraProviderType {
  return name in providers;
}

// 导出类型和提供商类
export type { SoraProvider, SoraProviderType, SoraSubmitParams, SoraSubmitResult, SoraVideoResult, Sora2UserConfig, CallContext } from './types';
export { SutuProvider } from './sutuProvider';
export { YunwuProvider } from './yunwuProvider';
export { DayuapiProvider } from './dayuapiProvider';
export { KieProvider } from './kieProvider';
export { SoraAPIError } from './types';
