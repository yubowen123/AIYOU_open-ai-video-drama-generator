/**
 * 节点服务注册表
 * 管理所有节点服务的注册、获取和执行
 */

import { AppNode, Connection, NodeType } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';

/**
 * 节点服务类型映射
 */
type NodeServiceClass = new () => BaseNodeService;

/**
 * 节点服务注册表（单例）
 */
class NodeServiceRegistryClass {
  private services: Map<string, NodeServiceClass> = new Map();
  private instances: Map<string, BaseNodeService> = new Map();

  /**
   * 注册节点服务
   * @param nodeType - 节点类型
   * @param serviceClass - 节点服务类
   */
  register(nodeType: string, serviceClass: NodeServiceClass): void {
    this.services.set(nodeType, serviceClass);
    console.log(`✓ 已注册节点服务: ${nodeType}`);
  }

  /**
   * 获取节点服务实例（单例模式）
   * @param nodeType - 节点类型
   * @returns 节点服务实例
   */
  get(nodeType: string): BaseNodeService | null {
    // 如果已有实例，直接返回
    if (this.instances.has(nodeType)) {
      return this.instances.get(nodeType)!;
    }

    // 如果服务类已注册，创建新实例
    const ServiceClass = this.services.get(nodeType);
    if (!ServiceClass) {
      console.warn(`未找到节点服务: ${nodeType}`);
      return null;
    }

    // 创建并缓存实例
    const instance = new ServiceClass();
    this.instances.set(nodeType, instance);
    return instance;
  }

  /**
   * 检查节点服务是否已注册
   * @param nodeType - 节点类型
   * @returns 是否已注册
   */
  has(nodeType: string): boolean {
    return this.services.has(nodeType);
  }

  /**
   * 获取所有已注册的节点类型
   * @returns 节点类型数组
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * 执行节点
   * @param node - 要执行的节点
   * @param allNodes - 所有节点列表
   * @param connections - 所有连接列表
   * @param updateNodeStatus - 更新节点状态的回调
   * @param updateNodeData - 更新节点数据的回调
   * @returns Promise<NodeExecutionResult>
   */
  async executeNode(
    node: AppNode,
    allNodes: AppNode[],
    connections: Connection[],
    updateNodeStatus: (nodeId: string, status: string) => void,
    updateNodeData: (nodeId: string, data: any) => void
  ): Promise<NodeExecutionResult> {
    // 获取节点服务
    const service = this.get(node.type);
    if (!service) {
      return {
        success: false,
        error: `未找到节点服务: ${node.type}`,
        status: 'error'
      };
    }

    // 创建执行上下文
    const context: NodeExecutionContext = {
      nodeId: node.id,
      nodes: allNodes,
      connections,
      getInputData: (fromNodeId: string, outputKey?: string) => {
        const sourceNode = allNodes.find(n => n.id === fromNodeId);
        if (!sourceNode) return null;

        // 如果指定了输出键，返回对应的数据
        if (outputKey) {
          return sourceNode.data[outputKey];
        }

        // 否则返回整个数据对象
        return sourceNode.data;
      },
      updateNodeStatus,
      updateNodeData
    };

    // 执行节点
    return service.executeNode(node, context);
  }

  /**
   * 批量执行节点（按照依赖顺序）
   * 使用拓扑排序确保节点按照正确的顺序执行
   * @param nodes - 要执行的节点列表
   * @param connections - 所有连接列表
   * @param updateNodeStatus - 更新节点状态的回调
   * @param updateNodeData - 更新节点数据的回调
   * @param onProgress - 进度回调 (current: number, total: number)
   * @returns Promise<{ success: number, failed: number, results: Map<string, NodeExecutionResult> }>
   */
  async executeNodesInOrder(
    nodes: AppNode[],
    connections: Connection[],
    updateNodeStatus: (nodeId: string, status: string) => void,
    updateNodeData: (nodeId: string, data: any) => void,
    onProgress?: (current: number, total: number, currentNode: string) => void
  ): Promise<{
    success: number;
    failed: number;
    results: Map<string, NodeExecutionResult>;
  }> {
    const results = new Map<string, NodeExecutionResult>();
    let successCount = 0;
    let failedCount = 0;

    // 构建依赖图
    const dependencies = new Map<string, string[]>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    nodes.forEach(node => {
      const deps = connections
        .filter(c => c.to === node.id)
        .map(c => c.from);
      dependencies.set(node.id, deps);
    });

    // 拓扑排序
    const sortedNodes = this.topologicalSort(Array.from(nodeMap.keys()), dependencies);

    // 按顺序执行节点
    for (let i = 0; i < sortedNodes.length; i++) {
      const nodeId = sortedNodes[i];
      const node = nodeMap.get(nodeId);

      if (!node) continue;

      // 执行节点
      const result = await this.executeNode(
        node,
        nodes,
        connections,
        updateNodeStatus,
        updateNodeData
      );

      results.set(nodeId, result);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      // 进度回调
      if (onProgress) {
        onProgress(i + 1, sortedNodes.length, node.title || node.id);
      }
    }

    return { success: successCount, failed: failedCount, results };
  }

  /**
   * 拓扑排序（Kahn算法）
   * 用于确定节点的执行顺序
   * @param nodes - 节点ID数组
   * @param dependencies - 依赖关系 Map<nodeId, dependentNodeIds[]>
   * @returns 排序后的节点ID数组
   */
  private topologicalSort(
    nodes: string[],
    dependencies: Map<string, string[]>
  ): string[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    const result: string[] = [];

    // 初始化
    nodes.forEach(node => {
      inDegree.set(node, 0);
      adjList.set(node, []);
    });

    // 构建邻接表和入度
    nodes.forEach(node => {
      const deps = dependencies.get(node) || [];
      deps.forEach(dep => {
        adjList.get(dep)!.push(node);
        inDegree.set(node, inDegree.get(node)! + 1);
      });
    });

    // 找到所有入度为0的节点
    const queue: string[] = [];
    inDegree.forEach((degree, node) => {
      if (degree === 0) {
        queue.push(node);
      }
    });

    // BFS
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = adjList.get(node) || [];
      neighbors.forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }

    return result;
  }

  /**
   * 清除所有服务实例（用于测试或重置）
   */
  clear(): void {
    this.instances.clear();
    this.services.clear();
  }
}

// 导出单例
export const NodeServiceRegistry = new NodeServiceRegistryClass();

// 导出类型和基类
export { BaseNodeService, NodeExecutionContext, NodeExecutionResult, NodeStatus };
