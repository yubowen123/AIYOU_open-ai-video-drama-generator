/**
 * AIYOU 漫剧生成平台 - 类型定义
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 * @license MIT
 */

// ============================================================
// LLM & 图片生成 API 提供商相关类型
// ============================================================

/**
 * LLM/图片生成 API 提供商类型
 * - gemini: Google 官方 Gemini API
 * - yunwu: 云雾 API（第三方代理）
 */
export type LLMProviderType = 'gemini' | 'yunwu';

/**
 * LLM API 配置接口
 */
export interface LLMProviderConfig {
  provider: LLMProviderType;
  geminiApiKey?: string;
  yunwuApiKey?: string;
}

export enum NodeType {
  PROMPT_INPUT = 'PROMPT_INPUT',
  IMAGE_GENERATOR = 'IMAGE_GENERATOR',
  VIDEO_GENERATOR = 'VIDEO_GENERATOR',
  VIDEO_ANALYZER = 'VIDEO_ANALYZER',
  IMAGE_EDITOR = 'IMAGE_EDITOR',
  AUDIO_GENERATOR = 'AUDIO_GENERATOR',
  SCRIPT_PLANNER = 'SCRIPT_PLANNER',
  SCRIPT_EPISODE = 'SCRIPT_EPISODE',
  STORYBOARD_GENERATOR = 'STORYBOARD_GENERATOR',
  STORYBOARD_IMAGE = 'STORYBOARD_IMAGE',
  STORYBOARD_SPLITTER = 'STORYBOARD_SPLITTER',
  CHARACTER_NODE = 'CHARACTER_NODE',
  DRAMA_ANALYZER = 'DRAMA_ANALYZER',
  DRAMA_REFINED = 'DRAMA_REFINED',
  STYLE_PRESET = 'STYLE_PRESET',
  SORA_VIDEO_GENERATOR = 'SORA_VIDEO_GENERATOR',
  SORA_VIDEO_CHILD = 'SORA_VIDEO_CHILD',
  STORYBOARD_VIDEO_GENERATOR = 'STORYBOARD_VIDEO_GENERATOR',
  STORYBOARD_VIDEO_CHILD = 'STORYBOARD_VIDEO_CHILD',
  VIDEO_EDITOR = 'VIDEO_EDITOR',
}

export enum NodeStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export type VideoGenerationMode = 'DEFAULT' | 'CONTINUE' | 'CUT' | 'FIRST_LAST_FRAME' | 'CHARACTER_REF';

// Storyboard grid types
export type StoryboardGridType = '6' | '9' | '16' | '25';

// Storyboard resolution types
export type StoryboardResolution = '1k' | '2k' | '4k';

// Grid configuration
export interface GridConfig {
  gridType: StoryboardGridType;
  shotsPerGrid: number;
  gridLayout: '2x3' | '3x3' | '4x4' | '5x5';
  cols: number;
  rows: number;
}

export interface StoryboardShot {
    id: string;
    subject: string;
    scene: string;
    camera: string;
    lighting: string;
    dynamics: string;
    audio: string;
    style: string;
    negative: string;
    imageUrl?: string; // Generated image
    duration?: number;
    visualDescription?: string;
}

// New detailed storyboard shot for episode breakdown
export interface DetailedStoryboardShot {
    id: string;
    shotNumber: number;
    duration: number; // 3-5 seconds

    // Basic info
    scene: string;
    characters: string[];

    // Camera info - 使用标准影视术语
    shotSize: string; // 景别：大远景/远景/全景/中景/中近景/近景/特写/大特写
    cameraAngle: string; // 拍摄角度：视平/高位俯拍/低位仰拍/斜拍/越肩/鸟瞰
    cameraMovement: string; // 运镜方式：固定/横移/俯仰/横摇/升降/轨道推拉/变焦推拉/正跟随/倒跟随/环绕/滑轨横移

    // Content
    visualDescription: string;
    dialogue: string;

    // Effects
    visualEffects: string;
    audioEffects: string;

    // Timeline
    startTime: number;
    endTime: number;
}

