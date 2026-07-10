
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest, defaultModelConfig, trackApiCall } from "./config";

export const generateFeatureMetadata = async (mode: string, prompt: string, images?: { imageBase64: string, mimeType: string }[]) => {
    trackApiRequest();
    const ai = getAiClient();
    const parts: any[] = [{ text: `Generate metadata for this ${mode} prompt: "${prompt}".` }];
    if (images) {
        parts.unshift(...images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })));
    }

    const _start = performance.now();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts },
        config: {
            systemInstruction: `You are an AI assistant generating metadata for image generation prompt fragments.
Given a ${mode} prompt, generate title (descriptive, under 60 chars), category (e.g. character, environment, style, lighting), artType (e.g. oil painting, 3D render, photography, digital art), and notes (any relevant context or usage tips).
Return a JSON object with exactly these keys: title, category, artType, notes.`,
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    artType: { type: Type.STRING },
                    notes: { type: Type.STRING }
                }
            }
        }
    });
    const _latency = Math.round(performance.now() - _start);
    trackApiCall({
        model: 'gemini-3-flash-preview',
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        responseTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: _latency,
    });
    
    try {
        return JSON.parse(response.text || "{}");
    } catch {
        return { title: '', category: '', artType: '', notes: '' };
    }
};

export const generateIdeasForStyle = async (stylePrompt: string): Promise<string[]> => {
    trackApiRequest();
    const ai = getAiClient();
    const _start = performance.now();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts: [{ text: stylePrompt }] },
        config: {
            systemInstruction: "You are a creative AI assistant helping generate image concepts. Given a visual style description, suggest 5 distinct subjects that would work well. Subjects should vary in type: include a character, an animal, an object, a landscape, and an abstract concept. Each subject should be a short descriptive phrase (5-15 words). Return a JSON array of 5 strings only.",
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });
    const _latency = Math.round(performance.now() - _start);
    trackApiCall({
        model: 'gemini-3-flash-preview',
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        responseTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: _latency,
    });
    try {
        return JSON.parse(response.text || "[]");
    } catch {
        return [];
    }
};

export const generateStructuredPromptMetadata = async (prompt: string, image?: { imageBase64: string, mimeType: string }) => {
    return generateFeatureMetadata('structured', prompt, image ? [image] : undefined);
};

export const generateMasterPromptMetadata = async (prompt: string, images?: { imageBase64: string, mimeType: string }[]) => {
    return generateFeatureMetadata('master', prompt, images);
};
