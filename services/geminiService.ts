import { GoogleGenAI } from "@google/genai";
import { ExtractionMode, AssistantResponse, SavedPrompt } from "../types";
import { EXTRACTION_MODE_MAP } from "../config";

const getAiClient = () => {
    const apiKey = localStorage.getItem('userGeminiKey') || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key no configurada.");
    return new GoogleGenAI({ apiKey });
};

const SAFETY_CATEGORY_MAP: Record<string, string> = {
    'HARM_CATEGORY_HARASSMENT': 'Acoso',
    'HARM_CATEGORY_HATE_SPEECH': 'Discurso de Odio',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'Contenido Sexualmente Explícito',
    'HARM_CATEGORY_DANGEROUS_CONTENT': 'Contenido Peligroso/Dañino',
    'HARM_CATEGORY_CIVIC_INTEGRITY': 'Integridad Cívica'
};

const formatSafetyError = (candidate: any): string => {
    if (!candidate.safetyRatings) return "Contenido bloqueado por seguridad.";
    
    const blockedReasons = candidate.safetyRatings
        .filter((r: any) => r.probability === 'HIGH' || r.probability === 'MEDIUM')
        .map((r: any) => {
            const cat = SAFETY_CATEGORY_MAP[r.category] || r.category;
            return cat;
        });

    if (blockedReasons.length > 0) {
        return `Contenido bloqueado por: ${blockedReasons.join(', ')}`;
    }
    return "Contenido bloqueado por filtros de seguridad.";
};

const MODEL_FLASH = 'gemini-2.5-flash';
const MODEL_FLASH_IMAGE = 'gemini-2.5-flash-image';

export const analyzeImageFeature = async (mode: ExtractionMode, images: {imageBase64: string, mimeType: string}[]): Promise<{result: string, warning?: string}> => {
    const ai = getAiClient();
    const config = EXTRACTION_MODE_MAP[mode];
    
    // Strict instruction for English output
    const prompt = `Analyze the provided image(s) and extract ONLY the '${config.label}' (${config.description}).
    
    CRITICAL INSTRUCTION: The output MUST be in ENGLISH. If the visual concepts are culturally specific, describe them in English.
    Provide a detailed, descriptive prompt fragment for this specific feature.
    Do not include introductory text like "Here is the description". Just the prompt fragment.`;

    const parts: any[] = images.map(img => ({
        inlineData: { mimeType: img.mimeType, data: img.imageBase64 }
    }));
    parts.push({ text: prompt });

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH_IMAGE,
            contents: { parts },
        });

        const text = response.text;
        if (!text) throw new Error("No se generó descripción.");
        return { result: text.trim() };
    } catch (e: any) {
         if (e.response?.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error(formatSafetyError(e.response.candidates[0]));
        }
        throw e;
    }
};

export const generateFeatureMetadata = async (mode: ExtractionMode, promptText: string, imagePayload?: {imageBase64: string, mimeType: string}[]): Promise<any> => {
     const ai = getAiClient();
     
     // English for metadata fields, Spanish for Notes (User Facing)
     const systemInstruction = `You are a Metadata Generator for an AI Art Prompt Gallery.
     Analyze the given prompt (and image if provided).
     Generate:
     1. A short, catchy Title (in ENGLISH).
     2. A Category (one word, ENGLISH).
     3. Notes (in SPANISH) explaining the visual elements or technique used for the user.
     4. Art Type (e.g., Photography, 3D Render, Illustration) (in ENGLISH).
     
     Output JSON only.`;

     const parts: any[] = [];
     if(imagePayload) {
         imagePayload.forEach(img => parts.push({ inlineData: { mimeType: img.mimeType, data: img.imageBase64 } }));
     }
     parts.push({ text: `Prompt: ${promptText}\n\nGenerate metadata.` });

     const response = await ai.models.generateContent({
         model: imagePayload ? MODEL_FLASH_IMAGE : MODEL_FLASH,
         contents: { parts },
         config: {
             responseMimeType: "application/json",
             systemInstruction
         }
     });
     
     return JSON.parse(response.text || '{}');
};

