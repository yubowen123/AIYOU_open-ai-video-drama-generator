/**
 * 分镜视频生成节点 UI 组件
 * 实现5阶段状态机：idle → selecting → prompting → generating → completed
 */

import React, { useState, memo, useEffect } from 'react';
import { AppNode, NodeType, SplitStoryboardShot } from '../types';
import { Film, Play, Loader2, Grid3X3, Copy, Check, Image as ImageIcon, Wand2, AlertCircle, Video as VideoIcon, Download } from 'lucide-react';

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
  const [showFusionOptions, setShowFusionOptions] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(data.selectedShotIds || []);

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
    const shots = data.availableShots || [];
    const selectedShots = shots.filter((s: any) => localSelectedIds.includes(s.id));
    const fusedImage = data.fusedImage; // 融合后的图片

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

          {/* Right: Prompt Editor */}
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
  // 检查基本属性
  if (prevProps.node.id !== nextProps.node.id) return false;
  if (prevProps.node.type !== nextProps.node.type) return false;
  if (prevProps.node.status !== nextProps.node.status) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isDragging !== nextProps.isDragging) return false;

  // 检查 data 对象的关键属性
  const prevData = prevProps.node.data;
  const nextData = nextProps.node.data;

  if (prevData.status !== nextData.status) return false;
  if (prevData.progress !== nextData.progress) return false;
  if (prevData.isLoading !== nextData.isLoading) return false;
  if (prevData.isLoadingFusion !== nextData.isLoadingFusion) return false;
  if (prevData.generatedPrompt !== nextData.generatedPrompt) return false;
  if (prevData.promptModified !== nextData.promptModified) return false;
  if (prevData.fusedImage !== nextData.fusedImage) return false;
  if (prevData.selectedPlatform !== nextData.selectedPlatform) return false;
  if (prevData.selectedModel !== nextData.selectedModel) return false;
  if (prevData.subModel !== nextData.subModel) return false;
  if (prevData.enableImageFusion !== nextData.enableImageFusion) return false;

  // 检查 selectedShotIds 数组内容（而不仅仅是长度）
  const prevIds = prevData.selectedShotIds || [];
  const nextIds = nextData.selectedShotIds || [];
  if (prevIds.length !== nextIds.length) return false;
  for (let i = 0; i < prevIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return false;
  }

  // 检查 modelConfig 对象
  const prevConfig = prevData.modelConfig;
  const nextConfig = nextData.modelConfig;
  if (!prevConfig !== !nextConfig) return false;
  if (prevConfig && nextConfig) {
    if (prevConfig.aspect_ratio !== nextConfig.aspect_ratio) return false;
    if (prevConfig.duration !== nextConfig.duration) return false;
    if (prevConfig.quality !== nextConfig.quality) return false;
  }

  // 所有检查都通过，返回 true 表示可以跳过重新渲染
  return true;
});

/**
 * 分镜视频子节点 UI - 显示视频（样式与 SORA_VIDEO_CHILD 保持一致）
 */
const StoryboardVideoChildNodeComponent: React.FC<StoryboardVideoNodeProps> = ({
  node
}) => {
  const data = node.data as any;
  const videoUrl = data.videoUrl;
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [durationValue, setDurationValue] = React.useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [videoError, setVideoError] = React.useState<string | null>(null);

  // 格式化时间显示
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 下载视频
  const handleDownload = async () => {
    if (!videoUrl) {
      alert('视频 URL 不存在');
      return;
    }

    try {
      console.log('[视频下载] 开始下载视频');
      alert('正在从原始地址下载，请稍候...');

      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyboard-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[视频下载] ✅ 下载完成');
    } catch (e) {
      console.error('[视频下载] ❌ 下载失败:', e);
      alert(`视频下载失败: ${e.message}\n\n您也可以右键点击视频，选择"视频另存为"来下载。`);
    }

    setContextMenu(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 overflow-hidden relative">
      {/* Video Player */}
      {videoUrl ? (
        <>
          <video
            ref={(el) => {
              if (el) {
                videoRef.current = el;
                el.onloadedmetadata = () => {
                  setDurationValue(el.duration);
                  setVideoError(null);
                };
                el.onerror = () => {
                  console.error('[视频播放] 加载失败:', videoUrl);
                  setVideoError('视频加载失败');
                };
              }
            }}
            src={videoUrl}
            className="w-full h-full object-cover bg-zinc-900"
            loop
            playsInline
            controls  // ✅ 使用原生视频控件（包含下载按钮）
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            onClick={() => setContextMenu(null)}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* 右键菜单 */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-zinc-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[200px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 text-xs text-white/50 border-b border-white/10 mb-1">
                视频操作
              </div>
              <button
                onClick={handleDownload}
                className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
              >
                <Download size={14} />
                下载视频
              </button>
              <div className="border-t border-white/10 my-1"></div>
              <button
                onClick={() => setContextMenu(null)}
                className="w-full px-3 py-2 text-left text-xs text-white/50 hover:bg-white/10 transition-colors"
              >
                取消
              </button>
            </div>
          )}

          {/* 点击其他地方关闭菜单 */}
          {contextMenu && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
          )}
        </>
      ) : data.error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400 bg-black/40 p-6 text-center">
          <AlertCircle className="text-red-500 mb-1" size={32} />
          <span className="text-xs font-medium text-red-200">{data.error}</span>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600">
          <VideoIcon size={32} className="opacity-50" />
          <span className="text-xs font-medium">等待视频生成</span>
        </div>
      )}

      {/* Error overlay */}
      {node.status === 'error' && !videoUrl && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
          <AlertCircle className="text-red-500 mb-2" />
          <span className="text-xs text-red-200">{data.error}</span>
        </div>
      )}
    </div>
  );
};

// 使用 memo 优化性能
export const StoryboardVideoChildNode = memo(StoryboardVideoChildNodeComponent, (prevProps, nextProps) => {
  // 只在关键属性变化时重新渲染
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.type === nextProps.node.type &&
    prevProps.node.status === nextProps.node.status &&
    prevProps.node.data.videoUrl === nextProps.node.data.videoUrl &&
    prevProps.node.data.error === nextProps.node.data.error &&
    prevProps.isSelected === nextProps.isSelected
  );
});
