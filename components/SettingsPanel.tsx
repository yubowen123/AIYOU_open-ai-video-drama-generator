// components/SettingsPanel.tsx
import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, Eye, EyeOff, Image as ImageIcon, Type, Music, ArrowUp, ArrowDown, RefreshCw, ExternalLink, Wand2, HelpCircle } from 'lucide-react';
import { useLanguage } from '../src/i18n/LanguageContext';
import {
  ModelCategory,
  getModelsByCategory,
  getModelInfo,
  saveUserPriority,
  getUserPriority,
  IMAGE_MODELS,
  TEXT_MODELS,
  AUDIO_MODELS
} from '../services/modelConfig';
import {
  getAllModelStats,
  getModelHealth,
  resetModelStats
} from '../services/modelFallback';
import { StorageSettingsPanel } from './StorageSettingsPanel';
import { getSoraStorageConfig, saveSoraStorageConfig, getOSSConfig, saveOSSConfig, DEFAULT_SORA_MODELS, getSoraProvider, saveSoraProvider, getYunwuApiKey } from '../services/soraConfigService';
import { testOSSConnection } from '../services/ossService';
import { OSSConfig } from '../types';

// API 提供商类型
type SoraProviderType = 'sutu' | 'yunwu';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// 模型类别配置（视频生成已移除 - 使用Sora2配置）
const MODEL_CATEGORIES = {
  image: {
    label: '图片生成模型',
    icon: ImageIcon,
    description: '按效果排序，优先使用高质量模型，自动降级到备用模型',
    models: IMAGE_MODELS
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
  const [activeTab, setActiveTab] = useState<'basic' | 'models' | 'storage' | 'sora'>('basic');
  const [isSaved, setIsSaved] = useState(false);

  // Sora 配置 state
  const [soraProvider, setSoraProviderState] = useState<SoraProviderType>('sutu');
  const [soraApiKey, setSoraApiKey] = useState('');
  const [yunwuApiKey, setYunwuApiKey] = useState('');
  const [ossConfig, setOssConfig] = useState<OSSConfig>({
    provider: 'imgbb',
    imgbbApiKey: '',
    imgbbExpiration: 86400, // 默认24小时
    bucket: '',
    region: '',
    accessKey: '',
    secretKey: ''
  });
  const [showSoraApiKey, setShowSoraApiKey] = useState(false);
  const [showYunwuApiKey, setShowYunwuApiKey] = useState(false);
  const [showOssHelp, setShowOssHelp] = useState(false);

  // OSS 测试状态
  const [ossTestState, setOssTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [ossTestMessage, setOssTestMessage] = useState('');
  const [ossTestUrl, setOssTestUrl] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);

  // 模型优先级配置（视频生成使用Sora2配置，不在此管理）
  const [modelPriorities, setModelPriorities] = useState<Record<ModelCategory, string[]>>({
    image: [],
    text: [],
    audio: []
  });

  // 模型健康状态
  const [modelHealth, setModelHealth] = useState<Record<string, {
    healthy: boolean;
    successRate: number;
    consecutiveFailures: number;
  }>>({});

  // 从 localStorage 加载 API Key 和配置
  useEffect(() => {
    if (!isOpen) return;

    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) {
      setApiKey(savedKey);
      setValidationStatus('success');
    }

    // 加载模型优先级配置（视频生成使用Sora2配置）
    const categories: ModelCategory[] = ['image', 'text', 'audio'];
    const priorities: Record<ModelCategory, string[]> = {} as any;

    categories.forEach(category => {
      // 获取用户保存的优先级
      const savedPriority = getUserPriority(category);
      // 获取当前可用的所有模型
      const availableModels = getModelsByCategory(category).map(m => m.id);

      // 合并：保留用户保存的优先级顺序，但添加新模型
      const mergedPriority = [
        ...savedPriority.filter(id => availableModels.includes(id)), // 保留保存的（如果仍然可用）
        ...availableModels.filter(id => !savedPriority.includes(id)) // 添加新的
      ];

      priorities[category] = mergedPriority;
    });

    setModelPriorities(priorities);

    // 加载模型健康状态
    const stats = getAllModelStats();
    const health: Record<string, any> = {};

    Object.keys(stats).forEach(modelId => {
      health[modelId] = getModelHealth(modelId);
    });

    setModelHealth(health);

    // 加载 Sora 配置
    const savedSoraConfig = getSoraStorageConfig();
    if (savedSoraConfig?.apiKey) {
      setSoraApiKey(savedSoraConfig.apiKey);
    }

    // 加载 API 提供商
    const savedProvider = getSoraProvider();
    setSoraProviderState(savedProvider);

    // 加载云雾 API Key
    const savedYunwuKey = getYunwuApiKey();
    if (savedYunwuKey) {
      setYunwuApiKey(savedYunwuKey);
    }

    // 加载 OSS 配置
    const savedOssConfig = getOSSConfig();
    if (savedOssConfig) {
      setOssConfig(savedOssConfig);
    }
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

  // 保存 Sora 配置
  const handleSaveSoraConfig = () => {
    const savedConfig = getSoraStorageConfig();

    // 一次性保存所有配置（包括 provider），避免覆盖
    saveSoraStorageConfig({
      ...savedConfig,
      provider: soraProvider, // ← 关键：保存提供商选择
      apiKey: soraProvider === 'sutu' ? soraApiKey : savedConfig.apiKey,
      sutuApiKey: soraProvider === 'sutu' ? soraApiKey : savedConfig.sutuApiKey,
      yunwuApiKey: yunwuApiKey,
    });

    // 保存 OSS 配置
    saveOSSConfig(ossConfig);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setTimeout(onClose, 500);
  };

  // 测试 OSS 连接
  const handleTestOSS = async () => {
    // 验证必填字段
    if (!ossConfig.bucket || !ossConfig.region || !ossConfig.accessKey || !ossConfig.secretKey) {
      setOssTestState('error');
      setOssTestMessage('请填写完整的 OSS 配置信息');
      return;
    }

    setOssTestState('testing');
    setOssTestMessage('');
    setOssTestUrl('');
    setImageLoadError(false);

    try {
      const result = await testOSSConnection(ossConfig, (message) => {
        setOssTestMessage(message);
      });

      if (result.success) {
        setOssTestState('success');
        setOssTestMessage('OSS 连接测试成功！图片已上传');
        setOssTestUrl(result.url || '');
      } else {
        setOssTestState('error');
        setOssTestMessage(result.error || '测试失败');
      }
    } catch (error: any) {
      setOssTestState('error');
      setOssTestMessage(error.message || '测试过程中发生错误');
    }
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
            onClick={() => setActiveTab('sora')}
            className={`flex-1 py-3 px-4 text-xs font-bold transition-all ${
              activeTab === 'sora'
                ? 'text-green-400 border-b-2 border-green-400 bg-white/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sora 2
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
                    const categories: ModelCategory[] = ['image', 'text', 'audio'];
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
          ) : activeTab === 'sora' ? (
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wand2 size={16} className="text-green-400" />
                  Sora 2 API 配置
                </h3>
                <p className="text-[11px] text-slate-400">
                  选择 API 提供商并配置对应的 API Key，系统将根据选择自动调用相应的服务
                </p>
              </div>

              {/* API 提供商选择 */}
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">API 提供商</span>
                </label>
                <select
                  value={soraProvider}
                  onChange={(e) => setSoraProviderState(e.target.value as SoraProviderType)}
                  className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-green-500/50"
                >
                  <option value="sutu">速推 API (Sutu)</option>
                  <option value="yunwu">云雾 API (Yunwu)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  {soraProvider === 'sutu' ? '速推 API：原有接口，稳定性一般' : '云雾 API：新增接口，稳定性较好（推荐）'}
                </p>
              </div>

              {/* 速推 API Key */}
              {soraProvider === 'sutu' && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-300">速推 API Key</span>
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showSoraApiKey ? 'text' : 'password'}
                        value={soraApiKey}
                        onChange={(e) => setSoraApiKey(e.target.value)}
                        placeholder="输入速推 API Key"
                        className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50"
                      />
                      <button
                        onClick={() => setShowSoraApiKey(!showSoraApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showSoraApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    从速推服务商获取 API Key
                  </p>
                </div>
              )}

              {/* 云雾 API Key */}
              {soraProvider === 'yunwu' && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-300">云雾 API Key</span>
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showYunwuApiKey ? 'text' : 'password'}
                        value={yunwuApiKey}
                        onChange={(e) => setYunwuApiKey(e.target.value)}
                        placeholder="输入云雾 API Key"
                        className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50"
                      />
                      <button
                        onClick={() => setShowYunwuApiKey(!showYunwuApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showYunwuApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    在 <a href="https://yunwu.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">云雾官网</a> 获取 API Key
                  </p>
                </div>
              )}

              {/* API 提供商说明 */}
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle size={16} className="text-blue-400" />
                  API 提供商说明
                </h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-white">速推 API (Sutu)</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        原有接口，稳定性一般，价格相对较低
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-white">云雾 API (Yunwu)</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        新增接口，稳定性较好，推荐使用
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  💡 提示：您可以随时切换提供商，每个提供商的 API Key 独立保存
                </p>
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
          ) : activeTab === 'sora' ? (
            <>
              <div></div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveSoraConfig}
                  className={`px-6 py-2.5 text-sm font-medium transition-all rounded-xl ${
                    isSaved
                      ? 'bg-green-500 text-white'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-400 hover:to-emerald-400 shadow-lg hover:shadow-green-500/25'
                  }`}
                >
                  {isSaved ? '✓ 已保存' : '保存配置'}
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

      {/* OSS 配置帮助弹窗 */}
      {showOssHelp && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowOssHelp(false)}
          />
          <div className="relative w-full max-w-3xl bg-[#1c1c1e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl">
                  <HelpCircle size={20} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">OSS 云存储配置指南</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">如何获取和配置对象存储服务</p>
                </div>
              </div>
              <button
                onClick={() => setShowOssHelp(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

              {/* 为什么需要 OSS */}
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle size={16} className="text-blue-400" />
                  为什么需要配置 OSS？
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sora 2 视频生成支持上传参考图，通过配置 OSS 对象存储服务，可以将本地图片自动上传到云端，生成更加精准的视频。
                </p>
                <p className="text-[10px] text-slate-400 mt-2">
                  注意：OSS 配置为可选项，不配置也能使用 Sora 2 生成视频（但不支持参考图功能）
                </p>
              </div>

              {/* 腾讯云 COS 配置步骤 */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  腾讯云 COS 配置步骤
                </h4>

                <div className="space-y-2 pl-4">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">登录腾讯云控制台</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        访问 <a href="https://console.cloud.tencent.com/cos" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">腾讯云 COS 控制台</a>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">创建存储桶（Bucket）</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        点击"创建桶"，设置桶名称，选择地域（如 ap-guangzhou），访问权限选择"公共读"
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">获取访问密钥</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        访问 <a href="https://console.cloud.tencent.com/cam/capi" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">API密钥管理</a> 页面，创建或查看 SecretId 和 SecretKey
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-bold">4</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">配置 CORS 规则（可选但推荐）</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        在 Bucket 管理页面，选择"安全管理" → "跨域访问 CORS"，添加规则：
                      </p>
                      <div className="mt-2 p-3 bg-black/30 rounded-lg space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">来源:</span>
                          <span className="text-white">*（或指定您的域名）</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">操作:</span>
                          <span className="text-white">GET, HEAD, PUT</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">允许 Headers:</span>
                          <span className="text-white">*</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-yellow-400 mt-1">
                        ⚠️ 不配置 CORS 也可以使用，但无法在浏览器中预览上传的图片
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-bold">5</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">填写配置信息</p>
                      <div className="mt-2 p-3 bg-black/30 rounded-lg space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">服务提供商:</span>
                          <span className="text-white">腾讯云 COS</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">Bucket 名称:</span>
                          <span className="text-white">创建的桶名称（如 my-bucket-1234567890）</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">区域:</span>
                          <span className="text-white">地域代码（如 ap-guangzhou）</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">Access Key:</span>
                          <span className="text-white">SecretId</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">Secret Key:</span>
                          <span className="text-white">SecretKey</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 阿里云 OSS 配置步骤 */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  阿里云 OSS 配置步骤
                </h4>

                <div className="space-y-2 pl-4">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">登录阿里云控制台</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        访问 <a href="https://oss.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">阿里云 OSS 控制台</a>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">创建 Bucket</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        点击"创建 Bucket"，设置 Bucket 名称，选择地域（如 华南1(深圳)），读写权限选择"公共读"
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">获取 AccessKey</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        访问 <a href="https://ram.console.aliyun.com/manage/ak" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">AccessKey 管理页面</a>，创建或查看 AccessKey ID 和 AccessKey Secret
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-[10px] font-bold">4</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">配置 CORS 规则（可选但推荐）</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        在 Bucket 管理页面，选择"权限管理" → "跨域设置"，添加规则：
                      </p>
                      <div className="mt-2 p-3 bg-black/30 rounded-lg space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">来源:</span>
                          <span className="text-white">*（或指定您的域名）</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">允许 Methods:</span>
                          <span className="text-white">GET, HEAD, PUT</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">允许 Headers:</span>
                          <span className="text-white">*</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-yellow-400 mt-1">
                        ⚠️ 不配置 CORS 也可以使用，但无法在浏览器中预览上传的图片
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-[10px] font-bold">5</span>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">填写配置信息</p>
                      <div className="mt-2 p-3 bg-black/30 rounded-lg space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">服务提供商:</span>
                          <span className="text-white">阿里云 OSS</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">Bucket 名称:</span>
                          <span className="text-white">创建的 Bucket 名称（如 my-bucket）</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">区域:</span>
                          <span className="text-white">地域节点（如 oss-cn-shenzhen）</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">Access Key:</span>
                          <span className="text-white">AccessKey ID</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-20">Secret Key:</span>
                          <span className="text-white">AccessKey Secret</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 注意事项 */}
              <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <h4 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  重要注意事项
                </h4>
                <ul className="space-y-1.5 text-[10px] text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>请妥善保管 AccessKey 和 SecretKey，不要泄露给他人</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>建议创建 RAM 子账号并授予 OSS 读写权限，不要使用主账号密钥</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>Bucket 访问权限建议设置为"公共读"，以便 Sora API 可以访问图片</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>不同云服务商的区域代码格式不同，请仔细核对</span>
                  </li>
                </ul>
              </div>

            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-white/5 bg-[#121214]">
              <button
                onClick={() => setShowOssHelp(false)}
                className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 rounded-xl transition-all"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
