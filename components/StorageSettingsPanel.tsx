/**
 * 存储设置面板组件
 * 用于配置本地文件存储
 */

import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  HardDrive,
  Cloud,
  CheckCircle,
  AlertCircle,
  Trash2,
  Download,
  ExternalLink,
  X,
  Loader2,
} from 'lucide-react';
import {
  FileStorageService,
  supportsFileSystemAccessAPI,
  StorageConfig,
  StorageStats,
} from '../services/storage/index';

interface StorageSettingsPanelProps {
  // 获取当前工作区ID的回调
  getCurrentWorkspaceId?: () => string;
  // 数据迁移回调
  onMigrateData?: () => void;
}

export const StorageSettingsPanel: React.FC<StorageSettingsPanelProps> = ({
  getCurrentWorkspaceId,
  onMigrateData,
}) => {
  const [storageService] = useState(() => new FileStorageService());
  const [config, setConfig] = useState<StorageConfig>({
    rootDirectoryHandle: null,
    rootPath: '',
    enabled: false,
    autoSave: true,
  });
  const [stats, setStats] = useState<StorageStats>({
    totalFiles: 0,
    totalSize: 0,
    byType: {},
    byNode: {},
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [showBrowserInfo, setShowBrowserInfo] = useState(false);

  // 初始化
  useEffect(() => {
    // 检查浏览器支持
    setIsSupported(supportsFileSystemAccessAPI());

    // 加载配置
    loadConfig();

    // 如果已启用，加载统计信息
    if (storageService.isEnabled()) {
      loadStats();
    }
  }, []);

  const loadConfig = async () => {
    try {
      // 从 localStorage 加载保存的配置
      const savedConfig = localStorage.getItem('storageConfig');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig({
          ...config,
          ...parsed,
        });

        // 如果启用了，尝试初始化服务
        if (parsed.enabled && parsed.rootPath) {
          // 注意：页面刷新后需要重新选择目录以获取目录句柄
          console.log('存储已启用，需要重新选择目录以获取访问权限');
        }
      }
    } catch (error) {
      console.error('加载存储配置失败:', error);
    }
  };

  const loadStats = () => {
    if (storageService.isEnabled()) {
      const storageStats = storageService.getStorageStats();
      setStats(storageStats);
    }
  };

  const handleSelectDirectory = async () => {
    if (!isSupported) {
      setShowBrowserInfo(true);
      return;
    }

    setIsSelecting(true);

    try {
      await storageService.selectRootDirectory();

      const newConfig = storageService.getConfig();
      setConfig(newConfig);

      // 创建工作区信息
      const workspaceId = getCurrentWorkspaceId?.() || 'default';
      await storageService['metadataManager']?.updateWorkspaceInfo(
        workspaceId,
        undefined,
        `Workspace ${workspaceId}`
      );

      loadStats();
    } catch (error: any) {
      console.error('选择目录失败:', error);
      alert(error.message || '选择目录失败');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleDisableStorage = async () => {
    if (confirm('确定要禁用本地存储吗？已保存的文件不会丢失，但应用将不再自动保存到本地。')) {
      await storageService.disable();
      setConfig({
        rootDirectoryHandle: null,
        rootPath: '',
        enabled: false,
        autoSave: true,
      });
      setStats({
        totalFiles: 0,
        totalSize: 0,
        byType: {},
        byNode: {},
      });
    }
  };

  const handleClearData = async () => {
    if (confirm('确定要清除存储配置吗？这不会删除已保存的文件。')) {
      localStorage.removeItem('storageConfig');
      setConfig({
        rootDirectoryHandle: null,
        rootPath: '',
        enabled: false,
        autoSave: true,
      });
    }
  };

  const handleMigrate = async () => {
    if (!onMigrateData) {
      alert('数据迁移功能尚未实现');
      return;
    }

    setIsMigrating(true);
    try {
      await onMigrateData();
      alert('数据迁移完成！');
      loadStats();
    } catch (error: any) {
      console.error('数据迁移失败:', error);
      alert(`数据迁移失败: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  return (
    <div className="space-y-6">
      {/* 浏览器兼容性警告 */}
      {!isSupported && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h4 className="text-sm font-bold text-amber-400">浏览器不支持本地存储</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                本地存储功能需要支持 File System Access API 的浏览器。
                当前使用的浏览器不支持此功能。
              </p>
              <div className="text-xs text-slate-400 space-y-1">
                <p className="font-medium text-slate-300">支持的浏览器：</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Chrome 86+ (推荐)</li>
                  <li>Microsoft Edge 86+</li>
                  <li>Opera 72+</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 存储状态 */}
      <div className="p-5 bg-white/5 border border-white/10 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.enabled ? (
              <div className="p-2.5 bg-green-500/20 rounded-xl">
                <HardDrive size={20} className="text-green-400" />
              </div>
            ) : (
              <div className="p-2.5 bg-slate-500/20 rounded-xl">
                <Cloud size={20} className="text-slate-400" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white">
                {config.enabled ? '本地存储已启用' : '使用浏览器存储'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {config.enabled
                  ? `存储位置: ${config.rootPath}`
                  : '文件保存在浏览器本地存储中'}
              </p>
            </div>
          </div>

          {config.enabled && (
            <button
              onClick={handleDisableStorage}
              className="px-3 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
            >
              禁用
            </button>
          )}
        </div>

        {/* 存储统计 */}
        {config.enabled && stats.totalFiles > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
            <div className="text-center p-3 bg-black/20 rounded-lg">
              <div className="text-lg font-bold text-cyan-400">{stats.totalFiles}</div>
              <div className="text-[10px] text-slate-400 mt-1">已保存文件</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded-lg">
              <div className="text-lg font-bold text-purple-400">
                {formatSize(stats.totalSize)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">总大小</div>
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {!config.enabled ? (
        <button
          onClick={handleSelectDirectory}
          disabled={isSelecting}
          className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-3 disabled:cursor-not-allowed"
        >
          {isSelecting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>选择文件夹中...</span>
            </>
          ) : (
            <>
              <Folder size={20} />
              <span>选择存储文件夹</span>
            </>
          )}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSelectDirectory}
            className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-medium"
          >
            <FolderOpen size={16} />
            更改文件夹
          </button>
          <button
            onClick={handleMigrate}
            disabled={isMigrating}
            className="py-3 px-4 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 hover:text-cyan-300 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMigrating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                迁移中...
              </>
            ) : (
              <>
                <Download size={16} />
                迁移数据
              </>
            )}
          </button>
        </div>
      )}

      {/* 功能说明 */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-blue-400">
          <HardDrive size={16} />
          <span className="text-xs font-bold">本地存储功能</span>
        </div>
        <ul className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>
              所有生成的图片、视频、音频将自动保存到您选择的文件夹中
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>
              按画布和节点类型自动分类存储，文件组织清晰
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>
              支持将现有浏览器存储的数据迁移到本地文件系统
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>
              每次打开应用需要重新授权访问文件夹（安全机制）
            </span>
          </li>
        </ul>
      </div>

      {/* 浏览器信息弹窗 */}
      {showBrowserInfo && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBrowserInfo(false)}
          />
          <div className="relative w-full max-w-md mx-4 bg-[#1c1c1e] rounded-2xl border border-white/10 shadow-2xl p-6">
            <button
              onClick={() => setShowBrowserInfo(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-xl">
                  <AlertCircle size={24} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">浏览器不兼容</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    本地存储功能需要 Chrome 或 Edge 浏览器
                  </p>
                </div>
              </div>

              <div className="text-sm text-slate-300 space-y-2">
                <p>请使用以下浏览器之一：</p>
                <ul className="space-y-1.5 ml-4">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-400" />
                    <a
                      href="https://www.google.com/chrome/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      Google Chrome
                      <ExternalLink size={12} />
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-400" />
                    <a
                      href="https://www.microsoft.com/edge"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      Microsoft Edge
                      <ExternalLink size={12} />
                    </a>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setShowBrowserInfo(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 危险操作区 */}
      {config.enabled && (
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={handleClearData}
            className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            清除存储配置（不删除文件）
          </button>
        </div>
      )}
    </div>
  );
};
