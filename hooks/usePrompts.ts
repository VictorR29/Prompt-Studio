
import { useState, useEffect, useCallback } from 'react';
import { SavedPrompt } from '../types';
import { db } from '../utils/db';
import { generateImageFromPrompt } from '../services/gemini';
import type { ToastMessage } from './useToast';

type AddToastFn = (message: string, type?: ToastMessage['type']) => void;

interface UsePromptsReturn {
  savedPrompts: SavedPrompt[];
  addPromptToGallery: (prompt: SavedPrompt) => Promise<void>;
  handleDeletePrompt: (id: string) => Promise<void>;
  handleUpdatePrompts: (prompts: SavedPrompt[]) => Promise<void>;
  importSharedPrompt: (prompt: SavedPrompt) => Promise<void>;
}

export function usePrompts(addToast: AddToastFn): UsePromptsReturn {
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);

  // Initial load & migration from localStorage to IndexedDB
  useEffect(() => {
    const initData = async () => {
      try {
        // Check for legacy data in localStorage
        const legacyPrompts = localStorage.getItem('savedPrompts');
        if (legacyPrompts) {
          try {
            const parsed = JSON.parse(legacyPrompts);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`Migrating ${parsed.length} prompts to IndexedDB...`);
              await db.saveMany(parsed);
              localStorage.removeItem('savedPrompts'); // Clear legacy data
              addToast('Galería migrada a base de datos optimizada.', 'success');
            }
          } catch (e) {
            console.error('Migration failed', e);
          }
        }

        // Load from IndexedDB
        const prompts = await db.getAllPrompts();
        setSavedPrompts(prompts);
      } catch (e) {
        console.error('Failed to load prompts form DB', e);
        addToast('Error al cargar la galería.', 'error');
      }
    };
    initData();
  }, [addToast]);

  const addPromptToGallery = useCallback(async (newPrompt: SavedPrompt) => {
    try {
      await db.savePrompt(newPrompt);
      setSavedPrompts(prev => [newPrompt, ...prev]);
    } catch (e) {
      console.error('DB Save failed', e);
      addToast('Error al guardar en base de datos.', 'error');
    }
  }, [addToast]);

  const importSharedPrompt = useCallback(async (promptToImport: SavedPrompt) => {
    // Add to gallery immediately with existing info
    addPromptToGallery(promptToImport);

    // Generate cover image in background if none exists
    if (!promptToImport.coverImage) {
      try {
        const coverUrl = await generateImageFromPrompt(promptToImport.prompt);
        const updatedPrompt = { ...promptToImport, coverImage: coverUrl };

        // Update DB
        await db.savePrompt(updatedPrompt);

        // Update UI
        setSavedPrompts(prev => prev.map(p =>
          p.id === promptToImport.id ? updatedPrompt : p
        ));
      } catch (e) {
        console.warn('Could not generate cover for imported prompt', e);
      }
    }
  }, [addPromptToGallery]);

  const handleDeletePrompt = useCallback(async (id: string) => {
    try {
      await db.deletePrompt(id);
      setSavedPrompts(prev => prev.filter(p => p.id !== id));
      addToast('Prompt eliminado.', 'success');
    } catch (e) {
      addToast('Error al eliminar.', 'error');
    }
  }, [addToast]);

  const handleUpdatePrompts = useCallback(async (newPrompts: SavedPrompt[]) => {
    try {
      await db.clearAll();
      if (newPrompts.length > 0) {
        await db.saveMany(newPrompts);
      }
      setSavedPrompts(newPrompts);
    } catch (e) {
      console.error('Bulk update failed', e);
      addToast('Error al actualizar la base de datos', 'error');
    }
  }, [addToast]);

  return {
    savedPrompts,
    addPromptToGallery,
    handleDeletePrompt,
    handleUpdatePrompts,
    importSharedPrompt,
  };
}
