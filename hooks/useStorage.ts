/**
 * 存储服务 Hook
 * 提供全局访问存储服务的统一入口
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getFileStorageService,
  FileStorageService,
  StorageConfig,
  StorageStats,
} from '../services/storage';

export function useStorage() {
  const [service] = useState(() => getFileStorageService());
  const [isEnabled, setIsEnabled] = useState(false);
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [stats, setStats] = useState<StorageStats>({
    totalFiles: 0,
    totalSize: 0,
    byType: {},
    byNode: {},
  });
  const [isLoading, setIsLoading] = useState(false);

  // 初始化：检查服务状态
  useEffect(() => {
    const checkServiceStatus = () => {
      const enabled = service.isEnabled();
      setIsEnabled(enabled);

      if (enabled) {
        const currentConfig = service.getConfig();
        setConfig(currentConfig);
        const currentStats = service.getStorageStats();
        setStats(currentStats);
      }
    };

    checkServiceStatus();

    // 监听 localStorage 变化
    const handleStorageChange = () => {
      checkServiceStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [service]);

  /**
   * 选择存储目录
   */
  const selectDirectory = useCallback(async () => {
    setIsLoading(true);
    try {
      await service.selectRootDirectory();
      const newConfig = service.getConfig();
      setConfig(newConfig);
      setIsEnabled(true);
      return { success: true };
    } catch (error: any) {
      console.error('选择目录失败:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  /**
   * 禁用存储
   */
  const disableStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      await service.disable();
      setIsEnabled(false);
      setConfig(null);
      setStats({
        totalFiles: 0,
        totalSize: 0,
        byType: {},
        byNode: {},
      });
      return { success: true };
    } catch (error: any) {
      console.error('禁用存储失败:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  /**
   * 保存文件
   */
  const saveFile = useCallback(async (
    workspaceId: string,
    nodeId: string,
    nodeType: string,
    fileData: string | Blob,
    options?: any
  ) => {
    if (!isEnabled) {
      return { success: false, error: '存储未启用' };
    }

    try {
      const result = await service.saveFile(
        workspaceId,
        nodeId,
        nodeType,
        fileData,
        options
      );

      // 更新统计
      const newStats = service.getStorageStats();
      setStats(newStats);

      return result;
    } catch (error: any) {
      console.error('保存文件失败:', error);
      return { success: false, error: error.message };
    }
  }, [service, isEnabled]);

  /**
   * 刷新统计信息
   */
  const refreshStats = useCallback(() => {
    if (isEnabled) {
      const newStats = service.getStorageStats();
      setStats(newStats);
    }
  }, [isEnabled, service]);

  return {
    service,
    isEnabled,
    config,
    stats,
    isLoading,
    selectDirectory,
    disableStorage,
    saveFile,
    refreshStats,
  };
}
