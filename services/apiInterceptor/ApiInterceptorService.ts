/**
 * API 拦截器服务
 * 透明的缓存层,拦截API调用并优先使用本地缓存
 */

import { indexedDBService, FileMetadataRecord } from '../storage/IndexedDBService';
import { generateImageWithProvider } from '../aiAdapter';
import { generateVideo, analyzeVideo } from '../geminiService';
import { generateAudio } from '../geminiService';
import type { FileStorageService } from '../storage/FileStorageService';

// API 拦截结果接口
export interface InterceptResult<T> {
  data: T;
  fromCache: boolean;
  cacheLocation?: 'filesystem' | 'indexeddb';
  savedPaths?: string[];
}

// 图片生成结果
export interface ImageGenerationResult {
  images: string[];
  fromCache: boolean;
  cacheLocation?: 'filesystem' | 'indexeddb';
  savedPaths?: string[];
}

// 视频生成结果
export interface VideoGenerationResult {
  videoUrl: string;
  fromCache: boolean;
  cacheLocation?: 'filesystem' | 'indexeddb';
  savedPath?: string;
}

// 音频生成结果
export interface AudioGenerationResult {
  audioUrl: string;
  fromCache: boolean;
  cacheLocation?: 'filesystem' | 'indexeddb';
  savedPath?: string;
}

export class ApiInterceptorService {
  private static instance: ApiInterceptorService;
  private fileStorageService: FileStorageService | null = null;

  private constructor() {
    this.initializeFileStorage();
  }

  static getInstance(): ApiInterceptorService {
    if (!this.instance) {
      this.instance = new ApiInterceptorService();
    }
    return this.instance;
  }

  /**
   * 初始化文件存储服务
   */
  private initializeFileStorage(): void {
    // 从全局状态获取 FileStorageService
    if (typeof window !== 'undefined' && (window as any).fileStorageService) {
      this.fileStorageService = (window as any).fileStorageService;
    } else {
    }
  }

  /**
   * 更新文件存储服务引用
   */
  setFileStorageService(service: FileStorageService | null): void {
    this.fileStorageService = service;
    if (service) {
    }
  }

  // ==================== 图片生成拦截 ====================

  /**
   * 拦截图片生成请求
   */
  async interceptGenerateImage(
    nodeId: string,
    prompt: string,
    model: string,
    referenceImages: string[],
    options: any
  ): Promise<ImageGenerationResult> {
    const workspaceId = 'default';
    const nodeType = 'IMAGE_GENERATOR';


    // 第1步: 检查文件系统缓存
    if (this.fileStorageService?.isEnabled()) {
      try {
        const existingFiles = await this.fileStorageService.getFilesByNode(
          workspaceId,
          nodeId
        );

        if (existingFiles.length > 0) {

          // 更新访问时间
          await indexedDBService.updateFileAccessTime(nodeId);

          // 读取文件并转换为 data URLs
          const imageUrls = await Promise.all(
            existingFiles.map(async (file) => {
              const dataUrl = await this.fileStorageService!.readFileAsDataUrl(file.relativePath);
              return dataUrl;
            })
          );

          return {
            images: imageUrls,
            fromCache: true,
            cacheLocation: 'filesystem'
          };
        }
      } catch (error) {
        console.warn('[ApiInterceptor] 文件系统查询失败,继续API调用:', error);
      }
    }

    // 第2步: 检查 IndexedDB 元数据
    const metadata = await indexedDBService.getFileMetadata(nodeId);
    if (metadata && metadata.files.length > 0) {

      // 尝试从文件系统加载
      if (this.fileStorageService?.isEnabled()) {
        try {
          const files = await Promise.all(
            metadata.files.map(f =>
              this.fileStorageService!.readFileAsDataUrl(f.relative_path)
            )
          );

          return {
            images: files,
            fromCache: true,
            cacheLocation: 'indexeddb-filesystem'
          };
        } catch (error) {
          console.warn('[ApiInterceptor] 文件加载失败,重新生成:', error);
        }
      }
    }

    // 第3步: 调用原始 API (支持 Google Gemini 和 云雾 API)
    const images = await generateImageWithProvider(
      prompt,
      model,
      referenceImages,
      options
    );


    // 第4步: 保存到文件系统
    const savedPaths: string[] = [];
    if (this.fileStorageService?.isEnabled()) {
      try {
        for (let i = 0; i < images.length; i++) {
          const result = await this.fileStorageService.saveFile(
            workspaceId,
            nodeId,
            nodeType,
            images[i],
            {
              prefix: `image-${i + 1}`,
              updateMetadata: true
            }
          );

          if (result.success) {
            savedPaths.push(result.relativePath);
          }
        }
      } catch (error) {
        console.error('[ApiInterceptor] 文件系统保存失败:', error);
      }
    }

    // 第5步: 保存元数据到 IndexedDB
    await indexedDBService.saveFileMetadata({
      id: this.generateId(),
      node_id: nodeId,
      node_type: nodeType,
      file_count: images.length,
      files: savedPaths.map((path, index) => ({
        id: this.generateId(),
        relative_path: path,
        index: index + 1,
        created_at: new Date()
      })),
      generation_params: {
        prompt,
        model,
        aspectRatio: options.aspectRatio,
        count: options.count
      },
      created_at: new Date(),
      last_accessed: new Date()
    });

    return {
      images,
      fromCache: false,
      savedPaths
    };
  }

