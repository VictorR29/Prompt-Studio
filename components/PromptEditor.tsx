

import React, { useState, useCallback, useEffect, useRef, useReducer } from 'react';
import { JsonDisplay } from './JsonDisplay';
import { JsonFormEditor } from './JsonFormEditor';
import { generateStructuredPromptMetadata, suggestTextPromptEdits, convertTextPromptToJson, PromptSuggestion, refactorJsonPrompt } from '../services/geminiService';
import { SavedPrompt } from '../types';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { RestoreIcon } from './icons/RestoreIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { JsonIcon } from './icons/JsonIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface PromptEditorProps {
    initialPrompt: SavedPrompt | null;
    onSave: (prompt: Omit<SavedPrompt, 'id'>) => void;
}

interface JsonSuggestion {
    refactoredPrompt: string;
    explanation: string;
}

// --- History State Management with useReducer ---
type HistoryState = {
  history: string[];
  currentIndex: number;
};

type HistoryAction =
  | { type: 'SET'; payload: string }
  | { type: 'UPDATE'; payload: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESTORE' };

const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
  switch (action.type) {
    case 'SET':
      if (action.payload === state.history[state.currentIndex]) return state;
      return { history: [action.payload], currentIndex: 0 };
    case 'UPDATE': {
      if (action.payload === state.history[state.currentIndex]) return state;
      const newHistory = state.history.slice(0, state.currentIndex + 1);
      newHistory.push(action.payload);
      return { history: newHistory, currentIndex: newHistory.length - 1 };
    }
    case 'UNDO':
      return { ...state, currentIndex: Math.max(0, state.currentIndex - 1) };
    case 'REDO':
      return { ...state, currentIndex: Math.min(state.history.length - 1, state.currentIndex + 1) };
    case 'RESTORE':
      return state.history.length > 0 ? { ...state, currentIndex: 0 } : state;
    default:
      return state;
  }
};
// --- End of History Management ---


