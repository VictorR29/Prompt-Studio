

import React, { useState, useEffect } from 'react';
import { Loader } from './Loader';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { generateIdeasForStyle } from '../services/geminiService';
import { ExtractionMode } from '../types';
import { EXTRACTION_MODE_MAP } from '../config';

interface PromptDisplayProps {
  prompt: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: () => void;
  extractionMode: ExtractionMode;
  onUseStyle: (prompt: string) => void;
  onUseIdeaAndStyle: (idea: string, style: string) => void;
  onUseFeature: (feature: string) => void;
}

const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; className: string; children: React.ReactNode }> = ({ onClick, disabled, className, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-300 transform focus:outline-none focus:ring-4 ${className}`}
    >
        {children}
    </button>
);


export const PromptDisplay: React.FC<PromptDisplayProps> = ({ prompt, isLoading, isSaving, error, onSave, extractionMode, onUseStyle, onUseIdeaAndStyle, onUseFeature }) => {
  const [copied, setCopied] = useState(false);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isSuggestingIdeas, setIsSuggestingIdeas] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  useEffect(() => {
    if (prompt) {
      setCopied(false);
      setIdeas([]);
      setIdeasError(null);
    }
  }, [prompt]);

  const handleCopy = () => {
    if (prompt) {
      navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleSuggestIdeas = async () => {
    if (!prompt) return;
    setIsSuggestingIdeas(true);
    setIdeasError(null);
    setIdeas([]);
    try {
      const suggestedIdeas = await generateIdeasForStyle(prompt);
      setIdeas(suggestedIdeas);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      setIdeasError(`Error al sugerir ideas: ${errorMessage}`);
    } finally {
      setIsSuggestingIdeas(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Loader />
          <p className="mt-4 text-lg text-gray-400">Analizando el estilo...</p>
          <p className="text-sm text-gray-500">Esto puede tardar unos segundos.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-center text-red-400 bg-red-500/10 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      );
    }

    if (prompt) {
      const isStyleMode = extractionMode === 'style';
      const useAction = isStyleMode ? onUseStyle : onUseFeature;
      const useActionLabel = `Usar ${EXTRACTION_MODE_MAP[extractionMode].label} en Estructurador`;

      return (
        <div className="relative h-full flex flex-col space-y-4 animate-fade-slide-in-up">
            <div className="flex-grow flex flex-col space-y-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-200 mb-3">Prompt Generado</h2>
                    <div className="relative group">
                        <div className="flex-grow bg-gray-900/70 rounded-lg p-4 pr-12 text-gray-300 overflow-y-auto min-h-[16rem] md:min-h-0 md:max-h-64 whitespace-pre-wrap font-mono text-sm ring-1 ring-white/10 custom-scrollbar">
                            {prompt}
                        </div>
                        <button
                            onClick={handleCopy}
                            className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500 transition-colors"
                            aria-label="Copiar prompt"
                        >
                            {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
                        </button>
                    </div>
                </div>
                
                {(isStyleMode && (ideas.length > 0 || isSuggestingIdeas || ideasError)) && (
                  <div className="border-t border-white/10 pt-4">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Ideas Sugeridas:</h3>
                    {isSuggestingIdeas && <p className="text-gray-400 text-sm">Generando...</p>}
                    {ideasError && <p className="text-red-400 text-sm">{ideasError}</p>}
                    {ideas.length > 0 && (
                      <div className="overflow-y-auto max-h-56 space-y-2 custom-scrollbar pr-2">
                        {ideas.map((idea, index) => (
                          <div key={index} className="bg-gray-900/50 p-3 rounded-lg flex justify-between items-center ring-1 ring-white/10">
                            <p className="text-gray-300 text-sm flex-grow">"{idea}"</p>
                            <button
                              onClick={() => onUseIdeaAndStyle(idea, prompt)}
                              className="ml-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-1.5 px-3 rounded-md transition-colors flex-shrink-0"
                            >
                              Usar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
            <div className="mt-auto pt-4 space-y-3 border-t border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ActionButton
                        onClick={onSave}
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-500 text-white focus:ring-green-500/50 disabled:bg-green-500/20 disabled:text-gray-400"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar en Galería'}
                    </ActionButton>
                    
                    <ActionButton onClick={() => useAction(prompt)} className="bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500/50">
                        {useActionLabel}
                    </ActionButton>
                </div>

                {isStyleMode && (
                  <ActionButton
                    onClick={handleSuggestIdeas}
                    disabled={isSuggestingIdeas}
                    className="bg-teal-600 hover:bg-teal-500 text-white focus:ring-teal-500/50 disabled:bg-teal-500/20 disabled:text-gray-400"
                  >
                    {isSuggestingIdeas ? 'Buscando inspiración...' : 'Sugerir Ideas'}
                  </ActionButton>
                )}
            </div>
        </div>
      );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-500">Esperando análisis</h2>
            <p className="mt-1 text-gray-600">El prompt generado aparecerá aquí.</p>
        </div>
    );
  };

  return <div className="h-full">{renderContent()}</div>;
};
