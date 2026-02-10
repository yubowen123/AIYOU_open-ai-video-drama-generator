/**
 * AIYOU 漫剧生成平台 - 节点共享类型
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

import React from 'react';
import { AppNode, CharacterProfile } from '../../types';

export interface InputAsset {
    id: string;
    type: 'image' | 'video';
    src: string;
}

export interface NodeProps {
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

  // Video Editor Action
  onOpenVideoEditor?: (nodeId: string) => void;

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
    getNodesByType?: (nodeType: string) => AppNode[];
  };
  characterLibrary?: CharacterProfile[];
}

/**
 * Props passed to type-specific media content renderers.
 * These are the shared state values from NodeComponent that type-specific
 * render sections need access to.
 */
export interface NodeContentContext {
  node: AppNode;
  onUpdate: NodeProps['onUpdate'];
  onAction: NodeProps['onAction'];
  onDelete: NodeProps['onDelete'];
  onExpand?: NodeProps['onExpand'];
  onCrop?: NodeProps['onCrop'];
  onMediaContextMenu?: NodeProps['onMediaContextMenu'];
  onCharacterAction?: NodeProps['onCharacterAction'];
  onViewCharacter?: NodeProps['onViewCharacter'];
  onOpenVideoEditor?: NodeProps['onOpenVideoEditor'];
  nodeQuery?: NodeProps['nodeQuery'];
  characterLibrary?: NodeProps['characterLibrary'];
  inputAssets?: InputAsset[];

  // Shared state from NodeComponent
  isWorking: boolean;
  isActionDisabled: boolean;
  isHovered: boolean;
  localPrompt: string;
  setLocalPrompt: React.Dispatch<React.SetStateAction<string>>;
  commitPrompt: () => void;
  handleActionClick: () => void;
  handleCmdEnter: (e: React.KeyboardEvent) => void;
  mediaRef: React.MutableRefObject<HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null>;
  videoBlobUrl: string | null;
  setVideoBlobUrl: React.Dispatch<React.SetStateAction<string | null>>;
  isLoadingVideo: boolean;
  setIsLoadingVideo: React.Dispatch<React.SetStateAction<boolean>>;
  showImageGrid: boolean;
  setShowImageGrid: React.Dispatch<React.SetStateAction<boolean>>;
  isPlayingAudio: boolean;
  setIsPlayingAudio: React.Dispatch<React.SetStateAction<boolean>>;
  generationMode: string;
  isInputFocused: boolean;
  setIsInputFocused: React.Dispatch<React.SetStateAction<boolean>>;
  inputHeight: number;
  setInputHeight: React.Dispatch<React.SetStateAction<number>>;
  handleInputResizeStart: (e: React.MouseEvent) => void;
  handleExpand: (e: React.MouseEvent) => void;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleUploadVideo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAspectRatioSelect: (newRatio: string) => void;

  // Sora-specific shared state
  localSoraConfigs: Record<string, { aspect_ratio: string; duration: string; hd: boolean }>;
  setLocalSoraConfigs: React.Dispatch<React.SetStateAction<Record<string, { aspect_ratio: string; duration: string; hd: boolean }>>>;

  // Episode-specific shared state
  availableChapters: string[];
  setAvailableChapters: React.Dispatch<React.SetStateAction<string[]>>;
  viewingOutline: boolean;
  setViewingOutline: React.Dispatch<React.SetStateAction<boolean>>;
  handleRefreshChapters: () => void;

  // Dynamic model config (for STORYBOARD_VIDEO_GENERATOR)
  dynamicSubModels: Record<string, Record<string, string[]>>;
  dynamicSubModelNames: Record<string, string>;
  configLoaded: boolean;

  // Video Editor state
  showExportModal: boolean;
  setShowExportModal: React.Dispatch<React.SetStateAction<boolean>>;
  exportSettings: { name: string; resolution: string; format: string };
  setExportSettings: React.Dispatch<React.SetStateAction<{ name: string; resolution: string; format: string }>>;

  // Action processing state
  isActionProcessing: boolean;
}

/**
 * Props for bottom panel renderers
 */
export interface BottomPanelContext extends NodeContentContext {
  isOpen: boolean;
  hasInputs: boolean;
  onInputReorder?: NodeProps['onInputReorder'];
  nodeWidth: number;
  nodeHeight: number;
  isSelected?: boolean;
}
