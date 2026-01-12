/**
 * 全局应用状态管理 (使用 Zustand)
 *
 * 功能：
 * - 节点管理（增删改查）
 * - 连接管理
 * - 用户认证
 * - UI 状态管理
 * - LocalStorage 持久化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { AppNode, Connection, Workflow, NodeStatus } from '../types';

// 用户接口
export interface User {
  id: string;
  email: string;
  username: string;
  credits: number;
  subscriptionTier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  subscriptionExpiresAt?: string;
  avatarUrl?: string;
  language: string;
  createdAt: string;
  lastLoginAt?: string;
  emailVerified: boolean;
}

// 视口状态
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// UI 状态
export interface UIState {
  selectedNodeIds: string[];
  selectedConnectionIds: string[];
  isDragging: boolean;
  isConnecting: boolean;
  hoveredNodeId?: string;
  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    nodeId?: string;
  } | null;
}

// 应用状态接口
interface AppState {
  // 数据
  nodes: AppNode[];
  connections: Connection[];
  workflows: Workflow[];

  // 用户
  user: User | null;
  isAuthenticated: boolean;

  // UI
  viewport: Viewport;
  ui: UIState;

  // 节点操作
  addNode: (node: AppNode) => void;
  updateNode: (id: string, data: Partial<AppNode['data']>) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;
  duplicateNode: (id: string) => void;

  // 连接操作
  addConnection: (connection: Connection) => void;
  deleteConnection: (id: string) => void;
  deleteConnections: (ids: string[]) => void;

  // 批量操作
  setNodes: (nodes: AppNode[]) => void;
  setConnections: (connections: Connection[]) => void;

  // 工作流操作
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, data: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;

  // 用户操作
  setUser: (user: User | null) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateCredits: (amount: number) => void;

  // UI 操作
  setViewport: (viewport: Viewport) => void;
  setSelectedNodes: (ids: string[]) => void;
  setSelectedConnections: (ids: string[]) => void;
  setDragging: (isDragging: boolean) => void;
  setConnecting: (isConnecting: boolean) => void;
  setContextMenu: (menu: UIState['contextMenu']) => void;

  // 清空所有数据
  reset: () => void;
}

// 创建 store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      nodes: [],
      connections: [],
      workflows: [],
      user: null,
      isAuthenticated: false,
      viewport: { x: 0, y: 0, zoom: 1 },
      ui: {
        selectedNodeIds: [],
        selectedConnectionIds: [],
        isDragging: false,
        isConnecting: false,
        contextMenu: null
      },

      // ========== 节点操作 ==========
      addNode: (node) => set((state) => ({
        nodes: [...state.nodes, node]
      })),

      updateNode: (id, data) => set((state) => ({
        nodes: state.nodes.map(n =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n
        )
      })),

      deleteNode: (id) => set((state) => ({
        nodes: state.nodes.filter(n => n.id !== id),
        connections: state.connections.filter(c => c.from !== id && c.to !== id),
        ui: {
          ...state.ui,
          selectedNodeIds: state.ui.selectedNodeIds.filter(sid => sid !== id)
        }
      })),

      deleteNodes: (ids) => set((state) => ({
        nodes: state.nodes.filter(n => !ids.includes(n.id)),
        connections: state.connections.filter(c =>
          !ids.includes(c.from) && !ids.includes(c.to)
        ),
        ui: {
          ...state.ui,
          selectedNodeIds: state.ui.selectedNodeIds.filter(sid => !ids.includes(sid))
        }
      })),

      duplicateNode: (id) => set((state) => {
        const node = state.nodes.find(n => n.id === id);
        if (!node) return;

        const newNode: AppNode = {
          ...node,
          id: `${node.id}-copy-${Date.now()}`,
          title: `${node.title} (副本)`,
          x: node.x + 50,
          y: node.y + 50
        };

        return { nodes: [...state.nodes, newNode] };
      }),

      // ========== 连接操作 ==========
      addConnection: (connection) => set((state) => ({
        connections: [...state.connections, connection]
      })),

      deleteConnection: (id) => set((state) => ({
        connections: state.connections.filter(c => c.id !== id),
        ui: {
          ...state.ui,
          selectedConnectionIds: state.ui.selectedConnectionIds.filter(sid => sid !== id)
        }
      })),

      deleteConnections: (ids) => set((state) => ({
        connections: state.connections.filter(c => !ids.includes(c.id)),
        ui: {
          ...state.ui,
          selectedConnectionIds: state.ui.selectedConnectionIds.filter(sid => !ids.includes(sid))
        }
      })),

      // ========== 批量操作 ==========
      setNodes: (nodes) => set({ nodes }),

      setConnections: (connections) => set({ connections }),

      // ========== 工作流操作 ==========
      setWorkflows: (workflows) => set({ workflows }),

      addWorkflow: (workflow) => set((state) => ({
        workflows: [...state.workflows, workflow]
      })),

      updateWorkflow: (id, data) => set((state) => ({
        workflows: state.workflows.map(w =>
          w.id === id ? { ...w, ...data } : w
        )
      })),

      deleteWorkflow: (id) => set((state) => ({
        workflows: state.workflows.filter(w => w.id !== id)
      })),

      // ========== 用户操作 ==========
      setUser: (user) => set({
        user,
        isAuthenticated: !!user
      }),

      login: (user, accessToken, refreshToken) => {
        // 保存 tokens 到 localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        set({
          user,
          isAuthenticated: true
        });
      },

      logout: () => {
        // 清除 tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');

        set({
          user: null,
          isAuthenticated: false
        });
      },

      updateCredits: (amount) => set((state) => ({
        user: state.user ? {
          ...state.user,
          credits: state.user.credits + amount
        } : null
      })),

      // ========== UI 操作 ==========
      setViewport: (viewport) => set({ viewport }),

      setSelectedNodes: (ids) => set((state) => ({
        ui: { ...state.ui, selectedNodeIds: ids }
      })),

      setSelectedConnections: (ids) => set((state) => ({
        ui: { ...state.ui, selectedConnectionIds: ids }
      })),

      setDragging: (isDragging) => set((state) => ({
        ui: { ...state.ui, isDragging }
      })),

      setConnecting: (isConnecting) => set((state) => ({
        ui: { ...state.ui, isConnecting }
      })),

      setContextMenu: (menu) => set((state) => ({
        ui: { ...state.ui, contextMenu: menu }
      })),

      // ========== 清空 ==========
      reset: () => set({
        nodes: [],
        connections: [],
        workflows: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        ui: {
          selectedNodeIds: [],
          selectedConnectionIds: [],
          isDragging: false,
          isConnecting: false,
          contextMenu: null
        }
      })
    }),
    {
      name: 'aiyou-storage', // LocalStorage key
      partialize: (state) => ({
        // 只持久化部分状态
        nodes: state.nodes,
        connections: state.connections,
        workflows: state.workflows,
        viewport: state.viewport
      })
    }
  )
);

// ========== 选择器 hooks（优化性能）==========

export const useNodes = () => useAppStore((state) => state.nodes);
export const useConnections = () => useAppStore((state) => state.connections);
export const useWorkflows = () => useAppStore((state) => state.workflows);
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useViewport = () => useAppStore((state) => state.viewport);
export const useSelectedNodes = () => useAppStore((state) => state.ui.selectedNodeIds);
export const useSelectedConnections = () => useAppStore((state) => state.ui.selectedConnectionIds);

// 组合选择器
export const useNodeById = (id: string) => {
  return useAppStore((state) => state.nodes.find(n => n.id === id));
};

export const useNodesByIds = (ids: string[]) => {
  return useAppStore((state) =>
    state.nodes.filter(n => ids.includes(n.id))
  );
};
