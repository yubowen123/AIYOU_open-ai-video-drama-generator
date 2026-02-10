/**
 * Sora 2 配置管理服务
 * 管理 Sora API Key、OSS 配置、存储路径等
 */

import { SoraStorageConfig, OSSConfig, SoraModel } from '../types';
import { SoraProviderType } from './soraProviders';

const SORA_CONFIG_KEY = 'sora_storage_config';
const OSS_CONFIG_KEY = 'sora_oss_config';
const SORA_MODELS_KEY = 'sora_models';

// API 提供商类型
export type { SoraProviderType } from './soraProviders';

// ✅ 官方模型列表（从 Yi 官网配置中心获取）
// 测试时间: 2025-01-14
export const DEFAULT_SORA_MODELS: SoraModel[] = [
  // 基础版 (全部 720p)
  {
    id: 'sora-2-15s-yijia',
    name: 'Sora 2 (15秒竖屏)',
    duration: 15,
    aspectRatio: '9:16',
    resolution: '1280x720',
    description: '15秒竖屏基础版',
    price: 0.240,
    endpointType: 'openai-video',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '竖屏']
  },
  {
    id: 'sora-2-landscape-15s-yijia',
    name: 'Sora 2 (15秒横屏)',
    duration: 15,
    aspectRatio: '16:9',
    resolution: '1280x720',
    description: '15秒横屏基础版',
    price: 0.240,
    endpointType: 'openai-video',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '横屏']
  },
  {
    id: 'sora-2-landscape-yijia',
    name: 'Sora 2 (10秒横屏)',
    duration: 10,
    aspectRatio: '16:9',
    resolution: '1280x720',
    description: '10秒横屏基础版',
    price: 0.190,
    endpointType: 'openai-video',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '横屏']
  },
  {
    id: 'sora-2-yijia',
    name: 'Sora 2 (10秒竖屏)',
    duration: 10,
    aspectRatio: '9:16',
    resolution: '1280x720',
    description: '10秒竖屏基础版',
    price: 0.190,
    endpointType: 'openai-video',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '竖屏'],
    isDefault: true
  },

  // Pro 版 - 竖屏 (全部 1080p)
  {
    id: 'sora-2-pro-10s-large-yijia',
    name: 'Sora 2 Pro (10秒竖屏)',
    duration: 10,
    aspectRatio: '9:16',
    resolution: '1080x1920',
    description: '10秒竖屏 Pro 版',
    price: 1.150,
    endpointType: 'openai',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '竖屏', 'Pro', '高清']
  },
  {
    id: 'sora-2-pro-15s-large-yijia',
    name: 'Sora 2 Pro (15秒竖屏)',
    duration: 15,
    aspectRatio: '9:16',
    resolution: '1080x1920',
    description: '15秒竖屏 Pro 版',
    price: 1.800,
    endpointType: 'openai',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '竖屏', 'Pro', '高清']
  },
  {
    id: 'sora-2-pro-25s-yijia',
    name: 'Sora 2 Pro (25秒竖屏)',
    duration: 25,
    aspectRatio: '9:16',
    resolution: '1080x1920',
    description: '25秒竖屏 Pro 版',
    price: 2.200,
    endpointType: 'openai',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '竖屏', 'Pro', '超长']
  },

  // Pro 版 - 横屏 (全部 1080p)
  {
    id: 'sora-2-pro-landscape-10s-large-yijia',
    name: 'Sora 2 Pro (10秒横屏)',
    duration: 10,
    aspectRatio: '16:9',
    resolution: '1920x1080',
    description: '10秒横屏 Pro 版',
    price: 0.850,
    endpointType: 'openai',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '横屏', 'Pro', '高清']
  },
  {
    id: 'sora-2-pro-landscape-15s-large-yijia',
    name: 'Sora 2 Pro (15秒横屏)',
    duration: 15,
    aspectRatio: '16:9',
    resolution: '1920x1080',
    description: '15秒横屏 Pro 版',
    price: 1.500,
    endpointType: 'openai',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '横屏', 'Pro', '高清']
  },
  {
    id: 'sora-2-pro-landscape-25s-yijia',
    name: 'Sora 2 Pro (25秒横屏)',
    duration: 25,
    aspectRatio: '16:9',
    resolution: '1920x1080',
    description: '25秒横屏 Pro 版',
    price: 2.200,
    endpointType: 'openai',
    provider: 'sora-2',
    billingType: '按次计费',
    tags: ['视频', '横屏', 'Pro', '超长']
  }
];

