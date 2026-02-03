// utils/nodeValidation.ts
import { AppNode, NodeType, Connection } from '../types';

/**
 * 节点依赖规则定义
 * 定义每种节点可以连接到哪些节点,以及输入输出限制
 */
export const NODE_DEPENDENCY_RULES: Record<NodeType, {
  allowedInputs: NodeType[];      // 允许作为输入的节点类型
  allowedOutputs: NodeType[];     // 允许作为输出连接到的节点类型
  minInputs: number;              // 最少输入数量
  maxInputs: number;              // 最多输入数量
  description: string;            // 规则描述
}> = {
  // 创意描述 - 作为起始节点,无输入,可输出到多种生成节点
  [NodeType.PROMPT_INPUT]: {
    allowedInputs: [],
    allowedOutputs: [
      NodeType.IMAGE_GENERATOR,
      NodeType.VIDEO_GENERATOR,
      NodeType.AUDIO_GENERATOR,
      NodeType.SCRIPT_PLANNER,
      NodeType.CHARACTER_NODE,
      NodeType.STORYBOARD_IMAGE  // 剧本分集子节点可以输出到分镜图设计
    ],
    minInputs: 0,
    maxInputs: 0,
    description: '文本输入节点,作为工作流的起点'
  },

  // 文字生图 - 可接收文本和图像输入,可输出到图像编辑和视频生成
  [NodeType.IMAGE_GENERATOR]: {
    allowedInputs: [
      NodeType.PROMPT_INPUT,
      NodeType.IMAGE_GENERATOR,
      NodeType.IMAGE_EDITOR,
      NodeType.STORYBOARD_GENERATOR,
      NodeType.CHARACTER_NODE,
      NodeType.STYLE_PRESET  // 接入风格设定
    ],
    allowedOutputs: [
      NodeType.IMAGE_GENERATOR,    // 可继续生成图像
      NodeType.VIDEO_GENERATOR,    // 图生视频
      NodeType.IMAGE_EDITOR        // 图像编辑
    ],
    minInputs: 0,
    maxInputs: 6,  // 支持多图参考 + 风格设定
    description: '生成图像,支持文本和参考图像输入'
  },

  // 文生视频 - 支持多种输入源,可输出到视频分析和继续生成
  [NodeType.VIDEO_GENERATOR]: {
    allowedInputs: [
      NodeType.PROMPT_INPUT,
      NodeType.IMAGE_GENERATOR,
      NodeType.VIDEO_GENERATOR,    // 视频续写
      NodeType.IMAGE_EDITOR,
      NodeType.STORYBOARD_GENERATOR,
      NodeType.CHARACTER_NODE,
      NodeType.STYLE_PRESET  // 接入风格设定
    ],
    allowedOutputs: [
      NodeType.VIDEO_GENERATOR,    // 视频续写
      NodeType.VIDEO_ANALYZER      // 视频分析
    ],
    minInputs: 0,
    maxInputs: 4,  // prompt + image/video + character + style
    description: '生成视频,支持文本、图像、视频输入'
  },

  // 灵感音乐 - 仅接收文本输入,作为终点节点
  [NodeType.AUDIO_GENERATOR]: {
    allowedInputs: [
      NodeType.PROMPT_INPUT,
      NodeType.STYLE_PRESET  // 接入风格设定
    ],
    allowedOutputs: [],  // 音频是终点节点
    minInputs: 1,
    maxInputs: 2,  // prompt + style
    description: '生成音频,接受文本和风格输入'
  },

  // 视频分析 - 仅接收视频输入,可输出到文本节点
  [NodeType.VIDEO_ANALYZER]: {
    allowedInputs: [
      NodeType.VIDEO_GENERATOR
    ],
    allowedOutputs: [
      NodeType.VIDEO_GENERATOR,    // 分析后再生成
      NodeType.SCRIPT_PLANNER      // 分析结果用于剧本
    ],
    minInputs: 1,
    maxInputs: 1,
    description: '分析视频内容,输出文本描述'
  },

  // 图像编辑 - 接收图像输入,可输出到图像和视频节点
  [NodeType.IMAGE_EDITOR]: {
    allowedInputs: [
      NodeType.IMAGE_GENERATOR,
      NodeType.IMAGE_EDITOR,
      NodeType.STYLE_PRESET  // 接入风格设定
    ],
    allowedOutputs: [
      NodeType.IMAGE_GENERATOR,
      NodeType.VIDEO_GENERATOR,
      NodeType.IMAGE_EDITOR        // 可继续编辑
    ],
    minInputs: 1,
    maxInputs: 3,  // 图像 + 编辑指令 + style
    description: '编辑图像,需要图像输入'
  },

  // 剧本大纲 - 接收文本输入,输出到分集和角色节点
  [NodeType.SCRIPT_PLANNER]: {
    allowedInputs: [
      NodeType.PROMPT_INPUT,
      NodeType.VIDEO_ANALYZER,
      NodeType.DRAMA_REFINED
    ],
    allowedOutputs: [
      NodeType.SCRIPT_EPISODE,
      NodeType.CHARACTER_NODE,
      NodeType.STYLE_PRESET  // 输出到风格设定
    ],
    minInputs: 0,
    maxInputs: 3,
    description: '生成剧本大纲'
  },

  // 剧本分集 - 接收大纲输入,输出到分镜和角色
  [NodeType.SCRIPT_EPISODE]: {
    allowedInputs: [
      NodeType.SCRIPT_PLANNER
    ],
    allowedOutputs: [
      NodeType.STORYBOARD_GENERATOR,
      NodeType.CHARACTER_NODE,
      NodeType.IMAGE_GENERATOR
    ],
    minInputs: 1,
    maxInputs: 1,
    description: '将大纲拆分为分集剧本'
  },

  // 分镜生成 - 接收剧本输入,输出到图像和视频
  [NodeType.STORYBOARD_GENERATOR]: {
    allowedInputs: [
      NodeType.SCRIPT_EPISODE,
      NodeType.PROMPT_INPUT
    ],
    allowedOutputs: [
      NodeType.IMAGE_GENERATOR,
      NodeType.VIDEO_GENERATOR
    ],
    minInputs: 1,
    maxInputs: 1,
    description: '生成电影分镜'
  },

  // 角色设计 - 接收剧本输入,输出到图像和视频
  [NodeType.CHARACTER_NODE]: {
    allowedInputs: [
      NodeType.SCRIPT_PLANNER,
      NodeType.SCRIPT_EPISODE,
      NodeType.PROMPT_INPUT,
      NodeType.STYLE_PRESET  // NEW: Accept global style preset
    ],
    allowedOutputs: [
      NodeType.IMAGE_GENERATOR,
      NodeType.VIDEO_GENERATOR,
      NodeType.STORYBOARD_IMAGE  // NEW: Output to storyboard image
    ],
    minInputs: 1,
    maxInputs: 10, // Allow multiple inputs for character deduplication and style
    description: '提取角色并生成角色档案（支持多输入去重和风格设定参考）'
  },

  // 分镜图设计 - 接收剧本和角色输入,生成九宫格分镜图
  [NodeType.STORYBOARD_IMAGE]: {
    allowedInputs: [
      NodeType.PROMPT_INPUT,
      NodeType.SCRIPT_EPISODE,
      NodeType.CHARACTER_NODE,  // Accept character design for consistency
      NodeType.STYLE_PRESET
    ],
    allowedOutputs: [
      NodeType.IMAGE_GENERATOR,
      NodeType.VIDEO_GENERATOR,
      NodeType.STORYBOARD_SPLITTER  // Output to storyboard splitter
    ],
    minInputs: 1,
    maxInputs: 10,  // prompt + episode + multiple characters + style
    description: '生成九宫格分镜图，支持角色一致性参考'
  },

  // 分镜图拆解 - 接收分镜图设计输入,拆分为单个分镜图
  [NodeType.STORYBOARD_SPLITTER]: {
    allowedInputs: [
      NodeType.STORYBOARD_IMAGE
    ],
    allowedOutputs: [
      NodeType.SORA_VIDEO_GENERATOR,  // Can output to Sora video generation
      NodeType.STORYBOARD_VIDEO_GENERATOR  // Can output to storyboard video generation
    ],
    minInputs: 1,
    maxInputs: 5,  // Can split up to 5 storyboard image nodes
    description: '拆解九宫格/六宫格分镜图为单个分镜，显示图片和详细描述'
  },

  // 剧目分析 - 无输入,可输出到剧目精炼和剧本大纲
  [NodeType.DRAMA_ANALYZER]: {
    allowedInputs: [],
    allowedOutputs: [
      NodeType.DRAMA_REFINED,
      NodeType.SCRIPT_PLANNER,
      NodeType.STYLE_PRESET  // 输出到风格设定
    ],
    minInputs: 0,
    maxInputs: 0,
    description: '分析剧目的IP潜力和创作价值'
  },

  // 剧目精炼 - 接收剧目分析输入,输出到剧本大纲
  [NodeType.DRAMA_REFINED]: {
    allowedInputs: [
      NodeType.DRAMA_ANALYZER
    ],
    allowedOutputs: [
      NodeType.SCRIPT_PLANNER,
      NodeType.SCRIPT_EPISODE,
      NodeType.IMAGE_GENERATOR,
      NodeType.STYLE_PRESET  // 输出到风格设定
    ],
    minInputs: 1,
    maxInputs: 1,
    description: '提取精炼标签,作为剧本创作的辅助信息'
  },

  // 风格设定 - 全局节点,可接收多个上游,输出到所有媒体生成节点
  [NodeType.STYLE_PRESET]: {
    allowedInputs: [
      NodeType.DRAMA_ANALYZER,
      NodeType.SCRIPT_PLANNER,
      NodeType.DRAMA_REFINED
    ],
    allowedOutputs: [
      NodeType.IMAGE_GENERATOR,
      NodeType.VIDEO_GENERATOR,
      NodeType.CHARACTER_NODE  // NEW: Output to character design
    ],
    minInputs: 0,
    maxInputs: 10,
    description: '全局风格设定,生成可复用的场景/人物风格描述词模板'
  },

  // Sora 2 视频生成器 - 接收分镜图拆解输入,生成 Sora 2 视频
  [NodeType.SORA_VIDEO_GENERATOR]: {
    allowedInputs: [
      NodeType.STORYBOARD_SPLITTER
    ],
    allowedOutputs: [
      NodeType.VIDEO_EDITOR  // Can output to video editor
    ],
    minInputs: 1,
    maxInputs: 5,  // Can accept up to 5 splitter nodes
    description: '将分镜数据转换为 Sora 2 视频，支持多镜头分组生成'
  },

  // Sora 2 视频子节点 - 仅作为显示节点,由父节点自动创建
  [NodeType.SORA_VIDEO_CHILD]: {
    allowedInputs: [
      NodeType.SORA_VIDEO_GENERATOR
    ],
    allowedOutputs: [
      NodeType.VIDEO_EDITOR  // Can output to video editor
    ],
    minInputs: 1,
    maxInputs: 1,
    description: '显示单个 Sora 2 视频生成结果'
  },

  // 分镜视频生成器 - 接收分镜图拆解输入,支持多模型视频生成
  [NodeType.STORYBOARD_VIDEO_GENERATOR]: {
    allowedInputs: [
      NodeType.STORYBOARD_SPLITTER
    ],
    allowedOutputs: [
      NodeType.VIDEO_EDITOR  // Can output to video editor
    ],
    minInputs: 1,
    maxInputs: 5,  // Can accept up to 5 splitter nodes
    description: '从分镜拆解节点获取分镜，支持多平台多模型视频生成（云雾API平台支持8个模型）'
  },

  // 分镜视频子节点 - 仅作为显示节点,由父节点自动创建
  [NodeType.STORYBOARD_VIDEO_CHILD]: {
    allowedInputs: [
      NodeType.STORYBOARD_VIDEO_GENERATOR
    ],
    allowedOutputs: [
      NodeType.VIDEO_EDITOR  // Can output to video editor
    ],
    minInputs: 1,
    maxInputs: 1,
    description: '显示单个分镜视频生成结果'
  },

  // 视频编辑器 - 接收多个视频节点,支持拼接和编辑
  [NodeType.VIDEO_EDITOR]: {
    allowedInputs: [
      NodeType.VIDEO_GENERATOR,
      NodeType.SORA_VIDEO_GENERATOR,
      NodeType.SORA_VIDEO_CHILD,  // Sora 2 视频结果
      NodeType.STORYBOARD_VIDEO_GENERATOR,
      NodeType.STORYBOARD_VIDEO_CHILD,  // 分镜视频结果
      NodeType.VIDEO_ANALYZER,
      NodeType.VIDEO_EDITOR  // 支持链式编辑
    ],
    allowedOutputs: [],  // 暂不考虑输出
    minInputs: 1,
    maxInputs: -1,  // 不限制输入数量
    description: '视频编辑器,拼接和编辑多个视频'
  }
};

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * 验证节点连接是否合法
 */
