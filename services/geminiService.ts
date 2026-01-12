
import { GoogleGenAI, GenerateContentResponse, Type, Modality, Part, FunctionDeclaration } from "@google/genai";
import { SmartSequenceItem, VideoGenerationMode, StoryboardShot, CharacterProfile } from "../types";
import { logAPICall } from "./apiLogger";

// Get API Key from localStorage only
const getApiKey = (): string | null => {
  // Only use user configured API Key in localStorage
  const userApiKey = localStorage.getItem('GEMINI_API_KEY');
  if (userApiKey && userApiKey.trim()) {
    return userApiKey.trim();
  }

  // No fallback - user must configure their own key
  return null;
};

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_NOT_CONFIGURED");
  }
  return new GoogleGenAI({ apiKey });
};

const getErrorMessage = (error: any): string => {
    if (!error) return "Unknown error";
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error && error.error.message) return error.error.message;
    return JSON.stringify(error);
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  baseDelay: number = 2000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const msg = getErrorMessage(error).toLowerCase();
      const isOverloaded = error.status === 503 || error.code === 503 || msg.includes("overloaded") || msg.includes("503") || error.status === 429 || error.code === 429;

      if (isOverloaded && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`API Overloaded (503/429). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await wait(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ... (Audio/Video/Image Utilities UNCHANGED) ...
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const combineBase64Chunks = (chunks: string[], sampleRate: number = 24000): string => {
    let totalLength = 0;
    const arrays: Uint8Array[] = [];
    
    for (const chunk of chunks) {
        const arr = base64ToUint8Array(chunk);
        arrays.push(arr);
        totalLength += arr.length;
    }

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        merged.set(arr, offset);
        offset += arr.length;
    }

    const channels = 1;
    const bitDepth = 16;
    const header = new ArrayBuffer(44);
    const headerView = new DataView(header);
    
    writeString(headerView, 0, 'RIFF');
    headerView.setUint32(4, 36 + totalLength, true);
    writeString(headerView, 8, 'WAVE');
    writeString(headerView, 12, 'fmt ');
    headerView.setUint32(16, 16, true); 
    headerView.setUint16(20, 1, true); 
    headerView.setUint16(22, channels, true); 
    headerView.setUint32(24, sampleRate, true);
    headerView.setUint32(28, sampleRate * channels * (bitDepth / 8), true); 
    headerView.setUint16(32, channels * (bitDepth / 8), true); 
    headerView.setUint16(34, bitDepth, true);
    writeString(headerView, 36, 'data');
    headerView.setUint32(40, totalLength, true);
    
    const wavFile = new Uint8Array(header.byteLength + totalLength);
    wavFile.set(new Uint8Array(header), 0);
    wavFile.set(merged, header.byteLength);

    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < wavFile.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(wavFile.subarray(i, i + chunk)));
    }
    
    return 'data:audio/wav;base64,' + btoa(binary);
};

const pcmToWav = (base64PCM: string, sampleRate: number = 24000): string => {
    return combineBase64Chunks([base64PCM], sampleRate);
};

export const urlToBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to convert URL to Base64", e);
        return "";
    }
};

const convertImageToCompatibleFormat = async (base64Str: string): Promise<{ data: string, mimeType: string, fullDataUri: string }> => {
    if (base64Str.match(/^data:image\/(png|jpeg|jpg);base64,/)) {
        const match = base64Str.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = match ? match[1] : 'image/png';
        const data = base64Str.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
        return { data, mimeType, fullDataUri: base64Str };
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error("Canvas context failed")); return; }
            ctx.drawImage(img, 0, 0);
            const pngDataUrl = canvas.toDataURL('image/png');
            const data = pngDataUrl.replace(/^data:image\/png;base64,/, "");
            resolve({ data, mimeType: 'image/png', fullDataUri: pngDataUrl });
        };
        img.onerror = (e) => reject(new Error("Image conversion failed for Veo compatibility"));
        img.src = base64Str;
    });
};

export const extractLastFrame = (videoSrc: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = "anonymous"; 
        video.src = videoSrc;
        video.muted = true;
        video.onloadedmetadata = () => { video.currentTime = Math.max(0, video.duration - 0.1); };
        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    reject(new Error("Canvas context failed"));
                }
            } catch (e) { reject(e); } finally { video.remove(); }
        };
        video.onerror = () => { reject(new Error("Video load failed for frame extraction")); video.remove(); };
    });
};

export const detectTextInImage = async (imageBase64: string): Promise<boolean> => {
    const ai = getClient();
    const prompt = `
    Analyze this image carefully.
    Does it contain any of the following visual elements?
    1. Text labels (e.g., "Front View", "Side", names, "Fig 1").
    2. Info boxes, stats blocks, or character descriptions overlaying the image.
    3. Watermarks, signatures, or large logos.
    4. Chinese characters or any handwritten notes.
    
    Answer strictly "YES" if any of these are visibly present. 
    Answer "NO" if the image contains ONLY the character illustration with no overlay text.
    `;
    
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            }
        });
        
        const text = response.text?.trim().toUpperCase() || "";
        return text.includes("YES");
    } catch (e) {
        console.warn("Text detection failed", e);
        return false; // Assume safe if check fails
    }
};

// --- New Character Prompts ---

const CHARACTER_EXTRACTION_INSTRUCTION = `
你是一位专业的选角导演。
你的任务是从剧本或大纲中提取所有出现的角色名称。
请只输出一个 JSON 字符串数组，不要包含其他内容。
例如: ["张三", "李四", "王五"]
`;

const CHARACTER_PROFILE_INSTRUCTION = `
你是一位资深的角色设计师和小说家。
你的任务是根据提供的角色名称和剧本上下文，生成极度详细的角色档案。

**输出格式要求 (JSON):**
请直接输出一个 JSON 对象，包含以下字段：
{
  "name": "角色名",
  "alias": "称谓 (同事、家人等)",
  "basicStats": "基础属性 (年龄、性别、身高、身材、发型、特征、着装)",
  "profession": "职业 (含隐藏身份)",
  "background": "生活环境、生理特征、地域标签",
  "personality": "性格 (主性格+次性格)",
  "motivation": "核心动机",
  "values": "价值观",
  "weakness": "恐惧与弱点",
  "relationships": "核心关系及影响",
  "habits": "语言风格、行为习惯、兴趣爱好",
  "appearancePrompt": "用于AI生图的详细英文提示词 (Format: [Visual Style Keywords], [Character Description], [Clothing], [Face], [Lighting]. Ensure it strictly matches the Visual Style Context provided.)"
}

**内容要求：**
1. 内容必须丰富、具体，具有画面感。
2. 必须严格遵守传入的【Visual Style Context】视觉风格设定。
3. "appearancePrompt" 字段必须包含具体的视觉风格关键词（如"Anime", "Photorealistic"等），并且描述清晰，可以直接用于文生图模型。
4. 如果上下文没有提供足够信息，请根据角色定位进行合理的**AI自动补全**，使其丰满。
`;

const SUPPORTING_CHARACTER_INSTRUCTION = `
你是一位资深的角色设计师。
你的任务是为配角生成简化的角色档案。配角是故事中的次要角色，只需要基础信息即可。

**输出格式要求 (JSON):**
请直接输出一个 JSON 对象，包含以下字段：
{
  "name": "角色名",
  "basicStats": "基础属性 (年龄、性别、身高、身材、发型、特征、着装)",
  "profession": "职业",
  "introduction": "简短介绍 (1-2句话描述角色定位和在剧中的作用)",
  "appearancePrompt": "用于AI生图的详细英文提示词 (Format: [Visual Style Keywords], [Character Description], [Clothing], [Face], [Lighting]. Ensure it strictly matches the Visual Style Context provided.)"
}

**内容要求：**
1. 保持简洁，突出角色的核心定位。
2. 必须严格遵守传入的【Visual Style Context】视觉风格设定。
3. "appearancePrompt" 字段必须包含具体的视觉风格关键词，描述清晰。
4. 配角不需要详细的性格、动机、关系等信息。
`;

const DRAMA_ANALYZER_INSTRUCTION = `
你是一位资深的影视剧分析专家和编剧顾问。
你的任务是对用户提供的剧名进行深度分析，从多个维度评估其创作价值和IP潜力。

**输出格式要求 (JSON):**
请直接输出一个 JSON 对象，包含以下字段：
{
  "dramaName": "剧名",
  "dramaIntroduction": "剧集介绍（简要概述剧情、主要角色、故事背景，100-200字）",
  "worldview": "世界观分析（是否有「反常识/强记忆点」的设定？参考：《进击的巨人》「巨人吃人的世界」、《咒术回战》「诅咒=负面情绪具象化」，200字左右）",
  "logicalConsistency": "逻辑自洽性分析（设定是否贯穿全剧？是否有明显BUG？参考：《火影忍者》后期「查克拉滥用」导致设定崩塌，150字左右）",
  "extensibility": "延展性分析（设定是否支持多场景/衍生内容？参考：《宝可梦》的「精灵收集」设定，可衍生游戏、卡牌、线下活动，150字左右）",
  "characterTags": "角色标签分析（角色是否有「可复制的标签组合」？参考：「高冷学霸+反差萌」「废柴逆袭+热血」，方便AI生成人设时复用标签，200字左右）",
  "protagonistArc": "主角弧光分析（主角/配角是否有清晰的成长线？参考：《海贼王》路飞从「单细胞船长」到「能承担责任的领袖」，200字左右）",
  "audienceResonance": "受众共鸣点分析（人设是否击中目标群体的「情感需求」？参考：《夏目友人帐》夏目「孤独但温柔」，击中社畜/孤独青年的共鸣，150字左右）",
  "artStyle": "画风/视觉风格分析（画风是否「差异化+适配题材」？参考：《JOJO的奇妙冒险》「荒木线」的独特画风，成为IP标识；《间谍过家家》清新画风适配家庭喜剧，200字左右）"
}

**内容要求：**
1. 如果你对该剧有所了解，请基于你的知识进行分析。
2. 如果你不了解该剧，请明确说明「无法检索到该剧的详细信息」，并建议用户提供更多上下文或尝试其他剧名。
3. 分析必须具体、深入，避免空泛的套话。
4. 每个维度的分析应该包含具体案例和可操作的建议。
5. 输出必须是纯 JSON 格式，不要包含 markdown 标记（如 \`\`\`json）。
`;

// ... (Other Instructions UNCHANGED) ...
const SYSTEM_INSTRUCTION = `
You are SunStudio AI, an expert multimedia creative assistant.
Your goal is to assist users in generating images, videos, audio, and scripts.
Always be concise, professional, and helpful.
When the user asks for creative ideas, provide vivid, detailed descriptions suitable for generative AI prompts.
`;

const STORYBOARD_INSTRUCTION = `
You are a professional film director and cinematographer.
Your task is to break down a user's prompt into a sequence of detailed shots (storyboard).
Output strictly valid JSON array of strings. No markdown.
Each string should be a highly detailed image generation prompt for one shot.
Example: ["Wide shot of a cyberpunk city...", "Close up of a neon sign..."]
`;

const HELP_ME_WRITE_INSTRUCTION = `
You are a professional writing assistant.
Your task is to help the user write, edit, or improve their text.
Maintain a professional and helpful tone.
If the user provides a draft, suggest improvements for clarity, coherence, and impact.
If the user provides a topic, generate a well-structured draft.
`;

const VIDEO_ORCHESTRATOR_INSTRUCTION = `
You are a video prompt engineering expert.
Your task is to create a seamless video generation prompt that bridges a sequence of images.
Analyze the provided images and the user's intent to create a prompt that describes the motion and transition.
`;

const SCRIPT_PLANNER_INSTRUCTION = `
你是一位专精于短剧和微电影的专业编剧 (Professional Screenwriter)。
你的任务是根据用户的核心创意和约束条件，创建一个引人入胜的**中文剧本大纲**。

**如果提供了【参考信息 - 来自剧目精炼】：**
- 这些信息仅作为创作参考，用于启发灵感和确定方向
- 不要照搬，而是将其作为创作风格、主题方向的参考
- 可以借鉴其中的情感基调、受众定位、角色特征等元素
- 最终作品应该是原创的，融合用户的核心创意和你的专业创作

**输出格式要求 (必须严格遵守 Markdown 格式):**

# 剧名 (Title)
**一句话梗概 (Logline)**: [一句话总结故事核心]
**类型 (Genre)**: [类型] | **主题 (Theme)**: [主题] | **背景 (Setting)**: [故事背景] | **视觉风格**: [Visual Style]

## 主要人物小传 (Character Briefs)
* **[姓名]**: [角色定位/原型] - [简短性格和外貌描述]

## 剧集结构规划 (共 [Total Episodes] 集)
请将大纲划分为几个主要章节 (Chapters)，以便后续分集开发。
* **## 第一章：[章节标题]** - [本章核心情节摘要，包含起承转合]
* **## 第二章：[章节标题]** - [本章核心情节摘要]
...
* **## 最终章：[章节标题]** - [大结局情节摘要]

**注意：**
1. **必须使用中文输出。**
2. 保持节奏紧凑，适合短视频平台（如抖音/TikTok）。
3. 确保每个章节都有明确的冲突和钩子 (Hook)。
4. 单集时长参考: [Duration] 分钟。
5. **在创作中请始终贯彻[Visual Style]的视觉美学。**
6. 如有参考信息，灵活运用但不要生搬硬套，保持原创性。
`;

const SCRIPT_EPISODE_INSTRUCTION = `
你是一位专业的短剧分集编剧。
你的任务是根据提供的【剧本大纲】和【指定章节】，将该章节拆分为 N 个具体的剧集脚本。

**输入上下文：**
1. 剧本大纲 (Context)
2. 目标章节 (Selected Chapter)
3. 拆分集数 (Split Count): [N]
4. 单集时长参考 (Duration Constraint)
5. 视觉风格 (Visual Style): [STYLE]
6. 修改建议 (Modification Suggestions): [如果提供] - 用户针对之前生成版本的修改意见

**输出要求：**
请直接输出一个 **JSON 数组**，不要包含 markdown 代码块标记（如 \`\`\`json），只输出纯 JSON 字符串。
数组中每个对象代表一集，格式如下：
[
  {
    "title": "第X集：[分集标题]",
    "content": "[详细剧本内容，包含场景描写、动作指令和对白。内容长度应符合时长限制。]",
    "characters": "[本集涉及的角色列表]",
    "visualStyleNote": "[针对本集的视觉风格备注]"
  },
  ...
]

**内容要求：**
1. **全中文写作**。
2. 剧本内容 (content) 必须包含画面感强的场景描述 (Scene Action) 和精彩对白 (Dialogue)。
3. 确保 N 个剧集能够完整覆盖所选章节的情节，并且每集结尾都要有悬念 (Cliffhanger)。
4. 场景描述应体现 [STYLE] 的视觉特点。
5. **如果提供了修改建议，请根据建议调整剧本内容，优化情节、对白或场景描述。**
`;

const CINEMATIC_STORYBOARD_INSTRUCTION = `
你是一位世界级的电影导演和摄影指导 (Director of Photography)。
你的任务是根据提供的【剧集脚本】，将其拆解为一系列专业的**电影分镜头 (Cinematic Shots)**。

**输入约束：**
1. 剧集内容 (Episode Content): 提供的文本。
2. 拆解数量 (Shot Count): [N] 个镜头。
3. 镜头时长 (Shot Duration): [T] 秒。
4. 视觉风格 (Visual Style): [STYLE]

**输出格式要求：**
必须直接输出一个 **JSON 数组**，不要包含任何 Markdown 标记。
数组中每个对象必须严格包含以下字段（全部为 String 类型）：

[
  {
    "subject": "主体：[详细描述人物外貌、动作、情绪]",
    "scene": "场景：[时间、地点、光影、氛围]",
    "camera": "镜头语言：[景别、角度、运镜方式、焦点]",
    "lighting": "光影：[光源性质、光比、色调]",
    "dynamics": "动态与特效：[环境动态、物理特效]",
    "audio": "声音：[人声、音效、BGM]",
    "style": "风格与质感：[画面风格、分辨率、胶片感]",
    "negative": "负面约束：[禁止出现的内容]"
  },
  ...
]

**内容创作要求：**
1. **视觉语言专业化**：使用专业的电影术语（如：侧逆光、浅景深、推镜头、荷兰角等）。
2. **画面感极强**：描述必须极其具体，能够直接指导 AI 生成高质量画面。
3. **连贯性**：镜头之间要有逻辑衔接，服务于叙事。
4. **情感传递**：通过光影和构图强化角色的情绪。
5. **风格一致性**：确保所有镜头的描述符合指定的 [STYLE]。
`;

const DETAILED_STORYBOARD_INSTRUCTION = `
你是一位专业的影视分镜师和摄影指导 (Storyboard Artist & DoP)。
你的任务是将提供的【剧集脚本内容】细化拆分为详细的**影视级分镜脚本**。

**输入约束：**
1. 剧集标题 (Episode Title): 提供的标题
2. 剧集内容 (Episode Content): 提供的剧本文本
3. 目标总时长 (Total Duration): [N] 秒
4. 视觉风格 (Visual Style): [STYLE]

**输出格式要求：**
必须直接输出一个 **JSON 数组**，不要包含任何 Markdown 标记（如 \`\`\`json）。
数组中每个对象代表一个分镜，格式如下：

[
  {
    "shotNumber": 1,
    "duration": 3,
    "scene": "教室 - 白天 - 靠窗最后一排",
    "characters": ["林霄"],
    "shotType": "特写 (Close-up)",
    "cameraAngle": "侧面45度仰角",
    "cameraMovement": "固定镜头 (Static Shot)",
    "visualDescription": "阳光从窗外洒在林霄的侧脸上，他目光空洞地望向窗外，教室里其他同学的声音模糊成背景音",
    "dialogue": "无",
    "visualEffects": "浅景深，背景虚化；暖色调光线；ANIME风格，强调眼神细节",
    "audioEffects": "环境音 - 教室嘈杂声（低音量）"
  },
  ...
]

**拆分要求（必须严格遵守）：**
1. **每个分镜时长**：严格控制在 3-5 秒之间，不得超出此范围
2. **分镜数量计算**：根据总时长和单镜时长计算
   - 公式：分镜数量 = 总时长 / 平均镜头时长(3.5-4秒)
   - 例如：60秒 → 15-20个分镜
   - 例如：120秒 → 30-40个分镜
3. **时间精确**：所有分镜的时长总和必须等于目标总时长（误差不超过±1秒）

**内容要求：**
1. **专业术语**：使用专业的影视术语
   - 镜头类型：特写(CU)、中景(MS)、全景(WS)、主观镜头(POV)、过肩(OTS)等
   - 拍摄角度：平视、仰角、俯角、第一人称、侧面、顶视、荷兰角等
   - 运镜方式：固定镜头、推镜、拉镜、摇镜、跟拍、环绕、快速甩镜、手持等

2. **画面描述详细**：
   - 必须包含具体的人物动作、表情、环境细节
   - 描述要有画面感，能够直接指导生成

3. **场景信息完整**：
   - 格式："地点 - 时间 - 具体位置"
   - 例如："教室 - 白天 - 靠窗最后一排"

4. **视觉效果专业**：
   - 包含景深、色调、特效、风格等信息
   - 必须符合指定的 [STYLE] 视觉风格

5. **连贯性**：
   - 分镜之间要有逻辑衔接
   - 服务于整体叙事节奏

6. **对白处理**：
   - 如果有对白，标注角色名和对白内容
   - 区分正常对白、内心独白(Voice Over)、旁白等
   - 如果无对白，写"无"

**重要提示：**
- 输出必须是纯 JSON 数组，不要包含任何其他文字
- 每个分镜对象的所有字段都必须填写
- duration 字段必须是数字类型
- characters 字段必须是字符串数组
`;

// --- API Functions ---

export const sendChatMessage = async (
    history: { role: 'user' | 'model', parts: { text: string }[] }[],
    newMessage: string,
    options?: { isThinkingMode?: boolean, isStoryboard?: boolean, isHelpMeWrite?: boolean },
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'sendChatMessage',
        async () => {
            const ai = getClient();

            let modelName = 'gemini-2.5-flash';
            let systemInstruction = SYSTEM_INSTRUCTION;

            if (options?.isThinkingMode) {
                modelName = 'gemini-2.5-flash';
            }

            if (options?.isStoryboard) {
                systemInstruction = STORYBOARD_INSTRUCTION;
            } else if (options?.isHelpMeWrite) {
                systemInstruction = HELP_ME_WRITE_INSTRUCTION;
            }

            const chat = ai.chats.create({
                model: modelName,
                config: { systemInstruction },
                history: history
            });

            const result = await chat.sendMessage({ message: newMessage });
            return result.text || "No response";
        },
        {
            model: options?.isThinkingMode ? 'gemini-2.5-flash' : 'gemini-2.5-flash',
            message: newMessage.substring(0, 200) + (newMessage.length > 200 ? '...' : ''),
            options,
            historyLength: history.length
        },
        context
    );
};

