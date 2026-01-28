
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
import { handleCharacterAction as handleCharacterActionNew } from './services/characterActionHandler';
import { getGenerationStrategy } from './services/videoStrategies';
import { saveToStorage, loadFromStorage } from './services/storage_old';
import { getUserPriority, ModelCategory, getDefaultModel, getUserDefaultModel } from './services/modelConfig';
import { saveImageNodeOutput, saveVideoNodeOutput, saveAudioNodeOutput, saveStoryboardGridOutput } from './utils/storageHelper';
import { checkImageNodeCache, checkVideoNodeCache, checkAudioNodeCache } from './utils/cacheChecker';
import { executeWithFallback } from './services/modelFallback';
import { validateConnection, canExecuteNode } from './utils/nodeValidation';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MemoizedConnectionLayer } from './components/ConnectionLayer';
import { CanvasContextMenu } from './components/CanvasContextMenu';
import { ApiKeyPrompt } from './components/ApiKeyPrompt';
import { getNodeIcon, getNodeNameCN, getApproxNodeHeight, getNodeBounds } from './utils/nodeHelpers';
import { useCanvasState } from './hooks/useCanvasState';
import { useNodeOperations } from './hooks/useNodeOperations';
import { useHistory } from './hooks/useHistory';
import { createNodeQuery, useThrottle } from './hooks/usePerformanceOptimization';
import {
    Plus, Copy, Trash2, Type, Image as ImageIcon, Video as VideoIcon,
    ScanFace, Brush, MousePointerClick, LayoutTemplate, X, Film, Link, RefreshCw, Upload,
    Minus, FolderHeart, Unplug, Sparkles, ChevronLeft, ChevronRight, Scan, Music, Mic2, Loader2, ScrollText, Clapperboard, User, BookOpen, Languages
} from 'lucide-react';

// ... (Constants, Helpers, ExpandedView UNCHANGED) ...
const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SNAP_THRESHOLD = 8; // Pixels for magnetic snap
const COLLISION_PADDING = 24; // Spacing when nodes bounce off each other

/**
 * 保存视频到服务器数据库
 * 注意：已禁用 IndexedDB 保存，直接使用 Sora URL 避免卡顿
 * @param videoUrl 视频 URL
 * @param taskId 任务 ID
 * @param taskNumber 任务编号
 * @param soraPrompt Sora 提示词
 * @returns videoId (直接返回 taskId)
 */
