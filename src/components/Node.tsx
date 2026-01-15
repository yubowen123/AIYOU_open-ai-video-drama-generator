
import { AppNode, NodeStatus, NodeType, StoryboardShot, CharacterProfile, DramaAnalysis } from '../types';
import { RefreshCw, Play, Image as ImageIcon, Video as VideoIcon, Type, AlertCircle, CheckCircle, Plus, Maximize2, Download, MoreHorizontal, Wand2, Scaling, FileSearch, Edit, Loader2, Layers, Trash2, X, Upload, Scissors, Film, MousePointerClick, Crop as CropIcon, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, GripHorizontal, Link, Copy, Monitor, Music, Pause, Volume2, Mic2, BookOpen, ScrollText, Clapperboard, LayoutGrid, Box, User, Users, Save, RotateCcw, Eye, List, Search, CheckSquare, Square } from 'lucide-react';
import { VideoModeSelector, SceneDirectorOverlay } from './VideoNodeModules';
import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { IMAGE_MODELS, TEXT_MODELS, VIDEO_MODELS, AUDIO_MODELS } from '../../services/modelConfig';

const IMAGE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const VIDEO_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const IMAGE_RESOLUTIONS = ['1k', '2k', '4k'];
const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];
const IMAGE_COUNTS = [1, 2, 3, 4];
const VIDEO_COUNTS = [1, 2, 3, 4];
const GLASS_PANEL = "bg-[#2c2c2e]/95 backdrop-blur-2xl border border-white/10 shadow-2xl";
const DEFAULT_NODE_WIDTH = 420;
const DEFAULT_FIXED_HEIGHT = 360; 
const AUDIO_NODE_HEIGHT = 200;
const STORYBOARD_NODE_HEIGHT = 500;
const CHARACTER_NODE_HEIGHT = 600;
const DRAMA_ANALYZER_HEIGHT = 550;

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
  onCharacterAction?: (nodeId: string, action: 'DELETE' | 'SAVE' | 'RETRY', charName: string) => void;
  onViewCharacter?: (character: CharacterProfile) => void;

  isDragging?: boolean;
  isGroupDragging?: boolean;
  isSelected?: boolean;
  isResizing?: boolean;
  isConnecting?: boolean; 
  
  allNodes?: AppNode[];
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
        return <div className={`flex items-center justify-center bg-zinc-800 text-xs text-red-400 ${className}`}>Load Error</div>;
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
    if (prev.isDragging !== next.isDragging || 
        prev.isResizing !== next.isResizing || 
        prev.isSelected !== next.isSelected ||
        prev.isGroupDragging !== next.isGroupDragging ||
        prev.isConnecting !== next.isConnecting) {
        return false;
    }
    if (prev.node !== next.node) return false;
    const prevInputs = prev.inputAssets || [];
    const nextInputs = next.inputAssets || [];
    if (prevInputs.length !== nextInputs.length) return false;
    for(let i = 0; i < prevInputs.length; i++) {
        if (prevInputs[i].id !== nextInputs[i].id || prevInputs[i].src !== nextInputs[i].src) return false;
    }
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

