// utils/imageFusion.ts
/**
 * 图片融合工具 - 将多张分镜图拼接并标号
 */

import { SplitStoryboardShot } from '../types';

/**
 * 融合多张分镜图为一张图
 * @param splitShots - 分镜数组（包含splitImage）
 * @param options - 融合选项
 * @returns Promise<string> - 融合后的图片Base64
 */
export async function fuseStoryboardImages(
    splitShots: SplitStoryboardShot[],
    options: {
        layout?: 'grid' | 'horizontal' | 'vertical'; // 布局方式
        columns?: number; // 网格列数（默认3）
        padding?: number; // 图片间距（默认8）
        bgColor?: string; // 背景颜色（默认#1a1a1c）
        showNumbers?: boolean; // 是否显示标号（默认true）
        numberSize?: number; // 标号字体大小（默认16）
    } = {}
): Promise<string> {
    const {
        layout = 'grid',
        columns = 3,
        padding = 8,
        bgColor = '#1a1a1c',
        showNumbers = true,
        numberSize = 16
    } = options;

    if (splitShots.length === 0) {
        throw new Error('没有可融合的分镜图');
    }

    // 加载所有图片
    const images = await Promise.all(
        splitShots.map(shot => loadImage(shot.splitImage))
    );

    // 统一图片尺寸（使用第一张图片的尺寸作为基准）
    const imgWidth = images[0].width;
    const imgHeight = images[0].height;

    // 计算布局
    let canvasWidth: number;
    let canvasHeight: number;
    let positions: Array<{ x: number; y: number; image: HTMLImageElement; index: number }>;

    if (layout === 'grid') {
        // 网格布局
        const cols = columns;
        const rows = Math.ceil(images.length / cols);
        const totalPaddingX = (cols + 1) * padding;
        const totalPaddingY = (rows + 1) * padding;
        canvasWidth = imgWidth * cols + totalPaddingX;
        canvasHeight = imgHeight * rows + totalPaddingY;

        positions = images.map((img, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            return {
                x: padding + col * (imgWidth + padding),
                y: padding + row * (imgHeight + padding),
                image: img,
                index: index + 1
            };
        });
    } else if (layout === 'horizontal') {
        // 水平布局
        canvasWidth = imgWidth * images.length + (images.length + 1) * padding;
        canvasHeight = imgHeight + padding * 2;

        positions = images.map((img, index) => ({
            x: padding + index * (imgWidth + padding),
            y: padding,
            image: img,
            index: index + 1
        }));
    } else {
        // 垂直布局
        canvasWidth = imgWidth + padding * 2;
        canvasHeight = imgHeight * images.length + (images.length + 1) * padding;

        positions = images.map((img, index) => ({
            x: padding,
            y: padding + index * (imgHeight + padding),
            image: img,
            index: index + 1
        }));
    }

    // 创建canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('无法创建canvas上下文');
    }

    // 填充背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 绘制图片
    positions.forEach(({ x, y, image, index }) => {
        // 绘制图片
        ctx.drawImage(image, x, y, imgWidth, imgHeight);

        // 绘制标号
        if (showNumbers) {
            // 标号背景
            const numPadding = 6;
            const numBgWidth = numberSize + numPadding * 2;
            const numBgHeight = numberSize + numPadding * 1.5;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x + 4, y + 4, numBgWidth, numBgHeight);

            // 标号文字
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${numberSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(String(index), x + 4 + numPadding, y + 4 + numPadding * 0.75);
        }
    });

    // 添加标题信息
    const titleHeight = 30;
    const titleCanvas = document.createElement('canvas');
    titleCanvas.width = canvasWidth;
    titleCanvas.height = canvasHeight + titleHeight;
    const titleCtx = titleCanvas.getContext('2d');
    if (!titleCtx) {
        throw new Error('无法创建标题canvas上下文');
    }

    // 绘制主图到标题canvas
    titleCtx.fillStyle = bgColor;
    titleCtx.fillRect(0, 0, canvasWidth, canvasHeight + titleHeight);
    titleCtx.drawImage(canvas, 0, titleHeight);

    // 绘制标题文本
    titleCtx.fillStyle = '#22d3ee';
    titleCtx.font = 'bold 14px Arial, sans-serif';
    titleCtx.textAlign = 'left';
    titleCtx.textBaseline = 'top';
    titleCtx.fillText(`分镜融合图 - 共 ${splitShots.length} 个镜头`, 10, 8);

    // 转换为Base64
    return titleCanvas.toDataURL('image/png', 0.95);
}

