/**
 * 分镜视频生成节点 UI 组件
 * 实现5阶段状态机：idle → selecting → prompting → generating → completed
 */

import React, { useState, memo, useEffect } from 'react';
import { AppNode, NodeType, SplitStoryboardShot } from '../types';
import { Film, Play, Loader2, ChevronDown, Grid3X3, Copy, Check, Settings, Image as ImageIcon, Wand2, Sparkles, RefreshCw } from 'lucide-react';
import { getAllModelsConfig, getAllSubModelNames } from '../services/modelConfigLoader';

interface StoryboardVideoNodeProps {
  node: AppNode;
  onUpdate: (nodeId: string, updates: any) => void;
  onAction: (nodeId: string, action: string, payload?: any) => void;
  onExpand?: (data: any) => void;
  nodeQuery?: any;
}

/**
 * 分镜视频生成节点 UI
 */
const StoryboardVideoNodeComponent: React.FC<StoryboardVideoNodeProps> = ({
  node,
  onUpdate,
  onAction,
  onExpand,
  nodeQuery
}) => {
  const data = node.data as any;
  const status = data.status || 'idle';

  // UI 状态 - 使用本地状态实时跟踪已选择的分镜
  const [expandedShotId, setExpandedShotId] = useState<string | null>(null);
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [showFusionOptions, setShowFusionOptions] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(data.selectedShotIds || []);

  // 动态加载的模型配置
  const [dynamicSubModels, setDynamicSubModels] = useState<Record<string, string[]>>({});
  const [dynamicSubModelNames, setDynamicSubModelNames] = useState<Record<string, string>>({});
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isRefreshingConfig, setIsRefreshingConfig] = useState(false);

  // 加载后台模型配置
  const loadConfig = async () => {
    try {
      const [subModels, subModelNames] = await Promise.all([
        getAllModelsConfig(),
        getAllSubModelNames()
      ]);
      setDynamicSubModels(subModels);
      setDynamicSubModelNames(subModelNames);
      setConfigLoaded(true);
      console.log('[StoryboardVideoNode] ✅ Model config loaded from backend:', {
        platforms: Object.keys(subModels),
        totalModels: Object.values(subModels).reduce((sum, models) => sum + Object.keys(models).length, 0)
      });
      return true;
    } catch (error) {
      console.error('[StoryboardVideoNode] ❌ Failed to load model config:', error);
      // 失败时使用空对象，组件会回退到硬编码的默认值
      setConfigLoaded(true);
      return false;
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // 手动刷新配置
  const handleRefreshConfig = async () => {
    setIsRefreshingConfig(true);
    const success = await loadConfig();
    setIsRefreshingConfig(false);
    if (success) {
      // 可以添加一个简单的提示
      console.log('[StoryboardVideoNode] ✅ Config refreshed successfully');
    }
  };

  // 当 node.data.selectedShotIds 从外部变化时（不是通过本组件的 updateSelectedIds），同步到本地状态
  const prevSelectedShotIdsRef = React.useRef<string[]>(data.selectedShotIds || []);
  React.useEffect(() => {
    const currentIds = data.selectedShotIds || [];
    const prevIds = prevSelectedShotIdsRef.current;

    // 只在外部更新时同步（长度或内容不同）
    if (currentIds.length !== prevIds.length || currentIds.some((id, i) => id !== prevIds[i])) {
      setLocalSelectedIds(currentIds);
      prevSelectedShotIdsRef.current = currentIds;
    }
  }, [data.selectedShotIds]);

  // 更新选择并同步到父组件
  const updateSelectedIds = (newIds: string[]) => {
    setLocalSelectedIds(newIds);
    prevSelectedShotIdsRef.current = newIds;  // 更新 ref 避免触发 useEffect
    onUpdate(node.id, { selectedShotIds: newIds });
  };

  /**
   * 渲染阶段1: idle - 空闲状态，操作按钮在操作区
   */
  const renderIdle = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
        <Film size={32} className="text-purple-400" />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-bold text-white mb-1">分镜视频生成</h3>
        <p className="text-xs text-slate-400">请在右侧操作区点击"获取分镜"按钮</p>
      </div>
    </div>
  );

  /**
   * 渲染阶段2: selecting - 分镜选择（左右布局：左边分镜图，右边选择列表）
   */
  const renderSelecting = () => {
    const shots = data.availableShots || [];
    const selectedShots = shots.filter((s: any) => localSelectedIds.includes(s.id));

    const toggleShot = (shotId: string) => {
      const updated = localSelectedIds.includes(shotId)
        ? localSelectedIds.filter((id: string) => id !== shotId)
        : [...localSelectedIds, shotId];
      updateSelectedIds(updated);
    };

    const toggleAll = () => {
      const updated = localSelectedIds.length === shots.length ? [] : shots.map((s: any) => s.id);
      console.log('[toggleAll] Current:', localSelectedIds.length, 'Total:', shots.length, 'Updated:', updated.length);
      updateSelectedIds(updated);
    };

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              已选择 {localSelectedIds.length} / {shots.length} 个分镜
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAll();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
            >
              {localSelectedIds.length === shots.length ? '取消全选' : '全选'}
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 flex gap-3 p-3 overflow-hidden">
          {/* Left: Selected Shots Grid (分镜图) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 mb-2">
              已选择的分镜
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {selectedShots.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-600">
                  <Grid3X3 size={24} className="opacity-50" />
                  <span className="text-xs">请从右侧选择分镜</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {selectedShots.map((shot: SplitStoryboardShot) => (
                    <div
                      key={shot.id}
                      className="relative group/shot"
                      onClick={() => toggleShot(shot.id)}
                    >
                      <img
                        src={shot.splitImage}
                        alt={`分镜 ${shot.shotNumber}`}
                        className="w-full aspect-video object-cover rounded-lg border-2 border-purple-500/50 cursor-pointer hover:border-purple-400 transition-all"
                      />
                      <div className="absolute top-1 left-1 w-5 h-5 rounded bg-purple-500 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
                        <span className="text-[10px] text-white font-medium">#{shot.shotNumber}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: All Shots List (选择列表) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 mb-2">
              所有分镜
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {shots.map((shot: SplitStoryboardShot) => {
                const isSelected = localSelectedIds.includes(shot.id);
                return (
                  <div
                    key={shot.id}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-black/40 border-white/10 hover:bg-black/60'
                    }`}
                    onClick={() => toggleShot(shot.id)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                        isSelected ? 'bg-purple-500 border-purple-500' : 'border-white/20'
                      }`}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>

                      {/* Thumbnail */}
                      <img
                        src={shot.splitImage}
                        alt={`分镜 ${shot.shotNumber}`}
                        className="w-16 h-10 rounded object-cover border border-white/10 shrink-0"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-300">#{shot.shotNumber}</span>
                          {shot.scene && (
                            <span className="text-[9px] text-slate-500 truncate">{shot.scene}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {shot.visualDescription || '暂无描述'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => onAction(node.id, 'generate-prompt')}
            disabled={localSelectedIds.length === 0 || data.isLoading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
              localSelectedIds.length === 0 || data.isLoading
                ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02]'
            }`}
          >
            {data.isLoading ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
            <span>生成提示词</span>
          </button>
        </div>
      </div>
    );
  };

  /**
   * 渲染阶段3: prompting - 提示词编辑 + 模型配置（左右布局：左边分镜图+融合图，右边提示词+配置）
   * 注意：操作按钮（返回、生成视频）在节点底部操作区
   */
  const renderPrompting = () => {
    const prompt = data.generatedPrompt || '';
    const selectedPlatform = data.selectedPlatform || 'yunwuapi';
    const selectedModel = data.selectedModel || 'luma';
    const modelConfig = data.modelConfig || {
      aspect_ratio: '16:9',
      duration: '5',
      quality: 'standard'
    };

    const shots = data.availableShots || [];
    const selectedShots = shots.filter((s: any) => localSelectedIds.includes(s.id));
    const fusedImage = data.fusedImage; // 融合后的图片

    const platforms = [
      { code: 'yunwuapi', name: '云雾API', models: ['veo', 'luma', 'runway', 'minimax', 'volcengine', 'grok', 'qwen', 'sora'] }
    ];

    const modelNames: Record<string, string> = {
      veo: 'Veo',
      luma: 'Luma Dream Machine',
      runway: 'Runway Gen-3',
      minimax: '海螺',
      volcengine: '豆包',
      grok: 'Grok',
      qwen: '通义万象',
      sora: 'Sora'
    };

    // 硬编码的默认子模型列表（作为fallback）
    const defaultSubModels: Record<string, string[]> = {
      veo: [
        'veo2',
        'veo2-fast',
        'veo2-fast-frames',
        'veo2-fast-components',
        'veo2-pro',
        'veo3',
        'veo3-fast',
        'veo3-pro',
        'veo3-pro-frames',
        'veo3-fast-frames',
        'veo3-frames'
      ],
      luma: [
        'ray-v2',
        'photon',
        'photon-flash'
      ],
      sora: [
        'sora',
        'sora-2'
      ],
      runway: [
        'gen3-alpha-turbo',
        'gen3-alpha',
        'gen3-alpha-extreme'
      ],
      minimax: [
        'video-01',
        'video-01-live'
      ],
      volcengine: [
        'doubao-video-1',
        'doubao-video-pro'
      ],
      grok: [
        'grok-2-video',
        'grok-vision-video'
      ],
      qwen: [
        'qwen-video',
        'qwen-video-plus'
      ]
    };

    // 默认子模型显示名称
    const defaultSubModelDisplayNames: Record<string, string> = {
      // veo
      'veo2': 'Veo 2',
      'veo2-fast': 'Veo 2 Fast',
      'veo2-fast-frames': 'Veo 2 Fast Frames',
      'veo2-fast-components': 'Veo 2 Fast Components',
      'veo2-pro': 'Veo 2 Pro',
      'veo3': 'Veo 3',
      'veo3-fast': 'Veo 3 Fast',
      'veo3-pro': 'Veo 3 Pro',
      'veo3-pro-frames': 'Veo 3 Pro Frames',
      'veo3-fast-frames': 'Veo 3 Fast Frames',
      'veo3-frames': 'Veo 3 Frames',
      // luma
      'ray-v2': 'Ray V2',
      'photon': 'Photon',
      'photon-flash': 'Photon Flash',
      // sora
      'sora': 'Sora 1',
      'sora-2': 'Sora 2',
      // runway
      'gen3-alpha-turbo': 'Gen-3 Alpha Turbo',
      'gen3-alpha': 'Gen-3 Alpha',
      'gen3-alpha-extreme': 'Gen-3 Alpha Extreme',
      // minimax
      'video-01': 'Video-01',
      'video-01-live': 'Video-01 Live',
      // volcengine
      'doubao-video-1': 'Doubao Video 1',
      'doubao-video-pro': 'Doubao Video Pro',
      // grok
      'grok-2-video': 'Grok 2 Video',
      'grok-vision-video': 'Grok Vision Video',
      // qwen
      'qwen-video': 'Qwen Video',
      'qwen-video-plus': 'Qwen Video Plus'
    };

    // 使用动态加载的配置（如果已加载），否则回退到硬编码的默认值
    const subModels = configLoaded && Object.keys(dynamicSubModels).length > 0 && dynamicSubModels[selectedPlatform]
      ? dynamicSubModels[selectedPlatform]
      : defaultSubModels;

    // 使用动态加载的显示名称，否则回退到默认值
    const subModelDisplayNames = configLoaded && Object.keys(dynamicSubModelNames).length > 0
      ? { ...defaultSubModelDisplayNames, ...dynamicSubModelNames }
      : defaultSubModelDisplayNames;

    // 获取当前选择的子模型，如果没有则使用默认的第一个
    const selectedSubModel = data.subModel || (subModels[selectedModel]?.[0] || selectedModel);

    // 处理图片融合
    const handleImageFusion = async () => {
      console.log('[图片融合] 开始处理，选中分镜数:', selectedShots.length);

      if (selectedShots.length === 0) {
        console.error('[图片融合] 没有选中的分镜');
        return;
      }

      try {
        onUpdate(node.id, { isLoadingFusion: true });
        console.log('[图片融合] 开始加载图片...');

        // 使用 canvas 融合图片
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('[图片融合] 无法创建 canvas context');
          return;
        }

        // 设置画布大小（根据图片数量决定布局）
        const cols = Math.ceil(Math.sqrt(selectedShots.length));
        const rows = Math.ceil(selectedShots.length / cols);
        const imgWidth = 300;
        const imgHeight = 169;
        const padding = 10;

        canvas.width = cols * imgWidth + (cols + 1) * padding;
        canvas.height = rows * imgHeight + (rows + 1) * padding + 30; // 额外30px用于标题

        // 填充背景
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 加载所有图片
        console.log('[图片融合] 加载', selectedShots.length, '张图片');
        const loadPromises = selectedShots.map((shot, index) => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              console.log('[图片融合] 图片', index + 1, '加载成功');
              resolve(img);
            };
            img.onerror = (error) => {
              console.error('[图片融合] 图片', index + 1, '加载失败:', error);
              reject(error);
            };
            img.src = shot.splitImage;
          });
        });

        const images = await Promise.all(loadPromises);
        console.log('[图片融合] 所有图片加载完成，开始绘制');

        // 绘制图片
        images.forEach((img, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = padding + col * (imgWidth + padding);
          const y = padding + 30 + row * (imgHeight + padding); // 30px偏移用于标题

          // 绘制图片
          ctx.drawImage(img, x, y, imgWidth, imgHeight);

          // 绘制边框
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, imgWidth, imgHeight);

          // 绘制序号
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px Arial';
          ctx.fillText(`#${index + 1}`, x + 10, y + 25);
        });

        // 转换为 base64
        console.log('[图片融合] 转换为 base64');
        const fusedDataUrl = canvas.toDataURL('image/png');

        // 保存融合图片
        console.log('[图片融合] 保存融合图片，长度:', fusedDataUrl.length);
        onUpdate(node.id, {
          fusedImage: fusedDataUrl,
          isLoadingFusion: false
        });
        console.log('[图片融合] 完成！');
      } catch (error) {
        console.error('[图片融合] 失败:', error);
        onUpdate(node.id, { isLoadingFusion: false });
      }
    };

    return (
      <div className="flex flex-col h-full">
        {/* Two Column Layout */}
        <div className="flex-1 flex gap-3 p-3 overflow-hidden">
          {/* Left: Selected Storyboard Images + Fused Image */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="text-[10px] font-bold text-slate-400 mb-2">
              分镜图 ({selectedShots.length})
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Fused Image */}
              {fusedImage && (
                <div className="mb-3 p-2 bg-black/40 rounded-lg border border-purple-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-purple-300">融合参考图</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExpand?.({
                          type: 'image',
                          src: fusedImage,
                          rect: new DOMRect()
                        });
                      }}
                      className="text-[9px] text-purple-400 hover:text-purple-300"
                    >
                      查看大图
                    </button>
                  </div>
                  <img
                    src={fusedImage}
                    alt="融合分镜图"
                    className="w-full rounded border border-white/10 cursor-pointer hover:border-purple-500/50 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpand?.({
                        type: 'image',
                        src: fusedImage,
                        rect: new DOMRect()
                      });
                    }}
                  />
                </div>
              )}

              {/* Original Shots Grid */}
              <div className="grid grid-cols-2 gap-2">
                {selectedShots.map((shot: SplitStoryboardShot) => (
                  <div key={shot.id} className="relative group/shot">
                    <img
                      src={shot.splitImage}
                      alt={`分镜 ${shot.shotNumber}`}
                      className="w-full aspect-video object-cover rounded-lg border border-white/10"
                    />
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
                      <span className="text-[10px] text-white font-medium">#{shot.shotNumber}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Image Fusion Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleImageFusion();
                }}
                disabled={data.isLoadingFusion || selectedShots.length === 0}
                className={`mt-3 w-full px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  data.isLoadingFusion || selectedShots.length === 0
                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 border border-purple-500/30'
                }`}
              >
                {data.isLoadingFusion ? <Loader2 className="animate-spin" size={12} /> : <ImageIcon size={12} />}
                <span>{data.isLoadingFusion ? '融合中...' : '生成分镜融合图'}</span>
              </button>
            </div>
          </div>

          {/* Right: Prompt Editor & Model Configuration */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Prompt Editor */}
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">视频生成提示词</span>
                <button
                  onClick={() => onUpdate(node.id, { promptModified: false })}
                  className={`text-[10px] transition-colors ${
                    data.promptModified ? 'text-purple-400 hover:text-purple-300' : 'text-slate-600'
                  }`}
                  disabled={!data.promptModified}
                >
                  重置
                </button>
              </div>
              <textarea
                className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50 resize-none custom-scrollbar leading-relaxed font-mono"
                placeholder="AI 将生成 Sora 2 Story Mode 格式提示词&#10;&#10;示例：&#10;Shot 1:&#10;duration: 5.0s&#10;Scene: 场景描述，运镜，风格等"
                value={prompt}
                onChange={(e) => {
                  onUpdate(node.id, { generatedPrompt: e.target.value, promptModified: true });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              />
            </div>

            {/* Model Configuration */}
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">模型配置</span>
                  {configLoaded && Object.keys(dynamicSubModels).length > 0 && (
                    <span className="text-[8px] text-green-400">● 后台</span>
                  )}
                  {!configLoaded && (
                    <span className="text-[8px] text-yellow-400">● 加载中...</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefreshConfig}
                    disabled={isRefreshingConfig}
                    className="text-[9px] text-slate-400 hover:text-purple-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                    title="刷新后台配置"
                  >
                    <RefreshCw size={10} className={isRefreshingConfig ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => setShowModelConfig(!showModelConfig)}
                    className="text-[9px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    <Settings size={10} />
                    {showModelConfig ? '收起' : '展开'}
                  </button>
                </div>
              </div>

              {/* Quick Model Display */}
              <div className="flex items-center gap-2 px-2 py-1.5 bg-black/40 rounded-lg border border-white/10">
                <Sparkles size={10} className="text-purple-400" />
                <span className="text-[9px] text-slate-300">{modelNames[selectedModel]}</span>
                {selectedSubModel && selectedSubModel !== selectedModel && (
                  <>
                    <span className="text-[8px] text-slate-500">·</span>
                    <span className="text-[9px] text-slate-400">{subModelDisplayNames[selectedSubModel] || selectedSubModel}</span>
                  </>
                )}
                <span className="text-[8px] text-slate-500">·</span>
                <span className="text-[9px] text-slate-400">{modelConfig.aspect_ratio}</span>
                <span className="text-[8px] text-slate-500">·</span>
                <span className="text-[9px] text-slate-400">{modelConfig.duration}s</span>
              </div>

              {/* Advanced Config (Collapsible) */}
              {showModelConfig && (
                <div className="flex flex-col gap-2 p-2 bg-black/40 rounded-xl border border-white/10">
                  {/* Platform & Model & Sub Model */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <select
                        className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-slate-200 focus:outline-none"
                        value={selectedPlatform}
                        onChange={(e) => onUpdate(node.id, { selectedPlatform: e.target.value })}
                      >
                        {platforms.map(p => (
                          <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                      </select>
                      <select
                        className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-slate-200 focus:outline-none"
                        value={selectedModel}
                        onChange={(e) => {
                          // 切换模型时，自动选择该模型的第一个子模型
                          const newModel = e.target.value;
                          const firstSubModel = subModels[newModel]?.[0];
                          onUpdate(node.id, {
                            selectedModel: newModel,
                            subModel: firstSubModel
                          });
                        }}
                      >
                        {platforms.find(p => p.code === selectedPlatform)?.models.map(m => (
                          <option key={m} value={m}>{modelNames[m]}</option>
                        ))}
                      </select>
                    </div>
                    {/* 子模型选择 */}
                    {subModels[selectedModel] && subModels[selectedModel].length > 0 && (
                      <select
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-slate-200 focus:outline-none"
                        value={selectedSubModel}
                        onChange={(e) => onUpdate(node.id, { subModel: e.target.value })}
                      >
                        {subModels[selectedModel].map(subModel => (
                          <option key={subModel} value={subModel}>
                            {subModelDisplayNames[subModel] || subModel}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Aspect Ratio & Duration */}
                  <div className="flex gap-2">
                    <div className="flex-1 flex gap-1">
                      {['16:9', '9:16'].map(ratio => (
                        <button
                          key={ratio}
                          onClick={() => onUpdate(node.id, {
                            modelConfig: { ...modelConfig, aspect_ratio: ratio }
                          })}
                          className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                            modelConfig.aspect_ratio === ratio
                              ? 'bg-purple-500 text-white'
                              : 'bg-black/60 text-slate-400 hover:bg-white/5'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 flex gap-1">
                      {['5', '10', '15'].map(duration => (
                        <button
                          key={duration}
                          onClick={() => onUpdate(node.id, {
                            modelConfig: { ...modelConfig, duration }
                          })}
                          className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                            modelConfig.duration === duration
                              ? 'bg-purple-500 text-white'
                              : 'bg-black/60 text-slate-400 hover:bg-white/5'
                          }`}
                        >
                          {duration}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality */}
                  <div className="flex gap-1">
                    {['standard', 'pro', 'hd'].map(quality => (
                      <button
                        key={quality}
                        onClick={() => onUpdate(node.id, {
                          modelConfig: { ...modelConfig, quality }
                        })}
                        className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                          modelConfig.quality === quality
                            ? 'bg-purple-500 text-white'
                            : 'bg-black/60 text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        {quality === 'standard' ? '标清' : quality === 'pro' ? '高清' : '超清'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染阶段4: generating - 进度显示
   */
  const renderGenerating = () => {
    const progress = data.progress || 0;

    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <div
            className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"
            style={{ transform: `rotate(${progress * 3.6}deg)` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{progress}%</span>
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-sm font-bold text-white mb-1">正在生成视频</h3>
          <p className="text-xs text-slate-400">请稍候，这可能需要几分钟...</p>
        </div>

        {/* Progress Steps */}
        <div className="w-full max-w-[240px] space-y-2">
          {['提交任务', '图片融合', '视频生成'].map((step, idx) => {
            const stepProgress = [20, 30, 100];
            const isActive = progress >= stepProgress[idx];
            const isCurrent = progress < stepProgress[idx] && (idx === 0 || progress >= stepProgress[idx - 1]);

            return (
              <div key={step} className={`flex items-center gap-2 text-xs transition-all ${
                isActive ? 'text-purple-400' : 'text-slate-600'
              }`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-purple-500' : 'bg-white/10'
                }`}>
                  {isActive && <Check size={10} className="text-white" />}
                  {isCurrent && <Loader2 className="animate-spin" size={10} />}
                </div>
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * 渲染阶段5: completed - 返回阶段3显示，便于调整
   */
  const renderCompleted = () => {
    // 阶段5与阶段3显示相同的内容，便于调整后重新生成
    return renderPrompting();
  };

  /**
   * 主渲染函数
   */
  const render = () => {
    switch (status) {
      case 'idle':
        return renderIdle();
      case 'selecting':
        return renderSelecting();
      case 'prompting':
        return renderPrompting();
      case 'generating':
        return renderGenerating();
      case 'completed':
        return renderCompleted();
      default:
        return renderIdle();
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1c1c1e]">
      {render()}
    </div>
  );
};

// 使用 memo 优化性能
export const StoryboardVideoNode = memo(StoryboardVideoNodeComponent, (prevProps, nextProps) => {
  // 只在关键属性变化时重新渲染
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.type === nextProps.node.type &&
    prevProps.node.status === nextProps.node.status &&
    prevProps.node.data.status === nextProps.node.data.status &&
    prevProps.node.data.selectedShotIds?.length === nextProps.node.data.selectedShotIds?.length &&
    prevProps.node.data.generatedPrompt === nextProps.node.data.generatedPrompt &&
    prevProps.node.data.progress === nextProps.node.data.progress &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging
  );
});

/**
 * 分镜视频子节点 UI - 显示视频 + 提示词（提示词默认收起）
 */
const StoryboardVideoChildNodeComponent: React.FC<StoryboardVideoNodeProps> = ({
  node
}) => {
  const data = node.data as any;

  return (
    <div className="flex flex-col h-full p-3">
      {/* Video Player */}
      <div className="flex-1 flex flex-col gap-2">
        {data.videoUrl ? (
          <video
            src={data.videoUrl}
            controls
            className="w-full flex-1 bg-black rounded-xl border border-white/10"
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-black/40 rounded-xl border border-white/10">
            <Loader2 className="animate-spin text-purple-400" size={24} />
          </div>
        )}
      </div>
    </div>
  );
};

// 使用 memo 优化性能
export const StoryboardVideoChildNode = memo(StoryboardVideoChildNodeComponent, (prevProps, nextProps) => {
  // 只在关键属性变化时重新渲染
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.type === nextProps.node.type &&
    prevProps.node.data.videoUrl === nextProps.node.data.videoUrl &&
    prevProps.isSelected === nextProps.isSelected
  );
});
