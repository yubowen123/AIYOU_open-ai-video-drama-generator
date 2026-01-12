
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
  CHARACTER_NODE = 'CHARACTER_NODE',
  DRAMA_ANALYZER = 'DRAMA_ANALYZER',
  DRAMA_REFINED = 'DRAMA_REFINED',
  STYLE_PRESET = 'STYLE_PRESET',
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

    // Camera info
    shotType: string;
    cameraAngle: string;
    cameraMovement: string;

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

// Window interface for Google AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}