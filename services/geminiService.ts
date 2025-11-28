import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { SavedPrompt, ExtractionMode, AssistantResponse } from "../types";

// ... existing throttle logic ...
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
    if (!request) { // Should not happen, but robustly handle to prevent hangs
        isProcessingQueue = false;
        setTimeout(processApiQueue, MIN_REQUEST_INTERVAL); // Retry processing
        return;
    }

    try {
        const result = await request.apiCall();
        request.resolve(result);
    } catch (error) {
        request.reject(error);
    } finally {
        // Ensure the queue continues processing even if a promise resolver has an issue (highly unlikely but robust)
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

export interface PromptSuggestion {
  type: 'ADDITION' | 'REPLACEMENT' | 'REMOVAL';
  description: string;
  data: {
    text_to_add?: string;
    text_to_remove?: string;
    text_to_replace_with?: string;
  };
}

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
                    // Add safety settings to minimize false positives in style analysis, allowing the model to process art.
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
            
            // Fallback: If response.text is empty, try to get text from parts.
            let text = response.text;
            if (!text && candidate?.content?.parts) {
                text = candidate.content.parts.map(p => p.text).join(' ');
            }

            // SAFETY CHECK LOGIC
            let warning: string | undefined;
            
            // Check if any category is HIGH or MEDIUM probability
            const isRisky = candidate?.safetyRatings?.some(rating => 
                rating.probability === 'HIGH' || rating.probability === 'MEDIUM'
            );

            // Determine if the request was blocked specifically due to safety
            const isBlockedBySafety = candidate?.finishReason === 'SAFETY' || (!text && isRisky);

            // CASE 1: BLOCKED (No text generated)
            if (!text) {
                if (isBlockedBySafety) {
                    throw new Error("⚠️ CONTENIDO SENSIBLE DETECTADO: La IA no pudo sanitizar la imagen automáticamente porque el contenido era demasiado explícito. Por favor, elimina la imagen problemática e intenta de nuevo.");
                }
                
                if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
                     throw new Error(`La generación se detuvo por razón: ${candidate.finishReason}`);
                }
                
                throw new Error("La API no devolvió ningún texto. La imagen podría ser compleja o ambigua.");
            }

            // CASE 2: SUCCESS WITH WARNING (Text generated, but risky elements found)
            if (text && isRisky) {
                warning = "⚠️ Aviso de Seguridad: Se detectó contenido potencialmente sensible en una o más imágenes. La IA ha optimizado el análisis para extraer solo los elementos seguros y técnicos, descartando lo demás.";
            }

            return { result: text.trim(), warning };
            
        } catch (error) {
            console.error(`Error calling Gemini API for ${errorContext}:`, error);
            if (error instanceof Error) {
                let msg = error.message;
                // Capture generic safety errors from the SDK that might bypass our logic above
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
    title: { type: Type.STRING, description: 'Título corto y evocador para el estilo.' },
    category: { type: Type.STRING, description: 'Categoría principal del estilo (ej. Cyberpunk Noir).' },
    artType: { type: Type.STRING, description: 'Tipo de arte (ej. Digital Painting).' },
    notes: { type: Type.STRING, description: 'Breve nota descriptiva sobre el estilo.' },
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
                        { text: `Este es el prompt generado: "${prompt}". Estas son las imágenes de referencia:` },
                        ...imageParts,
                        { text: "Genera los metadatos en JSON como se te indicó." },
                    ],
                },
            })) as GenerateContentResponse;
            const jsonString = response.text.trim();
            const metadata = JSON.parse(jsonString) as Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>;
            return metadata;
        } catch (error) {
            console.error(`Error generating metadata with Gemini API for ${errorContext}:`, error);
            if (error instanceof Error) {
                throw new Error(error.message || `No se pudo generar la categorización automática para ${errorContext}.`);
            }
            throw new Error(`No se pudo generar la categorización automática para ${errorContext}.`);
        }
    };
};

