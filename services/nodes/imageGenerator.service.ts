/**
 * 图像生成节点服务
 * 负责调用 Google Gemini API 生成图像
 */

import { AppNode } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult, NodeStatus } from './baseNode.service';
import { generateImageFromText } from '../geminiService';

/**
 * 图像生成请求接口
 */
interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  inputImages?: string[];
  aspectRatio?: string;
  resolution?: string;
  count?: number;
}

/**
 * 图像生成节点服务
 */
export class ImageGeneratorNodeService extends BaseNodeService {
  readonly nodeType = 'IMAGE_GENERATOR';

  /**
   * 验证输入
   */
  protected validateInputs(
    node: AppNode,
    context: NodeExecutionContext
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否有输入提示词
    const inputData = this.getSingleInput(node, context);
    if (!inputData || !inputData.prompt) {
      errors.push('缺少输入提示词');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行图像生成
   */
  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      // 1. 获取输入数据
      const inputData = this.getSingleInput(node, context);
      const prompt = inputData?.prompt || node.data.prompt || '';

      if (!prompt) {
        return this.createErrorResult('提示词不能为空');
      }

      // 2. 更新节点状态
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'generating',
        progress: 0
      }, context);

      // 3. 构建请求参数
      const request: ImageGenerationRequest = {
        prompt,
        negativePrompt: node.data.negativePrompt || '',
        model: node.data.model || 'gemini-2.5-flash-image',
        inputImages: node.data.inputImages || [],
        aspectRatio: node.data.aspectRatio || '1:1',
        resolution: node.data.resolution || '1024x1024',
        count: node.data.count || 1
      };

      // 4. 调用 Gemini API
      console.log(`[ImageGeneratorNodeService] 开始生成图像:`, request);

      const imageUrls = await generateImageFromText(
        request.prompt,
        request.model,
        request.inputImages,
        {
          aspectRatio: request.aspectRatio,
          resolution: request.resolution,
          count: request.count
        },
        {
          nodeId: node.id,
          nodeType: this.nodeType
        }
      );

      // 5. 处理响应
      if (!imageUrls || imageUrls.length === 0) {
        return this.createErrorResult('生成失败，未返回图像');
      }

      // 6. 更新节点数据
      const resultData = {
        ...node.data,
        status: 'success',
        progress: 100,
        imageUrl: imageUrls[0], // 主图像
        imageUrls: imageUrls,    // 所有生成的图像
        generatedAt: new Date().toISOString()
      };

      this.updateNodeData(node.id, resultData, context);

      console.log(`[ImageGeneratorNodeService] 图像生成成功:`, imageUrls);

      // 7. 返回成功结果
      return this.createSuccessResult(
        resultData,
        {
          imageUrl: imageUrls[0],
          imageUrls: imageUrls,
          prompt: request.prompt
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      console.error(`[ImageGeneratorNodeService] 生成失败:`, error);

      return this.createErrorResult(errorMessage);
    }
  }
}
