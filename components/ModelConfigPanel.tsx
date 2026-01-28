/**
 * 模型配置管理面板 - 独立页面
 * 完整的CRUD功能
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  RotateCcw,
  CheckCircle,
  Layers,
  Box,
  Server,
  AlertCircle
} from 'lucide-react';
import {
  modelConfigManager,
  PlatformConfig,
  ModelConfig,
  SubModelConfig
} from '../services/modelConfigManager';

interface ModelConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelConfigPanel: React.FC<ModelConfigPanelProps> = ({ isOpen, onClose }) => {
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{
    type: 'platform' | 'model' | 'submodel';
    platformId?: string;
    modelId?: string;
    item?: any;
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = () => {
    try {
      const config = modelConfigManager.load();
      setPlatforms(config.platforms);
      if (config.platforms.length > 0) {
        setExpandedPlatforms(new Set([config.platforms[0].id]));
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      showMessage('error', '加载配置失败');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const togglePlatform = (platformId: string) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  };

  const toggleModel = (modelId: string) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const editPlatform = (platform: PlatformConfig) => {
    setEditingItem({
      type: 'platform',
      item: { ...platform }
    });
  };

  const editModel = (platformId: string, model: ModelConfig) => {
    setEditingItem({
      type: 'model',
      platformId,
      item: { ...model }
    });
  };

  const editSubModel = (platformId: string, modelId: string, subModel: SubModelConfig) => {
    setEditingItem({
      type: 'submodel',
      platformId,
      modelId,
      item: { ...subModel }
    });
  };

  const saveEdit = () => {
    if (!editingItem) return;

    try {
      if (editingItem.type === 'platform') {
        modelConfigManager.updatePlatform(editingItem.item.id, editingItem.item);
        showMessage('success', '平台已更新');
      } else if (editingItem.type === 'model') {
        modelConfigManager.updateModel(editingItem.platformId!, editingItem.item.id, editingItem.item);
        showMessage('success', '模型已更新');
      } else if (editingItem.type === 'submodel') {
        modelConfigManager.updateSubModel(
          editingItem.platformId!,
          editingItem.modelId!,
          editingItem.item.id,
          editingItem.item
        );
        showMessage('success', '子模型已更新');
      }
      loadConfig();
      setEditingItem(null);
    } catch (error: any) {
      showMessage('error', error.message);
    }
  };

  const deletePlatform = (platformId: string) => {
    if (confirm('确定要删除此平台吗？')) {
      modelConfigManager.deletePlatform(platformId);
      loadConfig();
      showMessage('success', '平台已删除');
    }
  };

  const deleteModel = (platformId: string, modelId: string) => {
    if (confirm('确定要删除此模型吗？')) {
      modelConfigManager.deleteModel(platformId, modelId);
      loadConfig();
      showMessage('success', '模型已删除');
    }
  };

  const deleteSubModel = (platformId: string, modelId: string, subModelId: string) => {
    if (confirm('确定要删除此子模型吗？')) {
      modelConfigManager.deleteSubModel(platformId, modelId, subModelId);
      loadConfig();
      showMessage('success', '子模型已删除');
    }
  };

  const addPlatform = () => {
    setEditingItem({
      type: 'platform',
      item: {
        code: '',
        name: '',
        description: '',
        enabled: true,
        baseUrl: '',
        apiKeyRequired: true,
        models: []
      }
    });
  };

  const addModel = (platformId: string) => {
    setEditingItem({
      type: 'model',
      platformId,
      item: {
        code: '',
        name: '',
        description: '',
        enabled: true,
        useUnifiedEndpoint: true,
        checkEndpoint: '',
        subModels: [],
        supportsImageRef: true,
        maxDuration: 10,
        maxPromptLength: 1000
      }
    });
  };

  const addSubModel = (platformId: string, modelId: string) => {
    setEditingItem({
      type: 'submodel',
      platformId,
      modelId,
      item: {
        code: '',
        name: '',
        description: '',
        enabled: true
      }
    });
  };

  const exportConfig = () => {
    try {
      const config = modelConfigManager.exportConfig();
      const blob = new Blob([config], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('success', '配置已导出');
    } catch (error) {
      showMessage('error', '导出失败');
    }
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = modelConfigManager.importConfig(content);
      if (result.success) {
        loadConfig();
        showMessage('success', '配置已导入');
      } else {
        showMessage('error', result.error || '导入失败');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const resetConfig = () => {
    if (confirm('确定要重置为默认配置吗？所有自定义更改将丢失！')) {
      modelConfigManager.reset();
      loadConfig();
      showMessage('success', '配置已重置');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
      <div className="w-full max-w-6xl max-h-[95vh] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Settings className="text-purple-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">模型配置管理</h2>
              <p className="text-xs text-slate-400">管理视频平台的模型配置</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportConfig}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg flex items-center gap-2 transition-all text-sm"
            >
              <Download size={16} className="text-blue-400" />
              <span className="text-blue-300">导出配置</span>
            </button>

            <label className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg flex items-center gap-2 transition-all cursor-pointer text-sm">
              <Upload size={16} className="text-green-400" />
              <span className="text-green-300">导入配置</span>
              <input
                type="file"
                accept=".json"
                onChange={importConfig}
                className="hidden"
              />
            </label>

            <button
              onClick={resetConfig}
              className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg flex items-center gap-2 transition-all text-sm"
            >
              <RotateCcw size={16} className="text-orange-400" />
              <span className="text-orange-300">重置</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Platform Button */}
          <button
            onClick={addPlatform}
            className="w-full mb-6 p-4 border-2 border-dashed border-purple-500/30 rounded-xl hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={20} className="text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">添加新平台</span>
          </button>

          {/* Platform List */}
          <div className="space-y-4">
            {platforms.map((platform) => {
              const isExpanded = expandedPlatforms.has(platform.id);
              return (
                <div
                  key={platform.id}
                  className="bg-black/40 rounded-xl border border-white/10 overflow-hidden"
                >
                  {/* Platform Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => togglePlatform(platform.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown size={18} className="text-slate-400" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400" />
                      )}
                      <Server size={20} className={platform.enabled ? 'text-green-400' : 'text-slate-500'} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{platform.name}</span>
                          {!platform.enabled && (
                            <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] text-red-300">
                              已禁用
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            {platform.models?.length || 0} 个模型
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{platform.code}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editPlatform(platform);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="编辑平台"
                      >
                        <Edit2 size={14} className="text-blue-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addModel(platform.id);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="添加模型"
                      >
                        <Plus size={14} className="text-green-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePlatform(platform.id);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="删除平台"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Models */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 space-y-3">
                      {platform.models?.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                          暂无模型配置
                        </div>
                      ) : (
                        platform.models.map((model) => {
                          const isModelExpanded = expandedModels.has(model.id);
                          return (
                            <div
                              key={model.id}
                              className="bg-black/40 rounded-lg border border-white/10 overflow-hidden"
                            >
                              {/* Model Header */}
                              <div
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => toggleModel(model.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {isModelExpanded ? (
                                    <ChevronDown size={14} className="text-slate-400" />
                                  ) : (
                                    <ChevronRight size={14} className="text-slate-400" />
                                  )}
                                  <Layers size={16} className={model.enabled ? 'text-green-400' : 'text-slate-500'} />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white">{model.name}</span>
                                      {!model.enabled && (
                                        <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[9px] text-red-300">
                                          已禁用
                                        </span>
                                      )}
                                      <span className="text-[9px] text-slate-500">
                                        {model.subModels?.length || 0} 个子模型
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">{model.code}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editModel(platform.id, model);
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                    title="编辑模型"
                                  >
                                    <Edit2 size={12} className="text-blue-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addSubModel(platform.id, model.id);
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                    title="添加子模型"
                                  >
                                    <Plus size={12} className="text-green-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteModel(platform.id, model.id);
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                    title="删除模型"
                                  >
                                    <Trash2 size={12} className="text-red-400" />
                                  </button>
                                </div>
                              </div>

                              {/* SubModels */}
                              {isModelExpanded && (
                                <div className="border-t border-white/10 p-3 space-y-2">
                                  {model.subModels?.length === 0 ? (
                                    <div className="text-center py-4 text-slate-500 text-xs">
                                      暂无子模型配置
                                    </div>
                                  ) : (
                                    model.subModels.map((subModel) => (
                                      <div
                                        key={subModel.id}
                                        className="flex items-center justify-between p-2 bg-black/40 rounded border border-white/10"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Box size={12} className={subModel.enabled ? 'text-green-400' : 'text-slate-500'} />
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-bold text-white">{subModel.name}</span>
                                              {!subModel.enabled && (
                                                <span className="px-1 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[7px] text-red-300">
                                                  已禁用
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-[9px] text-slate-400">{subModel.code}</p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => editSubModel(platform.id, model.id, subModel)}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            title="编辑子模型"
                                          >
                                            <Edit2 size={10} className="text-blue-400" />
                                          </button>
                                          <button
                                            onClick={() => deleteSubModel(platform.id, model.id, subModel.id)}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            title="删除子模型"
                                          >
                                            <Trash2 size={10} className="text-red-400" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {platforms.length === 0 && (
            <div className="text-center py-16">
              <AlertCircle size={48} className="text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">暂无平台配置</p>
              <p className="text-sm text-slate-500">点击上方"添加新平台"按钮开始配置</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onSave={saveEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {/* Message Toast */}
      {message && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg border flex items-center gap-3 shadow-lg z-[110] ${
          message.type === 'success'
            ? 'bg-green-500/20 border-green-500/30 text-green-300'
            : 'bg-red-500/20 border-red-500/30 text-red-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}
    </div>
  );
};

// Edit Modal Component
interface EditModalProps {
  item: {
    type: 'platform' | 'model' | 'submodel';
    item?: any;
  };
  onSave: () => void;
  onCancel: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ item, onSave, onCancel }) => {
  const [formData, setFormData] = useState<any>(item.item || {});

  useEffect(() => {
    setFormData(item.item || {});
  }, [item.item]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120] p-4">
      <div className="w-full max-w-lg bg-slate-900 rounded-xl border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">
            {item.type === 'platform' ? '编辑平台' : item.type === 'model' ? '编辑模型' : '编辑子模型'}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Platform Fields */}
          {item.type === 'platform' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">平台代码</label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: yunwuapi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">显示名称</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: 云雾API"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">描述</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  rows={2}
                  placeholder="平台描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Base URL</label>
                <input
                  type="text"
                  value={formData.baseUrl || ''}
                  onChange={(e) => handleChange('baseUrl', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: http://localhost:3001/api/yunwuapi"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled !== false}
                  onChange={(e) => handleChange('enabled', e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="enabled" className="text-sm text-slate-300">启用此平台</label>
              </div>
            </>
          )}

          {/* Model Fields */}
          {item.type === 'model' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">模型代码</label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: veo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">显示名称</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: Veo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">描述</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  rows={2}
                  placeholder="模型描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">状态查询端点</label>
                <input
                  type="text"
                  value={formData.checkEndpoint || ''}
                  onChange={(e) => handleChange('checkEndpoint', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: /veo/status"
                />
              </div>
              {!formData.useUnifiedEndpoint && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">提交端点</label>
                  <input
                    type="text"
                    value={formData.submitEndpoint || ''}
                    onChange={(e) => handleChange('submitEndpoint', e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                    placeholder="如: /luma/generations"
                  />
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="useUnified"
                    checked={formData.useUnifiedEndpoint !== false}
                    onChange={(e) => handleChange('useUnifiedEndpoint', e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="useUnified" className="text-sm text-slate-300">使用统一端点</label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="supportsImage"
                    checked={formData.supportsImageRef !== false}
                    onChange={(e) => handleChange('supportsImageRef', e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="supportsImage" className="text-sm text-slate-300">支持图片参考</label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled !== false}
                    onChange={(e) => handleChange('enabled', e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="enabled" className="text-sm text-slate-300">启用此模型</label>
                </div>
              </div>
            </>
          )}

          {/* SubModel Fields */}
          {item.type === 'submodel' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">子模型代码</label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: veo3-fast"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">显示名称</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="如: Veo 3 Fast"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">描述</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                  rows={2}
                  placeholder="子模型描述"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled !== false}
                  onChange={(e) => handleChange('enabled', e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="enabled" className="text-sm text-slate-300">启用此子模型</label>
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onSave}
            className="flex-1 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save size={18} />
            保存
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <X size={18} />
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
