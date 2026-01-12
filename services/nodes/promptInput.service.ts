/**
 * 提示词输入节点服务
 * 负责收集和存储用户输入的提示词
 */

import { AppNode } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';

/**
 * 提示词输入节点服务
 * 这是一个简单的数据收集节点，不调用外部 API
 */
export class PromptInputNodeService extends BaseNodeService {
  readonly nodeType = 'PROMPT_INPUT';

  /**
   * 执行提示词输入节点
   * 这个节点只负责验证和格式化输入数据
   */
  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      const prompt = node.data.prompt || '';

      if (!prompt.trim()) {
        return this.createErrorResult('提示词不能为空');
      }

      // 更新节点数据
      const resultData = {
        ...node.data,
        status: 'success',
        lastModified: new Date().toISOString()
      };

      this.updateNodeData(node.id, resultData, context);

      // 输出提示词给下游节点
      return this.createSuccessResult(
        resultData,
        {
          prompt: prompt.trim(),
          wordCount: prompt.trim().split(/\s+/).length
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '处理失败';
      return this.createErrorResult(errorMessage);
    }
  }
}
