// services/apiLogger.ts
// API日志记录系统 - 用于调试和问题定位
// Developer: 光波 (a@ggbo.com)
// Copyright (c) 2025 光波. All rights reserved.

export type APILogType = 'submission' | 'polling' | 'result';

export interface APILogEntry {
    id: string;
    timestamp: number;
    apiName: string;          // API函数名称
    nodeId?: string;          // 关联的节点ID
    nodeType?: string;        // 节点类型
    platform?: string;        // API平台提供商（如 yunwuapi, kie, yijiapi 等）
    logType: APILogType;      // 日志类型：提交请求、轮询查询、最终结果
    request: {
        model?: string;
        prompt?: string;
        options?: any;
        inputs?: any[];
        inputImagesCount?: number;  // 参考图数量
        enhancedPrompt?: string;    // 完整的增强提示词
        generationConfig?: any;     // 生成配置
        [key: string]: any;         // 允许额外字段
    };
    response?: {
        success: boolean;
        data?: any;
        error?: string;
        details?: {              // 详细响应信息
            generatedCount?: number;
            images?: Array<{
                mimeType: string;
                size: string;
                index: number;
            }>;
            safetyRatings?: any[];
            finishReason?: string;
            responseText?: string;
        };
    };
    duration?: number;        // 请求耗时(ms)
    status: 'pending' | 'success' | 'error';
}

class APILogger {
    private logs: APILogEntry[] = [];
    private maxLogs = 30;  // 最多保存30条日志（减少内存占用）
    private storageKey = 'AIYOU_API_LOGS';
    // 开发者标识 - 用于证明版权归属
    private readonly DEVELOPER = '光波';
    private readonly DEVELOPER_EMAIL = 'a@ggbo.com';
    private readonly COPYRIGHT_YEAR = '2025';

    constructor() {
        this.loadFromStorage();
        // 在初始化时记录版权信息
    }

    /**
     * 创建一个新的日志条目（请求开始）
     */
    startLog(
        apiName: string,
        request: APILogEntry['request'],
        context?: { nodeId?: string; nodeType?: string; platform?: string; logType?: APILogType }
    ): string {
        const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        const logEntry: APILogEntry = {
            id,
            timestamp: Date.now(),
            apiName,
            nodeId: context?.nodeId,
            nodeType: context?.nodeType,
            platform: context?.platform,
            logType: context?.logType || 'submission',  // 默认为提交类型
            request: { ...request },  // 保存完整的请求信息
            status: 'pending'
        };

        this.logs.unshift(logEntry);

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        this.saveToStorage();


        return id;
    }

    /**
     * 完成一个日志条目（请求成功）
     */
    endLog(logId: string, response: any, startTime: number) {
        const log = this.logs.find(l => l.id === logId);
        if (!log) return;

        log.status = 'success';
        log.duration = Date.now() - startTime;

        // 检查是否有详细调试信息
        if (response && typeof response === 'object' && '_debugInfo' in response) {
            log.response = {
                success: true,
                data: this.sanitizeResponse(response),
                details: response._debugInfo
            };
        } else {
            log.response = {
                success: true,
                data: this.sanitizeResponse(response)
            };
        }

        this.saveToStorage();

        // 异步发送日志到服务器（不阻塞主流程）
        this.sendToServer(log);

    }

    /**
     * 记录错误
     */
    errorLog(logId: string, error: any, startTime: number) {
        const log = this.logs.find(l => l.id === logId);
        if (!log) return;

        log.status = 'error';
        log.duration = Date.now() - startTime;
        log.response = {
            success: false,
            error: this.extractErrorMessage(error)
        };

        this.saveToStorage();

        // 异步发送日志到服务器（不阻塞主流程）
        this.sendToServer(log);

        console.error(`[API Logger] Error: ${log.apiName}`, {
            logId,
            duration: log.duration,
            error: log.response.error
        });
    }