export const generateIdeasForStyle = async (stylePrompt: string): Promise<string[]> => {
    const ai = getAiClient();
    const prompt = `Based on this artistic style: "${stylePrompt}", suggest 5 distinct subjects or scenes that would look amazing in this style.
    Output a JSON array of strings.
    ALL SUGGESTIONS MUST BE IN ENGLISH.`;
    
    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || '[]');
};

export const modularizePrompt = async (fullPrompt: string): Promise<Record<string, string>> => {
    const ai = getAiClient();
    const prompt = `Analyze this image generation prompt and break it down into the following modules:
    - subject
    - pose
    - expression
    - outfit
    - scene
    - style
    - composition
    - color
    - object
    - negative (if any negative prompt is found)

    Input Prompt: "${fullPrompt}"

    CRITICAL INSTRUCTIONS: 
    1. Distribute the concepts into the most appropriate modules.
    2. ALL MODULE CONTENT MUST BE TRANSLATED TO ENGLISH if the input is in another language.
    3. Return a JSON object with keys corresponding to the modules. Empty strings for missing modules.`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || '{}');
};

export const assembleMasterPrompt = async (fragments: Record<string, string>): Promise<string> => {
    const ai = getAiClient();
    const activeFragments = Object.entries(fragments)
        .filter(([_, val]) => val && val.trim())
        .map(([key, val]) => `${key.toUpperCase()}: ${val}`)
        .join('\n');

    const prompt = `You are an expert Prompt Engineer. Assemble these parameters into a single, cohesive, high-quality image generation prompt (Midjourney/Stable Diffusion style).
    
    Modules:
    ${activeFragments}

    Instructions:
    1. Combine them into a fluid paragraph or comma-separated structure (whichever fits best).
    2. Enhance grammar and flow.
    3. Remove redundancy.
    4. OUTPUT MUST BE PURELY IN ENGLISH.
    5. Do not include module labels in the final output.`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
    });
    return response.text?.trim() || "";
};

export const optimizePromptFragment = async (mode: string, context: Record<string, string>): Promise<string[]> => {
     const ai = getAiClient();
     const target = context[mode];
     // Context without the target
     const otherContext = Object.entries(context)
        .filter(([k, v]) => k !== mode && v && v.trim())
        .map(([k, v]) => `${k}: ${v}`).join(', ');

     const prompt = `Optimize the '${mode}' module for an AI prompt.
     Current value: "${target}"
     Context of other modules: [${otherContext}]
     
     Task: Generate 3 variations/improvements of the '${mode}' that fit well with the context.
     - Variation 1: Enhanced detail.
     - Variation 2: More creative/artistic.
     - Variation 3: Concise and punchy.
     
     CRITICAL: OUTPUT MUST BE IN ENGLISH.
     Output a JSON array of strings.`;

     const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(response.text || '[]');
};

export const generateStructuredPrompt = async (input: {idea: string, style?: string}): Promise<string> => {
     const ai = getAiClient();
     const prompt = `Create a detailed, high-quality image generation prompt based on this idea: "${input.idea}"
     ${input.style ? `Style to apply: "${input.style}"` : ''}
     
     CRITICAL: THE PROMPT MUST BE IN ENGLISH. Translate input if necessary.
     Return only the prompt text.`;

     const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
    });
    return response.text?.trim() || "";
};

export const generateStructuredPromptFromImage = async (images: any[], instruction: string): Promise<string> => {
    const ai = getAiClient();
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.imageBase64 } }));
    parts.push({ text: `Analyze these images. ${instruction ? `Additional instruction: ${instruction}` : ''}
    Create a comprehensive image generation prompt that captures the essence of these inputs.
    CRITICAL: THE PROMPT MUST BE IN ENGLISH.` });

    const response = await ai.models.generateContent({
        model: MODEL_FLASH_IMAGE,
        contents: { parts },
    });
    return response.text?.trim() || "";
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
             const base64 = part.inlineData.data;
             return `data:image/png;base64,${base64}`;
        }
    }
    throw new Error("No image generated.");
};

