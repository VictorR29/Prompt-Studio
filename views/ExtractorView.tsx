
import React, { useState, useCallback, useEffect } from 'react';
import { fileToBase64 } from '../utils/fileUtils';
import { generateFeatureMetadata, analyzeImageFeature } from '../services/gemini';
import { createImageCollage } from '../utils/imageUtils';
import { SavedPrompt, ExtractionMode } from '../types';
import { ExtractorModeSelector } from '../components/ExtractorModeSelector';
import { ImageUploader } from '../components/ImageUploader';
import { PromptDisplay } from '../components/PromptDisplay';
import { EXTRACTION_MODE_MAP } from '../config';

interface ExtractorViewProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  setGlobalLoader: (state: { active: boolean; message: string }) => void;
  onFeaturePrompt: (prompt: string) => void;
  addPromptToGallery: (prompt: SavedPrompt) => Promise<void>;
}

const ExtractorView: React.FC<ExtractorViewProps> = ({ addToast, setGlobalLoader, onFeaturePrompt, addPromptToGallery }) => {
  const [images, setImages] = useState<{ url: string; base64: string; mimeType: string; }[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('style');

  const maxImages =
    extractionMode === 'style' ? 5 :
    extractionMode === 'subject' ? 3 :
    1;

  // Reset images/prompt/error when extraction mode changes
  useEffect(() => {
    setImages([]);
    setPrompt('');
    setError(null);
  }, [extractionMode]);

  const handleImagesUpload = useCallback(async (files: File[]) => {
    if (images.length + files.length > maxImages) {
      setError(`Puedes subir un máximo de ${maxImages} imágenes para este modo.`);
      return;
    }
    setError(null);
    setPrompt('');
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
      setImages(prevImages => [...prevImages, ...newImages]);
    } catch (err) {
      setError('Error al procesar las imágenes. Por favor, inténtalo de nuevo.');
      console.error(err);
    }
  }, [images.length, maxImages]);

  const handleImageRemove = useCallback((indexToRemove: number) => {
    setImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    setError(null);
  }, []);

  const handleAnalyzeClick = useCallback(async () => {
    if (images.length === 0) {
      setError('Por favor, sube una imagen primero.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPrompt('');

    try {
      const imagePayload = images.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
      const { result, warning } = await analyzeImageFeature(extractionMode, imagePayload);
      setPrompt(result);
      if (warning) {
        addToast(warning, 'warning');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      setError(`Error en el análisis: ${errorMessage}`);
      addToast(`Error en el análisis: ${errorMessage}`, 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [images, extractionMode, addToast]);

  const handleSaveExtractorPrompt = useCallback(async () => {
    if (!prompt || images.length === 0) return;

    setIsSaving(true);
    setError(null);
    setGlobalLoader({ active: true, message: 'Guardando en galería...' });

    try {
      let coverImageDataUrl = '';

      if (images.length > 0) {
        setGlobalLoader({ active: true, message: 'Procesando portada...' });
        coverImageDataUrl = await createImageCollage(images.map(img => ({ base64: img.base64, mimeType: img.mimeType })));
      }

      setGlobalLoader({ active: true, message: 'Generando metadatos con IA...' });
      const imagePayload = images.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
      const metadata = await generateFeatureMetadata(extractionMode, prompt, imagePayload);

      const newPrompt: SavedPrompt = {
        id: Date.now().toString(),
        type: extractionMode,
        prompt: prompt,
        coverImage: coverImageDataUrl,
        ...metadata,
      };

      await addPromptToGallery(newPrompt);
      addToast('Prompt guardado en la galería', 'success');
      setImages([]);
      setPrompt('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      setError(`Error al guardar: ${errorMessage}`);
      addToast(`Error al guardar: ${errorMessage}`, 'error');
      console.error(err);
    } finally {
      setIsSaving(false);
      setGlobalLoader({ active: false, message: '' });
    }
  }, [prompt, images, extractionMode, addToast, addPromptToGallery, setGlobalLoader]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-slide-in-up">
      <div className="flex flex-col space-y-6 glass-pane p-6 rounded-2xl">
        <ExtractorModeSelector mode={extractionMode} setMode={setExtractionMode} />
        <div key={extractionMode} className="flex flex-col space-y-6 animate-fade-slide-in-up">
          <ImageUploader
            onImagesUpload={handleImagesUpload}
            onImageRemove={handleImageRemove}
            images={images}
            maxImages={maxImages}
          />
          <button
            onClick={handleAnalyzeClick}
            disabled={images.length === 0 || isLoading}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 text-lg"
          >
            {isLoading ? 'Analizando...' : `Analizar ${EXTRACTION_MODE_MAP[extractionMode].label} (${images.length} ${images.length === 1 ? 'imagen' : 'imágenes'})`}
          </button>
        </div>
      </div>
      <div className="glass-pane rounded-2xl p-6 shadow-2xl">
        <PromptDisplay
          prompt={prompt}
          isLoading={isLoading}
          isSaving={isSaving}
          error={error}
          onSave={handleSaveExtractorPrompt}
          extractionMode={extractionMode}
          onUseStyle={(p) => onFeaturePrompt(p)}
          onUseIdeaAndStyle={(idea, style) => onFeaturePrompt(`${idea}, ${style}`)}
          onUseFeature={(p) => onFeaturePrompt(p)}
        />
      </div>
    </div>
  );
};

export default ExtractorView;
