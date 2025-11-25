
import React, { useState, useEffect } from 'react';
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

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 animate-fade-in-subtle" onClick={onClose}>
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
          {error && <p className="text-red-400 px-4 text-center">{error}</p>}
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
    </div>
  );
};
