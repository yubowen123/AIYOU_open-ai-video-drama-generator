/**
 * IndexedDB 元数据服务
 * 用于存储文件元数据索引,不存储实际文件内容
 * 实际文件由 FileStorageService 存储到文件系统
 */

// 文件元数据接口
export interface FileMetadataRecord {
  id: string;
  node_id: string;
  node_type: string;
  file_count: number;
  files: Array<{
    id: string;
    relative_path: string;
    index: number;
    created_at: Date;
  }>;
  generation_params?: {
    prompt?: string;
    model?: string;
    aspectRatio?: string;
    count?: number;
    [key: string]: any;
  };
  created_at: Date;
  last_accessed: Date;
}

// 角色元数据接口
export interface CharacterMetadataRecord {
  id: string;
  node_id: string;
  name: string;
  character_data: any;
  expression_sheet_id?: string;
  three_view_sheet_id?: string;
  role_type: 'main' | 'supporting';
  original_prompt?: string;
  generation_metadata?: any;
  created_at: Date;
  updated_at: Date;
}

// 工作流元数据接口
export interface WorkflowMetadataRecord {
  id: string;
  title: string;
  thumbnail?: string;
  nodes: string; // JSON字符串
  connections: string; // JSON字符串
  groups?: string; // JSON字符串
  metadata?: string; // JSON字符串
  created_at: Date;
  updated_at: Date;
  is_favorite: boolean;
  tags?: string; // JSON字符串
}