    /**
     * 获取所有日志
     */
    getLogs(): APILogEntry[] {
        return [...this.logs];
    }

    /**
     * 根据条件过滤日志
     */
    filterLogs(filter: {
        apiName?: string;
        nodeId?: string;
        status?: APILogEntry['status'];
        startTime?: number;
        endTime?: number;
    }): APILogEntry[] {
        return this.logs.filter(log => {
            if (filter.apiName && log.apiName !== filter.apiName) return false;
            if (filter.nodeId && log.nodeId !== filter.nodeId) return false;
            if (filter.status && log.status !== filter.status) return false;
            if (filter.startTime && log.timestamp < filter.startTime) return false;
            if (filter.endTime && log.timestamp > filter.endTime) return false;
            return true;
        });
    }

    /**
     * 清除所有日志
     */
    clearLogs() {
        this.logs = [];
        this.saveToStorage();
    }

    /**
     * 导出日志为JSON
     */
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const total = this.logs.length;
        const success = this.logs.filter(l => l.status === 'success').length;
        const error = this.logs.filter(l => l.status === 'error').length;
        const pending = this.logs.filter(l => l.status === 'pending').length;

        const apiCounts: Record<string, number> = {};
        this.logs.forEach(log => {
            apiCounts[log.apiName] = (apiCounts[log.apiName] || 0) + 1;
        });

        const avgDuration = this.logs
            .filter(l => l.duration)
            .reduce((sum, l) => sum + (l.duration || 0), 0) / (total || 1);

