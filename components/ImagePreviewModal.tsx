
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons/CloseIcon';
import { generateImageFromPrompt } from '../services/geminiService';
import { Loader } from './Loader';

interface ImagePreviewModalProps {
  prompt: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ prompt, onClose }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const generate = async () => {
      try {
        const url = await generateImageFromPrompt(prompt);
        if (mounted) setImageUrl(url);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Error al generar imagen');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    generate();
    return () => { mounted = false; };
  }, [prompt]);

  const isQuotaError = error && (error.includes('cuota') || error.includes('límite') || error.includes('gratuito'));

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 animate-fade-in-subtle" onClick={onClose}>
      <div className="glass-pane rounded-2xl p-4 max-w-2xl w-full flex flex-col items-center relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 p-2 rounded-full text-white transition-colors z-10">
          <CloseIcon className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-white mb-4 self-start">Vista Previa Rápida</h3>
        
        <div className="w-full aspect-square bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden border border-white/10 relative">
          {loading && (
            <div className="flex flex-col items-center gap-3">
               <Loader />
               <p className="text-teal-400 text-sm animate-pulse">Generando con Gemini...</p>
            </div>
          )}
          
          {error && (
            <div className="flex flex-col items-center justify-center p-6 text-center h-full w-full">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                     <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h4 className="text-red-400 font-bold mb-2">Error de Generación</h4>
                <p className="text-gray-300 text-sm mb-4">{error}</p>
                {isQuotaError && (
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-teal-400 text-xs hover:underline hover:text-teal-300"
                    >
                        Ver planes y facturación de Gemini API &rarr;
                    </a>
                )}
            </div>
          )}

          {imageUrl && (
            <img src={imageUrl} alt="Preview" className="w-full h-full object-contain animate-scale-in-center" />
          )}
        </div>

        {imageUrl && (
           <a 
             href={imageUrl} 
             download={`preview-${Date.now()}.jpg`}
             className="mt-4 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"
           >
             Descargar Imagen
           </a>
        )}
      </div>
    </div>,
    document.body
  );
};
