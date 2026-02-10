/**
 * Editor Store - 管理画布编辑器/交互状态
 *
 * @developer 光波 (a@ggbo.com)
 * @description 从 App.tsx 的 42 个 useState 中迁移出编辑器核心数据和交互状态
 */

import { create } from 'zustand';
import type { AppNode, Connection, Group, Workflow } from '../types';

interface EditorState {
  // Core data
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
  workflows: Workflow[];
  assetHistory: any[];

  // Selection & workflow
  selectedWorkflowId: string | null;
  isLoaded: boolean;
  clipboard: AppNode | null;
  selectedNodeIds: string[];
  selectedGroupId: string | null;

  // Drag state
  draggingNodeId: string | null;
  draggingNodeParentGroupId: string | null;
  draggingGroup: any;

  // Resize state
  resizingGroupId: string | null;
  resizingNodeId: string | null;
  initialSize: { width: number; height: number } | null;
  resizeStartPos: { x: number; y: number } | null;

  // Group & connection interaction
  activeGroupNodeIds: string[];
  connectionStart: { id: string; x: number; y: number } | null;
  selectionRect: any;

  // Actions - core data (support both direct value and updater function)
  setNodes: (nodes: AppNode[] | ((prev: AppNode[]) => AppNode[])) => void;
  updateNode: (id: string, data: Partial<AppNode['data']>) => void;
  setConnections: (connections: Connection[] | ((prev: Connection[]) => Connection[])) => void;
  setGroups: (groups: Group[] | ((prev: Group[]) => Group[])) => void;
  setWorkflows: (workflows: Workflow[] | ((prev: Workflow[]) => Workflow[])) => void;
  setAssetHistory: (assetHistory: any[] | ((prev: any[]) => any[])) => void;

  // Actions - selection & workflow
  setSelectedWorkflowId: (v: string | null) => void;
  setIsLoaded: (v: boolean) => void;
  setClipboard: (v: AppNode | null) => void;
  setSelectedNodeIds: (v: string[] | ((prev: string[]) => string[])) => void;
  setSelectedGroupId: (v: string | null) => void;

  // Actions - drag
  setDraggingNodeId: (v: string | null) => void;
  setDraggingNodeParentGroupId: (v: string | null) => void;
  setDraggingGroup: (v: any) => void;

  // Actions - resize
  setResizingGroupId: (v: string | null) => void;
  setResizingNodeId: (v: string | null) => void;
  setInitialSize: (v: { width: number; height: number } | null) => void;
  setResizeStartPos: (v: { x: number; y: number } | null) => void;

  // Actions - group & connection interaction
  setActiveGroupNodeIds: (v: string[]) => void;
  setConnectionStart: (v: { id: string; x: number; y: number } | null) => void;
  setSelectionRect: (v: any) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  // Initial values - core data
  nodes: [],
  connections: [],
  groups: [],
  workflows: [],
  assetHistory: [],

  // Initial values - selection & workflow
  selectedWorkflowId: null,
  isLoaded: false,
  clipboard: null,
  selectedNodeIds: [],
  selectedGroupId: null,

  // Initial values - drag
  draggingNodeId: null,
  draggingNodeParentGroupId: null,
  draggingGroup: null,

  // Initial values - resize
  resizingGroupId: null,
  resizingNodeId: null,
  initialSize: null,
  resizeStartPos: null,

  // Initial values - group & connection interaction
  activeGroupNodeIds: [],
  connectionStart: null,
  selectionRect: null,

  // Actions - core data (support both direct value and updater function)
  setNodes: (nodes) => set((state) => ({
    nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
  })),
  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),
  setConnections: (connections) => set((state) => ({
    connections: typeof connections === 'function' ? connections(state.connections) : connections,
  })),
  setGroups: (groups) => set((state) => ({
    groups: typeof groups === 'function' ? groups(state.groups) : groups,
  })),
  setWorkflows: (workflows) => set((state) => ({
    workflows: typeof workflows === 'function' ? workflows(state.workflows) : workflows,
  })),
  setAssetHistory: (assetHistory) => set((state) => ({
    assetHistory: typeof assetHistory === 'function' ? assetHistory(state.assetHistory) : assetHistory,
  })),

  // Actions - selection & workflow
  setSelectedWorkflowId: (v) => set({ selectedWorkflowId: v }),
  setIsLoaded: (v) => set({ isLoaded: v }),
  setClipboard: (v) => set({ clipboard: v }),
  setSelectedNodeIds: (v) => set((state) => ({
    selectedNodeIds: typeof v === 'function' ? v(state.selectedNodeIds) : v,
  })),
  setSelectedGroupId: (v) => set({ selectedGroupId: v }),

  // Actions - drag
  setDraggingNodeId: (v) => set({ draggingNodeId: v }),
  setDraggingNodeParentGroupId: (v) => set({ draggingNodeParentGroupId: v }),
  setDraggingGroup: (v) => set({ draggingGroup: v }),

  // Actions - resize
  setResizingGroupId: (v) => set({ resizingGroupId: v }),
  setResizingNodeId: (v) => set({ resizingNodeId: v }),
  setInitialSize: (v) => set({ initialSize: v }),
  setResizeStartPos: (v) => set({ resizeStartPos: v }),

  // Actions - group & connection interaction
  setActiveGroupNodeIds: (v) => set({ activeGroupNodeIds: v }),
  setConnectionStart: (v) => set({ connectionStart: v }),
  setSelectionRect: (v) => set({ selectionRect: v }),
}));