// ... (generateImageFromText, generateVideo, analyzeVideo, editImageWithText, planStoryboard, generateScriptPlanner, generateScriptEpisodes, generateCinematicStoryboard UNCHANGED) ...
export const generateImageFromText = async (
    prompt: string,
    model: string,
    inputImages: string[] = [],
    options: { aspectRatio?: string, resolution?: string, count?: number } = {},
    context?: { nodeId?: string; nodeType?: string }
): Promise<string[]> => {
    return logAPICall(
        'generateImageFromText',
        async () => {
            const ai = getClient();

            // Use the actual model ID provided - no fallback needed
            const effectiveModel = model;

            // Prepare Contents
            const parts: Part[] = [];

            // Add Input Images if available (Image-to-Image)
            for (const base64 of inputImages) {
                const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
                const mimeType = base64.match(/^data:(image\/\w+);base64,/)?.[1] || "image/png";
                parts.push({ inlineData: { data: cleanBase64, mimeType } });
            }

            // Prepend aspect ratio requirement to prompt if specified
            let enhancedPrompt = prompt;
            if (options.aspectRatio) {
                const ratioMap: Record<string, string> = {
                    '16:9': 'landscape orientation (16:9 aspect ratio, width greater than height)',
                    '9:16': 'portrait orientation (9:16 aspect ratio, height greater than width)',
                    '4:3': 'landscape orientation (4:3 aspect ratio)',
                    '3:4': 'portrait orientation (3:4 aspect ratio)',
                    '1:1': 'square orientation (1:1 aspect ratio, equal width and height)',
                    '21:9': 'ultrawide cinematic orientation (21:9 aspect ratio)',
                };
                const ratioDesc = ratioMap[options.aspectRatio] || options.aspectRatio;
                enhancedPrompt = `IMPORTANT: Generate the image in ${ratioDesc}.\n\n${prompt}`;
            }

            parts.push({ text: enhancedPrompt });

            try {
                // Build generation config with aspect ratio support
                const generationConfig: any = {};

                // Add image generation config if aspect ratio is specified
                if (options.aspectRatio) {
                    generationConfig.imageGenerationConfig = {
                        aspectRatio: options.aspectRatio
                    };
                }

                const response = await ai.models.generateContent({
                    model: effectiveModel,
                    contents: { parts },
                    generationConfig
                });

                // Parse Response for Images
                const images: string[] = [];
                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData && part.inlineData.data) {
                            const mime = part.inlineData.mimeType || 'image/png';
                            images.push(`data:${mime};base64,${part.inlineData.data}`);
                        }
                    }
                }

                if (images.length === 0) {
                    throw new Error("No images generated. Safety filter might have been triggered.");
                }

                return images;
            } catch (e: any) {
                console.error("Image Gen Error:", e);
                throw new Error(getErrorMessage(e));
            }
        },
        {
            model,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            options,
            inputs: inputImages.map(() => '[Image Data]')
        },
        context
    );
};

