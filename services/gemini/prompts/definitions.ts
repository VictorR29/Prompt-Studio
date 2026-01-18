
/**
 * Prompts de sistema y definiciones constantes para los modelos de Gemini.
 */

export const IMAGE_ANALYSIS_PROMPT = (mode: string) => {
    let specificInstructions = "";

    switch (mode) {
        case 'subject':
            specificInstructions = `CRITICAL FOR 'subject' MODE:
            - DETAILED VISUALS: Describe physical traits (age, race, skin texture, body build), hair (style, color), and distinctive features (scars, tattoos, makeup).
            - ESSENTIAL CONTEXT: Include immediate context if it defines the subject (e.g., 'holding a glowing staff', 'sitting on a throne').
            - GOAL: Provide enough detail to replicate the exact character identity.
            - IGNORE: Art style, camera settings, or background scenery.`;
            break;
        case 'style':
            specificInstructions = `CRITICAL FOR 'style' MODE:
            - VISUAL DNA: Extract the medium (oil painting, 3D render, polaroid), rendering engine (Unreal 5, Octane), texture quality (film grain, brushwork), and artistic school.
            - LIGHTING & ATMOSPHERE: Describe the specific lighting mood (volumetric, noir, studio softbox) and color grading style.
            - IGNORE: The actual subject matter or scene content.`;
            break;
        case 'pose':
            specificInstructions = `CRITICAL FOR 'pose' MODE:
            - ANATOMY: Describe exact limb positioning, hand gestures, head tilt, and spine curvature.
            - DYNAMICS: Capture the action energy (floating, sprinting, slouching) and camera perspective relative to the body (profile, foreshortened).
            - IGNORE: Character identity, outfit details, or background.`;
            break;
        case 'expression':
            specificInstructions = `CRITICAL FOR 'expression' MODE:
            - MICRO-DETAILS: Describe the exact state of eyebrows, eyes (gaze direction, openness), mouth, and muscle tension.
            - EMOTION: Capture the nuanced emotion (e.g., 'subtle disdain', 'manic joy') rather than just 'happy'.
            - IGNORE: Identity, style, or general body pose.`;
            break;
        case 'outfit':
            specificInstructions = `CRITICAL FOR 'outfit' MODE:
            - MATERIALITY: Describe fabric textures (silk, matte leather, distressed denim), heavy elements (armor, metal), and fit.
            - LAYERS: List garments from inner to outer, including specific accessories (belts, jewelry).
            - IGNORE: The person wearing it, pose, or background.`;
            break;
        case 'object':
            specificInstructions = `CRITICAL FOR 'object' MODE:
            - STRUCTURE: Describe the object's shape, material properties, wear and tear, and mechanical details.
            - IGNORE: The background or the person holding it (focus strictly on the item).`;
            break;
        case 'scene':
            specificInstructions = `CRITICAL FOR 'scene' MODE:
            - WORLD BUILDING: Describe architecture, vegetation, terrain, weather, time of day, and lighting sources.
            - DEPTH: Detail the foreground, midground, and background elements.
            - IGNORE: The main character/subject in the foreground.`;
            break;
        case 'composition':
            specificInstructions = `CRITICAL FOR 'composition' MODE:
            - CAMERA SPECS: Identify shot type (macro, wide-angle), lens characteristics (fisheye, telephoto), depth of field (bokeh), framing rules, and angle.
            - IGNORE: The actual subject content or style.`;
            break;
        case 'color':
            specificInstructions = `CRITICAL FOR 'color' MODE:
            - PALETTE: List dominant colors, accent tones, and lighting temperature (warm/cool).
            - VALUES: Describe saturation levels and contrast (high-key, low-key, faded).
            - IGNORE: Shapes or specific objects.`;
            break;
        case 'negative':
             specificInstructions = `CRITICAL FOR 'negative' MODE:
             - FLAWS: Identify visual defects to avoid (blur, artifacts, bad anatomy, watermark, text, chromatic aberration).`;
             break;
        default:
            specificInstructions = `Focus EXCLUSIVELY on the '${mode}' aspect. Describe it with high fidelity to replicate the image.`;
    }

    return `Analyze the provided images to generate a High-Fidelity text-to-image prompt fragment for the '${mode}' aspect.

${specificInstructions}

STRICT OUTPUT RULES:
1. Return ONLY the prompt text. No introductory filler.
2. DENSITY OVER BREVITY: The prompt must be detailed enough to REPLICATE the image feature exactly. Do not be vague.
3. Use precise, descriptive adjectives and nouns.
4. DO NOT describe elements outside the requested mode.
5. For 'subject', ensure sufficient context to avoid inappropriate results (e.g., nudity), but keep it focused on the entity.`;
};

