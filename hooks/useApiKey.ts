
import { useState, useEffect, useCallback } from 'react';
import { SavedPrompt, AppView } from '../types';
import type { ToastMessage } from './useToast';

type AddToastFn = (message: string, type?: ToastMessage['type']) => void;

interface UseApiKeyReturn {
  isApiKeySet: boolean;
  pendingSharedPrompt: SavedPrompt | null;
  setPendingSharedPrompt: (prompt: SavedPrompt | null) => void;
  handleKeySaved: () => void;
}

export function useApiKey(
  importSharedPrompt: (prompt: SavedPrompt) => Promise<void>,
  setView: (view: AppView) => void,
  addToast: AddToastFn
): UseApiKeyReturn {
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [pendingSharedPrompt, setPendingSharedPrompt] = useState<SavedPrompt | null>(null);

  useEffect(() => {
    const checkApiKey = () => {
      const userKey = localStorage.getItem('userGeminiKey');
      if (userKey) {
        setIsApiKeySet(true);
      } else {
        if (process.env.API_KEY) {
          setIsApiKeySet(true);
        } else {
          setIsApiKeySet(false);
        }
      }
    };
    checkApiKey();
  }, []);

  const handleKeySaved = useCallback(() => {
    setIsApiKeySet(true);
    if (pendingSharedPrompt) {
      importSharedPrompt(pendingSharedPrompt);
      setView('gallery');
      setTimeout(() => {
        addToast(`¡Prompt "${pendingSharedPrompt.title}" desbloqueado y guardado en tu Galería!`, 'success');
        setPendingSharedPrompt(null);
      }, 500);
    }
  }, [pendingSharedPrompt, importSharedPrompt, setView, addToast]);

  return {
    isApiKeySet,
    pendingSharedPrompt,
    setPendingSharedPrompt,
    handleKeySaved,
  };
}
