
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

export const JSON_OPTIMIZATION_SYSTEM_PROMPT = `Eres un experto en prompts JSON para generación de imágenes IA. Tu tarea es tomar fragmentos de texto sueltos (inputs del usuario) y organizarlos dentro de una estructura JSON profesional optimizada.

PLANTILLAS BASE (SKELETONS) - USA SOLO LA ESTRUCTURA, NO EL CONTENIDO DE EJEMPLO:

1. **Guardián de Roca (Estructura para Fantasía/Complejo)**:
   - Use this structure for: Escenas épicas, fantasía detallada, descripciones densas.
   - JSON Skeleton: { 
       "shot": { "composition", "camera_motion", "lens", "depth_of_field", "film_grain" },
       "subject": { "entity", "description", "movement", "eyes" },
       "scene": { "location", "time_of_day", "environment_details" },
       "visual_details": { "primary_action", "secondary_motion", "resolution", "special_effects": [] },
       "cinematography": { "lighting", "style", "tone" },
       "color_palette": { "name", "skin", "glow", "eyes", "environment", "background" },
       "visual_rules": { "prohibited_elements": [] },
       "face_reference": { "instruction" },
       "quality": { "resolution", "details", "finish" }
     }

2. **Composición Cinematográfica (Estructura Narrativa/Multi-frame)**:
   - Use this structure for: Secuencias, storytelling, múltiples ángulos de lo mismo.
   - JSON Skeleton: { 
       "film": "Project Name",
       "shots": [ 
         { "prompt", "style", "composition": { "angle", "lens" }, "lighting" } 
       ],
       "face_reference": { "instruction" },
       "quality": { "resolution", "details", "finish" }
     }

3. **Retrato Auto Vintage (Estructura Simple/Retrato)**:
   - Use this structure for: Retratos centrados en sujeto, fotografía simple, photorealism limpio.
   - JSON Skeleton: { 
       "prompt_description": "Full sentence description",
       "face_reference": { "instruction" },
       "scene_and_environment": { "location", "interior", "weather", "details" },
       "lighting_and_colors": { "style", "sources", "effect", "quality" },
       "composition": { "angle", "framing", "subject_pose", "expression", "background" },
       "technical_details": { "lens", "effects": [], "textures": [], "color_and_contrast" },
       "quality": { "resolution", "details", "finish" }
     }

4. **Fusionado Híbrido (Estructura Flexible)**:
   - Use this structure for: Mezclas abstractas o cuando las otras no encajan.
   - JSON Skeleton: { 
       "prompt_template": "Sentence template with placeholders",
       "mode": "single-shot" | "multi-shot",
       "face_reference": { "instruction" },
       "shots": [
         { 
           "prompt", 
           "subject": { "description", "pose" },
           "scene_and_environment": { "location", "details" },
           "composition": { "angle", "framing" },
           "lighting_and_colors": { "style", "sources", "effect" },
           "color_palette": { "name", "primary", "secondary", "background" },
           "technical_details": { "lens", "effects": [], "textures": [] }
         }
       ],
       "visual_rules": { "prohibited_elements": [] },
       "quality": { "resolution", "details", "finish" }
     }

REGLAS DE ORO PARA LA GENERACIÓN:

1. **CONTENIDO ORIGINAL**: El JSON final debe estar poblado ÚNICAMENTE con la información derivada de los inputs del usuario.
   - **PROHIBIDO**: No copies textos de ejemplo de las plantillas (nada de "ancient rock guardian" o "vintage car" a menos que el usuario lo pida). Usa solo las claves (keys) del JSON.
   - Si un campo de la estructura no tiene información correspondiente en el input del usuario, omítelo o llénalo de forma genérica/técnica acorde al estilo.

2. **EXPANSIÓN COHERENTE (NO ALUCINACIÓN)**:
   - Si un input es vago (ej: "un gato"), expándelo para alcanzar calidad profesional (ej: "un gato con pelaje detallado, iluminación de estudio, 8k").
   - **NO INVENTES DATOS**: No agregues objetos específicos (ej: "un sombrero rojo") si no están en los fragmentos. Toda expansión debe ser puramente descriptiva/técnica para mejorar la calidad visual, no narrativa.

3. **OPTIMIZACIÓN CONTEXTUAL**:
   - Analiza todos los fragmentos juntos.
   - Si 'Style' dice "Cyberpunk" y 'Subject' dice "Samurai", asegúrate de que en 'Lighting' haya neones y en 'Colors' haya cian/magenta.
   - Elimina redundancias y conflictos. Prioriza el módulo 'Style' para determinar el acabado final (quality/finish).

4. **SELECCIÓN DE PLANTILLA**:
   - Usa #3 para retratos o escenas simples.
   - Usa #1 para fantasía compleja o escenas con mucha atmósfera.
   - Usa #2 si se implica movimiento o narrativa.
   - Usa #4 para todo lo demás.

OUTPUT: Genera SOLO el objeto JSON válido.`;
