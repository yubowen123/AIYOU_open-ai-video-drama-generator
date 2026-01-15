import { useCallback, useRef } from 'react';

interface UseClickBlockerOptions {
  /**
   * 阻止时间（毫秒），默认 1000ms
   */
  blockDuration?: number;
  /**
   * 是否在执行时显示加载状态
   */
  showLoading?: boolean;
}

interface UseClickBlockerReturn {
  /**
   * 包装后的点击处理函数
   */
  handleClick: (handler: () => void | Promise<void>) => () => void;
  /**
   * 是否正在处理中
   */
  isProcessing: boolean;
}

/**
 * 防重复点击 Hook
 * 用于防止按钮在短时间内被多次点击
 *
 * @example
 * ```tsx
 * const { handleClick, isProcessing } = useClickBlocker({ blockDuration: 1000 });
 *
 * <button onClick={handleClick(() => {
 *   console.log('点击了');
 * })} disabled={isProcessing}>
 *   {isProcessing ? '处理中...' : '点击'}
 * </button>
 * ```
 */
export function useClickBlocker(options: UseClickBlockerOptions = {}): UseClickBlockerReturn {
  const { blockDuration = 1000, showLoading = true } = options;
  const isBlockedRef = useRef(false);
  const isProcessingRef = useRef(false);

  const handleClick = useCallback((handler: () => void | Promise<void>) => {
    return async () => {
      // 如果已被阻止，直接返回
      if (isBlockedRef.current) {
        return;
      }

      // 标记为已阻止
      isBlockedRef.current = true;
      isProcessingRef.current = true;

      try {
        // 执行处理函数
        await Promise.resolve(handler());
      } catch (error) {
        console.error('Click handler error:', error);
      } finally {
        // 在指定时间后解除阻止
        setTimeout(() => {
          isBlockedRef.current = false;
          isProcessingRef.current = false;
        }, blockDuration);
      }
    };
  }, [blockDuration]);

  return {
    handleClick,
    get isProcessing() {
      return isProcessingRef.current;
    }
  };
}

/**
 * 防重复点击 Hook（异步版本）
 * 用于处理异步操作，只在操作完成后才解除阻止
 *
 * @example
 * ```tsx
 * const { handleClick, isProcessing } = useAsyncClickBlocker();
 *
 * <button onClick={handleClick(async () => {
 *   await fetch('/api/data');
 * })} disabled={isProcessing}>
 *   {isProcessing ? '加载中...' : '提交'}
 * </button>
 * ```
 */
export function useAsyncClickBlocker(): UseClickBlockerReturn {
  const isProcessingRef = useRef(false);
  const isBlockedRef = useRef(false);

  const handleClick = useCallback((handler: () => void | Promise<void>) => {
    return async () => {
      // 如果已被阻止，直接返回
      if (isBlockedRef.current) {
        return;
      }

      // 标记为已阻止
      isBlockedRef.current = true;
      isProcessingRef.current = true;

      try {
        // 执行异步处理函数
        await handler();
      } catch (error) {
        console.error('Async click handler error:', error);
      } finally {
        // 操作完成后立即解除阻止
        isBlockedRef.current = false;
        isProcessingRef.current = false;
      }
    };
  }, []);

  return {
    handleClick,
    get isProcessing() {
      return isProcessingRef.current;
    }
  };
}
