# Sora2 提示词生成优化方案

## 问题分析

### 当前实现
1. `services/soraPromptBuilder.ts` 中的 `buildProfessionalSoraPrompt` 函数虽然调用了 AI，但可能存在以下问题：
   - 提示词不够专业，没有充分利用 Sora 2 的最佳实践
   - 没有充分利用分镜的完整信息（景别、角度、运镜等）
   - 缺少对上下文的理解（前后分镜的连贯性）

2. `services/soraService.ts` 中的 `buildSoraStoryPrompt` 只是简单拼接，作为 fallback

### 数据流
```
STORYBOARD_IMAGE 节点
  └─ storyboardShots: DetailedStoryboardShot[] (包含完整的分镜信息)
      ↓
  splitStoryboardImage (utils/imageSplitter.ts)
      ↓
  splitShots: SplitStoryboardShot[] (包含所有字段)
      ↓
  SORA_VIDEO_GENERATOR 节点
      ↓
  buildProfessionalSoraPrompt (services/soraPromptBuilder.ts)
      ↓
  AI 生成优化后的 Sora 提示词
```

## 优化方案

### 1. 改进 AI 提示词构建逻辑

**目标**：生成更专业、更符合 Sora 2 最佳实践的提示词

**优化点**：

1. **充分利用分镜的完整信息**
   - 景别 (shotSize)：大远景/远景/全景/中景/中近景/近景/特写/大特写
   - 拍摄角度 (cameraAngle)：视平/高位俯拍/低位仰拍/斜拍/越肩/鸟瞰
   - 运镜方式 (cameraMovement)：固定/横移/俯仰/横摇/升降/轨道推拉/变焦推拉/正跟随/倒跟随/环绕/滑轨横移
   - 场景描述 (visualDescription)：具体的画面内容
   - 视觉特效 (visualEffects)
   - 音效 (audioEffects)

2. **添加上下文连贯性**
   - 考虑前后分镜的关系
   - 保持角色位置、状态的一致性
   - 平滑的镜头过渡

3. **使用 Sora 2 最佳实践**
   - 参考 OpenAI 官方 Sora 2 Prompting Guide
   - 使用结构化提示词（Style → Scene → Cinematography → Actions → Dialogue → Sound）
   - 具体化、可视化的描述
   - 避免抽象概念

### 2. 实现细节

#### 2.1 优化 `buildProfessionalSoraPrompt` 函数

```typescript
export async function buildProfessionalSoraPrompt(
  shots: SplitStoryboardShot[],
  options?: {
    visualStyle?: string;  // 整体视觉风格
    context?: string;      // 上下文信息
  }
): Promise<string>
```

**关键改进**：

1. **构建结构化的分镜信息**
```typescript
const shotsInfo = shots.map((shot, index) => {
  return `
镜头 ${shot.shotNumber} (${shot.duration}秒)
- 景别: ${shot.shotSize}
- 拍摄角度: ${shot.cameraAngle}
- 运镜方式: ${shot.cameraMovement}
- 场景: ${shot.scene || '未指定'}
- 画面描述: ${shot.visualDescription}
- 对话: ${shot.dialogue || '无'}
- 视觉特效: ${shot.visualEffects || '无'}
- 音效: ${shot.audioEffects || '无'}
`;
}).join('\n');
```

2. **使用更专业的 System Prompt**
```typescript
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
6. 总时长控制在合理范围（参考原分镜总时长）

现在，请根据以下分镜信息生成优化后的 Sora 2 提示词：`;
```

3. **增强的用户提示词**
```typescript
const userPrompt = `请为以下${shots.length}个分镜生成 Sora 2 视频提示词：

${shotsInfo}

${options?.visualStyle ? `整体视觉风格：${options.visualStyle}` : ''}

要求：
1. 总时长约 ${shots.reduce((sum, s) => sum + s.duration, 0).toFixed(1)} 秒
2. 保留所有关键视觉信息
3. 添加专业的摄影和灯光术语
4. 确保动作描述具体可实现
5. 使用 Sora 2 Story Mode 格式输出
6. 确保前后分镜之间的连贯性和一致性`;
```

#### 2.2 添加日志记录

使用 `logAPICall` 包装 AI 调用：

```typescript
return logAPICall(
  'buildProfessionalSoraPrompt',
  async () => {
    const { generateText } = await import('./geminiService');
    return await generateText(
      systemPrompt + '\n\n' + userPrompt,
      getUserDefaultModel('text')
    );
  },
  {
    shotCount: shots.length,
    totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
    hasVisualStyle: !!options?.visualStyle,
    model: getUserDefaultModel('text')
  },
  { nodeId: 'sora-generator', nodeType: 'SORA_VIDEO_GENERATOR' }
);
```

### 3. 实施步骤

1. ✅ 添加 Sora API 日志记录
   - `submitSoraTask` 已添加日志
   - `checkSoraTaskStatus` 已添加日志
   - `generateSoraVideo` 已传递 context 参数

2. ⏳ 优化 `buildProfessionalSoraPrompt`
   - 改进 System Prompt（已完成，在 soraPromptBuilder.ts 中）
   - 添加日志记录
   - 添加更多上下文信息

3. ⏳ 测试和验证
   - 测试生成的提示词质量
   - 验证 Sora API 日志是否正确显示
   - 检查提示词是否充分利用了分镜信息

## 预期效果

1. **更专业的 Sora 提示词**
   - 包含完整的影视术语
   - 结构化、易读
   - 符合 Sora 2 最佳实践

2. **更好的视频生成效果**
   - 画面更精确
   - 运镜更流畅
   - 整体质量更高

3. **完整的日志追踪**
   - 可以在 API 调试面板看到所有 Sora 相关请求
   - 方便调试和问题定位