/**
 * 获取 Sora 存储配置
 */
export function getSoraStorageConfig(): SoraStorageConfig {
  const stored = localStorage.getItem(SORA_CONFIG_KEY);
  if (!stored) {
    return {};
  }

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse Sora storage config:', e);
    return {};
  }
}

/**
 * 保存 Sora 存储配置
 */
export function saveSoraStorageConfig(config: SoraStorageConfig): void {
  try {
    localStorage.setItem(SORA_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Sora storage config:', e);
  }
}

/**
 * 获取 OSS 配置
 */
export function getOSSConfig(): OSSConfig | null {
  const stored = localStorage.getItem(OSS_CONFIG_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse OSS config:', e);
    return null;
  }
}

/**
 * 保存 OSS 配置
 */
export function saveOSSConfig(config: OSSConfig): void {
  try {
    localStorage.setItem(OSS_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save OSS config:', e);
  }
}

/**
 * 获取 Sora 模型列表
 */
export function getSoraModels(): SoraModel[] {
  const stored = localStorage.getItem(SORA_MODELS_KEY);
  if (!stored) {
    return DEFAULT_SORA_MODELS;
  }

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse Sora models:', e);
    return DEFAULT_SORA_MODELS;
  }
}

/**
 * 根据 ID 获取模型信息
 */
export function getSoraModelById(modelId: string): SoraModel | undefined {
  const models = getSoraModels();
  return models.find(m => m.id === modelId);
}

// Sora2 配置常量
export const SORA2_ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 横屏' },
  { value: '9:16', label: '9:16 竖屏' }
] as const;

export const SORA2_DURATIONS = [
  { value: '5', label: '5秒' },
  { value: '10', label: '10秒' },
  { value: '15', label: '15秒' }
] as const;

// Sora2 默认配置
export const DEFAULT_SORA2_CONFIG = {
  aspect_ratio: '16:9' as const,
  duration: '10' as const,
  hd: true
} as const;

// ============================================================
// API 提供商配置
// ============================================================

/**
 * 获取当前选择的 API 提供商
 * @returns 提供商名称，默认为 'sutu'
 */
export function getSoraProvider(): SoraProviderType {
  const config = getSoraStorageConfig();
  return (config.provider as SoraProviderType) || 'sutu';
}

/**
 * 保存 API 提供商选择
 * @param provider 提供商名称
 */
export function saveSoraProvider(provider: SoraProviderType): void {
  const config = getSoraStorageConfig();
  config.provider = provider;
  saveSoraStorageConfig(config);
}

/**
 * 获取当前提供商的 API Key
 * @returns API Key，如果未配置则返回 null
 */
export function getProviderApiKey(): string | null {
  const provider = getSoraProvider();
  const config = getSoraStorageConfig();

  if (provider === 'sutu') {
    // 速推 API 使用原有的 apiKey 字段（向后兼容）
    return config.apiKey || config.sutuApiKey || null;
  } else if (provider === 'yunwu') {
    // 云雾 API 使用独立的 yunwuApiKey 字段
    return config.yunwuApiKey || null;
  } else if (provider === 'dayuapi') {
    // 大洋芋 API 使用独立的 dayuapiApiKey 字段
    return config.dayuapiApiKey || null;
  } else if (provider === 'kie') {
    // KIE AI API 使用独立的 kieApiKey 字段
    return config.kieApiKey || null;
  } else if (provider === 'yijiapi') {
    // 一加API 使用独立的 yijiapiApiKey 字段
    return config.yijiapiApiKey || null;
  }

  return null;
}

/**
 * 保存提供商的 API Key
 * @param provider 提供商名称
 * @param apiKey API Key
 */