// System Instructions Maps
const analysisSystemInstructions: Record<ExtractionMode, string> = {
    style: `You are a state-of-the-art professional image analyst. Your task is to analyze the set of images provided by the user to identify a cohesive and unified visual style present in them. You must generate an optimized prompt that describes ONLY this consolidated visual style.

Purpose and Goals:
*   Meticulously analyze the visual elements of the images to identify a cohesive style.
*   Generate a concise and comprehensive 'prompt', optimized for replicating the artistic style in image generation models.
*   Ensure the 'prompt' focuses exclusively on style (technique, atmosphere, composition, etc.), excluding specific content (characters, objects, scenes).

CRITICAL OUTPUT FORMAT RULE:
*   Your output must be the raw prompt text ONLY.
*   Do NOT include introductory phrases like "The visual style is..." or "Here is the prompt:".
*   Do NOT use markdown headers like "**Optimized Prompt:**".
*   Do NOT provide explanations.
*   The output should start directly with the first descriptor (e.g., "Photorealistic, cinematic lighting...").

CRITICAL SAFETY & SANITIZATION PROTOCOL:
*   If the provided images contain nudity, gore, or potentially sensitive/explicit content, **DO NOT REFUSE** the task.
*   Instead, **SANITIZE** the output: COMPLETELY IGNORE the sensitive subject matter.
*   Focus 100% on the artistic technique, brushstrokes, lighting, color palette, and composition.
*   Your output must be purely technical and artistic, safe for all audiences.
*   **NEVER output an empty string due to safety concerns unless the image is completely prohibited.** Always find safe, neutral details to describe (e.g., "warm lighting", "soft focus", "red color palette").

Behaviors and Rules:
1)  Initial Analysis:
    a) Assume the user has uploaded one or more images for analysis.
    b) If the user describes the style verbally, ask for the image for precise technical analysis.

2)  Prompt Generation:
    a) The generated 'prompt' must be highly descriptive, using technical terminology (e.g., 'volumetric lighting', 'charcoal strokes', 'analogous color palette').
    b) Include essential categories such as: Drawing/Painting Technique, Color Scheme, Lighting Quality, Level of Detail, and General Aesthetic/Mood.
    c) The final 'prompt' must be a single, coherent block of text, with an ideal balance between detail and conciseness. It should be structured as a series of high-quality descriptors and keywords, separated by commas.
    d) Emphasize content neutrality; the 'prompt' must not mention anything from the source image other than the style. The final prompt must be written exclusively in English.
    e) Technical Depth: The prompt must include, where relevant, references to specific painting techniques (e.g., 'impasto', 'sfumato', 'chiaroscuro'), brushstroke types (e.g., 'bold expressive strokes', 'fine delicate lines', 'cross-hatching'), and texture qualities (e.g., 'rough canvas texture', 'smooth glossy enamel', 'weathered wood grain').
    f) Universal Optimization: The prompt must be universally compatible and optimized to work effectively across major image generation platforms (like Midjourney, Stable Diffusion, DALL-E, etc.). Avoid syntax specific to a single platform.

General Tone:
*   Be formal, professional, and highly technically precise.
*   Use sophisticated and analytical vocabulary, befitting a visual arts and technology expert.`,
    subject: `Your mission is to analyze EACH main subject (person or character) in the provided images and generate an individual and optimized description for each one. It is CRITICAL that you capture both their physical identity and their individual VISUAL STYLE. If subjects come from images with different styles (e.g., a realistic photo and a comic drawing), you must faithfully preserve and describe the unique style of EACH ONE.

CRITICAL SAFETY & SANITIZATION PROTOCOL:
*   If a subject is depicted in a sensitive, nude, or explicitly provocative manner, **DO NOT REFUSE**.
*   **SANITIZE** the description: Describe only the neutral physical features (hair, eyes, face structure) and any visible non-explicit clothing/armor.
*   If the subject is nude, DO NOT mention it. Describe them as a "figure" or focus on the face and style.
*   Ignore any explicit poses or gore. Focus on the character archetype.
*   **NEVER output an empty string.** If the image is risky, describe the "safe" parts like hair color, eye color, or general build.

RULES:
1.  **Identify and Label:** If there is more than one distinct subject in the images, identify and label them as "Subject 1:", "Subject 2:", etc. If there is only one subject (even if appearing in multiple images), do not use labels.
2.  **Individual Description and Specific Style:** For EACH subject, create an optimized description, always in English, starting with their visual style.
    - **Visual Style and General Identity (CRITICAL RULE):** ALWAYS START with the visual style (e.g., 'photorealistic', 'comic book style', 'oil painting style') followed by identity (e.g., 'a young woman', 'an old warrior'). This is the most important part for maintaining character consistency.
    - **Key Facial Features:** (e.g., sharp jawline, bright blue eyes, freckles across the nose).
    - **Hair:** (e.g., long wavy blonde hair, short spiky black hair).
    - **Build and Physique:** (e.g., slender build, muscular frame).
    - **Clothing:** Include a description of the clothes worn (e.g., wearing simple peasant clothes, dressed in a suit of simple silver armor).
    - **Expression/Inferred Emotion:** Add a simple description of the apparent emotion or mood (e.g., with a determined gaze, looking calm and serene).
3.  **Consolidation:** If multiple images show the SAME subject, consolidate their characteristics into a single cohesive description for that subject.
4.  **Output Format:** Your output must be the English prompt, with each subject description on a new line if there is more than one. No additional explanations.

EXAMPLE OUTPUT (for two subjects of different styles):
Subject 1: photorealistic young woman with long wavy blonde hair, bright blue eyes, wearing simple peasant clothes, looking calm and serene.
Subject 2: old warrior in a comic book character style, with a long white beard, a scar over the left eye, dressed in a suit of simple silver armor, with a determined gaze.

Focus on inherent physical characteristics, clothing, expression, and the visual style of EACH subject. Ignore the background and general lighting of the scene.`,
    pose: `Exhaustively analyze the body pose of ALL subjects in the image. Your goal is to generate a unique, concise, and optimized description, always in English, that an image generation AI engine can use to replicate the poses with high fidelity.

CRITICAL SAFETY & SANITIZATION PROTOCOL:
*   If the pose is explicitly sexual or suggestive, **SANITIZE** it.
*   Describe the pose in neutral, anatomical terms (e.g., "sitting", "reclining", "standing").
*   Ignore any explicit interactions or contexts. Focus on the geometry of the body.
*   **NEVER output an empty string.**

STRICT RULES:
1.  **Gender Neutrality:** DO NOT include gender (e.g., 'man', 'woman') in your description. Use neutral terms like 'figure', 'person', 'subject'.
2.  **Identify Multiple Subjects:** If there is more than one subject, identify each by their position or a neutral visual feature (e.g., "the figure on the left", "the person in the red coat") and describe their poses separately within the same prompt.
3.  **Individual Description:** For EACH subject, the pose description must be an optimized text block including, in this order:
    a. **Subject Identifier:** Briefly describe the subject to differentiate them using neutral terms.
    b. **Action Verb/Main Posture:** A verb or phrase defining the action (e.g., sitting, leaping, kneeling).
    c. **Body Details:** Torso position, head angle, and gaze (e.g., torso slightly tilted, looking over the shoulder).
    d. **Limb Position:** Placement of arms, hands, legs, and feet (e.g., arms crossed, one hand on the hip).
    e. **Inferred Emotion/Energy:** The emotion or energy conveyed by the pose (e.g., confident and powerful stance, melancholic posture).
4.  **General Perspective:** At the end of the prompt, specify the camera angle if notable for the full scene (e.g., low angle shot, full body view).
5.  **Output Format:** Your output must be a single English prompt, without labels or additional explanations. Join pose descriptions with commas to form a coherent paragraph.

EXAMPLE OUTPUT:
The figure on the left is leaning against a wall, arms crossed, looking thoughtful. The figure on the right is walking towards the camera, with a determined stride and hands in their pockets, confident and powerful stance, full body shot from a medium angle.

Ignore style, background (except for pose interaction), and other details not strictly regarding body pose and conveyed emotion.`,
    expression: `Analyze the facial expression and emotional state of the main character in the image. Your task is to condense this information into a unique, concise, and optimized description, always in English, that an AI engine can immediately use to replicate the expression and emotional tone with high fidelity.

CRITICAL SAFETY PROTOCOL:
*   If the expression is associated with an explicit or violent act, **SANITIZE** it.
*   Focus strictly on the facial muscles (eyes, mouth, brows) and the core emotion (fear, joy, anger) without describing the context or cause if it is sensitive.
*   **NEVER output an empty string.**

The description must be a single optimized text block including, in this order:

Main Emotion and Facial Detail: A key emotional adjective followed by defining facial features (e.g., serene expression, closed eyes and soft smile).

Intensity and Reinforcing Body Language: The strength of the feeling and any complementary gestures (e.g., intense fury, furrowed brow and clenched jaw).

Narrative Vibe and Perspective: The general tone and angle that best capture the expression (e.g., vulnerable close-up shot, triumphant view).

Your output must be the English prompt without any additional labels or explanations.
If there are multiple images, focus on the main character and create a cohesive expression description representing the general emotion or mood. Ignore style, background, clothes, and other details not strictly regarding facial expression and emotion.`,
    scene: `Analyze the environment, setting, and atmosphere surrounding the main character. Your task is to condense this information into a unique, concise, and optimized description, always in English, that an AI engine can use to replicate the setting with high fidelity.

CRITICAL SAFETY PROTOCOL:
*   If the scene contains gore, violence, or explicit elements, **IGNORE** them.
*   Describe the architectural style, the lighting, the weather, and the general location type (e.g., "a dark room", "an outdoor street").
*   Focus on the atmosphere (e.g., "gloomy", "chaotic") without describing the specific sensitive elements.
*   **NEVER output an empty string.**

The description must be a single optimized text block including, in this order:

Environment and Main Location: The type of place and key elements (e.g., massive futuristic cityscape, dense foggy forest, vintage library interior).

Lighting and Time: The quality of light and time of day (e.g., cinematic low light, golden hour illumination, under harsh neon lights).

Atmosphere and Narrative Tone: The feeling or vibe of the setting (e.g., calm and ethereal atmosphere, chaotic and dramatic setting, melancholic mood).

Your output must be the English prompt without any additional labels or explanations.`,
    outfit: `Analyze and break down the outfit, accessories, and design style of the main character. Your task is to condense this information into a unique, concise, and optimized description, always in English, that an AI engine can use to replicate the outfit with high fidelity.

CRITICAL SAFETY PROTOCOL:
*   If the outfit is revealing or fetishistic in a way that triggers safety filters, describe it in neutral fashion terms (e.g., "leather bodysuit", "straps and buckles").
*   Focus on materials, colors, and design lines. Do NOT use sexually explicit terminology.
*   **NEVER output an empty string.**

The description must be a single optimized text block including, in this order:

General Style and Tone: Style classification (e.g., futuristic cyberpunk outfit, elegant vintage high fashion).

Main Garments and Fit: Description of key pieces and their fit (e.g., oversized denim jacket, slim-fit black leather pants, chunky combat boots).

Materials and Colors: Textures, finishes, and predominant color palette (e.g., shiny silk, matte black leather, vibrant green accents).

Crucial Accessories: Details that complete the look (e.g., gold chain belt, aviator sunglasses, elaborate feather hat).

Your output must be the English prompt without any additional labels or explanations.`,
    composition: `Analyze and describe the visual composition and shot setup of the image. Your task is to condense this information into a unique, concise, and optimized description, always in English, that an AI engine can use to replicate the visual structure of the image with high fidelity.

CRITICAL SAFETY PROTOCOL:
*   If the subject matter is sensitive, ignore it entirely.
*   Focus PURELY on the camera angle, lens choice, framing, depth of field, and lighting placement.
*   **NEVER output an empty string.**

The description must be a single optimized text block including, in this order:

Shot Type and Camera Angle: Framing and perspective (e.g., full body shot from a low angle, medium close-up from a bird's eye view).

Composition Rule and Dynamics: How elements are organized (e.g., rule of thirds composition, strong diagonal lines, perfectly symmetrical framing).

Focus and Depth: Sharpness control and blur (e.g., shallow depth of field with background blur, sharp focus on the face, high depth of field).

Subject Placement: Key position within the frame (e.g., subject framed by a doorway, centered subject, leading lines composition).

Your output must be the English prompt without any additional labels or explanations.`,
    color: `Your task is to analyze the use of color in the image and generate an optimized description in English.

**Step 1: Image Analysis**
First, determine if the image is:
A) A scene with content (characters, landscapes, defined objects).
B) Primarily an abstract color palette (color swatches, gradients, without a clear subject).

**Step 2: Prompt Generation based on image type**

**IF IT IS A SCENE WITH CONTENT (A), follow these rules:**
Generate a description specifying the palette and its distribution by zones. Omit HEX codes and use descriptive color names.
1.  **General Scheme:** Describe the color scheme, tone, and saturation (e.g., 'vibrant complementary palette', 'desaturated analogous color scheme').
2.  **Dominant Colors:** Mention the main hues.
3.  **Application by Zones (CRITICAL RULE):** Describe where key colors are located using functional and generic areas. DO NOT use specific garment names.
    *   **Use:** 'hair area', 'skin tone', 'primary garment area', 'secondary garment area', 'background', 'foreground elements', 'main light source color'.
    *   **AVOID:** 'dress', 'hat', 'boots', 'sword'.
    *   **Example:** '...fiery red on the main garment area, deep cobalt blue in the background.'
4.  **Contrast and Quality:** Describe the contrast and general light quality.

**IF IT IS AN ABSTRACT COLOR PALETTE (B), follow these rules:**
Generate a palette description detailed enough for an artist to use.
1.  **Hierarchical Analysis:** Identify and list key colors in a clear hierarchy:
    *   **Dominant Color(s):** The color occupying most area or defining the main tone.
    *   **Secondary Color(s):** Important colors complementing the dominant one.
    *   **Accent Color(s):** Colors appearing in small amounts but visually impactful.
    *   **Relation and Atmosphere:** Describe how colors relate to each other and the atmosphere they create (e.g., 'A harmonious analogous palette featuring a dominant deep forest green, a secondary earthy brown, and vibrant fiery orange and soft cream accent colors, creating a warm and rustic mood').
2.  **Rich Description:** Use descriptive and evocative color names (e.g., 'burnt sienna', 'midnight blue', 'electric magenta', 'mint green').
3.  **DO NOT mention areas** like 'hair area' or 'background'. The prompt must be a general color style description.

**Final Output:** Your output must be a single text block in English, without labels or additional explanations.`,
    object: `Your sole task is to analyze the image to identify the most prominent object and describe it. The object is usually an item that can be held or stands out visually from the character or background.

Strict Rules:
1.  **Identify the Main Object:** First, locate the most important object. If there is a character, the object is something they hold, wear, or is a key accessory (e.g., a sword, a book, a hat, glasses). DO NOT describe the character.
2.  **Describe ONLY the Object:** Your description must focus exclusively on the identified object.
3.  **Output Format:** Generate a unique, concise, and optimized description, always in English. The description must be a single text block including:
    *   **Object Identification:** The clear name of the object (e.g., 'an ornate silver sword', 'a vintage leather-bound book', 'a steaming ceramic coffee mug').
    *   **Key Visual Characteristics:** Its most important attributes (e.g., 'with intricate glowing runes', 'with a worn, cracked cover', 'with a chipped rim').
    *   **Material and Texture:** What it is made of and how its surface looks (e.g., 'polished metallic surface', 'rough, grainy wood texture').

4.  **Exclusions:** Completely ignore the character, their pose, their clothes (unless it is the object), the background, lighting, and artistic style. Your output must be only the object description.

Your output must be the English prompt without any additional labels or explanations.`,
};

