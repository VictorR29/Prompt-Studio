
import { Type } from "@google/genai";
import { defaultModelConfig, getAiClient, trackApiRequest } from "./config";
import { ExtractionMode } from "../../types";
import { JSON_OPTIMIZATION_SYSTEM_PROMPT } from "./prompts/definitions";

/**
 * Recursively removes keys with empty values (null, undefined, "", [], {}) from an object.
 */
const cleanEmptyKeys = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj
            .map(v => cleanEmptyKeys(v))
            .filter(v => v !== null && v !== undefined && v !== "" && (typeof v !== 'object' || Object.keys(v).length > 0));
    } else if (typeof obj === 'object' && obj !== null) {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            const value = cleanEmptyKeys(obj[key]);
            // Check if value is valid
            const isValid = value !== null && 
                            value !== undefined && 
                            value !== "" && 
                            (!Array.isArray(value) || value.length > 0) &&
                            (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0);
            
            if (isValid) {
                newObj[key] = value;
            }
        });
        return newObj;
    }
    return obj;
};

export const assembleOptimizedJson = async (modules: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    
    // Filter input modules to only send non-empty strings to the model
    const activeModules = Object.entries(modules).reduce((acc, [key, value]) => {
        if (value && typeof value === 'string' && value.trim().length > 0) {
            acc[key] = value;
        }
        return acc;
    }, {} as any);

    const jsonModules = JSON.stringify(activeModules);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { role: "user", parts: [{ text: `INPUT DATA (FRAGMENTS): ${jsonModules}` }] },
        config: {
            systemInstruction: JSON_OPTIMIZATION_SYSTEM_PROMPT,
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json"
        }
    });

    try {
        const rawJson = JSON.parse(response.text || "{}");
        const cleanJson = cleanEmptyKeys(rawJson);
        return JSON.stringify(cleanJson, null, 2);
    } catch (e) {
        console.error("Error cleaning JSON", e);
        return response.text || "{}";
    }
};

export const createJsonTemplate = async (json: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts: [{ text: json }] },
        config: {
            systemInstruction: "You are an AI prompt engineer creating reusable prompt templates. Given a JSON prompt, generalize it into a template by: 1. Keeping structural keys intact. 2. Replacing specific descriptions with placeholder descriptions (e.g. 'a red sports car' -> '[subject description]'). 3. Preserving all style, composition, and formatting rules. Return JSON with the same structure but generalized values.",
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json"
        }
    });
    
    try {
        const rawJson = JSON.parse(response.text || "{}");
        const cleanJson = cleanEmptyKeys(rawJson);
        return JSON.stringify(cleanJson, null, 2);
    } catch (e) {
        return response.text || "{}";
    }
};

export const mergeModulesIntoJsonTemplate = async (fragments: Partial<Record<ExtractionMode, string>>, template: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts: [{ text: `Fragments: ${JSON.stringify(fragments)}\nTemplate: ${template}` }] },
        config: {
            systemInstruction: "Merge the provided fragments into the JSON template. Return the filled JSON string. Ensure no data from fragments is lost.",
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json"
        }
    });
    
    try {
        const rawJson = JSON.parse(response.text || "{}");
        const cleanJson = cleanEmptyKeys(rawJson);
        return JSON.stringify(cleanJson, null, 2);
    } catch (e) {
        return response.text || "{}";
    }
};

export const generateStructuredPromptFromImage = async (images: { imageBase64: string, mimeType: string }[]): Promise<any> => {
    trackApiRequest();
    const ai = getAiClient();
     const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            role: "user",
            parts: [
                ...images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })),
            ]
        },
        config: {
            systemInstruction: "You are an AI visual analyst. Analyze the provided image(s) and generate a structured JSON prompt describing all visible elements. Include: subject (main entity), style (artistic style), scene (background/environment), color palette (dominant colors), and composition (layout/angle). Be specific and detailed in each field. Return a valid JSON object.",
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json"
        }
    });
    try {
        const rawJson = JSON.parse(response.text || "{}");
        return cleanEmptyKeys(rawJson);
    } catch (e) {
        return {};
    }
};

export const generateAndModularizePrompt = async (input: { idea: string, style: string, images?: { imageBase64: string, mimeType: string }[] }): Promise<Record<string, string>> => {
    trackApiRequest();
    const ai = getAiClient();
    const parts: any[] = [{ text: `Idea: "${input.idea}"\nStyle: "${input.style}"` }];
    if (input.images) {
        parts.unshift(...input.images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })));
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts },
        config: {
            systemInstruction: "You are an AI prompt engineer. Generate a detailed image generation prompt based on the user's idea and style, then break it into modular components: subject, style, scene, color, composition, lighting, pose, expression, outfit, and objects. Return a JSON object with each component as a key.",
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    style: { type: Type.STRING },
                    pose: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    outfit: { type: Type.STRING },
                    object: { type: Type.STRING },
                    scene: { type: Type.STRING },
                    composition: { type: Type.STRING },
                    color: { type: Type.STRING },
                    negative: { type: Type.STRING }
                }
            }
        }
    });
    
    try {
        const rawJson = JSON.parse(response.text || "{}");
        return cleanEmptyKeys(rawJson);
    } catch (e) {
        return {};
    }
};

export const modularizeImageAnalysis = async (images: { imageBase64: string, mimeType: string }[]): Promise<Record<string, string>> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            role: "user",
            parts: [
                ...images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })),
            ]
        },
        config: {
            systemInstruction: "You are an AI visual analyst. Analyze the provided image(s) and break down the visual elements into prompt components. Extract: the main subject, artistic style, scene/environment, color palette, and composition. Be detailed and specific for each component. Return a valid JSON object with exactly these keys: subject, style, scene, color, composition.",
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    style: { type: Type.STRING },
                    scene: { type: Type.STRING },
                    color: { type: Type.STRING },
                    composition: { type: Type.STRING }
                }
            }
        }
    });
    try {
        const rawJson = JSON.parse(response.text || "{}");
        return cleanEmptyKeys(rawJson);
    } catch (e) {
        return {};
    }
};
