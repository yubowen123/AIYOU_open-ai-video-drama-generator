/**
 * 模型配置中心
 * 定义所有 Gemini 模型的优先级、能力和成本
 */

export type ModelCategory = 'image' | 'video' | 'text' | 'audio';

export interface ModelInfo {
  id: string;
  name: string;
  category: ModelCategory;
  priority: number; // 优先级 (1=最高, 数字越大优先级越低)
  quality: number; // 质量评分 (1-10)
  speed: number; // 速度评分 (1-10, 10=最快)
  cost: number; // 成本评分 (1-10, 10=最便宜)
  capabilities: string[];
  description: string;
  tags: string[];
  isDefault?: boolean;
}

// 图片生成模型 - 使用 Gemini API 官方文档推荐的模型名称
// 参考: https://ai.google.dev/gemini-api/docs/image-generation
// 所有模型都使用 generateContent API，支持 image-to-image
export const IMAGE_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Experimental',
    category: 'image',
    priority: 1,
    quality: 8,
    speed: 10,
    cost: 9,
    capabilities: ['快速响应', 'aspectRatio 支持', '实验性功能', '支持图生图'],
    description: '快速稳定的实验性模型，支持 aspectRatio 参数',
    tags: ['experimental', 'fast', 'generateContent', 'aspectRatio'],
    isDefault: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    category: 'image',
    priority: 2,
    quality: 8,
    speed: 9,
    cost: 8,
    capabilities: ['快速响应', '稳定版', '支持图生图', '多模态'],
    description: '稳定版 Flash 模型，支持图像生成',
    tags: ['stable', 'fast', 'generateContent', 'multimodal']
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    category: 'image',
    priority: 3,
    quality: 10,
    speed: 7,
    cost: 5,
    capabilities: ['最高质量', '多模态理解', '推理增强', '支持图生图'],
    description: '最高质量，强大的多模态理解能力',
    tags: ['pro', 'high-quality', 'multimodal', 'generateContent']
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    category: 'image',
    priority: 4,
    quality: 9,
    speed: 9,
    cost: 7,
    capabilities: ['快速响应', '高质量', '支持图生图'],
    description: '快速高质量的图像生成',
    tags: ['fast', 'high-quality', 'generateContent']
  }
];

// 视频生成模型
export const VIDEO_MODELS: ModelInfo[] = [
  {
    id: 'veo-3.1-generate-preview',
    name: 'Veo 3.1',
    category: 'video',
    priority: 1,
    quality: 10,
    speed: 5,
    cost: 3,
    capabilities: ['最高质量', '长视频', '4K支持', '流畅动画'],
    description: 'Veo 3.1 专业版，生成高质量视频',
    tags: ['professional', 'high-quality'],
    isDefault: true
  },
  {
    id: 'veo-3.1-fast-generate-preview',
    name: 'Veo 3.1 Fast',
    category: 'video',
    priority: 2,
    quality: 8,
    speed: 9,
    cost: 7,
    capabilities: ['快速生成', '实时预览', '短视频'],
    description: '快速视频生成，适合快速迭代',
    tags: ['fast', 'preview', 'short-form']
  },
  {
    id: 'veo-3.0-fast-generate',
    name: 'Veo 3.0 Fast',
    category: 'video',
    priority: 3,
    quality: 7,
    speed: 8,
    cost: 8,
    capabilities: ['快速生成', '稳定版本'],
    description: 'Veo 3.0 快速版，稳定可靠',
    tags: ['stable', 'fast']
  },
  {
    id: 'wan-2.1-t2v-14b',
    name: 'Wan 2.1',
    category: 'video',
    priority: 4,
    quality: 8,
    speed: 6,
    cost: 6,
    capabilities: ['动画风格', '文本转视频', '艺术性强'],
    description: 'Wan 2.1 擅长动画风格视频生成',
    tags: ['animation', 'artistic', 't2v'],
    requiresPolloKey: true
  }
];

// 文本生成模型（LLM）- 按推理能力排序
export const TEXT_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    category: 'text',
    priority: 1,
    quality: 10,
    speed: 7,
    cost: 4,
    capabilities: ['预览版', '新功能', '高级推理', '最强推理', '复杂任务', '长上下文'],
    description: '最强推理能力，适合复杂创作任务',
    tags: ['preview', 'new-features', 'strongest-reasoning', 'complex-tasks'],
    isDefault: true
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    category: 'text',
    priority: 2,
    quality: 8,
    speed: 9,
    cost: 7,
    capabilities: ['快速响应', '轻量任务', '实时交互'],
    description: '快速文本生成，适合实时对话',
    tags: ['fast', 'realtime', 'lightweight']
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    category: 'text',
    priority: 3,
    quality: 7,
    speed: 10,
    cost: 9,
    capabilities: ['超快响应', '高并发', '稳定可用'],
    description: '速度最快的文本模型，高可用性',
    tags: ['fastest', 'high-availability', 'stable']
  },
  {
    id: 'gemini-2.5-flash-preview',
    name: 'Gemini 2.5 Flash Preview',
    category: 'text',
    priority: 4,
    quality: 6,
    speed: 10,
    cost: 10,
    capabilities: ['预览版', '实验性'],
    description: '预览版本，实验性功能',
    tags: ['preview', 'experimental']
  }
];

