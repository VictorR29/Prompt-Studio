

import React, { useCallback, useEffect } from 'react';
import { SavedPrompt } from '../types';
import { Gallery } from './Gallery';
import { CloseIcon } from './icons/CloseIcon';

interface GalleryModalProps {
  prompts: SavedPrompt[];
  onSelect: (prompt: SavedPrompt) => void;
  onClose: () => void;
  filter?: SavedPrompt['type'][];
  title?: string;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({ prompts, onSelect, onClose, filter, title }) => {

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

  const filteredPrompts = filter ? prompts.filter(p => filter.includes(p.type)) : prompts;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-subtle"
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
            <h2 className="text-xl font-bold text-white">{title || 'Seleccionar de la Galería'}</h2>
            <button
                onClick={onClose}
                className="bg-transparent text-gray-500 hover:text-white rounded-full p-1 transition-colors"
                aria-label="Cerrar modal"
            >
                <CloseIcon className="w-6 h-6" />
            </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
            <Gallery prompts={filteredPrompts} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
};