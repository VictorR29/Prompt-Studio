
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CloseIcon } from './icons/CloseIcon';
import { SavedPrompt } from '../types';
import { SaveIcon } from './icons/SaveIcon';

interface SettingsModalProps {
  onClose: () => void;
  onKeySaved: () => void;
  addToast: (message: string, type?: 'success' | 'error') => void;
  savedPrompts?: SavedPrompt[];
  onPromptsUpdate?: (prompts: SavedPrompt[]) => void;
}

const DownloadIcon: React.FC<{className?: string}> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const UploadIcon: React.FC<{className?: string}> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onKeySaved, addToast, savedPrompts = [], onPromptsUpdate }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onKeySaved();
    onClose();
  };
  
  const handleClear = () => {
    localStorage.removeItem('userGeminiKey');
    setApiKey('');
    addToast('Se ha limpiado tu API Key. Usando la clave por defecto.', 'success');
    onKeySaved();
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

  const handleExportData = () => {
      if (savedPrompts.length === 0) {
          addToast('No hay datos para exportar.', 'error');
          return;
      }
      try {
          const dataStr = JSON.stringify(savedPrompts, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const date = new Date().toISOString().split('T')[0];
          a.href = url;
          a.download = `prompt-studio-backup-${date}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addToast('Copia de seguridad descargada exitosamente.', 'success');
      } catch (error) {
          console.error('Export error:', error);
          addToast('Error al exportar datos.', 'error');
      }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const importedPrompts = JSON.parse(content);

              if (!Array.isArray(importedPrompts)) {
                  throw new Error('Formato de archivo inválido.');
              }

              // Merge strategy: Use a Map to deduplicate by ID, preferring the imported version if there's a conflict?
              // Actually, let's preserve existing if ID matches, or just add new ones.
              // Usually, restore implies we want what's in the file. But let's be safe and merge.
              // If we assume the file is a backup, it might contain older versions. 
              // Let's do a simple merge: Add prompts that don't exist.
              
              // Better strategy for user: Combine lists, unique by ID.
              const currentMap = new Map(savedPrompts.map(p => [p.id, p]));
              let addedCount = 0;
              
              importedPrompts.forEach((p: any) => {
                  if (p.id && p.prompt && p.type) {
                      // If it exists, we could overwrite or skip. Let's overwrite to allow restoring updates.
                      if (!currentMap.has(p.id)) {
                        addedCount++;
                      }
                      currentMap.set(p.id, p);
                  }
              });

              const mergedPrompts = Array.from(currentMap.values());
              
              if (onPromptsUpdate) {
                  onPromptsUpdate(mergedPrompts);
                  addToast(`Galería actualizada: ${addedCount} nuevos, ${mergedPrompts.length} total.`, 'success');
              }
          } catch (error) {
              console.error('Import error:', error);
              addToast('Error al importar: El archivo no es válido.', 'error');
          }
          // Reset input
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

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
        className="glass-pane rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scale-in-center p-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="settings-modal-title" className="text-xl font-bold text-white">Configuración</h2>
          <button
            onClick={onClose}
            className="bg-transparent text-gray-500 hover:text-white rounded-full p-1 transition-colors"
            aria-label="Cerrar"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
            {/* API Key Section */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200 border-b border-white/10 pb-2">API Key</h3>
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
                <div className="flex gap-3">
                    <button
                        onClick={handleClear}
                        className="text-xs text-gray-400 hover:text-white underline transition-colors"
                    >
                        Limpiar clave guardada
                    </button>
                     <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:text-teal-300 hover:underline transition-colors ml-auto">
                        Obtener API Key
                    </a>
                </div>
            </section>

            {/* Data Management Section */}
            <section className="space-y-4">
                 <h3 className="text-lg font-semibold text-gray-200 border-b border-white/10 pb-2">Gestión de Datos</h3>
                 <p className="text-gray-400 text-sm">
                    Tus prompts se guardan en el almacenamiento local de tu navegador. Haz una copia de seguridad para no perderlos.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleExportData}
                        className="flex flex-col items-center justify-center p-4 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-teal-500 group"
                    >
                        <DownloadIcon className="w-6 h-6 text-teal-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-semibold text-gray-200">Exportar Galería</span>
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-4 bg-gray-900/50 hover:bg-white/10 rounded-lg transition-all ring-1 ring-white/10 hover:ring-purple-500 group"
                    >
                        <UploadIcon className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-semibold text-gray-200">Importar Copia</span>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleImportData}
                            className="hidden" 
                            accept=".json"
                        />
                    </button>
                </div>
            </section>
        </div>
        
        <div className="mt-8 pt-4 border-t border-white/10">
          <button
            onClick={handleSave}
            className="w-full text-center bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-teal-500/50 shadow-lg"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
