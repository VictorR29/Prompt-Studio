


import React, { useState, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { Loader } from './Loader';
import { 
    analyzeImageFeature,
    assembleMasterPrompt,
    generateMasterPromptMetadata,
} from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { ExtractionMode } from '../types';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { SavedPrompt } from '../types';
import { EXTRACTION_MODES } from '../config';

type ImageState = { url: string; base64: string; mimeType: string; };
type FragmentsState = Partial<Record<ExtractionMode, string>>;
type ImagesState = Partial<Record<ExtractionMode, ImageState[]>>;
type LoadingState = Partial<Record<ExtractionMode, boolean>>;

interface MasterAssemblerProps {
    onSaveMasterPrompt: (prompt: Omit<SavedPrompt, 'id'>) => void;
}

const AccordionItem: React.FC<{ title: string; children: React.ReactNode; isComplete: boolean; isLoading: boolean }> = ({ title, children, isComplete, isLoading }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="bg-gray-900/50 rounded-lg overflow-hidden ring-1 ring-white/10">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
                <div className="flex items-center space-x-3">
                    {isLoading ? <Loader /> : isComplete ? <CheckIcon className="w-5 h-5 text-green-400" /> : <div className="w-5 h-5 border-2 border-gray-500 rounded-full"></div>}
                    <h3 className="font-semibold text-teal-300">{title}</h3>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isOpen && <div className="p-4 border-t border-white/10">{children}</div>}
        </div>
    )
}


