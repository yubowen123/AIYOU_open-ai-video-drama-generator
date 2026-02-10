import { describe, it, expect } from 'vitest';
import { NodeType } from '../types';
import {
  getNodeNameCN,
  getNodeColor,
  getApproxNodeHeight,
  getNodeBounds,
  nodesOverlap,
  findNearestFreePosition,
  snapToGrid,
  magneticSnap,
} from './nodeHelpers';

const makeNode = (overrides: Record<string, any> = {}) => ({
  id: 'test-1',
  type: NodeType.PROMPT_INPUT,
  x: 0,
  y: 0,
  width: 420,
  height: 360,
  title: 'Test',
  status: 'IDLE' as const,
  data: {},
  inputs: [],
  ...overrides,
});

describe('getNodeNameCN', () => {
  it('returns Chinese name for known node types', () => {
    expect(getNodeNameCN(NodeType.PROMPT_INPUT)).toBe('创意描述');
    expect(getNodeNameCN(NodeType.IMAGE_GENERATOR)).toBe('文字生图');
    expect(getNodeNameCN(NodeType.VIDEO_GENERATOR)).toBe('文生视频');
    expect(getNodeNameCN(NodeType.AUDIO_GENERATOR)).toBe('灵感音乐');
    expect(getNodeNameCN(NodeType.SCRIPT_PLANNER)).toBe('剧本大纲');
    expect(getNodeNameCN(NodeType.CHARACTER_NODE)).toBe('角色设计');
  });

  it('returns the type string for unknown types', () => {
    expect(getNodeNameCN('UNKNOWN_TYPE' as NodeType)).toBe('UNKNOWN_TYPE');
  });
});

describe('getNodeColor', () => {
  it('returns hex color for known types', () => {
    expect(getNodeColor(NodeType.PROMPT_INPUT)).toBe('#6366f1');
    expect(getNodeColor(NodeType.IMAGE_GENERATOR)).toBe('#10b981');
  });

  it('returns default color for unknown types', () => {
    expect(getNodeColor('UNKNOWN' as NodeType)).toBe('#6366f1');
  });
});

describe('getApproxNodeHeight', () => {
  it('returns explicit height if set', () => {
    const node = makeNode({ height: 500 });
    expect(getApproxNodeHeight(node)).toBe(500);
  });

  it('returns base height for type when no explicit height', () => {
    const node = makeNode({ height: undefined });
    expect(getApproxNodeHeight(node)).toBe(320); // PROMPT_INPUT base
  });

  it('adds extra height for storyboard shots', () => {
    const node = makeNode({
      height: undefined,
      data: { storyboardShots: [{ id: '1' }, { id: '2' }] },
    });
    expect(getApproxNodeHeight(node)).toBe(320 + 2 * 40);
  });

  it('adds extra height for generated characters', () => {
    const node = makeNode({
      height: undefined,
      type: NodeType.CHARACTER_NODE,
      data: { generatedCharacters: [{ name: 'A' }, { name: 'B' }] },
    });
    expect(getApproxNodeHeight(node)).toBe(520 + 2 * 60);
  });
});

describe('getNodeBounds', () => {
  it('returns correct bounds', () => {
    const node = makeNode({ x: 100, y: 200, width: 420, height: 360 });
    const bounds = getNodeBounds(node);
    expect(bounds.x).toBe(100);
    expect(bounds.y).toBe(200);
    expect(bounds.width).toBe(420);
    expect(bounds.right).toBe(520);
    expect(bounds.bottom).toBe(560);
  });

  it('uses default width when not set', () => {
    const node = makeNode({ x: 0, y: 0, width: undefined, height: 300 });
    const bounds = getNodeBounds(node);
    expect(bounds.width).toBe(420);
    expect(bounds.right).toBe(420);
  });
});

describe('nodesOverlap', () => {
  it('detects overlapping nodes', () => {
    const node1 = makeNode({ x: 0, y: 0, width: 420, height: 360 });
    const node2 = makeNode({ id: 'test-2', x: 200, y: 200, width: 420, height: 360 });
    expect(nodesOverlap(node1, node2)).toBe(true);
  });

  it('detects non-overlapping nodes', () => {
    const node1 = makeNode({ x: 0, y: 0, width: 420, height: 360 });
    const node2 = makeNode({ id: 'test-2', x: 1000, y: 1000, width: 420, height: 360 });
    expect(nodesOverlap(node1, node2)).toBe(false);
  });

  it('respects padding', () => {
    const node1 = makeNode({ x: 0, y: 0, width: 100, height: 100 });
    const node2 = makeNode({ id: 'test-2', x: 110, y: 0, width: 100, height: 100 });
    expect(nodesOverlap(node1, node2, 0)).toBe(false);
    expect(nodesOverlap(node1, node2, 20)).toBe(true);
  });
});

describe('findNearestFreePosition', () => {
  it('returns original position when no overlap', () => {
    const result = findNearestFreePosition(0, 0, []);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('finds alternative position when overlapping', () => {
    const existing = [makeNode({ x: 0, y: 0, width: 420, height: 360 })];
    const result = findNearestFreePosition(0, 0, existing);
    expect(result.x !== 0 || result.y !== 0).toBe(true);
  });
});

describe('snapToGrid', () => {
  it('snaps to nearest grid point', () => {
    expect(snapToGrid(17, 16)).toBe(16);
    expect(snapToGrid(24, 16)).toBe(32);
    expect(snapToGrid(0, 16)).toBe(0);
    expect(snapToGrid(8, 16)).toBe(16);
  });

  it('uses default grid size of 16', () => {
    expect(snapToGrid(10)).toBe(16);
    expect(snapToGrid(7)).toBe(0);
  });
});

describe('magneticSnap', () => {
  it('snaps to target within threshold', () => {
    expect(magneticSnap(103, [100, 200], 8)).toBe(100);
    expect(magneticSnap(197, [100, 200], 8)).toBe(200);
  });

  it('returns original value when no target within threshold', () => {
    expect(magneticSnap(150, [100, 200], 8)).toBe(150);
  });

  it('snaps to first matching target', () => {
    expect(magneticSnap(101, [100, 102], 8)).toBe(100);
  });

  it('uses default threshold of 8', () => {
    expect(magneticSnap(107, [100])).toBe(100);
    expect(magneticSnap(109, [100])).toBe(109);
  });
});
