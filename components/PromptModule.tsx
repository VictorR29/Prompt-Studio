import React, { useState } from 'react';
import { ExtractionMode, SavedPrompt } from '../types';
import { EXTRACTION_MODE_MAP } from '../config';
import { SparklesIcon } from './icons/SparklesIcon';
import { GalleryIcon } from './icons/GalleryIcon';
import { SaveIcon } from './icons/SaveIcon';
import { ImageIcon } from './icons/ImageIcon';
import { CloseIcon } from './icons/CloseIcon';
import { generateImageFromPrompt } from '../services/geminiService';

type ImageState = { url: string; base64: string; mimeType: string; };

interface PromptModuleProps {
    mode: ExtractionMode;
    config: typeof EXTRACTION_MODE_MAP[ExtractionMode];
    value: string;
    images: ImageState[];
    onChange: (mode: ExtractionMode, value: string) => void;
    onImageUpload: (mode: ExtractionMode, files: File[]) => void;
    onImageRemove: (mode: ExtractionMode, index: number) => void;
    onSavePrompt: (prompt: SavedPrompt) => void;
    savedPrompts: SavedPrompt[];
    onOpenGallery: (mode: ExtractionMode) => void;
    onOptimize: (mode: ExtractionMode) => void;
    isAnalyzingImages: boolean;
    isOptimizing: boolean;
    suggestions: string[];
    addToast: (message: string, type?: 'success' | 'error') => void;
    setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

const SmallLoader: React.FC = () => (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const PromptModule: React.FC<PromptModuleProps> = ({ 
    mode, 
    config, 
    value,
    images,
    onChange,
    onImageUpload,
    onImageRemove,
    onSavePrompt, 
    onOpenGallery,
    onOptimize,
    isAnalyzingImages,
    isOptimizing,
    suggestions,
    addToast,
    setGlobalLoader
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputId = React.useRef(`file-upload-${mode}-${Math.random().toString(36).substring(7)}`);
    const maxImages = config.id === 'style' ? 5 : config.id === 'subject' ? 3 : 1;
    const canUploadMore = images.length < maxImages;

    const handleImageUploadClick = () => {
        const inputElement = document.getElementById(inputId.current);
        if (inputElement) {
            inputElement.click();
        }
    };
    
    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onImageUpload(mode, Array.from(event.target.files));
        }
        event.target.value = ''; // Reset input to allow re-uploading the same file
    };

    const handleSaveFragment = async () => {
        if (!value) return;
        setGlobalLoader({ active: true, message: 'Guardando fragmento...' });
    
        try {
            let coverImageUrl = images.length > 0 ? `data:${images[0].mimeType};base64,${images[0].base64}` : '';
            
            if (!coverImageUrl) {
                try {
                    setGlobalLoader({ active: true, message: 'Generando portada para el fragmento...' });
                    coverImageUrl = await generateImageFromPrompt(value);
                } catch (imgErr) {
                    console.error("Error generating cover image for fragment:", imgErr);
                    addToast('No se pudo generar la portada. Guardando sin ella.', 'error');
                    coverImageUrl = ''; // Fallback to no cover
                }
            }
            
            const newPrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: mode,
                prompt: value,
                coverImage: coverImageUrl,
                title: `${config.label} - ${value.substring(0, 20)}...`,
                category: config.label,
                artType: 'Fragmento de Prompt',
                notes: `Fragmento de tipo '${config.label}' guardado desde el Editor Modular.`
            };
            onSavePrompt(newPrompt);
            addToast(`'${config.label}' guardado en la galería!`, 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            addToast(`Error al guardar fragmento: ${errorMessage}`, 'error');
        } finally {
            setGlobalLoader({ active: false, message: '' });
        }
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && canUploadMore) {
            onImageUpload(mode, Array.from(e.dataTransfer.files));
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (canUploadMore) {
            setIsDragging(true);
        }
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    return (
        <div className="glass-pane p-4 rounded-xl flex flex-col space-y-3" data-tour-id={`editor-module-${mode}`}>
            <h3 className={`font-semibold text-lg ${config.badgeClassName.replace('bg-', 'text-').replace('/20', '')}`}>{config.label}</h3>
            
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {images.map((image, index) => (
                        <div key={index} className="relative w-12 h-12 group flex-shrink-0">
                            <img src={image.url} alt={`Preview ${index}`} className="w-full h-full object-cover rounded-md" />
                            <button 
                                onClick={() => onImageRemove(mode, index)}
                                disabled={isAnalyzingImages}
                                className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 text-white rounded-full p-0.5 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                                aria-label="Eliminar imagen"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div 
                className="relative flex-grow"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
            >
                <textarea
                    value={value}
                    onChange={(e) => onChange(mode, e.target.value)}
                    placeholder={config.description}
                    className="w-full h-full min-h-[100px] bg-gray-900/70 rounded-lg p-3 text-gray-300 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner resize-none custom-scrollbar"
                />
                 {isDragging && (
                    <div className="absolute inset-0 bg-teal-500/20 border-2 border-dashed border-teal-400 rounded-lg flex flex-col items-center justify-center pointer-events-none transition-opacity">
                        <ImageIcon className="w-8 h-8 text-teal-300 mb-2" />
                        <p className="text-sm font-semibold text-teal-300">Suelta para analizar</p>
                    </div>
                )}
            </div>
            {suggestions.length > 0 && !isAnalyzingImages && (
                <div className="space-y-2 animate-fade-slide-in-up">
                    {suggestions.map((s, i) => (
                        <button key={i} onClick={() => onChange(mode, s)} className="w-full text-left p-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors">
                            {s}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/10" data-tour-id="module-actions-footer">
                <input
                    id={inputId.current}
                    type="file"
                    className="hidden"
                    multiple={maxImages > 1}
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileSelected}
                />
                <button onClick={handleImageUploadClick} disabled={!canUploadMore || isAnalyzingImages} title="Analizar desde Imagen" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors" data-tour-id="module-image-upload">
                    {isAnalyzingImages ? <SmallLoader /> : <ImageIcon className="w-4 h-4 text-amber-400" />}
                </button>
                <button onClick={() => onOptimize(mode)} disabled={!value || isOptimizing || isAnalyzingImages} title="Optimizar con IA" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors" data-tour-id="module-optimize-button">
                    {isOptimizing ? <SmallLoader /> : <SparklesIcon className="w-4 h-4 text-purple-400" />}
                </button>
                <button onClick={() => onOpenGallery(mode)} disabled={isAnalyzingImages} title="Reemplazar desde Galería" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors">
                    <GalleryIcon className="w-4 h-4 text-cyan-400" />
                </button>
                 <button onClick={handleSaveFragment} disabled={!value || isAnalyzingImages} title="Guardar fragmento en Galería" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors">
                    <SaveIcon className="w-4 h-4 text-green-400" />
                </button>
            </div>
        </div>
    );
};