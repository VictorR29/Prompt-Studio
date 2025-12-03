
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SavedPrompt } from '../types';
import { Gallery } from './Gallery';
import { CloseIcon } from './icons/CloseIcon';

interface GalleryModalProps {
  prompts: SavedPrompt[];
  onSelect: (prompt: SavedPrompt | SavedPrompt[]) => void;
  onClose: () => void;
  filter?: SavedPrompt['type'][];
  title?: string;
  multiSelect?: boolean;
  maxSelection?: number;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({ 
    prompts, 
    onSelect, 
    onClose, 
    filter, 
    title, 
    multiSelect = false,
    maxSelection = 1 
}) => {
  const [selected, setSelected] = useState<SavedPrompt[]>([]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Use useMemo to ensure the array reference stays stable unless data actually changes.
  // This prevents the Gallery component from resetting its view state unnecessarily.
  const filteredPrompts = useMemo(() => {
    return filter 
      ? prompts.filter(p => {
          if (filter.includes(p.type)) return true;
          if (filter.includes('hybrid') && p.isHybrid) return true;
          return false;
        }) 
      : prompts;
  }, [prompts, filter]);

  const handleCardSelect = (prompt: SavedPrompt) => {
    if (multiSelect) {
        setSelected(prev => {
            const isAlreadySelected = prev.some(p => p.id === prompt.id);
            if (isAlreadySelected) {
                return prev.filter(p => p.id !== prompt.id);
            }
            if (prev.length < maxSelection) {
                return [...prev, prompt];
            }
            return prev;
        });
    } else {
        onSelect(prompt);
    }
  };

  const handleConfirm = () => {
    onSelect(selected);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in-subtle"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-pane rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scale-in-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
            <h2 className="text-xl font-bold text-white">{multiSelect ? `Seleccionar hasta ${maxSelection} Sujetos` : (title || 'Seleccionar de la Galería')}</h2>
            <button
                onClick={onClose}
                className="bg-transparent text-gray-500 hover:text-white rounded-full p-1 transition-colors"
                aria-label="Cerrar modal"
            >
                <CloseIcon className="w-6 h-6" />
            </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
            <Gallery 
              prompts={filteredPrompts} 
              onSelect={handleCardSelect} 
              selection={selected}
              multiSelect={multiSelect}
            />
        </div>
        {multiSelect && (
          <div className="p-4 border-t border-white/10 flex-shrink-0 bg-gray-900/30">
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar Selección ({selected.length}/{maxSelection})
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