export interface EpisodeStoryboard {
    episodeTitle: string;
    totalDuration: number; // seconds
    totalShots: number;
    shots: DetailedStoryboardShot[];
    visualStyle: string;
}

// Split storyboard shot with image and detailed description
export interface SplitStoryboardShot {
    id: string;
    shotNumber: number;
    sourceNodeId: string; // Which STORYBOARD_IMAGE node this came from
    sourcePage: number; // Which page this came from (0-based)
    panelIndex: number; // Which panel in the grid (0-8 for 9-grid, 0-5 for 6-grid)
    splitImage: string; // Base64 of the split individual panel image

    // Resolution metadata
    sourceResolution?: StoryboardResolution; // Source image resolution
    sourceDimensions?: { width: number; height: number }; // Source image dimensions
    splitDimensions?: { width: number; height: number }; // Split panel dimensions

    // From DetailedStoryboardShot - 使用标准影视术语
    scene: string;
    characters: string[];
    shotSize: string; // 景别：大远景/远景/全景/中景/中近景/近景/特写/大特写
    cameraAngle: string; // 拍摄角度：视平/高位俯拍/低位仰拍/斜拍/越肩/鸟瞰
    cameraMovement: string; // 运镜方式：固定/横移/俯仰/横摇/升降/轨道推拉/变焦推拉/正跟随/倒跟随/环绕/滑轨横移
    visualDescription: string;
    dialogue: string;
    visualEffects: string;
    audioEffects: string;
    startTime: number;
    endTime: number;
    duration: number;
}

export interface CharacterProfile {
    id: string;
    name: string;
    alias?: string;
    roleType?: 'main' | 'supporting'; // 主角 or 配角
    basicStats?: string; // 26岁, 女...
    profession?: string;
    appearance?: string; // Prompt used for generation
    personality?: string;
    motivation?: string;
    values?: string;
    weakness?: string;
    relationships?: string;
    habits?: string;
    interests?: string;
    expressionSheet?: string; // Base64 of 9-grid
    threeViewSheet?: string; // Base64 of 3-view
    rawProfileData?: any; // The full JSON object from LLM
    // Stored prompts for regeneration
    expressionPromptZh?: string;
    expressionPromptEn?: string;
    threeViewPromptZh?: string;
    threeViewPromptEn?: string;
    // Status tracking
    status?: 'IDLE' | 'GENERATING' | 'SUCCESS' | 'ERROR';
    error?: string;
    isSaved?: boolean;
    // Individual task statuses
    profileStatus?: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';
    expressionStatus?: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';
    threeViewStatus?: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';
    // Generation flags
    isGeneratingExpression?: boolean;
    isGeneratingThreeView?: boolean;
    // Individual task errors
    expressionError?: string;
    threeViewError?: string;
}