        return {
            total,
            success,
            error,
            pending,
            avgDuration: Math.round(avgDuration),
            apiCounts
        };
    }

    // ===== 私有方法 =====

    /**
     * 发送日志到服务器（异步，不阻塞主流程）
     */
    private sendToServer(log: APILogEntry) {
        // 使用 sendBeacon 或 fetch 发送日志
        const logUrl = 'http://localhost:3001/api/logs';

        // 清理日志数据以减小大小
        const cleanLog = {
            id: log.id,
            timestamp: log.timestamp,
            apiName: log.apiName,
            nodeId: log.nodeId,
            nodeType: log.nodeType,
            status: log.status,
            duration: log.duration,
            request: {
                model: log.request.model,
                prompt: log.request.prompt ? this.truncateString(log.request.prompt, 500) : undefined,
                inputImagesCount: log.request.inputImagesCount,
                generationConfig: log.request.generationConfig
            },
            response: log.response ? {
                success: log.response.success,
                error: log.response.error ? this.truncateString(log.response.error, 500) : undefined,
                details: log.response.details
            } : undefined
        };

        // 使用 sendBeacon（更可靠，页面卸载时也能发送）
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(cleanLog)], { type: 'application/json' });
            const success = navigator.sendBeacon(logUrl, blob);
            if (success) {
            } else {
                console.warn(`[API Logger] ✗ sendBeacon失败，降级到fetch: ${log.apiName}`);
                // 降级到 fetch
                this.sendLogViaFetch(logUrl, cleanLog);
            }
        } else {
            this.sendLogViaFetch(logUrl, cleanLog);
        }
    }

    /**
     * 使用fetch发送日志
     */
    private sendLogViaFetch(logUrl: string, cleanLog: any) {
        fetch(logUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanLog),
            keepalive: true
        })
        .then(() => {
        })
        .catch(err => {
            // 不阻塞主流程，但记录错误
            console.error(`[API Logger] ✗ 发送日志失败: ${cleanLog.apiName}`, err.message);
        });
    }

    private sanitizeResponse(response: any): any {
        // 对于 API 日志调试面板，保留完整信息
        if (typeof response === 'string') {
            // prompt 等重要文本保留完整内容
            return response;
        }

        if (Array.isArray(response)) {
            // 数组保留所有项，但处理 base64
            return response.map(item => this.sanitizeResponse(item));
        }

        if (typeof response === 'object' && response !== null) {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(response)) {
                if (key === 'uri' || key === 'src' || key.includes('Url') || key.includes('Uri')) {
                    // 保留完整 URL
                    sanitized[key] = value;
                } else if (typeof value === 'string' && value.startsWith('data:')) {
                    // Base64 数据转换为描述信息
                    const match = value.match(/^data:([^;]+);base64,/);
                    const base64Length = value.split(',')[1]?.length || 0;
                    sanitized[key] = `[Base64 ${match?.[1] || 'image'} - ${base64Length.toLocaleString()} chars]`;
                } else {
                    sanitized[key] = this.sanitizeResponse(value);
                }
            }
            return sanitized;
        }

        return response;
    }

    private sanitizeForConsole(data: any): any {
        // 为控制台输出做更激进的清理
        if (typeof data === 'string') {
            return data.length > 200 ? data.substring(0, 200) + '...' : data;
        }

        if (Array.isArray(data)) {
            return `[Array(${data.length})]`;
        }

        if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data);
            return `{${keys.join(', ')}}`;
        }

        return data;
    }

    private extractErrorMessage(error: any): string {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        if (error.error && error.error.message) return error.error.message;
        return JSON.stringify(error);
    }

    private saveToStorage() {
        try {
            // 只保存最近20条到 localStorage（进一步减少存储压力）
            // 深度清理数据以减少存储大小
            const recentLogs = this.logs.slice(0, 20).map(log => ({
                ...log,
                // 清理 request 中的大字段
                request: {
                    model: log.request.model,
                    prompt: log.request.prompt ? this.truncateString(log.request.prompt, 200) : undefined,
                    options: log.request.options,
                    inputs: log.request.inputs?.map(() => '[Input Data]'),
                    inputImagesCount: log.request.inputImagesCount
                },
                // 清理 response 中的大字段
                response: log.response ? {
                    success: log.response.success,
                    error: log.response.error,
                    details: log.response.details ? {
                        generatedCount: log.response.details.generatedCount,
                        finishReason: log.response.details.finishReason
                    } : undefined
                } : undefined
            }));

            localStorage.setItem(this.storageKey, JSON.stringify(recentLogs));
        } catch (e: any) {
            // 如果存储失败，尝试清理后再次保存
            if (e.name === 'QuotaExceededError') {
                console.warn('[API Logger] Storage quota exceeded, clearing old logs...');
                try {
                    // 只保留最近 5 条
                    const minimalLogs = this.logs.slice(0, 5).map(log => ({
                        id: log.id,
                        timestamp: log.timestamp,
                        apiName: log.apiName,
                        status: log.status,
                        duration: log.duration
                    }));
                    localStorage.setItem(this.storageKey, JSON.stringify(minimalLogs));
                } catch (e2) {
                    // 如果还是失败，就清空所有日志
                    console.error('[API Logger] Failed to save even minimal logs, clearing storage');
                    localStorage.removeItem(this.storageKey);
                }
            } else {
                console.warn('[API Logger] Failed to save to storage', e);
            }
        }
    }

    private truncateString(str: string, maxLength: number): string {
        if (!str || typeof str !== 'string') return str;
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    }

    private loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[API Logger] Failed to load from storage', e);
            this.logs = [];
        }
    }
}

// 全局单例
export const apiLogger = new APILogger();

/**
 * 包装API调用的辅助函数
 */
export async function logAPICall<T>(
    apiName: string,
    apiCall: () => Promise<T>,
    request: APILogEntry['request'],
    context?: { nodeId?: string; nodeType?: string; platform?: string; logType?: APILogType }
): Promise<T> {
    const startTime = Date.now();
    const logId = apiLogger.startLog(apiName, request, context);

    try {
        const result = await apiCall();
        apiLogger.endLog(logId, result, startTime);
        return result;
    } catch (error) {
        apiLogger.errorLog(logId, error, startTime);
        throw error;
    }
}
