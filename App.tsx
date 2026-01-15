
// ... existing imports
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from './src/i18n/LanguageContext';
import { Node } from './components/Node';
import { SidebarDock } from './components/SidebarDock';
import { AssistantPanel } from './components/AssistantPanel';
import { ImageCropper } from './components/ImageCropper';
import { SketchEditor } from './components/SketchEditor'; 
import { SmartSequenceDock } from './components/SmartSequenceDock';
import { SonicStudio } from './components/SonicStudio'; 
import { CharacterLibrary } from './components/CharacterLibrary';
import { CharacterDetailModal } from './components/CharacterDetailModal';
import { SettingsPanel } from './components/SettingsPanel';
import { DebugPanel } from './components/DebugPanel';
import { ModelFallbackNotification } from './components/ModelFallbackNotification';
import { AppNode, NodeType, NodeStatus, Connection, ContextMenuState, Group, Workflow, SmartSequenceItem, CharacterProfile, SoraTaskGroup } from './types';
import { generateImageFromText, generateVideo, analyzeVideo, editImageWithText, planStoryboard, orchestrateVideoPrompt, compileMultiFramePrompt, urlToBase64, extractLastFrame, generateAudio, generateScriptPlanner, generateScriptEpisodes, generateCinematicStoryboard, extractCharactersFromText, generateCharacterProfile, detectTextInImage, analyzeDrama } from './services/geminiService';
import { generateSoraVideo, generateMultipleSoraVideos } from './services/soraService';
import { saveVideoFile, saveReferenceImage, saveVideoMetadata, saveUsageLog } from './services/fileSystemService';
import { getSoraModelById } from './services/soraConfigService';
import { generateImageWithFallback } from './services/geminiServiceWithFallback';
import { getGenerationStrategy } from './services/videoStrategies';
import { saveToStorage, loadFromStorage } from './services/storage';
import { getUserPriority, ModelCategory, getDefaultModel, getUserDefaultModel } from './services/modelConfig';
import { saveImageNodeOutput, saveVideoNodeOutput, saveAudioNodeOutput, saveStoryboardGridOutput } from './utils/storageHelper';
import { executeWithFallback } from './services/modelFallback';
import { validateConnection, canExecuteNode } from './utils/nodeValidation';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ConnectionLayer } from './components/ConnectionLayer';
import { CanvasContextMenu } from './components/CanvasContextMenu';
import { ApiKeyPrompt } from './components/ApiKeyPrompt';
import { getNodeIcon, getApproxNodeHeight, getNodeBounds } from './utils/nodeHelpers';
import { useCanvasState } from './hooks/useCanvasState';
import { useNodeOperations } from './hooks/useNodeOperations';
import { useHistory } from './hooks/useHistory';
import {
    Plus, Copy, Trash2, Type, Image as ImageIcon, Video as VideoIcon,
    ScanFace, Brush, MousePointerClick, LayoutTemplate, X, Film, Link, RefreshCw, Upload,
    Minus, FolderHeart, Unplug, Sparkles, ChevronLeft, ChevronRight, Scan, Music, Mic2, Loader2, ScrollText, Clapperboard, User, BookOpen, Languages
} from 'lucide-react';

// ... (Constants, Helpers, ExpandedView UNCHANGED) ...
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SNAP_THRESHOLD = 8; // Pixels for magnetic snap
const COLLISION_PADDING = 24; // Spacing when nodes bounce off each other

// Helper to get image dimensions
const getImageDimensions = (src: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({width: img.width, height: img.height});
        img.onerror = reject;
        img.src = src;
    });
};

const ExpandedView = ({ media, onClose }: { media: any, onClose: () => void }) => {
    // ... (ExpandedView content UNCHANGED) ...
    // Note: Re-pasting full component here is redundant if I can assume context, 
    // but strict format requires full file or changes.
    // Assuming partial replacement is supported for logical blocks, but XML format asks for full file.
    // To save tokens, I'll focus on the App component changes logic.
    // Wait, the prompt says "Full content of file". I must include everything.
    const [visible, setVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    
    useEffect(() => {
        if (media) {
            requestAnimationFrame(() => setVisible(true));
            setCurrentIndex(media.initialIndex || 0);
        } else {
            setVisible(false);
        }
    }, [media]);

    const handleClose = useCallback(() => {
        setVisible(false);
        setTimeout(onClose, 400);
    }, [onClose]);

    const hasMultiple = media?.images && media.images.length > 1;

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasMultiple) {
            setCurrentIndex((prev) => (prev + 1) % media.images.length);
        }
    }, [hasMultiple, media]);

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (hasMultiple) {
            setCurrentIndex((prev) => (prev - 1 + media.images.length) % media.images.length);
        }
    }, [hasMultiple, media]);

    useEffect(() => {
        if (!visible) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, handleClose, handleNext, handlePrev]);

    useEffect(() => {
        if (!media) return;
        const currentSrc = hasMultiple ? media.images[currentIndex] : media.src;
        const isVideo = (media.type === 'video') && !(currentSrc && currentSrc.startsWith('data:image'));

        if (isVideo) {
            if (currentSrc.startsWith('blob:') || currentSrc.startsWith('data:')) {
                setVideoBlobUrl(currentSrc);
                return;
            }
            setIsLoadingVideo(true);
            let active = true;
            fetch(currentSrc)
                .then(res => res.blob())
                .then(blob => {
                    if (active) {
                        const mp4Blob = new Blob([blob], { type: 'video/mp4' });
                        setVideoBlobUrl(URL.createObjectURL(mp4Blob));
                        setIsLoadingVideo(false);
                    }
                })
                .catch(() => { if (active) setIsLoadingVideo(false); });
            return () => { active = false; };
        } else {
            setVideoBlobUrl(null);
        }
    }, [media, currentIndex, hasMultiple]);


    if (!media) return null;
    
    const currentSrc = hasMultiple ? media.images[currentIndex] : media.src;
    const isVideo = (media.type === 'video') && !(currentSrc && currentSrc.startsWith('data:image'));

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ease-[${SPRING}] ${visible ? 'bg-black/90 backdrop-blur-xl' : 'bg-transparent pointer-events-none opacity-0'}`} onClick={handleClose}>
             <div className={`relative w-full h-full flex items-center justify-center p-8 transition-all duration-500 ease-[${SPRING}] ${visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`} onClick={e => e.stopPropagation()}>
                
                {hasMultiple && (
                    <button 
                        onClick={handlePrev}
                        className="absolute left-4 md:left-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}

                <div className="relative max-w-full max-h-full flex flex-col items-center">
                    {!isVideo ? (
                        <img 
                            key={currentSrc} 
                            src={currentSrc} 
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-[#0a0a0c]" 
                            draggable={false} 
                        />
                    ) : (
                        isLoadingVideo || !videoBlobUrl ? (
                            <div className="w-[60vw] h-[40vh] flex items-center justify-center bg-black/50 rounded-lg">
                                <Loader2 className="animate-spin text-white" size={48} />
                            </div>
                        ) : (
                            <video 
                                key={videoBlobUrl} 
                                src={videoBlobUrl} 
                                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in duration-300 bg-black" 
                                controls 
                                autoPlay 
                                playsInline
                            />
                        )
                    )}
                    
                    {hasMultiple && (
                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
                            {media.images.map((_:any, i:number) => (
                                <div 
                                    key={i} 
                                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }} 
                                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${i === currentIndex ? 'bg-cyan-500 scale-125' : 'bg-white/30 hover:bg-white/50'}`} 
                                />
                            ))}
                        </div>
                    )}
                </div>

                {hasMultiple && (
                    <button 
                        onClick={handleNext}
                        className="absolute right-4 md:right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all hover:scale-110 z-[110]"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

             </div>
             <button onClick={handleClose} className="absolute top-6 left-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-[110]"><X size={24} /></button>
        </div>
    );
};

