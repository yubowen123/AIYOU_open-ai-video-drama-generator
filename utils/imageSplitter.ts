// utils/imageSplitter.ts
import { SplitStoryboardShot } from '../types';

/**
 * 图像切割工具 - 将九宫格/六宫格分镜图切割为单个分镜图
 */

/**
 * 切割九宫格/六宫格图片为单个分镜图
 * @param imageUrl - 图片URL（可以是data URL或普通URL）
 * @param gridType - 网格类型 '9' (3x3) 或 '6' (2x3)
 * @param shotsData - 分镜描述数据数组（DetailedStoryboardShot）
 * @param sourceNodeId - 来源节点ID
 * @param sourcePage - 来源页码（0-based）
 * @returns Promise<SplitStoryboardShot[]> - 切割后的分镜数组
 */
export async function splitStoryboardImage(
  imageUrl: string,
  gridType: '9' | '6',
  shotsData: any[],
  sourceNodeId: string,
  sourcePage: number
): Promise<SplitStoryboardShot[]> {
  try {
    // 加载图片
    const img = await loadImage(imageUrl);

    // 计算网格布局
    const cols = gridType === '9' ? 3 : 3;
    const rows = gridType === '9' ? 3 : 2;
    const panelCount = gridType === '9' ? 9 : 6;

    // 计算每个面板的尺寸
    const panelWidth = img.width / cols;
    const panelHeight = img.height / rows;

    const splitShots: SplitStoryboardShot[] = [];

    // 切割每个面板
    for (let i = 0; i < panelCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // 计算当前面板在原图中的位置
      const x = col * panelWidth;
      const y = row * panelHeight;

      // 创建canvas并切割图片
      const canvas = document.createElement('canvas');
      canvas.width = panelWidth;
      canvas.height = panelHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建canvas上下文');
      }

      // 从原图中裁剪出当前面板
      ctx.drawImage(
        img,
        x, y, panelWidth, panelHeight,  // 源位置和尺寸
        0, 0, panelWidth, panelHeight   // 目标位置和尺寸
      );

      // 转换为Base64
      const splitImage = canvas.toDataURL('image/png', 0.95);

      // 获取对应的分镜描述数据
      const shotData = shotsData[i] || {};

      // 创建SplitStoryboardShot对象
      const splitShot: SplitStoryboardShot = {
        id: `split-${sourceNodeId}-${sourcePage}-${i}`,
        shotNumber: i + 1,
        sourceNodeId,
        sourcePage,
        panelIndex: i,
        splitImage,
        // From DetailedStoryboardShot
        scene: shotData.scene || '',
        characters: shotData.characters || [],
        shotType: shotData.shotType || '',
        cameraAngle: shotData.cameraAngle || '',
        cameraMovement: shotData.cameraMovement || '',
        visualDescription: shotData.visualDescription || shotData.description || '',
        dialogue: shotData.dialogue || '',
        visualEffects: shotData.visualEffects || '',
        audioEffects: shotData.audioEffects || '',
        startTime: shotData.startTime || 0,
        endTime: shotData.endTime || 0,
        duration: shotData.duration || 3
      };

      splitShots.push(splitShot);
    }

    return splitShots;
  } catch (error) {
    console.error('切割图片失败:', error);
    throw new Error(`图片切割失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 加载图片为HTMLImageElement
 * @param imageUrl - 图片URL
 * @returns Promise<HTMLImageElement>
 */
function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // 处理CORS问题
    if (imageUrl.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };

    img.src = imageUrl;
  });
}

/**
 * 批量切割多个分镜图节点
 * @param nodes - STORYBOARD_IMAGE节点数据数组
 * @param onProgress - 进度回调 (current: number, total: number)
 * @returns Promise<SplitStoryboardShot[]> - 所有切割后的分镜数组
 */
export async function splitMultipleStoryboardImages(
  nodes: Array<{
    id: string;
    data: {
      storyboardGridImages?: string[];
      storyboardGridType?: '9' | '6';
      storyboardShots?: any[];
    };
  }>,
  onProgress?: (current: number, total: number, currentNode: string) => void
): Promise<SplitStoryboardShot[]> {
  const allSplitShots: SplitStoryboardShot[] = [];
  let totalProcessed = 0;
  let totalToProcess = 0;

  // 计算总处理数
  for (const node of nodes) {
    const gridImages = node.data.storyboardGridImages || [];
    totalToProcess += gridImages.length;
  }

  // 处理每个节点
  for (const node of nodes) {
    const gridImages = node.data.storyboardGridImages || [];
    const gridType = node.data.storyboardGridType || '9';
    const allShots = node.data.storyboardShots || [];

    // 处理每页
    for (let pageIndex = 0; pageIndex < gridImages.length; pageIndex++) {
      const shotsPerGrid = gridType === '9' ? 9 : 6;
      const startIdx = pageIndex * shotsPerGrid;
      const endIdx = startIdx + shotsPerGrid;
      const pageShots = allShots.slice(startIdx, endIdx);

      try {
        const splitShots = await splitStoryboardImage(
          gridImages[pageIndex],
          gridType,
          pageShots,
          node.id,
          pageIndex
        );

        allSplitShots.push(...splitShots);
        totalProcessed++;

        if (onProgress) {
          onProgress(totalProcessed, totalToProcess, node.title || node.id);
        }
      } catch (error) {
        console.error(`切割节点 ${node.id} 第 ${pageIndex + 1} 页失败:`, error);
        // 继续处理其他图片，不中断整个流程
      }
    }
  }

  return allSplitShots;
}

/**
 * 导出切割后的图片为ZIP包
 * @param splitShots - 切割后的分镜数组
 * @param filename - ZIP文件名
 * @returns Promise<void>
 */
export async function exportSplitImagesAsZip(
  splitShots: SplitStoryboardShot[],
  filename: string = 'storyboard-shots.zip'
): Promise<void> {
  // 动态导入 JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // 添加每个分镜图片到ZIP
  splitShots.forEach((shot, index) => {
    // Base64转换为Blob
    const base64Data = shot.splitImage.split(',')[1];
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }

    // 文件名格式: 分镜-001-场景名称.png
    const sceneName = shot.scene.substring(0, 20).replace(/[^\w\u4e00-\u9fa5]/g, '_');
    const filename = `分镜-${String(shot.shotNumber).padStart(3, '0')}-${sceneName}.png`;

    zip.file(filename, bytes);
  });

  // 生成ZIP并下载
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