export const generateVideo = async (
    prompt: string,
    model: string,
    options: { aspectRatio?: string, count?: number, generationMode?: VideoGenerationMode, resolution?: string } = {},
    inputImageBase64?: string | null,
    videoInput?: any,
    referenceImages?: string[],
    context?: { nodeId?: string; nodeType?: string }
): Promise<{ uri: string, isFallbackImage?: boolean, videoMetadata?: any, uris?: string[] }> => {
    return logAPICall(
        'generateVideo',
        async () => {
            const ai = getClient();

            const qualitySuffix = ", cinematic lighting, highly detailed, photorealistic, 4k, smooth motion, professional color grading";
            const enhancedPrompt = prompt + qualitySuffix;

            let resolution = options.resolution || (model.includes('pro') ? '1080p' : '720p');

            // Prepare Inputs
            let inputs: any = { prompt: enhancedPrompt };

            let finalInputImageBase64: string | null = null;
            if (inputImageBase64) {
                try {
                    const compat = await convertImageToCompatibleFormat(inputImageBase64);
                    inputs.image = { imageBytes: compat.data, mimeType: compat.mimeType };
                    finalInputImageBase64 = compat.fullDataUri;
                } catch (e) {
                    console.warn("Veo Input Image Conversion Failed:", e);
                }
            }

            if (videoInput) {
                inputs.video = videoInput;
            }

            const config: any = {
                numberOfVideos: 1,
                aspectRatio: options.aspectRatio || '16:9',
                resolution: resolution as any
            };

            if (referenceImages && referenceImages.length > 0 && model === 'veo-3.1-generate-preview') {
                const refsPayload = [];
                for (const ref of referenceImages) {
                    const c = await convertImageToCompatibleFormat(ref);
                    refsPayload.push({ image: { imageBytes: c.data, mimeType: c.mimeType }, referenceType: 'ASSET' });
                }
                config.referenceImages = refsPayload;
            }

            const count = options.count || 1;

            try {
                const operations = [];
                for (let i = 0; i < count; i++) {
                    operations.push(retryWithBackoff(async () => {
                        let op = await ai.models.generateVideos({
                            model: model,
                            ...inputs,
                            config: config
                        });

                        while (!op.done) {
                            await wait(5000);
                            op = await ai.operations.getVideosOperation({ operation: op });
                        }
                        return op;
                    }));
                }

                const results = await Promise.allSettled(operations);

                const validUris: string[] = [];
                let primaryMetadata = null;

                for (const res of results) {
                    if (res.status === 'fulfilled') {
                        const vid = res.value.response?.generatedVideos?.[0]?.video;
                        if (vid?.uri) {
                            const fullUri = `${vid.uri}&key=${process.env.API_KEY}`;
                            validUris.push(fullUri);
                            if (!primaryMetadata) primaryMetadata = vid;
                        }
                    }
                }

                if (validUris.length === 0) {
                    const firstError = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
                    throw firstError?.reason || new Error("Video generation failed (No valid URIs).");
                }

                return {
                    uri: validUris[0],
                    uris: validUris,
                    videoMetadata: primaryMetadata,
                    isFallbackImage: false
                };

            } catch (e: any) {
                console.warn("Veo Generation Failed. Falling back to Image.", e);
                try {
                    const fallbackPrompt = "Cinematic movie still, " + enhancedPrompt;
                    const inputImages = finalInputImageBase64 ? [finalInputImageBase64] : [];
                    const imgs = await generateImageFromText(fallbackPrompt, 'gemini-2.5-flash-image', inputImages, { aspectRatio: options.aspectRatio }, context);
                    return { uri: imgs[0], isFallbackImage: true };
                } catch (imgErr) {
                    throw new Error("Video generation failed and Image fallback also failed: " + getErrorMessage(e));
                }
            }
        },
        {
            model,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            options,
            inputs: {
                hasImage: !!inputImageBase64,
                hasVideo: !!videoInput,
                referenceImagesCount: referenceImages?.length || 0
            }
        },
        context
    );
};

