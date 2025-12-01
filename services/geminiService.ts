import { GoogleGenAI, Type, Part } from "@google/genai";
import { ExtractionMode, AssistantResponse } from "../types";

const getAiClient = () => {
    const apiKey = localStorage.getItem('userGeminiKey') || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key no configurada.");
    return new GoogleGenAI({ apiKey });
};

export const generateFeatureMetadata = async (mode: ExtractionMode, prompt: string, images?: {imageBase64: string, mimeType: string}[]) => {
    const ai = getAiClient();
    
    const responseSchema = {
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
       - Translate technical terms to Spanish where appropriate but keep standard art terms precise (e.g., "cel-shading", "lineart").
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

    return JSON.parse(response.text || "{}");
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
    return JSON.parse(response.text || "[]");
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
            }
        }
    });
    return JSON.parse(response.text || "{}");
};

export const assembleMasterPrompt = async (fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    const ai = getAiClient();
    const inputs = Object.entries(fragments)
        .filter(([_, v]) => v && v.trim())
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
        .join('\n');

    if (!inputs) return "";

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Assemble a high-quality image prompt from these modules:\n${inputs}\n
        RULES:
        1. MULTI-SUBJECT INTEGRITY: If 'SUBJECT' contains multiple entities (e.g., "Subject 1..., Subject 2..."), YOU MUST Include both/all of them. Adjust grammar to plural.
        2. DEDUPLICATION: Remove redundant descriptions (e.g. if Subject says "red shirt" and Outfit says "red shirt", merge).
        3. COLOR AUTHORITY: The 'COLOR' module is the master palette. If it conflicts with colors in other modules, the 'COLOR' module overrides.
        4. FLOW: Merge into a single continuous paragraph.
        5. OUTPUT FORMAT: SINGLE CONTINUOUS BLOCK. No intro, no markdown, no newlines.`,
    });
    return response.text || "";
};

export const optimizePromptFragment = async (mode: ExtractionMode, fragments: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
    const ai = getAiClient();
    const current = fragments[mode];
    if (!current) return [];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Optimize this '${mode}' description for an image prompt: "${current}".
        Context of other modules: ${JSON.stringify(fragments)}.
        Provide 3 improved variations that enhance visual quality and clarity.
        Return strictly a JSON array of strings.`,
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

export const mergeModulesIntoJsonTemplate = async (fragments: Partial<Record<ExtractionMode, string>>, template: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Merge these prompt modules: ${JSON.stringify(fragments)} into this JSON template structure: ${template}.
        Fill the template fields intelligently using the module content. 
        Clean up redundancies.
        Keep the JSON structure valid. Return the JSON string.`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const createJsonTemplate = async (jsonString: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this JSON prompt: ${jsonString}. 
        Create a generalized, reusable JSON template from it. 
        Replace specific values with placeholders or generic descriptions of what should go there.
        Return the JSON string.`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const generateStructuredPromptMetadata = async (prompt: string, image?: {imageBase64: string, mimeType: string}) => {
    const ai = getAiClient();
    const parts: Part[] = [];
    if (image) {
        parts.push({ inlineData: { mimeType: image.mimeType, data: image.imageBase64 } });
    }
    parts.push({ text: `Generate metadata for this structured JSON prompt: ${prompt}.
    Return JSON with keys: title, category, notes.
    REQUIREMENTS:
    1. Title: Concise and evocative (2-5 words) in English.
    2. Category: Broad style/theme (e.g., Sci-Fi, Portrait) in English.
    3. Notes: A detailed technical analysis of the visual style in SPANISH.
       - Identify Key Elements: Extract essential descriptors.
       - Synthesis: Write a single concise paragraph in Spanish using connecting phrases like "Caracterizado por," "Utiliza," "Presenta,".
       - Goal: A technical executive summary of the visual requirements.` });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    notes: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
};

export const adaptFragmentToContext = async (targetModule: ExtractionMode, sourcePrompt: string, currentFragments: Partial<Record<ExtractionMode, string>>) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Extract the '${targetModule}' aspect from this prompt: "${sourcePrompt}".
        Then adapt it to fit seamlessly with this existing context: ${JSON.stringify(currentFragments)}.
        CRITICAL RULES:
        1. PRESERVE DETAILS: Do not summarize. Keep specific adjectives, textures, and technical terms from the source.
        2. INTEGRATE: Only adjust grammar to fit.
        3. OUTPUT FORMAT: SINGLE CONTINUOUS BLOCK. No fillers.`,
    });
    return response.text || "";
};

export const generateStructuredPrompt = async (input: { idea: string; style?: string }) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a detailed image prompt for this idea: "${input.idea}"${input.style ? ` in style: "${input.style}"` : ''}.
        Write it as a single, rich descriptive paragraph suitable for image generation.
        Do NOT return JSON. Do NOT use markdown. Just the prompt text.`,
        config: {
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ]
        }
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        if (response.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error("La generación fue bloqueada por filtros de seguridad.");
        }
        throw new Error("La IA no generó ningún texto.");
    }
    return text;
};