const metadataInstructionConfig: Record<ExtractionMode, {
    expert: string;
    feature: string;
    rules: { title: string; category: string; artType: string; notes: string };
}> = {
    style: {
        expert: "curador de arte digital",
        feature: "estilo visual",
        rules: {
            title: "Crea un título corto y evocador para el estilo (ej. 'Cyberpunk Noir').",
            category: "Clasifica el estilo en una categoría general de arte o diseño.",
            artType: "Define la técnica artística principal (ej. 'Digital Painting', 'Photography').",
            notes: "Escribe una breve nota sobre la atmósfera o técnica distintiva."
        }
    },
    subject: {
        expert: "director de casting y diseño de personajes",
        feature: "personaje o sujeto",
        rules: {
            title: "Nombra al personaje o sujeto de forma descriptiva (ej. 'Guerrero Elfo').",
            category: "Clasifica el tipo de personaje (ej. 'Fantasía', 'Sci-Fi', 'Retrato').",
            artType: "Define el estilo de representación del personaje.",
            notes: "Describe brevemente los rasgos más destacados del sujeto."
        }
    },
    pose: {
        expert: "coreógrafo y director de fotografía",
        feature: "pose y acción",
        rules: {
            title: "Describe la acción principal en pocas palabras (ej. 'Salto de Combate').",
            category: "Clasifica el tipo de pose (ej. 'Dinámica', 'Estática', 'Retrato').",
            artType: "N/A (Usa 'Referencia de Pose').",
            notes: "Nota sobre la energía o intención de la pose."
        }
    },
    expression: {
        expert: "director de actores y psicólogo visual",
        feature: "expresión facial y emoción",
        rules: {
            title: "Nombra la emoción dominante (ej. 'Ira Contenida').",
            category: "Clasifica la emoción (ej. 'Dramática', 'Sutil', 'Alegre').",
            artType: "N/A (Usa 'Referencia de Expresión').",
            notes: "Nota sobre los matices de la expresión."
        }
    },
    scene: {
        expert: "diseñador de escenarios y entornos",
        feature: "entorno y ambientación",
        rules: {
            title: "Pon título al lugar o escenario (ej. 'Bosque Encantado').",
            category: "Clasifica el tipo de entorno (ej. 'Exterior', 'Interior', 'Paisaje').",
            artType: "Define el estilo del entorno.",
            notes: "Nota sobre la atmósfera y elementos clave del lugar."
        }
    },
    outfit: {
        expert: "diseñador de moda y vestuario",
        feature: "vestimenta y accesorios",
        rules: {
            title: "Nombra el conjunto o prenda principal (ej. 'Armadura de Placas').",
            category: "Clasifica el estilo de ropa (ej. 'Futurista', 'Medieval', 'Casual').",
            artType: "N/A (Usa 'Diseño de Vestuario').",
            notes: "Nota sobre materiales y estilo del outfit."
        }
    },
    object: {
        expert: "diseñador de props y objetos",
        feature: "objeto o ítem",
        rules: {
            title: "Nombra el objeto (ej. 'Espada Ancestral').",
            category: "Clasifica el tipo de objeto (ej. 'Arma', 'Herramienta', 'Accesorio').",
            artType: "Define el estilo del objeto.",
            notes: "Nota sobre los detalles y materiales del objeto."
        }
    },
    composition: {
        expert: "director de fotografía",
        feature: "composición y encuadre",
        rules: {
            title: "Describe el tipo de plano (ej. 'Primer Plano Cenital').",
            category: "Clasifica la técnica de composición.",
            artType: "N/A (Usa 'Técnica Fotográfica').",
            notes: "Nota sobre el ángulo, foco y distribución visual."
        }
    },
    color: {
        expert: "colorista y teórico del color",
        feature: "paleta de colores",
        rules: {
            title: "Nombra la paleta (ej. 'Atardecer Neón').",
            category: "Clasifica el esquema de color (ej. 'Cálido', 'Frío', 'Complementario').",
            artType: "N/A (Usa 'Paleta de Color').",
            notes: "Nota sobre las emociones que evocan los colores."
        }
    }
};

const createMetadataSystemInstruction = (
    expert: string,
    feature: string,
    rules: { title: string; category: string; artType: string; notes: string }
) => {
    return `Eres un ${expert}. Tu tarea es analizar un prompt descriptivo de un ${feature} y las imágenes de referencia asociadas. Basado en este análisis, debes generar metadatos estructurados en formato JSON.

Reglas:
1.  **Título (title):** ${rules.title}
2.  **Categoría (category):** ${rules.category}
3.  **Tipo de Arte (artType):** ${rules.artType}
4.  **Notas (notes):** ${rules.notes}

Analiza el siguiente prompt y las imágenes asociadas y devuelve SOLO el objeto JSON con la estructura especificada.`;
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
  if (!analysisFunctions[mode]) {
    throw new Error(`Modo de análisis no válido: ${mode}`);
  }
  return analysisFunctions[mode](images);
};

// ... (Rest of the file remains unchanged, exporting other functions) ...
export const generateFeatureMetadata = (
  mode: ExtractionMode,
  prompt: string,
  images: ImagePayload[]
): Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>> => {
  if (!metadataFunctions[mode]) {
    throw new Error(`Modo de metadatos no válido: ${mode}`);
  }
  return metadataFunctions[mode](prompt, images);
};
// ... existing helper functions ...
export const generateStructuredPromptMetadata = async (
  prompt: string, 
  image?: ImagePayload
): Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>> => {
   // ... implementation same as before
   const metadataSystemInstruction = `Eres un curador de prompts de IA. Tu tarea es analizar un prompt JSON estructurado y su imagen de referencia (si se proporciona). Genera metadatos concisos y evocadores en formato JSON.

  Reglas:
  1.  **Título (title):** Crea un título corto y descriptivo a partir de los campos 'subject' o 'prompt_description' del JSON. Si es una plantilla con placeholders, dale un título que refleje su propósito (ej. "Plantilla de Personaje Cinemático").
  2.  **Categoría/Estilo (category):** Infiere una categoría general como 'Retrato Sci-Fi', 'Paisaje Fantástico', 'Escena Urbana Cinematográfica'. Para plantillas, usa 'Plantilla'.
  3.  **Tipo de Arte (artType):** Infiere el tipo de arte a partir de campos como 'technical_details' o el estilo general (ej. '3D Render', 'Fotografía Cinematográfica'). Para plantillas, usa 'Plantilla JSON'.
  4.  **Notas (notes):** Escribe una breve nota (1-2 frases) que resuma la esencia del prompt o el propósito de la plantilla.

  Analiza el siguiente prompt JSON y la imagen asociada (si existe) y devuelve SOLO el objeto JSON con la estructura especificada.`;
  
  const parts = [
      { text: `Este es el prompt JSON generado: \`\`\`json\n${prompt}\n\`\`\`.` },
      ...(image ? [
          { text: "Esta es la imagen de referencia:" },
          {
              inlineData: {
                  data: image.imageBase64,
                  mimeType: image.mimeType,
              },
          }
      ] : []),
      { text: "Genera los metadatos en JSON como se te indicó." }
  ];

  try {
      const response = await callApiThrottled(ai => ai.models.generateContent({
          model: 'gemini-2.5-flash',
          config: {
              systemInstruction: metadataSystemInstruction,
              responseMimeType: "application/json",
              responseSchema: metadataResponseSchema,
          },
          contents: { parts },
      })) as GenerateContentResponse;

      const jsonString = response.text.trim();
      const metadata = JSON.parse(jsonString) as Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>;
      return metadata;
  } catch (error) {
      console.error("Error generating structured prompt metadata with Gemini API:", error);
      throw new Error("No se pudo generar la categorización automática para el prompt estructurado.");
  }
};


export const generateStructuredPrompt = async (promptData: { idea: string; style?: string }): Promise<string> => {
    // ... implementation same as before
     const { idea, style } = promptData;

    let userPrompt = `Analiza la siguiente idea y genera el prompt JSON estructurado: "${idea}"`;
    if (style && style.trim()) {
        userPrompt += `\n\nFusiona la idea anterior con el siguiente prompt de estilo, aplicando las características del estilo al contenido de la idea: "${style}"`;
    }

    const structuredPromptSystemInstruction = `Eres un experto en la creación de prompts JSON para IA de generación de imágenes. Tu tarea es convertir la entrada del usuario en un prompt JSON estructurado y optimizado, adaptando tu enfoque según la complejidad de la entrada.

**Análisis y Lógica de Decisión (Paso a Paso):**

1.  **Evalúa la Entrada:** Primero, analiza el prompt proporcionado por el usuario. Determina si es:
    a)  **Una Idea Simple:** Corta, conceptual, con pocos detalles técnicos (ej: "un gato con sombrero de mago", "una ciudad futurista bajo la lluvia").
    b)  **Un Prompt Elaborado:** Detallado, más largo, y probablemente contiene palabras clave técnicas o estilísticas (ej: "close-up portrait of a rogue, dramatic cinematic lighting, shallow depth of field, 85mm lens, hyperdetailed, artstation").

2.  **Ejecuta la Tarea Correspondiente:**

    *   **Si es una Idea Simple:** Tu objetivo es la **expansión creativa**.
        *   Toma la idea central.
        *   Selecciona la plantilla JSON más adecuada de las que conoces ("Retrato en Auto Vintage" para retratos, "Guardián de Roca" para escenas épicas, etc.).
        *   Rellena creativamente los campos del JSON para construir una escena completa y detallada, añadiendo detalles lógicos que enriquezcan la idea original.

    *   **Si es un Prompt Elaborado:** Tu objetivo es la **reestructuración fiel**.
        *   **NO inventes nuevos detalles.** Tu misión es traducir el prompt existente a una estructura JSON.
        *   Analiza el prompt del usuario y extrae sus componentes.
        *   Mapea cada componente al campo correspondiente en una plantilla JSON adecuada. (ej: "close-up portrait" va a \`composition.framing\`, "85mm lens" va a \`technical_details.lens\`, "cinematic lighting" va a \`lighting_and_colors.style\`).
        *   El JSON final debe ser una representación estructurada y fiel del prompt original del usuario.

**Regla de Fusión (Si se proporcionan 'idea' y 'estilo'):**

*   Si el input contiene una 'idea' Y un 'estilo' separados, esta regla tiene prioridad. Fusiona los dos: usa la 'idea' para el contenido (sujeto, escena) y el 'estilo' para los detalles visuales (color, técnica, composición).

**Output Final:**

*   Devuelve únicamente el objeto JSON final, válido, optimizado y sin texto adicional.`;

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: structuredPromptSystemInstruction,
                responseMimeType: "application/json",
            },
            contents: {
                parts: [{ text: userPrompt }]
            }
        })) as GenerateContentResponse;
        
        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return JSON.stringify(parsedJson, null, 2);

    } catch (error) {
        console.error("Error calling Gemini API for structured prompt:", error);
        if (error instanceof SyntaxError) {
            throw new Error("El modelo de IA devolvió un JSON inválido. Inténtalo de nuevo con una idea más clara.");
        }
        throw new Error("No se pudo generar el prompt estructurado.");
    }
};

