import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { SavedPrompt, ExtractionMode } from "../types";

// --- Throttling Logic to prevent 429 errors ---
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
    return async (images: ImagePayload[]): Promise<string> => {
        if (images.length === 0) {
            throw new Error("Se requiere al menos una imagen para analizar.");
        }
        try {
            const imageParts = images.map(image => ({
                inlineData: { data: image.imageBase64, mimeType: image.mimeType },
            }));
            const response = await callApiThrottled(ai => ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: { systemInstruction },
                contents: {
                    parts: [
                        { text: `Analiza las siguientes imágenes y genera el prompt optimizado como se te indicó.` },
                        ...imageParts,
                    ],
                },
            })) as GenerateContentResponse;
            const text = response.text;
            if (!text) {
                throw new Error("La API no devolvió ningún texto.");
            }
            return text.trim();
        } catch (error) {
            console.error(`Error calling Gemini API for ${errorContext}:`, error);
            if (error instanceof Error) {
                throw new Error(error.message || "No se pudo obtener una respuesta del modelo de IA.");
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
    style: `Eres un analista profesional de última tecnología. Tu tarea es analizar el conjunto de imágenes proporcionadas por el usuario para identificar un estilo visual cohesivo y unificado presente en ellas. Debes generar un prompt optimizado que describa únicamente este estilo visual consolidado.

Propósito y Metas:

*   Analizar meticulosamente los elementos visuales de las imágenes proporcionadas por el usuario para identificar un estilo cohesivo.
*   Generar un 'prompt' conciso y completo, optimizado para la replicación del estilo artístico en modelos de generación de imágenes.
*   Asegurar que el 'prompt' se centre exclusivamente en el estilo (técnica, atmósfera, composición, etc.), excluyendo contenido específico (personajes, objetos, escenas).

Comportamientos y Reglas:

1)  Análisis Inicial:
    a) Asumir que el usuario ha subido una o más imágenes para analizar.
    b) Si el usuario describe el estilo verbalmente, pedir la imagen para un análisis técnico preciso.

2)  Generación del Prompt:
    a) El 'prompt' generado debe ser altamente descriptivo, usando terminología técnica (ej. 'volumetric lighting', 'charcoal strokes', 'analogous color palette').
    b) Incluir categorías esenciales como: Técnica de Dibujo/Pintura, Esquema de Color, Calidad de Iluminación, Nivel de Detalle y Estética General/Mood.
    c) El 'prompt' final debe ser un bloque de texto único y coherente, con un equilibrio ideal entre detalle y concisión. Debe estar estructurado como una serie de descriptores y palabras clave de alta calidad, separados por comas.
    d) Enfatizar la neutralidad de contenido; el 'prompt' no debe mencionar nada de la imagen fuente que no sea el estilo. El prompt final debe estar escrito exclusivamente en inglés.
    e) Profundidad Técnica: El prompt debe incluir, cuando sea relevante, referencias a técnicas pictóricas específicas (ej. 'impasto', 'sfumato', 'chiaroscuro'), tipos de pinceladas (ej. 'bold expressive strokes', 'fine delicate lines', 'cross-hatching'), y calidades de textura (ej. 'rough canvas texture', 'smooth glossy enamel', 'weathered wood grain').
    f) Optimización Universal: El prompt debe ser universalmente compatible y optimizado para funcionar eficazmente en las principales plataformas de generación de imágenes (como Midjourney, Stable Diffusion, DALL-E, etc.). Evita sintaxis específica de una sola plataforma.

Tono General:

*   Ser formal, profesional y de alta precisión técnica.
*   Utilizar un vocabulario sofisticado y analítico, acorde a un experto en tecnología y arte visual.`,
    subject: `Tu misión es analizar CADA sujeto principal (persona o personaje) en las imágenes proporcionadas y generar una descripción individual y optimizada para cada uno. Es CRÍTICO que captures tanto su identidad física como su ESTILO VISUAL individual. Si los sujetos provienen de imágenes con estilos diferentes (ej. una fotografía realista y un dibujo de cómic), debes preservar y describir fielmente el estilo único de CADA UNO.

REGLAS:
1.  **Identifica y Etiqueta:** Si hay más de un sujeto distinto en las imágenes, identifícalos y etiquétalos como "Subject 1:", "Subject 2:", etc. Si solo hay un sujeto (incluso si aparece en varias imágenes), no uses etiquetas.
2.  **Descripción Individual y Estilo Específico:** Para CADA sujeto, crea una descripción optimizada, siempre en inglés, que comience con su estilo visual.
    - **Estilo Visual e Identidad General (REGLA CRÍTICA):** COMIENZA SIEMPRE con el estilo visual (ej. 'photorealistic', 'comic book style', 'oil painting style') seguido de la identidad (ej. 'a young woman', 'an old warrior'). Esta es la parte más importante para mantener la coherencia del personaje.
    - **Rasgos Faciales Clave:** (ej. sharp jawline, bright blue eyes, freckles across the nose).
    - **Cabello:** (ej. long wavy blonde hair, short spiky black hair).
    - **Complexión y Físico:** (ej. slender build, muscular frame).
    - **Vestimenta:** Incluye una descripción de la ropa que lleva (ej. wearing simple peasant clothes, dressed in a suit of simple silver armor).
    - **Expresión/Emoción Inferida:** Añade una descripción simple de la emoción o estado de ánimo aparente (ej. with a determined gaze, looking calm and serene).
3.  **Consolidación:** Si varias imágenes muestran al MISMO sujeto, consolida sus características en una única descripción cohesiva para ese sujeto.
4.  **Formato de Salida:** Tu salida debe ser el prompt en inglés, con cada descripción de sujeto en una nueva línea si hay más de uno. Sin explicaciones adicionales.

EJEMPLO DE SALIDA (para dos sujetos de estilos distintos):
Subject 1: photorealistic young woman with long wavy blonde hair, bright blue eyes, wearing simple peasant clothes, looking calm and serene.
Subject 2: old warrior in a comic book character style, with a long white beard, a scar over the left eye, dressed in a suit of simple silver armor, with a determined gaze.

Céntrate en las características físicas inherentes, vestimenta, expresión y el estilo visual de CADA sujeto. Ignora el fondo y la iluminación general de la escena.`,
    pose: `Analiza exhaustivamente la pose corporal de TODOS los sujetos en la imagen. Tu objetivo es generar una descripción única, concisa y optimizada, siempre en inglés, que un motor de IA de generación de imágenes pueda usar para replicar las poses con alta fidelidad.

REGLAS ESTRICTAS:
1.  **Neutralidad de Género:** NO incluyas género (ej. 'man', 'woman') en tu descripción. Utiliza términos neutrales como 'figure', 'person', 'subject'.
2.  **Identifica Múltiples Sujetos:** Si hay más de un sujeto, identifica a cada uno por su posición o una característica visual neutra (ej. "the figure on the left", "the person in the red coat") y describe sus poses por separado dentro del mismo prompt.
3.  **Descripción Individual:** Para CADA sujeto, la descripción de su pose debe ser un bloque de texto optimizado que incluya, en este orden:
    a. **Identificador del Sujeto:** Describe brevemente al sujeto para diferenciarlo usando términos neutrales (ej. 'the figure in the dark clothing', 'the subject on the right').
    b. **Verbo de Acción/Postura Principal:** Un verbo o frase que defina la acción (ej. sitting, leaping, kneeling).
    c. **Detalles del Cuerpo:** Posición del torso, ángulo de la cabeza y mirada (ej. torso slightly tilted, looking over the shoulder).
    d. **Posición de Extremidades:** Colocación de brazos, manos, piernas y pies (ej. arms crossed, one hand on the hip).
    e. **Emoción/Energía Inferida:** La emoción o energía que transmite la pose (ej. confident and powerful stance, melancholic posture).
4.  **Perspectiva General:** Al final del prompt, especifica el ángulo de la cámara si es notable para la escena completa (ej. low angle shot, full body view).
5.  **Formato de Salida:** Tu salida debe ser un único prompt en inglés, sin etiquetas ni explicaciones adicionales. Une las descripciones de las poses con comas para formar un párrafo coherente.

EJEMPLO DE SALIDA (para una imagen con dos personas):
The figure on the left is leaning against a wall, arms crossed, looking thoughtful. The figure on the right is walking towards the camera, with a determined stride and hands in their pockets, confident and powerful stance, full body shot from a medium angle.

Ignora por completo el estilo, el fondo (excepto para interacción de pose), y otros detalles que no sean estrictamente la pose del cuerpo y la emoción que transmite.`,
    expression: `Analiza la expresión facial y el estado emocional del personaje principal en la imagen. Tu tarea es condensar esta información en una descripción única, concisa y optimizada, siempre en inglés, que un motor de IA pueda usar inmediatamente para replicar la expresión y el tono emocional con alta fidelidad.

La descripción debe ser un único bloque de texto optimizado que incluya, en este orden:

Emoción Principal y Detalle Facial: Un adjetivo emocional clave seguido de los rasgos faciales que lo definen (ej. serene expression, closed eyes and soft smile).

Intensidad y Lenguaje Corporal Reinforzador: La fuerza del sentimiento y cualquier gesto complementario (ej. intense fury, furrowed brow and clenched jaw).

Vibra Narrativa y Perspectiva: El tono general y el ángulo que mejor capturen la expresión (ej. vulnerable close-up shot, triumphant view).

Tu salida debe ser el prompt en inglés sin ninguna etiqueta o explicación adicional.
Si hay varias imágenes, céntrate en el personaje principal y crea una descripción de expresión cohesiva que represente la emoción o estado de ánimo general. Ignora por completo el estilo, el fondo, la ropa y otros detalles que no sean estrictamente la expresión facial y emocional.`,
    scene: `Analiza el entorno, la ambientación y la atmósfera que rodean al personaje principal. Tu tarea es condensar esta información en una descripción única, concisa y optimizada, siempre en inglés, que un motor de IA pueda usar para replicar el escenario con alta fidelidad.

La descripción debe ser un único bloque de texto optimizado que incluya, en este orden:

Entorno y Localización Principal: El tipo de lugar y elementos clave (ej. massive futuristic cityscape, dense foggy forest, vintage library interior).

Iluminación y Hora: La cualidad de la luz y el momento del día (ej. cinematic low light, golden hour illumination, under harsh neon lights).

Atmósfera y Tono Narrativo: El sentimiento o la vibra del entorno (ej. calm and ethereal atmosphere, chaotic and dramatic setting, melancholic mood).

Tu salida debe ser el prompt en inglés sin ninguna etiqueta o explicación adicional.`,
    outfit: `Analiza y desglosa el vestuario, accesorios y estilo de diseño del personaje principal. Tu tarea es condensar esta información en una descripción única, concisa y optimizada, siempre en inglés, que un motor de IA pueda usar para replicar el outfit con alta fidelidad.

La descripción debe ser un único bloque de texto optimizado que incluya, en este orden:

Estilo y Tono General: Clasificación del estilo (ej. futuristic cyberpunk outfit, elegant vintage high fashion).

Prendas Principales y Corte: Descripción de las piezas clave y su ajuste (ej. oversized denim jacket, slim-fit black leather pants, chunky combat boots).

Materiales y Colores: Texturas, acabados y paleta de colores predominante (ej. shiny silk, matte black leather, vibrant green accents).

Accesorios Cruciales: Detalles que completan el look (ej. gold chain belt, aviator sunglasses, elaborate feather hat).

Tu salida debe ser el prompt en inglés sin ninguna etiqueta o explicación adicional.`,
    composition: `Analiza y describe la composición visual y la configuración de la toma de la imagen. Tu tarea es condensar esta información en una descripción única, concisa y optimizada, siempre en inglés, que un motor de IA pueda usar para replicar la estructura visual de la imagen con alta fidelidad.

La descripción debe ser un único bloque de texto optimizado que incluya, en este orden:

Tipo de Plano y Ángulo de Cámara: El encuadre y la perspectiva (ej. full body shot from a low angle, medium close-up from a bird's eye view).

Regla de Composición y Dinámica: Cómo están organizados los elementos (ej. rule of thirds composition, strong diagonal lines, perfectly symmetrical framing).

Foco y Profundidad: Control de nitidez y el desenfoque (ej. shallow depth of field with background blur, sharp focus on the face, high depth of field).

Ubicación del Sujeto: Posición clave dentro del encuadre (ej. subject framed by a doorway, centered subject, leading lines composition).

Tu salida debe ser el prompt en inglés sin ninguna etiqueta o explicación adicional.`,
    color: `Tu tarea es analizar el uso del color en la imagen y generar una descripción optimizada en inglés.

**Paso 1: Análisis de la Imagen**
Primero, determina si la imagen es:
A) Una escena con contenido (personajes, paisajes, objetos definidos).
B) Principalmente una paleta de colores abstracta (muestras de color, gradientes, sin un sujeto claro).

**Paso 2: Generación del Prompt según el tipo de imagen**

**SI ES UNA ESCENA CON CONTENIDO (A), sigue estas reglas:**
Genera una descripción que especifique la paleta y su distribución por zonas. Omite códigos HEX y usa nombres de colores descriptivos.
1.  **Esquema General:** Describe el esquema de color, tono y saturación (ej. 'vibrant complementary palette', 'desaturated analogous color scheme').
2.  **Colores Dominantes:** Menciona los tonos principales.
3.  **Aplicación por Zonas (REGLA CRÍTICA):** Describe dónde se localizan los colores clave usando áreas funcionales y genéricas. NO uses nombres de prendas específicas.
    *   **Usa:** 'hair area', 'skin tone', 'primary garment area', 'secondary garment area', 'background', 'foreground elements', 'main light source color'.
    *   **EVITA:** 'dress', 'hat', 'boots', 'sword'.
    *   **Ejemplo:** '...fiery red on the main garment area, deep cobalt blue in the background.'
4.  **Contraste y Calidad:** Describe el contraste y la calidad general de la luz.

**SI ES UNA PALETA DE COLORES ABSTRACTA (B), sigue estas reglas:**
Genera una descripción de la paleta lo suficientemente detallada para que un artista la use.
1.  **Análisis Jerárquico:** Identifica y lista los colores clave en una jerarquía clara:
    *   **Color(es) Dominante(s):** El color que ocupa la mayor parte del área o define el tono principal.
    *   **Color(es) Secundario(s):** Colores importantes que complementan al dominante.
    *   **Color(es) de Acento:** Colores que aparecen en pequeñas cantidades pero que son visualmente impactantes.
2.  **Descripción Rica:** Usa nombres de colores descriptivos y evocadores (ej. 'burnt sienna', 'midnight blue', 'electric magenta', 'mint green').
3.  **Relación y Atmósfera:** Describe cómo se relacionan los colores entre sí y la atmósfera que crean (ej. 'A harmonious analogous palette featuring a dominant deep forest green, a secondary earthy brown, and vibrant fiery orange and soft cream accent colors, creating a warm and rustic mood').
4.  **NO menciones áreas** como 'hair area' o 'background'. El prompt debe ser una descripción general del estilo de color.

**Salida Final:** Tu salida debe ser un único bloque de texto en inglés, sin etiquetas ni explicaciones adicionales.`,
    object: `Tu única tarea es analizar la imagen para identificar el objeto más prominente y describirlo. El objeto suele ser un ítem que se puede sostener o que destaca visualmente del personaje o el fondo.

Reglas Estrictas:
1.  **Identifica el Objeto Principal:** Primero, localiza el objeto más importante. Si hay un personaje, el objeto es algo que sostiene, lleva, o que es un accesorio clave (ej. una espada, un libro, un sombrero, unas gafas). NO describas al personaje.
2.  **Describe ÚNICAMENTE el Objeto:** Tu descripción debe centrarse exclusivamente en el objeto identificado.
3.  **Formato de Salida:** Genera una descripción única, concisa y optimizada, siempre en inglés. La descripción debe ser un único bloque de texto que incluya:
    *   **Identificación del Objeto:** El nombre claro del objeto (ej. 'an ornate silver sword', 'a vintage leather-bound book', 'a steaming ceramic coffee mug').
    *   **Características Visuales Clave:** Sus atributos más importantes (ej. 'with intricate glowing runes', 'with a worn, cracked cover', 'with a chipped rim').
    *   **Material y Textura:** De qué está hecho y cómo se ve su superficie (ej. 'polished metallic surface', 'rough, grainy wood texture').

4.  **Exclusiones:** Ignora por completo al personaje, su pose, su ropa (a menos que sea el objeto), el fondo, la iluminación y el estilo artístico. Tu salida debe ser solo la descripción del objeto.

Tu salida debe ser el prompt en inglés sin ninguna etiqueta o explicación adicional.`,
};

// --- Refactored Metadata Instruction Generation ---
const createMetadataSystemInstruction = (expertType: string, featureName: string, rules: { title: string; category: string; artType: string; notes: string; }) =>
`Eres un ${expertType}. Tu tarea es analizar un prompt que describe un ${featureName} y las imágenes de referencia que lo inspiraron. Basado en este análisis, debes generar metadatos estructurados en formato JSON.

Reglas:
1.  **Título (title):** ${rules.title}
2.  **Categoría/Estilo (category):** ${rules.category}
3.  **Tipo de Arte (artType):** ${rules.artType}
4.  **Notas (notes):** ${rules.notes}

Analiza el siguiente prompt de ${featureName} y las imágenes asociadas y devuelve SOLO el objeto JSON con la estructura especificada.`;

const metadataInstructionConfig = {
    style: { expert: 'curador de arte y catalogador experto', feature: 'estilo artístico', rules: { title: 'Crea un título corto, evocador y descriptivo para el estilo. Debe ser atractivo y fácil de recordar. Máximo 5-7 palabras.', category: "Identifica la categoría principal del estilo. Sé específico. Ejemplos: 'Cyberpunk Noir', 'Impressionist Landscape', 'Vintage Cartoon', 'Gothic Fantasy'.", artType: "Clasifica el tipo de arte. Ejemplos: 'Digital Painting', 'Oil on Canvas', 'Watercolor', '3D Render', 'Charcoal Sketch'.", notes: 'Escribe una breve nota (1-2 frases) que describa la esencia del estilo o para qué tipo de escenas sería más adecuado.'}},
    subject: { expert: 'director de casting y catalogador experto en personajes', feature: 'sujeto', rules: { title: 'Crea un título corto y descriptivo para el sujeto (ej. "Guerrera Cibernética", "Explorador de Mundos", "Maga del Bosque").', category: "Identifica la categoría del arquetipo del personaje (ej. 'Personaje de Ciencia Ficción', 'Héroe de Fantasía', 'Retrato Realista').", artType: "Clasifica el uso principal (ej. 'Concepto de Personaje', 'Referencia para Retrato', 'Diseño de Protagonista').", notes: 'Escribe una breve nota (1-2 frases) que describa la esencia del personaje o para qué tipo de historias sería adecuado.'}},
    pose: { expert: 'catalogador experto en poses para artistas digitales', feature: 'pose', rules: { title: 'Crea un título corto y descriptivo para la pose. Ejemplos: "Pose de Acción Saltando", "Postura Relajada de Pie", "Mirada Confiada".', category: "Identifica la categoría de la pose. Ejemplos: 'Pose Dinámica', 'Pose Estática', 'Pose Contemplativa', 'Pose de Combate'.", artType: "Clasifica el uso principal. Ejemplos: 'Referencia de Personaje', 'Estudio de Anatomía', 'Boceto de Acción'.", notes: 'Escribe una breve nota (1-2 frases) que describa la esencia de la pose o para qué tipo de personajes o escenas sería más adecuada.'}},
    expression: { expert: 'catalogador experto en expresiones faciales para artistas digitales', feature: 'expresión', rules: { title: 'Crea un título corto y descriptivo para la expresión. Ejemplos: "Sonrisa Desafiante", "Mirada Melancólica", "Grito de Furia".', category: "Identifica la categoría de la emoción. Ejemplos: 'Expresión de Alegría', 'Expresión de Tristeza', 'Expresión de Ira', 'Expresión Sutil'.", artType: "Clasifica el uso principal. Ejemplos: 'Estudio de Personaje', 'Referencia Emocional', 'Retrato Expresivo'.", notes: 'Escribe una breve nota (1-2 frases) que describa la esencia de la expresión o para qué tipo de personajes o escenas sería más adecuada.'}},
    scene: { expert: 'catalogador experto en escenarios para artistas digitales', feature: 'escena', rules: { title: 'Crea un título corto y descriptivo para la escena (ej. "Fábrica Abandonada", "Lago al Atardecer").', category: "Identifica la categoría del escenario (ej. 'Paisaje Urbano', 'Entorno Natural', 'Interior Cinemático').", artType: "Clasifica el uso principal. Ejemplos: 'Arte Conceptual de Entorno', 'Fondo para Ilustración').", notes: 'Escribe una breve nota (1-2 frases) sobre la atmósfera de la escena.'}},
    outfit: { expert: 'catalogador experto en diseño de vestuario para artistas digitales', feature: 'outfit', rules: { title: 'Crea un título corto y descriptivo para el outfit (ej. "Vestimenta Táctica Militar", "Vestido de Gala Barroco").', category: "Identifica la categoría del vestuario (ej. 'Moda Cyberpunk', 'Fantasía Medieval', 'Alta Costura Vintage').", artType: "Clasifica el uso principal. Ejemplos: 'Diseño de Personaje', 'Concept Art de Vestuario').", notes: 'Escribe una breve nota (1-2 frases) sobre el estilo del outfit.'}},
    composition: { expert: 'catalogador experto en composición fotográfica para artistas', feature: 'composición visual', rules: { title: 'Crea un título corto y descriptivo para la composición (ej. "Retrato con Regla de Tercios", "Plano General Simétrico").', category: "Identifica la categoría de la composición (ej. 'Composición Dinámica', 'Encuadre Simétrico', 'Retrato Íntimo').", artType: "Clasifica el uso principal. Ejemplos: 'Referencia de Composición', 'Estudio de Encuadre', 'Boceto Narrativo').", notes: 'Escribe una breve nota (1-2 frases) sobre el efecto o la sensación que crea la composición.'}},
    color: { expert: 'catalogador experto en paletas de color para artistas', feature: 'paleta de color', rules: { title: 'Crea un título corto y descriptivo para la paleta (ej. "Paleta Neón Urbana", "Tonos Pastel Suaves").', category: "Identifica la categoría de la paleta (ej. 'Paleta Complementaria', 'Esquema Monocromático', 'Tonos Análogos').", artType: "Clasifica el uso principal. Ejemplos: 'Referencia de Color', 'Estudio de Tono', 'Moodboard Visual').", notes: 'Escribe una breve nota (1-2 frases) sobre el efecto o la sensación que crea la paleta.'}},
    object: { expert: 'catalogador de assets para artistas digitales', feature: 'objeto', rules: { title: 'Crea un título corto y descriptivo para el objeto (ej. "Espada Rúnica", "Cámara Antigua").', category: "Identifica la categoría del objeto (ej. 'Arma de Fantasía', 'Objeto Cotidiano', 'Dispositivo Tecnológico').", artType: "Clasifica el uso principal. Ejemplos: 'Asset para Escena', 'Concepto de Objeto', 'Prop').", notes: 'Escribe una breve nota (1--2 frases) sobre las características del objeto.'}},
};

const metadataSystemInstructions = Object.fromEntries(
  Object.entries(metadataInstructionConfig).map(([mode, config]) => [
    mode,
    createMetadataSystemInstruction(config.expert, config.feature, config.rules)
  ])
) as Record<ExtractionMode, string>;


const analysisFunctions = Object.fromEntries(
  (Object.keys(analysisSystemInstructions) as ExtractionMode[]).map(mode => [
    mode,
    createImageAnalyzer(analysisSystemInstructions[mode], `${mode} analysis`),
  ])
) as Record<ExtractionMode, (images: ImagePayload[]) => Promise<string>>;

const metadataFunctions = Object.fromEntries(
  (Object.keys(metadataSystemInstructions) as ExtractionMode[]).map(mode => [
    mode,
    createMetadataGenerator(metadataSystemInstructions[mode], `el ${mode}`),
  ])
) as Record<ExtractionMode, (prompt: string, images: ImagePayload[]) => Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>>>;

export const analyzeImageFeature = (mode: ExtractionMode, images: ImagePayload[]): Promise<string> => {
  if (!analysisFunctions[mode]) {
    throw new Error(`Modo de análisis no válido: ${mode}`);
  }
  return analysisFunctions[mode](images);
};

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


// --- Funciones existentes que se mantienen ---

export const generateStructuredPromptMetadata = async (
  prompt: string, 
  image?: ImagePayload
): Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>> => {
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

export const generateStructuredPrompt = async (promptData: { idea: string; style?: string }): Promise<string> => {
    const { idea, style } = promptData;

    let userPrompt = `Analiza la siguiente idea y genera el prompt JSON estructurado: "${idea}"`;
    if (style && style.trim()) {
        userPrompt += `\n\nFusiona la idea anterior con el siguiente prompt de estilo, aplicando las características del estilo al contenido de la idea: "${style}"`;
    }

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


export const generateReplicationPrompt = async (image: ImagePayload): Promise<string> => {
    try {
        const imagePart = {
            inlineData: {
                data: image.imageBase64,
                mimeType: image.mimeType,
            },
        };

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

export const generateStructuredPromptFromImage = async (images: ImagePayload[], style?: string): Promise<string> => {
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


export const generateFusedImagePrompt = async (subjectImage: ImagePayload, styleImage: ImagePayload): Promise<string> => {
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
  try {
    // A more descriptive prompt for better covers
    const generationPrompt = `Create a visually stunning, high-quality, cinematic image that artistically represents the following concept: ${prompt}`;
    // FIX: Cast the response from callApiThrottled to a specific type to resolve TypeScript errors.
    // The type is based on the Gemini API documentation for the generateImages method.
    const response = await callApiThrottled(ai => ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: generationPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    })) as { generatedImages: { image: { imageBytes: string } }[] };

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    
    throw new Error("La API no devolvió ninguna imagen.");

  } catch (error) {
    console.error("Error generating image from prompt with Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(error.message || "No se pudo generar la imagen de portada.");
    }
    throw new Error("No se pudo generar la imagen de portada.");
  }
};

export const generateIdeasForStyle = async (stylePrompt: string): Promise<string[]> => {
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

const masterAssemblerSystemInstruction = `Tu objetivo es combinar los fragmentos de prompt generados por los modos de extracción seleccionados por el usuario para construir un prompt maestro en inglés, coherente, optimizado y sin conflictos.

Instrucción:
Construye un prompt final, único y optimizado, siempre en inglés, ensamblando solo los fragmentos de prompt proporcionados. El resultado debe ser un único bloque de texto sin prefijos, listas o etiquetas, con los conceptos unidos por comas.

Orden de Ensamblaje:
El orden en el prompt final debe seguir esta secuencia para priorizar la identidad, luego la acción, el entorno y finalmente la estética:
Sujeto, Pose, Expresión, Outfit, Objeto, Escena, Paleta de Colores, Composición, Estilo.

Reglas de Fusión y Filtrado de Contenido Duplicado:
Aplica estas reglas de forma estricta para eliminar redundancias y crear un prompt conciso. El fragmento con mayor prioridad DICTA y el resto de fragmentos se FILTRAN.

1.  **Sujeto vs. Expresión:**
    *   **Prioridad:** SUJETO.
    *   **Acción:** El fragmento SUJETO elimina la descripción de rasgos faciales (ej. cabello oscuro, ojos azules, edad) del fragmento EXPRESION.
    *   **Si Ausente:** Si SUJETO está ausente, EXPRESION y OUTFIT pueden incluir descripciones básicas de rasgos físicos.

2.  **Pose vs. Expresión:**
    *   **Prioridad:** POSE.
    *   **Acción:** El fragmento POSE elimina la descripción de lenguaje corporal (hombros, brazos) del fragmento EXPRESION.
    *   **Si Ausente:** Si POSE está ausente, EXPRESION puede incluir el lenguaje corporal básico para contextualizar la emoción.

3.  **Outfit vs. Sujeto/Pose/Expresión (Regla de Vestimenta Única):**
    *   **Prioridad:** OUTFIT.
    *   **Acción:** El fragmento OUTFIT tiene la autoridad final y exclusiva sobre la vestimenta. DEBES eliminar CUALQUIER descripción de ropa, vestimenta, armadura o accesorios que pueda provenir de los fragmentos SUJETO, POSE y EXPRESION. La descripción del atuendo del sujeto debe originarse únicamente en este módulo.
    *   **Si Ausente:** Si el módulo OUTFIT está vacío, el fragmento SUJETO es la fuente principal para la descripción de la vestimenta. Si SUJETO tampoco la describe, POSE puede incluir detalles de ropa si son relevantes para la postura.

4.  **Objeto, Sujeto y Pose (Regla de Integración Inteligente):**
    *   **Prioridad:** La existencia de un SUJETO y POSE dicta CÓMO se integra el OBJETO.
    *   **Acción:** El fragmento OBJETO describe el ítem de forma aislada. Al ensamblar, tu tarea es integrar este objeto en la escena de forma coherente. NO te limites a añadir la descripción del objeto al final. En su lugar, modifica la descripción del SUJETO o POSE para incluir la interacción con el objeto.
    *   **Ejemplos:**
        *   Si SUJETO es "un guerrero" y OBJETO es "una espada brillante", el resultado debería ser "un guerrero sosteniendo una espada brillante" (a warrior holding a glowing sword).
        *   Si POSE es "mano extendida" y OBJETO es "una paloma blanca", el resultado debería ser "con una paloma blanca posada en su mano extendida" (with a white dove perched on their outstretched hand).
        *   Si el OBJETO es "un anillo de oro", se debe describir "llevando un anillo de oro en su dedo" (wearing a gold ring on their finger).
    *   Tu inteligencia es clave para que la integración sea natural y lógica.

5.  **Composición vs. Escena:**
    *   **Prioridad:** COMPOSICION.
    *   **Acción:** El fragmento COMPOSICION elimina la descripción de perspectiva, ángulo y tipo de plano (ej. 'low angle shot', 'wide shot') del fragmento ESCENA.
    *   **Si Ausente:** Si COMPOSICION está ausente, ESCENA debe incluir los términos de perspectiva y encuadre que detecte.

6.  **Paleta de Colores (Regla del Artista Experto):**
    *   **Prioridad:** PALETA DE COLORES tiene prioridad absoluta sobre cualquier otro color mencionado.
    *   **Acción (Tu mandato creativo más importante):** NO te limites a añadir la descripción de la paleta al final del prompt. Tu tarea es actuar como un **colorista experto**. Analiza la descripción de la paleta (que detallará colores dominantes, secundarios y de acento) y **distribuye estos colores de forma armoniosa y lógica a través de los demás fragmentos** (Sujeto, Outfit, Escena, Objeto, etc.).
    *   **Reglas de Distribución:**
        *   Usa los **colores dominantes** para las áreas más grandes (ej. el fondo, la prenda principal del outfit).
        *   Usa los **colores secundarios** para otros elementos significativos (ej. una prenda secundaria, un objeto grande).
        *   Usa los **colores de acento** para detalles pequeños y de alto impacto (ej. el color de los ojos, joyas, efectos de luz, bordados, adornos).
        *   Asegúrate de que la aplicación sea **coherente**. No apliques colores extraños a la piel, a menos que la descripción del sujeto lo justifique (ej. "un alienígena de piel verde").
    *   **Ejemplo de Fusión:**
        *   OUTFIT: "a suit of armor"
        *   ESCENA: "in a throne room"
        *   COLOR: "A regal palette with dominant deep purple, secondary gold, and silver accent colors."
        *   **Resultado Ensamblado (parcial):** "...wearing a suit of deep purple armor with gold filigree and silver trim, in a throne room adorned with gold details..."
    *   El fragmento original de PALETA DE COLORES se consume en este proceso y su texto original **NO debe aparecer** en el prompt final. Su propósito es guiar la reescritura, no ser incluido literalmente.

7.  **Regla de Estilo Global vs. Estilos Individuales:**
    *   **Contexto:** Esta es la regla principal para determinar la estética final de la imagen.
    *   **Caso A: Se proporciona un fragmento de ESTILO:**
        *   **Prioridad:** El fragmento ESTILO tiene prioridad absoluta sobre cualquier otro descriptor de estilo.
        *   **Acción:** Su contenido se aplica globalmente a toda la imagen. DEBES eliminar CUALQUIER descriptor de estilo visual específico (ej. 'photorealistic', 'anime style', 'oil painting') que pueda provenir del fragmento SUJETO. El fragmento ESTILO también elimina términos de calidad técnica (ej. '8K', 'hyper-detailed') de todos los demás fragmentos. La estética final debe ser 100% dictada por el fragmento ESTILO.
    *   **Caso B: NO se proporciona un fragmento de ESTILO:**
        *   **Prioridad:** Los estilos individuales descritos en el fragmento SUJETO se conservan. Su integridad es la máxima prioridad.
        *   **Acción:** Tu directiva principal es preservar el estilo visual único de cada sujeto tal como se define en su descripción individual del fragmento SUJETO. Si un sujeto es 'photorealistic' y otro es 'anime style', el prompt final DEBE contener ambas descripciones intactas, asegurando que coexistan manteniendo sus estilos distintos. NO intentes armonizar, promediar o fusionar sus estilos. La integridad de cada estilo individual es la máxima prioridad. Si hay términos de calidad en otros fragmentos (como COMPOSICION o ESCENA), deben ser incluidos al final del prompt.
        *   **Ejemplo de Resultado (Caso B):** "photorealistic young woman with blonde hair leaning against a wall, an old warrior with a beard rendered as a comic book character walking forwards, ..."
    
8.  **Asignación Inteligente de Sujeto y Pose:**
    *   **Prioridad:** REGLA ESPECIAL DE ENSAMBLAJE.
    *   **Contexto:** Esta regla se activa cuando el fragmento SUJETO contiene múltiples descripciones etiquetadas (ej. "Subject 1:", "Subject 2:") Y el fragmento POSE contiene múltiples descripciones de poses (ej. "The figure on the left...", "the person on the right...").
    *   **Acción:** Tu tarea es asignar inteligentemente cada pose a un sujeto. Combina la descripción de "Subject 1" con la primera descripción de pose, y "Subject 2" con la segunda, y así sucesivamente, creando una descripción de escena coherente. Al combinar, retira las etiquetas numéricas ("Subject 1:") y los identificadores de posición de la pose ("The figure on the left") para que la fusión sea natural.
    *   **Ejemplo de Fusión:**
        *   SUJETO: "Subject 1: a young woman with blonde hair. Subject 2: an old warrior with a beard."
        *   POSE: "The figure on the left is leaning against a wall. The figure on the right is walking forwards."
        *   **Resultado Ensamblado (parcial):** "a young woman with blonde hair leaning against a wall, an old warrior with a beard walking forwards, ..."
    *   Si el número de sujetos y poses no coincide, asigna las poses en orden hasta que se agoten y luego incluye los sujetos restantes sin una pose específica. Si hay más poses que sujetos, ignora las poses sobrantes.`;

export const assembleMasterPrompt = async (fragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
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

export const generateMasterPromptMetadata = async (prompt: string, images: ImagePayload[]): Promise<Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>> => {
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
    const systemInstruction = `You are an expert prompt engineer. Analyze the user's text prompt for an image generation AI. Your goal is to refine it for better results. Provide 3-4 concise, actionable suggestions in English.
    
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

const modularizePromptSystemInstruction = `Eres un experto en ingeniería de prompts para IA de generación de imágenes. Tu tarea es analizar un prompt (que puede ser texto plano o un JSON stringificado) y descomponerlo en 9 componentes modulares clave. Devuelve un objeto JSON con exactamente las siguientes 9 claves: 'subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'composition', 'style'.

Reglas:
1.  **Analiza Holísticamente:** Lee el prompt completo para entender la intención general.
2.  **Extrae y Asigna:** Identifica las frases y palabras clave que correspondan a cada una de las 9 categorías y asígnalas al campo correspondiente en el JSON.
3.  **Completa Todos los Campos:** TODOS los 9 campos deben estar presentes en el JSON de salida.
4.  **Manejo de Campos Vacíos:** Si un componente no se encuentra explícitamente en el prompt, deja el valor del campo como un string vacío (""). NO inventes contenido.
5.  **Evita la Redundancia:** Una vez que una parte del prompt se asigna a una categoría, intenta no repetirla en otra, a menos que sea fundamental para ambas (por ejemplo, el color de una prenda).
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

export const modularizePrompt = async (prompt: string): Promise<Record<ExtractionMode, string>> => {
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

export const optimizePromptFragment = async (targetMode: ExtractionMode, allFragments: Partial<Record<ExtractionMode, string>>): Promise<string[]> => {
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

export const adaptFragmentToContext = async (targetMode: ExtractionMode, fragmentToAdapt: string, allFragments: Partial<Record<ExtractionMode, string>>): Promise<string> => {
    
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

export const mergeModulesIntoJsonTemplate = async (modules: Partial<Record<ExtractionMode, string>>, jsonTemplate: string): Promise<string> => {
    
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

export const createJsonTemplate = async (jsonPrompt: string): Promise<string> => {
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
            throw new Error("El texto proporcionado no es un JSON válido y no pudo ser corregido automáticamente.");
        }
    }

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