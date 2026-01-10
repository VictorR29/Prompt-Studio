import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionMode, SavedPrompt, AssistantResponse, PlaygroundOperation } from "../types";

const getAiClient = () => {
    const apiKey = localStorage.getItem('userGeminiKey') || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

const trackApiRequest = () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const usageData = localStorage.getItem('gemini_api_usage');
        let count = 0;
        if (usageData) {
            const parsed = JSON.parse(usageData);
            if (parsed.date === today) {
                count = parsed.count;
            }
        }
        localStorage.setItem('gemini_api_usage', JSON.stringify({ date: today, count: count + 1 }));
    } catch (e) {
        console.warn("Analytics error", e);
    }
};

export const attemptLocalModularization = (text: string): Record<ExtractionMode, string> | null => {
    try {
        const json = JSON.parse(text);
        if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
            // Basic validation to check if keys resemble ExtractionMode
            const keys = Object.keys(json);
            const validKeys = ['subject', 'style', 'scene', 'color', 'light', 'composition'];
            if (keys.some(k => validKeys.includes(k))) {
                return json as Record<ExtractionMode, string>;
            }
        }
    } catch (e) {
        // Not JSON
    }
    return null;
};

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
                { text: `Analyze these images and extract the ${mode} details. Be specific and descriptive.` }
            ]
        }
    });
    return { result: response.text || "" };
};

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
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Assemble these components into a high-quality image generation prompt: ${JSON.stringify(fragments)}`,
    });
    return response.text || "";
};

export const optimizePromptFragment = async (mode: string, fragments: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest 3 improvements for the "${mode}" component given the context: ${JSON.stringify(fragments)}. Return JSON array.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    });
    return JSON.parse(response.text || "[]");
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

export const generateStructuredPromptMetadata = async (prompt: string, image?: { imageBase64: string, mimeType: string }) => {
    return generateFeatureMetadata('structured', prompt, image ? [image] : undefined);
};

export const generateMasterPromptMetadata = async (prompt: string, images?: { imageBase64: string, mimeType: string }[]) => {
    return generateFeatureMetadata('master', prompt, images);
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

export const generateNegativePrompt = async (positivePrompt: string): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a negative prompt for this positive prompt: "${positivePrompt}". Keep it comma separated.`,
    });
    return response.text || "";
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

// IMPROVED: Direct JSON Generation with STRICT INVALIDITY HIERARCHY
export const assembleOptimizedJson = async (modules: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    trackApiRequest();
    const ai = getAiClient();
    const jsonModules = JSON.stringify(modules);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `ACT AS: Senior AI Prompt Analyst & Data Architect.
        TASK: Distill the provided prompt modules into a STRICT Hierarchical JSON Map optimized for Diffusion Models (Stable Diffusion/Flux/Midjourney).

        INPUT DATA: ${jsonModules}

        CRITICAL HIERARCHY OF INVALIDITY (The "Cleaner" Logic):
        You must apply these rules in order to strip redundancy and prevent hallucinations:

        1. COLOR (Supreme Priority):
           - Rule: INVALIDATES any color adjectives in other modules.
           - Logic: If 'color' module exists (e.g. "cyan and magenta neons"), REMOVE all color terms from 'subject', 'outfit', 'scene', 'style'.
           - Application: Apply the colors regionally (e.g. "cyan eyes", "magenta light") in the output, do not wash everything in one color.

        2. OUTFIT, POSE, EXPRESSION (Specialists) > SUBJECT (Identity Base):
           - Rule: Specialist modules OVERRIDE the Subject description.
           - If 'outfit' exists: DELETE clothing/armor descriptions from 'subject'.
           - If 'pose' exists: DELETE action verbs/posture from 'subject'.
           - If 'expression' exists: DELETE facial expressions from 'subject'.
           - Result: 'subject' must be stripped down to basic identity (ethnicity, age, body type, hair style).

        3. SCENE & OBJECT > SUBJECT:
           - Rule: Context overrides Base.
           - If 'scene' exists: DELETE location/background details from 'subject'.

        4. COMPOSITION > STYLE/SUBJECT:
           - Rule: Technical specs belong in Composition.
           - DELETE camera angles/framing terms from 'style' and 'subject'.

        5. STYLE (Global Atmosphere):
           - Rule: Style defines the render.
           - DELETE generic quality tags (e.g. "realistic", "8k", "detailed") from all other modules.

        CRITICAL ENGINEERING RULES:

        1. GLOBAL SYNTHESIS (THE GLUE - CRITICAL ORDER):
           - Generate a root field "global_synthesis".
           - MANDATORY ORDER: [ART STYLE] + [MAIN SUBJECT] + [KEY ATMOSPHERE].
           - This ensures the rendering engine sets the style *before* drawing the subject.
           - Limit: Max 20 words.

        2. TOKEN DISTILLATION & PROSE ELIMINATION:
           - DO NOT copy-paste the raw text. DECONSTRUCT IT.
           - EXTRACT only essential keywords/tokens.
           - BAN grammatical connectors ("the", "is", "with a", "depicted in", "standing on").
           - OUTPUT FORMAT: Comma-separated technical tags.

        3. HIERARCHY & WEIGHTS:
           - Use "influence_weight" as a FLOAT (0.1 to 1.0).
           - Structure output into "layers":
             a. "foundation": 'style' (Weight 1.0), 'composition' (Weight 0.8-0.9).
             b. "figure": 'subject' (Weight 0.8-0.9), 'pose', 'expression'.
             c. "environment": 'scene', 'outfit', 'object', 'color' (Weight 0.4-0.7).

        OUTPUT STRUCTURE EXAMPLE:
        {
          "global_synthesis": "Cyberpunk oil painting, cyborg samurai, neon rain.",
          "layers": {
            "foundation": {
              "style": { "key_concept": "oil painting, impasto, cyberpunk, unreal engine 5", "raw_fragment": "original text...", "influence_weight": 1.0 }
            },
            "figure": {
              "subject": { "key_concept": "cyborg samurai, metallic skin, katana", "raw_fragment": "original text...", "influence_weight": 0.9 }
            },
            ...
          }
        }

        CRITICAL: If a module is empty in Input, OMIT it from the output.

        RETURN ONLY THE JSON OBJECT.`,
        config: {
            responseMimeType: "application/json"
        }
    });

    return response.text || "{}";
};