export const generateReplicationPrompt = async (image: ImagePayload): Promise<string> => {
    // ... implementation same as before
     try {
        const imagePart = {
            inlineData: {
                data: image.imageBase64,
                mimeType: image.mimeType,
            },
        };
        const replicationPromptSystemInstruction = `Eres un analista de imágenes experto. Tu tarea es crear un prompt JSON estructurado y detallado para replicar la imagen proporcionada con la mayor fidelidad posible. Analiza exhaustivamente el sujeto, el entorno, la composición, la iluminación, la paleta de colores y el estilo artístico.

Reglas:
1.  **Analiza la Imagen:** Descompón todos los elementos visuales clave.
2.  **Selecciona una Plantilla:** Utiliza la estructura de la plantilla "Retrato en Auto Vintage" para retratos y escenas centradas en personajes, o la plantilla "Guardián de Roca" para escenas de fantasía, paisajes o composiciones complejos.
3.  **Completa el JSON:** Rellena cada campo del JSON de forma descriptiva y precisa basándote en tu análisis. Describe el contenido específico de la imagen (el sujeto, la acción, el lugar) y su estilo técnico.
4.  **Output:** Devuelve únicamente el objeto JSON final, válido y conciso. No incluyas texto explicativo antes o después del JSON.

Ejemplo de estructura a seguir (adaptar según la plantilla elelección):
{
  "prompt_description": "A detailed description of the entire scene.",
  "face_reference": { "instruction": "If a person is present, describe instructions to keep them consistent. Otherwise, omit or state N/A." },
  "scene_and_environment": { "location": "...", "interior": "...", "weather": "...", "details": "..." },
  "lighting_and_colors": { "style": "...", "sources": "...", "effect": "...", "quality": "..." },
  "composition": { "angle": "...", "framing": "...", "subject_pose": "...", "expression": "...", "background": "..." },
  "technical_details": { "lens": "...", "effects": [], "textures": [] },
  "quality": { "resolution": "Ultra high-resolution, 8K", "details": "Hyperdetailed textures", "finish": "A description of the overall finish, e.g., 'Realistic grain for a cinematic filmic look'" }
}`;

        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: replicationPromptSystemInstruction,
                responseMimeType: "application/json",
            },
            contents: {
                parts: [
                    { text: "Analiza esta imagen y genera un prompt JSON detallado para replicarla." },
                    imagePart
                ]
            }
        })) as GenerateContentResponse;
        
        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return JSON.stringify(parsedJson, null, 2);

    } catch (error) {
        console.error("Error calling Gemini API for replication prompt:", error);
        if (error instanceof SyntaxError) {
            throw new Error("El modelo de IA devolvió un JSON inválido. Inténtalo de nuevo.");
        }
        throw new Error("No se pudo generar el prompt de replicación.");
    }
};

export const generateStructuredPromptFromImage = async (images: ImagePayload[], style?: string): Promise<string> => {
     // ... implementation same as before
     const imageParts = images.map(image => ({
        inlineData: {
            data: image.imageBase64,
            mimeType: image.mimeType,
        },
    }));

    const textParts = [
        { text: `Analiza ${images.length > 1 ? 'estas imágenes' : 'esta imagen'} y genera un prompt JSON estructurado.` }
    ];

    if (style && style.trim()) {
        textParts.push({ text: `Aplica el siguiente prompt de estilo al contenido de la${images.length > 1 ? 's' : ''} imagen${images.length > 1 ? 'es' : ''}: "${style}"` });
    } else {
        textParts.push({ text: `El objetivo es una replicación fiel y mejorada de la${images.length > 1 ? 's' : ''} imagen${images.length > 1 ? 'es' : ''} en formato JSON.` });
    }
    
    const structuredPromptFromImageSystemInstruction = `Eres un experto en la creación de prompts JSON para IA de generación de imágenes. Tu tarea es convertir la entrada del usuario en un prompt JSON estructurado. La entrada consistirá en una o varias imágenes de referencia (para el contenido) y un prompt de estilo de texto opcional (para la estética).

**Lógica de Decisión (Paso a Paso):**

1.  **Analiza la(s) Imagen(es) de Referencia:** Identifica el sujeto principal (si hay varias imágenes, crea una descripción cohesiva que represente sus características consistentes), los elementos de la escena, la acción y la composición básica. Esta será la base del **contenido** del prompt JSON.

2.  **Analiza el Prompt de Estilo (si se proporciona):** Extrae todos los descriptores visuales, técnicos y atmosféricos del prompt de texto. Esto incluye la paleta de colores, el estilo de iluminación, la técnica artística, el tipo de lente, la composición, etc.

3.  **Fusiona Contenido y Estilo:**
    *   Usa el **contenido** de la(s) imagen(es) como base para los campos \`subject\`, \`scene_and_environment\`, \`subject_pose\`, etc.
    *   Usa el **estilo** del texto para poblar o sobrescribir los campos \`lighting_and_colors\`, \`technical_details\`, \`composition\`, y la descripción general del estilo en \`prompt_description\`.
    *   El objetivo es que el sujeto de la(s) imagen(es) sea renderizado con la estética descrita en el prompt de texto.

4.  **Si NO se proporciona Prompt de Estilo:** Tu tarea es simplemente crear un prompt JSON de **replicación fiel y mejorada**. Analiza la(s) imagen(es) en su totalidad (contenido y estilo) y rellena todos los campos del JSON para describirla(s) con el mayor detalle posible, elaborando sobre la base para crear un prompt rico y completo.

**Output Final:**

*   Devuelve únicamente el objeto JSON final, válido, optimizado y sin texto adicional.`;

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: structuredPromptFromImageSystemInstruction,
                responseMimeType: "application/json",
            },
            contents: {
                parts: [
                    ...textParts,
                    ...imageParts
                ]
            }
        })) as GenerateContentResponse;

        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return JSON.stringify(parsedJson, null, 2);

    } catch (error) {
        console.error("Error calling Gemini API for structured prompt from image:", error);
        if (error instanceof SyntaxError) {
            throw new Error("El modelo de IA devolvió un JSON inválido.");
        }
        throw new Error("No se pudo generar el prompt estructurado desde la imagen.");
    }
};

export const generateFusedImagePrompt = async (subjectImage: ImagePayload, styleImage: ImagePayload): Promise<string> => {
     // ... implementation same as before
     try {
        const subjectImagePart = {
            inlineData: {
                data: subjectImage.imageBase64,
                mimeType: subjectImage.mimeType,
            },
        };
        const styleImagePart = {
            inlineData: {
                data: styleImage.imageBase64,
                mimeType: styleImage.mimeType,
            },
        };
        const fusionImageSystemInstruction = `Eres un director de arte de IA experto en fusión de conceptos visuales. Tu tarea es analizar dos imágenes proporcionadas y generar un único prompt JSON estructurado.

**Objetivo Principal:** Extraer el **sujeto** de la "Imagen del Sujeto" y aplicarle el **estilo visual completo** (composición, iluminación, paleta de colores, atmósfera, técnica artística) de la "Imagen de Estilo".

**Reglas Estrictas:**

1.  **Identificación de Roles:**
    *   **Imagen 1 (Sujeto Primario):** El contenido principal. Identifica el personaje, objeto o elemento central. Sus características intrínsecas (ropa, forma, identidad) deben preservarse.
    *   **Imagen 2 (Referencia Estilística):** La guía visual. Analiza su composición, ángulo de cámara, esquema de iluminación, paleta de colores, texturas, nivel de detalle y *mood* general. Ignora su sujeto específico.

2.  **Proceso de Fusión:**
    *   **NO describas ambas imágenes por separado.** El objetivo es una síntesis creativa.
    *   **Toma el sujeto de la Imagen 1.** Colócalo en una nueva escena que esté completamente definida por las características estilísticas de la Imagen 2.
    *   **Describe la nueva escena combinada** en el prompt JSON, utilizando un formato modular y detallado. Por ejemplo, la \`composition\` del JSON debe reflejar la de la Imagen 2, pero aplicada al sujeto de la Imagen 1.

3.  **Estructura del JSON:**
    *   Utiliza una plantilla robusta como "Retrato en Auto Vintage" o "Guardián de Roca" como base.
    *   Rellena cada campo (e.g., \`scene_and_environment\`, \`lighting_and_colors\`, \`composition\`, \`technical_details\`) basándote exclusivamente en la **Imagen de Estilo (Imagen 2)**.
    *   El campo \`subject\` o \`prompt_description\` debe describir al **Sujeto (Imagen 1)** pero ya inmerso en el nuevo entorno estilizado.

4.  **Output:** Devuelve únicamente el objeto JSON final, válido y conciso. No incluyas texto explicativo antes o después del JSON.`;


        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: fusionImageSystemInstruction,
                responseMimeType: "application/json",
            },
            contents: {
                parts: [
                    { text: "Imagen 1 (Sujeto Primario):" },
                    subjectImagePart,
                    { text: "Imagen 2 (Referencia Estilística):" },
                    styleImagePart,
                    { text: "Fusiona el sujeto de la Imagen 1 con el estilo de la Imagen 2 y genera el prompt JSON estructurado." }
                ]
            }
        })) as GenerateContentResponse;
        
        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return JSON.stringify(parsedJson, null, 2);

    } catch (error) {
        console.error("Error calling Gemini API for fused image prompt:", error);
        if (error instanceof SyntaxError) {
            throw new Error("El modelo de IA devolvió un JSON inválido. Inténtalo de nuevo.");
        }
        throw new Error("No se pudo generar el prompt de fusión de imágenes.");
    }
};

export const editImageWithPrompt = async (
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  // ... implementation same as before
   try {
    const response = await callApiThrottled(ai => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    })) as GenerateContentResponse;

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("La API no devolvió ninguna imagen.");
  } catch (error) {
    console.error("Error editing image with Gemini API:", error);
    throw new Error("No se pudo editar la imagen.");
  }
};


