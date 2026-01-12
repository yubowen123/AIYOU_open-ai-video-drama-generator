/**
 * 异步错误边界组件
 * 捕获异步操作中的错误（如 API 调用、Promise 等）
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 异步错误边界
 * 用于捕获异步操作中的未捕获错误
 */
export class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  componentDidMount() {
    // 监听未捕获的 Promise 错误
    this.handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();

      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

      console.error('AsyncErrorBoundary 捕获到未处理的 Promise 错误:', error);

      this.setState({
        hasError: true,
        error
      });

      if (this.props.onError) {
        this.props.onError(error);
      }

      // TODO: 发送到 Sentry
      // Sentry.captureException(error, { tags: { type: 'unhandled_rejection' } });
    };

    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle size={20} strokeWidth={2} />
            <div>
              <div className="text-sm font-medium">异步操作出错</div>
              <div className="text-xs text-slate-500 mt-1">
                {this.state.error?.message || '未知错误'}
              </div>
            </div>
            <button
              onClick={this.handleReset}
              className="ml-2 px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 加载状态组件
 */
export function LoadingFallback({ message = '加载中...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}

/**
 * 异步组件包装器
 * 自动处理加载和错误状态
 */
interface AsyncComponentProps {
  loading?: boolean;
  error?: Error | null;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  children: ReactNode;
}

export function AsyncComponent({
  loading = false,
  error = null,
  loadingFallback,
  errorFallback,
  children
}: AsyncComponentProps) {
  if (loading) {
    return loadingFallback || <LoadingFallback />;
  }

  if (error) {
    return (
      errorFallback || (
        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} strokeWidth={2} />
            <span className="text-sm">{error.message || '操作失败'}</span>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
