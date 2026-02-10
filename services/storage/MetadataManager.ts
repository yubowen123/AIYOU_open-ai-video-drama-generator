/**
 * 元数据管理器
 * 管理文件索引、工作区信息和存储统计
 */

import { FileMetadata, StorageStats, WorkspaceInfo } from './types';

interface MetadataData {
  version: string;
  files: FileMetadata[];
  workspaces: Record<string, WorkspaceInfo>;
  lastUpdated: string;
}

const METADATA_FILE_NAME = '.aiyou-metadata.json';
const METADATA_VERSION = '1.0.0';

export class MetadataManager {
  private rootHandle: FileSystemDirectoryHandle;
  private metadata: MetadataData;
  private metadataFilePath: string;

  constructor(rootHandle: FileSystemDirectoryHandle) {
    this.rootHandle = rootHandle;
    this.metadataFilePath = METADATA_FILE_NAME;
    this.metadata = {
      version: METADATA_VERSION,
      files: [],
      workspaces: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 初始化元数据管理器
   * 尝试读取现有元数据，如果不存在则创建新的
   */
  async initialize(): Promise<void> {
    try {

      const fileHandle = await this.rootHandle.getFileHandle(this.metadataFilePath);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);

      // 验证版本兼容性
      if (parsed.version !== METADATA_VERSION) {
        console.warn(
          `[MetadataManager] 元数据版本不匹配: ${parsed.version} vs ${METADATA_VERSION}，将进行迁移`
        );
        // TODO: 实现版本迁移逻辑
      }

      this.metadata = parsed;
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        this.metadata = {
          version: METADATA_VERSION,
          files: [],
          workspaces: {},
          lastUpdated: new Date().toISOString(),
        };
        await this.save();
      } else {
        console.error('[MetadataManager] 读取元数据失败:', error);
        throw new Error(`元数据初始化失败: ${error.message}`);
      }
    }
  }

  /**
   * 添加文件元数据
   */
  async addFile(metadata: FileMetadata): Promise<void> {
    // 检查是否已存在
    const existingIndex = this.metadata.files.findIndex(f => f.id === metadata.id);
    if (existingIndex >= 0) {
      console.warn(`[MetadataManager] 文件已存在，将更新: ${metadata.id}`);
      this.metadata.files[existingIndex] = metadata;
    } else {
      this.metadata.files.push(metadata);
    }

    // 更新工作区信息
    await this.updateWorkspaceInfo(metadata.workspaceId, metadata);

    // 更新时间戳
    this.metadata.lastUpdated = new Date().toISOString();

    await this.save();
  }

  /**
   * 批量添加文件元数据
   */
  async addFiles(metadatas: FileMetadata[]): Promise<void> {
    for (const metadata of metadatas) {
      await this.addFile(metadata);
    }
  }

