
import { Type } from "@google/genai";
import { getAiClient, trackApiRequest } from "./config";
import { AssistantResponse } from "../../types";

export const getCreativeAssistantResponse = async (history: any[], context: any): Promise<AssistantResponse> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            role: 'user',
            parts: [
                { text: `Context: ${JSON.stringify(context)}. Chat history: ${JSON.stringify(history)}. Provide updates to the prompt modules.` }
            ]
        },
        config: {
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
    return JSON.parse(response.text || "{}") as AssistantResponse;
};

export const generateHybridFragment = async (targetMode: string, inputs: any[], feedback: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    
    // Construcción del prompt con reglas estrictas de salida
    const promptText = `
ACT AS: Expert AI Visual Prompt Engineer.
TASK: Synthesize a single, cohesive, high-density description for the module "${targetMode}" by fusing the DNA of the provided visual and text inputs.

USER INSTRUCTIONS (THE CATALYST): "${feedback || "Blend the inputs perfectly to create a unified concept."}"

STRICT OUTPUT RULES:
1. Return ONLY the raw prompt text.
2. NO introductions (e.g., "Here is the prompt").
3. NO labels (e.g., "Style:", "Hybrid:").
4. NO markdown formatting.
5. NO bullet points.
6. Must be a SINGLE, continuous paragraph.
7. Focus exclusively on visual descriptions suitable for image generation.
`;

    const parts: any[] = [{ text: promptText }];
    
    inputs.forEach((input, index) => {
        if (input.imageBase64) {
             parts.push({ text: `[Input ${index + 1} (Image Reference)]` });
             parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType } });
        } else if (input.text) {
             parts.push({ text: `[Input ${index + 1} (Text Reference)]: "${input.text}"` });
        }
    });

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts }
    });
    
    // Limpieza adicional por seguridad
    let result = response.text?.trim() || "";
    // Eliminar posibles comillas envolventes o etiquetas markdown si el modelo falla en obedecer
    result = result.replace(/^["']|["']$/g, '').replace(/^```(json|text)?/g, '').replace(/```$/g, '');
    
    return result;
};
