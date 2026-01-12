/**
 * 本地存储服务类型定义
 */

/**
 * 节点类型到文件夹名称的映射
 */
export const NODE_TYPE_FOLDERS: Record<string, string> = {
  IMAGE_GENERATOR: 'IMAGE_GENERATOR',
  VIDEO_GENERATOR: 'VIDEO_GENERATOR',
  AUDIO_GENERATOR: 'AUDIO_GENERATOR',
  STORYBOARD_IMAGE: 'STORYBOARD_IMAGE',
  STORYBOARD_SPLITTER: 'STORYBOARD_SPLITTER',
  STORYBOARD_GENERATOR: 'STORYBOARD_GENERATOR',
  CHARACTER_NODE: 'CHARACTER_NODE',
  SCRIPT_PLANNER: 'SCRIPT_PLANNER',
  SCRIPT_EPISODE: 'SCRIPT_EPISODE',
  DRAMA_ANALYZER: 'DRAMA_ANALYZER',
  DRAMA_REFINED: 'DRAMMA_REFINED',
  VIDEO_ANALYZER: 'VIDEO_ANALYZER',
  IMAGE_EDITOR: 'IMAGE_EDITOR',
  STYLE_PRESET: 'STYLE_PRESET',
  PROMPT_INPUT: 'PROMPT_INPUT',
};

/**
 * 存储配置
 */
export interface StorageConfig {
  // 根目录句柄
  rootDirectoryHandle: FileSystemDirectoryHandle | null;
  // 根目录路径（用于显示）
  rootPath: string;
  // 是否启用本地存储
  enabled: boolean;
  // 自动保存
  autoSave: boolean;
  // 最后更新时间
  lastUpdated?: string;
}

/**
 * 文件元数据
 */
export interface FileMetadata {
  // 文件唯一ID
  id: string;
  // 所属工作区
  workspaceId: string;
  // 所属节点
  nodeId: string;
  // 节点类型
  nodeType: string;
  // 文件类型
  fileType: 'image' | 'video' | 'audio' | 'zip' | 'other';
  // 文件名
  fileName: string;
  // 相对路径（相对于根目录）
  relativePath: string;
  // 文件大小
  size: number;
  // 创建时间
  createdAt: string;
  // MIME 类型
  mimeType?: string;
}

/**
 * 保存选项
 */
export interface SaveOptions {
  // 是否自动重命名（如果文件存在）
  autoRename?: boolean;
  // 是否更新元数据
  updateMetadata?: boolean;
  // 是否覆盖已存在文件
  overwrite?: boolean;
  // 文件名前缀（用于特殊命名）
  prefix?: string;
  // 自定义文件名（覆盖自动生成的文件名）
  customFileName?: string;
}

/**
 * 文件保存结果
 */
export interface SaveResult {
  // 是否成功
  success: boolean;
  // 文件相对路径
  relativePath: string;
  // 文件元数据
  metadata: FileMetadata;
  // 错误信息（如果失败）
  error?: string;
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  // 总文件数
  totalFiles: number;
  // 总大小（字节）
  totalSize: number;
  // 按类型统计
  byType: Record<string, {
    count: number;
    size: number;
  }>;
  // 按节点统计
  byNode: Record<string, number>;
}

/**
 * 工作区信息
 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  createdAt: string;
  fileCount: number;
  totalSize: number;
}

/**
 * 特殊文件名类型
 */
export type SpecialFileNameType =
  | 'storyboard-grid'     // 分镜图网格
  | 'character'           // 角色图
  | 'split-shot'          // 拆解的分镜
  | 'export-zip'          // 导出的ZIP
  | 'thumbnail';          // 缩略图

/**
 * 特殊文件名参数
 */
export interface SpecialFileNameParams {
  // 分镜图参数
  storyboard?: {
    page: number;
  };
  // 角色图参数
  character?: {
    name: string;
    view: 'three-view' | 'expression' | 'scene';
  };
  // 拆解分镜参数
  splitShot?: {
    shotNumber: number;
  };
  // 导出ZIP参数
  export?: {
    timestamp: number;
  };
}