export function validateConnection(
  fromNode: AppNode,
  toNode: AppNode,
  existingConnections: Connection[]
): ValidationResult {

  // 1. 检查节点类型是否允许连接
  const fromRules = NODE_DEPENDENCY_RULES[fromNode.type];
  const toRules = NODE_DEPENDENCY_RULES[toNode.type];

  if (!fromRules.allowedOutputs.includes(toNode.type)) {
    return {
      valid: false,
      error: `"${fromNode.title}" 不能连接到 "${toNode.title}"`
    };
  }

  if (!toRules.allowedInputs.includes(fromNode.type)) {
    return {
      valid: false,
      error: `"${toNode.title}" 不接受来自 "${fromNode.title}" 的输入`
    };
  }

  // 2. 检查目标节点的输入数量限制
  const currentInputs = existingConnections.filter(c => c.to === toNode.id);

  // maxInputs 为 -1 表示不限制输入数量
  if (toRules.maxInputs >= 0 && currentInputs.length >= toRules.maxInputs) {
    return {
      valid: false,
      error: `"${toNode.title}" 最多只能接收 ${toRules.maxInputs} 个输入`
    };
  }

  // 3. 检查是否已存在相同的连接
  const duplicateConnection = existingConnections.find(
    c => c.from === fromNode.id && c.to === toNode.id
  );

  if (duplicateConnection) {
    return {
      valid: false,
      error: '该连接已存在'
    };
  }

  // 4. 检查是否会形成循环依赖
  if (hasCircularDependency(fromNode.id, toNode.id, existingConnections)) {
    return {
      valid: false,
      error: '不能创建循环依赖'
    };
  }

  // 5. 检查自连接
  if (fromNode.id === toNode.id) {
    return {
      valid: false,
      error: '节点不能连接到自己'
    };
  }

  return { valid: true };
}

