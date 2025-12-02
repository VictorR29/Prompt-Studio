import React, { useState } from 'react';
import { SavedPrompt } from '../types';
import { PROMPT_TYPE_CONFIG } from '../config';
import { DNAIcon } from './icons/DNAIcon';

interface ApiKeySetupProps {
  onKeySaved: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  pendingSharedPrompt?: SavedPrompt | null;
}

export const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onKeySaved, addToast, pendingSharedPrompt }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    if (!apiKey.trim()) {
      addToast('Por favor, ingresa una API Key válida.', 'error');
      return;
    }
    localStorage.setItem('userGeminiKey', apiKey.trim());
    if (!pendingSharedPrompt) {
        addToast('¡API Key guardada! Bienvenido a Prompt Studio.', 'success');
    }
    onKeySaved();
  };

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
            
            {/* Conditional Header based on Context */}
            {pendingSharedPrompt ? (
                <div className="glass-pane p-8 rounded-2xl shadow-2xl animate-scale-in-center border border-teal-500/30">
                     <div className="mb-6 flex flex-col items-center">
                        <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-teal-500/50 animate-pulse">
                            <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                           ¡Prompt Encontrado!
                        </h1>
                         <p className="text-gray-300">
                           Tu amigo te ha compartido un prompt. <br/>Ingresa tu clave para desbloquearlo.
                        </p>
                     </div>

                     {/* Shared Prompt Preview Card */}
                     <div className="bg-gray-800/80 rounded-xl p-4 mb-8 text-left border border-white/10 shadow-inner">
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1 ${PROMPT_TYPE_CONFIG[pendingSharedPrompt.type].className}`}>
                                {pendingSharedPrompt.isHybrid && <DNAIcon className="w-3 h-3" />}
                                {PROMPT_TYPE_CONFIG[pendingSharedPrompt.type].text}
                            </span>
                             <span className="text-xs text-gray-400 font-semibold">{pendingSharedPrompt.category}</span>
                        </div>
                        <h3 className="font-bold text-lg text-white line-clamp-1">{pendingSharedPrompt.title}</h3>
                        <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">{pendingSharedPrompt.prompt}</p>
                     </div>

                     <div className="space-y-4">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Pega tu API Key de Gemini aquí"
                            className="w-full bg-gray-900/50 rounded-lg p-3 text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner text-center"
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!apiKey.trim()}
                        className="w-full mt-6 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 text-lg flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        Guardar y Desbloquear Prompt
                    </button>

                </div>
            ) : (
                /* Default Onboarding */
                <div className="glass-pane p-8 rounded-2xl shadow-2xl animate-scale-in-center">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500 mb-2">
                        Bienvenido a Prompt Studio
                    </h1>
                    <p className="text-gray-400 mb-6">
                        Para comenzar, por favor ingresa tu API Key de Google AI Studio.
                    </p>

                    <div className="space-y-4">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Pega tu API Key aquí"
                            className="w-full bg-gray-900/50 rounded-lg p-3 text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner text-center"
                            aria-label="API Key de Gemini"
                        />
                        <a 
                            href="https://ai.google.dev/gemini-api/docs/api-key" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm text-teal-400 hover:text-teal-300 hover:underline transition-colors inline-block"
                        >
                            ¿Cómo obtener una API Key y configurar la facturación?
                        </a>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!apiKey.trim()}
                        className="w-full mt-6 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-500/20 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 text-lg"
                    >
                        Guardar y Empezar a Crear
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};