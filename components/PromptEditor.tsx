
import React, { useState, useEffect, useCallback } from 'react';
import { SavedPrompt, ExtractionMode, AppView } from '../types';
import { 
    modularizePrompt, 
    assembleMasterPrompt, 
    optimizePromptFragment, 
    mergeModulesIntoJsonTemplate, 
    createJsonTemplate, 
    generateStructuredPromptMetadata, 
    adaptFragmentToContext, 
    analyzeImageFeature,
    generateStructuredPrompt,
    generateStructuredPromptFromImage,
    generateMasterPromptMetadata,
    generateImageFromPrompt
} from '../services/geminiService';
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
import { CloseIcon } from './icons/CloseIcon';
import { fileToBase64 } from '../utils/fileUtils';
import { createImageCollage } from '../utils/imageUtils';
import { ImageUploader } from './ImageUploader';
import { SparklesIcon } from './icons/SparklesIcon';
import { CollapsibleSection } from './CollapsibleSection';
import { EyeIcon } from './icons/EyeIcon';
import { ImagePreviewModal } from './ImagePreviewModal';
import { BookmarkIcon } from './icons/BookmarkIcon';


type ImageState = { url: string; base64: string; mimeType: string; };

interface PromptEditorProps {
    initialPrompt: SavedPrompt | null;
    onSavePrompt: (prompt: SavedPrompt) => void;
    savedPrompts: SavedPrompt[];
    setView: (view: AppView) => void;
    onNavigateToGallery: () => void;
    addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
    setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

const initialFragments: Partial<Record<ExtractionMode, string>> = {
    subject: '', pose: '', expression: '', outfit: '', object: '',
    scene: '', color: '', composition: '', style: ''
};

export const PromptEditor: React.FC<PromptEditorProps> = ({ initialPrompt, onSavePrompt, savedPrompts, setView, onNavigateToGallery, addToast, setGlobalLoader }) => {
    const [viewMode, setViewMode] = useState<'selection' | 'editor'>('selection');
    const [fragments, setFragments] = useState<Partial<Record<ExtractionMode, string>>>(initialFragments);
    const [imagesByModule, setImagesByModule] = useState<Partial<Record<ExtractionMode, ImageState[]>>>({});
    const [pastedText, setPastedText] = useState('');
    const [pastedJson, setPastedJson] = useState('');
    const [pastedExternalPrompt, setPastedExternalPrompt] = useState('');
    const [loadingAction, setLoadingAction] = useState<'analyze' | 'import' | 'structure' | 'save-external' | null>(null);
    const [isLoading, setIsLoading] = useState(false); // For editor-mode actions
    const [isSaving, setIsSaving] = useState(false);
    const [loadingModules, setLoadingModules] = useState<Partial<Record<ExtractionMode, boolean>>>({});
    const [error, setError] = useState<string | null>(null);
    const [finalPrompt, setFinalPrompt] = useState('');
    const [outputType, setOutputType] = useState<'text' | 'json' | null>(null);
    const [copied, setCopied] = useState(false);
    const [galleryModalFor, setGalleryModalFor] = useState<ExtractionMode | null>(null);
    const [optimizingModule, setOptimizingModule] = useState<ExtractionMode | null>(null);
    const [suggestions, setSuggestions] = useState<Partial<Record<ExtractionMode, string[]>>>({});
    const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
    const [isJsonChoiceModalOpen, setIsJsonChoiceModalOpen] = useState(false);
    const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
        character: true,
        aesthetic: true,
    });
    const [showPreview, setShowPreview] = useState(false);

    // State for the new "Generate Structure" section
    const [structurerIdea, setStructurerIdea] = useState('');
    const [structurerStyle, setStructurerStyle] = useState('');
    const [structurerImages, setStructurerImages] = useState<ImageState[]>([]);

    useEffect(() => {
        try {
            const savedState = localStorage.getItem('promptEditorSections');
            if (savedState) {
                setOpenSections(JSON.parse(savedState));
            }
        } catch (error) {
            console.error("Failed to load section state from localStorage", error);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('promptEditorSections', JSON.stringify(openSections));
    }, [openSections]);
    
    const handleLoadPromptFromUI = useCallback(async (promptText: string) => {
        setLoadingAction('analyze');
        setError(null);
        setGlobalLoader({ active: true, message: 'Analizando y modularizando prompt...' });
        try {
            const modularized = await modularizePrompt(promptText) as Record<ExtractionMode, string>;
            setFragments(modularized);
            setViewMode('editor');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al modularizar: ${errorMessage}`);
            addToast(`Error al modularizar: ${errorMessage}`, 'error');
        } finally {
            setLoadingAction(null);
            setGlobalLoader({ active: false, message: '' });
        }
    }, [setGlobalLoader, addToast]);
    
    useEffect(() => {
        // This effect specifically handles loading an `initialPrompt` prop,
        // including cleanup for when the component unmounts mid-load.
        let isMounted = true;

        const loadInitialPrompt = async (promptText: string) => {
            setLoadingAction('analyze');
            setError(null);
            setGlobalLoader({ active: true, message: 'Analizando y modularizando prompt...' });
            try {
                const modularized = await modularizePrompt(promptText);
                if (isMounted) {
                    setFragments(modularized as Record<ExtractionMode, string>);
                    setViewMode('editor');
                }
            } catch (err) {
                if (isMounted) {
                    const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
                    setError(`Error al modularizar: ${errorMessage}`);
                    addToast(`Error al modularizar: ${errorMessage}`, 'error');
                }
            } finally {
                if (isMounted) {
                    setLoadingAction(null);
                    setGlobalLoader({ active: false, message: '' });
                }
            }
        };

        if (initialPrompt) {
            loadInitialPrompt(initialPrompt.prompt);
        }

        return () => {
            isMounted = false;
        };
    }, [initialPrompt, addToast, setGlobalLoader]);
    
    const handleImportTemplate = async () => {
        if (!pastedJson.trim()) return;

        setLoadingAction('import');
        setError(null);
        setGlobalLoader({ active: true, message: 'Creando plantilla desde JSON...' });
        try {
            const templateJson = String(await createJsonTemplate(pastedJson));

            let coverImageDataUrl = '';
            try {
                setGlobalLoader({ active: true, message: 'Generando portada para la plantilla...' });
                coverImageDataUrl = await generateImageFromPrompt(templateJson);
            } catch (imgErr) {
                console.error("Error generating cover image for template:", imgErr);
                addToast('No se pudo generar la portada para la plantilla. Guardando sin ella.', 'error');
                coverImageDataUrl = ''; // Fallback to no cover
            }
            
            setGlobalLoader({ active: true, message: 'Generando metadatos para la plantilla...' });
            const imagePayload = coverImageDataUrl ? {
                imageBase64: coverImageDataUrl.split(',')[1],
                mimeType: 'image/jpeg'
            } : undefined;

            const metadata = await generateStructuredPromptMetadata(templateJson, imagePayload) as Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>;

            const newTemplatePrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: 'structured',
                prompt: templateJson,
                coverImage: coverImageDataUrl,
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
            addToast(`Error al importar plantilla: ${errorMessage}`, 'error');
        } finally {
            setLoadingAction(null);
            setGlobalLoader({ active: false, message: '' });
        }
    };

    const handleSaveExternalPrompt = async () => {
        if (!pastedExternalPrompt.trim()) return;

        setLoadingAction('save-external');
        setError(null);
        setGlobalLoader({ active: true, message: 'Procesando prompt externo...' });
        
        try {
            let coverImageDataUrl = '';
            try {
                setGlobalLoader({ active: true, message: 'Generando portada con IA...' });
                coverImageDataUrl = await generateImageFromPrompt(pastedExternalPrompt);
            } catch (imgErr) {
                 console.error("Error generating cover image:", imgErr);
            }

            setGlobalLoader({ active: true, message: 'Generando metadatos...' });
            // Generate metadata based on the text prompt
            const metadata = await generateMasterPromptMetadata(pastedExternalPrompt, []);

            const newPrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: 'master', // Treat as a master prompt so it can be modularized later
                prompt: pastedExternalPrompt,
                coverImage: coverImageDataUrl,
                title: metadata.title,
                category: metadata.category,
                artType: metadata.artType,
                notes: metadata.notes,
            };

            onSavePrompt(newPrompt);
            addToast(`Prompt "${metadata.title}" guardado en galería!`, 'success');
            setPastedExternalPrompt('');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al guardar prompt externo: ${errorMessage}`);
            addToast(`Error: ${errorMessage}`, 'error');
        } finally {
            setLoadingAction(null);
            setGlobalLoader({ active: false, message: '' });
        }
    };
    
    const handleGenerateStructure = async () => {
        setLoadingAction('structure');
        setError(null);
        setGlobalLoader({ active: true, message: 'Generando prompt estructurado...' });

        try {
            let resultJson: string;
            if (structurerImages.length > 0) {
                 const imagePayloads = structurerImages.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
                 resultJson = await generateStructuredPromptFromImage(imagePayloads, structurerStyle || structurerIdea);
            } else {
                if (!structurerIdea.trim()) {
                    throw new Error('La idea principal es necesaria.');
                }
                resultJson = await generateStructuredPrompt({ idea: structurerIdea, style: structurerStyle });
            }
            
            setGlobalLoader({ active: true, message: 'Estructura creada. Modularizando...' });
            await handleLoadPromptFromUI(resultJson);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al generar estructura: ${errorMessage}`);
            addToast(`Error al generar estructura: ${errorMessage}`, 'error');
            setGlobalLoader({ active: false, message: '' });
        } finally {
            setLoadingAction(null);
            // setGlobalLoader is handled by handleLoadPrompt on success
        }
    };

    const handleStartBlank = () => {
        setFragments(initialFragments);
        setImagesByModule({});
        setFinalPrompt('');
        setError(null);
        setViewMode('editor');
    };

    const handleGoBackToSelection = () => {
        setFragments(initialFragments);
        setImagesByModule({});
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

    const handleClearSuggestions = useCallback((mode: ExtractionMode) => {
        setSuggestions(prev => ({ ...prev, [mode]: [] }));
    }, []);

    const analyzeImagesForModule = useCallback(async (mode: ExtractionMode, images: ImageState[]) => {
        setLoadingModules(prev => ({ ...prev, [mode]: true }));
        try {
            const imagePayload = images.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
            const { result, warning } = await analyzeImageFeature(mode, imagePayload);
            handleFragmentChange(mode, result);
            if (warning) {
                addToast(warning, 'warning');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            addToast(`Error al analizar imagen para '${EXTRACTION_MODE_MAP[mode].label}': ${errorMessage}`, 'error');
        } finally {
            setLoadingModules(prev => ({ ...prev, [mode]: false }));
        }
    }, [addToast]);

    const handleImageUploadForModule = useCallback(async (mode: ExtractionMode, files: File[]) => {
        const config = EXTRACTION_MODE_MAP[mode];
        const maxImages = config.id === 'style' ? 5 : config.id === 'subject' ? 3 : 1;
        const currentImages = imagesByModule[mode] || [];
        
        if (currentImages.length + files.length > maxImages) {
            addToast(`Máximo ${maxImages} imágenes para ${config.label}.`, 'error');
            return;
        }

        try {
            const newImagesData = await Promise.all(
                Array.from(files).map(file => fileToBase64(file).then(data => ({ ...data, url: URL.createObjectURL(file) })))
            );
            
            const allImages = [...currentImages, ...newImagesData];
            setImagesByModule(prev => ({ ...prev, [mode]: allImages }));
            await analyzeImagesForModule(mode, allImages);

        } catch (err) {
            addToast('Error al procesar imágenes.', 'error');
        }
    }, [imagesByModule, analyzeImagesForModule, addToast]);
    
    const handleImageRemoveForModule = useCallback(async (mode: ExtractionMode, indexToRemove: number) => {
        const currentImages = imagesByModule[mode] || [];
        const updatedImages = currentImages.filter((_, index) => index !== indexToRemove);
        setImagesByModule(prev => ({ ...prev, [mode]: updatedImages }));

        if (updatedImages.length > 0) {
            await analyzeImagesForModule(mode, updatedImages);
        } else {
            handleFragmentChange(mode, '');
        }
    }, [imagesByModule, analyzeImagesForModule]);
    
    const handleOpenGalleryForModule = (mode: ExtractionMode) => {
        setGalleryModalFor(mode);
    };

    const handleSelectFromGalleryForModule = async (selectedPrompts: SavedPrompt | SavedPrompt[]) => {
        const targetModule = galleryModalFor;
        if (targetModule) {
            setGalleryModalFor(null);

            if (targetModule === 'subject') {
                const promptsToProcess = Array.isArray(selectedPrompts) ? selectedPrompts : [selectedPrompts];
                if (promptsToProcess.length === 0) return;

                const existingSubjects = fragments.subject
                    ? fragments.subject.split('\n').filter(s => s.trim().startsWith('Subject ')).map(s => s.replace(/Subject \d+:\s*/, '').trim())
                    : (fragments.subject ? [fragments.subject.trim()] : []);
                
                const newSubjects = promptsToProcess.map(p => p.prompt);
                const combinedSubjects = [...existingSubjects, ...newSubjects].slice(0, 3);
    
                let finalSubjectString: string;
                if (combinedSubjects.length > 1) {
                    finalSubjectString = combinedSubjects.map((s, i) => `Subject ${i + 1}: ${s}`).join('\n');
                } else {
                    finalSubjectString = combinedSubjects[0] || '';
                }
                handleFragmentChange('subject', finalSubjectString);
                addToast(`${promptsToProcess.length} sujeto(s) añadido(s).`, 'success');
            } else {
                // Handle single select for other modules
                const selectedPrompt = Array.isArray(selectedPrompts) ? selectedPrompts[0] : selectedPrompts as SavedPrompt;
                 if (!selectedPrompt) return;

                setOptimizingModule(targetModule);
                setGlobalLoader({ active: true, message: 'Adaptando fragmento al contexto...' });
                try {
                    const adaptedFragment = String(await adaptFragmentToContext(targetModule, selectedPrompt.prompt, fragments));
                    handleFragmentChange(targetModule, adaptedFragment);
                    addToast(`Fragmento adaptado e insertado en '${EXTRACTION_MODE_MAP[targetModule].label}'`, 'success');
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
                    addToast(`Error al adaptar: ${errorMessage}`, 'error');
                    // Fallback to direct insertion on error
                    handleFragmentChange(targetModule, selectedPrompt.prompt);
                } finally {
                    setOptimizingModule(null);
                    setGlobalLoader({ active: false, message: '' });
                }
            }
        }
    };

    const handleOptimizeModule = async (mode: ExtractionMode) => {
        const fragmentValue = fragments[mode];
        if (!fragmentValue || !fragmentValue.trim()) return;

        setOptimizingModule(mode);
        setSuggestions(prev => ({ ...prev, [mode]: [] }));
        setError(null);
        setGlobalLoader({ active: true, message: `Optimizando '${EXTRACTION_MODE_MAP[mode].label}' con IA...` });
        try {
            const newSuggestions = await optimizePromptFragment(mode, fragments) as string[];
            setSuggestions(prev => ({ ...prev, [mode]: newSuggestions }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al optimizar: ${errorMessage}`);
        } finally {
            setOptimizingModule(null);
            setGlobalLoader({ active: false, message: '' });
        }
    };

    const handleGenerateText = async () => {
        setIsLoading(true);
        setOutputType('text');
        setError(null);
        setFinalPrompt('');
        setGlobalLoader({ active: true, message: 'Ensamblando prompt de texto...' });
        try {
            const result = String(await assembleMasterPrompt(fragments));
            setFinalPrompt(result);
        } catch (err) {
            setOutputType(null);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al ensamblar: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setGlobalLoader({ active: false, message: '' });
        }
    };
    
    const handleGenerateJson = () => {
        // FIX: Separated type check from method call to avoid potential TS inference issues where 'v' is 'unknown'.
        const activeFragments = Object.values(fragments).some(v => {
            if (typeof v === 'string') {
                return v.trim() !== '';
            }
            return false;
        });
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
            // FIX: Separated type check from method call to avoid potential TS inference issues.
            if (typeof value === 'string') {
                if (value.trim() !== '') {
                    acc[key as ExtractionMode] = value;
                }
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
        setGlobalLoader({ active: true, message: 'Fusionando módulos com plantilla JSON...' });
        
        const activeFragments = Object.entries(fragments).reduce((acc, [key, value]) => {
            if (typeof value === 'string' && value.trim() !== '') {
                acc[key as ExtractionMode] = value;
            }
            return acc;
        }, {} as Partial<Record<ExtractionMode, string>>);

        try {
            const result = String(await mergeModulesIntoJsonTemplate(activeFragments, template.prompt));
            setFinalPrompt(result);
        } catch (err) {
            setOutputType(null);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al fusionar con plantilla: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setGlobalLoader({ active: false, message: '' });
        }
    };

    const handleSave = async () => {
        if (!finalPrompt) return;
    
        setIsSaving(true);
        setGlobalLoader({ active: true, message: 'Guardando en galería...' });
    
        try {
            let coverImageDataUrl = '';
            let coverGenerationFailed = false;
    
            // --- Cover Image Generation Logic ---
            if (outputType === 'text') {
                const allImages: ImageState[] = Object.values(imagesByModule).reduce<ImageState[]>((acc, val) => (Array.isArray(val) ? acc.concat(val) : acc), []);
                if (allImages.length > 0) {
                    setGlobalLoader({ active: true, message: 'Creando collage para la portada...' });
                    coverImageDataUrl = await createImageCollage(allImages.map(img => ({ base64: img.base64, mimeType: img.mimeType })));
                } else {
                    try {
                        setGlobalLoader({ active: true, message: 'Generando portada con IA...' });
                        coverImageDataUrl = await generateImageFromPrompt(finalPrompt);
                    } catch (imgErr) {
                        coverGenerationFailed = true;
                        console.error("Error generating cover image:", imgErr);
                    }
                }
            } else if (outputType === 'json') {
                try {
                    setGlobalLoader({ active: true, message: 'Generando portada con IA...' });
                    coverImageDataUrl = await generateImageFromPrompt(finalPrompt);
                } catch (imgErr) {
                    coverGenerationFailed = true;
                    console.error("Error generating cover image:", imgErr);
                }
            }
    
            // --- Metadata and Saving Logic ---
            setGlobalLoader({ active: true, message: 'Generando metadatos con IA...' });
    
            if (outputType === 'text') {
                const allImages: ImageState[] = Object.values(imagesByModule).reduce<ImageState[]>((acc, val) => (Array.isArray(val) ? acc.concat(val) : acc), []);
                const imagePayload = allImages.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
                const metadata = await generateMasterPromptMetadata(finalPrompt, imagePayload);
    
                const newPrompt: SavedPrompt = {
                    id: Date.now().toString(),
                    type: 'master',
                    prompt: finalPrompt,
                    coverImage: coverImageDataUrl,
                    ...metadata,
                };
                onSavePrompt(newPrompt);
            } else if (outputType === 'json') {
                const imagePayload = coverImageDataUrl ? {
                    imageBase64: coverImageDataUrl.split(',')[1],
                    mimeType: 'image/jpeg'
                } : undefined;

                const metadata = await generateStructuredPromptMetadata(finalPrompt, imagePayload);
                const newPrompt: SavedPrompt = {
                    id: Date.now().toString(),
                    type: 'structured',
                    prompt: finalPrompt,
                    coverImage: coverImageDataUrl,
                    ...metadata
                };
                onSavePrompt(newPrompt);
            }
            
            if (coverGenerationFailed) {
                 addToast('Prompt guardado sin portada. La generación de portadas con IA podría requerir una API Key con facturación activada.', 'success');
            } else {
                 addToast('Prompt guardado en la galería con su portada.', 'success');
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            addToast(`Error al guardar: ${errorMessage}`, 'error');
            console.error("Error saving prompt:", err);
        } finally {
            setIsSaving(false);
            setGlobalLoader({ active: false, message: '' });
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
            <div className="glass-pane p-6 md:p-8 rounded-2xl max-w-5xl mx-auto animate-fade-slide-in-up">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                        Editor Hub
                    </h1>
                    <p className="mt-2 text-gray-400">Elige cómo quieres empezar a construir tu próximo gran prompt.</p>
                </div>

                {error && <div className="my-4 text-center text-red-400 bg-red-500/10 p-3 rounded-lg"><p>{error}</p></div>}
                
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <button onClick={handleStartBlank} data-tour-id="editor-start-blank" className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-teal-400">
                            <FilePlusIcon className="w-10 h-10 text-teal-400" />
                            <h2 className="font-semibold text-gray-200">Empezar en Blanco</h2>
                            <p className="text-xs text-gray-500">Construye un prompt desde cero usando los módulos.</p>
                        </button>
                        <button onClick={onNavigateToGallery} data-tour-id="editor-load-gallery" className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-teal-400">
                            <GalleryIcon className="w-10 h-10 text-teal-400" />
                            <h2 className="font-semibold text-gray-200">Cargar desde Galería</h2>
                            <p className="text-xs text-gray-500">Carga un prompt guardado para editarlo o descomponerlo.</p>
                        </button>
                         <button onClick={() => {
                            const element = document.getElementById('paste-text-section');
                            element?.scrollIntoView({ behavior: 'smooth' });
                         }} className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-teal-400">
                            <ClipboardPasteIcon className="w-10 h-10 text-teal-400" />
                            <h2 className="font-semibold text-gray-200">Analizar Texto</h2>
                            <p className="text-xs text-gray-500">Pega un prompt y la IA lo descompondrá en módulos.</p>
                        </button>
                    </div>

                    <div id="structure-section" data-tour-id="editor-generate-ai" className="flex flex-col items-center justify-center p-6 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                        <SparklesIcon className="w-10 h-10 text-purple-400 mb-3" />
                        <h2 className="font-semibold text-gray-200 text-lg">Generar Estructura con IA</h2>
                        <p className="text-xs text-gray-500 max-w-2xl text-center mb-6">Describe una idea, añade un estilo y/o una imagen de referencia, y la IA generará una base modular completa para que la edites.</p>
                        
                        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="flex flex-col space-y-4">
                                <textarea
                                    value={structurerIdea}
                                    onChange={(e) => setStructurerIdea(e.target.value)}
                                    placeholder="Idea Principal (ej: un astronauta explorando un planeta alienígena)..."
                                    className="w-full flex-grow bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px] resize-none"
                                />
                                 <textarea
                                    value={structurerStyle}
                                    onChange={(e) => setStructurerStyle(e.target.value)}
                                    placeholder="Estilo (Opcional, ej: cinematic, oil painting)..."
                                    className="w-full flex-grow bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px] resize-none"
                                />
                           </div>
                           <div className="h-full">
                             <ImageUploader onImagesUpload={(files) => {
                                fileToBase64(files[0]).then(imgData => setStructurerImages([{...imgData, url: URL.createObjectURL(files[0])}]));
                             }} onImageRemove={() => setStructurerImages([])} images={structurerImages} maxImages={1} />
                           </div>
                        </div>

                        <button onClick={handleGenerateStructure} disabled={(!structurerIdea.trim() && structurerImages.length === 0) || loadingAction !== null} className="w-full max-w-xs mt-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-lg transition-all duration-300">
                            {loadingAction === 'structure' ? 'Generando...' : 'Generar y Modularizar'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div id="paste-text-section" data-tour-id="editor-paste-text" className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                            <h2 className="font-semibold text-gray-200">Analizar Prompt de Texto</h2>
                            <textarea
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                placeholder="Pega tu prompt de texto aquí..."
                                className="w-full mt-2 bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px]"
                            />
                            <button onClick={() => handleLoadPromptFromUI(pastedText)} disabled={!pastedText.trim() || loadingAction !== null} className="w-full mt-2 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-lg transition-all duration-300">
                                {loadingAction === 'analyze' ? 'Analizando...' : 'Analizar y Modularizar'}
                            </button>
                        </div>
                        <div data-tour-id="editor-import-json" className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                            <h2 className="font-semibold text-gray-200">Importar Plantilla JSON</h2>
                            <textarea
                                value={pastedJson}
                                onChange={(e) => setPastedJson(e.target.value)}
                                placeholder="Pega tu prompt JSON aquí..."
                                className="w-full mt-2 bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px]"
                            />
                            <button onClick={handleImportTemplate} disabled={!pastedJson.trim() || loadingAction !== null} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-lg transition-all duration-300">
                                {loadingAction === 'import' ? 'Analizando...' : 'Guardar como Plantilla'}
                            </button>
                        </div>
                        <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                            <div className="flex items-center gap-2">
                                <BookmarkIcon className="w-5 h-5 text-indigo-400" />
                                <h2 className="font-semibold text-gray-200">Guardar Prompt Externo</h2>
                            </div>
                            <textarea
                                value={pastedExternalPrompt}
                                onChange={(e) => setPastedExternalPrompt(e.target.value)}
                                placeholder="Pega un prompt para guardarlo en la galería..."
                                className="w-full mt-2 bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px]"
                            />
                            <button onClick={handleSaveExternalPrompt} disabled={!pastedExternalPrompt.trim() || loadingAction !== null} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-lg transition-all duration-300">
                                {loadingAction === 'save-external' ? 'Guardando...' : 'Guardar en Galería'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    const characterModules: ExtractionMode[] = ['subject', 'pose', 'expression', 'outfit', 'object'];
    const aestheticModules: ExtractionMode[] = ['style', 'scene', 'color', 'composition'];

    return (
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Left Panel (Modules) */}
            <div className="lg:col-span-7 space-y-6">
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
                
                <CollapsibleSection
                    title="Personaje / Sujeto"
                    isOpen={!!openSections.character}
                    onToggle={() => setOpenSections(prev => ({ ...prev, character: !prev.character }))}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-tour-id="editor-modules-grid">
                        {characterModules.map((key) => {
                            const config = EXTRACTION_MODE_MAP[key];
                            return (
                                <PromptModule
                                    key={key}
                                    mode={key}
                                    config={config}
                                    value={fragments[key] || ''}
                                    images={imagesByModule[key] || []}
                                    onChange={handleFragmentChange}
                                    onImageUpload={handleImageUploadForModule}
                                    onImageRemove={handleImageRemoveForModule}
                                    onSavePrompt={onSavePrompt}
                                    savedPrompts={savedPrompts}
                                    onOpenGallery={handleOpenGalleryForModule}
                                    onOptimize={handleOptimizeModule}
                                    onClearSuggestions={handleClearSuggestions}
                                    isAnalyzingImages={loadingModules[key] || false}
                                    isOptimizing={optimizingModule === key}
                                    suggestions={suggestions[key] || []}
                                    addToast={addToast}
                                    setGlobalLoader={setGlobalLoader}
                                />
                            );
                        })}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                    title="Estética / Composición"
                    isOpen={!!openSections.aesthetic}
                    onToggle={() => setOpenSections(prev => ({ ...prev, aesthetic: !prev.aesthetic }))}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {aestheticModules.map((key) => {
                            const config = EXTRACTION_MODE_MAP[key];
                            return (
                                <PromptModule
                                    key={key}
                                    mode={key}
                                    config={config}
                                    value={fragments[key] || ''}
                                    images={imagesByModule[key] || []}
                                    onChange={handleFragmentChange}
                                    onImageUpload={handleImageUploadForModule}
                                    onImageRemove={handleImageRemoveForModule}
                                    onSavePrompt={onSavePrompt}
                                    savedPrompts={savedPrompts}
                                    onOpenGallery={handleOpenGalleryForModule}
                                    onOptimize={handleOptimizeModule}
                                    onClearSuggestions={handleClearSuggestions}
                                    isAnalyzingImages={loadingModules[key] || false}
                                    isOptimizing={optimizingModule === key}
                                    suggestions={suggestions[key] || []}
                                    addToast={addToast}
                                    setGlobalLoader={setGlobalLoader}
                                />
                            );
                        })}
                    </div>
                </CollapsibleSection>
            </div>

            {/* Right Panel (Output) */}
            <div className="mt-6 lg:mt-0 lg:col-span-5">
                <div className="lg:sticky lg:top-[90px]">
                    <div className="glass-pane p-6 rounded-2xl space-y-4" data-tour-id="editor-output-section">
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
                                     <div className="absolute top-2 right-2 flex space-x-1">
                                        <button onClick={() => setShowPreview(true)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Vista Previa">
                                            <EyeIcon className="w-5 h-5 text-indigo-400" />
                                        </button>
                                        <button onClick={handleCopy} className="p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Copiar prompt">
                                            {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
                                        </button>
                                    </div>
                                </div>
                                <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg">
                                    {isSaving ? 'Guardando...' : 'Guardar en Galería'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals are kept at the end to ensure they are on top of the layout */}
            {galleryModalFor && (
                <GalleryModal 
                    prompts={savedPrompts}
                    onSelect={handleSelectFromGalleryForModule}
                    onClose={() => setGalleryModalFor(null)}
                    filter={galleryModalFor === 'subject' ? ['subject'] : [galleryModalFor]}
                    multiSelect={galleryModalFor === 'subject'}
                    maxSelection={3}
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
             {showPreview && (
                <ImagePreviewModal 
                    prompt={finalPrompt} 
                    onClose={() => setShowPreview(false)} 
                />
            )}
        </div>
    );
};