/**
 * 加载图片为HTMLImageElement
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
            reject(new Error(`图片加载失败: ${imageUrl.substring(0, 50)}...`));
        };

        img.src = imageUrl;
    });
}

/**
 * 批量融合多个任务组的分镜图
 * @param taskGroups - 任务组数组
 * @param onProgress - 进度回调
 * @returns Promise<Array<{ groupId: string, fusedImage: string }>>
 */
export async function fuseMultipleTaskGroups(
    taskGroups: Array<{ id: string; splitShots: SplitStoryboardShot[] }>,
    onProgress?: (current: number, total: number, groupName: string) => void
): Promise<Array<{ groupId: string; fusedImage: string }>> {
    const results: Array<{ groupId: string; fusedImage: string }> = [];

    for (let i = 0; i < taskGroups.length; i++) {
        const tg = taskGroups[i];

        try {
            const fusedImage = await fuseStoryboardImages(tg.splitShots);
            results.push({ groupId: tg.id, fusedImage });

            if (onProgress) {
                onProgress(i + 1, taskGroups.length, `任务组 ${i + 1}`);
            }
        } catch (error) {
            console.error(`融合任务组 ${tg.id} 失败:`, error);
            // 继续处理其他任务组
        }
    }

    return results;
}

/**
 * 融合分镜图和角色三视图
 * @param splitShots - 分镜数组
 * @param characterViews - 角色三视图 { frontView?, sideView?, backView? }
 * @param options - 融合选项
 * @returns Promise<string> - 融合后的Base64图片
 */
