
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
}

export enum NodeStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export type VideoGenerationMode = 'DEFAULT' | 'CONTINUE' | 'CUT' | 'FIRST_LAST_FRAME' | 'CHARACTER_REF';

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
    // Status tracking
    status?: 'IDLE' | 'GENERATING' | 'SUCCESS' | 'ERROR';
    error?: string;
    isSaved?: boolean;
    // Generation flags
    isGeneratingExpression?: boolean;
    isGeneratingThreeView?: boolean;
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
    storyboardGridType?: '9' | '6'; // Grid layout type: 9-panel (3x3) or 6-panel (2x3)
    storyboardPanelOrientation?: '16:9' | '9:16'; // Panel orientation: landscape or portrait
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

export interface SoraTaskGroup {
  id: string;
  taskNumber: number;
  totalDuration: number; // 总时长（秒）
  shotIds: string[]; // 包含的分镜ID
  splitShots: SplitStoryboardShot[]; // 分镜数据

  // Sora 模型
  soraModelId?: string; // Sora 模型 ID

  // Sora 提示词
  soraPrompt: string;
  promptGenerated: boolean;
  promptModified?: boolean; // 用户是否修改过提示词

  // 参考图
  referenceImage?: string; // 拼接后的参考图URL或Base64
  imageFused: boolean;

  // 视频生成状态
  generationStatus: 'idle' | 'prompt_ready' | 'image_fused' | 'uploading' | 'generating' | 'completed' | 'failed';
  soraTaskId?: string;
  progress?: number; // 0-100
  videoFilePath?: string; // 本地视频文件路径
  videoMetadata?: {
    duration: number;
    resolution: string;
    fileSize: number;
    createdAt: Date;
  };
  error?: string;
}

export interface SoraStorageConfig {
  apiKey?: string;
}

export interface OSSConfig {
  provider: 'tencent' | 'aliyun';
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

// Window interface for Google AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}