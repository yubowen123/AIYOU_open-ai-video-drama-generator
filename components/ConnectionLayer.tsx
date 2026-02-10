// components/ConnectionLayer.tsx
import React, { useMemo } from 'react';
import { AppNode, Connection } from '../types';

interface ConnectionLayerProps {
  nodes: AppNode[];
  connections: Connection[];
  scale: number;
  pan: { x: number; y: number };
  connectionStart?: { id: string; x: number; y: number } | null;
  mousePos?: { x: number; y: number };
  onConnectionClick?: (connection: Connection, event: React.MouseEvent) => void;
  getNodeHeight: (node: AppNode) => number;
}

/**
 * 连接线渲染层
 * 渲染所有节点之间的连接线
 */
export const ConnectionLayer: React.FC<ConnectionLayerProps> = ({
  nodes,
  connections,
  scale,
  pan,
  connectionStart,
  mousePos,
  onConnectionClick,
  getNodeHeight
}) => {

  /**
   * 计算贝塞尔曲线路径
   */
  const calculatePath = useMemo(() => (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): string => {
    const dx = endX - startX;
    const controlPointOffset = Math.min(Math.abs(dx) * 0.5, 200);

    return `M ${startX},${startY} C ${startX + controlPointOffset},${startY} ${endX - controlPointOffset},${endY} ${endX},${endY}`;
  }, []);

  /**
   * 渲染已建立的连接线
   */
  const renderConnections = useMemo(() => {
    const nodeById = new Map<string, AppNode>(nodes.map(n => [n.id, n]));
    return connections.map((conn, idx) => {
      const fromNode = nodeById.get(conn.from);
      const toNode = nodeById.get(conn.to);

      if (!fromNode || !toNode) return null;

      const fromHeight = getNodeHeight(fromNode);
      const toHeight = getNodeHeight(toNode);

      const startX = fromNode.x + (fromNode.width || 420) + 3;
      const startY = fromNode.y + fromHeight / 2;
      const endX = toNode.x - 3;
      const endY = toNode.y + toHeight / 2;

      const path = calculatePath(startX, startY, endX, endY);

      return (
        <g key={`${conn.from}-${conn.to}-${idx}`}>
          {/* 不可见的粗线用于点击检测 */}
          <path
            d={path}
            stroke="transparent"
            strokeWidth="20"
            fill="none"
            style={{ cursor: 'pointer' }}
            onClick={(e) => onConnectionClick?.(conn, e)}
          />

          {/* 可见的连接线 */}
          <path
            d={path}
            stroke="url(#gradient)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.3))',
              pointerEvents: 'none'
            }}
          />

          {/* 箭头 */}
          <circle
            cx={endX}
            cy={endY}
            r="4"
            fill="#22d3ee"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.6))',
              pointerEvents: 'none'
            }}
          />
        </g>
      );
    });
  }, [connections, nodes, calculatePath, getNodeHeight, onConnectionClick]);

  /**
   * 渲染正在创建的连接线
   */
  const renderDraggingConnection = useMemo(() => {
    if (!connectionStart || !mousePos) return null;

    let startX = 0, startY = 0;

    if (connectionStart.id === 'smart-sequence-dock') {
      // 特殊处理: 来自 SmartSequenceDock 的连接
      startX = (connectionStart.x - pan.x) / scale;
      startY = (connectionStart.y - pan.y) / scale;
    } else {
      // 普通节点的连接 - O(1) Map lookup
      const nodeById = new Map<string, AppNode>(nodes.map(n => [n.id, n]));
      const startNode = nodeById.get(connectionStart.id);
      if (!startNode) return null;

      const startHeight = getNodeHeight(startNode);
      startX = startNode.x + (startNode.width || 420) + 3;
      startY = startNode.y + startHeight / 2;
    }

    const endX = (mousePos.x - pan.x) / scale;
    const endY = (mousePos.y - pan.y) / scale;

    const path = calculatePath(startX, startY, endX, endY);

    return (
      <g>
        <path
          d={path}
          stroke="url(#gradient)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="8 4"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.5))',
            animation: 'dash 1s linear infinite'
          }}
        />
        <circle
          cx={endX}
          cy={endY}
          r="6"
          fill="#22d3ee"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.8))',
            animation: 'pulse 1s ease-in-out infinite'
          }}
        />
      </g>
    );
  }, [connectionStart, mousePos, nodes, scale, pan, calculatePath, getNodeHeight]);

  return (
    <>
      {/* SVG 定义 */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* 已建立的连接 */}
      {renderConnections}

      {/* 正在创建的连接 */}
      {renderDraggingConnection}

      {/* CSS 动画 */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -24;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }
      `}</style>
    </>
  );
};

/**
 * 性能优化：使用React.memo防止不必要的重渲染
 * 只有当关键的props变化时才重新渲染
 */
const areConnectionLayerPropsEqual = (
  prev: ConnectionLayerProps,
  next: ConnectionLayerProps
): boolean => {
  // 检查基本类型
  if (prev.scale !== next.scale || prev.pan.x !== next.pan.x || prev.pan.y !== next.pan.y) {
    return false;
  }

  // 检查connectionStart和mousePos（拖拽时需要实时更新）
  if (prev.connectionStart?.id !== next.connectionStart?.id ||
      prev.connectionStart?.x !== next.connectionStart?.x ||
      prev.connectionStart?.y !== next.connectionStart?.y) {
    return false;
  }
  if (prev.mousePos?.x !== next.mousePos?.x || prev.mousePos?.y !== next.mousePos?.y) {
    return false;
  }

  // 检查connections数量
  if (prev.connections.length !== next.connections.length) {
    return false;
  }

  // 检查connections内容
  for (let i = 0; i < prev.connections.length; i++) {
    if (prev.connections[i].from !== next.connections[i].from ||
        prev.connections[i].to !== next.connections[i].to) {
      return false;
    }
  }

  // 检查nodes数量（节点位置变化需要重绘连接线）
  if (prev.nodes.length !== next.nodes.length) {
    return false;
  }

  // 检查可能影响连接线的节点属性
  for (let i = 0; i < prev.nodes.length; i++) {
    const prevNode = prev.nodes[i];
    const nextNode = next.nodes[i];
    if (prevNode.id !== nextNode.id) return false;
    if (prevNode.x !== nextNode.x || prevNode.y !== nextNode.y) return false;
    if (prevNode.width !== nextNode.width) return false;
    // 只有高度变化时才需要检查（因为连接线的端点依赖于高度）
    // 我们通过引用比较来判断节点数据是否变化
    if (prevNode !== nextNode) {
      // 如果节点引用变化了，需要检查关键属性
      const prevHeight = prevNode.height || 600;
      const nextHeight = nextNode.height || 600;
      if (prevHeight !== nextHeight) return false;
    }
  }

  return true;
};

export const MemoizedConnectionLayer = React.memo(ConnectionLayer, areConnectionLayerPropsEqual);
