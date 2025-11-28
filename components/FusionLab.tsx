
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
import { Loader } from './Loader';

interface FusionLabProps {
    onSavePrompt: (prompt: SavedPrompt) => void;
    addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
    setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

type ImageSlot = {
    id: string;
    url: string | null;
    base64: string | null;
    mimeType: string | null;
};

const Slot: React.FC<{
    slot: ImageSlot;
    onUpload: (id: string, file: File) => void;
    onClear: (id: string) => void;
    label: string;
}> = ({ slot, onUpload, onClear, label }) => {
    const inputId = `slot-input-${slot.id}`;
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(slot.id, e.target.files[0]);
        }
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
            className={`relative group w-full aspect-square bg-gray-900/50 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden ${isDragging ? 'border-teal-400 bg-teal-500/10' : 'border-gray-700 hover:border-indigo-500 hover:bg-gray-900/80'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            {slot.url ? (
                <>
                    <img src={slot.url} alt="Slot content" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                            onClick={() => onClear(slot.id)}
                            className="bg-red-500/80 p-2 rounded-full text-white hover:bg-red-600 transition-colors"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white">
                        {label}
                    </div>
                </>
            ) : (
                <label htmlFor={inputId} className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-indigo-400">
                    <ImageIcon className="w-8 h-8 mb-2" />
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] mt-1 opacity-60">Clic o Arrastrar</span>
                    <input
                        id={inputId}
                        type="file"
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleFileChange}
                    />
                </label>
            )}
        </div>
    );
};

export const FusionLab: React.FC<FusionLabProps> = ({ onSavePrompt, addToast, setGlobalLoader }) => {
    const [targetModule, setTargetModule] = useState<ExtractionMode>('style');
    const [slots, setSlots] = useState<ImageSlot[]>([
        { id: 'A', url: null, base64: null, mimeType: null },
        { id: 'B', url: null, base64: null, mimeType: null },
        { id: 'C', url: null, base64: null, mimeType: null },
    ]);
    const [userFeedback, setUserFeedback] = useState('');
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleUpload = async (id: string, file: File) => {
        try {
            const { base64, mimeType } = await fileToBase64(file);
            setSlots(prev => prev.map(s => s.id === id ? { ...s, url: URL.createObjectURL(file), base64, mimeType } : s));
        } catch (e) {
            addToast("Error al procesar imagen", 'error');
        }
    };

    const handleClearSlot = (id: string) => {
        setSlots(prev => prev.map(s => s.id === id ? { ...s, url: null, base64: null, mimeType: null } : s));
    };

    const activeImages = slots.filter(s => s.base64 !== null);

    const handleFuse = async () => {
        if (activeImages.length < 2) {
            addToast("Sube al menos 2 imágenes para fusionar.", 'warning');
            return;
        }
        
        setIsLoading(true);
        setGlobalLoader({ active: true, message: 'Alquimizando conceptos...' });
        
        try {
            const imagesPayload = activeImages.map(img => ({ 
                imageBase64: img.base64!, 
                mimeType: img.mimeType! 
            }));
            
            const hybridFragment = await generateHybridFragment(targetModule, imagesPayload, userFeedback);
            setResult(hybridFragment);
            addToast("¡Fusión completada!", 'success');
        } catch (e) {
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
            // Generate collage cover
            const collageImages = activeImages.map(img => ({ base64: img.base64!, mimeType: img.mimeType! }));
            const coverUrl = await createImageCollage(collageImages);
            
            // NOTE: We save the 'type' as the targetModule (e.g. 'style') so the Editor recognizes it.
            // We use the new 'isHybrid' flag to mark it visually as a hybrid.
            const newPrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: targetModule as any, 
                isHybrid: true,
                prompt: result,
                coverImage: coverUrl,
                title: `Híbrido: ${EXTRACTION_MODE_MAP[targetModule].label}`,
                category: EXTRACTION_MODE_MAP[targetModule].label,
                artType: 'Fragmento Híbrido',
                notes: `Fusión de ${activeImages.length} imágenes. Feedback: ${userFeedback || 'Ninguno'}.`,
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
                <p className="mt-2 text-gray-400">Combina el ADN visual de múltiples imágenes para crear nuevos conceptos híbridos.</p>
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
                        <div className="grid grid-cols-3 gap-4">
                            {slots.map((slot, idx) => (
                                <Slot 
                                    key={slot.id} 
                                    slot={slot} 
                                    onUpload={handleUpload} 
                                    onClear={handleClearSlot} 
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
                        disabled={activeImages.length < 2 || isLoading}
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
        </div>
    );
};