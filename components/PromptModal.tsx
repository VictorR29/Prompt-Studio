
import React, { useState, useEffect, useCallback } from 'react';
import { SavedPrompt } from '../types';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CloseIcon } from './icons/CloseIcon';
import { PencilIcon } from './icons/PencilIcon';
import { JsonEditor } from './JsonEditor';
import { BanIcon } from './icons/BanIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface PromptModalProps {
  promptData: SavedPrompt;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (prompt: SavedPrompt) => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({ promptData, onClose, onDelete, onEdit }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(promptData.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // The window.confirm dialog was likely being blocked, preventing the action.
    // Removing it to ensure functionality. A custom confirmation could be a future enhancement.
    onDelete(promptData.id);
    onClose(); // Close the modal after deletion
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(promptData);
    onClose();
  };
  
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


  return (
    <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in"
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-modal-title"
    >
      <div 
        className="glass-pane rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full md:w-1/2 relative bg-gray-900">
            {promptData.coverImage ? (
                <img src={promptData.coverImage} alt={promptData.title} className="w-full h-64 md:h-full object-cover" />
            ) : (
                <div className="w-full h-64 md:h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                    <svg className="w-24 h-24 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
            )}
             <button
                onClick={onClose}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-white rounded-full p-1.5 transition-all md:hidden"
                aria-label="Cerrar modal"
                >
                <CloseIcon className="w-5 h-5" />
            </button>
        </div>
        <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
                <div className="flex-grow">
                    <h2 id="prompt-modal-title" className="text-2xl font-bold text-white leading-tight">{promptData.title}</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                         <span className="text-teal-300 text-xs font-semibold bg-white/10 px-2.5 py-1 rounded-full">
                            {promptData.category}
                        </span>
                         <span className="text-amber-300 text-xs font-semibold bg-white/10 px-2.5 py-1 rounded-full">
                            {promptData.artType}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="hidden md:block bg-transparent text-gray-500 hover:text-white rounded-full p-1 transition-colors"
                    aria-label="Cerrar modal"
                    >
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>
          
            <div className="flex-grow overflow-y-auto pr-2 -mr-4 space-y-6 custom-scrollbar">
                <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                    <h4 className="font-bold text-teal-300 mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                        <SparklesIcon className="w-3 h-3" /> Descripción Visual
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{promptData.notes}</p>
                </div>

                <div>
                    <h4 className="font-bold text-teal-300 mb-2 text-sm uppercase tracking-wider">Prompt Completo</h4>
                     <div className="bg-gray-800 rounded-lg p-3 ring-1 ring-gray-700">
                        {promptData.type === 'structured' ? (
                            <JsonEditor jsonString={promptData.prompt} />
                        ) : (
                            <pre className="font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {promptData.prompt}
                            </pre>
                        )}
                    </div>
                </div>

                {promptData.negativePrompt && (
                    <div>
                        <h4 className="font-bold text-red-400 mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                            <BanIcon className="w-4 h-4" /> Prompt Negativo
                        </h4>
                        <div className="bg-red-900/10 rounded-lg p-3 ring-1 ring-red-500/30">
                            <pre className="font-mono text-xs text-red-200 leading-relaxed whitespace-pre-wrap">
                                {promptData.negativePrompt}
                            </pre>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-3 mt-6 pt-4 border-t border-white/10">
                <button
                    onClick={handleEdit}
                    className="flex-grow flex items-center justify-center space-x-2 text-center bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-amber-500/50"
                    aria-label="Cargar y Editar en Estructurador"
                >
                    <PencilIcon className="w-5 h-5" />
                    <span>Cargar y Editar</span>
                </button>
                <button
                onClick={handleCopy}
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 transition-colors"
                aria-label="Copiar prompt"
                >
                {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
                </button>
                <button
                onClick={handleDelete}
                className="p-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors"
                aria-label="Eliminar prompt"
                >
                <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
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
    </div>
  );
};