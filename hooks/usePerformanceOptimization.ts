/**
 * 性能优化相关的工具函数和hooks
 */

import { useRef, useCallback, useEffect } from 'react';
import { AppNode } from '../types';

/**
 * 节流函数 - 限制函数执行频率
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        return fn(...args);
      }
    },
    [fn, delay]
  ) as T;
}

/**
 * 防抖函数 - 延迟执行，只在最后一次调用后执行
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay]
  ) as T;
}

/**
 * 创建一个轻量级的节点查询函数
 * 避免传递整个nodes数组导致不必要的重渲染
 */
export function createNodeQuery(nodesRef: React.MutableRefObject<AppNode[]>) {
  let cachedMap: Map<string, AppNode> | null = null;
  let cachedNodesRef: AppNode[] | null = null;

  const getMap = (): Map<string, AppNode> => {
    // Rebuild map only when the underlying array reference changes
    if (cachedMap === null || cachedNodesRef !== nodesRef.current) {
      cachedMap = new Map<string, AppNode>();
      for (const node of nodesRef.current) {
        cachedMap.set(node.id, node);
      }
      cachedNodesRef = nodesRef.current;
    }
    return cachedMap;
  };

  /**
   * 根据ID获取节点 - O(1) via Map
   */
  const getNode = (id: string): AppNode | undefined => {
    return getMap().get(id);
  };

  /**
   * 获取指定类型的所有节点
   */
  const getNodesByType = (nodeType: string): AppNode[] => {
    return nodesRef.current.filter(n => n.type === nodeType);
  };

  /**
   * 获取指定类型的上游节点 - O(k) where k = number of inputs
   */
  const getUpstreamNodes = (nodeId: string, nodeType: string): AppNode[] => {
    const node = getMap().get(nodeId);
    if (!node || !node.inputs) return [];
    return node.inputs
      .map(id => getMap().get(id))
      .filter((n): n is AppNode => n !== undefined && n.type === nodeType);
  };

  /**
   * 获取第一个指定类型的上游节点
   */
  const getFirstUpstreamNode = (nodeId: string, nodeType: string): AppNode | undefined => {
    return getUpstreamNodes(nodeId, nodeType)[0];
  };

  /**
   * 检查是否存在指定类型的上游节点
   */
  const hasUpstreamNode = (nodeId: string, nodeType: string): boolean => {
    return getUpstreamNodes(nodeId, nodeType).length > 0;
  };

  /**
   * 根据ID批量获取节点 - O(k) via Map
   */
  const getNodesByIds = (ids: string[]): AppNode[] => {
    const map = getMap();
    return ids.map(id => map.get(id)).filter((n): n is AppNode => n !== undefined);
  };

  return {
    getNode,
    getNodesByType,
    getUpstreamNodes,
    getFirstUpstreamNode,
    hasUpstreamNode,
    getNodesByIds,
  };
}

/**
 * 视口可见性检测hook
 * 只渲染可见区域内的元素
 */
export function useViewportVisibility(
  containerRef: React.RefObject<HTMLDivElement>,
  itemBounds: { x: number; y: number; width: number; height: number },
  padding: number = 100
): boolean {
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    const checkVisibility = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // 检查itemBounds是否在视口内（考虑padding）
      const inViewport =
        itemBounds.x + itemBounds.width >= -padding &&
        itemBounds.x <= containerRect.width + padding &&
        itemBounds.y + itemBounds.height >= -padding &&
        itemBounds.y <= containerRect.height + padding;

      setIsVisible(inViewport);
    };

    checkVisibility();

    // 监听容器变化（如果需要）
    const resizeObserver = new ResizeObserver(checkVisibility);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, itemBounds, padding]);

  return isVisible;
}

import React from 'react';

/**
 * 性能监控hook
 * 用于测量组件渲染性能
 */
export function useRenderMetrics(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef<number>(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTime.current;

    if (process.env.NODE_ENV === 'development') {
    }

    lastRenderTime.current = now;
  });

  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current,
  };
}

/**
 * 优化的props比较函数
 * 用于React.memo的第二个参数
 */
export function createPropsComparator<T extends Record<string, any>>(
  keysToCompare: (keyof T)[]
): (prevProps: T, nextProps: T) => boolean {
  return (prevProps: T, nextProps: T) => {
    // 检查指定的key
    for (const key of keysToCompare) {
      if (prevProps[key] !== nextProps[key]) {
        // 如果是对象，进行浅比较
        if (
          typeof prevProps[key] === 'object' &&
          prevProps[key] !== null &&
          typeof nextProps[key] === 'object' &&
          nextProps[key] !== null
        ) {
          if (!shallowEqual(prevProps[key], nextProps[key])) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
    return true;
  };
}

/**
 * 浅比较两个对象
 */
function shallowEqual(obj1: any, obj2: any): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

/**
 * 优化的数组比较
 * 比较数组长度和每个元素
 */
export function arrayEquals<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
}
