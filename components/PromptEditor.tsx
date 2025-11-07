


// FIX: Import 'useState' and 'useEffect' from React to resolve hook usage and type inference errors.
import React, { useState, useEffect } from 'react';
import { SavedPrompt, ExtractionMode } from '../types';
import { AppView } from '../App';
import { modularizePrompt, assembleMasterPrompt, optimizePromptFragment, mergeModulesIntoJsonTemplate, createJsonTemplate, generateStructuredPromptMetadata } from '../services/geminiService';
import { EXTRACTION_MODE_MAP } from '../config';
import { Loader } from './Loader';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { GalleryIcon } from './icons/GalleryIcon';
import { FilePlusIcon } from './icons/FilePlusIcon';
import { ClipboardPasteIcon } from './icons/ClipboardPasteIcon';
import { PromptModule } from './PromptModule';
import { UndoIcon } from './icons/UndoIcon';
import { GalleryModal } from './GalleryModal';
import { JsonIcon } from './icons/JsonIcon';
import { CloseIcon } from './icons/CloseIcon';

interface PromptEditorProps {
    initialPrompt: SavedPrompt | null;
    onSavePrompt: (prompt: SavedPrompt) => void;
    savedPrompts: SavedPrompt[];
    setView: (view: AppView) => void;
    onNavigateToGallery: () => void;
    addToast: (message: string, type?: 'success' | 'error') => void;
}

const initialFragments: Partial<Record<ExtractionMode, string>> = {
    subject: '', pose: '', expression: '', outfit: '', object: '',
    scene: '', color: '', composition: '', style: ''
};