export const generateImageFromImages = async (
  subjectImage: ImagePayload,
  styleImage: ImagePayload
): Promise<string> => {
  // ... implementation same as before
   try {
    const response = await callApiThrottled(ai => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: 'Toma el sujeto de la primera imagen y aplícale el estilo visual completo (composición, iluminación, paleta de colores, atmósfera, técnica artística) de la segunda imagen para crear una nueva imagen.',
          },
          {
            inlineData: {
              data: subjectImage.imageBase64,
              mimeType: subjectImage.mimeType,
            },
          },
          {
            inlineData: {
              data: styleImage.imageBase64,
              mimeType: styleImage.mimeType,
            },
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    })) as GenerateContentResponse;

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("La API no devolvió ninguna imagen.");
  } catch (error) {
    console.error("Error generating image from images with Gemini API:", error);
    throw new Error("No se pudo generar la imagen fusionada.");
  }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
  // ... implementation same as before
   try {
    // A more descriptive prompt for better covers
    const generationPrompt = `Create a visually stunning, high-quality, cinematic image that artistically represents the following concept: ${prompt}`;
    
    // Switch to gemini-2.5-flash-image which is generally available on free tier, unlike Imagen.
    const response = await callApiThrottled(ai => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
            { text: generationPrompt }
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    })) as GenerateContentResponse;

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("La API no devolvió ninguna imagen.");

  } catch (error) {
    console.error("Error generating image from prompt with Gemini API:", error);
    if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
            throw new Error("Límite de cuota excedido para generación de imágenes. Esta función puede requerir una API Key de pago o esperar a que se restablezca el límite diario del plan gratuito.");
        }
        throw new Error(error.message || "No se pudo generar la imagen de portada.");
    }
    throw new Error("No se pudo generar la imagen de portada.");
  }
};

export const generateIdeasForStyle = async (stylePrompt: string): Promise<string[]> => {
    // ... implementation same as before
     const ideasSystemInstruction = `Eres un director creativo y conceptual. Tu tarea es analizar un prompt de estilo visual y, basándote en él, generar entre 3 y 5 ideas de escenas cortas, evocadoras y únicas. Las ideas deben ser concisas (máximo 10-15 palabras cada una).

    Reglas:
    1.  Analiza la esencia del estilo (atmósfera, colores, técnica).
    2.  Genera ideas de escenas o sujetos que se verían espectaculares con esa estética.
    3.  Sé creativo y evita clichés obvios.
    4.  Devuelve el resultado como un array de strings en formato JSON. Solo el array, sin texto adicional.`;

    const ideasResponseSchema = {
        type: Type.ARRAY,
        items: { type: Type.STRING },
    };

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: ideasSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: ideasResponseSchema,
            },
            contents: {
                parts: [
                    { text: `Este es el prompt de estilo: "${stylePrompt}". Genera las ideas como se te indicó.` },
                ]
            }
        })) as GenerateContentResponse;

        const jsonString = response.text.trim();
        const ideas = JSON.parse(jsonString) as string[];
        return ideas;
    } catch (error) {
        console.error("Error generating ideas with Gemini API:", error);
        throw new Error("No se pudo generar ideas para el estilo.");
    }
};

export const assembleMasterPrompt = async (fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
     // ... implementation same as before
     const masterAssemblerSystemInstruction = `Tu única misión es actuar como un sistema experto de ensamblaje de prompts. Debes combinar los fragmentos de texto proporcionados por el usuario para construir un prompt maestro en inglés, que sea coherente, optimizado y libre de conflictos, siguiendo un sistema de reglas jerárquicas estrictas.

**El Sistema de Reglas Jerárquicas**

Cada módulo tiene un dominio de control. La información de un módulo de mayor prioridad **elimina y reemplaza** la información conflictiva de cualquier módulo de menor prioridad. Procesa los fragmentos siguiendo esta jerarquía antes del ensamblaje final.

**JERARQUÍA DE CONTROL (DE MAYOR A MENOR PRIORIDAD):**

1.  **ESTILO (Estilo Artístico y Calidad Técnica):**
    *   **Dominio:** La estética general de la imagen.
    *   **Acción:** Este módulo tiene la **prioridad absoluta**. Su contenido DICTA el estilo visual y la calidad técnica. DEBES eliminar CUALQUIER descriptor de estilo en conflicto (ej. 'photorealistic', 'anime style', 'oil painting') y términos de calidad (ej. '8K', 'hyperdetailed', 'Unreal Engine') de TODOS los demás módulos, especialmente de 'SUJETO' y 'COMPOSICION'.
    *   **Si está ausente:** Se conservan los estilos individuales definidos en 'SUJETO'. Los términos de calidad de otros módulos se añaden al final del prompt.

2.  **PALETA DE COLORES (Colorista Experto):**
    *   **Dominio:** El esquema de color de toda la imagen.
    *   **Acción:** Esta es una regla de **REESCRITURA CREATIVA**. NO añadas el texto de este módulo directamente. En su lugar, analiza la paleta descrita (colores dominantes, secundarios, de acento) y úsala para **RE-COLOREAR** de forma inteligente y artística los elementos en 'SUJETO', 'OUTFIT', 'ESCENA' y 'OBJETO'. El texto original del módulo 'COLOR' se consume en este proceso y **NUNCA debe aparecer** en el prompt final.
    *   **Si está ausente:** Se conservan los colores descritos en los otros módulos.

3.  **COMPOSICIÓN (Director de Fotografía):**
    *   **Dominio:** Encuadre, ángulo de cámara, foco y reglas de composición.
    *   **Acción:** Su contenido DICTA la toma. DEBES eliminar cualquier descripción de perspectiva o encuadre (ej. 'low angle shot', 'full body shot', 'shallow depth of field') del módulo 'ESCENA'.
    *   **Si está ausente:** El módulo 'ESCENA' puede describir la composición.

4.  **OUTFIT (Diseñador de Vestuario):**
    *   **Dominio:** La vestimenta del sujeto.
    *   **Acción:** Este módulo es la **única fuente de verdad** para la ropa. DEBES eliminar CUALQUIER mención de vestimenta, armadura o accesorios de los módulos 'SUJETO', 'POSE' y 'EXPRESION'.
    *   **Si está ausente:** El módulo 'SUJETO' se convierte en la fuente principal para la vestimenta.

5.  **POSE (Coreógrafo):**
    *   **Dominio:** La postura corporal y la acción.
    *   **Acción:** Su contenido DICTA el lenguaje corporal. DEBES eliminar las descripciones de posturas conflictivas (ej. 'hombros caídos') del módulo 'EXPRESION'.
    *   **Si está ausente:** El módulo 'EXPRESION' puede describir el lenguaje corporal básico para dar contexto a la emoción.

6.  **SUJETO (Director de Casting):**
    *   **Dominio:** La identidad física del sujeto.
    *   **Acción:** Su contenido DICTA los rasgos físicos inherentes (ej. edad, cabello, ojos, estructura facial). DEBES eliminar estas descripciones de identidad del módulo 'EXPRESION'.

**Reglas Especiales de Integración (Aplicadas durante el ensamblaje):**

*   **Integración de OBJETO:** El módulo 'OBJETO' describe un ítem. Tu tarea es **integrarlo de forma natural** en la descripción de 'SUJETO' o 'POSE', no simplemente añadirlo al final.
    *   *Ejemplo:* SUJETO:"un guerrero" + OBJETO:"una espada brillante" -> **Resultado:** "un guerrero sosteniendo una espada brillante" (a warrior holding a glowing sword).

*   **Asignación SUJETO-POSE:** Si 'SUJETO' contiene múltiples sujetos ('Subject 1:', 'Subject 2:') y 'POSE' contiene múltiples poses ('La figura de la izquierda...', 'la persona de la derecha...'), debes **asignar cada pose a un sujeto en orden secuencial**, eliminando las etiquetas para crear una descripción fluida. Si las cantidades no coinciden, prioriza los sujetos y asigna las poses disponibles.

**Ensamblaje Final**

Después de aplicar TODAS las reglas de filtrado e integración, ensambla los fragmentos de texto limpios y resultantes en un **único bloque de texto en inglés, separado por comas**. El orden final DEBE ser el siguiente:
**Sujeto, Pose, Expresión, Outfit, Objeto, Escena, Composición, Estilo.**

Tu salida debe ser únicamente este prompt final. Sin explicaciones, sin etiquetas, solo el resultado.`;

    const priorityOrder: ExtractionMode[] = ['subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'composition', 'style'];
    
    const promptPieces = priorityOrder
        .filter(key => fragments[key as ExtractionMode])
        .map(key => `${key.toUpperCase()}: "${fragments[key as ExtractionMode]}"`);

    if (promptPieces.length === 0) {
        throw new Error("No hay fragmentos para ensamblar.");
    }
    
    const assemblyRequest = `Ensambla los siguientes fragmentos en un prompt maestro coherente, siguiendo las reglas: \n${promptPieces.join('\n')}`;

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: masterAssemblerSystemInstruction,
            },
            contents: { parts: [{ text: assemblyRequest }] },
        })) as GenerateContentResponse;

        const text = response.text;
        if (!text) {
            throw new Error("La API no devolvió ningún texto para el ensamblaje.");
        }
        return text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for master prompt assembly:", error);
        throw new Error("No se pudo ensamblar el prompt maestro.");
    }
};

export const generateNegativePrompt = async (positivePrompt: string): Promise<string> => {
    const systemInstruction = `You are an expert AI Prompt Engineer. Your task is to generate a comprehensive "Negative Prompt" based on the provided positive prompt. 
    
    A negative prompt lists elements that should be EXCLUDED from the image generation to ensure high quality and adhere to the intended style.

    **Rules:**
    1.  **Analyze the Positive Prompt:** Understand the style (e.g., photorealistic, anime, sketch) and content.
    2.  **Standard Quality Exclusions:** Always include standard quality assurance terms (e.g., "blurry, low quality, bad anatomy, watermark, text, signature").
    3.  **Context-Aware Exclusions:**
        *   If the style is "photorealistic", exclude terms like "cartoon, drawing, illustration, 3d render, anime".
        *   If the style is "drawing/sketch", exclude "photorealistic, photograph".
        *   If the subject is a "solo portrait", exclude "multiple people, extra limbs".
    4.  **Output:** Return ONLY the negative prompt string, separated by commas. Do not add labels like "Negative Prompt:".`;

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
            },
            contents: { parts: [{ text: `Generate a negative prompt for this positive prompt: "${positivePrompt}"` }] },
        })) as GenerateContentResponse;

        const text = response.text;
        if (!text) {
             throw new Error("La API no devolvió ningún texto para el prompt negativo.");
        }
        return text.trim();
    } catch (error) {
        console.error("Error generating negative prompt:", error);
        throw new Error("No se pudo generar el prompt negativo.");
    }
};

