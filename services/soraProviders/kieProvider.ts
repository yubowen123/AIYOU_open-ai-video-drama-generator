/**
 * KIE AI API 适配器
 * 将 KIE AI Sora2 API 封装为统一的提供商接口
 *
 * API 特点：
 * - 参数包装在 input 对象中
 * - model: sora-2-text-to-video 或 sora-2-image-to-video
 * - aspect_ratio: "landscape" | "portrait"
 * - n_frames: "10" | "15" | "25"
 * - remove_watermark: boolean (与 hd 参数相同含义)
 * - image_urls: string[] (图生视频时使用)
 * - 响应格式: {code: 200, msg: "success", data: {taskId: "..."}}
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

export class KieProvider implements SoraProvider {
  readonly name = 'kie' as const;
  readonly displayName = 'KIE AI';

  /**
   * 配置转换：Sora2UserConfig → KIE API 格式
   */
  transformConfig(userConfig: Sora2UserConfig): ProviderSpecificConfig {
    // 映射 aspect_ratio: '16:9' → "landscape", '9:16' → "portrait"
    const aspect_ratio = userConfig.aspect_ratio === '16:9' ? 'landscape' : 'portrait';

    // n_frames 直接使用 duration 的值（都是 "10" | "15" | "25"）
    const n_frames = userConfig.duration;

    // hd 和 remove_watermark 含义相同（true = 移除水印）
    const remove_watermark = userConfig.hd;

    return {
      aspect_ratio,
      n_frames,
      remove_watermark,
    };
  }

  /**
   * 提交任务到 KIE API
   */
  async submitTask(
    params: SoraSubmitParams,
    apiKey: string,
    context?: CallContext
  ): Promise<SoraSubmitResult> {
    const config = this.transformConfig(params.config);

    // 选择模型名称：根据是否有参考图片
    const model = params.referenceImageUrl
      ? 'sora-2-image-to-video'
      : 'sora-2-text-to-video';

    // 构建 input 对象
    const input: any = {
      prompt: params.prompt,
      aspect_ratio: config.aspect_ratio,
      n_frames: config.n_frames,
      remove_watermark: config.remove_watermark,
    };

    // 如果是图生视频，添加 image_urls
    if (params.referenceImageUrl) {
      input.image_urls = [params.referenceImageUrl];
    }

    const requestBody = {
      model,
      input,
    };

    return logAPICall(
      'kieSubmitTask',
      async () => {
        // 使用后端代理
        const apiUrl = 'http://localhost:3001/api/kie/create';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
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

        // KIE API 返回格式: {code: 200, msg: "success", data: {taskId: "..."}}
        if (result.code !== 200) {
          throw new SoraAPIError(
            this.name,
            result.code || 500,
            `KIE API 返回错误: ${result.msg}`,
            { result }
          );
        }

        const taskId = result.data?.taskId;
        if (!taskId) {
          throw new SoraAPIError(
            this.name,
            500,
            'KIE API 响应中没有 taskId',
            { result }
          );
        }

        console.log(`[${this.displayName}] 提交成功，任务 ID:`, taskId);

        return {
          id: taskId,
          status: 'queued',
          progress: 0,
          createdAt: Date.now(),
        };
      },
      {
        model,
        aspectRatio: config.aspect_ratio,
        nFrames: config.n_frames,
        removeWatermark: config.remove_watermark,
        hasReferenceImage: !!params.referenceImageUrl,
        promptLength: params.prompt.length,
        promptPreview: params.prompt.substring(0, 200) + (params.prompt.length > 200 ? '...' : ''),
      },
      context
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
      'kieCheckStatus',
      async () => {
        // 使用后端代理
        const apiUrl = `http://localhost:3001/api/kie/query?taskId=${encodeURIComponent(taskId)}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
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

        console.log(`[${this.displayName}] API Response:`, {
          taskId,
          code: data.code,
          msg: data.msg,
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : 'no data',
          fullResponse: data,
        });

        // KIE API 返回格式: {code: 200, msg: "success", data: {...}}
        if (data.code !== 200) {
          // 非 200 状态码表示错误
          return {
            taskId,
            status: 'error',
            progress: 0,
            videoUrl: undefined,
            videoUrlWatermarked: undefined,
            duration: undefined,
            quality: 'unknown',
            isCompliant: false,
            violationReason: data.msg || '查询任务失败',
            _rawData: data,
          };
        }

        const taskData = data.data || {};

        // 状态映射：KIE API 的状态值
        // 假设状态值: pending, processing, completed, failed
        const statusMap: Record<string, 'queued' | 'processing' | 'completed' | 'error'> = {
          'pending': 'queued',
          'queued': 'queued',
          'processing': 'processing',
          'completed': 'completed',
          'succeeded': 'completed',
          'failed': 'error',
          'error': 'error',
        };

        const status = statusMap[taskData.status] || 'processing';
        const progress = taskData.progress || 0;

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
            violationReason: taskData.error || taskData.message || '视频生成失败',
            _rawData: data,
          };
        }

        // 提取视频 URL
        // 假设 URL 字段在 taskData.output 或 taskData.videoUrl 或 taskData.url
        const videoUrl = taskData.output?.url || taskData.videoUrl || taskData.url || taskData.video_url;

        console.log(`[${this.displayName}] 最终返回:`, {
          taskId,
          status,
          progress,
          hasVideoUrl: !!videoUrl,
          videoUrlPreview: videoUrl ? videoUrl.substring(0, 100) : 'N/A',
        });

        return {
          taskId,
          status,
          progress,
          videoUrl,
          videoUrlWatermarked: undefined,  // KIE API 可能没有单独的水印视频
          duration: taskData.duration || taskData.n_frames,
          quality: 'standard',
          isCompliant: true,
          _rawData: data,
        };
      },
      { taskId, hasProgressCallback: !!onProgress },
      context
    );
  }
}
