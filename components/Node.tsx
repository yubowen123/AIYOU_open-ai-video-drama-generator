
import { AppNode, NodeStatus, NodeType, StoryboardShot, CharacterProfile } from '../types';
import { RefreshCw, Play, Image as ImageIcon, Video as VideoIcon, Type, AlertCircle, CheckCircle, Plus, Maximize2, Download, MoreHorizontal, Wand2, Scaling, FileSearch, Edit, Loader2, Layers, Trash2, X, Upload, Scissors, Film, MousePointerClick, Crop as CropIcon, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, GripHorizontal, Link, Copy, Monitor, Music, Pause, Volume2, Mic2, BookOpen, ScrollText, Clapperboard, LayoutGrid, Box, User, Users, Save, RotateCcw, Eye, List, Sparkles, ZoomIn, ZoomOut, Minus, Circle, Square, Maximize, Move, RotateCw, TrendingUp, TrendingDown, ArrowRight, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight, Palette, Grid, MoveHorizontal, ArrowUpDown, Database, ShieldAlert, ExternalLink } from 'lucide-react';
import { VideoModeSelector, SceneDirectorOverlay } from './VideoNodeModules';
import { PromptEditor } from './PromptEditor';
import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { IMAGE_MODELS, TEXT_MODELS, VIDEO_MODELS, AUDIO_MODELS } from '../services/modelConfig';
import { promptManager } from '../services/promptManager';

const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const IMAGE_RESOLUTIONS = ['1k', '2k', '4k'];
const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];

// 景别 (Shot Size) - 使用标准影视术语
const SHOT_TYPES = [
  { value: '大远景', label: '大远景', icon: Maximize, desc: 'Extreme Long Shot - 人物如蚂蚁，环境主导' },
  { value: '远景', label: '远景', icon: Maximize, desc: 'Long Shot - 人物小但能看清动作' },
  { value: '全景', label: '全景', icon: Square, desc: 'Full Shot - 顶天立地，全身可见' },
  { value: '中景', label: '中景', icon: Box, desc: 'Medium Shot - 腰部以上，社交距离' },
  { value: '中近景', label: '中近景', icon: User, desc: 'Medium Close-up - 胸部以上，故事重心' },
  { value: '近景', label: '近景', icon: Circle, desc: 'Close Shot - 脖子以上，亲密审视' },
  { value: '特写', label: '特写', icon: ZoomIn, desc: 'Close-up - 只有脸，灵魂窗口' },
  { value: '大特写', label: '大特写', icon: ZoomIn, desc: 'Extreme Close-up - 局部细节，显微镜' },
];

// 拍摄角度 (Camera Angle) - 使用标准影视术语
const CAMERA_ANGLES = [
  { value: '视平', label: '视平', icon: Minus, desc: 'Eye Level - 与角色眼睛同高，最中性自然' },
  { value: '高位俯拍', label: '高位俯拍', icon: TrendingDown, desc: 'High Angle - 从上往下拍，表现脆弱无助' },
  { value: '低位仰拍', label: '低位仰拍', icon: TrendingUp, desc: 'Low Angle - 从下往上拍，赋予力量' },
  { value: '斜拍', label: '斜拍', icon: RotateCw, desc: 'Dutch Angle - 摄影机倾斜，制造不安' },
  { value: '越肩', label: '越肩', icon: Users, desc: 'Over the Shoulder - 从肩膀后方拍摄' },
  { value: '鸟瞰', label: '鸟瞰', icon: ArrowDown, desc: 'Bird\'s Eye View - 垂直向下90度，上帝视角' },
];

// 运镜方式 (Camera Movement) - 使用标准影视术语
const CAMERA_MOVEMENTS = [
  { value: '固定', label: '固定', icon: Maximize2, desc: 'Static - 摄影机纹丝不动' },
  { value: '横移', label: '横移', icon: MoveHorizontal, desc: 'Truck - 水平移动，产生视差' },
  { value: '俯仰', label: '俯仰', icon: ArrowUpDown, desc: 'Tilt - 镜头上下转动' },
  { value: '横摇', label: '横摇', icon: RotateCw, desc: 'Pan - 镜头左右转动' },
  { value: '升降', label: '升降', icon: ArrowUp, desc: 'Boom/Crane - 垂直升降' },
  { value: '轨道推拉', label: '轨道推拉', icon: ZoomIn, desc: 'Dolly - 物理靠近或远离' },
  { value: '变焦推拉', label: '变焦推拉', icon: ZoomIn, desc: 'Zoom - 改变焦距，人工感' },
  { value: '正跟随', label: '正跟随', icon: Move, desc: 'Following Shot - 位于角色身后跟随' },
  { value: '倒跟随', label: '倒跟随', icon: Move, desc: 'Leading Shot - 在角色前方后退' },
  { value: '环绕', label: '环绕', icon: RefreshCw, desc: 'Arc/Orbit - 围绕主体旋转' },
  { value: '滑轨横移', label: '滑轨横移', icon: MoveHorizontal, desc: 'Slider - 小型轨道平滑移动' },
];
const IMAGE_COUNTS = [1, 2, 3, 4];
const VIDEO_COUNTS = [1, 2, 3, 4];
const GLASS_PANEL = "bg-[#2c2c2e]/95 backdrop-blur-2xl border border-white/10 shadow-2xl";
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_FIXED_HEIGHT = 360; 
const AUDIO_NODE_HEIGHT = 200;
const STORYBOARD_NODE_HEIGHT = 500;
const CHARACTER_NODE_HEIGHT = 600;

const SHORT_DRAMA_GENRES = [
    '霸总 (CEO)', '古装 (Historical)', '悬疑 (Suspense)', '甜宠 (Romance)', 
    '复仇 (Revenge)', '穿越 (Time Travel)', '都市 (Urban)', '奇幻 (Fantasy)', 
    '萌宝 (Cute Baby)', '战神 (God of War)'
];

const SHORT_DRAMA_SETTINGS = [
    '现代都市 (Modern City)', '古代宫廷 (Ancient Palace)', '豪门别墅 (Luxury Villa)', 
    '校园 (School)', '医院 (Hospital)', '办公室 (Office)', '民国 (Republic Era)', 
    '仙侠世界 (Xianxia)', '赛博朋克 (Cyberpunk)'
];

interface InputAsset {
    id: string;
    type: 'image' | 'video';
    src: string;
}

interface NodeProps {
  node: AppNode;
  onUpdate: (id: string, data: Partial<AppNode['data']>, size?: { width?: number, height?: number }, title?: string) => void;
  onAction: (id: string, prompt?: string) => void;
  onDelete: (id: string) => void;
  onExpand?: (data: { type: 'image' | 'video', src: string, rect: DOMRect, images?: string[], initialIndex?: number }) => void;
  onCrop?: (id: string, imageBase64: string) => void; 
  onNodeMouseDown: (e: React.MouseEvent, id: string) => void;
  onPortMouseDown: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
  onPortMouseUp: (e: React.MouseEvent, id: string, type: 'input' | 'output') => void;
  onNodeContextMenu: (e: React.MouseEvent, id: string) => void;
  onMediaContextMenu?: (e: React.MouseEvent, nodeId: string, type: 'image' | 'video', src: string) => void;
  onResizeMouseDown: (e: React.MouseEvent, id: string, initialWidth: number, initialHeight: number) => void;
  inputAssets?: InputAsset[];
  onInputReorder?: (nodeId: string, newOrder: string[]) => void;
  
  // Character Node Actions
  onCharacterAction?: (nodeId: string, action: 'DELETE' | 'SAVE' | 'RETRY' | 'GENERATE_EXPRESSION' | 'GENERATE_THREE_VIEW', charName: string, customPrompt?: { expressionPrompt?: string; threeViewPrompt?: string }) => void | Promise<void>;
  onViewCharacter?: (character: CharacterProfile) => void;

  isDragging?: boolean;
  isGroupDragging?: boolean;
  isSelected?: boolean;
  isResizing?: boolean;
  isConnecting?: boolean;

  // 性能优化：使用nodeQuery而不是传递整个nodes数组
  nodeQuery?: {
    getNode: (id: string) => AppNode | undefined;
    getUpstreamNodes: (nodeId: string, nodeType: string) => AppNode[];
    getFirstUpstreamNode: (nodeId: string, nodeType: string) => AppNode | undefined;
    hasUpstreamNode: (nodeId: string, nodeType: string) => boolean;
    getNodesByIds: (ids: string[]) => AppNode[];
  };
  characterLibrary?: CharacterProfile[];
}

const SecureVideo = ({ src, className, autoPlay, muted, loop, onMouseEnter, onMouseLeave, onClick, controls, videoRef, style }: any) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) return;
        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setBlobUrl(src);
            return;
        }

        let active = true;
        fetch(src)
            .then(response => {
                if (!response.ok) throw new Error("Video fetch failed");
                return response.blob();
            })
            .then(blob => {
                if (active) {
                    const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                    const url = URL.createObjectURL(mp4Blob);
                    setBlobUrl(url);
                }
            })
            .catch(err => {
                console.error("SecureVideo load error:", err);
                if (active) setError(true);
            });

        return () => {
            active = false;
            if (blobUrl && !blobUrl.startsWith('data:')) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [src]);

    if (error) {
        return <div className={`flex flex-col items-center justify-center bg-zinc-800 text-xs text-red-400 ${className}`}>
            <span>视频链接已失效</span>
            <span className="text-[9px] text-zinc-500 mt-0.5">Sora URL过期，请重新生成</span>
        </div>;
    }

    if (!blobUrl) {
        return <div className={`flex items-center justify-center bg-zinc-900 ${className}`}><Loader2 className="animate-spin text-zinc-600" /></div>;
    }

    return (
        <video 
            ref={videoRef}
            src={blobUrl} 
            className={className}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            controls={controls}
            playsInline
            preload="auto"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            style={{ backgroundColor: '#18181b', ...style }} 
        />
    );
};

const safePlay = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (!vid) return;
    const p = vid.play();
    if (p !== undefined) {
        p.catch((error: any) => {
            if (error.name !== 'AbortError') {
                console.debug("Video play prevented:", error);
            }
        });
    }
};

const safePause = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (vid) {
        vid.pause();
        vid.currentTime = 0; 
    }
};

const arePropsEqual = (prev: NodeProps, next: NodeProps) => {
    // 首先检查交互状态变化（这些状态变化时必须重新渲染）
    if (prev.isDragging !== next.isDragging ||
        prev.isResizing !== next.isResizing ||
        prev.isSelected !== next.isSelected ||
        prev.isGroupDragging !== next.isGroupDragging ||
        prev.isConnecting !== next.isConnecting) {
        return false;
    }

    // 深度比较node对象的关键属性（而不是引用比较）
    const prevNode = prev.node;
    const nextNode = next.node;

    // 检查基本属性
    if (prevNode.id !== nextNode.id ||
        prevNode.type !== nextNode.type ||
        prevNode.x !== nextNode.x ||
        prevNode.y !== nextNode.y ||
        prevNode.width !== nextNode.width ||
        prevNode.height !== nextNode.height ||
        prevNode.status !== nextNode.status) {
        return false;
    }

    // 检查node.data的关键属性
    const prevData = prevNode.data;
    const nextData = nextNode.data;

    // 检查关键的data字段（这些字段变化时需要重新渲染）
    const criticalDataKeys = [
        'prompt', 'model', 'aspectRatio', 'resolution', 'count',
        'image', 'videoUri', 'croppedFrame', 'analysis',
        'scriptOutline', 'scriptGenre', 'scriptSetting', 'scriptVisualStyle',
        'generatedEpisodes', 'storyboardGridImage', 'storyboardGridImages',
        'extractedCharacterNames', 'characterConfigs', 'generatedCharacters',
        'error', 'progress', 'duration', 'quality', 'isCompliant',
        'isExpanded', 'videoMode', 'shotType', 'cameraAngle', 'cameraMovement',
        'selectedFields', 'dramaName', 'taskGroups'
    ];

    for (const key of criticalDataKeys) {
        if (prevData[key] !== nextData[key]) {
            return false;
        }
    }

    // 检查inputs数组
    const prevInputs = prevNode.inputs;
    const nextInputs = nextNode.inputs;
    if (prevInputs.length !== nextInputs.length) {
        return false;
    }
    for (let i = 0; i < prevInputs.length; i++) {
        if (prevInputs[i] !== nextInputs[i]) {
            return false;
        }
    }

    // 检查inputAssets（输入的图片/视频资源）
    const prevInputAssets = prev.inputAssets || [];
    const nextInputAssets = next.inputAssets || [];
    if (prevInputAssets.length !== nextInputAssets.length) {
        return false;
    }
    for (let i = 0; i < prevInputAssets.length; i++) {
        if (prevInputAssets[i].id !== nextInputAssets[i].id ||
            prevInputAssets[i].src !== nextInputAssets[i].src ||
            prevInputAssets[i].type !== nextInputAssets[i].type) {
            return false;
        }
    }

    // 所有关键属性都相同，不需要重新渲染
    return true;
};

