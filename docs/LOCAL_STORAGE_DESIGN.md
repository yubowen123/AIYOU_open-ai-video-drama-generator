# 本地化存储功能设计方案

## 📋 需求概述

将所有生成的图片和视频本地化存储到用户指定的文件夹中，按画布和节点类型进行组织管理。

## 🎯 核心功能

1. **根目录配置** - 用户在设置中选择基础存储文件夹
2. **自动分类存储** - 按画布 → 节点类型自动分类
3. **文件命名规范** - 统一的文件命名规则
4. **已有数据迁移** - 支持将现有 localStorage 数据迁移到本地文件

## 📁 文件结构设计

```
用户选择的根目录/
├── .aiyou-metadata.json                    # 元数据索引文件
├── workspace-[workspace-id]/                # 画布文件夹
│   ├── .workspace-info.json                 # 画布信息（名称、创建时间等）
│   ├── IMAGE_GENERATOR/                     # 图像生成节点
│   │   ├── node-[node-id]-001.png
│   │   ├── node-[node-id]-002.png
│   │   └── node-[node-id]-003.png
│   ├── VIDEO_GENERATOR/                     # 视频生成节点
│   │   ├── node-[node-id]-001.mp4
│   │   └── node-[node-id]-002.mp4
│   ├── AUDIO_GENERATOR/                     # 音频生成节点
│   │   └── node-[node-id]-001.mp3
│   ├── STORYBOARD_IMAGE/                    # 分镜图节点
│   │   ├── grid-page-001.png
│   │   ├── grid-page-002.png
│   │   └── grid-page-003.png
│   ├── STORYBOARD_SPLITTER/                 # 分镜拆解节点
│   │   ├── split-shot-001.png
│   │   ├── split-shot-002.png
│   │   └── export.zip
│   ├── CHARACTER_NODE/                      # 角色节点
│   │   ├── character-[name]-three-view.png
│   │   ├── character-[name]-expression.png
│   │   └── character-[name]-scene.png
│   └── [其他节点类型]/
└── workspace-[另一个workspace-id]/
    └── ...
```

## 🏗️ 技术架构

### 1. 浏览器文件系统 API 选择

由于这是一个 Web 应用，需要使用浏览器提供的文件系统 API：

**方案：File System Access API**
- ✅ 原生支持，性能最好
- ✅ 可以读写本地文件
- ✅ 支持文件夹选择
- ⚠️ 仅支持 Chromium 系浏览器（Chrome, Edge 等）
- ⚠️ 需要用户权限授权

**备选方案：下载 + 文件导入**
- ✅ 兼容所有浏览器
- ❌ 用户体验较差（每次需要下载/上传）

### 2. 核心服务模块

```
services/
├── storage/
│   ├── FileStorageService.ts        # 文件存储核心服务
│   ├── PathManager.ts               # 路径管理器
│   ├── MetadataManager.ts           # 元数据管理器
│   ├── index.ts                     # 导出入口
│   └── types.ts                     # 类型定义
```

### 3. 数据流设计

```
用户生成图片
    ↓
[App层] 调用 generateImage()
    ↓
[服务层] Gemini API 返回 base64 图片
    ↓
[存储层] FileStorageService.save()
    ├─ 生成文件路径
    ├─ 保存到本地文件系统
    ├─ 更新元数据索引
    └─ 返回文件引用路径
    ↓
[应用层] 更新节点数据
    ├─ node.data.imageUrl = file://path/to/file
    └─ 保存到 localStorage（仅存引用）
```

## 📝 详细实现计划

### Phase 1: 基础架构（优先）

#### 1.1 创建类型定义 (`services/storage/types.ts`)

```typescript
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
  // 文件引用（用于在 app 中使用）
  fileHandle?: FileSystemFileHandle;
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
}

/**
 * 节点类型文件夹映射
 */
export const NODE_TYPE_FOLDERS: Record<string, string> = {
  IMAGE_GENERATOR: 'IMAGE_GENERATOR',
  VIDEO_GENERATOR: 'VIDEO_GENERATOR',
  AUDIO_GENERATOR: 'AUDIO_GENERATOR',
  STORYBOARD_IMAGE: 'STORYBOARD_IMAGE',
  STORYBOARD_SPLITTER: 'STORYBOARD_SPLITTER',
  CHARACTER_NODE: 'CHARACTER_NODE',
  DRAMA_ANALYZER: 'DRAMA_ANALYZER',
  // ... 其他节点类型
};
```

