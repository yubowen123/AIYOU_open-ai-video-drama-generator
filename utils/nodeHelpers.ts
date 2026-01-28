// utils/nodeHelpers.ts
import { AppNode, NodeType } from '../types';
import {
  Type,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  ScanFace,
  Brush,
  ScrollText,
  Clapperboard,
  User,
  BookOpen,
  Film,
  Sparkles,
  Palette,
  Grid,
  Wand2
} from 'lucide-react';

/**
 * 节点辅助函数集合
 */

/**
 * 获取节点中文名称
 */
export function getNodeNameCN(type: NodeType): string {
  switch (type) {
    case NodeType.PROMPT_INPUT: return '创意描述';
    case NodeType.IMAGE_GENERATOR: return '文字生图';
    case NodeType.VIDEO_GENERATOR: return '文生视频';
    case NodeType.AUDIO_GENERATOR: return '灵感音乐';
    case NodeType.VIDEO_ANALYZER: return '视频分析';
    case NodeType.IMAGE_EDITOR: return '图像编辑';
    case NodeType.SCRIPT_PLANNER: return '剧本大纲';
    case NodeType.SCRIPT_EPISODE: return '剧本分集';
    case NodeType.STORYBOARD_GENERATOR: return '分镜生成';
    case NodeType.STORYBOARD_IMAGE: return '分镜图设计';
    case NodeType.STORYBOARD_SPLITTER: return '分镜图拆解';
    case NodeType.SORA_VIDEO_GENERATOR: return 'Sora 2 视频';
    case NodeType.SORA_VIDEO_CHILD: return 'Sora 2 视频结果';
    case NodeType.STORYBOARD_VIDEO_GENERATOR: return '分镜视频生成';
    case NodeType.STORYBOARD_VIDEO_CHILD: return '分镜视频结果';
    case NodeType.CHARACTER_NODE: return '角色设计';
    case NodeType.DRAMA_ANALYZER: return '剧目分析';
    case NodeType.DRAMA_REFINED: return '剧目精炼';
    case NodeType.STYLE_PRESET: return '全局风格';
    default: return type;
  }
}

/**
 * 获取节点图标
 */
export function getNodeIcon(type: NodeType) {
  const icons: Record<NodeType, any> = {
    [NodeType.PROMPT_INPUT]: Type,
    [NodeType.IMAGE_GENERATOR]: ImageIcon,
    [NodeType.VIDEO_GENERATOR]: VideoIcon,
    [NodeType.AUDIO_GENERATOR]: Music,
    [NodeType.VIDEO_ANALYZER]: ScanFace,
    [NodeType.IMAGE_EDITOR]: Brush,
    [NodeType.SCRIPT_PLANNER]: ScrollText,
    [NodeType.SCRIPT_EPISODE]: BookOpen,
    [NodeType.STORYBOARD_GENERATOR]: Clapperboard,
    [NodeType.STORYBOARD_IMAGE]: Clapperboard,
    [NodeType.STORYBOARD_SPLITTER]: Grid,
    [NodeType.SORA_VIDEO_GENERATOR]: Wand2,
    [NodeType.CHARACTER_NODE]: User,
    [NodeType.DRAMA_ANALYZER]: Film,
    [NodeType.DRAMA_REFINED]: Sparkles,
    [NodeType.STYLE_PRESET]: Palette,
    [NodeType.STORYBOARD_VIDEO_GENERATOR]: Film,
    [NodeType.STORYBOARD_VIDEO_CHILD]: VideoIcon
  };

  return icons[type] || Type;
}

/**
 * 获取节点颜色
 */
export function getNodeColor(type: NodeType): string {
  const colors: Record<NodeType, string> = {
    [NodeType.PROMPT_INPUT]: '#6366f1',
    [NodeType.IMAGE_GENERATOR]: '#10b981',
    [NodeType.VIDEO_GENERATOR]: '#8b5cf6',
    [NodeType.AUDIO_GENERATOR]: '#f59e0b',
    [NodeType.VIDEO_ANALYZER]: '#06b6d4',
    [NodeType.IMAGE_EDITOR]: '#ec4899',
    [NodeType.SCRIPT_PLANNER]: '#3b82f6',
    [NodeType.SCRIPT_EPISODE]: '#14b8a6',
    [NodeType.STORYBOARD_GENERATOR]: '#a855f7',
    [NodeType.STORYBOARD_IMAGE]: '#a855f7',
    [NodeType.STORYBOARD_SPLITTER]: '#3b82f6',  // Blue color for analysis/processing
    [NodeType.SORA_VIDEO_GENERATOR]: '#10b981',  // Green color for Sora video generation
    [NodeType.SORA_VIDEO_CHILD]: '#10b981',
    [NodeType.CHARACTER_NODE]: '#f97316',
    [NodeType.DRAMA_ANALYZER]: '#7c3aed',
    [NodeType.DRAMA_REFINED]: '#06b6d4',
    [NodeType.STYLE_PRESET]: '#a855f7',
    [NodeType.STORYBOARD_VIDEO_GENERATOR]: '#a855f7',  // Purple color for storyboard video generator
    [NodeType.STORYBOARD_VIDEO_CHILD]: '#a855f7'
  };

  return colors[type] || '#6366f1';
}

