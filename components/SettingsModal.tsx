
import React, { useState, useEffect, useCallback } from 'react';
import { CloseIcon } from './icons/CloseIcon';

interface SettingsModalProps {
  onClose: () => void;
  addToast: (message: string, type?: 'success' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, addToast }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('userGeminiKey');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('userGeminiKey', apiKey.trim());
      addToast('Tu API Key ha sido guardada.', 'success');
    } else {
      localStorage.removeItem('userGeminiKey');
      addToast('Usando la clave de la aplicación por defecto.', 'success');
    }
    onClose();
  };
  
  const handleClear = () => {
    localStorage.removeItem('userGeminiKey');
    setApiKey('');
    addToast('Se ha limpiado tu API Key. Usando la clave por defecto.', 'success');
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-subtle"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="glass-pane rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scale-in-center p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="settings-modal-title" className="text-xl font-bold text-white">Configuración de API Key</h2>
          <button
            onClick={onClose}
            className="bg-transparent text-gray-500 hover:text-white rounded-full p-1 transition-colors"
            aria-label="Cerrar"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4">
            <p className="text-gray-400 text-sm">
                Puedes usar tu propia API Key de Google AI Studio. El uso se facturará a tu cuenta de Google Cloud.
            </p>
            <div>
                <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-300 mb-2">
                    Tu API Key de Gemini
                </label>
                <div className="relative">
                    <input
                        id="api-key-input"
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Pega tu API Key aquí"
                        className="w-full bg-gray-900/50 rounded-lg p-3 pr-10 text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-white"
                        aria-label={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                        {showKey ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                    </button>
                </div>
            </div>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sm text-teal-400 hover:text-teal-300 hover:underline transition-colors">
                ¿Cómo obtener una API Key y configurar la facturación?
            </a>
        </div>
        <div className="flex items-center space-x-3 mt-6 pt-4 border-t border-white/10">
          <button
            onClick={handleClear}
            className="flex-grow text-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-gray-500/50"
          >
            Limpiar clave
          </button>
          <button
            onClick={handleSave}
            className="flex-grow text-center bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-teal-500/50"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
