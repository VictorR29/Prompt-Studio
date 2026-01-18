
/**
 * Prompts de sistema y definiciones constantes para los modelos de Gemini.
 */

export const IMAGE_ANALYSIS_PROMPT = (mode: string) => {
    let specificInstructions = "";

    switch (mode) {
        case 'subject':
            specificInstructions = `CRITICAL FOR 'subject' MODE:
            - Describe the main character/object and their immediate context (e.g., outfit, essential accessories).
            - Include enough detail to prevent the subject from appearing incomplete or nude if human.
            - IGNORE art style, camera angles, or background scenery unless integral to the character's identity.`;
            break;
        case 'style':
            specificInstructions = `CRITICAL FOR 'style' MODE:
            - EXTRACT ONLY the artistic medium (e.g., oil, digital, photo), technique, brushwork, and visual aesthetic.
            - IGNORE the content of the image (who is in it, what they are doing).`;
            break;
        case 'pose':
            specificInstructions = `CRITICAL FOR 'pose' MODE:
            - EXTRACT ONLY the body position, gesture, limb placement, and stance.
            - IGNORE the character's identity, clothes, or the background.`;
            break;
        case 'expression':
            specificInstructions = `CRITICAL FOR 'expression' MODE:
            - EXTRACT ONLY the facial emotion, gaze direction, and micro-expressions.
            - IGNORE who the person is or what style the image is in.`;
            break;
        case 'outfit':
            specificInstructions = `CRITICAL FOR 'outfit' MODE:
            - EXTRACT ONLY the clothing, armor, jewelry, fabrics, and textures.
            - IGNORE the person wearing them, their pose, or the background.`;
            break;
        case 'object':
            specificInstructions = `CRITICAL FOR 'object' MODE:
            - EXTRACT ONLY the specific object or prop.
            - IGNORE the surroundings or who is holding it.`;
            break;
        case 'scene':
            specificInstructions = `CRITICAL FOR 'scene' MODE:
            - EXTRACT ONLY the location, environment, weather, time of day, and background elements.
            - IGNORE the foreground characters or subjects.`;
            break;
        case 'composition':
            specificInstructions = `CRITICAL FOR 'composition' MODE:
            - EXTRACT ONLY the camera angle, framing (e.g., close-up, wide), depth of field, and perspective.
            - IGNORE the actual subject matter or style.`;
            break;
        case 'color':
            specificInstructions = `CRITICAL FOR 'color' MODE:
            - EXTRACT ONLY the color palette, lighting temperature, saturation, and contrast.
            - IGNORE shapes, subjects, or composition.`;
            break;
        case 'negative':
             specificInstructions = `CRITICAL FOR 'negative' MODE:
             - Identify visual defects or elements that should be avoided based on this image (e.g., blur, noise, distortion).`;
             break;
        default:
            specificInstructions = `Focus EXCLUSIVELY on the '${mode}' aspect. IGNORE all other visual elements.`;
    }

    return `Analyze the provided images to generate a specific text-to-image prompt fragment.

${specificInstructions}

STRICT OUTPUT RULES:
1. Return ONLY the prompt text. No "Here is the prompt", no labels, no markdown.
2. Keep it concise.
3. DO NOT describe elements outside the requested mode (e.g., do not describe the dress if asking for 'pose').
4. For 'subject', ensure sufficient context to avoid inappropriate results (e.g., nudity), but keep it focused on the entity.`;
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