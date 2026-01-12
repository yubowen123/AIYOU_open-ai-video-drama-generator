/**
 * 模型自动降级服务
 * 当模型调用失败时，自动尝试下一个可用模型
 */

import { ModelCategory, getModelInfo, getNextFallbackModel, isQuotaError } from './modelConfig';
import { logAPICall } from './apiLogger';

export interface FallbackConfig {
  maxAttempts?: number; // 最大尝试次数，默认 3
  onModelFallback?: (from: string, to: string, reason: string) => void; // 降级回调
  excludedModels?: string[]; // 永久排除的模型列表
  enableFallback?: boolean; // 是否启用自动降级，默认 true
}

export interface ModelExecutionResult<T> {
  success: boolean;
  data?: T;
  model?: string;
  attempts: number;
  error?: string;
  fallbackChain?: string[]; // 尝试过的模型列表
}

/**
 * 模型使用统计（存储在 localStorage）
 */
interface ModelUsageStats {
  modelId: string;
  successCount: number;
  failureCount: number;
  lastError?: string;
  lastErrorTime?: number;
  consecutiveFailures: number; // 连续失败次数
}

const STATS_KEY = 'model_usage_stats';

// 获取模型统计信息
const getModelStats = (modelId: string): ModelUsageStats => {
  const stored = localStorage.getItem(STATS_KEY);
  if (!stored) return {
    modelId,
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0
  };

  try {
    const allStats: Record<string, ModelUsageStats> = JSON.parse(stored);
    return allStats[modelId] || {
      modelId,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0
    };
  } catch (e) {
    return {
      modelId,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0
    };
  }
};

// 更新模型统计
const updateModelStats = (modelId: string, success: boolean, error?: string) => {
  const stored = localStorage.getItem(STATS_KEY);
  let allStats: Record<string, ModelUsageStats> = {};

  try {
    if (stored) {
      allStats = JSON.parse(stored);
    }

    const existing = allStats[modelId] || {
      modelId,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0
    };

    if (success) {
      existing.successCount++;
      existing.consecutiveFailures = 0;
      existing.lastError = undefined;
      existing.lastErrorTime = undefined;
    } else {
      existing.failureCount++;
      existing.consecutiveFailures++;
      existing.lastError = error;
      existing.lastErrorTime = Date.now();
    }

    allStats[modelId] = existing;
    localStorage.setItem(STATS_KEY, JSON.stringify(allStats));
  } catch (e) {
    console.warn('Failed to update model stats:', e);
  }
};

// 检查模型是否应该被跳过（基于历史失败记录）
const shouldSkipModel = (modelId: string): boolean => {
  const stats = getModelStats(modelId);

  // 如果连续失败超过 3 次，且最后一次失败在 1 小时内，跳过此模型
  if (stats.consecutiveFailures >= 3 && stats.lastErrorTime) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (stats.lastErrorTime > oneHourAgo) {
      console.warn(`Model ${modelId} skipped due to recent failures`);
      return true;
    }
  }

  return false;
};

/**
 * 执行带自动降级的模型调用
 *
 * @param executeModel 执行函数，接收模型ID并返回结果
 * @param initialModel 初始模型ID
 * @param config 降级配置
 * @returns 执行结果
 */