export const MasterAssembler: React.FC<MasterAssemblerProps> = ({ onSaveMasterPrompt }) => {
    const [images, setImages] = useState<ImagesState>({});
    const [fragments, setFragments] = useState<FragmentsState>({});
    const [loading, setLoading] = useState<LoadingState>({});
    const [masterPrompt, setMasterPrompt] = useState('');
    const [isAssembling, setIsAssembling] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);


    const handleImageUpload = useCallback(async (mode: ExtractionMode, files: File[]) => {
        const maxImages =
            mode === 'style' ? 5 :
            mode === 'subject' ? 3 :
            1;
        const currentImages = images[mode] || [];
        if (currentImages.length + files.length > maxImages) {
            return;
        }

        setLoading(prev => ({ ...prev, [mode]: true }));
        setError(null);
        try {
            const newImagesData = await Promise.all(
                Array.from(files).map(file => fileToBase64(file).then(data => ({ ...data, url: URL.createObjectURL(file) })))
            );

            const updatedImages = [...currentImages, ...newImagesData];
            setImages(prev => ({ ...prev, [mode]: updatedImages }));
            
            const imagePayload = updatedImages.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
            const result = await analyzeImageFeature(mode, imagePayload);
            setFragments(prev => ({ ...prev, [mode]: result }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            const modeTitle = EXTRACTION_MODES.find(m => m.id === mode)?.label || mode;
            setError(`Error en ${modeTitle}: ${errorMessage}`);
        } finally {
            setLoading(prev => ({ ...prev, [mode]: false }));
        }
    }, [images]);

    const handleImageRemove = useCallback((mode: ExtractionMode, indexToRemove: number) => {
        const updatedImages = (images[mode] || []).filter((_, index) => index !== indexToRemove);

        setImages(prev => ({ ...prev, [mode]: updatedImages }));

        if (updatedImages.length === 0) {
            setFragments(prev => {
                const newFragments = { ...prev };
                delete newFragments[mode];
                return newFragments;
            });
            return;
        }
        
        setLoading(prev => ({ ...prev, [mode]: true }));
        (async () => {
             try {
                const imagePayload = updatedImages.map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
                const result = await analyzeImageFeature(mode, imagePayload);
                setFragments(prev => ({ ...prev, [mode]: result }));
                setError(null);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
                setError(`Error en re-extracción: ${errorMessage}`);
            } finally {
                setLoading(prev => ({ ...prev, [mode]: false }));
            }
        })();
    }, [images]);


    const handleAssemble = async () => {
        setIsAssembling(true);
        setError(null);
        setMasterPrompt('');
        try {
            const result = await assembleMasterPrompt(fragments);
            setMasterPrompt(result);
        } catch (err) {
             const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al ensamblar: ${errorMessage}`);
        } finally {
            setIsAssembling(false);
        }
    };
    
    const handleSave = async () => {
        if (!masterPrompt) return;
        setIsSaving(true);
        setError(null);
        try {
            const imagePayloads = Object.values(images)
                .flat()
                .filter((img): img is ImageState => Boolean(img))
                .map(img => ({ imageBase64: img.base64, mimeType: img.mimeType }));
            
            const priorityOrderForCover: ExtractionMode[] = ['subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'color', 'style', 'composition'];
            let coverImageState: ImageState | undefined = undefined;
            for (const mode of priorityOrderForCover) {
                if (images[mode] && images[mode]!.length > 0) {
                    coverImageState = images[mode]![0];
                    break;
                }
            }

            const metadata = await generateMasterPromptMetadata(masterPrompt, imagePayloads);
            
            onSaveMasterPrompt({
                type: 'master',
                prompt: masterPrompt,
                coverImage: coverImageState ? `data:${coverImageState.mimeType};base64,${coverImageState.base64}` : '',
                ...metadata,
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al guardar: ${errorMessage}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCopy = () => {
        if (masterPrompt) {
            navigator.clipboard.writeText(masterPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const isAssembleDisabled = Object.keys(fragments).length === 0 || isAssembling;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col space-y-4 glass-pane p-6 rounded-2xl">
                <h2 className="text-2xl font-bold text-white">Ensamblador Maestro</h2>
                <p className="text-gray-400">Sube imágenes para cada aspecto. La IA los analizará y podrás combinarlos en un prompt maestro.</p>
                <div className="space-y-3 overflow-y-auto max-h-[32rem] pr-2 -mr-4 custom-scrollbar">
                    {EXTRACTION_MODES.map(({ id, label, description }) => {
                        const maxImages =
                            id === 'style' ? 5 :
                            id === 'subject' ? 3 :
                            1;
                        return (
                           <AccordionItem key={id} title={label} isComplete={!!fragments[id]} isLoading={!!loading[id]}>
                                <p className="text-sm text-gray-400 mb-4">{description}</p>
                                <ImageUploader
                                    onImagesUpload={(files) => handleImageUpload(id, files)}
                                    onImageRemove={(index) => handleImageRemove(id, index)}
                                    images={images[id] || []}
                                    maxImages={maxImages}
                                    isLoading={!!loading[id]}
                                />
                           </AccordionItem>
                        );
                    })}
                </div>
            </div>
            <div className="glass-pane rounded-2xl p-6 shadow-2xl flex flex-col">
                 <button
                    onClick={handleAssemble}
                    disabled={isAssembleDisabled}
                    className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 text-lg"
                >
                    {isAssembling ? 'Ensamblando...' : `Ensamblar ${Object.keys(fragments).length} Fragmento(s)`}
                </button>
                <div className="mt-6 flex-grow flex flex-col items-center justify-center">
                {isAssembling ? (
                     <div className="flex flex-col items-center justify-center h-full text-center">
                        <Loader />
                        <p className="mt-4 text-lg text-gray-400">Creando prompt maestro...</p>
                    </div>
                ) : error ? (
                    <div className="text-center text-red-400 bg-red-500/10 p-4 rounded-lg"><p>{error}</p></div>
                ) : masterPrompt ? (
                    <div className="w-full flex flex-col h-full space-y-4 animate-fade-slide-in-up">
                         <h2 className="text-xl font-bold text-gray-200">Prompt Maestro Generado:</h2>
                         <div className="relative flex-grow">
                             <textarea
                                 readOnly
                                 value={masterPrompt}
                                 className="w-full h-full bg-gray-900/70 rounded-lg p-4 pr-12 text-gray-300 whitespace-pre-wrap font-mono text-sm resize-none ring-1 ring-white/10 custom-scrollbar"
                             />
                             <button onClick={handleCopy} className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Copiar prompt">
                                {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
                            </button>
                         </div>
                         <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-500/20 text-white font-bold py-2.5 px-4 rounded-lg">
                            {isSaving ? 'Guardando...' : 'Guardar en Galería'}
                        </button>
                    </div>
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-center">
                        <svg className="w-16 h-16 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 16v-2m0-8v-2m0 4h.01M6 12H4m16 0h-2m-8 0h.01M12 18h.01M18 12h.01M6 6.01h.01M18 18.01h.01M6 18.01h.01M18 6.01h.01" /></svg>
                        <h2 className="mt-4 text-xl font-semibold text-gray-500">Esperando fragmentos</h2>
                        <p className="mt-1 text-gray-600">El prompt maestro aparecerá aquí.</p>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
};