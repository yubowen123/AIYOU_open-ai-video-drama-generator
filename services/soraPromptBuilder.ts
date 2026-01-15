/**
 * Sora 2 提示词构建服务
 * 参考 OpenAI 官方 Sora 2 Prompting Guide 最佳实践
 */

import { SplitStoryboardShot } from '../types';
import { getUserDefaultModel } from './modelConfig';
import { logAPICall } from './apiLogger';

/**
 * 构建专业的 Sora 2 视频提示词
 * 使用结构化方法，包含：风格、场景、摄影、动作、对话、音效
 */
export async function buildProfessionalSoraPrompt(shots: SplitStoryboardShot[]): Promise<string> {
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

  const systemPrompt = `你是一位专业的电影导演和视频制作专家，精通 OpenAI Sora 2 的提示词编写。

请根据提供的分镜信息，生成符合 Sora 2 最佳实践的专业视频提示词。

## Sora 2 提示词结构规范

提示词应包含以下关键部分（按优先级排序）：

### 1. 风格定义（Style）
使用明确的风格术语，例如：
- 时代风格：1970s romantic drama, 90s handheld documentary, futuristic sci-fi
- 视觉风格：hand-painted 2D/3D hybrid animation, IMAX-scale epic, vintage 16mm film
- 技术风格：35mm film with natural flares, anamorphic 2.0x lens, digital capture emulating 65mm

### 2. 场景描述（Scene Description）
使用具体、可视化的语言：
- ✅ 好："wet asphalt, zebra crosswalk, neon signs reflecting in puddles"
- ❌ 差："a beautiful street at night"

包含：
- 环境细节（天气、光线、色彩）
- 人物外观（服装、表情、动作）
- 道具和布景
- 时间和氛围

### 3. 摄影（Cinematography）
明确指定：
- Camera shot: [景别和角度]
  - 示例：wide establishing shot, eye level / medium close-up, low angle
- Lens: [镜头类型]
  - 示例：32mm spherical prime, 50mm, anamorphic 2.0x, 35mm virtual lens
- Depth of field: shallow / deep
- Lighting: [灯光描述]
  - 示例：warm key from overhead practical, cool spill from window
- Mood: [整体基调]
  - 示例：cinematic and tense, playful and suspenseful, nostalgic and tender

### 4. 动作（Actions）
每个动作应该是：
- 具体的节拍（beats），而不是笼统的描述
- ✅ 好："Actor takes four steps to the window, pauses, and pulls the curtain"
- ❌ 差："Actor walks across the room"
- 与时长匹配（4秒视频 = 1-2个简单动作）

使用列表格式：
- Action 1: [具体节拍]
- Action 2: [另一个节拍]
- Action 3: [对话或反应]

### 5. 对话（Dialogue）
- 简短自然，匹配视频时长
- 明确标注说话者
- 可选：在场景描述中自然融入对话

### 6. 背景音效（Background Sound）
描述环境音：
- 示例："rain patters on the window, clock ticks steadily"
- 保持简洁，作为节奏提示

## Sora 2 Story Mode 格式

对于多镜头视频，使用以下格式：

Shot 1:
duration: 3.0s
Scene: [完整的场景描述，包含摄影、动作、灯光等信息]

Shot 2:
duration: 4.0s
Scene: [下一个镜头...]

## 重要原则

1. **具体性优先**：使用具体、可视化的名词和动词
2. **简洁明了**：每个镜头聚焦一个主要事件
3. **镜头明确**：明确指定相机运动和角度
4. **视觉化语言**：描述观众能看到的东西，而不是抽象概念
5. **保持一致性**：使用一致的术语描述相似元素

## 输出要求

1. 严格遵循 Sora 2 Story Mode 格式
2. 每个镜头包含 duration 和 Scene 两部分
3. Scene 部分应该是一个完整的、结构化的描述
4. 适当添加细节使画面生动，但不要大幅改变原意
5. 融入专业影视术语但不破坏可读性
6. 总长度控制在合理范围（参考原分镜总时长）

现在，请根据以下分镜信息生成优化后的 Sora 2 提示词：`;

  const userPrompt = `请为以下${shots.length}个分镜生成 Sora 2 视频提示词：

${shotsInfo}

要求：
1. 总时长约 ${shots.reduce((sum, s) => sum + s.duration, 0).toFixed(1)} 秒
2. 保留所有关键视觉信息
3. 添加专业的摄影和灯光术语
4. 确保动作描述具体可实现
5. 使用 Sora 2 Story Mode 格式输出`;

  try {
    const { sendChatMessage } = await import('./geminiService');

    return await logAPICall(
      'buildProfessionalSoraPrompt',
      async () => {
        return await sendChatMessage(
          systemPrompt + '\n\n' + userPrompt,
          getUserDefaultModel('text')
        );
      },
      {
        shotCount: shots.length,
        totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
        model: getUserDefaultModel('text'),
        promptPreview: userPrompt.substring(0, 200) + '...'
      },
      { nodeId: 'sora-generator', nodeType: 'SORA_VIDEO_GENERATOR' }
    );
  } catch (error: any) {
    console.error('[Sora Prompt Builder] AI enhancement failed, using basic prompt:', error);
    // 回退到基础提示词
    return buildBasicSoraPrompt(shots);
  }
}

/**
 * 构建基础 Sora 提示词（回退方案）
 */
function buildBasicSoraPrompt(shots: SplitStoryboardShot[]): string {
  return shots.map((shot, index) => {
    const duration = shot.duration || 5;
    const scene = shot.visualDescription || '';

    return `Shot ${index + 1}:
duration: ${duration.toFixed(1)}sec
Scene: ${scene}`;
  }).join('\n\n');
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
