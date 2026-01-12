
import React, { useMemo } from 'react';
import { X, User, Image as ImageIcon, AlignLeft, Shield, Heart, Zap, Target, RefreshCw, Loader2 } from 'lucide-react';
import { CharacterProfile, AppNode } from '../types';

interface CharacterDetailModalProps {
    character: CharacterProfile | null;
    nodeId?: string;
    allNodes?: AppNode[];
    onClose: () => void;
    onGenerateExpression?: (nodeId: string, charName: string) => void;
    onGenerateThreeView?: (nodeId: string, charName: string) => void;
}

export const CharacterDetailModal: React.FC<CharacterDetailModalProps> = ({
    character,
    nodeId,
    allNodes,
    onClose,
    onGenerateExpression,
    onGenerateThreeView
}) => {
    // Get latest character data from allNodes
    const latestCharacter = useMemo(() => {
        if (!character || !nodeId || !allNodes) {
            console.log('[CharacterDetailModal] useMemo: Missing props', { hasCharacter: !!character, hasNodeId: !!nodeId, hasAllNodes: !!allNodes });
            return character;
        }

        const node = allNodes.find(n => n.id === nodeId);
        if (!node) {
            console.log('[CharacterDetailModal] useMemo: Node not found', { nodeId });
            return character;
        }

        const generatedChars = node.data.generatedCharacters || [];
        const updated = generatedChars.find(c => c.name === character.name);

        console.log('[CharacterDetailModal] useMemo: Data update', {
            characterName: character.name,
            totalGenerated: generatedChars.length,
            foundUpdated: !!updated,
            hasExpressionSheet: updated?.expressionSheet,
            hasThreeViewSheet: updated?.threeViewSheet,
            isGeneratingExpression: updated?.isGeneratingExpression,
            isGeneratingThreeView: updated?.isGeneratingThreeView,
            expressionLength: updated?.expressionSheet?.length || 0,
            threeViewLength: updated?.threeViewSheet?.length || 0
        });

        return updated || character;
    }, [character, nodeId, allNodes]);

    if (!latestCharacter) return null;

    const isGeneratingExpression = (latestCharacter as any).isGeneratingExpression;
    const isGeneratingThreeView = (latestCharacter as any).isGeneratingThreeView;

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-[900px] max-h-[85vh] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Left Column: Visuals */}
                <div className="w-1/2 bg-black/30 border-r border-white/5 flex flex-col overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-6">
                        {/* 9-Grid Expressions - Only for main characters */}
                        {latestCharacter.roleType !== 'supporting' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                        <ImageIcon size={14} /> 九宫格表情 (Expression Sheet)
                                    </div>
                                    {nodeId && onGenerateExpression && (
                                        <button
                                            onClick={() => onGenerateExpression(nodeId, latestCharacter.name)}
                                            disabled={isGeneratingExpression}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg transition-all"
                                        >
                                            {isGeneratingExpression ? (
                                                <>
                                                    <Loader2 size={12} className="animate-spin" />
                                                    <span>生成中...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw size={12} />
                                                    <span>{latestCharacter.expressionSheet ? '重新生成' : '生成'}</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <div className="aspect-square w-full bg-black rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                    {latestCharacter.expressionSheet ? (
                                        <img src={latestCharacter.expressionSheet} className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                                            {isGeneratingExpression ? '生成中...' : '点击右上角按钮生成表情图'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 3-View */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <User size={14} /> 三视图 (Three-View)
                                </div>
                                {nodeId && onGenerateThreeView && (
                                    <button
                                        onClick={() => onGenerateThreeView(nodeId, latestCharacter.name)}
                                        disabled={isGeneratingThreeView || !latestCharacter.expressionSheet}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-all"
                                    >
                                        {isGeneratingThreeView ? (
                                            <>
                                                <Loader2 size={12} className="animate-spin" />
                                                <span>生成中...</span>
                                            </>
                                        ) : !latestCharacter.expressionSheet ? (
                                            <>
                                                <RefreshCw size={12} />
                                                <span>需先生成九宫格</span>
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw size={12} />
                                                <span>{latestCharacter.threeViewSheet ? '重新生成' : '生成'}</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                            <div className="aspect-[3/4] w-full bg-black rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                {latestCharacter.threeViewSheet ? (
                                    <img src={latestCharacter.threeViewSheet} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs p-10 text-center">
                                        {isGeneratingThreeView ? '生成中...' : '点击右上角按钮生成三视图'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Info */}
                <div className="w-1/2 flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{latestCharacter.name}</h2>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-[10px] font-bold rounded-md border border-orange-500/30">
                                    {latestCharacter.profession}
                                </span>
                                {latestCharacter.alias && (
                                    <span className="px-2 py-1 bg-white/10 text-slate-300 text-[10px] rounded-md">
                                        别名: {latestCharacter.alias}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                <User size={12} /> 基础设定
                            </h3>
                            <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                                {latestCharacter.basicStats}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                <AlignLeft size={12} /> 性格特征
                            </h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                {latestCharacter.personality}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                    <Target size={12} /> 核心动机
                                </h3>
                                <p className="text-xs text-slate-400 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                                    {latestCharacter.motivation || 'N/A'}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                    <Shield size={12} /> 弱点/恐惧
                                </h3>
                                <p className="text-xs text-slate-400 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                                    {latestCharacter.weakness || 'N/A'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-pink-400 uppercase tracking-widest flex items-center gap-2">
                                <Heart size={12} /> 核心关系
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {latestCharacter.relationships || 'N/A'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                <Zap size={12} /> 习惯与兴趣
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {latestCharacter.habits} {latestCharacter.interests ? ` • ${latestCharacter.interests}` : ''}
                            </p>
                        </div>

                        {/* Prompt Debug Info (Optional) */}
                        <div className="pt-4 border-t border-white/5">
                            <details className="group">
                                <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-400 list-none flex items-center gap-1">
                                    <span>查看生成提示词 (Prompt)</span>
                                </summary>
                                <p className="mt-2 text-[10px] text-slate-600 font-mono bg-black/40 p-2 rounded select-all">
                                    {latestCharacter.appearance}
                                </p>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
