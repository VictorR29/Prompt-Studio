
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest } from "./config";

export const generateFeatureMetadata = async (mode: string, prompt: string, images?: { imageBase64: string, mimeType: string }[]) => {
    trackApiRequest();
    const ai = getAiClient();
    const parts: any[] = [{ text: `Generate metadata for this ${mode} prompt: "${prompt}". Return JSON with title, category, artType, notes.` }];
    if (images) {
        parts.unshift(...images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })));
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
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
    
    return JSON.parse(response.text || "{}");
};

export const generateIdeasForStyle = async (stylePrompt: string): Promise<string[]> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest 5 distinct subjects that would look good in this style: "${stylePrompt}". Return a JSON array of strings.`,
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

export const generateStructuredPromptMetadata = async (prompt: string, image?: { imageBase64: string, mimeType: string }) => {
    return generateFeatureMetadata('structured', prompt, image ? [image] : undefined);
};

export const generateMasterPromptMetadata = async (prompt: string, images?: { imageBase64: string, mimeType: string }[]) => {
    return generateFeatureMetadata('master', prompt, images);
};