export const generateMasterPromptMetadata = async (prompt: string, images: ImagePayload[]): Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>> => {
     // ... implementation same as before
     const metadataSystemInstruction = `Eres un curador de arte y catalogador experto. Tu tarea es analizar un prompt maestro que ha sido ensamblado a partir de varios componentes (pose, estilo, escena, etc.) y las imágenes de referencia que lo inspiraron. Basado en este análisis, debes generar metadatos estructurados en formato JSON.

    Reglas:
    1.  **Título (title):** Crea un título corto y evocador para la escena completa descrita en el prompt. Máximo 5-7 palabras.
    2.  **Categoría/Estilo (category):** Identifica la categoría principal de la composición final. Ejemplos: 'Retrato de Personaje Fantástico', 'Escena Urbana Neo-Noir', 'Composición Surrealista'.
    3.  **Tipo de Arte (artType):** Clasifica el tipo de arte basándote en la estética general. Ejemplos: 'Ilustración Digital Cinematográfica', 'Concept Art Detallado', 'Composición Fotográfica'.
    4.  **Notas (notes):** Escribe una breve nota (1-2 frases) que describa la esencia de la imagen final que se podría generar con este prompt.

    Analiza el siguiente prompt y las imágenes asociadas y devuelve SOLO el objeto JSON con la estructura especificada.`;

    const imageParts = images.filter(Boolean).map(image => ({
      inlineData: {
        data: image.imageBase64,
        mimeType: image.mimeType,
      },
    }));

    try {
      const response = await callApiThrottled(ai => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: metadataSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: metadataResponseSchema,
        },
        contents: {
          parts: [
            { text: `Este es el prompt maestro generado: "${prompt}".` },
            ...(imageParts.length > 0 ? [{ text: `Estas son las imágenes de referencia:` }, ...imageParts] : []),
            { text: "Genera los metadatos en JSON como se te indicó." },
          ],
        },
      })) as GenerateContentResponse;

      const jsonString = response.text.trim();
      const metadata = JSON.parse(jsonString) as Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>;
      return metadata;
    } catch (error) {
      console.error("Error generating master prompt metadata with Gemini API:", error);
      throw new Error("No se pudo generar la categorización automática para el prompt maestro.");
    }
};

export const suggestTextPromptEdits = async (prompt: string): Promise<PromptSuggestion[]> => {
    // ... implementation same as before
     const systemInstruction = `You are an expert prompt engineering. Analyze the user's text prompt for an image generation AI. Your goal is to refine it for better results. Provide 3-4 concise, actionable suggestions in English.
    
The suggestions can be one of three types:
- ADDITION: To add detail, atmosphere, or technical specificity.
- REPLACEMENT: To replace weak or vague terms with more powerful, specific ones.
- REMOVAL: To remove redundant, contradictory, or low-value parts.

Return a JSON array of objects, each representing a suggestion. Each object must have:
- 'type': a string that is 'ADDITION', 'REPLACEMENT', or 'REMOVAL'.
- 'description': a string in English that clearly and concisely describes the suggestion to the user.
- 'data': an object containing the data to apply the suggestion. All text values within 'data' must also be in English.
  - For 'ADDITION': { "text_to_add": "text to add" }
  - For 'REPLACEMENT': { "text_to_remove": "text to replace", "text_to_replace_with": "new text" }
  - For 'REMOVAL': { "text_to_remove": "text to remove" }

IMPORTANT: The value of 'text_to_remove' must be an EXACT substring that exists in the original prompt. The 'text_to_add' and 'text_to_replace_with' should be high-quality prompt keywords. Return ONLY the JSON array.`;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, description: "Type of suggestion: 'ADDITION', 'REPLACEMENT', or 'REMOVAL'." },
                description: { type: Type.STRING, description: "Description of the suggestion in English for the user." },
                data: {
                    type: Type.OBJECT,
                    properties: {
                        text_to_add: { type: Type.STRING },
                        text_to_remove: { type: Type.STRING },
                        text_to_replace_with: { type: Type.STRING },
                    },
                    propertyOrdering: ["text_to_add", "text_to_remove", "text_to_replace_with"],
                }
            },
            required: ['type', 'description', 'data'],
            propertyOrdering: ["type", "description", "data"],
        },
    };

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            },
            contents: { parts: [{ text: `Analyze this prompt: "${prompt}"` }] }
        })) as GenerateContentResponse;
        const jsonString = response.text.trim();
        return JSON.parse(jsonString) as PromptSuggestion[];
    } catch (error) {
        console.error("Error generating prompt suggestions with Gemini API:", error);
        throw new Error("No se pudieron generar sugerencias.");
    }
};

export const convertTextPromptToJson = async (prompt: string): Promise<string> => {
    // ... implementation same as before
     const systemInstruction = `Eres un experto en la creación de prompts JSON para IA de generación de imágenes. Tu tarea es analizar un prompt de texto detallado y convertirlo a un formato JSON estructurado. El objetivo es una reestructuración fiel sin perder información ni añadir nuevos detalles. Analiza el prompt del usuario, extrae sus componentes (sujeto, estilo, composición, etc.) y mapea cada uno al campo correspondiente en una plantilla JSON adecuada. El JSON final debe ser una representación estructurada y fiel del prompt original. Devuelve únicamente el objeto JSON final, válido y optimizado.`;
    
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
                responseMimeType: "application/json",
            },
            contents: { parts: [{ text: `Convierte el siguiente prompt a JSON: "${prompt}"` }] }
        })) as GenerateContentResponse;
        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return JSON.stringify(parsedJson, null, 2);
    } catch (error) {
        console.error("Error converting prompt to JSON with Gemini API:", error);
        throw new Error("No se pudo convertir el prompt a JSON.");
    }
};

export const refactorJsonPrompt = async (prompt: string): Promise<{ refactored_prompt: string; explanation: string; }> => {
    // ... implementation same as before
    const systemInstruction = `You are an expert AI prompt engineer specializing in optimizing JSON structures for image generation. Your task is to analyze the user-provided JSON prompt and refactor it to improve its modularity, clarity, and ease of use.

Reglas:
1.  **Analyze Structure:** Examine the organization of fields, nesting, and the granularity of information.
2.  **Identify Improvements:** Look for opportunities to:
    *   **Reorganize fields:** Group related keys under a more logical parent (e.g., move 'lens' and 'aperture' to a 'camera_settings' object).
    *   **Add specific keys:** If a field is too generic (e.g., "details": "red dress, sunny day"), break it down into more specific keys (e.g., "subject_outfit": "red dress", "weather": "sunny day").
    *   **Simplify nesting:** If the structure is unnecessarily complex, flatten it where it makes sense.
3.  **Content Fidelity:** The original content and intent of the prompt must be fully preserved. DO NOT invent new creative details; only restructure the existing information.
4.  **Generate Output:** Return a single JSON object containing two keys:
    *   'refactored_prompt': The new JSON prompt, as a well-formatted JSON string.
    *   'explanation': A concise and clear explanation in English of the changes you made and why they improve the prompt.

Analyze the following JSON prompt and return the result with the specified structure.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            refactored_prompt: { 
                type: Type.STRING, 
                description: 'The refactored JSON prompt, as a JSON string.' 
            },
            explanation: { 
                type: Type.STRING, 
                description: 'Explanation in English of the changes made.' 
            },
        },
        required: ['refactored_prompt', 'explanation'],
    };

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            },
            contents: { parts: [{ text: `Refactor this JSON prompt: \`\`\`json\n${prompt}\n\`\`\`` }] }
        })) as GenerateContentResponse;
        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString) as { refactored_prompt: string; explanation: string; };
        
        try {
            const parsedRefactored = JSON.parse(result.refactored_prompt);
            result.refactored_prompt = JSON.stringify(parsedRefactored, null, 2);
        } catch (e) {
            // Si ya es un string JSON bien formateado, se usa directamente.
            // Esto maneja el caso en que el modelo ya devuelva un JSON "pretty-printed".
        }

        return result;
    } catch (error) {
        console.error("Error refactoring JSON prompt with Gemini API:", error);
        throw new Error("No se pudo refactorizar el prompt JSON.");
    }
};

export const modularizePrompt = async (prompt: string): Promise<Record<ExtractionMode, string>> => {
    // ... implementation same as before
     const modularizePromptSystemInstruction = `Eres un experto en ingeniería de prompts para IA de generación de imágenes. Tu tarea es analizar un prompt (que puede ser texto plano o un JSON stringificado) y descomponerlo en 9 componentes modulares clave. Devuelve un objeto JSON con exactamente las siguientes 9 claves: 'subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'composition', 'style'.

Reglas:
1.  **Analiza Holísticamente:** Lee el prompt completo para entender la intención general.
2.  **Extrae y Asigna:** Identifica las frases y palabras clave que correspondan a cada una de las 9 categorías y asígnalas al campo correspondiente en el JSON.
3.  **Completa Todos los Campos:** TODOS los 9 campos deben estar presentes en el JSON de salida.
4.  **Manejo de Campos Vacíos:** Si un componente no se encuentra explícitamente en el prompt, deja el valor del campo como un string vacío (""). NO inventes contenido.
5.  **Evita la Redundancia:** Una vez que una parte del prompt se asigna a una categoría, intenta no repetirla en otra, a menos que sea fundamental para ambas (por ejemplo, el color del prenda).
6.  **Definición de Categorías:**
    *   **subject:** Describe al personaje o sujeto principal (ej. "a young woman", "an old warrior").
    *   **pose:** Describe la postura corporal y la acción (ej. "sitting on a throne", "leaping through the air").
    *   **expression:** Describe la emoción facial (ej. "a determined gaze", "a soft smile").
    *   **outfit:** Describe la vestimenta y accesorios (ej. "wearing a suit of simple silver armor", "dressed in a futuristic cyberpunk outfit").
    *   **object:** Describe un objeto clave que el sujeto sostiene o que es prominente en la escena (ej. "holding a glowing sword", "an ornate silver pocket watch").
    *   **scene:** Describe el entorno y la ambientación (ej. "in a dense foggy forest", "massive futuristic cityscape").
    *   **color:** Describe la paleta de colores, el esquema cromático y el tono (ej. "vibrant complementary palette", "desaturated and muted analogous color scheme").
    *   **composition:** Describe el encuadre, ángulo y foco (ej. "full body shot from a low angle", "rule of thirds composition, shallow depth of field").
    *   **style:** Describe el estilo artístico general y los detalles técnicos (ej. "digital painting", "photorealistic", "8k, hyperdetailed").
7.  **Salida:** Devuelve únicamente el objeto JSON. Sin explicaciones adicionales.`;

    const modularizeResponseSchema = {
        type: Type.OBJECT,
        properties: {
            subject: { type: Type.STRING, description: "Descripción del sujeto principal." },
            pose: { type: Type.STRING, description: "Descripción de la pose corporal." },
            expression: { type: Type.STRING, description: "Descripción de la expresión facial." },
            outfit: { type: Type.STRING, description: "Descripción de la vestimenta." },
            object: { type: Type.STRING, description: "Descripción de un objeto clave." },
            scene: { type: Type.STRING, description: "Descripción de la escena o entorno." },
            color: { type: Type.STRING, description: "Descripción de la paleta de colores." },
            composition: { type: Type.STRING, description: "Descripción de la composición visual." },
            style: { type: Type.STRING, description: "Descripción del estilo artístico y técnico." },
        },
        required: ['subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'composition', 'style'],
    };

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: modularizePromptSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: modularizeResponseSchema,
            },
            contents: { parts: [{ text: `Analiza y modulariza el siguiente prompt: "${prompt}"` }] },
        })) as GenerateContentResponse;
        const jsonString = response.text.trim();
        return JSON.parse(jsonString) as Record<ExtractionMode, string>;
    } catch (error) {
        console.error("Error calling Gemini API for prompt modularization:", error);
        throw new Error("No se pudo modularizar el prompt.");
    }
};

