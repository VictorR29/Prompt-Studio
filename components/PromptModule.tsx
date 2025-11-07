

import React from 'react';
import { ExtractionMode, SavedPrompt } from '../types';
import { EXTRACTION_MODE_MAP } from '../config';
import { SparklesIcon } from './icons/SparklesIcon';
import { GalleryIcon } from './icons/GalleryIcon';
import { SaveIcon } from './icons/SaveIcon';

interface PromptModuleProps {
    mode: ExtractionMode;
    config: typeof EXTRACTION_MODE_MAP[ExtractionMode];
    value: string;
    onChange: (mode: ExtractionMode, value: string) => void;
    onSavePrompt: (prompt: SavedPrompt) => void;
    savedPrompts: SavedPrompt[];
    onOpenGallery: (mode: ExtractionMode) => void;
    onOptimize: (mode: ExtractionMode) => void;
    isOptimizing: boolean;
    suggestions: string[];
}

const SmallLoader: React.FC = () => (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const PromptModule: React.FC<PromptModuleProps> = ({ 
    mode, 
    config, 
    value, 
    onChange, 
    onSavePrompt, 
    onOpenGallery,
    onOptimize,
    isOptimizing,
    suggestions 
}) => {

    const handleSaveFragment = () => {
        if (!value) return;
        const newPrompt: SavedPrompt = {
            id: Date.now().toString(),
            type: mode,
            prompt: value,
            coverImage: '',
            title: `${config.label} - ${value.substring(0, 20)}...`,
            category: config.label,
            artType: 'Fragmento de Prompt',
            notes: `Fragmento de tipo '${config.label}' guardado desde el Editor Modular.`
        };
        onSavePrompt(newPrompt);
        alert(`'${config.label}' guardado en la galería!`);
    };

    return (
        <div className="glass-pane p-4 rounded-xl flex flex-col space-y-3">
            <h3 className={`font-semibold text-lg ${config.badgeClassName.replace('bg-', 'text-').replace('/20', '')}`}>{config.label}</h3>
            <div className="relative flex-grow">
                <textarea
                    value={value}
                    onChange={(e) => onChange(mode, e.target.value)}
                    placeholder={config.description}
                    className="w-full h-full min-h-[100px] bg-gray-900/70 rounded-lg p-3 text-gray-300 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner resize-none custom-scrollbar"
                />
            </div>
            {suggestions.length > 0 && (
                <div className="space-y-2 animate-fade-slide-in-up">
                    {suggestions.map((s, i) => (
                        <button key={i} onClick={() => onChange(mode, s)} className="w-full text-left p-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors">
                            {s}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/10">
                <button onClick={() => onOptimize(mode)} disabled={!value || isOptimizing} title="Optimizar con IA" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors">
                    {isOptimizing ? <SmallLoader /> : <SparklesIcon className="w-4 h-4 text-purple-400" />}
                </button>
                <button onClick={() => onOpenGallery(mode)} title="Reemplazar desde Galería" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors">
                    <GalleryIcon className="w-4 h-4 text-cyan-400" />
                </button>
                 <button onClick={handleSaveFragment} disabled={!value} title="Guardar fragmento en Galería" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors">
                    <SaveIcon className="w-4 h-4 text-green-400" />
                </button>
            </div>
        </div>
    );
};