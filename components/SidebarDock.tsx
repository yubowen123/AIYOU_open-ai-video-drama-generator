
// ... existing imports
import React, { useState, useRef, useEffect } from 'react';
import {
    Plus, RotateCcw, History, MessageSquare, FolderHeart, X,
    ImageIcon, Video as VideoIcon, Film, Save, FolderPlus,
    Edit, Trash2, Box, ScanFace, Brush, Type, Workflow as WorkflowIcon,
    Clapperboard, Mic2, Settings, BookOpen, ScrollText, User, Search, Sparkles, Palette, Bug, LayoutGrid, Grid
} from 'lucide-react';
import { NodeType, Workflow } from '../types';

interface SidebarDockProps {
    onAddNode: (type: NodeType) => void;
    onUndo: () => void;
    isChatOpen: boolean;
    onToggleChat: () => void;

    // Smart Sequence (ex-MultiFrame)
    isMultiFrameOpen: boolean;
    onToggleMultiFrame: () => void;

    // Sonic Studio (Music)
    isSonicStudioOpen?: boolean;
    onToggleSonicStudio?: () => void;

    // Character Library
    isCharacterLibraryOpen?: boolean;
    onToggleCharacterLibrary?: () => void;

    // Debug Panel
    isDebugOpen?: boolean;
    onToggleDebug?: () => void;

    // History Props
    assetHistory: any[];
    onHistoryItemClick: (item: any) => void;
    onDeleteAsset: (id: string) => void;

    // Workflow Props
    workflows: Workflow[];
    selectedWorkflowId: string | null;
    onSelectWorkflow: (id: string | null) => void;
    onSaveWorkflow: () => void;
    onDeleteWorkflow: (id: string) => void;
    onRenameWorkflow: (id: string, title: string) => void;

    // Settings
    onOpenSettings: () => void;
}

// ... (Helper Helpers UNCHANGED) ...
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
        case NodeType.STORYBOARD_IMAGE: return '分镜图设计';
        case NodeType.STORYBOARD_SPLITTER: return '分镜图拆解';
        case NodeType.CHARACTER_NODE: return '角色设计';
        case NodeType.DRAMA_ANALYZER: return '剧目分析';
        case NodeType.DRAMA_REFINED: return '剧目精炼';
        case NodeType.STYLE_PRESET: return '全局风格';
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
        case NodeType.STORYBOARD_IMAGE: return LayoutGrid;
        case NodeType.STORYBOARD_SPLITTER: return Grid;
        case NodeType.CHARACTER_NODE: return User;
        case NodeType.DRAMA_ANALYZER: return Search;
        case NodeType.DRAMA_REFINED: return Sparkles;
        case NodeType.STYLE_PRESET: return Palette;
        default: return Plus;
    }
};

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

