/**
 * Gemini AI 服务
 * AIYOU 漫剧生成平台核心服务
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

import { GoogleGenAI, GenerateContentResponse, Type, Modality, Part, FunctionDeclaration } from "@google/genai";
import { SmartSequenceItem, VideoGenerationMode, StoryboardShot, CharacterProfile } from "../types";
import { logAPICall } from "./apiLogger";
import { getUserDefaultModel } from "./modelConfig";
import { llmProviderManager } from "./llmProviders";

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

// Get client from provider manager
export const getClient = () => {
  return llmProviderManager.getCurrentProvider().getClient();
};

// 检查当前提供商是否为 Gemini（用于高级功能）
const requireGeminiProvider = (featureName: string): void => {
  const currentProvider = llmProviderManager.getCurrentProviderType();
  if (currentProvider !== 'gemini') {
    throw new Error(
        `"${featureName}" 功能需要使用 Gemini 官方 API。\n\n` +
        `当前提供商：${llmProviderManager.getCurrentProvider().getName()}\n\n` +
        `请切换到 Gemini API (Google Official) 以使用此功能。`
    );
  }
};

// Legacy function - kept for backward compatibility
export const getLegacyClient = () => {
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

export const detectTextInImage = async (
    imageBase64: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<boolean> => {
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
            model: getUserDefaultModel('text'),
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
3. "appearancePrompt" 字段必须包含具体的视觉风格关键词，并且描述清晰，可以直接用于文生图模型。

**视觉风格特定要求（根据 Visual Style 选择对应要求）：**

**3D动画风格（当 Visual Style 为 3D 时）：**
- 核心风格：Xianxia 3D animation character, semi-realistic style, Xianxia animation aesthetics
- 必须使用：high precision 3D modeling, PBR shading with soft translucency
- 皮肤质感：delicate and smooth skin texture (not overly realistic), subsurface scattering，追求通透柔滑质感
- 服饰细节：flowing fabric clothing, 纱质服饰的飘逸感
- 发丝细节：individual hair strands, 发丝根根分明
- 光影效果：soft ethereal lighting, cinematic rim lighting with neutral tones, ambient occlusion
- 角色气质：otherworldly gaze, elegant and natural demeanor，强化出尘气质
- 严格禁止：2D illustration, hand-drawn, anime 2D, flat shading, cel shading, toon shading, cartoon 2D, overly photorealistic, hyper-realistic skin, photorealistic rendering

**REAL真人风格（当 Visual Style 为 REAL 时）：**
- 核心风格：Photorealistic portrait, realistic human, cinematic photography, professional headshot
- 必须使用：Professional portrait photography, DSLR quality, 85mm lens, sharp focus
- 皮肤质感：Realistic skin texture, visible pores, natural skin imperfections, skin details, subsurface scattering
- 服饰细节：Realistic fabric texture, detailed clothing materials, natural fabric folds
- 发丝细节：Natural hair texture, realistic hair strands, hair volume, shiny hair
- 光影效果：Natural lighting, studio portrait lighting, softbox lighting, rim light, golden hour
- 角色气质：Natural human expression, authentic emotion, realistic gaze, professional model look
- 严格禁止：anime, cartoon, illustration, 3d render, cgi, 3d animation, painting, drawing, bad anatomy, deformed

**ANIME 2D动漫风格（当 Visual Style 为 ANIME 时）：**
- 核心风格：Anime character, anime style, 2D anime art, manga illustration style
- 必须使用：Clean linework, crisp outlines, manga art style, detailed illustration
- 皮肤质感：Smooth flat skin, cel shading, clean skin rendering, no skin texture details
- 服饰细节：Clean clothing lines, simple fabric shading, anime costume design
- 发丝细节：Stylized hair, anime hair style, sharp hair outlines, spiky hair
- 光影效果：Soft lighting, rim light, vibrant colors, cel shading lighting, flat shading
- 角色气质：Expressive anime eyes, emotional face, kawaii or cool demeanor
- 严格禁止：photorealistic, realistic, photo, 3d, cgi, live action, hyper-realistic, skin texture, pores, realistic shading

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

**视觉风格特定要求（根据 Visual Style 选择对应要求）：**

**3D动画风格（当 Visual Style 为 3D 时）：**
- 核心风格：Xianxia 3D animation character, semi-realistic style, Xianxia animation aesthetics
- 必须使用：high precision 3D modeling, PBR shading with soft translucency
- 皮肤质感：delicate and smooth skin texture (not overly realistic), subsurface scattering，追求通透柔滑质感
- 服饰细节：flowing fabric clothing, 纱质服饰的飘逸感
- 发丝细节：individual hair strands, 发丝根根分明
- 光影效果：soft ethereal lighting, cinematic rim lighting with neutral tones, ambient occlusion
- 角色气质：otherworldly gaze, elegant and natural demeanor，强化出尘气质
- 严格禁止：2D illustration, hand-drawn, anime 2D, flat shading, cel shading, toon shading, cartoon 2D, overly photorealistic, hyper-realistic skin, photorealistic rendering

**REAL真人风格（当 Visual Style 为 REAL 时）：**
- 核心风格：Photorealistic portrait, realistic human, cinematic photography, professional headshot
- 必须使用：Professional portrait photography, DSLR quality, 85mm lens, sharp focus
- 皮肤质感：Realistic skin texture, visible pores, natural skin imperfections, skin details
- 服饰细节：Realistic fabric texture, detailed clothing materials, natural fabric folds
- 发丝细节：Natural hair texture, realistic hair strands, hair volume, shiny hair
- 光影效果：Natural lighting, studio portrait lighting, softbox lighting, rim light
- 角色气质：Natural human expression, authentic emotion, realistic gaze
- 严格禁止：anime, cartoon, illustration, 3d render, cgi, 3d animation, painting, drawing

**ANIME 2D动漫风格（当 Visual Style 为 ANIME 时）：**
- 核心风格：Anime character, anime style, 2D anime art, manga illustration style
- 必须使用：Clean linework, crisp outlines, manga art style, detailed illustration
- 皮肤质感：Smooth flat skin, cel shading, clean skin rendering, no skin texture details
- 服饰细节：Clean clothing lines, simple fabric shading, anime costume design
- 发丝细节：Stylized hair, anime hair style, sharp hair outlines, spiky hair
- 光影效果：Soft lighting, rim light, vibrant colors, cel shading lighting, flat shading
- 角色气质：Expressive anime eyes, emotional face, kawaii or cool demeanor
- 严格禁止：photorealistic, realistic, photo, 3d, cgi, live action, hyper-realistic, skin texture, pores
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

const VIDEO_ORCHESTRATOR_INSTRUCTION = `
You are a video prompt engineering expert for AI video generation models.

Your task is to create a single, concise video generation prompt in English that seamlessly transitions between the provided storyboard images.

**CRITICAL REQUIREMENTS:**
1. Output ONLY the video prompt in English - no explanations, no introductions, no bullet points
2. Start directly with the prompt text (e.g., "A cinematic scene showing...")
3. Focus on visual descriptions: camera movement, transitions, lighting, mood, atmosphere
4. Keep it concise (under 200 words)
5. Use professional video terminology: pan, zoom, fade, transition, tracking shot, etc.
6. Describe the flow between images, not just individual images

**DO NOT include:**
- "Here is a prompt..." or similar introductions
- Any explanations or commentary
- Bullet points or numbered lists
- Any non-English text in the prompt itself

**Example format:**
"Cinematic tracking shot transitioning from [scene 1 description] to [scene 2 description], with smooth camera movement, atmospheric lighting, [specific visual details]..."
`;

const SCRIPT_PLANNER_INSTRUCTION = `
你是一位专精于短剧和微电影的专业编剧 (Professional Screenwriter)。
你的任务是根据用户的核心创意和约束条件，创建一个引人入胜的**中文剧本大纲**。

**核心原则：剧本大纲只在章节层面规划，不细化到每集**

**如果提供了【参考信息 - 来自剧目精炼】：**
- 这些信息仅作为创作参考，用于启发灵感和确定方向
- 不要照搬，而是将其作为创作风格、主题方向的参考
- 可以借鉴其中的情感基调、受众定位、角色特征等元素
- 最终作品应该是原创的，融合用户的核心创意和你的专业创作

---

## 📊 剧集规模要求

本剧为 **{TotalEpisodes} 集**，需要规划 **{ChapterCount} 个章节**，每个章节包含 **{EpisodesPerChapter} 集**。

### 角色数量要求：{MinCharacters}-{MaxCharacters} 个角色

**角色分级与描述重点：**

**A. 核心角色（3-5人）- 需要详细小传**
- **主角团队**（2-3人）：故事的绝对核心
- **核心反派**（1-2人）：与主角对抗的主要力量

描述要求（每个角色80-120字）：
> **林萧** - 男主，24岁，表面冷漠的实习医生，实际拥有"死神之眼"，能看到他人的死亡倒计时。童年目睹父母被神秘组织杀害，从此封闭内心。独自在深山中修炼十年，学会控制自己的能力。性格：外冷内热，不善表达但内心善良，对正义有执着的追求。外貌：黑发黑瞳，修长身材，常穿白大褂，眼神深邃。

**B. 重要配角（8-12人）- 简单描述**
- 导师/盟友/中立角色等

描述要求（每个角色20-40字）：
> **苏晴** - 女主的闺蜜，性格活泼开朗，是女主的情感支撑，关键时刻提供帮助。

**C. 其他角色（剩余数量）- 一笔带过**
- 群演、背景角色、一次性角色等

描述要求（每个角色5-10字）：
> **护士小李** - 医院护士，配角。

### 物品数量要求：{MinItems}-{MaxItems} 个关键物品

**物品分级与描述：**

**A. 核心物品（3-5个）- 推动主线**
描述要求（每个物品30-50字）：
> **死神之眼徽章** - 林萧家族的传承信物，能增强持有者的超感能力，但会消耗生命力。黑色金属质地，雕刻着骷髅图案。

**B. 辅助物品（5-8个）- 特定章节使用**
描述要求（每个物品15-25字）：
> **医院门禁卡** - 进入特定区域的钥匙，第5集获得。

**C. 世界物品（剩余数量）- 丰富设定**
描述要求（每个物品10-15字）：
> **手术刀** - 林萧的随身物品。

---

## 🎯 章节结构与节奏要求

### 核心原则：每章包含2-5集，描述这几集的整体故事

### 节奏规律（必须严格遵循）

1. **小高潮**：每3-5集设置一次小高潮
   - 第3-5集：第一次小高潮
   - 第8-10集：第二次小高潮
   - 第13-15集：第三次小高潮
   - 以此类推...

2. **大转折**：每10-15集设置一次大转折
   - 第10-15集：剧情大反转/阵营重组/重大秘密揭露
   - 第20-25集：中期转折/角色关系巨变
   - 第30-35集：后期转折/核心冲突升级
   - 以此类推...

---

## 📝 输出格式要求 (必须严格遵守 Markdown 格式)

# 剧名 (Title)
**一句话梗概 (Logline)**: [一句话总结故事核心]
**类型 (Genre)**: [类型] | **主题 (Theme)**: [主题] | **背景 (Setting)**: [故事背景] | **视觉风格**: [Visual Style]

---

## 主要人物小传

### 核心角色（详细小传，80-120字/人）
* **[姓名]**: [角色定位] - [年龄] [外貌特征]。性格：[性格特点]。背景：[重要经历]。能力/特征：[特殊能力或标志性特征]。

### 重要配角（简单描述，20-40字/人）
* **[姓名]**: [角色定位和作用，简短描述]

### 其他角色（一笔带过，5-10字/人）
* **[姓名]**: [身份或作用]

---

## 关键物品设定

### 核心物品（30-50字/个）
* **[物品名称]**: [物品描述、功能、象征意义]

### 辅助物品（15-25字/个）
* **[物品名称]**: [物品描述和出现时机]

### 世界物品（10-15字/个）
* **[物品名称]**: [简要描述]

---

## 剧集结构规划（共 {TotalEpisodes} 集，{ChapterCount} 章）

### 章节格式标准（每章100-150字）

#### 第X章：章节名称（第A-B集）

**涉及角色**：[本章主要角色，3-5人]

**关键物品**：[本章重要物品，2-3个]

**章节剧情**（100-150字）：
[这几集的整体故事描述，包含起承转合]

- [第A集]：[发生了什么]
- [第A+1集]：[情节推进]
- [第B集]：[本章高潮/转折]

**关键节点**：[标注：小高潮 或 大转折]

---

### 章节示例

#### 第一章：觉醒篇（第1-4集）

**涉及角色**：林萧、苏晴、王院长

**关键物品**：死神之眼徽章、神秘纸条

**章节剧情**（120字）：
实习医生林萧发现自己能看到他人的死亡倒计时，从恐惧到逐渐接受这种能力。院长王建国察觉异常，暗中观察。林萧与护士苏晴建立信任，发现医院隐藏的密室。神秘黑衣人出现，留下纸条"我知道你能看到什么"。林萧意识到自己卷入巨大阴谋，与苏晴联手逃脱追捕。第4集高潮：林萧首次主动使用能力，看到王建国只剩3天寿命。

**关键节点**：小高潮（第4集）

---

## ⚠️ 重要规则

1. **只在章节层面规划**，不要细化到每集的具体场景
2. **每章100-150字**，简洁描述这几集的核心内容
3. **每章必须包含明确的起承转合**
4. **严格遵守节奏规律**：3-5集小高潮，10-15集大转折
5. **章节之间要有因果链条**，避免情节断裂
6. **角色描述按分级处理**：核心角色详细，配角简单，其他一笔带过
7. **物品描述按分级处理**：核心详细，辅助简略，世界物品最简
8. **物品名称必须统一**，不要使用同义词
9. **单集时长参考**: {Duration} 分钟
10. **在创作中请始终贯彻[Visual Style]的视觉美学**
11. **如有参考信息，灵活运用但不要生搬硬套，保持原创性**

---

## 📌 质量检查清单

在输出前，请确认：
- [ ] 章节数量 = {ChapterCount} 个
- [ ] 每章包含 {EpisodesPerChapter} 集
- [ ] 每章100-150字
- [ ] 核心角色有详细小传（80-120字/人）
- [ ] 重要配角有简单描述（20-40字/人）
- [ ] 其他角色有一笔带过（5-10字/人）
- [ ] 核心物品有详细描述（30-50字/个）
- [ ] 辅助物品有简略描述（15-25字/个）
- [ ] 世界物品有简单描述（10-15字/个）
- [ ] 每章有明确的起承转合
- [ ] 遵循3-5集小高潮、10-15集大转折规律
- [ ] 在关键节点处标注"小高潮"或"大转折"
- [ ] 章节之间有连贯性
- [ ] 全中文输出
`;

const SCRIPT_EPISODE_INSTRUCTION = `
你是一位专业的短剧分集编剧，擅长创作连贯、一致的系列剧集。
你的任务是根据提供的【剧本大纲】和【指定章节】，将该章节拆分为 N 个具体的剧集脚本。

**输入上下文：**
1. 剧本大纲 (Context) - 包含所有章节的概览
2. 目标章节 (Selected Chapter) - 当前要拆分的章节
3. 前序剧集摘要 (Previous Episodes Summary) - 之前已生成的剧集摘要，用于保持连贯性
4. 全局角色设定 (Global Characters) - 剧本大纲中定义的所有角色信息
5. 全局物品设定 (Global Items) - 剧本大纲中定义的所有关键物品信息
6. 拆分集数 (Split Count): [N]
7. 单集时长参考 (Duration Constraint)
8. 视觉风格 (Visual Style): [STYLE]
9. 修改建议 (Modification Suggestions): [如果提供] - 用户针对之前生成版本的修改意见

**连贯性和一致性要求 (CRITICAL):**

1. **角色一致性**:
   - 严格遵循【全局角色设定】中的角色外貌、性格、说话方式
   - 不要改变角色的既定特征（如：如果林霄是冷静内敛的，不要突然变得热血冲动）
   - 角色关系和互动方式要保持一致

2. **物品命名一致性**:
   - 严格使用【全局物品设定】中的标准名称
   - ❌ 错误：一会儿叫"脊骨"，一会儿叫"灵骨"
   - ✅ 正确：始终使用"脊骨"这个名称
   - 物品的特征、能力描述要保持一致

3. **剧情连贯性**:
   - 参考【前序剧集摘要】，确保时间线、事件顺序合理衔接
   - 角色的知识、状态应该承接前文（如：如果第1集主角受伤了，第2集应该体现这个状态）
   - 不要出现剧情矛盾或逻辑漏洞

4. **场景连贯性**:
   - 场景描述应该符合既定的视觉风格
   - 环境细节要保持一致（如：同一个房间的布局、装饰）

**输出要求：**
请直接输出一个 **JSON 数组**，不要包含 markdown 代码块标记（如 \`\`\`json），只输出纯 JSON 字符串。
数组中每个对象代表一集，格式如下：
[
  {
    "title": "第X集：[分集标题]",
    "content": "[详细剧本内容，包含场景描写、动作指令和对白。内容长度应符合时长限制。]",
    "characters": "[本集涉及的角色列表，必须与全局设定一致]",
    "keyItems": "[本集出现的关键物品列表，必须使用标准名称]",
    "visualStyleNote": "[针对本集的视觉风格备注]",
    "continuityNote": "[本集的连贯性说明，如承接前文哪件事、角色状态变化等]"
  },
  ...
]

**内容要求：**
1. **全中文写作**。

2. **剧本内容长度要求（CRITICAL - 必须严格遵守）**：
   - 每分钟时长需要 **200-250字** 的详细剧本内容
   - 例如：1分钟剧集 = 200-250字，2分钟剧集 = 400-500字
   - **如果对话较多，字数应相应增加**（对话+场景描述的字数密度更高）
   - 计算公式：目标字数 = 时长(分钟) × 200-250字/分钟
   - 如果内容不足，AI应该：
     * 增加更详细的场景描述（环境、光影、氛围）
     * 添加更多角色的肢体动作和表情细节
     * 扩充对话内容，增加角色互动
     * 描述角色的内心活动和情感变化
     * 加入更多感官细节（声音、气味、触感等）

3. **内容结构要求**：
   - 剧本内容 (content) 必须包含：
     * **场景描述** (Scene Action)：详细的环境描写、光影氛围、空间布局
     * **肢体动作** (Physical Actions)：角色的身体姿势、动作细节、位置移动
     * **表情细节** (Facial Expressions)：眼神、微表情、情绪变化
     * **精彩对白** (Dialogue)：符合角色性格的对话，推动剧情发展
     * **情感描写** (Emotional Depth)：内心活动、情感转变、动机暗示
   - 确保 N 个剧集能够完整覆盖所选章节的情节，并且每集结尾都要有悬念 (Cliffhanger)。
   - 场景描述应体现 [STYLE] 的视觉特点。

4. **细节扩写技巧**：
   - 不要只写"他走进房间"，要写"他推开沉重的红木门，脚步沉重地踏入昏暗的书房，皮鞋在大理石地板上发出清脆的回响"
   - 不要只写"她哭了"，要写"她的眼泪如断了线的珍珠般滑落，肩膀随着压抑的抽泣微微颤抖，双手紧紧攥着衣角，指节泛白"
   - 不要只写"房间很乱"，要写"书本散落一地，纸张如同秋风中的落叶般铺满整个房间，书架歪斜，几本书籍摇摇欲坠地挂在边缘"

5. **如果提供了修改建议，请根据建议调整剧本内容，优化情节、对白或场景描述。**

6. **在每集的continuityNote中明确说明本集与剧情主线的衔接关系。**
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
    "duration": 2,
    "scene": "教室 - 白天 - 靠窗最后一排",
    "characters": ["林霄"],
    "shotSize": "特写",
    "cameraAngle": "低位仰拍",
    "cameraMovement": "固定",
    "visualDescription": "(林霄坐在靠窗座位上，单手托腮，侧身望向窗外)阳光从窗外洒在林霄的侧脸上，他目光空洞地望向窗外，教室里其他同学的声音模糊成背景音",
    "dialogue": "无",
    "visualEffects": "浅景深，背景虚化；暖色调光线；ANIME风格，强调眼神细节",
    "audioEffects": "环境音 - 教室嘈杂声（低音量）"
  },
  ...
]

**拆分要求（必须严格遵守）：**

**1. 时长控制（CRITICAL - 最重要要求）**
- 每个分镜时长：严格控制在 **1-4 秒** 之间
- 平均镜头时长：2-3秒（保持快节奏）
- 不得出现超过4秒的长镜头
- 不得出现少于1秒的碎片化镜头

**2. 分镜数量计算（必须满足最低要求）**
根据总时长智能计算分镜数量：
- **1分钟内容（60秒）**：**至少 20 个分镜**
  - 最少：20个分镜（平均3秒/镜）
  - 推荐：25-30个分镜（平均2-2.4秒/镜）
  - 最多：60个分镜（平均1秒/镜）
- **2分钟内容（120秒）**：**至少 40 个分镜**
  - 最少：40个分镜（平均3秒/镜）
  - 推荐：50-60个分镜（平均2-2.4秒/镜）
  - 最多：120个分镜（平均1秒/镜）
- **3分钟内容（180秒）**：**至少 60 个分镜**
  - 最少：60个分镜（平均3秒/镜）
  - 推荐：75-90个分镜（平均2-2.4秒/镜）
  - 最多：180个分镜（平均1秒/镜）

**3. 时间精确（强制要求）**
- **所有分镜的时长总和必须等于或大于目标总时长**
- **不得低于目标总时长**（这是底线要求）
- 如果超出，允许最多超出5秒（考虑到内容完整性）
- 例如：目标60秒，生成总时长可以在60-65秒之间
- 例如：目标120秒，生成总时长可以在120-125秒之间

**4. 时长不足的补偿策略**
如果计算后发现总时长不足，必须：
- 增加更多细节镜头（如：特写角色反应、环境细节）
- 将长镜头拆分为多个短镜头
- 添加过渡镜头或转场镜头
- 补充角色表情变化的镜头
- **严禁通过增加单个镜头时长来凑时间**（每个镜头仍必须在1-4秒范围内）

**5. 剧情结构智能拆分（核心要求）**
根据内容类型动态调整镜头节奏：

**关键情节/高潮场景**：
- 使用更多短镜头（1-2秒）
- 快速切换，营造紧张感
- 强化戏剧冲突
- 例如：对峙、冲突、意外发生、情感爆发时刻

**情感戏/对话场景**：
- 使用中等时长镜头（2-3秒）
- 适度推拉，跟随情绪
- 展现角色反应和微表情
- 例如：对话、思考、内心戏

**环境描写/转场**：
- 使用较长镜头（3-4秒）
- 建立空间感
- 缓和节奏
- 例如：环境空镜、场景切换

**动作场面**：
- 使用极短镜头（1秒）
- 快速剪辑
- 强化动感
- 例如：追逐、打斗、突发动作

**5. 内容结构识别**
必须识别并优先处理以下结构：
- 【场景】标记：场景切换处必须有分镜点
- 【画面】标记：画面描述重点处
- 对话：每个角色发言应有独立镜头（1-2秒）
- 动作：每个关键动作分解为1-2秒镜头
- 情绪：情绪变化点应有镜头切换

**内容要求：**

1. **专业术语**：
   - 景别：大远景、远景、全景、中景、中近景、近景、特写、大特写
   - 拍摄角度：视平、高位俯拍、低位仰拍、斜拍、越肩、鸟瞰
   - 运镜方式：固定、横移、俯仰、横摇、升降、轨道推拉、变焦推拉、正跟随、倒跟随、环绕、滑轨横移

2. **画面描述详细**：
   - **必须首先描述角色的肢体状态/身体姿势**（这是最重要的要求）
     - ✅ 正确："(秦烈躺在地上，浑身湿透)秦烈的眼睛里充满了不屈的怨毒，瞳孔深处燃烧着仇恨的火焰。"
     - ❌ 错误："秦烈的眼睛里充满了不屈的怨毒，瞳孔深处燃烧着仇恨的火焰。"
   - 肢体状态描述应包括：
     - 身体姿势：站着、坐着、躺着、跪着、蹲着、弯腰等
     - 身体状态：受伤、疲惫、湿透、颤抖、紧绷等
     - 位置关系：在地面上、靠墙坐着、悬在空中等
   - 在描述面部表情、眼神、细节之前，必须先交代角色的身体状态
   - 必须包含具体的人物动作、表情、环境细节
   - 描述要有画面感，能够直接指导AI生成

3. **场景信息完整**：
   - 格式："地点 - 时间 - 具体位置"
   - 例如："教室 - 白天 - 靠窗最后一排"

4. **视觉效果专业**：
   - 包含景深、色调、特效、风格等信息
   - 必须符合指定的 [STYLE] 视觉风格

5. **连贯性**：
   - 分镜之间要有逻辑衔接
   - 服务于整体叙事节奏
   - 镜头组接要符合视听语言规律
   - **肢体状态连贯性**：相邻分镜中，角色的身体姿势、位置状态应保持一致（除非有动作变化）
     - 例如：如果前一个镜头角色是"躺在地上"，下一个特写镜头也要在描述中暗示这个状态
     - 使用括号标注肢体状态以保持一致性："(角色躺在地上)"

6. **对白处理**：
   - 如果有对白，标注角色名和对白内容
   - 区分正常对白、内心独白(Voice Over)、旁白等
   - 如果无对白，写"无"

**拆分策略示例：**

*示例1：对话场景（15秒）*
- 镜头1：(林霄坐在靠窗座位上，单手托腮)林霄望向窗外，眼神空洞（2秒）
- 镜头2：(林霄坐着，侧脸特写)阳光洒在林霄侧脸上（2秒）
- 镜头3：(另一位同学站在林霄桌前)同学低头看向林霄（2秒）
- 镜头4：(林霄坐着，未回头)林霄眼皮微微颤动（2秒）
- 镜头5：(过肩镜头，林霄坐着)两人对话（3秒）
- 镜头6：(教室全景)教室里的其他同学在交谈（2秒）
- 镜头7：(林霄坐着，正面特写)林霄眼神逐渐聚焦（2秒）
= 总共7个镜头，15秒

*示例2：动作场景（10秒）*
- 镜头1：(秦烈站立，紧握拳头)秦烈怒视前方（1秒）
- 镜头2：(秦烈向前冲出)秦烈冲向对手（1秒）
- 镜头3：(两人肢体交错)特写冲击瞬间（1秒）
- 镜头4：(秦烈后退半步，踉跄)秦烈受到冲击（2秒）
- 镜头5：(秦烈单膝跪地，喘息)环境氛围渲染（2秒）
- 镜头6：(秦烈跪在地上，抬头)秦烈眼中燃烧不屈火焰（3秒）
= 总共6个镜头，10秒

**画面描述范例对比：**
- ❌ 缺少肢体状态："秦烈的眼睛里充满了不屈的怨毒，瞳孔深处燃烧着仇恨的火焰。"
- ✅ 包含肢体状态："(秦烈跪在地上，浑身湿透，雨水顺着发梢滴落)秦烈的眼睛里充满了不屈的怨毒，瞳孔深处燃烧着仇恨的火焰。"

**重要提示：**
- **每个分镜的visualDescription必须以角色肢体状态开头**（用括号标注）
- 输出必须是纯 JSON 数组，不要包含任何其他文字
- 每个分镜对象的所有字段都必须填写
- duration 字段必须是数字类型（1-4之间）
- characters 字段必须是字符串数组
- 优先保证剧情节奏，而非机械均分时长
- 关键时刻多用短镜头强化冲击力
- 过渡时刻可用较长镜头缓和节奏
`;

// --- API Functions ---


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
            // 使用提供商管理器生成图片
            return llmProviderManager.generateImages(prompt, model, inputImages, options);
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
            requireGeminiProvider('视频生成');
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
                    const imgs = await generateImageFromText(fallbackPrompt, getUserDefaultModel('image'), inputImages, { aspectRatio: options.aspectRatio }, context);
                    return { uri: imgs[0], isFallbackImage: true };
                } catch (imgErr) {
                    throw new Error("Video generation failed and Image fallback also failed: " + getErrorMessage(e));
                }
            }
        },
        {
            model,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            options: {
                aspectRatio: options.aspectRatio,
                resolution: options.resolution,
                count: options.count,
                generationMode: options.generationMode
            },
            inputs: {
                hasImage: !!inputImageBase64,
                hasVideo: !!videoInput,
                referenceImagesCount: referenceImages?.length || 0
            },
            inputImagesCount: (inputImageBase64 ? 1 : 0) + (referenceImages?.length || 0)
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
            requireGeminiProvider('视频分析');
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
     requireGeminiProvider('图片编辑');
     const imgs = await generateImageFromText(prompt, model, [imageBase64], { count: 1 });
     return imgs[0];
};

export const planStoryboard = async (
    prompt: string,
    context: string,
    model?: string,
    apiContext?: { nodeId?: string; nodeType?: string }
): Promise<string[]> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'planStoryboard',
        async () => {
            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const response = await llmProviderManager.generateContent(
                `Context: ${context}\n\nUser Idea: ${prompt}`,
                effectiveModel,
                {
                    responseMimeType: 'application/json',
                    systemInstruction: STORYBOARD_INSTRUCTION
                }
            );

            try {
                return JSON.parse(response || "[]");
            } catch {
                return [];
            }
        },
        {
            model: effectiveModel,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            contextLength: context.length
        },
        { ...apiContext, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

export const generateScriptPlanner = async (
    prompt: string,
    config: { theme?: string, genre?: string, setting?: string, episodes?: number, duration?: number, visualStyle?: string },
    refinedInfo?: Record<string, string[]>,
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'generateScriptPlanner',
        async () => {
            // 动态计算参数
            const episodes = config.episodes || 10;
            const episodesPerChapter = 4; // 每章包含4集（2-5集范围）
            const chapterCount = Math.ceil(episodes / episodesPerChapter); // 100集 = 25章
            const minCharacters = Math.round(10 + (episodes * 0.15)); // 100集 = 25人
            const maxCharacters = Math.round(minCharacters * 1.3); // 约32人
            const minItems = Math.round(8 + (episodes * 0.1)); // 100集 = 18个
            const maxItems = Math.round(minItems * 1.25); // 约22个

            // 替换prompt中的占位符
            let systemInstruction = SCRIPT_PLANNER_INSTRUCTION
                .replace(/{TotalEpisodes}/g, String(episodes))
                .replace(/{ChapterCount}/g, String(chapterCount))
                .replace(/{EpisodesPerChapter}/g, String(episodesPerChapter))
                .replace(/{MinCharacters}/g, String(minCharacters))
                .replace(/{MaxCharacters}/g, String(maxCharacters))
                .replace(/{MinItems}/g, String(minItems))
                .replace(/{MaxItems}/g, String(maxItems))
                .replace(/{Duration}/g, String(config.duration || 1));

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

            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const effectiveModel = model || getUserDefaultModel('text');
            const response = await llmProviderManager.generateContent(
                fullPrompt,
                effectiveModel,
                {
                    systemInstruction: systemInstruction
                }
            );

            return response;
        },
        {
            model: model || getUserDefaultModel('text'),
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            config,
            hasRefinedInfo: !!refinedInfo && Object.keys(refinedInfo).length > 0
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

export const generateScriptEpisodes = async (
    outline: string,
    chapter: string,
    splitCount: number,
    duration: number,
    style?: string,
    modificationSuggestion?: string,
    model?: string,
    previousEpisodes?: Array<{ title: string, content: string, characters: string, keyItems?: string }>, // 新增参数：之前生成的剧集
    context?: { nodeId?: string; nodeType?: string }
): Promise<{ title: string, content: string, characters: string, keyItems?: string, continuityNote?: string }[]> => {
    return logAPICall(
        'generateScriptEpisodes',
        async () => {
            // 解析剧本大纲中的角色和物品信息
            const globalCharacters = extractCharactersFromOutline(outline);
            const globalItems = extractItemsFromOutline(outline);

            // 构建前序剧集摘要
            const previousEpisodesSummary = previousEpisodes && previousEpisodes.length > 0
                ? previousEpisodes.map((ep, idx) => `
第${idx + 1}集：${ep.title}
- 涉及角色：${ep.characters}
- 关键物品：${ep.keyItems || '无'}
- 剧情摘要：${ep.content.substring(0, 200)}...
                `).join('\n')
                : '无前序剧集（这是第一批生成的剧集）';

            const prompt = `
剧本大纲全文：
${outline}

目标章节：${chapter}
拆分集数：${splitCount}
单集时长参考：${duration} 分钟
视觉风格：${style || 'N/A'}
${modificationSuggestion ? `\n修改建议：${modificationSuggestion}` : ''}

=== 全局角色设定 ===
${globalCharacters}

=== 全局物品设定 ===
${globalItems}

=== 前序剧集摘要（用于保持连贯性）===
${previousEpisodesSummary}

连贯性要求：
1. 角色特征、说话方式必须与【全局角色设定】一致
2. 物品名称必须严格使用【全局物品设定】中的标准名称
3. 剧情应承接【前序剧集摘要】中的事件和角色状态
4. 每集的continuityNote要明确说明与剧情主线的衔接关系
`;

            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const effectiveModel = model || getUserDefaultModel('text');
            const response = await llmProviderManager.generateContent(
                prompt,
                effectiveModel,
                {
                    systemInstruction: SCRIPT_EPISODE_INSTRUCTION,
                    responseMimeType: 'application/json'
                }
            );

            try {
                const text = response?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
                return JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse script episodes JSON", e);
                throw new Error("生成剧本格式错误，请重试");
            }
        },
        {
            model: model || getUserDefaultModel('text'),
            chapter,
            splitCount,
            duration,
            style,
            hasModification: !!modificationSuggestion,
            hasPreviousEpisodes: !!previousEpisodes && previousEpisodes.length > 0
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

/**
 * 从剧本大纲中提取角色信息
 */
