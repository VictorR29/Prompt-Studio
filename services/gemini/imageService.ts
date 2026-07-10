
import { defaultModelConfig, getAiClient, trackApiRequest, trackApiCall } from "./config";
import { IMAGE_ANALYSIS_PROMPT } from "./prompts/definitions";

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    // Default to gemini-2.5-flash-image for generation as per guidelines
    const _start = performance.now();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            ...defaultModelConfig('creative')
        },
    });
    const _latency = Math.round(performance.now() - _start);
    trackApiCall({
        model: 'gemini-2.5-flash-image',
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        responseTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: _latency,
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
    const _start = performance.now();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            role: "user",
            parts: images.map(img => ({ inlineData: { data: img.imageBase64, mimeType: img.mimeType } })),
        },
        config: {
            systemInstruction: IMAGE_ANALYSIS_PROMPT(mode),
            ...defaultModelConfig('extraction')
        },
    });
    const _latency = Math.round(performance.now() - _start);
    trackApiCall({
        model: 'gemini-3-flash-preview',
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        responseTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: _latency,
    });
    return { result: response.text?.trim() || "" };
};
