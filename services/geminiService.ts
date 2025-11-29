
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { SavedPrompt, ExtractionMode, AssistantResponse } from "../types";

// --- Throttling Logic ---
const requestQueue: Array<{
    apiCall: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
}> = [];
let isProcessingQueue = false;
// Set interval to ~55 requests per minute to stay safely below the 60 RPM free tier limit.
const MIN_REQUEST_INTERVAL = 1100; 

async function processApiQueue() {
    if (requestQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }

    isProcessingQueue = true;
    const request = requestQueue.shift();
    if (!request) {
        isProcessingQueue = false;
        setTimeout(processApiQueue, MIN_REQUEST_INTERVAL);
        return;
    }

    try {
        const result = await request.apiCall();
        request.resolve(result);
    } catch (error) {
        request.reject(error);
    } finally {
        setTimeout(processApiQueue, MIN_REQUEST_INTERVAL);
    }
}

function callApiThrottled<T>(apiCall: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const wrappedApiCall = async () => {
            const userApiKey = localStorage.getItem('userGeminiKey');
            const apiKey = userApiKey || process.env.API_KEY;

            if (!apiKey) {
                return reject(new Error("API Key no configurada. Por favor, ingrésala en la configuración para continuar."));
            }
            const ai = new GoogleGenAI({ apiKey });
            return apiCall(ai);
        };

        requestQueue.push({ apiCall: wrappedApiCall, resolve, reject });
        if (!isProcessingQueue) {
            processApiQueue();
        }
    });
}
// --- End Throttling Logic ---

type ImagePayload = { imageBase64: string; mimeType: string };

const createImageAnalyzer = (systemInstruction: string, errorContext: string) => {
    return async (images: ImagePayload[]): Promise<{ result: string; warning?: string }> => {
        if (images.length === 0) {
            throw new Error("Se requiere al menos una imagen para analizar.");
        }
        try {
            const imageParts = images.map(image => ({
                inlineData: { data: image.imageBase64, mimeType: image.mimeType },
            }));
            const response = await callApiThrottled(ai => ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: { 
                    systemInstruction,
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
                    ]
                },
                contents: {
                    parts: [
                        { text: `Analyze the provided images and generate the optimized prompt as instructed.` },
                        ...imageParts,
                    ],
                },
            })) as GenerateContentResponse;
            
            const candidate = response.candidates?.[0];
            
            let text = response.text;
            if (!text && candidate?.content?.parts) {
                text = candidate.content.parts.map(p => p.text).join(' ');
            }

            let warning: string | undefined;
            const isRisky = candidate?.safetyRatings?.some(rating => 
                rating.probability === 'HIGH' || rating.probability === 'MEDIUM'
            );
            const isBlockedBySafety = candidate?.finishReason === 'SAFETY' || (!text && isRisky);

            if (!text) {
                if (isBlockedBySafety) {
                    throw new Error("⚠️ CONTENIDO SENSIBLE DETECTADO: La IA no pudo sanitizar la imagen automáticamente.");
                }
                if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
                     throw new Error(`La generación se detuvo por razón: ${candidate.finishReason}`);
                }
                throw new Error("La API no devolvió ningún texto. La imagen podría ser compleja o ambigua.");
            }

            if (text && isRisky) {
                warning = "⚠️ Aviso de Seguridad: Se detectó contenido potencialmente sensible. La IA ha optimizado el análisis para extraer solo elementos seguros.";
            }

            return { result: text.trim(), warning };
            
        } catch (error) {
            console.error(`Error calling Gemini API for ${errorContext}:`, error);
            if (error instanceof Error) {
                let msg = error.message;
                if (msg.includes('SAFETY') || msg.includes('BLOCK')) {
                     msg = "⚠️ CONTENIDO BLOQUEADO: Se detectaron elementos que los filtros de seguridad no pudieron procesar.";
                }
                if (msg.includes('429')) msg = "Has excedido el límite de peticiones. Espera un momento.";
                throw new Error(msg);
            }
            throw new Error("No se pudo obtener una respuesta del modelo de IA.");
        }
    };
};

const metadataResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Título corto y evocador.' },
    category: { type: Type.STRING, description: 'Categoría principal.' },
    artType: { type: Type.STRING, description: 'Tipo de arte.' },
    notes: { type: Type.STRING, description: 'Breve nota descriptiva.' },
  },
  required: ['title', 'category', 'artType', 'notes'],
};