export const MASTER_PROMPT_ASSEMBLY = `ACT AS: Expert AI Prompt Engineer.
TASK: Assemble the provided prompt fragments into a SINGLE, seamless, high-density prompt block.

INPUT DATA: You will receive a JSON object with keys like 'subject', 'outfit', 'style', 'color', etc.

*** CORE PRINCIPLE: BALANCED INTEGRATION ***
You must use ALL provided fragments. They are all equally important ingredients.

*** CRITICAL: INTELLIGENT RECOLORING LOGIC ***
The 'Color' module is the SUPREME AUTHORITY on the visual palette.
- **Action**: You must ACTIVELY RECOLOR the 'Subject', 'Outfit', and 'Scene' using the 'Color' module.
- **Priority**: If the 'Color' module specifies "Black and Gold", and the Subject is "A knight", output "A black and gold knight". 
- **Conflict**: If the Subject has a defined color (e.g., "Red Tie") that strictly clashes with the 'Color' palette (e.g., "Blue Monochrome"), blend them intelligently (e.g., "Blue suit with a dark purple tie") OR let the 'Color' module override if it implies a global lighting filter.

*** CONTEXTUAL SUBSTITUTION RULES ***

1. **Subject vs Outfit**: 
   - 'Subject' defines ENTITY. 'Outfit' defines ATTIRE.
   - Combine them: Apply 'Outfit' to 'Subject'. Remove conflicting clothes from 'Subject'.
   
2. **Subject vs Pose/Expression**:
   - 'Pose' and 'Expression' override any action in 'Subject'.

3. **Global Styling**:
   - 'Style' and 'Color' wrap the entire prompt.

STRICT OUTPUT RULES:
1. **NO STRUCTURE**: Do NOT use paragraphs, bullet points, or labels.
2. **NO CHAT**: Return ONLY the final prompt string.
3. **FLOW**: [Art Style] -> [Recolored Subject + Outfit + Pose + Expression] -> [Recolored Scene] -> [Lighting/Color Specs] -> [Tech Specs].
4. **DENSITY**: Use natural language mixed with comma-separated tags.

FINAL RESULT MUST BE A SINGLE STRING READY FOR GENERATION.`;

export const JSON_OPTIMIZATION_SYSTEM_PROMPT = `Eres un experto en prompts JSON para generación de imágenes IA. Tu tarea es organizar fragmentos de texto en una estructura JSON, buscando el **EQUILIBRIO TOTAL**.

*** REGLA DE ORO: DOMINIO CROMÁTICO ***
El módulo 'color' (si existe) tiene PRIORIDAD GLOBAL.
- Debes "recolorear" los campos 'subject', 'outfit' y 'scene' usando la paleta del módulo 'color'.
- Ejemplo: Si subject="Un coche deportivo" y color="Cyberpunk neon pink and blue", el JSON final debe decir en subject: "Un coche deportivo rosa neón y azul".
- No te limites a poner la paleta en un campo separado; intégrala en las descripciones de los objetos.

REGLAS DE INTEGRACIÓN CONTEXTUAL:

1. **Sujeto + Outfit**:
   - Fusiona lógicamente. Si hay 'Outfit', elimina la ropa redundante en 'Subject'.
   
2. **Integridad de Datos**:
   - Todos los conceptos visuales clave de los inputs deben estar presentes.

PLANTILLAS BASE (SKELETONS):

1. **Guardián de Roca (Fantasía/Complejo)**:
   - JSON Skeleton: { 
       "shot": { "composition", "lens" },
       "subject": { "entity", "description", "outfit", "pose", "expression" },
       "scene": { "location", "environment_details" },
       "cinematography": { "lighting", "style" },
       "color_palette": { "primary", "secondary" }
     }

2. **Composición Cinematográfica**:
   - JSON Skeleton: { 
       "film_style": "Name",
       "shots": [ 
         { "subject_description", "outfit", "action", "composition" } 
       ],
       "quality": { "details" }
     }

3. **Retrato Simple**:
   - JSON Skeleton: { 
       "prompt_description": "Full sentence merging cleaned subject + outfit + pose (RECOLORED)",
       "environment": { "location" },
       "lighting": { "style" },
       "technical": { "lens" }
     }

REGLAS FINALES:
- **NO CAMPOS VACÍOS**: Elimina claves sin valor.
- **COHERENCIA**: El JSON debe describir una imagen visualmente unificada por la paleta de colores.

OUTPUT: Genera SOLO el objeto JSON válido y limpio.`;