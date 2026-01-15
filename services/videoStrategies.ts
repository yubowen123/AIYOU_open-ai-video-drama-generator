
import { AppNode, VideoGenerationMode } from '../types';
import { extractLastFrame, urlToBase64, analyzeVideo, orchestrateVideoPrompt, generateImageFromText } from './geminiService';
import { getUserDefaultModel } from './modelConfig';

export interface StrategyResult {
    finalPrompt: string;
    videoInput: any;
    inputImageForGeneration: string | null;
    referenceImages: string[] | undefined;
    generationMode: VideoGenerationMode;
}

// --- Module: Default (Basic Image-to-Video / Text-to-Video) ---
export const processDefaultVideoGen = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    // In Default mode, we strictly look for an Image input to do standard I2V.
    // We ignore video metadata (continuations), reference arrays, etc.
    
    let inputImageForGeneration: string | null = null;

    // Prioritize direct image inputs or cropped frames
    const imageInput = inputs.find(n => n.data.image || n.data.croppedFrame);
    
    if (imageInput) {
        inputImageForGeneration = imageInput.data.croppedFrame || imageInput.data.image || null;
    }

    // Note: In DEFAULT mode, we deliberately DO NOT extract frames from video inputs
    // or pass video metadata. It treats the node as a fresh generator.

    return {
        finalPrompt: prompt,
        videoInput: null,
        inputImageForGeneration,
        referenceImages: undefined,
        generationMode: 'DEFAULT'
    };
};

// --- Module: StoryContinuator (剧情延展) ---
export const processStoryContinuator = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    let inputImages: string[] = [];

    // 1. Check for Upstream Video (for Metadata)
    // CRITICAL FIX: For Story Continuation, we strictly want "Image-to-Video" behavior
    // where the image is the LAST FRAME of the previous video.
    // We do NOT want to pass the raw video bytes as `videoInput` because that triggers
    // Veo's "Video Editing" or "Masking" mode, which is not what we want for linear story extension.
    
    const videoNode = inputs.find(n => n.data.videoUri || n.data.videoMetadata);
    
    if (videoNode && videoNode.data.videoUri) {
         try {
             let videoSrc = videoNode.data.videoUri;
             // Ensure we have a base64 source for frame extraction (canvas needs it, or cross-origin blob)
             if (videoSrc.startsWith('http')) {
                 videoSrc = await urlToBase64(videoSrc); 
             }
             // Extract the very last frame
             const lastFrame = await extractLastFrame(videoSrc);
             if (lastFrame) {
                 inputImages = [lastFrame];
             }
         } catch (e) {
             console.warn("StoryContinuator: Frame extraction failed", e);
         }
    }

    return {
        finalPrompt: prompt,
        videoInput: null, // FORCE NULL to ensure Image-to-Video mode
        inputImageForGeneration: inputImages.length > 0 ? inputImages[0] : null,
        referenceImages: undefined,
        generationMode: 'CONTINUE'
    };
};

// --- Module: FrameWeaver (收尾插帧) ---
export const processFrameWeaver = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    const inputImages: string[] = [];
    inputs.forEach(n => {
        if (n.data.croppedFrame) inputImages.push(n.data.croppedFrame);
        else if (n.data.image) inputImages.push(n.data.image);
    });

    let finalPrompt = prompt;

    if (inputImages.length >= 2) {
        try { 
            finalPrompt = await orchestrateVideoPrompt(inputImages, prompt); 
        } catch (e) {
            console.warn("FrameWeaver: Orchestration failed, using raw prompt", e);
        }
    }

    return {
        finalPrompt,
        videoInput: null,
        inputImageForGeneration: inputImages[0], 
        referenceImages: inputImages, 
        generationMode: 'FIRST_LAST_FRAME'
    };
};