function extractCharactersFromOutline(outline: string): string {
    // 查找"## 主要人物小传"部分
    const characterSection = outline.match(/## 主要人物小传[^#]*/s);
    if (characterSection) {
        return characterSection[0].trim();
    }
    return "未找到明确的角色定义";
}

/**
 * 从剧本大纲中提取物品信息
 */
function extractItemsFromOutline(outline: string): string {
    // 查找"## 关键物品设定"部分
    const itemsSection = outline.match(/## 关键物品设定[^#]*/s);
    if (itemsSection) {
        return itemsSection[0].trim();
    }
    return "未找到明确的物品定义";
}

export const generateDetailedStoryboard = async (
    episodeTitle: string,
    episodeContent: string,
    totalDuration: number, // in seconds
    visualStyle: string,
    onShotGenerated?: (shot: import('../types').DetailedStoryboardShot) => void,
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<import('../types').DetailedStoryboardShot[]> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'generateDetailedStoryboard',
        async () => {

            // 计算所需分镜数量
            const minShots = Math.floor(totalDuration / 3);  // 最低：按3秒/镜
            const recommendedShots = Math.floor(totalDuration / 2.5);  // 推荐：按2.5秒/镜
            const maxShots = totalDuration;  // 最多：按1秒/镜


            const prompt = `🎯 CRITICAL TASK - 必须满足时长要求

【剧集信息】
Title: ${episodeTitle}
Content: ${episodeContent}
Duration: ${totalDuration} seconds
Style: ${visualStyle}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 绝对要求（ABSOLUTE REQUIREMENTS）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ 分镜数量强制要求：
   ✅ MUST生成至少 ${minShots} 个分镜
   ✅ 推荐生成 ${recommendedShots} 个分镜
   ✅ 当前你的任务是生成 ${totalDuration} 秒的视频分镜

2️⃣ 时长总和强制要求：
   ✅ 所有分镜的duration总和 ≥ ${totalDuration} 秒
   ✅ 绝对不能少于 ${totalDuration} 秒（这是底线）
   ✅ 每个分镜时长范围：1-4秒

3️⃣ 计算方法：
   • 如果生成 ${minShots} 个分镜，每个平均 3秒 → 总计 ${minShots * 3}秒 ✅
   • 如果生成 ${recommendedShots} 个分镜，每个平均 2.5秒 → 总计 ${Math.round(recommendedShots * 2.5)}秒 ✅
   • 如果生成 ${maxShots} 个分镜，每个平均 1秒 → 总计 ${maxShots}秒 ✅

4️⃣ 错误示例（必须避免）：
   ❌ 只生成 20 个分镜 → 总计最多 80秒 < ${totalDuration}秒 → 失败
   ❌ 只生成 ${minShots - 5} 个分镜 → 总计最多 ${(minShots - 5) * 4}秒 < ${totalDuration}秒 → 失败
   ✅ 生成 ${minShots} 个分镜 → 总计 ${minShots * 3}秒 ≥ ${totalDuration}秒 → 成功

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

输出JSON数组，包含至少 ${minShots} 个分镜对象。`;


            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const response = await llmProviderManager.generateContent(
                prompt,
                effectiveModel,
                {
                    systemInstruction: DETAILED_STORYBOARD_INSTRUCTION,
                    responseMimeType: 'application/json'
                }
            );

            try {
                const text = response?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";

                const rawShots = JSON.parse(text);

                // Validate and fix shot durations (must be 1-4 seconds)
                let currentTime = 0;
                let fixedDurationCount = 0;
                let invalidDurationCount = 0;

                const shots: import('../types').DetailedStoryboardShot[] = rawShots.map((rawShot: any, index: number) => {
                    let duration = rawShot.duration || 3;

                    // Validate and clamp duration to 1-4 seconds
                    if (duration < 1) {
                        console.warn(`[generateDetailedStoryboard] Shot ${index + 1} duration ${duration}s too short, setting to 1s`);
                        duration = 1;
                        fixedDurationCount++;
                    } else if (duration > 4) {
                        console.warn(`[generateDetailedStoryboard] Shot ${index + 1} duration ${duration}s too long, setting to 4s`);
                        duration = 4;
                        fixedDurationCount++;
                    }

                    if (duration !== rawShot.duration) {
                        invalidDurationCount++;
                    }

                    const startTime = currentTime;
                    const endTime = currentTime + duration;
                    currentTime = endTime;

                    return {
                        id: `shot-${Date.now()}-${index}`,
                        shotNumber: rawShot.shotNumber || (index + 1),
                        duration,
                        scene: rawShot.scene || '',
                        characters: Array.isArray(rawShot.characters) ? rawShot.characters : [],
                        shotSize: rawShot.shotSize || '',
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

                // Calculate statistics
                const actualTotalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
                const avgDuration = actualTotalDuration / shots.length;
                const minDuration = Math.min(...shots.map(s => s.duration));
                const maxDuration = Math.max(...shots.map(s => s.duration));


                // ⚠️ 时长检查（仅警告，不阻止生成）
                const durationDiff = actualTotalDuration - totalDuration;

                if (durationDiff < 0) {
                    const shortageSeconds = Math.abs(durationDiff);
                    const shortagePercent = (shortageSeconds / totalDuration) * 100;

                    console.warn(`[generateDetailedStoryboard] ⚠️ 时长不足`);
                    console.warn(`[generateDetailedStoryboard] 目标: ${totalDuration}秒，实际: ${actualTotalDuration}秒，缺少: ${shortageSeconds}秒 (${shortagePercent.toFixed(1)}%)`);

                    const minRequired = Math.floor(totalDuration / 3);
                    const recommended = Math.floor(totalDuration / 2.5);
                    console.warn(`[generateDetailedStoryboard] 当前: ${shots.length} 个分镜，建议: ${recommended} 个`);
                } else if (durationDiff > 5) {
                    console.warn(`[generateDetailedStoryboard] ⚠️ 时长超出 ${durationDiff} 秒`);
                } else {
                }

                // 分镜数量检查（仅警告，不阻止生成）
                const minExpectedShots = Math.floor(totalDuration / 3);
                const recommendedShots = Math.floor(totalDuration / 2.5);
                const maxExpectedShots = totalDuration;


                if (shots.length < minExpectedShots) {
                    console.warn(`[generateDetailedStoryboard] ⚠️ 分镜数量偏少（${shots.length}/${minExpectedShots}），但仍可使用`);
                } else if (shots.length > maxExpectedShots) {
                    console.warn(`[generateDetailedStoryboard] ⚠️ 分镜数量较多（${shots.length}/${maxExpectedShots}）`);
                } else {
                }

                return shots;
            } catch (e) {
                console.error("[generateDetailedStoryboard] Error:", e);
                // 保留原始错误信息，不要统一包装
                if (e instanceof Error) {
                    throw e;
                }
                throw new Error("分镜生成失败，请重试");
            }
        },
        {
            model: effectiveModel,
            episodeTitle,
            totalDuration,
            visualStyle,
            contentLength: episodeContent.length
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
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
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<StoryboardShot[]> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'generateCinematicStoryboard',
        async () => {
            const prompt = `
    Episode Script: ${episodeScript}
    Shot Count: ${shotCount}
    Shot Duration: ${shotDuration}s
    Visual Style: ${style}
    `;

            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const response = await llmProviderManager.generateContent(
                prompt,
                effectiveModel,
                {
                    systemInstruction: CINEMATIC_STORYBOARD_INSTRUCTION,
                    responseMimeType: 'application/json'
                }
            );

            try {
                const text = response?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
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
            model: effectiveModel,
            shotCount,
            shotDuration,
            style,
            scriptLength: episodeScript.length
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

export const orchestrateVideoPrompt = async (
    images: string[],
    userPrompt: string,
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'orchestrateVideoPrompt',
        async () => {
            const ai = getClient();
            const parts: Part[] = images.map(img => ({ inlineData: { data: img.replace(/^data:.*;base64,/, ""), mimeType: "image/png" } }));
            parts.push({ text: `Create a single video prompt that transitions between these images. User Intent: ${userPrompt}` });

            const response = await ai.models.generateContent({
                model: effectiveModel,
                config: { systemInstruction: VIDEO_ORCHESTRATOR_INSTRUCTION },
                contents: { parts }
            });

            return response.text || userPrompt;
        },
        {
            model: effectiveModel,
            prompt: userPrompt.substring(0, 200) + (userPrompt.length > 200 ? '...' : ''),
            imageCount: images.length
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

export const compileMultiFramePrompt = (frames: any[]) => {
    return "A sequence showing: " + frames.map(f => f.transition?.prompt || "scene").join(" transitioning to ");
};

export const generateAudio = async (
    prompt: string,
    model: string,
    referenceAudio?: string,
    options?: { persona?: any, emotion?: any },
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    return logAPICall(
        'generateAudio',
        async () => {
            requireGeminiProvider('音频生成');
            const ai = getClient();

            const parts: Part[] = [{ text: prompt }];
            if (referenceAudio) {
                const mime = referenceAudio.match(/^data:(audio\/\w+);base64,/)?.[1] || 'audio/wav';
                const data = referenceAudio.replace(/^data:audio\/\w+;base64,/, "");
                parts.push({ inlineData: { mimeType: mime, data } });
            }

            const voiceName = options?.persona?.label === 'Deep Narrative' ? 'Kore' : 'Puck';

            const response = await ai.models.generateContent({
                model: model,
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
            model: model,
            prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
            hasReferenceAudio: !!referenceAudio,
            voiceName: options?.persona?.label === 'Deep Narrative' ? 'Kore' : 'Puck'
        },
        context
    );
};

export const transcribeAudio = async (
    audioBase64: string,
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string> => {
    const effectiveModel = model || getUserDefaultModel('audio');

    return logAPICall(
        'transcribeAudio',
        async () => {
            requireGeminiProvider('音频转录');
            const ai = getClient();
            const mime = audioBase64.match(/^data:(audio\/\w+);base64,/)?.[1] || 'audio/wav';
            const data = audioBase64.replace(/^data:audio\/\w+;base64,/, "");

            const response = await ai.models.generateContent({
                model: effectiveModel,
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
            model: effectiveModel,
            hasAudio: true
        },
        context
    );
};

export const connectLiveSession = async (
    onAudioData: (base64: string) => void,
    onClose: () => void
) => {
    requireGeminiProvider('实时会话');
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
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<string[]> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'extractCharactersFromText',
        async () => {
            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const response = await llmProviderManager.generateContent(
                `提取以下剧本内容中的所有角色名：\n${text}`,
                effectiveModel,
                {
                    responseMimeType: 'application/json',
                    systemInstruction: CHARACTER_EXTRACTION_INSTRUCTION
                }
            );
            try {
                const json = JSON.parse(response || "[]");
                return Array.isArray(json) ? json : [];
            } catch {
                return [];
            }
        },
        {
            model: effectiveModel,
            textLength: text.length
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

export const generateCharacterProfile = async (
    name: string,
    contextText: string,
    styleContext?: string,
    customDesc?: string,
    model?: string,
    apiContext?: { nodeId?: string; nodeType?: string }
): Promise<CharacterProfile> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'generateCharacterProfile',
        async () => {
            const prompt = `
    Role Name: ${name}
    Script Context: ${contextText}
    Visual Style Context (CRITICAL): ${styleContext || "Default"}
    ${customDesc ? `Additional User Description: ${customDesc}` : 'Auto-complete details based on context.'}
    `;

            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const response = await llmProviderManager.generateContent(
                prompt,
                effectiveModel,
                {
                    responseMimeType: 'application/json',
                    systemInstruction: CHARACTER_PROFILE_INSTRUCTION
                }
            );

            try {
                const raw = JSON.parse(response || "{}");
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
            model: effectiveModel,
            characterName: name,
            hasStyleContext: !!styleContext,
            hasCustomDesc: !!customDesc,
            contextLength: contextText.length
        },
        { ...apiContext, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

// Generate simplified profile for supporting characters
export const generateSupportingCharacter = async (
    name: string,
    contextText: string,
    styleContext?: string,
    model?: string,
    apiContext?: { nodeId?: string; nodeType?: string }
): Promise<CharacterProfile> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'generateSupportingCharacter',
        async () => {
            const prompt = `
    Role Name: ${name}
    Script Context: ${contextText}
    Visual Style Context (CRITICAL): ${styleContext || "Default"}
    This is a SUPPORTING CHARACTER - keep it simple and concise.
    `;

            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const response = await llmProviderManager.generateContent(
                prompt,
                effectiveModel,
                {
                    responseMimeType: 'application/json',
                    systemInstruction: SUPPORTING_CHARACTER_INSTRUCTION
                }
            );

            try {
                const raw = JSON.parse(response || "{}");
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
            model: effectiveModel,
            characterName: name,
            roleType: 'supporting',
            hasStyleContext: !!styleContext,
            contextLength: contextText.length
        },
        { ...apiContext, platform: llmProviderManager.getCurrentProvider().getName() }
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
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<DramaAnalysisResult> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'analyzeDrama',
        async () => {
            const prompt = `
请分析以下剧集：${dramaName}

注意：
1. 如果你对该剧有所了解，请提供详细的分析。
2. 如果你不了解该剧，请在 dramaIntroduction 字段中明确说明，并在其他字段中提供通用的分析框架建议。
`;

            // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
            const response = await llmProviderManager.generateContent(
                prompt,
                effectiveModel,
                {
                    responseMimeType: 'application/json',
                    systemInstruction: DRAMA_ANALYZER_INSTRUCTION
                }
            );

            try {
                let text = response?.trim() || "{}";

                // 尝试多种方式提取JSON
                let raw: any = null;

                // 方法1: 直接解析
                try {
                    raw = JSON.parse(text);
                } catch (e1) {
                    console.warn('[analyzeDrama] Direct JSON parse failed, trying to extract...');

                    // 方法2: 移除markdown代码块标记
                    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                    try {
                        raw = JSON.parse(text);
                    } catch (e2) {
                        console.warn('[analyzeDrama] After removing markdown failed, trying regex...');

                        // 方法3: 使用正则表达式提取JSON对象
                        const jsonMatch = text.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                raw = JSON.parse(jsonMatch[0]);
                            } catch (e3) {
                                console.error('[analyzeDrama] All JSON parsing methods failed');
                                console.error('[analyzeDrama] Response text preview:', text.substring(0, 500));
                                throw new Error(
                                    `无法解析AI返回的JSON数据。\n` +
                                    `错误: ${e3 instanceof Error ? e3.message : '未知错误'}\n\n` +
                                    `💡 建议:\n` +
                                    `1. 重新尝试分析\n` +
                                    `2. 或切换到其他模型`
                                );
                            }
                        } else {
                            throw new Error('AI返回的内容中未找到有效的JSON格式');
                        }
                    }
                }

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
                console.error("[analyzeDrama] Error:", e);
                // 保留原始错误信息
                if (e instanceof Error) {
                    throw e;
                }
                throw new Error("剧目分析失败，请重试");
            }
        },
        {
            model: effectiveModel,
            dramaName
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
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
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<Record<string, string[]>> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'extractRefinedTags',
        async () => {
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
                // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
                const response = await llmProviderManager.generateContent(
                    `${DRAMA_REFINED_EXTRACTION_INSTRUCTION}\n\n${prompt}`,
                    effectiveModel,
                    {
                        responseMimeType: 'application/json'
                    }
                );


                // 改进的JSON清理逻辑
                let text = response?.trim() || "{}";

                // 移除markdown代码块标记
                text = text.replace(/```json\s*/g, '');
                text = text.replace(/```\s*/g, '');

                // 移除可能的前导文字（比如 "JSON Ext" 之类的）
                // 查找第一个 { 或 [
                const firstBraceIndex = text.indexOf('{');
                const firstBracketIndex = text.indexOf('[');
                const startIndex = Math.min(
                    firstBraceIndex !== -1 ? firstBraceIndex : Infinity,
                    firstBracketIndex !== -1 ? firstBracketIndex : Infinity
                );

                if (startIndex !== Infinity) {
                    text = text.substring(startIndex);
                }

                // 查找最后一个 } 或 ]
                const lastBraceIndex = text.lastIndexOf('}');
                const lastBracketIndex = text.lastIndexOf(']');
                const endIndex = Math.max(
                    lastBraceIndex !== -1 ? lastBraceIndex : -1,
                    lastBracketIndex !== -1 ? lastBracketIndex : -1
                );

                if (endIndex !== -1) {
                    text = text.substring(0, endIndex + 1);
                }

                text = text.trim();


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
            model: effectiveModel,
            selectedFieldsCount: selectedFields.length,
            selectedFields
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
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
   - 3D: photorealistic 3D CG character

2. **渲染质量**：
   - REAL: 8k uhd, professional portrait photography, high resolution
   - ANIME: masterpiece, best quality, official art, detailed illustration
   - 3D: high poly model, 8k, clean 3d render, stylized rendering

3. **人物绘制质量**（抽象）：
   - REAL: detailed facial features, realistic skin texture, professional lighting
   - ANIME: beautiful detailed eyes, detailed character design, clean linework
   - 3D: smooth realistic skin, clean character design, realistic features

4. **画面质感**：
   - REAL: shallow depth of field, bokeh background, natural colors
   - ANIME: vibrant colors, cel shading, clean rendering
   - 3D: toon shading, vibrant colors, clean surfaces, artistic rendering, non-photorealistic

5. **光照风格**（适用于人物）：
   - REAL: soft portrait lighting, natural light, rim light
   - ANIME: soft shading, anime lighting, gentle highlights
   - 3D: studio lighting, soft shadows, ambient occlusion, three-point lighting

**禁止包含**：
❌ 具体外貌：long hair, blue eyes, fair skin
❌ 具体服装：dress, suit, uniform
❌ 具体姿态：standing, sitting, running
❌ 具体表情：smiling, serious, sad
❌ 具体年龄/性别：teenage girl, old man
❌ 构图角度：portrait, full body, close-up
❌ 真人皮肤纹理：skin texture, pores, wrinkles, skin details
❌ 照片质感：photorealistic, hyperrealistic, photo, photography

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
    model?: string,
    context?: { nodeId?: string; nodeType?: string }
): Promise<{ stylePrompt: string; negativePrompt: string }> => {
    const effectiveModel = model || getUserDefaultModel('text');

    return logAPICall(
        'generateStylePreset',
        async () => {
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
                // 使用 llmProviderManager.generateContent 而不是直接调用 getClient()
                const response = await llmProviderManager.generateContent(
                    prompt,
                    effectiveModel,
                    {
                        systemInstruction
                    }
                );

                let stylePrompt = response?.trim() || '';

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


                return { stylePrompt, negativePrompt };
            } catch (e) {
                console.error('[generateStylePreset] Error:', e);
                throw new Error('风格提示词生成失败，请重试');
            }
        },
        {
            model: effectiveModel,
            presetType,
            visualStyle,
            hasUserInput: !!userInput,
            hasUpstreamInfo: !!(upstreamStyleInfo.artStyle || upstreamStyleInfo.genre || upstreamStyleInfo.setting)
        },
        { ...context, platform: llmProviderManager.getCurrentProvider().getName() }
    );
};

