/**
 * 模型配置管理服务
 * 用于管理视频平台的模型配置，支持动态添加、编辑、删除模型
 */

// ============================================================
// 类型定义
// ============================================================

/**
 * 子模型配置
 */
export interface SubModelConfig {
  id: string;  // 唯一标识
  code: string;  // 模型代码，如 'veo3.1-fast'
  name: string;  // 显示名称，如 'Veo 3.1 Fast'
  description?: string;  // 描述
  enabled: boolean;  // 是否启用
}

/**
 * 模型配置
 */
export interface ModelConfig {
  id: string;  // 唯一标识
  code: string;  // 模型代码，如 'veo'
  name: string;  // 显示名称，如 'Veo'
  description?: string;  // 描述
  enabled: boolean;  // 是否启用
  useUnifiedEndpoint: boolean;  // 是否使用统一端点
  submitEndpoint?: string;  // 自定义提交端点（如果不使用统一端点）
  checkEndpoint: string;  // 状态查询端点
  subModels: SubModelConfig[];  // 子模型列表
  defaultSubModel?: string;  // 默认子模型代码
  // 模型特定参数
  supportsImageRef: boolean;  // 是否支持图片参考
  maxDuration: number;  // 最大时长（秒）
  maxPromptLength: number;  // 最大提示词长度
}

/**
 * 平台配置
 */
export interface PlatformConfig {
  id: string;  // 唯一标识
  code: string;  // 平台代码，如 'yunwuapi'
  name: string;  // 显示名称，如 '云雾API'
  description?: string;  // 描述
  enabled: boolean;  // 是否启用
  baseUrl: string;  // API基础URL
  apiKeyRequired: boolean;  // 是否需要API Key
  models: ModelConfig[];  // 模型列表
}

/**
 * 完整的模型配置
 */
