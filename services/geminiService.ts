import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExtractionMode, SavedPrompt, AssistantResponse, PlaygroundOperation } from '../types';

const getAiClient = () => {
    const apiKey = localStorage.getItem('userGeminiKey') || process.env.API_KEY || '';
    if (!apiKey) {
        // Fallback for development/demo purposes if no key is set, though requests will fail.
        // In a real app, we should probably throw, but let's allow the UI to handle auth errors.
        console.warn("API Key not set");
    }
    return new GoogleGenAI({ apiKey });
};

// --- Analysis System Instructions ---
const analysisSystemInstructions: Record<ExtractionMode, string> = {
    style: `Analyze the visual style. Generate a prompt focusing ONLY on technique, atmosphere, and composition. Ignore specific subjects. Output raw prompt text only.`,
    subject: `Analyze the main subject(s). 
    CRITICAL: 
    1. If there is ONE subject, describe physical identity and individual visual style. 
    2. If there are MULTIPLE DISTINCT SUBJECTS, describe them SEPARATELY (e.g., "Subject 1: [details]... Subject 2: [details]...").
    3. Do NOT merge distinct characters into a single description.
    Output raw prompt text only.`,
    pose: `Analyze body pose. Describe strictly the geometry of limbs, head, and torso (e.g., "sitting cross-legged", "arms akimbo"). DO NOT describe clothing, gender, or physical appearance. Output raw prompt text only.`,
    expression: `Analyze facial expression. Describe emotion, muscle state (eyes, mouth), and mood. DO NOT describe hair, makeup (unless emotional), or racial features. Output raw prompt text only.`,
    scene: `Analyze environment and setting. Describe the background, location, lighting, and weather. DO NOT describe the subject in the foreground. Output raw prompt text only.`,
    outfit: `Analyze ONLY the clothing, footwear, and accessories.
    CRITICAL RESTRICTIONS:
    1. IGNORE ALL PHYSICAL TRAITS: Do NOT describe hair (color/style), eyes, skin tone, makeup, or body type.
    2. Focus strictly on the garments themselves: materials, cuts, textures, and their specific colors.
    3. List items directly (e.g., "Silk bomber jacket, ripped jeans"). Do not say "He is wearing...".
    Output raw prompt text only.`,
    composition: `Analyze composition, framing, and camera work. Describe camera angle, shot size, depth of field, perspective. DO NOT describe the subject's appearance (use "the subject" or "the figure" only to indicate position). Output raw prompt text only.`,
    color: `Analyze the color palette. Extract the dominant colors and map them to GENERIC structural zones.
    CRITICAL RULES:
    1. DO NOT describe specific garments or objects found in the image (e.g., do NOT say "red skirt", "blue armor").
    2. Map colors to ABSTRACT zones: "Primary Outfit Color", "Secondary Accent", "Hair Color", "Background Tone", "Lighting Tint".
    3. Example Output: "Crimson Red [Primary Outfit], Gold [Accents], Deep Blue [Atmosphere]".
    4. Goal: Apply these colors to whatever the subject is wearing defined in other modules, without changing the item itself. Output raw prompt text only.`,
    object: `Analyze the most prominent object/prop. Describe details, texture, and form of the item itself. DO NOT describe the person holding it. Output raw prompt text only.`,
    negative: `Identify negative space and unwanted elements (blur, distortion, etc.) to exclude. Output raw prompt text only.`
};

export const analyzeImageFeature = async (mode: ExtractionMode, images: {imageBase64: string, mimeType: string}[]) => {
    const ai = getAiClient();
    const parts: any[] = images.map(img => ({
        inlineData: {
            mimeType: img.mimeType,
            data: img.imageBase64
        }
    }));
    
    const prompt = analysisSystemInstructions[mode] || "Describe the image.";
    parts.push({ text: prompt });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                systemInstruction: "You are an expert prompt engineer specializing in stable diffusion prompts.",
                temperature: 0.4
            }
        });
        return { result: response.text || "", warning: null };
    } catch (error: any) {
        console.error("Analysis failed:", error);
        
        // Safety check fallback
        if (error.response?.promptFeedback?.blockReason || (error.response?.candidates && error.response.candidates[0]?.finishReason === 'SAFETY')) {
             throw new Error("Contenido Sensible Detectado. La IA no pudo procesar esta imagen por motivos de seguridad.");
        }
        
        // Try to return text if available despite error flags, or handle empty response
        if (error.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
             return { result: error.response.candidates[0].content.parts[0].text, warning: "Advertencia: Contenido potencialmente sensible detectado. Se ha aplicado sanitización." };
        }

        throw new Error("La API no devolvió ningún texto. Intenta con otra imagen.");
    }
};

