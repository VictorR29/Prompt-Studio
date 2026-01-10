
import { getAiClient, trackApiRequest } from "./config";
import { IMAGE_ANALYSIS_PROMPT } from "./prompts/definitions";

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    // Default to gemini-2.5-flash-image for generation as per guidelines
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
    });
    
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image generated");
};

export const analyzeImageFeature = async (mode: string, images: { imageBase64: string, mimeType: string }[]): Promise<{ result: string; warning?: string }> => {
    trackApiRequest();
    const ai = getAiClient();
    
    // Using gemini-3-flash-preview for analysis (multimodal)
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                ...images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })),
                { text: IMAGE_ANALYSIS_PROMPT(mode) }
            ]
        }
    });
    return { result: response.text?.trim() || "" };
};
