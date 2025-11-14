import React, { useState } from 'react';

interface ApiKeySetupProps {
  onKeySaved: () => void;
  addToast: (message: string, type?: 'success' | 'error') => void;
}

export const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onKeySaved, addToast }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    if (!apiKey.trim()) {
      addToast('Por favor, ingresa una API Key válida.', 'error');
      return;
    }
    localStorage.setItem('userGeminiKey', apiKey.trim());
    addToast('¡API Key guardada! Bienvenido a Prompt Studio.', 'success');
    onKeySaved();
  };

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
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
        </div>
    </div>
  );
};