export const optimizePromptFragment = async (targetMode: ExtractionMode, allFragments: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
    // ... implementation same as before
     const targetFragmentText = allFragments[targetMode] || '';
    if (!targetFragmentText.trim()) {
        return [];
    }

    const otherFragmentsContext = Object.entries(allFragments)
        .filter(([key, value]) => key !== targetMode && value && value.trim())
        .map(([key, value]) => `- ${key.toUpperCase()}: "${value}"`)
        .join('\n');

    const userPrompt = `I am optimizing the '${targetMode.toUpperCase()}' module, which currently contains: "${targetFragmentText}".

The full context of the other modules is:
${otherFragmentsContext || "No additional context."}

Generate 3 concise suggestions to enhance and expand the '${targetMode.toUpperCase()}' module based on this global context.`;
    
    const optimizeFragmentSystemInstruction = `You are a contextual prompt engineering expert. Your task is to analyze a specific prompt module within the context of a full prompt being built and provide 3 suggestions to enhance or expand upon it.

Rules:
1.  **Global Coherence:** The suggestions for the module being optimized must be coherent and synergistic with the context provided by the other modules.
2.  **Conflict Avoidance:** Do not suggest anything that contradicts existing information (e.g., do not suggest "close-up" if the "outfit" module describes boots).
3.  **Build Upon Existing Text:** Suggestions should improve the fragment by ADDING more detail, specificity, or creative direction to the existing text. They should not be simple replacements, but rather richer, more complete versions of the original text. For example, if the current text is 'photorealistic', a good suggestion would be 'photorealistic, cinematic lighting, sharp focus, 85mm lens'.
4.  **Output Format (CRITICAL):**
    *   Each suggestion MUST be a direct, applicable text fragment (the full, enhanced string of keywords or descriptive phrase) that can be used to REPLACE the current content of the module.
    *   Suggestions must be in ENGLISH.
    *   DO NOT provide instructions, explanations, or conversational text.
5.  **Final Output:** Return a JSON array of 3 strings. Only the array, with no additional text.`;

    const optimizeFragmentResponseSchema = {
        type: Type.ARRAY,
        items: { type: Type.STRING },
    };

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: optimizeFragmentSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: optimizeFragmentResponseSchema,
            },
            contents: { parts: [{ text: userPrompt }] }
        })) as GenerateContentResponse;
        const jsonString = response.text.trim();
        return JSON.parse(jsonString) as string[];
    } catch (error) {
        console.error("Error optimizing fragment contextually with Gemini API:", error);
        throw new Error("No se pudieron generar sugerencias contextuales para el fragmento.");
    }
};

export const adaptFragmentToContext = async (targetMode: ExtractionMode, fragmentToAdapt: string, allFragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
     // ... implementation same as before
     const otherFragmentsContext = Object.entries(allFragments)
        .filter(([key, value]) => key !== targetMode && value && value.trim())
        .map(([key, value]) => `- ${key.toUpperCase()}: "${value}"`)
        .join('\n');

    if (!otherFragmentsContext) {
        return fragmentToAdapt; // No context to adapt to, return original
    }

    const userPrompt = `The user is importing the following fragment into the '${targetMode.toUpperCase()}' module: "${fragmentToAdapt}".

The full context of the other modules is:
${otherFragmentsContext}

Please rewrite the fragment to make it perfectly coherent with the provided context.`;

    const adaptFragmentSystemInstruction = `You are a prompt engineering expert. A user is importing a pre-written prompt fragment into a module. Your task is to intelligently adapt this fragment to fit the existing context of the other modules.

Rules:
1.  **Analyze Context:** Carefully review the other modules to understand the overall scene, subject, and style.
2.  **Identify Conflicts:** Compare the fragment to be adapted with the existing context. Identify any direct contradictions or stylistic clashes.
3.  **Rewrite, Don't Just Combine:** Your goal is to REWRITE the fragment to be coherent with the context. Preserve the original INTENT of the fragment as much as possible. The final rewritten fragment should read as if it were written specifically for the current prompt.
4.  **Output:** Return ONLY the rewritten, adapted text fragment as a single string. Do not include explanations or conversational text.

**SPECIAL RULE for 'pose' Module Adaptation (CRITICAL):**
*   First, determine the number of distinct subjects described in the 'subject' module context. Count subjects by looking for prefixes like "Subject 1:", "Subject 2:", or by identifying distinct character descriptions on new lines.
*   Then, analyze the number of figures whose poses are described in the imported 'pose' fragment.
*   **If Subject Count > Pose Figure Count:** You MUST creatively and logically extrapolate poses for the subjects that are missing a pose. The new poses must be thematically consistent with the existing ones and the overall context. For example, if two subjects are in a 'confrontational stance', the third might be a 'tense observer in the background'. The final description must account for all subjects.
*   **If Pose Figure Count > Subject Count:** Condense the poses. Select the most relevant or primary pose descriptions from the fragment that match the number of subjects and discard the rest, or intelligently merge their actions into a cohesive description for the available subjects.
*   **The goal is to always produce a 'pose' description that perfectly matches the number of subjects in the 'subject' module.**
*   **Example:** If the 'subject' module has "Subject 1: a king. Subject 2: a jester. Subject 3: a guard." and the imported 'pose' fragment is "The first figure sits on a throne, the second figure juggles balls.", you must invent a pose for the guard, like: "The king sits on a throne, the jester juggles balls nearby, and the guard stands at attention by the door."`;

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: adaptFragmentSystemInstruction,
            },
            contents: { parts: [{ text: userPrompt }] },
        })) as GenerateContentResponse;
        const text = response.text;
        if (!text) {
            // If API fails, return the original fragment as a fallback
            return fragmentToAdapt;
        }
        return text.trim();
    } catch (error) {
        console.error("Error adapting fragment with Gemini API:", error);
        // Fallback to the original fragment in case of error
        return fragmentToAdapt;
    }
};

export const mergeModulesIntoJsonTemplate = async (modules: Partial<Record<ExtractionMode, string>>, jsonTemplate: string): Promise<string> => {
     // ... implementation same as before
     const activeModules = Object.entries(modules)
        .filter(([, value]) => value && value.trim())
        .map(([key, value]) => `- Módulo ${key.toUpperCase()}: "${value}"`)
        .join('\n');
    
    if (!activeModules) {
        return jsonTemplate; // No hay nada que fusionar, devuelve la plantilla original
    }

    const userPrompt = `Aquí tienes la plantilla JSON maestra:
\`\`\`json
${jsonTemplate}
\`\`\`

Y aquí está el contenido de los módulos activos que debes fusionar en ella:
${activeModules}

Sigue las reglas para integrar el contenido de los módulos en la plantilla JSON.`;

    const mergeModulesIntoJsonTemplateSystemInstruction = `Eres un experto en ingeniería de prompts que fusiona contenido modular en una plantilla JSON existente. Tu tarea es integrar de manera inteligente el contenido de los 9 módulos de usuario en la plantilla JSON proporcionada, y rellenar creativamente cualquier campo faltante para crear un prompt completo, coherente y sin redundancias.

**Objetivo Principal:** Utilizar la plantilla JSON como una **estructura base**, reemplazando y completando su contenido temático con la información de los módulos del usuario para producir un JSON final rico en detalles y optimizado.

**Reglas Estrictas:**

1.  **La Plantilla dicta la Estructura:** La estructura de claves, el anidamiento, la sintaxis (como pesos \`::1.5\`) y cualquier campo técnico que no se corresponda con un módulo (ej. \`"seed": 12345\`) DEBEN ser preservados fielmente.

2.  **Los Módulos dictan el Contenido Principal:** El contenido de los 9 módulos de usuario (\`subject\`, \`pose\`, \`style\`, etc.) es la fuente de verdad para el contenido temático principal.

3.  **Mapeo y REEMPLAZO Inteligente:**
    *   Analiza el contenido de cada módulo de usuario.
    *   Encuentra la clave más apropiada dentro de la plantilla JSON para insertar esa información (ej. el módulo 'subject' podría ir en 'character_description').
    *   **REEMPLAZA COMPLETAMENTE** el valor existente en esa clave de la plantilla con el contenido del módulo correspondiente. El contenido del módulo de usuario siempre tiene la prioridad.
    *   Una vez que el contenido de un módulo se ha utilizado para rellenar un campo, considéralo "consumido". Evita volver a utilizar el mismo texto del módulo en otros campos a menos que sea absolutamente esencial para la coherencia.

4.  **Manejo de Placeholders:** Si la plantilla contiene placeholders como \`{{module_name}}\`, reemplázalos directamente con el contenido del módulo correspondiente.

5.  **Relleno Creativo y Coherente (REGLA CRÍTICA):**
    *   Después de mapear todos los módulos de usuario, analiza el JSON resultante.
    *   Si alguna clave de la plantilla ha quedado vacía, sin contenido, o contiene un placeholder para un módulo que el usuario no proporcionó (ej. \`{{scene}}\` pero el módulo 'scene' está vacío), **tu tarea es rellenar ese campo de forma creativa**.
    *   **REGLA DE NO REPETICIÓN:** Al rellenar estos campos, **NO COPIES Y PEGUES** texto de los módulos ya utilizados. En su lugar, genera **NUEVOS detalles que complementen y expandan** el contexto global. El contenido debe ser **sinérgico**, no una simple repetición.
    *   **Ejemplo:** Si el módulo 'outfit' es "a grey hoodie under a black coat", no pongas "a grey hoodie under a black coat" en un campo llamado "accessory". En su lugar, podrías poner algo como "a simple silver chain" o "black leather gloves" si se ajusta al contexto.
    *   El contenido que generes DEBE ser **coherente** con el contexto global. Si el 'subject' es "un guerrero de fantasía", un campo 'scene' vacío podría ser rellenado con "en un castillo en ruinas", no con "un guerrero de fantasía".

6.  **Optimización y Concisión:**
    *   Revisa el JSON final para eliminar cualquier redundancia obvia entre campos. Si dos campos diferentes terminan describiendo lo mismo, consolida la información en el campo más apropiado y simplifica el otro.
    *   El objetivo es un prompt donde cada clave aporta información única y valiosa.

7.  **Output Final:** Devuelve únicamente el objeto JSON final, válido, que refleje la estructura de la plantilla pero con el contenido de los módulos del usuario y los campos vacíos rellenados de forma inteligente. No incluyas texto adicional.`;

    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: mergeModulesIntoJsonTemplateSystemInstruction,
                responseMimeType: "application/json",
            },
            contents: { parts: [{ text: userPrompt }] },
        })) as GenerateContentResponse;
        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return JSON.stringify(parsedJson, null, 2);
    } catch (error) {
        console.error("Error merging modules into JSON template with Gemini API:", error);
        throw new Error("No se pudo fusionar el contenido en la plantilla JSON.");
    }
};

