/**
 * 错误边界组件
 * 捕获子组件中的 JavaScript 错误，防止整个应用崩溃
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 错误边界组件类
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 可以将错误日志上报给服务器
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);

    // 保存错误信息到 state
    this.setState({
      error,
      errorInfo
    });

    // 调用自定义错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: 发送到 Sentry
    // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义降级 UI，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
            {/* 错误图标 */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-500" strokeWidth={2} />
              </div>
            </div>

            {/* 错误标题 */}
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              出错了
            </h1>
            <p className="text-slate-400 text-center mb-8">
              抱歉，应用遇到了一些问题。请尝试刷新页面或返回首页。
            </p>

            {/* 错误详情（可选显示） */}
            {this.props.showDetails && this.state.error && (
              <details className="mb-6 bg-black/30 rounded-lg p-4 border border-white/5">
                <summary className="text-sm font-medium text-slate-300 cursor-pointer hover:text-white transition-colors">
                  查看错误详情
                </summary>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">错误信息</div>
                    <pre className="text-xs text-red-400 bg-black/50 p-3 rounded overflow-x-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">组件堆栈</div>
                      <pre className="text-xs text-slate-400 bg-black/50 p-3 rounded overflow-x-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all duration-200 font-medium border border-white/5 hover:border-white/10"
              >
                <RefreshCw size={18} strokeWidth={2} />
                重试
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg shadow-cyan-500/20"
              >
                <RefreshCw size={18} strokeWidth={2} />
                刷新页面
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all duration-200 font-medium border border-white/5 hover:border-white/10"
              >
                <Home size={18} strokeWidth={2} />
                返回首页
              </button>
            </div>

            {/* 开发模式下的提示 */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Bug className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-yellow-500 mb-1">
                      开发模式提示
                    </div>
                    <div className="text-xs text-slate-400">
                      您正在开发模式下运行，错误信息会显示在页面上。在生产环境中，建议将错误信息发送到监控服务（如 Sentry）。
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 简化的错误边界组件（用于小范围错误捕获）
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
): React.ComponentType<P> {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
}

/**
 * Hook: 在函数组件中使用错误边界
 * 注意：这不能捕获事件处理器和异步代码中的错误
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}
