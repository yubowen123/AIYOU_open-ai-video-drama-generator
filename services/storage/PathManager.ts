/**
 * 路径管理器
 * 负责生成文件路径、文件夹结构和文件名
 */

import { NODE_TYPE_FOLDERS, SpecialFileNameParams, SpecialFileNameType } from './types';

export class PathManager {
  /**
   * 获取工作区文件夹名
   * @param workspaceId 工作区ID
   * @param workspaceName 工作区名称（可选）
   * @returns 文件夹名称，格式: workspace-[id]-[sanitized-name]
   */
  getWorkspaceFolderName(workspaceId: string, workspaceName?: string): string {
    if (workspaceName) {
      const sanitizedName = this.sanitizeFileName(workspaceName);
      return `workspace-${workspaceId}-${sanitizedName}`;
    }
    return `workspace-${workspaceId}`;
  }

  /**
   * 获取节点类型文件夹名
   * @param nodeType 节点类型
   * @returns 文件夹名称
   */
  getNodeTypeFolder(nodeType: string): string {
    return NODE_TYPE_FOLDERS[nodeType] || nodeType;
  }

  /**
   * 生成标准文件名
   * @param nodeId 节点ID
   * @param index 文件索引
   * @param extension 文件扩展名
   * @param prefix 文件名前缀（可选）
   * @returns 文件名，格式: node-[node-id]-[prefix-]001.png
   */
  generateFileName(
    nodeId: string,
    index: number,
    extension: string,
    prefix?: string
  ): string {
    // 清理节点ID（移除特殊字符）
    const cleanNodeId = nodeId.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 12);
    const indexStr = String(index).padStart(3, '0');
    const prefixStr = prefix ? `${this.sanitizeFileName(prefix)}-` : '';
    return `node-${cleanNodeId}-${prefixStr}${indexStr}.${extension}`;
  }

  /**
   * 生成特殊文件名
   * @param type 特殊文件类型
   * @param params 参数
   * @returns 文件名
   */
  generateSpecialFileName(
    type: SpecialFileNameType,
    params: SpecialFileNameParams
  ): string {
    const timestamp = Date.now();

    switch (type) {
      case 'storyboard-grid':
        return `grid-page-${String(params.storyboard!.page).padStart(3, '0')}.png`;

      case 'character':
        const characterName = this.sanitizeFileName(params.character!.name);
        const view = params.character!.view;
        return `character-${characterName}-${view}.png`;

      case 'split-shot':
        return `split-shot-${String(params.splitShot!.shotNumber).padStart(3, '0')}.png`;

      case 'export-zip':
        return `storyboard-split-${timestamp}.zip`;

      case 'thumbnail':
        return `thumbnail-${timestamp}.png`;

      default:
        return `file-${timestamp}.bin`;
    }
  }

  /**
   * 清理文件名（移除非法字符）
   * @param name 原始名称
   * @returns 清理后的名称
   */
  sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')   // 移除非法字符
      .replace(/\s+/g, '_')            // 空格替换为下划线
      .replace(/[\x00-\x1f\x80-\x9f]/g, '') // 移除控制字符
      .replace(/^\.+/, '')             // 移除开头的点
      .substring(0, 50);               // 限制长度
  }

  /**
   * 构建完整相对路径
   * @param workspaceId 工作区ID
   * @param nodeType 节点类型
   * @param fileName 文件名
   * @param workspaceName 工作区名称（可选）
   * @returns 相对路径，格式: workspace-[id]/[node-type]/file.png
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

  /**
   * 解析相对路径
   * @param relativePath 相对路径
   * @returns 解析后的路径信息
   */
  parseRelativePath(relativePath: string): {
    workspaceFolder: string;
    nodeTypeFolder: string;
    fileName: string;
  } {
    const parts = relativePath.split('/');
    if (parts.length < 3) {
      throw new Error(`无效的相对路径: ${relativePath}`);
    }

    return {
      workspaceFolder: parts[0],
      nodeTypeFolder: parts[1],
      fileName: parts.slice(2).join('/'),
    };
  }

  /**
   * 从文件名提取文件扩展名
   * @param fileName 文件名
   * @returns 扩展名（不含点）
   */
  getExtension(fileName: string): string {
    const match = fileName.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * 从 MIME 类型获取文件扩展名
   * @param mimeType MIME 类型
   * @returns 扩展名
   */
  getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      // 图片
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',

      // 视频
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',

      // 音频
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',

      // 压缩文件
      'application/zip': 'zip',
      'application/x-zip-compressed': 'zip',
    };

    return mimeMap[mimeType] || 'bin';
  }

  /**
   * 获取文件类型分类
   * @param extension 文件扩展名
   * @returns 文件类型分类
   */
  getFileType(extension: string): 'image' | 'video' | 'audio' | 'zip' | 'other' {
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac'];
    const zipExts = ['zip', 'tar', 'gz', 'rar'];

    const ext = extension.toLowerCase();

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (zipExts.includes(ext)) return 'zip';

    return 'other';
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化后的字符串（如 "1.5 MB"）
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  /**
   * 生成唯一的文件ID
   * @param workspaceId 工作区ID
   * @param nodeId 节点ID
   * @param timestamp 时间戳（可选）
   * @returns 文件ID
   */
  generateFileId(workspaceId: string, nodeId: string, timestamp?: number): string {
    const ts = timestamp || Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${workspaceId}-${nodeId}-${ts}-${random}`;
  }

  /**
   * 检查文件名是否有效
   * @param fileName 文件名
   * @returns 是否有效
   */
  isValidFileName(fileName: string): boolean {
    // 检查是否包含非法字符
    if (/[<>:"/\\|?*\x00-\x1f\x80-\x9f]/.test(fileName)) {
      return false;
    }

    // 检查是否为空或仅包含空格
    if (!fileName.trim()) {
      return false;
    }

    // 检查是否为保留名称（Windows）
    const upperName = fileName.toUpperCase().replace(/\.[^.]+$/, '');
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    if (reservedNames.includes(upperName)) {
      return false;
    }

    return true;
  }
}
