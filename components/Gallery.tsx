
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
}

const filterOptions: { id: SavedPrompt['type']; label: string; className: string }[] = Object.entries(PROMPT_TYPE_CONFIG)
    .map(([id, config]) => ({
        id: id as SavedPrompt['type'],
        label: config.text,
        className: config.className.replace('hover:bg-', 'hover:bg-opacity-30 bg-'), // Adapt hover class
    }));

const INITIAL_LOAD_COUNT = 20;
const SUBSEQUENT_LOAD_COUNT = 10;


export const Gallery: React.FC<GalleryProps> = ({ prompts = [], onSelect, selection, multiSelect = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Set of strings to allow for custom filters like 'imported'
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
      // Filter by type or custom status
      if (activeFilters.size > 0) {
          const isImported = prompt.category === 'Imported' || !!prompt.creator;
          
          let matches = false;
          if (activeFilters.has(prompt.type)) matches = true;
          if (activeFilters.has('hybrid') && prompt.isHybrid) matches = true;
          if (activeFilters.has('imported') && isImported) matches = true;
          
          if (!matches) return false;
      }

      // Filter by search query
      const query = searchQuery.toLowerCase().trim();
      if (query === '') return true;

      const titleMatch = prompt.title.toLowerCase().includes(query);
      const notesMatch = prompt.notes.toLowerCase().includes(query);
      
      return titleMatch || notesMatch;
    });
  }, [prompts, searchQuery, activeFilters]);

  // Reset visible count when filters or search query change.
  // We use prompts.length as a dependency instead of prompts to avoid resetting on unstable array references.
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD_COUNT);
  }, [searchQuery, activeFilters, prompts.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredPrompts.length) {
          setVisibleCount(prevCount => prevCount + SUBSEQUENT_LOAD_COUNT);
        }
      },
      { rootMargin: '400px' } // Load content before it's visible
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [visibleCount, filteredPrompts.length]);

  const promptsToShow = useMemo(() => {
    return filteredPrompts.slice(0, visibleCount);
  }, [filteredPrompts, visibleCount]);


  return (
    <>
      <div className="mb-8 space-y-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" />
          </span>
          <input
            type="search"
            placeholder="Buscar por título o notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900/50 rounded-lg text-gray-200 ring-1 ring-white/10 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
            aria-label="Buscar en galería"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold text-gray-400 mr-2">Filtrar por:</span>
            
            <button
              onClick={() => handleFilterToggle('imported')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full ring-1 transition-all duration-200 flex items-center gap-1 ${
                activeFilters.has('imported')
                  ? 'ring-offset-2 ring-offset-gray-900 ring-white bg-white text-gray-900 scale-105 shadow-md'
                  : 'opacity-70 hover:opacity-100 bg-white/10 text-white border border-white/20'
              }`}
            >
              📥 Importados
            </button>
            <div className="h-4 w-px bg-gray-700 mx-1"></div>

          {filterOptions.map(option => (
            <button
              key={option.id}
              onClick={() => handleFilterToggle(option.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full ring-1 transition-all duration-200 ${
                activeFilters.has(option.id)
                  ? 'ring-offset-2 ring-offset-gray-900 ring-teal-400 scale-105'
                  : 'opacity-70 hover:opacity-100'
              } ${option.className}`}
            >
              {option.label}
            </button>
          ))}
          {activeFilters.size > 0 && (
             <button
              onClick={() => setActiveFilters(new Set())}
              className="px-3 py-1.5 text-xs font-semibold rounded-full ring-1 transition-all duration-200 text-gray-300 ring-gray-500/30 hover:bg-gray-500/30 ml-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {prompts.length === 0 && (
        <div className="text-center text-gray-500 py-16">
            <h2 className="text-2xl font-bold mb-2">Tu galería está vacía</h2>
            <p>Genera un prompt y guárdalo para que aparezca aquí.</p>
        </div>
      )}

      {prompts.length > 0 && filteredPrompts.length === 0 && (
        <div className="text-center text-gray-500 py-16">
            <h2 className="text-2xl font-bold mb-2">No hay resultados</h2>
            <p>Prueba a cambiar los filtros o el término de búsqueda.</p>
        </div>
      )}

      {promptsToShow.length > 0 && (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-6">
            {promptsToShow.map((prompt) => {
              const isSelected = multiSelect && selection ? selection.some(p => p.id === prompt.id) : false;
              return (
                <PromptCard 
                    key={prompt.id} 
                    promptData={prompt} 
                    onClick={() => onSelect(prompt)}
                    isSelected={isSelected} 
                />
              );
            })}
        </div>
      )}

      {/* Sentinel element for triggering infinite scroll */}
      {visibleCount < filteredPrompts.length && (
         <div ref={loaderRef} className="h-10 w-full" />
      )}
    </>
  );
};
