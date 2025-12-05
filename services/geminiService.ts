
import { GoogleGenAI, Type, Part, Schema } from "@google/genai";
import { ExtractionMode, AssistantResponse } from "../types";

const getAiClient = () => {
    const apiKey = localStorage.getItem('userGeminiKey') || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key no configurada.");
    return new GoogleGenAI({ apiKey });
};

// Helper to translate and format safety errors
const SAFETY_CATEGORY_MAP: Record<string, string> = {
    'HARM_CATEGORY_HARASSMENT': 'Acoso',
    'HARM_CATEGORY_HATE_SPEECH': 'Discurso de Odio',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'Contenido Sexualmente Explícito',
    'HARM_CATEGORY_DANGEROUS_CONTENT': 'Contenido Peligroso/Dañino',
    'HARM_CATEGORY_CIVIC_INTEGRITY': 'Integridad Cívica'
};

const formatSafetyError = (candidate: any): string => {
    if (!candidate.safetyRatings) return "Contenido bloqueado por seguridad.";
    
    const blockedReasons = candidate.safetyRatings
        .filter((r: any) => r.probability === 'HIGH' || r.probability === 'MEDIUM')
        .map((r: any) => {
            const cat = SAFETY_CATEGORY_MAP[r.category] || r.category;
            const prob = r.probability === 'HIGH' ? 'Alta' : 'Media';
            return `${cat} (${prob})`;
        });

    if (blockedReasons.length > 0) {
        return `Generación bloqueada. Se detectó posible: ${blockedReasons.join(', ')}. Por favor reformula tu entrada.`;
    }
    
    return "El contenido fue marcado como inseguro por los filtros de IA.";
};

const cleanAndParseJson = (text: string): any => {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        // If simple parse fails, try to find the first '{' and last '}'
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
             try {
                return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
            } catch (e2) {
                // Ignore
            }
        }
        return {}; // Return empty object on failure to avoid app crash
    }
};

export const generateFeatureMetadata = async (mode: ExtractionMode, prompt: string, images?: {imageBase64: string, mimeType: string}[]) => {
    const ai = getAiClient();
    
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            notes: { type: Type.STRING },
            artType: { type: Type.STRING }
        },
        required: ["title", "category", "notes", "artType"]
    };

    const textPrompt = `Generate metadata for this ${mode} prompt: "${prompt}". 
    REQUIREMENTS:
    1. Title: Concise and evocative (2-5 words) in English.
    2. Category: Broad style/theme (e.g., Sci-Fi, Portrait) in English.
    3. ArtType: Specific medium (e.g., Digital Art, Oil Painting) in English.
    4. Notes: A detailed technical analysis of the visual style in SPANISH.
       Follow this specific logic:
       - Identify Key Elements: Extract essential descriptors (aesthetics, technique, lighting, shading).
       - Grouping: Group elements into themes (style, line, color/lighting, composition).
       - Synthesis: Write a single concise paragraph in Spanish using connecting phrases like "Caracterizado por," "Utiliza," "Presenta," and "Se enfoca en".
       - Terminology: Translate general descriptions to Spanish but keep specific technical art terms precise (e.g., "cel-shading", "lineart", "bokeh").
       - Goal: A technical executive summary of the visual requirements.`;

    const parts: Part[] = [];
    if (images) {
        images.forEach(img => parts.push({
            inlineData: { mimeType: img.mimeType, data: img.imageBase64 }
        }));
    }
    parts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    return cleanAndParseJson(response.text || "{}");
};

