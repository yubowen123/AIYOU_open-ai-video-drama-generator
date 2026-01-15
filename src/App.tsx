
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Node } from './components/Node';
import { SidebarDock } from './components/SidebarDock';
import { AssistantPanel } from './components/AssistantPanel';
import { ImageCropper } from './components/ImageCropper';
import { SketchEditor } from './components/SketchEditor'; 
import { SmartSequenceDock } from './components/SmartSequenceDock';
import { SonicStudio } from './components/SonicStudio'; 
import { CharacterLibrary } from './components/CharacterLibrary';
import { CharacterDetailModal } from './components/CharacterDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { AppNode, NodeType, NodeStatus, Connection, ContextMenuState, Group, Workflow, SmartSequenceItem, CharacterProfile } from './types';
import { generateImageFromText, generateVideo, analyzeVideo, editImageWithText, planStoryboard, orchestrateVideoPrompt, compileMultiFramePrompt, urlToBase64, extractLastFrame, generateAudio, generateScriptPlanner, generateScriptEpisodes, generateCinematicStoryboard, extractCharactersFromText, generateCharacterProfile, detectTextInImage, analyzeDrama } from './services/geminiService';
import { getUserDefaultModel } from '../services/modelConfig';
import { getGenerationStrategy } from './services/videoStrategies';
import { saveToStorage, loadFromStorage } from './services/storage';
import { 
    Plus, Copy, Trash2, Type, Image as ImageIcon, Video as VideoIcon, 
    ScanFace, Brush, MousePointerClick, LayoutTemplate, X, Film, Link, RefreshCw, Upload,
    Minus, FolderHeart, Unplug, Sparkles, ChevronLeft, ChevronRight, Scan, Music, Mic2, Loader2, ScrollText, Clapperboard, User, BookOpen
} from 'lucide-react';

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
  const [workflows, setWorkflows] = useState<Workflow[]>([]); 
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false); 
  
  // Modal States
  const [isSketchEditorOpen, setIsSketchEditorOpen] = useState(false);
  const [isMultiFrameOpen, setIsMultiFrameOpen] = useState(false);
  const [isSonicStudioOpen, setIsSonicStudioOpen] = useState(false);
  const [isCharacterLibraryOpen, setIsCharacterLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewingCharacter, setViewingCharacter] = useState<CharacterProfile | null>(null);

  // --- Canvas State ---
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [clipboard, setClipboard] = useState<AppNode | null>(null); 
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
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
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
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
      nodesRef.current = nodes; connectionsRef.current = connections; groupsRef.current = groups;
      historyRef.current = history; historyIndexRef.current = historyIndex; connectionStartRef.current = connectionStart;
  }, [nodes, connections, groups, history, historyIndex, connectionStart]);

  useEffect(() => {
      if (window.aistudio) window.aistudio.hasSelectedApiKey().then(hasKey => { if (!hasKey) window.aistudio.openSelectKey(); });
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

  const getApproxNodeHeight = (node: AppNode) => {
      if (node.height) return node.height;
      const width = node.width || 420;
      if (node.type === NodeType.STORYBOARD_GENERATOR) return 500;
      if (node.type === NodeType.CHARACTER_NODE) return 600; 
      if (['PROMPT_INPUT', 'VIDEO_ANALYZER', 'IMAGE_EDITOR', 'SCRIPT_PLANNER', 'SCRIPT_EPISODE'].includes(node.type)) return 360;
      if (node.type === NodeType.AUDIO_GENERATOR) return 200;
      if (node.type === NodeType.DRAMA_ANALYZER) return 550;
      const [w, h] = (node.data.aspectRatio || '16:9').split(':').map(Number);
      const extra = (node.type === NodeType.VIDEO_GENERATOR && node.data.generationMode === 'CUT') ? 36 : 0;
      return ((width * h / w) + extra);
  };
  
  const getNodeBounds = (node: AppNode) => {
      const h = node.height || getApproxNodeHeight(node);
      const w = node.width || 420;
      return { x: node.x, y: node.y, width: w, height: h, r: node.x + w, b: node.y + h };
  };

  const getNodeNameCN = (t: string) => {
      switch(t) {
          case NodeType.PROMPT_INPUT: return '创意描述';
          case NodeType.IMAGE_GENERATOR: return '文字生图';
          case NodeType.VIDEO_GENERATOR: return '文生视频';
          case NodeType.AUDIO_GENERATOR: return '灵感音乐';
          case NodeType.VIDEO_ANALYZER: return '视频分析';
          case NodeType.IMAGE_EDITOR: return '图像编辑';
          case NodeType.SCRIPT_PLANNER: return '剧本大纲';
          case NodeType.SCRIPT_EPISODE: return '剧本分集';
          case NodeType.STORYBOARD_GENERATOR: return '分镜生成';
          case NodeType.CHARACTER_NODE: return '角色设计';
          case NodeType.DRAMA_ANALYZER: return '剧本分析';
          default: return t;
      }
  };
  const getNodeIcon = (t: string) => {
      switch(t) {
          case NodeType.PROMPT_INPUT: return Type;
          case NodeType.IMAGE_GENERATOR: return ImageIcon;
          case NodeType.VIDEO_GENERATOR: return Film;
          case NodeType.AUDIO_GENERATOR: return Mic2;
          case NodeType.VIDEO_ANALYZER: return ScanFace;
          case NodeType.IMAGE_EDITOR: return Brush;
          case NodeType.SCRIPT_PLANNER: return BookOpen;
          case NodeType.SCRIPT_EPISODE: return ScrollText;
          case NodeType.STORYBOARD_GENERATOR: return Clapperboard;
          case NodeType.CHARACTER_NODE: return User;
          case NodeType.DRAMA_ANALYZER: return BookOpen;
          default: return Plus;
      }
  };

  const handleFitView = useCallback(() => {
      if (nodes.length === 0) {
          setPan({ x: 0, y: 0 });
          setScale(1);
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
      setPan({ x: newPanX, y: newPanY });
      setScale(newScale);
  }, [nodes]);

  const saveHistory = useCallback(() => {
      try {
          const currentStep = { nodes: JSON.parse(JSON.stringify(nodesRef.current)), connections: JSON.parse(JSON.stringify(connectionsRef.current)), groups: JSON.parse(JSON.stringify(groupsRef.current)) };
          const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
          newHistory.push(currentStep); if (newHistory.length > 50) newHistory.shift(); 
          setHistory(newHistory); setHistoryIndex(newHistory.length - 1);
      } catch (e) {
          console.warn("History save failed:", e);
      }
  }, []);

  const undo = useCallback(() => {
      const idx = historyIndexRef.current; if (idx > 0) { const prev = historyRef.current[idx - 1]; setNodes(prev.nodes); setConnections(prev.connections); setGroups(prev.groups); setHistoryIndex(idx - 1); }
  }, []);

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
                 type === NodeType.DRAMA_ANALYZER ? 'gemini-3-pro-preview' :
                 type.includes('IMAGE') ? getUserDefaultModel('image') :
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
      
      const safeX = x !== undefined ? x : (-pan.x + window.innerWidth/2)/scale - 210;
      const safeY = y !== undefined ? y : (-pan.y + window.innerHeight/2)/scale - 180;

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
  }, [pan, scale, saveHistory]);

  const createStartEndWorkflow = () => {
        saveHistory();
        const startId = `n-start-${Date.now()}`;
        const endId = `n-end-${Date.now()}`;
        const videoId = `n-vid-${Date.now()}`;
        
        const centerX = (-pan.x + window.innerWidth/2)/scale;
        const centerY = (-pan.y + window.innerHeight/2)/scale;

        const startNode: AppNode = {
            id: startId, type: NodeType.IMAGE_GENERATOR, x: centerX - 500, y: centerY - 200, width: 420,
            title: '起始帧 (Start Frame)', status: NodeStatus.IDLE, inputs: [],
            data: { model: getUserDefaultModel('image'), prompt: 'Cinematic shot, start scene...', aspectRatio: '16:9' }
        };

        const endNode: AppNode = {
            id: endId, type: NodeType.IMAGE_GENERATOR, x: centerX - 500, y: centerY + 250, width: 420,
            title: '结束帧 (End Frame)', status: NodeStatus.IDLE, inputs: [],
            data: { model: getUserDefaultModel('image'), prompt: 'Cinematic shot, end scene...', aspectRatio: '16:9' }
        };

        const videoNode: AppNode = {
            id: videoId, type: NodeType.VIDEO_GENERATOR, x: centerX + 100, y: centerY, width: 420,
            title: '视频生成 (FrameWeaver)', status: NodeStatus.IDLE, inputs: [startId, endId],
            data: { 
                model: 'veo-3.1-fast-generate-preview', 
                generationMode: 'FIRST_LAST_FRAME',
                prompt: 'Smooth transition between start and end frames.',
                aspectRatio: '16:9'
            }
        };

        setNodes(prev => [...prev, startNode, endNode, videoNode]);
        setConnections(prev => [...prev, { from: startId, to: videoId }, { from: endId, to: videoId }]);
  };

  const handleAssetGenerated = useCallback((type: 'image' | 'video' | 'audio', src: string, title: string) => {
      setAssetHistory(h => {
          const exists = h.find(a => a.src === src);
          if (exists) return h;
          return [{ id: `a-${Date.now()}`, type, src, title, timestamp: Date.now() }, ...h];
      });
  }, []);
  
  const handleSketchResult = (type: 'image' | 'video', result: string, prompt: string) => {
      const centerX = (-pan.x + window.innerWidth/2)/scale - 210;
      const centerY = (-pan.y + window.innerHeight/2)/scale - 180;
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
        e.preventDefault(); const newScale = Math.min(Math.max(0.2, scale - e.deltaY * 0.001), 3);
        const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
        const scaleDiff = newScale - scale;
        setPan(p => ({ x: p.x - (x - p.x) * (scaleDiff / scale), y: p.y - (y - p.y) * (scaleDiff / scale) }));
        setScale(newScale);
      } else { setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY })); }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (contextMenu) setContextMenu(null); setSelectedGroupId(null);
      if (e.button === 0 && !e.shiftKey) { 
          if (e.detail > 1) { e.preventDefault(); return; }
          setSelectedNodeIds([]); 
          setSelectionRect({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY }); 
      }
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) { setIsDraggingCanvas(true); setLastMousePos({ x: e.clientX, y: e.clientY }); }
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
      const { clientX, clientY } = e;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setMousePos({ x: clientX, y: clientY });
          if (selectionRect) { setSelectionRect((prev:any) => prev ? ({ ...prev, currentX: clientX, currentY: clientY }) : null); return; }
          if (dragGroupRef.current) {
              const { id, startX, startY, mouseStartX, mouseStartY, childNodes } = dragGroupRef.current;
              const dx = (clientX - mouseStartX) / scale;
              const dy = (clientY - mouseStartY) / scale;
              setGroups(prev => prev.map(g => g.id === id ? { ...g, x: startX + dx, y: startY + dy } : g));
              if (childNodes.length > 0) { 
                  setNodes(prev => prev.map(n => { 
                      const child = childNodes.find(c => c.id === n.id); 
                      return child ? { ...n, x: child.startX + dx, y: child.startY + dy } : n; 
                  })); 
              } 
              return;
          }
          if (isDraggingCanvas) { 
              const dx = clientX - lastMousePos.x; 
              const dy = clientY - lastMousePos.y; 
              setPan(p => ({ x: p.x + dx, y: p.y + dy })); 
              setLastMousePos({ x: clientX, y: clientY }); 
          }
          if (draggingNodeId && dragNodeRef.current && dragNodeRef.current.id === draggingNodeId) {
             const { startX, startY, mouseStartX, mouseStartY, nodeWidth, nodeHeight } = dragNodeRef.current;
             let dx = (clientX - mouseStartX) / scale;
             let dy = (clientY - mouseStartY) / scale;
             let proposedX = startX + dx;
             let proposedY = startY + dy;
             const SNAP = SNAP_THRESHOLD / scale; 
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
          } else if (draggingNodeId) {
              const dx = (clientX - lastMousePos.x) / scale; 
              const dy = (clientY - lastMousePos.y) / scale; 
              setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n));
              setLastMousePos({ x: clientX, y: clientY });
          }
          if (resizingNodeId && initialSize && resizeStartPos) {
              const dx = (clientX - resizeStartPos.x) / scale; const dy = (clientY - resizeStartPos.y) / scale;
              setNodes(prev => prev.map(n => n.id === resizingNodeId ? { ...n, width: Math.max(360, initialSize.width + dx), height: Math.max(240, initialSize.height + dy) } : n));
          }
      });
  }, [selectionRect, isDraggingCanvas, draggingNodeId, resizingNodeId, initialSize, resizeStartPos, scale, lastMousePos]);

  const handleGlobalMouseUp = useCallback(() => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (selectionRect) {
          const x = Math.min(selectionRect.startX, selectionRect.currentX); const y = Math.min(selectionRect.startY, selectionRect.currentY);
          const w = Math.abs(selectionRect.currentX - selectionRect.startX); const h = Math.abs(selectionRect.currentY - selectionRect.startY);
          if (w > 10) {
              const rect = { x: (x - pan.x) / scale, y: (y - pan.y) / scale, w: w / scale, h: h / scale };
              const enclosed = nodesRef.current.filter(n => { const cx = n.x + (n.width||420)/2; const cy = n.y + 160; return cx>rect.x && cx<rect.x+rect.w && cy>rect.y && cy<rect.y+rect.h; });
              if (enclosed.length > 0) { saveHistory(); 
                  const freeNodes = enclosed.filter(n => {
                      const cx = n.x + (n.width || 420) / 2; const cy = n.y + 160;
                      return !groupsRef.current.some(g => cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height);
                  });
                  if (freeNodes.length > 0) {
                      const fMinX=Math.min(...freeNodes.map(n=>n.x)), fMinY=Math.min(...freeNodes.map(n=>n.y)), fMaxX=Math.max(...freeNodes.map(n=>n.x+(n.width||420))), fMaxY=Math.max(...freeNodes.map(n=>n.y+320));
                      setGroups(prev => [...prev, { id: `g-${Date.now()}`, title: '新建分组', x: fMinX-32, y: fMinY-32, width: (fMaxX-fMinX)+64, height: (fMaxY-fMinY)+64 }]);
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
                       myBounds.x = draggedNode.x; myBounds.y = draggedNode.y; myBounds.r = draggedNode.x + myBounds.width; myBounds.b = draggedNode.y + myBounds.height;
                  }
              }
              setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: draggedNode.x, y: draggedNode.y } : n));
          }
      }
      if (draggingNodeId || resizingNodeId || dragGroupRef.current) saveHistory();
      setIsDraggingCanvas(false); setDraggingNodeId(null); setDraggingNodeParentGroupId(null); setDraggingGroup(null); setResizingGroupId(null); setActiveGroupNodeIds([]); setResizingNodeId(null); setInitialSize(null); setResizeStartPos(null); setConnectionStart(null);
      dragNodeRef.current = null; resizeContextRef.current = null; dragGroupRef.current = null;
  }, [selectionRect, pan, scale, saveHistory, draggingNodeId, resizingNodeId]);

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
          base = 'Photorealistic 3D render, highly realistic human characters, lifelike skin textures, natural subsurface scattering, realistic eyes with detailed iris, accurate anatomy, high-fidelity 3D modeling, Unreal Engine 5, MetaHuman, cinematic lighting, volumetric light ray, global illumination, screen space reflections, 8k resolution, photorealistic materials, detailed fabric textures, realistic hair strands, natural skin pores and imperfections, live action quality.';
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

              // Fetch context for style using unified helper
              const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);

              try {
                  const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, username, website, chinese characters, info box, stats, descriptions, annotations";
                  const stylePrefix = getVisualPromptPrefix(style, genre, setting);
                  
                  const viewPrompt = `
                  ${stylePrefix}

                  CHARACTER THREE-VIEW GENERATION TASK:
                  Generate a character three-view reference sheet (front, side, back views) in 16:9 horizontal layout.

                  Character Description:
                  ${char.appearance}

                  Attributes: ${char.basicStats}

                  COMPOSITION LAYOUT - STRICT REQUIREMENTS:
                  - Aspect Ratio: 16:9 horizontal (landscape) format
                  - Layout: THREE EQUAL HORIZONTAL PANELS arranged LEFT TO RIGHT
                  - Left Panel: FRONT VIEW (full body, facing forward)
                  - Center Panel: SIDE VIEW (full body, profile view facing left or right)
                  - Right Panel: BACK VIEW (full body, facing backward)
                  - EACH PANEL MUST SHOW FULL BODY from head to feet
                  - Clean white or neutral background
                  - NO VERTICAL layout, NO GRID other than 3 horizontal panels

                  CRITICAL REQUIREMENTS:
                  1. FULL BODY ONLY - Each panel must show complete character from head to toe, NO half-body, NO portrait, NO upper body only
                  2. STRICT LAYOUT - Exactly 3 horizontal panels (left-center-right), NO other arrangements, NO vertical stacking, NO irregular layouts
                  3. CONSISTENT CHARACTER DESIGN - All three views must show the SAME character with consistent facial features, hair style, body proportions, and clothing
                  4. NO TEXT, NO LABELS - Pure image only, no "Front View" or "Side View" text labels, no Chinese characters, no English text
                  5. PROPER ANATOMY - Ensure correct body proportions and natural stance for each view angle
                  6. NEUTRAL EXPRESSION - Use a calm, neutral face expression across all views
                  7. CLEAR ALIGNMENT - All three figures should be aligned and proportionally consistent

                  ${char.expressionSheet ? 'REFERENCE IMAGE: Use the expression sheet as visual reference for face and clothing details.' : ''}

                  Negative: ${negativePrompt}, half body, portrait, upper body only, head and shoulders, close-up, vertical layout, grid, irregular layout, cropped, cut off.
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
                          viewImages = await generateImageFromText(retryPrompt, getUserDefaultModel('image'), inputImages, { aspectRatio: '16:9', count: 1 });
                      } else {
                          viewImages = await generateImageFromText(viewPrompt, getUserDefaultModel('image'), inputImages, { aspectRatio: '16:9', count: 1 });
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
                  return n.data.generatedEpisodes.map(ep => `Title: ${ep.title}\nCharacters: ${ep.characters}\nContent: ${ep.content}`).join('\n\n');
              }
              if (n?.type === NodeType.SCRIPT_PLANNER) return n.data.scriptOutline;
              return null;
          }).filter(t => t && t.trim().length > 0) as string[];
          
          // Use Unified Helper
          const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);

          const context = upstreamTexts.join('\n');
          const config = node.data.characterConfigs?.[charName] || { method: 'AI_AUTO' };
          const customDesc = config.method === 'AI_CUSTOM' ? config.customPrompt : undefined;

          try {
              // Pass style context to LLM for consistent text description
              const stylePrompt = getVisualPromptPrefix(style, genre, setting);
              const profile = await generateCharacterProfile(charName, context, stylePrompt, customDesc);
              profile.status = 'GENERATING'; 
              
              const currentList = [...(nodesRef.current.find(n => n.id === nodeId)?.data.generatedCharacters || [])];
              const idx = currentList.findIndex(c => c.name === charName);
              if (idx >= 0) currentList[idx] = profile; else currentList.push(profile);
              handleNodeUpdate(nodeId, { generatedCharacters: currentList });

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
              CRITICAL: NO TEXT, NO LABELS - Pure image only, no emotion labels (like "happy", "sad"), no numbers, no Chinese characters, no English text, no grid labels.
              Negative: ${negativePrompt}, text, labels, emotion names, numbers, letters, writing, watermark, signature.
              `;
              const exprImages = await generateImageFromText(exprPrompt, getUserDefaultModel('image'), [], { aspectRatio: '1:1', count: 1 });
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
      const node = nodesRef.current.find(n => n.id === id); if (!node) return;
      handleNodeUpdate(id, { error: undefined });
      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

      try {
          const inputs = node.inputs.map(i => nodesRef.current.find(n => n.id === i)).filter(Boolean) as AppNode[];
          
          const upstreamTexts = inputs.map(n => {
              if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
              if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
              if (n?.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes) {
                  return n.data.generatedEpisodes.map(ep => `Title: ${ep.title}\nCharacters: ${ep.characters}\nContent: ${ep.content}`).join('\n\n');
              }
              if (n?.type === NodeType.SCRIPT_PLANNER) return n.data.scriptOutline;
              return null;
          }).filter(t => t && t.trim().length > 0) as string[];

          let prompt = promptOverride || node.data.prompt || '';
          if (upstreamTexts.length > 0) {
              const combinedUpstream = upstreamTexts.join('\n\n');
              prompt = prompt ? `${combinedUpstream}\n\n${prompt}` : combinedUpstream;
          }

          if (node.type === NodeType.DRAMA_ANALYZER) {
              const analysis = await analyzeDrama(promptOverride || node.data.prompt || ""); 
              handleNodeUpdate(id, { dramaAnalysis: analysis });
          } else if (node.type === NodeType.CHARACTER_NODE) {
              // --- Character Node Generation Logic ---
              
              if (!node.data.extractedCharacterNames || node.data.extractedCharacterNames.length === 0) {
                  if (upstreamTexts.length > 0) {
                      const content = upstreamTexts.join('\n');
                      const names = await extractCharactersFromText(content);
                      handleNodeUpdate(id, { extractedCharacterNames: names, characterConfigs: {} });
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
              
              // Use Unified Helper
              const { style, genre, setting } = getUpstreamStyleContext(node, nodesRef.current);

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
                          // Pass style context string for Text Generation to align descriptions
                          const stylePrompt = getVisualPromptPrefix(style, genre, setting);
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
                          const exprImages = await generateImageFromText(exprPrompt, getUserDefaultModel('image'), [], { aspectRatio: '1:1', count: 1 });
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

          } else if (node.type === NodeType.SCRIPT_PLANNER) {
              const outline = await generateScriptPlanner(prompt, {
                  theme: node.data.scriptTheme,
                  genre: node.data.scriptGenre,
                  setting: node.data.scriptSetting,
                  episodes: node.data.scriptEpisodes,
                  duration: node.data.scriptDuration,
                  visualStyle: node.data.scriptVisualStyle // Pass Visual Style
              });
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
                  currentStyle // Pass Visual Style
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
               // ... (Existing Image Logic UNCHANGED) ...
               const inputImages: string[] = [];
               inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
               const isStoryboard = /分镜|storyboard|sequence|shots|frames|json/i.test(prompt);
               if (isStoryboard) {
                  try {
                      const storyboard = await planStoryboard(prompt, upstreamTexts.join('\n'));
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
              const res = await generateImageFromText(prompt, node.data.model, inputImages, { aspectRatio: node.data.aspectRatio || '16:9', resolution: node.data.resolution, count: node.data.imageCount });
              handleNodeUpdate(id, { image: res[0], images: res });

          } else if (node.type === NodeType.VIDEO_GENERATOR) {
              const strategy = await getGenerationStrategy(node, inputs, prompt);
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
                  strategy.lastFrameImage
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
              const audioUri = await generateAudio(prompt);
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
                      ? 'Photorealistic 3D render, highly realistic human characters, lifelike skin textures, natural subsurface scattering, realistic eyes with detailed iris, accurate anatomy, high-fidelity 3D modeling, Unreal Engine 5, MetaHuman, cinematic lighting, volumetric light ray, global illumination, screen space reflections, 8k resolution, photorealistic materials, detailed fabric textures, realistic hair strands, natural skin pores and imperfections, live action quality.'
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

          } else if (node.type === NodeType.VIDEO_ANALYZER) {
             const vid = node.data.videoUri || inputs.find(n => n?.data.videoUri)?.data.videoUri;
             if (!vid) throw new Error("未找到视频输入");
             let vidData = vid;
             if (vid.startsWith('http')) vidData = await urlToBase64(vid);
             const txt = await analyzeVideo(vidData, prompt, node.data.model);
             handleNodeUpdate(id, { analysis: txt });
          } else if (node.type === NodeType.IMAGE_EDITOR) {
             const inputImages: string[] = [];
             inputs.forEach(n => { if (n?.data.image) inputImages.push(n.data.image); });
             const img = node.data.image || inputImages[0];
             const res = await editImageWithText(img, prompt, node.data.model);
             handleNodeUpdate(id, { image: res });
          }
          setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
      } catch (e: any) {
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
      const dropX = (e.clientX - pan.x) / scale;
      const dropY = (e.clientY - pan.y) / scale;
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
          className={`w-full h-full overflow-hidden text-slate-200 selection:bg-cyan-500/30 ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'}`}
          onMouseDown={handleCanvasMouseDown} onWheel={handleWheel} 
          onDoubleClick={(e) => { e.preventDefault(); if (e.detail > 1 && !selectionRect) { setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: '' }); setContextMenuTarget({ type: 'create' }); } }}
          onContextMenu={(e) => { e.preventDefault(); if(e.target === e.currentTarget) setContextMenu(null); }}
          onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}
      >
          <div className="absolute inset-0 noise-bg" />
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #aaa 1px, transparent 1px)', backgroundSize: `${32 * scale}px ${32 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />

          <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-[${SPRING}] z-50 pointer-events-none ${nodes.length > 0 ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
                {/* ... (Welcome Screen UNCHANGED) ... */}
                <div className="flex flex-col items-center justify-center mb-10 select-none animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="relative">
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-300 to-zinc-600 drop-shadow-sm px-4 pb-2">SUNSTUDIO</h1>
                        <div className="absolute -inset-10 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-blue-500/20 blur-[60px] opacity-20 pointer-events-none mix-blend-screen"></div>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-zinc-600"></div>
                        <span className="text-[11px] font-bold tracking-[0.6em] text-zinc-500 uppercase">Welcome</span>
                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-zinc-600"></div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-6 text-zinc-500 text-xs font-medium tracking-wide opacity-60">
                    <div className="px-1.5 py-0.5 rounded-md bg-zinc-800/50 border border-zinc-700/50 text-[10px] flex items-center gap-1">
                        <MousePointerClick size={10} />
                        <span>双击</span>
                    </div>
                    <span>画布自由生成，或查看工作流模板</span>
                </div>

                <div className={`flex items-center gap-1.5 p-1.5 rounded-[18px] bg-[#09090b]/80 border border-white/5 backdrop-blur-xl shadow-2xl ${nodes.length > 0 ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                    <button onClick={() => addNode(NodeType.IMAGE_GENERATOR)} className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300">
                        <ImageIcon size={16} className="text-zinc-500 transition-colors group-hover:text-cyan-400" />
                        <span className="text-[13px] font-medium tracking-wide">文字生图</span>
                    </button>
                    
                     <button onClick={() => addNode(NodeType.VIDEO_GENERATOR)} className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300">
                        <Film size={16} className="text-zinc-500 transition-colors group-hover:text-purple-400" />
                        <span className="text-[13px] font-medium tracking-wide">文生视频</span>
                    </button>

                    <button onClick={createStartEndWorkflow} className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-all border border-white/5 hover:border-white/10 group shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-300">
                        <Link size={16} className="text-zinc-500 transition-colors group-hover:text-emerald-400" />
                        <span className="text-[13px] font-medium tracking-wide">首尾插帧</span>
                    </button>
                </div>
            </div>

          <input type="file" ref={replaceVideoInputRef} className="hidden" accept="video/*" onChange={(e) => handleReplaceFile(e, 'video')} />
          <input type="file" ref={replaceImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleReplaceFile(e, 'image')} />

          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: '100%', height: '100%', transformOrigin: '0 0' }} className="w-full h-full">
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
                  {connections.map((conn) => {
                      const f = nodes.find(n => n.id === conn.from), t = nodes.find(n => n.id === conn.to);
                      if (!f || !t) return null;
                      const fHeight = f.height || getApproxNodeHeight(f); const tHeight = t.height || getApproxNodeHeight(t);
                      const fx = f.x + (f.width||420) + 3; let fy = f.y + fHeight/2; const tx = t.x - 3; let ty = t.y + tHeight/2;
                      if (Math.abs(fy - ty) < 0.5) ty += 0.5;
                      if (isNaN(fx) || isNaN(fy) || isNaN(tx) || isNaN(ty)) return null;
                      const d = `M ${fx} ${fy} C ${fx + (tx-fx)*0.5} ${fy} ${tx - (tx-fx)*0.5} ${ty} ${tx} ${ty}`;
                      return (
                          <g key={`${conn.from}-${conn.to}`} className="pointer-events-auto group/line">
                              <path d={d} stroke="url(#gradient)" strokeWidth="3" fill="none" strokeOpacity="0.5" className="transition-colors duration-300 group-hover/line:stroke-white group-hover/line:stroke-opacity-40" />
                              <path d={d} stroke="transparent" strokeWidth="15" fill="none" style={{ cursor: 'pointer' }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: `${conn.from}-${conn.to}` }); setContextMenuTarget({ type: 'connection', from: conn.from, to: conn.to }); }} />
                          </g>
                      );
                  })}
                  <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" /><stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" /></linearGradient></defs>
                  {connectionStart && (() => {
                      let startX = 0, startY = 0;
                      if (connectionStart.id === 'smart-sequence-dock') {
                          startX = (connectionStart.x - pan.x) / scale; startY = (connectionStart.y - pan.y) / scale;
                      } else {
                          const startNode = nodes.find(n => n.id === connectionStart.id); if (!startNode) return null;
                          const startHeight = startNode.height || getApproxNodeHeight(startNode); startX = startNode.x + (startNode.width || 420) + 3; startY = startNode.y + startHeight / 2;
                      }
                      const endX = (mousePos.x - pan.x) / scale; const endY = (mousePos.y - pan.y) / scale;
                      return <path d={`M ${startX} ${startY} L ${endX} ${endY}`} stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="4,4" fill="none" />;
                  })()}
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
                          if (start.id === 'smart-sequence-dock') { } else { setConnections(p => [...p, { from: start.id, to: id }]); setNodes(p => p.map(n => n.id === id ? { ...n, inputs: [...n.inputs, start.id] } : n)); }
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

              {selectionRect && <div className="absolute border border-cyan-500/40 bg-cyan-500/10 rounded-lg pointer-events-none" style={{ left: (Math.min(selectionRect.startX, selectionRect.currentX) - pan.x) / scale, top: (Math.min(selectionRect.startY, selectionRect.currentY) - pan.y) / scale, width: Math.abs(selectionRect.currentX - selectionRect.startX) / scale, height: Math.abs(selectionRect.currentY - selectionRect.startY) / scale }} />}
          </div>

          {contextMenu && (
              // ... (Context Menu UNCHANGED) ...
              <div className="fixed z-[100] bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-200 origin-top-left" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseDown={(e) => e.stopPropagation()}>
                  {contextMenuTarget?.type === 'node' && (
                      <>
                          <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) setClipboard(JSON.parse(JSON.stringify(targetNode))); setContextMenu(null); }}>
                              <Copy size={12} /> 复制节点
                          </button>
                          {(() => { const targetNode = nodes.find(n => n.id === contextMenu.id); if (targetNode) { const isVideo = targetNode.type === NodeType.VIDEO_GENERATOR || targetNode.type === NodeType.VIDEO_ANALYZER; const isImage = targetNode.type === NodeType.IMAGE_GENERATOR || targetNode.type === NodeType.IMAGE_EDITOR; if (isVideo || isImage) { return ( <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:bg-purple-500/20 hover:text-purple-400 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { replacementTargetRef.current = contextMenu.id; if (isVideo) replaceVideoInputRef.current?.click(); else replaceImageInputRef.current?.click(); setContextMenu(null); }}> <RefreshCw size={12} /> 替换素材 </button> ); } } return null; })()}
                          <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors mt-1" onClick={() => { deleteNodes([contextMenuTarget.id]); setContextMenu(null); }}><Trash2 size={12} /> 删除节点</button>
                      </>
                  )}
                  {contextMenuTarget?.type === 'create' && (
                      <>
                          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">创建新节点</div>
                          {[NodeType.PROMPT_INPUT, NodeType.IMAGE_GENERATOR, NodeType.VIDEO_GENERATOR, NodeType.AUDIO_GENERATOR, NodeType.SCRIPT_PLANNER, NodeType.SCRIPT_EPISODE, NodeType.CHARACTER_NODE, NodeType.STORYBOARD_GENERATOR, NodeType.VIDEO_ANALYZER, NodeType.IMAGE_EDITOR].map(t => { const ItemIcon = getNodeIcon(t); return ( <button key={t} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 rounded-lg flex items-center gap-2.5 transition-colors" onClick={() => { addNode(t, (contextMenu.x-pan.x)/scale, (contextMenu.y-pan.y)/scale); setContextMenu(null); }}> <ItemIcon size={12} className="text-cyan-400" /> {getNodeNameCN(t)} </button> ); })}
                      </>
                  )}
                  {contextMenuTarget?.type === 'group' && (
                      <>
                           <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors mb-1" onClick={() => { saveGroupAsWorkflow(contextMenu.id); setContextMenu(null); }}> <FolderHeart size={12} className="text-cyan-400" /> 保存为工作流 </button>
                           <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { setGroups(p => p.filter(g => g.id !== contextMenu.id)); setContextMenu(null); }}> <Trash2 size={12} /> 删除分组 </button>
                      </>
                  )}
                  {contextMenuTarget?.type === 'connection' && (
                      <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors" onClick={() => { setConnections(prev => prev.filter(c => c.from !== contextMenuTarget.from || c.to !== contextMenuTarget.to)); setNodes(prev => prev.map(n => n.id === contextMenuTarget.to ? { ...n, inputs: n.inputs.filter(i => i !== contextMenuTarget.from) } : n)); setContextMenu(null); }}> <Unplug size={12} /> 删除连接线 </button>
                  )}
              </div>
          )}
          
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
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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

          <div className="absolute bottom-8 right-8 flex items-center gap-3 px-4 py-2 bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"><Minus size={14} strokeWidth={3} /></button>
              <div className="flex items-center gap-2 min-w-[100px]">
                   <input type="range" min="0.2" max="3" step="0.1" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-125 transition-all" />
                   <span className="text-[10px] font-bold text-slate-400 w-8 text-right tabular-nums cursor-pointer hover:text-white" onClick={() => setScale(1)} title="Reset Zoom">{Math.round(scale * 100)}%</span>
              </div>
              <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"><Plus size={14} strokeWidth={3} /></button>
              <button onClick={handleFitView} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10 ml-2 border-l border-white/10 pl-3" title="适配视图">
                  <Scan size={14} strokeWidth={3} />
              </button>
          </div>
      </div>
    </div>
  );
};
