/**
 * 存储服务导出入口
 */

// 类型定义
export * from './types';

// 核心服务
export { FileStorageService, createFileStorageService, supportsFileSystemAccessAPI } from './FileStorageService';

// 辅助服务
export { PathManager } from './PathManager';
export { MetadataManager } from './MetadataManager';

/**
 * 默认导出的单例实例
 */
let defaultInstance: FileStorageService | null = null;

/**
 * 获取默认存储服务实例
 */
export function getFileStorageService(): FileStorageService {
  if (!defaultInstance) {
    defaultInstance = createFileStorageService();
  }
  return defaultInstance;
}

/**
 * 重置默认实例
 */
export function resetFileStorageService(): void {
  defaultInstance = null;
}
