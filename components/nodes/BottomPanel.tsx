/**
 * AIYOU 漫剧生成平台 - 节点底部面板渲染
 *
 * 从 nodes/index.tsx 的 renderBottomPanel() 提取。
 * 根据节点类型渲染底部的输入面板、配置面板等。
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

import React from 'react';
import { NodeType, StoryboardShot, CharacterProfile } from '../../types';
import { RefreshCw, Play, Image as ImageIcon, Video as VideoIcon, Type, AlertCircle, CheckCircle, Plus, Maximize2, Download, MoreHorizontal, Wand2, Scaling, FileSearch, Edit, Loader2, Layers, Trash2, X, Upload, Scissors, Film, MousePointerClick, Crop as CropIcon, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, GripHorizontal, Link, Copy, Monitor, Music, Pause, Volume2, Mic2, BookOpen, ScrollText, Clapperboard, LayoutGrid, Box, User, Users, Save, RotateCcw, Eye, List, Sparkles, ZoomIn, ZoomOut, Minus, Circle, Square, Maximize, Move, RotateCw, TrendingUp, TrendingDown, ArrowRight, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight, Palette, Grid, Grid3X3, MoveHorizontal, ArrowUpDown, Database, ShieldAlert, ExternalLink, Package } from 'lucide-react';
import { PromptEditor } from '../PromptEditor';
import { IMAGE_MODELS, TEXT_MODELS, VIDEO_MODELS, AUDIO_MODELS } from '../../services/modelConfig';
import {
  IMAGE_ASPECT_RATIOS, VIDEO_ASPECT_RATIOS,
  IMAGE_COUNTS, VIDEO_COUNTS, GLASS_PANEL,
  SHORT_DRAMA_GENRES, SHORT_DRAMA_SETTINGS,
} from './constants';
import { InputThumbnails } from './helpers';
import type { BottomPanelContext } from './types';

export const BottomPanel: React.FC<BottomPanelContext> = (ctx) => {
  const {
    node, onUpdate, onAction, onDelete, onExpand, onCrop, onMediaContextMenu,
    onCharacterAction, onViewCharacter, onOpenVideoEditor,
    nodeQuery, characterLibrary, inputAssets,
    isWorking, isActionDisabled, isHovered, localPrompt, setLocalPrompt,
    commitPrompt, handleActionClick, handleCmdEnter, mediaRef,
    videoBlobUrl, setVideoBlobUrl, isLoadingVideo, setIsLoadingVideo,
    showImageGrid, setShowImageGrid, isPlayingAudio, setIsPlayingAudio,
    generationMode, isInputFocused, setIsInputFocused,
    inputHeight, setInputHeight, handleInputResizeStart, handleExpand,
    isUploading, fileInputRef, handleUploadVideo, handleUploadImage,
    handleAspectRatioSelect,
    localSoraConfigs, setLocalSoraConfigs,
    availableChapters, setAvailableChapters, viewingOutline, setViewingOutline,
    handleRefreshChapters,
    dynamicSubModels, dynamicSubModelNames, configLoaded,
    showExportModal, setShowExportModal, exportSettings, setExportSettings,
    isActionProcessing,
    isOpen: _isOpenProp, hasInputs, onInputReorder, nodeWidth, nodeHeight, isSelected,
  } = ctx;

     // DRAMA_REFINED node doesn't need bottom panel (display only)
     if (node.type === NodeType.DRAMA_REFINED) {
         return null;
     }

     // STORYBOARD_VIDEO_GENERATOR 和 SORA_VIDEO_GENERATOR 在特定状态下始终显示底部操作栏
     // PROMPT_INPUT 和 IMAGE_GENERATOR 始终显示操作栏（方便编辑）
     // 但剧本分集的子节点（创意描述）不应始终显示生图操作栏
     const isEpisodeChildNode = node.type === NodeType.PROMPT_INPUT && nodeQuery?.hasUpstreamNode(node.id, NodeType.SCRIPT_EPISODE);
     const isAlwaysOpen = (node.type === NodeType.STORYBOARD_VIDEO_GENERATOR && node.data.status === 'prompting') ||
                          (node.type === NodeType.SORA_VIDEO_GENERATOR && node.data.taskGroups && node.data.taskGroups.length > 0) ||
                          (node.type === NodeType.PROMPT_INPUT && !isEpisodeChildNode) ||
                          node.type === NodeType.IMAGE_GENERATOR;
     const isPanelOpen = isAlwaysOpen || (isHovered || isInputFocused);

     // 获取当前画布缩放比例，用于反向缩放底部操作栏以保持按钮可点击
     const canvasScale = ((window as unknown as { __canvasScale?: number }).__canvasScale) || 1;
     const inverseScale = canvasScale < 0.5 ? 1 / canvasScale : 1; // 只在缩放小于50%时才反向缩放

     // Special handling for DRAMA_ANALYZER
     if (node.type === NodeType.DRAMA_ANALYZER) {
         const selectedFields = node.data.selectedFields || [];
         const hasAnalysis = node.data.dramaIntroduction || node.data.worldview;

         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'OPTION') e.stopPropagation(); }} onWheel={(e) => e.stopPropagation()}>
                     {/* Drama name input + analyze button */}
                     <div className="flex items-center gap-2">
                         <Film size={14} className="text-violet-400 shrink-0" />
                         <input
                             className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                             placeholder="输入剧名进行分析..."
                             value={node.data.dramaName || ''}
                             onChange={(e) => onUpdate(node.id, { dramaName: e.target.value })}
                             onMouseDown={e => e.stopPropagation()}
                         />
                         <button
                             onClick={handleActionClick}
                             disabled={isWorking || !node.data.dramaName?.trim()}
                             className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                 isWorking || !node.data.dramaName?.trim()
                                     ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                     : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg hover:shadow-violet-500/20'
                             }`}
                         >
                             {isWorking ? <Loader2 className="animate-spin" size={12} /> : '分析'}
                         </button>
                     </div>

                     {/* Extract button (only shown when has analysis and selected fields) */}
                     {hasAnalysis && selectedFields.length > 0 && (
                         <button
                             onClick={() => onAction?.(node.id, 'extract')}
                             className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                         >
                             <Sparkles size={14} />
                             提取精炼信息（已选择 {selectedFields.length} 项）
                         </button>
                     )}
                 </div>
             </div>
         );
     }

     // Special handling for STYLE_PRESET
     if (node.type === NodeType.STYLE_PRESET) {
         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'OPTION') e.stopPropagation(); }} onWheel={(e) => e.stopPropagation()}>
                    {/* Preset Type Selector */}
                     <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-2 text-[10px] text-slate-400">
                             <Palette size={12} className="text-purple-400" />
                             <span>应用范围</span>
                         </div>
                         <div className="flex gap-2">
                             {[
                                 { value: 'SCENE', label: '场景 (Scene)', icon: LayoutGrid },
                                 { value: 'CHARACTER', label: '人物 (Character)', icon: User }
                             ].map(({ value, label, icon: Icon }) => (
                                 <button
                                     key={value}
                                     onClick={() => onUpdate(node.id, { stylePresetType: value })}
                                     className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                         (node.data.stylePresetType || 'SCENE') === value
                                             ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                                             : 'bg-black/20 border border-white/10 text-slate-400 hover:bg-white/5'
                                     }`}
                                 >
                                     <Icon size={14} />
                                     <span>{label}</span>
                                 </button>
                             ))}
                         </div>
                     </div>

                     {/* User Input */}
                     <div className="flex flex-col gap-2">
                         <label className="text-[10px] text-slate-400">补充描述</label>
                         <textarea
                             className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none h-20"
                             placeholder="输入额外的风格描述，如：赛博朋克风格、温馨治愈系...&#10;或人物特征：银发少女、机甲战士、古装书生..."
                             value={node.data.styleUserInput || ''}
                             onChange={(e) => onUpdate(node.id, { styleUserInput: e.target.value })}
                             onMouseDown={e => e.stopPropagation()}
                             onWheel={(e) => e.stopPropagation()}
                         />
                     </div>

                     {/* Generate Button */}
                     <button
                         onClick={handleActionClick}
                         disabled={isActionDisabled}
                         className={`w-full px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                             isWorking
                                 ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                 : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/20'
                         }`}
                     >
                         {isWorking ? (
                             <>
                                 <Loader2 className="animate-spin" size={14} />
                                 <span>生成中...</span>
                             </>
                         ) : (
                             <>
                                 <Palette size={14} />
                                 <span>🎨 生成风格提示词</span>
                             </>
                         )}
                     </button>
                 </div>
             </div>
         );
     }

     // Special handling for SORA_VIDEO_GENERATOR
     if (node.type === NodeType.SORA_VIDEO_GENERATOR) {
         const taskGroups = node.data.taskGroups || [];
         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'OPTION') e.stopPropagation(); }} onWheel={(e) => e.stopPropagation()}>
                    {/* Sora2 Configuration */}
                     <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-2 text-[10px] text-slate-400">
                             <Wand2 size={12} className="text-green-400" />
                             <span>Sora 2 配置</span>
                         </div>

                         {/* Config Controls - 3 Options */}
                         <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                             {/* Get current config from node level, not task groups */}
                             {(() => {
                                 const currentConfig = node.data.sora2Config || { aspect_ratio: '16:9', duration: '10', hd: true };
                                 const updateConfig = (updates: any) => {
                                     const newConfig = { ...currentConfig, ...updates };
                                     // 同时更新节点级别和所有任务组的配置
                                     const updatedTaskGroups = taskGroups.map((tg: any) => ({
                                         ...tg,
                                         sora2Config: newConfig
                                     }));
                                     onUpdate(node.id, {
                                         sora2Config: newConfig,
                                         taskGroups: updatedTaskGroups
                                     });
                                 };
                                 return (
                                     <>
                                     {/* Aspect Ratio & Duration Row */}
                                     <div className="flex items-center gap-3 mb-2">
                                         {/* Aspect Ratio Toggle */}
                                         <div className="flex-1">
                                             <div className="text-[9px] font-bold text-slate-500 mb-1">视频比例</div>
                                             <div className="flex gap-1">
                                                 <button
                                                     onClick={() => updateConfig({ aspect_ratio: '16:9' as const })}
                                                     onMouseDown={(e) => e.stopPropagation()}
                                                     className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
                                                         currentConfig.aspect_ratio === '16:9'
                                                             ? 'bg-indigo-500 text-white'
                                                             : 'bg-white/10 text-slate-400 hover:bg-white/20'
                                                     }`}
                                                 >
                                                     16:9 横屏
                                                 </button>
                                                 <button
                                                     onClick={() => updateConfig({ aspect_ratio: '9:16' as const })}
                                                     onMouseDown={(e) => e.stopPropagation()}
                                                     className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
                                                         currentConfig.aspect_ratio === '9:16'
                                                             ? 'bg-indigo-500 text-white'
                                                             : 'bg-white/10 text-slate-400 hover:bg-white/20'
                                                     }`}
                                                 >
                                                     9:16 竖屏
                                                 </button>
                                             </div>
                                         </div>

                                         {/* Duration Selector */}
                                         <div className="flex-1">
                                             <div className="text-[9px] font-bold text-slate-500 mb-1">时长</div>
                                             <div className="flex gap-1">
                                                 {(['10', '15', '25'] as const).map((dur) => (
                                                     <button
                                                         key={dur}
                                                         onClick={() => updateConfig({ duration: dur as any })}
                                                         onMouseDown={(e) => e.stopPropagation()}
                                                         className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${
                                                             currentConfig.duration === dur
                                                                 ? 'bg-indigo-500 text-white'
                                                                 : 'bg-white/10 text-slate-400 hover:bg-white/20'
                                                         }`}
                                                     >
                                                         {dur}s
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     </div>

                                     {/* HD Toggle */}
                                     <div className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded">
                                         <span className="text-[10px] text-slate-400">高清画质 (1080p)</span>
                                         <button
                                             onClick={() => updateConfig({ hd: !currentConfig.hd })}
                                             onMouseDown={(e) => e.stopPropagation()}
                                             className={`w-10 h-5 rounded-full transition-colors relative ${
                                                 currentConfig.hd ? 'bg-green-500' : 'bg-slate-600'
                                             }`}
                                         >
                                             <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                                 currentConfig.hd ? 'left-5' : 'left-0.5'
                                             }`}></div>
                                         </button>
                                     </div>
                                     </>
                                 );
                             })()}
                         </div>
                     </div>


                     {/* Action Buttons */}
                     {taskGroups.length === 0 ? (
                         // Stage 1: Generate task groups
                         <button
                             onClick={handleActionClick}
                             disabled={isActionDisabled}
                             className={`w-full px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                 isWorking
                                     ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                     : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/20'
                             }`}
                         >
                             {isWorking ? (
                                 <>
                                     <Loader2 className="animate-spin" size={14} />
                                     <span>生成中...</span>
                                 </>
                             ) : (
                                 <>
                                     <Wand2 size={14} />
                                     <span>开始生成</span>
                                 </>
                             )}
                         </button>
                     ) : (
                         // Stage 2 & 3: Generate videos or regenerate
                         <>
                             {/* Status Hint */}
                             {taskGroups.filter((tg: any) => tg.splitShots && tg.splitShots.length > 0).length === 0 && (
                                 <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                     <div className="flex items-center gap-2 text-yellow-300 text-[9px]">
                                         <AlertCircle size={12} />
                                         <span>任务组尚未创建分镜数据，请确保已完成"开始生成"流程</span>
                                     </div>
                                 </div>
                             )}

                             <div className="flex gap-2">
                                 <button
                                     onClick={(e) => {
                                         e.stopPropagation();
                                         onAction?.(node.id, 'fuse-images');
                                     }}
                                     onMouseDown={(e) => e.stopPropagation()}
                                     onPointerDownCapture={(e) => e.stopPropagation()}
                                     disabled={isWorking || taskGroups.filter((tg: any) => tg.splitShots && tg.splitShots.length > 0).length === 0}
                                     className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                         isWorking || taskGroups.filter((tg: any) => tg.splitShots && tg.splitShots.length > 0).length === 0
                                             ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                             : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:shadow-lg hover:shadow-purple-500/20'
                                     }`}
                                     title={taskGroups.filter((tg: any) => tg.splitShots && tg.splitShots.length > 0).length === 0 ? "请先生成分镜图" : "将分镜图拼接融合"}
                                 >
                                     🖼️ 图片融合
                                 </button>
                                 <button
                                     onClick={(e) => {
                                         e.stopPropagation();
                                         onAction?.(node.id, 'generate-videos');
                                     }}
                                     onMouseDown={(e) => e.stopPropagation()}
                                     onPointerDownCapture={(e) => e.stopPropagation()}
                                     disabled={isWorking || taskGroups.every((tg: any) => tg.generationStatus === 'completed')}
                                     className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                         isWorking || taskGroups.every((tg: any) => tg.generationStatus === 'completed')
                                             ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                             : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/20'
                                     }`}
                                 >
                                     {isWorking ? (
                                         <Loader2 className="animate-spin" size={12} />
                                     ) : (
                                         '🎬 生成视频'
                                     )}
                                 </button>
                             </div>

                             {/* Progress Info */}
                             {taskGroups.some((tg: any) => tg.generationStatus === 'generating' || tg.generationStatus === 'uploading') && (
                                 <div className="text-[9px] text-slate-400 text-center">
                                     正在生成 {taskGroups.filter((tg: any) => tg.generationStatus === 'generating' || tg.generationStatus === 'uploading').length} 个视频...
                                 </div>
                             )}
                         </>
                     )}
                 </div>
             </div>
         );
     }

     // Special handling for SORA_VIDEO_CHILD
     if (node.type === NodeType.SORA_VIDEO_CHILD) {
         const locallySaved = node.data.locallySaved;
         const videoUrl = node.data.videoUrl;
         const parentId = node.data.parentId || node.inputs?.[0];  // 优先使用parentId，回退到inputs[0]
         const taskGroupId = node.data.taskGroupId;  // 任务组ID
         const provider = node.data.provider || 'yunwu';
         const [isRefreshing, setIsRefreshing] = useState(false);

         // 刷新任务状态
         const handleRefreshStatus = async () => {
             if (!parentId || isRefreshing) {
                 console.error('[Sora2子节点] 缺少parentId或正在刷新');
                 return;
             }

             // 从母节点查询taskGroups
             const parentNode = nodeQuery?.getNode(parentId);
             if (!parentNode) {
                 console.error('[Sora2子节点] 找不到母节点:', parentId);
                 alert('找不到母节点');
                 return;
             }

             // 从taskGroups中找到对应的taskGroup
             const taskGroups = parentNode.data.taskGroups || [];
             const taskGroup = taskGroups.find((tg: any) => tg.id === taskGroupId);

             if (!taskGroup) {
                 console.error('[Sora2子节点] 找不到任务组:', taskGroupId);
                 alert('找不到任务组');
                 return;
             }

             const soraTaskId = taskGroup.soraTaskId;
             if (!soraTaskId) {
                 console.error('[Sora2子节点] 任务组没有soraTaskId:', taskGroup);
                 alert('任务组没有任务ID，请重新生成');
                 return;
             }

             setIsRefreshing(true);

             try {
                 // 获取API Key
                 const getApiKey = async () => {
                     if (provider === 'yunwu') {
                         return localStorage.getItem('YUNWU_API_KEY');
                     } else if (provider === 'sutu') {
                         return localStorage.getItem('SUTU_API_KEY');
                     } else if (provider === 'yijiapi') {
                         return localStorage.getItem('YIJIAPI_API_KEY');
                     }
                     return null;
                 };

                 const apiKey = await getApiKey();
                 if (!apiKey) {
                     alert('请先配置API Key');
                     return;
                 }

                 // 根据不同的provider调用不同的API
                 let apiUrl: string;
                 let requestBody: any;

                 if (provider === 'yunwu') {
                     apiUrl = 'http://localhost:3001/api/yunwuapi/status';
                     requestBody = { task_id: soraTaskId };
                 } else if (provider === 'sutu') {
                     apiUrl = 'http://localhost:3001/api/sutu/query';
                     requestBody = { id: soraTaskId };
                 } else if (provider === 'yijiapi') {
                     apiUrl = `http://localhost:3001/api/yijiapi/query/${encodeURIComponent(soraTaskId)}`;
                     requestBody = null;
                 } else {
                     throw new Error('不支持的provider');
                 }

                 const response = await fetch(apiUrl, {
                     method: 'POST',
                     headers: {
                         'Content-Type': 'application/json',
                         'X-API-Key': apiKey
                     },
                     body: requestBody ? JSON.stringify(requestBody) : undefined
                 });

                 if (!response.ok) {
                     throw new Error(`HTTP ${response.status}`);
                 }

                 const data = await response.json();

                 // 根据provider解析响应
                 let newVideoUrl: string | undefined;
                 let newStatus: string;
                 let newProgress: number;
                 let newViolationReason: string | undefined;

                 if (provider === 'yunwu') {
                     newVideoUrl = data.video_url;
                     newStatus = data.status;
                     newProgress = data.progress || 0;
                     if (newStatus === 'error' || newStatus === 'failed') {
                         newViolationReason = data.error || '视频生成失败';
                     }
                 } else if (provider === 'sutu') {
                     newVideoUrl = data.data?.remote_url || data.data?.video_url;
                     newStatus = data.data?.status === 'success' ? 'completed' : 'processing';
                     newProgress = data.data?.status === 'success' ? 100 : 50;
                 } else if (provider === 'yijiapi') {
                     newVideoUrl = data.url;
                     newStatus = data.status === 'completed' ? 'completed' : 'processing';
                     newProgress = data.progress || (data.status === 'completed' ? 100 : 0);
                 }

                 // 更新节点数据
                 if (newVideoUrl) {
                     onUpdate(node.id, {
                         videoUrl: newVideoUrl,
                         status: newStatus === 'completed' ? NodeStatus.SUCCESS : undefined,
                         progress: newProgress,
                         violationReason: newViolationReason
                     });
                 } else if (newStatus === 'processing' || newStatus === 'pending') {
                     onUpdate(node.id, {
                         progress: newProgress,
                         violationReason: undefined
                     });
                 } else if (newViolationReason) {
                     onUpdate(node.id, {
                         violationReason: newViolationReason,
                         status: NodeStatus.ERROR
                     });
                 }
             } catch (error: any) {
                 console.error('[Sora2子节点] ❌ 刷新失败:', error);
                 alert(`刷新失败: ${error.message}`);
             } finally {
                 setIsRefreshing(false);
             }
         };

         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-4 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'OPTION') e.stopPropagation(); }} onWheel={(e) => e.stopPropagation()}>
                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        {/* Refresh Status Button - 需要parentId */}
                        {parentId && (
                             <button
                                 onClick={handleRefreshStatus}
                                 disabled={isRefreshing}
                                 className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                     isRefreshing
                                         ? 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/10'
                                         : 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 hover:from-cyan-500/40 hover:to-blue-500/40 text-cyan-100 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                                 }`}
                             >
                                 {isRefreshing ? (
                                     <>
                                         <RefreshCw className="animate-spin" size={18} />
                                         <span>刷新中...</span>
                                     </>
                                 ) : (
                                     <>
                                         <RefreshCw size={18} />
                                         <span>刷新状态</span>
                                     </>
                                 )}
                             </button>
                        )}

                        {/* Save Locally Button */}
                         {videoUrl && !locallySaved && (
                             <button
                                 onClick={() => onAction?.(node.id, 'save-locally')}
                                 disabled={isActionDisabled}
                                 className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                     isWorking
                                         ? 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/10'
                                         : 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 hover:from-green-500/40 hover:to-emerald-500/40 text-green-100 border border-green-500/40 shadow-lg shadow-green-500/10'
                                 }`}
                             >
                                 {isWorking ? (
                                     <>
                                         <Loader2 className="animate-spin" size={18} />
                                         <span>保存中...</span>
                                     </>
                                 ) : (
                                     <>
                                         <Download size={18} />
                                         <span>保存本地</span>
                                     </>
                                 )}
                             </button>
                         )}
                    </div>

                     {/* Sora Prompt Display - Scrollable Version */}
                     {node.data.soraPrompt && (
                         <div className="flex flex-col gap-2 p-3 bg-black/30 rounded-xl border border-white/10">
                             <div className="text-xs text-slate-400 font-bold">Sora 提示词</div>
                             <div className="max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                 <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{node.data.soraPrompt}</p>
                             </div>
                         </div>
                     )}

                     {/* Task Info */}
                     {node.data.taskNumber && (
                         <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                             <span>任务 #{node.data.taskNumber}</span>
                             {provider && <span>{provider}</span>}
                         </div>
                     )}

                     {/* Status */}
                     {locallySaved && (
                         <div className="text-center py-2 px-3 bg-green-500/20 rounded-lg border border-green-500/30">
                             <span className="text-sm text-green-300 font-bold">✓ 已保存到本地</span>
                         </div>
                     )}
                 </div>
             </div>
         );
     }

     // Special handling for STORYBOARD_VIDEO_GENERATOR
     if (node.type === NodeType.STORYBOARD_VIDEO_GENERATOR) {
         const data = node.data as any;
         const status = data.status || 'idle';
         const isLoading = data.isLoading;

         return (
             <div
                 className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}
                 style={{
                     transform: `translateX(-50%) ${inverseScale !== 1 ? `scale(${inverseScale})` : ''}`,
                     transformOrigin: 'top center'
                 }}
             >
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'OPTION') e.stopPropagation(); }} onWheel={(e) => e.stopPropagation()}>
                     {/* Stage 1 (idle): 获取分镜按钮 */}
                     {status === 'idle' && (
                         <button
                             onClick={() => onAction?.(node.id, 'fetch-shots')}
                             disabled={isLoading}
                             className={`w-full px-4 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                 isLoading
                                     ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                     : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02]'
                             }`}
                         >
                             {isLoading ? (
                                 <>
                                     <Loader2 className="animate-spin" size={14} />
                                     <span>获取中...</span>
                                 </>
                             ) : (
                                 <>
                                     <Grid3X3 size={14} />
                                     <span>获取分镜</span>
                                 </>
                             )}
                         </button>
                     )}

                     {/* Stage 2 (selecting): 提示信息 */}
                     {status === 'selecting' && (
                         <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                             <div className="flex items-center gap-2 text-purple-300 text-[10px]">
                                 <Grid3X3 size={12} />
                                 <span>请在节点内容区选择要生成的分镜</span>
                             </div>
                         </div>
                     )}

                     {/* Stage 3 (prompting): 模型配置 + 操作按钮 */}
                     {status === 'prompting' && (
                         (() => {
                             const selectedPlatform = data.selectedPlatform || 'yunwuapi';
                             const selectedModel = data.selectedModel || 'luma';
                             const modelConfig = data.modelConfig || {
                                 aspect_ratio: '16:9',
                                 duration: '5',
                                 quality: 'standard'
                             };
                             
                             // 如果有错误，显示错误提示
                             const hasError = data.error;

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

                             // 默认子模型列表（根据云雾API最新截图更新）
                            const defaultSubModels: Record<string, string[]> = {
                                veo: [
                                    'veo3.1-4k', 'veo3.1-components-4k', 'veo3.1-pro-4k', 'veo3.1',
                                    'veo3.1-pro', 'veo3.1-components', 'veo3.1-fast-components', 'veo3.1-fast'
                                ],
                                luma: ['ray-v2', 'photon', 'photon-flash'],
                                sora: ['sora', 'sora-2'],
                                runway: ['gen3-alpha-turbo', 'gen3-alpha', 'gen3-alpha-extreme'],
                                minimax: ['video-01', 'video-01-live'],
                                volcengine: ['doubao-video-1', 'doubao-video-pro'],
                                grok: ['grok-2-video', 'grok-vision-video'],
                                qwen: ['qwen-video', 'qwen-video-plus']
                            };

                             const defaultSubModelDisplayNames: Record<string, string> = {
                                // Veo 3.1 系列（根据截图更新）
                                'veo3.1-4k': 'Veo 3.1 4K',
                                'veo3.1-components-4k': 'Veo 3.1 Components 4K',
                                'veo3.1-pro-4k': 'Veo 3.1 Pro 4K',
                                'veo3.1': 'Veo 3.1',
                                'veo3.1-pro': 'Veo 3.1 Pro',
                                'veo3.1-components': 'Veo 3.1 Components',
                                'veo3.1-fast-components': 'Veo 3.1 Fast Components',
                                'veo3.1-fast': 'Veo 3.1 Fast',
                                // 其他模型
                                'ray-v2': 'Ray V2',
                                'photon': 'Photon',
                                'photon-flash': 'Photon Flash',
                                'sora': 'Sora 1',
                                'sora-2': 'Sora 2',
                                'gen3-alpha-turbo': 'Gen-3 Alpha Turbo',
                                'gen3-alpha': 'Gen-3 Alpha',
                                'gen3-alpha-extreme': 'Gen-3 Alpha Extreme',
                                'video-01': 'Video-01',
                                'video-01-live': 'Video-01 Live',
                                'doubao-video-1': 'Doubao Video 1',
                                'doubao-video-pro': 'Doubao Video Pro',
                                'grok-2-video': 'Grok 2 Video',
                                'grok-vision-video': 'Grok Vision Video',
                                'qwen-video': 'Qwen Video',
                                'qwen-video-plus': 'Qwen Video Plus'
                            };

                             // 使用动态加载的配置（如果已加载），否则回退到硬编码的默认值
                             // 动态配置结构: { yunwuapi: { veo: [...], luma: [...] } }
                             // 默认配置结构: { veo: [...], luma: [...] }
                             const subModels = configLoaded && Object.keys(dynamicSubModels).length > 0 && dynamicSubModels[selectedPlatform]
                               ? dynamicSubModels[selectedPlatform]
                               : defaultSubModels;

                             const subModelDisplayNames = configLoaded && Object.keys(dynamicSubModelNames).length > 0
                               ? { ...defaultSubModelDisplayNames, ...dynamicSubModelNames }
                               : defaultSubModelDisplayNames;

                             const selectedSubModel = data.subModel || (subModels[selectedModel]?.[0] || selectedModel);

                             return (
                                <div className="flex flex-col gap-3">
                                    {/* 错误提示 */}
                                    {hasError && (
                                        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-[10px] text-red-300">{data.error}</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* 模型配置 */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Wand2 size={12} className="text-purple-400" />
                                                <span className="text-[10px] font-bold text-slate-400">模型配置</span>
                                                 {configLoaded && Object.keys(dynamicSubModels).length > 0 && (
                                                     <span className="text-[8px] text-green-400">● 后台</span>
                                                 )}
                                                 {!configLoaded && (
                                                     <span className="text-[8px] text-yellow-400">● 加载中...</span>
                                                 )}
                                             </div>
                                         </div>

                                         {/* 快速模型显示 */}
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

                                         {/* 平台 & 模型选择 */}
                                         <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                             <select
                                                 className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-slate-200 focus:outline-none"
                                                 value={selectedPlatform}
                                                 onChange={(e) => {
                                                     const newValue = e.target.value;
                                                     onUpdate(node.id, { selectedPlatform: newValue });
                                                 }}
                                             >
                                                 {platforms.map(p => (
                                                     <option key={p.code} value={p.code}>{p.name}</option>
                                                 ))}
                                             </select>
                                             <select
                                                 className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-slate-200 focus:outline-none"
                                                 value={selectedModel}
                                                 onChange={(e) => {
                                                     const newModel = e.target.value;
                                                     // 使用当前可用的subModels获取新模型的子模型列表
                                                     const currentSubModels = configLoaded && Object.keys(dynamicSubModels).length > 0 && dynamicSubModels[selectedPlatform]
                                                         ? dynamicSubModels[selectedPlatform]
                                                         : defaultSubModels;
                                                     const firstSubModel = currentSubModels[newModel]?.[0];
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
                                             <div onClick={(e) => e.stopPropagation()}>
                                                 <select
                                                     className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-slate-200 focus:outline-none"
                                                     value={selectedSubModel}
                                                     onChange={(e) => {
                                                         const newValue = e.target.value;
                                                         onUpdate(node.id, { subModel: newValue });
                                                     }}
                                                 >
                                                     {subModels[selectedModel].map(subModel => (
                                                         <option key={subModel} value={subModel}>
                                                             {subModelDisplayNames[subModel] || subModel}
                                                         </option>
                                                     ))}
                                                 </select>
                                             </div>
                                         )}

                                         {/* 宽高比 & 时长 */}
                                         <div className="flex gap-2">
                                             <div className="flex-1 flex gap-1">
                                                 {['16:9', '9:16'].map(ratio => (
                                                     <button
                                                         key={ratio}
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             onUpdate(node.id, {
                                                                 modelConfig: { ...modelConfig, aspect_ratio: ratio }
                                                             });
                                                         }}
                                                         className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                                             modelConfig.aspect_ratio === ratio
                                                                 ? 'bg-purple-500 text-white'
                                                                 : 'bg-black/60 text-slate-400 hover:bg-white/5'
                                                         }`}
                                                         onMouseDown={(e) => e.stopPropagation()}
                                                     >
                                                         {ratio}
                                                     </button>
                                                 ))}
                                             </div>
                                             <div className="flex-1 flex gap-1">
                                                 {['5', '10', '15'].map(duration => (
                                                     <button
                                                         key={duration}
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             onUpdate(node.id, {
                                                                 modelConfig: { ...modelConfig, duration }
                                                             });
                                                         }}
                                                         className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                                             modelConfig.duration === duration
                                                                 ? 'bg-purple-500 text-white'
                                                                 : 'bg-black/60 text-slate-400 hover:bg-white/5'
                                                         }`}
                                                         onMouseDown={(e) => e.stopPropagation()}
                                                     >
                                                         {duration}s
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>

                                         {/* 画质选择 */}
                                         <div className="flex gap-1">
                                             {['standard', 'pro', 'hd'].map(quality => (
                                                 <button
                                                     key={quality}
                                                     onClick={(e) => {
                                                         e.stopPropagation();
                                                         onUpdate(node.id, {
                                                             modelConfig: { ...modelConfig, quality }
                                                         });
                                                     }}
                                                     className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                                         modelConfig.quality === quality
                                                             ? 'bg-purple-500 text-white'
                                                             : 'bg-black/60 text-slate-400 hover:bg-white/5'
                                                     }`}
                                                     onMouseDown={(e) => e.stopPropagation()}
                                                 >
                                                     {quality === 'standard' ? '标清' : quality === 'pro' ? '高清' : '超清'}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>

                                     {/* 操作按钮 */}
                                     <div className="flex gap-2">
                                         <button
                                             onClick={(e) => {
                                                 e.stopPropagation();
                                                 onUpdate(node.id, {
                                                     status: 'selecting',
                                                     generatedPrompt: '',
                                                     promptModified: false
                                                 });
                                             }}
                                             disabled={isLoading}
                                             className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                                             onMouseDown={(e) => e.stopPropagation()}
                                         >
                                             <ChevronDown size={14} className="rotate-90" />
                                             <span>返回</span>
                                         </button>

                                         <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // 如果有错误，先清除错误再生成
                                                if (hasError) {
                                                    onUpdate(node.id, { error: undefined });
                                                }
                                                onAction?.(node.id, 'generate-video');
                                            }}
                                            disabled={isLoading}
                                            className={`flex-[2] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                                hasError 
                                                    ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:shadow-lg hover:shadow-red-500/20' 
                                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/20'
                                            } text-white hover:scale-[1.02]`}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            {isLoading ? <Loader2 className="animate-spin" size={14} /> : hasError ? <RefreshCw size={14} /> : <Play size={14} />}
                                            <span>{hasError ? '重新生成' : '生成视频'}</span>
                                        </button>
                                     </div>
                                 </div>
                             );
                         })()
                     )}

                     {/* Stage 4 (generating): 进度提示 + 取消按钮 */}
                     {status === 'generating' && (
                         <div className="flex gap-2">
                             <div className="flex-1 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                 <div className="flex items-center gap-2 text-blue-300 text-[10px]">
                                     <Loader2 className="animate-spin" size={12} />
                                     <span>视频生成中 {data.progress || 0}%</span>
                                 </div>
                                 {/* 进度条 */}
                                 <div className="mt-1.5 h-1 bg-blue-500/20 rounded-full overflow-hidden">
                                     <div
                                         className="h-full bg-blue-400 transition-all duration-300"
                                         style={{ width: `${data.progress || 0}%` }}
                                     />
                                 </div>
                             </div>
                             <button
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     onAction?.(node.id, 'cancel-generate');
                                 }}
                                 className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg flex items-center gap-2 transition-all hover:scale-[1.02]"
                             >
                                 <X size={12} className="text-red-300" />
                                 <span className="text-[10px] text-red-300">取消</span>
                             </button>
                         </div>
                     )}

                     {/* Stage 5 (completed): 完成提示 + 返回 + 重新生成按钮 */}
                     {status === 'completed' && (
                         <div className="flex gap-2">
                             <div className="flex-1 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-center">
                                 <div className="flex items-center gap-2 text-green-300 text-[10px]">
                                     <Sparkles size={12} />
                                     <span>生成完成！</span>
                                 </div>
                             </div>
                             <button
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     onUpdate(node.id, {
                                         status: 'prompting',
                                         progress: 0
                                     });
                                 }}
                                 className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-2 transition-all hover:scale-[1.02]"
                                 onMouseDown={(e) => e.stopPropagation()}
                             >
                                 <ChevronDown size={12} className="text-slate-400 rotate-90" />
                                 <span className="text-[10px] text-slate-400">返回</span>
                             </button>
                             <button
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     onAction?.(node.id, 'regenerate-video');
                                 }}
                                 className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg flex items-center gap-2 transition-all hover:scale-[1.02]"
                                 onMouseDown={(e) => e.stopPropagation()}
                             >
                                 <RefreshCw size={12} className="text-purple-300" />
                                 <span className="text-[10px] text-purple-300">重新生成</span>
                             </button>
                         </div>
                     )}
                 </div>
             </div>
         );
     }

     // Special handling for STORYBOARD_SPLITTER
     if (node.type === NodeType.STORYBOARD_SPLITTER) {
         const splitShots = node.data.splitShots || [];
         const selectedSourceNodes = node.data.selectedSourceNodes || node.inputs || [];
         const isSplitting = node.data.isSplitting || false;
         const connectedStoryboardNodes = nodeQuery ? nodeQuery.getUpstreamNodes(node.id, NodeType.STORYBOARD_IMAGE) : [];

         // Handler: Toggle source node selection
         const handleToggleSourceNode = (nodeId: string) => {
             const current = selectedSourceNodes || [];
             const updated = current.includes(nodeId)
                 ? current.filter(id => id !== nodeId)
                 : [...current, nodeId];
             onUpdate(node.id, { selectedSourceNodes: updated });
         };

         // Handler: Select all / Deselect all
         const handleToggleAll = () => {
             if (selectedSourceNodes.length === connectedStoryboardNodes.length) {
                 onUpdate(node.id, { selectedSourceNodes: [] });
             } else {
                 onUpdate(node.id, { selectedSourceNodes: connectedStoryboardNodes.map(n => n.id) });
             }
         };

         // Handler: Start splitting
         const handleStartSplit = async () => {
             if (selectedSourceNodes.length === 0) return;
             const nodesToSplit = nodeQuery ? nodeQuery.getNodesByIds(selectedSourceNodes) : [];
             onUpdate(node.id, { isSplitting: true });

             try {
                 const { splitMultipleStoryboardImages } = await import('../../utils/imageSplitter');
                 const allSplitShots = await splitMultipleStoryboardImages(
                     nodesToSplit,
                     (current, total, currentNode) => {
                     }
                 );
                 onUpdate(node.id, { splitShots: allSplitShots, isSplitting: false });
             } catch (error) {
                 console.error('切割失败:', error);
                 onUpdate(node.id, {
                     error: error instanceof Error ? error.message : String(error),
                     isSplitting: false
                 });
             }
         };

         // Handler: Export images
         const handleExportImages = async () => {
             if (splitShots.length === 0) return;
             try {
                 const { exportSplitImagesAsZip } = await import('../../utils/imageSplitter');
                 await exportSplitImagesAsZip(splitShots);
             } catch (error) {
                 console.error('导出失败:', error);
             }
         };

         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100] max-h-[320px] overflow-hidden`} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'OPTION') e.stopPropagation(); }} onWheel={(e) => e.stopPropagation()}>
                    {/* Connected Nodes List */}
                     {connectedStoryboardNodes.length > 0 && (
                         <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <Link size={12} className="text-slate-400" />
                                     <span className="text-xs font-bold text-slate-400">
                                         已连接的分镜图节点 ({connectedStoryboardNodes.length})
                                     </span>
                                 </div>
                                 <button
                                     onClick={handleToggleAll}
                                     className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                 >
                                     {selectedSourceNodes.length === connectedStoryboardNodes.length
                                         ? '取消全选'
                                         : '全选'}
                                 </button>
                             </div>

                             <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1" style={STYLE_MAX_HEIGHT_180}>
                                 {connectedStoryboardNodes.map((sbNode) => {
                                     const gridImages = sbNode.data.storyboardGridImages || [];
                                     const gridType = sbNode.data.storyboardGridType || '9';
                                     const isSelected = selectedSourceNodes.includes(sbNode.id);

                                     return (
                                         <div
                                             key={sbNode.id}
                                             className={`p-3 rounded-lg border transition-all ${
                                                 isSelected
                                                     ? 'bg-blue-500/10 border-blue-500/30'
                                                     : 'bg-black/40 border-white/10 hover:bg-black/60'
                                             }`}
                                         >
                                             <div className="flex items-center gap-3 mb-2">
                                                 <input
                                                     type="checkbox"
                                                     checked={isSelected}
                                                     onChange={() => handleToggleSourceNode(sbNode.id)}
                                                     className="w-4 h-4 rounded border-white/20 bg-black/60 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
                                                 />
                                                 <div className="flex-1 min-w-0">
                                                     <div className="text-xs font-bold text-white truncate">
                                                         {sbNode.title}
                                                     </div>
                                                     <div className="text-[10px] text-slate-500">
                                                         {gridImages.length}页 · {gridType === '9' ? '九宫格' : '六宫格'}
                                                     </div>
                                                 </div>
                                             </div>

                                             {/* 显示所有网格图 - 每个图单独显示 */}
                                             {gridImages.length > 0 && (
                                                 <div className="grid grid-cols-4 gap-1 pl-7">
                                                     {gridImages.map((img, idx) => (
                                                         <img
                                                             loading="lazy" key={idx}
                                                             src={img}
                                                             alt={`${sbNode.title} 第${idx + 1}页`}
                                                             className="w-full aspect-square rounded object-cover border border-white/10 hover:border-blue-500/50 transition-colors cursor-pointer"
                                                         />
                                                     ))}
                                                 </div>
                                             )}
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                     )}

                     {/* Action Buttons */}
                     <div className="flex items-center gap-3">
                         {splitShots.length > 0 && (
                             <button
                                 onClick={handleExportImages}
                                 className="flex-1 px-4 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
                             >
                                 <Download size={14} className="inline mr-1" />
                                 导出图片包
                             </button>
                         )}

                         <button
                             onClick={handleStartSplit}
                             disabled={selectedSourceNodes.length === 0 || isSplitting}
                             className={`flex-[2] px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                 isSplitting
                                     ? 'bg-blue-500/20 text-blue-300'
                                     : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/20'
                             }`}
                         >
                             {isSplitting ? (
                                 <>
                                     <Loader2 size={14} className="animate-spin" />
                                     正在切割...
                                 </>
                             ) : (
                                 <>
                                     <Scissors size={14} />
                                     开始拆分
                                 </>
                             )}
                         </button>
                     </div>
                 </div>
             </div>
         );
     }

     let models: {l: string, v: string}[] = [];
     if (node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.SORA_VIDEO_GENERATOR) {
        models = VIDEO_MODELS.map(m => ({l: m.name, v: m.id}));
     } else if (node.type === NodeType.VIDEO_ANALYZER) {
         models = TEXT_MODELS.map(m => ({l: m.name, v: m.id}));
     } else if (node.type === NodeType.AUDIO_GENERATOR) {
         models = AUDIO_MODELS.map(m => ({l: m.name, v: m.id}));
     } else if (node.type === NodeType.SCRIPT_PLANNER) {
         models = TEXT_MODELS.map(m => ({l: m.name, v: m.id}));
     } else if (node.type === NodeType.SCRIPT_EPISODE) {
         models = TEXT_MODELS.map(m => ({l: m.name, v: m.id}));
     } else if (node.type === NodeType.STORYBOARD_GENERATOR) {
         models = TEXT_MODELS.map(m => ({l: m.name, v: m.id}));
     } else if (node.type === NodeType.STORYBOARD_IMAGE) {
         models = IMAGE_MODELS.map(m => ({l: m.name, v: m.id}));
     } else if (node.type === NodeType.CHARACTER_NODE) {
         models = IMAGE_MODELS.map(m => ({l: m.name, v: m.id}));
     } else {
        models = IMAGE_MODELS.map(m => ({l: m.name, v: m.id}));
     }

     return (
        <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
            {hasInputs && onInputReorder && (<div className="w-full flex justify-center mb-2 z-0 relative"><InputThumbnails assets={inputAssets!} onReorder={(newOrder) => onInputReorder(node.id, newOrder)} /></div>)}

            <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} relative z-[100]`} onMouseDown={(e) => {
                // 对于 range input，阻止所有事件冒泡，确保滑块可以正常拖拽
                // 对于其他交互元素，也阻止冒泡防止触发节点拖拽
                const target = e.target as HTMLElement;
                const tagName = target.tagName;
                const targetType = target.getAttribute('type');

                const isInteractiveElement =
                    (tagName === 'INPUT' && (targetType === 'range' || targetType === 'text' || targetType === 'number' || targetType === 'checkbox' || targetType === 'radio')) ||
                    tagName === 'TEXTAREA' ||
                    tagName === 'SELECT';

                if (isInteractiveElement) {
                    e.stopPropagation();
                }
            }} onWheel={(e) => e.stopPropagation()}>

                {/* Specific UI for Storyboard Generator */}
                {node.type === NodeType.STORYBOARD_GENERATOR ? (
                    <div className="flex flex-col gap-3 p-2">
                        {/* Connected Episode Info (if any) */}
                        {node.inputs.length > 0 && (
                            <div className="flex items-center gap-2 px-1 text-[9px] text-slate-400">
                                <Link size={10} /> 
                                <span>已连接内容源 ({node.inputs.length})</span>
                            </div>
                        )}

                        {/* Style Selector */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                                <span>风格 (Style)</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                {['REAL', 'ANIME', '3D'].map((s) => (
                                    <button 
                                        key={s}
                                        onClick={() => onUpdate(node.id, { storyboardStyle: s as 'REAL' | 'ANIME' | '3D' })}
                                        className={`
                                            py-1.5 rounded-md text-[9px] font-bold border transition-colors
                                            ${node.data.storyboardStyle === s 
                                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' 
                                                : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'}
                                        `}
                                    >
                                        {s === 'REAL' ? '真人 (Real)' : s === 'ANIME' ? '动漫 (Anime)' : '3D (CGI)'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-1">
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                                    <span>分镜数量 (Shots)</span>
                                    <span className="text-indigo-400">{node.data.storyboardCount || 6}</span>
                                </div>
                                <input 
                                    type="range" min="5" max="20" step="1" 
                                    value={node.data.storyboardCount || 6} 
                                    onChange={e => onUpdate(node.id, { storyboardCount: parseInt(e.target.value) })} 
                                    className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none cursor-pointer" 
                                />
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                                    <span>单镜时长 (Duration)</span>
                                    <span className="text-indigo-400">{node.data.storyboardDuration || 4}s</span>
                                </div>
                                <input 
                                    type="range" min="2" max="10" step="1" 
                                    value={node.data.storyboardDuration || 4} 
                                    onChange={e => onUpdate(node.id, { storyboardDuration: parseInt(e.target.value) })} 
                                    className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none cursor-pointer" 
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleActionClick} 
                            disabled={isWorking || node.inputs.length === 0} 
                            className={`
                                w-full mt-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                ${isWorking || node.inputs.length === 0
                                    ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02]'}
                            `}
                        >
                            {isWorking ? <Loader2 className="animate-spin" size={12} /> : <Clapperboard size={12} />}
                            <span>生成电影分镜</span>
                        </button>
                    </div>
                ) : node.type === NodeType.STORYBOARD_IMAGE ? (
                    <div className="flex flex-col gap-3 p-2">
                        {/* Text Input for Storyboard Description */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">分镜描述 (Description)</span>
                            <textarea
                                className="w-full bg-black/20 text-xs text-slate-200 placeholder-slate-500/60 p-2 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed rounded-lg border border-white/5 focus:border-purple-500/50"
                                style={STYLE_HEIGHT_80}
                                placeholder="输入分镜描述，或连接剧本分集子节点..."
                                value={localPrompt}
                                onChange={(e) => setLocalPrompt(e.target.value)}
                                onBlur={() => { setIsInputFocused(false); commitPrompt(); }}
                                onFocus={() => setIsInputFocused(true)}
                                onWheel={(e) => e.stopPropagation()}
                            />
                        </div>

                        {/* Connection Status */}
                        {node.inputs.length > 0 && (
                            <div className="flex flex-col gap-1 px-1">
                                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                                    <Link size={10} />
                                    <span>已连接 {node.inputs.length} 个节点</span>
                                </div>
                                {/* Show if character node is connected */}
                                {nodeQuery?.hasUpstreamNode(node.id, NodeType.CHARACTER_NODE) && (
                                    <div className="flex items-center gap-2 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded text-[9px] text-orange-300">
                                        <User size={10} />
                                        <span>已连接角色设计，将保持角色一致性</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Grid Type Selector */}
                        <div className="flex flex-col gap-1 px-1">
                            <span className="text-[9px] text-slate-400 font-bold">网格布局 (Grid Layout)</span>
                            <div className="flex gap-2">
                                {[
                                    { value: '9', label: '九宫格 (3×3)', desc: '9个分镜面板' },
                                    { value: '6', label: '六宫格 (2×3)', desc: '6个分镜面板' }
                                ].map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => onUpdate(node.id, { storyboardGridType: value as '9' | '6' })}
                                        className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                            (node.data.storyboardGridType || '9') === value
                                                ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                                                : 'bg-black/20 border border-white/10 text-slate-400 hover:bg-white/5'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Panel Orientation Selector */}
                        <div className="flex flex-col gap-1 px-1">
                            <span className="text-[9px] text-slate-400 font-bold">面板方向 (Panel Orientation)</span>
                            <div className="flex gap-2">
                                {[
                                    { value: '16:9', label: '横屏 (16:9)', icon: Monitor },
                                    { value: '9:16', label: '竖屏 (9:16)', icon: Monitor }
                                ].map(({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        onClick={() => onUpdate(node.id, { storyboardPanelOrientation: value as '16:9' | '9:16' })}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                            (node.data.storyboardPanelOrientation || '16:9') === value
                                                ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                                                : 'bg-black/20 border border-white/10 text-slate-400 hover:bg-white/5'
                                        }`}
                                    >
                                        <Icon size={12} className={value === '9:16' ? 'rotate-90' : ''} />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleActionClick}
                            disabled={isWorking || (node.inputs.length === 0 && !localPrompt.trim())}
                            className={`
                                w-full mt-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                ${isWorking || (node.inputs.length === 0 && !localPrompt.trim())
                                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02]'}
                            `}
                        >
                            {isWorking ? <Loader2 className="animate-spin" size={12} /> : <LayoutGrid size={12} />}
                            <span>生成九宫格分镜图</span>
                        </button>
                    </div>
                ) : node.type === NodeType.CHARACTER_NODE ? (
                    <div className="flex flex-col gap-2 p-2">
                        {/* Status / Instructions */}
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[9px] text-slate-400">已选角色: {(node.data.extractedCharacterNames || []).length}</span>
                            <span className="text-[9px] text-orange-400">{isWorking ? '生成中...' : 'Ready'}</span>
                        </div>

                        <button 
                            onClick={handleActionClick} 
                            disabled={isWorking || node.inputs.length === 0} 
                            className={`
                                w-full mt-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                ${isWorking || node.inputs.length === 0
                                    ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02]'}
                            `}
                        >
                            {isWorking ? <Loader2 className="animate-spin" size={12} /> : <Users size={12} />}
                            <span>生成角色档案 & 表情图</span>
                        </button>
                    </div>
                ) : node.type === NodeType.SCRIPT_PLANNER ? (
                    <div className="flex flex-col gap-2 p-2">
                        {/* STATE A: PRE-OUTLINE (Planning) */}
                        {!node.data.scriptOutline ? (
                            <>
                                <div className="relative group/input bg-black/20 rounded-[12px]">
                                    <textarea className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500/60 p-2 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed" style={STYLE_HEIGHT_60} placeholder="输入剧本核心创意..." value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onFocus={() => setIsInputFocused(true)} onWheel={(e) => e.stopPropagation()} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="bg-black/20 rounded-lg px-2 py-1.5 text-[10px] text-white border border-white/5 focus:border-orange-500/50 outline-none appearance-none hover:bg-white/5" value={node.data.scriptGenre || ''} onChange={e => onUpdate(node.id, { scriptGenre: e.target.value })}>
                                        <option value="" disabled>选择类型 (Genre)</option>
                                        {SHORT_DRAMA_GENRES.map(g => <option key={g} value={g} className="bg-zinc-800">{g}</option>)}
                                    </select>
                                    <select className="bg-black/20 rounded-lg px-2 py-1.5 text-[10px] text-white border border-white/5 focus:border-orange-500/50 outline-none appearance-none hover:bg-white/5" value={node.data.scriptSetting || ''} onChange={e => onUpdate(node.id, { scriptSetting: e.target.value })}>
                                        <option value="" disabled>选择背景 (Setting)</option>
                                        {SHORT_DRAMA_SETTINGS.map(s => <option key={s} value={s} className="bg-zinc-800">{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1 px-1">
                                    <span className="text-[9px] text-slate-400 font-bold">视觉风格 (Visual Style)</span>
                                    <div className="flex bg-black/30 rounded-lg p-0.5">
                                        {['REAL', 'ANIME', '3D'].map((s) => (
                                            <button 
                                                key={s}
                                                onClick={() => onUpdate(node.id, { scriptVisualStyle: s as 'REAL' | 'ANIME' | '3D' })}
                                                className={`flex-1 py-1 text-[9px] font-bold rounded-md transition-all ${node.data.scriptVisualStyle === s ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {s === 'REAL' ? '真人' : s === 'ANIME' ? '动漫' : '3D'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 px-1">
                                    <div className="flex-1 flex flex-col gap-1">
                                        <div className="flex justify-between text-[9px] text-slate-400"><span>总集数</span><span>{node.data.scriptEpisodes || 10}</span></div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="100"
                                            step="1"
                                            value={node.data.scriptEpisodes || 10}
                                            onChange={e => onUpdate(node.id, { scriptEpisodes: parseInt(e.target.value) })}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <div className="flex justify-between text-[9px] text-slate-400"><span>单集时长 (分钟)</span><span>{node.data.scriptDuration || 1}</span></div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="5"
                                            step="0.5"
                                            value={node.data.scriptDuration || 1}
                                            onChange={e => onUpdate(node.id, { scriptDuration: parseFloat(e.target.value) })}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                                <button onClick={handleActionClick} disabled={isActionDisabled} className={`w-full mt-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02]'}`}>{isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}<span>生成大纲</span></button>
                            </>
                        ) : (
                            /* STATE B: POST-OUTLINE (View Only Mode) */
                            <div className="flex flex-col gap-3 p-1">
                                <div className="flex items-center justify-center py-2 text-xs text-slate-500">
                                    <BookOpen size={14} className="mr-2" />
                                    <span>大纲已生成</span>
                                </div>
                                <button 
                                    onClick={() => onUpdate(node.id, { scriptOutline: undefined })}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-1.5 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                                >
                                    <RefreshCw size={12} />
                                    <span>重置大纲</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : node.type === NodeType.SCRIPT_EPISODE ? (
                    <div className="flex flex-col gap-3 p-2">
                        {/* Chapter Selection */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">选择章节 (Source Chapter)</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRefreshChapters();
                                    }}
                                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors"
                                    title="重新获取章节"
                                >
                                    <RefreshCw size={10} />
                                </button>
                            </div>
                            <div className="relative">
                                <select
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors"
                                    value={node.data.selectedChapter || ''}
                                    onChange={(e) => onUpdate(node.id, { selectedChapter: e.target.value })}
                                >
                                    <option value="" disabled>-- 请选择章节 --</option>
                                    {availableChapters.map((ch, idx) => (
                                        <option key={idx} value={ch} className="bg-zinc-800">{ch}</option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Split Count Slider */}
                        <div className="flex flex-col gap-1 px-1">
                            <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                                <span>拆分集数 (Episodes)</span>
                                <span className="text-teal-400">{node.data.episodeSplitCount || 3} 集</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={node.data.episodeSplitCount || 3}
                                onChange={e => onUpdate(node.id, { episodeSplitCount: parseInt(e.target.value) })}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Modification Suggestions Input */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider px-1">修改建议 (Optional)</span>
                            <textarea
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none resize-none h-16 custom-scrollbar placeholder:text-slate-600"
                                placeholder="输入修改建议或留空使用默认设置..."
                                value={node.data.episodeModificationSuggestion || ''}
                                onChange={(e) => onUpdate(node.id, { episodeModificationSuggestion: e.target.value })}
                                onMouseDown={e => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                            />
                        </div>

                        {/* Generate / Regenerate Button */}
                        <button
                            onClick={handleActionClick}
                            disabled={isWorking || !node.data.selectedChapter}
                            className={`
                                w-full mt-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                ${isWorking || !node.data.selectedChapter
                                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-black hover:shadow-lg hover:shadow-teal-500/20 hover:scale-[1.02]'}
                            `}
                        >
                            {isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                            <span>{node.data.generatedEpisodes && node.data.generatedEpisodes.length > 0 ? '重新生成' : '生成分集脚本'}</span>
                        </button>
                    </div>
                ) : (() => {
                    const isEpisodeChild = node.type === NodeType.PROMPT_INPUT && nodeQuery?.hasUpstreamNode(node.id, NodeType.SCRIPT_EPISODE);
                    if (node.type === NodeType.PROMPT_INPUT) {
                    }
                    return { isEpisodeChild, nodeType: node.type };
                })().isEpisodeChild ? (
                    // Special handling for episode child nodes - only show storyboard button
                    <div className="flex flex-col gap-2 p-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction(node.id, 'generate-storyboard');
                            }}
                            disabled={isActionDisabled}
                            className={`
                                w-full flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                ${isWorking
                                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02]'}
                            `}
                        >
                            {isWorking ? <Loader2 className="animate-spin" size={14} /> : <Film size={14} />}
                            <span>拆分为影视分镜</span>
                        </button>
                    </div>
                ) : node.type === NodeType.PROMPT_INPUT ? (
                    // PROMPT_INPUT 默认底部面板 - 生图功能
                    <>
                    {(() => {
                        return null;
                    })()}
                    <div className="flex flex-col gap-3 p-2">
                        {/* 分辨率选择 */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">图片分辨率</span>
                                <span className="text-[9px] text-amber-400">{node.data.resolution || '512x512'}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                                {['512x512', '768x768', '1024x1024', '1024x768'].map((res) => (
                                    <button
                                        key={res}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdate(node.id, { resolution: res });
                                        }}
                                        className={`
                                            px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all border
                                            ${(node.data.resolution || '512x512') === res
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                                : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'}
                                        `}
                                    >
                                        {res.replace('x', '×')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 宽高比选择 */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">宽高比</span>
                                <span className="text-[9px] text-amber-400">{node.data.aspectRatio || '1:1'}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                                {['1:1', '16:9', '9:16'].map((ratio) => (
                                    <button
                                        key={ratio}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const [w, h] = ratio.split(':').map(Number);
                                            let newSize: { width?: number, height?: number } = { height: undefined };
                                            if (w && h) {
                                                const currentWidth = node.width || DEFAULT_NODE_WIDTH;
                                                const projectedHeight = (currentWidth * h) / w;
                                                if (projectedHeight > 600) newSize.width = (600 * w) / h;
                                            }
                                            onUpdate(node.id, { aspectRatio: ratio }, newSize);
                                        }}
                                        className={`
                                            px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all border
                                            ${(node.data.aspectRatio || '1:1') === ratio
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                                : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'}
                                        `}
                                    >
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 生成图片按钮 */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction(node.id, 'generate-image');
                            }}
                            disabled={isActionDisabled}
                            className={`
                                w-full flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                ${isWorking
                                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-500/20 hover:scale-[1.02]'}
                            `}
                        >
                            {isWorking ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
                            <span>生成图片</span>
                        </button>
                    </div>
                    </>
                ) : node.type === NodeType.VIDEO_EDITOR ? (
                    // VIDEO EDITOR NODE
                    <>
                    {/* Content Area: Video Grid Display */}
                    <div
                        className="flex-1 overflow-y-auto custom-scrollbar p-2"
                        onMouseEnter={handleMouseEnter}  // 鼠标在内容区时保持操作区显示
                    >
                        {(() => {
                            // Get connected video nodes
                            const getConnectedVideos = () => {
                                const videos: Array<{
                                    id: string;
                                    url: string;
                                    sourceNodeId: string;
                                    sourceNodeName: string;
                                    duration?: number;
                                }> = [];

                                // Get all connected nodes via nodeQuery
                                const connectedNodes = nodeQuery ? nodeQuery.getNodesByIds(node.inputs) : [];

                                // Iterate through connected nodes
                                for (const inputNode of connectedNodes) {

                                    // Get video URL based on node type
                                    let videoUrl = '';
                                    let duration = 0;

                                    switch (inputNode.type) {
                                        case NodeType.VIDEO_GENERATOR:
                                            videoUrl = inputNode.data.videoUri || inputNode.data.videoUris?.[0] || '';
                                            duration = inputNode.data.duration || 0;
                                            break;
                                        case NodeType.SORA_VIDEO_GENERATOR:
                                            // Sora 2 节点会创建子节点（SORA_VIDEO_CHILD），视频存储在子节点中
                                            // 通过 inputs 连接来查找子节点
                                            const allSoraChildren = nodeQuery ? nodeQuery.getNodesByType(NodeType.SORA_VIDEO_CHILD) : [];
                                            const connectedSoraChildren = allSoraChildren.filter(child =>
                                                child.inputs && child.inputs.includes(inputNode.id)
                                            );

                                            for (const childNode of connectedSoraChildren) {
                                                if (childNode.data.videoUrl) {
                                                    videos.push({
                                                        id: childNode.id,
                                                        url: childNode.data.videoUrl,
                                                        sourceNodeId: inputNode.id,
                                                        sourceNodeName: `${inputNode.title} - ${childNode.data.taskNumber || '视频'}`,
                                                        duration: childNode.data.duration || 0
                                                    });
                                                }
                                            }
                                            break;
                                        case NodeType.STORYBOARD_VIDEO_GENERATOR:
                                            // 分镜视频生成器也会创建子节点（STORYBOARD_VIDEO_CHILD）
                                            // 通过 inputs 连接来查找子节点
                                            const allStoryboardChildren = nodeQuery ? nodeQuery.getNodesByType(NodeType.STORYBOARD_VIDEO_CHILD) : [];
                                            const connectedStoryboardChildren = allStoryboardChildren.filter(child =>
                                                child.inputs && child.inputs.includes(inputNode.id)
                                            );

                                            for (const childNode of connectedStoryboardChildren) {
                                                if (childNode.data.videoUrl) {
                                                    videos.push({
                                                        id: childNode.id,
                                                        url: childNode.data.videoUrl,
                                                        sourceNodeId: inputNode.id,
                                                        sourceNodeName: `${inputNode.title} - ${childNode.data.shotIndex || '视频'}`,
                                                        duration: childNode.data.videoDuration || 0
                                                    });
                                                }
                                            }
                                            break;
                                        case NodeType.VIDEO_ANALYZER:
                                            videoUrl = inputNode.data.videoUri || '';
                                            break;
                                        case NodeType.VIDEO_EDITOR:
                                            // Chain editing: get output video
                                            videoUrl = (inputNode.data as Record<string, any>).outputVideoUrl || '';
                                            break;
                                    }

                                    if (videoUrl) {
                                        videos.push({
                                            id: `${inputNode.id}-main`,
                                            url: videoUrl,
                                            sourceNodeId: inputNode.id,
                                            sourceNodeName: inputNode.title,
                                            duration
                                        });
                                    }
                                }

                                return videos;
                            };

                            const videos = getConnectedVideos();

                            if (videos.length === 0) {
                                return (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                                        <Film size={48} className="mb-3 opacity-30" />
                                        <p className="text-xs">请连接视频节点</p>
                                        <p className="text-[10px] mt-1 opacity-60">支持: 文生视频、Sora 2 视频、分镜视频、视频分析、视频编辑器</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-3 gap-2">
                                    {videos.map((video) => (
                                        <div
                                            key={video.id}
                                            className="relative group/video bg-black/30 rounded-lg overflow-hidden border border-white/5 hover:border-red-500/30 transition-all"
                                        >
                                            {/* Video Thumbnail */}
                                            <div className="relative aspect-video bg-black">
                                                <video
                                                    src={video.url}
                                                    className="w-full h-full object-cover"
                                                    onMouseEnter={(e) => {
                                                        const vid = e.currentTarget;
                                                        vid.currentTime = 0;
                                                        vid.play().catch(() => {});
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        const vid = e.currentTarget;
                                                        vid.pause();
                                                        vid.currentTime = 0;
                                                    }}
                                                    muted
                                                    loop
                                                    playsInline
                                                />
                                                {/* Duration Badge */}
                                                {video.duration > 0 && (
                                                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[9px] text-white font-medium">
                                                        {video.duration.toFixed(1)}s
                                                    </div>
                                                )}
                                            </div>

                                            {/* Source Name */}
                                            <div className="px-2 py-1.5 bg-black/20">
                                                <p className="text-[9px] text-slate-400 truncate" title={video.sourceNodeName}>
                                                    {video.sourceNodeName}
                                                </p>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/video:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const a = document.createElement('a');
                                                        a.href = video.url;
                                                        a.download = `${video.sourceNodeName}-${video.id}.mp4`;
                                                        a.click();
                                                    }}
                                                    className="p-1.5 bg-black/70 hover:bg-green-600 rounded-lg transition-colors"
                                                    title="下载"
                                                >
                                                    <Download size={12} className="text-white" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // TODO: Remove video from list
                                                    }}
                                                    className="p-1.5 bg-black/70 hover:bg-red-600 rounded-lg transition-colors"
                                                    title="删除"
                                                >
                                                    <Trash2 size={12} className="text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Operation Area: Edit & Export Buttons */}
                    <div
                        className="flex flex-col gap-2 p-2 border-t border-white/5"
                        onMouseEnter={handleMouseEnter}  // 进入操作区时保持显示
                        onMouseLeave={handleMouseLeave}  // 离开操作区时重新开始倒计时
                    >
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[9px] text-slate-400">
                                已连接 {node.inputs.length} 个视频节点
                            </span>
                            <span className="text-[9px] text-red-400">{isWorking ? '处理中...' : 'Ready'}</span>
                        </div>

                        <div className="flex gap-2">
                            {/* Edit Video Button */}
                            <button
                                onClick={() => {
                                    if (onOpenVideoEditor) {
                                        onOpenVideoEditor(node.id);
                                    }
                                }}
                                disabled={node.inputs.length === 0}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                    ${node.inputs.length === 0
                                        ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02]'}
                                `}
                            >
                                <Scissors size={14} />
                                <span>编辑视频</span>
                            </button>

                            {/* Generate Video Button */}
                            <button
                                onClick={() => {
                                    setShowExportModal(true);
                                }}
                                disabled={node.inputs.length === 0 || isWorking}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300
                                    ${node.inputs.length === 0 || isWorking
                                        ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:shadow-lg hover:shadow-red-500/20 hover:scale-[1.02]'}
                                `}
                            >
                                <Package size={14} />
                                <span>生成视频</span>
                            </button>
                        </div>
                    </div>

                    {/* Export Modal */}
                    {showExportModal && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-[24px]">
                            <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl p-4 w-80 shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-white">导出设置</h3>
                                    <button
                                        onClick={() => setShowExportModal(false)}
                                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X size={16} className="text-slate-400" />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* Name Input */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5">
                                            视频名称
                                        </label>
                                        <input
                                            type="text"
                                            value={exportSettings.name}
                                            onChange={(e) => setExportSettings(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="视频作品"
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-red-500/50 focus:outline-none"
                                        />
                                    </div>

                                    {/* Resolution Select */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5">
                                            分辨率
                                        </label>
                                        <select
                                            value={exportSettings.resolution}
                                            onChange={(e) => setExportSettings(prev => ({ ...prev, resolution: e.target.value }))}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-red-500/50 focus:outline-none appearance-none cursor-pointer hover:bg-white/5"
                                        >
                                            <option value="1080p">1080p (Full HD)</option>
                                            <option value="720p">720p (HD)</option>
                                            <option value="480p">480p (SD)</option>
                                            <option value="4k">4K (Ultra HD)</option>
                                        </select>
                                    </div>

                                    {/* Format Select */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5">
                                            格式
                                        </label>
                                        <select
                                            value={exportSettings.format}
                                            onChange={(e) => setExportSettings(prev => ({ ...prev, format: e.target.value }))}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-red-500/50 focus:outline-none appearance-none cursor-pointer hover:bg-white/5"
                                        >
                                            <option value="mp4">MP4</option>
                                            <option value="webm">WebM</option>
                                            <option value="mov">MOV</option>
                                        </select>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => setShowExportModal(false)}
                                            className="flex-1 px-4 py-2 rounded-lg text-[10px] font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={async () => {
                                                // TODO: Implement video merging logic
                                                setShowExportModal(false);
                                            }}
                                            disabled={isWorking || !exportSettings.name.trim()}
                                            className={`
                                                flex-1 px-4 py-2 rounded-lg text-[10px] font-bold transition-all
                                                ${isWorking || !exportSettings.name.trim()
                                                    ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:shadow-lg hover:shadow-red-500/20'}
                                            `}
                                        >
                                            {isWorking ? '生成中...' : '开始生成'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    </>
                ) : (
                    // ... (Other nodes basic UI) ...
                    <>
                    <div className="relative group/input bg-black/10 rounded-[16px]">
                        <textarea className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed" style={{ height: `${Math.min(inputHeight, 200)}px` }} placeholder={node.type === NodeType.AUDIO_GENERATOR ? "描述您想生成的音乐或音效..." : "描述您的修改或生成需求..."} value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onKeyDown={handleCmdEnter} onFocus={() => setIsInputFocused(true)} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} readOnly={isWorking} />
                        <div className="absolute bottom-0 left-0 w-full h-3 cursor-row-resize flex items-center justify-center opacity-0 group-hover/input:opacity-100 transition-opacity" onMouseDown={handleInputResizeStart}><div className="w-8 h-1 rounded-full bg-white/10 group-hover/input:bg-white/20" /></div>
                    </div>
                    {/* ... Models dropdown, Aspect ratio, etc. Same as existing ... */}
                    <div className="flex items-center justify-between px-2 pb-1 pt-1 relative z-20">
                        {/* ... */}
                        <div className="flex items-center gap-2">
                            <div className="relative group/model">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400"><span>{models.find(m => m.v === node.data.model)?.l || 'AI Model'}</span><ChevronDown size={10} /></div>
                                <div className="absolute bottom-full left-0 pb-2 w-40 opacity-0 translate-y-2 pointer-events-none group-hover/model:opacity-100 group-hover/model:translate-y-0 group-hover/model:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">{models.map(m => (<div key={m.v} onClick={() => onUpdate(node.id, { model: m.v })} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${node.data.model === m.v ? 'text-cyan-400 bg-white/5' : 'text-slate-400'}`}>{m.l}</div>))}</div></div>
                            </div>
                            {/* ... Ratios ... */}
                            {node.type !== NodeType.VIDEO_ANALYZER && node.type !== NodeType.AUDIO_GENERATOR && (<div className="relative group/ratio"><div className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-[10px] font-bold text-slate-400 hover:text-cyan-400"><Scaling size={12} /><span>{node.data.aspectRatio || '16:9'}</span></div><div className="absolute bottom-full left-0 pb-2 w-20 opacity-0 translate-y-2 pointer-events-none group-hover/ratio:opacity-100 group-hover/ratio:translate-y-0 group-hover/ratio:pointer-events-auto transition-all duration-200 z-[200]"><div className="bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden">{(node.type.includes('VIDEO') ? VIDEO_ASPECT_RATIOS : IMAGE_ASPECT_RATIOS).map(r => (<div key={r} onClick={() => handleAspectRatioSelect(r)} className={`px-3 py-2 text-[10px] font-bold cursor-pointer hover:bg-white/10 ${node.data.aspectRatio === r ? 'text-cyan-400 bg-white/5' : 'text-slate-400'}`}>{r}</div>))}</div></div></div>)}
                        </div>
                        <button onClick={handleActionClick} disabled={isActionDisabled} className={`relative flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black hover:shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95'}`}>{isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}<span>{isWorking ? '生成中...' : '生成'}</span></button>
                    </div>
                    </>
                )}
            </div>
        </div>
     );
};