// 存储统计接口
export interface StorageStats {
  totalFiles: number;
  totalNodes: number;
  totalSize: number;
  byType: Record<string, number>;
}

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'AIYOU_LOCAL_DB';
  private readonly DB_VERSION = 2;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    return new Promise((resolve, reject) => {

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 打开数据库失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建文件元数据表
        if (!db.objectStoreNames.contains('file_metadata')) {
          const store = db.createObjectStore('file_metadata', { keyPath: 'id' });
          store.createIndex('node_id', 'node_id', { unique: false });
          store.createIndex('node_type', 'node_type', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          store.createIndex('last_accessed', 'last_accessed', { unique: false });
        }

        // 创建角色元数据表
        if (!db.objectStoreNames.contains('character_metadata')) {
          const store = db.createObjectStore('character_metadata', { keyPath: 'id' });
          store.createIndex('node_id', 'node_id', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('role_type', 'role_type', { unique: false });
        }

        // 创建工作流元数据表
        if (!db.objectStoreNames.contains('workflow_metadata')) {
          const store = db.createObjectStore('workflow_metadata', { keyPath: 'id' });
          store.createIndex('created_at', 'created_at', { unique: false });
          store.createIndex('updated_at', 'updated_at', { unique: false });
          store.createIndex('is_favorite', 'is_favorite', { unique: false });
        }

      };
    });
  }

  // ==================== 文件元数据操作 ====================

  /**
   * 保存文件元数据
   */
  async saveFileMetadata(metadata: FileMetadataRecord): Promise<void> {
    await this.init();

    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['file_metadata'], 'readwrite');
      const store = tx.objectStore('file_metadata');
      const request = store.put(metadata);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 文件元数据保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取文件元数据
   */
  async getFileMetadata(nodeId: string): Promise<FileMetadataRecord | null> {
    await this.init();

    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['file_metadata'], 'readonly');
      const store = tx.objectStore('file_metadata');
      const index = store.index('node_id');
      const request = index.get(nodeId);

      request.onsuccess = () => {
        const result = request.result as FileMetadataRecord | undefined;
        resolve(result || null);
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 获取文件元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有文件元数据
   */
  async getAllFileMetadata(): Promise<FileMetadataRecord[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['file_metadata'], 'readonly');
      const store = tx.objectStore('file_metadata');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as FileMetadataRecord[]);
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 获取所有文件元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 更新文件访问时间
   */
  async updateFileAccessTime(nodeId: string): Promise<void> {
    const metadata = await this.getFileMetadata(nodeId);

    if (metadata) {
      metadata.last_accessed = new Date();
      await this.saveFileMetadata(metadata);
    }
  }

  /**
   * 删除文件元数据
   */
  async deleteFileMetadata(nodeId: string): Promise<void> {
    await this.init();

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['file_metadata'], 'readwrite');
      const store = tx.objectStore('file_metadata');
      const index = store.index('node_id');
      const request = index.openCursor(IDBKeyRange.only(nodeId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 删除文件元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  // ==================== 角色元数据操作 ====================

  /**
   * 保存角色元数据
   */
  async saveCharacterMetadata(metadata: CharacterMetadataRecord): Promise<void> {
    await this.init();

    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['character_metadata'], 'readwrite');
      const store = tx.objectStore('character_metadata');
      const request = store.put(metadata);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 角色元数据保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取节点的所有角色元数据
   */
  async getCharactersByNode(nodeId: string): Promise<CharacterMetadataRecord[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['character_metadata'], 'readonly');
      const store = tx.objectStore('character_metadata');
      const index = store.index('node_id');
      const request = index.getAll(nodeId);

      request.onsuccess = () => {
        resolve(request.result as CharacterMetadataRecord[]);
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 获取角色元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 根据名称获取角色元数据
   */
  async getCharacterByName(nodeId: string, name: string): Promise<CharacterMetadataRecord | null> {
    const characters = await this.getCharactersByNode(nodeId);
    return characters.find(c => c.name === name) || null;
  }

  /**
   * 删除角色元数据
   */
  async deleteCharacterMetadata(nodeId: string): Promise<void> {
    await this.init();

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['character_metadata'], 'readwrite');
      const store = tx.objectStore('character_metadata');
      const index = store.index('node_id');
      const request = index.openCursor(IDBKeyRange.only(nodeId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 删除角色元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  // ==================== 工作流元数据操作 ====================

  /**
   * 保存工作流元数据
   */
  async saveWorkflowMetadata(metadata: WorkflowMetadataRecord): Promise<void> {
    await this.init();

    if (!this.db) {
      throw new Error('数据库未初始化');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['workflow_metadata'], 'readwrite');
      const store = tx.objectStore('workflow_metadata');
      const request = store.put(metadata);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 工作流元数据保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取工作流元数据
   */
  async getWorkflowMetadata(workflowId: string): Promise<WorkflowMetadataRecord | null> {
    await this.init();

    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['workflow_metadata'], 'readonly');
      const store = tx.objectStore('workflow_metadata');
      const request = store.get(workflowId);

      request.onsuccess = () => {
        const result = request.result as WorkflowMetadataRecord | undefined;
        resolve(result || null);
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 获取工作流元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有工作流元数据
   */
  async getAllWorkflowMetadata(): Promise<WorkflowMetadataRecord[]> {
    await this.init();

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['workflow_metadata'], 'readonly');
      const store = tx.objectStore('workflow_metadata');
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as WorkflowMetadataRecord[];
        // 按更新时间倒序排列
        results.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
        resolve(results);
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 获取所有工作流元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除工作流元数据
   */
  async deleteWorkflowMetadata(workflowId: string): Promise<void> {
    await this.init();

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['workflow_metadata'], 'readwrite');
      const store = tx.objectStore('workflow_metadata');
      const request = store.delete(workflowId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 删除工作流元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  // ==================== 清理和维护 ====================

  /**
   * 清理旧的文件元数据
   */
  async cleanupOldMetadata(daysToKeep: number = 30): Promise<number> {
    await this.init();

    if (!this.db) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['file_metadata'], 'readwrite');
      const store = tx.objectStore('file_metadata');
      const index = store.index('created_at');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 清理元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取存储统计
   */
  async getStorageStats(): Promise<StorageStats> {
    await this.init();

    if (!this.db) {
      return { totalFiles: 0, totalNodes: 0, totalSize: 0, byType: {} };
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['file_metadata'], 'readonly');
      const store = tx.objectStore('file_metadata');
      const request = store.getAll();

      request.onsuccess = () => {
        const allMetadata = request.result as FileMetadataRecord[];
        const byType: Record<string, number> = {};

        allMetadata.forEach(m => {
          byType[m.node_type] = (byType[m.node_type] || 0) + m.file_count;
        });

        resolve({
          totalFiles: allMetadata.reduce((sum, m) => sum + m.file_count, 0),
          totalNodes: allMetadata.length,
          totalSize: 0, // 文件大小由 FileStorageService 统计
          byType
        });
      };

      request.onerror = () => {
        console.error('[IndexedDBService] ❌ 获取存储统计失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清空所有数据
   */
  async clearAll(): Promise<void> {
    await this.init();

    if (!this.db) {
      return;
    }

    const stores = ['file_metadata', 'character_metadata', 'workflow_metadata'];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error(`[IndexedDBService] ❌ 清空 ${storeName} 失败:`, request.error);
          reject(request.error);
        };
      });
    }

  }
}

// 导出单例
export const indexedDBService = new IndexedDBService();