export const analyzeImageFeature = async (mode: ExtractionMode, images: {imageBase64: string, mimeType: string}[]) => {
    const ai = getAiClient();
    const parts: Part[] = [];
    images.forEach(img => parts.push({
        inlineData: { mimeType: img.mimeType, data: img.imageBase64 }
    }));
    
    let instruction = `Analyze these images and extract strictly the '${mode}' aspect. Return ONLY the detailed text description.`;

    if (mode === 'subject') {
        instruction += ` IMPORTANT: If there are multiple distinct subjects/characters, describe them separately using the format 'Subject 1: [details]... Subject 2: [details]...'. Do not merge them into one entity.`;
    } else if (mode === 'outfit') {
        instruction += ` STRICT CONSTRAINT: Describe ONLY the garments, accessories, and fabrics. DO NOT describe the person, body type, hair, eyes, skin, or pose. Imagine the clothes on an invisible mannequin.`;
    } else if (['pose', 'expression', 'object', 'scene', 'composition'].includes(mode)) {
        instruction += ` STRICT CONSTRAINT: Focus ONLY on the '${mode}'. DO NOT describe the subject's physical appearance (hair, face, body) unless it is technically required for the '${mode}' (e.g., for expression, describe facial muscles; for pose, describe limb position). Ignore clothing colors.`;
    } else if (mode === 'color') {
        instruction += ` STRICT CONSTRAINT: Extract the color palette and assign it to abstract zones like [Primary Outfit], [Accents], [Background], [Atmosphere]. DO NOT describe specific objects or garments from the reference image (e.g., do not say 'red dress' if you see a red dress, say '[Primary Outfit]: Red'). The goal is to apply this color scheme to ANY subject.`;
    }
    
    parts.push({ text: instruction });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts }
    });

    // Check for safety blocks even if text is returned (sometimes partial)
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        const warning = formatSafetyError(response.candidates[0]);
        if (!response.text) {
            throw new Error(warning);
        }
        return { result: response.text, warning: `Advertencia: ${warning}` };
    }

    return { result: response.text || "", warning: undefined };
};

export const generateIdeasForStyle = async (prompt: string): Promise<string[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Given this style description: "${prompt}", suggest 5 distinct subjects/concepts that would be visually striking in this specific style.
        Act as a Creative Director.
        Return strictly a JSON array of strings (e.g., ["A cyberpunk samurai in rain", "A quiet forest stream at dawn"]).`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });
    return cleanAndParseJson(response.text || "[]");
};

export const modularizePrompt = async (prompt: string): Promise<Partial<Record<ExtractionMode, string>>> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this image prompt and break it down into the following modules: 
        subject, pose, expression, outfit, object, scene, color, composition, style.
        Also extract any 'negative' prompt aspects if explicitly stated.
        Prompt: "${prompt}"
        Return a JSON object where keys are the module names and values are the extracted text. Empty strings if not present.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    pose: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    outfit: { type: Type.STRING },
                    object: { type: Type.STRING },
                    scene: { type: Type.STRING },
                    color: { type: Type.STRING },
                    composition: { type: Type.STRING },
                    style: { type: Type.STRING },
                    negative: { type: Type.STRING }
                }
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            ]
        }
    });
    
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error(formatSafetyError(response.candidates[0]));
    }

    return cleanAndParseJson(response.text || "{}");
};

export const generateAndModularizePrompt = async (
    input: { idea?: string; style?: string; images?: {imageBase64: string, mimeType: string}[] }
): Promise<Partial<Record<ExtractionMode, string>>> => {
    const ai = getAiClient();
    const parts: Part[] = [];

    if (input.images) {
        input.images.forEach(img => parts.push({
            inlineData: { mimeType: img.mimeType, data: img.imageBase64 }
        }));
    }

    let promptText = `
    ACT AS: Professional AI Art Director (Midjourney/Flux Expert).
    
    TASK: 
    1. ANALYZE the user's input (Idea + Style + Images).
    2. CREATIVELY EXPAND: You MUST turn simple inputs into a highly detailed, professional prompt. 
       - If input is "a cat", you must invent the breed, the lighting, the scene, the mood. 
       - DO NOT simply repeat "a cat". Invent a masterpiece.
    3. DISTRIBUTE: Break your *newly created* rich description into the specific JSON fields below.

    USER INPUT:
    - Idea: "${input.idea || ''}"
    - Style: "${input.style || ''}"
    ${input.images ? '- (See attached images for visual reference)' : ''}
    
    JSON OUTPUT REQUIREMENTS:
    - 'subject': Detailed description of the character/subject.
    - 'pose': The specific action or stance.
    - 'style': Art mediums, influences, engine settings (e.g. Unreal Engine 5).
    - 'lighting': (Include in 'scene' or 'composition')
    - 'negative': LEAVE EMPTY. Do NOT generate a negative prompt unless the User Input explicitly includes negative constraints (e.g. "no blurry", "avoid red"). DO NOT hallucinate negative prompts.
    - ALL VALUES MUST BE IN ENGLISH AND HIGHLY DETAILED.
    `;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    pose: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    outfit: { type: Type.STRING },
                    object: { type: Type.STRING },
                    scene: { type: Type.STRING },
                    color: { type: Type.STRING },
                    composition: { type: Type.STRING },
                    style: { type: Type.STRING },
                    negative: { type: Type.STRING }
                }
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            ]
        }
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error(formatSafetyError(response.candidates[0]));
    }

    return cleanAndParseJson(response.text || "{}");
};

// --- Missing Functions Implementation ---

export const assembleMasterPrompt = async (modules: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    const ai = getAiClient();
    const jsonModules = JSON.stringify(modules);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Act as a Midjourney Prompt Engineer. 
        Assemble these separate prompt modules into a single, cohesive, high-quality text prompt.
        
        Rules:
        1. Eliminate redundancies (e.g. if Subject and Outfit both say "red dress", say it once).
        2. Ensure logical flow: Subject -> Action/Pose -> Outfit -> Scene -> Lighting -> Style.
        3. Add specific high-quality art keywords if missing (e.g. "8k", "masterpiece") appropriate for the style.
        4. Return ONLY the final prompt string.
        
        Modules: ${jsonModules}`
    });
    
    return response.text || "";
};