export interface AppNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width?: number; // Custom width
  height?: number; // Custom height
  title: string;
  status: NodeStatus;
  data: {
    prompt?: string;
    model?: string; // Selected AI model
    image?: string; // Base64 (The currently displayed main image)
    images?: string[]; // Array of Base64 strings (for multiple generations)
    imageCount?: number; // Number of images to generate (1-4)
    videoCount?: number; // Number of videos to generate (1-4)
    videoUri?: string; // URL
    videoUris?: string[]; // Array of URLs (for multiple video generations)
    videoMetadata?: any; // Stores the raw Video object from Gemini API for extension
    audioUri?: string; // Base64 or Blob URL for Audio Node
    analysis?: string; // Video analysis result
    error?: string;
    progress?: string;
    aspectRatio?: string; // e.g., '16:9', '4:3'
    resolution?: string; // e.g., '1080p', '4k'
    duration?: number; // Duration in seconds (for Audio/Video)
    
    // Script Planner Specifics
    scriptTheme?: string;
    scriptGenre?: string;
    scriptSetting?: string;
    scriptVisualStyle?: 'REAL' | 'ANIME' | '3D'; // New Style Field
    scriptEpisodes?: number; // 5-50
    scriptDuration?: number; // 1-5 mins
    scriptOutline?: string; // The generated text output

    // Script Episode Specifics
    selectedChapter?: string; // The chapter string from outline
    episodeSplitCount?: number; // 1-10
    episodeModificationSuggestion?: string; // User's modification suggestions for regeneration
    generatedEpisodes?: { title: string, content: string, characters: string }[]; // Store generated episodes for downstream use

    // Storyboard Generator Specifics
    storyboardCount?: number; // 5-20
    storyboardDuration?: number; // 2-10s
    storyboardStyle?: 'REAL' | 'ANIME' | '3D'; // Style selection
    storyboardShots?: StoryboardShot[];

    // Character Node Specifics
    extractedCharacterNames?: string[]; // List of names found in script
    characterConfigs?: Record<string, {
        method: 'AI_AUTO' | 'AI_CUSTOM' | 'LIBRARY';
        customPrompt?: string;
        libraryId?: string;
    }>;
    generatedCharacters?: CharacterProfile[];

    // Video Strategies (StoryContinuator, SceneDirector, FrameWeaver, CharacterRef)
    generationMode?: VideoGenerationMode; 
    selectedFrame?: string; // Base64 of the specific frame captured from video (Raw)
    croppedFrame?: string; // Base64 of the cropped/edited frame (Final Input)
    
    // Input Management
    sortedInputIds?: string[]; // Order of input nodes for multi-image composition

    // Episode Storyboard (for PROMPT_INPUT nodes that are episode scripts)
    episodeStoryboard?: EpisodeStoryboard; // Detailed storyboard breakdown

    // Storyboard Image Grid (for STORYBOARD_IMAGE nodes)
    storyboardGridImages?: string[]; // Array of grid images (supports multiple pages)
    storyboardGridImage?: string; // Deprecated: use storyboardGridImages instead (kept for backward compatibility)
    storyboardGridType?: StoryboardGridType; // Grid layout type: 6-panel (2x3), 9-panel (3x3), 16-panel (4x4), 25-panel (5x5)
    storyboardPanelOrientation?: '16:9' | '9:16'; // Panel orientation: landscape or portrait
    storyboardResolution?: StoryboardResolution; // Resolution: 1k, 2k, 4k
    storyboardCurrentPage?: number; // Current page index (0-based)
    storyboardTotalPages?: number; // Total number of pages

    // Storyboard Splitter Specifics
    selectedSourceNodes?: string[]; // IDs of selected STORYBOARD_IMAGE nodes to split
    splitShots?: SplitStoryboardShot[]; // Array of all split shots with images and descriptions
    isSplitting?: boolean; // Whether currently splitting images

    // Drama Analyzer Specifics
    dramaName?: string; // 剧名
    dramaIntroduction?: string; // 剧介绍（AI 检索的结果）
    worldview?: string; // 世界观
    logicalConsistency?: string; // 逻辑自洽性
    extensibility?: string; // 延展性
    characterTags?: string; // 角色标签
    protagonistArc?: string; // 主角弧光
    audienceResonance?: string; // 受众共鸣点
    artStyle?: string; // 画风
    selectedFields?: string[]; // 选中要传递的字段

    // Sora Child Node Specifics
    parentId?: string; // 父节点ID (用于从父节点获取currentTaskId)
    provider?: 'yunwu' | 'sutu' | 'yijiapi' | 'kie' | 'dayuapi'; // Sora提供商
    soraTaskId?: string; // 任务ID (已弃用，保留用于兼容性)
    taskGroupId?: string; // 任务组ID
    taskNumber?: number; // 任务组编号
    soraPrompt?: string; // Sora提示词
    videoUrlWatermarked?: string; // 带水印的视频URL
    isCompliant?: boolean; // 是否合规
    violationReason?: string; // 违规原因
    locallySaved?: boolean; // 是否已本地保存

    // Sora Video Generator Specifics
    taskGroups?: SoraTaskGroup[]; // Sora 任务组列表
    sora2Config?: Sora2UserConfig; // Sora2 全局配置
    currentTaskId?: string; // 当前任务ID

    // Drama Refined Specifics
    refinedContent?: string; // 精炼后的剧本内容

    // Style Preset Specifics
    stylePrompt?: string; // 风格预设提示词

    // Audio Generator Extended
    referenceAudio?: string; // 参考音频
    persona?: string; // 音色/角色
    emotion?: string; // 情感

    // Image Generator Extended
    negativePrompt?: string; // 反向提示词
    inputImages?: string[]; // 输入图片列表

    // Video Generation Extended
    videoUrl?: string; // 视频URL（videoUri 别名）

    // Storyboard Video Child Specifics
    platformInfo?: {
      platformCode: string;
      modelName: string;
    };
    modelConfig?: {
      aspect_ratio: string;
      duration: string;
      quality: string;
    };
    promptExpanded?: boolean; // 提示词展开状态

    // Generic
    outputKey?: string; // 输出键名

    // Storyboard Video Generator (inline from StoryboardVideoGeneratorData)
    availableShots?: SplitStoryboardShot[];
    selectedShotIds?: string[];
    selectedShotIndex?: number;
    characterData?: Array<any>;
    generatedPrompt?: string;
    promptModified?: boolean;
    selectedPlatform?: string;
    selectedModel?: string;
    subModel?: string;
    enableImageFusion?: boolean;
    fusionLayout?: 'grid' | 'horizontal' | 'vertical';
    fusionColumns?: number;
    includeCharacterViews?: boolean;
    fusedImage?: string;
    fusedImageUrl?: string;
    isLoadingFusion?: boolean;
    childNodeIds?: string[];

    // Video child extended
    videoDuration?: number;
    videoResolution?: string;
    quality?: string;

    // Style Preset Extended
    styleUserInput?: string;
    stylePresetType?: string;
    storyboardRegeneratePanel?: boolean;

    // Status/loading
    isLoading?: boolean;
    isCached?: boolean;
    cacheLocation?: string;
    isRemovingSensitiveWords?: boolean;

    // Character extended
    characterName?: string;

    // Misc runtime fields
    imageUrl?: string;
    count?: number;
    shotCount?: number;
    visualStyle?: string;
    taskId?: string;
  };
  inputs: string[]; // IDs of nodes this node connects FROM
}

