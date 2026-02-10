/**
 * yijiAPI (一加API) 适配器
 * 将 yijiAPI Sora2 API 封装为统一的提供商接口
 *
 * API 特点：
 * - 生成接口: https://ai.yijiarj.cn/v1/videos
 * - 查询接口: http://apius.yijiarj.cn/v1/videos/{video_id}
 * - 认证: Bearer Token
 * - model: "sora-2-yijia"
 * - size: 视频分辨率，如 "720x1280" (9:16) 或 "1280x720" (16:9)
 * - 响应格式: {id, object, model, status, progress, created_at, size}
 * - 查询响应: {id, url, size, model, object, status, quality, seconds, progress, created_at}
 */

import {
  SoraProvider,
  SoraSubmitParams,
  SoraSubmitResult,
  SoraVideoResult,
  Sora2UserConfig,
  ProviderSpecificConfig,
  CallContext,
  SoraAPIError
} from './types';
import { logAPICall } from '../apiLogger';

export class YijiapiProvider implements SoraProvider {
  readonly name = 'yijiapi' as const;
  readonly displayName = '一加API';

  // API 端点
  private readonly GENERATE_API = 'https://ai.yijiarj.cn/v1/videos';
  private readonly QUERY_API = 'https://ai.yijiarj.cn/v1/videos';

  /**
   * 配置转换：Sora2UserConfig → yijiAPI 格式
   */
  transformConfig(userConfig: Sora2UserConfig): ProviderSpecificConfig {
    // 映射 aspect_ratio 和 hd 到 size
    // 9:16 (竖屏): 720x1280 (标清) 或 1280x720 (错误，应该是 720x1280)
    // 16:9 (横屏): 1280x720 (标清) 或 1920x1080 (高清)

    let width: number;
    let height: number;

    if (userConfig.aspect_ratio === '9:16') {
      // 竖屏
      width = userConfig.hd ? 720 : 720;  // yijiAPI 暂无 1080p 竖屏
      height = userConfig.hd ? 1280 : 1280;
    } else {
      // 横屏 16:9
      width = userConfig.hd ? 1920 : 1280;
      height = userConfig.hd ? 1080 : 720;
    }

    const size = `${width}x${height}`;

    return {
      model: 'sora-2-yijia',
      size,
    };
  }

  /**
   * 提交任务到 yijiAPI
   */
  async submitTask(
    params: SoraSubmitParams,
    apiKey: string,
    context?: CallContext
  ): Promise<SoraSubmitResult> {
    const config = this.transformConfig(params.config);

    // 构建请求体
    const requestBody: any = {
      prompt: params.prompt,
      model: config.model,
      size: config.size,
    };

    // 添加图片URL（图生视频）
    if (params.referenceImageUrl) {
      requestBody.input_reference = params.referenceImageUrl;
    }


    return logAPICall(
      'yijiapiSubmitTask',
      async () => {
        const response = await fetch(this.GENERATE_API, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new SoraAPIError(
            this.name,
            response.status,
            `提交任务失败: ${errorText}`,
            { errorText }
          );
        }

        const result: any = await response.json();


        const taskId = result.id;
        if (!taskId) {
          throw new SoraAPIError(
            this.name,
            500,
            'yijiAPI 响应中没有 id',
            { result }
          );
        }


        return {
          id: taskId,
          status: result.status || 'queued',
          progress: result.progress || 0,
          createdAt: result.created_at ? result.created_at * 1000 : Date.now(), // 转换为毫秒
        };
      },
      {
        model: config.model,
        prompt: params.prompt.substring(0, 200) + (params.prompt.length > 200 ? '...' : ''),
        options: {
          size: config.size,
          hasReferenceImage: !!params.referenceImageUrl,
        },
        inputImagesCount: params.referenceImageUrl ? 1 : 0,
      },
      { ...context, platform: this.displayName }
    );
  }

  /**
   * 查询任务状态
   */
  async checkStatus(
    taskId: string,
    apiKey: string,
    onProgress?: (progress: number) => void,
    context?: CallContext
  ): Promise<SoraVideoResult> {
    return logAPICall(
      'yijiapiCheckStatus',
      async () => {
        const response = await fetch(`${this.QUERY_API}/${encodeURIComponent(taskId)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new SoraAPIError(
            this.name,
            response.status,
            `查询任务失败: ${errorText}`,
            { errorText }
          );
        }

        const data: any = await response.json();


        // yijiAPI 状态映射
        // 官方状态值: queued, processing, completed, failed
        const statusMap: Record<string, 'queued' | 'processing' | 'completed' | 'error'> = {
          'queued': 'queued',
          'processing': 'processing',
          'completed': 'completed',
          'failed': 'error',
          'fail': 'error',
          'failure': 'error',
          'cancelled': 'error',
          'cancel': 'error',
          'canceled': 'error',
        };

        const apiStatus = data.status || 'queued';
        const status = statusMap[apiStatus] || 'processing';

        // 计算进度
        const progress = data.progress || 0;

        // 更新进度
        if (onProgress) {
          onProgress(progress);
        }

        // 检查是否失败
        if (status === 'error') {
          return {
            taskId,
            status: 'error',
            progress,
            videoUrl: undefined,
            videoUrlWatermarked: undefined,
            duration: undefined,
            quality: 'unknown',
            isCompliant: false,
            violationReason: data.error || data.message || '视频生成失败',
            _rawData: data,
          };
        }

        // 提取视频 URL
        // 注意：size 字段是视频分辨率（如 "720x720"），不是视频URL
        let videoUrl = data.url;

        // 验证 videoUrl 是否为有效 URL
        const isValidUrl = (url: string | undefined): boolean => {
          if (!url || typeof url !== 'string') return false;
          try {
            const parsed = new URL(url);
            return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
                   (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') || url.includes('.avi'));
          } catch {
            return false;
          }
        };

        // 只有状态为 completed 且有有效 videoUrl 时才算完成
        if (status === 'completed' && !isValidUrl(videoUrl)) {
          console.warn(`[${this.displayName}] 任务已完成但无有效视频URL，API原始数据:`, {
            taskId,
            url: data.url,
            size: data.size,  // 这是分辨率，不是URL
            status: data.status,
            progress: data.progress,
          });

          return {
            taskId,
            status: 'error',
            progress: data.progress || 0,
            videoUrl: undefined,
            videoUrlWatermarked: undefined,
            duration: undefined,
            quality: 'unknown',
            isCompliant: false,
            violationReason: data.error || data.message || '任务已完成但未生成有效视频URL',
            _rawData: data,
          };
        }


        return {
          taskId,
          status,
          progress,
          videoUrl,
          videoUrlWatermarked: undefined, // yijiAPI 可能没有单独的水印视频
          duration: data.seconds ? String(data.seconds) : undefined,
          quality: data.quality || 'standard',
          isCompliant: true,
          _rawData: data,
        };
      },
      {
        model: 'sora-2-yijia',
        options: {
          taskId,
          hasProgressCallback: !!onProgress,
        },
      },
      { ...context, platform: this.displayName, logType: 'polling' }
    );
  }
}
