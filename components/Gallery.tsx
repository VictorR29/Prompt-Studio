
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { SavedPrompt } from '../types';
import { PromptCard } from './PromptCard';
import { SearchIcon } from './icons/SearchIcon';
import { PROMPT_TYPE_CONFIG } from '../config';

interface GalleryProps {
  prompts: SavedPrompt[];
  onSelect: (prompt: SavedPrompt) => void;
  selection?: SavedPrompt[];
  multiSelect?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (prompt: SavedPrompt) => void;
}

const filterOptions: { id: SavedPrompt['type']; label: string; className: string }[] = Object.entries(PROMPT_TYPE_CONFIG)
    .map(([id, config]) => ({
        id: id as SavedPrompt['type'],
        label: config.text,
        className: config.className.replace('hover:bg-', 'hover:bg-opacity-30 bg-'), 
    }));

const INITIAL_LOAD_COUNT = 24;
const SUBSEQUENT_LOAD_COUNT = 12;

export const Gallery: React.FC<GalleryProps> = ({ prompts = [], onSelect, selection, multiSelect = false, onDelete, onEdit }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  const loaderRef = useRef<HTMLDivElement>(null);

  const handleFilterToggle = useCallback((type: string) => {
    setActiveFilters(prevFilters => {
      const newFilters = new Set(prevFilters);
      if (newFilters.has(type)) {
        newFilters.delete(type);
      } else {
        newFilters.add(type);
      }
      return newFilters;
    });
  }, []);
  
  const filteredPrompts = useMemo(() => {
    if (!prompts) return [];
    return prompts.filter(prompt => {
      if (activeFilters.size > 0) {
          const isImported = prompt.category === 'Imported' || !!prompt.creator;
          
          let matches = false;
          if (activeFilters.has(prompt.type)) matches = true;
          if (activeFilters.has('hybrid') && prompt.isHybrid) matches = true;
          if (activeFilters.has('imported') && isImported) matches = true;
          
          if (!matches) return false;
      }

      const query = searchQuery.toLowerCase().trim();
      if (query === '') return true;

      const titleMatch = prompt.title.toLowerCase().includes(query);
      const notesMatch = prompt.notes.toLowerCase().includes(query);
      
      return titleMatch || notesMatch;
    });
  }, [prompts, searchQuery, activeFilters]);

  useEffect(() => {
    setVisibleCount(INITIAL_LOAD_COUNT);
  }, [searchQuery, activeFilters, prompts.length]);

  useEffect(() => {
    const element = loaderRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredPrompts.length) {
          setVisibleCount(prevCount => prevCount + SUBSEQUENT_LOAD_COUNT);
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleCount, filteredPrompts.length]);

  const promptsToShow = filteredPrompts.slice(0, visibleCount);

  return (
    <div className="w-full">
      <div className="mb-8 space-y-6">
        <div className="relative group">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-500 group-focus-within:text-teal-400 transition-colors" />
          </span>
          <input
            type="search"
            placeholder="Buscar por título, notas o contenido..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900/50 rounded-lg text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => handleFilterToggle('imported')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full ring-1 transition-all duration-200 flex items-center gap-1 ${
                activeFilters.has('imported')
                  ? 'ring-offset-2 ring-offset-gray-900 ring-white bg-white text-gray-900 scale-105 shadow-md'
                  : 'opacity-70 hover:opacity-100 bg-white/5 text-white border border-white/10 hover:bg-white/10'
              }`}
            >
              📥 Importados
            </button>
            <div className="h-4 w-px bg-white/10 mx-1"></div>

          {filterOptions.map(option => (
            <button
              key={option.id}
              onClick={() => handleFilterToggle(option.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full ring-1 transition-all duration-200 ${
                activeFilters.has(option.id)
                  ? 'ring-offset-2 ring-offset-gray-900 ring-teal-400 scale-105 shadow-glow'
                  : 'opacity-70 hover:opacity-100 bg-white/5 hover:bg-white/10 border-transparent'
              } ${option.className}`}
            >
              {option.label}
            </button>
          ))}
          {activeFilters.size > 0 && (
             <button
              onClick={() => setActiveFilters(new Set())}
              className="px-3 py-1.5 text-xs font-semibold rounded-full ring-1 transition-all duration-200 text-gray-400 ring-gray-600 hover:bg-white/5 ml-auto hover:text-white"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {prompts.length === 0 && (
        <div className="text-center text-gray-500 py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 opacity-50">
                <SearchIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-gray-400">Tu galería está vacía</h2>
            <p className="text-sm">Guarda tus primeros prompts para verlos aquí.</p>
        </div>
      )}

      {prompts.length > 0 && filteredPrompts.length === 0 && (
        <div className="text-center text-gray-500 py-20">
            <h2 className="text-xl font-bold mb-2 text-gray-400">Sin resultados</h2>
            <p className="text-sm">Intenta ajustar tus filtros de búsqueda.</p>
        </div>
      )}

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {promptsToShow.map((prompt) => {
            const isSelected = multiSelect && selection ? selection.some(p => p.id === prompt.id) : false;
            return (
            <PromptCard 
                key={prompt.id} 
                promptData={prompt} 
                onClick={() => onSelect(prompt)}
                isSelected={isSelected} 
                onDelete={onDelete}
                onEdit={onEdit}
            />
            );
        })}
      </div>

      {visibleCount < filteredPrompts.length && (
         <div ref={loaderRef} className="h-20 w-full flex items-center justify-center mt-8">
             <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce mx-1"></div>
             <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce mx-1" style={{ animationDelay: '0.1s' }}></div>
             <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce mx-1" style={{ animationDelay: '0.2s' }}></div>
         </div>
      )}
    </div>
  );
};
