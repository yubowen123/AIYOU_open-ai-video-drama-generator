/**
 * Sora 2 提示词构建服务
 * 参考 OpenAI 官方 Sora 2 Prompting Guide 最佳实践
 *
 * @deprecated 此文件已废弃，请使用 services/promptBuilders 模块
 * 使用 promptBuilderFactory.getByNodeType('SORA_VIDEO_GENERATOR').build() 代替
 */

import { SplitStoryboardShot } from '../types';
import { getUserDefaultModel } from './modelConfig';
import { logAPICall } from './apiLogger';
import { llmProviderManager } from './llmProviders';

// 导入新的构建器工厂（延迟导入以避免循环依赖）
let promptBuilderFactory: any = null;

/**
 * @deprecated 使用 promptBuilderFactory.getByNodeType('SORA_VIDEO_GENERATOR').build() 代替
 * 构建专业的 Sora 2 视频提示词
 * 使用结构化方法，包含：风格、场景、摄影、动作、对话、音效
 *
 * @param shots 分镜列表
 * @param options 可选配置参数（向后兼容）
 * @returns Sora 2 提示词
 */
export async function buildProfessionalSoraPrompt(
  shots: SplitStoryboardShot[],
  options?: any
): Promise<string> {
  // 如果传入了配置参数，使用新的构建器架构
  if (options && typeof options === 'object') {
    if (!promptBuilderFactory) {
      const module = await import('./promptBuilders');
      promptBuilderFactory = module.promptBuilderFactory;
    }

    const builder = promptBuilderFactory.getByNodeType('SORA_VIDEO_GENERATOR');
    return builder.build(shots, options);
  }

  // 向后兼容：如果没有传入配置参数，使用原始逻辑（不含黑色空镜）
  return buildProfessionalSoraPromptLegacy(shots);
}

/**
 * 原始的提示词构建逻辑（向后兼容）
 * @deprecated 保留用于向后兼容，新代码应使用 promptBuilderFactory
 */
async function buildProfessionalSoraPromptLegacy(shots: SplitStoryboardShot[]): Promise<string> {
  if (shots.length === 0) {
    throw new Error('至少需要一个分镜');
  }

  // 构建完整的分镜信息
  const shotsInfo = shots.map((shot, index) => {
    return `
镜头 ${shot.shotNumber} (${shot.duration}秒)
- 景别: ${shot.shotSize}
- 拍摄角度: ${shot.cameraAngle}
- 运镜方式: ${shot.cameraMovement}
- 场景: ${shot.scene || '未指定'}
- 视觉描述: ${shot.visualDescription}
- 对话: ${shot.dialogue || '无'}
- 视觉特效: ${shot.visualEffects || '无'}
- 音效: ${shot.audioEffects || '无'}`;
  }).join('\n');

  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

  const userPrompt = `你是一位专业的 Sora 2 提示词生成器。你的任务是将分镜信息转换为 Sora 2 Story Mode 格式。

分镜信息：
${shotsInfo}

总时长：约 ${totalDuration.toFixed(1)} 秒

输出要求：
1. 只输出 Sora 2 Story Mode 格式
2. 必须以 Shot 1 开始（第一个实际分镜）
3. 不要添加任何前缀、后缀、说明、建议或解释
4. 不要使用 "---" 分隔线
5. 不要添加"导演建议"、"色彩控制"等额外内容
6. 直接开始输出 Shot 1

输出格式：
Shot 1:
duration: X.Xs
Scene: [第一个镜头的场景描述]

Shot 2:
duration: X.Xs
Scene: [第二个镜头的场景描述]`;

  const systemPrompt = `你是一个 Sora 2 提示词格式化工具。只负责将分镜信息转换为指定格式，不添加任何额外内容。`;

  try {
    return await logAPICall(
      'buildProfessionalSoraPrompt',
      async () => {
        const modelName = getUserDefaultModel('text');

        // 使用 llmProviderManager 统一调用，支持 Gemini 和云雾 API
        const text = await llmProviderManager.generateContent(
          systemPrompt + '\n\n' + userPrompt,
          modelName,
          {
            systemInstruction: systemPrompt
          }
        );

        if (!text) return buildBasicSoraPrompt(shots);

        // 清理多余内容
        return cleanSoraPrompt(text);
      },
      {
        shotCount: shots.length,
        totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
        model: getUserDefaultModel('text'),
        promptPreview: userPrompt.substring(0, 200) + '...'
      },
      { nodeId: 'sora-generator', nodeType: 'SORA_VIDEO_GENERATOR', platform: llmProviderManager.getCurrentProvider().getName() }
    );
  } catch (error: any) {
    console.error('[Sora Prompt Builder] AI enhancement failed, using basic prompt:', error);
    // 回退到基础提示词
    return buildBasicSoraPrompt(shots);
  }
}