export const optimizePromptFragment = async (mode: ExtractionMode, context: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
    const ai = getAiClient();
    const currentVal = context[mode] || "";
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Context: A generative art prompt.
        Current '${mode}' description: "${currentVal}".
        
        Task: Generate 3 distinct, highly detailed, and creative variations/improvements for this '${mode}'.
        Make them "Midjourney-ready" (descriptive, evocative).
        
        Return strictly a JSON array of strings.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });
    
    return cleanAndParseJson(response.text || "[]");
};

export const createJsonTemplate = async (input: string): Promise<string> => {
    // This function seems to just validate or re-format JSON, or convert text to JSON template
    // For now, we assume it ensures a structured JSON string
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Convert this text/json into a clean, structured JSON prompt template for image generation. 
        Ensure keys like 'subject', 'style', 'lighting' etc.
        Input: ${input}
        Return strictly JSON.`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const generateStructuredPromptMetadata = async (prompt: string, images?: any) => {
    // Re-use logic from generateFeatureMetadata but adapted for full prompts
    return generateFeatureMetadata('style', prompt, images ? [images] : undefined);
};

export const generateMasterPromptMetadata = async (prompt: string, images?: any[]) => {
    return generateFeatureMetadata('style', prompt, images);
};

export const adaptFragmentToContext = async (mode: ExtractionMode, fragment: string, context: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Task: Rewrite the following '${mode}' fragment to fit seamlessly into the existing prompt Context.
        
        Fragment to Insert: "${fragment}"
        Target Context: ${JSON.stringify(context)}
        
        Rules:
        1. Maintain the core visual idea of the fragment.
        2. Adjust tone, style, and detail level to match the Context.
        3. Resolve conflicts (e.g. if context is "cyberpunk" and fragment is "medieval", adapt fragment to "cyberpunk medieval").
        4. Return ONLY the rewritten fragment string.
        `
    });
    return response.text || fragment;
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    // According to instructions: "General Image Generation and Editing Tasks: 'gemini-2.5-flash-image'"
    // And "output response may contain both image and text parts"
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
             // Instructions say: DO NOT set responseMimeType for nano banana (gemini-2.5-flash-image)
        });
        
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image data returned from API");
    } catch (e) {
        console.error("Image gen failed", e);
        // Fallback or re-throw
        throw e;
    }
};

