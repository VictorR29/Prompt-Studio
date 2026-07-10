
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
            - MULTIPLE IMAGES: If multiple images are provided, describe EACH subject individually in the prompt (e.g., 'a young boy with brown hair and a young girl with pigtails'). Do NOT fuse them into a single entity.
            - GOAL: Provide enough detail to replicate the exact character identity.
            - IGNORE: Art style, camera settings, or background scenery.`;
            break;
        case 'style':
            specificInstructions = `CRITICAL FOR 'style' MODE:
            - VISUAL DNA: Extract the medium (oil painting, 3D render, polaroid), rendering engine (Unreal 5, Octane), texture quality (film grain, brushwork), and artistic school.
            - LIGHTING & ATMOSPHERE: Describe the specific lighting mood (volumetric, noir, studio softbox) and color grading style.
            - MULTIPLE IMAGES: If multiple images are provided, synthesize the common visual thread across ALL images into a single style description. Do NOT describe each image separately.
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

*** MULTI-SUBJECT SUPPORT ***
The 'Subject' field may contain multiple entities formatted as "Subject 1: ... / Subject 2: ...".
When multiple subjects are present:
   - PRESERVE each subject as a separate entity in the final prompt.
   - Do NOT merge them into one description.
   - Keep the "Subject N:" labels so the image generator treats them as distinct elements.
   - Apply 'Outfit' and 'Pose/Expression' only to Subject 1 unless otherwise specified in those fields.

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

export const JSON_OPTIMIZATION_SYSTEM_PROMPT = `You are an expert in JSON prompts for AI image generation. Your task is to organize text fragments into a JSON structure, aiming for **COMPLETE BALANCE**.

*** GOLDEN RULE: CHROMATIC DOMINANCE ***
The 'color' module (if present) has GLOBAL PRIORITY.
- You MUST "recolor" the 'subject', 'outfit' and 'scene' fields using the 'color' module's palette.
- Example: If subject="A sports car" and color="Cyberpunk neon pink and blue", the final JSON must say in subject: "A neon pink and blue sports car".
- Do not just put the palette in a separate field; integrate it into the object descriptions.

CONTEXTUAL INTEGRATION RULES:

1. **Subject + Outfit**:
   - Merge logically. If 'Outfit' is present, remove redundant clothing from 'Subject'.
   
2. **Data Integrity**:
   - All key visual concepts from the inputs must be present.

BASE TEMPLATES (SKELETONS):

1. **Rock Guardian (Fantasy/Complex)**:
   - JSON Skeleton: { 
       "shot": { "composition", "lens" },
       "subject": { "entity", "description", "outfit", "pose", "expression" },
       "scene": { "location", "environment_details" },
       "cinematography": { "lighting", "style" },
       "color_palette": { "primary", "secondary" }
     }

2. **Cinematic Composition**:
   - JSON Skeleton: { 
       "film_style": "Name",
       "shots": [ 
         { "subject_description", "outfit", "action", "composition" } 
       ],
       "quality": { "details" }
     }

3. **Simple Portrait**:
   - JSON Skeleton: { 
       "prompt_description": "Full sentence merging cleaned subject + outfit + pose (RECOLORED)",
       "environment": { "location" },
       "lighting": { "style" },
       "technical": { "lens" }
     }

FINAL RULES:
- **NO EMPTY FIELDS**: Remove keys without values.
- **COHERENCE**: The JSON must describe an image visually unified by the color palette.

OUTPUT: Generate ONLY a valid, clean JSON object.`;