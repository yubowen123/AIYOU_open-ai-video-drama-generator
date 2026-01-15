/**
 * Sora 2 配置管理服务
 * 管理 Sora API Key、OSS 配置、存储路径等
 */

import { SoraStorageConfig, OSSConfig, SoraModel } from '../types';

const SORA_CONFIG_KEY = 'sora_storage_config';
const OSS_CONFIG_KEY = 'sora_oss_config';
const SORA_MODELS_KEY = 'sora_models';

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
 * 获取 Sora API Key
 */
export function getSoraApiKey(): string | undefined {
  const config = getSoraStorageConfig();
  return config.apiKey;
}

/**
 * 保存 Sora API Key
 */
export function saveSoraApiKey(apiKey: string): void {
  const config = getSoraStorageConfig();
  config.apiKey = apiKey;
  saveSoraStorageConfig(config);
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