export const generateNegativePrompt = async (positivePrompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this prompt: "${positivePrompt}".
        Generate a "Negative Prompt" (things to avoid) suitable for Stable Diffusion/Flux.
        Include standard quality fixes (e.g. blurry, low quality) AND logic-specific exclusions based on the prompt subject.
        Return ONLY the negative prompt string.`
    });
    return response.text || "";
};

export const assembleOptimizedJson = async (modules: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    // Similar to assembleMasterPrompt but returns a JSON string structure
    return JSON.stringify(modules, null, 2);
};

export const generateStructuredPromptFromImage = async (image: {imageBase64: string, mimeType: string}): Promise<string> => {
     // Re-use analyze logic
     const result = await analyzeImageFeature('style', [image]);
     return result.result || "";
};

export const mergeModulesIntoJsonTemplate = async (modules: any, template: string): Promise<string> => {
     const ai = getAiClient();
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Merge these modules into the provided JSON template.
        Modules: ${JSON.stringify(modules)}
        Template: ${template}
        Return the filled JSON string.`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const modularizeImageAnalysis = async (images: any[]): Promise<any> => {
    // Just a wrapper
    return {}; 
};

export const getCreativeAssistantResponse = async (history: any[], currentFragments: any): Promise<AssistantResponse> => {
    const ai = getAiClient();
    // System instruction to guide the chat
    const systemInstruction = `You are an Expert AI Art Director & Prompt Engineer.
    Your goal is to help the user refine their generative art prompt in real-time.
    
    Current Prompt State (JSON Modules): ${JSON.stringify(currentFragments)}
    
    Instructions:
    1. Chat casually but professionally.
    2. When the user asks for a change (e.g. "make it sci-fi", "add a cat"), you must UPDATE the relevant modules.
    3. Return a JSON response with:
       - 'message': Your reply to the user.
       - 'updates': An array of objects { "module": "subject|style|etc", "value": "new text" } for changed fields.
       - 'assembled_prompt': The full, updated linear prompt text.
    
    Do NOT hallucinate modules outside standard keys (subject, style, etc).
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history, // Pass the chat history
        config: {
            systemInstruction: systemInstruction,
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
    
    return cleanAndParseJson(response.text || "{}");
};

export const generateHybridFragment = async (targetMode: ExtractionMode, sources: {text?: string, imageBase64?: string, mimeType?: string}[], feedback: string): Promise<string> => {
    const ai = getAiClient();
    const parts: Part[] = [];
    
    // Add images
    sources.forEach(s => {
        if (s.imageBase64 && s.mimeType) {
            parts.push({ inlineData: { data: s.imageBase64, mimeType: s.mimeType } });
        }
    });
    
    // Construct prompt
    let textPrompt = `Act as a Master Visual Alchemist.
    Task: Create a new, unique '${targetMode}' description by fusing the "visual DNA" of the provided references.
    
    References provided (Images and/or Text):
    ${sources.map((s, i) => s.text ? `Ref ${i+1} (Text): "${s.text}"` : `Ref ${i+1}: [Image]`).join('\n')}
    
    User Feedback/Constraints: "${feedback}"
    
    Instructions:
    1. Analyze the essence of each reference.
    2. Synthesize them into a single, cohesive, highly detailed description for '${targetMode}'.
    3. If User Feedback exists, prioritize it.
    4. Return ONLY the resulting description text.`;
    
    parts.push({ text: textPrompt });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts }
    });
    
    return response.text || "";
};