#### 1.2 路径管理器 (`services/storage/PathManager.ts`)

```typescript
/**
 * 路径管理器
 * 负责生成文件路径和文件夹结构
 */
export class PathManager {
  /**
   * 生成工作区文件夹名
   * @param workspaceId 工作区ID
   * @param workspaceName 工作区名称（可选）
   */
  getWorkspaceFolderName(workspaceId: string, workspaceName?: string): string {
    const sanitizedName = workspaceName
      ? this.sanitizeFileName(workspaceName)
      : workspaceId;
    return `workspace-${workspaceId}-${sanitizedName}`;
  }

  /**
   * 获取节点文件夹名
   * @param nodeType 节点类型
   */
  getNodeTypeFolder(nodeType: string): string {
    return NODE_TYPE_FOLDERS[nodeType] || nodeType;
  }

  /**
   * 生成文件名
   * @param nodeId 节点ID
   * @param index 文件索引
   * @param extension 文件扩展名
   * @param prefix 文件名前缀（可选）
   */
  generateFileName(
    nodeId: string,
    index: number,
    extension: string,
    prefix?: string
  ): string {
    const indexStr = String(index).padStart(3, '0');
    const prefixStr = prefix ? `${prefix}-` : '';
    return `node-${nodeId}-${prefixStr}${indexStr}.${extension}`;
  }

  /**
   * 生成特殊文件名（如分镜图、角色图等）
   */
  generateSpecialFileName(
    type: 'storyboard-grid' | 'character' | 'split-shot',
    params: Record<string, any>
  ): string {
    switch (type) {
      case 'storyboard-grid':
        return `grid-page-${String(params.page).padStart(3, '0')}.png`;
      case 'character':
        return `character-${params.name}-${params.view}.png`;
      case 'split-shot':
        return `split-shot-${String(params.shotNumber).padStart(3, '0')}.png`;
      default:
        return `file-${Date.now()}.png`;
    }
  }

  /**
   * 清理文件名（移除非法字符）
   */
  sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')  // 移除非法字符
      .replace(/\s+/g, '_')            // 空格替换为下划线
      .substring(0, 50);               // 限制长度
  }

  /**
   * 构建完整相对路径
   */
  buildRelativePath(
    workspaceId: string,
    nodeType: string,
    fileName: string,
    workspaceName?: string
  ): string {
    const workspaceFolder = this.getWorkspaceFolderName(workspaceId, workspaceName);
    const nodeTypeFolder = this.getNodeTypeFolder(nodeType);
    return `${workspaceFolder}/${nodeTypeFolder}/${fileName}`;
  }
}
```

#### 1.3 核心存储服务 (`services/storage/FileStorageService.ts`)

