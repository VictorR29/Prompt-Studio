
import React, { Suspense, useCallback } from 'react';
import { useAppContext } from './context/AppContext';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SavedPrompt } from './types';
import { Loader } from './components/Loader';
import { Toast } from './components/Toast';
import { ShareCard } from './components/ShareCard';
import { PromptModal } from './components/PromptModal';
import { SettingsModal } from './components/SettingsModal';
import { WalkthroughGuide } from './components/WalkthroughGuide';
import { ApiKeySetup } from './components/ApiKeySetup';
import ExtractorView from './views/ExtractorView';
const GalleryView = React.lazy(() => import('./views/GalleryView'));
import EditorView from './views/EditorView';
import PlaygroundView from './views/PlaygroundView';
import FusionView from './views/FusionView';

const GlobalLoader: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed inset-0 bg-black/60 z-[101] flex flex-col items-center justify-center p-4 animate-fade-in-subtle"
    style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} role="alert" aria-live="assertive">
    <Loader />
    <p className="mt-4 text-lg font-semibold text-gray-200 text-center">{message || 'Procesando con IA...'}</p>
    <p className="mt-1 text-sm text-gray-400 text-center">La IA está trabajando. Esto puede tardar unos segundos...</p>
  </div>
);

const App: React.FC = () => {
  const ctx = useAppContext();

  if (!ctx.isApiKeySet) {
    return (
      <ApiKeySetup onKeySaved={ctx.handleKeySaved} addToast={ctx.addToast} pendingSharedPrompt={ctx.pendingSharedPrompt} />
    );
  }

  const handleUseFeatureInEditor = useCallback((featurePrompt: string) => {
    const tempPrompt: SavedPrompt = {
      id: `temp-${Date.now()}`,
      type: 'style',
      prompt: featurePrompt,
      coverImage: '',
      title: 'Nuevo Fragmento desde Extractor',
      category: 'Fragmento',
      artType: 'Prompt',
      notes: 'Editando un nuevo fragmento desde el extractor.',
    };
    ctx.setPromptForEditor(tempPrompt);
    ctx.handleSetView('editor');
  }, [ctx.setPromptForEditor, ctx.handleSetView]);

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-sans flex flex-col">
      <Header view={ctx.view} setView={ctx.handleSetView} onOpenSettings={() => ctx.setIsSettingsModalOpen(true)} />

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {ctx.promptToShare && ctx.shareUrl && (
          <ShareCard ref={ctx.shareCardRef} promptData={ctx.promptToShare} shareUrl={ctx.shareUrl} />
        )}
      </div>

      <main className="flex-grow container mx-auto p-4 md:p-8 w-full pb-24 md:pb-8">
        <ErrorBoundary key="extractor" viewName="Extractor">
          {ctx.view === 'extractor' && (
            <ExtractorView addToast={ctx.addToast} setGlobalLoader={ctx.setGlobalLoader}
              onFeaturePrompt={handleUseFeatureInEditor} addPromptToGallery={ctx.addPromptToGallery} />
          )}
        </ErrorBoundary>
        <ErrorBoundary key="gallery" viewName="Gallery">
          {ctx.view === 'gallery' && (
            <Suspense fallback={<Loader />}>
              <GalleryView prompts={ctx.savedPrompts} onSelect={ctx.handleSelectPromptForModal}
                onDelete={ctx.handleDeletePrompt} onEdit={ctx.handleEditPrompt} onShare={ctx.handleSharePrompt} />
            </Suspense>
          )}
        </ErrorBoundary>
        <ErrorBoundary key="editor" viewName="Editor">
          {ctx.view === 'editor' && (
            <EditorView key={ctx.promptForEditor?.id || 'new-editor'} initialPrompt={ctx.promptForEditor}
              onSavePrompt={ctx.addPromptToGallery} savedPrompts={ctx.savedPrompts}
              setView={ctx.handleSetView} onNavigateToGallery={() => ctx.handleSetView('gallery')}
              addToast={ctx.addToast} setGlobalLoader={ctx.setGlobalLoader} />
          )}
        </ErrorBoundary>
        <ErrorBoundary key="playground" viewName="Playground">
          {ctx.view === 'playground' && (
            <PlaygroundView initialPrompt={ctx.promptForPlayground} savedPrompts={ctx.savedPrompts}
              onSavePrompt={ctx.addPromptToGallery} addToast={ctx.addToast}
              setGlobalLoader={ctx.setGlobalLoader} />
          )}
        </ErrorBoundary>
        <ErrorBoundary key="fusion" viewName="Fusion">
          {ctx.view === 'fusion' && (
            <FusionView savedPrompts={ctx.savedPrompts} onSavePrompt={ctx.addPromptToGallery}
              addToast={ctx.addToast} setGlobalLoader={ctx.setGlobalLoader} />
          )}
        </ErrorBoundary>
      </main>

      <footer className="text-center p-6 text-gray-500 text-sm flex flex-col items-center gap-2">
        <p>&copy; 2026 Victor Ramones</p>
        <p className="opacity-70 text-xs">Desarrollado con React, Tailwind CSS y la API de Gemini.</p>
      </footer>

      {ctx.selectedPromptForModal && (
        <PromptModal promptData={ctx.selectedPromptForModal} onClose={ctx.handleClosePromptModal}
          onDelete={ctx.handleDeletePrompt} onEdit={ctx.handleEditPrompt} />
      )}
      {ctx.isSettingsModalOpen && (
        <SettingsModal onClose={() => ctx.setIsSettingsModalOpen(false)} onKeySaved={ctx.handleKeySaved}
          addToast={ctx.addToast} savedPrompts={ctx.savedPrompts} onPromptsUpdate={ctx.handleUpdatePrompts} />
      )}
      {ctx.globalLoader.active && <GlobalLoader message={ctx.globalLoader.message} />}
      {ctx.isWalkthroughActive && (
        <WalkthroughGuide onFinish={ctx.finishWalkthrough} setView={ctx.handleSetView} currentView={ctx.view} />
      )}
      <div aria-live="assertive" className="fixed inset-0 pointer-events-none p-4 flex flex-col items-end justify-end space-y-2 z-[100]">
        {ctx.toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => ctx.removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
};

export default App;
