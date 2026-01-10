
/**
 * Prompts de sistema y definiciones constantes para los modelos de Gemini.
 */

export const IMAGE_ANALYSIS_PROMPT = (mode: string) => 
    `Analyze these images and extract the ${mode} details. Be specific, descriptive and use natural language to capture nuances.`;

export const MASTER_PROMPT_ASSEMBLY = `ACT AS: Expert AI Prompt Engineer (Midjourney/Stable Diffusion Specialist).
TASK: Assemble the provided prompt fragments into a SINGLE, seamless, high-density prompt block.

STRICT OUTPUT RULES:
1. NO STRUCTURE: Do NOT use paragraphs, bullet points, or labels (like "Subject:"). 
2. NO CHAT: Return ONLY the final prompt string. No "Here is the prompt".
3. FLOW: Organize tokens logically: [Art Style/Medium] -> [Subject & Action] -> [Environment] -> [Lighting/Color] -> [Technical Specs].
4. OPTIMIZATION: 
   - Remove redundant words (e.g., if Style is "Photo", don't say "Photograph of" in Subject).
   - Connect ideas fluently (e.g., "A cyberpunk samurai standing in neon rain" instead of "Cyberpunk samurai. Neon rain.").
5. DENSITY: Use commas for technical tags (e.g., "8k, unreal engine 5, octane render").

FINAL RESULT MUST BE A SINGLE STRING READY FOR GENERATION.`;

export const JSON_OPTIMIZATION_SYSTEM_PROMPT = `ACT AS: Senior AI Prompt Analyst & Data Architect.
TASK: Distill the provided prompt modules into a STRICT Hierarchical JSON Map optimized for Diffusion Models (Stable Diffusion/Flux/Midjourney).

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

RETURN ONLY THE JSON OBJECT.`;
