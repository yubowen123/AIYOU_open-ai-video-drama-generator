
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
import { AppNode, NodeType, NodeStatus, Connection, ContextMenuState, Group, Workflow, SmartSequenceItem, CharacterProfile } from './types';
import { generateImageFromText, generateVideo, analyzeVideo, editImageWithText, planStoryboard, orchestrateVideoPrompt, compileMultiFramePrompt, urlToBase64, extractLastFrame, generateAudio, generateScriptPlanner, generateScriptEpisodes, generateCinematicStoryboard, extractCharactersFromText, generateCharacterProfile, detectTextInImage, analyzeDrama } from './services/geminiService';
import { getGenerationStrategy } from './services/videoStrategies';
import { saveToStorage, loadFromStorage } from './services/storage';
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
  const [viewingCharacter, setViewingCharacter] = useState<CharacterProfile | null>(null);

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
      const defaults: any = { 
          model: type === NodeType.VIDEO_GENERATOR ? 'veo-3.1-fast-generate-preview' :
                 type === NodeType.VIDEO_ANALYZER ? 'gemini-3-pro-preview' :
                 type === NodeType.AUDIO_GENERATOR ? 'gemini-2.5-flash-preview-tts' :
                 type === NodeType.SCRIPT_PLANNER ? 'gemini-2.5-flash' :
                 type === NodeType.SCRIPT_EPISODE ? 'gemini-2.5-flash' :
                 type === NodeType.STORYBOARD_GENERATOR ? 'gemini-3-pro-preview' :
                 type === NodeType.CHARACTER_NODE ? 'gemini-3-pro-preview' :
                 type.includes('IMAGE') ? 'gemini-2.5-flash-image' :
                 'gemini-3-pro-preview',
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

  // Helper to get unified style context from upstream
  const getUpstreamStyleContext = (node: AppNode, allNodes: AppNode[]): { style: string, genre: string, setting: string } => {
      const inputs = node.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];
      let style = node.data.scriptVisualStyle || 'REAL';
      let genre = '';
      let setting = '';

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
      }
      
      return { style, genre, setting };
  };

  // --- Character Action Handler ---
  const handleCharacterAction = async (nodeId: string, action: 'DELETE' | 'SAVE' | 'RETRY', charName: string) => {
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
                  Character Three-View Reference Sheet (Front, Side, Back).
                  Subject: ${char.appearance}.
                  Attributes: ${char.basicStats}.
                  Full body standing pose, neutral expression.
                  Clean white background.
                  
                  IMPORTANT REQUIREMENTS:
                  - PURE IMAGE ONLY.
                  - NO TEXT, NO LABELS, NO WRITING.
                  - NO "FRONT VIEW" or "SIDE VIEW" labels.
                  - NO info boxes or character stats.
                  - Reference the character in the input image strictly. Maintain facial features, hair color, and clothing style.
                  
                  Negative: ${negativePrompt}.
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
                          viewImages = await generateImageFromText(retryPrompt, 'gemini-2.5-flash-image', inputImages, { aspectRatio: '3:4', count: 1 });
                      } else {
                          viewImages = await generateImageFromText(viewPrompt, 'gemini-2.5-flash-image', inputImages, { aspectRatio: '3:4', count: 1 });
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
          // Reset status and regenerate Expression Sheet ONLY
          const updatedGenerated = generated.map(c => c.name === charName ? { ...c, status: 'GENERATING' as const, error: undefined, isSaved: false } : c);
          handleNodeUpdate(nodeId, { generatedCharacters: updatedGenerated });

          const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];
          const upstreamTexts = inputs.map(n => {
              if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
              if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
              if (n?.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes) {
                  // 只传递角色列表和标题，不传完整剧本内容
                  return n.data.generatedEpisodes.map(ep => `${ep.title}\n角色: ${ep.characters}`).join('\n');
              }
              if (n?.type === NodeType.SCRIPT_PLANNER) return n.data.scriptOutline;
              return null;
          }).filter(t => t && t.trim().length > 0) as string[];

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

          const context = upstreamTexts.join('\n');
          const config = node.data.characterConfigs?.[charName] || { method: 'AI_AUTO' };
          const customDesc = config.method === 'AI_CUSTOM' ? config.customPrompt : undefined;

          try {
              // Use style prompt from STYLE_PRESET or upstream context
              const profile = await generateCharacterProfile(charName, context, stylePrompt, customDesc);
              profile.status = 'GENERATING'; 
              
              const currentList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
              const idx = currentList.findIndex(c => c.name === charName);
              if (idx >= 0) currentList[idx] = profile; else currentList.push(profile);
              handleNodeUpdate(nodeId, { generatedCharacters: currentList });

              const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui";
              
              // Generate Expression Sheet
              const exprPrompt = `
              ${stylePrompt}
              Character Reference Sheet, 3x3 grid layout showing 9 different facial expressions (joy, anger, sorrow, surprise, fear, disgust, neutral, thinking, tired).
              Subject: ${profile.appearance}.
              Attributes: ${profile.basicStats}.
              White background, consistent character design.
              Composition: 3x3 grid.
              Negative: ${negativePrompt}.
              `;
              const exprImages = await generateImageFromText(exprPrompt, 'gemini-2.5-flash-image', [], { aspectRatio: '1:1', count: 1 });
              profile.expressionSheet = exprImages[0];
              profile.status = 'SUCCESS';
              
              const finalList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
              const fIdx = finalList.findIndex(c => c.name === charName);
              if (fIdx >= 0) finalList[fIdx] = profile;
              handleNodeUpdate(nodeId, { generatedCharacters: finalList });

          } catch (e: any) {
              const failList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
              const failIdx = failList.findIndex(c => c.name === charName);
              if (failIdx >= 0) failList[failIdx] = { ...failList[failIdx], status: 'ERROR', error: e.message };
              handleNodeUpdate(nodeId, { generatedCharacters: failList });
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

              if (!node.data.extractedCharacterNames || node.data.extractedCharacterNames.length === 0) {
                  if (upstreamTexts.length > 0) {
                      // Extract character names from ALL connected inputs
                      const allCharacterNames: string[] = [];

                      for (const text of upstreamTexts) {
                          const names = await extractCharactersFromText(text);
                          allCharacterNames.push(...names);
                      }

                      // Deduplicate character names (case-insensitive)
                      const uniqueNames = Array.from(new Set(allCharacterNames.map(name => name.trim()))).filter(name => name.length > 0);

                      console.log('[CHARACTER_NODE] Extracted characters from', upstreamTexts.length, 'inputs:', uniqueNames);

                      handleNodeUpdate(id, { extractedCharacterNames: uniqueNames, characterConfigs: {} });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                      return;
                  } else {
                      throw new Error("请先连接剧本大纲或剧本分集节点");
                  }
              }

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
                  
                  // Skip if already generated successfully
                  if (newGeneratedChars.find(c => c.name === name && c.status === 'SUCCESS')) continue;

                  let charProfile = newGeneratedChars.find(c => c.name === name);
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
                  } else {
                      const context = upstreamTexts.join('\n');
                      const customDesc = config.method === 'AI_CUSTOM' ? config.customPrompt : undefined;

                      try {
                          // Use style prompt from STYLE_PRESET or upstream context
                          const profile = await generateCharacterProfile(name, context, stylePrompt, customDesc);
                          profile.status = 'GENERATING';
                          
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          newGeneratedChars[idx] = profile;
                          handleNodeUpdate(id, { generatedCharacters: [...newGeneratedChars] });

                          const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui";
                          
                          // Generate Expression Sheet
                          // CRITICAL: Prepend Style Prompt to ensure visual match
                          const exprPrompt = `
                          ${stylePrompt}
                          Character Reference Sheet, 3x3 grid layout showing 9 different facial expressions (joy, anger, sorrow, surprise, fear, disgust, neutral, thinking, tired).
                          Subject: ${profile.appearance}.
                          Attributes: ${profile.basicStats}.
                          White background, consistent character design.
                          Composition: 3x3 grid.
                          Negative: ${negativePrompt}.
                          `;
                          const exprImages = await generateImageFromText(exprPrompt, 'gemini-2.5-flash-image', [], { aspectRatio: '1:1', count: 1 });
                          profile.expressionSheet = exprImages[0];

                          profile.status = 'SUCCESS';
                          newGeneratedChars[idx] = profile;
                      } catch (e: any) {
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          newGeneratedChars[idx] = { ...newGeneratedChars[idx], status: 'ERROR', error: e.message };
                      }
                  }
                  
                  handleNodeUpdate(id, { generatedCharacters: [...newGeneratedChars] });
              }
              handleNodeUpdate(id, { generatedCharacters: newGeneratedChars });

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
              }, refinedInfo); // 传入精炼信息作为参考
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

              const episodes = await generateScriptEpisodes(
                  planner.data.scriptOutline,
                  node.data.selectedChapter,
                  node.data.episodeSplitCount || 3,
                  planner.data.scriptDuration || 1,
                  currentStyle, // Pass Visual Style
                  node.data.episodeModificationSuggestion // Pass Modification Suggestion
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
                      const formattedContent = `## ${ep.title}\n\n**角色**: ${ep.characters}\n\n${ep.content}`;
                      
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
              const res = await generateImageFromText(finalPrompt, node.data.model, inputImages, { aspectRatio: node.data.aspectRatio || '16:9', resolution: node.data.resolution, count: node.data.imageCount });
              handleNodeUpdate(id, { image: res[0], images: res });

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
                  strategy.referenceImages
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
              }

          } else if (node.type === NodeType.AUDIO_GENERATOR) {
              // Extract style preset from inputs
              const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
              const stylePrefix = stylePresetNode?.data.stylePrompt || '';
              const finalPrompt = stylePrefix ? `${stylePrefix}, ${prompt}` : prompt;

              const audioUri = await generateAudio(finalPrompt);
              handleNodeUpdate(id, { audioUri: audioUri });

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
                      const imgs = await generateImageFromText(visualPrompt, 'gemini-2.5-flash-image', [], { aspectRatio: node.data.aspectRatio || '16:9', count: 1 });
                      if (imgs && imgs.length > 0) {
                          updatedShots[shotIndex] = { ...shot, imageUrl: imgs[0] };
                          handleNodeUpdate(id, { storyboardShots: [...updatedShots] });
                      }
                  } catch (e) {
                      console.warn(`Failed to gen image for shot ${shotIndex}`, e);
                  }
              };

              await Promise.all(updatedShots.map((_, i) => processShotImage(i)));

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
                  onViewCharacter={(char) => setViewingCharacter(char)}
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
              nodeTypes={[
                  NodeType.PROMPT_INPUT,
                  NodeType.IMAGE_GENERATOR,
                  NodeType.VIDEO_GENERATOR,
                  NodeType.AUDIO_GENERATOR,
                  NodeType.SCRIPT_PLANNER,
                  NodeType.SCRIPT_EPISODE,
                  NodeType.CHARACTER_NODE,
                  NodeType.STORYBOARD_GENERATOR,
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
            character={viewingCharacter}
            onClose={() => setViewingCharacter(null)}
          />
          <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          <ApiKeyPrompt
            isOpen={isApiKeyPromptOpen}
            onClose={() => setIsApiKeyPromptOpen(false)}
            onSave={handleApiKeySave}
          />

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