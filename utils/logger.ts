/**
 * AIYOU 漫剧生成平台 - 日志工具
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 * @description 生产环境安全的日志工具，可通过环境变量控制
 */

// 从环境变量获取日志级别
const LOG_LEVEL = import.meta.env?.VITE_LOG_LEVEL || (process.env?.NODE_ENV === 'production' ? 'error' : 'debug');

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 999,
};

const currentLevel = LOG_LEVELS[LOG_LEVEL as LogLevel] ?? (process.env?.NODE_ENV === 'production' ? 3 : 0);

/**
 * 判断是否应该输出日志
 */
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= currentLevel;
};

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 调试日志 - 仅开发环境
   */
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
    }
  },

  /**
   * 信息日志 - 仅开发环境
   */
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * 警告日志 - 始终输出
   */
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * 错误日志 - 始终输出
   */
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },
};

// 便捷别名
export const log = logger;
export default logger;
