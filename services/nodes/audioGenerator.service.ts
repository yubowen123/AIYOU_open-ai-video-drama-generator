/**
 * 音频生成节点服务
 * 负责调用 Google Gemini API 生成音乐/音效
 */

import { AppNode } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';
import { generateAudio } from '../geminiService';

/**
 * 音频生成节点服务
 */
export class AudioGeneratorNodeService extends BaseNodeService {
  readonly nodeType = 'AUDIO_GENERATOR';

  /**
   * 验证输入
   */
  protected validateInputs(
    node: AppNode,
    context: NodeExecutionContext
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const prompt = node.data.prompt;
    if (!prompt) {
      errors.push('缺少音频描述提示词');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行音频生成
   */
  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      const prompt = node.data.prompt || '';

      if (!prompt) {
        return this.createErrorResult('提示词不能为空');
      }

      // 更新节点状态
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'generating',
        progress: 0
      }, context);

      // 构建请求参数
      const request = {
        prompt,
        referenceAudio: node.data.referenceAudio,
        persona: node.data.persona,
        emotion: node.data.emotion
      };

      // 调用 Gemini API
      console.log(`[AudioGeneratorNodeService] 开始生成音频:`, request);

      const audioData = await generateAudio(
        request.prompt,
        request.referenceAudio,
        {
          persona: request.persona,
          emotion: request.emotion
        },
        {
          nodeId: node.id,
          nodeType: this.nodeType
        }
      );

      // 处理响应
      if (!audioData) {
        return this.createErrorResult('生成失败，未返回音频');
      }

      // 更新节点数据
      const resultData = {
        ...node.data,
        status: 'success',
        progress: 100,
        audioUrl: audioData,
        generatedAt: new Date().toISOString()
      };

      this.updateNodeData(node.id, resultData, context);

      console.log(`[AudioGeneratorNodeService] 音频生成成功`);

      // 返回成功结果
      return this.createSuccessResult(
        resultData,
        {
          audioUrl: audioData,
          prompt: request.prompt
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      console.error(`[AudioGeneratorNodeService] 生成失败:`, error);

      return this.createErrorResult(errorMessage);
    }
  }
}