export async function fuseStoryboardWithCharacterViews(
    splitShots: SplitStoryboardShot[],
    characterViews: {
        frontView?: string;
        sideView?: string;
        backView?: string;
    },
    options: {
        layout?: 'grid' | 'horizontal' | 'vertical';
        columns?: number;
        padding?: number;
        bgColor?: string;
        showNumbers?: boolean;
        numberSize?: number;
        characterPosition?: 'bottom' | 'right' | 'left';
        characterSize?: 'small' | 'medium' | 'large';
    } = {}
): Promise<string> {
    const {
        layout = 'grid',
        columns = 3,
        padding = 8,
        bgColor = '#1a1a1c',
        showNumbers = true,
        numberSize = 16,
        characterPosition = 'bottom',
        characterSize = 'medium'
    } = options;

    // 1. 先融合分镜图
    const storyboardCanvas = document.createElement('canvas');
    const storyboardCtx = storyboardCanvas.getContext('2d');
    if (!storyboardCtx) throw new Error('无法创建canvas上下文');

    // 加载分镜图
    const shotImages = await Promise.all(
        splitShots.map(shot => loadImage(shot.splitImage))
    );

    const firstImg = shotImages[0];
    const imgWidth = firstImg.width;
    const imgHeight = firstImg.height;

    // 计算布局
    const numShots = shotImages.length;
    let cols = columns;
    if (layout === 'horizontal') cols = numShots;
    if (layout === 'vertical') cols = 1;
    const rows = Math.ceil(numShots / cols);

    const storyboardWidth = imgWidth * cols + (cols + 1) * padding;
    const storyboardHeight = imgHeight * rows + (rows + 1) * padding;

    storyboardCanvas.width = storyboardWidth;
    storyboardCanvas.height = storyboardHeight;

    // 绘制背景
    storyboardCtx.fillStyle = bgColor;
    storyboardCtx.fillRect(0, 0, storyboardWidth, storyboardHeight);

    // 绘制分镜图
    shotImages.forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (imgWidth + padding);
        const y = padding + row * (imgHeight + padding);

        storyboardCtx.drawImage(img, x, y, imgWidth, imgHeight);

        // 绘制序号
        if (showNumbers) {
            const numBoxW = numberSize + 12;
            const numBoxH = numberSize + 6 * 1.5;

            storyboardCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            storyboardCtx.fillRect(x + 4, y + 4, numBoxW, numBoxH);

            storyboardCtx.fillStyle = '#ffffff';
            storyboardCtx.font = `bold ${numberSize}px Arial`;
            storyboardCtx.textAlign = 'left';
            storyboardCtx.textBaseline = 'top';
            storyboardCtx.fillText(String(i + 1), x + 4 + 6, y + 4 + 6 * 0.75);
        }
    });

    // 2. 添加角色三视图（如果有）
    const characterImages: HTMLImageElement[] = [];
    if (characterViews.frontView) {
        characterImages.push(await loadImage(characterViews.frontView));
    }
    if (characterViews.sideView) {
        characterImages.push(await loadImage(characterViews.sideView));
    }
    if (characterViews.backView) {
        characterImages.push(await loadImage(characterViews.backView));
    }

    // 如果没有角色图，直接返回分镜融合图
    if (characterImages.length === 0) {
        return storyboardCanvas.toDataURL('image/png', 0.95);
    }

    // 3. 创建最终画布（分镜 + 角色）
    const charHeight = characterSize === 'small' ? 150 : characterSize === 'medium' ? 200 : 250;
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) throw new Error('无法创建最终canvas上下文');

    if (characterPosition === 'bottom') {
        // 角色在底部
        finalCanvas.width = storyboardWidth;
        finalCanvas.height = storyboardHeight + padding + charHeight;

        finalCtx.fillStyle = bgColor;
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // 绘制分镜图
        finalCtx.drawImage(storyboardCanvas, 0, 0);

        // 绘制角色区域标题
        finalCtx.fillStyle = '#22d3ee';
        finalCtx.font = 'bold 12px Arial, sans-serif';
        finalCtx.textAlign = 'left';
        finalCtx.textBaseline = 'top';
        finalCtx.fillText('角色三视图', 10, storyboardHeight + padding / 2);

        // 绘制角色图
        const charImgWidth = (finalCanvas.width - padding * 2) / characterImages.length - padding;
        const charImgHeight = charHeight - 30;

        characterImages.forEach((img, i) => {
            const x = padding + i * (charImgWidth + padding);
            const y = storyboardHeight + padding + 20;

            // 保持宽高比
            const aspect = img.width / img.height;
            let drawW = charImgWidth;
            let drawH = drawW / aspect;

            if (drawH > charImgHeight) {
                drawH = charImgHeight;
                drawW = drawH * aspect;
            }

            const centerX = x + charImgWidth / 2;
            const centerY = y + charImgHeight / 2;

            finalCtx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
        });
    } else if (characterPosition === 'right') {
        // 角色在右侧
        const charWidth = 200;
        finalCanvas.width = storyboardWidth + padding + charWidth;
        finalCanvas.height = Math.max(storyboardHeight, charHeight * characterImages.length);

        finalCtx.fillStyle = bgColor;
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // 绘制分镜图
        finalCtx.drawImage(storyboardCanvas, 0, 0);

        // 绘制角色图
        const charImgHeight = (finalCanvas.height - padding * (characterImages.length + 1)) / characterImages.length;
        const charImgWidth = charWidth - padding * 2;

        characterImages.forEach((img, i) => {
            const x = storyboardWidth + padding;
            const y = padding + i * (charImgHeight + padding);

            const aspect = img.width / img.height;
            let drawH = charImgHeight;
            let drawW = drawH * aspect;

            if (drawW > charImgWidth) {
                drawW = charImgWidth;
                drawH = drawW / aspect;
            }

            const centerX = x + charWidth / 2;
            const centerY = y + charImgHeight / 2;

            finalCtx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
        });
    } else {
        // 角色在左侧（同右侧逻辑）
        const charWidth = 200;
        finalCanvas.width = storyboardWidth + padding + charWidth;
        finalCanvas.height = Math.max(storyboardHeight, charHeight * characterImages.length);

        finalCtx.fillStyle = bgColor;
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // 绘制角色图
        const charImgHeight = (finalCanvas.height - padding * (characterImages.length + 1)) / characterImages.length;
        const charImgWidth = charWidth - padding * 2;

        characterImages.forEach((img, i) => {
            const x = padding;
            const y = padding + i * (charImgHeight + padding);

            const aspect = img.width / img.height;
            let drawH = charImgHeight;
            let drawW = drawH * aspect;

            if (drawW > charImgWidth) {
                drawW = charImgWidth;
                drawH = drawW / aspect;
            }

            const centerX = x + charWidth / 2;
            const centerY = y + charImgHeight / 2;

            finalCtx.drawImage(img, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
        });

        // 绘制分镜图
        finalCtx.drawImage(storyboardCanvas, charWidth, 0);
    }

    return finalCanvas.toDataURL('image/png', 0.95);
}