// 音频生成模型
export const AUDIO_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.5-flash-preview-tts',
    name: 'Gemini 2.5 Flash TTS',
    category: 'audio',
    priority: 1,
    quality: 8,
    speed: 9,
    cost: 8,
    capabilities: ['文本转语音', '快速生成', '多音色'],
    description: '高质量文本转语音',
    tags: ['tts', 'voice'],
    isDefault: true
  },
  {
    id: 'gemini-2.5-flash-native-audio-dialog',
    name: 'Gemini 2.5 Native Audio',
    category: 'audio',
    priority: 2,
    quality: 9,
    speed: 7,
    cost: 6,
    capabilities: ['原生音频', '对话生成', '音效'],
    description: '原生音频生成，支持对话场景',
    tags: ['native-audio', 'dialog', 'sfx']
  }
];

// 所有模型集合
export const ALL_MODELS: ModelInfo[] = [
  ...IMAGE_MODELS,
  ...VIDEO_MODELS,
  ...TEXT_MODELS,
  ...AUDIO_MODELS
];

// 按类别获取模型
export const getModelsByCategory = (category: ModelCategory): ModelInfo[] => {
  switch (category) {
    case 'image':
      return IMAGE_MODELS;
    case 'video':
      return VIDEO_MODELS;
    case 'text':
      return TEXT_MODELS;
    case 'audio':
      return AUDIO_MODELS;
    default:
      return [];
  }
};

// 获取默认模型
export const getDefaultModel = (category: ModelCategory): string => {
  const models = getModelsByCategory(category);
  const defaultModel = models.find(m => m.isDefault);
  return defaultModel?.id || models[0]?.id || '';
};

// 按优先级获取模型列表
export const getModelsByPriority = (category: ModelCategory): ModelInfo[] => {
  return getModelsByCategory(category).sort((a, b) => a.priority - b.priority);
};

// 获取模型信息
export const getModelInfo = (modelId: string): ModelInfo | undefined => {
  return ALL_MODELS.find(m => m.id === modelId);
};

// 获取下一个备用模型（自动降级）
export const getNextFallbackModel = (
  currentModelId: string,
  excludedModels: string[] = []
): string | null => {
  const currentModel = getModelInfo(currentModelId);
  if (!currentModel) return null;

  const categoryModels = getModelsByPriority(currentModel.category);
  const currentIndex = categoryModels.findIndex(m => m.id === currentModelId);

  // 找到下一个未排除的模型
  for (let i = currentIndex + 1; i < categoryModels.length; i++) {
    const nextModel = categoryModels[i];
    if (!excludedModels.includes(nextModel.id)) {
      return nextModel.id;
    }
  }

  return null; // 没有更多备用模型
};

// 检查是否为配额错误
export const isQuotaError = (error: any): boolean => {
  const errorMsg = String(error?.message || error || '').toLowerCase();
  const quotaKeywords = [
    'quota',
    'limit',
    'exceeded',
    'rate limit',
    '429',
    'insufficient',
    'billing',
    'credit'
  ];

  return quotaKeywords.some(keyword => errorMsg.includes(keyword));
};

// 获取用户配置的优先级（从 localStorage）
export const getUserPriority = (category: ModelCategory): string[] => {
  const priorityKey = `model_priority_${category}`;
  const stored = localStorage.getItem(priorityKey);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse user priority:', e);
    }
  }

  // 返回默认优先级
  return getModelsByPriority(category).map(m => m.id);
};

// 保存用户配置的优先级
export const saveUserPriority = (category: ModelCategory, priority: string[]) => {
  const priorityKey = `model_priority_${category}`;
  localStorage.setItem(priorityKey, JSON.stringify(priority));
};

/**
 * 从 localStorage 获取用户配置的默认模型
 * 与 App.tsx 中的逻辑保持一致
 */
export const getUserDefaultModel = (category: ModelCategory): string => {
  const localStorageKey = `default_${category}_model`;
  const model = localStorage.getItem(localStorageKey);

  if (model) {
    return model;
  }

  // 如果没有配置，返回默认值
  return getDefaultModel(category);
};

/**
 * 根据节点类型获取默认模型
 */
export const getModelByNodeType = (nodeType: string): string => {
  // 视频生成节点
  if (nodeType.includes('VIDEO') || nodeType === 'SORA_VIDEO_GENERATOR') {
    return getUserDefaultModel('video');
  }

  // 图片生成节点
  if (nodeType.includes('IMAGE') || nodeType === 'STORYBOARD_IMAGE') {
    return getUserDefaultModel('image');
  }

  // 音频生成节点
  if (nodeType.includes('AUDIO')) {
    return getUserDefaultModel('audio');
  }

  // 文本处理节点（分析、剧本等）
  return getUserDefaultModel('text');
};

/**
 * 获取节点首选模型（考虑节点自身的模型配置）
 * @param nodeType 节点类型
 * @param nodeModel 节点自身配置的模型（可选）
 * @returns 优先使用节点配置，否则使用节点类型对应的默认模型
 */
export const getPreferredModel = (nodeType: string, nodeModel?: string): string => {
  if (nodeModel) {
    return nodeModel;
  }
  return getModelByNodeType(nodeType);
};
