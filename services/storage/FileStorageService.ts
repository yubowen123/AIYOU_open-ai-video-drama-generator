/**
 * 文件存储服务
 * 提供文件系统的读写、保存和管理功能
 */

import { PathManager } from './PathManager';
import { MetadataManager } from './MetadataManager';
import {
  StorageConfig,
  SaveOptions,
  SaveResult,
  FileMetadata,
  SpecialFileNameParams,
} from './types';

export class FileStorageService {
  private config: StorageConfig;
  private pathManager: PathManager;
  private metadataManager: MetadataManager | null = null;
  private isInitialized = false;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      rootDirectoryHandle: null,
      rootPath: '',
      enabled: false,
      autoSave: true,
      ...config,
    };
    this.pathManager = new PathManager();
  }

  /**
   * 初始化存储服务
   */
  async initialize(config: StorageConfig): Promise<void> {
    console.log('[FileStorageService] 初始化存储服务...');

    this.config = {
      ...this.config,
      ...config,
    };

    if (!this.config.rootDirectoryHandle) {
      throw new Error('根目录句柄未设置');
    }

    // 初始化元数据管理器
    this.metadataManager = new MetadataManager(this.config.rootDirectoryHandle);
    await this.metadataManager.initialize();

    this.isInitialized = true;
    console.log('[FileStorageService] 存储服务初始化成功');

    // 保存配置到 localStorage
    this.saveConfigToStorage();
  }

  /**
   * 选择根目录
   */
  async selectRootDirectory(): Promise<void> {
    console.log('[FileStorageService] 打开目录选择器...');

    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      console.log('[FileStorageService] 用户选择目录:', handle.name);

      this.config.rootDirectoryHandle = handle;
      this.config.rootPath = handle.name;
      this.config.enabled = true;

      // 初始化元数据管理器
      await this.initialize(this.config);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[FileStorageService] 用户取消选择目录');
        throw new Error('用户取消选择目录');
      } else {
        console.error('[FileStorageService] 选择目录失败:', error);
        throw error;
      }
    }
  }

  /**
   * 保存文件（标准接口）
   */
  async saveFile(
    workspaceId: string,
    nodeId: string,
    nodeType: string,
    fileData: string | Blob,
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    if (!this.isInitialized || !this.config.rootDirectoryHandle) {
      return {
        success: false,
        relativePath: '',
        metadata: {} as FileMetadata,
        error: '存储服务未初始化',
      };
    }

    try {
      console.log('[FileStorageService] 保存文件:', {
        workspaceId,
        nodeId,
        nodeType,
        options,
      });

      // 1. 解析文件数据
      const blob = await this.parseFileData(fileData);
      const extension = this.pathManager.getExtensionFromMimeType(blob.type);

      // 2. 生成文件路径
      let fileName: string;
      if (options.customFileName) {
        fileName = options.customFileName;
      } else if (options.prefix) {
        fileName = this.pathManager.generateFileName(nodeId, 1, extension, options.prefix);
      } else {
        fileName = this.pathManager.generateFileName(nodeId, 1, extension);
      }

      const relativePath = this.pathManager.buildRelativePath(workspaceId, nodeType, fileName);

      // 3. 确保目录结构存在
      await this.ensureDirectoryStructure(
        workspaceId,
        nodeType,
        this.config.rootDirectoryHandle
      );

      // 4. 写入文件
      await this.writeFile(relativePath, blob, options.overwrite || false);

      // 5. 创建元数据
      const metadata: FileMetadata = {
        id: this.pathManager.generateFileId(workspaceId, nodeId),
        workspaceId,
        nodeId,
        nodeType,
        fileType: this.pathManager.getFileType(extension),
        fileName,
        relativePath,
        size: blob.size,
        createdAt: new Date().toISOString(),
        mimeType: blob.type,
      };

      // 6. 更新元数据
      if (options.updateMetadata !== false && this.metadataManager) {
        await this.metadataManager.addFile(metadata);
      }

      console.log('[FileStorageService] 文件保存成功:', relativePath);

      return {
        success: true,
        relativePath,
        metadata,
      };
    } catch (error: any) {
      console.error('[FileStorageService] 保存文件失败:', error);
      return {
        success: false,
        relativePath: '',
        metadata: {} as FileMetadata,
        error: error.message || '保存失败',
      };
    }
  }

  /**
   * 保存特殊文件（使用特殊命名规则）
   */
  async saveSpecialFile(
    workspaceId: string,
    nodeId: string,
    nodeType: string,
    fileData: string | Blob,
    fileNameType: keyof SpecialFileNameParams,
    params: SpecialFileNameParams,
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    let type: 'storyboard-grid' | 'character' | 'split-shot' | 'export-zip' | 'thumbnail';

    switch (fileNameType) {
      case 'storyboard':
        type = 'storyboard-grid';
        break;
      case 'character':
        type = 'character';
        break;
      case 'splitShot':
        type = 'split-shot';
        break;
      case 'export':
        type = 'export-zip';
        break;
      default:
        type = 'thumbnail';
    }

    const fileName = this.pathManager.generateSpecialFileName(type, params);

    return await this.saveFile(workspaceId, nodeId, nodeType, fileData, {
      ...options,
      customFileName: fileName,
    });
  }

  /**
   * 批量保存文件
   */
  async saveFiles(
    workspaceId: string,
    nodeId: string,
    nodeType: string,
    filesData: Array<string | Blob>,
    options: SaveOptions = {}
  ): Promise<SaveResult[]> {
    const results: SaveResult[] = [];

    for (let i = 0; i < filesData.length; i++) {
      const result = await this.saveFile(
        workspaceId,
        nodeId,
        nodeType,
        filesData[i],
        {
          ...options,
          prefix: options.prefix || `batch-${i + 1}`,
        }
      );
      results.push(result);
    }

    return results;
  }

  /**
   * 读取文件
   */
  async readFile(relativePath: string): Promise<Blob> {
    if (!this.config.rootDirectoryHandle) {
      throw new Error('存储服务未初始化');
    }

    console.log('[FileStorageService] 读取文件:', relativePath);

    const parts = relativePath.split('/');
    const fileName = parts.pop()!;

    let currentDir = this.config.rootDirectoryHandle;
    for (const folder of parts) {
      currentDir = await currentDir.getDirectoryHandle(folder);
    }

    const fileHandle = await currentDir.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    return file;
  }

  /**
   * 读取文件为 Data URL
   */
  async readFileAsDataUrl(relativePath: string): Promise<string> {
    const blob = await this.readFile(relativePath);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 删除文件
   */
  async deleteFile(relativePath: string): Promise<void> {
    if (!this.config.rootDirectoryHandle) {
      throw new Error('存储服务未初始化');
    }

    console.log('[FileStorageService] 删除文件:', relativePath);

    const parts = relativePath.split('/');
    const fileName = parts.pop()!;

    let currentDir = this.config.rootDirectoryHandle;
    for (const folder of parts) {
      currentDir = await currentDir.getDirectoryHandle(folder);
    }

    await currentDir.removeEntry(fileName);

    // 从元数据中移除
    if (this.metadataManager) {
      await this.metadataManager.removeFileByPath(relativePath);
    }

    console.log('[FileStorageService] 文件删除成功:', relativePath);
  }

  /**
   * 删除节点所有文件
   */
  async deleteNodeFiles(nodeId: string): Promise<void> {
    if (!this.metadataManager) {
      return;
    }

    const files = this.metadataManager.getFilesByNode(nodeId);
    console.log(`[FileStorageService] 删除节点 ${nodeId} 的 ${files.length} 个文件`);

    for (const file of files) {
      await this.deleteFile(file.relativePath);
    }
  }

  /**
   * 获取工作区所有文件
   */
  async getWorkspaceFiles(workspaceId: string): Promise<FileMetadata[]> {
    if (!this.metadataManager) {
      return [];
    }
    return this.metadataManager.getFilesByWorkspace(workspaceId);
  }

  /**
   * 获取存储统计信息
   */
  getStorageStats() {
    if (!this.metadataManager) {
      return {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
        byNode: {},
      };
    }
    return this.metadataManager.getStorageStats();
  }

  /**
   * 获取所有工作区
   */
  getAllWorkspaces() {
    if (!this.metadataManager) {
      return [];
    }
    return this.metadataManager.getAllWorkspaces();
  }

  /**
   * 检查是否已启用
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isInitialized;
  }

  /**
   * 获取配置
   */
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  /**
   * 禁用本地存储
   */
  async disable(): Promise<void> {
    console.log('[FileStorageService] 禁用本地存储');
    this.config.enabled = false;
    this.isInitialized = false;
    this.metadataManager = null;
    this.saveConfigToStorage();
  }

  // ============ 私有方法 ============

  /**
   * 解析文件数据
   */
  private async parseFileData(data: string | Blob): Promise<Blob> {
    if (data instanceof Blob) {
      return data;
    }

    // 解析 base64
    const matches = data.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1];
      const base64 = matches[2];
      const byteString = atob(base64);
      const array = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        array[i] = byteString.charCodeAt(i);
      }
      return new Blob([array], { type: mimeType });
    }

    throw new Error('无效的文件数据格式');
  }

  /**
   * 确保目录结构存在
   */
  private async ensureDirectoryStructure(
    workspaceId: string,
    nodeType: string,
    rootHandle: FileSystemDirectoryHandle
  ): Promise<void> {
    const workspaceFolder = this.pathManager.getWorkspaceFolderName(workspaceId);
    const nodeTypeFolder = this.pathManager.getNodeTypeFolder(nodeType);

    try {
      // 创建或获取工作区文件夹
      const workspaceHandle = await rootHandle.getDirectoryHandle(workspaceFolder, {
        create: true,
      });

      // 创建或获取节点类型文件夹
      await workspaceHandle.getDirectoryHandle(nodeTypeFolder, {
        create: true,
      });

      console.log('[FileStorageService] 目录结构已创建:', {
        workspaceFolder,
        nodeTypeFolder,
      });
    } catch (error) {
      console.error('[FileStorageService] 创建目录结构失败:', error);
      throw error;
    }
  }

  /**
   * 写入文件
   */
  private async writeFile(
    relativePath: string,
    blob: Blob,
    overwrite: boolean
  ): Promise<FileSystemFileHandle> {
    const parts = relativePath.split('/');
    const fileName = parts.pop()!;

    let currentDir = this.config.rootDirectoryHandle!;
    for (const folder of parts) {
      currentDir = await currentDir.getDirectoryHandle(folder);
    }

    const fileHandle = await currentDir.getFileHandle(fileName, {
      create: true,
    });

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return fileHandle;
  }

  /**
   * 保存配置到 localStorage
   */
  private saveConfigToStorage(): void {
    try {
      const configToSave = {
        rootPath: this.config.rootPath,
        enabled: this.config.enabled,
        autoSave: this.config.autoSave,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem('storageConfig', JSON.stringify(configToSave));
      console.log('[FileStorageService] 配置已保存到 localStorage');
    } catch (error) {
      console.error('[FileStorageService] 保存配置失败:', error);
    }
  }

  /**
   * 从 localStorage 加载配置
   */
  static loadConfigFromStorage(): Partial<StorageConfig> {
    try {
      const saved = localStorage.getItem('storageConfig');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('[FileStorageService] 加载配置失败:', error);
    }
    return {};
  }
}

/**
 * 检测浏览器是否支持 File System Access API
 */
export function supportsFileSystemAccessAPI(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * 创建存储服务实例（自动检测兼容性）
 */
export function createFileStorageService(): FileStorageService {
  if (!supportsFileSystemAccessAPI()) {
    console.warn('浏览器不支持 File System Access API');
  }

  // 尝试从 localStorage 加载配置
  const savedConfig = FileStorageService.loadConfigFromStorage();
  return new FileStorageService(savedConfig);
}
