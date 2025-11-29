
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExtractionMode, SavedPrompt, AssistantResponse } from '../types';
import { getCreativeAssistantResponse, modularizePrompt, assembleMasterPrompt, generateMasterPromptMetadata, generateImageFromPrompt } from '../services/geminiService';
import { EXTRACTION_MODE_MAP } from '../config';
import { SparklesIcon } from './icons/SparklesIcon';
import { Loader } from './Loader';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { GalleryIcon } from './icons/GalleryIcon';
import { FilePlusIcon } from './icons/FilePlusIcon';
import { GalleryModal } from './GalleryModal';
import { EyeIcon } from './icons/EyeIcon';
import { ImagePreviewModal } from './ImagePreviewModal';
import { SaveIcon } from './icons/SaveIcon';
import { CloseIcon } from './icons/CloseIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { SimpleMarkdown } from './SimpleMarkdown';

const UserIcon: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-teal-600/80 flex items-center justify-center font-bold text-white flex-shrink-0 ring-2 ring-white/10">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
        </svg>
    </div>
);

const AssistantIcon: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-indigo-600/80 flex items-center justify-center flex-shrink-0 ring-2 ring-white/10">
        <SparklesIcon className="w-5 h-5 text-white" />
    </div>
);

const SmallLoader: React.FC = () => (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface PlaygroundProps {
    initialPrompt: SavedPrompt | null;
    savedPrompts: SavedPrompt[];
    onSavePrompt: (prompt: SavedPrompt) => void;
    addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
    setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

const initialFragments: Partial<Record<ExtractionMode, string>> = {
    subject: '', pose: '', expression: '', outfit: '', object: '',
    scene: '', color: '', composition: '', style: ''
};

// Fallback map to handle common AI hallucinations (Spanish keys or capitalization)
const MODULE_FALLBACK_MAP: Record<string, ExtractionMode> = {
    'estilo': 'style',
    'sujeto': 'subject',
    'personaje': 'subject',
    'pose': 'pose',
    'postura': 'pose',
    'expresion': 'expression',
    'expresión': 'expression',
    'escena': 'scene',
    'entorno': 'scene',
    'fondo': 'scene',
    'vestimenta': 'outfit',
    'ropa': 'outfit',
    'outfit': 'outfit',
    'objeto': 'object',
    'props': 'object',
    'color': 'color',
    'colores': 'color',
    'composicion': 'composition',
    'composición': 'composition',
    'negativo': 'negative',
    'negative': 'negative'
};

export const Playground: React.FC<PlaygroundProps> = ({ initialPrompt, savedPrompts, onSavePrompt, addToast, setGlobalLoader }) => {
    const [viewState, setViewState] = useState<'setup' | 'chat'>('setup');
    const [fragments, setFragments] = useState<Partial<Record<ExtractionMode, string>>>(initialFragments);
    const [messages, setMessages] = useState<ConversationMessage[]>([{
        role: 'assistant',
        content: "¡Hola! Soy tu copiloto creativo en tiempo real. Pídeme cualquier cambio (ej: 'hazlo cyberpunk', 'añade un sombrero') y actualizaré tu prompt al instante."
    }]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Change from single module to a Set of modules for persistent highlighting
    const [updatedModules, setUpdatedModules] = useState<Set<ExtractionMode>>(new Set());
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [pastedText, setPastedText] = useState('');
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [currentPromptText, setCurrentPromptText] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (viewState === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, viewState]);

    useEffect(() => {
        if (initialPrompt) {
            handleLoadPrompt(initialPrompt.prompt);
        }
    }, [initialPrompt]);

    const handleLoadPrompt = async (text: string) => {
        setGlobalLoader({ active: true, message: 'Analizando prompt con IA...' });
        setCurrentPromptText(text); // Initialize with the raw text
        try {
            const modularized = await modularizePrompt(text) as Record<ExtractionMode, string>;
            setFragments(modularized);
            setViewState('chat');
        } catch (error) {
            addToast("Error al analizar el prompt.", 'error');
        } finally {
            setGlobalLoader({ active: false, message: '' });
        }
    };

    const handleGallerySelect = (prompt: SavedPrompt | SavedPrompt[]) => {
        const selected = Array.isArray(prompt) ? prompt[0] : prompt;
        if (selected) {
            handleLoadPrompt(selected.prompt);
            setIsGalleryOpen(false);
        }
    };

    // Helper to extract JSON from AI response even if it includes Markdown or extra text
    const cleanAndParseResponse = (text: string): AssistantResponse => {
        try {
            // 1. Try simple parse first
            return JSON.parse(text);
        } catch (e) {
            // 2. Try extracting from markdown code blocks
            const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                try {
                    return JSON.parse(codeBlockMatch[1]);
                } catch (e2) {
                    // continue
                }
            }
            
            // 3. Try finding the outer braces
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                try {
                    return JSON.parse(text.substring(firstBrace, lastBrace + 1));
                } catch (e3) {
                    // continue
                }
            }

            // 4. Failed to parse JSON, assume plain text error or message
            console.warn("Could not parse JSON from AI response:", text);
            return {
                message: text,
                updates: []
            };
        }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || isLoading) return;

        const newUserMessage: ConversationMessage = { role: 'user', content: userInput };
        setMessages(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsLoading(true);

        const fragmentsContext = Object.entries(fragments)
            .filter(([, value]) => typeof value === 'string' && value.trim())
            .map(([key, value]) => `- ${key.toUpperCase()}: "${value}"`)
            .join('\n');
        
        const contextText = `(CONTEXTO ACTUAL DE LOS MÓDULOS:\n${fragmentsContext || "Vacíos."}\n)`;

        const geminiHistory = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));
        
        // We prepend context to the user message for the model's visibility
        geminiHistory.push({ role: 'user', parts: [{ text: userInput + `\n\n${contextText}` }] });

        try {
            const responseText = await getCreativeAssistantResponse(geminiHistory, fragments);
            
            // Robust parsing
            const parsedResponse = cleanAndParseResponse(responseText);

            // Apply updates immediately
            if (parsedResponse.updates && parsedResponse.updates.length > 0) {
                const newFragments = { ...fragments };
                const nextUpdatedModules = new Set<ExtractionMode>();

                parsedResponse.updates.forEach(op => {
                    // Normalize the module key (lowercase, strip whitespace)
                    let moduleKey = op.module.toLowerCase().trim();
                    
                    // Check fallback map if the exact key isn't a valid mode
                    if (!EXTRACTION_MODE_MAP[moduleKey as ExtractionMode] && MODULE_FALLBACK_MAP[moduleKey]) {
                        moduleKey = MODULE_FALLBACK_MAP[moduleKey];
                    }

                    // Only apply if it's a valid mode now
                    if (EXTRACTION_MODE_MAP[moduleKey as ExtractionMode] || moduleKey === 'negative') {
                        newFragments[moduleKey as ExtractionMode] = op.value;
                        nextUpdatedModules.add(moduleKey as ExtractionMode);
                    }
                });
                
                setFragments(newFragments);
                setUpdatedModules(nextUpdatedModules);
            }
            
            // Update the master prompt text directly from the AI's calculation
            if (parsedResponse.assembled_prompt) {
                setCurrentPromptText(parsedResponse.assembled_prompt);
            }

            const newAssistantMessage: ConversationMessage = { role: 'assistant', content: parsedResponse.message };
            setMessages(prev => [...prev, newAssistantMessage]);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocurrió un error.";
            addToast(`Error del asistente: ${errorMessage}`, 'error');
            const newAssistantMessage: ConversationMessage = { role: 'assistant', content: `Lo siento, he encontrado un error: ${errorMessage}` };
            setMessages(prev => [...prev, newAssistantMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopy = () => {
        // Copy the currentPromptText directly. 
        // Since we update it on every AI turn, it's always ready.
        // This avoids async operations inside the click handler.
        const textToCopy = currentPromptText || "Prompt vacío";
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            addToast('Prompt actualizado copiado al portapapeles.', 'success');
        }).catch(err => {
             console.error('Failed to copy text: ', err);
             addToast('Error al copiar al portapapeles.', 'error');
        });
    };

    const handleSaveToGallery = async () => {
        // Here we can use currentPromptText as the prompt to save, or re-assemble to be safe.
        // Re-assembling ensures consistency if manual edits were possible (they aren't here yet),
        // but currentPromptText comes from the AI expert assembler, so it's high quality.
        if (!currentPromptText) {
             addToast('No hay prompt para guardar.', 'error');
             return;
        }

        setGlobalLoader({ active: true, message: 'Guardando en galería...' });
        try {
            
            let coverImageDataUrl = '';
            try {
                 setGlobalLoader({ active: true, message: 'Generando portada con IA...' });
                 coverImageDataUrl = await generateImageFromPrompt(currentPromptText);
            } catch (imgErr) {
                 console.error("Cover generation failed", imgErr);
            }

            setGlobalLoader({ active: true, message: 'Generando metadatos...' });
            const metadata = await generateMasterPromptMetadata(currentPromptText, []);
             const newPrompt: SavedPrompt = {
                id: Date.now().toString(),
                type: 'master',
                prompt: currentPromptText,
                coverImage: coverImageDataUrl,
                ...metadata,
            };
            onSavePrompt(newPrompt);
            addToast('Prompt refinado guardado en la Galería.', 'success');

        } catch (e) {
             addToast('Error al guardar.', 'error');
        } finally {
            setGlobalLoader({ active: false, message: '' });
        }
    }

    const handleResetChat = () => {
        setMessages([{
            role: 'assistant',
            content: "Chat reiniciado. Sigo aquí para ayudarte con tu prompt actual."
        }]);
        addToast('Historial del chat limpiado.', 'success');
    };

    const fragmentOrder: ExtractionMode[] = ['subject', 'pose', 'expression', 'outfit', 'object', 'scene', 'style', 'composition', 'color'];

    if (viewState === 'setup') {
        return (
            <div className="glass-pane p-6 md:p-8 rounded-2xl max-w-4xl mx-auto animate-fade-slide-in-up">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                        Refinador IA
                    </h1>
                    <p className="mt-2 text-gray-400">Carga un prompt y trabaja mano a mano con la IA para perfeccionarlo en tiempo real.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => setIsGalleryOpen(true)} className="flex flex-col items-center justify-center space-y-3 p-8 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-indigo-400 group">
                        <GalleryIcon className="w-12 h-12 text-indigo-400 group-hover:scale-110 transition-transform" />
                        <h2 className="font-semibold text-gray-200 text-lg">Desde Galería</h2>
                        <p className="text-sm text-gray-500">Elige un prompt que ya hayas creado.</p>
                    </button>
                    
                    <div className="flex flex-col space-y-3 p-6 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                        <div className="flex flex-col items-center justify-center mb-2">
                             <FilePlusIcon className="w-10 h-10 text-purple-400 mb-2" />
                             <h2 className="font-semibold text-gray-200">Pegar Texto</h2>
                        </div>
                        <textarea
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Pega aquí cualquier prompt de texto..."
                            className="w-full bg-gray-800/70 rounded-lg p-3 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm transition-all shadow-inner min-h-[100px] resize-none"
                        />
                        <button 
                            onClick={() => handleLoadPrompt(pastedText)}
                            disabled={!pastedText.trim()}
                            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-500/20 disabled:text-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                            Analizar y Refinar
                        </button>
                    </div>
                </div>

                {isGalleryOpen && (
                    <GalleryModal
                        prompts={savedPrompts}
                        onSelect={handleGallerySelect}
                        onClose={() => setIsGalleryOpen(false)}
                        title="Seleccionar Prompt para Refinar"
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] animate-fade-in-subtle">
            {/* Header: Responsive Layout */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 md:gap-0">
                 <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center gap-2">
                    <SparklesIcon className="w-6 h-6 text-indigo-400" />
                    Refinador IA
                </h1>
                
                {/* Mobile: Grid for buttons to fit width. Desktop: Flex row */}
                <div className="grid grid-cols-5 gap-2 w-full md:w-auto md:flex md:space-x-3">
                    <button 
                        onClick={() => setShowPreview(true)} 
                        className="flex items-center justify-center space-x-2 px-2 md:px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg border border-white/10 text-sm md:text-base"
                        title="Vista Previa"
                    >
                        <EyeIcon className="w-5 h-5" />
                        <span className="hidden md:inline">Vista Previa</span>
                    </button>
                    
                    <button 
                        onClick={handleCopy} 
                        className="flex items-center justify-center space-x-2 px-2 md:px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors shadow-lg border border-white/10 text-sm md:text-base"
                        title="Copiar Prompt"
                    >
                         {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                        <span className="hidden md:inline">Copiar</span>
                    </button>

                    <button 
                        onClick={handleResetChat} 
                        className="flex items-center justify-center space-x-2 px-2 md:px-4 py-2 rounded-lg hover:bg-white/10 text-gray-300 transition-colors text-sm md:text-base border border-transparent hover:border-white/10"
                        title="Reiniciar Chat"
                    >
                        <RefreshIcon className="w-5 h-5" />
                        <span className="hidden md:inline">Reiniciar</span>
                    </button>
                    
                    <button 
                        onClick={handleSaveToGallery} 
                        className="flex items-center justify-center space-x-2 px-2 md:px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors shadow-lg text-sm md:text-base"
                        title="Guardar en Galería"
                    >
                        <SaveIcon className="w-5 h-5" />
                        <span className="hidden md:inline">Guardar</span>
                    </button>
                    
                    <button 
                        onClick={() => setViewState('setup')} 
                        className="flex items-center justify-center space-x-2 px-2 md:px-4 py-2 rounded-lg hover:bg-white/10 text-gray-300 transition-colors text-sm md:text-base"
                        title="Salir del modo Refinador"
                    >
                        <CloseIcon className="w-5 h-5" />
                        <span className="hidden md:inline">Salir</span>
                    </button>
                </div>
            </div>

            <div className="flex-grow flex flex-col lg:flex-row gap-6 overflow-hidden relative">
                {/* Left Panel: Fragments (Read Only / Context) - Hidden on Mobile */}
                <div className="hidden lg:flex w-full lg:w-1/3 flex-col glass-pane rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                    <div className="p-4 border-b border-white/10 bg-gray-900/50 flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-200">Estado del Prompt</h2>
                             <div className="flex items-center gap-2 ml-2">
                                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                <span className="text-xs text-teal-400 uppercase tracking-wider font-semibold">En vivo</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/20">
                        {fragmentOrder.map(mode => {
                            const value = fragments[mode];
                            const config = EXTRACTION_MODE_MAP[mode];
                            const isUpdated = updatedModules.has(mode);
                            // Show active if it has value OR if it was just updated
                            if (!value && !isUpdated) return null; 
                            
                            return (
                                <div key={mode} className={`p-3 rounded-lg border transition-all duration-500 ${isUpdated ? 'ring-2 ring-teal-400 bg-teal-500/20 border-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.3)] scale-105 z-10' : 'bg-gray-900/50 border-white/5 hover:border-white/10'}`}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`w-2 h-2 rounded-full ${config.badgeClassName.replace('bg-', 'bg-').split(' ')[0]}`}></span>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{config.label}</h3>
                                    </div>
                                    <p className="text-sm text-gray-200 leading-relaxed font-mono text-xs opacity-90">{value || <span className="text-gray-600 italic">Vacío...</span>}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right Panel: Chat - Full width on mobile */}
                <div className="flex w-full lg:w-2/3 flex-col glass-pane rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                    <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''} animate-fade-slide-in-up`}>
                                {msg.role === 'assistant' && <AssistantIcon />}
                                <div className={`max-w-2xl p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none ring-1 ring-white/10'}`}>
                                    {msg.role === 'user' ? (
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    ) : (
                                        <SimpleMarkdown>{msg.content}</SimpleMarkdown>
                                    )}
                                </div>
                                {msg.role === 'user' && <UserIcon />}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-4 animate-fade-in-subtle">
                                <AssistantIcon />
                                <div className="p-4 rounded-2xl rounded-bl-none bg-gray-800 ring-1 ring-white/10">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-white/10 bg-gray-900/30">
                        <div className="relative">
                             <textarea
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Escribe un cambio (ej: 'hazlo cyberpunk', 'añade un sombrero')..."
                                className="w-full bg-gray-900/50 rounded-xl p-4 pr-24 text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm transition-all shadow-inner resize-none"
                                rows={2}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!userInput.trim() || isLoading}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors disabled:bg-indigo-500/30 disabled:cursor-not-allowed shadow-lg"
                            >
                                {isLoading ? <Loader /> : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
             {showPreview && (
                <ImagePreviewModal 
                    prompt={currentPromptText} 
                    onClose={() => setShowPreview(false)} 
                />
            )}
        </div>
    );
};
