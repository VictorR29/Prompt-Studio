
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest, defaultModelConfig } from "./config";
import { ExtractionMode } from "../../types";
import { MASTER_PROMPT_ASSEMBLY } from "./prompts/definitions";

const MODULARIZE_SYSTEM_INSTRUCTION = `You are an AI prompt engineer analyzing an image generation prompt.
Break the following prompt into its visual components: subject, style, scene, color, composition (framing, angle, lighting, depth of field), pose, expression, outfit, and any objects.
Return a JSON object where each key is a module name and the value is the extracted text for that module.
If a component is not present in the input, return an empty string for that key.`;

export const modularizePrompt = async (prompt: string): Promise<Record<string, string>> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts: [{ text: prompt }] },
        config: {
            systemInstruction: MODULARIZE_SYSTEM_INSTRUCTION,
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
        return JSON.parse(response.text || "{}");
    } catch {
        return {};
    }
};

export const assembleMasterPrompt = async (fragments: Record<string, string>): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    
    // Remove empty fragments to avoid noise
    const activeFragments = Object.entries(fragments).reduce((acc, [key, value]) => {
        if (value && value.trim()) acc[key] = value;
        return acc;
    }, {} as any);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { role: "user", parts: [{ text: `INPUT FRAGMENTS: ${JSON.stringify(activeFragments)}` }] },
        config: {
            systemInstruction: MASTER_PROMPT_ASSEMBLY,
            ...defaultModelConfig('creative'),
        },
    });
    return response.text?.trim() || "";
};

const OPTIMIZE_SYSTEM_INSTRUCTION = `ACT AS: Elite AI Prompt Engineer.
TASK: Optimize a specific text fragment of an image generation prompt.

*** ADAPTIVE OPTIMIZATION LOGIC ***
1. **ANALYZE DENSITY**:
   - If the input is **VAGUE/SHORT** (e.g., "cat", "blue light"): **EXPAND & ENRICH**. Add professional artistic terms, lighting specifics, textures, and details relevant to the module.
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

export const optimizePromptFragment = async (mode: string, fragments: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
    trackApiRequest();
    const ai = getAiClient();
    const targetValue = fragments[mode as ExtractionMode] || "";

    if (!targetValue.trim()) return [];

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts: [{ text: `Optimize the following text for the '${mode}' module.\n\nTARGET TEXT TO OPTIMIZE: "${targetValue}"\nFULL CONTEXT (Other modules): ${JSON.stringify(fragments)}` }] },
        config: {
            systemInstruction: OPTIMIZE_SYSTEM_INSTRUCTION,
            ...defaultModelConfig('extraction'),
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    });
    try {
        return JSON.parse(response.text || "[]");
    } catch {
        return [];
    }
};

const ADAPT_SYSTEM_INSTRUCTION = `You are an AI prompt engineer. Rewrite the following description to better fit the provided visual context.
Preserve the core meaning and key details, but adjust wording to match the overall scene described in the context.
Return ONLY the rewritten description, no labels or explanations.`;

export const adaptFragmentToContext = async (mode: string, fragment: string, context: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts: [{ text: `Adapt this "${mode}" description: "${fragment}" to fit this context: ${JSON.stringify(context)}.` }] },
        config: {
            systemInstruction: ADAPT_SYSTEM_INSTRUCTION,
            ...defaultModelConfig('creative'),
        },
    });
    return response.text || fragment;
};

const NEGATIVE_PROMPT_SYSTEM_INSTRUCTION = `You are an AI prompt engineer creating negative prompts for image generation.
A negative prompt tells the AI what NOT to include in an image.
Generate a comma-separated list of elements, styles, colors, and artifacts to avoid, based on the positive prompt provided.
Return ONLY the comma-separated text.`;

export const generateNegativePrompt = async (positivePrompt: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts: [{ text: positivePrompt }] },
        config: {
            systemInstruction: NEGATIVE_PROMPT_SYSTEM_INSTRUCTION,
            ...defaultModelConfig('creative'),
        },
    });
    return response.text || "";
};
