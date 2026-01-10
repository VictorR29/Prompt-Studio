
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest } from "./config";
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
        contents: `${JSON_OPTIMIZATION_SYSTEM_PROMPT}\n\nINPUT DATA (FRAGMENTS): ${jsonModules}`,
        config: {
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
        contents: `Generalize this JSON prompt into a reusable template: ${json}`,
        config: { responseMimeType: "application/json" }
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
        contents: `Merge these fragments ${JSON.stringify(fragments)} into this JSON template: ${template}. Return the filled JSON string. Ensure no data from fragments is lost.`,
        config: { responseMimeType: "application/json" }
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
             parts: [
                ...images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })),
                { text: "Generate a structured JSON prompt describing this image." }
            ]
        },
        config: { responseMimeType: "application/json" }
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
    const parts: any[] = [{ text: `Generate a detailed prompt based on idea: "${input.idea}" and style: "${input.style}", then break it down into components.` }];
    if (input.images) {
        parts.unshift(...input.images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })));
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
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
            parts: [
                ...images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })),
                { text: "Analyze this image and break down the prompt components." }
            ]
        },
        config: {
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