// --- Module: SceneDirector (局部分镜) ---
export const processSceneDirector = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    let inputImageForGeneration: string | null = null;
    let upstreamContextStyle = "";

    // 1. Get Style Context from Upstream Video (if any)
    const videoInputNode = inputs.find(n => n.data.videoUri);
    if (videoInputNode && videoInputNode.data.videoUri) {
        try {
            let vidData = videoInputNode.data.videoUri;
            if (vidData.startsWith('http')) vidData = await urlToBase64(vidData);
            upstreamContextStyle = await analyzeVideo(vidData, "Analyze the visual style, lighting, composition, and color grading briefly.", getUserDefaultModel('text'));
        } catch (e) { /* Ignore analysis failure */ }
    }

    // 2. Identify the Low-Res/Cropped Input Source
    if (node.data.croppedFrame) {
        inputImageForGeneration = node.data.croppedFrame;
    } else {
        const cropSource = inputs.find(n => n.data.croppedFrame);
        if (cropSource) {
            inputImageForGeneration = cropSource.data.croppedFrame!;
        } else {
             // Fallback to normal image if no crop found
             const imgSource = inputs.find(n => n.data.image);
             if (imgSource) inputImageForGeneration = imgSource.data.image!;
             
             if (!inputImageForGeneration && videoInputNode) {
                  try {
                       inputImageForGeneration = await extractLastFrame(videoInputNode.data.videoUri!);
                  } catch (e) {}
             }
        }
    }

    let finalPrompt = `${prompt}. \n\nVisual Style Reference: ${upstreamContextStyle}`;

    // 3. CRITICAL STEP: High-Fidelity Restoration & Upscaling
    // We must turn the blurry crop into a sharp image WITHOUT changing the composition.
    if (inputImageForGeneration) {
        try {
            // Strict Instruction: Preserve Composition & Prevent Hallucination
            const restorationPrompt = `
            CRITICAL IMAGE RESTORATION TASK:
            1. Input is a low-resolution crop. Your goal is to UPSCALE and RESTORE it to 4K quality.
            2. STRICTLY PRESERVE the original composition, character pose, camera angle, and object placement.
            3. DO NOT reframe, DO NOT zoom out, DO NOT change the perspective.
            4. Fix blurriness and noise. Add skin texture and realistic details matching the description: "${prompt}".
            5. Ensure the style matches: "${upstreamContextStyle || 'Cinematic, High Fidelity'}".
            6. Output a single, high-quality image that looks exactly like the input but sharper.

            NEGATIVE CONSTRAINTS:
            - DO NOT add new people, characters, or subjects.
            - The number of people MUST remain exactly the same as the input.
            - DO NOT hallucinate extra limbs, faces, or background figures.

            STRUCTURAL INTEGRITY:
            - Treat the input image as the absolute ground truth for composition.
            - Only enhance existing pixels, do not invent new geometry.
            `;
            
            const restoredImages = await generateImageFromText(
                restorationPrompt,
                getUserDefaultModel('image'),
                [inputImageForGeneration],
                { aspectRatio: node.data.aspectRatio || '16:9', count: 1 }
            );
            
            if (restoredImages && restoredImages.length > 0) {
                // Use the restored, sharp image as the input for Veo
                inputImageForGeneration = restoredImages[0];
            }
        } catch (reframeErr) {
            console.warn("SceneDirector: Restoration failed, using original crop", reframeErr);
        }
    }

    return {
        finalPrompt,
        videoInput: null, // Veo uses Image-to-Video mode
        inputImageForGeneration, // This is now the RESTORED High-Res Image
        referenceImages: undefined,
        generationMode: 'CUT'
    };
};

// --- Module: CharacterRef (角色迁移) ---
export const processCharacterRef = async (
    node: AppNode,
    inputs: AppNode[],
    prompt: string
): Promise<StrategyResult> => {
    // 1. Identify Sources
    const videoSource = inputs.find(n => n.data.videoUri);
    const imageSource = inputs.find(n => n.data.image);
    
    // Fallback: If no image source, check for inputs that have image data (maybe prompts that generated images)
    const characterImage = imageSource?.data.image || inputs.find(n => n.data.image)?.data.image || null;

    let motionDescription = "";

    // 2. Analyze Video Motion (if available)
    if (videoSource?.data.videoUri) {
        try {
            let vidData = videoSource.data.videoUri;
            if (vidData.startsWith('http')) vidData = await urlToBase64(vidData);
            
            // Ask Gemini to extract purely the motion/action, ignoring the original character's identity
            motionDescription = await analyzeVideo(
                vidData,
                "Describe ONLY the physical actions, camera movement, and background environment of this video. Do not describe the person's identity. Example: 'A figure is waving their hand while walking forward in a studio.'",
                getUserDefaultModel('text')
            );
        } catch (e) {
            console.warn("CharacterRef: Motion analysis failed", e);
            motionDescription = "performing dynamic action"; // Fallback
        }
    }

    // 3. Construct Final Prompt
    // Combine User Prompt + Motion Description + Character Reference logic is implicit via image input to Veo
    let finalPrompt = "";
    
    if (motionDescription) {
        finalPrompt = `Character Action Reference: ${motionDescription}. \nUser Instruction: ${prompt || "Cinematic video"}`;
    } else {
        finalPrompt = prompt;
    }

    return {
        finalPrompt,
        videoInput: null, // We do NOT pass the video bytes to Veo for generation, we only used it for prompting
        inputImageForGeneration: characterImage, // This is the "Anchor" (The Character)
        referenceImages: undefined,
        generationMode: 'CHARACTER_REF'
    };
};

// --- Main Factory ---
export const getGenerationStrategy = async (
    node: AppNode, 
    inputs: AppNode[], 
    basePrompt: string
): Promise<StrategyResult> => {
    const mode = node.data.generationMode || 'DEFAULT';

    switch (mode) {
        case 'CHARACTER_REF':
            return processCharacterRef(node, inputs, basePrompt);
        case 'FIRST_LAST_FRAME':
            return processFrameWeaver(node, inputs, basePrompt);
        case 'CUT':
            return processSceneDirector(node, inputs, basePrompt);
        case 'CONTINUE':
            return processStoryContinuator(node, inputs, basePrompt);
        case 'DEFAULT':
        default:
            return processDefaultVideoGen(node, inputs, basePrompt);
    }
};
