import { describe, it, expect } from 'vitest';
import { NodeType, Connection, NodeStatus } from '../types';
import {
  validateConnection,
  canExecuteNode,
  getAllowedOutputTypes,
  getAllowedInputTypes,
  canConnectNodeTypes,
  NODE_DEPENDENCY_RULES,
} from './nodeValidation';

const makeNode = (overrides: Record<string, any> = {}) => ({
  id: 'node-1',
  type: NodeType.PROMPT_INPUT,
  x: 0,
  y: 0,
  width: 420,
  height: 360,
  title: 'Test Node',
  status: NodeStatus.IDLE,
  data: {},
  inputs: [],
  ...overrides,
});

const makeConnection = (from: string, to: string): Connection => ({
  from,
  to,
});

describe('validateConnection', () => {
  it('allows valid connection (PROMPT_INPUT → IMAGE_GENERATOR)', () => {
    const from = makeNode({ id: 'a', type: NodeType.PROMPT_INPUT, title: 'Prompt' });
    const to = makeNode({ id: 'b', type: NodeType.IMAGE_GENERATOR, title: 'Image' });
    const result = validateConnection(from, to, []);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid connection (AUDIO_GENERATOR → IMAGE_GENERATOR)', () => {
    const from = makeNode({ id: 'a', type: NodeType.AUDIO_GENERATOR, title: 'Audio' });
    const to = makeNode({ id: 'b', type: NodeType.IMAGE_GENERATOR, title: 'Image' });
    const result = validateConnection(from, to, []);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects self-connection', () => {
    const node = makeNode({ id: 'a', type: NodeType.IMAGE_GENERATOR, title: 'Image' });
    const result = validateConnection(node, node, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('循环');
  });

  it('rejects duplicate connection', () => {
    const from = makeNode({ id: 'a', type: NodeType.PROMPT_INPUT, title: 'Prompt' });
    const to = makeNode({ id: 'b', type: NodeType.IMAGE_GENERATOR, title: 'Image' });
    const existing = [makeConnection('a', 'b')];
    const result = validateConnection(from, to, existing);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('已存在');
  });

  it('rejects when max inputs exceeded', () => {
    const from = makeNode({ id: 'c', type: NodeType.SCRIPT_PLANNER, title: 'Planner' });
    const to = makeNode({ id: 'b', type: NodeType.SCRIPT_EPISODE, title: 'Episode' });
    // SCRIPT_EPISODE maxInputs = 1, already has one connection
    const existing = [makeConnection('a', 'b')];
    const result = validateConnection(from, to, existing);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('最多');
  });

  it('rejects circular dependency', () => {
    const nodeA = makeNode({ id: 'a', type: NodeType.IMAGE_GENERATOR, title: 'Image A' });
    const nodeB = makeNode({ id: 'b', type: NodeType.VIDEO_GENERATOR, title: 'Video B' });
    // A → B already exists, trying B → A would create a cycle
    // But VIDEO_GENERATOR can't output to IMAGE_GENERATOR, so this would fail on type check first
    // Let's use IMAGE_GENERATOR → IMAGE_GENERATOR chain
    const nodeC = makeNode({ id: 'c', type: NodeType.IMAGE_GENERATOR, title: 'Image C' });
    // a → b, b → c, now try c → a
    const existing = [makeConnection('a', 'b'), makeConnection('b', 'c')];
    const result = validateConnection(nodeC, nodeA, existing);
    expect(result.valid).toBe(false);
  });
});

describe('canExecuteNode', () => {
  it('allows execution when requirements met', () => {
    const node = makeNode({
      id: 'a',
      type: NodeType.PROMPT_INPUT,
      data: { prompt: 'test' },
    });
    const result = canExecuteNode(node, []);
    expect(result.valid).toBe(true);
  });

  it('rejects IMAGE_GENERATOR without prompt or input', () => {
    const node = makeNode({
      id: 'a',
      type: NodeType.IMAGE_GENERATOR,
      data: {},
    });
    const result = canExecuteNode(node, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('提示词');
  });

  it('allows IMAGE_GENERATOR with prompt', () => {
    const node = makeNode({
      id: 'a',
      type: NodeType.IMAGE_GENERATOR,
      data: { prompt: 'a cat' },
    });
    const result = canExecuteNode(node, []);
    expect(result.valid).toBe(true);
  });

  it('allows IMAGE_GENERATOR with input connection', () => {
    const node = makeNode({
      id: 'a',
      type: NodeType.IMAGE_GENERATOR,
      data: {},
    });
    const connections = [makeConnection('b', 'a')];
    const result = canExecuteNode(node, connections);
    expect(result.valid).toBe(true);
  });

  it('rejects SCRIPT_PLANNER without theme', () => {
    const node = makeNode({
      id: 'a',
      type: NodeType.SCRIPT_PLANNER,
      data: {},
    });
    const result = canExecuteNode(node, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('主题');
  });

  it('rejects CHARACTER_NODE without input', () => {
    const node = makeNode({
      id: 'a',
      type: NodeType.CHARACTER_NODE,
      data: {},
    });
    const result = canExecuteNode(node, []);
    expect(result.valid).toBe(false);
  });

  it('allows CHARACTER_NODE with input', () => {
    const node = makeNode({
      id: 'a',
      type: NodeType.CHARACTER_NODE,
      data: {},
    });
    const connections = [makeConnection('b', 'a')];
    const result = canExecuteNode(node, connections);
    expect(result.valid).toBe(true);
  });
});

describe('canConnectNodeTypes', () => {
  it('returns true for valid type pairs', () => {
    expect(canConnectNodeTypes(NodeType.PROMPT_INPUT, NodeType.IMAGE_GENERATOR)).toBe(true);
    expect(canConnectNodeTypes(NodeType.IMAGE_GENERATOR, NodeType.VIDEO_GENERATOR)).toBe(true);
    expect(canConnectNodeTypes(NodeType.SCRIPT_PLANNER, NodeType.SCRIPT_EPISODE)).toBe(true);
  });

  it('returns false for invalid type pairs', () => {
    expect(canConnectNodeTypes(NodeType.AUDIO_GENERATOR, NodeType.IMAGE_GENERATOR)).toBe(false);
    expect(canConnectNodeTypes(NodeType.SCRIPT_EPISODE, NodeType.PROMPT_INPUT)).toBe(false);
  });
});

describe('getAllowedOutputTypes', () => {
  it('returns correct outputs for PROMPT_INPUT', () => {
    const outputs = getAllowedOutputTypes(NodeType.PROMPT_INPUT);
    expect(outputs).toContain(NodeType.IMAGE_GENERATOR);
    expect(outputs).toContain(NodeType.VIDEO_GENERATOR);
    expect(outputs).toContain(NodeType.SCRIPT_PLANNER);
    expect(outputs).not.toContain(NodeType.PROMPT_INPUT);
  });

  it('returns empty array for terminal nodes', () => {
    const outputs = getAllowedOutputTypes(NodeType.AUDIO_GENERATOR);
    expect(outputs).toEqual([]);
  });
});

describe('getAllowedInputTypes', () => {
  it('returns correct inputs for IMAGE_GENERATOR', () => {
    const inputs = getAllowedInputTypes(NodeType.IMAGE_GENERATOR);
    expect(inputs).toContain(NodeType.PROMPT_INPUT);
    expect(inputs).toContain(NodeType.IMAGE_GENERATOR);
    expect(inputs).toContain(NodeType.STYLE_PRESET);
  });

  it('returns empty array for source nodes', () => {
    const inputs = getAllowedInputTypes(NodeType.PROMPT_INPUT);
    expect(inputs).toEqual([]);
  });
});

describe('NODE_DEPENDENCY_RULES', () => {
  it('has rules for all node types', () => {
    const allTypes = Object.values(NodeType);
    for (const type of allTypes) {
      expect(NODE_DEPENDENCY_RULES[type]).toBeDefined();
      expect(NODE_DEPENDENCY_RULES[type].description).toBeTruthy();
    }
  });

  it('has rules defined for common node types', () => {
    expect(NODE_DEPENDENCY_RULES[NodeType.PROMPT_INPUT]).toBeDefined();
    expect(NODE_DEPENDENCY_RULES[NodeType.IMAGE_GENERATOR]).toBeDefined();
    expect(NODE_DEPENDENCY_RULES[NodeType.VIDEO_GENERATOR]).toBeDefined();
    expect(NODE_DEPENDENCY_RULES[NodeType.SCRIPT_PLANNER]).toBeDefined();
    expect(NODE_DEPENDENCY_RULES[NodeType.CHARACTER_NODE]).toBeDefined();
  });
});