const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode; title: string }> = ({ onClick, disabled, children, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="p-2.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 disabled:text-gray-600 disabled:bg-white/5 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500"
    >
        {children}
    </button>
);

const SmallLoader: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


export const PromptEditor: React.FC<PromptEditorProps> = ({ initialPrompt, onSave }) => {
    const [{ history, currentIndex: currentHistoryIndex }, dispatch] = useReducer(historyReducer, { history: [], currentIndex: -1 });
    const [promptType, setPromptType] = useState<'json' | 'text' | null>(null);

    const [parsedJson, setParsedJson] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);

    const [isRefactoring, setIsRefactoring] = useState(false);
    const [jsonSuggestion, setJsonSuggestion] = useState<JsonSuggestion | null>(null);
    const [refactorError, setRefactorError] = useState<string | null>(null);

    const textEditorRef = useRef<HTMLTextAreaElement>(null);
    const [selection, setSelection] = useState<{ start: number, end: number } | null>(null);
    const [isFlashing, setIsFlashing] = useState(false);
    const [editorViewKey, setEditorViewKey] = useState(0);

    const currentPromptString = history[currentHistoryIndex] || '';

    useEffect(() => {
        if (initialPrompt) {
            const isJson = initialPrompt.type === 'structured';
            setPromptType(isJson ? 'json' : 'text');
            dispatch({ type: 'SET', payload: initialPrompt.prompt });
            
            setSuggestions([]);
            setSuggestionError(null);
            setJsonSuggestion(null);
            setRefactorError(null);
        } else {
            dispatch({ type: 'SET', payload: '' });
            setPromptType(null);
        }
    }, [initialPrompt]);

    useEffect(() => {
        const promptStr = history[currentHistoryIndex];
        if (promptStr && promptType === 'json') {
            try {
                const newJson = JSON.parse(promptStr);
                setParsedJson(newJson);
                setError(null);
            } catch (e) {
                console.error("Error parsing JSON from history", e);
                setError("El estado del historial contiene un JSON inválido.");
                setParsedJson(null);
            }
        }
    }, [currentHistoryIndex, history, promptType]);

    useEffect(() => {
        if (selection && textEditorRef.current) {
            textEditorRef.current.focus();
            textEditorRef.current.setSelectionRange(selection.start, selection.end);
            setSelection(null); // Clear selection state after applying
        }
    }, [selection, currentPromptString]);
    
    const handleJsonChange = useCallback((newJsonData: any) => {
        const newPromptString = JSON.stringify(newJsonData, null, 2);
        dispatch({ type: 'UPDATE', payload: newPromptString });
    }, []);

     const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newPromptString = e.target.value;
        dispatch({ type: 'UPDATE', payload: newPromptString });
    }, []);

    const handleSuggestEdits = async () => {
        if (!currentPromptString) return;
        setIsSuggesting(true);
        setSuggestionError(null);
        setSuggestions([]);
        try {
            const newSuggestions = await suggestTextPromptEdits(currentPromptString);
            setSuggestions(newSuggestions);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setSuggestionError(`Error suggesting: ${errorMessage}`);
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleApplySuggestion = (suggestion: PromptSuggestion) => {
        let newPrompt = currentPromptString;
        switch (suggestion.type) {
            case 'ADDITION':
                if (suggestion.data.text_to_add) {
                    const originalTrimmed = newPrompt.trim();
                    const separator = originalTrimmed.length > 0 ? ', ' : '';
                    const textToActuallyAdd = suggestion.data.text_to_add;

                    newPrompt = `${originalTrimmed}${separator}${textToActuallyAdd}`;
                    
                    const selectionStart = originalTrimmed.length > 0 
                        ? originalTrimmed.length + separator.length 
                        : 0;
                    const selectionEnd = newPrompt.length;

                    setSelection({ start: selectionStart, end: selectionEnd });
                }
                break;
            case 'REPLACEMENT':
                if (suggestion.data.text_to_remove && suggestion.data.text_to_replace_with) {
                    const startIndex = newPrompt.indexOf(suggestion.data.text_to_remove);
                    if (startIndex !== -1) {
                        newPrompt = newPrompt.replace(suggestion.data.text_to_remove, suggestion.data.text_to_replace_with);
                        const endIndex = startIndex + suggestion.data.text_to_replace_with.length;
                        setSelection({ start: startIndex, end: endIndex });
                    }
                }
                break;
            case 'REMOVAL':
                 if (suggestion.data.text_to_remove) {
                    newPrompt = newPrompt.replace(suggestion.data.text_to_remove, '');
                    // Clean up common artifacts like double commas or leading/trailing commas
                    newPrompt = newPrompt.replace(/, ,/g, ',').replace(/,,/g, ',').trim().replace(/^,|,$/g, '').trim();
                }
                break;
        }
        dispatch({ type: 'UPDATE', payload: newPrompt });
        if (textEditorRef.current) {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 700); // Duration of the animation
        }
    };

    const handleConvertToJSON = async () => {
        if (!currentPromptString) return;
        setIsConverting(true);
        setError(null);
        try {
            const jsonString = await convertTextPromptToJson(currentPromptString);
            dispatch({ type: 'UPDATE', payload: jsonString });
            setPromptType('json');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al convertir: ${errorMessage}`);
        } finally {
            setIsConverting(false);
        }
    };

    const handleRefactorJson = async () => {
        if (!currentPromptString) return;
        setIsRefactoring(true);
        setRefactorError(null);
        setJsonSuggestion(null);

        try {
            const result = await refactorJsonPrompt(currentPromptString);
            setJsonSuggestion({
                refactoredPrompt: result.refactored_prompt,
                explanation: result.explanation
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setRefactorError(`Error al refactorizar: ${errorMessage}`);
        } finally {
            setIsRefactoring(false);
        }
    };

    const handleApplyRefactor = () => {
        if (jsonSuggestion) {
            dispatch({ type: 'UPDATE', payload: jsonSuggestion.refactoredPrompt });
            setJsonSuggestion(null);
            setEditorViewKey(prev => prev + 1);
        }
    };


    const handleSave = async () => {
        if (!currentPromptString || !initialPrompt) return;
        setIsSaving(true);
        setError(null);
        try {
            const finalPromptType = promptType === 'json' ? 'structured' : initialPrompt.type;
            let metadata: Omit<SavedPrompt, 'id' | 'prompt' | 'coverImage' | 'type'>;
            
            const coverImagePayload = initialPrompt.coverImage 
                ? { 
                    imageBase64: initialPrompt.coverImage.split(',')[1], 
                    mimeType: initialPrompt.coverImage.match(/:(.*?);/)?.[1] || 'image/png' 
                  } 
                : undefined;

            if (finalPromptType === 'structured') {
                metadata = await generateStructuredPromptMetadata(currentPromptString, coverImagePayload);
            } else {
                metadata = {
                    title: initialPrompt.title,
                    category: initialPrompt.category,
                    artType: initialPrompt.artType,
                    notes: initialPrompt.notes,
                };
            }
            
            onSave({
                type: finalPromptType,
                prompt: currentPromptString,
                coverImage: initialPrompt.coverImage,
                ...metadata,
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al guardar: ${errorMessage}`);
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!initialPrompt) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center glass-pane p-8 rounded-2xl">
                <svg className="w-20 h-20 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002 2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                <h2 className="mt-6 text-2xl font-bold text-gray-400">Editor de Prompts</h2>
                <p className="mt-2 text-gray-500 max-w-md">
                    Para empezar, genera un prompt en el <span className="font-semibold text-teal-400">Estructurador</span> y haz clic en "Editar", o carga un prompt guardado desde la <span className="font-semibold text-teal-400">Galería</span>.
                </p>
            </div>
        );
    }
    
    if (error && !parsedJson && promptType === 'json') {
        return (
             <div className="flex items-center justify-center h-full text-center text-red-400 bg-red-500/10 p-4 rounded-lg glass-pane">
                <p>{error}</p>
            </div>
        )
    }
    
    const actionButtons = (
        <div className="mt-4 pt-4 border-t border-white/10 flex-shrink-0 space-y-3">
             <div className="flex items-center justify-center space-x-3 bg-gray-900/50 p-2 rounded-lg">
                <ActionButton onClick={() => dispatch({type: 'UNDO'})} disabled={currentHistoryIndex <= 0} title="Undo">
                    <UndoIcon className="w-5 h-5" />
                </ActionButton>
                <ActionButton onClick={() => dispatch({type: 'REDO'})} disabled={currentHistoryIndex >= history.length - 1} title="Redo">
                    <RedoIcon className="w-5 h-5" />
                </ActionButton>
                <ActionButton onClick={() => dispatch({type: 'RESTORE'})} disabled={currentHistoryIndex === 0} title="Restore Original">
                    <RestoreIcon className="w-5 h-5" />
                </ActionButton>
            </div>
            <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-4 focus:ring-green-500/50"
            >
                {isSaving ? 'Saving...' : 'Save Changes to Gallery'}
            </button>
        </div>
    );

    if (promptType === 'json') {
        return (
            <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass-pane rounded-2xl p-6 shadow-2xl flex flex-col h-full lg:max-h-[75vh]">
                        <JsonDisplay jsonString={currentPromptString} />
                    </div>
                    <div className="glass-pane rounded-2xl p-6 shadow-2xl flex flex-col h-full lg:max-h-[75vh]">
                        {parsedJson ? (
                            <>
                                <div 
                                    key={editorViewKey}
                                    className="flex-grow min-h-0 flex flex-col animate-fade-in-subtle"
                                >
                                    <div className="flex-shrink-0">
                                        <button
                                            onClick={handleRefactorJson}
                                            disabled={isRefactoring}
                                            className="w-full flex items-center justify-center space-x-2 bg-purple-600/80 hover:bg-purple-600 disabled:bg-purple-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/50 mb-4"
                                        >
                                            {isRefactoring ? <SmallLoader /> : <><SparklesIcon className="w-5 h-5" /><span>Suggest JSON Improvements</span></>}
                                        </button>
                                        {refactorError && <p className="mb-4 text-sm text-red-400 text-center bg-red-500/10 p-2 rounded-lg">{refactorError}</p>}
                                    </div>
                                    <div className="flex-grow min-h-0">
                                        <JsonFormEditor jsonData={parsedJson} onJsonChange={handleJsonChange} />
                                    </div>
                                </div>
                                {actionButtons}
                            </>
                        ) : (
                            <div className="text-gray-500 flex items-center justify-center h-full">
                            {error ? error : "Loading editor..."}
                            </div>
                        )}
                    </div>
                </div>
                 {jsonSuggestion && (
                    <div 
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                        onClick={() => setJsonSuggestion(null)}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="suggestion-title"
                    >
                        <div 
                            className="glass-pane rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6 animate-scale-in-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 id="suggestion-title" className="text-xl font-bold text-teal-300 mb-4 flex items-center space-x-2">
                                <SparklesIcon className="w-6 h-6" />
                                <span>Suggested Improvement</span>
                            </h3>
                            <div className="overflow-y-auto custom-scrollbar pr-2 -mr-2 flex-grow">
                                <p className="text-gray-300 whitespace-pre-wrap">{jsonSuggestion.explanation}</p>
                            </div>
                            <div className="mt-auto pt-6 flex items-center space-x-4 border-t border-white/10">
                                <button 
                                    onClick={handleApplyRefactor}
                                    className="flex-grow bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-teal-500/50"
                                >
                                    Apply Improvement
                                </button>
                                <button 
                                    onClick={() => setJsonSuggestion(null)}
                                    className="flex-grow bg-gray-600/50 hover:bg-gray-600/80 text-gray-300 font-semibold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                                >
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    if (promptType === 'text') {
        const getSuggestionPrefix = (type: PromptSuggestion['type']) => {
            switch (type) {
                case 'ADDITION': return { text: 'Add:', color: 'text-green-400' };
                case 'REPLACEMENT': return { text: 'Replace:', color: 'text-amber-400' };
                case 'REMOVAL': return { text: 'Remove:', color: 'text-red-400' };
                default: return { text: 'Suggestion:', color: 'text-teal-400' };
            }
        };

        return (
            <div className="glass-pane rounded-2xl p-6 shadow-2xl flex flex-col h-full max-w-4xl mx-auto lg:max-h-[75vh] w-full">
                <h2 className="text-2xl font-bold text-gray-200 mb-1 flex-shrink-0">Prompt Editor</h2>
                <div className="text-sm text-gray-400 mb-4 flex-shrink-0">
                    <span className="font-semibold text-teal-400">{initialPrompt?.title || 'Prompt'}</span> - <span className="italic">{initialPrompt?.category}</span>
                </div>
                <div className="flex-grow min-h-[10rem] flex flex-col">
                  <textarea
                      ref={textEditorRef}
                      value={currentPromptString}
                      onChange={handleTextChange}
                      className={`w-full flex-grow bg-gray-900/50 rounded-lg p-4 text-gray-300 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none text-base custom-scrollbar resize-none font-mono ${isFlashing ? 'animate-suggestion-flash' : ''}`}
                      aria-label="Editor de prompt de texto"
                  />
                </div>


                <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={handleSuggestEdits}
                            disabled={isSuggesting || isConverting}
                            className="flex items-center justify-center space-x-2 w-full bg-teal-600/80 hover:bg-teal-600 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-teal-500/50"
                        >
                            {isSuggesting ? <SmallLoader /> : <><LightbulbIcon className="w-5 h-5" /> <span>Suggest Edits</span></>}
                        </button>
                        <button
                            onClick={handleConvertToJSON}
                            disabled={isSuggesting || isConverting}
                            className="flex items-center justify-center space-x-2 w-full bg-purple-600/80 hover:bg-purple-600 disabled:bg-purple-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/50"
                        >
                           {isConverting ? <SmallLoader /> : <> <JsonIcon className="w-5 h-5" /> <span>Convert to JSON</span> </>}
                        </button>
                    </div>
                    
                    {suggestionError && <p className="text-sm text-red-400 text-center">{suggestionError}</p>}
                    
                    {suggestions.length > 0 && (
                        <div className="pt-3 border-t border-white/10 animate-fade-slide-in-up">
                            <h4 className="font-semibold text-gray-300 text-sm mb-2">Suggestions:</h4>
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                                {suggestions.map((suggestion, i) => {
                                    const prefix = getSuggestionPrefix(suggestion.type);
                                    return (
                                        <button 
                                            key={i} 
                                            onClick={() => handleApplySuggestion(suggestion)}
                                            className="text-left p-3 text-sm font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors ring-1 ring-white/10 w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                                            title="Apply this suggestion"
                                        >
                                           <strong className={`font-semibold ${prefix.color} mr-2`}>{prefix.text}</strong> {suggestion.description}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {actionButtons}
            </div>
        );
    }

    // Estado por defecto mientras se determina el tipo
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center glass-pane p-8 rounded-2xl">
            <h2 className="mt-6 text-2xl font-bold text-gray-400">Loading Editor...</h2>
        </div>
    );
};