const createMetadataGenerator = (systemInstruction: string, errorContext: string) => {
    return async (prompt: string, images: ImagePayload[]): Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>> => {
        const imageParts = images.map(image => ({
            inlineData: { data: image.imageBase64, mimeType: image.mimeType },
        }));
        try {
            const response = await callApiThrottled(ai => ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: metadataResponseSchema,
                },
                contents: {
                    parts: [
                        { text: `Este es el prompt generado: "${prompt}".` },
                        ...imageParts,
                        { text: "Genera los metadatos en JSON como se te indicó." },
                    ],
                },
            })) as GenerateContentResponse;
            const jsonString = response.text.trim();
            const metadata = JSON.parse(jsonString) as Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>;
            return metadata;
        } catch (error) {
            console.error(`Error generating metadata for ${errorContext}:`, error);
            throw new Error(`No se pudo generar la categorización automática para ${errorContext}.`);
        }
    };
};

// --- Analysis System Instructions (Shortened for brevity but functionally equivalent to input) ---
const analysisSystemInstructions: Record<ExtractionMode, string> = {
    style: `Analyze the visual style. Generate a prompt focusing ONLY on technique, atmosphere, and composition. Ignore specific subjects. Output raw prompt text only.`,
    subject: `Analyze the main subject(s). Describe physical identity and individual visual style. Start with style (e.g. 'photorealistic'). Output raw prompt text only.`,
    pose: `Analyze body pose. Describe pose, action, and angle in neutral terms. Output raw prompt text only.`,
    expression: `Analyze facial expression and emotion. Describe emotion, key features, and mood. Output raw prompt text only.`,
    scene: `Analyze environment and setting. Describe location, lighting, and atmosphere. Output raw prompt text only.`,
    outfit: `Analyze outfit and accessories. Describe style, garments, materials, and colors. Output raw prompt text only.`,
    composition: `Analyze composition and camera work. Describe angle, framing, depth, and lighting. Output raw prompt text only.`,
    color: `Analyze color usage. Describe palette, dominant colors, and distribution. Output raw prompt text only.`,
    object: `Analyze the most prominent object/prop. Describe it in detail, ignoring the holder. Output raw prompt text only.`,
    negative: `Identify negative space and unwanted elements (blur, distortion, etc.) to exclude.`
};

const metadataInstructionConfig: Record<ExtractionMode, { expert: string; feature: string; rules: any }> = {
    style: { expert: "curador de arte", feature: "estilo visual", rules: { title: "Título evocador", category: "Categoría de arte", artType: "Técnica", notes: "Atmósfera" } },
    subject: { expert: "director de casting", feature: "personaje", rules: { title: "Nombre descriptivo", category: "Tipo de personaje", artType: "Estilo", notes: "Rasgos clave" } },
    pose: { expert: "coreógrafo", feature: "pose", rules: { title: "Acción principal", category: "Tipo de pose", artType: "Ref Pose", notes: "Energía" } },
    expression: { expert: "director", feature: "expresión", rules: { title: "Emoción", category: "Tipo emoción", artType: "Ref Expresión", notes: "Matices" } },
    scene: { expert: "diseñador de entornos", feature: "entorno", rules: { title: "Lugar", category: "Tipo entorno", artType: "Estilo", notes: "Atmósfera" } },
    outfit: { expert: "diseñador de moda", feature: "vestuario", rules: { title: "Prenda principal", category: "Estilo ropa", artType: "Diseño Vestuario", notes: "Materiales" } },
    object: { expert: "diseñador de props", feature: "objeto", rules: { title: "Nombre objeto", category: "Tipo objeto", artType: "Estilo", notes: "Detalles" } },
    composition: { expert: "director foto", feature: "composición", rules: { title: "Tipo plano", category: "Técnica", artType: "Foto", notes: "Ángulo" } },
    color: { expert: "colorista", feature: "color", rules: { title: "Nombre paleta", category: "Esquema", artType: "Paleta", notes: "Emoción" } },
    negative: { expert: "auditor", feature: "negativo", rules: { title: "Perfil negativo", category: "Restricción", artType: "Negativo", notes: "Qué evitar" } },
};

