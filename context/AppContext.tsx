
import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SavedPrompt, AppView } from '../types';
import { useToast, ToastMessage } from '../hooks/useToast';
import { usePrompts } from '../hooks/usePrompts';
import { useApiKey } from '../hooks/useApiKey';
import LZString from 'lz-string';
import { toBlob } from 'html-to-image';
import { ShareCard } from '../components/ShareCard';

interface AppContextValue {
  // View state
  view: AppView;
  setView: (view: AppView) => void;

  // Toast state
  toasts: ToastMessage[];
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  removeToast: (id: number) => void;

  // Global loader
  globalLoader: { active: boolean; message: string };
  setGlobalLoader: (state: { active: boolean; message: string }) => void;

  // API Key
  isApiKeySet: boolean;
  pendingSharedPrompt: SavedPrompt | null;
  handleKeySaved: () => void;

  // Prompts / Gallery
  savedPrompts: SavedPrompt[];
  addPromptToGallery: (prompt: SavedPrompt) => Promise<void>;
  handleDeletePrompt: (id: string) => Promise<void>;
  handleUpdatePrompts: (prompts: SavedPrompt[]) => Promise<void>;
  importSharedPrompt: (prompt: SavedPrompt) => Promise<void>;

  // Navigation helpers
  handleSetView: (view: AppView) => void;

  // Editor / Playground routing
  promptForEditor: SavedPrompt | null;
  setPromptForEditor: (p: SavedPrompt | null) => void;
  promptForPlayground: SavedPrompt | null;
  setPromptForPlayground: (p: SavedPrompt | null) => void;

  // Share flow
  promptToShare: SavedPrompt | null;
  setPromptToShare: (p: SavedPrompt | null) => void;
  shareUrl: string;
  shareCardRef: React.RefObject<HTMLDivElement | null>;
  handleSharePrompt: (prompt: SavedPrompt) => Promise<void>;

  // Prompt modal
  selectedPromptForModal: SavedPrompt | null;
  setSelectedPromptForModal: (p: SavedPrompt | null) => void;
  handleSelectPromptForModal: (prompt: SavedPrompt) => void;
  handleClosePromptModal: () => void;
  handleEditPrompt: (prompt: SavedPrompt) => void;

  // Settings
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  // Walkthrough
  isWalkthroughActive: boolean;
  setIsWalkthroughActive: (active: boolean) => void;
  finishWalkthrough: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // View state (must be declared before hooks that use them)
  const [view, setView] = useState<AppView>('editor');
  const [promptForEditor, setPromptForEditor] = useState<SavedPrompt | null>(null);
  const [promptForPlayground, setPromptForPlayground] = useState<SavedPrompt | null>(null);

  // Compose hooks
  const { toasts, addToast, removeToast } = useToast();
  const { savedPrompts, addPromptToGallery, handleDeletePrompt, handleUpdatePrompts, importSharedPrompt } = usePrompts(addToast);
  const { isApiKeySet, pendingSharedPrompt, setPendingSharedPrompt, handleKeySaved } = useApiKey(importSharedPrompt, setView, addToast);

  // Share state
  const [promptToShare, setPromptToShare] = useState<SavedPrompt | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const shareCardRef = useRef<HTMLDivElement>(null);

