
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest, defaultModelConfig, trackApiCall } from "./config";
import { AssistantResponse } from "../../types";

const CREATIVE_ASSISTANT_SYSTEM_INSTRUCTION = `You are an AI creative assistant inside a prompt builder application.
The user is refining image generation prompts module by module.
You receive: the current state of all prompt modules (context) and the conversation history.
Based on the conversation, determine which module(s) to update.
You can update: subject, style, pose, expression, scene, outfit, object, composition, color.
Only update modules that the user explicitly asks to change. Do NOT invent module names outside this list.
When asked to generate or finalize, also provide an assembled_prompt combining all current modules.
For simple greetings or off-topic messages, return an empty updates array with an appropriate message.
Return a JSON object matching the AssistantResponse type.`;

export const getCreativeAssistantResponse = async (history: any[], context: any): Promise<AssistantResponse> => {
    trackApiRequest();
    const ai = getAiClient();
    const _start = performance.now();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            role: 'user',
            parts: [{ text: `Context: ${JSON.stringify(context)}. Chat history: ${JSON.stringify(history)}.` }]
        },
        config: {
            systemInstruction: CREATIVE_ASSISTANT_SYSTEM_INSTRUCTION,
            ...defaultModelConfig('creative'),
            responseMimeType: "application/json",
            responseSchema: {
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
        return JSON.parse(response.text || "{}") as AssistantResponse;
    } catch {
        return {} as AssistantResponse;
    }
};

export const generateHybridFragment = async (targetMode: string, inputs: any[], feedback: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();

    const hasUserInstructions = feedback?.trim().length > 0;

    const systemInstruction = `ACT AS: Expert AI Visual Prompt Engineer.
TASK: Analyze ALL provided reference images thoroughly and synthesize a single, cohesive, high-density description for the "${targetMode}" module.

${
    hasUserInstructions
        ? `USER INSTRUCTIONS (SELECTIVE FUSION): "${feedback}"
The user may refer to inputs as Ref 1, Ref 2, Ref 3 — these correspond to [Input 1], [Input 2], [Input 3] in order.
The user has specified what elements to take from each reference image. Follow their instructions precisely when selecting which visual features from each image to include in the final output.`
        : `BLEND ALL IMAGES: Extract the most prominent visual features from EVERY provided image and merge them into one unified description. The result should be a coherent blend of all inputs — not a list or comparison.`
}

STRICT OUTPUT RULES:
1. Return ONLY the raw prompt text.
2. NO introductions (e.g., "Here is the prompt").
3. NO labels (e.g., "Style:", "Hybrid:").
4. NO markdown formatting.
5. NO bullet points.
6. Must be a SINGLE, continuous paragraph.
7. Focus exclusively on visual descriptions suitable for image generation.`;

    const parts: any[] = [];

    inputs.forEach((input, index) => {
        if (input.imageBase64) {
            parts.push({ text: `[Input ${index + 1} (Image Reference)]` });
            parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType } });
        } else if (input.text) {
            parts.push({ text: `[Input ${index + 1} (Text Reference)]: "${input.text}"` });
        }
    });

    const _start = performance.now();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { role: "user", parts },
        config: {
            systemInstruction,
            ...defaultModelConfig('creative'),
        }
    });
    const _latency = Math.round(performance.now() - _start);
    trackApiCall({
        model: 'gemini-3-flash-preview',
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        responseTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs: _latency,
    });

    // Limpieza adicional por seguridad
    let result = response.text?.trim() || "";
    // Eliminar posibles comillas envolventes o etiquetas markdown si el modelo falla en obedecer
    result = result.replace(/^["']|["']$/g, '').replace(/^```(json|text)?/g, '').replace(/```$/g, '');

    return result;
};