/**
 * 清理 AI 生成的提示词，去除多余内容
 */
function cleanSoraPrompt(text: string): string {
  let cleaned = text.trim();

  // 移除常见的前缀
  const prefixesToRemove = [
    '好的，',
    '好的。',
    '以下是',
    '这是',
    '根据要求',
    '为你生成',
    '优化后的',
    '这是优化后的',
    '以下是优化后的',
    '你好',
    '你好，我是',
    '作为导演',
    '作为专业的',
    'Sure,',
    'Here is',
    'Certainly,',
    'I will',
    'Let me'
  ];

  for (const prefix of prefixesToRemove) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length).trim();
    }
  }

  // 确保以 "Shot 1:" 开头
  if (!cleaned.startsWith('Shot 1:')) {
    const shot1Index = cleaned.indexOf('Shot 1:');
    if (shot1Index !== -1) {
      cleaned = cleaned.substring(shot1Index).trim();
    } else {
      // 如果没找到 Shot 1，尝试查找其他 Shot
      const firstShotMatch = cleaned.match(/Shot \d+:/);
      if (firstShotMatch) {
        cleaned = cleaned.substring(firstShotMatch.index).trim();
      }
    }
  }

  // 移除 markdown 代码块标记
  cleaned = cleaned.replace(/```[\w]*\n?/g, '').trim();

  // 移除 "---" 或更多的分隔线及其后的额外内容
  // 找到第一个 "---" 并移除它之后的所有内容
  const separatorIndex = cleaned.indexOf('\n---');
  if (separatorIndex !== -1) {
    cleaned = cleaned.substring(0, separatorIndex).trim();
  }

  // 移除 "### " 开头的章节（导演建议等）
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    // 跳过以 ### 开头的行（这通常是额外的建议章节）
    if (trimmed.startsWith('###')) return false;
    // 跳过只包含 "---" 的行
    if (trimmed === '---' || trimmed.match(/^--+$/)) return false;
    return true;
  });

  cleaned = filteredLines.join('\n').trim();

  // 移除末尾可能的分隔线和额外内容
  const lastShotIndex = cleaned.lastIndexOf('\nShot ');
  if (lastShotIndex !== -1) {
    // 保留到最后一个 Shot
    const afterLastShot = cleaned.substring(lastShotIndex + 1);
    // 检查是否有非 Shot 的内容
    if (afterLastShot.includes('\n#') || afterLastShot.includes('\n---')) {
      // 找到最后一个 Shot 的结束位置
      const nextNewline = afterLastShot.indexOf('\n', afterLastShot.indexOf('Scene:') + 6);
      if (nextNewline !== -1) {
        cleaned = cleaned.substring(0, lastShotIndex + nextNewline + 1).trim();
      }
    }
  }

  return cleaned;
}

/**
 * 构建基础 Sora 提示词（回退方案）
 */
function buildBasicSoraPrompt(shots: SplitStoryboardShot[]): string {
  // 直接从 Shot 1 开始
  const actualShots = shots.map((shot, index) => {
    const duration = shot.duration || 5;
    const scene = shot.visualDescription || '';

    return `Shot ${index + 1}:
duration: ${duration.toFixed(1)}s
Scene: ${scene}`;
  }).join('\n\n');

  return actualShots;
}

/**
 * 构建单个镜头的详细提示词（用于编辑界面预览）
 */
export function buildSingleShotPrompt(shot: SplitStoryboardShot): string {
  const parts: string[] = [];

  // 1. 场景描述
  if (shot.visualDescription) {
    parts.push(`Scene: ${shot.visualDescription}`);
  }

  // 2. 摄影信息
  const cinematography: string[] = [];
  if (shot.shotSize) cinematography.push(`shot size: ${shot.shotSize}`);
  if (shot.cameraAngle) cinematography.push(`angle: ${shot.cameraAngle}`);
  if (shot.cameraMovement) cinematography.push(`movement: ${shot.cameraMovement}`);

  if (cinematography.length > 0) {
    parts.push(`Cinematography:\nCamera: ${cinematography.join(', ')}`);
  }

  // 3. 动作
  if (shot.visualDescription) {
    parts.push(`Actions:\n- ${shot.visualDescription}`);
  }

  // 4. 对话
  if (shot.dialogue && shot.dialogue !== '无') {
    parts.push(`Dialogue:\n${shot.dialogue}`);
  }

  // 5. 音效
  if (shot.audioEffects && shot.audioEffects !== '无') {
    parts.push(`Background Sound:\n${shot.audioEffects}`);
  }

  return parts.join('\n\n');
}

/**
 * 去除Sora提示词中的敏感词
 * 通过AI优化涉及暴力、色情、版权侵权或名人信息的提示词
 *
 * @param soraPrompt 原始Sora提示词
 * @returns 清理后的提示词
 */
export async function removeSensitiveWords(soraPrompt: string): Promise<string> {
  if (!soraPrompt || soraPrompt.trim().length === 0) {
    throw new Error('提示词不能为空');
  }

  const systemPrompt = `你是一个专业的Sora提示词净化工具。你的任务是检测并优化提示词中的敏感内容，同时保持原有的结构和格式不变。

敏感词类型：
1. 暴力内容：流血、死亡、残肢、酷刑、吐血、鲜血等
2. 色情内容：裸露、性暗示、不雅行为、赤身裸体等
3. 版权侵权：商标、品牌、受版权保护的角色名（如米老鼠、迪士尼等）
4. 名人信息：真实人物姓名、肖像描述

优化原则：
- 仅针对特定敏感词进行替换或删除
- 保持Shot结构完整（Shot X:, duration:, Scene:）
- 保持原有的时长、运镜、场景等描述
- 使用中性表达替代敏感内容
- 不要添加任何额外的解释或说明`;

  const userPrompt = `请优化以下Sora提示词，去除敏感词但保持结构不变：

${soraPrompt}

输出要求：
1. 保持完整的Shot结构（Shot 1:, Shot 2:, 等）
2. 只修改敏感内容，其他部分完全不变
3. 直接输出优化后的提示词，不要添加任何解释或前缀
4. 必须以"Shot 1:"开始
5. 不要添加"以下是优化后的提示词"等说明文字

敏感词替换示例：
- "吐血" → "重伤"或"吐白沫"
- "死亡" → "倒地不起"或"失去意识"
- "鲜血直流" → "红色液体流出"
- "赤身裸体" → "穿着单薄"
- "米老鼠" → "某卡通老鼠角色"
- "迪士尼" → "某动画公司"`;

  return await logAPICall(
    'removeSensitiveWords',
    async () => {
      const modelName = getUserDefaultModel('text');


      const startTime = Date.now();

      // 使用 llmProviderManager 统一调用，支持 Gemini 和云雾 API
      const response = await llmProviderManager.generateContent(
        systemPrompt + '\n\n' + userPrompt,
        modelName,
        {
          systemInstruction: systemPrompt
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;


      if (!response) {
        console.error('[去敏感词] ❌ AI 返回为空');
        throw new Error('AI未能返回优化后的提示词');
      }

      let text = response;


      // 清理多余内容
      text = text.trim();

      // 确保以Shot 1:开始
      if (!text.startsWith('Shot 1:')) {
        console.warn('[去敏感词] ⚠️ 返回内容不以"Shot 1:"开始，尝试提取');
        // 尝试提取Shot部分
        const shotMatch = text.match(/Shot 1:/s);
        if (shotMatch) {
          text = text.substring(shotMatch.index);
        } else {
          console.error('[去敏感词] ❌ 无法找到Shot 1');
          throw new Error('优化后的提示词格式错误：未找到Shot 1');
        }
      }


      return text;
    },
    {
      originalLength: soraPrompt.length,
      promptPreview: soraPrompt.substring(0, 200),
      modelName: getUserDefaultModel('text')
    }
  );
}