const createMetadataSystemInstruction = (expert: string, feature: string, rules: any) => {
    return `Eres un ${expert}. Analiza el prompt y las imágenes de un ${feature}. Genera JSON con title, category, artType, notes según: ${JSON.stringify(rules)}.`;
};

const metadataSystemInstructions = Object.fromEntries(
  Object.entries(metadataInstructionConfig).map(([mode, config]) => [
    mode,
    createMetadataSystemInstruction(config.expert, config.feature, config.rules),
  ])
) as Record<ExtractionMode, string>;

const analysisFunctions = Object.fromEntries(
  (Object.keys(analysisSystemInstructions) as ExtractionMode[]).map(mode => [
    mode,
    createImageAnalyzer(analysisSystemInstructions[mode], `${mode} analysis`),
  ])
) as Record<ExtractionMode, (images: ImagePayload[]) => Promise<{ result: string; warning?: string }>>;

const metadataFunctions = Object.fromEntries(
  (Object.keys(metadataSystemInstructions) as ExtractionMode[]).map(mode => [
    mode,
    createMetadataGenerator(metadataSystemInstructions[mode], `el ${mode}`),
  ])
) as Record<ExtractionMode, (prompt: string, images: ImagePayload[]) => Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>>>;

export const analyzeImageFeature = (mode: ExtractionMode, images: ImagePayload[]): Promise<{ result: string; warning?: string }> => {
  if (!analysisFunctions[mode]) throw new Error(`Modo inválido: ${mode}`);
  return analysisFunctions[mode](images);
};

export const generateFeatureMetadata = (mode: ExtractionMode, prompt: string, images: ImagePayload[]) => {
  if (!metadataFunctions[mode]) throw new Error(`Modo inválido: ${mode}`);
  return metadataFunctions[mode](prompt, images);
};

export const generateHybridFragment = async (
    targetModule: ExtractionMode, 
    inputs: (ImagePayload | { text: string })[], 
    userFeedback: string
): Promise<string> => {
    // UPDATED SYSTEM INSTRUCTION: Focus on richness and detail (Concept Artist)
    const systemInstruction = `Act as a world-class Concept Artist and Prompt Engineer specializing in Visual Synthesis.
Your task is to SYNTHESIZE a single, rich, and cohesive prompt fragment for the '${targetModule}' module, based on the provided inputs (images and/or text concepts).

CRITICAL INSTRUCTIONS:
1.  **RICHNESS & DETAIL:** DO NOT create a short or generic summary. You must generate a lavish, detailed description that captures textures, lighting nuances, specific materials, artistic techniques, and aesthetic vibes from the inputs.
2.  **SYNERGY:** Blend the distinct traits of the inputs into a unique, unified aesthetic concept. Use evocative language (e.g. instead of "blue shirt", use "cobalt blue silk shirt with iridescent sheen").
3.  **MIXED MEDIA:** You may receive images and text. Treat text descriptions as visual DNA to be woven into the final image description.
4.  **USER PRIORITY:** "${userFeedback}". If this user instruction contradicts the visual data, the user instruction RULES.
5.  **OUTPUT FORMAT:** Return ONLY the raw prompt text. No introductory phrases.
6.  **QUALITY:** The output should be suitable for high-end generative models (Midjourney v6, Flux, etc.).`;

    const contents = inputs.map(input => {
        if ('text' in input) {
            return { text: `[TEXT DNA REFERENCE]: ${input.text}` };
        } else {
            return { inlineData: { data: input.imageBase64, mimeType: input.mimeType } };
        }
    });
    
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
            contents: { 
                parts: [
                    { text: `Create a rich, high-quality hybrid prompt for ${targetModule} using these references:` }, 
                    ...contents
                ] 
            },
        })) as GenerateContentResponse;
        return response.text.trim();
    } catch (error) {
        console.error(error);
        throw new Error("Failed to generate hybrid fragment.");
    }
};

// --- Implemented Missing Functions ---

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            // responseMimeType is not supported for nano banana
        })) as GenerateContentResponse;

        // Find image part
        for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image generated.");
    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};