export const generateFeatureMetadata = async (mode: ExtractionMode, prompt: string, images?: {imageBase64: string, mimeType: string}[]) => {
    const ai = getAiClient();
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            notes: { type: Type.STRING },
            artType: { type: Type.STRING }
        },
        required: ["title", "category", "notes", "artType"]
    };

    const textPrompt = `Generate metadata for this ${mode} prompt: "${prompt}". Keep title concise.`;
    const parts: any[] = [];
    if (images) {
        images.forEach(img => parts.push({
            inlineData: { mimeType: img.mimeType, data: img.imageBase64 }
        }));
    }
    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    return JSON.parse(response.text || "{}");
};

export const generateIdeasForStyle = async (stylePrompt: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Acting as a Creative Director, suggest 5 distinct SUBJECT concepts (characters, creatures, or objects) that would look amazing rendered in this specific art style: "${stylePrompt}". Do NOT suggest changes to the style itself.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });
    return JSON.parse(response.text || "[]");
};

export const modularizePrompt = async (promptText: string) => {
    const ai = getAiClient();
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            subject: { type: Type.STRING },
            pose: { type: Type.STRING },
            expression: { type: Type.STRING },
            outfit: { type: Type.STRING },
            object: { type: Type.STRING },
            scene: { type: Type.STRING },
            style: { type: Type.STRING },
            composition: { type: Type.STRING },
            color: { type: Type.STRING },
            negative: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Deconstruct the following image prompt into these distinct modules. If a module is not present, leave it empty. Identify negative terms (no, avoid, without) and put them in 'negative'. Prompt: "${promptText}"`,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    return JSON.parse(response.text || "{}");
};

export const assembleMasterPrompt = async (fragments: Partial<Record<ExtractionMode, string>>) => {
    const ai = getAiClient();
    
    // Separate negative prompt
    const negativePrompt = fragments.negative;
    const positiveFragments = { ...fragments };
    delete positiveFragments.negative;

    const inputs = Object.entries(positiveFragments)
        .filter(([_, v]) => v && v.trim())
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
        .join('\n');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Act as an ELITE Prompt Engineer. Assemble these parameters into a cohesive, high-quality image generation prompt.
        
        CRITICAL RULES:
        1. MULTI-SUBJECT INTEGRITY: If the 'SUBJECT' module defines multiple distinct characters (e.g. "Subject 1... Subject 2..."), you MUST include ALL of them in the final prompt. Adjust grammar to plural (e.g. "Two women standing..." instead of "A woman...").
        2. DEDUPLICATION: Merge redundant descriptions. If 'Subject' says "red dress" and 'Outfit' says "red dress", say it ONCE.
        3. LOGICAL FLOW: Subject > Action/Pose > Outfit > Environment > Lighting > Style.
        4. GRAMMAR: Use natural flow, not a list.
        5. COLOR AUTHORITY: The 'COLOR' parameter is the MASTER PALETTE. It OVERRIDES and REPLACES specific colors found in 'Outfit', 'Scene', or 'Object' if they conflict. If 'Outfit' says "red dress" but 'Color' dictates "Blue and Silver", the prompt MUST describe a "Blue and Silver dress".
        
        Input Parameters:
        ${inputs}`,
    });
    
    let finalPrompt = response.text || "";
    
    // Append negative prompt if it exists, using standard separator
    if (negativePrompt && negativePrompt.trim()) {
        finalPrompt += `\n\nNEGATIVE PROMPT: ${negativePrompt.trim()}`;
    }
    
    return finalPrompt;
};

export const optimizePromptFragment = async (mode: ExtractionMode, fragments: Partial<Record<ExtractionMode, string>>) => {
    const ai = getAiClient();
    const currentVal = fragments[mode] || "";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Optimize and expand this ${mode} description: "${currentVal}". Provide 3 distinct variations improving detail and clarity.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    });
    return JSON.parse(response.text || "[]");
};