export const createJsonTemplate = async (jsonPrompt: string): Promise<string> => {
     // ... implementation same as before
     let validJsonString = '';
    try {
        // First, try to parse the user's input directly.
        JSON.parse(jsonPrompt);
        validJsonString = jsonPrompt;
    } catch (e) {
        // If parsing fails, ask the AI to correct the syntax.
        console.warn("Initial JSON.parse failed. Attempting AI correction.", e);
        const systemInstruction = `The following text is intended to be a valid JSON string, but it contains syntax errors. Please correct the syntax (e.g., fix quotes, remove trailing commas, etc.) and return ONLY the raw, corrected JSON string. Do not add explanations, markdown, or any other text outside of the JSON object. If it's impossible to fix, return an empty JSON object: {}.`;
        
        try {
            const response = await callApiThrottled(ai => ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: { systemInstruction },
                contents: { parts: [{ text: jsonPrompt }] },
            })) as GenerateContentResponse;
            const rawResponseText = response.text.trim();
            let cleanedJsonText = rawResponseText;

            // FIX: The AI might wrap the JSON in markdown or add extra text.
            // This regex extracts the first JSON object or array from the response string.
            const jsonMatch = rawResponseText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch && jsonMatch[0]) {
                cleanedJsonText = jsonMatch[0];
            }
            
            // Validate the AI's output before proceeding.
            JSON.parse(cleanedJsonText);
            validJsonString = cleanedJsonText;

        } catch (aiError) {
            console.error("AI failed to clean JSON or returned invalid JSON.", aiError);
            throw new Error("El texto proporcionado no es un JSON inválido y no pudo ser corregido automáticamente.");
        }
    }

    const createJsonTemplateSystemInstruction = `You are an expert system that converts concrete JSON image generation prompts into reusable templates. Your task is to analyze a user-provided JSON prompt, separate its structure (the "Fórmula") from its specific content, and create a new JSON template. This template must preserve the original structure and syntax while replacing content with placeholders corresponding to 9 predefined modules.

The 9 modules are: 'subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'composition', 'style'.

**Rules:**

1.  **Preserve Structure:** The output JSON template MUST have the exact same keys, nesting, and syntax (like weights, e.g., \`::1.5\`) as the input JSON. This is the highest priority.
2.  **Analyze Content:** For each value in the input JSON, determine which of the 9 modules it primarily belongs to.
3.  **Create Placeholders:** Replace the specific content values in the original JSON with placeholders of the format \`{{module_name}}\`.
4.  **Intelligent Combination:** If a single value contains information from multiple modules, combine the placeholders. For example, if a \`description\` key has the value \`"a knight in shining armor, photorealistic"\`, the new value in the template should be \`"{{subject}} in {{outfit}}, {{style}}"\`.
5.  **Handle Unmapped Content:** If a key's value in the input JSON does not clearly map to any of the 9 modules (e.g., a specific seed number, a unique flag), **preserve that original value** in the template. This is crucial for advanced templates.
6.  **Integrate All Modules:** The final template should try to incorporate ALL 9 module placeholders in the most logical locations, even if the original prompt didn't contain content for them. For example, you might change a key's value from \`"{{subject}}"\` to \`"{{subject}}, {{pose}}, {{expression}}"\` to make the template more comprehensive.
7.  **Output:** Return ONLY the final JSON template as a valid JSON object. Do not include any explanatory text.`;

    // If we have a valid JSON string (either original or corrected), proceed to templatize it.
    try {
        const response = await callApiThrottled(ai => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: createJsonTemplateSystemInstruction,
                responseMimeType: "application/json",
            },
            contents: { parts: [{ text: `Analiza este JSON y crea una plantilla: ${validJsonString}` }] }
        })) as GenerateContentResponse;
        
        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return JSON.stringify(parsedJson, null, 2);

    } catch (error) {
        console.error("Error calling Gemini API for JSON template creation:", error);
        if (error instanceof SyntaxError) {
            throw new Error("El modelo de IA devolvió un JSON inválido al crear la plantilla.");
        }
        throw new Error("No se pudo crear la plantilla JSON.");
    }
};

export const getCreativeAssistantResponse = async (
  conversationHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
  currentFragments: Partial<Record<ExtractionMode, string>>
): Promise<string> => {
     // ... implementation same as before
     const getCreativeAssistantResponseSystemInstruction = `You are an expert AI Prompt Engineer and Creative Director for an image generation tool.
Your goal is to interpret the user's natural language requests (which may be in Spanish) and translate them into high-quality, detailed, and evocative PROMPT FRAGMENTS in ENGLISH.

**The 9 Modules:** subject, pose, expression, outfit, object, scene, color, composition, style.

**CRITICAL RULES FOR "UPDATES":**
1.  **ALWAYS ENGLISH:** The 'value' field in the 'updates' array MUST be in English, regardless of the user's language.
2.  **EXPAND & ENHANCE (MANDATORY):** Do NOT just transcribe the user's words.
    *   If the user provides a short or vague concept (e.g., "cartoon", "cyberpunk", "happy"), you MUST expand it into a professional, descriptive prompt fragment.
    *   *Bad:* User says "ponlo triste" -> Value: "sad".
    *   *Good:* User says "ponlo triste" -> Value: "melancholic expression, teary eyes, downcast gaze, sorrowful vibe".
    *   *Bad:* User says "estilo cartoon" -> Value: "cartoon".
    *   *Good:* User says "estilo cartoon" -> Value: "vibrant cartoon style, cel shaded, bold outlines, flat colors, 2D animation aesthetic".
    *   NEVER return a single word as a value unless explicitly requested to be minimal.
3.  **CONTEXT AWARE:** Analyze the current context to ensure coherence.
4.  **REPLACE vs. MERGE:**
    *   If the user implies a total change (e.g., "change the outfit to armor"), replace the 'outfit' module entirely with a detailed description.
    *   If the user implies an addition (e.g., "add a cape"), try to incorporate it into the existing description.
5.  **BE CREATIVE:** If the user is vague (e.g., "make it better"), enhance the 'style', 'lighting', or 'composition' modules with professional keywords (e.g., "cinematic lighting, 8k, masterpiece").
6.  **ASSEMBLE:** You must also return the \`assembled_prompt\`. This is the final, cohesive English prompt string resulting from applying your updates to the current context. It should follow the hierarchy: Style > Subject > Outfit > Pose > Expression > Object > Scene > Composition > Color (applied). Remove conflicts.

**Response Format:**
Return a JSON object:
{
  "updates": [
    { "module": "style", "value": "..." },
    { "module": "expression", "value": "..." }
  ],
  "assembled_prompt": "The full, coherent, master prompt in English...",
  "message": "..." // A helpful response in SPANISH explaining what you did. Use Markdown (e.g., **bold** for key terms, *italics* for emphasis) to make it readable.
}`;


  const fragmentsContext = Object.entries(currentFragments)
    .filter(([, value]) => value && value.trim())
    .map(([key, value]) => `- ${key.toUpperCase()}: "${value}"`)
    .join('\n');

  // We are not sending the context as a separate message, but rather including it in the history
  // processing to be prepended to the user's *next* message for the model to see it.
  // The logic inside PlaygroundModal will handle adding context to the user message.
  
  try {
      const response = await callApiThrottled(ai => ai.models.generateContent({
          model: 'gemini-2.5-flash',
          config: {
              systemInstruction: getCreativeAssistantResponseSystemInstruction,
              responseMimeType: "application/json",
          },
          contents: conversationHistory,
      })) as GenerateContentResponse;
      
      const text = response.text;
      if (!text) {
          throw new Error("El asistente de IA no devolvió ninguna respuesta.");
      }
      return text.trim();
  } catch (error) {
      console.error("Error calling Gemini API for creative assistant:", error);
      if (error instanceof Error) {
        throw new Error(error.message || "No se pudo obtener una respuesta del asistente de IA.");
      }
      throw new Error("No se pudo obtener una respuesta del asistente de IA.");
  }
};