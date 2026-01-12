// components/SettingsPanel.tsx
import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, Eye, EyeOff, Image as ImageIcon, Video, Type, Music, ArrowUp, ArrowDown, RefreshCw, ExternalLink } from 'lucide-react';
import { useLanguage } from '../src/i18n/LanguageContext';
import {
  ModelCategory,
  getModelsByCategory,
  getModelInfo,
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
import { StorageSettingsPanel } from './StorageSettingsPanel';

interface SettingsPanelProps {
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

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'models' | 'storage'>('basic');
  const [isSaved, setIsSaved] = useState(false);

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

  // 从 localStorage 加载 API Key
  useEffect(() => {
    if (!isOpen) return;

    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) {
      setApiKey(savedKey);
      setValidationStatus('success');
    }

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

  // 验证 API Key
  const validateApiKey = async (key: string): Promise<boolean> => {
    if (!key || key.length < 20) {
      setErrorMessage('API Key 长度不足，请检查是否完整');
      return false;
    }

    setIsValidating(true);
    setValidationStatus('idle');

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);

      if (response.ok) {
        setValidationStatus('success');
        setErrorMessage('');
        return true;
      } else {
        const error = await response.json();
        setValidationStatus('error');
        setErrorMessage(error.error?.message || 'API Key 验证失败，请检查是否正确');
        return false;
      }
    } catch (error: any) {
      setValidationStatus('error');
      setErrorMessage('网络错误，无法验证 API Key');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // 保存 API Key
  const handleSaveApiKey = async () => {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      setValidationStatus('error');
      setErrorMessage('请输入 API Key');
      return;
    }

    const isValid = await validateApiKey(trimmedKey);

    if (isValid) {
      localStorage.setItem('GEMINI_API_KEY', trimmedKey);
      window.dispatchEvent(new CustomEvent('apiKeyUpdated', { detail: { apiKey: trimmedKey } }));
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  // 清除 API Key
  const handleClearApiKey = () => {
    setApiKey('');
    setValidationStatus('idle');
    setErrorMessage('');
    localStorage.removeItem('GEMINI_API_KEY');
    window.dispatchEvent(new CustomEvent('apiKeyUpdated', { detail: { apiKey: '' } }));
  };

  // 保存模型优先级设置
  const handleSaveModels = () => {
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
  const handleResetStats = () => {
    resetModelStats();

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
      return <AlertCircle size={14} className="text-red-500" />;
    }

    return <AlertCircle size={14} className="text-yellow-500" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 设置面板 */}
      <div className="relative w-full max-w-4xl mx-4 bg-[#1c1c1e] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

        {/* 装饰性背景 */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[120px]" />
        </div>

        {/* 标题栏 */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl">
              <Key size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">设置 (Settings)</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">API Key & 模型配置</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="relative flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex-1 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === 'basic'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            基础设置
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`flex-1 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === 'models'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            模型优先级
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex-1 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === 'storage'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            存储设置
          </button>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'basic' ? (
            <div className="p-8 space-y-6">
              {/* API Key 配置 */}
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">Gemini API Key</span>
                  <span className="text-xs text-slate-500 ml-2">必填</span>
                </label>

                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setValidationStatus('idle');
                      setErrorMessage('');
                    }}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all font-mono text-sm"
                  />

                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white transition-colors"
                    type="button"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {validationStatus === 'success' && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle size={16} />
                    <span>API Key 已验证</span>
                  </div>
                )}

                {validationStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="text-xs text-slate-400 space-y-1">
                  <p>• 访问 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google AI Studio</a> 获取免费 API Key</p>
                  <p>• API Key 将安全地存储在您的浏览器本地,不会上传到任何服务器</p>
                </div>
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
          ) : activeTab === 'models' ? (
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
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-600 w-4">
                                {index + 1}
                              </span>
                            </div>

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
                    <AlertCircle size={12} className="text-yellow-500" />
                    <span>偶尔失败</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle size={12} className="text-red-500" />
                    <span>不可用 (已自动跳过)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <StorageSettingsPanel
              getCurrentWorkspaceId={() => 'default'}
            />
          )}
        </div>

        {/* 底部按钮 */}
        <div className="relative flex items-center justify-between px-6 py-4 border-t border-white/5 bg-[#121214]">
          {activeTab === 'basic' ? (
            <>
              <button
                onClick={handleClearApiKey}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                disabled={!apiKey}
              >
                清除
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveApiKey}
                  disabled={isValidating || !apiKey.trim()}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isValidating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      验证中...
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleResetStats}
                className="px-3 py-1.5 text-[10px] text-slate-500 hover:text-white transition-colors"
              >
                重置所有统计
              </button>

              <button
                onClick={handleSaveModels}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSaved
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-black hover:bg-cyan-400'
                }`}
              >
                {isSaved ? '✓ 已保存' : '保存设置'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