export const getCreativeAssistantResponse = async (history: any[], currentFragments: Record<string, string>): Promise<AssistantResponse> => {
    const ai = getAiClient();
    
    const systemInstruction = `You are an expert AI Art Prompt Engineer assistant.
    The user will ask for changes to their prompt modules.
    
    Current Modules State: ${JSON.stringify(currentFragments)}
    
    Your goal:
    1. Understand the user's intent (even if they speak Spanish).
    2. Determine which modules need to be updated (subject, style, lighting, etc.).
    3. Generate the new values for those modules.
    
    CRITICAL RULES:
    - User communicates in SPANISH. You MUST reply in SPANISH (for the 'message' field).
    - HOWEVER, the content of the prompt updates (the values in 'updates') MUST BE IN ENGLISH.
    - Example: If the user asks "hazlo más oscuro", the 'color' or 'scene' module update should be "Dark, moody lighting, low key" (English), while your message says "He oscurecido la iluminación" (Spanish).
    - Always output JSON with:
      - 'message': Your reply to the user (Spanish).
      - 'updates': Array of { module: string, value: string } (English values).
      - 'assembled_prompt': The full new prompt assembled (English).`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: history,
        config: { 
            systemInstruction,
            responseMimeType: "application/json" 
        }
    });

    const text = response.text || '{}';
    // Helper to extract JSON if the model wraps it in markdown blocks
    const cleanedText = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    const jsonString = (firstBrace !== -1 && lastBrace !== -1) 
        ? cleanedText.substring(firstBrace, lastBrace + 1) 
        : cleanedText;

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // Fallback in case of severe malformed JSON, though responseMimeType helps
        console.error("Failed to parse assistant response:", text);
        return {
            message: "Lo siento, hubo un error al procesar tu solicitud. Inténtalo de nuevo.",
            updates: []
        };
    }
};

export const generateNegativePrompt = async (positivePrompt: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Based on this positive prompt: "${positivePrompt}", generate a comprehensive Negative Prompt.
    Include common quality fixers (e.g., blurred, low quality, watermark) and specific things to avoid based on the subject.
    CRITICAL: OUTPUT MUST BE IN ENGLISH.
    Return only the negative prompt text.`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt
    });
    return response.text?.trim() || "";
};

export const generateMasterPromptMetadata = generateFeatureMetadata; 
export const generateStructuredPromptMetadata = generateFeatureMetadata;

export const createJsonTemplate = async (jsonString: string): Promise<string> => {
     return jsonString; 
};

export const mergeModulesIntoJsonTemplate = async (modules: Record<string, string>, template: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Merge these modules into the provided JSON template.
    Modules: ${JSON.stringify(modules)}
    Template: ${template}
    
    Instructions:
    - Map module content to appropriate fields in the JSON.
    - Keep the structure of the JSON.
    - Ensure all inserted values are in ENGLISH.
    - Return valid JSON string.`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const adaptFragmentToContext = async (targetMode: string, fragment: string, context: Record<string, string>): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Adapt this '${targetMode}' fragment: "${fragment}" to fit seamlessly with the current prompt context.
    Context: ${JSON.stringify(context)}
    
    CRITICAL: OUTPUT MUST BE IN ENGLISH.
    Return only the adapted text for the '${targetMode}' module.`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt
    });
    return response.text?.trim() || "";
};

export const assembleOptimizedJson = async (modules: Record<string, string>): Promise<string> => {
     const ai = getAiClient();
     const prompt = `Create a structured JSON prompt from these modules.
     Modules: ${JSON.stringify(modules)}
     
     Output a detailed JSON object suitable for ComfyUI or advanced API usage.
     CRITICAL: ALL VALUES MUST BE IN ENGLISH.`;

     const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const generateHybridFragment = async (targetMode: string, inputs: any[], feedback: string): Promise<string> => {
    const ai = getAiClient();
    const parts: any[] = [];
    inputs.forEach(input => {
        if(input.imageBase64) {
            parts.push({ inlineData: { mimeType: input.mimeType, data: input.imageBase64 } });
        } else if (input.text) {
             parts.push({ text: `Reference Text: ${input.text}` });
        }
    });
    
    const prompt = `Analyze the provided references (images and/or text).
    Synthesize a new, unique '${targetMode}' description that combines the best elements of all references.
    ${feedback ? `User Instructions (may be in Spanish, but ignored for output language): "${feedback}"` : ''}
    
    CRITICAL: THE RESULT MUST BE IN ENGLISH.
    Return only the new description text.`;
    
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: MODEL_FLASH_IMAGE,
        contents: { parts },
    });
    return response.text?.trim() || "";
};