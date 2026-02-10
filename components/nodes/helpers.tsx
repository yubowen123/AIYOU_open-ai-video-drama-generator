/**
 * AIYOU 漫剧生成平台 - 节点共享辅助组件
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ChevronDown, Copy } from 'lucide-react';
import { InputAsset } from './types';

export const SecureVideo = ({ src, className, autoPlay, muted, loop, onMouseEnter, onMouseLeave, onClick, controls, videoRef, style }: any) => {
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

export const safePlay = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
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

export const safePause = (e: React.SyntheticEvent<HTMLVideoElement> | HTMLVideoElement) => {
    const vid = (e as any).currentTarget || e;
    if (vid) {
        vid.pause();
        vid.currentTime = 0;
    }
};

export const AudioVisualizer = ({ isPlaying }: { isPlaying: boolean }) => (
    <div className="flex items-center justify-center gap-[2px] h-12 w-full opacity-60">
        {[...Array(20)].map((_, i) => (
            <div key={i} className="w-1 bg-cyan-400/80 rounded-full" style={{ height: isPlaying ? `${20 + Math.random() * 80}%` : '20%', transition: 'height 0.1s ease', animation: isPlaying ? `pulse 0.5s infinite ${i * 0.05}s` : 'none' }} />
        ))}
    </div>
);

// Episode Viewer Component - Single component to display all generated episodes
export const EpisodeViewer = ({ episodes }: { episodes: { title: string, content: string, characters: string }[] }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    return (
        <div className="w-full h-full flex flex-col bg-[#1c1c1e] relative overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2" onWheel={(e) => e.stopPropagation()}>
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

export const InputThumbnails = ({ assets, onReorder }: { assets: InputAsset[], onReorder: (newOrder: string[]) => void }) => {
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
                                transition: isItemDragging ? 'transform 0s, box-shadow 0.2s' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s',
                                zIndex,
                                boxShadow: isItemDragging ? '0 8px 25px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
                            }}
                            onMouseDown={(e) => handleMouseDown(e, asset.id)}
                        >
                            {isVideo ? (
                                <video src={asset.src} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                            ) : (
                                <img loading="lazy" src={asset.src} className="w-full h-full object-cover" alt="" draggable={false} />
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