  // ==================== 视频生成拦截 ====================

  /**
   * 拦截视频生成请求
   */
  async interceptGenerateVideo(
    nodeId: string,
    prompt: string,
    model: string,
    referenceImage: string,
    options: any
  ): Promise<VideoGenerationResult> {
    const workspaceId = 'default';
    const nodeType = 'VIDEO_GENERATOR';


    // 第1步: 检查文件系统缓存
    if (this.fileStorageService?.isEnabled()) {
      try {
        const existingFiles = await this.fileStorageService.getFilesByNode(
          workspaceId,
          nodeId
        );

        if (existingFiles.length > 0) {

          // 更新访问时间
          await indexedDBService.updateFileAccessTime(nodeId);

          // 读取视频文件
          const videoUrl = await this.fileStorageService.readFileAsDataUrl(existingFiles[0].relativePath);

          return {
            videoUrl,
            fromCache: true,
            cacheLocation: 'filesystem',
            savedPath: existingFiles[0].relativePath
          };
        }
      } catch (error) {
        console.warn('[ApiInterceptor] 文件系统查询失败,继续API调用:', error);
      }
    }

    // 第2步: 调用原始 API
    const result = await generateVideo(prompt, model, referenceImage, options);

    const videoUrl = result.uri || result.videoUrl;

    // 第3步: 下载视频并保存到文件系统
    let savedPath: string | undefined;
    if (this.fileStorageService?.isEnabled() && videoUrl) {
      try {
        // 如果是远程 URL,先下载
        let videoData = videoUrl;
        if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
          const response = await fetch(videoUrl);
          const blob = await response.blob();
          videoData = await this.blobToBase64(blob);
        }

        // 保存到文件系统
        const saveResult = await this.fileStorageService.saveFile(
          workspaceId,
          nodeId,
          nodeType,
          videoData,
          {
            prefix: 'video',
            updateMetadata: true
          }
        );

        if (saveResult.success) {
          savedPath = saveResult.relativePath;
        }
      } catch (error) {
        console.error('[ApiInterceptor] 视频保存失败:', error);
      }
    }

    // 第4步: 保存元数据到 IndexedDB
    if (savedPath) {
      await indexedDBService.saveFileMetadata({
        id: this.generateId(),
        node_id: nodeId,
        node_type: nodeType,
        file_count: 1,
        files: [{
          id: this.generateId(),
          relative_path: savedPath,
          index: 1,
          created_at: new Date()
        }],
        generation_params: {
          prompt,
          model,
          mode: options.mode
        },
        created_at: new Date(),
        last_accessed: new Date()
      });
    }