export interface Group {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}

export interface Connection {
  id?: string;
  from: string;
  to: string;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  id?: string;
}

export interface Workflow {
  id: string;
  title: string;
  thumbnail: string;
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
}

// New Smart Sequence Types
export interface SmartSequenceItem {
    id: string;
    src: string; // Base64 or URL
    transition: {
        duration: number; // 1-6s
        prompt: string;
    };
}

// Sora 2 Video Generator Types
export interface SoraModel {
  id: string;
  name: string;
  duration: number; // 秒
  aspectRatio: '16:9' | '9:16';
  resolution: string;
  description: string;
  price: number; // 价格（元）
  endpointType: 'openai-video' | 'openai'; // 端点类型
  provider: string; // 供应商
  billingType: string; // 计费类型
  tags: string[]; // 标签
}

// Sora2 用户可配置项
export interface Sora2UserConfig {
  aspect_ratio: '16:9' | '9:16';
  duration: '10' | '15' | '25';
  hd: boolean;
}

export interface SoraTaskGroup {
  id: string;
  taskNumber: number;
  totalDuration: number; // 总时长（秒）
  shotIds: string[]; // 包含的分镜ID
  splitShots: SplitStoryboardShot[]; // 分镜数据

  // Sora 模型
  soraModelId?: string; // Sora 模型 ID

  // Sora2 用户配置
  sora2Config?: Sora2UserConfig;

  // Sora 提示词
  soraPrompt: string;
  promptGenerated: boolean;
  promptModified?: boolean; // 用户是否修改过提示词

  // 参考图
  referenceImage?: string; // 拼接后的参考图URL或Base64
  imageFused: boolean;

  // API提供商
  provider?: 'yunwu' | 'sutu' | 'yijiapi' | 'kie' | 'dayuapi'; // Sora提供商

