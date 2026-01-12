import React, { useState, useEffect } from 'react';
import {
  X, Save, Key, ExternalLink, Image as ImageIcon,
  Video, Type, Music, ArrowUp, ArrowDown,
  RefreshCw, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import {
  ModelCategory,
  getModelsByCategory,
  getModelInfo,
  getDefaultModel,
  saveUserPriority,
  getUserPriority,
  IMAGE_MODELS,
  VIDEO_MODELS,
  TEXT_MODELS,
  AUDIO_MODELS
} from '../services/modelConfig';
import {
  getAllModelStats,
  getModelHealth,
  resetModelStats
} from '../services/modelFallback';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 模型类别配置
const MODEL_CATEGORIES = {
  image: {
    label: '图片生成模型',
    icon: ImageIcon,
    description: '按效果排序，优先使用高质量模型，自动降级到备用模型',
    models: IMAGE_MODELS
  },
  video: {
    label: '视频生成模型',
    icon: Video,
    description: '专业模型优先，快速模型作为备用',
    models: VIDEO_MODELS
  },
  text: {
    label: '文本生成模型 (LLM)',
    icon: Type,
    description: '推理能力优先，Flash 模型作为快速备用',
    models: TEXT_MODELS
  },
  audio: {
    label: '音频生成模型',
    icon: Music,
    description: 'TTS 和原生音频模型',
    models: AUDIO_MODELS
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [polloKey, setPolloKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'models'>('basic');

  // 模型优先级配置
  const [modelPriorities, setModelPriorities] = useState<Record<ModelCategory, string[]>>({
    image: [],
    video: [],
    text: [],
    audio: []
  });

  // 模型健康状态
  const [modelHealth, setModelHealth] = useState<Record<string, {
    healthy: boolean;
    successRate: number;
    consecutiveFailures: number;
  }>>({});

  // 加载数据
  useEffect(() => {
    if (!isOpen) return;

    // 加载 API Key
    const storedKey = localStorage.getItem('pollo_api_key');
    if (storedKey) setPolloKey(storedKey);

    // 加载模型优先级配置
    const categories: ModelCategory[] = ['image', 'video', 'text', 'audio'];
    const priorities: Record<ModelCategory, string[]> = {} as any;

    categories.forEach(category => {
      priorities[category] = getUserPriority(category);
    });

    setModelPriorities(priorities);

    // 加载模型健康状态
    const stats = getAllModelStats();
    const health: Record<string, any> = {};

    Object.keys(stats).forEach(modelId => {
      health[modelId] = getModelHealth(modelId);
    });

    setModelHealth(health);
  }, [isOpen]);

  // 保存设置
  const handleSave = () => {
    // 保存 API Key
    if (polloKey.trim()) {
      localStorage.setItem('pollo_api_key', polloKey.trim());
    }

    // 保存模型优先级
    Object.entries(modelPriorities).forEach(([category, priority]) => {
      saveUserPriority(category as ModelCategory, priority);
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setTimeout(onClose, 500);
  };

  // 调整模型优先级
  const moveModelUp = (category: ModelCategory, currentIndex: number) => {
    if (currentIndex === 0) return;

    const newPriority = [...modelPriorities[category]];
    [newPriority[currentIndex - 1], newPriority[currentIndex]] =
    [newPriority[currentIndex], newPriority[currentIndex - 1]];

    setModelPriorities({
      ...modelPriorities,
      [category]: newPriority
    });
  };

  const moveModelDown = (category: ModelCategory, currentIndex: number) => {
    if (currentIndex === modelPriorities[category].length - 1) return;

    const newPriority = [...modelPriorities[category]];
    [newPriority[currentIndex], newPriority[currentIndex + 1]] =
    [newPriority[currentIndex + 1], newPriority[currentIndex]];

    setModelPriorities({
      ...modelPriorities,
      [category]: newPriority
    });
  };

  // 重置为默认优先级
  const resetToDefault = (category: ModelCategory) => {
    const defaultPriority = getModelsByCategory(category)
      .sort((a, b) => a.priority - b.priority)
      .map(m => m.id);

    setModelPriorities({
      ...modelPriorities,
      [category]: defaultPriority
    });
  };

  // 重置模型统计
  const handleResetStats = (modelId?: string) => {
    resetModelStats(modelId);

    // 刷新健康状态
    const stats = getAllModelStats();
    const health: Record<string, any> = {};

    Object.keys(stats).forEach(id => {
      health[id] = getModelHealth(id);
    });

    setModelHealth(health);
  };

  // 获取模型健康状态图标
  const getHealthIcon = (modelId: string) => {
    const health = modelHealth[modelId];

    if (!health) {
      return <CheckCircle size={14} className="text-slate-600" />;
    }

    if (health.healthy) {
      return <CheckCircle size={14} className="text-green-500" />;
    }

    if (health.consecutiveFailures >= 3) {
      return <XCircle size={14} className="text-red-500" />;
    }

    return <AlertTriangle size={14} className="text-yellow-500" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-[700px] max-h-[90vh] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-700/50 rounded-lg">
              <Key size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white">设置 (Settings)</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex-1 py-3 text-xs font-bold transition-all ${
              activeTab === 'basic'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            基础设置
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`flex-1 py-3 text-xs font-bold transition-all ${
              activeTab === 'models'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            模型优先级
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'basic' ? (
            <div className="p-6 space-y-6">
              {/* API Key 配置 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Pollo.ai API Key (Wan 2.5)
                  </label>
                  <a
                    href="https://pollo.ai/dashboard/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span>获取 Key</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-mono text-xs">key-</span>
                  </div>
                  <input
                    type="password"
                    autoComplete="off"
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    placeholder="粘贴您的 Pollo API Key..."
                    value={polloKey}
                    onChange={(e) => setPolloKey(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  用于激活 <strong>Wan 2.1 / Wan 2.5</strong> 视频生成模型。密钥仅保存在您的浏览器本地存储中。
                </p>
              </div>

              {/* 自动降级说明 */}
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-cyan-400">
                  <RefreshCw size={14} />
                  <span className="text-xs font-bold">智能模型降级</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  系统会自动检测模型配额和可用性。当首选模型额度用完或调用失败时，
                  会自动切换到下一个可用模型，确保工作流持续运行。
                  您可以在"模型优先级"标签页调整模型顺序。
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">模型优先级配置</h3>
                  <p className="text-[11px] text-slate-400">
                    拖动调整模型顺序，优先使用排在最前面的模型
                  </p>
                </div>
                <button
                  onClick={() => {
                    const categories: ModelCategory[] = ['image', 'video', 'text', 'audio'];
                    categories.forEach(cat => resetToDefault(cat));
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-slate-400 hover:text-white transition-all flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  <span>重置全部</span>
                </button>
              </div>

              {Object.entries(MODEL_CATEGORIES).map(([key, category]) => {
                const Icon = category.icon;
                const catKey = key as ModelCategory;
                const priority = modelPriorities[catKey];

                return (
                  <div key={key} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-300">{category.label}</span>
                      </div>
                      <button
                        onClick={() => resetToDefault(catKey)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        重置
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {category.description}
                    </p>

                    <div className="space-y-2">
                      {priority.map((modelId, index) => {
                        const modelInfo = getModelInfo(modelId);
                        if (!modelInfo) return null;

                        const health = modelHealth[modelId];

                        return (
                          <div
                            key={modelId}
                            className="flex items-center gap-3 p-3 bg-black/30 border border-white/10 rounded-lg group hover:bg-black/40 transition-all"
                          >
                            {/* 优先级指示 */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-600 w-4">
                                {index + 1}
                              </span>
                            </div>

                            {/* 模型信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white truncate">
                                  {modelInfo.name}
                                </span>
                                {modelInfo.isDefault && (
                                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] font-bold rounded">
                                    默认
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {getHealthIcon(modelId)}
                                {health && (
                                  <span className="text-[9px] text-slate-500">
                                    成功率: {health.successRate.toFixed(0)}%
                                    {health.consecutiveFailures > 0 && (
                                      <span className="text-yellow-500 ml-1">
                                        ({health.consecutiveFailures} 连续失败)
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 能力标签 */}
                            <div className="hidden lg:flex items-center gap-1 flex-wrap">
                              {modelInfo.tags.slice(0, 2).map(tag => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 bg-white/5 text-slate-500 text-[9px] rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* 控制按钮 */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveModelUp(catKey, index)}
                                disabled={index === 0}
                                className={`p-1 rounded transition-all ${
                                  index === 0
                                    ? 'text-slate-700 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => moveModelDown(catKey, index)}
                                disabled={index === priority.length - 1}
                                className={`p-1 rounded transition-all ${
                                  index === priority.length - 1
                                    ? 'text-slate-700 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* 健康状态说明 */}
              <div className="p-3 bg-white/5 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                  <span>模型健康状态说明:</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-500" />
                    <span>健康</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle size={12} className="text-yellow-500" />
                    <span>偶尔失败</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle size={12} className="text-red-500" />
                    <span>不可用 (已自动跳过)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-between items-center">
          <button
            onClick={() => handleResetStats()}
            className="px-3 py-1.5 text-[10px] text-slate-500 hover:text-white transition-colors"
          >
            重置所有统计
          </button>
          <button
            onClick={handleSave}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
              isSaved
                ? 'bg-green-500 text-white'
                : 'bg-white text-black hover:bg-cyan-400'
            }`}
          >
            {isSaved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};
