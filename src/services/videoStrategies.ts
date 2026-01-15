
import { AppNode, VideoGenerationMode } from '../types';
import { extractLastFrame, urlToBase64, analyzeVideo, orchestrateVideoPrompt, generateImageFromText } from './geminiService';
import { getUserDefaultModel } from '../../services/modelConfig';

export interface StrategyResult {
    finalPrompt: string;
    videoInput: any;
    inputImageForGeneration: string | null;
    referenceImages: string[] | undefined;
    lastFrameImage: string | null; // NEW: Explicit end frame support
    generationMode: VideoGenerationMode;
}

// --- Module: Default (Basic Image-to-Video / Text-to-Video) ---
export const processDefaultVideoGen = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    let inputImageForGeneration: string | null = null;

    const imageInput = inputs.find(n => n.data.image || n.data.croppedFrame);
    
    if (imageInput) {
        inputImageForGeneration = imageInput.data.croppedFrame || imageInput.data.image || null;
    }

    return {
        finalPrompt: prompt,
        videoInput: null,
        inputImageForGeneration,
        referenceImages: undefined,
        lastFrameImage: null,
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

    const videoNode = inputs.find(n => n.data.videoUri || n.data.videoMetadata);
    
    if (videoNode && videoNode.data.videoUri) {
         try {
             let videoSrc = videoNode.data.videoUri;
             if (videoSrc.startsWith('http')) {
                 videoSrc = await urlToBase64(videoSrc); 
             }
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
        videoInput: null,
        inputImageForGeneration: inputImages.length > 0 ? inputImages[0] : null,
        referenceImages: undefined,
        lastFrameImage: null,
        generationMode: 'CONTINUE'
    };
};

// --- Module: FrameWeaver (收尾插帧) ---
export const processFrameWeaver = async (
    node: AppNode, 
    inputs: AppNode[], 
    prompt: string
): Promise<StrategyResult> => {
    // Collect all available images from inputs
    // We expect inputs to be ordered: Start Node -> End Node
    // If not ordered, we assume the first two inputs are Start and End
    const inputImages: string[] = [];
    
    inputs.forEach(n => {
        if (n.data.croppedFrame) inputImages.push(n.data.croppedFrame);
        else if (n.data.image) inputImages.push(n.data.image);
    });

    let finalPrompt = prompt;
    let startImage = null;
    let endImage = null;

    if (inputImages.length > 0) {
        startImage = inputImages[0];
        if (inputImages.length > 1) {
            endImage = inputImages[inputImages.length - 1]; // Use the last one as the End Frame
        }
    }

    // If explicit prompt is empty, try to orchestrate one (optional)
    if (!finalPrompt.trim() && startImage && endImage) {
         try { 
            finalPrompt = await orchestrateVideoPrompt(inputImages, "Transition smoothly between these two frames."); 
        } catch (e) {
            finalPrompt = "Smooth transition between start and end frame.";
        }
    }

    return {
        finalPrompt,
        videoInput: null,
        inputImageForGeneration: startImage, // The Start Frame
        lastFrameImage: endImage,            // The End Frame
        referenceImages: undefined,
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

    const videoInputNode = inputs.find(n => n.data.videoUri);
    if (videoInputNode && videoInputNode.data.videoUri) {
        try {
            let vidData = videoInputNode.data.videoUri;
            if (vidData.startsWith('http')) vidData = await urlToBase64(vidData);
            upstreamContextStyle = await analyzeVideo(vidData, "Analyze the visual style, lighting, composition, and color grading briefly.", getUserDefaultModel('text'));
        } catch (e) { /* Ignore analysis failure */ }
    }

    if (node.data.croppedFrame) {
        inputImageForGeneration = node.data.croppedFrame;
    } else {
        const cropSource = inputs.find(n => n.data.croppedFrame);
        if (cropSource) {
            inputImageForGeneration = cropSource.data.croppedFrame!;
        } else {
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

    if (inputImageForGeneration) {
        try {
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
                inputImageForGeneration = restoredImages[0];
            }
        } catch (reframeErr) {
            console.warn("SceneDirector: Restoration failed, using original crop", reframeErr);
        }
    }

    return {
        finalPrompt,
        videoInput: null,
        inputImageForGeneration,
        referenceImages: undefined,
        lastFrameImage: null,
        generationMode: 'CUT'
    };
};

// --- Module: CharacterRef (角色迁移) ---
export const processCharacterRef = async (
    node: AppNode,
    inputs: AppNode[],
    prompt: string
): Promise<StrategyResult> => {
    const videoSource = inputs.find(n => n.data.videoUri);
    const imageSource = inputs.find(n => n.data.image);
    
    const characterImage = imageSource?.data.image || inputs.find(n => n.data.image)?.data.image || null;

    let motionDescription = "";

    if (videoSource?.data.videoUri) {
        try {
            let vidData = videoSource.data.videoUri;
            if (vidData.startsWith('http')) vidData = await urlToBase64(vidData);
            
            motionDescription = await analyzeVideo(
                vidData, 
                "Describe ONLY the physical actions, camera movement, and background environment of this video. Do not describe the person's identity. Example: 'A figure is waving their hand while walking forward in a studio.'", 
                "gemini-2.5-flash"
            );
        } catch (e) {
            console.warn("CharacterRef: Motion analysis failed", e);
            motionDescription = "performing dynamic action";
        }
    }

    let finalPrompt = "";
    if (motionDescription) {
        finalPrompt = `Character Action Reference: ${motionDescription}. \nUser Instruction: ${prompt || "Cinematic video"}`;
    } else {
        finalPrompt = prompt;
    }

    return {
        finalPrompt,
        videoInput: null,
        inputImageForGeneration: characterImage,
        referenceImages: undefined,
        lastFrameImage: null,
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