const InputThumbnails = ({ assets, onReorder }: { assets: InputAsset[], onReorder: (newOrder: string[]) => void }) => {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const onReorderRef = useRef(onReorder);
    onReorderRef.current = onReorder; 
    const stateRef = useRef({ draggingId: null as string | null, startX: 0, originalAssets: [] as InputAsset[] });
    const THUMB_WIDTH = 48; 
    const GAP = 6;
    const ITEM_FULL_WIDTH = THUMB_WIDTH + GAP;

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (!stateRef.current.draggingId) return;
        const delta = e.clientX - stateRef.current.startX;
        setDragOffset(delta);
    }, []);

    const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
        if (!stateRef.current.draggingId) return;
        const { draggingId, startX, originalAssets } = stateRef.current;
        const currentOffset = e.clientX - startX;
        const moveSlots = Math.round(currentOffset / ITEM_FULL_WIDTH);
        const currentIndex = originalAssets.findIndex(a => a.id === draggingId);
        const newIndex = Math.max(0, Math.min(originalAssets.length - 1, currentIndex + moveSlots));

        if (newIndex !== currentIndex) {
            const newOrderIds = originalAssets.map(a => a.id);
            const [moved] = newOrderIds.splice(currentIndex, 1);
            newOrderIds.splice(newIndex, 0, moved);
            onReorderRef.current(newOrderIds);
        }
        setDraggingId(null);
        setDragOffset(0);
        stateRef.current.draggingId = null;
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [ITEM_FULL_WIDTH]); 
    
    useEffect(() => {
        return () => {
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        }
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        setDraggingId(id);
        setDragOffset(0);
        stateRef.current = { draggingId: id, startX: e.clientX, originalAssets: [...assets] };
        document.body.style.cursor = 'grabbing';
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    if (!assets || assets.length === 0) return null;

    return (
        <div className="flex items-center justify-center h-14 pointer-events-none select-none relative z-0" onMouseDown={e => e.stopPropagation()}>
            <div className="relative flex items-center gap-[6px]">
                {assets.map((asset, index) => {
                    const isItemDragging = asset.id === draggingId;
                    const originalIndex = assets.findIndex(a => a.id === draggingId);
                    let translateX = 0;
                    let scale = 1;
                    let zIndex = 10;
                    
                    if (isItemDragging) {
                        translateX = dragOffset;
                        scale = 1.15;
                        zIndex = 100;
                    } else if (draggingId) {
                        const draggingVirtualIndex = Math.max(0, Math.min(assets.length - 1, originalIndex + Math.round(dragOffset / ITEM_FULL_WIDTH)));
                        if (index > originalIndex && index <= draggingVirtualIndex) translateX = -ITEM_FULL_WIDTH;
                        else if (index < originalIndex && index >= draggingVirtualIndex) translateX = ITEM_FULL_WIDTH;
                    }
                    const isVideo = asset.type === 'video';
                    return (
                        <div 
                            key={asset.id}
                            className={`relative rounded-md overflow-hidden cursor-grab active:cursor-grabbing pointer-events-auto border border-white/20 shadow-lg bg-black/60 group`}
                            style={{
                                width: `${THUMB_WIDTH}px`, height: `${THUMB_WIDTH}px`, 
                                transform: `translateX(${translateX}px) scale(${scale})`,
                                zIndex,
                                transition: isItemDragging ? 'none' : 'transform 0.5s cubic-bezier(0.32,0.72,0,1)', 
                            }}
                            onMouseDown={(e) => handleMouseDown(e, asset.id)}
                        >
                            {isVideo ? (
                                <SecureVideo src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-zinc-900" muted loop autoPlay />
                            ) : (
                                <img src={asset.src} className="w-full h-full object-cover pointer-events-none select-none opacity-80 group-hover:opacity-100 transition-opacity bg-zinc-900" alt="" />
                            )}
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-md"></div>
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 z-20 shadow-sm pointer-events-none">
                                <span className="text-[9px] font-bold text-white leading-none">{index + 1}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
};

const AudioVisualizer = ({ isPlaying }: { isPlaying: boolean }) => (
    <div className="flex items-center justify-center gap-[2px] h-12 w-full opacity-60">
        {[...Array(20)].map((_, i) => (
            <div key={i} className="w-1 bg-cyan-400/80 rounded-full" style={{ height: isPlaying ? `${20 + Math.random() * 80}%` : '20%', transition: 'height 0.1s ease', animation: isPlaying ? `pulse 0.5s infinite ${i * 0.05}s` : 'none' }} />
        ))}
    </div>
);

// Episode Viewer Component - Single component to display all generated episodes
const EpisodeViewer = ({ episodes }: { episodes: { title: string, content: string, characters: string }[] }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    return (
        <div className="w-full h-full flex flex-col bg-[#1c1c1e] relative overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {episodes.map((ep, idx) => {
                    const isExpanded = expandedIndex === idx;
                    return (
                        <div 
                            key={idx} 
                            className={`rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-black/40 border-teal-500/30 shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                        >
                            <button 
                                onClick={(e) => { e.stopPropagation(); setExpandedIndex(isExpanded ? null : idx); }}
                                className="w-full flex items-center justify-between p-3 text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isExpanded ? 'bg-teal-500 text-black' : 'bg-white/10 text-slate-400'}`}>
                                        {idx + 1}
                                    </div>
                                    <span className={`text-xs font-bold ${isExpanded ? 'text-teal-100' : 'text-slate-300'}`}>{ep.title}</span>
                                </div>
                                <ChevronDown size={14} className={`text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isExpanded && (
                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="mb-3 pl-3 border-l-2 border-teal-500/30">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Characters</span>
                                        <span className="text-[10px] text-teal-300/80">{ep.characters}</span>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-3 border border-white/5 relative group/text">
                                        <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed select-text font-medium">
                                            {ep.content}
                                        </pre>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`Title: ${ep.title}\nCharacters: ${ep.characters}\n\n${ep.content}`); }}
                                            className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur rounded text-slate-400 hover:text-white opacity-0 group-hover/text:opacity-100 transition-opacity"
                                            title="Copy Content"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const NodeComponent: React.FC<NodeProps> = ({
  node, onUpdate, onAction, onDelete, onExpand, onCrop, onNodeMouseDown, onPortMouseDown, onPortMouseUp, onNodeContextMenu, onMediaContextMenu, onResizeMouseDown, inputAssets, onInputReorder, onCharacterAction, onViewCharacter, isDragging, isGroupDragging, isSelected, isResizing, isConnecting, nodeQuery, characterLibrary
}) => {
  const isWorking = node.status === NodeStatus.WORKING;
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const isActionDisabled = isWorking || isActionProcessing;
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>(null);
  const isHoveringRef = useRef(false);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false); 
  const [showImageGrid, setShowImageGrid] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(node.title);
  const [isHovered, setIsHovered] = useState(false); 
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const generationMode = node.data.generationMode || 'CONTINUE';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPrompt, setLocalPrompt] = useState(node.data.prompt || '');
  const [inputHeight, setInputHeight] = useState(48); 
  const isResizingInput = useRef(false);
  const inputStartDragY = useRef(0);
  const inputStartHeight = useRef(0);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
  const [viewingOutline, setViewingOutline] = useState(false);
  const actionProcessingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setLocalPrompt(node.data.prompt || ''); }, [node.data.prompt]);
  const commitPrompt = () => { if (localPrompt !== (node.data.prompt || '')) onUpdate(node.id, { prompt: localPrompt }); };

  // 防重复点击的 Action 处理函数
  const handleActionClick = () => {
    // 如果正在处理中，直接返回
    if (isActionProcessing) {
      return;
    }

    // 标记为处理中
    setIsActionProcessing(true);

    // 执行操作
    commitPrompt();
    onAction(node.id, localPrompt);

    // 清除之前的定时器
    if (actionProcessingTimerRef.current) {
      clearTimeout(actionProcessingTimerRef.current);
    }

    // 1秒后解除阻止
    actionProcessingTimerRef.current = setTimeout(() => {
      setIsActionProcessing(false);
    }, 1000);
  };

  const handleCmdEnter = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      // 使用相同的防重复点击逻辑
      if (isActionProcessing) {
        return;
      }
      setIsActionProcessing(true);
      commitPrompt();
      onAction(node.id, localPrompt);
      if (actionProcessingTimerRef.current) {
        clearTimeout(actionProcessingTimerRef.current);
      }
      actionProcessingTimerRef.current = setTimeout(() => {
        setIsActionProcessing(false);
      }, 1000);
    }
  };
  
  const handleInputResizeStart = (e: React.MouseEvent) => {
      e.stopPropagation(); e.preventDefault();
      isResizingInput.current = true; inputStartDragY.current = e.clientY; inputStartHeight.current = inputHeight;
      const handleGlobalMouseMove = (e: MouseEvent) => { 
          if (!isResizingInput.current) return; 
          setInputHeight(Math.max(48, Math.min(inputStartHeight.current + (e.clientY - inputStartDragY.current), 300))); 
      };
      const handleGlobalMouseUp = () => { isResizingInput.current = false; window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
      window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp);
  };

  // Function to refresh chapters from planner node
  const handleRefreshChapters = useCallback(() => {
      console.log('🔄 刷新章节列表...');
      if (node.type === NodeType.SCRIPT_EPISODE && nodeQuery) {
          const plannerNode = nodeQuery.getFirstUpstreamNode(node.id, NodeType.SCRIPT_PLANNER);
          console.log('📖 找到上游剧本大纲节点:', plannerNode?.id);
          if (plannerNode && plannerNode.data.scriptOutline) {
              console.log('📝 剧本大纲内容长度:', plannerNode.data.scriptOutline.length);
              console.log('📄 完整剧本大纲:\n', plannerNode.data.scriptOutline);
              // 匹配格式：*   **## 第一章：都市异象 (Episodes 1-2)** - 描述
              const regex1 = /##\s+(第[一二三四五六七八九十\d]+章[：:][^\(\*]+|最终章[：:][^\(\*]+)/gm;
              const matches = [];
              let match;
              while ((match = regex1.exec(plannerNode.data.scriptOutline)) !== null) {
                  matches.push(match[1].trim());
              }
              console.log('✅ 提取到章节数量:', matches.length, matches);
              if (matches.length > 0) {
                  setAvailableChapters(matches);
                  // Auto-select first chapter if none selected
                  if (!node.data.selectedChapter) {
                      onUpdate(node.id, { selectedChapter: matches[0] });
                  }
              }
          } else {
              console.log('⚠️ 未找到剧本大纲节点或大纲内容为空');
          }
      }
  }, [node.type, node.inputs, node.id, node.data.selectedChapter, nodeQuery, onUpdate]);

  useEffect(() => {
      handleRefreshChapters();
  }, [handleRefreshChapters]);

  React.useEffect(() => {
      if (videoBlobUrl) { URL.revokeObjectURL(videoBlobUrl); setVideoBlobUrl(null); }
      if ((node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_ANALYZER) && node.data.videoUri) {
          if (node.data.videoUri.startsWith('data:')) { setVideoBlobUrl(node.data.videoUri); return; }
          let isActive = true; setIsLoadingVideo(true);
          fetch(node.data.videoUri).then(res => res.blob()).then(blob => { 
              if (isActive) { 
                  const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                  setVideoBlobUrl(URL.createObjectURL(mp4Blob)); 
                  setIsLoadingVideo(false); 
              }
          }).catch(err => { if (isActive) setIsLoadingVideo(false); });
          return () => { isActive = false; if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl); };
      }
  }, [node.data.videoUri, node.type]);

  const toggleAudio = (e: React.MouseEvent) => {
      e.stopPropagation();
      const audio = mediaRef.current as HTMLAudioElement;
      if (!audio) return;
      if (audio.paused) { audio.play(); setIsPlayingAudio(true); } else { audio.pause(); setIsPlayingAudio(false); }
  };

  useEffect(() => {
    return () => {
        if (mediaRef.current && (mediaRef.current instanceof HTMLVideoElement || mediaRef.current instanceof HTMLAudioElement)) {
            try { mediaRef.current.pause(); mediaRef.current.src = ""; mediaRef.current.load(); } catch (e) {}
        }
    }
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    isHoveringRef.current = true;
    if(node.data.images?.length > 1 || (node.data.videoUris && node.data.videoUris.length > 1)) setShowImageGrid(true);
    if (mediaRef.current instanceof HTMLVideoElement) safePlay(mediaRef.current);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    isHoveringRef.current = false;
    setShowImageGrid(false);
    if (mediaRef.current instanceof HTMLVideoElement) safePause(mediaRef.current);
  };
  
  const handleExpand = (e: React.MouseEvent) => { 
      e.stopPropagation(); 
      if (onExpand && mediaRef.current) { 
          const rect = mediaRef.current.getBoundingClientRect(); 
          if (node.type.includes('IMAGE') && node.data.image) {
              onExpand({ type: 'image', src: node.data.image, rect, images: node.data.images || [node.data.image], initialIndex: (node.data.images || [node.data.image]).indexOf(node.data.image) }); 
          } else if (node.type.includes('VIDEO') && node.data.videoUri) {
              const src = node.data.videoUri;
              const videos = node.data.videoUris && node.data.videoUris.length > 0 ? node.data.videoUris : [src];
              const currentIndex = node.data.videoUris ? node.data.videoUris.indexOf(node.data.videoUri) : 0;
              const safeIndex = currentIndex >= 0 ? currentIndex : 0;
              onExpand({ type: 'video', src: src, rect, images: videos, initialIndex: safeIndex }); 
          }
      }
  };
  const handleDownload = (e: React.MouseEvent) => { e.stopPropagation(); const a = document.createElement('a'); a.href = node.data.image || videoBlobUrl || node.data.audioUri || ''; a.download = `sunstudio-${Date.now()}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

  // 防重复点击的上传处理函数
  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpdate(node.id, { videoUri: e.target?.result as string });
      setIsUploading(false);
    };
    reader.onerror = () => setIsUploading(false);
    reader.readAsDataURL(file);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpdate(node.id, { image: e.target?.result as string });
      setIsUploading(false);
    };
    reader.onerror = () => setIsUploading(false);
    reader.readAsDataURL(file);
  };
  
  const handleAspectRatioSelect = (newRatio: string) => {
    const [w, h] = newRatio.split(':').map(Number);
    let newSize: { width?: number, height?: number } = { height: undefined };
    if (w && h) { 
        const currentWidth = node.width || DEFAULT_NODE_WIDTH; 
        const projectedHeight = (currentWidth * h) / w; 
        if (projectedHeight > 600) newSize.width = (600 * w) / h; 
    }
    onUpdate(node.id, { aspectRatio: newRatio }, newSize);
  };
  
  const handleTitleSave = () => { setIsEditingTitle(false); if (tempTitle.trim() && tempTitle !== node.title) onUpdate(node.id, {}, undefined, tempTitle); else setTempTitle(node.title); };

  const getNodeConfig = () => {
      switch (node.type) {
        case NodeType.PROMPT_INPUT: return { icon: Type, color: 'text-amber-400', border: 'border-amber-500/30' };
        case NodeType.IMAGE_GENERATOR: return { icon: ImageIcon, color: 'text-cyan-400', border: 'border-cyan-500/30' };
        case NodeType.VIDEO_GENERATOR: return { icon: VideoIcon, color: 'text-purple-400', border: 'border-purple-500/30' };
        case NodeType.AUDIO_GENERATOR: return { icon: Mic2, color: 'text-pink-400', border: 'border-pink-500/30' };
        case NodeType.VIDEO_ANALYZER: return { icon: FileSearch, color: 'text-emerald-400', border: 'border-emerald-500/30' };
        case NodeType.IMAGE_EDITOR: return { icon: Edit, color: 'text-rose-400', border: 'border-rose-500/30' };
        case NodeType.SCRIPT_PLANNER: return { icon: BookOpen, color: 'text-orange-400', border: 'border-orange-500/30' };
        case NodeType.SCRIPT_EPISODE: return { icon: ScrollText, color: 'text-teal-400', border: 'border-teal-500/30' };
        case NodeType.STORYBOARD_GENERATOR: return { icon: Clapperboard, color: 'text-indigo-400', border: 'border-indigo-500/30' };
        case NodeType.STORYBOARD_IMAGE: return { icon: LayoutGrid, color: 'text-purple-400', border: 'border-purple-500/30' };
        case NodeType.CHARACTER_NODE: return { icon: User, color: 'text-orange-400', border: 'border-orange-500/30' };
        case NodeType.DRAMA_ANALYZER: return { icon: Film, color: 'text-violet-400', border: 'border-violet-500/30' };
        default: return { icon: Type, color: 'text-slate-400', border: 'border-white/10' };
      }
  };
  const { icon: NodeIcon } = getNodeConfig();

  const getNodeHeight = () => {
      if (node.height) return node.height;
      if (node.type === NodeType.STORYBOARD_GENERATOR) return STORYBOARD_NODE_HEIGHT;
      if (node.type === NodeType.STORYBOARD_IMAGE) return 600;
      if (node.type === NodeType.CHARACTER_NODE) return CHARACTER_NODE_HEIGHT;
      if (node.type === NodeType.DRAMA_ANALYZER) return 600;
      if (node.type === NodeType.SORA_VIDEO_GENERATOR) return 700;
      if (node.type === NodeType.SORA_VIDEO_CHILD) return 500;
      if (node.type === NodeType.SCRIPT_PLANNER && node.data.scriptOutline) return 500;
      if (['VIDEO_ANALYZER', 'IMAGE_EDITOR', 'PROMPT_INPUT', 'SCRIPT_PLANNER', 'SCRIPT_EPISODE'].includes(node.type)) return DEFAULT_FIXED_HEIGHT;
      if (node.type === NodeType.AUDIO_GENERATOR) return AUDIO_NODE_HEIGHT;
      const ratio = node.data.aspectRatio || '16:9';
      const [w, h] = ratio.split(':').map(Number);
      const extra = (node.type === NodeType.VIDEO_GENERATOR && generationMode === 'CUT') ? 36 : 0;
      return ((node.width || DEFAULT_NODE_WIDTH) * h / w) + extra;
  };
  const nodeHeight = getNodeHeight();
  const nodeWidth = node.width || DEFAULT_NODE_WIDTH;
  const hasInputs = inputAssets && inputAssets.length > 0;

  // 固定显示的标题栏
  const renderTitleBar = () => {
    const config = getNodeConfig();
    const IconComponent = config.icon;

    return (
      <div className="absolute -top-9 left-0 w-full flex items-center justify-between px-2 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-lg">
          <IconComponent size={12} className={config.color} />
          {isEditingTitle ? (
            <input
              className="bg-transparent border-none outline-none text-slate-200 text-xs font-semibold w-32"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              onMouseDown={e => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className="text-xs font-semibold text-slate-200 hover:text-white cursor-text transition-colors"
              onClick={() => setIsEditingTitle(true)}
              title="点击编辑节点名称"
            >
              {node.title}
            </span>
          )}
          {isWorking && <Loader2 className="animate-spin w-3 h-3 text-cyan-400 ml-1" />}
        </div>
      </div>
    );
  };

  // 悬停工具栏（用于操作按钮）
  const renderHoverToolbar = () => {
    const showToolbar = isSelected || isHovered;
    return (
      <div className={`absolute -top-9 right-0 flex items-center gap-1.5 px-1 transition-all duration-300 pointer-events-auto ${showToolbar ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}`}>
        {node.type === NodeType.VIDEO_GENERATOR && (<VideoModeSelector currentMode={generationMode} onSelect={(mode) => onUpdate(node.id, { generationMode: mode })} />)}
        {(node.data.image || node.data.videoUri || node.data.audioUri) && (
          <div className="flex items-center gap-1">
            <button onClick={handleDownload} className="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors" title="下载"><Download size={14} /></button>
            {node.type !== NodeType.AUDIO_GENERATOR && node.type !== NodeType.STORYBOARD_IMAGE && <button onClick={handleExpand} className="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors" title="全屏预览"><Maximize2 size={14} /></button>}
          </div>
        )}
      </div>
    );
  };

  // State for shot editing modal
  const [editingShot, setEditingShot] = useState<import('../types').DetailedStoryboardShot | null>(null);
  const [editingShotIndex, setEditingShotIndex] = useState<number>(-1);

  const renderMediaContent = () => {
      if (node.type === NodeType.PROMPT_INPUT) {
          // If episodeStoryboard exists, show storyboard view
          if (node.data.episodeStoryboard && node.data.episodeStoryboard.shots.length > 0) {
              const storyboard = node.data.episodeStoryboard;
              const shots = storyboard.shots;

              return (
                  <div className="w-full h-full flex flex-col overflow-hidden relative bg-[#1c1c1e]">
                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                          {shots.map((shot, idx) => (
                              <div key={shot.id} className="flex gap-3 p-3 rounded-xl bg-black/40 border border-white/5 hover:bg-black/60 transition-colors">
                                  {/* Shot Number Badge */}
                                  <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                      <span className="text-sm font-bold text-indigo-300">{shot.shotNumber}</span>
                                  </div>

                                  {/* Shot Details */}
                                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                              <div className="text-[10px] font-bold text-indigo-300 mb-1">{shot.scene}</div>
                                              <div className="text-[9px] text-slate-400">
                                                  {shot.characters.length > 0 && (
                                                      <span className="mr-2">👤 {shot.characters.join(', ')}</span>
                                                  )}
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                              <span className="text-[9px] font-mono text-slate-500">{shot.duration}s</span>
                                              <button
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingShot({ ...shot });
                                                      setEditingShotIndex(idx);
                                                  }}
                                                  disabled={isActionDisabled}
                                                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                                                  title="编辑分镜"
                                              >
                                                  <Edit size={12} />
                                              </button>
                                          </div>
                                      </div>

                                      <div className="text-[10px] text-slate-300 leading-relaxed">
                                          {shot.visualDescription}
                                      </div>

                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] text-slate-500">
                                              📹 {shot.shotSize}
                                          </span>
                                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] text-slate-500">
                                              📐 {shot.cameraAngle}
                                          </span>
                                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] text-slate-500">
                                              🎬 {shot.cameraMovement}
                                          </span>
                                      </div>

                                      {shot.dialogue && shot.dialogue !== '无' && (
                                          <div className="mt-1 px-2 py-1.5 bg-black/40 border border-white/5 rounded text-[9px] text-cyan-300">
                                              💬 {shot.dialogue}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}

                          {/* Show loading indicator if working */}
                          {isWorking && (
                              <div className="flex items-center justify-center gap-2 p-4 text-indigo-400">
                                  <Loader2 size={16} className="animate-spin" />
                                  <span className="text-xs">正在生成更多分镜...</span>
                              </div>
                          )}
                      </div>

                      {/* Summary Bar */}
                      <div className="shrink-0 px-4 py-2 bg-black/60 border-t border-white/5 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">
                              共 {storyboard.totalShots} 个分镜
                          </span>
                          <span className="text-slate-400">
                              总时长 {Math.floor(storyboard.totalDuration / 60)}:{(storyboard.totalDuration % 60).toString().padStart(2, '0')}
                          </span>
                      </div>

                      {/* Edit Shot Modal */}
                      {editingShot && (
                          <div
                              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]"
                              onClick={() => setEditingShot(null)}
                              onMouseDown={(e) => e.stopPropagation()}
                          >
                              <div
                                  className="bg-[#1c1c1e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto custom-scrollbar m-4"
                                  onClick={(e) => e.stopPropagation()}
                              >
                                  <div className="flex items-center justify-between mb-4">
                                      <h3 className="text-lg font-bold text-white">编辑分镜 #{editingShot.shotNumber}</h3>
                                      <button
                                          onClick={() => setEditingShot(null)}
                                          className="p-1 hover:bg-white/10 rounded transition-colors"
                                      >
                                          <X size={20} className="text-slate-400" />
                                      </button>
                                  </div>

                                  <div className="space-y-4">
                                      <div>
                                          <label className="block text-xs text-slate-400 mb-1">场景</label>
                                          <input
                                              type="text"
                                              value={editingShot.scene}
                                              onChange={(e) => setEditingShot({ ...editingShot, scene: e.target.value })}
                                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                          />
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-1">角色 (逗号分隔)</label>
                                          <input
                                              type="text"
                                              value={editingShot.characters.join(', ')}
                                              onChange={(e) => setEditingShot({
                                                  ...editingShot,
                                                  characters: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                              })}
                                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                          />
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-1">时长 (秒)</label>
                                          <input
                                              type="number"
                                              min="1"
                                              max="10"
                                              step="0.5"
                                              value={editingShot.duration}
                                              onChange={(e) => setEditingShot({ ...editingShot, duration: parseFloat(e.target.value) || 3 })}
                                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                          />
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-2">景别</label>
                                          <div className="grid grid-cols-4 gap-2">
                                              {SHOT_TYPES.map((type) => {
                                                  const Icon = type.icon;
                                                  const isSelected = editingShot.shotSize === type.value || editingShot.shotSize.includes(type.label);
                                                  return (
                                                      <button
                                                          key={type.value}
                                                          onClick={() => setEditingShot({ ...editingShot, shotSize: type.value })}
                                                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                                                              isSelected
                                                                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                                                                  : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'
                                                          }`}
                                                          title={type.desc}
                                                      >
                                                          <Icon size={16} />
                                                          <span className="text-[9px] font-medium">{type.label}</span>
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-2">拍摄角度</label>
                                          <div className="grid grid-cols-4 gap-2">
                                              {CAMERA_ANGLES.map((angle) => {
                                                  const Icon = angle.icon;
                                                  const isSelected = editingShot.cameraAngle === angle.value || editingShot.cameraAngle.includes(angle.label);
                                                  return (
                                                      <button
                                                          key={angle.value}
                                                          onClick={() => setEditingShot({ ...editingShot, cameraAngle: angle.value })}
                                                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                                                              isSelected
                                                                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                                                                  : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'
                                                          }`}
                                                          title={angle.desc}
                                                      >
                                                          <Icon size={16} />
                                                          <span className="text-[9px] font-medium">{angle.label}</span>
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-2">运镜方式</label>
                                          <div className="grid grid-cols-4 gap-2">
                                              {CAMERA_MOVEMENTS.map((movement) => {
                                                  const Icon = movement.icon;
                                                  const isSelected = editingShot.cameraMovement === movement.value || editingShot.cameraMovement.includes(movement.label);
                                                  return (
                                                      <button
                                                          key={movement.value}
                                                          onClick={() => setEditingShot({ ...editingShot, cameraMovement: movement.value })}
                                                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                                                              isSelected
                                                                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                                                                  : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'
                                                          }`}
                                                          title={movement.desc}
                                                      >
                                                          <Icon size={16} />
                                                          <span className="text-[9px] font-medium">{movement.label}</span>
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-1">画面描述</label>
                                          <textarea
                                              value={editingShot.visualDescription}
                                              onChange={(e) => setEditingShot({ ...editingShot, visualDescription: e.target.value })}
                                              rows={4}
                                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                                          />
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-1">对白</label>
                                          <textarea
                                              value={editingShot.dialogue}
                                              onChange={(e) => setEditingShot({ ...editingShot, dialogue: e.target.value })}
                                              rows={2}
                                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                                          />
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-1">视觉效果</label>
                                          <input
                                              type="text"
                                              value={editingShot.visualEffects}
                                              onChange={(e) => setEditingShot({ ...editingShot, visualEffects: e.target.value })}
                                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                          />
                                      </div>

                                      <div>
                                          <label className="block text-xs text-slate-400 mb-1">音效</label>
                                          <input
                                              type="text"
                                              value={editingShot.audioEffects}
                                              onChange={(e) => setEditingShot({ ...editingShot, audioEffects: e.target.value })}
                                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                          />
                                      </div>
                                  </div>

                                  <div className="flex gap-3 mt-6">
                                      <button
                                          onClick={() => setEditingShot(null)}
                                          className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-colors"
                                      >
                                          取消
                                      </button>
                                      <button
                                          onClick={() => {
                                              if (editingShotIndex >= 0 && node.data.episodeStoryboard) {
                                                  const updatedShots = [...node.data.episodeStoryboard.shots];
                                                  updatedShots[editingShotIndex] = editingShot;

                                                  // Recalculate start/end times
                                                  let currentTime = 0;
                                                  updatedShots.forEach(shot => {
                                                      shot.startTime = currentTime;
                                                      shot.endTime = currentTime + shot.duration;
                                                      currentTime = shot.endTime;
                                                  });

                                                  const updatedStoryboard = {
                                                      ...node.data.episodeStoryboard,
                                                      shots: updatedShots,
                                                      totalDuration: updatedShots.reduce((sum, shot) => sum + shot.duration, 0),
                                                      totalShots: updatedShots.length
                                                  };

                                                  onUpdate(node.id, { episodeStoryboard: updatedStoryboard });
                                                  setEditingShot(null);
                                                  setEditingShotIndex(-1);
                                              }
                                          }}
                                          className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:shadow-lg hover:shadow-indigo-500/20 rounded-lg text-sm font-bold text-white transition-all"
                                      >
                                          保存
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              );
          }

          // Default text input view
          const isCollapsed = (node.height || 360) < 100;
          return (
            <div className="w-full h-full flex flex-col group/text relative">
                <div className={`flex-1 bg-black/10 relative overflow-hidden backdrop-blur-sm transition-all ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                    {/* 折叠/展开按钮 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const currentH = node.height || 360;
                            const targetH = currentH < 100 ? 360 : 50;
                            onUpdate(node.id, {}, { height: targetH });
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors z-10"
                        title={isCollapsed ? "展开" : "折叠"}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                    <textarea
                        className="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-slate-200 placeholder-slate-500 font-medium leading-relaxed custom-scrollbar selection:bg-amber-500/30 p-4"
                        placeholder="输入您的创意构想..."
                        value={localPrompt}
                        onChange={(e) => setLocalPrompt(e.target.value)}
                        onBlur={commitPrompt}
                        onKeyDown={handleCmdEnter}
                        onWheel={(e) => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        maxLength={10000}
                        disabled={isCollapsed}
                    />
                </div>
            </div>
          );
      }
      
      if (node.type === NodeType.SCRIPT_PLANNER) {
          if (!node.data.scriptOutline) {
              return (
                 <div className="w-full h-full p-6 flex flex-col group/script">
                     <div className="flex-1 bg-black/10 rounded-2xl border border-white/5 p-4 relative overflow-hidden backdrop-blur-sm transition-colors group-hover/script:bg-black/20">
                         <textarea 
                            className="w-full h-full bg-transparent resize-none focus:outline-none text-sm text-slate-200 placeholder-slate-500 font-medium leading-relaxed custom-scrollbar selection:bg-orange-500/30 font-mono" 
                            placeholder="描述剧本核心创意..." 
                            value={localPrompt} 
                            onChange={(e) => setLocalPrompt(e.target.value)} 
                            onBlur={commitPrompt}
                            onWheel={(e) => e.stopPropagation()} 
                            onMouseDown={e => e.stopPropagation()}
                         />
                     </div>
                 </div>
              );
          } else {
              return (
                  <div className="w-full h-full flex flex-col bg-[#1c1c1e] overflow-hidden relative rounded-b-2xl">
                      <div className="absolute top-2 right-2 flex gap-1 z-20">
                          <button 
                              onClick={() => setViewingOutline(!viewingOutline)}
                              className="p-1.5 bg-black/40 border border-white/10 rounded-md text-slate-400 hover:text-white backdrop-blur-md transition-colors"
                              title={viewingOutline ? "收起大纲" : "查看完整大纲"}
                          >
                              {viewingOutline ? <List size={14} /> : <FileSearch size={14} />}
                          </button>
                      </div>

                      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-black/20">
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{node.data.scriptOutline}</pre>
                      </div>
                  </div>
              );
          }
      }

      if (node.type === NodeType.SCRIPT_EPISODE) {
          if (node.data.generatedEpisodes && node.data.generatedEpisodes.length > 0) {
              return <EpisodeViewer episodes={node.data.generatedEpisodes} />;
          }
          
          return (
              <div className="w-full h-full p-6 flex flex-col justify-center items-center gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-black/20 border border-white/5 w-full flex-1 flex flex-col items-center justify-center gap-3">
                      {isWorking ? <Loader2 size={32} className="animate-spin text-teal-500" /> : <ScrollText size={32} className="text-teal-500/50" />}
                      <span className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                          {availableChapters.length > 0
                              ? (node.data.selectedChapter ? `已选择: ${node.data.selectedChapter}` : "请在下方选择章节")
                              : "请先连接已生成大纲的剧本节点 (Planner)"}
                      </span>
                  </div>
              </div>
          );
      }
      if (node.type === NodeType.STORYBOARD_IMAGE) {
          const gridImages = node.data.storyboardGridImages || (node.data.storyboardGridImage ? [node.data.storyboardGridImage] : []);
          const currentPage = node.data.storyboardCurrentPage || 0;
          const totalPages = node.data.storyboardTotalPages || gridImages.length;
          const hasMultiplePages = gridImages.length > 1;
          const currentImage = gridImages[currentPage] || null;
          const gridType = node.data.storyboardGridType || '9';
          const shotsPerGrid = gridType === '9' ? 9 : 6;

          // Get shots data for this page
          const allShots = node.data.storyboardShots || [];
          const startIdx = currentPage * shotsPerGrid;
          const endIdx = Math.min(startIdx + shotsPerGrid, allShots.length);
          const currentPageShots = allShots.slice(startIdx, endIdx);

          // Pagination handlers
          const handlePrevPage = () => {
              if (currentPage > 0) {
                  onUpdate(node.id, { storyboardCurrentPage: currentPage - 1 });
              }
          };

          const handleNextPage = () => {
              if (currentPage < totalPages - 1) {
                  onUpdate(node.id, { storyboardCurrentPage: currentPage + 1 });
              }
          };

          // View mode: 'normal' | 'preview' | 'edit'
          const [viewMode, setViewMode] = useState<'normal' | 'preview' | 'edit'>('normal');
          const [editingShots, setEditingShots] = useState<any[]>([]);
          const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

          const handleOpenPreview = () => {
              setViewMode('preview');
          };

          const handleClosePreview = () => {
              setViewMode('normal');
          };

          const handleOpenEdit = () => {
              setEditingShots(currentPageShots.map(shot => ({
                  ...shot,
                  visualDescription: shot.visualDescription || shot.scene || ''
              })));
              setViewMode('edit');
          };

          const handleSaveEdit = () => {
              // Update all shots and trigger regeneration
              const updatedShots = [...allShots];
              editingShots.forEach((shot, idx) => {
                  updatedShots[startIdx + idx] = {
                      ...updatedShots[startIdx + idx],
                      visualDescription: shot.visualDescription
                  };
              });

              onUpdate(node.id, {
                  storyboardShots: updatedShots,
                  storyboardRegeneratePage: currentPage // Regenerate entire page
              });

              // 触发节点执行以开始重新生成
              setTimeout(() => {
                  console.log('[分镜图编辑] 触发节点重新生成');
                  onAction(node.id);
              }, 100);

              setViewMode('normal');
          };

          const handleCancelEdit = () => {
              setViewMode('normal');
          };

          const handleContextMenu = (e: React.MouseEvent) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
          };

          const handleCloseContextMenu = () => {
              setContextMenu(null);
          };

          const handleDownloadImage = async () => {
              if (!currentImage) return;

              try {
                  const response = await fetch(currentImage);
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `分镜-第${currentPage + 1}页-${Date.now()}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
              } catch (error) {
                  console.error('下载图片失败:', error);
              }

              setContextMenu(null);
          };

          return (
              <div
                  className="w-full h-full flex flex-col overflow-hidden relative bg-[#1c1c1e]"
                  onClick={handleCloseContextMenu}
              >
                  {currentImage ? (
                      <>
                          {/* Edit Mode */}
                          {viewMode === 'edit' && (
                              <div className="w-full h-full flex flex-col bg-[#1c1c1e]">
                                  {/* Header */}
                                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                              <Edit size={20} className="text-purple-300" />
                                          </div>
                                          <div>
                                              <h3 className="text-base font-bold text-white">编辑分镜描述</h3>
                                              <p className="text-xs text-slate-400">
                                                  第 {currentPage + 1} 页 · 修改后重新生成
                                              </p>
                                          </div>
                                      </div>
                                      <button
                                          onClick={handleCancelEdit}
                                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                      >
                                          <X size={20} className="text-slate-400" />
                                      </button>
                                  </div>

                                  {/* Shots List - Scrollable */}
                                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                      {editingShots.map((shot, idx) => (
                                          <div key={idx} className="bg-black/40 border border-white/10 rounded-lg p-4">
                                              <div className="flex items-start gap-3">
                                                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                                      <span className="text-sm font-bold text-purple-300">
                                                          {startIdx + idx + 1}
                                                      </span>
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                      <label className="block text-xs font-bold text-slate-400 mb-2">
                                                          分镜 {startIdx + idx + 1}
                                                      </label>
                                                      <textarea
                                                          value={shot.visualDescription}
                                                          onChange={(e) => {
                                                              const newShots = [...editingShots];
                                                              newShots[idx].visualDescription = e.target.value;
                                                              setEditingShots(newShots);
                                                          }}
                                                          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                                                          rows={3}
                                                          placeholder={`输入分镜 ${startIdx + idx + 1} 的描述...`}
                                                      />
                                                      {shot.scene && (
                                                          <div className="mt-2 text-[10px] text-slate-500">
                                                              场景: {shot.scene}
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-white/10 flex-shrink-0 bg-black/20">
                                      <button
                                          onClick={handleCancelEdit}
                                          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                                      >
                                          取消
                                      </button>
                                      <button
                                          onClick={handleSaveEdit}
                                          disabled={isActionDisabled}
                                          className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                      >
                                          {isWorking ? (
                                              <>
                                                  <Loader2 size={14} className="animate-spin" />
                                                  生成中...
                                              </>
                                          ) : (
                                              <>
                                                  <Sparkles size={14} />
                                                  重新生成
                                              </>
                                          )}
                                      </button>
                                  </div>
                              </div>
                          )}

                          {/* Preview Mode or Normal Mode */}
                          {viewMode !== 'edit' && (
                              <>
                                  {/* Image Display */}
                                  <div
                                      className={`flex-1 overflow-hidden relative flex items-center justify-center transition-all ${
                                          viewMode === 'preview' ? 'fixed inset-0 bg-black/95 z-[9999] p-8' : 'p-3'
                                      }`}
                                  >
                                      <img
                                          ref={mediaRef as any}
                                          src={currentImage}
                                          className="max-w-full max-h-full object-contain cursor-default"
                                          onContextMenu={handleContextMenu}
                                          draggable={false}
                                          alt={`Storyboard Grid - Page ${currentPage + 1}`}
                                      />

                                      {/* Preview Mode Controls */}
                                      {viewMode === 'preview' && (
                                          <>
                                              {/* Close Button - Top Left */}
                                              <button
                                                  onClick={handleClosePreview}
                                                  className="absolute top-6 left-6 p-2 bg-black/60 backdrop-blur-sm rounded-lg hover:bg-black/80 transition-colors border border-white/10"
                                                  title="关闭预览 (ESC)"
                                              >
                                                  <X size={24} className="text-white" />
                                              </button>

                                              {/* Edit Button - Top Right */}
                                              {!isWorking && (
                                                  <button
                                                      onClick={handleOpenEdit}
                                                      className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-lg hover:bg-black/80 transition-colors border border-white/10"
                                                      title="编辑分镜描述"
                                                  >
                                                      <Edit size={18} className="text-white" />
                                                      <span className="text-sm font-medium text-white">编辑</span>
                                                  </button>
                                              )}
                                          </>
                                      )}

                                      {/* Normal Mode - Preview Button */}
                                      {viewMode === 'normal' && !isWorking && (
                                          <button
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenPreview();
                                              }}
                                              className="absolute top-5 right-5 p-2 bg-black/60 backdrop-blur-sm rounded-lg hover:bg-black/80 transition-colors border border-white/10"
                                              title="查看大图"
                                          >
                                              <Maximize2 size={18} className="text-white" />
                                          </button>
                                      )}

                                      {/* Context Menu */}
                                      {contextMenu && (
                                          <div
                                              className="fixed z-[10000] bg-[#2c2c2e] border border-white/10 rounded-lg shadow-2xl min-w-[180px] overflow-hidden"
                                              style={{
                                                  left: `${contextMenu.x}px`,
                                                  top: `${contextMenu.y}px`,
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                          >
                                              <button
                                                  onClick={handleDownloadImage}
                                                  className="w-full px-4 py-3 flex items-center gap-3 text-sm text-white hover:bg-white/5 transition-colors text-left"
                                              >
                                                  <Download size={16} className="text-slate-400" />
                                                  <span>下载图片</span>
                                              </button>
                                          </div>
                                      )}
                                  </div>

                                  {/* Control Bar - Only show in normal mode */}
                                  {viewMode === 'normal' && (
                                      <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 bg-black/20">
                                          {/* Pagination Controls */}
                                          <div className="flex items-center gap-2">
                                              {hasMultiplePages && (
                                                  <>
                                                      <button
                                                          onClick={handlePrevPage}
                                                          disabled={currentPage === 0}
                                                          className={`p-1.5 rounded-lg transition-all ${
                                                              currentPage === 0
                                                                  ? 'text-slate-700 cursor-not-allowed'
                                                                  : 'text-slate-400 hover:text-white hover:bg-white/10'
                                                          }`}
                                                      >
                                                          <ChevronLeft size={16} />
                                                      </button>
                                                      <div className="flex items-center gap-1">
                                                          <span className="text-[10px] font-bold text-white">
                                                              {currentPage + 1}
                                                          </span>
                                                          <span className="text-[10px] text-slate-500">/</span>
                                                          <span className="text-[10px] text-slate-400">
                                                              {totalPages}
                                                          </span>
                                                      </div>
                                                      <button
                                                          onClick={handleNextPage}
                                                          disabled={currentPage >= totalPages - 1}
                                                          className={`p-1.5 rounded-lg transition-all ${
                                                              currentPage >= totalPages - 1
                                                                  ? 'text-slate-700 cursor-not-allowed'
                                                                  : 'text-slate-400 hover:text-white hover:bg-white/10'
                                                          }`}
                                                      >
                                                          <ChevronRight size={16} />
                                                      </button>
                                                  </>
                                              )}
                                              {!hasMultiplePages && (
                                                  <span className="text-[10px] text-slate-500">单页分镜</span>
                                              )}
                                          </div>

                                          {/* Edit Button */}
                                          {!isWorking && (
                                              <button
                                                      onClick={handleOpenEdit}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-white/10 hover:border-purple-500/30"
                                              >
                                                  <Edit size={12} />
                                                  编辑描述
                                              </button>
                                          )}
                                      </div>
                                  )}
                              </>
                          )}
                      </>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600 p-6 text-center">
                          {isWorking ? <Loader2 size={32} className="animate-spin text-purple-500" /> : <LayoutGrid size={32} className="text-purple-500/50" />}
                          <span className="text-xs font-medium">{isWorking ? "正在生成分镜网格图..." : "等待生成分镜图..."}</span>
                          {!isWorking && (
                              <div className="flex flex-col gap-1 text-[10px] text-slate-500 max-w-[220px]">
                                  <span>💡 输入分镜描述或连接剧本分集节点</span>
                                  <span>🎭 可连接角色设计节点保持角色一致性</span>
                                  <span>🎬 选择九宫格/六宫格布局</span>
                                  <span>📄 支持多页自动分页</span>
                              </div>
                          )}
                      </div>
                  )}
              </div>
          );
      }
      if (node.type === NodeType.STORYBOARD_SPLITTER) {
          const splitShots = node.data.splitShots || [];
          const isSplitting = node.data.isSplitting || false;
          const connectedStoryboardNodes = nodeQuery ? nodeQuery.getUpstreamNodes(node.id, NodeType.STORYBOARD_IMAGE) : [];

          // 过滤掉空的分镜：必须同时有画面描述和拆解图片
          const validShots = splitShots.filter((shot) => {
              return shot.visualDescription && shot.splitImage;
          });

          return (
              <div className="w-full h-full flex flex-col overflow-hidden relative bg-[#1c1c1e]">
                  {/* Content Area - Split Results List */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {validShots.length > 0 ? (
                          <div className="p-4 space-y-3">
                              {validShots.map((shot) => (
                                  <div key={shot.id} className="bg-black/40 border border-white/10 rounded-lg p-4">
                                      <div className="flex items-start gap-4">
                                          {/* Left: Image */}
                                          <div className="flex-shrink-0">
                                              <img
                                                  src={shot.splitImage}
                                                  alt={`分镜 ${shot.shotNumber}`}
                                                  className="w-[200px] rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
                                                  onClick={() => onExpand?.({
                                                      type: 'image',
                                                      src: shot.splitImage,
                                                      rect: new DOMRect(),
                                                      images: splitShots.map(s => s.splitImage),
                                                      initialIndex: shot.shotNumber - 1
                                                  })}
                                              />
                                          </div>

                                          {/* Right: Info */}
                                          <div className="flex-1 min-w-0">
                                              {/* Header */}
                                              <div className="flex items-center gap-2 mb-3">
                                                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                                      <span className="text-sm font-bold text-blue-300">
                                                          {shot.shotNumber}
                                                      </span>
                                                  </div>
                                                  <h3 className="text-base font-bold text-white">分镜 {shot.shotNumber}</h3>
                                              </div>

                                              {/* Details */}
                                              <div className="space-y-2">
                                                  {shot.scene && (
                                                      <div>
                                                          <span className="text-[10px] font-bold text-slate-500 uppercase">场景</span>
                                                          <p className="text-xs text-slate-300">{shot.scene}</p>
                                                      </div>
                                                  )}

                                                  {shot.characters && shot.characters.length > 0 && (
                                                      <div>
                                                          <span className="text-[10px] font-bold text-slate-500 uppercase">角色</span>
                                                          <p className="text-xs text-slate-300">{shot.characters.join(', ')}</p>
                                                      </div>
                                                  )}

                                                  {shot.visualDescription && (
                                                      <div>
                                                          <span className="text-[10px] font-bold text-slate-500 uppercase">画面</span>
                                                          <p className="text-xs text-slate-300">{shot.visualDescription}</p>
                                                      </div>
                                                  )}

                                                  {shot.dialogue && (
                                                      <div>
                                                          <span className="text-[10px] font-bold text-slate-500 uppercase">对话</span>
                                                          <p className="text-xs text-slate-300">{shot.dialogue}</p>
                                                      </div>
                                                  )}

                                                  <div className="grid grid-cols-2 gap-2">
                                                      {shot.shotSize && (
                                                          <div>
                                                              <span className="text-[10px] font-bold text-slate-500 uppercase">景别</span>
                                                              <p className="text-xs text-slate-300">{shot.shotSize}</p>
                                                          </div>
                                                      )}
                                                      {shot.cameraAngle && (
                                                          <div>
                                                              <span className="text-[10px] font-bold text-slate-500 uppercase">拍摄角度</span>
                                                              <p className="text-xs text-slate-300">{shot.cameraAngle}</p>
                                                          </div>
                                                  )}
                                                  </div>

                                                  <div className="grid grid-cols-2 gap-2">
                                                      {shot.cameraMovement && (
                                                          <div>
                                                              <span className="text-[10px] font-bold text-slate-500 uppercase">运镜方式</span>
                                                              <p className="text-xs text-slate-300">{shot.cameraMovement}</p>
                                                          </div>
                                                      )}
                                                      {shot.duration && (
                                                          <div>
                                                              <span className="text-[10px] font-bold text-slate-500 uppercase">时长</span>
                                                              <p className="text-xs text-slate-300">{shot.duration}s</p>
                                                          </div>
                                                  )}
                                                  </div>

                                                  {shot.visualEffects && (
                                                      <div>
                                                          <span className="text-[10px] font-bold text-slate-500 uppercase">视觉特效</span>
                                                          <p className="text-xs text-slate-300">{shot.visualEffects}</p>
                                                      </div>
                                                  )}

                                                  {shot.audioEffects && (
                                                      <div>
                                                          <span className="text-[10px] font-bold text-slate-500 uppercase">音效</span>
                                                          <p className="text-xs text-slate-300">{shot.audioEffects}</p>
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 p-6 text-center">
                              {isSplitting ? (
                                  <Loader2 size={32} className="animate-spin text-blue-500" />
                              ) : splitShots.length > 0 && validShots.length === 0 ? (
                                  // 有分镜但全部被过滤（都是空的）
                                  <>
                                      <AlertCircle size={32} className="text-orange-500/50" />
                                      <span className="text-xs font-medium">所有分镜内容为空，无法展示</span>
                                      <div className="flex flex-col gap-1 text-[10px] text-slate-500 max-w-[260px]">
                                          <span>💡 分镜缺少画面描述或拆解图片</span>
                                          <span>✂️ 请重新生成分镜图并确保内容完整</span>
                                      </div>
                                  </>
                              ) : (
                                  <>
                                      <Grid size={32} className="text-blue-500/50" />
                                      <span className="text-xs font-medium">
                                          {isSplitting ? "正在切割分镜图..." : "等待切割分镜图..."}
                                      </span>
                                      {!isSplitting && connectedStoryboardNodes.length === 0 && (
                                          <div className="flex flex-col gap-1 text-[10px] text-slate-500 max-w-[220px]">
                                              <span>💡 连接分镜图设计节点</span>
                                              <span>✂️ 鼠标移入底部面板选择要切割的图片</span>
                                              <span>📦 切割后可导出图片包</span>
                                          </div>
                                      )}
                                  </>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          );
      }
      if (node.type === NodeType.STORYBOARD_GENERATOR) {
          const shots = node.data.storyboardShots || [];
          return (
              <div className="w-full h-full flex flex-col overflow-hidden relative">
                  {shots.length > 0 ? (
                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                          {shots.map((shot, idx) => (
                              <div key={shot.id} className="flex gap-3 p-2 rounded-xl bg-black/20 border border-white/5 group hover:bg-black/40 transition-colors">
                                  {/* Shot Image */}
                                  <div className="w-24 h-24 shrink-0 rounded-lg bg-black/50 overflow-hidden relative border border-white/10">
                                      {shot.imageUrl ? (
                                          <img src={shot.imageUrl} className="w-full h-full object-cover" onClick={() => onExpand?.({ type: 'image', src: shot.imageUrl!, rect: new DOMRect(), images: shots.filter(s=>s.imageUrl).map(s=>s.imageUrl!), initialIndex: idx })} />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                              <Loader2 className="animate-spin text-slate-600" size={16} />
                                          </div>
                                      )}
                                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 backdrop-blur rounded text-[8px] font-bold text-white/80">
                                          Shot {idx + 1}
                                      </div>
                                  </div>
                                  
                                  {/* Shot Details */}
                                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                                      <div className="flex items-start justify-between">
                                          <span className="text-[10px] font-bold text-indigo-300 truncate">{shot.subject}</span>
                                          <span className="text-[9px] font-mono text-slate-500">{shot.duration}s</span>
                                      </div>
                                      <div className="text-[9px] text-slate-400 line-clamp-2 leading-relaxed">
                                          <span className="text-slate-500">运镜: </span>{shot.camera}
                                      </div>
                                      <div className="text-[9px] text-slate-400 line-clamp-2 leading-relaxed">
                                          <span className="text-slate-500">场景: </span>{shot.scene}
                                      </div>
                                      <div className="mt-auto flex gap-2">
                                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] text-slate-500">{shot.lighting}</span>
                                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] text-slate-500">{shot.style}</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600 p-6 text-center">
                          {isWorking ? <Loader2 size={32} className="animate-spin text-indigo-500" /> : <Clapperboard size={32} className="text-indigo-500/50" />}
                          <span className="text-xs font-medium">{isWorking ? "正在规划分镜并绘制..." : "等待生成分镜..."}</span>
                          {!isWorking && <span className="text-[10px] text-slate-500 max-w-[200px]">连接分集脚本节点，设置数量与时长，点击生成开始创作。</span>}
                      </div>
                  )}
              </div>
          );
      }
      
      // --- CHARACTER NODE CONTENT ---
      if (node.type === NodeType.CHARACTER_NODE) {
          const names = node.data.extractedCharacterNames || [];
          const configs = node.data.characterConfigs || {};
          const generated = node.data.generatedCharacters || [];

          return (
              <div className="w-full h-full flex flex-col overflow-hidden relative">
                  {/* Top: List of Characters */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                      {names.length === 0 && !isWorking ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                              <User size={32} className="opacity-50" />
                              <span className="text-xs">等待提取角色...</span>
                              <span className="text-[10px]">请连接剧本节点</span>
                              <span className="text-[9px] text-slate-600 mt-2">💡 支持连接多个节点自动去重</span>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {/* Show input source count */}
                              {node.inputs.length > 1 && (
                                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 flex items-center gap-2">
                                      <div className="flex items-center gap-1.5">
                                          <User size={12} className="text-orange-400" />
                                          <span className="text-[10px] text-orange-300 font-bold">{names.length} 个角色</span>
                                      </div>
                                      <span className="text-[9px] text-slate-400">来自 {node.inputs.length} 个输入节点</span>
                                  </div>
                              )}
                              {names.map((name, idx) => {
                                  const config = configs[name] || { method: 'AI_AUTO' };
                                  const profile = generated.find(p => p.name === name);
                                  const isProcessing = profile?.status === 'GENERATING';
                                  const isFailed = profile?.status === 'ERROR';
                                  const isSaved = profile?.isSaved;

                                  // Debug log
                                  if (profile) {
                                      console.log('[Node CHARACTER_NODE] Rendering character:', {
                                          name,
                                          status: profile.status,
                                          isProcessing,
                                          isFailed,
                                          shouldShowCard: !isProcessing && !isFailed,
                                          hasProfession: !!profile.profession,
                                          hasPersonality: !!profile.personality,
                                          hasExpressionSheet: !!profile.expressionSheet,
                                          hasThreeViewSheet: !!profile.threeViewSheet,
                                          expressionLength: profile.expressionSheet?.length || 0,
                                          threeViewLength: profile.threeViewSheet?.length || 0
                                      });
                                  }

                                  return (
                                      <div key={idx} className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2 group/char hover:border-white/20 transition-all">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold">{idx + 1}</div>
                                                  <span className="font-bold text-sm text-slate-200">{name}</span>
                                              </div>

                                              <div className="flex items-center gap-2">
                                                  {!profile && !isProcessing && (
                                                      <select
                                                          className="bg-black/40 border border-white/10 rounded-lg text-[10px] text-slate-300 px-2 py-1 outline-none"
                                                          value={config.method}
                                                          onChange={(e) => {
                                                              const newConfigs = { ...configs, [name]: { ...config, method: e.target.value as any } };
                                                              onUpdate(node.id, { characterConfigs: newConfigs });
                                                          }}
                                                          onClick={e => e.stopPropagation()}
                                                      >
                                                          <option value="AI_AUTO">主角 (完整)</option>
                                                          <option value="SUPPORTING_ROLE">配角 (简化)</option>
                                                          <option value="AI_CUSTOM">补充描述</option>
                                                          <option value="LIBRARY">角色库</option>
                                                      </select>
                                                  )}

                                                  {!profile ? (
                                                      isProcessing ? (
                                                          <button
                                                              disabled
                                                              className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-300/50 text-[10px] font-bold rounded cursor-not-allowed"
                                                          >
                                                              <Loader2 size={10} className="animate-spin" />
                                                              生成中
                                                          </button>
                                                      ) : (
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'GENERATE_SINGLE', name); }}
                                                              className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-[10px] font-bold rounded transition-all"
                                                          >
                                                              <Sparkles size={10} />
                                                              生成
                                                          </button>
                                                      )
                                                  ) : null}

                                                  <button
                                                      onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'DELETE', name); }}
                                                      disabled={isProcessing}
                                                      className={`p-1 rounded-full transition-colors ${isProcessing ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10 text-slate-500 hover:text-red-400'}`}
                                                  >
                                                      <X size={12} />
                                                  </button>
                                              </div>
                                          </div>

                                          {config.method === 'AI_CUSTOM' && !profile && (
                                              <textarea
                                                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-slate-300 outline-none resize-none h-16 custom-scrollbar disabled:opacity-50"
                                                  placeholder="输入外貌、性格等补充描述..."
                                                  value={config.customPrompt || ''}
                                                  onChange={(e) => {
                                                      const newConfigs = { ...configs, [name]: { ...config, customPrompt: e.target.value } };
                                                      onUpdate(node.id, { characterConfigs: newConfigs });
                                                  }}
                                                  disabled={isProcessing}
                                              />
                                          )}

                                          {isProcessing && (
                                              <div className="bg-[#18181b] rounded-lg p-3 border border-white/5 flex items-center justify-center gap-2">
                                                  <Loader2 size={12} className="animate-spin text-orange-400" />
                                                  <span className="text-[10px] text-slate-400">
                                                      {profile?.isGeneratingThreeView ? '正在生成三视图...' :
                                                       profile?.isGeneratingExpression ? '正在生成九宫格表情...' :
                                                       !profile?.expressionSheet ? '正在生成角色档案...' :
                                                       '正在生成中...'}
                                                  </span>
                                              </div>
                                          )}

                                          {isFailed && (
                                              <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/20 flex flex-col gap-2">
                                                  <div className="flex items-center gap-2 text-red-300 text-[10px]">
                                                      <AlertCircle size={12} />
                                                      <span>生成失败</span>
                                                  </div>
                                                  <button 
                                                      onClick={() => onCharacterAction?.(node.id, 'RETRY', name)}
                                                      className="w-full py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[10px] rounded"
                                                  >
                                                      重试
                                                  </button>
                                              </div>
                                          )}

                                          {profile && !isProcessing && !isFailed && (
                                              <div className="bg-[#18181b] rounded-lg p-2 border border-white/5 flex flex-col gap-2 animate-in fade-in cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onViewCharacter?.(profile)}>
                                                  <div className="flex gap-3">
                                                      <div className="w-16 h-16 shrink-0 bg-black rounded-md overflow-hidden relative">
                                                          {profile.threeViewSheet ? (
                                                              <img src={profile.threeViewSheet} className="w-full h-full object-cover" />
                                                          ) : profile.expressionSheet ? (
                                                              <img src={profile.expressionSheet} className="w-full h-full object-cover" />
                                                          ) : (
                                                              <div className="w-full h-full bg-black flex items-center justify-center">
                                                                  <User className="w-8 h-8 text-slate-700 opacity-30" />
                                                              </div>
                                                          )}
                                                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/char:opacity-100 transition-opacity">
                                                              <Eye size={16} className="text-white drop-shadow-md" />
                                                          </div>
                                                      </div>
                                                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                          <div className="text-[10px] text-orange-300 font-bold">{profile.profession || '未知职业'}</div>
                                                          <div className="text-[9px] text-slate-400 line-clamp-3 leading-relaxed">{profile.personality || '无性格描述'}</div>
                                                      </div>
                                                  </div>

                                                  {/* 根据生成状态显示不同的按钮 */}
                                                  {!profile.expressionSheet && !profile.threeViewSheet && (
                                                      <div className="flex items-center gap-2 mt-1">
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'GENERATE_EXPRESSION', name); }}
                                                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 transition-all"
                                                          >
                                                              <Sparkles size={10} /> 生成九宫格
                                                          </button>
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); alert('请先生成九宫格表情图'); }}
                                                              disabled
                                                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold bg-white/5 text-slate-600 cursor-not-allowed"
                                                          >
                                                              <Layers size={10} /> 生成三视图
                                                          </button>
                                                      </div>
                                                  )}

                                                  {profile.expressionSheet && !profile.threeViewSheet && (
                                                      <div className="flex items-center gap-2 mt-1">
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'GENERATE_THREE_VIEW', name); }}
                                                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-all"
                                                          >
                                                              <Layers size={10} /> 生成三视图
                                                          </button>
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'RETRY', name); }}
                                                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                                                          >
                                                              <RotateCcw size={10} /> 重新生成
                                                          </button>
                                                      </div>
                                                  )}

                                                  {profile.expressionSheet && profile.threeViewSheet && (
                                                      <div className="flex items-center gap-2 mt-1">
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'SAVE', name); }}
                                                              disabled={isSaved}
                                                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold transition-all ${isSaved ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'}`}
                                                          >
                                                              {isSaved ? <CheckCircle size={10} /> : <Save size={10} />}
                                                              {isSaved ? '已保存' : '保存'}
                                                          </button>
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'RETRY', name); }}
                                                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                                                          >
                                                              <RotateCcw size={10} /> 重新生成
                                                          </button>
                                                      </div>
                                                  )}
                                              </div>
                                          )}

                                          {/* Prompt Editor - only show when profile exists and has prompts */}
                                          {profile && !isProcessing && !isFailed && (
                                              <PromptEditor
                                                  nodeId={node.id}
                                                  charName={name}
                                                  expressionPromptZh={profile.expressionPromptZh || promptManager.getDefaultPrompts().expressionPrompt.zh}
                                                  expressionPromptEn={profile.expressionPromptEn || promptManager.getDefaultPrompts().expressionPrompt.en}
                                                  threeViewPromptZh={profile.threeViewPromptZh || promptManager.getDefaultPrompts().threeViewPrompt.zh}
                                                  threeViewPromptEn={profile.threeViewPromptEn || promptManager.getDefaultPrompts().threeViewPrompt.en}
                                                  hasExpressionSheet={!!profile.expressionSheet}
                                                  hasThreeViewSheet={!!profile.threeViewSheet}
                                                  onRegenerateExpression={(customPrompt) => {
                                                      onCharacterAction?.(node.id, 'GENERATE_EXPRESSION', name, { expressionPrompt: customPrompt });
                                                  }}
                                                  onRegenerateThreeView={(customPrompt) => {
                                                      onCharacterAction?.(node.id, 'GENERATE_THREE_VIEW', name, { threeViewPrompt: customPrompt });
                                                  }}
                                              />
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          );
      }

      // --- STYLE PRESET NODE CONTENT ---
      if (node.type === NodeType.STYLE_PRESET) {
          const stylePrompt = node.data.stylePrompt || '';
          const negativePrompt = node.data.negativePrompt || '';
          const visualStyle = node.data.visualStyle || 'ANIME';
          const characterCount = stylePrompt.length;

          return (
              <div className="w-full h-full flex flex-col overflow-hidden relative">
                  {/* Top: Generated Style Prompt */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                      {!stylePrompt && !isWorking ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                              <Palette size={32} className="opacity-50" />
                              <span className="text-xs">等待生成风格提示词...</span>
                              <span className="text-[10px]">配置参数后点击生成</span>
                          </div>
                      ) : (
                          <>
                              {/* Style Prompt Display */}
                              <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                          <Palette size={14} className="text-purple-400" />
                                          <span className="text-xs text-slate-300 font-bold">风格提示词</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                                              visualStyle === 'REAL' ? 'bg-blue-500/20 text-blue-300' :
                                              visualStyle === 'ANIME' ? 'bg-pink-500/20 text-pink-300' :
                                              'bg-green-500/20 text-green-300'
                                          }`}>{visualStyle}</span>
                                          <span className="text-[9px] text-slate-500">{characterCount} 字符</span>
                                          {stylePrompt && (
                                              <button
                                                  onClick={() => navigator.clipboard.writeText(stylePrompt)}
                                                  className="p-1 rounded hover:bg-white/10 transition-colors"
                                                  title="复制"
                                              >
                                                  <Copy size={10} className="text-slate-400" />
                                              </button>
                                          )}
                                      </div>
                                  </div>
                                  <textarea
                                      className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-slate-300 font-mono leading-relaxed resize-none h-32 custom-scrollbar"
                                      placeholder="生成的风格提示词将显示在这里..."
                                      value={stylePrompt}
                                      onChange={(e) => onUpdate(node.id, { stylePrompt: e.target.value })}
                                      onMouseDown={e => e.stopPropagation()}
                                      spellCheck={false}
                                  />
                              </div>

                              {/* Negative Prompt Display (Collapsible) */}
                              {negativePrompt && (
                                  <details className="bg-black/10 border border-white/5 rounded-xl overflow-hidden">
                                      <summary className="px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between text-[10px] text-slate-400">
                                          <span>负面提示词 (Negative Prompt)</span>
                                          <ChevronDown size={12} />
                                      </summary>
                                      <div className="p-3 pt-0">
                                          <div className="bg-black/40 border border-white/10 rounded-lg p-2">
                                              <div className="text-[9px] text-slate-400 font-mono leading-relaxed">{negativePrompt}</div>
                                          </div>
                                      </div>
                                  </details>
                              )}
                          </>
                      )}
                  </div>

                  {isWorking && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                          <Loader2 className="animate-spin text-purple-400" />
                      </div>
                  )}
              </div>
          );
      }

      if (node.type === NodeType.VIDEO_ANALYZER) {
          return (
            <div className="w-full h-full p-5 flex flex-col gap-3">
                 <div className="relative w-full h-32 rounded-xl bg-black/20 border border-white/5 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-black/30 transition-colors group/upload" onClick={() => !node.data.videoUri && fileInputRef.current?.click()}>
                    {videoBlobUrl ? <video src={videoBlobUrl} className="w-full h-full object-cover opacity-80" muted onMouseEnter={safePlay} onMouseLeave={safePause} onClick={handleExpand} /> : <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:upload:text-slate-300"><Upload size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">上传视频</span></div>}
                    {node.data.videoUri && <button className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-slate-400 hover:text-white backdrop-blur-md" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><Edit size={10} /></button>}
                    <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleUploadVideo} />
                 </div>
                 <div className="flex-1 bg-black/10 rounded-xl border border-white/5 overflow-hidden relative group/analysis">
                    <textarea className="w-full h-full bg-transparent p-3 resize-none focus:outline-none text-xs text-slate-300 font-mono leading-relaxed custom-scrollbar select-text placeholder:italic placeholder:text-slate-600" value={node.data.analysis || ''} placeholder="等待分析结果，或在此粘贴文本..." onChange={(e) => onUpdate(node.id, { analysis: e.target.value })} onWheel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} spellCheck={false} />
                    {node.data.analysis && <button className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-md text-slate-400 hover:text-white transition-all opacity-0 group-hover/analysis:opacity-100 backdrop-blur-md z-10" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(node.data.analysis || ''); }} title="复制全部"><Copy size={12} /></button>}
                 </div>
                 {isWorking && <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10"><Loader2 className="animate-spin text-emerald-400" /></div>}
            </div>
          )
      }
      if (node.type === NodeType.AUDIO_GENERATOR) {
          return (
              <div className="w-full h-full p-6 flex flex-col justify-center items-center relative overflow-hidden group/audio">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-900/10 z-0"></div>
                  {node.data.audioUri ? (
                      <div className="flex flex-col items-center gap-4 w-full z-10">
                          <audio ref={mediaRef as any} src={node.data.audioUri} onEnded={() => setIsPlayingAudio(false)} onPlay={() => setIsPlayingAudio(true)} onPause={() => setIsPlayingAudio(false)} className="hidden" />
                          <div className="w-full px-4"><AudioVisualizer isPlaying={isPlayingAudio} /></div>
                          <div className="flex items-center gap-4"><button onClick={toggleAudio} className="w-12 h-12 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/50 flex items-center justify-center transition-all hover:scale-105">{isPlayingAudio ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-1" />}</button></div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-600 z-10 select-none">{isWorking ? <Loader2 size={32} className="animate-spin text-pink-500" /> : <Mic2 size={32} className="text-slate-500" />}<span className="text-[10px] font-bold uppercase tracking-widest">{isWorking ? '生成中...' : '准备生成'}</span></div>
                  )}
                  {node.status === NodeStatus.ERROR && <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"><AlertCircle className="text-red-500 mb-2" /><span className="text-xs text-red-200">{node.data.error}</span></div>}
              </div>
          )
      }
      
      if (node.type === NodeType.IMAGE_EDITOR) {
          return (
              <div className="w-full h-full p-0 flex flex-col relative group/edit">
                  {node.data.image ? (
                      <div className="relative flex-1 overflow-hidden bg-[#09090b]">
                          <img src={node.data.image} className="w-full h-full object-contain" onClick={handleExpand} />
                          <button className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-500/80 transition-colors" onClick={() => onUpdate(node.id, { image: undefined })}><X size={14} /></button>
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 bg-[#1c1c1e]" onClick={() => fileInputRef.current?.click()}>
                          <Upload size={24} />
                          <span className="text-xs">上传图片或使用画板</span>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadImage} />
                      </div>
                  )}
                  <div className="h-14 border-t border-white/5 bg-[#1c1c1e] p-2 flex items-center gap-2">
                        <input className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none" placeholder="编辑指令..." value={localPrompt} onChange={e => setLocalPrompt(e.target.value)} onKeyDown={handleCmdEnter} onBlur={commitPrompt} />
                        <button className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors shadow-sm" onClick={handleActionClick}><Wand2 size={14} /></button>
                  </div>
              </div>
          )
      }

      if (node.type === NodeType.DRAMA_ANALYZER) {
          const analysisFields = [
              { key: 'dramaIntroduction', label: '剧集介绍', icon: Film },
              { key: 'worldview', label: '世界观分析', icon: LayoutGrid },
              { key: 'logicalConsistency', label: '逻辑自洽性', icon: CheckCircle },
              { key: 'extensibility', label: '延展性分析', icon: Layers },
              { key: 'characterTags', label: '角色标签', icon: Users },
              { key: 'protagonistArc', label: '主角弧光', icon: User },
              { key: 'audienceResonance', label: '受众共鸣点', icon: Eye },
              { key: 'artStyle', label: '画风分析', icon: ImageIcon }
          ];

          const selectedFields = node.data.selectedFields || [];
          const hasAnalysis = node.data.dramaIntroduction || node.data.worldview;

          return (
              <div className="w-full h-full flex flex-col bg-[#1c1c1e] relative overflow-hidden">
                  {/* Analysis results display area */}
                  {hasAnalysis ? (
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                          {analysisFields.map(({ key, label, icon: Icon }) => {
                              const value = node.data[key as keyof typeof node.data] as string || '';
                              const isSelected = selectedFields.includes(key);

                              return (
                                  <div key={key} className="bg-black/20 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
                                      {/* Field Header with Checkbox */}
                                      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/5">
                                          <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                  const newSelected = e.target.checked
                                                      ? [...selectedFields, key]
                                                      : selectedFields.filter(f => f !== key);
                                                  onUpdate(node.id, { selectedFields: newSelected });
                                              }}
                                              className="w-3.5 h-3.5 rounded border-white/20 bg-black/20 checked:bg-violet-500 cursor-pointer"
                                              onMouseDown={e => e.stopPropagation()}
                                          />
                                          <Icon size={12} className="text-violet-400" />
                                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{label}</span>
                                          {isSelected && (
                                              <div className="ml-auto px-1.5 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded text-[8px] text-violet-300 font-bold">
                                                  已选择
                                              </div>
                                          )}
                                      </div>

                                      {/* Field Content */}
                                      <textarea
                                          className="w-full bg-transparent p-3 text-[11px] text-slate-300 leading-relaxed resize-none focus:outline-none custom-scrollbar"
                                          style={{ minHeight: '80px' }}
                                          value={value}
                                          onChange={(e) => onUpdate(node.id, { [key]: e.target.value })}
                                          placeholder={`等待${label}...`}
                                          onMouseDown={e => e.stopPropagation()}
                                          onWheel={e => e.stopPropagation()}
                                      />
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600 p-6 text-center">
                          {isWorking ? (
                              <>
                                  <Loader2 size={32} className="animate-spin text-violet-500" />
                                  <span className="text-xs font-medium">正在分析剧目...</span>
                              </>
                          ) : (
                              <>
                                  <Film size={32} className="text-violet-500/50" />
                                  <span className="text-xs font-medium">输入剧名并点击分析</span>
                                  <span className="text-[10px] text-slate-500 max-w-[280px] leading-relaxed">
                                      AI将从世界观、逻辑自洽性、延展性、角色标签、主角弧光、受众共鸣点和画风等多维度深度分析剧集的IP潜力
                                  </span>
                              </>
                          )}
                      </div>
                  )}

                  {node.status === NodeStatus.ERROR && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                          <AlertCircle className="text-red-500 mb-2" />
                          <span className="text-xs text-red-200">{node.data.error}</span>
                      </div>
                  )}
              </div>
          );
      }

      // DRAMA_REFINED Node Rendering
      if (node.type === NodeType.DRAMA_REFINED) {
          const refinedData = node.data.refinedContent || {};

          // Helper function to get category labels in Chinese
          const getCategoryLabel = (category: string) => {
              const labels: Record<string, string> = {
                  // 剧目分析的原始字段
                  dramaIntroduction: '剧集介绍',
                  worldview: '世界观分析',
                  logicalConsistency: '逻辑自洽性',
                  extensibility: '延展性分析',
                  characterTags: '角色标签',
                  protagonistArc: '主角弧光',
                  audienceResonance: '受众共鸣点',
                  artStyle: '画风分析',
                  // 兼容旧的固定类别（如果有）
                  audience: '受众与共鸣',
                  theme: '核心主题',
                  tone: '情感基调',
                  characters: '角色特征',
                  visual: '视觉风格'
              };
              return labels[category] || category;
          };

          return (
              <div className="w-full h-full flex flex-col bg-[#1c1c1e] relative overflow-hidden">
                  {/* Tags Grid */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                      {Object.keys(refinedData).length > 0 ? (
                          Object.entries(refinedData).map(([category, tags]) => (
                              <div key={category} className="space-y-2">
                                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                                      {getCategoryLabel(category)}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                      {(tags as string[]).map((tag, idx) => (
                                          <div
                                              key={idx}
                                              className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-md text-[10px] text-cyan-300 font-medium hover:bg-cyan-500/20 transition-colors"
                                          >
                                              {tag}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ))
                      ) : (
                          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600 p-6 text-center">
                              {isWorking ? (
                                  <>
                                      <Loader2 size={32} className="animate-spin text-cyan-500" />
                                      <span className="text-xs font-medium">正在提取精炼信息...</span>
                                  </>
                              ) : (
                                  <>
                                      <Sparkles size={32} className="text-cyan-500/50" />
                                      <span className="text-xs font-medium">等待精炼数据</span>
                                      <span className="text-[10px] text-slate-500 max-w-[280px] leading-relaxed">
                                          从剧目分析节点提取精炼标签
                                      </span>
                                  </>
                              )}
                          </div>
                      )}
                  </div>

                  {/* Footer Info */}
                  <div className="px-4 py-2 border-t border-white/5 bg-white/5 shrink-0">
                      <div className="text-[9px] text-slate-500">
                          💡 此节点可连接到"剧本大纲"作为创作辅助信息
                      </div>
                  </div>

                  {node.status === NodeStatus.ERROR && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                          <AlertCircle className="text-red-500 mb-2" />
                          <span className="text-xs text-red-200">{node.data.error}</span>
                      </div>
                  )}
              </div>
          );
      }

      // --- SORA VIDEO GENERATOR (PARENT NODE) CONTENT ---
      if (node.type === NodeType.SORA_VIDEO_GENERATOR) {
          const taskGroups = node.data.taskGroups || [];

          return (
              <div className="w-full h-full flex flex-col bg-zinc-900 overflow-hidden">
                  {/* Task Groups List */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                      {taskGroups.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-600">
                              <Wand2 size={32} className="opacity-50" />
                              <span className="text-xs font-medium">等待生成分组</span>
                              <span className="text-[10px] text-slate-500 text-center max-w-[280px]">
                                  连接分镜图拆解节点后点击"开始生成"
                              </span>
                          </div>
                      ) : (
                          <div className="flex flex-col gap-3">
                              {taskGroups.map((tg: any, index: number) => (
                                  <div
                                      key={tg.id}
                                      className={`rounded-lg border overflow-hidden transition-all ${
                                          tg.generationStatus === 'completed'
                                              ? 'bg-green-500/10 border-green-500/30'
                                              : tg.generationStatus === 'generating' || tg.generationStatus === 'uploading'
                                              ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-border-glow'
                                              : tg.generationStatus === 'failed'
                                              ? 'bg-red-500/10 border-red-500/30'
                                              : 'bg-white/5 border-white/10'
                                      }`}
                                  >
                                      {/* Header */}
                                      <div className="flex items-center justify-between px-3 py-2 bg-black/20 border-b border-white/5">
                                          <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-white">
                                                  任务组 {tg.taskNumber}
                                              </span>
                                              <span className="text-[9px] text-slate-400">
                                                  {tg.totalDuration.toFixed(1)}秒 · {tg.shotIds.length}个镜头
                                              </span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                              {/* Sora2 Config Button */}
                                              <button
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      const currentConfig = tg.sora2Config || { aspect_ratio: '16:9', duration: '10', hd: true };
                                                      const newConfig = { ...currentConfig, aspect_ratio: currentConfig.aspect_ratio === '16:9' ? '9:16' : '16:9' };
                                                      onUpdate(node.id, {
                                                          taskGroups: taskGroups.map((t: any, i: number) =>
                                                              i === index ? { ...t, sora2Config: newConfig } : t
                                                          )
                                                      });
                                                  }}
                                                  className="px-1.5 py-0.5 bg-slate-600 hover:bg-slate-500 text-white text-[8px] rounded transition-colors"
                                                  title="切换横/竖屏"
                                              >
                                                  📐
                                              </button>

                                              {/* Duration Toggle */}
                                              <button
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      const durations = ['10', '15', '25'];
                                                      const currentIndex = durations.indexOf(tg.sora2Config?.duration || '10');
                                                      const nextDuration = durations[(currentIndex + 1) % 3];
                                                      const baseConfig = { aspect_ratio: '16:9', duration: '10', hd: true };
                                                      const newConfig = { ...baseConfig, ...tg.sora2Config, duration: nextDuration };
                                                      onUpdate(node.id, {
                                                          taskGroups: taskGroups.map((t: any, i: number) =>
                                                              i === index ? { ...t, sora2Config: newConfig } : t
                                                          )
                                                      });
                                                  }}
                                                  className="px-1.5 py-0.5 bg-slate-600 hover:bg-slate-500 text-white text-[8px] rounded transition-colors"
                                                  title={`切换时长: ${tg.sora2Config?.duration || '10'}s`}
                                              >
                                                  ⏱️
                                              </button>

                                              {/* HD Toggle */}
                                              <button
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      const newConfig = tg.sora2Config || { aspect_ratio: '16:9', duration: '10', hd: true };
                                                      newConfig.hd = !newConfig.hd;
                                                      onUpdate(node.id, {
                                                          taskGroups: taskGroups.map((t: any, i: number) =>
                                                              i === index ? { ...t, sora2Config: newConfig } : t
                                                          )
                                                      });
                                                  }}
                                                  className={`px-1.5 py-0.5 text-white text-[8px] rounded transition-colors ${
                                                      (tg.sora2Config?.hd ?? true) ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-600 hover:bg-slate-500'
                                                  }`}
                                                  title={`高清: ${tg.sora2Config?.hd ?? true ? '开启' : '关闭'}`}
                                              >
                                                  🎬
                                              </button>

                                              {/* Generate Video Button */}
                                              <button
                                                  onClick={() => onAction?.(node.id, `generate-video:${index}`)}
                                                  disabled={tg.generationStatus === 'generating' || tg.generationStatus === 'uploading'}
                                                  className="px-2 py-0.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-[9px] rounded font-medium transition-colors"
                                                  title="单独生成此任务组的视频"
                                              >
                                                  {tg.generationStatus === 'generating' || tg.generationStatus === 'uploading' ? '生成中...' : '生成视频'}
                                              </button>

                                              {/* Stop Generation Button (only show when generating) */}
                                              {(tg.generationStatus === 'generating' || tg.generationStatus === 'uploading') && (
                                                  <button
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (confirm('确定要停止生成吗？任务将被终止。')) {
                                                              onUpdate(node.id, {
                                                                  taskGroups: taskGroups.map((t: any, i: number) =>
                                                                      i === index ? { ...t, generationStatus: 'failed' as const, error: '用户已停止生成' } : t
                                                                  )
                                                              });
                                                          }
                                                      }}
                                                      className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-[9px] rounded font-medium transition-colors"
                                                      title="停止生成此任务"
                                                  >
                                                      结束
                                                  </button>
                                              )}

                                              {/* Status Badge */}
                                              {tg.generationStatus === 'completed' && (
                                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-[9px] rounded-full font-medium">
                                                      完成
                                                  </span>
                                              )}
                                              {tg.generationStatus === 'generating' && (
                                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[9px] rounded-full font-medium">
                                                      {tg.progress || 0}%
                                                  </span>
                                              )}
                                              {tg.generationStatus === 'failed' && (
                                                  <div className="flex flex-col gap-1">
                                                      <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-[9px] rounded-full font-medium">
                                                          失败
                                                      </span>
                                                      {tg.error && (
                                                          <span className="text-[8px] text-red-400 max-w-[150px] truncate" title={typeof tg.error === 'object' ? JSON.stringify(tg.error) : String(tg.error)}>
                                                              {typeof tg.error === 'object' ? JSON.stringify(tg.error) : String(tg.error)}
                                                          </span>
                                                      )}
                                                  </div>
                                              )}
                                          </div>
                                      </div>

                                      {/* Two Column Layout */}
                                      <div className="flex gap-3 p-3">
                                          {/* Left: Storyboard Info */}
                                          <div className="flex-1 space-y-2">
                                              <div className="text-[10px] font-bold text-slate-400">分镜信息</div>

                                              {/* Shots Grid */}
                                              {tg.splitShots && tg.splitShots.length > 0 && (
                                                  <div className="grid grid-cols-3 gap-1.5">
                                                      {tg.splitShots.slice(0, 6).map((shot: any) => (
                                                          <div key={shot.id} className="relative group/shot">
                                                              <img
                                                                  src={shot.splitImage}
                                                                  alt={`Shot ${shot.shotNumber}`}
                                                                  className="w-full aspect-video object-cover rounded border border-white/10 cursor-pointer hover:border-cyan-500/50 transition-all"
                                                                  onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      // 可以添加点击查看大图的功能
                                                                  }}
                                                              />
                                                              <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/80 to-transparent">
                                                                  <span className="text-[8px] text-white/90">#{shot.shotNumber}</span>
                                                              </div>
                                                          </div>
                                                      ))}
                                                      {tg.splitShots.length > 6 && (
                                                          <div className="flex items-center justify-center aspect-video bg-black/30 rounded border border-white/10 text-[8px] text-slate-500">
                                                              +{tg.splitShots.length - 6}
                                                          </div>
                                                      )}
                                                  </div>
                                              )}

                                              {/* Overall Description */}
                                              {tg.splitShots && tg.splitShots.length > 0 && (
                                                  <div className="space-y-1">
                                                      <div className="text-[8px] text-slate-500">分镜概述</div>
                                                      <div className="text-[9px] text-slate-300 line-clamp-3">
                                                          {tg.splitShots.map((s: any) => s.visualDescription).join('；')}
                                                      </div>
                                                  </div>
                                              )}

                                              {/* Image Fusion Info */}
                                              {tg.splitShots && tg.splitShots.length > 0 && (
                                                  <div className="mt-3 space-y-1.5 p-2 bg-purple-500/10 rounded border border-purple-500/20">
                                                      <div className="flex items-center justify-between">
                                                          <div className="flex items-center gap-1.5">
                                                              <ImageIcon size={12} className="text-purple-400" />
                                                              <span className="text-[9px] font-bold text-purple-300">图片融合</span>
                                                          </div>
                                                          {tg.imageFused ? (
                                                              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 text-[8px] rounded">
                                                                  ✓ 已融合
                                                              </span>
                                                          ) : (
                                                              <span className="text-[8px] text-slate-500">
                                                                  待融合 ({tg.splitShots.length}张)
                                                              </span>
                                                          )}
                                                      </div>
                                                      <div className="text-[8px] text-slate-400 leading-relaxed">
                                                          将当前任务组的 <span className="text-purple-300 font-medium">{tg.splitShots.length}</span> 张分镜图进行拼接并标号，生成一张参考图供 AI 理解镜头顺序和画面内容
                                                      </div>
                                                      {/* Fusion Structure Preview */}
                                                      {!tg.imageFused && (
                                                          <div className="flex items-center gap-1 pt-1">
                                                              {tg.splitShots.slice(0, 6).map((_, idx) => (
                                                                  <div key={idx} className="flex items-center">
                                                                      <div className="w-6 h-4 bg-purple-500/30 rounded border border-purple-500/30 flex items-center justify-center">
                                                                          <span className="text-[6px] text-purple-300">{idx + 1}</span>
                                                                      </div>
                                                                      {idx < Math.min(tg.splitShots.length, 6) - 1 && (
                                                                          <span className="text-purple-500/40">+</span>
                                                                      )}
                                                                  </div>
                                                              ))}
                                                              {tg.splitShots.length > 6 && (
                                                                  <span className="text-[7px] text-purple-400">+{tg.splitShots.length - 6}</span>
                                                              )}
                                                              <span className="text-[7px] text-slate-500">→ 融合图</span>
                                                          </div>
                                                      )}
                                                      {/* Fused Image Display */}
                                                      {tg.imageFused && tg.referenceImage && (
                                                          <div className="mt-2 space-y-2">
                                                              {/* Thumbnail - Collapsed by default */}
                                                              <div className="relative group rounded overflow-hidden border border-purple-500/30 bg-black/40">
                                                                  <img
                                                                      src={tg.referenceImage}
                                                                      alt={`任务组 ${tg.taskNumber} 融合图`}
                                                                      className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                                                      onClick={() => onExpand?.(tg.referenceImage)}
                                                                      style={{ maxHeight: '200px' }}
                                                                  />
                                                                  {/* Action Buttons Overlay */}
                                                                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                      <button
                                                                          onClick={(e) => {
                                                                              e.stopPropagation();
                                                                              onExpand?.(tg.referenceImage);
                                                                          }}
                                                                          className="p-1.5 bg-black/60 rounded hover:bg-black/80 transition-colors"
                                                                          title="查看大图"
                                                                      >
                                                                          <Maximize2 size={12} className="text-white" />
                                                                      </button>
                                                                      <button
                                                                          onClick={async (e) => {
                                                                              e.stopPropagation();
                                                                              try {
                                                                                  console.log('[合成图下载] 开始下载:', tg.referenceImage);

                                                                                  // 使用fetch获取图片
                                                                                  const response = await fetch(tg.referenceImage);
                                                                                  if (!response.ok) throw new Error('下载失败');

                                                                                  const blob = await response.blob();
                                                                                  const url = URL.createObjectURL(blob);

                                                                                  // 创建下载链接
                                                                                  const link = document.createElement('a');
                                                                                  link.href = url;
                                                                                  link.download = `sora-reference-${tg.taskNumber}.png`;
                                                                                  document.body.appendChild(link);
                                                                                  link.click();
                                                                                  document.body.removeChild(link);

                                                                                  // 释放URL
                                                                                  setTimeout(() => URL.revokeObjectURL(url), 100);

                                                                                  console.log('[合成图下载] ✅ 下载成功');
                                                                              } catch (error) {
                                                                                  console.error('[合成图下载] ❌ 下载失败:', error);
                                                                                  // 回退方案：在新标签页打开
                                                                                  window.open(tg.referenceImage, '_blank');
                                                                              }
                                                                          }}
                                                                          className="p-1.5 bg-black/60 rounded hover:bg-black/80 transition-colors"
                                                                          title="下载融合图"
                                                                      >
                                                                          <Download size={12} className="text-white" />
                                                                      </button>
                                                                  </div>
                                                                  {/* Expand Hint */}
                                                                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[8px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                      点击查看大图
                                                                  </div>
                                                              </div>
                                                              {/* Info */}
                                                              <div className="flex items-center justify-between text-[8px] text-slate-400">
                                                                  <span>共 {tg.splitShots.length} 个镜头已融合</span>
                                                                  <span className="text-purple-400">点击缩略图查看完整</span>
                                                              </div>
                                                          </div>
                                                      )}
                                                  </div>
                                              )}
                                          </div>

                                          {/* Right: AI Optimized Sora Prompt */}
                                          <div className="flex-1 space-y-2">
                                              <div className="flex items-center justify-between">
                                                  <div className="text-[10px] font-bold text-slate-400">AI 优化提示词</div>
                                                  <div className="flex items-center gap-1">
                                                      <button
                                                          onClick={() => onAction?.(node.id, `edit-shots:${index}`)}
                                                          className="p-1 hover:bg-white/10 rounded transition-colors"
                                                          title="编辑分镜信息"
                                                      >
                                                          <Edit size={10} className="text-slate-400 hover:text-white" />
                                                      </button>
                                                      <button
                                                          onClick={() => onAction?.(node.id, `regenerate-prompt:${index}`)}
                                                          className="p-1 hover:bg-white/10 rounded transition-colors"
                                                          title="重新生成提示词"
                                                      >
                                                          <RefreshCw size={10} className="text-slate-400 hover:text-white" />
                                                      </button>
                                                      <button
                                                          onClick={() => onAction?.(node.id, `remove-sensitive-words:${index}`)}
                                                          disabled={!tg.soraPrompt}
                                                          className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                          title="去除敏感词（暴力、色情、版权、名人信息）"
                                                      >
                                                          <ShieldAlert size={10} className="text-orange-400 hover:text-white disabled:text-slate-600" />
                                                      </button>
                                                  </div>
                                              </div>

                                              {tg.soraPrompt ? (
                                                  <>
                                                      <div className="px-2 pb-2">
                                                          <textarea
                                                              className="w-full p-2 bg-black/30 rounded border border-white/10 text-[9px] text-slate-300 font-mono resize-y min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar focus:outline-none focus:border-cyan-500/30"
                                                              defaultValue={tg.soraPrompt}
                                                              onChange={(e) => {
                                                                  const updatedTaskGroups = [...node.data.taskGroups];
                                                                  const tgIndex = updatedTaskGroups.findIndex(t => t.id === tg.id);
                                                                  if (tgIndex !== -1) {
                                                                      updatedTaskGroups[tgIndex].soraPrompt = e.target.value;
                                                                      onUpdate(node.id, { taskGroups: updatedTaskGroups });
                                                                  }
                                                              }}
                                                              onMouseDown={(e) => e.stopPropagation()}
                                                              onTouchStart={(e) => e.stopPropagation()}
                                                              onPointerDown={(e) => e.stopPropagation()}
                                                              placeholder="Sora 提示词..."
                                                          />
                                                      </div>

                                                      {/* 去敏感词状态提示 */}
                                                      {tg.isRemovingSensitiveWords && (
                                                          <div className="px-2 pb-2">
                                                              <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                                                                  <Loader2 size={12} className="text-blue-400 animate-spin" />
                                                                  <span className="text-[9px] text-blue-300">{tg.removeSensitiveWordsProgress || '正在处理...'}</span>
                                                              </div>
                                                          </div>
                                                      )}

                                                      {tg.removeSensitiveWordsSuccess && (
                                                          <div className="px-2 pb-2">
                                                              <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded">
                                                                  <CheckCircle size={12} className="text-green-400" />
                                                                  <span className="text-[9px] text-green-300">{tg.removeSensitiveWordsSuccess}</span>
                                                              </div>
                                                          </div>
                                                      )}

                                                      {tg.removeSensitiveWordsError && (
                                                          <div className="px-2 pb-2">
                                                              <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded">
                                                                  <AlertCircle size={12} className="text-red-400" />
                                                                  <span className="text-[9px] text-red-300">处理失败: {tg.removeSensitiveWordsError}</span>
                                                              </div>
                                                          </div>
                                                      )}

                                                      {/* 视频预览 - 仅在完成时显示 */}
                                                      {tg.generationStatus === 'completed' && tg.videoUrl && (
                                                          <div className="px-2 pb-2">
                                                              <div className="space-y-1">
                                                                  <div className="flex items-center justify-between">
                                                                      <div className="flex items-center gap-1.5">
                                                                          <Play size={10} className="text-green-400" />
                                                                          <span className="text-[9px] font-bold text-green-300">生成完成</span>
                                                                      </div>
                                                                      {tg.videoMetadata?.duration && (
                                                                          <span className="text-[8px] text-slate-500">
                                                                              {tg.videoMetadata.duration.toFixed(1)}秒
                                                                          </span>
                                                                      )}
                                                                  </div>
                                                                  <div className="relative group/video rounded overflow-hidden border border-green-500/30 bg-black/40">
                                                                      <video
                                                                          src={tg.videoUrl}
                                                                          className="w-full h-auto object-contain cursor-pointer"
                                                                          controls
                                                                          playsInline
                                                                          preload="metadata"
                                                                      />
                                                                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/video:opacity-100 transition-opacity">
                                                                          <button
                                                                              onClick={(e) => {
                                                                                  e.stopPropagation();
                                                                                  window.open(tg.videoUrl, '_blank');
                                                                              }}
                                                                              className="p-1 bg-black/60 hover:bg-black/80 rounded text-white"
                                                                              title="在新窗口打开"
                                                                          >
                                                                              <ExternalLink size={10} />
                                                                          </button>
                                                                      </div>
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      )}
                                                  </>
                                              ) : (
                                                  <div className="p-2 bg-black/20 rounded border border-dashed border-white/10 text-center">
                                                      <span className="text-[9px] text-slate-500">等待生成提示词</span>
                                                  </div>
                                              )}

                                              {/* Camera Tags */}
                                              {tg.splitShots && tg.splitShots.length > 0 && (
                                                  <div className="flex flex-wrap gap-1">
                                                      {Array.from(new Set(tg.splitShots.map((s: any) => s.shotSize))).slice(0, 3).map((shotSize: string, i: number) => (
                                                          <span key={i} className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[8px] rounded">
                                                              {shotSize}
                                                          </span>
                                                      ))}
                                                  </div>
                                              )}
                                          </div>
                                      </div>

                                      {/* Error Message */}
                                      {tg.error && (
                                          <div className="px-3 pb-2 text-[9px] text-red-400">
                                              ⚠️ {tg.error}
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* Footer Actions */}
                  {taskGroups.length > 0 && (
                      <div className="px-4 py-3 border-t border-white/10 bg-white/5 shrink-0">
                          <div className="flex items-center justify-between">
                              <div className="text-[9px] text-slate-500">
                                  {taskGroups.filter((tg: any) => tg.generationStatus === 'completed').length} / {taskGroups.length} 个任务已完成
                              </div>
                              <div className="flex items-center gap-2">
                                  <button
                                      onClick={() => onAction?.(node.id, 'regenerate-all')}
                                      disabled={taskGroups.some((tg: any) => tg.generationStatus === 'generating' || tg.generationStatus === 'uploading')}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-slate-600/20 disabled:cursor-not-allowed text-cyan-400 disabled:text-slate-500 text-[10px] rounded font-medium transition-colors"
                                      title="重新生成所有任务"
                                  >
                                      <RotateCcw size={10} />
                                      重新生成全部
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          );
      }

      // --- SORA VIDEO CHILD NODE CONTENT ---
      if (node.type === NodeType.SORA_VIDEO_CHILD) {
          const videoUrl = node.data.videoUrl;
          const duration = node.data.duration;
          const isCompliant = node.data.isCompliant;
          const violationReason = node.data.violationReason;
          const locallySaved = node.data.locallySaved;
          const taskNumber = node.data.taskNumber;
          const soraTaskId = node.data.soraTaskId;

          const [isPlaying, setIsPlaying] = useState(false);
          const [currentTime, setCurrentTime] = useState(0);
          const [durationValue, setDurationValue] = useState(0);
          const videoRef = useRef<HTMLVideoElement>(null);
          const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
          const [useLocalServer, setUseLocalServer] = useState(false);
          const [videoError, setVideoError] = useState<string | null>(null);

          // 格式化时间显示
          const formatTime = (time: number) => {
              const mins = Math.floor(time / 60);
              const secs = Math.floor(time % 60);
              return `${mins}:${secs.toString().padStart(2, '0')}`;
          };

          // 直接下载视频（从 URL 或浏览器缓存）
          const handleDirectDownload = async () => {
              if (!videoUrl) {
                  alert('视频 URL 不存在');
                  return;
              }

              try {
                  console.log('[直接下载] 开始下载:', videoUrl);

                  // 尝试使用 fetch 下载
                  const response = await fetch(videoUrl);
                  if (!response.ok) {
                      throw new Error(`HTTP ${response.status}`);
                  }

                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `sora-video-${taskNumber || 'direct'}-${Date.now()}.mp4`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);

                  console.log('[直接下载] ✅ 下载成功');
              } catch (e) {
                  console.error('[直接下载] ❌ 下载失败:', e);

                  // 如果 fetch 失败，尝试在新标签页打开
                  console.log('[直接下载] 尝试在新标签页打开');
                  window.open(videoUrl, '_blank');
                  alert('已在新标签页打开视频，请在视频上右键选择"视频另存为"来下载。');
              }

              setContextMenu(null);
          };

          // 下载视频 - 智能兼容方案
          const handleDownload = async () => {
              if (!videoUrl) {
                  alert('视频 URL 不存在');
                  return;
              }

              try {
                  console.log('[视频下载] 开始下载视频:', { soraTaskId, videoUrl });

                  // 如果有 soraTaskId，先尝试从数据库下载
                  if (soraTaskId) {
                      try {
                          const downloadUrl = `http://localhost:3001/api/videos/download/${soraTaskId}`;
                          const response = await fetch(downloadUrl);

                          if (response.ok) {
                              const contentType = response.headers.get('content-type');

                              // 检查是否是视频文件
                              if (!contentType || !contentType.includes('application/json')) {
                                  const blob = await response.blob();
                                  console.log('[视频下载] ✅ 从数据库下载成功');

                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `sora-task-${taskNumber || 'video'}-${Date.now()}.mp4`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                  return;
                              }
                          }
                      } catch (dbError) {
                          console.log('[视频下载] 数据库中未找到，尝试直接下载:', dbError.message);
                      }
                  }

                  // 数据库中没有或没有 soraTaskId，提供选项
                  const shouldSaveToDb = confirm(
                      '此视频尚未保存到数据库。\n\n' +
                      '点击"确定"将视频保存到数据库后再下载（推荐，以后可快速下载）\n' +
                      '点击"取消"直接从原始地址下载（可能较慢）'
                  );

                  if (shouldSaveToDb) {
                      // 保存到数据库
                      const taskId = soraTaskId || `video-${Date.now()}`;
                      console.log('[视频下载] 正在保存到数据库...');

                      const saveResponse = await fetch('http://localhost:3001/api/videos/save', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              videoUrl,
                              taskId,
                              taskNumber,
                              soraPrompt: node.data.soraPrompt || ''
                          })
                      });

                      const saveResult = await saveResponse.json();

                      if (saveResult.success) {
                          console.log('[视频下载] ✅ 保存成功，开始下载');
                          alert('视频已保存到数据库！现在开始下载...');

                          // 从数据库下载
                          const downloadUrl = `http://localhost:3001/api/videos/download/${taskId}`;
                          const downloadResponse = await fetch(downloadUrl);
                          const blob = await downloadResponse.blob();

                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `sora-task-${taskNumber || 'video'}-${Date.now()}.mp4`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                      } else {
                          throw new Error(saveResult.error || '保存失败');
                      }
                  } else {
                      // 直接从原始 URL 下载
                      console.log('[视频下载] 直接从原始地址下载');
                      alert('正在从原始地址下载，请稍候...');

                      const response = await fetch(videoUrl);
                      if (!response.ok) {
                          throw new Error(`HTTP ${response.status}`);
                      }

                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `sora-task-${taskNumber || 'video'}-${Date.now()}.mp4`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                  }

                  console.log('[视频下载] ✅ 下载完成');
              } catch (e) {
                  console.error('[视频下载] ❌ 下载失败:', e);
                  alert(`视频下载失败: ${e.message}\n\n您也可以右键点击视频，选择"视频另存为"来下载。`);
              }
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
                                      // 设置视频元数据加载监听
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
                              src={useLocalServer && soraTaskId ? `http://localhost:3001/api/videos/download/${soraTaskId}` : videoUrl}
                              className="w-full h-full object-cover bg-zinc-900"
                              loop
                              playsInline
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
                                      onClick={handleDirectDownload}
                                      className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                                  >
                                      <Download size={14} />
                                      直接下载视频
                                  </button>
                                  <button
                                      onClick={handleDownload}
                                      className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                                  >
                                      <Database size={14} />
                                      从数据库下载
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

                          {/* Controls Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3">
                              {/* Progress Bar */}
                              <div className="w-full mb-3">
                                  <div
                                      className="w-full h-1 bg-white/20 rounded-full cursor-pointer group/relative"
                                      onClick={(e) => {
                                          if (videoRef.current) {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              const x = e.clientX - rect.left;
                                              const newTime = (x / rect.width) * durationValue;
                                              videoRef.current.currentTime = newTime;
                                              setCurrentTime(newTime);
                                          }
                                      }}
                                  >
                                      <div
                                          className="h-full bg-cyan-500 rounded-full relative"
                                          style={{ width: `${durationValue > 0 ? (currentTime / durationValue) * 100 : 0}%` }}
                                      >
                                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                  </div>
                                  {/* Time Display */}
                                  <div className="flex justify-between text-[10px] text-white/70 mt-1">
                                      <span>{formatTime(currentTime)}</span>
                                      <span>{formatTime(durationValue)}</span>
                                  </div>
                              </div>

                              {/* Control Buttons */}
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                      {/* Play/Pause Button */}
                                      <button
                                          onClick={() => {
                                              if (videoRef.current) {
                                                  if (isPlaying) {
                                                      videoRef.current.pause();
                                                  } else {
                                                      videoRef.current.play();
                                                  }
                                              }
                                          }}
                                          className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                                      >
                                          {isPlaying ? (
                                              <Pause size={14} className="text-white" />
                                          ) : (
                                              <Play size={14} className="text-white ml-0.5" />
                                          )}
                                      </button>

                                      {/* Duration Badge */}
                                      {duration && (
                                          <span className="text-[10px] text-white/70 px-2 py-0.5 bg-white/10 rounded">
                                              {duration}
                                          </span>
                                      )}

                                      {/* Status Badges */}
                                      {isCompliant === false && (
                                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-[9px] rounded-full" title={violationReason}>
                                              ⚠️ 违规
                                          </span>
                                      )}
                                      {locallySaved && (
                                          <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-[9px] rounded-full">
                                              ✓ 已保存
                                          </span>
                                      )}
                                      {/* Local Server Toggle */}
                                      {soraTaskId && (
                                          <button
                                              onClick={() => setUseLocalServer(!useLocalServer)}
                                              className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
                                                  useLocalServer
                                                      ? 'bg-blue-500/30 text-blue-300 border border-blue-400/30'
                                                      : 'bg-white/10 text-white/50 border border-white/10'
                                              }`}
                                              title={useLocalServer ? '使用本地服务器（推荐）' : '使用原始URL（可能较慢）'}
                                          >
                                              {useLocalServer ? '🔄 本地服务器' : '☁️ 原始URL'}
                                          </button>
                                      )}
                                  </div>

                                  {/* Download Button */}
                                  <button
                                      onClick={handleDownload}
                                      className="w-8 h-8 flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/40 rounded-full transition-colors"
                                      title="下载视频"
                                  >
                                      <Download size={14} className="text-cyan-400" />
                                  </button>
                              </div>
                          </div>
                      </>
                  ) : violationReason || node.data.error ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400 bg-black/40 p-6 text-center">
                          <AlertCircle className="text-red-500 mb-1" size={32} />
                          <span className="text-xs font-medium text-red-200">{violationReason || node.data.error}</span>
                      </div>
                  ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600">
                          <VideoIcon size={32} className="opacity-50" />
                          <span className="text-xs font-medium">等待视频生成</span>
                      </div>
                  )}

                  {/* Error overlay */}
                  {node.status === NodeStatus.ERROR && !videoUrl && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                          <AlertCircle className="text-red-500 mb-2" />
                          <span className="text-xs text-red-200">{node.data.error}</span>
                      </div>
                  )}
              </div>
          );
      }

      const hasContent = node.data.image || node.data.videoUri;
      return (
        <div className="w-full h-full relative group/media overflow-hidden bg-zinc-900" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {!hasContent ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600"><div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 hover:scale-105 transition-all duration-300 shadow-inner" onClick={() => fileInputRef.current?.click()}>{isWorking ? <Loader2 className="animate-spin text-cyan-500" size={32} /> : <NodeIcon size={32} className="opacity-50" />}</div><span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">{isWorking ? "处理中..." : "拖拽或上传"}</span><input type="file" ref={fileInputRef} className="hidden" accept={node.type.includes('VIDEO') ? "video/*" : "image/*"} onChange={node.type.includes('VIDEO') ? handleUploadVideo : handleUploadImage} /></div>
            ) : (
                <>
                    {node.data.image ? 
                        <img ref={mediaRef as any} src={node.data.image} className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105 bg-zinc-900" draggable={false} style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} onContextMenu={(e) => onMediaContextMenu?.(e, node.id, 'image', node.data.image!)} /> 
                    : 
                        <SecureVideo 
                            videoRef={mediaRef} // Pass Ref to Video
                            src={node.data.videoUri} 
                            className="w-full h-full object-cover bg-zinc-900" 
                            loop 
                            muted 
                            // autoPlay removed to rely on hover logic
                            onContextMenu={(e: React.MouseEvent) => onMediaContextMenu?.(e, node.id, 'video', node.data.videoUri!)} 
                            style={{ filter: showImageGrid ? 'blur(10px)' : 'none' }} // Pass Style
                        />
                    }
                    {node.status === NodeStatus.ERROR && <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20"><AlertCircle className="text-red-500 mb-2" /><span className="text-xs text-red-200">{node.data.error}</span></div>}
                    {showImageGrid && (node.data.images || node.data.videoUris) && (
                        <div className="absolute inset-0 bg-black/40 z-10 grid grid-cols-2 gap-2 p-2 animate-in fade-in duration-200">
                            {node.data.images ? node.data.images.map((img, idx) => (
                                <div key={idx} className={`relative rounded-lg overflow-hidden cursor-pointer border-2 bg-zinc-900 ${img === node.data.image ? 'border-cyan-500' : 'border-transparent hover:border-white/50'}`} onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { image: img }); }}>
                                    <img src={img} className="w-full h-full object-cover" />
                                </div>
                            )) : node.data.videoUris?.map((uri, idx) => (
                                <div key={idx} className={`relative rounded-lg overflow-hidden cursor-pointer border-2 bg-zinc-900 ${uri === node.data.videoUri ? 'border-cyan-500' : 'border-transparent hover:border-white/50'}`} onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { videoUri: uri }); }}>
                                    {uri ? (
                                        <SecureVideo src={uri} className="w-full h-full object-cover bg-zinc-900" muted loop autoPlay />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-xs text-slate-500">Failed</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {generationMode === 'CUT' && node.data.croppedFrame && <div className="absolute top-4 right-4 w-24 aspect-video bg-black/80 rounded-lg border border-purple-500/50 shadow-xl overflow-hidden z-20 hover:scale-150 transition-transform origin-top-right opacity-0 group-hover:opacity-100 transition-opacity duration-300"><img src={node.data.croppedFrame} className="w-full h-full object-cover" /></div>}
                    {generationMode === 'CUT' && !node.data.croppedFrame && hasInputs && inputAssets?.some(a => a.src) && (<div className="absolute top-4 right-4 w-24 aspect-video bg-black/80 rounded-lg border border-purple-500/30 border-dashed shadow-xl overflow-hidden z-20 hover:scale-150 transition-transform origin-top-right flex flex-col items-center justify-center group/preview opacity-0 group-hover:opacity-100 transition-opacity duration-300"><div className="absolute inset-0 bg-purple-500/10 z-10"></div>{(() => { const asset = inputAssets!.find(a => a.src); if (asset?.type === 'video') { return <SecureVideo src={asset.src} className="w-full h-full object-cover opacity-60 bg-zinc-900" muted autoPlay />; } else { return <img src={asset?.src} className="w-full h-full object-cover opacity-60 bg-zinc-900" />; } })()}<span className="absolute z-20 text-[8px] font-bold text-purple-200 bg-black/50 px-1 rounded">分镜参考</span></div>)}
                </>
            )}
            {node.type === NodeType.VIDEO_GENERATOR && generationMode === 'CUT' && (videoBlobUrl || node.data.videoUri) && 
                <SceneDirectorOverlay 
                    visible={true} 
                    videoRef={mediaRef as React.RefObject<HTMLVideoElement>} 
                    onCrop={() => { 
                        const vid = mediaRef.current as HTMLVideoElement; 
                        if (vid) { 
                            const canvas = document.createElement('canvas'); 
                            canvas.width = vid.videoWidth; 
                            canvas.height = vid.videoHeight; 
                            const ctx = canvas.getContext('2d'); 
                            if (ctx) { 
                                ctx.drawImage(vid, 0, 0); 
                                onCrop?.(node.id, canvas.toDataURL('image/png')); 
                            } 
                        }
                    }} 
                    onTimeHover={() => {}} 
                />
            }
        </div>
      );
  };

  const renderBottomPanel = () => {
     // DRAMA_REFINED node doesn't need bottom panel (display only)
     if (node.type === NodeType.DRAMA_REFINED) {
         return null;
     }

     const isOpen = (isHovered || isInputFocused);

     // Special handling for DRAMA_ANALYZER
     if (node.type === NodeType.DRAMA_ANALYZER) {
         const selectedFields = node.data.selectedFields || [];
         const hasAnalysis = node.data.dramaIntroduction || node.data.worldview;

         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
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
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
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
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
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
                                     onUpdate(node.id, {
                                         sora2Config: { ...currentConfig, ...updates }
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
                             <div className="flex gap-2">
                                 <button
                                     onClick={() => onAction?.(node.id, 'fuse-images')}
                                     disabled={isWorking || taskGroups.every((tg: any) => tg.imageFused)}
                                     className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${
                                         isWorking || taskGroups.every((tg: any) => tg.imageFused)
                                             ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                             : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:shadow-lg hover:shadow-purple-500/20'
                                     }`}
                                 >
                                     🖼️ 图片融合
                                 </button>
                                 <button
                                     onClick={() => onAction?.(node.id, 'generate-videos')}
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

         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                     {/* Save Locally Button */}
                     {videoUrl && !locallySaved && (
                         <button
                             onClick={() => onAction?.(node.id, 'save-locally')}
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
                                     <span>保存中...</span>
                                 </>
                             ) : (
                                 <>
                                     <Download size={14} />
                                     <span>保存到本地</span>
                                 </>
                             )}
                         </button>
                     )}

                     {/* Sora Prompt Display */}
                     {node.data.soraPrompt && (
                         <div className="flex flex-col gap-2">
                             <label className="text-[10px] text-slate-400">Sora 提示词:</label>
                             <textarea
                                 className="w-full p-2 bg-black/30 rounded border border-white/10 text-[9px] text-slate-300 font-mono resize-y min-h-[400px] max-h-[600px] overflow-y-auto custom-scrollbar focus:outline-none focus:border-cyan-500/30"
                                 defaultValue={node.data.soraPrompt}
                                 onChange={(e) => {
                                     onUpdate(node.id, { soraPrompt: e.target.value });
                                 }}
                                 onMouseDown={(e) => e.stopPropagation()}
                                 onTouchStart={(e) => e.stopPropagation()}
                                 onPointerDown={(e) => e.stopPropagation()}
                                 placeholder="Sora 提示词..."
                             />
                         </div>
                     )}

                     {/* Info */}
                     {locallySaved && (
                         <div className="text-[9px] text-green-400 text-center">
                             ✓ 已保存到: {node.data.videoFilePath || '本地'}
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
                 const { splitMultipleStoryboardImages } = await import('../utils/imageSplitter');
                 const allSplitShots = await splitMultipleStoryboardImages(
                     nodesToSplit,
                     (current, total, currentNode) => {
                         console.log(`正在切割 ${current}/${total}: ${currentNode}`);
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
                 const { exportSplitImagesAsZip } = await import('../utils/imageSplitter');
                 await exportSplitImagesAsZip(splitShots);
             } catch (error) {
                 console.error('导出失败:', error);
             }
         };

         return (
             <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
                 <div className={`w-full rounded-[20px] p-3 flex flex-col gap-3 ${GLASS_PANEL} relative z-[100] max-h-[320px] overflow-hidden`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
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

                             <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '180px' }}>
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
                                                             key={idx}
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
        <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
            {hasInputs && onInputReorder && (<div className="w-full flex justify-center mb-2 z-0 relative"><InputThumbnails assets={inputAssets!} onReorder={(newOrder) => onInputReorder(node.id, newOrder)} /></div>)}

            <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} relative z-[100]`} onMouseDown={(e) => {
                // 只在点击的不是range input时才阻止冒泡
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' || target.type !== 'range') {
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
                                style={{ height: '80px' }}
                                placeholder="输入分镜描述，或连接剧本分集子节点..."
                                value={localPrompt}
                                onChange={(e) => setLocalPrompt(e.target.value)}
                                onBlur={() => { setIsInputFocused(false); commitPrompt(); }}
                                onFocus={() => setIsInputFocused(true)}
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
                                    <textarea className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500/60 p-2 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed" style={{ height: '60px' }} placeholder="输入剧本核心创意..." value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onFocus={() => setIsInputFocused(true)} />
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
                        console.log('[Node Render] PROMPT_INPUT node:', node.id, 'isEpisodeChild:', isEpisodeChild, 'inputs:', node.inputs);
                    }
                    return isEpisodeChild;
                })() ? (
                    // Special handling for episode child nodes - only show storyboard button
                    <div className="flex flex-col gap-2 p-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('[Node] Button clicked, node.id:', node.id, 'isWorking:', isWorking);
                                console.log('[Node] Node data.prompt:', node.data.prompt?.substring(0, 100));
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
                ) : (
                    // ... (Other nodes basic UI) ...
                    <>
                    <div className="relative group/input bg-black/10 rounded-[16px]">
                        <textarea className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500/60 p-3 focus:outline-none resize-none custom-scrollbar font-medium leading-relaxed" style={{ height: `${Math.min(inputHeight, 200)}px` }} placeholder={node.type === NodeType.AUDIO_GENERATOR ? "描述您想生成的音乐或音效..." : "描述您的修改或生成需求..."} value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} onBlur={() => { setIsInputFocused(false); commitPrompt(); }} onKeyDown={handleCmdEnter} onFocus={() => setIsInputFocused(true)} onMouseDown={e => e.stopPropagation()} readOnly={isWorking} />
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

  const isInteracting = isDragging || isResizing || isGroupDragging;
  return (
    <div
        className={`absolute rounded-[24px] group ${isSelected ? 'ring-1 ring-cyan-500/50 shadow-[0_0_40px_-10px_rgba(34,211,238,0.3)] z-30' : 'ring-1 ring-white/10 hover:ring-white/20 z-10'}`}
        style={{
            left: node.x, top: node.y, width: nodeWidth, height: nodeHeight,
            background: isSelected ? 'rgba(28, 28, 30, 0.85)' : 'rgba(28, 28, 30, 0.6)',
            transition: isInteracting ? 'none' : 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
            backdropFilter: isInteracting ? 'none' : 'blur(24px)',
            boxShadow: isInteracting ? 'none' : undefined,
            willChange: isInteracting ? 'left, top, width, height' : 'auto'
        }}
        onMouseDown={(e) => onNodeMouseDown(e, node.id)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => onNodeContextMenu(e, node.id)}
        onWheel={(e) => e.stopPropagation()}
    >
        {renderTitleBar()}
        {renderHoverToolbar()}
        <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md ${isConnecting ? 'ring-2 ring-cyan-400 animate-pulse' : ''}`} onMouseDown={(e) => onPortMouseDown(e, node.id, 'input')} onMouseUp={(e) => onPortMouseUp(e, node.id, 'input')} title="Input"><Plus size={10} strokeWidth={3} className="text-white/50" /></div>
        <div className={`absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md ${isConnecting ? 'ring-2 ring-purple-400 animate-pulse' : ''}`} onMouseDown={(e) => onPortMouseDown(e, node.id, 'output')} onMouseUp={(e) => onPortMouseUp(e, node.id, 'output')} title="Output"><Plus size={10} strokeWidth={3} className="text-white/50" /></div>
        <div className="w-full h-full flex flex-col relative rounded-[24px] overflow-hidden bg-zinc-900"><div className="flex-1 min-h-0 relative bg-zinc-900">{renderMediaContent()}</div></div>
        {renderBottomPanel()}
        <div className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-50" onMouseDown={(e) => onResizeMouseDown(e, node.id, nodeWidth, nodeHeight)}><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
    </div>
  );
};

export const Node = memo(NodeComponent, arePropsEqual);
