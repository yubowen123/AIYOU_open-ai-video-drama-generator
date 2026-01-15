
import { GoogleGenAI, GenerateContentResponse, Type, Modality, Part, FunctionDeclaration } from "@google/genai";
import { SmartSequenceItem, VideoGenerationMode, StoryboardShot, CharacterProfile, DramaAnalysis } from "../types";
import { getUserDefaultModel } from "../../services/modelConfig";

const getClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please select a paid API key via the Google AI Studio button.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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

// Audio/Video/Image Utilities
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

export const sendChatMessage = async (
    history: { role: 'user' | 'model', parts: { text: string }[] }[], 
    newMessage: string,
    options?: { isThinkingMode?: boolean, isStoryboard?: boolean, isHelpMeWrite?: boolean }
): Promise<string> => {
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
};

export const generateImageFromText = async (
    prompt: string, 
    model: string, 
    inputImages: string[] = [], 
    options: { aspectRatio?: string, resolution?: string, count?: number } = {}
): Promise<string[]> => {
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
    
    parts.push({ text: prompt });

    try {
        const response = await ai.models.generateContent({
            model: effectiveModel,
            contents: { parts },
            config: {
                // responseMimeType: 'image/jpeg', // Not supported for Gemini models yet in this SDK version context
            }
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
};

export const generateVideo = async (
    prompt: string, 
    model: string, 
    options: { aspectRatio?: string, count?: number, generationMode?: VideoGenerationMode, resolution?: string } = {}, 
    inputImageBase64?: string | null,
    videoInput?: any,
    referenceImages?: string[],
    lastFrameImageBase64?: string | null
): Promise<{ uri: string, isFallbackImage?: boolean, videoMetadata?: any, uris?: string[] }> => {
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

    if (lastFrameImageBase64) {
        try {
            const c = await convertImageToCompatibleFormat(lastFrameImageBase64);
            config.lastFrame = { imageBytes: c.data, mimeType: c.mimeType };
        } catch (e) {
            console.warn("Veo Last Frame Image Conversion Failed:", e);
        }
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
            const imgs = await generateImageFromText(fallbackPrompt, getUserDefaultModel('image'), inputImages, { aspectRatio: options.aspectRatio });
            return { uri: imgs[0], isFallbackImage: true };
        } catch (imgErr) {
            throw new Error("Video generation failed and Image fallback also failed: " + getErrorMessage(e));
        }
    }
};

export const analyzeVideo = async (videoBase64OrUrl: string, prompt: string, model: string): Promise<string> => {
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
};

export const editImageWithText = async (imageBase64: string, prompt: string, model: string): Promise<string> => {
     const imgs = await generateImageFromText(prompt, model, [imageBase64], { count: 1 });
     return imgs[0];
};

export const planStoryboard = async (prompt: string, context: string): Promise<string[]> => {
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
};

export const generateScriptPlanner = async (
    prompt: string, 
    config: { theme?: string, genre?: string, setting?: string, episodes?: number, duration?: number, visualStyle?: string }
): Promise<string> => {
    const ai = getClient();
    const fullPrompt = `
    核心创意: ${prompt}
    主题: ${config.theme || 'N/A'}
    类型: ${config.genre || 'N/A'}
    背景: ${config.setting || 'N/A'}
    预估集数: ${config.episodes || 10}
    单集时长: ${config.duration || 1} 分钟
    视觉风格: ${config.visualStyle || 'N/A'}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: { systemInstruction: SCRIPT_PLANNER_INSTRUCTION },
        contents: { parts: [{ text: fullPrompt }] }
    });
    
    return response.text || "";
};

export const generateScriptEpisodes = async (
    outline: string,
    chapter: string,
    splitCount: number,
    duration: number,
    style?: string
): Promise<{ title: string, content: string, characters: string }[]> => {
    const ai = getClient();
    const prompt = `
    Input Outline: ${outline}
    Target Chapter: ${chapter}
    Split into ${splitCount} episodes.
    Target Duration per episode: ${duration} minutes.
    Visual Style: ${style || 'N/A'}
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
};

export const generateCinematicStoryboard = async (
    episodeScript: string,
    shotCount: number,
    shotDuration: number,
    style: string
): Promise<StoryboardShot[]> => {
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
};

export const orchestrateVideoPrompt = async (images: string[], userPrompt: string): Promise<string> => {
     const ai = getClient();
     const parts: Part[] = images.map(img => ({ inlineData: { data: img.replace(/^data:.*;base64,/, ""), mimeType: "image/png" } }));
     parts.push({ text: `Create a single video prompt that transitions between these images. User Intent: ${userPrompt}` });
     
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: { systemInstruction: VIDEO_ORCHESTRATOR_INSTRUCTION },
        contents: { parts }
     });
     
     return response.text || userPrompt;
};

export const compileMultiFramePrompt = (frames: any[]) => {
    return "A sequence showing: " + frames.map(f => f.transition?.prompt || "scene").join(" transitioning to ");
};

export const generateAudio = async (
    prompt: string, 
    referenceAudio?: string, 
    options?: { persona?: any, emotion?: any }
): Promise<string> => {
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
};

export const transcribeAudio = async (audioBase64: string): Promise<string> => {
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

export const extractCharactersFromText = async (text: string): Promise<string[]> => {
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
};

export const generateCharacterProfile = async (
    name: string, 
    context: string, 
    styleContext?: string,
    customDesc?: string
): Promise<CharacterProfile> => {
    const ai = getClient();
    const prompt = `
    Role Name: ${name}
    Script Context: ${context}
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
};

export const analyzeDrama = async (title: string): Promise<DramaAnalysis> => {
    const ai = getClient();
    const prompt = `
    Analyze the drama/movie "${title}".
    Provide a JSON output with the following keys:
    - worldview (string): Brief description of the world/setting.
    - logic (string): Comment on plot logic and consistency.
    - scalability (string): Potential for sequels or universe expansion.
    - characterTags (string): Key character archetypes/tags.
    - arc (string): Summary of the main character's arc.
    - resonance (string): Why it resonates with the audience.
    - artStyle (string): Visual style description.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: { responseMimeType: 'application/json' },
        contents: { parts: [{ text: prompt }] }
    });
    try {
        return JSON.parse(response.text || "{}");
    } catch {
        return {};
    }
};