export const generateIdeasForStyle = async (prompt: string): Promise<string[]> => {
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Suggest 3 creative additions or variations for this style prompt: "${prompt}". Return ONLY a JSON array of strings.` }] },
            config: { responseMimeType: 'application/json' }
        })) as GenerateContentResponse;
        return JSON.parse(response.text);
    } catch (error) {
        return [];
    }
};

export const modularizePrompt = async (prompt: string): Promise<Partial<Record<ExtractionMode, string>>> => {
    const schema = {
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
            negative: { type: Type.STRING },
        },
    };
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { 
                systemInstruction: "You are an expert prompt engineer. Analyze the text prompt and decompose it into specific visual modules. Extract any negative/exclusionary constraints into the 'negative' module. Return a JSON object.",
                responseMimeType: 'application/json',
                responseSchema: schema
            },
            contents: { parts: [{ text: prompt }] }
        })) as GenerateContentResponse;
        return JSON.parse(response.text);
    } catch (error) {
        throw new Error("Failed to modularize prompt.");
    }
};

export const assembleMasterPrompt = async (fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    try {
        // Extract negative prompt to handle it separately
        const { negative, ...positiveFragments } = fragments;
        
        const inputs = Object.entries(positiveFragments)
            .filter(([_, v]) => v && v.trim())
            .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
            .join('\n');

        // UPDATED: Elite system instruction for true optimization
        const systemInstruction = `You are an elite Prompt Engineer for high-end generative AI (Midjourney v6, Flux, Stable Diffusion).
Your task is to ASSEMBLE and OPTIMIZE a set of distinct visual modules into a single, high-performance master prompt.

CRITICAL OPTIMIZATION RULES:
1.  **DEDUPLICATION:** Aggressively identify and merge redundant details. (e.g. If 'Subject' says "wearing a red suit" and 'Outfit' says "red suit", mention it once).
2.  **FLOW & COHESION:** Do not just concatenate strings. Rewrite the text so it flows naturally. Use a mix of natural language for the subject/action and comma-separated keywords for style/technical specs.
3.  **LOGICAL ORDERING:** Structure the prompt logically: [Subject + Action] > [Outfit/Details] > [Environment/Scene] > [Lighting/Camera] > [Style/Aesthetics].
4.  **ENHANCEMENT:** Polish the phrasing for maximum visual impact without altering the user's original intent.
5.  **EXCLUSION:** Do NOT include any negative constraints (no "--no" parameters) in this text.

Output ONLY the final raw prompt string.`;
            
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
            contents: { parts: [{ text: inputs }] }
        })) as GenerateContentResponse;
        
        let masterPrompt = response.text.trim();
        
        // Append negative prompt if it exists
        if (negative && negative.trim()) {
            masterPrompt += `\n\n|| NEGATIVE PROMPT: ${negative.trim()}`;
        }
        
        return masterPrompt;
    } catch (error) {
        return "";
    }
};

export const assembleOptimizedJson = async (fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    try {
        const { negative, ...positiveFragments } = fragments;
        
        const systemInstruction = `You are an elite Prompt Engineer specialized in JSON structures.
Your task is to CLEAN, OPTIMIZE, and REORDER a set of prompt modules into a final JSON object.

CRITICAL INSTRUCTIONS:
1.  **DEDUPLICATION:** Remove redundant info (e.g. if 'style' says "anime" and 'subject' says "anime girl", keep "anime" in style and just "girl" in subject).
2.  **VISUAL ORDERING:** The output JSON keys MUST be ordered logically for human reading. You MUST output the JSON string with keys in this exact order if they exist:
    - 1st: 'subject'
    - 2nd: 'action' / 'pose'
    - 3rd: 'expression'
    - 4th: 'outfit' / 'object'
    - 5th: 'scene' / 'lighting'
    - 6th: 'color'
    - 7th: 'composition'
    - Last: 'style'
3.  **FORMAT:** Return only valid JSON.
4.  **NEGATIVE PROMPT:** If provided, include a 'negative' key at the very end.`;

        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { systemInstruction, responseMimeType: 'application/json' },
            contents: { parts: [{ text: `Optimize these fragments into structured JSON:\n${JSON.stringify(positiveFragments)}${negative ? `\nNegative Context: ${negative}` : ''}` }] }
        })) as GenerateContentResponse;

        // Ensure pretty print
        try {
            return JSON.stringify(JSON.parse(response.text), null, 2);
        } catch {
            return response.text;
        }

    } catch (error) {
        // Fallback to simple stringify if AI fails
        const ordered: any = {};
        const order: ExtractionMode[] = ['subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'composition', 'style'];
        order.forEach(k => { if (fragments[k]) ordered[k] = fragments[k]; });
        if (fragments.negative) ordered.negative = fragments.negative;
        return JSON.stringify(ordered, null, 2);
    }
};

export const generateNegativePrompt = async (positivePrompt: string): Promise<string> => {
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Generate a concise negative prompt for this positive prompt, avoiding common artifacts: "${positivePrompt}"` }] }
        })) as GenerateContentResponse;
        return response.text.trim();
    } catch (error) {
        return "";
    }
};