export const App = () => {
  const { language, setLanguage, t } = useLanguage();

  // ========== Hooks: 画布状态管理 ==========
  const canvas = useCanvasState();

  // ========== Hooks: 历史记录管理 ==========
  const historyManager = useHistory(50);

  // ========== 应用状态 ==========
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Long press for canvas drag
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressDraggingRef = useRef(false);

  // Modal States
  const [isSketchEditorOpen, setIsSketchEditorOpen] = useState(false);
  const [isMultiFrameOpen, setIsMultiFrameOpen] = useState(false);
  const [isSonicStudioOpen, setIsSonicStudioOpen] = useState(false);
  const [isCharacterLibraryOpen, setIsCharacterLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiKeyPromptOpen, setIsApiKeyPromptOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [viewingCharacter, setViewingCharacter] = useState<{ character: CharacterProfile, nodeId: string } | null>(null);

  // --- Canvas State (TODO: migrate to useNodeOperations) ---
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [clipboard, setClipboard] = useState<AppNode | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingNodeParentGroupId, setDraggingNodeParentGroupId] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<any>(null);
  const [resizingGroupId, setResizingGroupId] = useState<string | null>(null);
  const [activeGroupNodeIds, setActiveGroupNodeIds] = useState<string[]>([]);
  const [connectionStart, setConnectionStart] = useState<{ id: string, x: number, y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<any>(null);
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [initialSize, setInitialSize] = useState<{width: number, height: number} | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState<{x: number, y: number} | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<any>(null);
  const [expandedMedia, setExpandedMedia] = useState<any>(null);
  const [croppingNodeId, setCroppingNodeId] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  const groupsRef = useRef(groups);
  const connectionStartRef = useRef(connectionStart);
  const rafRef = useRef<number | null>(null); 
  const replaceVideoInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const replacementTargetRef = useRef<string | null>(null);
  
  const dragNodeRef = useRef<{
      id: string, 
      startX: number, 
      startY: number, 
      mouseStartX: number, 
      mouseStartY: number,
      parentGroupId?: string | null,
      siblingNodeIds: string[],
      nodeWidth: number,
      nodeHeight: number
  } | null>(null);

  const resizeContextRef = useRef<{
      nodeId: string,
      initialWidth: number,
      initialHeight: number,
      startX: number,
      startY: number,
      parentGroupId: string | null,
      siblingNodeIds: string[]
  } | null>(null);

  const dragGroupRef = useRef<{
      id: string, 
      startX: number, 
      startY: number, 
      mouseStartX: number, 
      mouseStartY: number,
      childNodes: {id: string, startX: number, startY: number}[]
  } | null>(null);

  useEffect(() => {
      nodesRef.current = nodes;
      connectionsRef.current = connections;
      groupsRef.current = groups;
      connectionStartRef.current = connectionStart;
  }, [nodes, connections, groups, connectionStart]);

  useEffect(() => {
      if (window.aistudio) window.aistudio.hasSelectedApiKey().then(hasKey => { if (!hasKey) window.aistudio.openSelectKey(); });

      // Check if Gemini API Key is configured
      const checkApiKey = () => {
          const apiKey = localStorage.getItem('GEMINI_API_KEY');
          if (!apiKey || !apiKey.trim()) {
              // Show a gentle reminder after a short delay
              setTimeout(() => {
                  console.info('💡 提示：请在右上角设置按钮中配置您的 Gemini API Key 以使用 AI 功能');
              }, 2000);
          }
      };
      checkApiKey();

      const loadData = async () => {
          try {
            const sAssets = await loadFromStorage<any[]>('assets'); if (sAssets) setAssetHistory(sAssets);
            const sWfs = await loadFromStorage<Workflow[]>('workflows'); if (sWfs) setWorkflows(sWfs);
            const sNodes = await loadFromStorage<AppNode[]>('nodes'); if (sNodes) setNodes(sNodes);
            const sConns = await loadFromStorage<Connection[]>('connections'); if (sConns) setConnections(sConns);
            const sGroups = await loadFromStorage<Group[]>('groups'); if (sGroups) setGroups(sGroups);
          } catch (e) {
            console.error("Failed to load storage", e);
          } finally {
            setIsLoaded(true);
          }
      };
      loadData();
  }, []);

  useEffect(() => {
      if (!isLoaded) return; 
      saveToStorage('assets', assetHistory);
      saveToStorage('workflows', workflows);
      saveToStorage('nodes', nodes);
      saveToStorage('connections', connections);
      saveToStorage('groups', groups);
  }, [assetHistory, workflows, nodes, connections, groups, isLoaded]);

  const getNodeNameCN = (type: string) => {
      switch(type) {
          case NodeType.PROMPT_INPUT: return t.nodes.promptInput;
          case NodeType.IMAGE_GENERATOR: return t.nodes.imageGenerator;
          case NodeType.VIDEO_GENERATOR: return t.nodes.videoGenerator;
          case NodeType.AUDIO_GENERATOR: return t.nodes.audioGenerator;
          case NodeType.VIDEO_ANALYZER: return t.nodes.videoAnalyzer;
          case NodeType.IMAGE_EDITOR: return t.nodes.imageEditor;
          case NodeType.SCRIPT_PLANNER: return t.nodes.scriptPlanner;
          case NodeType.SCRIPT_EPISODE: return t.nodes.scriptEpisode;
          case NodeType.STORYBOARD_GENERATOR: return t.nodes.storyboardGenerator;
          case NodeType.STORYBOARD_IMAGE: return '分镜图设计';
          case NodeType.STORYBOARD_SPLITTER: return '分镜图拆解';
          case NodeType.SORA_VIDEO_GENERATOR: return 'Sora 2 视频';
          case NodeType.SORA_VIDEO_CHILD: return 'Sora 2 视频结果';
          case NodeType.CHARACTER_NODE: return t.nodes.characterNode;
          case NodeType.DRAMA_ANALYZER: return '剧目分析';
          case NodeType.DRAMA_REFINED: return '剧目精炼';
          case NodeType.STYLE_PRESET: return '全局风格';
          default: return type;
      }
  };

  // Global error handler for API calls
  const handleApiError = (error: any, nodeId?: string) => {
      const errorMessage = error?.message || String(error);

      // Check if error is due to missing API Key
      if (errorMessage.includes('GEMINI_API_KEY_NOT_CONFIGURED')) {
          // Open API Key prompt dialog
          setIsApiKeyPromptOpen(true);

          // Update node status if nodeId is provided
          if (nodeId) {
              setNodes(prev => prev.map(n =>
                  n.id === nodeId
                      ? {
                          ...n,
                          status: NodeStatus.ERROR,
                          data: { ...n.data, error: '请先配置 Gemini API Key' }
                      }
                      : n
              ));
          }

          return '请先配置 Gemini API Key';
      }

      return errorMessage;
  };

  // Handle API Key save from prompt
  const handleApiKeySave = (apiKey: string) => {
      localStorage.setItem('GEMINI_API_KEY', apiKey);
      setIsApiKeyPromptOpen(false);
      console.info('✅ Gemini API Key 已保存成功！');
  };

  const handleFitView = useCallback(() => {
      if (nodes.length === 0) {
          canvas.resetCanvas();
          return;
      }
      const padding = 100;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(n => {
          const h = n.height || getApproxNodeHeight(n);
          const w = n.width || 420;
          if (n.x < minX) minX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.x + w > maxX) maxX = n.x + w;
          if (n.y + h > maxY) maxY = n.y + h;
      });
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const scaleX = (window.innerWidth - padding * 2) / contentW;
      const scaleY = (window.innerHeight - padding * 2) / contentH;
      let newScale = Math.min(scaleX, scaleY, 1);
      newScale = Math.max(0.2, newScale);
      const contentCenterX = minX + contentW / 2;
      const contentCenterY = minY + contentH / 2;
      const newPanX = (window.innerWidth / 2) - (contentCenterX * newScale);
      const newPanY = (window.innerHeight / 2) - (contentCenterY * newScale);
      canvas.setPan({ x: newPanX, y: newPanY });
      canvas.setScale(newScale);
  }, [nodes, canvas]);

  const saveHistory = useCallback(() => {
      try {
          historyManager.saveToHistory(
              nodesRef.current,
              connectionsRef.current,
              groupsRef.current
          );
      } catch (e) {
          console.warn("History save failed:", e);
      }
  }, [historyManager]);

  const undo = useCallback(() => {
      const prevState = historyManager.undo();
      if (prevState) {
          setNodes(prevState.nodes);
          setConnections(prevState.connections);
          setGroups(prevState.groups);
      }
  }, [historyManager]);

  const deleteNodes = useCallback((ids: string[]) => { 
      if (ids.length === 0) return;
      saveHistory(); 
      setNodes(p => p.filter(n => !ids.includes(n.id)).map(n => ({...n, inputs: n.inputs.filter(i => !ids.includes(i))}))); 
      setConnections(p => p.filter(c => !ids.includes(c.from) && !ids.includes(c.to))); 
      setSelectedNodeIds([]); 
  }, [saveHistory]);

  const addNode = useCallback((type: NodeType, x?: number, y?: number, initialData?: any) => {
      if (type === NodeType.IMAGE_EDITOR) {
          setIsSketchEditorOpen(true);
          return;
      }
      try { saveHistory(); } catch (e) { }

      // 根据节点类型选择合适的默认模型
      const getDefaultModel = () => {
          switch (type) {
              // 视频生成节点
              case NodeType.VIDEO_GENERATOR:
                  return getUserDefaultModel('video');

              // 图片生成节点
              case NodeType.IMAGE_GENERATOR:
              case NodeType.STORYBOARD_IMAGE:
                  return getUserDefaultModel('image');

              // 音频生成节点
              case NodeType.AUDIO_GENERATOR:
                  return getUserDefaultModel('audio');

              // 文本处理节点（分析、剧本等）
              case NodeType.VIDEO_ANALYZER:
              case NodeType.SCRIPT_PLANNER:
              case NodeType.SCRIPT_EPISODE:
              case NodeType.STORYBOARD_GENERATOR:
              case NodeType.CHARACTER_NODE:
              case NodeType.DRAMA_ANALYZER:
              case NodeType.STYLE_PRESET:
                  return getUserDefaultModel('text');

              // 其他节点根据是否包含 IMAGE 判断
              default:
                  return type.includes('IMAGE') ? getUserDefaultModel('image') : getUserDefaultModel('text');
          }
      };

      const defaults: any = {
          model: getDefaultModel(),
          generationMode: type === NodeType.VIDEO_GENERATOR ? 'DEFAULT' : undefined,
          scriptEpisodes: type === NodeType.SCRIPT_PLANNER ? 10 : undefined,
          scriptDuration: type === NodeType.SCRIPT_PLANNER ? 1 : undefined,
          scriptVisualStyle: type === NodeType.SCRIPT_PLANNER ? 'REAL' : undefined,
          episodeSplitCount: type === NodeType.SCRIPT_EPISODE ? 3 : undefined,
          storyboardCount: type === NodeType.STORYBOARD_GENERATOR ? 6 : undefined,
          storyboardDuration: type === NodeType.STORYBOARD_GENERATOR ? 4 : undefined,
          storyboardStyle: type === NodeType.STORYBOARD_GENERATOR ? 'REAL' : undefined,
          ...initialData
      };

      const safeX = x !== undefined ? x : (-canvas.pan.x + window.innerWidth/2)/canvas.scale - 210;
      const safeY = y !== undefined ? y : (-canvas.pan.y + window.innerHeight/2)/canvas.scale - 180;

      const newNode: AppNode = {
        id: `n-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        type,
        x: isNaN(safeX) ? 100 : safeX,
        y: isNaN(safeY) ? 100 : safeY,
        width: 420,
        title: getNodeNameCN(type),
        status: NodeStatus.IDLE,
        data: defaults,
        inputs: []
      };
      setNodes(prev => [...prev, newNode]);
  }, [canvas, saveHistory]);

  const handleAssetGenerated = useCallback((type: 'image' | 'video' | 'audio', src: string, title: string) => {
      setAssetHistory(h => {
          const exists = h.find(a => a.src === src);
          if (exists) return h;
          return [{ id: `a-${Date.now()}`, type, src, title, timestamp: Date.now() }, ...h];
      });
  }, []);
  
  const handleSketchResult = (type: 'image' | 'video', result: string, prompt: string) => {
      const centerX = (-canvas.pan.x + window.innerWidth/2)/canvas.scale - 210;
      const centerY = (-canvas.pan.y + window.innerHeight/2)/canvas.scale - 180;
      if (type === 'image') {
          addNode(NodeType.IMAGE_GENERATOR, centerX, centerY, { image: result, prompt, status: NodeStatus.SUCCESS });
      } else {
          addNode(NodeType.VIDEO_GENERATOR, centerX, centerY, { videoUri: result, prompt, status: NodeStatus.SUCCESS });
      }
      handleAssetGenerated(type, result, prompt || 'Sketch Output');
  };

  const handleMultiFrameGenerate = async (frames: SmartSequenceItem[]): Promise<string> => {
      const complexPrompt = compileMultiFramePrompt(frames as any[]);
      try {
          const res = await generateVideo(
              complexPrompt, 
              'veo-3.1-generate-preview', 
              { aspectRatio: '16:9', count: 1 },
              frames[0].src, 
              null,
              frames.length > 1 ? frames.map(f => f.src) : undefined 
          );
          if (res.isFallbackImage) {
              handleAssetGenerated('image', res.uri, 'Smart Sequence Preview (Fallback)');
          } else {
              handleAssetGenerated('video', res.uri, 'Smart Sequence');
          }
          return res.uri;
      } catch (e: any) {
          throw new Error(e.message || "Smart Sequence Generation Failed");
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        canvas.zoomCanvas(delta, x, y);
      } else {
        canvas.setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (contextMenu) setContextMenu(null);
      setSelectedGroupId(null);

      // Middle click or Shift+Left click for immediate drag
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
          canvas.startCanvasDrag(e.clientX, e.clientY);
          return;
      }

      // Left click on canvas
      if (e.button === 0 && !e.shiftKey) {
          if (e.detail > 1) { e.preventDefault(); return; }

          // Clear selection
          setSelectedNodeIds([]);

          // Start selection rect
          setSelectionRect({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });

          // Setup long press detection (300ms)
          longPressStartPosRef.current = { x: e.clientX, y: e.clientY };
          isLongPressDraggingRef.current = false;

          longPressTimerRef.current = setTimeout(() => {
              // Long press detected - start canvas drag
              if (longPressStartPosRef.current) {
                  isLongPressDraggingRef.current = true;
                  setSelectionRect(null); // Cancel selection rect
                  canvas.startCanvasDrag(longPressStartPosRef.current.x, longPressStartPosRef.current.y);
              }
          }, 300);
      }
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
      const { clientX, clientY } = e;

      // Cancel long press if mouse moves more than 5px
      if (longPressTimerRef.current && longPressStartPosRef.current && !isLongPressDraggingRef.current) {
          const dx = clientX - longPressStartPosRef.current.x;
          const dy = clientY - longPressStartPosRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 5) {
              // Mouse moved too much, cancel long press and allow selection rect
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
              longPressStartPosRef.current = null;
          }
      }

      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          canvas.updateMousePos(clientX, clientY);

          if (selectionRect) {
              setSelectionRect((prev:any) => prev ? ({ ...prev, currentX: clientX, currentY: clientY }) : null);
              return;
          }

          if (dragGroupRef.current) {
              const { id, startX, startY, mouseStartX, mouseStartY, childNodes } = dragGroupRef.current;
              const dx = (clientX - mouseStartX) / canvas.scale;
              const dy = (clientY - mouseStartY) / canvas.scale;
              setGroups(prev => prev.map(g => g.id === id ? { ...g, x: startX + dx, y: startY + dy } : g));
              if (childNodes.length > 0) {
                  setNodes(prev => prev.map(n => {
                      const child = childNodes.find(c => c.id === n.id);
                      return child ? { ...n, x: child.startX + dx, y: child.startY + dy } : n;
                  }));
              }
              return;
          }

          if (canvas.isDraggingCanvas) {
              canvas.dragCanvas(clientX, clientY);
          }

          if (draggingNodeId && dragNodeRef.current && dragNodeRef.current.id === draggingNodeId) {
             const { startX, startY, mouseStartX, mouseStartY, nodeWidth, nodeHeight } = dragNodeRef.current;
             let dx = (clientX - mouseStartX) / canvas.scale;
             let dy = (clientY - mouseStartY) / canvas.scale;
             let proposedX = startX + dx;
             let proposedY = startY + dy;
             const SNAP = SNAP_THRESHOLD / canvas.scale;
             const myL = proposedX; const myC = proposedX + nodeWidth / 2; const myR = proposedX + nodeWidth;
             const myT = proposedY; const myM = proposedY + nodeHeight / 2; const myB = proposedY + nodeHeight;
             let snappedX = false; let snappedY = false;
             nodesRef.current.forEach(other => {
                 if (other.id === draggingNodeId) return;
                 const otherBounds = getNodeBounds(other);
                 if (!snappedX) {
                     if (Math.abs(myL - otherBounds.x) < SNAP) { proposedX = otherBounds.x; snappedX = true; }
                     else if (Math.abs(myL - otherBounds.r) < SNAP) { proposedX = otherBounds.r; snappedX = true; }
                     else if (Math.abs(myR - otherBounds.x) < SNAP) { proposedX = otherBounds.x - nodeWidth; snappedX = true; }
                     else if (Math.abs(myR - otherBounds.r) < SNAP) { proposedX = otherBounds.r - nodeWidth; snappedX = true; }
                     else if (Math.abs(myC - (otherBounds.x+otherBounds.width/2)) < SNAP) { proposedX = (otherBounds.x+otherBounds.width/2) - nodeWidth/2; snappedX = true; }
                 }
                 if (!snappedY) {
                     if (Math.abs(myT - otherBounds.y) < SNAP) { proposedY = otherBounds.y; snappedY = true; }
                     else if (Math.abs(myT - otherBounds.b) < SNAP) { proposedY = otherBounds.b; snappedY = true; }
                     else if (Math.abs(myB - otherBounds.y) < SNAP) { proposedY = otherBounds.y - nodeHeight; snappedY = true; }
                     else if (Math.abs(myB - otherBounds.b) < SNAP) { proposedY = otherBounds.b - nodeHeight; snappedY = true; }
                     else if (Math.abs(myM - (otherBounds.y+otherBounds.height/2)) < SNAP) { proposedY = (otherBounds.y+otherBounds.height/2) - nodeHeight/2; snappedY = true; }
                 }
             });
             setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: proposedX, y: proposedY } : n));
          }

          if (resizingNodeId && initialSize && resizeStartPos) {
              const dx = (clientX - resizeStartPos.x) / canvas.scale;
              const dy = (clientY - resizeStartPos.y) / canvas.scale;
              setNodes(prev => prev.map(n => n.id === resizingNodeId ? { ...n, width: Math.max(360, initialSize.width + dx), height: Math.max(240, initialSize.height + dy) } : n));
          }
      });
  }, [selectionRect, canvas, draggingNodeId, resizingNodeId, initialSize, resizeStartPos]);

  const handleGlobalMouseUp = useCallback(() => {
      // Clear long press timer
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }
      longPressStartPosRef.current = null;
      isLongPressDraggingRef.current = false;

      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (selectionRect) {
          const x = Math.min(selectionRect.startX, selectionRect.currentX);
          const y = Math.min(selectionRect.startY, selectionRect.currentY);
          const w = Math.abs(selectionRect.currentX - selectionRect.startX);
          const h = Math.abs(selectionRect.currentY - selectionRect.startY);
          if (w > 10) {
              const rect = {
                  x: (x - canvas.pan.x) / canvas.scale,
                  y: (y - canvas.pan.y) / canvas.scale,
                  w: w / canvas.scale,
                  h: h / canvas.scale
              };
              const enclosed = nodesRef.current.filter(n => {
                  const cx = n.x + (n.width||420)/2;
                  const cy = n.y + 160;
                  return cx>rect.x && cx<rect.x+rect.w && cy>rect.y && cy<rect.y+rect.h;
              });
              if (enclosed.length > 0) {
                  saveHistory();
                  const freeNodes = enclosed.filter(n => {
                      const cx = n.x + (n.width || 420) / 2;
                      const cy = n.y + 160;
                      return !groupsRef.current.some(g => cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height);
                  });
                  if (freeNodes.length > 0) {
                      const fMinX=Math.min(...freeNodes.map(n=>n.x));
                      const fMinY=Math.min(...freeNodes.map(n=>n.y));
                      const fMaxX=Math.max(...freeNodes.map(n=>n.x+(n.width||420)));
                      const fMaxY=Math.max(...freeNodes.map(n=>n.y+320));
                      setGroups(prev => [...prev, {
                          id: `g-${Date.now()}`,
                          title: '新建分组',
                          x: fMinX-32,
                          y: fMinY-32,
                          width: (fMaxX-fMinX)+64,
                          height: (fMaxY-fMinY)+64
                      }]);
                  }
              }
          }
          setSelectionRect(null);
      }
      if (draggingNodeId) {
          const draggedNode = nodesRef.current.find(n => n.id === draggingNodeId);
          if (draggedNode) {
              const myBounds = getNodeBounds(draggedNode);
              const otherNodes = nodesRef.current.filter(n => n.id !== draggingNodeId);
              for (const other of otherNodes) {
                  const otherBounds = getNodeBounds(other);
                  const isOverlapping = (myBounds.x < otherBounds.r && myBounds.r > otherBounds.x && myBounds.y < otherBounds.b && myBounds.b > otherBounds.y);
                  if (isOverlapping) {
                       const overlapLeft = myBounds.r - otherBounds.x;
                       const overlapRight = otherBounds.r - myBounds.x;
                       const overlapTop = myBounds.b - otherBounds.y;
                       const overlapBottom = otherBounds.b - myBounds.y;
                       const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                       if (minOverlap === overlapLeft) draggedNode.x = otherBounds.x - myBounds.width - COLLISION_PADDING;
                       else if (minOverlap === overlapRight) draggedNode.x = otherBounds.r + COLLISION_PADDING;
                       else if (minOverlap === overlapTop) draggedNode.y = otherBounds.y - myBounds.height - COLLISION_PADDING;
                       else if (minOverlap === overlapBottom) draggedNode.y = otherBounds.b + COLLISION_PADDING;
                       myBounds.x = draggedNode.x;
                       myBounds.y = draggedNode.y;
                       myBounds.r = draggedNode.x + myBounds.width;
                       myBounds.b = draggedNode.y + myBounds.height;
                  }
              }
              setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: draggedNode.x, y: draggedNode.y } : n));
          }
      }
      if (draggingNodeId || resizingNodeId || dragGroupRef.current) saveHistory();
      canvas.endCanvasDrag();
      setDraggingNodeId(null);
      setDraggingNodeParentGroupId(null);
      setDraggingGroup(null);
      setResizingGroupId(null);
      setActiveGroupNodeIds([]);
      setResizingNodeId(null);
      setInitialSize(null);
      setResizeStartPos(null);
      setConnectionStart(null);
      dragNodeRef.current = null;
      resizeContextRef.current = null;
      dragGroupRef.current = null;
  }, [selectionRect, canvas, saveHistory, draggingNodeId, resizingNodeId]);

  useEffect(() => { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); return () => { window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); }; }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  const handleNodeUpdate = useCallback((id: string, data: any, size?: any, title?: string) => {
      setNodes(prev => prev.map(n => {
          if (n.id === id) {
              const updated = { ...n, data: { ...n.data, ...data }, title: title || n.title };

              // Debug log for character updates
              if (data.generatedCharacters) {
                  console.log('[handleNodeUpdate] Updating generatedCharacters:', {
                      nodeId: id,
                      count: data.generatedCharacters.length,
                      characters: data.generatedCharacters.map((c: any) => ({
                          name: c.name,
                          hasExpression: !!c.expressionSheet,
                          hasThreeView: !!c.threeViewSheet
                      }))
                  });
              }

              if (size) { if (size.width) updated.width = size.width; if (size.height) updated.height = size.height; }
              if (data.image) handleAssetGenerated('image', data.image, updated.title);
              if (data.videoUri) handleAssetGenerated('video', data.videoUri, updated.title);
              if (data.audioUri) handleAssetGenerated('audio', data.audioUri, updated.title);
              return updated;
          }
          return n;
      }));
  }, [handleAssetGenerated]);

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
      const file = e.target.files?.[0];
      const targetId = replacementTargetRef.current;
      if (file && targetId) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const result = e.target?.result as string;
              if (type === 'image') handleNodeUpdate(targetId, { image: result });
              else handleNodeUpdate(targetId, { videoUri: result });
          };
          reader.readAsDataURL(file);
      }
      e.target.value = ''; setContextMenu(null); replacementTargetRef.current = null; 
  };

  const getVisualPromptPrefix = (style: string, genre?: string, setting?: string): string => {
      let base = '';
      // Enhanced Visual Style Definitions
      if (style === 'ANIME') {
          base = 'Anime style, Japanese 2D animation, vibrant colors, Studio Ghibli style, clean lines, high detail, 8k resolution, cel shaded, flat color, expressive characters.';
      } else if (style === '3D') {
          base = '3D render, C4D, Pixar style, high fidelity, clay material, unreal engine 5, global illumination, octane render, 8k, volumetric lighting, highly detailed textures.';
      } else {
          // Default to REAL
          base = 'Cinematic, Photorealistic, 8k, raw photo, hyperrealistic, movie still, live action, cinematic lighting, Arri Alexa, depth of field, film grain, color graded.';
      }

      if (genre) base += ` Genre: ${genre}.`;
      if (setting) base += ` Setting: ${setting}.`;
      
      base += " Unified art style, consistent character design across all generated images.";
      return base;
  };

  // Helper to recursively collect upstream context
  const getUpstreamContext = (node: AppNode, allNodes: AppNode[], visited: Set<string> = new Set()): string[] => {
      if (visited.has(node.id)) return [];
      visited.add(node.id);

      const texts: string[] = [];
      const inputs = node.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];

      for (const inputNode of inputs) {
          // Collect content from this node
          if (inputNode.type === NodeType.PROMPT_INPUT && inputNode.data.prompt) {
              texts.push(inputNode.data.prompt);
          } else if (inputNode.type === NodeType.VIDEO_ANALYZER && inputNode.data.analysis) {
              texts.push(inputNode.data.analysis);
          } else if (inputNode.type === NodeType.SCRIPT_EPISODE && inputNode.data.generatedEpisodes) {
              texts.push(inputNode.data.generatedEpisodes.map(ep => `${ep.title}\n角色: ${ep.characters}`).join('\n'));
          } else if (inputNode.type === NodeType.SCRIPT_PLANNER && inputNode.data.scriptOutline) {
              // Include script outline (may contain character backstories)
              texts.push(inputNode.data.scriptOutline);
          } else if (inputNode.type === NodeType.DRAMA_ANALYZER) {
              const selected = inputNode.data.selectedFields || [];
              if (selected.length > 0) {
                  const fieldLabels: Record<string, string> = {
                      dramaIntroduction: '剧集介绍',
                      worldview: '世界观分析',
                      logicalConsistency: '逻辑自洽性',
                      extensibility: '延展性分析',
                      characterTags: '角色标签',
                      protagonistArc: '主角弧光',
                      audienceResonance: '受众共鸣点',
                      artStyle: '画风分析'
                  };
                  const parts = selected.map(fieldKey => {
                      const value = inputNode.data[fieldKey as keyof typeof inputNode.data] as string || '';
                      const label = fieldLabels[fieldKey] || fieldKey;
                      return `【${label}】\n${value}`;
                  });
                  texts.push(parts.join('\n\n'));
              }
          } else if (inputNode.type === NodeType.DRAMA_REFINED && inputNode.data.refinedContent) {
              // Include refined content if available
              const refined = inputNode.data.refinedContent;
              if (refined.characterTags) texts.push(`角色标签: ${refined.characterTags.join(', ')}`);
          }

          // Recursively collect from upstream nodes
          const upstreamTexts = getUpstreamContext(inputNode, allNodes, visited);
          texts.push(...upstreamTexts);
      }

      return texts;
  };

  // Helper to get unified style context from upstream (with recursive tracing)
  const getUpstreamStyleContext = (node: AppNode, allNodes: AppNode[]): { style: string, genre: string, setting: string } => {
      const inputs = node.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];
      let style = node.data.scriptVisualStyle || 'REAL';
      let genre = '';
      let setting = '';

      // Function to recursively find SCRIPT_PLANNER
      const findPlannerRecursive = (currentNode: AppNode, visited: Set<string> = new Set()): AppNode | null => {
          if (visited.has(currentNode.id)) return null;
          visited.add(currentNode.id);

          if (currentNode.type === NodeType.SCRIPT_PLANNER) {
              return currentNode;
          }

          // Check inputs of current node
          const currentInputs = currentNode.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];
          for (const inputNode of currentInputs) {
              const found = findPlannerRecursive(inputNode, visited);
              if (found) return found;
          }

          return null;
      };

      // First, try to find SCRIPT_EPISODE or SCRIPT_PLANNER directly in inputs
      const episodeNode = inputs.find(n => n.type === NodeType.SCRIPT_EPISODE);
      const plannerNode = inputs.find(n => n.type === NodeType.SCRIPT_PLANNER);

      if (episodeNode) {
          if (episodeNode.data.scriptVisualStyle) style = episodeNode.data.scriptVisualStyle;
          // Traverse up to planner if connected to episode
          const parentPlanner = allNodes.find(n => episodeNode.inputs.includes(n.id) && n.type === NodeType.SCRIPT_PLANNER);
          if (parentPlanner) {
              if (parentPlanner.data.scriptVisualStyle) style = parentPlanner.data.scriptVisualStyle;
              genre = parentPlanner.data.scriptGenre || '';
              setting = parentPlanner.data.scriptSetting || '';
          }
      } else if (plannerNode) {
          if (plannerNode.data.scriptVisualStyle) style = plannerNode.data.scriptVisualStyle;
          genre = plannerNode.data.scriptGenre || '';
          setting = plannerNode.data.scriptSetting || '';
      } else {
          // If no direct SCRIPT_EPISODE or SCRIPT_PLANNER found, recursively search upstream
          // This handles cases like: CHARACTER_NODE -> PROMPT_INPUT -> SCRIPT_EPISODE -> SCRIPT_PLANNER
          for (const inputNode of inputs) {
              const foundPlanner = findPlannerRecursive(inputNode);
              if (foundPlanner) {
                  if (foundPlanner.data.scriptVisualStyle) style = foundPlanner.data.scriptVisualStyle;
                  genre = foundPlanner.data.scriptGenre || '';
                  setting = foundPlanner.data.scriptSetting || '';
                  console.log(`[getUpstreamStyleContext] Found SCRIPT_PLANNER recursively:`, {
                      style,
                      genre,
                      setting,
                      plannerId: foundPlanner.id
                  });
                  break;
              }
          }
      }

      return { style, genre, setting };
  };

  // --- Character Action Handler ---
  const handleCharacterAction = async (nodeId: string, action: 'DELETE' | 'SAVE' | 'RETRY' | 'GENERATE_EXPRESSION' | 'GENERATE_THREE_VIEW' | 'GENERATE_SINGLE', charName: string) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (!node) return;

      const generated = [...(node.data.generatedCharacters || [])];
      const extracted = [...(node.data.extractedCharacterNames || [])];

      if (action === 'DELETE') {
          const newExtracted = extracted.filter(n => n !== charName);
          const newGenerated = generated.filter(c => c.name !== charName);
          handleNodeUpdate(nodeId, { extractedCharacterNames: newExtracted, generatedCharacters: newGenerated });
      }
      
      else if (action === 'SAVE') {
          // Trigger 3-View generation if missing, then Save
          let char = generated.find(c => c.name === charName);
          if (!char) return;

          // 1. Check if 3-View needs generation
          if (!char.threeViewSheet) {
              // Update status
              const updatedGenerated = generated.map(c => c.name === charName ? { ...c, isSaved: true } : c); // Hack: use isSaved as loading indicator in UI
              handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });

              // Extract style preset from inputs (priority: STYLE_PRESET > upstream context)
              const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];
              const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
              let stylePrefix = '';

              if (stylePresetNode?.data.stylePrompt) {
                  // Use style preset if connected
                  stylePrefix = stylePresetNode.data.stylePrompt;
              } else {
                  // Fallback to unified helper
                  const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);
                  stylePrefix = getVisualPromptPrefix(style, genre, setting);
              }

              try {
                  const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, username, website, chinese characters, info box, stats, descriptions, annotations";
                  
                  const viewPrompt = `
                  ${stylePrefix}

                  CHARACTER THREE-VIEW GENERATION TASK:
                  Generate a character three-view reference sheet (front, side, back views).

                  Character Description:
                  ${char.appearance}

                  Attributes: ${char.basicStats}

                  COMPOSITION:
                  - Create a vertical layout with 3 views: Front View, Side View (profile), Back View
                  - Full body standing pose, neutral expression
                  - Clean white or neutral background
                  - Each view should clearly show the character from the specified angle

                  CRITICAL REQUIREMENTS:
                  1. CONSISTENT CHARACTER DESIGN - All three views must show the SAME character with consistent facial features, hair style, body proportions, and clothing
                  2. NO TEXT, NO LABELS - Pure image only, no "Front View" or "Side View" text labels, no Chinese characters, no English text
                  3. PROPER ANATOMY - Ensure correct body proportions and natural stance for each view angle
                  4. NEUTRAL EXPRESSION - Use a calm, neutral face expression across all views
                  5. CLEAR ALIGNMENT - Front, side, and back views should be vertically aligned and proportionally consistent

                  ${char.expressionSheet ? 'REFERENCE IMAGE: Use the expression sheet as visual reference for face and clothing details.' : ''}

                  Negative Prompt: ${negativePrompt}, text, labels, writing, letters, watermark, signature, bad anatomy, deformed, low quality, chinese characters, english text, interface elements, stats, info boxes
                  `;
                  
                  // Use Expression Sheet as Input Image reference if available
                  const inputImages = char.expressionSheet ? [char.expressionSheet] : [];
                  
                  let viewImages: string[] = [];
                  let hasText = true;
                  let attempt = 0;
                  const MAX_ATTEMPTS = 3;

                  // Retry Loop
                  while (hasText && attempt < MAX_ATTEMPTS) {
                      if (attempt > 0) {
                          const retryPrompt = viewPrompt + " NO TEXT. NO LABELS. CLEAR BACKGROUND.";
                          viewImages = await generateImageFromText(retryPrompt, getUserDefaultModel('image'), inputImages, { aspectRatio: '16:9', resolution: '2K', count: 1 });
                      } else {
                          viewImages = await generateImageFromText(viewPrompt, getUserDefaultModel('image'), inputImages, { aspectRatio: '16:9', resolution: '2K', count: 1 });
                      }

                      if (viewImages.length > 0) {
                          // Check for text
                          hasText = await detectTextInImage(viewImages[0]);
                          if (hasText) {
                              console.log(`Text detected in generated 3-view (Attempt ${attempt + 1}/${MAX_ATTEMPTS}). Retrying...`);
                          }
                      }
                      attempt++;
                  }
                  
                  // Use the last generated image even if it might still have text (after max retries)
                  // Update char object
                  char = { ...char, threeViewSheet: viewImages[0], isSaved: true }; // Final save state
                  
                  // Update list
                  const finalList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
                  const fIdx = finalList.findIndex(c => c.name === charName);
                  if (fIdx >= 0) finalList[fIdx] = char;
                  handleNodeUpdate(nodeId, { generatedCharacters: finalList });

                  // Save to Library
                  setAssetHistory(h => {
                      const exists = h.find(a => a.id === char!.id);
                      if (exists) return h;
                      return [{ id: char!.id, type: 'character', data: char, title: char!.name, timestamp: Date.now() }, ...h];
                  });

              } catch (e) {
                  console.error("Failed to generate 3-view on save", e);
                  // Revert saved state on error
                  const revertList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
                  const rIdx = revertList.findIndex(c => c.name === charName);
                  if (rIdx >= 0) revertList[rIdx] = { ...revertList[rIdx], isSaved: false };
                  handleNodeUpdate(nodeId, { generatedCharacters: revertList });
              }
          } else {
              // Already has 3-view, just save
              const updatedGenerated = generated.map(c => c.name === charName ? { ...c, isSaved: true } : c);
              handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });
              
              setAssetHistory(h => {
                  const exists = h.find(a => a.id === char!.id);
                  if (exists) return h;
                  return [{ id: char!.id, type: 'character', data: { ...char, isSaved: true }, title: char!.name, timestamp: Date.now() }, ...h];
              });
          }
      } 
      
      else if (action === 'RETRY') {
          // RETRY: Regenerate character profile info only (no images)
          let updatedGenerated = [...generated];

          // Find or create character entry
          let charIdx = updatedGenerated.findIndex(c => c.name === charName);

          // If character doesn't exist in array, add it first
          if (charIdx < 0) {
              const newChar = { id: `${nodeId}-${charName}`, name: charName, status: 'GENERATING' as const } as any;
              updatedGenerated.push(newChar);
              charIdx = updatedGenerated.length - 1;
          } else {
              updatedGenerated[charIdx] = { ...updatedGenerated[charIdx], status: 'GENERATING' as const, error: undefined };
          }

          handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });

          const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];
          const upstreamTexts = inputs.map(n => {
              if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
              if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
              if (n?.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes) {
                  return n.data.generatedEpisodes.map(ep => `${ep.title}\n角色: ${ep.characters}`).join('\n');
              }
              if (n?.type === NodeType.SCRIPT_PLANNER) return n.data.scriptOutline;
              return null;
          }).filter(t => t && t.trim().length > 0) as string[];

          const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
          let stylePrompt = '';

          if (stylePresetNode?.data.stylePrompt) {
              stylePrompt = stylePresetNode.data.stylePrompt;
          } else {
              const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);
              stylePrompt = getVisualPromptPrefix(style, genre, setting);
          }

          const context = upstreamTexts.join('\n');
          const config = node.data.characterConfigs?.[charName] || { method: 'AI_AUTO' };
          const customDesc = config.method === 'AI_CUSTOM' ? config.customPrompt : undefined;

          try {
              const profile = await generateCharacterProfile(
                  charName,
                  context,
                  stylePrompt,
                  customDesc,
                  { nodeId: nodeId, nodeType: node.type }
              );

              // Re-fetch from nodesRef to get latest state after async API call
              const finalList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
              const fIdx = finalList.findIndex(c => c.name === charName);

              if (fIdx >= 0) {
                  // Phase 1 complete
                  // Preserve existing images (expressionSheet, threeViewSheet)
                  const existingChar = finalList[fIdx];
                  finalList[fIdx] = {
                      ...profile,
                      // Preserve existing image data
                      expressionSheet: existingChar?.expressionSheet,
                      threeViewSheet: existingChar?.threeViewSheet,
                      status: 'SUCCESS' as const
                  };
              } else {
                  // Character not in list - add directly with profile data
                  console.warn('[RETRY] Character not found in final list, adding new entry');
                  finalList.push({
                      ...profile,
                      id: `${nodeId}-${charName}`,
                      name: charName,
                      status: 'SUCCESS' as const
                  });
              }
              handleNodeUpdate(nodeId, { generatedCharacters: finalList });
          } catch (e: any) {
              const failList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
              const failIdx = failList.findIndex(c => c.name === charName);
              if (failIdx >= 0) {
                  failList[failIdx] = { ...failList[failIdx], status: 'ERROR', error: e.message };
              } else {
                  // Character not in list, add it with error status
                  failList.push({ id: `${nodeId}-${charName}`, name: charName, status: 'ERROR' as const, error: e.message } as any);
              }
              handleNodeUpdate(nodeId, { generatedCharacters: failList });
          }
      }

      else if (action === 'GENERATE_EXPRESSION') {
          // Phase 2A: Generate expression sheet only
          let char = generated.find(c => c.name === charName);
          if (!char) return;

          // Mark as generating - IMPORTANT: Get FRESH data from nodesRef to avoid stale state
          const freshNode = nodesRef.current.find(n => n.id === nodeId);
          const freshGenerated = freshNode?.data.generatedCharacters || [];
          let updatedGenerated = [...freshGenerated];
          updatedGenerated = updatedGenerated.map(c => c.name === charName ? { ...c, isGeneratingExpression: true } : c);
          handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });

          const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];
          const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
          let stylePrompt = '';

          if (stylePresetNode?.data.stylePrompt) {
              stylePrompt = stylePresetNode.data.stylePrompt;
          } else {
              const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);
              stylePrompt = getVisualPromptPrefix(style, genre, setting);
          }

          // Re-fetch char from updatedGenerated to get latest state
          const latestChar = updatedGenerated.find(c => c.name === charName);
          if (!latestChar) return;

          try {
              const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui";

              let styleNegative = "";
              const { style: detectedStyle } = getUpstreamStyleContext(node, nodesRef.current);
              if (detectedStyle === 'REAL') {
                  styleNegative = ", anime, cartoon, illustrated, 3d render, cgi, painting, drawing";
              } else if (detectedStyle === 'ANIME') {
                  styleNegative = ", photorealistic, realistic, photo, 3d, cgi, live action";
              } else if (detectedStyle === '3D') {
                  styleNegative = ", 2d, flat, anime, photo, painting, illustrated";
              }

              const exprPrompt = `
              ${stylePrompt}

              PORTRAIT COMPOSITION: Extreme close-up, head and shoulders only, facial expressions focus.

              Character facial expressions reference sheet, 3x3 grid layout showing 9 different facial expressions (joy, anger, sorrow, surprise, fear, disgust, neutral, thinking, tired).

              Character Face Description: ${latestChar.appearance}.

              CRITICAL CONSTRAINTS:
              - Close-up portrait shots ONLY (head and shoulders)
              - NO full body, NO lower body, NO legs
              - Focus on facial features, expressions, and head
              - White or neutral background
              - Consistent character design across all 9 expressions
              - 3x3 grid composition

              Negative Prompt: ${negativePrompt}${styleNegative}, full body, standing, legs, feet, full-length portrait, wide shot, environmental background
              `;

              // Use user-configured model priority for image generation
              const userPriority = getUserPriority('image');
              const initialModel = userPriority[0] || getDefaultModel('image');

              console.log('[GENERATE_EXPRESSION] Using model priority:', userPriority);

              const exprImages = await generateImageWithFallback(
                  exprPrompt,
                  initialModel,
                  [],
                  { aspectRatio: '1:1', count: 1 },
                  { nodeId: nodeId, nodeType: node.type }
              );

              console.log('[GENERATE_EXPRESSION] Image generation complete:', {
                  charName,
                  imageCount: exprImages?.length || 0,
                  firstImageLength: exprImages?.[0]?.length || 0
              });

              if (!exprImages || exprImages.length === 0) {
                  throw new Error('表情图生成失败：API未返回图片数据');
              }

              // Update character with expression sheet - use the local updatedGenerated array
              const fIdx = updatedGenerated.findIndex(c => c.name === charName);
              if (fIdx >= 0) {
                  // CRITICAL: Explicitly set all generating states to false
                  const currentChar = updatedGenerated[fIdx];
                  updatedGenerated[fIdx] = {
                      ...currentChar,
                      expressionSheet: exprImages[0],
                      isGeneratingExpression: false,
                      isGeneratingThreeView: false // Also ensure this is false
                  };
                  console.log('[GENERATE_EXPRESSION] Updating character with expression sheet:', {
                      name: updatedGenerated[fIdx].name,
                      hasExpression: !!updatedGenerated[fIdx].expressionSheet,
                      hasThreeView: !!updatedGenerated[fIdx].threeViewSheet,
                      isGeneratingExpression: updatedGenerated[fIdx].isGeneratingExpression,
                      isGeneratingThreeView: updatedGenerated[fIdx].isGeneratingThreeView
                  });
              }
              handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });
          } catch (e: any) {
              // Use the local updatedGenerated array for error handling
              const failIdx = updatedGenerated.findIndex(c => c.name === charName);
              if (failIdx >= 0) {
                  updatedGenerated[failIdx] = { ...updatedGenerated[failIdx], isGeneratingExpression: false, expressionError: e.message };
              }
              handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });
          }
      }

      else if (action === 'GENERATE_THREE_VIEW') {
          // Phase 2B: Generate three-view sheet only
          let char = generated.find(c => c.name === charName);
          if (!char) return;

          console.log('[GENERATE_THREE_VIEW] Starting three-view generation:', {
              charName,
              hasExpressionSheet: !!char.expressionSheet,
              isGeneratingExpression: char.isGeneratingExpression,
              currentThreeView: !!char.threeViewSheet
          });

          // Mark as generating - IMPORTANT: Get FRESH data from nodesRef to avoid stale state
          const freshNode = nodesRef.current.find(n => n.id === nodeId);
          const freshGenerated = freshNode?.data.generatedCharacters || [];
          let updatedGenerated = [...freshGenerated];

          updatedGenerated = updatedGenerated.map(c => {
              if (c.name === charName) {
                  console.log('[GENERATE_THREE_VIEW] Marking as generating, preserving:', {
                      hasExpressionSheet: !!c.expressionSheet,
                      isGeneratingExpression: c.isGeneratingExpression
                  });
                  return { ...c, isGeneratingThreeView: true };
              }
              return c;
          });
          handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });

          const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];
          const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
          let stylePrefix = '';

          if (stylePresetNode?.data.stylePrompt) {
              stylePrefix = stylePresetNode.data.stylePrompt;
          } else {
              const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);
              stylePrefix = getVisualPromptPrefix(style, genre, setting);
          }

          // Re-fetch char from updatedGenerated to get latest state
          const latestChar = updatedGenerated.find(c => c.name === charName);
          if (!latestChar) return;

          // CRITICAL: Require expression sheet to exist before generating three-view
          if (!latestChar.expressionSheet) {
              const error = '请先生成九宫格表情图，再生成三视图。三视图基于九宫格表情图生成。';
              console.log('[GENERATE_THREE_VIEW] Blocked:', error);
              alert(error); // User-friendly notification

              // Update UI to show error state
              const failIdx = updatedGenerated.findIndex(c => c.name === charName);
              if (failIdx >= 0) {
                  updatedGenerated[failIdx] = {
                      ...updatedGenerated[failIdx],
                      isGeneratingThreeView: false,
                      threeViewError: error
                  };
              }
              handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });
              return;
          }

          console.log('[GENERATE_THREE_VIEW] Starting with expression sheet as reference:', {
              charName,
              hasExpressionSheet: !!latestChar.expressionSheet,
              expressionLength: latestChar.expressionSheet?.length || 0
          });

          try {
              const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, username, website, chinese characters, info box, stats, descriptions, annotations";

              const viewPrompt = `
              ${stylePrefix}

              CHARACTER THREE-VIEW GENERATION TASK:
              Generate a character three-view reference sheet (front, side, back views).

              Character Description:
              ${latestChar.appearance}

              Attributes: ${latestChar.basicStats}

              COMPOSITION:
              - Create a vertical layout with 3 views: Front View, Side View (profile), Back View
              - Full body standing pose, neutral expression
              - Clean white or neutral background
              - Each view should clearly show the character from the specified angle

              CRITICAL REQUIREMENTS:
              1. CONSISTENT CHARACTER DESIGN - All three views must show the SAME character with consistent facial features, hair style, body proportions, and clothing
              2. NO TEXT, NO LABELS - Pure image only, no "Front View" or "Side View" text labels, no Chinese characters, no English text
              3. PROPER ANATOMY - Ensure correct body proportions and natural stance for each view angle
              4. NEUTRAL EXPRESSION - Use a calm, neutral face expression across all views
              5. CLEAR ALIGNMENT - Front, side, and back views should be vertically aligned and proportionally consistent

              ${latestChar.expressionSheet ? 'REFERENCE IMAGE: Use the expression sheet as visual reference for face and clothing details.' : ''}

              Negative Prompt: ${negativePrompt}, text, labels, writing, letters, watermark, signature, bad anatomy, deformed, low quality, chinese characters, english text, interface elements, stats, info boxes
              `;

              const inputImages = latestChar.expressionSheet ? [latestChar.expressionSheet] : [];

              // Use user-configured model priority for image generation
              const userPriority = getUserPriority('image');
              const initialModel = userPriority[0] || getDefaultModel('image');

              console.log('[GENERATE_THREE_VIEW] Using model priority:', userPriority);

              let viewImages: string[] = [];
              let hasText = true;
              let attempt = 0;
              const MAX_ATTEMPTS = 3;

              while (hasText && attempt < MAX_ATTEMPTS) {
                  if (attempt > 0) {
                      const retryPrompt = viewPrompt + " NO TEXT. NO LABELS. CLEAR BACKGROUND.";
                      viewImages = await generateImageWithFallback(
                          retryPrompt,
                          initialModel,
                          inputImages,
                          { aspectRatio: '16:9', count: 1 },
                          { nodeId: nodeId, nodeType: node.type }
                      );
                  } else {
                      viewImages = await generateImageWithFallback(
                          viewPrompt,
                          initialModel,
                          inputImages,
                          { aspectRatio: '16:9', count: 1 },
                          { nodeId: nodeId, nodeType: node.type }
                      );
                  }

                  if (viewImages.length > 0) {
                      hasText = await detectTextInImage(viewImages[0]);
                      if (hasText) {
                          console.log(`Text detected in generated 3-view (Attempt ${attempt + 1}/${MAX_ATTEMPTS}). Retrying...`);
                      }
                  }
                  attempt++;
              }

              console.log('[GENERATE_THREE_VIEW] Image generation complete:', {
                  charName,
                  imageCount: viewImages?.length || 0,
                  firstImageLength: viewImages?.[0]?.length || 0,
                  attempts: attempt
              });

              // Update character with three-view sheet - use the local updatedGenerated array
              const fIdx = updatedGenerated.findIndex(c => c.name === charName);
              if (fIdx >= 0) {
                  // CRITICAL: Explicitly preserve isGeneratingExpression = false to prevent UI bug
                  const currentChar = updatedGenerated[fIdx];
                  updatedGenerated[fIdx] = {
                      ...currentChar,
                      threeViewSheet: viewImages[0],
                      isGeneratingThreeView: false,
                      isGeneratingExpression: false // Explicitly set to false to prevent "generating" state in UI
                  };
                  console.log('[GENERATE_THREE_VIEW] Updating character with three-view sheet:', {
                      name: updatedGenerated[fIdx].name,
                      hasThreeView: !!updatedGenerated[fIdx].threeViewSheet,
                      hasExpressionSheet: !!updatedGenerated[fIdx].expressionSheet,
                      isGeneratingExpression: updatedGenerated[fIdx].isGeneratingExpression,
                      isGeneratingThreeView: updatedGenerated[fIdx].isGeneratingThreeView
                  });
              }
              handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });
          } catch (e: any) {
              // Use the local updatedGenerated array for error handling
              const failIdx = updatedGenerated.findIndex(c => c.name === charName);
              if (failIdx >= 0) {
                  updatedGenerated[failIdx] = { ...updatedGenerated[failIdx], isGeneratingThreeView: false, threeViewError: e.message };
              }
              handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });
          }
      }

      else if (action === 'GENERATE_SINGLE') {
          // Generate single character on-demand
          const configs = node.data.characterConfigs || {};
          const config = configs[charName] || { method: 'AI_AUTO' };

          // Get upstream context using recursive tracing
          const recursiveUpstreamTexts = getUpstreamContext(node, nodesRef.current);
          const context = recursiveUpstreamTexts.join('\n');

          console.log('[GENERATE_SINGLE] Collected upstream context:', {
              charName,
              textCount: recursiveUpstreamTexts.length,
              totalLength: context.length
          });

          // Extract style preset from inputs (priority: STYLE_PRESET > upstream context)
          const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];
          const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
          let stylePrompt = '';

          if (stylePresetNode?.data.stylePrompt) {
              stylePrompt = stylePresetNode.data.stylePrompt;
          } else {
              const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);
              stylePrompt = getVisualPromptPrefix(style, genre, setting);
          }

          // Initialize character in GENERATING state
          let charProfile = generated.find(c => c.name === charName);
          if (!charProfile) {
              charProfile = { id: '', name: charName, status: 'GENERATING' } as any;
              generated.push(charProfile!);
          } else {
              charProfile.status = 'GENERATING';
          }
          handleNodeUpdate(nodeId, { generatedCharacters: [...generated] });

          try {
              if (config.method === 'LIBRARY' && config.libraryId) {
                  // Use library character
                  const libChar = assetHistory.find(a => a.id === config.libraryId && a.type === 'character');
                  if (libChar) {
                      const idx = generated.findIndex(c => c.name === charName);
                      generated[idx] = { ...libChar.data, id: `char-inst-${Date.now()}-${charName}`, status: 'SUCCESS' };
                      handleNodeUpdate(nodeId, { generatedCharacters: [...generated] });
                  }
              } else if (config.method === 'SUPPORTING_ROLE') {
                  // Generate supporting character
                  const { generateSupportingCharacter, generateImageFromText, detectTextInImage } = await import('./services/geminiService');

                  const profile = await generateSupportingCharacter(
                      charName,
                      context,
                      stylePrompt,
                      { nodeId: nodeId, nodeType: node.type }
                  );

                  const idx = generated.findIndex(c => c.name === charName);
                  const existingChar = generated[idx];
                  generated[idx] = {
                      ...profile,
                      // Preserve existing image data
                      threeViewSheet: existingChar?.threeViewSheet,
                      status: 'GENERATING' as const,
                      roleType: 'supporting'
                  };
                  handleNodeUpdate(nodeId, { generatedCharacters: [...generated] });

                  // Auto-generate Three-View
                  const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, username, website, chinese characters, info box, stats, descriptions, annotations";

                  const viewPrompt = `
                  ${stylePrompt}

                  CHARACTER THREE-VIEW GENERATION TASK:
                  Generate a character three-view reference sheet (front, side, back views).

                  Character Description:
                  ${profile.appearance}

                  Attributes: ${profile.basicStats}

                  COMPOSITION:
                  - Create a vertical layout with 3 views: Front View, Side View (profile), Back View
                  - Full body standing pose, neutral expression
                  - Clean white or neutral background
                  - Each view should clearly show the character from the specified angle

                  CRITICAL REQUIREMENTS:
                  1. CONSISTENT CHARACTER DESIGN - All three views must show the SAME character with consistent facial features, hair style, body proportions, and clothing
                  2. NO TEXT, NO LABELS - Pure image only, no "Front View" or "Side View" text labels, no Chinese characters, no English text
                  3. PROPER ANATOMY - Ensure correct body proportions and natural stance for each view angle
                  4. NEUTRAL EXPRESSION - Use a calm, neutral face expression across all views
                  5. CLEAR ALIGNMENT - Front, side, and back views should be vertically aligned and proportionally consistent

                  Negative Prompt: ${negativePrompt}, text, labels, writing, letters, watermark, signature, bad anatomy, deformed, low quality, chinese characters, english text, interface elements, stats, info boxes
                  `;

                  let viewImages: string[] = [];
                  let hasText = true;
                  let attempt = 0;
                  const MAX_ATTEMPTS = 3;

                  while (hasText && attempt < MAX_ATTEMPTS) {
                      if (attempt > 0) {
                          const retryPrompt = viewPrompt + " NO TEXT. NO LABELS. CLEAR BACKGROUND.";
                          viewImages = await generateImageFromText(
                              retryPrompt,
                              getUserDefaultModel('image'),
                              [],
                              { aspectRatio: '16:9', resolution: '2K', count: 1 },
                              { nodeId: nodeId, nodeType: node.type }
                          );
                      } else {
                          viewImages = await generateImageFromText(
                              viewPrompt,
                              getUserDefaultModel('image'),
                              [],
                              { aspectRatio: '16:9', resolution: '2K', count: 1 },
                              { nodeId: nodeId, nodeType: node.type }
                          );
                      }

                      if (viewImages.length > 0) {
                          hasText = await detectTextInImage(viewImages[0]);
                          if (hasText) {
                              console.log(`[GENERATE_SINGLE] Text detected in supporting 3-view (Attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
                          }
                      }
                      attempt++;
                  }

                  const finalIdx = generated.findIndex(c => c.name === charName);
                  generated[finalIdx] = {
                      ...generated[finalIdx],
                      threeViewSheet: viewImages[0],
                      status: 'SUCCESS' as const
                  };
                  handleNodeUpdate(nodeId, { generatedCharacters: [...generated] });

              } else {
                  // Generate main character (AI_AUTO or AI_CUSTOM)
                  const customDesc = config.method === 'AI_CUSTOM' ? config.customPrompt : undefined;

                  const profile = await generateCharacterProfile(
                      charName,
                      context,
                      stylePrompt,
                      customDesc,
                      { nodeId: nodeId, nodeType: node.type }
                  );

                  const idx = generated.findIndex(c => c.name === charName);
                  const existingChar = generated[idx];
                  generated[idx] = {
                      ...profile,
                      // Preserve existing image data
                      expressionSheet: existingChar?.expressionSheet,
                      threeViewSheet: existingChar?.threeViewSheet,
                      status: 'SUCCESS' as const,
                      roleType: 'main'
                  };
                  handleNodeUpdate(nodeId, { generatedCharacters: [...generated] });
              }
          } catch (e: any) {
              const idx = generated.findIndex(c => c.name === charName);
              generated[idx] = { ...generated[idx], status: 'ERROR', error: e.message };
              handleNodeUpdate(nodeId, { generatedCharacters: [...generated] });
          }
      }
  };

  // --- Main Action Handler ---
  const handleNodeAction = useCallback(async (id: string, promptOverride?: string) => {
      console.log('[handleNodeAction] Called with id:', id, 'promptOverride:', promptOverride);
      const node = nodesRef.current.find(n => n.id === id);
      console.log('[handleNodeAction] Found node:', node?.type, 'data.prompt length:', node?.data?.prompt?.length);
      if (!node) return;
      handleNodeUpdate(id, { error: undefined });
      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

      try {
          // Handle PROMPT_INPUT storyboard generation
          if (node.type === NodeType.PROMPT_INPUT && promptOverride === 'generate-storyboard') {
              console.log('[handleNodeAction] Entering storyboard generation block');
              const episodeContent = node.data.prompt || '';
              if (!episodeContent || episodeContent.length < 50) {
                  throw new Error('剧本内容太短，无法生成分镜');
              }

              // Extract episode title from content (first line or use default)
              const lines = episodeContent.split('\n');
              const episodeTitle = lines[0].replace(/^#+\s*/, '').trim() || '未命名剧集';

              // Find parent SCRIPT_EPISODE node and its connected SCRIPT_PLANNER to get configured duration
              const parentEpisodeNode = nodesRef.current.find(n => n.type === NodeType.SCRIPT_EPISODE && n.id && node.inputs.includes(n.id));
              let configuredDuration = 60; // default 1 minute in seconds
              let visualStyle: 'REAL' | 'ANIME' | '3D' = 'ANIME';

              if (parentEpisodeNode) {
                  // Find SCRIPT_PLANNER connected to the SCRIPT_EPISODE
                  const plannerNode = nodesRef.current.find(n =>
                      n.type === NodeType.SCRIPT_PLANNER &&
                      parentEpisodeNode.inputs.includes(n.id)
                  );

                  if (plannerNode && plannerNode.data.scriptDuration) {
                      // Convert minutes to seconds
                      configuredDuration = plannerNode.data.scriptDuration * 60;
                      console.log('[Duration] Using configured duration from SCRIPT_PLANNER:', configuredDuration, 'seconds');
                  }

                  if (plannerNode && plannerNode.data.scriptVisualStyle) {
                      visualStyle = plannerNode.data.scriptVisualStyle;
                  }
              }

              const estimatedDuration = configuredDuration;

              // Generate detailed storyboard
              const { generateDetailedStoryboard } = await import('./services/geminiService');

              const shots = await generateDetailedStoryboard(
                  episodeTitle,
                  episodeContent,
                  estimatedDuration,
                  visualStyle
              );

              // Update with complete storyboard
              const storyboard: import('./types').EpisodeStoryboard = {
                  episodeTitle,
                  totalDuration: shots.reduce((sum, shot) => sum + shot.duration, 0),
                  totalShots: shots.length,
                  shots,
                  visualStyle
              };

              handleNodeUpdate(id, { episodeStoryboard: storyboard });
              setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
              return;
          }

          // Handle DRAMA_ANALYZER extract action
          if (node.type === NodeType.DRAMA_ANALYZER && promptOverride === 'extract') {
              const selectedFields = node.data.selectedFields || [];

              if (selectedFields.length === 0) {
                  throw new Error('请先勾选需要提取的分析项');
              }

              // Call AI API to extract refined tags
              const { extractRefinedTags } = await import('./services/geminiService');
              const refinedContent = await extractRefinedTags(node.data, selectedFields);

              // Create new DRAMA_REFINED node
              const newNode: AppNode = {
                  id: `n-refined-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                  type: NodeType.DRAMA_REFINED,
                  x: node.x + (node.width || 420) + 150,
                  y: node.y,
                  width: 420,
                  title: '剧目精炼',
                  status: NodeStatus.SUCCESS,
                  data: {
                      refinedContent,
                      sourceDramaName: node.data.dramaName,
                      sourceNodeId: node.id,
                      selectedFields
                  },
                  inputs: [node.id]
              };

              // Create connection
              const newConnection: Connection = {
                  from: node.id,
                  to: newNode.id
              };

              // Update state
              try { saveHistory(); } catch (e) { }
              setNodes(prev => [...prev, newNode]);
              setConnections(prev => [...prev, newConnection]);

              // Set source node back to SUCCESS
              setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));

              return; // Exit early after extraction
          }

          // Handle SORA_VIDEO_GENERATOR actions
          if (node.type === NodeType.SORA_VIDEO_GENERATOR) {
              const taskGroups = node.data.taskGroups || [];

              // Action: Regenerate prompt for a specific task group
              if (promptOverride?.startsWith('regenerate-prompt:')) {
                  const taskGroupIndex = parseInt(promptOverride.split(':')[1]);
                  const taskGroup = taskGroups[taskGroupIndex];

                  if (!taskGroup) {
                      throw new Error(`未找到任务组 ${taskGroupIndex + 1}`);
                  }

                  console.log('[SORA_VIDEO_GENERATOR] Regenerating AI-enhanced prompt for task group:', taskGroup.taskNumber);

                  // Set node to WORKING status
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING, data: { ...n.data, progress: '正在优化提示词...' } } : n));

                  try {
                    // Use AI to generate enhanced prompt
                    const { buildProfessionalSoraPrompt } = await import('./services/soraPromptBuilder');
                    const newPrompt = await buildProfessionalSoraPrompt(taskGroup.splitShots);

                    // Update the task group's prompt
                    const updatedTaskGroups = [...taskGroups];
                    updatedTaskGroups[taskGroupIndex] = {
                        ...taskGroup,
                        soraPrompt: newPrompt,
                        promptModified: true
                    };

                    handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  } catch (error: any) {
                    console.error('[SORA_VIDEO_GENERATOR] Failed to regenerate prompt:', error);
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR, data: { ...n.data, error: error.message } } : n));
                  }
                  return;
              }

              // Action: Edit shots for a specific task group
              if (promptOverride?.startsWith('edit-shots:')) {
                  const taskGroupIndex = parseInt(promptOverride.split(':')[1]);
                  const taskGroup = taskGroups[taskGroupIndex];

                  if (!taskGroup) {
                      throw new Error(`未找到任务组 ${taskGroupIndex + 1}`);
                  }

                  console.log('[SORA_VIDEO_GENERATOR] Opening shot editor for task group:', taskGroup.taskNumber);
                  // Store the editing state in a temporary location (could use localStorage or a modal state)
                  // For now, we'll just log it - the actual editing UI will need to be implemented separately
                  alert(`分镜编辑功能即将推出\n\n任务组 ${taskGroup.taskNumber} 包含 ${taskGroup.splitShots?.length || 0} 个分镜\n\n您可以先在分镜图拆解节点中编辑，然后重新生成提示词。`);
                  return;
              }

              // Action: Generate video for a specific task group
              if (promptOverride?.startsWith('generate-video:')) {
                  const taskGroupIndex = parseInt(promptOverride.split(':')[1]);
                  const taskGroup = taskGroups[taskGroupIndex];

                  if (!taskGroup) {
                      throw new Error(`未找到任务组 ${taskGroupIndex + 1}`);
                  }

                  console.log('[SORA_VIDEO_GENERATOR] Generating video for task group:', taskGroup.taskNumber);

                  if (!taskGroup.soraPrompt) {
                      throw new Error('请先生成提示词');
                  }

                  // Set to uploading status
                  const updatedTaskGroups = [...taskGroups];
                  updatedTaskGroups[taskGroupIndex] = {
                      ...taskGroup,
                      generationStatus: 'uploading' as const
                  };
                  handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

                  try {
                    const { generateSoraVideo } = await import('./services/soraService');

                    const result = await generateSoraVideo(
                        updatedTaskGroups[taskGroupIndex],
                        (message, progress) => {
                            console.log(`[SORA_VIDEO_GENERATOR] Task ${taskGroup.taskNumber}: ${message} (${progress}%)`);
                        },
                        { nodeId: id, nodeType: node.type }
                    );

                    if (result.status === 'completed') {
                        // Create child node for the video
                        const childNodeId = `n-sora-child-${Date.now()}`;
                        const childNode: AppNode = {
                            id: childNodeId,
                            type: NodeType.SORA_VIDEO_CHILD,
                            x: node.x + (node.width || 420) + 50,
                            y: node.y + (taskGroupIndex * 150),
                            title: `任务组 ${taskGroup.taskNumber}`,
                            status: NodeStatus.SUCCESS,
                            data: {
                                taskGroupId: taskGroup.id,
                                taskNumber: taskGroup.taskNumber,
                                soraPrompt: taskGroup.soraPrompt,
                                videoUrl: result.videoUrl,
                                videoUrlWatermarked: result.videoUrlWatermarked,
                                duration: result.duration,
                                quality: result.quality,
                                isCompliant: result.isCompliant,
                                violationReason: result.violationReason
                            },
                            inputs: [node.id]
                        };

                        const newConnection: Connection = {
                            from: node.id,
                            to: childNodeId
                        };

                        // Update task group with results
                        updatedTaskGroups[taskGroupIndex] = {
                            ...taskGroup,
                            generationStatus: 'completed' as const,
                            progress: 100,
                            videoMetadata: {
                                duration: parseFloat(result.duration || '0'),
                                resolution: '1080p',
                                fileSize: 0,
                                createdAt: new Date()
                            }
                        };

                        saveHistory();
                        setNodes(prev => [...prev, childNode]);
                        setConnections(prev => [...prev, newConnection]);
                    } else {
                        // Generation failed
                        updatedTaskGroups[taskGroupIndex] = {
                            ...taskGroup,
                            generationStatus: 'failed' as const,
                            error: '生成失败，请重试'
                        };
                    }

                    handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));

                  } catch (error: any) {
                    console.error('[SORA_VIDEO_GENERATOR] Failed to generate video:', error);
                    updatedTaskGroups[taskGroupIndex] = {
                        ...taskGroup,
                        generationStatus: 'failed' as const,
                        error: error.message || '生成失败'
                    };
                    handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR, data: { ...n.data, error: error.message } } : n));
                  }
                  return;
              }

              // Action: Fuse reference images for task groups
              if (promptOverride === 'fuse-images') {
                  console.log('[SORA_VIDEO_GENERATOR] Fusing reference images for task groups');

                  if (taskGroups.length === 0) {
                      throw new Error('请先生成任务组和提示词');
                  }

                  // TODO: Implement image fusion logic
                  // For now, just mark as fused
                  const updatedTaskGroups = taskGroups.map(tg => ({
                      ...tg,
                      imageFused: true,
                      generationStatus: 'image_fused' as const
                  }));

                  handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  return;
              }

              // Action: Generate Sora videos for all task groups
              if (promptOverride === 'generate-videos') {
                  console.log('[SORA_VIDEO_GENERATOR] Generating Sora videos for task groups');

                  const taskGroupsToGenerate = taskGroups.filter(tg =>
                      tg.generationStatus === 'prompt_ready' || tg.generationStatus === 'image_fused'
                  );

                  if (taskGroupsToGenerate.length === 0) {
                      throw new Error('没有可生成的任务组，请先完成提示词生成');
                  }

                  // Update all task groups to 'uploading' status
                  const uploadingGroups = taskGroups.map(tg =>
                      taskGroupsToGenerate.find(t => t.id === tg.id)
                          ? { ...tg, generationStatus: 'uploading' as const }
                          : tg
                  );
                  handleNodeUpdate(id, { taskGroups: uploadingGroups });

                  // Generate videos for each task group
                  const results = await generateMultipleSoraVideos(
                      taskGroupsToGenerate,
                      (index, message, progress) => {
                          console.log(`[SORA_VIDEO_GENERATOR] Task ${index + 1}/${taskGroupsToGenerate.length}: ${message} (${progress}%)`);
                      },
                      { nodeId: id, nodeType: node.type }
                  );

                  // Create child nodes for completed videos
                  const newChildNodes: AppNode[] = [];
                  const newConnections: Connection[] = [];

                  results.forEach((result, index) => {
                      const taskGroup = taskGroupsToGenerate[index];
                      if (result.status === 'completed' && result.videoUrl) {
                          // Create child node
                          const childNodeId = `n-sora-child-${Date.now()}-${index}`;
                          const childNode: AppNode = {
                              id: childNodeId,
                              type: NodeType.SORA_VIDEO_CHILD,
                              x: node.x + (node.width || 420) + 50,
                              y: node.y + (index * 150),
                              title: `任务组 ${taskGroup.taskNumber}`,
                              status: NodeStatus.SUCCESS,
                              data: {
                                  taskGroupId: taskGroup.id,
                                  taskNumber: taskGroup.taskNumber,
                                  soraPrompt: taskGroup.soraPrompt,
                                  videoUrl: result.videoUrl,
                                  videoUrlWatermarked: result.videoUrlWatermarked,
                                  duration: result.duration,
                                  quality: result.quality,
                                  isCompliant: result.isCompliant,
                                  violationReason: result.violationReason
                              },
                              inputs: [node.id]
                          };
                          newChildNodes.push(childNode);
                          newConnections.push({ from: node.id, to: childNodeId });
                      }
                  });

                  // Update task groups with results
                  const finalTaskGroups = taskGroups.map(tg => {
                      const result = results.get(tg.id);
                      if (result) {
                          return {
                              ...tg,
                              generationStatus: result.status === 'completed' ? 'completed' as const : 'failed' as const,
                              progress: result.status === 'completed' ? 100 : 0,
                              error: result.status === 'error' ? '生成失败' : undefined,
                              videoMetadata: result.status === 'completed' ? {
                                  duration: parseFloat(result.duration || '0'),
                                  resolution: '1080p',
                                  fileSize: 0,
                                  createdAt: new Date()
                              } : undefined
                          };
                      }
                      return tg;
                  });

                  // Add child nodes to canvas
                  if (newChildNodes.length > 0) {
                      try { saveHistory(); } catch (e) { }
                      setNodes(prev => [...prev, ...newChildNodes]);
                      setConnections(prev => [...prev, ...newConnections]);
                  }

                  handleNodeUpdate(id, { taskGroups: finalTaskGroups });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  return;
              }

              // Action: Regenerate all videos
              if (promptOverride === 'regenerate-all') {
                  console.log('[SORA_VIDEO_GENERATOR] Regenerating all videos');

                  // Reset all task groups to prompt_ready status
                  const updatedTaskGroups = taskGroups.map(tg => ({
                      ...tg,
                      generationStatus: 'prompt_ready' as const,
                      progress: 0,
                      error: undefined,
                      videoMetadata: undefined
                  }));

                  handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

                  // Remove all existing child nodes
                  const childNodes = nodesRef.current.filter(n =>
                      n.type === NodeType.SORA_VIDEO_CHILD && n.inputs.includes(id)
                  );

                  if (childNodes.length > 0) {
                      const childNodeIds = childNodes.map(n => n.id);
                      const connectionsToRemove = connectionsRef.current.filter(c =>
                          childNodeIds.includes(c.from) || childNodeIds.includes(c.to)
                      );

                      setNodes(prev => prev.filter(n => !childNodeIds.includes(n.id)));
                      setConnections(prev => prev.filter(c =>
                          !connectionsToRemove.includes(c)
                      ));
                  }

                  try { saveHistory(); } catch (e) { }

                  // Trigger video generation for all task groups
                  setTimeout(async () => {
                      const results = await generateMultipleSoraVideos(
                          updatedTaskGroups,
                          (index, message, progress) => {
                              console.log(`[SORA_VIDEO_GENERATOR] Task ${index + 1}/${updatedTaskGroups.length}: ${message} (${progress}%)`);
                          },
                          { nodeId: id, nodeType: node.type }
                      );

                      const finalTaskGroups = updatedTaskGroups.map((tg, index) => {
                          const result = results.find(r => r.taskGroupId === tg.id);
                          if (result) {
                              return {
                                  ...tg,
                                  generationStatus: result.status === 'completed' ? 'completed' as const : 'failed' as const,
                                  progress: result.status === 'completed' ? 100 : 0,
                                  error: result.status === 'error' ? '生成失败' : undefined,
                                  videoMetadata: result.status === 'completed' ? {
                                      duration: parseFloat(result.duration || '0'),
                                      resolution: '1080p',
                                      fileSize: 0,
                                      createdAt: new Date()
                                  } : undefined
                              };
                          }
                          return tg;
                      });

                      // Create child nodes for successfully generated videos
                      const newChildNodes: AppNode[] = [];
                      const newConnections: Connection[] = [];

                      results.forEach((result, index) => {
                          if (result.status === 'completed') {
                              const childNodeId = `n-sora-child-${Date.now()}-${index}`;
                              const taskGroup = updatedTaskGroups[index];

                              const childNode: AppNode = {
                                  id: childNodeId,
                                  type: NodeType.SORA_VIDEO_CHILD,
                                  x: node.x + (node.width || 420) + 50,
                                  y: node.y + (index * 150),
                                  title: `任务组 ${taskGroup.taskNumber}`,
                                  status: NodeStatus.SUCCESS,
                                  data: {
                                      taskGroupId: taskGroup.id,
                                      taskNumber: taskGroup.taskNumber,
                                      soraPrompt: taskGroup.soraPrompt,
                                      videoUrl: result.videoUrl,
                                      videoUrlWatermarked: result.videoUrlWatermarked,
                                      duration: result.duration,
                                      quality: result.quality,
                                      isCompliant: result.isCompliant,
                                      violationReason: result.violationReason
                                  },
                                  inputs: [node.id]
                              };

                              const newConnection: Connection = {
                                  from: node.id,
                                  to: childNodeId
                              };

                              newChildNodes.push(childNode);
                              newConnections.push(newConnection);
                          }
                      });

                      if (newChildNodes.length > 0) {
                          try { saveHistory(); } catch (e) { }
                          setNodes(prev => [...prev, ...newChildNodes]);
                          setConnections(prev => [...prev, ...newConnections]);
                      }

                      handleNodeUpdate(id, { taskGroups: finalTaskGroups });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  }, 100);

                  return;
              }
          }

          // Handle SORA_VIDEO_CHILD node actions (save video locally)
          if (node.type === NodeType.SORA_VIDEO_CHILD && promptOverride === 'save-locally') {
              const videoUrl = node.data.videoUrl;
              if (!videoUrl) {
                  throw new Error('未找到视频URL');
              }

              console.log('[SORA_VIDEO_CHILD] Saving video locally');

              // Get parent node to retrieve task group info
              const parentNode = nodesRef.current.find(n => n.id === node.inputs[0]);
              if (!parentNode || parentNode.type !== NodeType.SORA_VIDEO_GENERATOR) {
                  throw new Error('未找到父节点');
              }

              const taskGroups = parentNode.data.taskGroups || [];
              const taskGroup = taskGroups.find((tg: any) => tg.id === node.data.taskGroupId);
              if (!taskGroup) {
                  throw new Error('未找到任务组信息');
              }

              // Save video file
              const filePath = await saveVideoFile(videoUrl, taskGroup, false);

              // Save metadata
              const result: any = {
                  taskId: node.data.taskGroupId,
                  status: 'completed',
                  videoUrl: videoUrl,
                  duration: node.data.duration,
                  quality: node.data.quality,
                  isCompliant: node.data.isCompliant
              };
              await saveVideoMetadata(taskGroup, result);

              handleNodeUpdate(id, {
                  videoFilePath: filePath,
                  locallySaved: true
              });
              setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
              return;
          }

          const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];

          const upstreamTexts = inputs.map(n => {
              if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
              if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
              if (n?.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes) {
                  // 只传递角色列表和标题，不传完整剧本内容
                  return n.data.generatedEpisodes.map(ep => `${ep.title}\n角色: ${ep.characters}`).join('\n');
              }
              if (n?.type === NodeType.SCRIPT_PLANNER) return n.data.scriptOutline;
              if (n?.type === NodeType.DRAMA_ANALYZER) {
                  const selected = n.data.selectedFields || [];
                  if (selected.length === 0) return null;

                  const fieldLabels: Record<string, string> = {
                      dramaIntroduction: '剧集介绍',
                      worldview: '世界观分析',
                      logicalConsistency: '逻辑自洽性',
                      extensibility: '延展性分析',
                      characterTags: '角色标签',
                      protagonistArc: '主角弧光',
                      audienceResonance: '受众共鸣点',
                      artStyle: '画风分析'
                  };

                  const parts = selected.map(fieldKey => {
                      const value = n.data[fieldKey as keyof typeof n.data] as string || '';
                      const label = fieldLabels[fieldKey] || fieldKey;
                      return `【${label}】\n${value}`;
                  });

                  return parts.join('\n\n');
              }
              return null;
          }).filter(t => t && t.trim().length > 0) as string[];

          let prompt = promptOverride || node.data.prompt || '';
          if (upstreamTexts.length > 0) {
              const combinedUpstream = upstreamTexts.join('\n\n');
              prompt = prompt ? `${combinedUpstream}\n\n${prompt}` : combinedUpstream;
          }

          if (node.type === NodeType.DRAMA_ANALYZER) {
              // --- Drama Analyzer Logic ---
              const dramaName = node.data.dramaName?.trim();
              if (!dramaName) {
                  throw new Error("请输入剧名");
              }

              const analysis = await analyzeDrama(dramaName);

              // Spread all analysis fields into node data
              handleNodeUpdate(id, {
                  dramaIntroduction: analysis.dramaIntroduction,
                  worldview: analysis.worldview,
                  logicalConsistency: analysis.logicalConsistency,
                  extensibility: analysis.extensibility,
                  characterTags: analysis.characterTags,
                  protagonistArc: analysis.protagonistArc,
                  audienceResonance: analysis.audienceResonance,
                  artStyle: analysis.artStyle,
                  selectedFields: [] // Initialize empty selection
              });

          } else if (node.type === NodeType.CHARACTER_NODE) {
              // --- Character Node Generation Logic ---

              // For character name extraction: Use ONLY direct inputs (not recursive)
              const directUpstreamTexts = inputs.map(n => {
                  if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
                  if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
                  if (n?.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes) {
                      return n.data.generatedEpisodes.map(ep => `${ep.title}\n角色: ${ep.characters}`).join('\n');
                  }
                  if (n?.type === NodeType.SCRIPT_PLANNER) return n.data.scriptOutline;
                  if (n?.type === NodeType.DRAMA_ANALYZER) {
                      const selected = n.data.selectedFields || [];
                      if (selected.length === 0) return null;
                      const fieldLabels: Record<string, string> = {
                          dramaIntroduction: '剧集介绍',
                          worldview: '世界观分析',
                          logicalConsistency: '逻辑自洽性',
                          extensibility: '延展性分析',
                          characterTags: '角色标签',
                          protagonistArc: '主角弧光',
                          audienceResonance: '受众共鸣点',
                          artStyle: '画风分析'
                      };
                      const parts = selected.map(fieldKey => {
                          const value = n.data[fieldKey as keyof typeof n.data] as string || '';
                          const label = fieldLabels[fieldKey] || fieldKey;
                          return `【${label}】\n${value}`;
                      });
                      return parts.join('\n\n');
                  }
                  return null;
              }).filter(t => t && t.trim().length > 0) as string[];

              // For character info generation: Use recursive upstream context (includes SCRIPT_PLANNER, etc.)
              const recursiveUpstreamTexts = getUpstreamContext(node, nodesRef.current);

              console.log('[CHARACTER_NODE] Context collection:', {
                  nodeId: id,
                  directTextCount: directUpstreamTexts.length,
                  recursiveTextCount: recursiveUpstreamTexts.length,
                  directLength: directUpstreamTexts.join('\n').length,
                  recursiveLength: recursiveUpstreamTexts.join('\n').length
              });

              if (!node.data.extractedCharacterNames || node.data.extractedCharacterNames.length === 0) {
                  // STEP 1: Extract character names from DIRECT inputs only
                  if (directUpstreamTexts.length > 0) {
                      const allCharacterNames: string[] = [];

                      for (const text of directUpstreamTexts) {
                          const names = await extractCharactersFromText(text);
                          allCharacterNames.push(...names);
                      }

                      const uniqueNames = Array.from(new Set(allCharacterNames.map(name => name.trim()))).filter(name => name.length > 0);

                      console.log('[CHARACTER_NODE] Extracted characters from DIRECT inputs only:', {
                          inputCount: directUpstreamTexts.length,
                          characters: uniqueNames
                      });

                      handleNodeUpdate(id, { extractedCharacterNames: uniqueNames, characterConfigs: {} });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                      return;
                  } else {
                      throw new Error("请先连接剧本大纲或剧本分集节点");
                  }
              }

              // STEP 2: Generate character info using RECURSIVE context (includes all upstream content)
              const names = node.data.extractedCharacterNames || [];
              const configs = node.data.characterConfigs || {};
              const generatedChars = node.data.generatedCharacters || [];
              const newGeneratedChars = [...generatedChars];

              // Extract style preset from inputs (priority: STYLE_PRESET > upstream context)
              const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
              let stylePrompt = '';

              if (stylePresetNode?.data.stylePrompt) {
                  // Use style preset if connected
                  stylePrompt = stylePresetNode.data.stylePrompt;
              } else {
                  // Fallback to unified helper
                  const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);
                  stylePrompt = getVisualPromptPrefix(style, genre, setting);
              }

              for (const name of names) {
                  const config = configs[name] || { method: 'AI_AUTO' };

                  // Skip if already generated successfully or is currently being processed
                  const existingChar = newGeneratedChars.find(c => c.name === name);
                  if (existingChar && (existingChar.status === 'SUCCESS' || existingChar.isGeneratingExpression || existingChar.isGeneratingThreeView)) {
                      console.log('[CHARACTER_NODE] Skipping character:', name, 'status:', existingChar.status);
                      continue;
                  }

                  // Only regenerate if explicitly in ERROR state or doesn't exist
                  if (existingChar && existingChar.status === 'ERROR') {
                      console.log('[CHARACTER_NODE] Regenerating ERROR character:', name);
                  } else if (existingChar && existingChar.status !== 'PENDING') {
                      // Skip if character exists and is not in an error state
                      console.log('[CHARACTER_NODE] Skipping existing character:', name, 'status:', existingChar.status);
                      continue;
                  }

                  let charProfile = existingChar;
                  if (!charProfile) {
                      charProfile = { id: '', name, status: 'GENERATING' } as any;
                      newGeneratedChars.push(charProfile!);
                  } else {
                      charProfile.status = 'GENERATING';
                  }
                  handleNodeUpdate(id, { generatedCharacters: [...newGeneratedChars] });

                  if (config.method === 'LIBRARY' && config.libraryId) {
                      const libChar = assetHistory.find(a => a.id === config.libraryId && a.type === 'character');
                      if (libChar) {
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          newGeneratedChars[idx] = { ...libChar.data, id: `char-inst-${Date.now()}-${name}`, status: 'SUCCESS' };
                      }
                  } else if (config.method === 'SUPPORTING_ROLE') {
                      // SUPPORTING CHARACTER: Use recursive context for generation
                      const context = recursiveUpstreamTexts.join('\n');

                      console.log('[CHARACTER_NODE] Generating supporting character with recursive context:', {
                          name,
                          contextLength: context.length
                      });

                      try {
                          // Import the supporting character generator
                          const { generateSupportingCharacter, generateImageFromText, detectTextInImage } = await import('./services/geminiService');

                          // Step 1: Generate simplified profile
                          const profile = await generateSupportingCharacter(
                              name,
                              context,
                              stylePrompt,
                              { nodeId: id, nodeType: node.type }
                          );

                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          const existingChar = newGeneratedChars[idx];
                          newGeneratedChars[idx] = {
                              ...profile,
                              // Preserve existing image data
                              threeViewSheet: existingChar?.threeViewSheet,
                              status: 'GENERATING' as const,
                              roleType: 'supporting'
                          };
                          handleNodeUpdate(id, { generatedCharacters: [...newGeneratedChars] });

                          console.log('[CHARACTER_NODE] Supporting character profile generated, now generating three-view...');

                          // Step 2: Auto-generate Three-View (no expression sheet for supporting chars)
                          const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, username, website, chinese characters, info box, stats, descriptions, annotations";

                          const viewPrompt = `
                          ${stylePrompt}

                          CHARACTER THREE-VIEW GENERATION TASK:
                          Generate a character three-view reference sheet (front, side, back views).

                          Character Description:
                          ${profile.appearance}

                          Attributes: ${profile.basicStats}

                          COMPOSITION:
                          - Create a vertical layout with 3 views: Front View, Side View (profile), Back View
                          - Full body standing pose, neutral expression
                          - Clean white or neutral background
                          - Each view should clearly show the character from the specified angle

                          CRITICAL REQUIREMENTS:
                          1. CONSISTENT CHARACTER DESIGN - All three views must show the SAME character with consistent facial features, hair style, body proportions, and clothing
                          2. NO TEXT, NO LABELS - Pure image only, no "Front View" or "Side View" text labels, no Chinese characters, no English text
                          3. PROPER ANATOMY - Ensure correct body proportions and natural stance for each view angle
                          4. NEUTRAL EXPRESSION - Use a calm, neutral face expression across all views
                          5. CLEAR ALIGNMENT - Front, side, and back views should be vertically aligned and proportionally consistent

                          Negative Prompt: ${negativePrompt}, text, labels, writing, letters, watermark, signature, bad anatomy, deformed, low quality, chinese characters, english text, interface elements, stats, info boxes
                          `;

                          let viewImages: string[] = [];
                          let hasText = true;
                          let attempt = 0;
                          const MAX_ATTEMPTS = 3;

                          while (hasText && attempt < MAX_ATTEMPTS) {
                              if (attempt > 0) {
                                  const retryPrompt = viewPrompt + " NO TEXT. NO LABELS. CLEAR BACKGROUND.";
                                  viewImages = await generateImageFromText(
                                      retryPrompt,
                                      'gemini-2.0-flash-exp',
                                      [],
                                      { aspectRatio: '16:9', resolution: '2K', count: 1 },
                                      { nodeId: id, nodeType: node.type }
                                  );
                              } else {
                                  viewImages = await generateImageFromText(
                                      viewPrompt,
                                      'gemini-2.0-flash-exp',
                                      [],
                                      { aspectRatio: '16:9', resolution: '2K', count: 1 },
                                      { nodeId: id, nodeType: node.type }
                                  );
                              }

                              if (viewImages.length > 0) {
                                  hasText = await detectTextInImage(viewImages[0]);
                                  if (hasText) {
                                      console.log(`Text detected in supporting character 3-view (Attempt ${attempt + 1}/${MAX_ATTEMPTS}). Retrying...`);
                                  }
                              }
                              attempt++;
                          }

                          // Update with three-view
                          const finalIdx = newGeneratedChars.findIndex(c => c.name === name);
                          newGeneratedChars[finalIdx] = {
                              ...newGeneratedChars[finalIdx],
                              threeViewSheet: viewImages[0],
                              status: 'SUCCESS' as const,
                              isGeneratingExpression: false, // Explicitly set
                              isGeneratingThreeView: false  // Explicitly set
                          };

                          console.log('[CHARACTER_NODE] Supporting character complete (profile + three-view):', {
                              name,
                              hasThreeView: !!viewImages[0],
                              roleType: 'supporting'
                          });
                      } catch (e: any) {
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          newGeneratedChars[idx] = { ...newGeneratedChars[idx], status: 'ERROR', error: e.message };
                      }
                  } else {
                      const context = recursiveUpstreamTexts.join('\n');
                      const customDesc = config.method === 'AI_CUSTOM' ? config.customPrompt : undefined;

                      try {
                          // PHASE 1: Generate character profile info only (no images)
                          // Use style prompt from STYLE_PRESET or upstream context
                          const profile = await generateCharacterProfile(
                              name,
                              context,
                              stylePrompt,
                              customDesc,
                              { nodeId: id, nodeType: node.type }
                          );

                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          // ✅ Phase 1 complete - user can review info
                          // Preserve existing images (expressionSheet, threeViewSheet)
                          const existingChar = newGeneratedChars[idx];
                          newGeneratedChars[idx] = {
                              ...profile,
                              // Preserve existing image data
                              expressionSheet: existingChar?.expressionSheet,
                              threeViewSheet: existingChar?.threeViewSheet,
                              status: 'SUCCESS' as const,
                              roleType: 'main',
                              isGeneratingExpression: false, // Explicitly set
                              isGeneratingThreeView: false  // Explicitly set
                          };
                          console.log('[CHARACTER_NODE] Profile generated successfully:', {
                              name,
                              status: newGeneratedChars[idx].status,
                              hasProfile: !!newGeneratedChars[idx],
                              profession: newGeneratedChars[idx].profession,
                              personality: newGeneratedChars[idx].personality?.substring(0, 50)
                          });
                          // No expression sheet or three-view generation here
                          // User will generate them on-demand in the detail modal
                      } catch (e: any) {
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          newGeneratedChars[idx] = { ...newGeneratedChars[idx], status: 'ERROR', error: e.message };
                      }
                  }

                  // Update after each character is processed (for real-time feedback)
                  handleNodeUpdate(id, { generatedCharacters: [...newGeneratedChars] });
              }

          } else if (node.type === NodeType.STYLE_PRESET) {
              // --- Style Preset Generation Logic ---

              // Extract upstream style information
              let artStyle = '';
              let visualStyle: 'REAL' | 'ANIME' | '3D' = 'ANIME';
              let genre = '';
              let setting = '';

              // Merge from all upstream nodes
              for (const input of inputs) {
                  if (input.type === NodeType.DRAMA_ANALYZER && input.data.artStyle) {
                      artStyle = input.data.artStyle;
                  }
                  if (input.type === NodeType.SCRIPT_PLANNER) {
                      if (input.data.scriptVisualStyle) visualStyle = input.data.scriptVisualStyle;
                      if (input.data.scriptGenre) genre = input.data.scriptGenre;
                      if (input.data.scriptSetting) setting = input.data.scriptSetting;
                  }
                  if (input.type === NodeType.DRAMA_REFINED && input.data.refinedContent) {
                      // Extract from refined content if available
                      const refined = input.data.refinedContent;
                      if (refined.artStyle && refined.artStyle.length > 0) {
                          artStyle = refined.artStyle.join(', ');
                      }
                  }
              }

              // Get user configuration
              const presetType = node.data.stylePresetType || 'SCENE'; // 'SCENE' or 'CHARACTER'
              const userInput = node.data.styleUserInput || '';

              // Generate style preset
              const { generateStylePreset } = await import('./services/geminiService');
              const result = await generateStylePreset(
                  presetType,
                  visualStyle,
                  { artStyle, genre, setting },
                  userInput
              );

              handleNodeUpdate(id, {
                  stylePrompt: result.stylePrompt,
                  negativePrompt: result.negativePrompt,
                  visualStyle // Store for reference
              });

          } else if (node.type === NodeType.SCRIPT_PLANNER) {
              // 检查是否有连接的 DRAMA_REFINED 节点
              const refinedNode = inputs.find(n => n.type === NodeType.DRAMA_REFINED);
              const refinedInfo = refinedNode?.data.refinedContent;

              const outline = await generateScriptPlanner(prompt, {
                  theme: node.data.scriptTheme,
                  genre: node.data.scriptGenre,
                  setting: node.data.scriptSetting,
                  episodes: node.data.scriptEpisodes,
                  duration: node.data.scriptDuration,
                  visualStyle: node.data.scriptVisualStyle // Pass Visual Style
              }, refinedInfo, node.data.model || getUserDefaultModel('text')); // 传入精炼信息作为参考和模型
              handleNodeUpdate(id, { scriptOutline: outline });

          } else if (node.type === NodeType.SCRIPT_EPISODE) {
              const planner = inputs.find(n => n.type === NodeType.SCRIPT_PLANNER);
              if (!planner || !planner.data.scriptOutline) throw new Error("Need connected Script Planner with outline");

              if (!node.data.selectedChapter) throw new Error("Please select a chapter first");

              // Inherit style if not set or updated
              let currentStyle = node.data.scriptVisualStyle;
              if (!currentStyle && planner.data.scriptVisualStyle) {
                  currentStyle = planner.data.scriptVisualStyle;
                  handleNodeUpdate(id, { scriptVisualStyle: currentStyle });
              }

              // Collect previous episodes from all SCRIPT_EPISODE nodes that come before this one
              // This ensures continuity across episodes
              const allScriptEpisodeNodes = nodesRef.current.filter(
                  n => n.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes && n.data.generatedEpisodes.length > 0
              );

              const previousEpisodes = allScriptEpisodeNodes.flatMap(n => n.data.generatedEpisodes);

              console.log('[SCRIPT_EPISODE] Generating with context:', {
                  currentChapter: node.data.selectedChapter,
                  totalPreviousEpisodes: previousEpisodes.length,
                  hasGlobalCharacters: planner.data.scriptOutline.includes('主要人物小传'),
                  hasGlobalItems: planner.data.scriptOutline.includes('关键物品设定')
              });

              const episodes = await generateScriptEpisodes(
                  planner.data.scriptOutline,
                  node.data.selectedChapter,
                  node.data.episodeSplitCount || 3,
                  planner.data.scriptDuration || 1,
                  currentStyle, // Pass Visual Style
                  node.data.episodeModificationSuggestion, // Pass Modification Suggestion
                  node.data.model || getUserDefaultModel('text'), // Pass Model
                  previousEpisodes // Pass previous episodes for continuity
              );

              // ... (Episode Expansion Logic UNCHANGED) ...
              if (episodes && episodes.length > 0) {
                  const newNodes: AppNode[] = [];
                  const newConnections: Connection[] = [];

                  const startX = node.x + (node.width || 420) + 150;
                  const startY = node.y;
                  const gapY = 40;
                  const nodeHeight = 360;

                  episodes.forEach((ep, index) => {
                      const newNodeId = `n-ep-${Date.now()}-${index}`;

                      // Build formatted content with all episode information
                      let formattedContent = `## ${ep.title}\n\n`;
                      formattedContent += `**角色**: ${ep.characters}\n`;
                      if (ep.keyItems) {
                          formattedContent += `**关键物品**: ${ep.keyItems}\n`;
                      }
                      formattedContent += `\n${ep.content}`;
                      if (ep.continuityNote) {
                          formattedContent += `\n\n**连贯性说明**: ${ep.continuityNote}`;
                      }

                      newNodes.push({
                          id: newNodeId,
                          type: NodeType.PROMPT_INPUT,
                          x: startX,
                          y: startY + index * (nodeHeight + gapY),
                          width: 420,
                          title: ep.title,
                          status: NodeStatus.IDLE,
                          data: {
                              prompt: formattedContent,
                              model: 'gemini-3-pro-preview'
                          },
                          inputs: [node.id]
                      });
                      newConnections.push({ from: node.id, to: newNodeId });
                  });

                  const groupHeight = (episodes.length * nodeHeight) + ((episodes.length - 1) * gapY) + 60;
                  const newGroup = {
                      id: `g-eps-${Date.now()}`,
                      title: `${node.data.selectedChapter} - 分集脚本`,
                      x: startX - 30,
                      y: startY - 30,
                      width: 420 + 60,
                      height: groupHeight
                  };

                  saveHistory();
                  setNodes(prev => [...prev, ...newNodes]);
                  setConnections(prev => [...prev, ...newConnections]);
                  setGroups(prev => [...prev, newGroup]);
                  
                  handleNodeUpdate(id, { generatedEpisodes: episodes });
              }

          } else if (node.type === NodeType.IMAGE_GENERATOR) {
               // Extract style preset from inputs
               const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
               const stylePrefix = stylePresetNode?.data.stylePrompt || '';
               const finalPrompt = stylePrefix ? `${stylePrefix}, ${prompt}` : prompt;

               const inputImages: string[] = [];
               inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
               const isStoryboard = /分镜|storyboard|sequence|shots|frames|json/i.test(finalPrompt);
               if (isStoryboard) {
                  try {
                      const storyboard = await planStoryboard(finalPrompt, upstreamTexts.join('\n'));
                      if (storyboard.length > 1) {
                          // ... (Storyboard Expansion Logic UNCHANGED) ...
                          const newNodes: AppNode[] = [];
                          const newConnections: Connection[] = [];
                          const COLUMNS = 3;
                          const gapX = 40; const gapY = 40;
                          const childWidth = node.width || 420;
                          const ratio = node.data.aspectRatio || '16:9';
                          const [rw, rh] = ratio.split(':').map(Number);
                          const childHeight = (childWidth * rh / rw); 
                          const startX = node.x + (node.width || 420) + 150;
                          const startY = node.y; 
                          const totalRows = Math.ceil(storyboard.length / COLUMNS);
                          
                          storyboard.forEach((shotPrompt, index) => {
                              const col = index % COLUMNS;
                              const row = Math.floor(index / COLUMNS);
                              const posX = startX + col * (childWidth + gapX);
                              const posY = startY + row * (childHeight + gapY);
                              const newNodeId = `n-${Date.now()}-${index}`;
                              newNodes.push({
                                  id: newNodeId, type: NodeType.IMAGE_GENERATOR, x: posX, y: posY, width: childWidth, height: childHeight,
                                  title: `分镜 ${index + 1}`, status: NodeStatus.WORKING,
                                  data: { ...node.data, aspectRatio: ratio, prompt: shotPrompt, image: undefined, images: undefined, imageCount: 1 },
                                  inputs: [node.id] 
                              });
                              newConnections.push({ from: node.id, to: newNodeId });
                          });
                          
                          const groupPadding = 30;
                          const groupWidth = (Math.min(storyboard.length, COLUMNS) * childWidth) + ((Math.min(storyboard.length, COLUMNS) - 1) * gapX) + (groupPadding * 2);
                          const groupHeight = (totalRows * childHeight) + ((totalRows - 1) * gapY) + (groupPadding * 2);

                          setGroups(prev => [...prev, { id: `g-${Date.now()}`, title: '分镜生成组', x: startX - groupPadding, y: startY - groupPadding, width: groupWidth, height: groupHeight }]);
                          setNodes(prev => [...prev, ...newNodes]);
                          setConnections(prev => [...prev, ...newConnections]);
                          handleNodeUpdate(id, { status: NodeStatus.SUCCESS });

                          newNodes.forEach(async (n) => {
                               try {
                                   const res = await generateImageFromText(n.data.prompt!, n.data.model!, inputImages, { aspectRatio: n.data.aspectRatio, resolution: n.data.resolution, count: 1 });
                                   handleNodeUpdate(n.id, { image: res[0], images: res, status: NodeStatus.SUCCESS });
                               } catch (e: any) {
                                   handleNodeUpdate(n.id, { error: e.message, status: NodeStatus.ERROR });
                               }
                          });
                          return; 
                      }
                  } catch (e) { console.warn("Storyboard planning failed", e); }
               }
              const res = await generateImageFromText(
                  finalPrompt,
                  node.data.model,
                  inputImages,
                  { aspectRatio: node.data.aspectRatio || '16:9', resolution: node.data.resolution, count: node.data.imageCount },
                  { nodeId: id, nodeType: node.type }
              );
              handleNodeUpdate(id, { image: res[0], images: res });
              // Save to local storage
              await saveImageNodeOutput(id, res, 'IMAGE_GENERATOR');

          } else if (node.type === NodeType.VIDEO_GENERATOR) {
              // Extract style preset from inputs
              const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
              const stylePrefix = stylePresetNode?.data.stylePrompt || '';
              const finalPrompt = stylePrefix ? `${stylePrefix}, ${prompt}` : prompt;

              const strategy = await getGenerationStrategy(node, inputs, finalPrompt);
              const res = await generateVideo(
                  strategy.finalPrompt,
                  node.data.model,
                  {
                      aspectRatio: node.data.aspectRatio || '16:9',
                      count: node.data.videoCount || 1,
                      generationMode: strategy.generationMode,
                      resolution: node.data.resolution
                  },
                  strategy.inputImageForGeneration,
                  strategy.videoInput,
                  strategy.referenceImages,
                  { nodeId: id, nodeType: node.type }
              );
              if (res.isFallbackImage) {
                   handleNodeUpdate(id, {
                       image: res.uri,
                       videoUri: undefined,
                       videoMetadata: undefined,
                       error: "Region restricted: Generated preview image instead.",
                       status: NodeStatus.SUCCESS
                   });
              } else {
                   handleNodeUpdate(id, { videoUri: res.uri, videoMetadata: res.videoMetadata, videoUris: res.uris });
                   // Save to local storage
                   const videoUris = res.uris || [res.uri];
                   await saveVideoNodeOutput(id, videoUris, 'VIDEO_GENERATOR');
              }

          } else if (node.type === NodeType.AUDIO_GENERATOR) {
              // Extract style preset from inputs
              const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
              const stylePrefix = stylePresetNode?.data.stylePrompt || '';
              const finalPrompt = stylePrefix ? `${stylePrefix}, ${prompt}` : prompt;

              const audioUri = await generateAudio(finalPrompt, node.data.model);
              handleNodeUpdate(id, { audioUri: audioUri });
              // Save to local storage
              await saveAudioNodeOutput(id, audioUri, 'AUDIO_GENERATOR');

          } else if (node.type === NodeType.STORYBOARD_GENERATOR) {
              const episodeContent = prompt; 
              if (!episodeContent.trim()) throw new Error("请连接包含剧本内容的节点 (Input Node)");

              const shots = await generateCinematicStoryboard(
                  episodeContent,
                  node.data.storyboardCount || 6,
                  node.data.storyboardDuration || 4,
                  node.data.storyboardStyle || 'REAL'
              );

              handleNodeUpdate(id, { storyboardShots: shots });

              const updatedShots = [...shots];
              
              const processShotImage = async (shotIndex: number) => {
                  const shot = updatedShots[shotIndex];
                  const stylePrompt = node.data.storyboardStyle === 'ANIME' 
                      ? 'Anime style, Japanese animation, Studio Ghibli style, 2D, Cel shaded, vibrant colors.'
                      : node.data.storyboardStyle === '3D'
                      ? '3D Animation style, Pixar style, C4D, Octane Render, Unreal Engine 5, high fidelity.'
                      : 'Cinematic Movie Still, Photorealistic, 8k, Live Action, highly detailed.';

                  const visualPrompt = `
                  ${stylePrompt}
                  Subject: ${shot.subject}.
                  Scene: ${shot.scene}.
                  Camera: ${shot.camera}.
                  Lighting: ${shot.lighting}.
                  Style: ${shot.style}.
                  Negative: ${shot.negative}.
                  `;
                  try {
                      const imgs = await generateImageFromText(visualPrompt, getUserDefaultModel('image'), [], { aspectRatio: node.data.aspectRatio || '16:9', count: 1 });
                      if (imgs && imgs.length > 0) {
                          updatedShots[shotIndex] = { ...shot, imageUrl: imgs[0] };
                          handleNodeUpdate(id, { storyboardShots: [...updatedShots] });
                      }
                  } catch (e) {
                      console.warn(`Failed to gen image for shot ${shotIndex}`, e);
                  }
              };

              await Promise.all(updatedShots.map((_, i) => processShotImage(i)));

          } else if (node.type === NodeType.STORYBOARD_IMAGE) {
              // Check if this is a panel or page regeneration request
              const regeneratePanelIndex = node.data.storyboardRegeneratePanel;
              const regeneratePageIndex = node.data.storyboardRegeneratePage;
              const isRegeneratingPanel = typeof regeneratePanelIndex === 'number';
              const isRegeneratingPage = typeof regeneratePageIndex === 'number';
              const isRegenerating = isRegeneratingPanel || isRegeneratingPage;

              // Get existing shots data or fetch from input
              let extractedShots: any[] = node.data.storyboardShots || [];

              if (!isRegenerating || extractedShots.length === 0) {
                  // Normal generation or no existing shots - get from input
                  let storyboardContent = prompt.trim();

                  // Check if there's a connected PROMPT_INPUT node with episodeStoryboard data
                  const promptInputNode = inputs.find(n => n.type === NodeType.PROMPT_INPUT);
                  if (promptInputNode?.data.episodeStoryboard) {
                      const storyboard = promptInputNode.data.episodeStoryboard;
                      console.log('[STORYBOARD_IMAGE] Found episodeStoryboard from PROMPT_INPUT:', {
                          shotCount: storyboard.shots?.length || 0,
                          totalDuration: storyboard.totalDuration
                      });

                      // Keep the full structured data for detailed prompt generation
                      storyboardContent = JSON.stringify({
                          shots: storyboard.shots.map((shot: any) => ({
                              visualDescription: shot.visualDescription,
                              scene: shot.scene,
                              shotSize: shot.shotSize,
                              cameraAngle: shot.cameraAngle,
                              cameraMovement: shot.cameraMovement
                          }))
                      });
                  }

                  if (!storyboardContent) {
                      throw new Error("请输入分镜描述或连接剧本分集子节点");
                  }

                  console.log('[STORYBOARD_IMAGE] Processing content:', {
                      contentLength: storyboardContent.length,
                      inputCount: inputs.length,
                      hasEpisodeStoryboard: !!promptInputNode?.data.episodeStoryboard
                  });

                  // Extract shots with full structured data
                  // Try to parse as JSON first (from generateDetailedStoryboard)
                  const jsonMatch = storyboardContent.match(/\{[\s\S]*"shots"[\s\S]*\}/);
                  if (jsonMatch) {
                      try {
                          const parsed = JSON.parse(jsonMatch[0]);
                          if (parsed.shots && Array.isArray(parsed.shots)) {
                              extractedShots = parsed.shots;
                              console.log('[STORYBOARD_IMAGE] Parsed structured shots:', extractedShots.length);
                          }
                      } catch (e) {
                          console.warn('[STORYBOARD_IMAGE] Failed to parse JSON, falling back to text parsing');
                      }
                  }

                  // Fallback: Parse text descriptions
                  if (extractedShots.length === 0) {
                      const numberedMatches = storyboardContent.match(/^\d+[.、)]\s*(.+)$/gm);
                      if (numberedMatches && numberedMatches.length > 0) {
                          extractedShots = numberedMatches.map(m => ({
                              visualDescription: m.replace(/^\d+[.、)]\s*/, '').trim()
                          }));
                      } else {
                          extractedShots = storyboardContent.split(/\n+/)
                              .map(line => line.trim())
                              .filter(line => line.length > 10)
                              .map(desc => ({ visualDescription: desc }));
                      }
                  }
              }

              if (extractedShots.length === 0) {
                  throw new Error("未能从内容中提取分镜描述，请检查格式");
              }

              console.log('[STORYBOARD_IMAGE] Total shots to process:', extractedShots.length);

              // Get grid configuration
              const gridType = node.data.storyboardGridType || '9';
              const panelOrientation = node.data.storyboardPanelOrientation || '16:9';
              const shotsPerGrid = gridType === '9' ? 9 : 6;
              const gridLayout = gridType === '9' ? '3x3' : '2x3';

              // Calculate number of pages needed
              const numberOfPages = Math.ceil(extractedShots.length / shotsPerGrid);

              console.log('[STORYBOARD_IMAGE] Generation plan:', {
                  totalShots: extractedShots.length,
                  shotsPerGrid,
                  numberOfPages,
                  gridLayout,
                  panelOrientation,
                  isRegenerating
              });

              // Get visual style from upstream
              const { style } = getUpstreamStyleContext(node, nodesRef.current);
              const stylePrefix = getVisualPromptPrefix(style);

              // Get user-configured image model priority
              const imageModelPriority = getUserPriority('image' as ModelCategory);
              const primaryImageModel = imageModelPriority[0] || getDefaultModel('image');
              console.log('[STORYBOARD_IMAGE] Using image model priority:', imageModelPriority);

              // Extract character reference images from upstream CHARACTER_NODE (for all cases)
              const characterReferenceImages: string[] = [];
              const characterNode = inputs.find(n => n.type === NodeType.CHARACTER_NODE);

              if (characterNode?.data.generatedCharacters) {
                  const characters = characterNode.data.generatedCharacters as CharacterProfile[];
                  characters.forEach(char => {
                      if (char.threeViewSheet) {
                          characterReferenceImages.push(char.threeViewSheet);
                      } else if (char.expressionSheet) {
                          characterReferenceImages.push(char.expressionSheet);
                      }
                  });

                  console.log('[STORYBOARD_IMAGE] Character references:', {
                      characterCount: characters.length,
                      referenceImageCount: characterReferenceImages.length,
                      characterNames: characters.map(c => c.name)
                  });
              }

              // Helper: Build detailed shot prompt with camera language
              const buildDetailedShotPrompt = (shot: any, index: number, globalIndex: number): string => {
                  const parts: string[] = [];

                  // 1. Visual description (most important)
                  if (shot.visualDescription) {
                      parts.push(shot.visualDescription);
                  }

                  // 2. Shot size mapping (景别)
                  const shotSizeMap: Record<string, string> = {
                      '大远景': 'extreme long shot, vast environment, figures small like ants',
                      '远景': 'long shot, small figure visible, action and environment',
                      '全景': 'full shot, entire body visible, head to toe',
                      '中景': 'medium shot, waist-up composition, social distance',
                      '中近景': 'medium close-up shot, chest-up, focus on emotion',
                      '近景': 'close shot, neck and above, intimate examination',
                      '特写': 'close-up shot, face only, soul window, intense impact',
                      '大特写': 'extreme close-up shot, partial detail, microscopic view'
                  };

                  if (shot.shotSize && shotSizeMap[shot.shotSize]) {
                      parts.push(shotSizeMap[shot.shotSize]);
                  }

                  // 3. Camera angle mapping (拍摄角度)
                  const cameraAngleMap: Record<string, string> = {
                      '视平': 'eye-level angle, neutral and natural perspective',
                      '高位俯拍': 'high angle shot, looking down at subject, makes them appear vulnerable',
                      '低位仰拍': 'low angle shot, looking up at subject, makes them appear powerful',
                      '斜拍': 'dutch angle, tilted horizon, creates psychological unease',
                      '越肩': 'over the shoulder shot, emphasizes relationship and space',
                      '鸟瞰': 'bird\'s eye view, top-down 90-degree, god-like perspective'
                  };

                  if (shot.cameraAngle && cameraAngleMap[shot.cameraAngle]) {
                      parts.push(cameraAngleMap[shot.cameraAngle]);
                  }

                  // 4. Scene context
                  if (shot.scene) {
                      parts.push(`environment: ${shot.scene}`);
                  }

                  // 5. Add unique identifier to prevent duplication
                  parts.push(`[Unique Panel ID: ${globalIndex + 1}]`);

                  return parts.join('. ');
              };

              // Helper: Generate single grid page
              const generateGridPage = async (pageIndex: number): Promise<string | null> => {
                  const startIdx = pageIndex * shotsPerGrid;
                  const endIdx = Math.min(startIdx + shotsPerGrid, extractedShots.length);
                  const pageShots = extractedShots.slice(startIdx, endIdx);

                  // Pad last page if needed
                  while (pageShots.length < shotsPerGrid) {
                      pageShots.push({
                          visualDescription: '(empty panel - storyboard end)',
                          isEmpty: true
                      });
                  }

                  // Build detailed panel descriptions with clear numbering and uniqueness
                  const panelDescriptions = pageShots.map((shot, idx) => {
                      const globalIndex = startIdx + idx;
                      if (shot.isEmpty) {
                          return `Panel ${idx + 1}: [BLANK] - Empty panel at end of storyboard`;
                      }
                      const shotPrompt = buildDetailedShotPrompt(shot, idx, globalIndex);
                      return `Panel ${idx + 1}: ${shotPrompt}`;
                  }).join('\n\n');

                  // Calculate correct output aspect ratio and resolution based on grid type
                  let outputAspectRatio: string;
                  let resolutionWidth: number;
                  let resolutionHeight: number;

                  if (gridType === '9') {
                      // 3x3 grid: standard 16:9 or 9:16
                      outputAspectRatio = panelOrientation;
                      if (panelOrientation === '16:9') {
                          resolutionWidth = 3840;
                          resolutionHeight = 2160;
                      } else {
                          resolutionWidth = 2160;
                          resolutionHeight = 3840;
                      }
                  } else {
                      // 2x3 or 3x2 grid: 4:3 or 3:4 (standard supported aspect ratios)
                      if (panelOrientation === '16:9') {
                          outputAspectRatio = '4:3';
                          resolutionWidth = 3840;
                          resolutionHeight = 2880;
                      } else {
                          outputAspectRatio = '3:4';
                          resolutionWidth = 2880;
                          resolutionHeight = 3840;
                      }
                  }

                  // Build comprehensive prompt with 2K resolution and subtle panel numbers
                  const gridPrompt = `
Create a professional cinematic storyboard ${gridLayout} grid layout at 2K resolution.

OVERALL IMAGE SPECS:
- Output Aspect Ratio: ${outputAspectRatio} (${panelOrientation === '16:9' ? 'landscape' : 'portrait'})
- Grid Layout: ${shotsPerGrid} panels arranged in ${gridLayout} formation
- Each panel maintains ${panelOrientation} aspect ratio
- Panel borders: EXACTLY 4 pixels wide black lines (NOT percentage-based, ABSOLUTE FIXED SIZE)
- CRITICAL: All panel borders must be PERFECTLY UNIFORM - absolutely NO thickness variation allowed
- Every dividing line must have EXACTLY the same 4-pixel width
- NO variation in border thickness - all borders must be identical

QUALITY STANDARDS:
- Professional film industry storyboard quality
- **2K HD resolution (2048 pixels wide base)**
- High-detail illustration with sharp focus
- Suitable for web and digital display
- Crisp edges, no blurring or artifacts
- Cinematic composition with proper framing
- Expressive character poses and emotions
- Dynamic lighting and shading
- Clear foreground/background separation
- CRITICAL: Maintain 100% visual style consistency across ALL panels
- ALL characters must look identical across all panels (same face, hair, clothes, body type)
- Same color palette, same art style, same lighting quality throughout

CRITICAL NEGATIVE CONSTRAINTS (MUST FOLLOW):
- NO text, NO speech bubbles, NO dialogue boxes
- NO subtitles, NO captions, NO watermarks
- NO letters, NO numbers, NO typography, NO panel numbers
- NO markings or labels of any kind
- NO variation in panel border thickness - all borders must be EXACTLY 4 pixels
- NO inconsistent or varying border widths
- NO style variations between panels
- NO character appearance changes
- Visual narrative without any text or numbers

${stylePrefix ? `ART STYLE: ${stylePrefix}\n` : ''}

${characterReferenceImages.length > 0 ? `CHARACTER CONSISTENCY: Use provided reference images to ensure ALL characters look EXACTLY THE SAME across all panels - same face, hair, clothes, body proportions, and style. Maintain visual consistency rigorously.\n` : ''}

PANEL BREAKDOWN (each panel MUST be visually distinct):
${panelDescriptions}

COMPOSITION REQUIREMENTS:
- Each panel MUST depict a DIFFERENT scene/angle/moment
- NO repetition of content between panels
- Each panel should have unique visual elements
- Maintain narrative flow across the ${gridLayout} grid
- Professional color grading throughout
- Environmental details and props clearly visible
`.trim();

                  console.log(`[STORYBOARD_IMAGE] Generating page ${pageIndex + 1}/${numberOfPages}:`, {
                      shotRange: `${startIdx + 1}-${endIdx}`,
                      promptLength: gridPrompt.length,
                      aspectRatio: outputAspectRatio
                  });

                  try {
                      // Use user-configured model priority with fallback
                      console.log(`[STORYBOARD_IMAGE] Generating page ${pageIndex + 1}/${numberOfPages} with model: ${primaryImageModel}`);

                      const imgs = await generateImageWithFallback(
                          gridPrompt,
                          primaryImageModel,
                          characterReferenceImages,
                          {
                              aspectRatio: outputAspectRatio,
                              resolution: "2K",
                              count: 1
                          },
                          { nodeId: id, nodeType: node.type }
                      );

                      if (imgs && imgs.length > 0) {
                          console.log(`[STORYBOARD_IMAGE] Page ${pageIndex + 1} generated successfully`);
                          return imgs[0];
                      } else {
                          console.error(`[STORYBOARD_IMAGE] Page ${pageIndex + 1} generation failed - no images returned`);
                          return null;
                      }
                  } catch (error: any) {
                      console.error(`[STORYBOARD_IMAGE] Page ${pageIndex + 1} generation error:`, error.message);
                      return null;
                  }
              };

              // Generate all pages or regenerate specific page
              const generatedGrids: string[] = [];
              let finalCurrentPage = 0;

              if (isRegenerating) {
                  // Regenerate specific page (either single panel or entire page)
                  let targetPageIndex: number;

                  if (isRegeneratingPage) {
                      targetPageIndex = regeneratePageIndex;
                      console.log(`[STORYBOARD_IMAGE] Regenerating entire page ${targetPageIndex + 1}`);
                  } else {
                      targetPageIndex = Math.floor(regeneratePanelIndex / shotsPerGrid);
                      console.log(`[STORYBOARD_IMAGE] Regenerating page ${targetPageIndex + 1} for panel ${regeneratePanelIndex + 1}`);
                  }

                  // Keep existing grids, regenerate only the target page
                  const existingGrids = node.data.storyboardGridImages || [];

                  // Generate the target page
                  const regeneratedImage = await generateGridPage(targetPageIndex);

                  if (regeneratedImage) {
                      // Replace the target page in the existing grids
                      const updatedGrids = [...existingGrids];
                      updatedGrids[targetPageIndex] = regeneratedImage;

                      handleNodeUpdate(id, {
                          storyboardGridImages: updatedGrids,
                          storyboardGridImage: updatedGrids[0],
                          storyboardGridType: gridType,
                          storyboardPanelOrientation: panelOrientation,
                          storyboardCurrentPage: targetPageIndex,
                          storyboardTotalPages: updatedGrids.length,
                          storyboardShots: extractedShots,
                          storyboardRegeneratePanel: undefined, // Clear both flags
                          storyboardRegeneratePage: undefined
                      });

                      // Save to local storage
                      await saveStoryboardGridOutput(id, updatedGrids, 'STORYBOARD_IMAGE');

                      console.log('[STORYBOARD_IMAGE] Page regeneration complete');
                  } else {
                      throw new Error("分镜重新生成失败，请重试");
                  }
              } else {
                  // Normal generation - generate all pages
                  const generationPromises: Promise<string | null>[] = [];

                  for (let pageIdx = 0; pageIdx < numberOfPages; pageIdx++) {
                      generationPromises.push(generateGridPage(pageIdx));
                  }

                  // Wait for all pages to generate
                  const results = await Promise.all(generationPromises);

                  // Filter out failed generations
                  results.forEach(result => {
                      if (result) {
                          generatedGrids.push(result);
                      }
                  });

                  console.log('[STORYBOARD_IMAGE] Generation complete:', {
                      totalPagesRequested: numberOfPages,
                      totalPagesGenerated: generatedGrids.length,
                      success: generatedGrids.length === numberOfPages
                  });

                  if (generatedGrids.length === 0) {
                      throw new Error("分镜图生成失败，请重试");
                  }

                  // Save results
                  handleNodeUpdate(id, {
                      storyboardGridImages: generatedGrids,
                      storyboardGridImage: generatedGrids[0], // For backward compatibility
                      storyboardGridType: gridType,
                      storyboardPanelOrientation: panelOrientation,
                      storyboardCurrentPage: 0,
                      storyboardTotalPages: generatedGrids.length,
                      storyboardShots: extractedShots // Save shots data for editing
                  });

                  // Save to local storage
                  await saveStoryboardGridOutput(id, generatedGrids, 'STORYBOARD_IMAGE');

                  console.log('[STORYBOARD_IMAGE] All data saved successfully');
              }

          } else if (node.type === NodeType.SORA_VIDEO_GENERATOR) {
              // --- Sora 2 Video Generator Logic ---

              // 1. Get split shots from STORYBOARD_SPLITTER input nodes
              const splitterNodes = inputs.filter(n => n?.type === NodeType.STORYBOARD_SPLITTER) as AppNode[];
              if (splitterNodes.length === 0) {
                  throw new Error('请连接分镜图拆解节点 (STORYBOARD_SPLITTER)');
              }

              // Collect all split shots from all connected splitter nodes
              const allSplitShots: any[] = [];
              splitterNodes.forEach(splitterNode => {
                  if (splitterNode.data.splitShots && splitterNode.data.splitShots.length > 0) {
                      allSplitShots.push(...splitterNode.data.splitShots);
                  }
              });

              if (allSplitShots.length === 0) {
                  throw new Error('未找到任何分镜数据，请确保拆解节点包含分镜');
              }

              // 2. Get model configuration
              const modelId = node.data.soraModelId || 'sora-2-10s-large';
              const model = getSoraModelById(modelId);
              if (!model) {
                  throw new Error(`未找到模型: ${modelId}`);
              }

              // 3. Group shots into task groups based on model duration
              const taskGroups: SoraTaskGroup[] = [];
              let currentGroup: any = {
                  id: `tg-${Date.now()}-${taskGroups.length}`,
                  taskNumber: taskGroups.length + 1,
                  totalDuration: 0,
                  shotIds: [] as string[],
                  splitShots: [] as any[],
                  soraModelId: modelId,
                  soraPrompt: '',
                  promptGenerated: false,
                  imageFused: false,
                  generationStatus: 'idle' as const
              };

              allSplitShots.forEach(shot => {
                  const shotDuration = shot.duration || 0;

                  // Check if adding this shot would exceed the model duration
                  if (currentGroup.totalDuration + shotDuration > model.duration && currentGroup.shotIds.length > 0) {
                      // Finalize current group and start a new one
                      taskGroups.push({ ...currentGroup });
                      currentGroup = {
                          id: `tg-${Date.now()}-${taskGroups.length + 1}`,
                          taskNumber: taskGroups.length + 2,
                          totalDuration: 0,
                          shotIds: [],
                          splitShots: [],
                          soraModelId: modelId,
                          soraPrompt: '',
                          promptGenerated: false,
                          imageFused: false,
                          generationStatus: 'idle' as const
                      };
                  }

                  // Add shot to current group
                  currentGroup.shotIds.push(shot.id);
                  currentGroup.splitShots.push(shot);
                  currentGroup.totalDuration += shotDuration;
              });

              // Don't forget the last group
              if (currentGroup.shotIds.length > 0) {
                  taskGroups.push(currentGroup);
              }

              console.log('[SORA_VIDEO_GENERATOR] Created task groups:', {
                  totalGroups: taskGroups.length,
                  modelDuration: model.duration,
                  shotsPerGroup: taskGroups.map(tg => tg.shotIds.length)
              });

              // 4. Generate AI-enhanced Sora prompts for each task group
              const { buildProfessionalSoraPrompt } = await import('./services/soraPromptBuilder');

              // Generate prompts asynchronously
              for (const tg of taskGroups) {
                  try {
                    console.log(`[SORA_VIDEO_GENERATOR] Generating professional prompt for task group ${tg.taskNumber}...`);
                    tg.soraPrompt = await buildProfessionalSoraPrompt(tg.splitShots);
                    tg.promptGenerated = true;
                    tg.generationStatus = 'prompt_ready';
                    console.log(`[SORA_VIDEO_GENERATOR] Prompt generated for task group ${tg.taskNumber}`);
                  } catch (error) {
                    console.error(`[SORA_VIDEO_GENERATOR] Failed to generate professional prompt for task group ${tg.taskNumber}:`, error);
                    // Fallback to basic prompt
                    const { buildSoraStoryPrompt } = await import('./services/soraService');
                    tg.soraPrompt = buildSoraStoryPrompt(tg.splitShots);
                    tg.promptGenerated = true;
                    tg.generationStatus = 'prompt_ready';
                  }
              }

              // Save task groups to node data
              handleNodeUpdate(id, {
                  taskGroups: taskGroups,
                  soraModelId: modelId
              });

              console.log('[SORA_VIDEO_GENERATOR] Task groups created successfully');

          } else if (node.type === NodeType.VIDEO_ANALYZER) {
             const vid = node.data.videoUri || inputs.find(n => n?.data.videoUri)?.data.videoUri;
             if (!vid) throw new Error("未找到视频输入");
             let vidData = vid;
             if (vid.startsWith('http')) vidData = await urlToBase64(vid);
             const txt = await analyzeVideo(vidData, prompt, node.data.model);
             handleNodeUpdate(id, { analysis: txt });
          } else if (node.type === NodeType.IMAGE_EDITOR) {
             // Extract style preset from inputs
             const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
             const stylePrefix = stylePresetNode?.data.stylePrompt || '';
             const finalPrompt = stylePrefix ? `${stylePrefix}, ${prompt}` : prompt;

             const inputImages: string[] = [];
             inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
             const img = node.data.image || inputImages[0];
             const res = await editImageWithText(img, finalPrompt, node.data.model);
             handleNodeUpdate(id, { image: res });
          }
          setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
      } catch (e: any) {
          console.error('[handleNodeAction] Error caught:', e);
          console.error('[handleNodeAction] Error message:', e.message);
          console.error('[handleNodeAction] Error stack:', e.stack);
          handleNodeUpdate(id, { error: e.message });
          setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
      }
  }, [handleNodeUpdate]);

  // ... (saveCurrentAsWorkflow, saveGroupAsWorkflow, loadWorkflow, deleteWorkflow, renameWorkflow, Keyboard Handlers, Drag & Drop, Mouse Handlers UNCHANGED) ...
  const saveCurrentAsWorkflow = () => {
      const thumbnailNode = nodes.find(n => n.data.image);
      const thumbnail = thumbnailNode?.data.image || '';
      const newWf: Workflow = { 
          id: `wf-${Date.now()}`, 
          title: `工作流 ${new Date().toLocaleDateString()}`, 
          thumbnail, 
          nodes: JSON.parse(JSON.stringify(nodes)), 
          connections: JSON.parse(JSON.stringify(connections)), 
          groups: JSON.parse(JSON.stringify(groups)) 
      };
      setWorkflows(prev => [newWf, ...prev]);
  };
  
  const saveGroupAsWorkflow = (groupId: string) => {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;
      const nodesInGroup = nodes.filter(n => { const w = n.width || 420; const h = n.height || getApproxNodeHeight(n); const cx = n.x + w/2; const cy = n.y + h/2; return cx > group.x && cx < group.x + group.width && cy > group.y && cy < group.y + group.height; });
      const nodeIds = new Set(nodesInGroup.map(n => n.id));
      const connectionsInGroup = connections.filter(c => nodeIds.has(c.from) && nodeIds.has(c.to));
      const thumbNode = nodesInGroup.find(n => n.data.image);
      const thumbnail = thumbNode ? thumbNode.data.image : '';
      const newWf: Workflow = { id: `wf-${Date.now()}`, title: group.title || '未命名工作流', thumbnail: thumbnail || '', nodes: JSON.parse(JSON.stringify(nodesInGroup)), connections: JSON.parse(JSON.stringify(connectionsInGroup)), groups: [JSON.parse(JSON.stringify(group))] };
      setWorkflows(prev => [newWf, ...prev]);
  };

  const loadWorkflow = (id: string) => {
      const wf = workflows.find(w => w.id === id);
      if (wf) { saveHistory(); setNodes(JSON.parse(JSON.stringify(wf.nodes))); setConnections(JSON.parse(JSON.stringify(wf.connections))); setGroups(JSON.parse(JSON.stringify(wf.groups))); setSelectedWorkflowId(id); }
  };

  const deleteWorkflow = (id: string) => { setWorkflows(prev => prev.filter(w => w.id !== id)); if (selectedWorkflowId === id) setSelectedWorkflowId(null); };
  const renameWorkflow = (id: string, newTitle: string) => { setWorkflows(prev => prev.map(w => w.id === id ? { ...w, title: newTitle } : w)); };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedNodeIds(nodesRef.current.map(n => n.id)); return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') { const lastSelected = selectedNodeIds[selectedNodeIds.length - 1]; if (lastSelected) { const nodeToCopy = nodesRef.current.find(n => n.id === lastSelected); if (nodeToCopy) { e.preventDefault(); setClipboard(JSON.parse(JSON.stringify(nodeToCopy))); } } return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') { if (clipboard) { e.preventDefault(); saveHistory(); const newNode: AppNode = { ...clipboard, id: `n-${Date.now()}-${Math.floor(Math.random()*1000)}`, x: clipboard.x + 50, y: clipboard.y + 50, status: NodeStatus.IDLE, inputs: [] }; setNodes(prev => [...prev, newNode]); setSelectedNodeIds([newNode.id]); } return; }
        if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedGroupId) { saveHistory(); setGroups(prev => prev.filter(g => g.id !== selectedGroupId)); setSelectedGroupId(null); return; } if (selectedNodeIds.length > 0) { deleteNodes(selectedNodeIds); } }
    };
    const handleKeyDownSpace = (e: KeyboardEvent) => { if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { document.body.classList.add('cursor-grab-override'); } };
    const handleKeyUpSpace = (e: KeyboardEvent) => { if (e.code === 'Space') { document.body.classList.remove('cursor-grab-override'); } };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keydown', handleKeyDownSpace); window.addEventListener('keyup', handleKeyUpSpace);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keydown', handleKeyDownSpace); window.removeEventListener('keyup', handleKeyUpSpace); };
  }, [selectedWorkflowId, selectedNodeIds, selectedGroupId, deleteNodes, undo, saveHistory, clipboard]);

  const handleCanvasDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const handleCanvasDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const dropX = (e.clientX - canvas.pan.x) / canvas.scale;
      const dropY = (e.clientY - canvas.pan.y) / canvas.scale;
      const assetData = e.dataTransfer.getData('application/json');
      const workflowId = e.dataTransfer.getData('application/workflow-id');

      if (workflowId && workflows) {
          const wf = workflows.find(w => w.id === workflowId);
          if (wf) {
              saveHistory();
              const minX = Math.min(...wf.nodes.map(n => n.x));
              const minY = Math.min(...wf.nodes.map(n => n.y));
              const width = Math.max(...wf.nodes.map(n => n.x + (n.width||420))) - minX;
              const height = Math.max(...wf.nodes.map(n => n.y + 320)) - minY;
              const offsetX = dropX - (minX + width/2);
              const offsetY = dropY - (minY + height/2);
              const idMap = new Map<string, string>();
              const newNodes = wf.nodes.map(n => { const newId = `n-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; idMap.set(n.id, newId); return { ...n, id: newId, x: n.x + offsetX, y: n.y + offsetY, status: NodeStatus.IDLE, inputs: [] }; });
              newNodes.forEach((n, i) => { const original = wf.nodes[i]; n.inputs = original.inputs.map(oldId => idMap.get(oldId)).filter(Boolean) as string[]; });
              const newConnections = wf.connections.map(c => ({ from: idMap.get(c.from)!, to: idMap.get(c.to)! })).filter(c => c.from && c.to);
              const newGroups = (wf.groups || []).map(g => ({ ...g, id: `g-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, x: g.x + offsetX, y: g.y + offsetY }));
              setNodes(prev => [...prev, ...newNodes]); setConnections(prev => [...prev, ...newConnections]); setGroups(prev => [...prev, ...newGroups]);
          }
          return;
      }
      if (assetData) {
          try {
              const asset = JSON.parse(assetData);
              if (asset && asset.type) {
                  if (asset.type === 'image') addNode(NodeType.IMAGE_GENERATOR, dropX - 210, dropY - 180, { image: asset.src, prompt: asset.title });
                  else if (asset.type === 'video') addNode(NodeType.VIDEO_GENERATOR, dropX - 210, dropY - 180, { videoUri: asset.src });
              }
              return;
          } catch (err) { console.error("Drop failed", err); }
      }
      
      // Updated Multi-File Logic (9-Grid Support)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const files = Array.from(e.dataTransfer.files) as File[];
          const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
          
          if (validFiles.length > 0) {
              const COLS = 3; 
              const GAP = 40;
              const BASE_WIDTH = 420;
              const BASE_HEIGHT = 450; 
              
              const startX = dropX - 210; 
              const startY = dropY - 180;

              validFiles.forEach((file, index) => {
                  const col = index % COLS;
                  const row = Math.floor(index / COLS);
                  
                  const xPos = startX + (col * (BASE_WIDTH + GAP));
                  const yPos = startY + (row * BASE_HEIGHT);

                  const reader = new FileReader();
                  reader.onload = (event) => {
                      const res = event.target?.result as string;
                      if (file.type.startsWith('image/')) {
                          addNode(NodeType.IMAGE_GENERATOR, xPos, yPos, { image: res, prompt: file.name, status: NodeStatus.SUCCESS });
                      } else if (file.type.startsWith('video/')) {
                          addNode(NodeType.VIDEO_GENERATOR, xPos, yPos, { videoUri: res, prompt: file.name, status: NodeStatus.SUCCESS });
                      }
                  };
                  reader.readAsDataURL(file);
              });
          }
      }
  };
  
  useEffect(() => {
      const style = document.createElement('style');
      style.innerHTML = ` .cursor-grab-override, .cursor-grab-override * { cursor: grab !important; } .cursor-grab-override:active, .cursor-grab-override:active * { cursor: grabbing !important; } `;
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0a0a0c]">
      <div
          className={`w-full h-full overflow-hidden text-slate-200 selection:bg-cyan-500/30 ${canvas.isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'}`}
          onMouseDown={handleCanvasMouseDown} onWheel={handleWheel} 
          onDoubleClick={(e) => { e.preventDefault(); if (e.detail > 1 && !selectionRect) { setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: '' }); setContextMenuTarget({ type: 'create' }); } }}
          onContextMenu={(e) => { e.preventDefault(); if(e.target === e.currentTarget) setContextMenu(null); }}
          onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}
      >
          <div className="absolute inset-0 noise-bg" />
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #aaa 1px, transparent 1px)', backgroundSize: `${32 * canvas.scale}px ${32 * canvas.scale}px`, backgroundPosition: `${canvas.pan.x}px ${canvas.pan.y}px` }} />

          {/* Welcome Screen Component */}
          <WelcomeScreen visible={nodes.length === 0} />

          <input type="file" ref={replaceVideoInputRef} className="hidden" accept="video/*" onChange={(e) => handleReplaceFile(e, 'video')} />
          <input type="file" ref={replaceImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleReplaceFile(e, 'image')} />

          <div style={{ transform: `translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.scale})`, width: '100%', height: '100%', transformOrigin: '0 0' }} className="w-full h-full">
              {/* Groups Layer */}
              {groups.map(g => (
                  <div 
                      key={g.id} className={`absolute rounded-[32px] border transition-all ${(draggingGroup?.id === g.id || draggingNodeParentGroupId === g.id) ? 'duration-0' : 'duration-300'} ${selectedGroupId === g.id ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-white/5'}`} style={{ left: g.x, top: g.y, width: g.width, height: g.height }} 
                      onMouseDown={(e) => { 
                          e.stopPropagation(); setSelectedGroupId(g.id); 
                          const childNodes = nodes.filter(n => { const b = getNodeBounds(n); const cx = b.x + b.width/2; const cy = b.y + b.height/2; return cx>g.x && cx<g.x+g.width && cy>g.y && cy<g.y+g.height; }).map(n=>({id:n.id, startX:n.x, startY:n.y}));
                          dragGroupRef.current = { id: g.id, startX: g.x, startY: g.y, mouseStartX: e.clientX, mouseStartY: e.clientY, childNodes };
                          setActiveGroupNodeIds(childNodes.map(c => c.id)); setDraggingGroup({ id: g.id }); 
                      }} 
                      onContextMenu={e => { e.stopPropagation(); setContextMenu({visible:true, x:e.clientX, y:e.clientY, id:g.id}); setContextMenuTarget({type:'group', id:g.id}); }}
                  >
                      <div className="absolute -top-8 left-4 text-xs font-bold text-white/40 uppercase tracking-widest">{g.title}</div>
                  </div>
              ))}

              {/* Connections Layer */}
              <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                  <ConnectionLayer
                      nodes={nodes}
                      connections={connections}
                      scale={canvas.scale}
                      pan={canvas.pan}
                      connectionStart={connectionStart}
                      mousePos={canvas.mousePos}
                      onConnectionClick={(conn, e) => {
                          e.stopPropagation();
                          setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: `${conn.from}-${conn.to}` });
                          setContextMenuTarget({ type: 'connection', from: conn.from, to: conn.to });
                      }}
                      getNodeHeight={getApproxNodeHeight}
                  />
              </svg>

              {nodes.map(node => (
              <Node
                  key={node.id} 
                  node={node} 
                  allNodes={nodes}
                  characterLibrary={assetHistory.filter(a => a.type === 'character').map(a => a.data)}
                  onUpdate={handleNodeUpdate} 
                  onAction={handleNodeAction} 
                  onDelete={(id) => deleteNodes([id])} 
                  onExpand={setExpandedMedia} 
                  onCrop={(id, img) => { setCroppingNodeId(id); setImageToCrop(img); }}
                  onNodeMouseDown={(e, id) => { 
                      e.stopPropagation(); 
                      if (e.shiftKey || e.metaKey || e.ctrlKey) { setSelectedNodeIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); } else { setSelectedNodeIds([id]); }
                      const n = nodes.find(x => x.id === id);
                      if (n) {
                          const w = n.width || 420; const h = n.height || getApproxNodeHeight(n); const cx = n.x + w/2; const cy = n.y + 160; 
                          const pGroup = groups.find(g => { return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height; });
                          let siblingNodeIds: string[] = [];
                          if (pGroup) { siblingNodeIds = nodes.filter(other => { if (other.id === id) return false; const b = getNodeBounds(other); const ocx = b.x + b.width/2; const ocy = b.y + b.height/2; return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height; }).map(s => s.id); }
                          dragNodeRef.current = { id, startX: n.x, startY: n.y, mouseStartX: e.clientX, mouseStartY: e.clientY, parentGroupId: pGroup?.id, siblingNodeIds, nodeWidth: w, nodeHeight: h };
                          setDraggingNodeParentGroupId(pGroup?.id || null); setDraggingNodeId(id); 
                      }
                  }}
                  onPortMouseDown={(e, id, type) => { e.stopPropagation(); setConnectionStart({ id, x: e.clientX, y: e.clientY }); }}
                  onPortMouseUp={(e, id, type) => {
                      e.stopPropagation();
                      const start = connectionStartRef.current;
                      if (start && start.id !== id) {
                          if (start.id === 'smart-sequence-dock') {
                              // Smart Sequence Dock 的连接逻辑保持不变
                          } else {
                              // 获取源节点和目标节点
                              const fromNode = nodes.find(n => n.id === start.id);
                              const toNode = nodes.find(n => n.id === id);

                              if (fromNode && toNode) {
                                  // 验证连接是否合法
                                  const validation = validateConnection(fromNode, toNode, connections);

                                  if (validation.valid) {
                                      // 连接合法,创建连接
                                      setConnections(p => [...p, { from: start.id, to: id }]);
                                      setNodes(p => p.map(n =>
                                          n.id === id ? { ...n, inputs: [...n.inputs, start.id] } : n
                                      ));
                                  } else {
                                      // 连接不合法,显示错误提示
                                      alert(validation.error || '无法创建连接');
                                  }
                              }
                          }
                      }
                      setConnectionStart(null);
                  }}
                  onNodeContextMenu={(e, id) => { e.stopPropagation(); e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id }); setContextMenuTarget({ type: 'node', id }); }}
                  onResizeMouseDown={(e, id, w, h) => { 
                      e.stopPropagation(); const n = nodes.find(x => x.id === id);
                      if (n) {
                          const cx = n.x + w/2; const cy = n.y + 160; 
                          const pGroup = groups.find(g => { return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height; });
                          setDraggingNodeParentGroupId(pGroup?.id || null);
                          let siblingNodeIds: string[] = [];
                          if (pGroup) { siblingNodeIds = nodes.filter(other => { if (other.id === id) return false; const b = getNodeBounds(other); const ocx = b.x + b.width/2; const ocy = b.y + b.height/2; return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height; }).map(s => s.id); }
                          resizeContextRef.current = { nodeId: id, initialWidth: w, initialHeight: h, startX: e.clientX, startY: e.clientY, parentGroupId: pGroup?.id || null, siblingNodeIds };
                      }
                      setResizingNodeId(id); setInitialSize({ width: w, height: h }); setResizeStartPos({ x: e.clientX, y: e.clientY }); 
                  }}
                  onCharacterAction={handleCharacterAction}
                  onViewCharacter={(char) => setViewingCharacter({ character: char, nodeId: node.id })}
                  isSelected={selectedNodeIds.includes(node.id)} 
                  inputAssets={node.inputs.map(i => nodes.find(n => n.id === i)).filter(n => n && (n.data.image || n.data.videoUri || n.data.croppedFrame)).slice(0, 6).map(n => ({ id: n!.id, type: (n!.data.croppedFrame || n!.data.image) ? 'image' : 'video', src: n!.data.croppedFrame || n!.data.image || n!.data.videoUri! }))}
                  onInputReorder={(nodeId, newOrder) => { const node = nodes.find(n => n.id === nodeId); if (node) { setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, inputs: newOrder } : n)); } }}
                  isDragging={draggingNodeId === node.id} isResizing={resizingNodeId === node.id} isConnecting={!!connectionStart} isGroupDragging={activeGroupNodeIds.includes(node.id)}
              />
              ))}

              {selectionRect && <div className="absolute border border-cyan-500/40 bg-cyan-500/10 rounded-lg pointer-events-none" style={{ left: (Math.min(selectionRect.startX, selectionRect.currentX) - canvas.pan.x) / canvas.scale, top: (Math.min(selectionRect.startY, selectionRect.currentY) - canvas.pan.y) / canvas.scale, width: Math.abs(selectionRect.currentX - selectionRect.startX) / canvas.scale, height: Math.abs(selectionRect.currentY - selectionRect.startY) / canvas.scale }} />}
          </div>

          {/* Context Menu Component */}
          <CanvasContextMenu
              visible={contextMenu?.visible || false}
              x={contextMenu?.x || 0}
              y={contextMenu?.y || 0}
              target={contextMenuTarget}
              nodeData={nodes.find(n => n.id === contextMenu?.id)?.data}
              nodeType={nodes.find(n => n.id === contextMenu?.id)?.type}
              nodeTypes={[
                  NodeType.PROMPT_INPUT,
                  NodeType.IMAGE_GENERATOR,
                  NodeType.VIDEO_GENERATOR,
                  NodeType.AUDIO_GENERATOR,
                  NodeType.SCRIPT_PLANNER,
                  NodeType.SCRIPT_EPISODE,
                  NodeType.CHARACTER_NODE,
                  NodeType.STORYBOARD_GENERATOR,
                  NodeType.STORYBOARD_IMAGE,
                  NodeType.DRAMA_ANALYZER,
                  NodeType.VIDEO_ANALYZER,
                  NodeType.IMAGE_EDITOR
              ]}
              onClose={() => setContextMenu(null)}
              onAction={(action, data) => {
                  switch (action) {
                      case 'copy':
                          const targetNode = nodes.find(n => n.id === data);
                          if (targetNode) setClipboard(JSON.parse(JSON.stringify(targetNode)));
                          break;

                      case 'replace':
                          replacementTargetRef.current = data;
                          const node = nodes.find(n => n.id === data);
                          if (node) {
                              const isVideo = node.type === NodeType.VIDEO_GENERATOR || node.type === NodeType.VIDEO_ANALYZER;
                              if (isVideo) replaceVideoInputRef.current?.click();
                              else replaceImageInputRef.current?.click();
                          }
                          break;

                      case 'delete':
                          deleteNodes([data]);
                          break;

                      case 'downloadImage':
                          const downloadNode = nodes.find(n => n.id === data);
                          console.log('[下载分镜图] 节点ID:', data, '节点数据:', downloadNode?.data);

                          if (!downloadNode) {
                              console.error('[下载分镜图] 未找到节点');
                              break;
                          }

                          if (downloadNode.data.storyboardGridImages?.length > 0) {
                              // 下载所有分镜图页面
                              console.log('[下载分镜图] 开始下载', downloadNode.data.storyboardGridImages.length, '张图片');

                              downloadNode.data.storyboardGridImages.forEach((imageUrl: string, index: number) => {
                                  setTimeout(() => {
                                      try {
                                          const a = document.createElement('a');
                                          a.href = imageUrl;
                                          a.download = `storyboard-page-${index + 1}-${Date.now()}.png`;
                                          a.target = '_blank'; // 在新标签页打开，避免浏览器阻止
                                          document.body.appendChild(a);
                                          a.click();
                                          setTimeout(() => document.body.removeChild(a), 100);
                                          console.log(`[下载分镜图] 第 ${index + 1} 张下载完成`);
                                      } catch (err) {
                                          console.error(`[下载分镜图] 第 ${index + 1} 张下载失败:`, err);
                                      }
                                  }, index * 800); // 增加间隔到800ms
                              });
                          } else if (downloadNode.data.storyboardGridImage) {
                              // 下载单张分镜图
                              console.log('[下载分镜图] 下载单张图片');
                              const a = document.createElement('a');
                              a.href = downloadNode.data.storyboardGridImage;
                              a.download = `storyboard-${Date.now()}.png`;
                              a.target = '_blank';
                              document.body.appendChild(a);
                              a.click();
                              setTimeout(() => document.body.removeChild(a), 100);
                          } else {
                              console.warn('[下载分镜图] 节点中没有找到图片数据');
                          }
                          break;

                      case 'createNode':
                          addNode(data.type, (data.x - canvas.pan.x) / canvas.scale, (data.y - canvas.pan.y) / canvas.scale);
                          break;

                      case 'saveGroup':
                          saveGroupAsWorkflow(data);
                          break;

                      case 'deleteGroup':
                          setGroups(p => p.filter(g => g.id !== data));
                          break;

                      case 'deleteConnection':
                          setConnections(prev => prev.filter(c => c.from !== data.from || c.to !== data.to));
                          setNodes(prev => prev.map(n =>
                              n.id === data.to ? { ...n, inputs: n.inputs.filter(i => i !== data.from) } : n
                          ));
                          break;

                      default:
                          console.warn('Unknown action:', action);
                  }
              }}
              getNodeIcon={getNodeIcon}
              getNodeName={getNodeNameCN}
          />
          
          {croppingNodeId && imageToCrop && <ImageCropper imageSrc={imageToCrop} onCancel={() => {setCroppingNodeId(null); setImageToCrop(null);}} onConfirm={(b) => {handleNodeUpdate(croppingNodeId, {croppedFrame: b}); setCroppingNodeId(null); setImageToCrop(null);}} />}
          <ExpandedView media={expandedMedia} onClose={() => setExpandedMedia(null)} />
          {isSketchEditorOpen && <SketchEditor onClose={() => setIsSketchEditorOpen(false)} onGenerate={handleSketchResult} />}
          <SmartSequenceDock 
             isOpen={isMultiFrameOpen} 
             onClose={() => setIsMultiFrameOpen(false)} 
             onGenerate={handleMultiFrameGenerate}
             onConnectStart={(e, type) => { e.preventDefault(); e.stopPropagation(); setConnectionStart({ id: 'smart-sequence-dock', x: e.clientX, y: e.clientY }); }}
          />
          <SonicStudio 
            isOpen={isSonicStudioOpen}
            onClose={() => setIsSonicStudioOpen(false)}
            history={assetHistory.filter(a => a.type === 'audio')}
            onGenerate={(src, prompt) => handleAssetGenerated('audio', src, prompt)}
          />
          <CharacterLibrary 
            isOpen={isCharacterLibraryOpen}
            onClose={() => setIsCharacterLibraryOpen(false)}
            characters={assetHistory.filter(a => a.type === 'character').map(a => a.data)}
            onDelete={(id) => {
                // Find matching asset ID (which is the char.id)
                setAssetHistory(prev => prev.filter(a => a.id !== id));
            }}
          />
          <CharacterDetailModal
            character={viewingCharacter?.character || null}
            nodeId={viewingCharacter?.nodeId}
            allNodes={nodes}
            onClose={() => setViewingCharacter(null)}
            onGenerateExpression={(nodeId, charName) => handleCharacterAction(nodeId, 'GENERATE_EXPRESSION', charName)}
            onGenerateThreeView={(nodeId, charName) => handleCharacterAction(nodeId, 'GENERATE_THREE_VIEW', charName)}
          />
          <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          <ApiKeyPrompt
            isOpen={isApiKeyPromptOpen}
            onClose={() => setIsApiKeyPromptOpen(false)}
            onSave={handleApiKeySave}
          />
          <DebugPanel
            isOpen={isDebugOpen}
            onClose={() => setIsDebugOpen(false)}
          />

          {/* 模型降级通知 */}
          <ModelFallbackNotification />

          <SidebarDock
              onAddNode={addNode}
              onUndo={undo}
              isChatOpen={isChatOpen}
              onToggleChat={() => setIsChatOpen(!isChatOpen)}
              isMultiFrameOpen={isMultiFrameOpen}
              onToggleMultiFrame={() => setIsMultiFrameOpen(!isMultiFrameOpen)}
              isSonicStudioOpen={isSonicStudioOpen}
              onToggleSonicStudio={() => setIsSonicStudioOpen(!isSonicStudioOpen)}
              isCharacterLibraryOpen={isCharacterLibraryOpen}
              onToggleCharacterLibrary={() => setIsCharacterLibraryOpen(!isCharacterLibraryOpen)}
              isDebugOpen={isDebugOpen}
              onToggleDebug={() => setIsDebugOpen(!isDebugOpen)}
              assetHistory={assetHistory}
              onHistoryItemClick={(item) => { const type = item.type.includes('image') ? NodeType.IMAGE_GENERATOR : NodeType.VIDEO_GENERATOR; const data = item.type === 'image' ? { image: item.src } : { videoUri: item.src }; addNode(type, undefined, undefined, data); }}
              onDeleteAsset={(id) => setAssetHistory(prev => prev.filter(a => a.id !== id))}
              workflows={workflows}
              selectedWorkflowId={selectedWorkflowId}
              onSelectWorkflow={loadWorkflow}
              onSaveWorkflow={saveCurrentAsWorkflow}
              onDeleteWorkflow={deleteWorkflow}
              onRenameWorkflow={renameWorkflow}
              onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <AssistantPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

          {/* Language Toggle Button */}
          <div className="absolute top-8 right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-700">
              <button
                  onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl text-slate-300 hover:text-white hover:border-white/20 transition-all hover:scale-105"
                  title={t.settings.language}
              >
                  <Languages size={16} />
                  <span className="text-xs font-medium">{language === 'zh' ? t.settings.english : t.settings.chinese}</span>
              </button>
          </div>

          <div className="absolute bottom-8 right-8 flex items-center gap-3 px-4 py-2 bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <button onClick={() => canvas.setScale(s => Math.max(0.2, s - 0.1))} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"><Minus size={14} strokeWidth={3} /></button>
              <div className="flex items-center gap-2 min-w-[100px]">
                   <input type="range" min="0.2" max="3" step="0.1" value={canvas.scale} onChange={(e) => canvas.setScale(parseFloat(e.target.value))} className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-125 transition-all" />
                   <span className="text-[10px] font-bold text-slate-400 w-8 text-right tabular-nums cursor-pointer hover:text-white" onClick={() => canvas.setScale(1)} title="Reset Zoom">{Math.round(canvas.scale * 100)}%</span>
              </div>
              <button onClick={() => canvas.setScale(s => Math.min(3, s + 0.1))} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"><Plus size={14} strokeWidth={3} /></button>
              <button onClick={handleFitView} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10 ml-2 border-l border-white/10 pl-3" title="适配视图">
                  <Scan size={14} strokeWidth={3} />
              </button>
          </div>
      </div>
    </div>
  );
};