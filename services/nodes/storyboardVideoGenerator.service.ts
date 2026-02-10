/**
 * 分镜视频生成节点服务
 * 支持多平台、多模型视频生成
 */

import { AppNode, NodeType, SplitStoryboardShot, StoryboardVideoGeneratorData, StoryboardVideoChildData } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';
import { promptBuilderFactory } from '../promptBuilders';
import { generateVideoFromStoryboard } from '../videoGenerationService';
import { fuseStoryboardWithCharacterViews } from '../../utils/imageFusion';
import { uploadFileToOSS } from '../ossService';
import { getOSSConfig, getVideoPlatformApiKey } from '../soraConfigService';
import { VideoModelType } from '../videoPlatforms';

/**
 * 分镜视频生成节点服务
 */
export class StoryboardVideoGeneratorNodeService extends BaseNodeService {
  readonly nodeType = 'STORYBOARD_VIDEO_GENERATOR';

  /**
   * 验证输入
   */
  protected validateInputs(
    node: AppNode,
    context: NodeExecutionContext
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否连接了分镜拆解节点
    const splitterNode = this.getUpstreamNode(context, node.id, NodeType.STORYBOARD_SPLITTER);
    if (!splitterNode) {
      errors.push('请连接分镜拆解节点');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行节点
   */
  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    const data = node.data as StoryboardVideoGeneratorData;

    try {
      switch (data.status) {
        case 'idle':
          return await this.fetchShots(node, context);
        case 'selecting':
          return await this.generatePrompt(node, context);
        case 'prompting':
          return await this.generateVideo(node, context);
        default:
          return this.createSuccessResult();
      }
    } catch (error: any) {
      console.error('[StoryboardVideoGenerator] 执行失败:', error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * 获取分镜数据（阶段1 → 阶段2）
   */
  private async fetchShots(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {

    // 1. 获取上游分镜拆解节点
    const splitterNode = this.getUpstreamNode(context, node.id, NodeType.STORYBOARD_SPLITTER);
    if (!splitterNode) {
      return this.createErrorResult('未找到分镜拆解节点');
    }

    const splitShots: SplitStoryboardShot[] = splitterNode.data.splitShots || [];

    // 2. 尝试获取角色节点（可选）
    const characterNode = this.findUpstreamNode(
      context,
      node.id,
      NodeType.CHARACTER_NODE
    );
    const characterData = characterNode?.data?.generatedCharacters || [];

    // 3. 更新节点数据
    this.updateNodeData(node.id, {
      ...node.data,
      availableShots: splitShots,
      selectedShotIds: [],
      characterData,
      status: 'selecting' as const,
      childNodeIds: [],
    } as StoryboardVideoGeneratorData, context);


    return this.createSuccessResult({
      availableShots: splitShots,
      characterData
    });
  }

  /**
   * 生成提示词（阶段2 → 阶段3）
   */
  private async generatePrompt(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {

    const data = node.data as StoryboardVideoGeneratorData;

    // 1. 获取选中的分镜
    const selectedShots = data.availableShots.filter(s =>
      data.selectedShotIds.includes(s.id)
    );

    if (selectedShots.length === 0) {
      return this.createErrorResult('请先选择要生成的分镜');
    }


    // 2. 获取上游风格信息
    const { style: styleType, genre, setting } = this.getUpstreamStyleContext(node, context);
    const stylePrompt = this.getVisualStylePrompt(styleType);


    // 3. 调用 AI 生成提示词（使用 GenericBuilder，传递风格和对白保留选项）
    const builder = promptBuilderFactory.getByNodeType('STORYBOARD_VIDEO_GENERATOR');
    const prompt = await builder.build(selectedShots, {
      visualStyle: stylePrompt,
      context: `类型：${genre}，背景：${setting}`,
      preserveDialogue: true  // 保留对白，不翻译
    });


    // 4. 初始化默认配置
    const defaultConfig = {
      selectedPlatform: 'yunwuapi' as const,
      selectedModel: 'luma' as const,
      modelConfig: {
        aspect_ratio: '16:9' as const,
        duration: '5' as const,
        quality: 'standard' as const,
      },
      enableImageFusion: false,
      fusionLayout: 'grid' as const,
      fusionColumns: 3,
      includeCharacterViews: false,
    };

    // 5. 更新节点数据
    this.updateNodeData(node.id, {
      ...data,
      ...defaultConfig,
      generatedPrompt: prompt,
      promptModified: false,
      status: 'prompting' as const,
    } as StoryboardVideoGeneratorData, context);

    return this.createSuccessResult({
      prompt,
      ...defaultConfig
    });
  }

  /**
   * 生成视频（阶段3 → 阶段4 → 阶段5）
   */
  private async generateVideo(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {

    const data = node.data as StoryboardVideoGeneratorData;

    // 1. 获取选中的分镜
    const selectedShots = data.availableShots.filter(s =>
      data.selectedShotIds.includes(s.id)
    );

    // 2. 图片融合（如果启用）
    let referenceImageUrl: string | undefined;
    if (data.enableImageFusion) {

      this.updateNodeData(node.id, {
        ...data,
        status: 'generating' as const,
        progress: 0,
      } as StoryboardVideoGeneratorData, context);

      // 获取角色三视图
      const characterViews = data.includeCharacterViews && data.characterData?.[0]
        ? {
            frontView: data.characterData[0].frontView,
            sideView: data.characterData[0].sideView,
            backView: data.characterData[0].backView,
          }
        : {};

      // 融合图片
      const fusedImage = await fuseStoryboardWithCharacterViews(
        selectedShots,
        characterViews,
        {
          layout: data.fusionLayout,
          columns: data.fusionColumns
        }
      );

      // 上传到 OSS
      this.updateNodeData(node.id, {
        ...data,
        progress: 10,
      } as StoryboardVideoGeneratorData, context);

      const ossConfig = getOSSConfig();
      if (ossConfig) {
        const fileName = `storyboard-${node.id}-${Date.now()}.png`;
        referenceImageUrl = await uploadFileToOSS(fusedImage, fileName, ossConfig);

        this.updateNodeData(node.id, {
          ...data,
          fusedImageUrl: referenceImageUrl,
          progress: 20,
        } as StoryboardVideoGeneratorData, context);

      } else {
        referenceImageUrl = fusedImage;
      }
    }

    // 3. 生成视频
    this.updateNodeData(node.id, {
      ...data,
      status: 'generating' as const,
      progress: 30,
    } as StoryboardVideoGeneratorData, context);

    // 获取平台和模型配置
    const platformCode = data.selectedPlatform || 'yunwuapi';
    const model = data.selectedModel as VideoModelType;

    // 获取平台 API Key
    const apiKey = getVideoPlatformApiKey(platformCode);
    if (!apiKey) {
      throw new Error(`请先配置 ${platformCode} 平台的 API Key`);
    }

    const result = await generateVideoFromStoryboard(
      platformCode,
      model,
      data.generatedPrompt,
      referenceImageUrl,
      data.modelConfig,
      apiKey,
      {
        onProgress: (message, progress) => {
          // 将 0-100 的进度映射到 30-100
          const adjustedProgress = 30 + Math.round(progress * 0.7);
          this.updateNodeData(node.id, {
            ...data,
            progress: adjustedProgress,
          } as StoryboardVideoGeneratorData, context);
        }
      }
    );

    // 4. 创建子节点
    const childNodeId = await this.createChildNode(node, result, context);

    // 5. 更新节点状态为完成
    this.updateNodeData(node.id, {
      ...data,
      status: 'completed' as const,
      progress: 100,
      currentTaskId: result.taskId,
      childNodeIds: [...(data.childNodeIds || []), childNodeId],
    } as StoryboardVideoGeneratorData, context);


    return this.createSuccessResult({
      videoUrl: result.videoUrl,
      childNodeId
    });
  }

  /**
   * 创建子节点
   */
  private async createChildNode(
    parentNode: AppNode,
    videoResult: {
      videoUrl: string;
      taskId: string;
      duration: number;
      resolution: string;
    },
    context: NodeExecutionContext
  ): Promise<string> {
    const parentData = parentNode.data as StoryboardVideoGeneratorData;

    // 生成唯一ID
    const childId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 准备子节点数据
    const childData: StoryboardVideoChildData = {
      prompt: parentData.generatedPrompt,
      platformInfo: {
        platformCode: parentData.selectedPlatform || 'yunwuapi',
        modelName: parentData.selectedModel || 'luma',
      },
      modelConfig: {
        aspect_ratio: parentData.modelConfig.aspect_ratio,
        duration: parentData.modelConfig.duration,
        quality: parentData.modelConfig.quality,
      },
      videoUrl: videoResult.videoUrl,
      videoDuration: videoResult.duration,
      videoResolution: videoResult.resolution,
      fusedImageUrl: parentData.fusedImageUrl,
      promptExpanded: false,
    };

    // 创建子节点
    const childNode: AppNode = {
      id: childId,
      type: NodeType.STORYBOARD_VIDEO_CHILD,
      position: {
        x: parentNode.position.x + 300,
        y: parentNode.position.y
      },
      data: childData,
      title: `视频结果 #${(parentData.childNodeIds?.length || 0) + 1}`,
      status: 'SUCCESS' as const,
    };

    // 添加到画布
    context.nodes.push(childNode);


    return childId;
  }

  /**
   * 获取上游节点
   */
  private getUpstreamNode(
    context: NodeExecutionContext,
    nodeId: string,
    nodeType: NodeType
  ): AppNode | undefined {
    const connection = context.connections.find(c => c.to === nodeId);
    if (!connection) return undefined;

    const node = context.nodes.find(n => n.id === connection.from);
    if (!node || node.type !== nodeType) return undefined;

    return node;
  }

  /**
   * 查找上游节点（递归搜索）
   */
  private findUpstreamNode(
    context: NodeExecutionContext,
    nodeId: string,
    nodeType: NodeType
  ): AppNode | undefined {
    // 搜索直接连接
    const direct = this.getUpstreamNode(context, nodeId, nodeType);
    if (direct) return direct;

    // 递归搜索上游
    const connection = context.connections.find(c => c.to === nodeId);
    if (!connection) return undefined;

    const upstream = context.nodes.find(n => n.id === connection.from);
    if (!upstream) return undefined;

    return this.findUpstreamNode(context, upstream.id, nodeType);
  }

  /**
   * 获取上游风格上下文（递归查找 SCRIPT_PLANNER 或 SCRIPT_EPISODE）
   */
  private getUpstreamStyleContext(
    node: AppNode,
    context: NodeExecutionContext
  ): { style: '3D' | 'REAL' | 'ANIME'; genre: string; setting: string } {
    // 默认值
    let style: '3D' | 'REAL' | 'ANIME' = '3D';
    let genre = '';
    let setting = '';

    // 辅助函数：递归查找规划节点
    const findPlannerRecursive = (currentNode: AppNode, visited = new Set<string>()): AppNode | undefined => {
      if (visited.has(currentNode.id)) return undefined;
      visited.add(currentNode.id);

      // 检查当前节点是否是目标节点
      if (currentNode.type === NodeType.SCRIPT_PLANNER || currentNode.type === NodeType.SCRIPT_EPISODE) {
        return currentNode;
      }

      // 递归搜索上游
      const connections = context.connections.filter(c => c.to === currentNode.id);
      for (const conn of connections) {
        const upstream = context.nodes.find(n => n.id === conn.from);
        if (upstream) {
          const found = findPlannerRecursive(upstream, visited);
          if (found) return found;
        }
      }

      return undefined;
    };

    // 查找上游规划节点
    const plannerNode = findPlannerRecursive(node);

    if (plannerNode) {
      // 提取风格信息
      if (plannerNode.data.scriptVisualStyle) {
        style = plannerNode.data.scriptVisualStyle;
      }
      if (plannerNode.data.scriptGenre) {
        genre = plannerNode.data.scriptGenre;
      }
      if (plannerNode.data.scriptSetting) {
        setting = plannerNode.data.scriptSetting;
      }

    } else {
    }

    return { style, genre, setting };
  }

  /**
   * 根据风格类型生成视觉前缀
   */
  private getVisualStylePrompt(style: '3D' | 'REAL' | 'ANIME'): string {
    switch (style) {
      case '3D':
        return `Xianxia 3D animation character, semi-realistic style, Xianxia animation aesthetics, high precision 3D modeling, PBR shading with soft translucency, subsurface scattering, ambient occlusion, delicate and smooth skin texture (not overly realistic), flowing fabric clothing, individual hair strands, neutral studio lighting, clear focused gaze, natural demeanor`;

      case 'REAL':
        return `Professional portrait photography, photorealistic human, cinematic photography, professional headshot, DSLR quality, 85mm lens, sharp focus, realistic skin texture, visible pores, natural skin imperfections, subsurface scattering, natural lighting, studio portrait lighting, softbox lighting, rim light, golden hour`;

      case 'ANIME':
        return `Anime character, anime style, 2D anime art, manga illustration style, clean linework, crisp outlines, manga art style, detailed illustration, soft lighting, rim light, vibrant colors, cel shading lighting, flat shading`;

      default:
        return `3D动漫风格`;
    }
  }
}
