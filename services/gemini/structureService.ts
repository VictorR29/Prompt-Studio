
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest } from "./config";
import { ExtractionMode } from "../../types";
import { JSON_OPTIMIZATION_SYSTEM_PROMPT } from "./prompts/definitions";

export const assembleOptimizedJson = async (modules: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const jsonModules = JSON.stringify(modules);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${JSON_OPTIMIZATION_SYSTEM_PROMPT}\n\nINPUT DATA: ${jsonModules}`,
        config: {
            responseMimeType: "application/json"
        }
    });

    return response.text || "{}";
};

export const createJsonTemplate = async (json: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generalize this JSON prompt into a reusable template: ${json}`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const mergeModulesIntoJsonTemplate = async (fragments: Partial<Record<ExtractionMode, string>>, template: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Merge these fragments ${JSON.stringify(fragments)} into this JSON template: ${template}. Return the filled JSON string.`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
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
    return JSON.parse(response.text || "{}");
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
    return JSON.parse(response.text || "{}");
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
                    // Simplified for analysis
                    color: { type: Type.STRING },
                    composition: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
};