  // Modal / walkthrough / loader state
  const [selectedPromptForModal, setSelectedPromptForModal] = useState<SavedPrompt | null>(null);
  const [globalLoader, setGlobalLoader] = useState<{ active: boolean; message: string }>({ active: false, message: '' });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);

  // Walkthrough init effect
  useEffect(() => {
    const hasCompleted = localStorage.getItem('hasCompletedWalkthrough');
    if (!hasCompleted) {
      setTimeout(() => setIsWalkthroughActive(true), 500);
    }
  }, []);

  // Shared URL parsing effect (on mount)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');

    if (data) {
      try {
        const json = LZString.decompressFromEncodedURIComponent(data);
        if (json) {
          const payload = JSON.parse(json);
          const loadedPrompt: SavedPrompt = {
            id: `shared-${Date.now()}`,
            prompt: payload.p,
            negativePrompt: payload.n,
            type: payload.t,
            title: payload.ti || 'Shared Prompt',
            category: 'Imported',
            artType: payload.at || 'Prompt',
            notes: payload.no || 'Imported via QR/Link',
            isHybrid: payload.h,
            creator: payload.u,
            coverImage: '',
          };

          const userKey = localStorage.getItem('userGeminiKey');
          const envKey = process.env.API_KEY;

          if (userKey || envKey) {
            importSharedPrompt(loadedPrompt);
            setView('gallery');
            setTimeout(() => {
              addToast(`¡Prompt "${loadedPrompt.title}" añadido a la Galería!`, 'success');
            }, 1000);
          } else {
            setPendingSharedPrompt(loadedPrompt);
          }

          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        console.error('Failed to load shared data', e);
        setTimeout(() => {
          addToast('Error al cargar el prompt compartido.', 'error');
        }, 1000);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Share URL generation effect
  useEffect(() => {
    if (!promptToShare) {
      setShareUrl('');
      return;
    }
    try {
      const safeTitle = String(promptToShare.title || 'Sin Título');
      const safeCategory = String(promptToShare.category || 'General');
      const safeArtType = String(promptToShare.artType || 'Estándar');
      const safeNotes = promptToShare.notes ? String(promptToShare.notes) : '';
      const safePromptText = typeof promptToShare.prompt === 'string' ? promptToShare.prompt : JSON.stringify(promptToShare.prompt || '');
      const safeNegativePrompt = promptToShare.negativePrompt ? String(promptToShare.negativePrompt) : '';
      const currentUser = localStorage.getItem('promptStudioUsername');

      const payload: any = {
        p: safePromptText,
        t: promptToShare.type,
        ti: safeTitle.substring(0, 50),
        c: safeCategory,
        at: safeArtType,
        u: currentUser || undefined,
      };

      if (safeNegativePrompt) payload.n = safeNegativePrompt;
      if (safeNotes) payload.no = safeNotes.substring(0, 600);
      if (promptToShare.isHybrid) payload.h = 1;

      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      const url = `${window.location.origin}?data=${compressed}`;
      setShareUrl(url);
    } catch (error) {
      console.warn('Could not generate share URL for this prompt:', error);
      setShareUrl('');
    }
  }, [promptToShare]);

  // handleSetView clears promptForEditor/promptForPlayground when leaving respective views
  const handleSetView = useCallback((newView: AppView) => {
    if (view === 'editor' && newView !== 'editor') {
      setPromptForEditor(null);
    }
    if (view === 'playground' && newView !== 'playground') {
      setPromptForPlayground(null);
    }
    setView(newView);
  }, [view]);

  const handleEditPrompt = useCallback((promptToLoad: SavedPrompt) => {
    setPromptForEditor(promptToLoad);
    handleSetView('editor');
  }, [handleSetView]);

  const handleSelectPromptForModal = useCallback((prompt: SavedPrompt) => {
    setSelectedPromptForModal(prompt);
  }, []);

  const handleClosePromptModal = useCallback(() => {
    setSelectedPromptForModal(null);
  }, []);

  const handleSharePrompt = useCallback(async (prompt: SavedPrompt) => {
    setPromptToShare(prompt);
    setGlobalLoader({ active: true, message: 'Creando ficha visual...' });

    setTimeout(async () => {
      if (!shareCardRef.current) {
        setGlobalLoader({ active: false, message: '' });
        return;
      }

      try {
        const blob = await toBlob(shareCardRef.current, {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: '#0A0814',
          fontEmbedCSS: '',
        });

        const cleanTitle = (prompt.title || 'prompt').replace(/\s+/g, '-').toLowerCase();
        const file = new File([blob], `prompt-studio-${cleanTitle}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: prompt.title,
            text: `Mira este prompt: ${prompt.title}`,
          });
        } else {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `prompt-studio-${cleanTitle}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
          addToast('Imagen descargada (Compartir no soportado en este dispositivo)', 'success');
        }
      } catch (e) {
        console.error('Share error', e);
        addToast('Error al generar la imagen para compartir', 'error');
      } finally {
        setGlobalLoader({ active: false, message: '' });
        setPromptToShare(null);
      }
    }, 500);
  }, [addToast]);

  const finishWalkthrough = useCallback(() => {
    localStorage.setItem('hasCompletedWalkthrough', 'true');
    setIsWalkthroughActive(false);
    addToast('¡Tutorial completado! Ya estás listo para crear.', 'success');
  }, [addToast]);

  const ctxValue = useMemo<AppContextValue>(() => ({
    view,
    setView,
    toasts,
    addToast,
    removeToast,
    globalLoader,
    setGlobalLoader,
    isApiKeySet,
    pendingSharedPrompt,
    handleKeySaved,
    savedPrompts,
    addPromptToGallery,
    handleDeletePrompt,
    handleUpdatePrompts,
    importSharedPrompt,
    handleSetView,
    promptForEditor,
    setPromptForEditor,
    promptForPlayground,
    setPromptForPlayground,
    promptToShare,
    setPromptToShare,
    shareUrl,
    shareCardRef,
    handleSharePrompt,
    selectedPromptForModal,
    setSelectedPromptForModal,
    handleSelectPromptForModal,
    handleClosePromptModal,
    handleEditPrompt,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isWalkthroughActive,
    setIsWalkthroughActive,
    finishWalkthrough,
  }), [
    view, toasts, addToast, removeToast, globalLoader, setGlobalLoader,
    isApiKeySet, pendingSharedPrompt, handleKeySaved,
    savedPrompts, addPromptToGallery, handleDeletePrompt, handleUpdatePrompts, importSharedPrompt,
    handleSetView, promptForEditor, setPromptForEditor,
    promptForPlayground, setPromptForPlayground,
    promptToShare, setPromptToShare, shareUrl, shareCardRef, handleSharePrompt,
    selectedPromptForModal, setSelectedPromptForModal,
    handleSelectPromptForModal, handleClosePromptModal, handleEditPrompt,
    isSettingsModalOpen, setIsSettingsModalOpen,
    isWalkthroughActive, setIsWalkthroughActive, finishWalkthrough,
  ]);

  return (
    <AppContext.Provider value={ctxValue}>
      {children}
    </AppContext.Provider>
  );
}
