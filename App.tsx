import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptDisplay } from './components/PromptDisplay';
import { Gallery } from './components/Gallery';
import { PromptEditor } from './components/PromptEditor';
import { generateFeatureMetadata, analyzeImageFeature, generateImageFromPrompt } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { SavedPrompt, ExtractionMode, AppView } from './types';
import { ExtractorModeSelector } from './components/ExtractorModeSelector';
import { PromptModal } from './components/PromptModal';
import { EXTRACTION_MODE_MAP } from './config';
import { Toast } from './components/Toast';
import { Loader } from './components/Loader';
import { WalkthroughGuide } from './components/WalkthroughGuide';
import { ApiKeySetup } from './components/ApiKeySetup';
import { SettingsModal } from './components/SettingsModal';
import { createImageCollage } from './utils/imageUtils';
import { Playground } from './components/Playground';
import { FusionLab } from './components/FusionLab';
import LZString from 'lz-string';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
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
  const [promptForEditor, setPromptForEditor] = useState<SavedPrompt | null>(null);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('style');
  const [selectedPromptForModal, setSelectedPromptForModal] = useState<SavedPrompt | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [globalLoaderState, setGlobalLoaderState] = useState<{ active: boolean; message: string }>({ active: false, message: '' });
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [promptForPlayground, setPromptForPlayground] = useState<SavedPrompt | null>(null);
  
  // New state to hold a shared prompt if the user hasn't set up their key yet
  const [pendingSharedPrompt, setPendingSharedPrompt] = useState<SavedPrompt | null>(null);

  const maxImages =
    extractionMode === 'style' ? 5 :
    extractionMode === 'subject' ? 3 :
    1;
    
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
  }, []);

  const addPromptToGallery = useCallback((newPrompt: SavedPrompt) => {
    setSavedPrompts(prev => [newPrompt, ...prev]);
  }, []);

  const importSharedPrompt = useCallback(async (promptToImport: SavedPrompt) => {
        // Add to gallery immediately with existing info
        addPromptToGallery(promptToImport);
        
        // Generate cover image in background if none exists
        if (!promptToImport.coverImage) {
            try {
                // We don't block the UI here, just update state when ready
                const coverUrl = await generateImageFromPrompt(promptToImport.prompt);
                setSavedPrompts(prev => prev.map(p => 
                    p.id === promptToImport.id ? { ...p, coverImage: coverUrl } : p
                ));
            } catch (e) {
                console.warn("Could not generate cover for imported prompt", e);
            }
        }
  }, [addPromptToGallery]);


  // Handle Loading Data from URL (Shared Prompts)
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const data = params.get('data');
      
      if (data) {
          try {
              const json = LZString.decompressFromEncodedURIComponent(data);
              if (json) {
                  const payload = JSON.parse(json);
                  // Reconstruct SavedPrompt object
                  const loadedPrompt: SavedPrompt = {
                      id: `shared-${Date.now()}`,
                      prompt: payload.p,
                      negativePrompt: payload.n,
                      type: payload.t,
                      title: payload.ti || 'Shared Prompt',
                      category: 'Imported', // Force category to Imported
                      artType: payload.at || 'Prompt',
                      notes: payload.no || 'Imported via QR/Link',
                      isHybrid: payload.h,
                      creator: payload.u, // Attribution
                      coverImage: '' // No cover image in shared link
                  };
                  
                  // Check if we have a key ready
                  const userKey = localStorage.getItem('userGeminiKey');
                  const envKey = process.env.API_KEY;

                  if (userKey || envKey) {
                      // Normal flow for existing users: Add to Gallery
                      importSharedPrompt(loadedPrompt);
                      setView('gallery');
                      setTimeout(() => {
                          addToast(`¡Prompt "${loadedPrompt.title}" añadido a la Galería!`, 'success');
                      }, 1000);
                  } else {
                      // Conversion flow for new users: Store pending prompt
                      setPendingSharedPrompt(loadedPrompt);
                  }
                  
                  // Clear URL to prevent re-reading on refresh
                  window.history.replaceState({}, document.title, window.location.pathname);
              }
          } catch (e) {
              console.error("Failed to load shared data", e);
              setTimeout(() => {
                  addToast('Error al cargar el prompt compartido.', 'error');
              }, 1000);
          }
      }
  }, [importSharedPrompt, addToast]); 

  useEffect(() => {
    const hasCompleted = localStorage.getItem('hasCompletedWalkthrough');
    if (!hasCompleted) {
        // Delay to allow UI to settle before starting the tour
        setTimeout(() => setIsWalkthroughActive(true), 500);
    }
  }, []);

  useEffect(() => {
    const checkApiKey = () => {
        const userKey = localStorage.getItem('userGeminiKey');
        // The app is considered configured if a user key is set.
        // The fallback to process.env.API_KEY will be handled in the service.
        if (userKey) {
            setIsApiKeySet(true);
        } else {
             // Check for the fallback key to avoid showing the setup screen if not needed.
            if(process.env.API_KEY) {
                setIsApiKeySet(true);
            } else {
                setIsApiKeySet(false);
            }
        }
    };
    checkApiKey();
  }, []);

  const handleKeySaved = () => {
    setIsApiKeySet(true);
    // If there was a pending shared prompt, load it into gallery now
    if (pendingSharedPrompt) {
        importSharedPrompt(pendingSharedPrompt);
        setView('gallery');
        setTimeout(() => {
            addToast(`¡Prompt "${pendingSharedPrompt.title}" desbloqueado y guardado en tu Galería!`, 'success');
            setPendingSharedPrompt(null);
        }, 500);
    }
  };


  const handleSetView = (newView: AppView) => {
    if (view === 'editor' && newView !== 'editor') {
        setPromptForEditor(null);
    }
    if (view === 'playground' && newView !== 'playground') {
        setPromptForPlayground(null);
    }
    setView(newView);
  };

  const removeToast = (id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
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


  const handleUpdatePrompts = useCallback((newPrompts: SavedPrompt[]) => {
    setSavedPrompts(newPrompts);
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

  const handleSaveExtractorPrompt = async () => {
    if (!prompt || images.length === 0) return;

    setIsSaving(true);
    setError(null);
    setGlobalLoaderState({ active: true, message: 'Guardando en galería...' });

    try {
        let coverImageDataUrl = '';

        if ((extractionMode === 'style' || extractionMode === 'subject') && images.length > 1) {
            setGlobalLoaderState({ active: true, message: 'Creando collage para la portada...' });
            coverImageDataUrl = await createImageCollage(images.map(img => ({ base64: img.base64, mimeType: img.mimeType })));
        } else {
            const coverImage = images[0];
            coverImageDataUrl = `data:${coverImage.mimeType};base64,${coverImage.base64}`;
        }
        
        setGlobalLoaderState({ active: true, message: 'Generando metadatos con IA...' });
        const imagePayload = images.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
        const metadata = await generateFeatureMetadata(extractionMode, prompt, imagePayload);

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
        setGlobalLoaderState({ active: false, message: '' });
    }
  };

  const handleDeletePrompt = (id: string) => {
      setSavedPrompts(prev => prev.filter(p => p.id !== id));
  };

  const handleUseFeatureInEditor = useCallback((featurePrompt: string) => {
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

  const finishWalkthrough = () => {
    localStorage.setItem('hasCompletedWalkthrough', 'true');
    setIsWalkthroughActive(false);
    addToast('¡Tutorial completado! Ya estás listo para crear.', 'success');
  };
  
  if (!isApiKeySet) {
    return (
        <ApiKeySetup 
            onKeySaved={handleKeySaved} 
            addToast={addToast} 
            pendingSharedPrompt={pendingSharedPrompt}
        />
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-sans flex flex-col">
      <Header view={view} setView={handleSetView} onOpenSettings={() => setIsSettingsModalOpen(true)} />
      
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
        {view === 'playground' && (
            <div className="animate-fade-slide-in-up">
                <Playground
                    initialPrompt={promptForPlayground}
                    savedPrompts={savedPrompts}
                    onSavePrompt={addPromptToGallery}
                    addToast={addToast}
                    setGlobalLoader={setGlobalLoaderState}
                />
            </div>
        )}
        {view === 'fusion' && (
            <div className="animate-fade-slide-in-up">
                <FusionLab
                    onSavePrompt={addPromptToGallery}
                    savedPrompts={savedPrompts}
                    addToast={addToast}
                    setGlobalLoader={setGlobalLoaderState}
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
       {isSettingsModalOpen && (
        <SettingsModal
          onClose={() => setIsSettingsModalOpen(false)}
          onKeySaved={handleKeySaved}
          addToast={addToast}
          savedPrompts={savedPrompts}
          onPromptsUpdate={handleUpdatePrompts}
        />
      )}
      {globalLoaderState.active && <GlobalLoader message={globalLoaderState.message} />}
      {isWalkthroughActive && (
        <WalkthroughGuide 
          onFinish={finishWalkthrough}
          setView={handleSetView}
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
