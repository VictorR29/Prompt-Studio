
import { ExtractionMode } from "../../types";

/**
 * Intenta parsear texto como JSON modular localmente antes de llamar a la IA.
 */
export const attemptLocalModularization = (text: string): Record<ExtractionMode, string> | null => {
    try {
        const json = JSON.parse(text);
        if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
            // Basic validation to check if keys resemble ExtractionMode
            const keys = Object.keys(json);
            const validKeys = ['subject', 'style', 'scene', 'color', 'light', 'composition'];
            if (keys.some(k => validKeys.includes(k))) {
                return json as Record<ExtractionMode, string>;
            }
        }
    } catch (e) {
        // Not JSON
    }
    return null;
};