// Episode Viewer Component
const EpisodeViewer = ({ episodes, onClear }: { episodes: { title: string, content: string, characters: string }[], onClear?: () => void }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    return (
        <div className="w-full h-full flex flex-col bg-[#1c1c1e] relative overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5 shrink-0">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <ScrollText size={14} className="text-teal-400" />
                    Generated Episodes ({episodes.length})
                </span>
                {onClear && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onClear(); }} 
                        className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-md transition-colors"
                        title="Clear All"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
            
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
  node, onUpdate, onAction, onDelete, onExpand, onCrop, onNodeMouseDown, onPortMouseDown, onPortMouseUp, onNodeContextMenu, onMediaContextMenu, onResizeMouseDown, inputAssets, onInputReorder, onCharacterAction, onViewCharacter, isDragging, isGroupDragging, isSelected, isResizing, isConnecting, allNodes, characterLibrary 
}) => {
  const isWorking = node.status === NodeStatus.WORKING;
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

  useEffect(() => { setLocalPrompt(node.data.prompt || ''); }, [node.data.prompt]);
  const commitPrompt = () => { if (localPrompt !== (node.data.prompt || '')) onUpdate(node.id, { prompt: localPrompt }); };
  const handleActionClick = () => { commitPrompt(); onAction(node.id, localPrompt); };
  const handleCmdEnter = (e: React.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commitPrompt(); onAction(node.id, localPrompt); }};
  
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

  useEffect(() => {
      if (node.type === NodeType.SCRIPT_EPISODE && allNodes) {
          const plannerNode = allNodes.find(n => node.inputs.includes(n.id) && n.type === NodeType.SCRIPT_PLANNER);
          if (plannerNode && plannerNode.data.scriptOutline) {
              const regex = /^##\s*(.+)$/gm;
              const matches = [];
              let match;
              while ((match = regex.exec(plannerNode.data.scriptOutline)) !== null) {
                  matches.push(match[1].trim());
              }
              if (matches.length > 0) {
                  if (JSON.stringify(availableChapters) !== JSON.stringify(matches)) {
                      setAvailableChapters(matches);
                      // Auto-select first chapter if none selected
                      if (!node.data.selectedChapter) {
                          onUpdate(node.id, { selectedChapter: matches[0] });
                      }
                  }
              }
          }
      }
  }, [node.type, node.inputs, allNodes, node.data.selectedChapter]);

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
  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => onUpdate(node.id, { videoUri: e.target?.result as string }); reader.readAsDataURL(file); }};
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => onUpdate(node.id, { image: e.target?.result as string }); reader.readAsDataURL(file); }};
  
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
        case NodeType.CHARACTER_NODE: return { icon: User, color: 'text-orange-400', border: 'border-orange-500/30' };
        case NodeType.DRAMA_ANALYZER: return { icon: Search, color: 'text-blue-400', border: 'border-blue-500/30' };
        default: return { icon: Type, color: 'text-slate-400', border: 'border-white/10' };
      }
  };
  const { icon: NodeIcon } = getNodeConfig();
  
  const getNodeHeight = () => {
      if (node.height) return node.height; 
      if (node.type === NodeType.STORYBOARD_GENERATOR) return STORYBOARD_NODE_HEIGHT;
      if (node.type === NodeType.CHARACTER_NODE) return CHARACTER_NODE_HEIGHT;
      if (node.type === NodeType.DRAMA_ANALYZER) return DRAMA_ANALYZER_HEIGHT;
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

  const renderTopBar = () => {
    const showTopBar = isSelected || isHovered;
    return (
    <div className={`absolute -top-10 left-0 w-full flex items-center justify-between px-1 transition-all duration-300 ${showTopBar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <div className="flex items-center gap-1.5 pointer-events-auto">
            {node.type === NodeType.VIDEO_GENERATOR && (<VideoModeSelector currentMode={generationMode} onSelect={(mode) => onUpdate(node.id, { generationMode: mode })} />)}
             {(node.data.image || node.data.videoUri || node.data.audioUri) && (
                <div className="flex items-center gap-1">
                    <button onClick={handleDownload} className="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors" title="下载"><Download size={14} /></button>
                    {node.type !== NodeType.AUDIO_GENERATOR && <button onClick={handleExpand} className="p-1.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-slate-400 hover:text-white hover:border-white/30 transition-colors" title="全屏预览"><Maximize2 size={14} /></button>}
                </div>
             )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
             {isWorking && <div className="bg-[#2c2c2e]/90 backdrop-blur-md p-1.5 rounded-full border border-white/10"><Loader2 className="animate-spin w-3 h-3 text-cyan-400" /></div>}
            <div className={`px-2 py-1 flex items-center gap-2`}>
                {isEditingTitle ? (
                    <input className="bg-transparent border-none outline-none text-slate-400 text-[10px] font-bold uppercase tracking-wider w-24 text-right" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()} onMouseDown={e => e.stopPropagation()} autoFocus />
                ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-text text-right" onClick={() => setIsEditingTitle(true)}>{node.title}</span>
                )}
            </div>
        </div>
    </div>
    );
  };

  const renderMediaContent = () => {
      // --- DRAMA ANALYZER UI ---
      if (node.type === NodeType.DRAMA_ANALYZER) {
          const analysis = node.data.dramaAnalysis;
          const selection = node.data.dramaAnalysisSelection || {};

          // Field labels mapping
          const fields: Array<{key: keyof DramaAnalysis, label: string}> = [
              { key: 'worldview', label: '世界观 (Worldview)' },
              { key: 'logic', label: '逻辑自洽性 (Logic)' },
              { key: 'scalability', label: '延展性 (Scalability)' },
              { key: 'characterTags', label: '角色标签 (Tags)' },
              { key: 'arc', label: '主角弧光 (Arc)' },
              { key: 'resonance', label: '受众共鸣 (Resonance)' },
              { key: 'artStyle', label: '画风 (Art Style)' },
          ];

          return (
              <div className="w-full h-full flex flex-col p-4 bg-[#1c1c1e] overflow-hidden">
                  {/* Search Bar */}
                  <div className="flex gap-2 mb-4">
                      <div className="relative flex-1 group">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                          <input 
                              className="w-full bg-black/30 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                              placeholder="输入剧名 (如: 进击的巨人)..."
                              value={localPrompt}
                              onChange={(e) => setLocalPrompt(e.target.value)}
                              onKeyDown={handleCmdEnter}
                          />
                      </div>
                      <button 
                          onClick={handleActionClick}
                          disabled={isWorking || !localPrompt.trim()}
                          className={`
                              px-4 rounded-xl flex items-center justify-center transition-all shadow-lg
                              ${isWorking || !localPrompt.trim() 
                                  ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                                  : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 shadow-blue-500/20'}
                          `}
                      >
                          {isWorking ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      </button>
                  </div>

                  {/* Analysis Content */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                      {!analysis ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 opacity-60">
                              <Search size={32} strokeWidth={1.5} />
                              <span className="text-xs font-medium">输入剧名开始分析</span>
                          </div>
                      ) : (
                          fields.map((field) => (
                              <div key={field.key} className="bg-white/5 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
                                  {/* Header with Checkbox */}
                                  <div className="flex items-center gap-2 px-3 py-2 bg-black/20 border-b border-white/5">
                                      <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              const newSel = { ...selection, [field.key]: !selection[field.key] };
                                              onUpdate(node.id, { dramaAnalysisSelection: newSel });
                                          }}
                                          className={`transition-colors ${selection[field.key] ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                                      >
                                          {selection[field.key] ? <CheckSquare size={14} /> : <Square size={14} />}
                                      </button>
                                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex-1">{field.label}</span>
                                  </div>
                                  
                                  {/* Editable Content */}
                                  <textarea 
                                      className="w-full bg-transparent text-[11px] text-slate-300 p-3 min-h-[60px] resize-none focus:outline-none focus:bg-black/20 transition-colors leading-relaxed"
                                      value={analysis[field.key] || ''}
                                      onChange={(e) => {
                                          const newAnalysis = { ...analysis, [field.key]: e.target.value };
                                          onUpdate(node.id, { dramaAnalysis: newAnalysis });
                                      }}
                                  />
                              </div>
                          ))
                      )}
                  </div>
              </div>
          );
      }

      if (node.type === NodeType.PROMPT_INPUT) {
          const isCollapsed = (node.height || 360) < 100;
          return (
            <div className="w-full h-full flex flex-col group/text relative">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5 shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Type size={12} className="text-amber-400 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-200 truncate uppercase tracking-wide" title={node.title}>
                            {node.title}
                        </span>
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            const currentH = node.height || 360;
                            const targetH = currentH < 100 ? 360 : 50;
                            onUpdate(node.id, {}, { height: targetH });
                        }}
                        className="p-1 text-slate-500 hover:text-white transition-colors rounded hover:bg-white/10"
                        title={isCollapsed ? "Expand" : "Collapse"}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>
                <div className={`flex-1 bg-black/10 relative overflow-hidden backdrop-blur-sm transition-all ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
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
              return <EpisodeViewer episodes={node.data.generatedEpisodes} onClear={() => onUpdate(node.id, { generatedEpisodes: undefined })} />;
          }
          
          return (
              <div className="w-full h-full p-6 flex flex-col justify-center items-center gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-black/20 border border-white/5 w-full flex-1 flex flex-col items-center justify-center gap-3">
                      {isWorking ? <Loader2 size={32} className="animate-spin text-teal-500" /> : <ScrollText size={32} className="text-teal-500/50" />}
                      <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-300">剧本分集生成</span>
                          <span className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                              {availableChapters.length > 0 
                                  ? (node.data.selectedChapter ? `已选择: ${node.data.selectedChapter}` : "请在下方选择章节")
                                  : "请先连接已生成大纲的剧本节点 (Planner)"}
                          </span>
                      </div>
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
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {names.map((name, idx) => {
                                  const config = configs[name] || { method: 'AI_AUTO' };
                                  const profile = generated.find(p => p.name === name);
                                  const isProcessing = profile?.status === 'GENERATING';
                                  const isFailed = profile?.status === 'ERROR';
                                  const isSaved = profile?.isSaved;

                                  return (
                                      <div key={idx} className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2 group/char hover:border-white/20 transition-all">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold">{idx + 1}</div>
                                                  <span className="font-bold text-sm text-slate-200">{name}</span>
                                              </div>
                                              
                                              <div className="flex items-center gap-2">
                                                  {!profile && (
                                                      <select 
                                                          className="bg-black/40 border border-white/10 rounded-lg text-[10px] text-slate-300 px-2 py-1 outline-none"
                                                          value={config.method}
                                                          onChange={(e) => {
                                                              const newConfigs = { ...configs, [name]: { ...config, method: e.target.value as any } };
                                                              onUpdate(node.id, { characterConfigs: newConfigs });
                                                          }}
                                                          onClick={e => e.stopPropagation()}
                                                      >
                                                          <option value="AI_AUTO">AI 生成</option>
                                                          <option value="AI_CUSTOM">补充描述</option>
                                                          <option value="LIBRARY">角色库</option>
                                                      </select>
                                                  )}
                                                  
                                                  <button 
                                                      onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'DELETE', name); }}
                                                      className="p-1 rounded-full hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors"
                                                  >
                                                      <X size={12} />
                                                  </button>
                                              </div>
                                          </div>

                                          {config.method === 'AI_CUSTOM' && !profile && (
                                              <textarea 
                                                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-[10px] text-slate-300 outline-none resize-none h-16 custom-scrollbar"
                                                  placeholder="输入外貌、性格等补充描述..."
                                                  value={config.customPrompt || ''}
                                                  onChange={(e) => {
                                                      const newConfigs = { ...configs, [name]: { ...config, customPrompt: e.target.value } };
                                                      onUpdate(node.id, { characterConfigs: newConfigs });
                                                  }}
                                              />
                                          )}

                                          {isProcessing && (
                                              <div className="bg-[#18181b] rounded-lg p-3 border border-white/5 flex items-center justify-center gap-2">
                                                  <Loader2 size={12} className="animate-spin text-orange-400" />
                                                  <span className="text-[10px] text-slate-400">
                                                      {profile?.isSaved ? '正在生成三视图并保存...' : '正在生成角色表情...'}
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
                                                      <div className="w-16 h-16 shrink-0 bg-black/50 rounded-md overflow-hidden relative">
                                                          {profile.expressionSheet ? <img src={profile.expressionSheet} className="w-full h-full object-cover" /> : <User className="w-full h-full p-4 text-slate-600" />}
                                                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/char:opacity-100 transition-opacity">
                                                              <Eye size={16} className="text-white drop-shadow-md" />
                                                          </div>
                                                      </div>
                                                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                          <div className="text-[10px] text-orange-300 font-bold">{profile.profession || '未知职业'}</div>
                                                          <div className="text-[9px] text-slate-400 line-clamp-3 leading-relaxed">{profile.personality || '无性格描述'}</div>
                                                      </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 mt-1">
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'SAVE', name); }}
                                                          disabled={isSaved}
                                                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold transition-all ${isSaved ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'}`}
                                                      >
                                                          {isSaved ? <CheckCircle size={10} /> : <Save size={10} />}
                                                          {isSaved ? '已保存' : '保存 & 生成三视图'}
                                                      </button>
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); onCharacterAction?.(node.id, 'RETRY', name); }}
                                                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                                                      >
                                                          <RotateCcw size={10} /> 重绘表情
                                                      </button>
                                                  </div>
                                              </div>
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
     const isOpen = (isHovered || isInputFocused);
     if (node.type === NodeType.DRAMA_ANALYZER) return null; // No bottom panel for Analyzer

     let models: {l: string, v: string}[] = [];
     if (node.type === NodeType.VIDEO_GENERATOR) {
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
     } else if (node.type === NodeType.CHARACTER_NODE) {
         models = IMAGE_MODELS.map(m => ({l: m.name, v: m.id}));
     } else {
        models = IMAGE_MODELS.map(m => ({l: m.name, v: m.id}));
     }

     return (
        <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[98%] pt-2 z-50 flex flex-col items-center justify-start transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? `opacity-100 translate-y-0 scale-100` : 'opacity-0 translate-y-[-10px] scale-95 pointer-events-none'}`}>
            {hasInputs && onInputReorder && (<div className="w-full flex justify-center mb-2 z-0 relative"><InputThumbnails assets={inputAssets!} onReorder={(newOrder) => onInputReorder(node.id, newOrder)} /></div>)}
            
            <div className={`w-full rounded-[20px] p-1 flex flex-col gap-1 ${GLASS_PANEL} relative z-[100]`} onMouseDown={e => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                
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
                                        <input type="range" min="5" max="100" step="1" value={node.data.scriptEpisodes || 10} onChange={e => onUpdate(node.id, { scriptEpisodes: parseInt(e.target.value) })} className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none cursor-pointer" />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <div className="flex justify-between text-[9px] text-slate-400"><span>单集时长 (分钟)</span><span>{node.data.scriptDuration || 1}</span></div>
                                        <input type="range" min="1" max="5" step="0.5" value={node.data.scriptDuration || 1} onChange={e => onUpdate(node.id, { scriptDuration: parseFloat(e.target.value) })} className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none cursor-pointer" />
                                    </div>
                                </div>
                                <button onClick={handleActionClick} disabled={isWorking} className={`w-full mt-1 flex items-center justify-center gap-2 px-4 py-1.5 rounded-[10px] font-bold text-[10px] tracking-wide transition-all duration-300 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02]'}`}>{isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}<span>生成大纲</span></button>
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
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider px-1">选择章节 (Source Chapter)</span>
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
                            <span>生成分集脚本</span>
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
                        <button onClick={handleActionClick} disabled={isWorking} className={`relative flex items-center gap-2 px-4 py-1.5 rounded-[12px] font-bold text-[10px] tracking-wide transition-all duration-300 ${isWorking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black hover:shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95'}`}>{isWorking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}<span>{isWorking ? '生成中...' : '生成'}</span></button>
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
        onMouseDown={(e) => onNodeMouseDown(e, node.id)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onContextMenu={(e) => onNodeContextMenu(e, node.id)}
    >
        {renderTopBar()}
        <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md ${isConnecting ? 'ring-2 ring-cyan-400 animate-pulse' : ''}`} onMouseDown={(e) => onPortMouseDown(e, node.id, 'input')} onMouseUp={(e) => onPortMouseUp(e, node.id, 'input')} title="Input"><Plus size={10} strokeWidth={3} className="text-white/50" /></div>
        <div className={`absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/20 bg-[#1c1c1e] flex items-center justify-center transition-all duration-300 hover:scale-125 cursor-crosshair z-50 shadow-md ${isConnecting ? 'ring-2 ring-purple-400 animate-pulse' : ''}`} onMouseDown={(e) => onPortMouseDown(e, node.id, 'output')} onMouseUp={(e) => onPortMouseUp(e, node.id, 'output')} title="Output"><Plus size={10} strokeWidth={3} className="text-white/50" /></div>
        <div className="w-full h-full flex flex-col relative rounded-[24px] overflow-hidden bg-zinc-900"><div className="flex-1 min-h-0 relative bg-zinc-900">{renderMediaContent()}</div></div>
        {renderBottomPanel()}
        <div className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-50" onMouseDown={(e) => onResizeMouseDown(e, node.id, nodeWidth, nodeHeight)}><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
    </div>
  );
};

export const Node = memo(NodeComponent, arePropsEqual);