```typescript
/**
 * 文件存储服务
 */
export class FileStorageService {
  private config: StorageConfig;
  private pathManager: PathManager;
  private metadataManager: MetadataManager;

  // 初始化
  async initialize(config: StorageConfig): Promise<void> {
    this.config = config;
    this.pathManager = new PathManager();
    this.metadataManager = new MetadataManager(config.rootDirectoryHandle);

    // 创建元数据索引文件
    await this.metadataManager.initialize();
  }

  /**
   * 选择根目录
   */
  async selectRootDirectory(): Promise<void> {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      this.config.rootDirectoryHandle = handle;
      this.config.rootPath = handle.name;

      // 保存配置到 localStorage
      localStorage.setItem('storageConfig', JSON.stringify({
        rootPath: handle.name,
        enabled: true,
        autoSave: true
      }));

      await this.initialize(this.config);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('选择目录失败:', error);
        throw error;
      }
    }
  }

  /**
   * 保存文件
   * @param workspaceId 工作区ID
   * @param nodeId 节点ID
   * @param nodeType 节点类型
   * @param fileData 文件数据（base64 或 blob）
   * @param options 保存选项
   */
  async saveFile(
    workspaceId: string,
    nodeId: string,
    nodeType: string,
    fileData: string | Blob,
    options: SaveOptions = {}
  ): Promise<string> {
    if (!this.config.rootDirectoryHandle) {
      throw new Error('未设置存储目录');
    }

    // 1. 解析文件数据
    const blob = await this.parseFileData(fileData);
    const extension = this.getFileExtension(blob.type);

    // 2. 生成文件路径
    const fileName = this.pathManager.generateFileName(nodeId, 1, extension);
    const relativePath = this.pathManager.buildRelativePath(
      workspaceId,
      nodeType,
      fileName
    );

    // 3. 确保目录结构存在
    await this.ensureDirectoryStructure(
      workspaceId,
      nodeType,
      this.config.rootDirectoryHandle
    );

    // 4. 写入文件
    const fileHandle = await this.writeFile(
      relativePath,
      blob,
      options.overwrite || false
    );

    // 5. 更新元数据
    if (options.updateMetadata !== false) {
      await this.metadataManager.addFile({
        id: this.generateFileId(),
        workspaceId,
        nodeId,
        nodeType,
        fileType: this.getFileType(extension),
        fileName,
        relativePath,
        size: blob.size,
        createdAt: new Date().toISOString(),
        fileHandle
      });
    }

    // 返回文件引用 URL
    return this.getFileUrl(relativePath);
  }

  /**
   * 读取文件
   */
  async readFile(relativePath: string): Promise<Blob> {
    // 解析路径
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
   * 删除文件
   */
  async deleteFile(relativePath: string): Promise<void> {
    // 实现删除逻辑
    await this.metadataManager.removeFile(relativePath);
  }

  /**
   * 获取工作区所有文件
   */
  async getWorkspaceFiles(workspaceId: string): Promise<FileMetadata[]> {
    return await this.metadataManager.getFilesByWorkspace(workspaceId);
  }

  // 私有辅助方法
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

  private getFileExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'application/zip': 'zip',
    };
    return map[mimeType] || 'bin';
  }

  private async ensureDirectoryStructure(
    workspaceId: string,
    nodeType: string,
    rootHandle: FileSystemDirectoryHandle
  ): Promise<void> {
    // 创建工作区文件夹
    const workspaceFolder = this.pathManager.getWorkspaceFolderName(workspaceId);
    const nodeTypeFolder = this.pathManager.getNodeTypeFolder(nodeType);

    // 确保目录存在
    try {
      await rootHandle.getDirectoryHandle(workspaceFolder, { create: true });
      const workspaceHandle = await rootHandle.getDirectoryHandle(workspaceFolder);
      await workspaceHandle.getDirectoryHandle(nodeTypeFolder, { create: true });
    } catch (error) {
      console.error('创建目录结构失败:', error);
      throw error;
    }
  }

  private async writeFile(
    relativePath: string,
    blob: Blob,
    overwrite: boolean
  ): Promise<FileSystemFileHandle> {
    const parts = relativePath.split('/');
    const fileName = parts.pop()!;

    let currentDir = this.config.rootDirectoryHandle;
    for (const folder of parts) {
      currentDir = await currentDir.getDirectoryHandle(folder);
    }

    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return fileHandle;
  }

  private getFileUrl(relativePath: string): string {
    // 返回可以在应用中使用的 URL
    // 由于文件系统 API 的限制，可能需要特殊处理
    return `file://${relativePath}`;
  }

  private generateFileId(): string {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFileType(extension: string): FileMetadata['fileType'] {
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) return 'image';
    if (['mp4', 'webm', 'mov'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(extension)) return 'audio';
    if (['zip'].includes(extension)) return 'zip';
    return 'other';
  }
}
```

#### 1.4 元数据管理器 (`services/storage/MetadataManager.ts`)

```typescript
/**
 * 元数据管理器
 * 管理文件索引和元数据
 */
export class MetadataManager {
  private rootHandle: FileSystemDirectoryHandle;
  private metadataPath = '.aiyou-metadata.json';
  private metadata: {
    files: FileMetadata[];
    workspaces: Record<string, { name: string; createdAt: string }>;
  };