export const analyzeVideo = async (
    videoBase64OrUrl: string,
    prompt: string,
    model: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'analyzeVideo',
        async () => {
            const ai = getClient();
            let inlineData: any = null;

            if (videoBase64OrUrl.startsWith('data:')) {
                const mime = videoBase64OrUrl.match(/^data:(video\/\w+);base64,/)?.[1] || 'video/mp4';
                const data = videoBase64OrUrl.replace(/^data:video\/\w+;base64,/, "");
                inlineData = { mimeType: mime, data };
            } else {
                throw new Error("Direct URL analysis not implemented in this demo. Please use uploaded videos.");
            }

            const response = await ai.models.generateContent({
                model: model,
                contents: {
                    parts: [
                        { inlineData },
                        { text: prompt }
                    ]
                }
            });

            return response.text || "Analysis failed";
        },
        {
            model,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            hasVideo: videoBase64OrUrl.startsWith('data:')
        },
        context
    );
};

export const editImageWithText = async (imageBase64: string, prompt: string, model: string): Promise<string> => {
     const imgs = await generateImageFromText(prompt, model, [imageBase64], { count: 1 });
     return imgs[0];
};

export const planStoryboard = async (
    prompt: string,
    context: string,
    apiContext?: { nodeId?: string; nodeType?: string }
): Promise<string[]> => {
    return logAPICall(
        'planStoryboard',
        async () => {
            const ai = getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    responseMimeType: 'application/json',
                    systemInstruction: STORYBOARD_INSTRUCTION
                },
                contents: { parts: [{ text: `Context: ${context}\n\nUser Idea: ${prompt}` }] }
            });

            try {
                return JSON.parse(response.text || "[]");
            } catch {
                return [];
            }
        },
        {
            model: 'gemini-2.5-flash',
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            contextLength: context.length
        },
        apiContext
    );
};

