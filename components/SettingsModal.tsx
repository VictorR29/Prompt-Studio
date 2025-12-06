
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CloseIcon } from './icons/CloseIcon';
import { SavedPrompt } from '../types';
import { SaveIcon } from './icons/SaveIcon';
import { TrashIcon } from './icons/TrashIcon';

interface SettingsModalProps {
  onClose: () => void;
  onKeySaved: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
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

// Chart Icon for Usage
const ChartIcon: React.FC<{className?: string}> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onKeySaved, addToast, savedPrompts = [], onPromptsUpdate }) => {
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Usage Stats
  const [storageUsed, setStorageUsed] = useState({ usedKB: 0, percent: 0, totalMB: 5 });
  const [apiUsage, setApiUsage] = useState(0);

  useEffect(() => {
    const storedKey = localStorage.getItem('userGeminiKey');
    if (storedKey) setApiKey(storedKey);
    
    const storedUser = localStorage.getItem('promptStudioUsername');
    if (storedUser) setUsername(storedUser);

    // Calculate Storage Usage Manually
    const calculateStorage = () => {
        let totalCharLength = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalCharLength += (localStorage[key].length + key.length);
            }
        }
        // Browsers typically limit to 5M characters (~5MB or 10MB depending on encoding)
        // We'll use 5M chars as the conservative baseline for the progress bar.
        const limitChars = 5200000; // Approx 5MB
        const usedKB = Math.round((totalCharLength * 2) / 1024); // Est. UTF-16 size
        const percent = Math.min(100, Math.round((totalCharLength / limitChars) * 100));
        
        setStorageUsed({
            usedKB,
            percent,
            totalMB: 5
        });
    };
    calculateStorage();

    // Load API Usage
    const today = new Date().toISOString().split('T')[0];
    const usageData = localStorage.getItem('gemini_api_usage');
    if (usageData) {
        const parsed = JSON.parse(usageData);
        if (parsed.date === today) {
            setApiUsage(parsed.count);
        } else {
            setApiUsage(0);
        }
    }

  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('userGeminiKey', apiKey.trim());
      addToast('Configuración guardada.', 'success');
    } else {
      localStorage.removeItem('userGeminiKey');
      addToast('Usando la clave de la aplicación por defecto.', 'success');
    }
    
    if (username.trim()) {
        localStorage.setItem('promptStudioUsername', username.trim());
    } else {
        localStorage.setItem('promptStudioUsername', 'Anon');
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
  
  const handleClearGallery = () => {
    localStorage.removeItem('savedPrompts');
    if (onPromptsUpdate) {
        onPromptsUpdate([]);
    }
    setConfirmClear(false);
    addToast('Galería eliminada por completo. Ahora tienes espacio libre.', 'success');
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

              const currentMap = new Map(savedPrompts.map(p => [p.id, p]));
              let addedCount = 0;
              
              importedPrompts.forEach((p: any) => {
                  if (p.id && p.prompt && p.type) {
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
            
            {/* Usage Stats (New) */}
            <section className="bg-gray-900/40 p-4 rounded-xl border border-white/5 space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                     <ChartIcon className="w-5 h-5 text-indigo-400" />
                     <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Estadísticas de Uso</h3>
                 </div>
                 
                 {/* Storage Bar */}
                 <div>
                     <div className="flex justify-between text-xs mb-1">
                         <span className="text-gray-400">Almacenamiento Local</span>
                         <span className={storageUsed.percent > 80 ? 'text-red-400 font-bold' : 'text-gray-300'}>
                             {storageUsed.usedKB} KB / ~{storageUsed.totalMB} MB
                         </span>
                     </div>
                     <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                         <div 
                            className={`h-full transition-all duration-500 ${
                                storageUsed.percent < 60 ? 'bg-teal-500' : 
                                storageUsed.percent < 85 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${storageUsed.percent}%` }}
                         />
                     </div>
                     {storageUsed.percent > 80 && (
                         <p className="text-[10px] text-red-400 mt-1">
                             ⚠️ Almacenamiento casi lleno. Exporta y limpia tu galería.
                         </p>
                     )}
                 </div>

                 {/* API Count */}
                 <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                     <span className="text-xs text-gray-400">Peticiones IA (Hoy)</span>
                     <span className="text-sm font-bold text-indigo-300">{apiUsage}</span>
                 </div>
            </section>

            {/* User Profile Section */}
             <section className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200 border-b border-white/10 pb-2">Perfil de Creador</h3>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Nombre de Usuario
                    </label>
                     <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ej: NeoArtist"
                        className="w-full bg-gray-900/50 rounded-lg p-3 text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner"
                    />
                    <p className="text-xs text-gray-500 mt-1">Este nombre aparecerá cuando compartas tus prompts.</p>
                </div>
            </section>

            {/* API Key Section */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200 border-b border-white/10 pb-2">API Key</h3>
                <p className="text-gray-400 text-sm">
                    Puedes usar tu propia API Key de Google AI Studio.
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
                    Tus prompts se guardan en el almacenamiento local. Exporta una copia de seguridad antes de borrar.
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
                
                {/* Nuclear Option: Clear Gallery */}
                {!confirmClear ? (
                    <button 
                        onClick={() => setConfirmClear(true)}
                        className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                        <TrashIcon className="w-4 h-4" />
                        Borrar toda la Galería (Reiniciar)
                    </button>
                ) : (
                    <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg animate-fade-in-subtle">
                        <p className="text-xs text-red-200 mb-2 text-center">
                            ¿Estás seguro? Esta acción borrará TODOS los prompts y no se puede deshacer.
                            <br/><span className="font-bold">Asegúrate de haber exportado antes.</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmClear(false)}
                                className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-md transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleClearGallery}
                                className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-md transition-colors"
                            >
                                Sí, Borrar Todo
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
        
        <div className="mt-8 pt-4 border-t border-white/10">
          <button
            onClick={handleSave}
            className="w-full text-center bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-teal-500/50 shadow-lg"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