async function saveVideoToDatabase(videoUrl: string, taskId: string, taskNumber: number, soraPrompt: string): Promise<string> {
    // 直接返回 taskId，不保存到 IndexedDB 避免阻塞主线程
    console.log('[视频保存] 使用 Sora URL，跳过 IndexedDB 保存', {
        taskId,
        taskNumber,
        videoUrl: videoUrl.substring(0, 100) + '...'
    });
    return taskId;
}

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
  const [storageReconnectNeeded, setStorageReconnectNeeded] = useState<boolean>(false);
  const [expandedMedia, setExpandedMedia] = useState<any>(null);
  const [croppingNodeId, setCroppingNodeId] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  const groupsRef = useRef(groups);
  const connectionStartRef = useRef(connectionStart);

  // 性能优化：创建轻量级的节点查询函数
  // 避免传递整个nodes数组导致所有节点重渲染
  const nodeQuery = useRef(createNodeQuery(nodesRef));
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
      nodeHeight: number,
      // 多选拖拽支持
      isMultiDrag?: boolean,
      selectedNodeIds?: string[],
      selectedNodesStartPos?: Array<{ id: string, x: number, y: number }>
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
            let sNodes = await loadFromStorage<AppNode[]>('nodes');
            if (sNodes) {
              // 数据迁移：将英文标题更新为中文标题
              sNodes = sNodes.map(node => ({
                ...node,
                title: getNodeNameCN(node.type)
              }));
              setNodes(sNodes);
            }
            const sConns = await loadFromStorage<Connection[]>('connections'); if (sConns) setConnections(sConns);
            const sGroups = await loadFromStorage<Group[]>('groups'); if (sGroups) setGroups(sGroups);
          } catch (e) {
            console.error("Failed to load storage", e);
          } finally {
            setIsLoaded(true);
          }
      };
      loadData();

      // ✅ 检查本地存储配置（仅记录日志，不自动连接）
      const checkStorageConfig = () => {
          try {
              const savedConfig = JSON.parse(localStorage.getItem('fileStorageConfig') || '{}');
              if (savedConfig.enabled && savedConfig.rootPath) {
                  console.log('[App] 检测到已配置的存储:', savedConfig.rootPath);
                  console.log('[App] 💡 提示：请通过设置面板重新连接工作文件夹以访问缓存');
                  // 可以在界面上显示一个提示徽章
                  setStorageReconnectNeeded(true);
              }
          } catch (error) {
              console.error('[App] 检查存储配置失败:', error);
          }
      };

      checkStorageConfig();
  }, []);

  // 恢复Sora视频生成轮询（刷新页面后）
  // 使用 ref 跟踪已恢复的任务，避免重复恢复
  const restoredTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded) return;

    const restoreSoraPolling = async () => {
      console.log('[恢复轮询] 检查是否有正在生成的Sora任务...');

      // 找到所有Sora2节点
      const soraNodes = nodes.filter(n => n.type === NodeType.SORA_VIDEO_GENERATOR);

      for (const node of soraNodes) {
        const taskGroups = node.data.taskGroups || [];
        const generatingTasks = taskGroups.filter((tg: any) =>
          (tg.generationStatus === 'generating' || tg.generationStatus === 'uploading') &&
          tg.soraTaskId &&
          !restoredTasksRef.current.has(tg.soraTaskId) // 只恢复未恢复过的任务
        );

        if (generatingTasks.length === 0) continue;

        console.log(`[恢复轮询] 找到 ${generatingTasks.length} 个正在生成的任务，节点: ${node.id}`);

        try {
          // 导入checkSoraTaskStatus函数
          const { checkSoraTaskStatus, pollSoraTaskUntilComplete } = await import('./services/soraService');

          // 对每个正在生成的任务恢复轮询
          for (const tg of generatingTasks) {
            // 标记为已恢复，防止重复恢复
            restoredTasksRef.current.add(tg.soraTaskId);

            console.log(`[恢复轮询] 恢复任务组 ${tg.taskNumber} 的轮询，taskId: ${tg.soraTaskId}`);

            try {
              // 先查询一次当前状态，检查是否应该恢复轮询
              const initialResult = await checkSoraTaskStatus(
                tg.soraTaskId,
                undefined,
                { nodeId: node.id, nodeType: node.type }
              );

              // 检查任务是否已经太旧或处于异常状态
              const now = Math.floor(Date.now() / 1000);
              const taskCreatedAt = initialResult.created_at || now;
              const taskAge = now - taskCreatedAt;

              // 如果任务超过10分钟还在排队或处理中，不再恢复轮询
              if (taskAge > 600 && (initialResult.status === 'queued' || initialResult.status === 'processing')) {
                console.warn(`[恢复轮询] 任务 ${tg.taskNumber} 已经过旧(${Math.floor(taskAge / 60)}分钟)，状态仍为 ${initialResult.status}，停止轮询`);
                // 标记为失败
                setNodes(prevNodes => {
                  return prevNodes.map(n => {
                    if (n.id === node.id) {
                      const updatedTaskGroups = n.data.taskGroups.map((t: any) => {
                        if (t.id === tg.id) {
                          return {
                            ...t,
                            generationStatus: 'failed' as const,
                            error: `任务超时(${Math.floor(taskAge / 60)}分钟，状态: ${initialResult.status})`
                          };
                        }
                        return t;
                      });
                      return { ...n, data: { ...n.data, taskGroups: updatedTaskGroups } };
                    }
                    return n;
                  });
                });
                continue;
              }

              // 如果任务已经失败或完成，直接更新状态
              if (initialResult.status === 'error' || initialResult.status === 'failed' || initialResult.status === 'FAILED') {
                console.log(`[恢复轮询] 任务 ${tg.taskNumber} 已失败，不再轮询`);
                setNodes(prevNodes => {
                  return prevNodes.map(n => {
                    if (n.id === node.id) {
                      const updatedTaskGroups = n.data.taskGroups.map((t: any) => {
                        if (t.id === tg.id) {
                          return { ...t, generationStatus: 'failed' as const, error: '任务失败' };
                        }
                        return t;
                      });
                      return { ...n, data: { ...n.data, taskGroups: updatedTaskGroups } };
                    }
                    return n;
                  });
                });
                continue;
              }

              if (initialResult.status === 'completed' || initialResult.status === 'succeeded' || initialResult.status === 'success') {
                console.log(`[恢复轮询] 任务 ${tg.taskNumber} 已完成，不再轮询`);
                setNodes(prevNodes => {
                  return prevNodes.map(n => {
                    if (n.id === node.id) {
                      const updatedTaskGroups = n.data.taskGroups.map((t: any) => {
                        if (t.id === tg.id) {
                          return { ...t, generationStatus: 'completed' as const, videoUri: initialResult.videoUrl };
                        }
                        return t;
                      });
                      return { ...n, data: { ...n.data, taskGroups: updatedTaskGroups } };
                    }
                    return n;
                  });
                });
                continue;
              }

              // 任务仍在进行中，开始轮询
              console.log(`[恢复轮询] 任务 ${tg.taskNumber} 当前状态: ${initialResult.status}，开始轮询`);

              // 使用轮询函数持续查询状态
              const result = await pollSoraTaskUntilComplete(
                tg.soraTaskId,
                (progress) => {
                  console.log(`[恢复轮询] 任务 ${tg.taskNumber} 进度: ${progress}%`);
                  // 更新进度
                  setNodes(prevNodes => {
                    return prevNodes.map(n => {
                      if (n.id === node.id) {
                        const updatedTaskGroups = n.data.taskGroups.map((t: any) =>
                          t.id === tg.id ? { ...t, progress } : t
                        );
                        return { ...n, data: { ...n.data, taskGroups: updatedTaskGroups } };
                      }
                      return n;
                    });
                  });
                },
                5000, // 5秒轮询间隔
                { nodeId: node.id, nodeType: node.type }
              );

              // 更新最终状态
              console.log(`[恢复轮询] 任务 ${tg.taskNumber} 最终状态:`, result.status);

              setNodes(prevNodes => {
                return prevNodes.map(n => {
                  if (n.id === node.id) {
                    const updatedTaskGroups = n.data.taskGroups.map((t: any) => {
                      if (t.id === tg.id) {
                        if (result.status === 'completed') {
                          return {
                            ...t,
                            generationStatus: 'completed' as const,
                            progress: 100
                          };
                        } else if (result.status === 'error') {
                          const rawError = result.violationReason || result._rawData?.error || result._rawData?.message || '视频生成失败';
                          const errorMessage = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
                          return {
                            ...t,
                            generationStatus: 'failed' as const,
                            error: errorMessage
                          };
                        }
                      }
                      return t;
                    });
                    return { ...n, data: { ...n.data, taskGroups: updatedTaskGroups } };
                  }
                  return n;
                });
              });
            } catch (error) {
              console.error(`[恢复轮询] 任务组 ${tg.taskNumber} 轮询失败:`, error);
              // 标记为失败
              setNodes(prevNodes => {
                return prevNodes.map(n => {
                  if (n.id === node.id) {
                    const updatedTaskGroups = n.data.taskGroups.map((t: any) => {
                      if (t.id === tg.id) {
                        return {
                          ...t,
                          generationStatus: 'failed' as const,
                          error: '轮询失败: ' + (error as any).message
                        };
                      }
                      return t;
                    });
                    return { ...n, data: { ...n.data, taskGroups: updatedTaskGroups } };
                  }
                  return n;
                });
              });
            }
          }
        } catch (error) {
          console.error(`[恢复轮询] 恢复轮询失败:`, error);
        }
      }
    };

    // 延迟执行，确保节点完全加载
    const timeoutId = setTimeout(restoreSoraPolling, 1000);

    return () => clearTimeout(timeoutId);
  }, [isLoaded]); // 移除 nodes 依赖，避免循环触发

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
  const handleApiError = useCallback((error: any, nodeId?: string) => {
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
  }, []);

  // Handle API Key save from prompt
  const handleApiKeySave = useCallback((apiKey: string) => {
      localStorage.setItem('GEMINI_API_KEY', apiKey);
      setIsApiKeyPromptOpen(false);
      console.info('✅ Gemini API Key 已保存成功！');
  }, []);

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

  // 防抖版本的历史保存（1秒内多次调用只保存一次）
  const debouncedSaveHistoryRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSaveHistory = useCallback(() => {
      if (debouncedSaveHistoryRef.current) {
          clearTimeout(debouncedSaveHistoryRef.current);
      }
      debouncedSaveHistoryRef.current = setTimeout(() => {
          saveHistory();
          debouncedSaveHistoryRef.current = null;
      }, 1000); // 1秒防抖
  }, [saveHistory]);

  // 组件卸载时保存待处理的历史
  useEffect(() => {
      return () => {
          if (debouncedSaveHistoryRef.current) {
              clearTimeout(debouncedSaveHistoryRef.current);
              saveHistory();
          }
      };
  }, [saveHistory]);

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

  const handleWheel = useCallback((e: WheelEvent) => {
      // 检查事件目标是否在节点内
      const target = e.target as HTMLElement;
      const nodeElement = target.closest('[data-node-container]');
      if (nodeElement) {
        // 事件发生在节点内，不移动画布
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        canvas.zoomCanvas(delta, x, y);
      } else {
        canvas.setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
  }, [canvas]);

  // 手动添加非被动的 wheel 事件监听器（避免 preventDefault 警告）
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      const element = canvasRef.current;
      if (!element) return;

      const handleWheelEvent = (e: WheelEvent) => {
          handleWheel(e);
      };

      // 添加非被动的监听器
      element.addEventListener('wheel', handleWheelEvent, { passive: false });

      return () => {
          element.removeEventListener('wheel', handleWheelEvent);
      };
  }, [handleWheel]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
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
  }, [contextMenu, canvas]);

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
             const { startX, startY, mouseStartX, mouseStartY, nodeWidth, nodeHeight, isMultiDrag, selectedNodeIds, selectedNodesStartPos } = dragNodeRef.current;
             let dx = (clientX - mouseStartX) / canvas.scale;
             let dy = (clientY - mouseStartY) / canvas.scale;
             let proposedX = startX + dx;
             let proposedY = startY + dy;

             // 磁吸对齐（只对主拖拽节点进行）
             const SNAP = SNAP_THRESHOLD / canvas.scale;
             const myL = proposedX; const myC = proposedX + nodeWidth / 2; const myR = proposedX + nodeWidth;
             const myT = proposedY; const myM = proposedY + nodeHeight / 2; const myB = proposedY + nodeHeight;
             let snappedX = false; let snappedY = false;
             nodesRef.current.forEach(other => {
                 // 多选时跳过其他选中的节点
                 if (isMultiDrag && selectedNodeIds?.includes(other.id)) return;
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

             // 计算最终位移（考虑磁吸）
             const finalDx = proposedX - startX;
             const finalDy = proposedY - startY;

             if (isMultiDrag && selectedNodeIds && selectedNodesStartPos) {
                 // 多选拖拽：移动所有选中的节点
                 setNodes(prev => prev.map(n => {
                     if (selectedNodeIds.includes(n.id)) {
                         const startPos = selectedNodesStartPos.find(p => p.id === n.id);
                         if (startPos) {
                             return { ...n, x: startPos.x + finalDx, y: startPos.y + finalDy };
                         }
                     }
                     return n;
                 }));
             } else {
                 // 单个节点拖拽
                 setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: proposedX, y: proposedY } : n));
             }
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
                  // 选中框选的节点（移除自动创建分组的逻辑）
                  setSelectedNodeIds(enclosed.map(n => n.id));
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
      const callingStack = new Error().stack?.split('\n').slice(1, 4).join('\n');
      console.log('[handleNodeUpdate] Called:', {
          nodeId: id,
          dataKeys: Object.keys(data),
          hasGeneratedCharacters: !!data.generatedCharacters,
          callingStack
      });

      setNodes(prev => prev.map(n => {
          if (n.id === id) {
              // 确保标题始终是中文的
              const correctTitle = getNodeNameCN(n.type);
              const updated = { ...n, data: { ...n.data, ...data }, title: title || correctTitle };

              // Debug log for character updates
              if (data.generatedCharacters) {
                  console.log('[handleNodeUpdate] Updating generatedCharacters:', {
                      nodeId: id,
                      count: data.generatedCharacters.length,
                      characters: data.generatedCharacters.map((c: any) => ({
                          name: c.name,
                          status: c.status,
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

  const handleReplaceFile = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
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
  }, [handleNodeUpdate]);

  const getVisualPromptPrefix = (style: string, genre?: string, setting?: string): string => {
      let base = '';
      // Enhanced Visual Style Definitions
      if (style === 'ANIME') {
          base = 'Anime style, Japanese 2D animation, vibrant colors, Studio Ghibli style, clean lines, high detail, 8k resolution, cel shaded, flat color, expressive characters.';
      } else if (style === '3D') {
          base = 'Xianxia 3D animation character, semi-realistic style, Xianxia animation aesthetics, high precision 3D modeling, PBR shading with soft translucency, subsurface scattering, ambient occlusion, delicate and smooth skin texture (not overly realistic), flowing fabric clothing, individual hair strands, soft ethereal lighting, cinematic rim lighting with cool blue tones, otherworldly gaze, elegant and cold demeanor, 3D animation quality, vibrant colors.';
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
  const handleCharacterAction = useCallback(async (nodeId: string, action: 'DELETE' | 'SAVE' | 'RETRY' | 'GENERATE_EXPRESSION' | 'GENERATE_THREE_VIEW' | 'GENERATE_SINGLE', charName: string) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (!node) return;

      // Use new character action handler with queue-based state management
      await handleCharacterActionNew(
          nodeId,
          action,
          charName,
          node,
          nodesRef.current,
          handleNodeUpdate
      );
  }, [handleNodeUpdate]);

  // --- Node Event Handlers (useCallback for performance) ---
  const handleNodeDelete = useCallback((id: string) => {
      deleteNodes([id]);
  }, []);

  const handleNodeExpand = useCallback((data: { type: 'image' | 'video', src: string, rect: DOMRect, images?: string[], initialIndex?: number }) => {
      setExpandedMedia(data);
  }, []);

  const handleNodeCrop = useCallback((id: string, img: string) => {
      setCroppingNodeId(id);
      setImageToCrop(img);
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
      e.stopPropagation();

      // 检查是否点击了交互元素，如果是则不触发节点拖拽
      const target = e.target as HTMLElement;
      const tagName = target.tagName;
      const targetType = target.getAttribute('type');

      // 交互元素列表：range input、普通input、textarea、select、button、a标签
      const isInteractiveElement =
          (tagName === 'INPUT' && (targetType === 'range' || targetType === 'text' || targetType === 'number' || targetType === 'checkbox' || targetType === 'radio')) ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          tagName === 'BUTTON' ||
          tagName === 'A';

      if (isInteractiveElement) {
          // 点击的是交互元素，不触发节点拖拽
          return;
      }

      const isAlreadySelected = selectedNodeIds.includes(id);

      // 如果按住shift/meta/ctrl键，切换选中状态
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
          setSelectedNodeIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
      } else if (!isAlreadySelected) {
          // 如果点击的节点未被选中，清除其他选中，只选中当前节点
          setSelectedNodeIds([id]);
      }
      // 如果点击的节点已经被选中，保持选中状态不变（支持多选拖拽）

      const n = nodesRef.current.find(x => x.id === id);
      if (!n) return;

      const w = n.width || 420;
      const h = n.height || getApproxNodeHeight(n);
      const cx = n.x + w/2;
      const cy = n.y + 160;
      const pGroup = groups.find(g => {
          return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height;
      });

      let siblingNodeIds: string[] = [];
      if (pGroup) {
          siblingNodeIds = nodesRef.current.filter(other => {
              if (other.id === id) return false;
              const b = getNodeBounds(other);
              const ocx = b.x + b.width/2;
              const ocy = b.y + b.height/2;
              return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height;
          }).map(s => s.id);
      }

      // 记录多选拖拽信息
      const currentSelectedIds = selectedNodeIds.includes(id) ? selectedNodeIds : [id];
      const isMultiDrag = currentSelectedIds.length > 1;
      const selectedNodesStartPos = isMultiDrag
          ? nodesRef.current.filter(node => currentSelectedIds.includes(node.id))
              .map(node => ({ id: node.id, x: node.x, y: node.y }))
          : [];

      dragNodeRef.current = {
          id,
          startX: n.x,
          startY: n.y,
          mouseStartX: e.clientX,
          mouseStartY: e.clientY,
          parentGroupId: pGroup?.id,
          siblingNodeIds,
          nodeWidth: w,
          nodeHeight: h,
          isMultiDrag,
          selectedNodeIds: currentSelectedIds,
          selectedNodesStartPos
      };
      setDraggingNodeParentGroupId(pGroup?.id || null);
      setDraggingNodeId(id);
  }, [selectedNodeIds, groups, getApproxNodeHeight, getNodeBounds]);

  const handlePortMouseDown = useCallback((e: React.MouseEvent, id: string, type: 'input' | 'output') => {
      e.stopPropagation();
      setConnectionStart({ id, x: e.clientX, y: e.clientY });
  }, []);

  const handlePortMouseUp = useCallback((e: React.MouseEvent, id: string, type: 'input' | 'output') => {
      e.stopPropagation();
      const start = connectionStartRef.current;
      if (!start || start.id === id) return;

      if (start.id === 'smart-sequence-dock') {
          // Smart Sequence Dock 的连接逻辑保持不变
          setConnectionStart(null);
          return;
      }

      // 获取源节点和目标节点
      const fromNode = nodesRef.current.find(n => n.id === start.id);
      const toNode = nodesRef.current.find(n => n.id === id);

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

      setConnectionStart(null);
  }, [connections]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id });
      setContextMenuTarget({ type: 'node', id });
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, id: string, w: number, h: number) => {
      e.stopPropagation();
      const n = nodesRef.current.find(x => x.id === id);
      if (!n) return;

      const cx = n.x + w/2;
      const cy = n.y + 160;
      const pGroup = groups.find(g => {
          return cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height;
      });

      setDraggingNodeParentGroupId(pGroup?.id || null);

      let siblingNodeIds: string[] = [];
      if (pGroup) {
          siblingNodeIds = nodesRef.current.filter(other => {
              if (other.id === id) return false;
              const b = getNodeBounds(other);
              const ocx = b.x + b.width/2;
              const ocy = b.y + b.height/2;
              return ocx > pGroup.x && ocx < pGroup.x + pGroup.width && ocy > pGroup.y && ocy < pGroup.y + pGroup.height;
          }).map(s => s.id);
      }

      resizeContextRef.current = {
          nodeId: id,
          initialWidth: w,
          initialHeight: h,
          startX: e.clientX,
          startY: e.clientY,
          parentGroupId: pGroup?.id || null,
          siblingNodeIds
      };

      setResizingNodeId(id);
      setInitialSize({ width: w, height: h });
      setResizeStartPos({ x: e.clientX, y: e.clientY });
  }, [groups, getNodeBounds]);

  const handleInputReorder = useCallback((nodeId: string, newOrder: string[]) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node) {
          setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, inputs: newOrder } : n));
      }
  }, []);

  const handleViewCharacter = useCallback((character: CharacterProfile) => {
      setViewingCharacter({ character, nodeId: '' }); // nodeId will be set by Node component
  }, []);

  // --- Helper: Calculate input assets for a node ---
  const getNodeInputAssets = useCallback((nodeId: string, inputs: string[]): InputAsset[] => {
      return inputs
          .map(i => nodesRef.current.find(n => n.id === i))
          .filter(n => n && (n.data.image || n.data.videoUri || n.data.croppedFrame))
          .slice(0, 6)
          .map(n => ({
              id: n!.id,
              type: (n!.data.croppedFrame || n!.data.image) ? 'image' : 'video',
              src: n!.data.croppedFrame || n!.data.image || n!.data.videoUri!
          }));
  }, []);

  // --- Main Action Handler ---
  const handleNodeAction = useCallback(async (id: string, promptOverride?: string) => {
      console.log('[handleNodeAction] ===== 动作处理器被调用 =====');
      console.log('[handleNodeAction] 节点ID:', id);
      console.log('[handleNodeAction] 动作类型:', promptOverride);
      console.log('[handleNodeAction] Called with id:', id, 'promptOverride:', promptOverride);
      const node = nodesRef.current.find(n => n.id === id);
      console.log('[handleNodeAction] Found node:', node?.type, 'data.prompt length:', node?.data?.prompt?.length);
      if (!node) {
          console.error('[handleNodeAction] 未找到节点:', id);
          return;
      }
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
                  visualStyle,
                  undefined,  // onShotGenerated callback (not used)
                  getUserDefaultModel('text'),  // 总是使用最新的模型配置
                  { nodeId: node.id, nodeType: node.type }  // context for API logging
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

              // Action: Remove sensitive words from prompt
              if (promptOverride?.startsWith('remove-sensitive-words:')) {
                  const taskGroupIndex = parseInt(promptOverride.split(':')[1]);
                  const taskGroup = taskGroups[taskGroupIndex];

                  if (!taskGroup) {
                      throw new Error(`未找到任务组 ${taskGroupIndex + 1}`);
                  }

                  if (!taskGroup.soraPrompt) {
                      throw new Error('请先生成提示词');
                  }

                  console.log('[去敏感词] ===== 开始处理 =====');
                  console.log('[去敏感词] 任务组:', taskGroup.taskNumber);
                  console.log('[去敏感词] 原始提示词长度:', taskGroup.soraPrompt.length);

                  // 设置正在去敏感词状态
                  const updatedTaskGroups = [...taskGroups];
                  updatedTaskGroups[taskGroupIndex] = {
                      ...taskGroup,
                      isRemovingSensitiveWords: true,
                      removeSensitiveWordsProgress: '正在调用AI模型...'
                  };
                  handleNodeUpdate(id, { taskGroups: updatedTaskGroups });

                  try {
                      // Import and call the remove sensitive words function
                      console.log('[去敏感词] 正在调用 AI 模型...');
                      const { removeSensitiveWords } = await import('./services/soraPromptBuilder');
                      const cleanedPrompt = await removeSensitiveWords(taskGroup.soraPrompt);

                      console.log('[去敏感词] AI 模型调用成功');
                      console.log('[去敏感词] 优化后提示词长度:', cleanedPrompt.length);
                      console.log('[去敏感词] ===== 处理完成 =====');

                      // 计算优化统计
                      const wordCountDiff = taskGroup.soraPrompt.length - cleanedPrompt.length;
                      const successMessage = wordCountDiff > 0
                          ? `✓ 已优化 ${wordCountDiff} 个字符`
                          : `✓ 优化完成`;

                      // Update the task group's prompt
                      updatedTaskGroups[taskGroupIndex] = {
                          ...taskGroup,
                          soraPrompt: cleanedPrompt,
                          promptModified: true,
                          isRemovingSensitiveWords: false,
                          removeSensitiveWordsProgress: undefined,
                          removeSensitiveWordsSuccess: successMessage
                      };

                      handleNodeUpdate(id, { taskGroups: updatedTaskGroups });

                      // 3秒后清除成功消息
                      setTimeout(() => {
                          const currentTaskGroups = nodesRef.current.find(n => n.id === id)?.data?.taskGroups;
                          if (currentTaskGroups) {
                              const tg = currentTaskGroups[taskGroupIndex];
                              if (tg && tg.removeSensitiveWordsSuccess) {
                                  const clearedTaskGroups = [...currentTaskGroups];
                                  clearedTaskGroups[taskGroupIndex] = {
                                      ...tg,
                                      removeSensitiveWordsSuccess: undefined
                                  };
                                  handleNodeUpdate(id, { taskGroups: clearedTaskGroups });
                              }
                          }
                      }, 3000);
                  } catch (error: any) {
                      console.error('[去敏感词] ❌ 处理失败:', error);

                      updatedTaskGroups[taskGroupIndex] = {
                          ...taskGroup,
                          isRemovingSensitiveWords: false,
                          removeSensitiveWordsProgress: undefined,
                          removeSensitiveWordsError: error.message
                      };
                      handleNodeUpdate(id, { taskGroups: updatedTaskGroups });

                      // 5秒后清除错误消息
                      setTimeout(() => {
                          const currentTaskGroups = nodesRef.current.find(n => n.id === id)?.data?.taskGroups;
                          if (currentTaskGroups) {
                              const tg = currentTaskGroups[taskGroupIndex];
                              if (tg && tg.removeSensitiveWordsError) {
                                  const clearedTaskGroups = [...currentTaskGroups];
                                  clearedTaskGroups[taskGroupIndex] = {
                                      ...tg,
                                      removeSensitiveWordsError: undefined
                                  };
                                  handleNodeUpdate(id, { taskGroups: clearedTaskGroups });
                              }
                          }
                      }, 5000);
                  }
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
                        // 不保存到IndexedDB，直接使用 Sora URL
                        saveVideoToDatabase(
                            result.videoUrl,
                            result.taskId,
                            taskGroup.taskNumber,
                            taskGroup.soraPrompt
                        );

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
                                violationReason: result.violationReason,
                                soraTaskId: result.taskId
                            },
                            inputs: [node.id]
                        };

                        const newConnection: Connection = {
                            from: node.id,
                            to: childNodeId
                        };

                        // 添加到历史记录
                        if (result.videoUrl) {
                            handleAssetGenerated('video', result.videoUrl, `Sora 任务组 ${taskGroup.taskNumber}`);
                        }

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
                        // Generation failed - extract error details from result
                        const rawError = result.violationReason ||
                                          result._rawData?.error ||
                                          result._rawData?.message ||
                                          '视频生成失败';
                        // 确保 errorMessage 是字符串
                        const errorMessage = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);

                        console.error(`[SORA] 任务 ${taskGroup.taskNumber} 失败详情:`, {
                            violationReason: result.violationReason,
                            rawData: result._rawData
                        });

                        updatedTaskGroups[taskGroupIndex] = {
                            ...taskGroup,
                            generationStatus: 'failed' as const,
                            error: errorMessage
                        };
                    }

                    handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));

                  } catch (error: any) {
                    console.error('[SORA_VIDEO_GENERATOR] Failed to generate video:', error);
                    const errorMessage = error.message || '生成失败';

                    // 更新任务组状态
                    updatedTaskGroups[taskGroupIndex] = {
                        ...taskGroup,
                        generationStatus: 'failed' as const,
                        error: errorMessage
                    };

                    // 创建失败状态的子节点
                    const childNodeId = `n-sora-child-${Date.now()}`;
                    const childNode: AppNode = {
                        id: childNodeId,
                        type: NodeType.SORA_VIDEO_CHILD,
                        x: node.x + (node.width || 420) + 50,
                        y: node.y + (taskGroupIndex * 150),
                        title: `任务组 ${taskGroup.taskNumber}`,
                        status: NodeStatus.ERROR,
                        data: {
                            taskGroupId: taskGroup.id,
                            taskNumber: taskGroup.taskNumber,
                            soraPrompt: taskGroup.soraPrompt,
                            videoUrl: undefined,
                            error: errorMessage
                        },
                        inputs: [node.id]
                    };

                    const newConnection: Connection = {
                        from: node.id,
                        to: childNodeId
                    };

                    setNodes(prev => [...prev.filter(n => n.id !== childNodeId), childNode]);
                    setConnections(prev => [...prev.filter(c => c.to !== childNodeId), newConnection]);
                    handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                    setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
                  }
                  return;
              }

              // Action: Fuse reference images for task groups
              if (promptOverride === 'fuse-images') {
                  console.log('[SORA_VIDEO_GENERATOR] Fusing reference images for task groups');

                  if (taskGroups.length === 0) {
                      throw new Error('请先生成任务组和提示词');
                  }

                  try {
                      // 导入图片融合工具
                      const { fuseMultipleTaskGroups } = await import('./utils/imageFusion');

                      // 过滤出有splitShots的任务组
                      const taskGroupsToFuse = taskGroups.filter(tg =>
                          tg.splitShots && tg.splitShots.length > 0
                      );

                      if (taskGroupsToFuse.length === 0) {
                          throw new Error('没有可融合的分镜图');
                      }

                      console.log('[SORA_VIDEO_GENERATOR] Starting image fusion for', taskGroupsToFuse.length, 'task groups');

                      // 执行图片融合
                      const fusionResults = await fuseMultipleTaskGroups(
                          taskGroupsToFuse,
                          (current, total, groupName) => {
                              console.log(`正在融合 ${current}/${total}: ${groupName}`);
                          }
                      );

                      console.log('[SORA_VIDEO_GENERATOR] Fusion completed:', fusionResults.length, 'groups');

                      // 导入OSS服务
                      const { getOSSConfig } = await import('./services/soraConfigService');
                      const { uploadFileToOSS } = await import('./services/ossService');

                      // 检查是否配置了OSS
                      const ossConfig = getOSSConfig();
                      if (!ossConfig) {
                          console.warn('[SORA_VIDEO_GENERATOR] OSS未配置，融合图将使用Base64格式，可能导致显示问题');
                      }

                      // 更新任务组数据（如果配置了OSS，先上传）
                      const updatedTaskGroups = await Promise.all(taskGroups.map(async (tg) => {
                          const result = fusionResults.find(r => r.groupId === tg.id);
                          if (result) {
                              let imageUrl = result.fusedImage;

                              // 如果配置了OSS，上传融合图
                              if (ossConfig) {
                                  try {
                                      const fileName = `sora-reference-${tg.id}-${Date.now()}.png`;
                                      imageUrl = await uploadFileToOSS(result.fusedImage, fileName, ossConfig);
                                      console.log('[SORA_VIDEO_GENERATOR] Task group', tg.taskNumber, 'reference image uploaded to OSS:', imageUrl);
                                  } catch (error: any) {
                                      console.error('[SORA_VIDEO_GENERATOR] Failed to upload reference image for task group', tg.taskNumber, ':', error);
                                      // 上传失败，回退到Base64
                                      imageUrl = result.fusedImage;
                                  }
                              }

                              return {
                                  ...tg,
                                  referenceImage: imageUrl,
                                  imageFused: true,
                                  generationStatus: 'image_fused' as const
                              };
                          }
                          return tg;
                      }));

                      handleNodeUpdate(id, { taskGroups: updatedTaskGroups });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  } catch (error: any) {
                      console.error('[SORA_VIDEO_GENERATOR] Image fusion failed:', error);
                      throw new Error(`图片融合失败: ${error.message}`);
                  }
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
                          // 实时更新进度到节点状态
                          const tg = taskGroupsToGenerate[index];
                          if (tg) {
                              handleNodeUpdate(id, {
                                  taskGroups: nodesRef.current.find(n => n.id === id)?.data.taskGroups?.map(t =>
                                      t.id === tg.id ? { ...t, progress } : t
                                  )
                              });
                          }
                      },
                      { nodeId: id, nodeType: node.type }
                  );

                  // Create child nodes for completed videos
                  const newChildNodes: AppNode[] = [];
                  const newConnections: Connection[] = [];

                  // 使用 for...of 循环以支持 await
                  for (const [index, result] of results.entries()) {
                      const taskGroup = taskGroupsToGenerate[index];
                      if (result.status === 'completed' && result.videoUrl) {
                          // 不保存到IndexedDB，直接使用 Sora URL
                          saveVideoToDatabase(result.videoUrl, result.taskId, taskGroup.taskNumber, taskGroup.soraPrompt);

                          // 🚀 保存视频到本地文件系统
                          try {
                              const { getFileStorageService } = await import('./services/storage/index');
                              const service = getFileStorageService();

                              if (service.isEnabled()) {
                                  // 使用 prefix 参数添加任务组 ID，便于后续查找
                                  const saveResult = await service.saveFile(
                                      'default',
                                      id, // 使用父节点 ID
                                      'SORA_VIDEO_GENERATOR',
                                      result.videoUrl,
                                      {
                                          updateMetadata: true,
                                          prefix: `sora-video-${taskGroup.id}` // 文件名前缀
                                      }
                                  );

                                  if (saveResult.success) {
                                      console.log('[Sora2] ✅ 视频已保存到本地:', taskGroup.taskNumber, saveResult.relativePath);
                                  }
                              }
                          } catch (error) {
                              console.error('[Sora2] 保存视频到本地失败:', error);
                          }

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
                                  violationReason: result.violationReason,
                                  soraTaskId: result.taskId
                              },
                              inputs: [node.id]
                          };
                          newChildNodes.push(childNode);
                          newConnections.push({ from: node.id, to: childNodeId });
                      }
                  }

                  // Update task groups with results
                  const finalTaskGroups = taskGroups.map(tg => {
                      const result = results.get(tg.id);
                      if (result) {
                          // 保留实际的进度值
                          const finalProgress = result.status === 'completed' ? 100 : result.progress;

                          // 提取错误信息
                          let errorMessage = undefined;
                          if (result.status === 'error') {
                              const rawError = result.violationReason || result._rawData?.error || result._rawData?.message || '视频生成失败';
                              // 确保 errorMessage 是字符串
                              errorMessage = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
                              console.error(`[SORA] 任务 ${tg.taskNumber} 失败详情:`, {
                                  violationReason: result.violationReason,
                                  rawData: result._rawData
                              });
                          }

                          return {
                              ...tg,
                              generationStatus: result.status === 'completed' ? 'completed' as const :
                                              result.status === 'error' ? 'failed' as const :
                                              tg.generationStatus,
                              progress: finalProgress,
                              error: errorMessage,
                              // 保存视频URL到taskGroup中
                              videoUrl: result.videoUrl,
                              videoUrlWatermarked: result.videoUrlWatermarked,
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
                              // 保留实际的进度值
                              const finalProgress = result.status === 'completed' ? 100 : result.progress;

                              // 提取错误信息
                              let errorMessage = undefined;
                              if (result.status === 'error') {
                                  const rawError = result.violationReason || result._rawData?.error || result._rawData?.message || '视频生成失败';
                                  // 确保 errorMessage 是字符串
                                  errorMessage = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
                                  console.error(`[SORA] 重新生成任务 ${tg.taskNumber} 失败详情:`, {
                                      violationReason: result.violationReason,
                                      rawData: result._rawData
                                  });
                              }

                              return {
                                  ...tg,
                                  generationStatus: result.status === 'completed' ? 'completed' as const :
                                                      result.status === 'error' ? 'failed' as const :
                                                      tg.generationStatus,
                                  progress: finalProgress,
                                  error: errorMessage,
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

                      // 使用 for...of 循环以支持 await
                      for (const [index, result] of results.entries()) {
                          // 只有当状态完成且有有效videoUrl时才创建子节点
                          if (result.status === 'completed' && result.videoUrl) {
                              const childNodeId = `n-sora-child-${Date.now()}-${index}`;
                              const taskGroup = updatedTaskGroups[index];

                              // 不保存到IndexedDB，直接使用 Sora URL
                              saveVideoToDatabase(result.videoUrl, result.taskId, taskGroup.taskNumber, taskGroup.soraPrompt);

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
                                      violationReason: result.violationReason,
                                      soraTaskId: result.taskId
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
                      }

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

          // Handle STORYBOARD_VIDEO_GENERATOR node actions
          if (node.type === NodeType.STORYBOARD_VIDEO_GENERATOR) {
              if (promptOverride === 'fetch-shots') {
                  console.log('[STORYBOARD_VIDEO_GENERATOR] Fetching shots from splitter node');

                  // Find upstream STORYBOARD_SPLITTER node
                  const splitterNode = inputs.find(n => n?.type === NodeType.STORYBOARD_SPLITTER);
                  if (!splitterNode) {
                      throw new Error('请连接分镜拆解节点');
                  }

                  const splitShots = splitterNode.data.splitShots || [];
                  if (splitShots.length === 0) {
                      throw new Error('分镜拆解节点中没有分镜数据');
                  }

                  // Find optional CHARACTER_NODE
                  const characterNode = inputs.find(n => n?.type === NodeType.CHARACTER_NODE);
                  const characterData = characterNode?.data?.generatedCharacters || [];

                  // Update node with available shots
                  handleNodeUpdate(id, {
                      availableShots: splitShots,
                      selectedShotIds: [],
                      characterData,
                      status: 'selecting'
                  });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  return;
              }

              if (promptOverride === 'generate-prompt') {
                  console.log('[STORYBOARD_VIDEO_GENERATOR] Generating prompt');

                  const selectedShotIds = node.data.selectedShotIds || [];
                  if (selectedShotIds.length === 0) {
                      throw new Error('请至少选择一个分镜');
                  }

                  // Get selected shots
                  const availableShots = node.data.availableShots || [];
                  const selectedShots = availableShots.filter((s: any) => selectedShotIds.includes(s.id));

                  // Use SORA2 prompt builder for consistent format
                  const { buildProfessionalSoraPrompt } = await import('./services/soraPromptBuilder');

                  console.log('[STORYBOARD_VIDEO_GENERATOR] Calling AI with', selectedShots.length, 'shots');

                  // Generate prompt using SORA2 format
                  const generatedPrompt = await buildProfessionalSoraPrompt(selectedShots);

                  console.log('[STORYBOARD_VIDEO_GENERATOR] Generated prompt:', generatedPrompt);

                  handleNodeUpdate(id, {
                      generatedPrompt,
                      status: 'prompting'
                  });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  return;
              }

              if (promptOverride === 'generate-video') {
                  console.log('[STORYBOARD_VIDEO_GENERATOR] ===== 开始生成视频 =====');
                  console.log('[STORYBOARD_VIDEO_GENERATOR] 节点ID:', id);
                  console.log('[STORYBOARD_VIDEO_GENERATOR] 提示词长度:', node.data.generatedPrompt?.length || 0);
                  console.log('[STORYBOARD_VIDEO_GENERATOR] Generating video');

                  const generatedPrompt = node.data.generatedPrompt;
                  if (!generatedPrompt) {
                      throw new Error('请先生成提示词');
                  }

                  // Get model config
                  const selectedPlatform = node.data.selectedPlatform || 'yunwuapi';
                  const selectedModel = node.data.selectedModel || 'luma';
                  const modelConfig = node.data.modelConfig || {
                      aspect_ratio: '16:9',
                      duration: '5',
                      quality: 'standard'
                  };

                  console.log('[STORYBOARD_VIDEO_GENERATOR] Model config:', {
                      platform: selectedPlatform,
                      model: selectedModel,
                      subModel: node.data.subModel,
                      config: modelConfig
                  });

                  // Set to generating status
                  handleNodeUpdate(id, {
                      status: 'generating',
                      progress: 0
                  });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

                  try {
                      // Handle image fusion (if exists)
                      let referenceImageUrl: string | undefined;
                      if (node.data.fusedImage) {
                          console.log('[STORYBOARD_VIDEO_GENERATOR] Uploading fused image to OSS');

                          handleNodeUpdate(id, { progress: 10 });

                          // Import OSS service
                          const { uploadFileToOSS } = await import('./services/ossService');
                          const { getOSSConfig } = await import('./services/soraConfigService');

                          const ossConfig = getOSSConfig();
                          if (ossConfig) {
                              const fileName = `storyboard-fusion-${node.id}-${Date.now()}.png`;
                              referenceImageUrl = await uploadFileToOSS(node.data.fusedImage, fileName, ossConfig);

                              handleNodeUpdate(id, {
                                  fusedImageUrl: referenceImageUrl,
                                  progress: 20
                              });

                              console.log('[STORYBOARD_VIDEO_GENERATOR] Fused image uploaded:', referenceImageUrl);
                          } else {
                              console.warn('[STORYBOARD_VIDEO_GENERATOR] No OSS config, using base64 data URL');
                              referenceImageUrl = node.data.fusedImage;
                          }
                      }

                      // Get API key
                      const { getVideoPlatformApiKey } = await import('./services/soraConfigService');
                      const apiKey = getVideoPlatformApiKey(selectedPlatform);
                      if (!apiKey) {
                          const platformNames: Record<string, string> = {
                              'yunwuapi': '云雾API平台',
                              'official': '官方 Sora',
                              'custom': '自定义'
                          };
                          const platformName = platformNames[selectedPlatform] || selectedPlatform;
                          throw new Error(`请先在设置中配置 ${platformName} 的 API Key\n配置路径: 设置 → API 配置 → 视频平台 API Keys → ${platformName} Key`);
                      }

                      handleNodeUpdate(id, { progress: 30 });

                      // Generate video
                      const { generateVideoFromStoryboard } = await import('./services/videoGenerationService');

                      console.log('[STORYBOARD_VIDEO_GENERATOR] Calling video generation service');

                      const result = await generateVideoFromStoryboard(
                          selectedPlatform as any,
                          selectedModel as any,
                          generatedPrompt,
                          referenceImageUrl,
                          modelConfig,
                          apiKey,
                          {
                              onProgress: (message, progress) => {
                                  const adjustedProgress = 30 + Math.round(progress * 0.7);
                                  handleNodeUpdate(id, { progress: adjustedProgress });
                                  console.log(`[STORYBOARD_VIDEO_GENERATOR] ${message} (${progress}%)`);
                              },
                              subModel: node.data.subModel  // 传递子模型
                          }
                      );

                      console.log('[STORYBOARD_VIDEO_GENERATOR] Video generation complete:', result);

                      // Create child node
                      const childNodeId = `node-storyboard-video-child-${Date.now()}`;
                      const childIndex = (node.data.childNodeIds?.length || 0) + 1;

                      const childNode: AppNode = {
                          id: childNodeId,
                          type: NodeType.STORYBOARD_VIDEO_CHILD,
                          x: node.x + (node.width || 420) + 50,
                          y: node.y + (childIndex - 1) * 150,
                          title: `视频结果 #${childIndex}`,
                          status: NodeStatus.SUCCESS,
                          data: {
                              prompt: generatedPrompt,
                              platformInfo: {
                                  platformCode: selectedPlatform,
                                  modelName: selectedModel
                              },
                              modelConfig,
                              videoUrl: result.videoUrl,
                              videoDuration: result.duration,
                              videoResolution: result.resolution,
                              fusedImageUrl: node.data.fusedImageUrl,
                              promptExpanded: false
                          },
                          inputs: [node.id]
                      };

                      const newConnection: Connection = {
                          from: node.id,
                          to: childNodeId
                      };

                      // Add to asset history
                      if (result.videoUrl) {
                          handleAssetGenerated('video', result.videoUrl, `分镜视频 #${childIndex}`);
                      }

                      // Update node
                      handleNodeUpdate(id, {
                          status: 'completed',
                          progress: 100,
                          currentTaskId: result.taskId,
                          childNodeIds: [...(node.data.childNodeIds || []), childNodeId]
                      });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));

                      // Add child node and connection
                      saveHistory();
                      setNodes(prev => [...prev, childNode]);
                      setConnections(prev => [...prev, newConnection]);

                  } catch (error: any) {
                      console.error('[STORYBOARD_VIDEO_GENERATOR] Video generation failed:', error);

                      handleNodeUpdate(id, {
                          status: 'prompting',
                          error: error.message || '视频生成失败'
                      });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));

                      throw error;
                  }

                  return;
              }

              if (promptOverride === 'regenerate-video') {
                  console.log('[STORYBOARD_VIDEO_GENERATOR] ===== 重新生成视频 =====');
                  console.log('[STORYBOARD_VIDEO_GENERATOR] 节点ID:', id);
                  console.log('[STORYBOARD_VIDEO_GENERATOR] 提示词长度:', node.data.generatedPrompt?.length || 0);
                  console.log('[STORYBOARD_VIDEO_GENERATOR] Regenerating video');

                  const generatedPrompt = node.data.generatedPrompt;
                  if (!generatedPrompt) {
                      throw new Error('请先生成提示词');
                  }

                  // Get model config
                  const selectedPlatform = node.data.selectedPlatform || 'yunwuapi';
                  const selectedModel = node.data.selectedModel || 'luma';
                  const modelConfig = node.data.modelConfig || {
                      aspect_ratio: '16:9',
                      duration: '5',
                      quality: 'standard'
                  };

                  console.log('[STORYBOARD_VIDEO_GENERATOR] Model config:', {
                      platform: selectedPlatform,
                      model: selectedModel,
                      subModel: node.data.subModel,
                      config: modelConfig
                  });

                  // Set to generating status
                  handleNodeUpdate(id, {
                      status: 'generating',
                      progress: 0
                  });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.WORKING } : n));

                  try {
                      // Handle image fusion (if exists)
                      let referenceImageUrl: string | undefined;
                      if (node.data.fusedImage) {
                          console.log('[STORYBOARD_VIDEO_GENERATOR] Uploading fused image to OSS');

                          handleNodeUpdate(id, { progress: 10 });

                          // Import OSS service
                          const { uploadFileToOSS } = await import('./services/ossService');
                          const { getOSSConfig } = await import('./services/soraConfigService');

                          const ossConfig = getOSSConfig();
                          if (ossConfig) {
                              // Check if already uploaded
                              if (node.data.fusedImageUrl) {
                                  referenceImageUrl = node.data.fusedImageUrl;
                                  console.log('[STORYBOARD_VIDEO_GENERATOR] Using already uploaded fused image:', referenceImageUrl);
                              } else {
                                  const fileName = `storyboard-fusion-${node.id}-${Date.now()}.png`;
                                  referenceImageUrl = await uploadFileToOSS(node.data.fusedImage, fileName, ossConfig);

                                  handleNodeUpdate(id, {
                                      fusedImageUrl: referenceImageUrl,
                                      progress: 20
                                  });

                                  console.log('[STORYBOARD_VIDEO_GENERATOR] Fused image uploaded:', referenceImageUrl);
                              }
                          } else {
                              console.warn('[STORYBOARD_VIDEO_GENERATOR] No OSS config, using base64 data URL');
                              referenceImageUrl = node.data.fusedImage;
                          }
                      }

                      // Get API key
                      const { getVideoPlatformApiKey } = await import('./services/soraConfigService');
                      const apiKey = getVideoPlatformApiKey(selectedPlatform);
                      if (!apiKey) {
                          const platformNames: Record<string, string> = {
                              'yunwuapi': '云雾API平台',
                              'official': '官方 Sora',
                              'custom': '自定义'
                          };
                          const platformName = platformNames[selectedPlatform] || selectedPlatform;
                          throw new Error(`请先在设置中配置 ${platformName} 的 API Key\n配置路径: 设置 → API 配置 → 视频平台 API Keys → ${platformName} Key`);
                      }

                      handleNodeUpdate(id, { progress: 30 });

                      // Generate video
                      const { generateVideoFromStoryboard } = await import('./services/videoGenerationService');

                      console.log('[STORYBOARD_VIDEO_GENERATOR] Calling video generation service');

                      const result = await generateVideoFromStoryboard(
                          selectedPlatform as any,
                          selectedModel as any,
                          generatedPrompt,
                          referenceImageUrl,
                          modelConfig,
                          apiKey,
                          {
                              onProgress: (message, progress) => {
                                  const adjustedProgress = 30 + Math.round(progress * 0.7);
                                  handleNodeUpdate(id, { progress: adjustedProgress });
                                  console.log(`[STORYBOARD_VIDEO_GENERATOR] ${message} (${progress}%)`);
                              },
                              subModel: node.data.subModel  // 传递子模型
                          }
                      );

                      console.log('[STORYBOARD_VIDEO_GENERATOR] Video generation complete:', result);

                      // Create child node
                      const childNodeId = `node-storyboard-video-child-${Date.now()}`;
                      const childIndex = (node.data.childNodeIds?.length || 0) + 1;

                      const childNode: AppNode = {
                          id: childNodeId,
                          type: NodeType.STORYBOARD_VIDEO_CHILD,
                          x: node.x + (node.width || 420) + 50,
                          y: node.y + (childIndex - 1) * 150,
                          title: `视频结果 #${childIndex}`,
                          status: NodeStatus.SUCCESS,
                          data: {
                              prompt: generatedPrompt,
                              platformInfo: {
                                  platformCode: selectedPlatform,
                                  modelName: selectedModel
                              },
                              modelConfig,
                              videoUrl: result.videoUrl,
                              videoDuration: result.duration,
                              videoResolution: result.resolution,
                              fusedImageUrl: node.data.fusedImageUrl,
                              promptExpanded: false
                          },
                          inputs: [node.id]
                      };

                      const newConnection: Connection = {
                          from: node.id,
                          to: childNodeId
                      };

                      // Add to asset history
                      if (result.videoUrl) {
                          handleAssetGenerated('video', result.videoUrl, `分镜视频 #${childIndex}`);
                      }

                      // Update node
                      handleNodeUpdate(id, {
                          status: 'completed',
                          progress: 100,
                          currentTaskId: result.taskId,
                          childNodeIds: [...(node.data.childNodeIds || []), childNodeId]
                      });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));

                      // Add child node and connection
                      saveHistory();
                      setNodes(prev => [...prev, childNode]);
                      setConnections(prev => [...prev, newConnection]);

                  } catch (error: any) {
                      console.error('[STORYBOARD_VIDEO_GENERATOR] Video regeneration failed:', error);

                      handleNodeUpdate(id, {
                          status: 'prompting',
                          error: error.message || '视频重新生成失败'
                      });
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));

                      throw error;
                  }

                  return;
              }
          }

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

              console.log('[CHARACTER_NODE] Starting character node processing:', {
                  nodeId: id,
                  hasExtractedNames: !!node.data.extractedCharacterNames,
                  nameCount: node.data.extractedCharacterNames?.length || 0,
                  inputCount: node.inputs.length,
                  existingGeneratedCount: node.data.generatedCharacters?.length || 0
              });

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
                  recursiveLength: recursiveUpstreamTexts.join('\n').length,
                  inputTypes: inputs.map(n => n?.type)
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

                  // Skip if already generated successfully
                  const existingChar = newGeneratedChars.find(c => c.name === name);
                  if (existingChar && existingChar.status === 'SUCCESS') {
                      console.log('[CHARACTER_NODE] Skipping completed character:', name, 'status:', existingChar.status);
                      continue;
                  }

                  // Skip if currently processing expressions or three views
                  if (existingChar && (existingChar.isGeneratingExpression || existingChar.isGeneratingThreeView)) {
                      console.log('[CHARACTER_NODE] Skipping character (generating sub-items):', name, 'status:', existingChar.status);
                      continue;
                  }

                  // Skip if character exists and is in IDLE state (waiting for manual trigger)
                  if (existingChar && existingChar.status === 'IDLE') {
                      console.log('[CHARACTER_NODE] Skipping IDLE character (waiting for manual trigger):', name);
                      continue;
                  }

                  // 对于 GENERATING、ERROR 或其他非成功状态，允许重新生成
                  if (existingChar && existingChar.status === 'GENERATING') {
                      console.log('[CHARACTER_NODE] Regenerating stuck character (was in GENERATING state):', name);
                  } else if (existingChar && existingChar.status === 'ERROR') {
                      console.log('[CHARACTER_NODE] Regenerating ERROR character:', name);
                  } else if (existingChar && existingChar.status !== 'PENDING') {
                      // 其他状态也允许重新生成，避免卡住
                      console.log('[CHARACTER_NODE] Regenerating character with status:', name, existingChar.status);
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
                      // SUPPORTING CHARACTER: 只生成基础信息，不生成图片
                      const context = recursiveUpstreamTexts.join('\n');

                      console.log('[CHARACTER_NODE] Generating supporting character with recursive context:', {
                          name,
                          contextLength: context.length
                      });

                      try {
                          // Import the supporting character generator
                          const { generateSupportingCharacter } = await import('./services/geminiService');

                          // Step 1: Generate simplified profile
                          const profile = await generateSupportingCharacter(
                              name,
                              context,
                              stylePrompt,
                              getUserDefaultModel('text'),
                              { nodeId: id, nodeType: node.type }
                          );

                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          const existingChar = newGeneratedChars[idx];
                          newGeneratedChars[idx] = {
                              ...profile,
                              expressionSheet: existingChar?.expressionSheet,
                              threeViewSheet: existingChar?.threeViewSheet,
                              status: 'SUCCESS' as const,
                              roleType: 'supporting',
                              isGeneratingExpression: false,
                              isGeneratingThreeView: false
                          };
                          console.log('[CHARACTER_NODE] Supporting character profile generated successfully:', {
                              name,
                              status: newGeneratedChars[idx].status,
                              roleType: 'supporting'
                          });
                      } catch (e: any) {
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          newGeneratedChars[idx] = { ...newGeneratedChars[idx], status: 'ERROR', error: e.message };
                      }
                  } else {
                      // 主角：使用 GENERATE_ALL 自动完成完整流程
                      console.log('[CHARACTER_NODE] Using GENERATE_ALL for main character:', name);

                      try {
                          console.log('[CHARACTER_NODE] About to call handleCharacterActionNew for:', name);

                          // 调用 handleCharacterActionNew，它会处理完整的生成流程
                          await handleCharacterActionNew(
                              id,                  // nodeId
                              'GENERATE_ALL',      // action
                              name,                // charName
                              node,                // node ← 必须传递当前节点！
                              nodesRef.current,    // allNodes
                              handleNodeUpdate     // onNodeUpdate ← 必须传递更新函数！
                          );

                          console.log('[CHARACTER_NODE] handleCharacterActionNew returned successfully for:', name);

                          // 更新状态为生成完成
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          if (idx >= 0) {
                              const updatedChar = nodesRef.current.find(n => n.id === id)?.data?.generatedCharacters?.find(c => c.name === name);
                              if (updatedChar) {
                                  newGeneratedChars[idx] = updatedChar;
                                  console.log('[CHARACTER_NODE] Updated character from node:', name, 'status:', updatedChar.status);
                              } else {
                                  console.warn('[CHARACTER_NODE] Could not find updated character in node:', name);
                              }
                          }

                          console.log('[CHARACTER_NODE] GENERATE_ALL completed for:', name);
                      } catch (e: any) {
                          console.error('[CHARACTER_NODE] GENERATE_ALL failed for:', name, e);
                          console.error('[CHARACTER_NODE] Error stack:', e?.stack);
                          console.error('[CHARACTER_NODE] Error details:', {
                              message: e?.message,
                              name: e?.name,
                              cause: e?.cause
                          });
                          const idx = newGeneratedChars.findIndex(c => c.name === name);
                          if (idx >= 0) {
                              newGeneratedChars[idx] = { ...newGeneratedChars[idx], status: 'ERROR', error: e?.message || String(e) };
                          }
                      }
                  }

                  // Update after each character is processed (for real-time feedback)
                  handleNodeUpdate(id, { generatedCharacters: [...newGeneratedChars] });
              }

              // Check if any characters were processed
              const anyProcessed = newGeneratedChars.some(c => c.status === 'GENERATING' || c.status === 'SUCCESS' || c.status === 'ERROR');
              if (!anyProcessed && names.length > 0) {
                  // All characters were skipped - they're already in SUCCESS state
                  console.log('[CHARACTER_NODE] All characters already generated, no action needed');
                  handleNodeUpdate(id, { generatedCharacters: [...newGeneratedChars] });
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
              } else if (names.length === 0) {
                  // No characters to generate
                  console.log('[CHARACTER_NODE] No characters to generate');
                  setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.IDLE } : n));
              } else {
                  // Characters were processed - check if all completed successfully
                  const allSuccess = newGeneratedChars.every(c => c.status === 'SUCCESS');
                  const hasError = newGeneratedChars.some(c => c.status === 'ERROR');

                  if (allSuccess) {
                      console.log('[CHARACTER_NODE] All characters generated successfully');
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.SUCCESS } : n));
                  } else if (hasError) {
                      console.log('[CHARACTER_NODE] Some characters failed to generate');
                      setNodes(p => p.map(n => n.id === id ? { ...n, status: NodeStatus.ERROR } : n));
                  }
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
              }, refinedInfo, getUserDefaultModel('text')); // 传入精炼信息作为参考和模型，总是使用最新配置
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
                  getUserDefaultModel('text'), // 总是使用最新的模型配置
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
                                   const res = await generateImageFromText(n.data.prompt!, getUserDefaultModel('image'), inputImages, { aspectRatio: n.data.aspectRatio, resolution: n.data.resolution, count: 1 });
                                   handleNodeUpdate(n.id, { image: res[0], images: res, status: NodeStatus.SUCCESS });
                               } catch (e: any) {
                                   handleNodeUpdate(n.id, { error: e.message, status: NodeStatus.ERROR });
                               }
                          });
                          return; 
                      }
                  } catch (e) { console.warn("Storyboard planning failed", e); }
               }

               // ✅ 检查缓存
               const cachedImages = await checkImageNodeCache(id);
               if (cachedImages && cachedImages.length > 0) {
                   console.log('[App] ✅ 使用缓存的图片:', cachedImages.length);
                   handleNodeUpdate(id, {
                       image: cachedImages[0],
                       images: cachedImages,
                       status: NodeStatus.SUCCESS,
                       isCached: true,
                       cacheLocation: 'filesystem'
                   });
               } else {
                   // ❌ 没有缓存，调用 API
                   console.log('[App] 🌐 缓存未命中，调用 API 生成图片');
                  const res = await generateImageFromText(
                      finalPrompt,
                      getUserDefaultModel('image'),
                      inputImages,
                      { aspectRatio: node.data.aspectRatio || '16:9', resolution: node.data.resolution, count: node.data.imageCount },
                      { nodeId: id, nodeType: node.type }
                  );
                  handleNodeUpdate(id, {
                      image: res[0],
                      images: res,
                      isCached: false
                  });
                  // Save to local storage
                  await saveImageNodeOutput(id, res, 'IMAGE_GENERATOR');
               }

          } else if (node.type === NodeType.VIDEO_GENERATOR) {
              // Extract style preset from inputs
              const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
              const stylePrefix = stylePresetNode?.data.stylePrompt || '';
              const finalPrompt = stylePrefix ? `${stylePrefix}, ${prompt}` : prompt;

              const strategy = await getGenerationStrategy(node, inputs, finalPrompt);

              // ✅ 检查缓存
              const cachedVideo = await checkVideoNodeCache(id);
              if (cachedVideo) {
                  console.log('[App] ✅ 使用缓存的视频');
                  handleNodeUpdate(id, {
                      videoUri: cachedVideo,
                      videoMetadata: node.data.videoMetadata,
                      videoUris: [cachedVideo],
                      status: NodeStatus.SUCCESS,
                      isCached: true,
                      cacheLocation: 'filesystem'
                  });
              } else {
                  // ❌ 没有缓存，调用 API
                  console.log('[App] 🌐 缓存未命中，调用 API 生成视频');
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
                           status: NodeStatus.SUCCESS,
                           isCached: false
                       });
                  } else {
                       handleNodeUpdate(id, {
                           videoUri: res.uri,
                           videoMetadata: res.videoMetadata,
                           videoUris: res.uris,
                           isCached: false
                       });
                       // Save to local storage
                       const videoUris = res.uris || [res.uri];
                       await saveVideoNodeOutput(id, videoUris, 'VIDEO_GENERATOR');
                  }
              }

          } else if (node.type === NodeType.AUDIO_GENERATOR) {
              // Extract style preset from inputs
              const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);
              const stylePrefix = stylePresetNode?.data.stylePrompt || '';
              const finalPrompt = stylePrefix ? `${stylePrefix}, ${prompt}` : prompt;

              // ✅ 检查缓存
              const cachedAudio = await checkAudioNodeCache(id);
              if (cachedAudio) {
                  console.log('[App] ✅ 使用缓存的音频');
                  handleNodeUpdate(id, {
                      audioUri: cachedAudio,
                      status: NodeStatus.SUCCESS,
                      isCached: true,
                      cacheLocation: 'filesystem'
                  });
              } else {
                  // ❌ 没有缓存，调用 API
                  console.log('[App] 🌐 缓存未命中，调用 API 生成音频');
                  const audioUri = await generateAudio(finalPrompt, node.data.model);
                  handleNodeUpdate(id, {
                      audioUri: audioUri,
                      isCached: false
                  });
                  // Save to local storage
                  await saveAudioNodeOutput(id, audioUri, 'AUDIO_GENERATOR');
              }

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
                      ? 'Xianxia 3D animation character, semi-realistic style, Xianxia animation aesthetics, high precision 3D modeling, PBR shading with soft translucency, subsurface scattering, ambient occlusion, delicate and smooth skin texture (not overly realistic), flowing fabric clothing, individual hair strands, soft ethereal lighting, cinematic rim lighting with cool blue tones, otherworldly gaze, elegant and cold demeanor, 3D animation quality, vibrant colors.'
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
                              shotNumber: shot.shotNumber,
                              duration: shot.duration,
                              scene: shot.scene || '',
                              characters: shot.characters || [],
                              shotSize: shot.shotSize || '',
                              cameraAngle: shot.cameraAngle || '',
                              cameraMovement: shot.cameraMovement || '',
                              visualDescription: shot.visualDescription || '',
                              dialogue: shot.dialogue || '无',
                              visualEffects: shot.visualEffects || '',
                              audioEffects: shot.audioEffects || '',
                              startTime: shot.startTime || 0,
                              endTime: shot.endTime || (shot.startTime || 0) + (shot.duration || 3)
                          }))
                      }, null, 2); // 使用格式化输出，便于调试
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
                  // 直接尝试解析整个字符串作为JSON
                  try {
                      const parsed = JSON.parse(storyboardContent);
                      if (parsed.shots && Array.isArray(parsed.shots) && parsed.shots.length > 0) {
                          extractedShots = parsed.shots;
                          console.log('[STORYBOARD_IMAGE] Parsed structured shots:', extractedShots.length);
                          console.log('[STORYBOARD_IMAGE] First shot sample:', extractedShots[0]);
                      }
                  } catch (e) {
                      console.warn('[STORYBOARD_IMAGE] Failed to parse JSON as whole, trying regex fallback:', e);
                      // 如果整体解析失败，尝试提取shots部分
                      const jsonMatch = storyboardContent.match(/\{[\s\S]*"shots"[\s\S]*\}/);
                      if (jsonMatch) {
                          try {
                              const parsed = JSON.parse(jsonMatch[0]);
                              if (parsed.shots && Array.isArray(parsed.shots)) {
                                  extractedShots = parsed.shots;
                                  console.log('[STORYBOARD_IMAGE] Parsed structured shots via regex:', extractedShots.length);
                              }
                          } catch (e2) {
                              console.warn('[STORYBOARD_IMAGE] Regex fallback also failed, using text parsing');
                          }
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
              const characterNames: string[] = [];  // Track character names for prompt
              const characterNode = inputs.find(n => n.type === NodeType.CHARACTER_NODE);

              if (characterNode?.data.generatedCharacters) {
                  const characters = characterNode.data.generatedCharacters as CharacterProfile[];
                  characters.forEach(char => {
                      if (char.threeViewSheet) {
                          characterReferenceImages.push(char.threeViewSheet);
                      } else if (char.expressionSheet) {
                          characterReferenceImages.push(char.expressionSheet);
                      }
                      // Collect character names
                      if (char.name) {
                          characterNames.push(char.name);
                      }
                  });

                  console.log('[STORYBOARD_IMAGE] Character references:', {
                      characterCount: characters.length,
                      referenceImageCount: characterReferenceImages.length,
                      characterNames: characterNames,
                      hasReferences: characterReferenceImages.length > 0
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

                  // Extract unique scenes and build scene consistency guide
                  const sceneGroups = new Map<string, { indices: number[], descriptions: string[] }>();
                  pageShots.forEach((shot, idx) => {
                      if (!shot.isEmpty && shot.scene) {
                          if (!sceneGroups.has(shot.scene)) {
                              sceneGroups.set(shot.scene, { indices: [], descriptions: [] });
                          }
                          const group = sceneGroups.get(shot.scene)!;
                          group.indices.push(idx + 1); // 1-based panel number
                          if (shot.visualDescription) {
                              group.descriptions.push(shot.visualDescription);
                          }
                      }
                  });

                  // Build scene consistency section
                  let sceneConsistencySection = '';
                  if (sceneGroups.size > 0) {
                      const sceneEntries = Array.from(sceneGroups.entries()).map(([sceneName, data]) => {
                          const panelList = data.indices.join(', ');
                          const combinedDesc = data.descriptions.join(' ');
                          // Truncate if too long
                          const descSummary = combinedDesc.length > 150
                              ? combinedDesc.substring(0, 150) + '...'
                              : combinedDesc;

                          return `- Scene "${sceneName}" (Panels ${panelList}): ${descSummary}`;
                      }).join('\n');

                      sceneConsistencySection = `
SCENE CONSISTENCY REQUIREMENTS:
CRITICAL: Panels belonging to the same scene MUST maintain perfect visual consistency:
${sceneEntries}

For each scene above:
- Environment style, architecture, and props must be IDENTICAL across all panels of that scene
- Lighting quality, color temperature, and shadow direction must be CONSISTENT within the same scene
- Atmosphere, mood, and environmental effects must match across panels of the same scene
- Background elements, textures, and materials must be the same for the same scene
- Time of day and weather conditions must be consistent within each scene

This ensures visual continuity - multiple panels showing the same scene should look like different camera angles of the SAME location, not different places.
`;
                  }

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

${characterReferenceImages.length > 0 ? `CHARACTER CONSISTENCY (CRITICAL):
⚠️ MANDATORY: You MUST use the provided character reference images as the ONLY source of truth for character appearance.

Characters in this storyboard: ${characterNames.length > 0 ? characterNames.join(', ') : 'See reference images'}
Number of character references provided: ${characterReferenceImages.length}

REQUIREMENTS:
- ALL characters in EVERY panel must look EXACTLY THE SAME as in the reference images
- Face: SAME facial features, eye shape, nose, mouth, skin tone, expression style
- Hair: IDENTICAL hairstyle, hair color, hair texture, hair length
- Body: SAME body proportions, height, build, posture
- Clothing: EXACT SAME clothes, accessories, shoes, colors, fabrics
- Skin: IDENTICAL skin texture, skin tone, skin quality
- ZERO tolerance for character appearance changes across panels
- DO NOT generate random or different-looking characters
- Treat these reference images as sacred - match them PERFECTLY in every detail

This is NON-NEGOTIABLE: Character consistency across all panels is mandatory.
` : ''}

${sceneConsistencySection}

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
                      aspectRatio: outputAspectRatio,
                      sceneGroups: Array.from(sceneGroups.entries()).map(([scene, data]) => ({
                          scene,
                          panelCount: data.indices.length,
                          panels: data.indices
                      })),
                      characterReferences: {
                          count: characterReferenceImages.length,
                          names: characterNames,
                          hasReferences: characterReferenceImages.length > 0
                      }
                  });

                  try {
                      // Use user-configured model priority with fallback
                      console.log(`[STORYBOARD_IMAGE] Generating page ${pageIndex + 1}/${numberOfPages} with model: ${primaryImageModel}`);

                      // Add timeout wrapper (5 minutes per page)
                      const timeoutPromise = new Promise<never>((_, reject) => {
                          setTimeout(() => reject(new Error('页面生成超时（5分钟）')), 5 * 60 * 1000);
                      });

                      const imgs = await Promise.race([
                          generateImageWithFallback(
                              gridPrompt,
                              primaryImageModel,
                              characterReferenceImages,
                              {
                                  aspectRatio: outputAspectRatio,
                                  resolution: "2K",
                                  count: 1
                              },
                              { nodeId: id, nodeType: node.type }
                          ),
                          timeoutPromise
                      ]);

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

                  // Warn if some pages failed
                  if (generatedGrids.length > 0 && generatedGrids.length < numberOfPages) {
                      const failedPages = numberOfPages - generatedGrids.length;
                      console.warn(`[STORYBOARD_IMAGE] ${failedPages} page(s) failed to generate. ${generatedGrids.length} page(s) succeeded.`);
                      // Note: We still proceed with the successful pages
                  }

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

                  // 添加到历史记录
                  generatedGrids.forEach((gridUrl, index) => {
                      handleAssetGenerated('image', gridUrl, `分镜图 第${index + 1}页`);
                  });

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

              const { DEFAULT_SORA2_CONFIG } = await import('./services/soraConfigService');
              // 2. Get Sora2 configuration from node
              const sora2Config = node.data.sora2Config || DEFAULT_SORA2_CONFIG;
              const maxDuration = parseInt(sora2Config.duration); // 5, 10, or 15

              // 3. Group shots into task groups based on selected duration
              const taskGroups: SoraTaskGroup[] = [];
              let currentGroup: any = {
                  id: `tg-${Date.now()}-${taskGroups.length}`,
                  taskNumber: taskGroups.length + 1,
                  totalDuration: 0,
                  shotIds: [] as string[],
                  splitShots: [] as any[],
                  sora2Config: { ...sora2Config },
                  soraPrompt: '',
                  promptGenerated: false,
                  imageFused: false,
                  generationStatus: 'idle' as const
              };

              allSplitShots.forEach(shot => {
                  const shotDuration = shot.duration || 0;

                  // Check if adding this shot would exceed the max duration
                  if (currentGroup.totalDuration + shotDuration > maxDuration && currentGroup.shotIds.length > 0) {
                      // Finalize current group and start a new one
                      taskGroups.push({ ...currentGroup });
                      currentGroup = {
                          id: `tg-${Date.now()}-${taskGroups.length + 1}`,
                          taskNumber: taskGroups.length + 2,
                          totalDuration: 0,
                          shotIds: [],
                          splitShots: [],
                          sora2Config: { ...sora2Config },
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
                  maxDuration: maxDuration,
                  aspectRatio: sora2Config.aspect_ratio,
                  hd: sora2Config.hd,
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
                    // 保留任务组创建时设置的 Sora2 配置（用户选择的时长）
                    if (!tg.sora2Config) {
                        tg.sora2Config = { ...DEFAULT_SORA2_CONFIG };
                    }
                    tg.generationStatus = 'prompt_ready';
                    console.log(`[SORA_VIDEO_GENERATOR] Prompt generated for task group ${tg.taskNumber}`);
                  } catch (error) {
                    console.error(`[SORA_VIDEO_GENERATOR] Failed to generate professional prompt for task group ${tg.taskNumber}:`, error);
                    // Fallback to basic prompt
                    const { buildSoraStoryPrompt } = await import('./services/soraService');
                    tg.soraPrompt = buildSoraStoryPrompt(tg.splitShots);
                    tg.promptGenerated = true;
                    // 保留任务组创建时设置的 Sora2 配置（用户选择的时长）
                    if (!tg.sora2Config) {
                        tg.sora2Config = { ...DEFAULT_SORA2_CONFIG };
                    }
                    tg.generationStatus = 'prompt_ready';
                  }
              }

              // Save task groups to node data
              handleNodeUpdate(id, {
                  taskGroups: taskGroups
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
          ref={canvasRef}
          className={`w-full h-full overflow-hidden text-slate-200 selection:bg-cyan-500/30 ${canvas.isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'}`}
          onMouseDown={handleCanvasMouseDown}
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
                  <MemoizedConnectionLayer
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

              {nodes.map(node => {
                  const inputAssets = getNodeInputAssets(node.id, node.inputs);
                  return (
                  <Node
                      key={node.id}
                      node={node}
                      // 性能优化：使用nodeQuery而不是传递整个nodes数组
                      nodeQuery={nodeQuery.current}
                      characterLibrary={assetHistory.filter(a => a.type === 'character').map(a => a.data)}
                      onUpdate={handleNodeUpdate}
                      onAction={handleNodeAction}
                      onDelete={handleNodeDelete}
                      onExpand={handleNodeExpand}
                      onCrop={handleNodeCrop}
                      onNodeMouseDown={handleNodeMouseDown}
                      onPortMouseDown={handlePortMouseDown}
                      onPortMouseUp={handlePortMouseUp}
                      onNodeContextMenu={handleNodeContextMenu}
                      onResizeMouseDown={handleResizeMouseDown}
                      onCharacterAction={handleCharacterAction}
                      onViewCharacter={(char) => setViewingCharacter({ character: char, nodeId: node.id })}
                      isSelected={selectedNodeIds.includes(node.id)}
                      inputAssets={inputAssets}
                      onInputReorder={handleInputReorder}
                      isDragging={draggingNodeId === node.id} isResizing={resizingNodeId === node.id} isConnecting={!!connectionStart} isGroupDragging={activeGroupNodeIds.includes(node.id)}
                  />
                  );
              })}

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
              selectedNodeIds={selectedNodeIds}
              nodeTypes={[
                  NodeType.IMAGE_GENERATOR,
                  NodeType.SCRIPT_PLANNER,
                  NodeType.SCRIPT_EPISODE,
                  NodeType.CHARACTER_NODE,
                  NodeType.STYLE_PRESET,
                  NodeType.STORYBOARD_GENERATOR,
                  NodeType.STORYBOARD_IMAGE,
                  NodeType.STORYBOARD_SPLITTER,
                  NodeType.SORA_VIDEO_GENERATOR,
                  NodeType.DRAMA_ANALYZER
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

                      case 'deleteMultiple':
                          // 删除所有选中的节点
                          if (Array.isArray(data) && data.length > 0) {
                              deleteNodes(data);
                              // 清除选中状态
                              setSelectedNodeIds([]);
                          }
                          break;

                      case 'createGroupFromSelection':
                          // 从选中的节点创建分组
                          if (Array.isArray(data) && data.length > 0) {
                              const selectedNodes = nodes.filter(n => data.includes(n.id));
                              if (selectedNodes.length > 0) {
                                  saveHistory();

                                  // 计算分组边界
                                  const fMinX = Math.min(...selectedNodes.map(n => n.x));
                                  const fMinY = Math.min(...selectedNodes.map(n => n.y));
                                  const fMaxX = Math.max(...selectedNodes.map(n => n.x + (n.width || 420)));
                                  const fMaxY = Math.max(...selectedNodes.map(n => n.y + 320));

                                  // 创建新分组
                                  const newGroup = {
                                      id: `g-${Date.now()}`,
                                      title: '新建分组',
                                      x: fMinX - 32,
                                      y: fMinY - 32,
                                      width: (fMaxX - fMinX) + 64,
                                      height: (fMaxY - fMinY) + 64
                                  };

                                  setGroups(prev => [...prev, newGroup]);

                                  // 清除选中状态
                                  setSelectedNodeIds([]);
                              }
                          }
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
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
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
          <div className="absolute top-8 right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-700 flex flex-col gap-2 items-end">
              {storageReconnectNeeded && (
                  <button
                      onClick={async () => {
                          try {
                              const { getFileStorageService } = await import('./services/storage');
                              const service = getFileStorageService();
                              await service.selectRootDirectory();
                              setStorageReconnectNeeded(false);
                              alert('✅ 已成功连接工作文件夹！');
                          } catch (error: any) {
                              console.error('[App] 重连失败:', error);
                              alert('❌ 连接失败: ' + error.message);
                          }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 backdrop-blur-2xl border border-orange-500/30 rounded-full shadow-2xl text-orange-300 hover:text-orange-200 hover:border-orange-500/50 transition-all hover:scale-105 animate-pulse"
                      title="点击重新连接本地存储文件夹"
                  >
                      <HardDrive size={16} />
                      <span className="text-xs font-medium">重连存储</span>
                  </button>
              )}
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