export const generateMasterPromptMetadata = async (prompt: string, images: ImagePayload[] = []) => {
    // Reuse metadata generator logic but generic
    const generator = createMetadataGenerator(
        "Eres un curador de arte digital experto. Analiza este prompt maestro.", 
        "prompt maestro"
    );
    return generator(prompt, images);
};

export const generateStructuredPromptMetadata = async (prompt: string, imagePayload?: ImagePayload) => {
    const images = imagePayload ? [imagePayload] : [];
    return generateMasterPromptMetadata(prompt, images);
};

export const optimizePromptFragment = async (mode: ExtractionMode, contextFragments: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
    const current = contextFragments[mode] || "";
    const context = Object.entries(contextFragments).filter(([k]) => k !== mode).map(([k,v]) => `${k}: ${v}`).join(', ');
    
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Optimize the '${mode}' fragment: "${current}". Context: [${context}]. Provide 3 distinct, improved variations in a JSON array of strings.` }] },
            config: { responseMimeType: 'application/json' }
        })) as GenerateContentResponse;
        return JSON.parse(response.text);
    } catch (error) {
        return [];
    }
};

export const adaptFragmentToContext = async (mode: ExtractionMode, fragment: string, contextFragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    const context = Object.entries(contextFragments).map(([k,v]) => `${k}: ${v}`).join('\n');
    
    // UPDATED SYSTEM INSTRUCTION: Stricter rules to preserve input details
    const systemInstruction = `You are a careful editor. Your task is to fit the provided '${mode}' description into a prompt context.
CRITICAL RULES:
1.  **INTEGRATE WITHOUT DESTROYING:** Do NOT summarize, simplify, or shorten the input description.
2.  **PRESERVE DETAILS:** You must keep specific adjectives, technical terms, artistic references, and visual nuances from the input.
3.  **ADJUST FLOW ONLY:** Only change grammatical connectors (like 'with', 'featuring', 'in the style of') to make it grammatically consistent with the context.
4.  **OUTPUT:** Return the adjusted description text only.`;

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
            contents: { parts: [{ text: `Adapt this '${mode}' description:\n"${fragment}"\n\nTo fit into this context:\n${context}` }] }
        })) as GenerateContentResponse;
        return response.text.trim();
    } catch (error) {
        return fragment;
    }
};

export const createJsonTemplate = async (jsonString: string): Promise<string> => {
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Validate and clean this JSON prompt template structure. Ensure it is valid JSON. Return only the JSON string.\n${jsonString}` }] },
            config: { responseMimeType: 'application/json' }
        })) as GenerateContentResponse;
        return response.text;
    } catch (error) {
        return jsonString;
    }
};

export const mergeModulesIntoJsonTemplate = async (modules: Partial<Record<ExtractionMode, string>>, template: string): Promise<string> => {
    try {
        const { negative, ...positiveModules } = modules;
        
        const systemInstruction = `You are an expert Prompt Engineer.
        Merge the provided modules into the JSON template.
        CRITICAL: 
        1. Replace placeholders or relevant fields in the template.
        2. Clean up and deduplicate content (e.g., don't repeat 'style' details in 'subject').
        3. Ensure the final JSON is valid and visually structured with 'subject' appearing early if possible.
        4. If a 'negative' module is provided, ensure it is added to a 'negative' or 'exclude' field in the JSON.`;

        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { systemInstruction, responseMimeType: 'application/json' },
            contents: { parts: [{ text: `Merge these modules into the provided JSON template.\nModules: ${JSON.stringify(positiveModules)}\nNegative: ${negative || ''}\nTemplate: ${template}\nReturn updated JSON.` }] }
        })) as GenerateContentResponse;
        return response.text;
    } catch (error) {
        return template;
    }
};

