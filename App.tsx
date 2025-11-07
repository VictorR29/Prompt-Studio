

import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptDisplay } from './components/PromptDisplay';
import { Gallery } from './components/Gallery';
import { PromptStructurer } from './components/PromptStructurer';
import { MasterAssembler } from './components/ImageEditor';
import { PromptEditor } from './components/PromptEditor';
import { generateFeatureMetadata, analyzeImageFeature } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { SavedPrompt, ExtractionMode } from './types';
import { ExtractorModeSelector } from './components/ExtractorModeSelector';
import { PromptModal } from './components/PromptModal';
import { EXTRACTION_MODE_MAP } from './config';
import { Toast } from './components/Toast';

export type AppView = 'generator' | 'gallery' | 'structurer' | 'assembler' | 'editor';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const App: React.FC = () => {
  const [images, setImages] = useState<{ url: string; base64: string; mimeType: string; }[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('editor');
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [styleToStructure, setStyleToStructure] = useState<string | null>(null);
  const [ideaToStructure, setIdeaToStructure] = useState<string | null>(null);
  const [promptForEditor, setPromptForEditor] = useState<SavedPrompt | null>(null);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('style');
  const [selectedPromptForModal, setSelectedPromptForModal] = useState<SavedPrompt | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const maxImages =
    extractionMode === 'style' ? 5 :
    extractionMode === 'subject' ? 3 :
    1;

  const handleSetView = (newView: AppView) => {
    if (view === 'editor' && newView !== 'editor') {
        setPromptForEditor(null);
    }
    setView(newView);
  };

  const removeToast = (id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
  };

  useEffect(() => {
    try {
      const storedPrompts = localStorage.getItem('savedPrompts');
      if (storedPrompts) {
        const parsedPrompts = JSON.parse(storedPrompts);
        // Migration logic for older prompts without a 'type'
        const migratedPrompts = parsedPrompts.map((p: any) => ({
          ...p,
          type: p.type || 'style',
        }));
        setSavedPrompts(migratedPrompts);
      }
    } catch (error) {
      console.error("Error al cargar los prompts desde localStorage:", error);
    }
  }, []);

  useEffect(() => {
    // Sincronizar con localStorage cada vez que savedPrompts cambie
    localStorage.setItem('savedPrompts', JSON.stringify(savedPrompts));
  }, [savedPrompts]);
  
  useEffect(() => {
    // Cuando cambia el modo, limpia el estado para evitar confusiones.
    setImages([]);
    setPrompt('');
    setError(null);
  }, [extractionMode]);

  const addPromptToGallery = useCallback((newPrompt: SavedPrompt) => {
    setSavedPrompts(prev => [newPrompt, ...prev]);
  }, []);


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
      const generatedPrompt = await analyzeImageFeature(extractionMode, imagePayload);
      setPrompt(generatedPrompt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      setError(`Error en el análisis: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [images, extractionMode]);

  const handleSaveExtractorPrompt = async () => {
    if (!prompt || images.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
        const imagePayload = images.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
        const metadata = await generateFeatureMetadata(extractionMode, prompt, imagePayload);

        const randomIndex = Math.floor(Math.random() * images.length);
        const coverImage = images[randomIndex];
        const coverImageDataUrl = `data:${coverImage.mimeType};base64,${coverImage.base64}`;

        const newPrompt: SavedPrompt = {
            id: Date.now().toString(),
            type: extractionMode,
            prompt: prompt,
            coverImage: coverImageDataUrl,
            ...metadata,
        };
        addPromptToGallery(newPrompt);
        addToast('Prompt guardado en la galería', 'success');
        setImages([]);
        setPrompt('');

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
        setError(`Error al guardar: ${errorMessage}`);
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleSaveStructuredPrompt = (promptToSave: Omit<SavedPrompt, 'id'>) => {
    const newPrompt: SavedPrompt = {
        id: Date.now().toString(),
        ...promptToSave,
    };
    addPromptToGallery(newPrompt);
    addToast('Prompt guardado en la galería', 'success');
  };
  
  const handleSaveMasterPrompt = (promptToSave: Omit<SavedPrompt, 'id'>) => {
    const newPrompt: SavedPrompt = {
      id: Date.now().toString(),
      ...promptToSave,
    };
    addPromptToGallery(newPrompt);
    addToast('Prompt guardado en la galería', 'success');
  };

  const handleDeletePrompt = (id: string) => {
      setSavedPrompts(prev => prev.filter(p => p.id !== id));
  };

  const handleUseStyleInStructurer = useCallback((style: string) => {
    setStyleToStructure(style);
    handleSetView('structurer');
  }, []);
  
  const handleUseIdeaAndStyleInStructurer = useCallback((idea: string, style: string) => {
    setIdeaToStructure(idea);
    setStyleToStructure(style);
    handleSetView('structurer');
  }, []);
  
  const handleUseFeatureInStructurer = useCallback((featurePrompt: string) => {
    setIdeaToStructure(featurePrompt);
    setStyleToStructure(null);
    handleSetView('structurer');
  }, []);

  const clearStyleToStructure = useCallback(() => {
    setStyleToStructure(null);
  }, []);
  
  const clearIdeaToStructure = useCallback(() => {
    setIdeaToStructure(null);
  }, []);

  const handleEditPrompt = useCallback((promptToLoad: SavedPrompt) => {
    setPromptForEditor(promptToLoad);
    handleSetView('editor');
  }, []);
  
  const handleGoToEditorFromStructurer = useCallback((promptString: string) => {
    const tempPrompt: SavedPrompt = {
      id: `temp-${Date.now()}`,
      type: 'structured',
      prompt: promptString,
      coverImage: '',
      title: 'Nuevo Prompt Estructurado',
      category: 'JSON',
      artType: 'Prompt',
      notes: 'Editando un nuevo prompt desde el estructurador.'
    };
    setPromptForEditor(tempPrompt);
    handleSetView('editor');
  }, []);

  const handleSelectPromptForModal = useCallback((prompt: SavedPrompt) => {
    setSelectedPromptForModal(prompt);
  }, []);

  const handleClosePromptModal = useCallback(() => {
      setSelectedPromptForModal(null);
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-sans flex flex-col">
      <Header view={view} setView={handleSetView} />
      <main className="flex-grow container mx-auto p-4 md:p-8 w-full pb-24 md:pb-8">
        {view === 'generator' && (
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
                onUseStyle={handleUseStyleInStructurer}
                onUseIdeaAndStyle={handleUseIdeaAndStyleInStructurer}
                onUseFeature={handleUseFeatureInStructurer}
              />
            </div>
          </div>
        )}
        {view === 'gallery' && (
          <div className="animate-fade-slide-in-up">
            <Gallery 
              prompts={savedPrompts} 
              onSelect={handleSelectPromptForModal}
            />
          </div>
        )}
        {view === 'structurer' && (
          <div className="animate-fade-slide-in-up">
            <PromptStructurer 
              initialStyle={styleToStructure}
              onClearInitialStyle={clearStyleToStructure}
              initialIdea={ideaToStructure}
              onClearInitialIdea={clearIdeaToStructure}
              onSaveStructuredPrompt={handleSaveStructuredPrompt}
              onGoToEditor={handleGoToEditorFromStructurer}
            />
          </div>
        )}
        {view === 'assembler' && (
          <div className="animate-fade-slide-in-up">
            <MasterAssembler 
              onSaveMasterPrompt={handleSaveMasterPrompt}
            />
          </div>
        )}
        {view === 'editor' && (
            <div className="animate-fade-slide-in-up">
                <PromptEditor
                    key={promptForEditor?.id || 'new-editor'}
                    initialPrompt={promptForEditor}
                    onSavePrompt={addPromptToGallery}
                    savedPrompts={savedPrompts}
                    setView={handleSetView}
                    onNavigateToGallery={() => handleSetView('gallery')}
                    addToast={addToast}
                />
            </div>
        )}
      </main>
      <footer className="text-center p-4 text-gray-500 text-sm">
        <p>Desarrollado con React, Tailwind CSS y la API de Gemini.</p>
      </footer>
      {selectedPromptForModal && (
        <PromptModal
          promptData={selectedPromptForModal}
          onClose={handleClosePromptModal}
          onDelete={handleDeletePrompt}
          onEdit={handleEditPrompt}
        />
      )}
      <div aria-live="assertive" className="fixed inset-0 pointer-events-none p-4 flex flex-col items-end justify-end space-y-2 z-[100]">
        {toasts.map(toast => (
            <Toast
                key={toast.id}
                message={toast.message}
                type={toast.type}
                onClose={() => removeToast(toast.id)}
            />
        ))}
      </div>
    </div>
  );
};

export default App;