  async initialize(): Promise<void> {
    try {
      // 尝试读取现有元数据
      const fileHandle = await this.rootHandle.getFileHandle(this.metadataPath);
      const file = await fileHandle.getFile();
      const text = await file.text();
      this.metadata = JSON.parse(text);
    } catch {
      // 创建新元数据
      this.metadata = {
        files: [],
        workspaces: {}
      };
      await this.save();
    }
  }

  async addFile(file: FileMetadata): Promise<void> {
    this.metadata.files.push(file);
    await this.save();
  }

  async removeFile(relativePath: string): Promise<void> {
    this.metadata.files = this.metadata.files.filter(
      f => f.relativePath !== relativePath
    );
    await this.save();
  }

  async getFilesByWorkspace(workspaceId: string): Promise<FileMetadata[]> {
    return this.metadata.files.filter(f => f.workspaceId === workspaceId);
  }

  async getFilesByNode(nodeId: string): Promise<FileMetadata[]> {
    return this.metadata.files.filter(f => f.nodeId === nodeId);
  }

  private async save(): Promise<void> {
    const fileHandle = await this.rootHandle.getFileHandle(
      this.metadataPath,
      { create: true }
    );
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(this.metadata, null, 2));
    await writable.close();
  }
}
```

### Phase 2: UI 集成

#### 2.1 设置界面 (`components/SettingsPanel.tsx`)

```typescript
// 添加存储设置部分
<div className="storage-settings">
  <h3>存储设置</h3>

  {!storageConfig.enabled ? (
    <button onClick={handleSelectDirectory}>
      <Folder size={16} />
      选择存储文件夹
    </button>
  ) : (
    <div className="storage-info">
      <p>当前存储位置: {storageConfig.rootPath}</p>
      <div className="stats">
        <span>已保存文件: {stats.totalFiles}</span>
        <span>总大小: {formatSize(stats.totalSize)}</span>
      </div>
      <button onClick={handleChangeDirectory}>更改文件夹</button>
      <button onClick={handleDisableStorage}>禁用本地存储</button>
    </div>
  )}

  <label className="checkbox">
    <input
      type="checkbox"
      checked={storageConfig.autoSave}
      onChange={(e) => updateConfig({ autoSave: e.target.checked })}
    />
    自动保存生成的文件
  </label>

  {storageConfig.enabled && (
    <button onClick={handleMigrateData}>
      <Download size={16} />
      迁移现有数据到本地存储
    </button>
  )}
</div>
```

#### 2.2 修改节点生成逻辑

在 `App.tsx` 中修改图片生成后的处理：

```typescript
// 生成图片后
const images = await generateImageWithFallback(...);

// 如果启用了本地存储
if (storageService.isEnabled()) {
  for (let i = 0; i < images.length; i++) {
    const filePath = await storageService.saveFile(
      workspaceId,      // 当前工作区ID
      node.id,         // 节点ID
      node.type,       // 节点类型
      images[i],       // base64 图片数据
      { updateMetadata: true }
    );

    // 更新节点数据，保存文件路径而非 base64
    if (i === 0) {
      updatedData.imageUrl = filePath;
    }
    imageUrls[i] = filePath;
  }
} else {
  // 旧逻辑：保存 base64 到 localStorage
  updatedData.imageUrl = images[0];
  updatedData.imageUrls = images;
}
```

### Phase 3: 高级功能

#### 3.1 数据迁移工具

```typescript
/**
 * 数据迁移服务
 * 将 localStorage 中的 base64 数据迁移到本地文件系统
 */
export class DataMigrationService {
  async migrateWorkspace(
    workspaceId: string,
    nodes: AppNode[],
    storageService: FileStorageService
  ): Promise<void> {
    let migrated = 0;

    for (const node of nodes) {
      // 迁移图片
      if (node.data.imageUrl && node.data.imageUrl.startsWith('data:')) {
        await storageService.saveFile(
          workspaceId,
          node.id,
          node.type,
          node.data.imageUrl
        );
        migrated++;
      }

      // 迁移视频
      if (node.data.videoUrl && node.data.videoUrl.startsWith('data:')) {
        await storageService.saveFile(
          workspaceId,
          node.id,
          node.type,
          node.data.videoUrl
        );
        migrated++;
      }

      // 迁移其他数据...
    }

    console.log(`迁移完成: ${migrated} 个文件`);
  }
}
```

#### 3.2 文件缓存管理

```typescript
/**
 * 文件缓存管理器
 * 管理文件对象的 URL 和内存缓存
 */