export function saveProviderApiKey(provider: SoraProviderType, apiKey: string): void {
  const config = getSoraStorageConfig();

  if (provider === 'sutu') {
    // 速推 API 同时保存到 apiKey（向后兼容）和 sutuApiKey
    config.apiKey = apiKey;
    config.sutuApiKey = apiKey;
  } else if (provider === 'yunwu') {
    config.yunwuApiKey = apiKey;
  } else if (provider === 'dayuapi') {
    config.dayuapiApiKey = apiKey;
  } else if (provider === 'kie') {
    config.kieApiKey = apiKey;
  } else if (provider === 'yijiapi') {
    config.yijiapiApiKey = apiKey;
  }

  saveSoraStorageConfig(config);
}

/**
 * 获取速推 API Key
 * @deprecated 使用 getProviderApiKey() 代替
 */
export function getSoraApiKey(): string | undefined {
  const config = getSoraStorageConfig();
  return config.apiKey;
}

/**
 * 保存速推 API Key
 * @deprecated 使用 saveProviderApiKey('sutu', apiKey) 代替
 */
export function saveSoraApiKey(apiKey: string): void {
  saveProviderApiKey('sutu', apiKey);
}

/**
 * 获取云雾 API Key
 */
export function getYunwuApiKey(): string | null {
  const config = getSoraStorageConfig();
  return config.yunwuApiKey || null;
}

/**
 * 保存云雾 API Key
 */
export function saveYunwuApiKey(apiKey: string): void {
  saveProviderApiKey('yunwu', apiKey);
}

/**
 * 获取大洋芋 API Key
 * @returns 大洋芋 API Key，如果未配置则返回 null
 */
export function getDayuapiApiKey(): string | null {
  const config = getSoraStorageConfig();
  return config.dayuapiApiKey || null;
}

/**
 * 保存大洋芋 API Key
 */
export function saveDayuapiApiKey(apiKey: string): void {
  saveProviderApiKey('dayuapi', apiKey);
}

/**
 * 获取 KIE AI API Key
 * @returns KIE AI API Key，如果未配置则返回 null
 */
export function getKieApiKey(): string | null {
  const config = getSoraStorageConfig();
  return config.kieApiKey || null;
}

/**
 * 保存 KIE AI API Key
 */
export function saveKieApiKey(apiKey: string): void {
  saveProviderApiKey('kie', apiKey);
}

/**
 * 获取一加API Key
 * @returns 一加API Key，如果未配置则返回 null
 */
export function getYijiapiApiKey(): string | null {
  const config = getSoraStorageConfig();
  return config.yijiapiApiKey || null;
}

/**
 * 保存一加API Key
 */
export function saveYijiapiApiKey(apiKey: string): void {
  saveProviderApiKey('yijiapi', apiKey);
}

// ============================================================
// 视频平台配置（用于分镜视频生成节点）
// ============================================================

/**
 * 获取视频平台 API Key
 * @param platformCode 平台代码
 * @returns API Key，如果未配置则返回 null
 */
export function getVideoPlatformApiKey(platformCode: string): string | null {
  const config = getSoraStorageConfig();
  const platformKeys = config.videoPlatformKeys || {};

  return platformKeys[platformCode] || null;
}

/**
 * 保存视频平台 API Key
 * @param platformCode 平台代码
 * @param apiKey API Key
 */
export function saveVideoPlatformApiKey(platformCode: string, apiKey: string): void {
  const config = getSoraStorageConfig();

  if (!config.videoPlatformKeys) {
    config.videoPlatformKeys = {};
  }

  config.videoPlatformKeys[platformCode] = apiKey;
  saveSoraStorageConfig(config);

}

/**
 * 获取所有视频平台 API Keys
 * @returns 平台 API Keys 对象
 */
export function getAllVideoPlatformKeys(): Record<string, string> {
  const config = getSoraStorageConfig();
  return config.videoPlatformKeys || {};
}

/**
 * 检查视频平台是否已配置 API Key
 * @param platformCode 平台代码
 * @returns 是否已配置
 */
export function hasVideoPlatformApiKey(platformCode: string): boolean {
  const apiKey = getVideoPlatformApiKey(platformCode);
  return apiKey !== null && apiKey.length > 0;
}
