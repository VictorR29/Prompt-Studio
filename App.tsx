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
import { SettingsModal } from './components/SettingsModal';
import { Loader } from './components/Loader';
import { WalkthroughGuide } from './components/WalkthroughGuide';

export type AppView = 'editor' | 'extractor' | 'gallery';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const GlobalLoader: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-[101] flex flex-col items-center justify-center p-4 animate-fade-in-subtle"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      role="alert"
      aria-live="assertive"
    >
      <Loader />
      <p className="mt-4 text-lg font-semibold text-gray-200 text-center">
        {message || 'Procesando con IA...'}
      </p>
       <p className="mt-1 text-sm text-gray-400 text-center">
        La IA está trabajando. Esto puede tardar unos segundos...
      </p>
    </div>
  );
};

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [globalLoaderState, setGlobalLoaderState] = useState<{ active: boolean; message: string }>({ active: false, message: '' });
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);
  const [hasCheckedForWalkthrough, setHasCheckedForWalkthrough] = useState(false);

  const maxImages =
    extractionMode === 'style' ? 5 :
    extractionMode === 'subject' ? 3 :
    1;
    
  const checkApiKey = useCallback(() => {
    const userKey = localStorage.getItem('userGeminiKey');
    const envKey = process.env.API_KEY;
    const keyExists = (userKey && userKey.trim() !== '') || (envKey && envKey.trim() !== '');
    if (keyExists) {
        setHasApiKey(true);
        if (!hasCheckedForWalkthrough) {
            const hasCompleted = localStorage.getItem('hasCompletedWalkthrough');
            if (!hasCompleted) {
                // Delay to allow UI to settle before starting the tour
                setTimeout(() => setIsWalkthroughActive(true), 500);
            }
            setHasCheckedForWalkthrough(true);
        }
    } else {
        setHasApiKey(false);
    }
    setIsCheckingApiKey(false);
  }, [hasCheckedForWalkthrough]);


  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

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
      addToast(`Error en el análisis: ${errorMessage}`, 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [images, extractionMode, addToast]);

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
        addToast(`Error al guardar: ${errorMessage}`, 'error');
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };
  
  // These functions are now conceptually part of the editor, but we keep the logic for now
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

  const handleUseFeatureInEditor = useCallback((featurePrompt: string) => {
    // This logic will be handled inside the new Editor Hub
    // For now, it can load a temporary prompt into the editor
     const tempPrompt: SavedPrompt = {
      id: `temp-${Date.now()}`,
      type: 'style', // Generic type
      prompt: featurePrompt,
      coverImage: '',
      title: 'Nuevo Fragmento desde Extractor',
      category: 'Fragmento',
      artType: 'Prompt',
      notes: 'Editando un nuevo fragmento desde el extractor.'
    };
    setPromptForEditor(tempPrompt);
    handleSetView('editor');
  }, []);

  const handleEditPrompt = useCallback((promptToLoad: SavedPrompt) => {
    setPromptForEditor(promptToLoad);
    handleSetView('editor');
  }, []);
  
  const handleSelectPromptForModal = useCallback((prompt: SavedPrompt) => {
    setSelectedPromptForModal(prompt);
  }, []);

  const handleClosePromptModal = useCallback(() => {
      setSelectedPromptForModal(null);
  }, []);

  const handleKeySaved = () => {
    checkApiKey(); // Re-check for the key, which will trigger walkthrough if needed
  };

  const finishWalkthrough = () => {
    localStorage.setItem('hasCompletedWalkthrough', 'true');
    setIsWalkthroughActive(false);
    addToast('¡Tutorial completado! Ya estás listo para crear.', 'success');
  };

  if (isCheckingApiKey) {
    return (
        <div className="min-h-screen bg-transparent text-gray-200 font-sans flex flex-col items-center justify-center">
            <Loader />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-sans flex flex-col">
      <Header view={view} setView={handleSetView} onOpenSettings={() => setIsSettingsModalOpen(true)} />
      
      {!hasApiKey ? (
        <main className="flex-grow container mx-auto p-4 flex items-center justify-center">
          <div className="text-center glass-pane p-8 md:p-12 rounded-2xl max-w-2xl animate-fade-slide-in-up">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500 mb-4">
              Bienvenido a Prompt Studio
            </h2>
            <p className="text-gray-400 mb-6">
              Por favor, ingresa tu API Key en la configuración para empezar a crear.
            </p>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 text-lg"
            >
              Ir a Configuración
            </button>
          </div>
        </main>
      ) : (
        <main className="flex-grow container mx-auto p-4 md:p-8 w-full pb-24 md:pb-8">
          {view === 'extractor' && (
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
                  onUseStyle={(p) => handleUseFeatureInEditor(p)}
                  onUseIdeaAndStyle={(idea, style) => handleUseFeatureInEditor(`${idea}, ${style}`)}
                  onUseFeature={(p) => handleUseFeatureInEditor(p)}
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
                      setGlobalLoader={setGlobalLoaderState}
                  />
              </div>
          )}
        </main>
      )}

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
      {isSettingsModalOpen && (
        <SettingsModal
            onClose={() => setIsSettingsModalOpen(false)}
            onKeySaved={handleKeySaved}
            addToast={addToast}
        />
      )}
      {globalLoaderState.active && <GlobalLoader message={globalLoaderState.message} />}
      {isWalkthroughActive && (
        <WalkthroughGuide 
          onFinish={finishWalkthrough}
          setView={setView}
          currentView={view}
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