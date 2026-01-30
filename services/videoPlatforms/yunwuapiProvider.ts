/**
 * 云雾API平台提供商
 * 支持8个视频生成模型：veo, luma, runway, minimax, volcengine, grok, qwen, sora
 */

import {
  VideoPlatformProvider,
  VideoPlatformType,
  VideoModelType,
  VideoGenerationRequest,
  VideoGenerationResult
} from './types';

/**
 * 云雾API平台配置
 */
interface YunwuAPIConfig {
  baseUrl: string;
  endpoints: {
    submit: string;
    status: string;
  };
}

/**
 * 各模型API映射
 */
interface ModelEndpointMap {
  [key: string]: {
    submitModel: string;
    checkEndpoint: string;
    useUnifiedEndpoint: boolean;  // 是否使用统一端点
    submitEndpoint?: string;  // 独立端点（用于luma等）
  };
}

/**
 * 云雾API平台提供商实现
 */
export class YunwuAPIPlatformProvider implements VideoPlatformProvider {
  readonly platformCode: VideoPlatformType = 'yunwuapi';
  readonly platformName = '云雾API';
  readonly supportedModels: VideoModelType[] = [
    'veo',
    'luma',
    'runway',
    'minimax',
    'volcengine',
    'grok',
    'qwen',
    'sora'
  ];

  private readonly config: YunwuAPIConfig = {
    baseUrl: 'http://localhost:3001/api/yunwuapi',
    endpoints: {
      submit: '/create',
      status: '/status'
    }
  };

  /**
   * 模型端点映射
   */
  private readonly modelEndpoints: ModelEndpointMap = {
    veo: {
      submitModel: 'veo3.1-fast',
      checkEndpoint: '/veo/status',
      useUnifiedEndpoint: true
    },
    luma: {
      submitModel: 'ray-v2',
      checkEndpoint: '/luma/status',
      useUnifiedEndpoint: false,
      submitEndpoint: '/luma/generations'
    },
    runway: {
      submitModel: 'gen-3-alpha-turbo',
      checkEndpoint: '/runway/status',
      useUnifiedEndpoint: true
    },
    minimax: {
      submitModel: 'minimax-video',
      checkEndpoint: '/minimax/status',
      useUnifiedEndpoint: true
    },
    volcengine: {
      submitModel: 'doubao',
      checkEndpoint: '/volcengine/status',
      useUnifiedEndpoint: true
    },
    grok: {
      submitModel: 'grok-video',
      checkEndpoint: '/grok/status',
      useUnifiedEndpoint: true
    },
    qwen: {
      submitModel: 'qwen-vl-max',
      checkEndpoint: '/qwen/status',
      useUnifiedEndpoint: true
    },
    sora: {
      submitModel: 'sora-2',
      checkEndpoint: '/sora/status',
      useUnifiedEndpoint: true
    }
  };

  /**
   * 检查模型是否支持图生视频
   */
  supportsImageToVideo(model: VideoModelType): boolean {
    // 所有云雾API模型都支持图生视频
    return true;
  }

  /**
   * 检查模型是否支持某时长
   */
  supportsDuration(model: VideoModelType, duration: string): boolean {
    const modelConfig: Record<VideoModelType, string[]> = {
      veo: ['5', '10', '15'],
      luma: ['5', '10'],
      runway: ['5', '10', '15'],
      minimax: ['5', '10'],
      volcengine: ['5', '10', '15'],
      grok: ['5', '10'],
      qwen: ['5', '10', '15', '25'],
      sora: ['5', '10', '15']
    };

    return modelConfig[model]?.includes(duration) || false;
  }

  /**
   * 提交视频生成任务
   */
  async submitTask(
    model: VideoModelType,
    params: VideoGenerationRequest,
    apiKey: string,
    context?: any,
    subModel?: string  // 新增子模型参数
  ): Promise<{ taskId: string }> {
    try {
      const modelEndpoint = this.modelEndpoints[model];
      if (!modelEndpoint) {
        throw new Error(`不支持的模型: ${model}`);
      }

      // 优先使用 subModel，如果没有则使用默认的 submitModel
      const actualModel = subModel || modelEndpoint.submitModel;
      console.log(`[YunwuAPI] 提交任务 - 模型: ${model}, 子模型: ${actualModel}, 提示词: ${params.prompt.substring(0, 50)}...`);

      // luma 使用不同的端点和参数格式
      if (!modelEndpoint.useUnifiedEndpoint) {
        return this.submitLumaTask(params, apiKey, actualModel);
      }

      // veo/sora 等使用统一格式
      return this.submitUnifiedTask(model, params, apiKey, actualModel);
    } catch (error: any) {
      console.error(`[YunwuAPI] 提交任务失败:`, error);
      throw new Error(`云雾API任务提交失败: ${error.message}`);
    }
  }

