
import React, { useState } from 'react';
import { ExtractionMode, SavedPrompt } from '../types';
import { EXTRACTION_MODE_MAP, EXTRACTION_MODES } from '../config';
import { generateHybridFragment, generateImageFromPrompt } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { createImageCollage } from '../utils/imageUtils';
import { SparklesIcon } from './icons/SparklesIcon';
import { CloseIcon } from './icons/CloseIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { SaveIcon } from './icons/SaveIcon';
import { ImageIcon } from './icons/ImageIcon';
import { GalleryIcon } from './icons/GalleryIcon';
import { Loader } from './Loader';
import { GalleryModal } from './GalleryModal';

interface FusionLabProps {
    onSavePrompt: (prompt: SavedPrompt) => void;
    addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
    setGlobalLoader: (state: { active: boolean; message: string }) => void;
    savedPrompts: SavedPrompt[];
}

type SlotData = {
    id: string;
    type: 'image' | 'text' | 'empty';
    url: string | null; // Display URL (image blob or text cover)
    base64: string | null; // For image content
    mimeType: string | null; // For image content
    text: string | null; // For text content
    label: string | null; // Title for text content
};

const Slot: React.FC<{
    slot: SlotData;
    onUpload: (id: string, file: File) => void;
    onClear: (id: string) => void;
    onOpenGallery: (id: string) => void;
    label: string;
}> = ({ slot, onUpload, onClear, onOpenGallery, label }) => {
    const inputId = `slot-input-${slot.id}`;
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(slot.id, e.target.files[0]);
        }
        e.target.value = ''; // Reset
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onUpload(slot.id, e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    return (
        <div 
            className={`relative group w-full h-48 sm:h-auto sm:aspect-square bg-gray-900/50 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${isDragging ? 'border-teal-400 bg-teal-500/10' : 'border-gray-700 hover:border-indigo-500 hover:bg-gray-900/80'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            {slot.type !== 'empty' ? (
                <>
                    {slot.type === 'image' && slot.url && (
                        <img src={slot.url} alt="Slot content" className="w-full h-full object-cover" />
                    )}
                    {slot.type === 'text' && (
                        <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center bg-indigo-900/20">
                            {slot.url ? (
                                <div className="absolute inset-0 opacity-30">
                                    <img src={slot.url} alt="Cover" className="w-full h-full object-cover" />
                                </div>
                            ) : null}
                            <div className="relative z-10 pointer-events-none">
                                <span className="text-2xl mb-2 block">📝</span>
                                <p className="text-xs font-bold text-indigo-300 line-clamp-3">{slot.label}</p>
                            </div>
                        </div>
                    )}
                    
                    {/* Always visible delete button on top-right, safer for mobile */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear(slot.id);
                        }}
                        className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-red-600 text-white p-2 rounded-full transition-all shadow-md backdrop-blur-sm"
                        title="Limpiar slot"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1 z-10 pointer-events-none">
                        <span>{label}</span>
                        <span className="text-[10px] text-gray-400 uppercase ml-1">({slot.type === 'image' ? 'IMG' : 'TXT'})</span>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-4 w-full h-full">
                    <span className="text-sm font-semibold text-gray-500 mb-1">{label}</span>
                    <div className="flex gap-4">
                        <label htmlFor={inputId} className="cursor-pointer bg-gray-800 hover:bg-gray-700 p-3 rounded-xl transition-colors group/btn shadow-md ring-1 ring-white/5" title="Subir Imagen">
                            <ImageIcon className="w-6 h-6 text-gray-400 group-hover/btn:text-white" />
                            <input
                                id={inputId}
                                type="file"
                                className="hidden"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={handleFileChange}
                            />
                        </label>
                        <button 
                            onClick={() => onOpenGallery(slot.id)} 
                            className="bg-gray-800 hover:bg-gray-700 p-3 rounded-xl transition-colors group/btn shadow-md ring-1 ring-white/5" 
                            title="Seleccionar de Galería"
                        >
                            <GalleryIcon className="w-6 h-6 text-gray-400 group-hover/btn:text-white" />
                        </button>
                    </div>
                    <span className="text-xs text-gray-600 mt-1">Arrastra o selecciona</span>
                </div>
            )}
            {isDragging && (
                <div className="absolute inset-0 bg-teal-500/20 border-2 border-dashed border-teal-400 rounded-lg flex flex-col items-center justify-center pointer-events-none transition-opacity bg-gray-900/90 z-20">
                    <p className="text-sm font-semibold text-teal-300">Suelta imagen aquí</p>
                </div>
            )}
        </div>
    );
};

export const FusionLab: React.FC<FusionLabProps> = ({ onSavePrompt, addToast, setGlobalLoader, savedPrompts }) => {
    const [targetModule, setTargetModule] = useState<ExtractionMode>('style');
    const [slots, setSlots] = useState<SlotData[]>([
        { id: 'A', type: 'empty', url: null, base64: null, mimeType: null, text: null, label: null },
        { id: 'B', type: 'empty', url: null, base64: null, mimeType: null, text: null, label: null },
        { id: 'C', type: 'empty', url: null, base64: null, mimeType: null, text: null, label: null },
    ]);
    const [userFeedback, setUserFeedback] = useState('');
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // Gallery Modal State
    const [gallerySlotId, setGallerySlotId] = useState<string | null>(null);

    const handleUpload = async (id: string, file: File) => {
        try {
            const { base64, mimeType } = await fileToBase64(file);
            setSlots(prev => prev.map(s => s.id === id ? { 
                ...s, 
                type: 'image',
                url: URL.createObjectURL(file), 
                base64, 
                mimeType,
                text: null,
                label: null
            } : s));
        } catch (e) {
            addToast("Error al procesar imagen", 'error');
        }
    };

    const handleGallerySelect = (prompt: SavedPrompt | SavedPrompt[]) => {
        const selected = Array.isArray(prompt) ? prompt[0] : prompt;
        if (gallerySlotId && selected) {
            setSlots(prev => prev.map(s => s.id === gallerySlotId ? {
                ...s,
                type: 'text',
                url: selected.coverImage || null, // Use cover image as visual if available
                text: selected.prompt,
                label: selected.title,
                base64: null,
                mimeType: null
            } : s));
        }
        setGallerySlotId(null);
    };

    const handleClearSlot = (id: string) => {
        setSlots(prev => prev.map(s => s.id === id ? { id, type: 'empty', url: null, base64: null, mimeType: null, text: null, label: null } : s));
    };

    const activeSlots = slots.filter(s => s.type !== 'empty');

    const handleFuse = async () => {
        if (activeSlots.length < 2) {
            addToast("Añade al menos 2 referencias (imagen o texto) para fusionar.", 'warning');
            return;
        }
        
        setIsLoading(true);
        setGlobalLoader({ active: true, message: 'Alquimizando conceptos...' });
        
        try {
            const payload = activeSlots.map(slot => {
                if (slot.type === 'image' && slot.base64 && slot.mimeType) {
                    return { imageBase64: slot.base64, mimeType: slot.mimeType };
                } else if (slot.type === 'text' && slot.text) {
                    return { text: slot.text };
                }
                throw new Error("Invalid slot state");
            });
            
            const hybridFragment = await generateHybridFragment(targetModule, payload, userFeedback);
            setResult(hybridFragment);
            addToast("¡Fusión completada!", 'success');
        } catch (e) {
            console.error(e);
            addToast("La fusión falló. Intenta de nuevo.", 'error');
        } finally {
            setIsLoading(false);
            setGlobalLoader({ active: false, message: '' });
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async () => {
        if (!result) return;
        setGlobalLoader({ active: true, message: 'Guardando híbrido...' });
        try {
            let coverUrl = '';
            
            // Generate collage cover only if we have images
            const imageInputs = activeSlots.filter(s => s.type === 'image' && s.base64);
            if (imageInputs.length > 0) {
                const collageImages = imageInputs.map(img => ({ base64: img.base64!, mimeType: img.mimeType! }));
                // If we have mixed text inputs, we might want to just use the images we have
                coverUrl = await createImageCollage(collageImages);
            } else {
                // Text only fusion? Try generating a cover with AI
                try {
                    setGlobalLoader({ active: true, message: 'Generando portada conceptual...' });
                    coverUrl = await generateImageFromPrompt(result);
                } catch (e) {
                    console.warn("Cover generation failed");
                }
            }
            
            const newPrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: targetModule as any, 
                isHybrid: true,
                prompt: result,
                coverImage: coverUrl,
                title: `Híbrido: ${EXTRACTION_MODE_MAP[targetModule].label}`,
                category: EXTRACTION_MODE_MAP[targetModule].label,
                artType: 'Fragmento Híbrido',
                notes: `Fusión de ${activeSlots.length} fuentes (${imageInputs.length} img, ${activeSlots.length - imageInputs.length} txt). Feedback: ${userFeedback || 'Ninguno'}.`,
            };
            
            onSavePrompt(newPrompt);
            addToast("Fragmento híbrido guardado.", 'success');
        } catch (e) {
            console.error(e);
            addToast("Error al guardar.", 'error');
        } finally {
            setGlobalLoader({ active: false, message: '' });
        }
    };

    return (
        <div className="glass-pane p-6 md:p-8 rounded-2xl max-w-5xl mx-auto animate-fade-slide-in-up min-h-[calc(100vh-140px)] flex flex-col">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center gap-3">
                    <span className="text-4xl">🧪</span> Laboratorio de Fusión
                </h1>
                <p className="mt-2 text-gray-400">Combina el ADN visual de imágenes y textos guardados para crear nuevos conceptos híbridos.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 flex-grow">
                {/* Control Panel */}
                <div className="w-full lg:w-1/2 space-y-6">
                    {/* Module Selector */}
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5">
                        <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">1. Objetivo de Fusión</label>
                        <div className="grid grid-cols-3 gap-2">
                            {EXTRACTION_MODES.filter(m => m.id !== 'negative').map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setTargetModule(mode.id)}
                                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                                        targetModule === mode.id
                                            ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-900'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Slots */}
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5">
                        <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">2. Referencias (ADN)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                            {slots.map((slot, idx) => (
                                <Slot 
                                    key={slot.id} 
                                    slot={slot} 
                                    onUpload={handleUpload} 
                                    onClear={handleClearSlot} 
                                    onOpenGallery={setGallerySlotId}
                                    label={`Ref ${idx + 1}`} 
                                />
                            ))}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5">
                        <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">3. Catalizador (Instrucciones)</label>
                        <textarea
                            value={userFeedback}
                            onChange={(e) => setUserFeedback(e.target.value)}
                            placeholder="Ej: Conserva la iluminación de la Ref 1 pero usa la ropa de la Ref 2..."
                            className="w-full bg-gray-800/50 rounded-lg p-3 text-sm text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-24"
                        />
                    </div>

                    <button
                        onClick={handleFuse}
                        disabled={activeSlots.length < 2 || isLoading}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 text-lg"
                    >
                        {isLoading ? <Loader /> : <SparklesIcon className="w-6 h-6" />}
                        {isLoading ? 'Sintetizando...' : 'Fusionar Conceptos'}
                    </button>
                </div>

                {/* Result Panel */}
                <div className="w-full lg:w-1/2 flex flex-col">
                    <div className="flex-grow bg-gray-900/80 rounded-2xl border border-white/10 p-6 flex flex-col relative shadow-inner">
                        <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="bg-indigo-500/20 p-1 rounded">🧬</span> Resultado Híbrido
                        </h3>
                        
                        {result ? (
                            <>
                                <textarea
                                    readOnly
                                    value={result}
                                    className="flex-grow w-full bg-transparent text-gray-200 font-mono text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar"
                                />
                                <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
                                    <button 
                                        onClick={handleCopy}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                                        Copiar
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <SaveIcon className="w-4 h-4" />
                                        Guardar
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-grow flex flex-col items-center justify-center text-gray-600 opacity-50">
                                <div className="text-6xl mb-4 grayscale">⚗️</div>
                                <p>El resultado de la fusión aparecerá aquí.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {gallerySlotId && (
                <GalleryModal
                    prompts={savedPrompts}
                    onSelect={handleGallerySelect}
                    onClose={() => setGallerySlotId(null)}
                    title="Seleccionar Fuente de ADN"
                />
            )}
        </div>
    );
};
