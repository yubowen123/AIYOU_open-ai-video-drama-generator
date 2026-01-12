/**
 * 视频生成节点服务
 * 负责调用 Google Gemini API 生成视频
 */

import { AppNode } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';
import { generateVideo } from '../geminiService';

/**
 * 视频生成节点服务
 */
export class VideoGeneratorNodeService extends BaseNodeService {
  readonly nodeType = 'VIDEO_GENERATOR';

  /**
   * 验证输入
   */
  protected validateInputs(
    node: AppNode,
    context: NodeExecutionContext
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否有输入提示词或图片
    const inputData = this.getSingleInput(node, context);
    const prompt = inputData?.prompt || node.data.prompt;
    const imageUrl = inputData?.imageUrl || node.data.imageUrl;

    if (!prompt && !imageUrl) {
      errors.push('缺少输入提示词或参考图片');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行视频生成
   */
  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      // 1. 获取输入数据
      const inputData = this.getSingleInput(node, context);
      const prompt = inputData?.prompt || node.data.prompt || '';
      const imageUrl = inputData?.imageUrl || node.data.imageUrl;

      if (!prompt && !imageUrl) {
        return this.createErrorResult('提示词或参考图片不能为空');
      }

      // 2. 更新节点状态
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'generating',
        progress: 0
      }, context);

      // 3. 构建请求参数
      const request = {
        prompt,
        imageUrl,
        model: node.data.model || 'veo-3.1-generate-preview',
        aspectRatio: node.data.aspectRatio || '16:9',
        resolution: node.data.resolution || '1080p',
        count: node.data.count || 1,
        generationMode: node.data.generationMode || 'TEXT_TO_VIDEO'
      };

      // 4. 调用 Gemini API
      console.log(`[VideoGeneratorNodeService] 开始生成视频:`, request);

      const result = await generateVideo(
        request.prompt,
        request.model,
        {
          aspectRatio: request.aspectRatio,
          resolution: request.resolution,
          count: request.count,
          generationMode: request.generationMode
        },
        request.imageUrl || null,
        undefined, // videoInput
        undefined, // referenceImages
        {
          nodeId: node.id,
          nodeType: this.nodeType
        }
      );

      // 5. 处理响应
      if (!result || !result.uri) {
        return this.createErrorResult('生成失败，未返回视频');
      }

      // 6. 更新节点数据
      const resultData = {
        ...node.data,
        status: 'success',
        progress: 100,
        videoUrl: result.uri,
        videoUrls: result.uris || [result.uri],
        thumbnailUrl: result.videoMetadata?.thumbnail,
        isFallbackImage: result.isFallbackImage,
        videoMetadata: result.videoMetadata,
        generatedAt: new Date().toISOString()
      };

      this.updateNodeData(node.id, resultData, context);

      console.log(`[VideoGeneratorNodeService] 视频生成成功:`, result);

      // 7. 返回成功结果
      return this.createSuccessResult(
        resultData,
        {
          videoUrl: result.uri,
          videoUrls: result.uris || [result.uri],
          thumbnailUrl: result.videoMetadata?.thumbnail,
          prompt: request.prompt
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      console.error(`[VideoGeneratorNodeService] 生成失败:`, error);

      return this.createErrorResult(errorMessage);
    }
  }
}