export const generateScriptPlanner = async (
    prompt: string,
    config: { theme?: string, genre?: string, setting?: string, episodes?: number, duration?: number, visualStyle?: string },
    refinedInfo?: Record<string, string[]>,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'generateScriptPlanner',
        async () => {
            const ai = getClient();

            // 构建精炼信息参考文本
            let refinedReference = '';
            if (refinedInfo && Object.keys(refinedInfo).length > 0) {
                refinedReference = '\n\n【参考信息 - 来自剧目精炼】\n';
                refinedReference += '以下信息仅作为创作参考，不要完全照搬，而是融入你的创意中：\n\n';

                const fieldLabels: Record<string, string> = {
                    dramaIntroduction: '剧集介绍参考',
                    worldview: '世界观参考',
                    logicalConsistency: '逻辑自洽性参考',
                    extensibility: '延展性参考',
                    characterTags: '角色特征参考',
                    protagonistArc: '主角弧光参考',
                    audienceResonance: '受众共鸣参考',
                    artStyle: '画风参考'
                };

                for (const [key, values] of Object.entries(refinedInfo)) {
                    if (values && values.length > 0) {
                        const label = fieldLabels[key] || key;
                        refinedReference += `${label}:\n`;
                        values.forEach(v => {
                            refinedReference += `  - ${v}\n`;
                        });
                        refinedReference += '\n';
                    }
                }
            }

            const fullPrompt = `
    核心创意: ${prompt}
    主题: ${config.theme || 'N/A'}
    类型: ${config.genre || 'N/A'}
    背景: ${config.setting || 'N/A'}
    预估集数: ${config.episodes || 10}
    单集时长: ${config.duration || 1} 分钟
    视觉风格: ${config.visualStyle || 'N/A'}${refinedReference}
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: SCRIPT_PLANNER_INSTRUCTION },
                contents: { parts: [{ text: fullPrompt }] }
            });

            return response.text || "";
        },
        {
            model: 'gemini-2.5-flash',
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            config,
            hasRefinedInfo: !!refinedInfo && Object.keys(refinedInfo).length > 0
        },
        context
    );
};

export const generateScriptEpisodes = async (
    outline: string,
    chapter: string,
    splitCount: number,
    duration: number,
    style?: string,
    modificationSuggestion?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<{ title: string, content: string, characters: string }[]> => {
    return logAPICall(
        'generateScriptEpisodes',
        async () => {
            const ai = getClient();
            const prompt = `
    Input Outline: ${outline}
    Target Chapter: ${chapter}
    Split into ${splitCount} episodes.
    Target Duration per episode: ${duration} minutes.
    Visual Style: ${style || 'N/A'}
    ${modificationSuggestion ? `\n修改建议 (User Modification Suggestions): ${modificationSuggestion}` : ''}
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: SCRIPT_EPISODE_INSTRUCTION,
                    responseMimeType: 'application/json'
                },
                contents: { parts: [{ text: prompt }] }
            });

            try {
                const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
                return JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse script episodes JSON", e);
                throw new Error("生成剧本格式错误，请重试");
            }
        },
        {
            model: 'gemini-2.5-flash',
            chapter,
            splitCount,
            duration,
            style,
            hasModification: !!modificationSuggestion
        },
        context
    );
};

export const generateDetailedStoryboard = async (
    episodeTitle: string,
    episodeContent: string,
    totalDuration: number, // in seconds
    visualStyle: string,
    onShotGenerated?: (shot: import('../types').DetailedStoryboardShot) => void,
    context?: { nodeId?: string; nodeType?: string }
): Promise<import('../types').DetailedStoryboardShot[]> => {
    return logAPICall(
        'generateDetailedStoryboard',
        async () => {
            console.log('[generateDetailedStoryboard] Starting generation with:', { episodeTitle, totalDuration, visualStyle });

            const ai = getClient();
            const prompt = `
    Episode Title: ${episodeTitle}
    Episode Content: ${episodeContent}
    Total Duration: ${totalDuration} seconds
    Visual Style: ${visualStyle}
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: DETAILED_STORYBOARD_INSTRUCTION,
                    responseMimeType: 'application/json'
                },
                contents: { parts: [{ text: prompt }] }
            });

            try {
                const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
                console.log('[generateDetailedStoryboard] Received response, parsing...');

                const rawShots = JSON.parse(text);
                console.log('[generateDetailedStoryboard] Parsed shots count:', rawShots.length);

                let currentTime = 0;
                const shots: import('../types').DetailedStoryboardShot[] = rawShots.map((rawShot: any, index: number) => {
                    const startTime = currentTime;
                    const duration = rawShot.duration || 4;
                    const endTime = currentTime + duration;
                    currentTime = endTime;

                    return {
                        id: `shot-${Date.now()}-${index}`,
                        shotNumber: rawShot.shotNumber || (index + 1),
                        duration,
                        scene: rawShot.scene || '',
                        characters: Array.isArray(rawShot.characters) ? rawShot.characters : [],
                        shotType: rawShot.shotType || '',
                        cameraAngle: rawShot.cameraAngle || '',
                        cameraMovement: rawShot.cameraMovement || '',
                        visualDescription: rawShot.visualDescription || '',
                        dialogue: rawShot.dialogue || '无',
                        visualEffects: rawShot.visualEffects || '',
                        audioEffects: rawShot.audioEffects || '',
                        startTime,
                        endTime
                    };
                });

                console.log('[generateDetailedStoryboard] Successfully generated', shots.length, 'shots');
                return shots;
            } catch (e) {
                console.error("[generateDetailedStoryboard] Error:", e);
                throw new Error("分镜生成格式错误，请重试");
            }
        },
        {
            model: 'gemini-2.5-flash',
            episodeTitle,
            totalDuration,
            visualStyle,
            contentLength: episodeContent.length
        },
        context
    );
};

// Helper function to extract completed shot objects from streaming JSON
function extractCompletedShots(text: string): { completed: any[], remaining: string } {
    const completed: any[] = [];
    let remaining = text;

    // Remove markdown code blocks if present
    remaining = remaining.replace(/```json/g, '').replace(/```/g, '').trim();

    // Find array start
    const arrayStartIndex = remaining.indexOf('[');
    if (arrayStartIndex === -1) {
        return { completed: [], remaining: text };
    }

    remaining = remaining.substring(arrayStartIndex + 1);

    // Try to extract complete objects
    let depth = 0;
    let currentObject = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < remaining.length; i++) {
        const char = remaining[i];

        if (escapeNext) {
            currentObject += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            currentObject += char;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            currentObject += char;
            continue;
        }

        if (!inString) {
            if (char === '{') {
                depth++;
                currentObject += char;
            } else if (char === '}') {
                depth--;
                currentObject += char;

                // Complete object found
                if (depth === 0 && currentObject.trim()) {
                    try {
                        const parsed = JSON.parse(currentObject);
                        completed.push(parsed);
                        currentObject = '';
                    } catch (e) {
                        // Not yet complete, continue
                    }
                }
            } else if (char === ',' && depth === 0) {
                // Skip commas between objects
                currentObject = '';
            } else {
                currentObject += char;
            }
        } else {
            currentObject += char;
        }
    }

    return { completed, remaining: currentObject };
}

// Helper function to extract final shots from remaining text
function extractFinalShots(text: string): any[] {
    try {
        // Clean up the text
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // If it's not wrapped in array brackets, try to wrap it
        if (!cleaned.startsWith('[')) {
            cleaned = '[' + cleaned;
        }
        if (!cleaned.endsWith(']')) {
            cleaned = cleaned + ']';
        }

        // Try to parse as array
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error('Failed to parse final shots:', e);
        return [];
    }
}

export const generateCinematicStoryboard = async (
    episodeScript: string,
    shotCount: number,
    shotDuration: number,
    style: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<StoryboardShot[]> => {
    return logAPICall(
        'generateCinematicStoryboard',
        async () => {
            const ai = getClient();
            const prompt = `
    Episode Script: ${episodeScript}
    Shot Count: ${shotCount}
    Shot Duration: ${shotDuration}s
    Visual Style: ${style}
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                config: {
                    systemInstruction: CINEMATIC_STORYBOARD_INSTRUCTION,
                    responseMimeType: 'application/json'
                },
                contents: { parts: [{ text: prompt }] }
            });

            try {
                const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
                const rawShots = JSON.parse(text);

                return rawShots.map((shot: any, index: number) => ({
                    id: `shot-${Date.now()}-${index}`,
                    subject: shot.subject || "N/A",
                    scene: shot.scene || "N/A",
                    camera: shot.camera || "N/A",
                    lighting: shot.lighting || "N/A",
                    dynamics: shot.dynamics || "N/A",
                    audio: shot.audio || "N/A",
                    style: shot.style || "N/A",
                    negative: shot.negative || "",
                    duration: shotDuration
                }));
            } catch (e) {
                console.error("Failed to parse storyboard JSON", e);
                throw new Error("分镜生成失败，请重试");
            }
        },
        {
            model: 'gemini-3-pro-preview',
            shotCount,
            shotDuration,
            style,
            scriptLength: episodeScript.length
        },
        context
    );
};

