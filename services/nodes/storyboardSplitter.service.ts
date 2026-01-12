/**
 * 分镜图拆解节点服务
 * 负责切割九宫格/六宫格分镜图为单个分镜
 */

import { AppNode } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';
import { splitMultipleStoryboardImages } from '../../utils/imageSplitter';

/**
 * 分镜图拆解节点服务
 */
export class StoryboardSplitterNodeService extends BaseNodeService {
  readonly nodeType = 'STORYBOARD_SPLITTER';

  /**
   * 验证输入
   */
  protected validateInputs(
    node: AppNode,
    context: NodeExecutionContext
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 获取选中的源节点
    const selectedSourceIds = node.data.selectedSourceNodes || [];
    if (selectedSourceIds.length === 0) {
      errors.push('请选择至少一个分镜图节点');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行分镜图拆解
   */
  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      // 1. 获取选中的源节点
      const selectedSourceIds = node.data.selectedSourceNodes || [];

      // 2. 获取源节点数据
      const sourceNodes = selectedSourceIds
        .map(id => context.nodes.find(n => n.id === id))
        .filter(n => n !== undefined) as AppNode[];

      if (sourceNodes.length === 0) {
        return this.createErrorResult('未找到选中的分镜图节点');
      }

      // 3. 更新节点状态
      this.updateNodeData(node.id, {
        ...node.data,
        isSplitting: true,
        splitProgress: 0
      }, context);

      // 4. 准备切割数据
      const nodesToSplit = sourceNodes.map(n => ({
        id: n.id,
        title: n.title,
        data: {
          storyboardGridImages: n.data.storyboardGridImages || [],
          storyboardGridType: n.data.storyboardGridType || '9',
          storyboardShots: n.data.storyboardShots || []
        }
      }));

      // 5. 执行切割
      const splitShots = await splitMultipleStoryboardImages(
        nodesToSplit,
        (current, total, currentNode) => {
          // 更新进度
          const progress = Math.round((current / total) * 100);
          this.updateNodeData(node.id, {
            ...node.data,
            isSplitting: true,
            splitProgress: progress,
            currentSplitting: currentNode
          }, context);
        }
      );

      // 6. 更新节点数据
      const resultData = {
        ...node.data,
        isSplitting: false,
        splitProgress: 100,
        splitShots,
        splitAt: new Date().toISOString()
      };

      this.updateNodeData(node.id, resultData, context);

      // 7. 返回成功结果
      return this.createSuccessResult(
        resultData,
        {
          splitShots,
          totalShots: splitShots.length
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '拆解失败';

      // 更新节点为错误状态
      this.updateNodeData(node.id, {
        ...node.data,
        isSplitting: false,
        splitError: errorMessage
      }, context);

      return this.createErrorResult(errorMessage);
    }
  }
}