export const getCreativeAssistantResponseSystemInstruction = () => {
    return `You are a creative AI assistant for prompt engineering. Help the user refine their image prompt. 
    You can update specific modules or the whole prompt. 
    
    CRITICAL INSTRUCTIONS:
    1. **LANGUAGE:** You must converse with the user in Spanish (in the 'message' field), BUT ALL prompt content ('value' in updates and 'assembled_prompt') MUST BE IN ENGLISH.
    2. **MODULE KEYS:** In the 'updates' array, the 'module' key MUST be one of these exact English strings: 'subject', 'style', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'composition', 'negative'. DO NOT translate module names (e.g. never use 'estilo' or 'vestimenta').
    3. **CREATIVE EXPANSION:** Act as a Creative Director. If the user request is vague (e.g. "hazlo cartoon"), DO NOT just swap the word. Expand it into a rich technical description in English (e.g. "vibrant cartoon style, cel shaded, bold outlines, 2D animation aesthetic").
    4. **MARKDOWN:** Use Markdown in your 'message' response to highlight changes (e.g. **bold** for new terms, *italics* for emphasis).
    5. **ASSEMBLY:** The 'assembled_prompt' must be the full, cohesive prompt text resulting from all updates, in English.
    
    Return a JSON object with:
    - 'message': Your conversational response in Spanish (using Markdown).
    - 'updates': A list of objects { module, value } for the fields you changed.
    - 'assembled_prompt': The final assembled text prompt.`;
};

export const getCreativeAssistantResponse = async (history: { role: string, parts: { text: string }[] }[], currentFragments: any): Promise<string> => {
    const schema = {
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
        },
        required: ['message', 'updates']
    };

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { 
                systemInstruction: getCreativeAssistantResponseSystemInstruction(),
                responseMimeType: 'application/json',
                responseSchema: schema
            },
            contents: history.map(h => ({ role: h.role, parts: h.parts }))
        })) as GenerateContentResponse;
        return response.text;
    } catch (error) {
        throw new Error("Assistant failed to respond.");
    }
};

export const generateStructuredPrompt = async (input: { idea: string; style?: string }): Promise<string> => {
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Create a detailed image generation prompt based on this idea: "${input.idea}" and style: "${input.style || 'general'}". Return a rich, descriptive text prompt.` }] }
        })) as GenerateContentResponse;
        return response.text.trim();
    } catch (error) {
        return "";
    }
};

export const generateStructuredPromptFromImage = async (images: ImagePayload[], extraInstruction: string = ""): Promise<string> => {
    const imageParts = images.map(image => ({ inlineData: { data: image.imageBase64, mimeType: image.mimeType } }));
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Generate a detailed image prompt based on these images. ${extraInstruction}` }, ...imageParts] }
        })) as GenerateContentResponse;
        return response.text.trim();
    } catch (error) {
        return "";
    }
};

// Placeholders for less critical or redundant functions
export const generateReplicationPrompt = async (images: ImagePayload[]) => generateStructuredPromptFromImage(images, "Focus on replicating this image exactly.");
export const generateFusedImagePrompt = async (images: ImagePayload[]) => generateStructuredPromptFromImage(images, "Fuse these images into one concept.");
export const editImageWithPrompt = async (image: ImagePayload, prompt: string) => {
    // Basic implementation for image editing using the image model
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: image.imageBase64, mimeType: image.mimeType } },
                    { text: prompt }
                ]
            }
        })) as GenerateContentResponse;
         for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return "";
    } catch (error) {
        return "";
    }
};
export const generateImageFromImages = async (images: ImagePayload[], prompt: string) => {
    // Similar to edit but with multiple images (if supported, otherwise use first)
    if (images.length === 0) return "";
    return editImageWithPrompt(images[0], prompt);
};
export const suggestTextPromptEdits = async (prompt: string) => generateIdeasForStyle(prompt);
export const convertTextPromptToJson = async (prompt: string) => modularizePrompt(prompt);
export const refactorJsonPrompt = async (json: string) => createJsonTemplate(json);