export const createJsonTemplate = async (jsonString: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Clean and standardize this JSON for stable diffusion. Ensure it has relevant fields. JSON: ${jsonString}`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const generateStructuredPromptMetadata = async (jsonPrompt: string, image?: {imageBase64: string, mimeType: string}) => {
    return generateFeatureMetadata('style', jsonPrompt, image ? [image] : undefined);
};

export const generateMasterPromptMetadata = async (prompt: string, images?: {imageBase64: string, mimeType: string}[]) => {
     return generateFeatureMetadata('style', prompt, images);
};

export const adaptFragmentToContext = async (targetMode: ExtractionMode, fragment: string, currentContext: any) => {
    const ai = getAiClient();
    const contextStr = JSON.stringify(currentContext);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `INTEGRATE WITHOUT DESTROYING.
        Task: Insert this specific fragment: "${fragment}" into the "${targetMode}" slot of the current context.
        
        CRITICAL RULES:
        1. PRESERVE DETAILS: Do NOT summarize or simplify the fragment. Keep specific adjectives, materials, and artistic terms.
        2. GRAMMAR ONLY: You may only adjust grammatical connectors to make it fit.
        3. PRIORITY: The content of the fragment takes precedence over existing context if there is a conflict.
        
        Context: ${contextStr}
        
        Return ONLY the adapted text string.`,
    });
    return response.text || "";
};

export const generateStructuredPrompt = async (params: {idea: string, style?: string}) => {
    const ai = getAiClient();
    const prompt = `Create a detailed image prompt structure based on: Idea: "${params.idea}", Style: "${params.style || 'Any'}". Return a JSON with keys for subject, scene, style, lighting, etc.`;
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" } 
    });
    return response.text || "{}";
};

export const generateStructuredPromptFromImage = async (images: {imageBase64: string, mimeType: string}[], style?: string) => {
    const ai = getAiClient();
    const parts: any[] = images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.imageBase64 } }));
    parts.push({ text: `Analyze this image and generate a structured JSON prompt description. Style guidance: ${style || 'Match image style'}.` });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const generateImageFromPrompt = async (prompt: string) => {
    const ai = getAiClient();
    // Using gemini-2.5-flash-image for image generation as per guidelines.
    // It returns candidates with parts, one of which contains the image data.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: { aspectRatio: "1:1" } 
        }
    });

    const candidates = response.candidates;
    if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No image generated.");
};

export const generateNegativePrompt = async (positivePrompt: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a negative prompt for this positive prompt: "${positivePrompt}". List unwanted elements like blur, distortion, bad anatomy, etc. Return raw text.`,
    });
    return response.text || "";
};

export const assembleOptimizedJson = async (fragments: any) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Act as an ELITE Prompt Engineer. Assemble these prompt fragments into a clean, optimized JSON object.
        
        CRITICAL RULES:
        1. KEY ORDERING: The output JSON MUST start with 'subject' key. This is for human readability.
        2. MULTI-SUBJECT: If 'subject' contains multiple characters, preserve them distinctively.
        3. DEDUPLICATION: Remove redundant descriptors across fields.
        4. COLOR AUTHORITY: The 'color' key is the MASTER PALETTE. It OVERRIDES conflicting colors in 'outfit', 'scene', or 'object'. Update those fields to match the master palette.
        
        Fragments: ${JSON.stringify(fragments)}`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const getCreativeAssistantResponse = async (history: any[], fragments: any) => {
    const ai = getAiClient();
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            message: { type: Type.STRING },
            updates: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        module: { type: Type.STRING },
                        value: { type: Type.STRING }
                    }
                }
            },
            assembled_prompt: { type: Type.STRING }
        },
        required: ["message", "updates"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history,
        config: {
            systemInstruction: `You are a creative assistant for image prompting. 
            RULES:
            1. You can update specific prompt modules based on user requests.
            2. VAGUE REQUESTS: If user says "make it cartoon", you must EXPAND it to "vibrant cartoon style, cel shaded, bold outlines". Be an expert prompt engineer.
            3. LANGUAGE: User talks in Spanish, but 'module' keys MUST be in ENGLISH (subject, style, etc.) and 'value' content MUST be in ENGLISH.
            4. FORMATTING: Use Markdown (bold, italic) in the 'message' field to highlight changes.
            5. ASSEMBLED PROMPT: Always return the full, updated prompt text in 'assembled_prompt'.`,
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    return response.text || "{}";
};

export const generateHybridFragment = async (mode: ExtractionMode, sources: any[], feedback: string) => {
    const ai = getAiClient();
    const parts: any[] = [];
    sources.forEach(s => {
        if (s.imageBase64) {
            parts.push({ inlineData: { mimeType: s.mimeType, data: s.imageBase64 } });
        } else if (s.text) {
            parts.push({ text: `Source Text (Visual DNA): "${s.text}"` });
        }
    });
    parts.push({ text: `Act as a CONCEPT ARTIST.
    Task: Analyze these sources (images and/or text). Synthesize a NEW, RICH description for the "${mode}" module that combines their best elements.
    
    Guidelines:
    1. SYNERGY: Do not just list features. Create a new visual concept that blends the sources.
    2. RICHNESS: Be detailed and artistic (Midjourney style). Avoid short summaries.
    3. USER FEEDBACK: Prioritize this instruction: "${feedback}".
    
    Return raw text only.` });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
    });
    return response.text || "";
};

export const mergeModulesIntoJsonTemplate = async (modules: any, template: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Merge these modules: ${JSON.stringify(modules)} into this JSON template: ${template}. 
        RULES:
        1. Replace placeholders.
        2. Clean and Deduplicate content.
        3. Ensure 'subject' describes all characters if multiple are present.
        Return cleaned JSON.`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};