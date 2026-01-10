
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
    const parts: any[] = [{ text: `Create a hybrid "${targetMode}" description based on these inputs. User feedback: ${feedback}` }];
    
    inputs.forEach(input => {
        if (input.imageBase64) {
             parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType } });
        } else if (input.text) {
             parts.push({ text: `Reference text: ${input.text}` });
        }
    });

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts }
    });
    return response.text || "";
};
