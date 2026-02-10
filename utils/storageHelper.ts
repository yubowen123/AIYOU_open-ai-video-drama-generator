/**
 * 存储辅助函数
 * 用于在节点生成后保存文件到本地存储
 */

import { getFileStorageService } from '../services/storage/index';

interface SaveNodeOutputOptions {
  workspaceId?: string;
  nodeId: string;
  nodeType: string;
  fileData: string | Blob | Array<string | Blob>;
  fileType?: 'image' | 'video' | 'audio' | 'zip';
}

interface SaveNodeOutputResult {
  success: boolean;
  savedPaths?: string[];
  error?: string;
}

/**
 * 保存节点输出到本地存储
 * @param options 保存选项
 * @returns 保存结果
 */
export async function saveNodeOutput(
  options: SaveNodeOutputOptions
): Promise<SaveNodeOutputResult> {
  const {
    workspaceId = 'default',
    nodeId,
    nodeType,
    fileData,
    fileType,
  } = options;

  const service = getFileStorageService();

  // 检查存储是否启用
  if (!service.isEnabled()) {
    return { success: false };
  }

  try {

    const savedPaths: string[] = [];

    // 处理单个文件
    if (typeof fileData === 'string' || fileData instanceof Blob) {
      const result = await service.saveFile(
        workspaceId,
        nodeId,
        nodeType,
        fileData,
        {
          updateMetadata: true,
        }
      );

      if (result.success) {
        savedPaths.push(result.relativePath);
      } else {
        console.error('[StorageHelper] 保存失败:', result.error);
        return { success: false, error: result.error };
      }
    }
    // 处理多个文件
    else if (Array.isArray(fileData)) {
      for (let i = 0; i < fileData.length; i++) {
        const result = await service.saveFile(
          workspaceId,
          nodeId,
          nodeType,
          fileData[i],
          {
            updateMetadata: true,
            prefix: `batch-${i + 1}`,
          }
        );

        if (result.success) {
          savedPaths.push(result.relativePath);
        } else {
          console.error(`[StorageHelper] 保存文件 ${i + 1} 失败:`, result.error);
        }
      }
    }


    return { success: true, savedPaths };
  } catch (error: any) {
    console.error('[StorageHelper] 保存异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 保存图片节点输出
 */
export async function saveImageNodeOutput(
  nodeId: string,
  images: string[],
  nodeType: string = 'IMAGE_GENERATOR'
): Promise<SaveNodeOutputResult> {
  return saveNodeOutput({
    nodeId,
    nodeType,
    fileData: images,
    fileType: 'image',
  });
}

/**
 * 保存视频节点输出
 */
export async function saveVideoNodeOutput(
  nodeId: string,
  videos: string[],
  nodeType: string = 'VIDEO_GENERATOR'
): Promise<SaveNodeOutputResult> {
  return saveNodeOutput({
    nodeId,
    nodeType,
    fileData: videos,
    fileType: 'video',
  });
}

/**
 * 保存音频节点输出
 */
export async function saveAudioNodeOutput(
  nodeId: string,
  audio: string,
  nodeType: string = 'AUDIO_GENERATOR'
): Promise<SaveNodeOutputResult> {
  return saveNodeOutput({
    nodeId,
    nodeType,
    fileData: audio,
    fileType: 'audio',
  });
}

/**
 * 保存分镜图网格输出
 */
export async function saveStoryboardGridOutput(
  nodeId: string,
  grids: string[],
  nodeType: string = 'STORYBOARD_IMAGE'
): Promise<SaveNodeOutputResult> {
  return saveNodeOutput({
    nodeId,
    nodeType,
    fileData: grids,
    fileType: 'image',
  });
}