/**
 * 检测循环依赖 (使用 DFS)
 */
function hasCircularDependency(
  fromId: string,
  toId: string,
  connections: Connection[]
): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(currentId: string): boolean {
    // 如果在递归栈中发现了起始节点,说明有环
    if (currentId === fromId) {
      return true;
    }

    if (visited.has(currentId)) {
      return false;
    }

    visited.add(currentId);
    recursionStack.add(currentId);

    // 查找所有从当前节点出发的连接
    const outgoingConnections = connections.filter(c => c.from === currentId);

    for (const conn of outgoingConnections) {
      if (dfs(conn.to)) {
        return true;
      }
    }

    recursionStack.delete(currentId);
    return false;
  }

  return dfs(toId);
}

/**
 * 验证节点是否可以执行 (检查输入是否满足)
 */
export function canExecuteNode(
  node: AppNode,
  connections: Connection[]
): ValidationResult {
  const rules = NODE_DEPENDENCY_RULES[node.type];

  // 获取当前节点的输入连接数
  const inputCount = connections.filter(c => c.to === node.id).length;

  // 检查最少输入要求
  if (inputCount < rules.minInputs) {
    return {
      valid: false,
      error: `"${getNodeDisplayName(node.type)}" 至少需要 ${rules.minInputs} 个输入才能执行`
    };
  }

  // 特殊验证: 某些节点需要特定的配置
  switch (node.type) {
    case NodeType.IMAGE_GENERATOR:
      if (!node.data.prompt && inputCount === 0) {
        return {
          valid: false,
          error: '请输入提示词或连接一个文本输入节点'
        };
      }
      break;

    case NodeType.VIDEO_GENERATOR:
      if (!node.data.prompt && inputCount === 0) {
        return {
          valid: false,
          error: '请输入提示词或连接一个输入节点'
        };
      }
      break;

    case NodeType.AUDIO_GENERATOR:
      if (!node.data.prompt && inputCount === 0) {
        return {
          valid: false,
          error: '请输入提示词或连接一个文本输入节点'
        };
      }
      break;

    case NodeType.SCRIPT_PLANNER:
      if (!node.data.scriptTheme) {
        return {
          valid: false,
          error: '请配置剧本主题'
        };
      }
      break;

    case NodeType.SCRIPT_EPISODE:
      if (!node.data.selectedChapter) {
        return {
          valid: false,
          error: '请选择要拆分的章节'
        };
      }
      break;

    case NodeType.STORYBOARD_GENERATOR:
      if (inputCount === 0) {
        return {
          valid: false,
          error: '请连接一个剧本节点'
        };
      }
      break;

    case NodeType.STORYBOARD_IMAGE:
      if (inputCount === 0 && !node.data.prompt) {
        return {
          valid: false,
          error: '请输入分镜描述或连接剧本节点'
        };
      }
      break;

    case NodeType.STORYBOARD_SPLITTER:
      if (inputCount === 0) {
        return {
          valid: false,
          error: '请连接至少一个分镜图设计节点'
        };
      }
      break;

    case NodeType.SORA_VIDEO_GENERATOR:
      if (inputCount === 0) {
        return {
          valid: false,
          error: '请连接至少一个分镜图拆解节点'
        };
      }
      break;

    case NodeType.CHARACTER_NODE:
      if (inputCount === 0) {
        return {
          valid: false,
          error: '请连接一个剧本节点'
        };
      }
      break;

    case NodeType.VIDEO_ANALYZER:
      if (inputCount === 0) {
        return {
          valid: false,
          error: '请连接一个视频生成节点'
        };
      }
      break;

    case NodeType.IMAGE_EDITOR:
      if (inputCount === 0) {
        return {
          valid: false,
          error: '请连接一个图像生成节点'
        };
      }
      if (!node.data.prompt) {
        return {
          valid: false,
          error: '请输入编辑指令'
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * 获取节点显示名称 (中文)
 */
function getNodeDisplayName(type: NodeType): string {
  const names: Record<NodeType, string> = {
    [NodeType.PROMPT_INPUT]: '创意描述',
    [NodeType.IMAGE_GENERATOR]: '文字生图',
    [NodeType.VIDEO_GENERATOR]: '文生视频',
    [NodeType.AUDIO_GENERATOR]: '灵感音乐',
    [NodeType.VIDEO_ANALYZER]: '视频分析',
    [NodeType.IMAGE_EDITOR]: '图像编辑',
    [NodeType.SCRIPT_PLANNER]: '剧本大纲',
    [NodeType.SCRIPT_EPISODE]: '剧本分集',
    [NodeType.STORYBOARD_GENERATOR]: '分镜生成',
    [NodeType.STORYBOARD_IMAGE]: '分镜图设计',
    [NodeType.STORYBOARD_SPLITTER]: '分镜图拆解',
    [NodeType.SORA_VIDEO_GENERATOR]: 'Sora 2 视频',
    [NodeType.STORYBOARD_VIDEO_GENERATOR]: '分镜视频生成',
    [NodeType.STORYBOARD_VIDEO_CHILD]: '分镜视频结果',
    [NodeType.CHARACTER_NODE]: '角色设计',
    [NodeType.DRAMA_ANALYZER]: '剧目分析',
    [NodeType.DRAMA_REFINED]: '剧目精炼',
    [NodeType.STYLE_PRESET]: '全局风格'
  };

  return names[type] || type;
}

/**
 * 获取节点可以连接到的节点类型列表
 */
export function getAllowedOutputTypes(nodeType: NodeType): NodeType[] {
  return NODE_DEPENDENCY_RULES[nodeType].allowedOutputs;
}

/**
 * 获取节点可以接受的输入节点类型列表
 */
export function getAllowedInputTypes(nodeType: NodeType): NodeType[] {
  return NODE_DEPENDENCY_RULES[nodeType].allowedInputs;
}

/**
 * 检查两个节点类型是否可以连接
 */
export function canConnectNodeTypes(fromType: NodeType, toType: NodeType): boolean {
  const fromRules = NODE_DEPENDENCY_RULES[fromType];
  const toRules = NODE_DEPENDENCY_RULES[toType];

  return fromRules.allowedOutputs.includes(toType) &&
         toRules.allowedInputs.includes(fromType);
}