  /**
   * 移除文件元数据
   */
  async removeFile(fileId: string): Promise<void> {
    const file = this.metadata.files.find(f => f.id === fileId);
    if (!file) {
      console.warn(`[MetadataManager] 文件不存在: ${fileId}`);
      return;
    }

    this.metadata.files = this.metadata.files.filter(f => f.id !== fileId);

    // 更新工作区统计
    await this.updateWorkspaceStats(file.workspaceId);

    this.metadata.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * 通过相对路径移除文件
   */
  async removeFileByPath(relativePath: string): Promise<void> {
    const file = this.metadata.files.find(f => f.relativePath === relativePath);
    if (file) {
      await this.removeFile(file.id);
    }
  }

  /**
   * 获取文件元数据
   */
  getFile(fileId: string): FileMetadata | undefined {
    return this.metadata.files.find(f => f.id === fileId);
  }

  /**
   * 获取工作区所有文件
   */
  getFilesByWorkspace(workspaceId: string): FileMetadata[] {
    return this.metadata.files.filter(f => f.workspaceId === workspaceId);
  }

  /**
   * 获取节点所有文件
   */
  getFilesByNode(nodeId: string): FileMetadata[] {
    return this.metadata.files.filter(f => f.nodeId === nodeId);
  }

  /**
   * 按节点类型获取文件
   */
  getFilesByNodeType(nodeType: string): FileMetadata[] {
    return this.metadata.files.filter(f => f.nodeType === nodeType);
  }

  /**
   * 按文件类型获取文件
   */
  getFilesByFileType(fileType: FileMetadata['fileType']): FileMetadata[] {
    return this.metadata.files.filter(f => f.fileType === fileType);
  }

  /**
   * 获取所有工作区信息
   */
  getAllWorkspaces(): WorkspaceInfo[] {
    return Object.values(this.metadata.workspaces);
  }

  /**
   * 获取工作区信息
   */
  getWorkspaceInfo(workspaceId: string): WorkspaceInfo | undefined {
    return this.metadata.workspaces[workspaceId];
  }

  /**
   * 创建或更新工作区信息
   */
  async updateWorkspaceInfo(
    workspaceId: string,
    fileMetadata?: FileMetadata,
    workspaceName?: string
  ): Promise<void> {
    let workspace = this.metadata.workspaces[workspaceId];

    if (!workspace) {
      // 创建新工作区
      workspace = {
        id: workspaceId,
        name: workspaceName || workspaceId,
        createdAt: new Date().toISOString(),
        fileCount: 0,
        totalSize: 0,
      };
      this.metadata.workspaces[workspaceId] = workspace;
    }

    // 更新工作区名称（如果提供）
    if (workspaceName && workspace.name !== workspaceName) {
      workspace.name = workspaceName;
    }

    // 如果提供了文件元数据，更新统计
    if (fileMetadata) {
      await this.updateWorkspaceStats(workspaceId);
    }
  }

  /**
   * 更新工作区统计信息
   */
  async updateWorkspaceStats(workspaceId: string): Promise<void> {
    const workspaceFiles = this.getFilesByWorkspace(workspaceId);
    const workspace = this.metadata.workspaces[workspaceId];

    if (!workspace) {
      console.warn(`[MetadataManager] 工作区不存在: ${workspaceId}`);
      return;
    }

    workspace.fileCount = workspaceFiles.length;
    workspace.totalSize = workspaceFiles.reduce((sum, f) => sum + f.size, 0);

  }

  /**
   * 获取存储统计信息
   */
  getStorageStats(): StorageStats {
    const stats: StorageStats = {
      totalFiles: this.metadata.files.length,
      totalSize: this.metadata.files.reduce((sum, f) => sum + f.size, 0),
      byType: {},
      byNode: {},
    };

    // 按类型统计
    for (const file of this.metadata.files) {
      if (!stats.byType[file.fileType]) {
        stats.byType[file.fileType] = { count: 0, size: 0 };
      }
      stats.byType[file.fileType].count++;
      stats.byType[file.fileType].size += file.size;

      // 按节点统计
      if (!stats.byNode[file.nodeId]) {
        stats.byNode[file.nodeId] = 0;
      }
      stats.byNode[file.nodeId]++;
    }

    return stats;
  }

  /**
   * 搜索文件
   */
  searchFiles(query: {
    workspaceId?: string;
    nodeId?: string;
    nodeType?: string;
    fileType?: FileMetadata['fileType'];
    fileNamePattern?: string;
  }): FileMetadata[] {
    let results = [...this.metadata.files];

    if (query.workspaceId) {
      results = results.filter(f => f.workspaceId === query.workspaceId);
    }

    if (query.nodeId) {
      results = results.filter(f => f.nodeId === query.nodeId);
    }

    if (query.nodeType) {
      results = results.filter(f => f.nodeType === query.nodeType);
    }

    if (query.fileType) {
      results = results.filter(f => f.fileType === query.fileType);
    }

    if (query.fileNamePattern) {
      const pattern = new RegExp(query.fileNamePattern, 'i');
      results = results.filter(f => pattern.test(f.fileName));
    }

    return results;
  }

  /**
   * 清理无效的文件引用
   * 检查元数据中的文件是否实际存在于文件系统中
   */
  async cleanupInvalidFiles(): Promise<string[]> {
    const invalidFiles: string[] = [];

    for (const file of this.metadata.files) {
      try {
        const parts = file.relativePath.split('/');
        const fileName = parts.pop()!;

        let currentDir = this.rootHandle;
        for (const folder of parts) {
          currentDir = await currentDir.getDirectoryHandle(folder);
        }

        // 尝试获取文件句柄
        await currentDir.getFileHandle(fileName);
      } catch (error) {
        console.warn(`[MetadataManager] 文件不存在: ${file.relativePath}`);
        invalidFiles.push(file.id);
      }
    }

    // 移除无效文件
    for (const fileId of invalidFiles) {
      await this.removeFile(fileId);
    }

    return invalidFiles;
  }

  /**
   * 导出元数据为 JSON
   */
  exportMetadata(): string {
    return JSON.stringify(this.metadata, null, 2);
  }

  /**
   * 导入元数据
   */
  async importMetadata(jsonData: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonData) as MetadataData;

      // 验证导入的数据
      if (!imported.version || !Array.isArray(imported.files)) {
        throw new Error('无效的元数据格式');
      }

      // 合并数据
      for (const file of imported.files) {
        await this.addFile(file);
      }

    } catch (error) {
      console.error('[MetadataManager] 导入元数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存元数据到文件
   */
  private async save(): Promise<void> {
    try {
      const fileHandle = await this.rootHandle.getFileHandle(this.metadataFilePath, {
        create: true,
      });

      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(this.metadata, null, 2));
      await writable.close();

    } catch (error) {
      console.error('[MetadataManager] 保存元数据失败:', error);
      throw new Error(`保存元数据失败: ${error}`);
    }
  }
}