export class FileCacheManager {
  private cache = new Map<string, Blob>();
  private urlCache = new Map<string, string>();

  /**
   * 获取文件 URL（带缓存）
   */
  async getFileUrl(
    relativePath: string,
    fileHandle: FileSystemFileHandle
  ): Promise<string> {
    // 检查 URL 缓存
    if (this.urlCache.has(relativePath)) {
      return this.urlCache.get(relativePath)!;
    }

    // 读取文件
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);

    // 缓存 URL
    this.urlCache.set(relativePath, url);

    return url;
  }

  /**
   * 清理缓存
   */
  clear(): void {
    // 释放所有 Object URLs
    this.urlCache.forEach(url => URL.revokeObjectURL(url));
    this.urlCache.clear();
    this.cache.clear();
  }
}
```

## 🎨 UI 改进建议

### 1. 文件浏览器面板

添加一个侧边面板显示当前工作区的所有文件：

```typescript
<div className="file-browser">
  <h3>文件管理</h3>
  <div className="file-tree">
    {nodeTypes.map(nodeType => (
      <div key={nodeType} className="file-group">
        <h4>{getNodeTypeName(nodeType)}</h4>
        {files.filter(f => f.nodeType === nodeType).map(file => (
          <div key={file.id} className="file-item">
            <img src={file.url} alt="" />
            <span>{file.fileName}</span>
            <button onClick={() => openFile(file)}>打开</button>
            <button onClick={() => deleteFile(file)}>删除</button>
          </div>
        ))}
      </div>
    ))}
  </div>
</div>
```

### 2. 存储状态指示器

在画布上显示存储状态：

```typescript
<div className="storage-status">
  {storageConfig.enabled ? (
    <div className="enabled">
      <HardDrive size={14} />
      <span>本地存储已启用</span>
    </div>
  ) : (
    <div className="disabled">
      <Cloud size={14} />
      <span>使用浏览器存储</span>
    </div>
  )}
</div>
```

## ⚠️ 注意事项和限制

### File System Access API 限制

1. **浏览器兼容性**
   - ✅ Chrome 86+
   - ✅ Edge 86+
   - ❌ Firefox（不支持）
   - ❌ Safari（不支持）

2. **权限管理**
   - 每次页面刷新需要重新请求权限
   - 需要用户手动授权

3. **文件访问**
   - 只能访问用户明确授权的目录
   - 无法访问系统任意位置

### 降级方案

对于不支持 File System Access API 的浏览器：

```typescript
class FallbackStorageService {
  async saveFile(data: Blob): Promise<string> {
    // 触发下载
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.generateFileName();
    a.click();
    URL.revokeObjectURL(url);

    // 返回提示信息
    return 'downloaded';
  }
}
```

## 📊 实施优先级

| 优先级 | 功能 | 工作量 | 价值 |
|--------|------|--------|------|
| P0 | 基础存储服务 | 大 | 高 |
| P0 | 设置界面 | 中 | 高 |
| P1 | 节点集成 | 中 | 高 |
| P1 | 元数据管理 | 小 | 中 |
| P2 | 数据迁移 | 中 | 中 |
| P2 | 文件浏览器 | 中 | 中 |
| P3 | 缓存管理 | 小 | 低 |

## 🔄 兼容性处理

```typescript
// 检测浏览器支持
export function supportsFileSystemAccessAPI(): boolean {
  return 'showDirectoryPicker' in window;
}

// 自动选择存储方案
export function createStorageService(): FileStorageService | FallbackStorageService {
  if (supportsFileSystemAccessAPI()) {
    return new FileStorageService();
  } else {
    console.warn('浏览器不支持 File System Access API，使用降级方案');
    return new FallbackStorageService();
  }
}
```

---

**这个设计方案是否符合您的需求？需要我开始实现哪个部分？**
