/**
 * 节点错误边界组件
 * 专门用于捕获节点组件中的错误
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface Props {
  nodeId: string;
  nodeTitle?: string;
  children: ReactNode;
  onError?: (nodeId: string, error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 节点错误边界
 * 当单个节点出错时，不影响其他节点的正常运行
 */
export class NodeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`节点 ${this.props.nodeId} 出错:`, error, errorInfo);

    // 调用错误回调
    if (this.props.onError) {
      this.props.onError(this.props.nodeId, error);
    }

    // TODO: 发送到 Sentry
    // Sentry.captureException(error, {
    //   tags: { component: 'node', nodeId: this.props.nodeId },
    //   contexts: { react: { componentStack: errorInfo.componentStack } }
    // });
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative w-full h-full min-h-[200px] bg-red-500/5 border-2 border-red-500/20 rounded-xl overflow-hidden">
          {/* 错误提示 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500/60 mb-3" strokeWidth={2} />
            <div className="text-sm font-medium text-red-400 mb-2">
              {this.props.nodeTitle || '节点'} 执行出错
            </div>
            <div className="text-xs text-slate-500 max-w-[200px]">
              {this.state.error?.message || '未知错误'}
            </div>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={this.handleDismiss}
            className="absolute top-2 right-2 p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
            title="关闭错误提示"
          >
            <X size={14} className="text-red-400" strokeWidth={2} />
          </button>

          {/* 错误详情（开发模式） */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="absolute bottom-0 left-0 right-0 bg-black/50 p-3 text-left">
              <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300">
                错误详情
              </summary>
              <pre className="text-xs text-red-400 mt-2 overflow-x-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook: 为节点添加错误处理
 */
export function useNodeErrorHandler(nodeId: string, nodeTitle?: string) {
  const handleError = (error: Error) => {
    console.error(`节点 ${nodeId} (${nodeTitle}) 执行失败:`, error);

    // TODO: 发送到 Sentry
    // Sentry.captureException(error, {
    //   tags: { component: 'node', nodeId },
    //   extra: { nodeTitle }
    // });
  };

  return { handleError };
}
