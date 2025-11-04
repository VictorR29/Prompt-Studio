import { SavedPrompt, ExtractionMode } from './types';

interface ModeConfig {
  id: ExtractionMode;
  label: string;
  description: string;
  badgeClassName: string;
}

export const EXTRACTION_MODES: ModeConfig[] = [
  { id: 'style', label: 'Estilo', description: 'Técnica, color, atmósfera', badgeClassName: 'bg-green-500/20 text-green-300 ring-green-500/30 hover:bg-green-500/30' },
  { id: 'subject', label: 'Sujeto', description: 'Personaje o elemento principal', badgeClassName: 'bg-red-500/20 text-red-300 ring-red-500/30 hover:bg-red-500/30' },
  { id: 'pose', label: 'Pose', description: 'Postura del personaje', badgeClassName: 'bg-blue-500/20 text-blue-300 ring-blue-500/30 hover:bg-blue-500/30' },
  { id: 'expression', label: 'Expresión', description: 'Emoción y rasgos faciales', badgeClassName: 'bg-amber-500/20 text-amber-300 ring-amber-500/30 hover:bg-amber-500/30' },
  { id: 'scene', label: 'Escena', description: 'Entorno y ambientación', badgeClassName: 'bg-teal-500/20 text-teal-300 ring-teal-500/30 hover:bg-teal-500/30' },
  { id: 'outfit', label: 'Outfit', description: 'Vestuario y accesorios', badgeClassName: 'bg-pink-500/20 text-pink-300 ring-pink-500/30 hover:bg-pink-500/30' },
  { id: 'object', label: 'Objeto', description: 'Objeto o elemento aislado', badgeClassName: 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30 hover:bg-indigo-500/30' },
  { id: 'composition', label: 'Composición', description: 'Encuadre, ángulo y foco', badgeClassName: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30 hover:bg-cyan-500/30' },
  { id: 'color', label: 'Color', description: 'Esquema, tonos y contraste', badgeClassName: 'bg-orange-500/20 text-orange-300 ring-orange-500/30 hover:bg-orange-500/30' },
];


interface PromptTypeInfo {
    className: string;
    text: string;
}

export const PROMPT_TYPE_CONFIG: Record<SavedPrompt['type'], PromptTypeInfo> = {
    style: { className: 'bg-green-500/20 text-green-300 ring-green-500/30', text: 'Estilo' },
    structured: { className: 'bg-purple-500/20 text-purple-300 ring-purple-500/30', text: 'JSON' },
    master: { className: 'bg-gray-500/20 text-gray-300 ring-gray-500/30', text: 'Maestro' },
    subject: { className: 'bg-red-500/20 text-red-300 ring-red-500/30', text: 'Sujeto' },
    pose: { className: 'bg-blue-500/20 text-blue-300 ring-blue-500/30', text: 'Pose' },
    expression: { className: 'bg-amber-500/20 text-amber-300 ring-amber-500/30', text: 'Expresión' },
    scene: { className: 'bg-teal-500/20 text-teal-300 ring-teal-500/30', text: 'Escena' },
    outfit: { className: 'bg-pink-500/20 text-pink-300 ring-pink-500/30', text: 'Outfit' },
    object: { className: 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30', text: 'Objeto' },
    composition: { className: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30', text: 'Composición' },
    color: { className: 'bg-orange-500/20 text-orange-300 ring-orange-500/30', text: 'Color' },
};


export const EXTRACTION_MODE_MAP = EXTRACTION_MODES.reduce((acc, mode) => {
    acc[mode.id] = mode;
    return acc;
}, {} as Record<ExtractionMode, ModeConfig>);
