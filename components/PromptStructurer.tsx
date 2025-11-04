

import React, { useState, useCallback, useEffect } from 'react';
import { generateStructuredPrompt, generateStructuredPromptFromImage, generateStructuredPromptMetadata } from '../services/geminiService';
import { Loader } from './Loader';
import { JsonDisplay } from './JsonDisplay';
import { ImageUploader } from './ImageUploader';
import { fileToBase64 } from '../utils/fileUtils';
import { SavedPrompt } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { CloseIcon } from './icons/CloseIcon';

type Mode = 'idea' | 'image';
type ImageState = { url: string; base64: string; mimeType: string; };


interface PromptStructurerProps {
    initialStyle: string | null;
    onClearInitialStyle: () => void;
    initialIdea: string | null;
    onClearInitialIdea: () => void;
    onSaveEditedPrompt: (prompt: Omit<SavedPrompt, 'id'>) => void;
    onGoToEditor: (prompt: string) => void;
}

export const PromptStructurer: React.FC<PromptStructurerProps> = ({ 
    initialStyle, 
    onClearInitialStyle, 
    initialIdea,
    onClearInitialIdea,
    onSaveEditedPrompt,
    onGoToEditor
}) => {
  const [mode, setMode] = useState<Mode>('idea');
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState('');
  const [subjectImages, setSubjectImages] = useState<ImageState[]>([]);
  const [structuredPrompt, setStructuredPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStyle) {
      setMode('idea');
      setStyle(initialStyle);
      onClearInitialStyle();
    }
  }, [initialStyle, onClearInitialStyle]);

  useEffect(() => {
    if (initialIdea) {
      setMode('idea');
      setIdea(initialIdea);
      onClearInitialIdea();
    }
  }, [initialIdea, onClearInitialIdea]);


  const handleGenerateClick = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setStructuredPrompt('');

    try {
      let resultJson: string;
      if (mode === 'idea') {
        if (!idea.trim()) {
          setError('Por favor, introduce una idea para la imagen.');
          setIsLoading(false);
          return;
        }
        resultJson = await generateStructuredPrompt({ idea, style });
      } else { 
        if (subjectImages.length === 0) {
          setError('Por favor, sube al menos una imagen de sujeto para analizar.');
          setIsLoading(false);
          return;
        }
        const imagePayloads = subjectImages.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
        resultJson = await generateStructuredPromptFromImage(
            imagePayloads,
            style
        );
      }
      setStructuredPrompt(resultJson);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      setError(`Error en la generación: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [idea, style, subjectImages, mode]);

 const handleSubjectImageUpload = useCallback(async (files: File[]) => {
    if (subjectImages.length + files.length > 3) {
      setError('Puedes subir un máximo de 3 imágenes para este modo.');
      return;
    }
    setError(null);
    try {
      const newImages = await Promise.all(
        Array.from(files).map(async (file) => {
          const { base64, mimeType } = await fileToBase64(file);
          return {
            url: URL.createObjectURL(file),
            base64,
            mimeType,
          };
        })
      );
      setSubjectImages(prevImages => [...prevImages, ...newImages]);
    } catch (err) {
      setError('Error al procesar las imágenes.');
      console.error(err);
    }
  }, [subjectImages.length]);

  const handleSubjectImageRemove = useCallback((indexToRemove: number) => {
    setSubjectImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    setError(null);
  }, []);

  
  const handleSave = async () => {
    if (!structuredPrompt) return;
    setIsSaving(true);
    setError(null);
    try {
      const imagePayload = subjectImages.length > 0 ? { imageBase64: subjectImages[0].base64, mimeType: subjectImages[0].mimeType } : undefined;
      const metadata = await generateStructuredPromptMetadata(structuredPrompt, imagePayload);
      
      const coverImageDataUrl = subjectImages.length > 0 ? `data:${subjectImages[0].mimeType};base64,${subjectImages[0].base64}` : '';
      
      onSaveEditedPrompt({
        type: 'structured',
        prompt: structuredPrompt,
        coverImage: coverImageDataUrl,
        ...metadata,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      setError(`Error al guardar: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const isGenerateButtonDisabled = isLoading || (mode === 'idea' ? !idea.trim() : subjectImages.length === 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="flex flex-col space-y-4 glass-pane p-6 rounded-2xl">
        <div className="flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">Crea un Prompt Estructurado</h2>
          <p className="mt-2 text-gray-400">
            {mode === 'idea' 
              ? "Describe tu idea y la IA creará un prompt JSON optimizado y modular para ti."
              : "Sube hasta 3 imágenes de sujeto y opcionalmente añade un prompt de estilo para crear un prompt JSON."
            }
          </p>
        </div>
        
        <div className="p-1 bg-gray-900/50 rounded-full self-center">
            <div className="relative flex space-x-1">
                 <div
                    className="absolute top-0 left-0 h-full w-1/2 bg-teal-600 rounded-full transition-transform duration-300 ease-in-out"
                    style={{ transform: mode === 'idea' ? 'translateX(0%)' : 'translateX(100%)' }}
                />
                <button
                    onClick={() => setMode('idea')}
                    className={`relative z-10 px-4 py-2 text-sm font-semibold rounded-full transition-colors w-32 ${mode === 'idea' ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                >
                    Desde Idea
                </button>
                <button
                    onClick={() => setMode('image')}
                    className={`relative z-10 px-4 py-2 text-sm font-semibold rounded-full transition-colors w-32 ${mode === 'image' ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                >
                    Desde Imagen
                </button>
            </div>
        </div>
        
        <div className="flex-grow flex flex-col">
            {mode === 'idea' ? (
                <div key="idea-content" className="space-y-4 animate-fade-slide-in-up flex flex-col flex-grow">
                    <div className="relative w-full flex-grow flex flex-col">
                        <textarea
                            value={idea}
                            onChange={(e) => setIdea(e.target.value)}
                            placeholder="Describe una idea simple (ej: un astronauta en Marte) o pega un prompt detallado para convertirlo a JSON."
                            className="w-full flex-grow bg-gray-900/50 rounded-lg p-4 pr-10 text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[150px] text-base resize-none"
                            aria-label="Idea principal para el prompt"
                        />
                         {idea && (
                            <button 
                                onClick={() => setIdea('')} 
                                className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors" 
                                aria-label="Limpiar idea"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="relative w-full">
                        <textarea
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            placeholder="Estilo (Opcional): Pega un prompt de estilo aquí, o usa el botón desde el Extractor..."
                            className="w-full bg-gray-900/50 rounded-lg p-4 pr-10 text-gray-300 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[100px] text-sm resize-none"
                            aria-label="Estilo para el prompt"
                        />
                        {style && (
                            <button 
                                onClick={() => setStyle('')} 
                                className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors" 
                                aria-label="Limpiar estilo"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div key="image-content" className='space-y-4 overflow-y-auto pr-2 -mr-2 custom-scrollbar animate-fade-slide-in-up flex-grow'>
                    <div>
                        <h3 className='text-lg font-semibold mb-2 text-teal-300'>Imagen del Sujeto (Principal)</h3>
                        <ImageUploader 
                            onImagesUpload={handleSubjectImageUpload}
                            onImageRemove={handleSubjectImageRemove}
                            images={subjectImages}
                            maxImages={3}
                        />
                    </div>
                    <div>
                        <h3 className='text-lg font-semibold mb-2 text-teal-300'>Idea o Estilo (Opcional)</h3>
                        <div className="relative w-full">
                            <textarea
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                placeholder="Describe la escena, añade detalles o pega un prompt de estilo para aplicarlo al sujeto de la imagen..."
                                className="w-full bg-gray-900/50 rounded-lg p-4 pr-10 text-gray-300 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[150px] text-sm resize-none"
                                aria-label="Idea o Estilo para el prompt"
                            />
                            {style && (
                                <button 
                                    onClick={() => setStyle('')} 
                                    className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors" 
                                    aria-label="Limpiar campo de texto"
                                >
                                    <CloseIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
        <div className="mt-auto space-y-3 pt-4">
          <button
            onClick={handleGenerateClick}
            disabled={isGenerateButtonDisabled}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 text-lg"
          >
            {isLoading ? 'Generando...' : 'Generar Prompt JSON'}
          </button>
        </div>
      </div>
      <div className="glass-pane rounded-2xl p-6 shadow-2xl flex flex-col xl:col-span-1">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader />
                <p className="mt-4 text-lg text-gray-400">Procesando...</p>
                <p className="text-sm text-gray-500">Esto puede tardar unos segundos.</p>
            </div>
        ) : error ? (
            <div className="flex items-center justify-center h-full text-center text-red-400 bg-red-500/10 p-4 rounded-lg">
                <p>{error}</p>
            </div>
        ) : structuredPrompt ? (
            <div className="flex flex-col h-full">
                <JsonDisplay jsonString={structuredPrompt} />
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-4 focus:ring-green-500/50"
                    >
                        {isSaving ? 'Guardando y categorizando...' : 'Guardar en Galería'}
                    </button>
                     <button
                        onClick={() => onGoToEditor(structuredPrompt)}
                        className="w-full flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-4 focus:ring-amber-500/50"
                    >
                        <PencilIcon className="w-5 h-5" />
                        <span>Editar en Vista Dedicada</span>
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <svg className="w-16 h-16 text-gray-700" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                <h2 className="mt-4 text-xl font-semibold text-gray-500">Esperando entrada</h2>
                <p className="mt-1 text-gray-600">El prompt JSON generado aparecerá aquí.</p>
            </div>
        )}
      </div>
    </div>
  );
};