/**
 * 模型配置加载服务
 * 从后台管理API加载最新的模型配置
 */

interface SubModelConfig {
  id: string;
  code: string;
  name: string;
  description?: string;
  enabled: boolean;
  default?: boolean;
}

interface ModelConfig {
  id: string;
  code: string;
  name: string;
  subModels: SubModelConfig[];
  defaultSubModel?: string;
}

interface PlatformConfig {
  id: string;
  code: string;
  name: string;
  models: ModelConfig[];
}

interface ModelConfiguration {
  platforms: PlatformConfig[];
}

/**
 * 从后台API加载模型配置
 */
export async function loadModelConfig(): Promise<ModelConfiguration> {
  try {
    const response = await fetch('http://localhost:3001/api/admin/config');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('[ModelConfigLoader] Failed to load config from API:', error);
    throw error;
  }
}

/**
 * 获取指定模型的子模型列表
 * @param platformCode 平台代码（如 'yunwuapi'）
 * @param modelCode 模型代码（如 'veo'）
 * @returns 子模型代码数组
 */
export async function getSubModels(platformCode: string, modelCode: string): Promise<string[]> {
  try {
    const config = await loadModelConfig();
    const platform = config.platforms.find(p => p.code === platformCode);
    if (!platform) {
      console.warn(`[ModelConfigLoader] Platform not found: ${platformCode}`);
      return [];
    }

    const model = platform.models.find(m => m.code === modelCode);
    if (!model) {
      console.warn(`[ModelConfigLoader] Model not found: ${modelCode}`);
      return [];
    }

    // 只返回启用的子模型
    return model.subModels
      .filter(sm => sm.enabled)
      .map(sm => sm.code);
  } catch (error) {
    console.error('[ModelConfigLoader] Failed to get submodels:', error);
    return [];
  }
}

/**
 * 获取指定模型的默认子模型
 * @param platformCode 平台代码
 * @param modelCode 模型代码
 * @returns 默认子模型代码，如果没有则返回第一个启用的子模型
 */
export async function getDefaultSubModel(platformCode: string, modelCode: string): Promise<string | undefined> {
  try {
    const config = await loadModelConfig();
    const platform = config.platforms.find(p => p.code === platformCode);
    if (!platform) return undefined;

    const model = platform.models.find(m => m.code === modelCode);
    if (!model) return undefined;

    // 首先返回标记为默认的子模型
    const defaultSubModel = model.subModels.find(sm => sm.enabled && sm.default);
    if (defaultSubModel) {
      return defaultSubModel.code;
    }

    // 如果没有标记为默认的，返回第一个启用的子模型
    const firstEnabled = model.subModels.find(sm => sm.enabled);
    return firstEnabled?.code;
  } catch (error) {
    console.error('[ModelConfigLoader] Failed to get default submodel:', error);
    return undefined;
  }
}

/**
 * 获取子模型显示名称
 * @param platformCode 平台代码
 * @param modelCode 模型代码
 * @param subModelCode 子模型代码
 * @returns 子模型名称
 */
export async function getSubModelName(
  platformCode: string,
  modelCode: string,
  subModelCode: string
): Promise<string> {
  try {
    const config = await loadModelConfig();
    const platform = config.platforms.find(p => p.code === platformCode);
    if (!platform) return subModelCode;

    const model = platform.models.find(m => m.code === modelCode);
    if (!model) return subModelCode;

    const subModel = model.subModels.find(sm => sm.code === subModelCode);
    return subModel?.name || subModelCode;
  } catch (error) {
    console.error('[ModelConfigLoader] Failed to get submodel name:', error);
    return subModelCode;
  }
}

/**
 * 缓存的配置数据（避免频繁请求）
 */
let cachedConfig: ModelConfiguration | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 60000; // 1分钟缓存

/**
 * 带缓存的加载模型配置
 */
export async function loadModelConfigWithCache(): Promise<ModelConfiguration> {
  const now = Date.now();
  if (cachedConfig && (now - cacheTime) < CACHE_DURATION) {
    return cachedConfig;
  }

  const config = await loadModelConfig();
  cachedConfig = config;
  cacheTime = now;
  return config;
}

/**
 * 清除配置缓存
 */
export function clearModelConfigCache(): void {
  cachedConfig = null;
  cacheTime = 0;
}

/**
 * 获取所有模型配置（用于初始化）
 * @returns 平台代码 -> 模型代码 -> 子模型代码列表的映射
 */
export async function getAllModelsConfig(): Promise<Record<string, Record<string, string[]>>> {
  try {
    const config = await loadModelConfigWithCache();
    const result: Record<string, Record<string, string[]>> = {};

    for (const platform of config.platforms) {
      if (!platform.enabled) continue;

      result[platform.code] = {};
      for (const model of platform.models) {
        if (!model.enabled) continue;

        result[platform.code][model.code] = model.subModels
          .filter(sm => sm.enabled)
          .map(sm => sm.code);
      }
    }

    return result;
  } catch (error) {
    console.error('[ModelConfigLoader] Failed to get all models config:', error);
    return {};
  }
}

/**
 * 获取所有子模型显示名称（用于初始化）
 */
export async function getAllSubModelNames(): Promise<Record<string, string>> {
  try {
    const config = await loadModelConfigWithCache();
    const result: Record<string, string> = {};

    for (const platform of config.platforms) {
      for (const model of platform.models) {
        for (const subModel of model.subModels) {
          result[subModel.code] = subModel.name;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[ModelConfigLoader] Failed to get all submodel names:', error);
    return {};
  }
}