export const PromptEditor: React.FC<PromptEditorProps> = ({ initialPrompt, onSavePrompt, savedPrompts, setView, onNavigateToGallery, addToast }) => {
    const [viewMode, setViewMode] = useState<'selection' | 'editor'>('selection');
    const [fragments, setFragments] = useState<Partial<Record<ExtractionMode, string>>>(initialFragments);
    const [pastedText, setPastedText] = useState('');
    const [pastedJson, setPastedJson] = useState('');
    const [loadingAction, setLoadingAction] = useState<'analyze' | 'import' | null>(null);
    const [isLoading, setIsLoading] = useState(false); // For editor-mode actions
    const [error, setError] = useState<string | null>(null);
    const [finalPrompt, setFinalPrompt] = useState('');
    const [outputType, setOutputType] = useState<'text' | 'json' | null>(null);
    const [copied, setCopied] = useState(false);
    const [galleryModalFor, setGalleryModalFor] = useState<ExtractionMode | null>(null);
    const [optimizingModule, setOptimizingModule] = useState<ExtractionMode | null>(null);
    const [suggestions, setSuggestions] = useState<Partial<Record<ExtractionMode, string[]>>>({});
    const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
    const [isJsonChoiceModalOpen, setIsJsonChoiceModalOpen] = useState(false);
    
    useEffect(() => {
        if (initialPrompt) {
            handleLoadPrompt(initialPrompt.prompt);
        }
    }, [initialPrompt]);
    
    const handleLoadPrompt = async (promptText: string) => {
        setLoadingAction('analyze');
        setError(null);
        try {
            const modularized = await modularizePrompt(promptText);
            setFragments(modularized);
            setViewMode('editor');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al modularizar: ${errorMessage}`);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleImportTemplate = async () => {
        if (!pastedJson.trim()) return;

        setLoadingAction('import');
        setError(null);
        try {
            const templateJson = await createJsonTemplate(pastedJson);
            const metadata = await generateStructuredPromptMetadata(templateJson);

            const newTemplatePrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: 'structured',
                prompt: templateJson,
                coverImage: '', 
                title: metadata.title,
                category: metadata.category,
                artType: 'Plantilla JSON',
                notes: metadata.notes,
            };

            onSavePrompt(newTemplatePrompt);
            addToast(`Plantilla "${metadata.title}" guardada!`, 'success');
            setPastedJson('');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al importar plantilla: ${errorMessage}`);
        } finally {
            setLoadingAction(null);
        }
    };
    
    const handleStartBlank = () => {
        setFragments(initialFragments);
        setFinalPrompt('');
        setError(null);
        setViewMode('editor');
    };

    const handleGoBackToSelection = () => {
        setFragments(initialFragments);
        setPastedText('');
        setError(null);
        setFinalPrompt('');
        setOutputType(null);
        setCopied(false);
        setIsLoading(false);
        setLoadingAction(null);
        setViewMode('selection');
    };

    const handleFragmentChange = (mode: ExtractionMode, value: string) => {
        setFragments(prev => ({ ...prev, [mode]: value }));
    };
    
    const handleOpenGalleryForModule = (mode: ExtractionMode) => {
        setGalleryModalFor(mode);
    };

    const handleSelectFromGalleryForModule = (selectedPrompt: SavedPrompt) => {
        if (galleryModalFor) {
            handleFragmentChange(galleryModalFor, selectedPrompt.prompt);
        }
        setGalleryModalFor(null);
    };

    const handleOptimizeModule = async (mode: ExtractionMode) => {
        const fragmentValue = fragments[mode];
        if (!fragmentValue || !fragmentValue.trim()) return;

        setOptimizingModule(mode);
        setSuggestions(prev => ({ ...prev, [mode]: [] }));
        setError(null);
        try {
            const newSuggestions = await optimizePromptFragment(mode, fragments);
            setSuggestions(prev => ({ ...prev, [mode]: newSuggestions }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al optimizar: ${errorMessage}`);
        } finally {
            setOptimizingModule(null);
        }
    };

    const handleGenerateText = async () => {
        setIsLoading(true);
        setOutputType('text');
        setError(null);
        setFinalPrompt('');
        try {
            const result = await assembleMasterPrompt(fragments);
            setFinalPrompt(result);
        } catch (err) {
            setOutputType(null);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al ensamblar: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateJson = () => {
        const activeFragments = Object.values(fragments).some(v => v && v.trim() !== '');
        if (!activeFragments) {
            setError("No hay contenido en los módulos para generar un JSON.");
            return;
        }
        setError(null);
        setIsJsonChoiceModalOpen(true);
    };

    const handleDirectJsonGeneration = () => {
        setIsJsonChoiceModalOpen(false);
        const activeFragments = Object.entries(fragments).reduce((acc, [key, value]) => {
            if (value && value.trim() !== '') {
                acc[key as ExtractionMode] = value;
            }
            return acc;
        }, {} as Partial<Record<ExtractionMode, string>>);
        
        const jsonString = JSON.stringify(activeFragments, null, 2);
        setFinalPrompt(jsonString);
        setOutputType('json');
    };

    const handleTemplateJsonGeneration = () => {
        setIsJsonChoiceModalOpen(false);
        setIsTemplateSelectorOpen(true);
    };

    const handleSelectJsonTemplate = async (template: SavedPrompt) => {
        setIsTemplateSelectorOpen(false);
        setIsLoading(true);
        setOutputType('json');
        setError(null);
        setFinalPrompt('');
        
        const activeFragments = Object.entries(fragments).reduce((acc, [key, value]) => {
            if (value && value.trim() !== '') {
                acc[key as ExtractionMode] = value;
            }
            return acc;
        }, {} as Partial<Record<ExtractionMode, string>>);

        try {
            const result = await mergeModulesIntoJsonTemplate(activeFragments, template.prompt);
            setFinalPrompt(result);
        } catch (err) {
            setOutputType(null);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al fusionar con plantilla: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!finalPrompt) return;
        
        if (outputType === 'text') {
            const newPrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: 'master',
                prompt: finalPrompt,
                coverImage: '',
                title: `Prompt Maestro - ${new Date().toLocaleDateString()}`,
                category: 'Ensamblado',
                artType: 'Prompt Compuesto',
                notes: 'Generado desde el Editor Modular como texto plano.'
            };
            onSavePrompt(newPrompt);
            addToast('Prompt guardado en la galería', 'success');
        } else if (outputType === 'json') {
            const newPrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: 'structured',
                prompt: finalPrompt,
                coverImage: '',
                title: `JSON Modular - ${new Date().toLocaleDateString()}`,
                category: 'JSON Modular',
                artType: 'Prompt Estructurado',
                notes: 'Generado desde el Editor Modular como JSON.'
            };
            onSavePrompt(newPrompt);
            addToast('Prompt guardado en la galería', 'success');
        }
    };

    const handleCopy = () => {
        if (finalPrompt) {
            navigator.clipboard.writeText(finalPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (viewMode === 'selection') {
        return (
            <div className="glass-pane p-8 rounded-2xl max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                        Panel de Control Modular
                    </h1>
                    <p className="mt-2 text-gray-400">Elige cómo quieres empezar a construir tu próximo gran prompt.</p>
                </div>

                {loadingAction && <div className="flex justify-center my-4"><Loader /></div>}
                {error && <div className="my-4 text-center text-red-400 bg-red-500/10 p-3 rounded-lg"><p>{error}</p></div>}
                
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                        <button onClick={onNavigateToGallery} className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-teal-400">
                            <GalleryIcon className="w-10 h-10 text-teal-400" />
                            <h2 className="font-semibold text-gray-200">Cargar desde Galería</h2>
                            <p className="text-xs text-gray-500">Carga un prompt guardado para editarlo o descomponerlo.</p>
                        </button>
                        <button onClick={handleStartBlank} className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-teal-400">
                            <FilePlusIcon className="w-10 h-10 text-teal-400" />
                            <h2 className="font-semibold text-gray-200">Empezar en Blanco</h2>
                            <p className="text-xs text-gray-500">Construye un prompt desde cero usando los módulos.</p>
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                            <ClipboardPasteIcon className="w-10 h-10 text-teal-400" />
                            <h2 className="font-semibold text-gray-200">Analizar Prompt de Texto</h2>
                            <p className="text-xs text-gray-500 max-w-md text-center">Pega un prompt existente y la IA lo descompondrá en los 9 módulos.</p>
                            <textarea
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                placeholder="Pega tu prompt de texto aquí..."
                                className="w-full mt-4 bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px]"
                            />
                            <button onClick={() => handleLoadPrompt(pastedText)} disabled={!pastedText.trim() || loadingAction !== null} className="w-full mt-2 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-lg transition-all duration-300">
                                {loadingAction === 'analyze' ? 'Analizando...' : 'Analizar y Modularizar'}
                            </button>
                        </div>
                         <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                            <JsonIcon className="w-10 h-10 text-purple-400" />
                            <h2 className="font-semibold text-gray-200">Importar Plantilla JSON</h2>
                            <p className="text-xs text-gray-500 max-w-md text-center">Pega un prompt JSON para guardarlo como una plantilla reutilizable en tu galería.</p>
                            <textarea
                                value={pastedJson}
                                onChange={(e) => setPastedJson(e.target.value)}
                                placeholder="Pega tu prompt JSON aquí..."
                                className="w-full mt-4 bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px]"
                            />
                            <button onClick={handleImportTemplate} disabled={!pastedJson.trim() || loadingAction !== null} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-lg transition-all duration-300">
                                {loadingAction === 'import' ? 'Analizando...' : 'Analizar y Guardar Plantilla'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center -mb-2">
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                    Editor Modular
                </h1>
                <button
                    onClick={handleGoBackToSelection}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 text-gray-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500"
                >
                    <UndoIcon className="w-5 h-5" />
                    <span>Volver</span>
                </button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(EXTRACTION_MODE_MAP).map(([key, config]) => (
                    <PromptModule
                        key={key}
                        mode={key as ExtractionMode}
                        config={config}
                        value={fragments[key as ExtractionMode] || ''}
                        onChange={handleFragmentChange}
                        onSavePrompt={onSavePrompt}
                        savedPrompts={savedPrompts}
                        onOpenGallery={handleOpenGalleryForModule}
                        onOptimize={handleOptimizeModule}
                        isOptimizing={optimizingModule === (key as ExtractionMode)}
                        suggestions={suggestions[key as ExtractionMode] || []}
                        addToast={addToast}
                    />
                ))}
            </div>
            <div className="glass-pane p-6 rounded-2xl space-y-4">
                <h2 className="text-xl font-bold text-white">Salida y Ensamblaje</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <button
                        onClick={handleGenerateText}
                        disabled={isLoading}
                        className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-teal-500/50 text-lg"
                    >
                        {isLoading && outputType === 'text' ? 'Generando...' : 'Generar Prompt de Texto'}
                    </button>
                    <button
                        onClick={handleGenerateJson}
                        disabled={isLoading}
                        className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/50 text-lg"
                    >
                        {isLoading && outputType === 'json' ? 'Generando...' : 'Generar como JSON'}
                    </button>
                </div>
                
                {error && <div className="text-center text-red-400 bg-red-500/10 p-3 rounded-lg"><p>{error}</p></div>}
                
                {isLoading && (outputType === 'text' || outputType === 'json') && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-4">
                        <Loader />
                        <p className="mt-4 text-gray-400">Ensamblando prompt...</p>
                    </div>
                )}

                {finalPrompt && !isLoading && (
                    <div className="space-y-4 animate-fade-slide-in-up">
                        <div className="relative">
                            <textarea
                                readOnly
                                value={finalPrompt}
                                className="w-full h-48 bg-gray-900/70 rounded-lg p-4 pr-12 text-gray-300 whitespace-pre-wrap font-mono text-sm resize-none ring-1 ring-white/10 custom-scrollbar"
                            />
                            <button onClick={handleCopy} className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Copiar prompt">
                               {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
                           </button>
                        </div>
                        <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 px-4 rounded-lg">
                            Guardar en Galería
                        </button>
                    </div>
                )}
            </div>
            {galleryModalFor && (
                <GalleryModal 
                    prompts={savedPrompts}
                    onSelect={handleSelectFromGalleryForModule}
                    onClose={() => setGalleryModalFor(null)}
                    filter={[galleryModalFor]}
                />
            )}
            {isTemplateSelectorOpen && (
                <GalleryModal
                    title="Seleccionar Plantilla JSON"
                    prompts={savedPrompts}
                    onSelect={handleSelectJsonTemplate}
                    onClose={() => setIsTemplateSelectorOpen(false)}
                    filter={['structured']}
                />
            )}
             {isJsonChoiceModalOpen && (
                <div
                className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-subtle"
                style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                onClick={() => setIsJsonChoiceModalOpen(false)}
                >
                <div
                    className="glass-pane rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in-center p-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Generar como JSON</h2>
                        <button
                            onClick={() => setIsJsonChoiceModalOpen(false)}
                            className="bg-transparent text-gray-500 hover:text-white rounded-full p-1 transition-colors"
                            aria-label="Cerrar"
                        >
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-gray-400 mb-6 text-sm">Elige cómo quieres crear tu prompt JSON.</p>
                    <div className="space-y-4">
                        <button
                            onClick={handleDirectJsonGeneration}
                            className="w-full text-center p-4 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-teal-400"
                        >
                            <h3 className="font-semibold text-gray-200">Generar JSON Directo</h3>
                            <p className="text-xs text-gray-500 mt-1">Crea un JSON simple a partir del contenido de los módulos activos.</p>
                        </button>
                        <button
                            onClick={handleTemplateJsonGeneration}
                            disabled={!savedPrompts.some(p => p.type === 'structured')}
                            className="w-full text-center p-4 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-purple-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:ring-white/10"
                        >
                            <h3 className="font-semibold text-gray-200">Usar Plantilla de la Galería</h3>
                            <p className="text-xs text-gray-500 mt-1">Fusiona los módulos en una plantilla JSON guardada para una estructura más compleja.</p>
                        </button>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
};