export const SidebarDock: React.FC<SidebarDockProps> = ({
    onAddNode,
    onUndo,
    isChatOpen,
    onToggleChat,
    isMultiFrameOpen,
    onToggleMultiFrame,
    isSonicStudioOpen,
    onToggleSonicStudio,
    isCharacterLibraryOpen,
    onToggleCharacterLibrary,
    isDebugOpen,
    onToggleDebug,
    assetHistory,
    onHistoryItemClick,
    onDeleteAsset,
    workflows,
    selectedWorkflowId,
    onSelectWorkflow,
    onSaveWorkflow,
    onDeleteWorkflow,
    onRenameWorkflow,
    onOpenSettings
}) => {
    // ... (State logic UNCHANGED) ...
    const [activePanel, setActivePanel] = useState<'history' | 'workflow' | 'add' | null>(null);
    const [activeHistoryTab, setActiveHistoryTab] = useState<'image' | 'video'>('image');
    const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, id: string, type: 'workflow' | 'history' } | null>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hover Handlers
    const handleSidebarHover = (id: string) => {
        if (['add', 'history', 'workflow'].includes(id)) {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
            setActivePanel(id as any);
        } else {
            closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 100);
        }
    };

    const handleSidebarLeave = () => {
        closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 500);
    };

    const handlePanelEnter = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };

    const handlePanelLeave = () => {
        closeTimeoutRef.current = setTimeout(() => setActivePanel(null), 500);
    };

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // ... (renderPanelContent logic for history and workflow UNCHANGED) ...
    const renderPanelContent = () => {
        if (activePanel === 'history') {
            const filteredAssets = assetHistory.filter(a => {
                if (activeHistoryTab === 'image') return a.type === 'image' || a.type.includes('image') || a.type.includes('image_generator');
                if (activeHistoryTab === 'video') return a.type === 'video' || a.type.includes('video');
                return false;
            });

            return (
                <>
                    <div className="p-4 border-b border-white/5 flex flex-col gap-3 bg-white/5">
                        <div className="flex justify-between items-center">
                            <button onClick={() => setActivePanel(null)}><X size={14} className="text-slate-500 hover:text-white" /></button>
                            <span className="text-xs font-bold uppercase tracking-widest text-white/50">历史记录</span>
                        </div>
                        {/* Tabs */}
                        <div className="flex bg-black/20 p-1 rounded-lg">
                            <button 
                                onClick={() => setActiveHistoryTab('image')}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeHistoryTab === 'image' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <ImageIcon size={12} /> 图片
                            </button>
                            <button 
                                onClick={() => setActiveHistoryTab('video')}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeHistoryTab === 'video' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <VideoIcon size={12} /> 视频
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2 relative">
                        {filteredAssets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 select-none">
                                {activeHistoryTab === 'image' ? <ImageIcon size={48} strokeWidth={1} className="mb-3 opacity-50" /> : <Film size={48} strokeWidth={1} className="mb-3 opacity-50" />}
                                <span className="text-[10px] font-medium tracking-widest uppercase">暂无{activeHistoryTab === 'image' ? '图片' : '视频'}</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 p-1">
                                {filteredAssets.map(a => (
                                    <div 
                                        key={a.id} 
                                        className="aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-white/5 hover:border-cyan-500/50 transition-colors group relative shadow-md bg-black/20"
                                        draggable={true}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('application/json', JSON.stringify(a));
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={() => onHistoryItemClick(a)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, id: a.id, type: 'history' });
                                        }}
                                    >
                                        {a.type.includes('image') ? (
                                            <img src={a.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" draggable={false} />
                                        ) : (
                                            <video src={a.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" draggable={false} />
                                        )}
                                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[8px] font-bold text-white/70">
                                            {a.type.includes('image') ? 'IMG' : 'MOV'}
                                        </div>
                                        <div className="absolute bottom-0 left-0 w-full p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[9px] text-white/90 truncate font-medium">
                                            {a.title || 'Untitled'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            );
        }

        if (activePanel === 'workflow') {
            return (
                <>
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                            我的工作流
                        </span>
                        <button onClick={onSaveWorkflow} className="p-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white rounded-md transition-colors" title="保存当前工作流">
                            <Save size={14} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 relative">
                        {workflows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 select-none">
                                <FolderHeart size={48} strokeWidth={1} className="mb-3 opacity-50" />
                                <span className="text-[10px] font-medium tracking-widest uppercase text-center">空空如也<br/>保存您的第一个工作流</span>
                            </div>
                        ) : (
                            workflows.map(wf => (
                                <div 
                                    key={wf.id} 
                                    className={`
                                        relative p-2 rounded-xl border bg-black/20 group transition-all duration-300 cursor-grab active:cursor-grabbing hover:bg-white/5
                                        ${selectedWorkflowId === wf.id ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-white/5 hover:border-white/20'}
                                    `}
                                    draggable={true}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/workflow-id', wf.id);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onClick={(e) => { e.stopPropagation(); onSelectWorkflow(wf.id); }}
                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingWorkflowId(wf.id); }}
                                    onContextMenu={(e) => { 
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        setContextMenu({visible: true, x: e.clientX, y: e.clientY, id: wf.id, type: 'workflow'}); 
                                    }}
                                >
                                    <div className="aspect-[2/1] bg-black/40 rounded-lg mb-2 overflow-hidden relative">
                                        {wf.thumbnail ? (
                                            <img src={wf.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" draggable={false} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <WorkflowIcon size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        {editingWorkflowId === wf.id ? (
                                            <input 
                                                className="bg-black/50 border border-cyan-500/50 rounded px-1 text-xs text-white w-full outline-none"
                                                defaultValue={wf.title}
                                                autoFocus
                                                onBlur={(e) => { onRenameWorkflow(wf.id, e.target.value); setEditingWorkflowId(null); }}
                                                onKeyDown={(e) => { if(e.key === 'Enter') { onRenameWorkflow(wf.id, e.currentTarget.value); setEditingWorkflowId(null); } }}
                                            />
                                        ) : (
                                            <span className="text-xs font-medium text-slate-300 truncate select-none group-hover:text-white transition-colors">{wf.title}</span>
                                        )}
                                        <span className="text-[9px] text-slate-600 font-mono">{wf.nodes.length} 节点</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            );
        }

        // Default: Add Node
        return (
            <>
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <button onClick={() => setActivePanel(null)}><X size={14} className="text-slate-500 hover:text-white" /></button>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                        添加节点
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                    {[NodeType.PROMPT_INPUT, NodeType.IMAGE_GENERATOR, NodeType.VIDEO_GENERATOR, NodeType.AUDIO_GENERATOR, NodeType.SCRIPT_PLANNER, NodeType.SCRIPT_EPISODE, NodeType.CHARACTER_NODE, NodeType.STYLE_PRESET, NodeType.STORYBOARD_GENERATOR, NodeType.STORYBOARD_IMAGE, NodeType.STORYBOARD_SPLITTER, NodeType.DRAMA_ANALYZER, NodeType.VIDEO_ANALYZER, NodeType.IMAGE_EDITOR].map(t => {
                        const ItemIcon = getNodeIcon(t);
                        return (
                            <button 
                                key={t} 
                                onClick={(e) => { e.stopPropagation(); onAddNode(t); setActivePanel(null); }} 
                                className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 flex items-center gap-3 text-sm text-slate-200 transition-colors border border-transparent hover:border-white/5 hover:shadow-lg"
                            >
                                <div className="p-2 bg-white/10 rounded-lg text-cyan-200 shadow-inner">
                                    <ItemIcon size={16} />
                                </div> 
                                <div className="flex flex-col">
                                    <span className="font-medium text-xs">{getNodeNameCN(t)}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </>
        );
    };

    return (
        <>
            {/* Left Vertical Dock */}
            <div 
                className="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 p-2 bg-[#2c2c2e]/70 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-left-10 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                onMouseLeave={handleSidebarLeave}
            >
                {[
                    { id: 'add', icon: Plus },
                    { id: 'workflow', icon: FolderHeart },
                    { id: 'smart_sequence', icon: Clapperboard, action: onToggleMultiFrame, active: isMultiFrameOpen },
                    { id: 'sonic_studio', icon: Mic2, action: onToggleSonicStudio, active: isSonicStudioOpen, tooltip: '音频中心 (Audio Hub)' },
                    { id: 'character_library', icon: User, action: onToggleCharacterLibrary, active: isCharacterLibraryOpen, tooltip: '角色库 (Char Lib)' },
                    { id: 'history', icon: History },
                    { id: 'chat', icon: MessageSquare, action: onToggleChat, active: isChatOpen },
                    { id: 'debug', icon: Bug, action: onToggleDebug, active: isDebugOpen, tooltip: 'API日志调试' },
                    { id: 'undo', icon: RotateCcw, action: onUndo },
                ].map(item => (
                    <div key={item.id} className="relative group">
                        <button 
                            onMouseEnter={() => handleSidebarHover(item.id)}
                            onClick={() => item.action ? item.action() : setActivePanel(item.id as any)}
                            className={`relative group w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${activePanel === item.id || item.active ? 'bg-white text-black shadow-lg' : 'hover:bg-white/10 text-slate-300 hover:text-white'}`}
                        >
                            <item.icon size={20} strokeWidth={2} />
                        </button>
                        {/* Tooltip for Sidebar Icons */}
                        {(item.id === 'smart_sequence' || item.id === 'sonic_studio' || item.id === 'character_library' || item.id === 'debug') && (
                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 backdrop-blur-md rounded border border-white/10 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                {item.tooltip || (item.id === 'smart_sequence' ? '智能多帧' : item.id === 'debug' ? 'API日志调试' : '音频中心')}
                            </div>
                        )}
                    </div>
                ))}
                
                {/* Spacer & Settings */}
                <div className="w-8 h-px bg-white/10 my-1"></div>
                
                <button 
                    onClick={onOpenSettings}
                    className="relative group w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 hover:bg-white/10 text-slate-300 hover:text-white"
                >
                    <Settings size={20} strokeWidth={2} />
                </button>

            </div>

            {/* Slide-out Panels */}
            <div 
                className={`fixed left-24 top-1/2 -translate-y-1/2 max-h-[75vh] h-auto w-72 bg-[#1c1c1e]/85 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-500 ease-[${SPRING}] z-40 flex flex-col overflow-hidden ${activePanel ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0 pointer-events-none scale-95'}`}
                onMouseEnter={handlePanelEnter}
                onMouseLeave={handlePanelLeave}
                onMouseDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
            >
                {activePanel && renderPanelContent()}
            </div>

            {/* Global Context Menu (Rendered outside the transformed panel to fix positioning) */}
            {contextMenu && (
                <div 
                    className="fixed z-[100] bg-[#2c2c2e] border border-white/10 rounded-lg shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200 min-w-[120px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onMouseDown={e => e.stopPropagation()}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    {contextMenu.type === 'history' && (
                         <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 rounded-md flex items-center gap-2" onClick={() => { onDeleteAsset(contextMenu.id); setContextMenu(null); }}>
                             <Trash2 size={12} /> 删除
                         </button>
                    )}
                    {contextMenu.type === 'workflow' && (
                        <>
                            <button className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-md flex items-center gap-2" onClick={() => { setEditingWorkflowId(contextMenu.id); setContextMenu(null); }}>
                                <Edit size={12} /> 重命名
                            </button>
                            <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 rounded-md flex items-center gap-2" onClick={() => { onDeleteWorkflow(contextMenu.id); setContextMenu(null); }}>
                                <Trash2 size={12} /> 删除
                            </button>
                        </>
                    )}
                </div>
            )}
        </>
    );
};