    return {
      videoUrl,
      fromCache: false,
      savedPath
    };
  }

  // ==================== 音频生成拦截 ====================

  /**
   * 拦截音频生成请求
   */
  async interceptGenerateAudio(
    nodeId: string,
    prompt: string,
    options: any
  ): Promise<AudioGenerationResult> {
    const workspaceId = 'default';
    const nodeType = 'AUDIO_GENERATOR';


    // 第1步: 检查文件系统缓存
    if (this.fileStorageService?.isEnabled()) {
      try {
        const existingFiles = await this.fileStorageService.getFilesByNode(
          workspaceId,
          nodeId
        );

        if (existingFiles.length > 0) {

          // 更新访问时间
          await indexedDBService.updateFileAccessTime(nodeId);

          // 读取音频文件
          const audioUrl = await this.fileStorageService.readFileAsDataUrl(existingFiles[0].relativePath);

          return {
            audioUrl,
            fromCache: true,
            cacheLocation: 'filesystem',
            savedPath: existingFiles[0].relativePath
          };
        }
      } catch (error) {
        console.warn('[ApiInterceptor] 文件系统查询失败,继续API调用:', error);
      }
    }

    // 第2步: 调用原始 API
    const audioUrl = await generateAudio(prompt, options);

    // 第3步: 保存到文件系统
    let savedPath: string | undefined;
    if (this.fileStorageService?.isEnabled() && audioUrl) {
      try {
        const saveResult = await this.fileStorageService.saveFile(
          workspaceId,
          nodeId,
          nodeType,
          audioUrl,
          {
            prefix: 'audio',
            updateMetadata: true
          }
        );

        if (saveResult.success) {
          savedPath = saveResult.relativePath;
        }
      } catch (error) {
        console.error('[ApiInterceptor] 音频保存失败:', error);
      }
    }

    // 第4步: 保存元数据到 IndexedDB
    if (savedPath) {
      await indexedDBService.saveFileMetadata({
        id: this.generateId(),
        node_id: nodeId,
        node_type: nodeType,
        file_count: 1,
        files: [{
          id: this.generateId(),
          relative_path: savedPath,
          index: 1,
          created_at: new Date()
        }],
        generation_params: {
          prompt
        },
        created_at: new Date(),
        last_accessed: new Date()
      });
    }

    return {
      audioUrl,
      fromCache: false,
      savedPath
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 将 Blob 转换为 Base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 检查缓存状态
   */
  async checkCacheStatus(nodeId: string): Promise<{
    hasCache: boolean;
    cacheLocation?: 'filesystem' | 'indexeddb';
    fileCount?: number;
  }> {
    // 检查文件系统
    if (this.fileStorageService?.isEnabled()) {
      try {
        const files = await this.fileStorageService.getFilesByNode('default', nodeId);
        if (files.length > 0) {
          return {
            hasCache: true,
            cacheLocation: 'filesystem',
            fileCount: files.length
          };
        }
      } catch (error) {
        console.warn('[ApiInterceptor] 检查文件系统缓存失败:', error);
      }
    }

    // 检查 IndexedDB
    const metadata = await indexedDBService.getFileMetadata(nodeId);
    if (metadata && metadata.files.length > 0) {
      return {
        hasCache: true,
        cacheLocation: 'indexeddb',
        fileCount: metadata.file_count
      };
    }

    return {
      hasCache: false
    };
  }

  /**
   * 清除节点缓存
   */
  async clearNodeCache(nodeId: string): Promise<void> {

    // 删除 IndexedDB 元数据
    await indexedDBService.deleteFileMetadata(nodeId);

    // TODO: 删除文件系统中的文件(可选,需要用户确认)
    // if (this.fileStorageService?.isEnabled()) {
    //   const files = await this.fileStorageService.getFilesByNode('default', nodeId);
    //   for (const file of files) {
    //     await this.fileStorageService.deleteFile(file.relativePath);
    //   }
    // }
  }
}

// 导出单例
export const apiInterceptor = ApiInterceptorService.getInstance();

// 初始化时设置 FileStorageService
if (typeof window !== 'undefined') {
  // 在应用启动后,需要手动调用 apiInterceptor.setFileStorageService(service)
}