/**
 * 估算节点高度
 */
export function getApproxNodeHeight(node: AppNode): number {
  if (node.height) return node.height;

  // 根据节点类型估算默认高度
  const baseHeights: Record<NodeType, number> = {
    [NodeType.PROMPT_INPUT]: 320,
    [NodeType.IMAGE_GENERATOR]: 360,
    [NodeType.VIDEO_GENERATOR]: 400,
    [NodeType.AUDIO_GENERATOR]: 300,
    [NodeType.VIDEO_ANALYZER]: 360,
    [NodeType.IMAGE_EDITOR]: 360,
    [NodeType.SCRIPT_PLANNER]: 480,
    [NodeType.SCRIPT_EPISODE]: 420,
    [NodeType.STORYBOARD_GENERATOR]: 500,
    [NodeType.STORYBOARD_IMAGE]: 600,
    [NodeType.STORYBOARD_SPLITTER]: 700,  // Taller for list display
    [NodeType.SORA_VIDEO_GENERATOR]: 700,  // Taller for task groups list
    [NodeType.SORA_VIDEO_CHILD]: 500,  // Medium height for video display
    [NodeType.CHARACTER_NODE]: 520,
    [NodeType.DRAMA_ANALYZER]: 600,
    [NodeType.DRAMA_REFINED]: 400,
    [NodeType.STYLE_PRESET]: 420,
    [NodeType.STORYBOARD_VIDEO_GENERATOR]: 720,  // Taller for 5-phase state machine
    [NodeType.STORYBOARD_VIDEO_CHILD]: 480  // Medium height for video + prompt display
  };

  let height = baseHeights[node.type] || 360;

  // 根据内容调整高度
  if (node.data.images && node.data.images.length > 1) {
    height += 50; // 多图展示需要更多空间
  }

  if (node.data.videoUris && node.data.videoUris.length > 1) {
    height += 50; // 多视频展示需要更多空间
  }

  if (node.data.storyboardShots && node.data.storyboardShots.length > 0) {
    height += node.data.storyboardShots.length * 40; // 每个分镜增加高度
  }

  if (node.data.generatedCharacters && node.data.generatedCharacters.length > 0) {
    height += node.data.generatedCharacters.length * 60; // 每个角色增加高度
  }

  if (node.data.splitShots && node.data.splitShots.length > 0) {
    height += node.data.splitShots.length * 30; // 每个拆解的分镜增加高度
  }

  if (node.data.taskGroups && node.data.taskGroups.length > 0) {
    height += node.data.taskGroups.length * 80; // 每个任务组增加高度
  }

  return height;
}

/**
 * 获取节点边界框
 */
export function getNodeBounds(node: AppNode) {
  const width = node.width || 420;
  const height = getApproxNodeHeight(node);

  return {
    x: node.x,
    y: node.y,
    width,
    height,
    right: node.x + width,
    bottom: node.y + height
  };
}

/**
 * 检查两个节点是否重叠
 */
export function nodesOverlap(node1: AppNode, node2: AppNode, padding = 0): boolean {
  const bounds1 = getNodeBounds(node1);
  const bounds2 = getNodeBounds(node2);

  return !(
    bounds1.right + padding < bounds2.x ||
    bounds1.x - padding > bounds2.right ||
    bounds1.bottom + padding < bounds2.y ||
    bounds1.y - padding > bounds2.bottom
  );
}

/**
 * 查找最近的可用位置 (避免重叠)
 */
export function findNearestFreePosition(
  x: number,
  y: number,
  existingNodes: AppNode[],
  width = 420,
  height = 360,
  padding = 24
): { x: number; y: number } {
  const testNode: AppNode = {
    id: 'test',
    type: NodeType.PROMPT_INPUT,
    x,
    y,
    width,
    height,
    title: '',
    status: 'IDLE' as any,
    data: {},
    inputs: []
  };

  // 检查是否与现有节点重叠
  let hasOverlap = existingNodes.some(node => nodesOverlap(testNode, node, padding));

  if (!hasOverlap) {
    return { x, y };
  }

  // 螺旋搜索可用位置
  const step = 50;
  let radius = step;
  let angle = 0;

  while (radius < 1000) {
    const testX = x + Math.cos(angle) * radius;
    const testY = y + Math.sin(angle) * radius;

    testNode.x = testX;
    testNode.y = testY;

    hasOverlap = existingNodes.some(node => nodesOverlap(testNode, node, padding));

    if (!hasOverlap) {
      return { x: testX, y: testY };
    }

    angle += Math.PI / 6; // 30度增量
    if (angle >= Math.PI * 2) {
      angle = 0;
      radius += step;
    }
  }

  // 如果找不到,返回原位置偏移
  return { x: x + 50, y: y + 50 };
}

/**
 * 对齐到网格
 */
export function snapToGrid(value: number, gridSize = 16): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * 磁性吸附检测
 */
export function magneticSnap(
  value: number,
  targets: number[],
  threshold = 8
): number {
  for (const target of targets) {
    if (Math.abs(value - target) < threshold) {
      return target;
    }
  }
  return value;
}