  /**
   * 提交任务 - 统一格式（veo/sora/runway等）
   */
  private async submitUnifiedTask(
    model: VideoModelType,
    params: VideoGenerationRequest,
    apiKey: string,
    actualModel: string  // 实际使用的模型（子模型）
  ): Promise<{ taskId: string }> {
    const modelEndpoint = this.modelEndpoints[model];

    // 构建请求参数 - 根据模型类型添加不同参数
    const requestBody: any = {
      model: actualModel,  // 使用 actualModel（子模型）而不是 submitModel
      prompt: params.prompt,
      images: params.referenceImageUrl ? [params.referenceImageUrl] : [],  // ✅ 数组格式
      aspect_ratio: params.config.aspect_ratio,  // ✅ 直接传递
      duration: parseInt(params.config.duration)
    };

    // sora 特有参数
    if (model === 'sora') {
      requestBody.orientation = params.config.aspect_ratio === '16:9' ? 'landscape' : 'portrait';
      requestBody.size = params.config.quality === 'hd' ? 'large' : 'small';
      requestBody.watermark = false;
      requestBody.private = true;
      delete requestBody.aspect_ratio;  // sora 使用 orientation 而不是 aspect_ratio
    }

    // veo 特有参数
    if (model === 'veo') {
      requestBody.enhance_prompt = true;  // 中文转英文
      requestBody.enable_upsample = true;
    }

    console.log(`[YunwuAPI] 统一格式请求:`, JSON.stringify(requestBody, null, 2));

    // 通过本地代理调用
    const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.submit}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // 统一格式返回 id 或 task_id
    const taskId = data.id || data.task_id;
    if (!taskId) {
      throw new Error('响应中缺少task_id');
    }

    console.log(`[YunwuAPI] 统一格式任务提交成功: ${taskId}`);

    return { taskId };
  }

  /**
   * 提交任务 - Luma独立格式
   */
  private async submitLumaTask(
    params: VideoGenerationRequest,
    apiKey: string,
    actualModel: string  // 实际使用的模型（子模型）
  ): Promise<{ taskId: string }> {
    // Luma 使用不同的参数格式
    const requestBody = {
      user_prompt: params.prompt,
      model_name: actualModel,  // 使用 actualModel（子模型）
      duration: '5s',
      resolution: params.config.quality === 'hd' ? '1080p' : '720p',
      expand_prompt: true,
      loop: false,
      ...(params.referenceImageUrl && {
        image_url: params.referenceImageUrl
      })
    };

    console.log(`[YunwuAPI] Luma格式请求:`, JSON.stringify(requestBody, null, 2));

    // Luma 使用独立的端点
    const response = await fetch(`http://localhost:3001/api/yunwuapi/luma/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Luma 返回嵌套格式: { data: { task_id } }
    const taskId = data.data?.task_id || data.task_id;
    if (!taskId) {
      throw new Error('响应中缺少task_id');
    }

    console.log(`[YunwuAPI] Luma任务提交成功: ${taskId}`);

    return { taskId };
  }

  /**
   * 查询任务状态
   */
  async checkStatus(
    model: VideoModelType,
    taskId: string,
    apiKey: string,
    context?: any
  ): Promise<VideoGenerationResult> {
    try {
      const modelEndpoint = this.modelEndpoints[model];
      if (!modelEndpoint) {
        throw new Error(`不支持的模型: ${model}`);
      }

      // 通过本地代理调用
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.status}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          model: modelEndpoint.submitModel,
          task_id: taskId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      console.log('[YunwuAPI] 状态查询响应:', {
        taskId,
        rawStatus: data.status,
        rawProgress: data.progress,
        rawProgressPct: data.progress_pct,
        rawVideoUrl: data.video_url,
        fullData: data
      });

      // 映射状态
      let status: 'queued' | 'processing' | 'completed' | 'error';
      switch (data.status) {
        case 'pending':
        case 'queued':
          status = 'queued';
          break;
        case 'processing':
        case 'generating':
          status = 'processing';
          break;
        case 'completed':
        case 'succeeded':
          status = 'completed';
          break;
        case 'failed':
        case 'error':
          status = 'error';
          break;
        default:
          status = 'processing';
      }

      const progress = data.progress || data.progress_pct || 0;

      console.log('[YunwuAPI] 映射后的状态:', {
        taskId,
        mappedStatus: status,
        mappedProgress: progress,
        videoUrl: data.video_url
      });

      const result: VideoGenerationResult = {
        taskId,
        status,
        progress: progress
      };

      if (status === 'completed') {
        result.videoUrl = data.video_url;
        result.videoDuration = data.duration;
        result.videoResolution = data.resolution;
        result.coverUrl = data.cover_url;
        console.log('[YunwuAPI] 任务完成，视频URL:', data.video_url);
      }

      if (status === 'error') {
        result.error = data.error || '视频生成失败';
      }

      return result;
    } catch (error: any) {
      console.error(`[YunwuAPI] 查询状态失败:`, error);
      throw new Error(`云雾API状态查询失败: ${error.message}`);
    }
  }
}

/**
 * 导出单例实例
 */
export const yunwuapiPlatform = new YunwuAPIPlatformProvider();
