/**
 * AIYOU 漫剧生成平台 - 视频编辑器组件
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Play, Pause, Scissors, Download, Trash2, Plus, Film } from 'lucide-react';

// ==================== 类型定义 ====================

export interface VideoSource {
  id: string;
  url: string;
  name: string;
  duration?: number;
  sourceNodeId?: string;
}

export interface TimelineClip {
  id: string;
  sourceId: string;
  startTime: number; // 在时间轴上的开始时间（秒）
  duration: number; // 显示时长（秒）
  sourceStart: number; // 在源视频中的开始时间（秒）
  trimStart: number; // 裁剪开始时间（秒）
  trimEnd: number; // 裁剪结束时间（秒）
}

interface VideoEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialVideos: VideoSource[];
  onExport?: (outputUrl: string) => void;
}

// ==================== 主组件 ====================

export const VideoEditor: React.FC<VideoEditorProps> = ({
  isOpen,
  onClose,
  initialVideos = [],
  onExport
}) => {
  // 移除调试日志，避免控制台刷屏
  // console.log('[VideoEditor] Render, isOpen:', isOpen, 'initialVideos:', initialVideos.length);

  // ==================== 状态管理 ====================

  const [videos, setVideos] = useState<VideoSource[]>(initialVideos);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  // ==================== 初始化 ====================

  // 更新视频列表
  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  // 初始化时间轴
  useEffect(() => {
    if (isOpen && initialVideos.length > 0) {
      // 将初始视频添加到时间轴
      let offsetTime = 0;
      const initialClips: TimelineClip[] = initialVideos.map((video, index) => {
        const clipDuration = video.duration || 5;
        const clip: TimelineClip = {
          id: `clip-${Date.now()}-${index}`,
          sourceId: video.id,
          startTime: offsetTime,
          duration: clipDuration,
          sourceStart: 0,
          trimStart: 0,
          trimEnd: clipDuration
        };
        offsetTime += clipDuration;
        return clip;
      });

      setClips(initialClips);
      setDuration(offsetTime);
    } else if (isOpen && initialVideos.length === 0) {
      setClips([]);
      setDuration(0);
    }
  }, [isOpen, initialVideos]);

  // ==================== 播放控制 ====================

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && isPlaying) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // 播放结束
      if (time >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }

      animationFrameRef.current = requestAnimationFrame(handleTimeUpdate);
    }
  }, [isPlaying, duration]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(handleTimeUpdate);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, handleTimeUpdate]);

  // ==================== 拖拽功能 ====================

  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    e.dataTransfer.setData('clipId', clipId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetClipId?: string) => {
    e.preventDefault();
    const clipId = e.dataTransfer.getData('clipId');
    if (!clipId || clipId === targetClipId) return;

    setClips(prev => {
      const clipIndex = prev.findIndex(c => c.id === clipId);
      const targetIndex = targetClipId
        ? prev.findIndex(c => c.id === targetClipId)
        : prev.length - 1;

      if (clipIndex === -1 || targetIndex === -1) return prev;

      const newClips = [...prev];
      const [movedClip] = newClips.splice(clipIndex, 1);
      newClips.splice(targetIndex, 0, movedClip);

      // 重新计算时间
      let timeOffset = 0;
      return newClips.map(clip => ({
        ...clip,
        startTime: timeOffset,
        sourceStart: timeOffset
      }));
      timeOffset += clip.duration;
    });
  };

  // ==================== 裁剪功能 ====================

  const handleTrim = (clipId: string, trimStart: number, trimEnd: number) => {
    setClips(prev => prev.map(clip => {
      if (clip.id === clipId) {
        const newDuration = trimEnd - trimStart;
        return {
          ...clip,
          trimStart,
          trimEnd,
          duration: newDuration
        };
      }
      return clip;
    }));

    // 重新计算总时长和后续片段位置
    setClips(prev => {
      let offsetTime = 0;
      return prev.map(clip => {
        const updatedClip = { ...clip, startTime: offsetTime };
        offsetTime += clip.duration;
        return updatedClip;
      });
    });

    setDuration(prev => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return prev;
      return prev - (clip.duration - (trimEnd - trimStart));
    });
  };

  // ==================== 删除片段 ====================

  const handleDeleteClip = (clipId: string) => {
    setClips(prev => {
      const newClips = prev.filter(c => c.id !== clipId);
      let offsetTime = 0;
      return newClips.map(clip => {
        const updatedClip = { ...clip, startTime: offsetTime };
        offsetTime += clip.duration;
        return updatedClip;
      });
    });

    const deletedClip = clips.find(c => c.id === clipId);
    if (deletedClip) {
      setDuration(prev => prev - deletedClip.duration);
    }
  };

  // ==================== 导出视频（使用 FFmpeg.wasm）====================

  const handleExport = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // 这里将集成 FFmpeg.wasm 进行视频拼接
      // 目前先创建一个模拟导出
      const totalSteps = clips.length;
      for (let i = 0; i < totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setProgress(((i + 1) / totalSteps) * 100);
      }

      // TODO: 实现 FFmpeg.wasm 拼接
      // const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      // const { fetchFile } = await import('@ffmpeg/util');

      setIsProcessing(false);

      if (onExport) {
        // 临时返回第一个视频的 URL
        const outputUrl = clips.length > 0 ? videos.find(v => v.id === clips[0].sourceId)?.url || '' : '';
        onExport(outputUrl);
      }
    } catch (error) {
      console.error('导出失败:', error);
      setIsProcessing(false);
    }
  };

  // ==================== 渲染 ====================

  if (!isOpen) return null;

  const selectedClip = clips.find(c => c.id === selectedClipId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full h-full max-h-screen flex flex-col bg-[#0a0a0a]">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f0f0f]">
          <div className="flex items-center gap-3">
            <Film className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">视频编辑器</h2>
            <span className="text-xs text-slate-500">FFmpeg.wasm</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={isProcessing || clips.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>处理中 {progress.toFixed(0)}%</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>导出视频</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧素材区 */}
          <div className="w-64 border-r border-white/10 bg-[#0f0f0f] flex flex-col">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white mb-3">素材库</h3>
              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg cursor-pointer transition-colors border border-dashed border-white/20">
                <Upload size={16} />
                <span className="text-sm">上传视频</span>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(file => {
                      const url = URL.createObjectURL(file);
                      const newVideo: VideoSource = {
                        id: `video-${Date.now()}-${Math.random()}`,
                        url,
                        name: file.name
                      };
                      setVideos(prev => [...prev, newVideo]);
                    });
                  }}
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {videos.map(video => (
                <div
                  key={video.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, video.id)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                >
                  <video
                    src={video.url}
                    className="w-full h-20 object-cover rounded mb-2"
                    preload="metadata"
                  />
                  <p className="text-xs text-slate-300 truncate">{video.name}</p>
                  <button
                    onClick={() => {
                      const videoData = videos.find(v => v.id === video.id);
                      if (!videoData) return;

                      const clipDuration = videoData.duration || 5;
                      const newClip: TimelineClip = {
                        id: `clip-${Date.now()}-${Math.random()}`,
                        sourceId: video.id,
                        startTime: duration,
                        duration: clipDuration,
                        sourceStart: 0,
                        trimStart: 0,
                        trimEnd: clipDuration
                      };

                      setClips(prev => [...prev, newClip]);
                      setDuration(prev => prev + clipDuration);
                    }}
                    className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30 transition-colors"
                  >
                    <Plus size={12} />
                    添加到时间轴
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧预览和时间轴区 */}
          <div className="flex-1 flex flex-col">
            {/* 视频预览区 */}
            <div className="flex-1 flex items-center justify-center p-4 bg-[#0a0a0a]">
              <div className="relative max-w-4xl w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                {selectedClip ? (
                  <video
                    ref={videoRef}
                    src={videos.find(v => v.id === selectedClip.sourceId)?.url}
                    className="w-full h-full object-contain"
                    onTimeUpdate={() => {
                      if (videoRef.current && !isPlaying) {
                        setCurrentTime(videoRef.current.currentTime);
                      }
                    }}
                  />
                ) : clips.length > 0 ? (
                  <video
                    ref={videoRef}
                    src={videos.find(v => v.id === clips[0].sourceId)?.url}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <Film size={48} className="mx-auto mb-2 opacity-50" />
                      <p>拖拽素材到时间轴开始编辑</p>
                    </div>
                  </div>
                )}

                {/* 播放控制 */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={togglePlay}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    >
                      {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                    </button>

                    <div className="flex-1">
                      <input
                        type="range"
                        min={0}
                        max={duration}
                        value={currentTime}
                        onChange={(e) => {
                          const time = parseFloat(e.target.value);
                          setCurrentTime(time);
                          if (videoRef.current) {
                            videoRef.current.currentTime = time;
                          }
                        }}
                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>

                    <span className="text-xs text-white/80 font-mono">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 时间轴 */}
            <div className="h-64 border-t border-white/10 bg-[#0f0f0f] flex flex-col">
              {/* 时间轴标尺 */}
              <div className="h-6 border-b border-white/10 px-2 flex items-center">
                {Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => (
                  <div key={i} className="flex-1 text-xs text-slate-500 font-mono">
                    {formatTime(i * 5)}
                  </div>
                ))}
              </div>

              {/* 视频轨道 */}
              <div
                ref={timelineRef}
                className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar p-2"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e)}
              >
                <div className="relative h-16" style={{ width: `${Math.max(duration * 50, 800)}px` }}>
                  {/* 轨道背景 */}
                  <div className="absolute inset-0 bg-white/5 rounded" />

                  {/* 片段 */}
                  {clips.map(clip => {
                    const video = videos.find(v => v.id === clip.sourceId);
                    return (
                      <div
                        key={clip.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, clip.id)}
                        onClick={() => setSelectedClipId(clip.id)}
                        className={`absolute top-1 bottom-1 rounded cursor-pointer border-2 transition-all ${
                          selectedClipId === clip.id
                            ? 'border-cyan-400 shadow-lg shadow-cyan-400/20'
                            : 'border-white/20 hover:border-white/40'
                        }`}
                        style={{
                          left: `${clip.startTime * 50}px`,
                          width: `${clip.duration * 50}px`
                        }}
                      >
                        {/* 片段内容 */}
                        <div className="h-full flex items-center px-2">
                          <video
                            src={video?.url}
                            className="h-full rounded"
                            preload="metadata"
                          />
                          <div className="ml-2 flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{video?.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {formatTime(clip.trimStart)} - {formatTime(clip.trimEnd)}
                            </p>
                          </div>

                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClip(clip.id);
                            }}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* 裁剪手柄 */}
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-cyan-400/30 rounded-l" />
                        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-cyan-400/30 rounded-r" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 工具栏 */}
              <div className="h-10 border-t border-white/10 px-4 flex items-center gap-2">
                <button className="flex items-center gap-1 px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
                  <Scissors size={14} />
                  裁剪
                </button>
                <span className="text-xs text-slate-600">|</span>
                <span className="text-xs text-slate-500">
                  共 {clips.length} 个片段 · 总时长 {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== 工具函数 ====================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