export const orchestrateVideoPrompt = async (
    images: string[],
    userPrompt: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'orchestrateVideoPrompt',
        async () => {
            const ai = getClient();
            const parts: Part[] = images.map(img => ({ inlineData: { data: img.replace(/^data:.*;base64,/, ""), mimeType: "image/png" } }));
            parts.push({ text: `Create a single video prompt that transitions between these images. User Intent: ${userPrompt}` });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: VIDEO_ORCHESTRATOR_INSTRUCTION },
                contents: { parts }
            });

            return response.text || userPrompt;
        },
        {
            model: 'gemini-2.5-flash',
            prompt: userPrompt.substring(0, 200) + (userPrompt.length > 200 ? '...' : ''),
            imageCount: images.length
        },
        context
    );
};

export const compileMultiFramePrompt = (frames: any[]) => {
    return "A sequence showing: " + frames.map(f => f.transition?.prompt || "scene").join(" transitioning to ");
};

export const generateAudio = async (
    prompt: string,
    referenceAudio?: string,
    options?: { persona?: any, emotion?: any },
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'generateAudio',
        async () => {
            const ai = getClient();

            const parts: Part[] = [{ text: prompt }];
            if (referenceAudio) {
                const mime = referenceAudio.match(/^data:(audio\/\w+);base64,/)?.[1] || 'audio/wav';
                const data = referenceAudio.replace(/^data:audio\/\w+;base64,/, "");
                parts.push({ inlineData: { mimeType: mime, data } });
            }

            const voiceName = options?.persona?.label === 'Deep Narrative' ? 'Kore' : 'Puck';

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: { parts },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName }
                        }
                    }
                }
            });

            const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!audioData) throw new Error("Audio generation failed");

            return pcmToWav(audioData);
        },
        {
            model: 'gemini-2.5-flash-preview-tts',
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            hasReferenceAudio: !!referenceAudio,
            voiceName: options?.persona?.label === 'Deep Narrative' ? 'Kore' : 'Puck'
        },
        context
    );
};

export const transcribeAudio = async (
    audioBase64: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'transcribeAudio',
        async () => {
            const ai = getClient();
            const mime = audioBase64.match(/^data:(audio\/\w+);base64,/)?.[1] || 'audio/wav';
            const data = audioBase64.replace(/^data:audio\/\w+;base64,/, "");

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: mime, data } },
                        { text: "Transcribe this audio strictly verbatim." }
                    ]
                }
            });

            return response.text || "";
        },
        {
            model: 'gemini-2.5-flash',
            hasAudio: true
        },
        context
    );
};

export const connectLiveSession = async (
    onAudioData: (base64: string) => void,
    onClose: () => void
) => {
    const ai = getClient();
    const model = 'gemini-2.5-flash-native-audio-preview-09-2025';
    const sessionPromise = ai.live.connect({
        model,
        callbacks: {
            onopen: () => console.log("Live Session Connected"),
            onmessage: (msg) => {
                if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                    onAudioData(msg.serverContent.modelTurn.parts[0].inlineData.data);
                }
            },
            onclose: onClose,
            onerror: (e) => { console.error(e); onClose(); }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
        }
    });
    return sessionPromise;
};

// --- Character Generation Services ---

export const extractCharactersFromText = async (
    text: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string[]> => {
    return logAPICall(
        'extractCharactersFromText',
        async () => {
            const ai = getClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    responseMimeType: 'application/json',
                    systemInstruction: CHARACTER_EXTRACTION_INSTRUCTION
                },
                contents: { parts: [{ text: `提取以下剧本内容中的所有角色名：\n${text}` }] }
            });
            try {
                const json = JSON.parse(response.text || "[]");
                return Array.isArray(json) ? json : [];
            } catch {
                return [];
            }
        },
        {
            model: 'gemini-2.5-flash',
            textLength: text.length
        },
        context
    );
};

export const generateCharacterProfile = async (
    name: string,
    contextText: string,
    styleContext?: string,
    customDesc?: string,
    apiContext?: { nodeId?: string; nodeType?: string }
): Promise<CharacterProfile> => {
    return logAPICall(
        'generateCharacterProfile',
        async () => {
            const ai = getClient();
            const prompt = `
    Role Name: ${name}
    Script Context: ${contextText}
    Visual Style Context (CRITICAL): ${styleContext || "Default"}
    ${customDesc ? `Additional User Description: ${customDesc}` : 'Auto-complete details based on context.'}
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                config: {
                    responseMimeType: 'application/json',
                    systemInstruction: CHARACTER_PROFILE_INSTRUCTION
                },
                contents: { parts: [{ text: prompt }] }
            });

            try {
                const raw = JSON.parse(response.text || "{}");
                // Ensure shape
                return {
                    id: `char-${Date.now()}-${Math.random()}`,
                    name: raw.name || name,
                    alias: raw.alias,
                    basicStats: raw.basicStats,
                    profession: raw.profession,
                    personality: raw.personality,
                    motivation: raw.motivation,
                    values: raw.values,
                    weakness: raw.weakness,
                    relationships: raw.relationships,
                    habits: raw.habits,
                    appearance: raw.appearancePrompt, // Use specific prompt for image gen
                    rawProfileData: raw
                };
            } catch (e) {
                throw new Error("Character profile generation failed format");
            }
        },
        {
            model: 'gemini-3-pro-preview',
            characterName: name,
            hasStyleContext: !!styleContext,
            hasCustomDesc: !!customDesc,
            contextLength: contextText.length
        },
        apiContext
    );
};

// Generate simplified profile for supporting characters
export const generateSupportingCharacter = async (
    name: string,
    contextText: string,
    styleContext?: string,
    apiContext?: { nodeId?: string; nodeType?: string }
): Promise<CharacterProfile> => {
    return logAPICall(
        'generateSupportingCharacter',
        async () => {
            const ai = getClient();
            const prompt = `
    Role Name: ${name}
    Script Context: ${contextText}
    Visual Style Context (CRITICAL): ${styleContext || "Default"}
    This is a SUPPORTING CHARACTER - keep it simple and concise.
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    responseMimeType: 'application/json',
                    systemInstruction: SUPPORTING_CHARACTER_INSTRUCTION
                },
                contents: { parts: [{ text: prompt }] }
            });

            try {
                const raw = JSON.parse(response.text || "{}");
                // Return simplified profile
                return {
                    id: `char-${Date.now()}-${Math.random()}`,
                    name: raw.name || name,
                    roleType: 'supporting',
                    basicStats: raw.basicStats,
                    profession: raw.profession,
                    personality: raw.introduction, // Use introduction as personality for supporting chars
                    appearance: raw.appearancePrompt,
                    rawProfileData: raw
                };
            } catch (e) {
                throw new Error("Supporting character generation failed format");
            }
        },
        {
            model: 'gemini-2.5-flash',
            characterName: name,
            roleType: 'supporting',
            hasStyleContext: !!styleContext,
            contextLength: contextText.length
        },
        apiContext
    );
};