  // 视频生成状态
  generationStatus: 'idle' | 'prompt_ready' | 'image_fused' | 'uploading' | 'generating' | 'completed' | 'failed';
  soraTaskId?: string;
  progress?: number; // 0-100
  videoUrl?: string; // 视频URL
  videoUrlWatermarked?: string; // 带水印的视频URL
  videoFilePath?: string; // 本地视频文件路径
  videoMetadata?: {
    duration: number;
    resolution: string;
    fileSize: number;
    createdAt: Date;
  };
  error?: string;

  // 敏感词处理
  isRemovingSensitiveWords?: boolean;
  removeSensitiveWordsSuccess?: boolean;
  removeSensitiveWordsError?: string;
}

export interface SoraStorageConfig {
  // 通用 API Key（向后兼容，主要用于速推 API）
  apiKey?: string;

  // API 提供商选择
  provider?: 'sutu' | 'yunwu' | 'dayuapi' | 'kie' | 'yijiapi';

  // 速推 API Key（独立字段，与 apiKey 共享值）
  sutuApiKey?: string;

  // 云雾 API Key（Sora 官方）
  yunwuApiKey?: string;

  // 大洋芋 API Key
  dayuapiApiKey?: string;

  // KIE AI API Key
  kieApiKey?: string;

  // 一加API Key
  yijiapiApiKey?: string;

  // 视频生成平台 API Keys（用于分镜视频生成节点）
  videoPlatformKeys?: {
    yunwuapi?: string;  // 云雾API平台（多模型聚合）
    // 未来可添加更多平台
    // official?: string;
    // custom?: string;
  };
}

export interface OSSConfig {
  provider: 'imgbb' | 'tencent' | 'aliyun';
  // ImgBB 专用
  imgbbApiKey?: string;
  imgbbExpiration?: number;  // 过期时间(秒)，0=永久
  // 腾讯云/阿里云 专用
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

// ============================================================
// 分镜视频生成节点相关类型
// ============================================================

/**
 * 分镜视频生成节点的数据结构
 */
export interface StoryboardVideoGeneratorData {
  // 状态管理
  status: 'idle' | 'selecting' | 'prompting' | 'generating' | 'completed';

  // 分镜数据
  availableShots: SplitStoryboardShot[];
  selectedShotIds: string[];

  // 角色数据（可选）
  characterData?: Array<any>;

  // 提示词
  generatedPrompt: string;
  promptModified: boolean;

  // 平台和模型配置
  selectedPlatform?: 'yunwuapi' | 'official' | 'custom';  // 默认yunwuapi
  selectedModel?: 'veo' | 'luma' | 'runway' | 'minimax' | 'volcengine' | 'grok' | 'qwen' | 'sora';
  subModel?: string;  // 子模型，例如 veo3.1-fast, ray-v2, sora-2 等
  modelConfig: {
    aspect_ratio: '16:9' | '9:16';
    duration: '5' | '10' | '15' | '25';
    quality: 'standard' | 'pro' | 'hd';
  };

  // 图片融合
  enableImageFusion: boolean;
  fusionLayout: 'grid' | 'horizontal' | 'vertical';
  fusionColumns: number;
  includeCharacterViews: boolean;
  fusedImage?: string; // Base64 data URL of the fused image
  fusedImageUrl?: string; // OSS URL after uploading
  isLoadingFusion?: boolean; // Whether image fusion is in progress

  // 生成结果
  currentTaskId?: string;
  progress?: number;
  error?: string;

  // 子节点列表
  childNodeIds: string[];
}

/**
 * 分镜视频子节点的数据结构
 */
export interface StoryboardVideoChildData {
  // 来自父节点的快照
  prompt: string;
  platformInfo: {
    platformCode: string;
    modelName: string;
  };
  modelConfig: {
    aspect_ratio: string;
    duration: string;
    quality: string;
  };

  // 生成结果
  videoUrl: string;
  videoDuration?: number;
  videoResolution?: string;

  // 可选：融合图片URL
  fusedImageUrl?: string;

  // UI状态
  promptExpanded: boolean;
}

// Window interface for Google AI Studio key selection
declare global {
  interface Window {
    aistudio?: AIStudio;
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}