export const generateStructuredPromptFromImage = async (images: {imageBase64: string, mimeType: string}[], style: string) => {
    const ai = getAiClient();
    const parts: Part[] = [];
    images.forEach(img => parts.push({ inlineData: { mimeType: img.mimeType, data: img.imageBase64 } }));
    parts.push({ text: `Analyze these images and generate a detailed image generation prompt based on them${style ? `, incorporating this style: ${style}` : ''}.
    Write it as a single, rich descriptive paragraph.
    Do NOT return JSON. Do NOT use markdown. Just the prompt text.` });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ]
        }
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        if (response.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error("La generación fue bloqueada por filtros de seguridad.");
        }
        throw new Error("La IA no generó ningún texto.");
    }
    return text;
};

export const generateMasterPromptMetadata = async (prompt: string, images?: {imageBase64: string, mimeType: string}[]) => {
     return generateFeatureMetadata('style', prompt, images); 
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                 parts: [{ text: prompt }]
            }
        });
    
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image generated.");
    } catch (e: any) {
        if (e.message?.includes('429') || e.status === 429 || e.message?.includes('RESOURCE_EXHAUSTED')) {
             throw new Error("Has excedido tu cuota gratuita de generación de imágenes. Por favor, intenta más tarde o usa una API Key con facturación.");
        }
        throw e;
    }
};

export const generateNegativePrompt = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on this positive prompt: "${prompt}", generate a standard negative prompt for AI image generation (things to avoid, like low quality, distortion, etc). Return only the negative prompt text.`,
    });
    return response.text || "";
};

export const assembleOptimizedJson = async (fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Convert these prompt modules into a structured JSON prompt optimized for ComfyUI or similar: ${JSON.stringify(fragments)}.
        RULES:
        1. MULTI-SUBJECT: If Subject module has multiple chars, keep them distinct.
        2. KEY ORDERING: The output JSON keys MUST be ordered visually for humans: 'subject' FIRST, then details, 'style' LAST.
        3. DEDUPLICATION: Remove repeated details.
        4. COLOR AUTHORITY: 'color' module overrides others.
        Return the JSON string.`,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "{}";
};

export const getCreativeAssistantResponse = async (history: {role: string, parts: {text: string}[]}[], fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history.map(h => ({ role: h.role, parts: h.parts })),
        config: {
            systemInstruction: `You are a creative AI assistant for image prompting. 
            Your goal is to help the user refine their image prompt by modifying specific modules.
            The current state of the prompt modules is: ${JSON.stringify(fragments)}.
            
            When the user asks for a change:
            1. ACT AS A PROMPT ENGINEER: Expand vague requests into detailed English technical descriptions.
            2. MARKDOWN: Use **bold** for key changes in your 'message'.
            3. STRICT SCHEMA: Return a JSON object.
            4. MODULE KEYS: ALWAYS use the English keys (subject, style, etc) in 'updates'.
            5. OUTPUT FORMAT: The 'assembled_prompt' must be a SINGLE CONTINUOUS BLOCK of text.
            
            Schema:
            {
                "message": "Your conversational reply in Spanish...",
                "updates": [
                    { "module": "subject", "value": "Detailed English description..." }
                ],
                "assembled_prompt": "Full continuous prompt text..."
            }
            `,
            responseMimeType: "application/json"
        }
    });
    
    return response.text || "";
};

export const generateHybridFragment = async (targetModule: ExtractionMode, payload: {text?: string, imageBase64?: string, mimeType?: string}[], feedback: string): Promise<string> => {
    const ai = getAiClient();
    const parts: Part[] = [];
    
    payload.forEach((p, i) => {
        if (p.text) {
            parts.push({ text: `[Text Reference ${i+1}]: ${p.text}` });
        }
        if (p.imageBase64) {
             parts.push({ text: `[Visual Reference ${i+1}]:` });
             parts.push({ inlineData: { mimeType: p.mimeType!, data: p.imageBase64 } });
        }
    });
    
    parts.push({ text: `User Feedback/Priority: ${feedback || "None"}` });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            systemInstruction: `You are an expert Concept Artist AI.
            Task: Create a NEW '${targetModule}' description by fusing the 'DNA' of the provided references.
            
            Rules:
            1. SYNTHESIS: Do not just list features. Create a cohesive new concept that blends the references.
            2. RICHNESS: Generate a detailed, high-quality description suitable for Midjourney/Flux.
            3. FEEDBACK: User feedback overrides reference data.
            4. OUTPUT FORMAT: SINGLE CONTINUOUS BLOCK. No headers, no conversational filler.
            `,
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ]
        }
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
         if (response.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error("Contenido bloqueado por seguridad.");
        }
        // Fallback for weird API responses
        if (response.text) return response.text;
        throw new Error("La IA no generó texto.");
    }
    return text;
};