export async function executeWithFallback<T>(
  executeModel: (modelId: string) => Promise<T>,
  initialModel: string,
  config: FallbackConfig = {}
): Promise<ModelExecutionResult<T>> {
  const {
    maxAttempts = 3,
    onModelFallback,
    excludedModels: initialExcluded = [],
    enableFallback = true
  } = config;

  let currentModel = initialModel;
  const excludedModels = [...initialExcluded];
  const fallbackChain: string[] = [currentModel];
  let lastError: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 检查是否应该跳过此模型
    if (shouldSkipModel(currentModel)) {
      const nextModel = getNextFallbackModel(currentModel, excludedModels);

      if (!nextModel || !enableFallback) {
        // 没有更多备用模型
        return {
          success: false,
          attempts: attempt + 1,
          error: lastError || 'All models failed or skipped',
          fallbackChain
        };
      }

      if (onModelFallback) {
        onModelFallback(currentModel, nextModel, 'Recent failures');
      }

      currentModel = nextModel;
      excludedModels.push(currentModel);
      fallbackChain.push(currentModel);
      continue;
    }

    try {
      // 尝试执行
      const result = await executeModel(currentModel);

      // 成功 - 更新统计
      updateModelStats(currentModel, true);

      return {
        success: true,
        data: result,
        model: currentModel,
        attempts: attempt + 1,
        fallbackChain
      };

    } catch (error: any) {
      lastError = String(error?.message || error);

      // 记录失败
      updateModelStats(currentModel, false, lastError);

      // 记录日志
      const modelInfo = getModelInfo(currentModel);
      logAPICall(
        `model_fallback_attempt_${attempt + 1}`,
        async () => ({ success: false, error }),
        {
          model: currentModel,
          modelName: modelInfo?.name,
          error: lastError,
          attempt: attempt + 1,
          isQuotaError: isQuotaError(error),
          maxAttempts
        }
      );

      // 检查是否为配额错误
      const isQuota = isQuotaError(error);

      if (!enableFallback || attempt >= maxAttempts - 1) {
        // 不启用降级或已达到最大尝试次数
        return {
          success: false,
          attempts: attempt + 1,
          error: isQuota
            ? `Model ${currentModel} quota exceeded. ${!enableFallback ? 'Fallback disabled.' : 'Max attempts reached.'}`
            : lastError,
          fallbackChain
        };
      }

      // 获取下一个备用模型
      const nextModel = getNextFallbackModel(currentModel, excludedModels);

      if (!nextModel) {
        // 没有更多备用模型
        return {
          success: false,
          attempts: attempt + 1,
          error: isQuota
            ? `All models quota exceeded or unavailable`
            : lastError,
          fallbackChain
        };
      }

      // 触发降级回调
      if (onModelFallback) {
        const reason = isQuota ? '配额用完' : '模型调用失败';
        onModelFallback(currentModel, nextModel, reason);
      }

      // 添加到排除列表
      excludedModels.push(currentModel);

      // 切换到下一个模型
      currentModel = nextModel;
      fallbackChain.push(currentModel);
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
    error: lastError || 'Max attempts reached',
    fallbackChain
  };
}

/**
 * 重置模型统计信息（用于手动清除）
 */
export function resetModelStats(modelId?: string) {
  const stored = localStorage.getItem(STATS_KEY);
  if (!stored) return;

  try {
    const allStats: Record<string, ModelUsageStats> = JSON.parse(stored);

    if (modelId) {
      // 重置单个模型
      delete allStats[modelId];
    } else {
      // 重置所有
      localStorage.removeItem(STATS_KEY);
      return;
    }

    localStorage.setItem(STATS_KEY, JSON.stringify(allStats));
  } catch (e) {
    console.warn('Failed to reset model stats:', e);
  }
}

/**
 * 获取所有模型的统计信息
 */
export function getAllModelStats(): Record<string, ModelUsageStats> {
  const stored = localStorage.getItem(STATS_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch (e) {
    return {};
  }
}

/**
 * 检查模型健康状态
 */
export function getModelHealth(modelId: string): {
  healthy: boolean;
  successRate: number;
  consecutiveFailures: number;
  lastError?: string;
} {
  const stats = getModelStats(modelId);
  const totalCalls = stats.successCount + stats.failureCount;
  const successRate = totalCalls > 0 ? (stats.successCount / totalCalls) * 100 : 100;

  return {
    healthy: stats.consecutiveFailures < 3,
    successRate,
    consecutiveFailures: stats.consecutiveFailures,
    lastError: stats.lastError
  };
}
