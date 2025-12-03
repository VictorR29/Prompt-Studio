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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  const filteredPrompts = useMemo(() => {
    if (filter && filter.length > 0) {
        return prompts.filter(p => {
          if (filter.includes(p.type)) return true;
          if (filter.includes('hybrid') && p.isHybrid) return true;
          return false;
        });
    }
    return prompts;
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

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 animate-fade-in"
      style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-pane rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scale-in border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0 bg-gray-900/90">
            <h2 className="text-xl font-bold text-white">{multiSelect ? `Seleccionar hasta ${maxSelection} Sujetos` : (title || 'Seleccionar de la Galería')}</h2>
            <button
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Cerrar modal"
            >
                <CloseIcon className="w-5 h-5" />
            </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-grow bg-[#0A0814]/80">
            <Gallery 
              prompts={filteredPrompts} 
              onSelect={handleCardSelect} 
              selection={selected}
              multiSelect={multiSelect}
            />
        </div>
        {multiSelect && (
          <div className="p-4 border-t border-white/10 flex-shrink-0 bg-gray-900">
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar Selección ({selected.length}/{maxSelection})
            </button>
          </div>
        )}
      </div>
       <style>{`
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes scale-in {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
      `}</style>
    </div>,
    document.body
  );
};