// --- Drama Analyzer Service ---

export interface DramaAnalysisResult {
    dramaName: string;
    dramaIntroduction: string;
    worldview: string;
    logicalConsistency: string;
    extensibility: string;
    characterTags: string;
    protagonistArc: string;
    audienceResonance: string;
    artStyle: string;
}

export const analyzeDrama = async (
    dramaName: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<DramaAnalysisResult> => {
    return logAPICall(
        'analyzeDrama',
        async () => {
            const ai = getClient();
            const prompt = `
    请分析以下剧集：${dramaName}

    注意：
    1. 如果你对该剧有所了解，请提供详细的分析。
    2. 如果你不了解该剧，请在 dramaIntroduction 字段中明确说明，并在其他字段中提供通用的分析框架建议。
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    responseMimeType: 'application/json',
                    systemInstruction: DRAMA_ANALYZER_INSTRUCTION
                },
                contents: { parts: [{ text: prompt }] }
            });

            try {
                const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
                const raw = JSON.parse(text);

                return {
                    dramaName: raw.dramaName || dramaName,
                    dramaIntroduction: raw.dramaIntroduction || '暂无剧集信息',
                    worldview: raw.worldview || '',
                    logicalConsistency: raw.logicalConsistency || '',
                    extensibility: raw.extensibility || '',
                    characterTags: raw.characterTags || '',
                    protagonistArc: raw.protagonistArc || '',
                    audienceResonance: raw.audienceResonance || '',
                    artStyle: raw.artStyle || ''
                };
            } catch (e) {
                console.error("Drama analysis failed:", e);
                throw new Error("剧目分析失败，请重试");
            }
        },
        {
            model: 'gemini-2.5-flash',
            dramaName
        },
        context
    );
};

const DRAMA_REFINED_EXTRACTION_INSTRUCTION = `
你是一个专业的剧本分析专家。请从给定的剧目分析文本中提取关键信息，
转换为精炼且易懂的信息条目。

**重要：你必须严格按照输入的分析类别进行提取，不要自行添加或删除类别。**

**输出格式要求 (JSON):**
根据输入的分析内容，输出对应的 JSON 对象。例如：
- 如果输入包含"剧集介绍"，输出应包含 "dramaIntroduction" 字段
- 如果输入包含"世界观分析"，输出应包含 "worldview" 字段
- 以此类推

**核心原则 - 只提取通用特征，禁止具体名词：**
1. ❌ **禁止出现**：剧名、角色名、地名、作者名等任何专有名词
2. ✅ **必须使用**：描述性词汇、形容词、通用特征
3. **目的**：提取的是"类型、风格、特征"，而不是"具体内容"

**提取原则：**
1. **灵活长度**：每条信息可以是短标签（如"青少年"）或完整描述（如"主角从弱小逐步成长为强者的励志历程"）
2. **清晰完整**：确保提取的内容含义清晰，信息完整，读者能准确理解
3. **保留精华**：提取最有价值的关键信息，去除冗余和废话
4. **数量灵活**：根据内容实际情况决定数量，可多可少，无需凑数
5. **纯JSON格式**：必须输出纯 JSON 格式，不要包含 markdown 标记（如 \`\`\`json）
6. **严格对应**：只提取输入中明确存在的分析类别，不要添加额外的类别

**提取示例：**

❌ **错误示例（包含具体名词）：**
- "《斗破苍穹》讲述萧炎的成长故事"
- "主角萧炎在乌坦城开始修炼"
- "纳兰嫣然退婚引发矛盾"

✅ **正确示例（只用描述和形容词）：**
- "主角从天才跌落废柴，历经三年屈辱后逆袭成长"
- "以修炼等级体系为核心的玄幻世界观"
- "退婚情节引发的复仇与证明自我的动力"
- "热血奋斗、永不放弃的精神内核"

✅ **短标签形式：**
- "青少年受众"
- "逆袭成长"
- "热血励志"
- "玄幻修炼"

✅ **完整描述形式：**
- "故事以被同学排挤的少年为主角，引发青少年对归属感的强烈共鸣"
- "主角在逆境中不断成长，最终通过自己的努力获得认可"
- "世界观设定融合了现代都市与超自然元素，呈现出独特的奇幻氛围"

✅ **混合形式（根据内容特点灵活选择）：**
- "温暖治愈的情感基调"
- "永不放弃的精神贯穿始终，传递正能量"
- "日式动画风格"
- "主角从弱者逆袭的经典成长线"
`;



/**
 * 从剧目分析中提取精炼标签
 */
export const extractRefinedTags = async (
    analysisData: any,
    selectedFields: string[],
    context?: { nodeId?: string; nodeType?: string }
): Promise<Record<string, string[]>> => {
    return logAPICall(
        'extractRefinedTags',
        async () => {
            const ai = getClient();

            // 构建提取提示词
            const fieldLabels: Record<string, string> = {
                dramaIntroduction: '剧集介绍',
                worldview: '世界观分析',
                logicalConsistency: '逻辑自洽性',
                extensibility: '延展性分析',
                characterTags: '角色标签',
                protagonistArc: '主角弧光',
                audienceResonance: '受众共鸣点',
                artStyle: '画风分析'
            };

            const contentToExtract = selectedFields.map(field => {
                const label = fieldLabels[field] || field;
                const value = analysisData[field] || '';
                return `【${label}】\n${value}`;
            }).join('\n\n');

            // 构建期望的 JSON 结构说明
            const expectedFields = selectedFields.map(field => {
                const label = fieldLabels[field] || field;
                return `"${field}": ["${label}精炼信息1", "${label}精炼信息2", ...]`;
            }).join(',\n  ');

            const prompt = `请从以下剧目分析内容中提取关键信息。

**输入的分析内容：**
${contentToExtract}

**期望输出的JSON格式：**
{
  ${expectedFields}
}

请严格按照上述字段进行提取，只提取这些字段，不要添加其他字段。`;

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    config: {
                        responseMimeType: 'application/json',
                        systemInstruction: DRAMA_REFINED_EXTRACTION_INSTRUCTION
                    },
                    contents: { parts: [{ text: prompt }] }
                });

                const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
                const extracted = JSON.parse(text);

                // 动态构建返回对象，只包含用户选择的字段
                const result: Record<string, string[]> = {};
                for (const field of selectedFields) {
                    result[field] = extracted[field] || [];
                }

                return result;
            } catch (e) {
                console.error('提取精炼标签失败:', e);
                // 返回空结构，包含用户选择的字段
                const fallback: Record<string, string[]> = {};
                for (const field of selectedFields) {
                    fallback[field] = [];
                }
                return fallback;
            }
        },
        {
            model: 'gemini-2.5-flash',
            selectedFieldsCount: selectedFields.length,
            selectedFields
        },
        context
    );
};

// ============================================
// Style Preset Generation
// ============================================

const SCENE_STYLE_INSTRUCTION = `你是一位Prompt工程专家，专门生成可复用的**场景风格描述词模板**。

**核心任务**：
生成一段通用的风格描述词，用作后续场景图像/视频生成的**风格前缀**。
这段描述词不包含具体场景内容，只包含画风、渲染质量、色调、光影等抽象风格元素。

**输出要求**：
1. 纯风格描述，不包含具体物体、场景、构图
2. 可以直接作为prompt前缀使用
3. 长度：30-50个英文单词
4. 使用逗号分隔关键词

**必须包含的元素**：
1. **核心风格标签**：
   - REAL: photorealistic style, cinematic
   - ANIME: anime style, anime background art
   - 3D: 3d render, octane render

2. **渲染质量**：
   - REAL: 8k uhd, high resolution, professional photography
   - ANIME: high quality, masterpiece, detailed illustration
   - 3D: ray tracing, global illumination, 8k

3. **光影风格**（抽象描述）：
   - REAL: natural lighting, volumetric lighting, soft shadows
   - ANIME: soft lighting, rim light, vibrant colors
   - 3D: studio lighting, HDRI lighting, ambient occlusion

4. **色调风格**：
   - 暖色调：warm tone, golden palette
   - 冷色调：cool tone, blue palette
   - 中性：natural colors, balanced colors

5. **画面质感**：
   - REAL: sharp focus, depth of field, bokeh effect
   - ANIME: cel shading, flat colors, clean lines
   - 3D: PBR materials, realistic reflections

**禁止包含**：
❌ 具体场景：forest, street, room
❌ 具体物体：tree, building, furniture
❌ 构图角度：wide shot, close-up, from above
❌ 具体光源：sunset, candlelight, neon lights

**输出格式**：
纯文本，逗号分隔，无换行，无markdown格式`;

const CHARACTER_STYLE_INSTRUCTION = `你是一位Prompt工程专家，专门生成可复用的**人物风格描述词模板**。

**核心任务**：
生成一段通用的风格描述词，用作后续人物图像/视频生成的**风格前缀**。
这段描述词不包含具体人物特征，只包含画风、渲染质量、人物绘制风格等抽象元素。

**输出要求**：
1. 纯风格描述，不包含具体外貌、服装、姿态
2. 可以直接作为prompt前缀使用
3. 长度：30-50个英文单词
4. 使用逗号分隔关键词

**必须包含的元素**：
1. **核心风格标签**：
   - REAL: photorealistic portrait, realistic human
   - ANIME: anime character, anime style
   - 3D: 3d character, 3d human model

2. **渲染质量**：
   - REAL: 8k uhd, professional portrait photography, high resolution
   - ANIME: masterpiece, best quality, official art, detailed illustration
   - 3D: high poly model, 8k, ray tracing, detailed textures

3. **人物绘制质量**（抽象）：
   - REAL: detailed facial features, realistic skin texture, professional lighting
   - ANIME: beautiful detailed eyes, detailed character design, clean linework
   - 3D: subsurface scattering, realistic skin shader, detailed topology

4. **画面质感**：
   - REAL: shallow depth of field, bokeh background, natural colors
   - ANIME: vibrant colors, cel shading, clean rendering
   - 3D: PBR materials, realistic hair shader, cloth simulation

5. **光照风格**（适用于人物）：
   - REAL: soft portrait lighting, natural light, rim light
   - ANIME: soft shading, anime lighting, gentle highlights
   - 3D: three-point lighting, studio setup, subsurface scattering

**禁止包含**：
❌ 具体外貌：long hair, blue eyes, fair skin
❌ 具体服装：dress, suit, uniform
❌ 具体姿态：standing, sitting, running
❌ 具体表情：smiling, serious, sad
❌ 具体年龄/性别：teenage girl, old man
❌ 构图角度：portrait, full body, close-up

**输出格式**：
纯文本，逗号分隔，无换行，无markdown格式`;

/**
 * 生成风格提示词模板（场景或人物）
 */
export const generateStylePreset = async (
    presetType: 'SCENE' | 'CHARACTER',
    visualStyle: 'REAL' | 'ANIME' | '3D',
    upstreamStyleInfo: {
        artStyle?: string;
        genre?: string;
        setting?: string;
    },
    userInput?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<{ stylePrompt: string; negativePrompt: string }> => {
    return logAPICall(
        'generateStylePreset',
        async () => {
            const ai = getClient();

            const isScene = presetType === 'SCENE';
            const systemInstruction = isScene ? SCENE_STYLE_INSTRUCTION : CHARACTER_STYLE_INSTRUCTION;

            const prompt = `请生成一段${isScene ? '场景' : '人物'}风格描述词模板。

【上游视觉风格信息】
画风分析：${upstreamStyleInfo.artStyle || '未提供'}
类型：${upstreamStyleInfo.genre || '未提供'}
设定：${upstreamStyleInfo.setting || '未提供'}

【视觉风格类型】
${visualStyle}

【用户补充】
${userInput || '无'}

【要求】
生成纯粹的风格描述词，不包含任何具体${isScene ? '场景、物体或构图' : '人物特征（外貌、服装、姿态、表情）'}。
只包含：画风、${isScene ? '渲染' : '人物绘制'}质量、光影风格、${isScene ? '' : '渲染'}质感等抽象元素。
这段描述词将作为前缀，用于后续所有${isScene ? '场景' : '人物'}图像生成。`;

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction,
                        temperature: 0.7
                    },
                    contents: { parts: [{ text: prompt }] }
                });

                let stylePrompt = response.text?.trim() || '';

                // Remove markdown code blocks if present
                stylePrompt = stylePrompt.replace(/```/g, '').replace(/^text\n/g, '').trim();

                // Generate negative prompt based on type and style
                const negativePrompts: Record<string, string> = {
                    'SCENE_REAL': 'people, characters, humans, anime, cartoon, painting, illustration, 3d render, low quality, blurry, watermark, signature',
                    'SCENE_ANIME': 'realistic, photo, 3d, low quality, blurry, monochrome, watermark',
                    'SCENE_3D': '2d, flat, anime, photo, painting, low poly, low quality, blurry',
                    'CHARACTER_REAL': 'anime, cartoon, illustration, 3d, cgi, bad anatomy, deformed, low quality, blurry, watermark',
                    'CHARACTER_ANIME': 'realistic, photo, 3d, bad anatomy, bad hands, extra limbs, low quality, blurry, nsfw',
                    'CHARACTER_3D': '2d, flat, anime, photo, painting, low poly, bad topology, low quality, blurry'
                };

                const negativeKey = `${presetType}_${visualStyle}`;
                const negativePrompt = negativePrompts[negativeKey] || 'low quality, blurry, watermark';

                console.log('[generateStylePreset] Generated:', { presetType, visualStyle, stylePrompt, negativePrompt });

                return { stylePrompt, negativePrompt };
            } catch (e) {
                console.error('[generateStylePreset] Error:', e);
                throw new Error('风格提示词生成失败，请重试');
            }
        },
        {
            model: 'gemini-2.5-flash',
            presetType,
            visualStyle,
            hasUserInput: !!userInput,
            hasUpstreamInfo: !!(upstreamStyleInfo.artStyle || upstreamStyleInfo.genre || upstreamStyleInfo.setting)
        },
        context
    );
};