export interface ModelConfiguration {
  version: string;  // 配置版本
  updatedAt: string;  // 更新时间
  platforms: PlatformConfig[];  // 平台列表
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: ModelConfiguration = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  platforms: [
    {
      id: 'platform-yunwuapi',
      code: 'yunwuapi',
      name: '云雾API',
      description: '云雾AI视频生成平台',
      enabled: true,
      baseUrl: 'http://localhost:3001/api/yunwuapi',
      apiKeyRequired: true,
      models: [
        {
          id: 'model-veo',
          code: 'veo',
          name: 'Veo',
          description: 'Google Veo视频生成模型',
          enabled: true,
          useUnifiedEndpoint: true,
          checkEndpoint: '/veo/status',
          subModels: [
            { id: 'sub-veo2', code: 'veo2', name: 'Veo 2', enabled: true },
            { id: 'sub-veo2-fast', code: 'veo2-fast', name: 'Veo 2 Fast', enabled: true },
            { id: 'sub-veo2-fast-frames', code: 'veo2-fast-frames', name: 'Veo 2 Fast Frames', enabled: true },
            { id: 'sub-veo2-fast-components', code: 'veo2-fast-components', name: 'Veo 2 Fast Components', enabled: true },
            { id: 'sub-veo2-pro', code: 'veo2-pro', name: 'Veo 2 Pro', enabled: true },
            { id: 'sub-veo3', code: 'veo3', name: 'Veo 3', enabled: true },
            { id: 'sub-veo3-fast', code: 'veo3-fast', name: 'Veo 3 Fast', enabled: true },
            { id: 'sub-veo3-pro', code: 'veo3-pro', name: 'Veo 3 Pro', enabled: true },
            { id: 'sub-veo3-pro-frames', code: 'veo3-pro-frames', name: 'Veo 3 Pro Frames', enabled: true },
            { id: 'sub-veo3-fast-frames', code: 'veo3-fast-frames', name: 'Veo 3 Fast Frames', enabled: true },
            { id: 'sub-veo3-frames', code: 'veo3-frames', name: 'Veo 3 Frames', enabled: true }
          ],
          defaultSubModel: 'veo3-fast',
          supportsImageRef: true,
          maxDuration: 10,
          maxPromptLength: 1000
        },
        {
          id: 'model-luma',
          code: 'luma',
          name: 'Luma Dream Machine',
          description: 'Luma Dream Machine视频生成模型',
          enabled: true,
          useUnifiedEndpoint: false,
          submitEndpoint: '/luma/generations',
          checkEndpoint: '/luma/status',
          subModels: [
            { id: 'sub-ray-v2', code: 'ray-v2', name: 'Ray V2', enabled: true },
            { id: 'sub-photon', code: 'photon', name: 'Photon', enabled: true },
            { id: 'sub-photon-flash', code: 'photon-flash', name: 'Photon Flash', enabled: true }
          ],
          defaultSubModel: 'ray-v2',
          supportsImageRef: true,
          maxDuration: 5,
          maxPromptLength: 1000
        },
        {
          id: 'model-sora',
          code: 'sora',
          name: 'Sora',
          description: 'OpenAI Sora视频生成模型',
          enabled: true,
          useUnifiedEndpoint: true,
          checkEndpoint: '/sora/status',
          subModels: [
            { id: 'sub-sora', code: 'sora', name: 'Sora 1', enabled: true },
            { id: 'sub-sora-2', code: 'sora-2', name: 'Sora 2', enabled: true }
          ],
          defaultSubModel: 'sora-2',
          supportsImageRef: true,
          maxDuration: 15,
          maxPromptLength: 1000
        },
        {
          id: 'model-runway',
          code: 'runway',
          name: 'Runway Gen-3',
          description: 'Runway Gen-3视频生成模型',
          enabled: true,
          useUnifiedEndpoint: true,
          checkEndpoint: '/runway/status',
          subModels: [
            { id: 'sub-gen3-alpha-turbo', code: 'gen3-alpha-turbo', name: 'Gen-3 Alpha Turbo', enabled: true },
            { id: 'sub-gen3-alpha', code: 'gen3-alpha', name: 'Gen-3 Alpha', enabled: true },
            { id: 'sub-gen3-alpha-extreme', code: 'gen3-alpha-extreme', name: 'Gen-3 Alpha Extreme', enabled: true }
          ],
          defaultSubModel: 'gen3-alpha-turbo',
          supportsImageRef: true,
          maxDuration: 10,
          maxPromptLength: 1000
        },
        {
          id: 'model-minimax',
          code: 'minimax',
          name: '海螺',
          description: 'MiniMax视频生成模型',
          enabled: true,
          useUnifiedEndpoint: true,
          checkEndpoint: '/minimax/status',
          subModels: [
            { id: 'sub-video-01', code: 'video-01', name: 'Video-01', enabled: true },
            { id: 'sub-video-01-live', code: 'video-01-live', name: 'Video-01 Live', enabled: true }
          ],
          defaultSubModel: 'video-01',
          supportsImageRef: false,
          maxDuration: 5,
          maxPromptLength: 500
        },
        {
          id: 'model-volcengine',
          code: 'volcengine',
          name: '豆包',
          description: '火山引擎视频生成模型',
          enabled: true,
          useUnifiedEndpoint: true,
          checkEndpoint: '/volcengine/status',
          subModels: [
            { id: 'sub-doubao-video-1', code: 'doubao-video-1', name: 'Doubao Video 1', enabled: true },
            { id: 'sub-doubao-video-pro', code: 'doubao-video-pro', name: 'Doubao Video Pro', enabled: true }
          ],
          defaultSubModel: 'doubao-video-1',
          supportsImageRef: true,
          maxDuration: 10,
          maxPromptLength: 1000
        },
        {
          id: 'model-grok',
          code: 'grok',
          name: 'Grok',
          description: 'Grok视频生成模型',
          enabled: true,
          useUnifiedEndpoint: true,
          checkEndpoint: '/grok/status',
          subModels: [
            { id: 'sub-grok-2-video', code: 'grok-2-video', name: 'Grok 2 Video', enabled: true },
            { id: 'sub-grok-vision-video', code: 'grok-vision-video', name: 'Grok Vision Video', enabled: true }
          ],
          defaultSubModel: 'grok-2-video',
          supportsImageRef: true,
          maxDuration: 10,
          maxPromptLength: 1000
        },
        {
          id: 'model-qwen',
          code: 'qwen',
          name: '通义万象',
          description: '通义万象视频生成模型',
          enabled: true,
          useUnifiedEndpoint: true,
          checkEndpoint: '/qwen/status',
          subModels: [
            { id: 'sub-qwen-video', code: 'qwen-video', name: 'Qwen Video', enabled: true },
            { id: 'sub-qwen-video-plus', code: 'qwen-video-plus', name: 'Qwen Video Plus', enabled: true }
          ],
          defaultSubModel: 'qwen-video',
          supportsImageRef: true,
          maxDuration: 10,
          maxPromptLength: 1000
        }
      ]
    }
  ]
};

// ============================================================
// 存储键
// ============================================================

const STORAGE_KEY = 'aiyou-model-configuration';

// ============================================================
// 配置管理类
// ============================================================

class ModelConfigManager {
  private config: ModelConfiguration | null = null;

  /**
   * 加载配置
   */
  load(): ModelConfiguration {
    if (this.config) {
      return this.config;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.config = JSON.parse(stored);
        console.log('[ModelConfigManager] 已加载配置:', this.config);
        return this.config!;
      }
    } catch (error) {
      console.error('[ModelConfigManager] 加载配置失败:', error);
    }

