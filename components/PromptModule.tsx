
import React, { useState } from 'react';
import { ExtractionMode, SavedPrompt } from '../types';
import { ModeConfig } from '../config';
import { SparklesIcon } from './icons/SparklesIcon';
import { GalleryIcon } from './icons/GalleryIcon';
import { SaveIcon } from './icons/SaveIcon';
import { ImageIcon } from './icons/ImageIcon';
import { CloseIcon } from './icons/CloseIcon';
import { generateImageFromPrompt } from '../services/gemini';

type ImageState = { url: string; base64: string; mimeType: string; };

interface PromptModuleProps {
    mode: ExtractionMode;
    config: ModeConfig;
    value: string;
    images: ImageState[];
    onChange: (mode: ExtractionMode, value: string) => void;
    onImageUpload: (mode: ExtractionMode, files: File[]) => void;
    onImageRemove: (mode: ExtractionMode, index: number) => void;
    onSavePrompt: (prompt: SavedPrompt) => void;
    savedPrompts: SavedPrompt[];
    onOpenGallery: (mode: ExtractionMode) => void;
    onOptimize: (mode: ExtractionMode) => void;
    onClearSuggestions: (mode: ExtractionMode) => void;
    isAnalyzingImages: boolean;
    isOptimizing: boolean;
    suggestions: string[];
    addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
    setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

const SmallLoader: React.FC = () => (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const VARIANT_LABELS = [
    { text: "Pulido", desc: "Corrección gramatical y vocabulario preciso", color: "text-blue-400" },
    { text: "Mejorado", desc: "Equilibrio ideal entre detalle y brevedad", color: "text-green-400" },
    { text: "Detallado", desc: "Rico en descripciones artísticas y técnicas", color: "text-purple-400" }
];

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
    onClearSuggestions,
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

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        const imageFiles: File[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                    imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length > 0) {
            // Prevent default to avoid pasting filename/garbage text if an image is present
            e.preventDefault();

            if (images.length >= maxImages) {
                addToast(`Límite de imágenes alcanzado (${maxImages}) para ${config.label}.`, 'warning');
                return;
            }

            const availableSlots = maxImages - images.length;
            const filesToProcess = imageFiles.slice(0, availableSlots);

            if (filesToProcess.length < imageFiles.length) {
                addToast(`Solo se añadieron ${filesToProcess.length} imágenes (límite alcanzado).`, 'warning');
            }

            if (filesToProcess.length > 0) {
                onImageUpload(mode, filesToProcess);
                addToast('Imagen pegada y procesando...', 'success');
            }
        }
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
                    onPaste={handlePaste}
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
            
            {/* AI Optimization Suggestions Block */}
            {suggestions.length > 0 && !isAnalyzingImages && (
                <div className="space-y-3 animate-fade-slide-in-up mt-2 p-2 bg-black/20 rounded-lg border border-white/5 relative">
                    <button 
                        onClick={() => onClearSuggestions(mode)}
                        className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
                        aria-label="Cerrar sugerencias"
                    >
                        <CloseIcon className="w-3 h-3" />
                    </button>
                    
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1 mb-1">Resultados de Optimización</p>
                    
                    {suggestions.map((s, i) => {
                        const variant = VARIANT_LABELS[i] || { text: `Variante ${i+1}`, desc: "", color: "text-gray-400" };
                        return (
                            <div key={i} className="group">
                                <div className="flex items-center justify-between mb-1 pl-1 pr-1">
                                    <span className={`text-[11px] font-bold uppercase tracking-wide ${variant.color}`}>
                                        {variant.text}
                                    </span>
                                    {/* Optional: Add info icon or tooltip here for description */}
                                </div>
                                <button 
                                    onClick={() => {
                                        onChange(mode, s);
                                        onClearSuggestions(mode);
                                    }} 
                                    className="w-full text-left p-3 text-xs rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all ring-1 ring-white/10 hover:ring-teal-500/50 shadow-sm relative overflow-hidden group-hover:shadow-md"
                                >
                                    <div className="absolute inset-0 w-1 bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    {s}
                                </button>
                            </div>
                        );
                    })}
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
                <button onClick={handleImageUploadClick} disabled={!canUploadMore || isAnalyzingImages} title="Analizar desde Imagen (Cargar, Soltar o Pegar)" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors" data-tour-id="module-image-upload">
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
