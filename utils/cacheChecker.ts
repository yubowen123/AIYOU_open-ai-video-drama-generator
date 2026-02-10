/**
 * 缓存检查工具
 * 用于检查节点是否已有缓存的文件
 */

import { createFileStorageService } from '../services/storage/index';

interface CacheResult {
    hasCache: boolean;
    files?: Array<{
        relativePath: string;
        dataUrl: string;
    }>;
}

/**
 * 检查节点是否已有缓存的文件
 */
export async function checkNodeCache(
    nodeId: string,
    nodeType: string
): Promise<CacheResult> {
    const service = createFileStorageService();

    // 检查存储是否启用
    if (!service.isEnabled()) {
        return { hasCache: false };
    }

    try {
        // 访问元数据管理器
        const metadataManager = (service as any).metadataManager;
        if (!metadataManager) {
            return { hasCache: false };
        }

        // 获取该节点的文件
        const files = metadataManager.getFilesByNode(nodeId);

        if (!files || files.length === 0) {
            return { hasCache: false };
        }


        // 读取文件内容
        const fileData = await Promise.all(
            files.map(async (file: any) => {
                try {
                    const dataUrl = await service.readFileAsDataUrl(file.relativePath);
                    return {
                        relativePath: file.relativePath,
                        dataUrl
                    };
                } catch (error) {
                    console.error('[CacheChecker] 读取文件失败:', file.relativePath, error);
                    return null;
                }
            })
        );

        // 过滤掉读取失败的
        const validFiles = fileData.filter(f => f !== null);

        if (validFiles.length === 0) {
            console.warn('[CacheChecker] 所有文件读取失败');
            return { hasCache: false };
        }


        return {
            hasCache: true,
            files: validFiles
        };

    } catch (error) {
        console.error('[CacheChecker] 检查缓存失败:', error);
        return { hasCache: false };
    }
}

/**
 * 检查图片节点缓存
 * @returns 图片 Data URLs 数组，如果没有缓存则返回 null
 */
export async function checkImageNodeCache(nodeId: string): Promise<string[] | null> {

    const result = await checkNodeCache(nodeId, 'IMAGE_GENERATOR');

    if (!result.hasCache || !result.files) {
        return null;
    }

    // 返回图片 Data URLs
    const images = result.files.map(f => f.dataUrl);
    return images;
}

/**
 * 检查视频节点缓存
 * @returns 视频 Data URL，如果没有缓存则返回 null
 */
export async function checkVideoNodeCache(nodeId: string): Promise<string | null> {

    const result = await checkNodeCache(nodeId, 'VIDEO_GENERATOR');

    if (!result.hasCache || !result.files || result.files.length === 0) {
        return null;
    }

    return result.files[0].dataUrl;
}

/**
 * 检查音频节点缓存
 * @returns 音频 Data URL，如果没有缓存则返回 null
 */
export async function checkAudioNodeCache(nodeId: string): Promise<string | null> {

    const result = await checkNodeCache(nodeId, 'AUDIO_GENERATOR');

    if (!result.hasCache || !result.files || result.files.length === 0) {
        return null;
    }

    return result.files[0].dataUrl;
}

/**
 * 检查分镜图网格节点缓存
 */
export async function checkStoryboardGridCache(nodeId: string): Promise<string[] | null> {

    const result = await checkNodeCache(nodeId, 'STORYBOARD_IMAGE');

    if (!result.hasCache || !result.files) {
        return null;
    }

    const grids = result.files.map(f => f.dataUrl);
    return grids;
}
