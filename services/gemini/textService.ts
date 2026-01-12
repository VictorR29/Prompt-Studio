
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest } from "./config";
import { ExtractionMode } from "../../types";
import { MASTER_PROMPT_ASSEMBLY } from "./prompts/definitions";

export const modularizePrompt = async (prompt: string): Promise<Record<string, string>> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Break down this prompt into components: "${prompt}"`,
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

export const assembleMasterPrompt = async (fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    
    // Remove empty fragments to avoid noise
    const activeFragments = Object.entries(fragments).reduce((acc, [key, value]) => {
        if (value && value.trim()) acc[key] = value;
        return acc;
    }, {} as any);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${MASTER_PROMPT_ASSEMBLY}\n\nINPUT FRAGMENTS: ${JSON.stringify(activeFragments)}`,
    });
    return response.text?.trim() || "";
};

export const optimizePromptFragment = async (mode: string, fragments: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
    trackApiRequest();
    const ai = getAiClient();
    const targetValue = fragments[mode as ExtractionMode] || "";

    if (!targetValue.trim()) return [];

    const prompt = `ACT AS: Elite AI Prompt Engineer.
TASK: Optimize the specific text fragment for the '${mode}' module of an image generation prompt.

TARGET TEXT TO OPTIMIZE: "${targetValue}"
FULL CONTEXT (Other modules): ${JSON.stringify(fragments)}

*** ADAPTIVE OPTIMIZATION LOGIC ***
1. **ANALYZE DENSITY**:
   - If the input is **VAGUE/SHORT** (e.g., "cat", "blue light"): **EXPAND & ENRICH**. Add professional artistic terms, lighting specifics, textures, and details relevant to '${mode}'.
   - If the input is **DETAILED/STRUCTURED**: **POLISH & REFINE**. Elevate the vocabulary (e.g., change "shiny" to "iridescent"), fix grammar, and improve flow. Do NOT add unnecessary length if it's already complete.

*** STRICT RULES ***
1. Output **ONLY** the final, ready-to-use prompt text.
2. **NO** instructions (e.g., do NOT write "Add more light" or "Ensure...").
3. **NO** conversational filler.
4. **ALWAYS IN ENGLISH**.
5. Return exactly 3 variations following this pattern:
   - Variation 1: **Conservative Polish** (High fidelity to original, better vocab).
   - Variation 2: **Balanced Enhancement** (The optimal version).
   - Variation 3: **Creative/Rich** (Highly descriptive and artistic).

Return JSON array of strings.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    });
    return JSON.parse(response.text || "[]");
};

export const adaptFragmentToContext = async (mode: string, fragment: string, context: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Adapt this "${mode}" description: "${fragment}" to fit this context: ${JSON.stringify(context)}.`,
    });
    return response.text || fragment;
};

export const generateNegativePrompt = async (positivePrompt: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a negative prompt for this positive prompt: "${positivePrompt}". Keep it comma separated.`,
    });
    return response.text || "";
};