    // 使用默认配置
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.save();
    return this.config;
  }

  /**
   * 保存配置
   */
  save(): void {
    if (!this.config) {
      return;
    }

    this.config.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    console.log('[ModelConfigManager] 已保存配置');
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.save();
  }

  /**
   * 获取所有平台
   */
  getPlatforms(): PlatformConfig[] {
    return this.load().platforms.filter(p => p.enabled);
  }

  /**
   * 获取指定平台
   */
  getPlatform(platformCode: string): PlatformConfig | undefined {
    return this.load().platforms.find(p => p.code === platformCode && p.enabled);
  }

  /**
   * 获取指定模型
   */
  getModel(platformCode: string, modelCode: string): ModelConfig | undefined {
    const platform = this.getPlatform(platformCode);
    return platform?.models.find(m => m.code === modelCode && m.enabled);
  }

  /**
   * 获取所有启用的模型代码列表
   */
  getEnabledModelCodes(platformCode: string): string[] {
    const platform = this.getPlatform(platformCode);
    return platform?.models.filter(m => m.enabled).map(m => m.code) || [];
  }

  /**
   * 获取子模型列表
   */
  getSubModels(platformCode: string, modelCode: string): SubModelConfig[] {
    const model = this.getModel(platformCode, modelCode);
    return model?.subModels.filter(s => s.enabled) || [];
  }

  /**
   * 获取默认子模型
   */
  getDefaultSubModel(platformCode: string, modelCode: string): string | undefined {
    const model = this.getModel(platformCode, modelCode);
    return model?.defaultSubModel;
  }

  // ==================== 管理操作 ====================

  /**
   * 添加平台
   */
  addPlatform(platform: Omit<PlatformConfig, 'id'>): void {
    const config = this.load();
    const newPlatform: PlatformConfig = {
      ...platform,
      id: `platform-${Date.now()}`
    };
    config.platforms.push(newPlatform);
    this.config = config;
    this.save();
  }

  /**
   * 更新平台
   */
  updatePlatform(platformId: string, updates: Partial<PlatformConfig>): void {
    const config = this.load();
    const index = config.platforms.findIndex(p => p.id === platformId);
    if (index !== -1) {
      config.platforms[index] = { ...config.platforms[index], ...updates };
      this.config = config;
      this.save();
    }
  }

  /**
   * 删除平台
   */
  deletePlatform(platformId: string): void {
    const config = this.load();
    config.platforms = config.platforms.filter(p => p.id !== platformId);
    this.config = config;
    this.save();
  }

  /**
   * 添加模型
   */
  addModel(platformId: string, model: Omit<ModelConfig, 'id'>): void {
    const config = this.load();
    const platform = config.platforms.find(p => p.id === platformId);
    if (platform) {
      const newModel: ModelConfig = {
        ...model,
        id: `model-${Date.now()}`
      };
      platform.models.push(newModel);
      this.config = config;
      this.save();
    }
  }

  /**
   * 更新模型
   */
  updateModel(platformId: string, modelId: string, updates: Partial<ModelConfig>): void {
    const config = this.load();
    const platform = config.platforms.find(p => p.id === platformId);
    if (platform) {
      const index = platform.models.findIndex(m => m.id === modelId);
      if (index !== -1) {
        platform.models[index] = { ...platform.models[index], ...updates };
        this.config = config;
        this.save();
      }
    }
  }

  /**
   * 删除模型
   */
  deleteModel(platformId: string, modelId: string): void {
    const config = this.load();
    const platform = config.platforms.find(p => p.id === platformId);
    if (platform) {
      platform.models = platform.models.filter(m => m.id !== modelId);
      this.config = config;
      this.save();
    }
  }

  /**
   * 添加子模型
   */
  addSubModel(platformId: string, modelId: string, subModel: Omit<SubModelConfig, 'id'>): void {
    const config = this.load();
    const platform = config.platforms.find(p => p.id === platformId);
    if (platform) {
      const model = platform.models.find(m => m.id === modelId);
      if (model) {
        const newSubModel: SubModelConfig = {
          ...subModel,
          id: `sub-${Date.now()}`
        };
        model.subModels.push(newSubModel);
        this.config = config;
        this.save();
      }
    }
  }

  /**
   * 更新子模型
   */
  updateSubModel(platformId: string, modelId: string, subModelId: string, updates: Partial<SubModelConfig>): void {
    const config = this.load();
    const platform = config.platforms.find(p => p.id === platformId);
    if (platform) {
      const model = platform.models.find(m => m.id === modelId);
      if (model) {
        const index = model.subModels.findIndex(s => s.id === subModelId);
        if (index !== -1) {
          model.subModels[index] = { ...model.subModels[index], ...updates };
          this.config = config;
          this.save();
        }
      }
    }
  }

  /**
   * 删除子模型
   */
  deleteSubModel(platformId: string, modelId: string, subModelId: string): void {
    const config = this.load();
    const platform = config.platforms.find(p => p.id === platformId);
    if (platform) {
      const model = platform.models.find(m => m.id === modelId);
      if (model) {
        model.subModels = model.subModels.filter(s => s.id !== subModelId);
        this.config = config;
        this.save();
      }
    }
  }

  /**
   * 导出配置
   */
  exportConfig(): string {
    return JSON.stringify(this.load(), null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(jsonString: string): { success: boolean; error?: string } {
    try {
      const config = JSON.parse(jsonString);
      if (!config.platforms || !Array.isArray(config.platforms)) {
        return { success: false, error: '配置格式无效' };
      }
      this.config = config;
      this.save();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// ============================================================
// 导出单例
// ============================================================

export const modelConfigManager = new ModelConfigManager();
