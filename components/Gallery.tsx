
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SavedPrompt } from '../types';
import { PromptCard } from './PromptCard';
import { SearchIcon } from './icons/SearchIcon';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { PROMPT_TYPE_CONFIG } from '../config';

interface GalleryProps {
  prompts: SavedPrompt[];
  onSelect: (prompt: SavedPrompt) => void;
  selection?: SavedPrompt[];
  multiSelect?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (prompt: SavedPrompt) => void;
  onShare?: (prompt: SavedPrompt) => void;
}

const filterOptions: { id: SavedPrompt['type']; label: string; className: string }[] = Object.entries(PROMPT_TYPE_CONFIG)
    .map(([id, config]) => ({
        id: id as SavedPrompt['type'],
        label: config.text,
        className: config.className.replace('hover:bg-', 'hover:bg-opacity-30 bg-'), 
    }));

const INITIAL_LOAD_COUNT = 24;
const SUBSEQUENT_LOAD_COUNT = 12;

export const Gallery: React.FC<GalleryProps> = ({ prompts = [], onSelect, selection, multiSelect = false, onDelete, onEdit, onShare }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  const [activeContextMenuId, setActiveContextMenuId] = useState<string | null>(null);
  const [numColumns, setNumColumns] = useState(2); // Default mobile
  const [showScrollTop, setShowScrollTop] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Responsive Column Calculation
  useEffect(() => {
      const updateColumns = () => {
          const width = window.innerWidth;
          if (width >= 1024) {
              setNumColumns(4); // Desktop
          } else if (width >= 768) {
              setNumColumns(3); // Tablet
          } else {
              setNumColumns(2); // Mobile
          }
      };

      // Initial call
      updateColumns();

      // Listener
      window.addEventListener('resize', updateColumns);
      return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Scroll to Top Logic
  useEffect(() => {
    const handleScroll = () => {
      // Threshold 100px
      if (window.scrollY > 100) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial position
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

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
      { root: null, rootMargin: '400px', threshold: 0.1 } // Increased margin for smoother loading
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleCount, filteredPrompts.length]);

  // Close context menu when scrolling
  useEffect(() => {
    const handleScroll = () => {
        if (activeContextMenuId) setActiveContextMenuId(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeContextMenuId]);

  const promptsToShow = filteredPrompts.slice(0, visibleCount);

  // Deterministic Column Distribution
  const columns = useMemo(() => {
      const cols: SavedPrompt[][] = Array.from({ length: numColumns }, () => []);
      promptsToShow.forEach((prompt, index) => {
          cols[index % numColumns].push(prompt);
      });
      return cols;
  }, [promptsToShow, numColumns]);

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
        <div className="text-center py-24 px-6">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center">
                <svg className="w-12 h-12 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-200 mb-2">Tu galería está vacía</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Empezá a crear prompts con el Editor o el Extractor y guardalos acá para tenerlos siempre a mano.</p>
            <div className="flex gap-3 justify-center">
                <button
                    onClick={() => {}}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/20"
                >
                    Abrir Editor
                </button>
                <button
                    onClick={() => {}}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-semibold rounded-lg border border-white/10 transition-all duration-200"
                >
                    Ir al Extractor
                </button>
            </div>
        </div>
      )}

      {prompts.length > 0 && filteredPrompts.length === 0 && (
        <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
                <SearchIcon className="w-7 h-7 text-gray-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-400 mb-1">Sin resultados</h2>
            <p className="text-sm text-gray-500">Probá ajustando los filtros o el término de búsqueda.</p>
        </div>
      )}

      {/* Stable Masonry Layout */}
      <div className="flex gap-4 items-start">
        {columns.map((colPrompts, colIndex) => (
            <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
                {colPrompts.map((prompt) => {
                    const isSelected = multiSelect && selection ? selection.some(p => p.id === prompt.id) : false;
                    return (
                        <PromptCard 
                            key={prompt.id} 
                            promptData={prompt} 
                            onClick={() => onSelect(prompt)}
                            isSelected={isSelected} 
                            onDelete={onDelete}
                            onEdit={onEdit}
                            onShare={onShare}
                            activeContextMenuId={activeContextMenuId}
                            onSetActiveContextMenu={setActiveContextMenuId}
                        />
                    );
                })}
            </div>
        ))}
      </div>

      {visibleCount < filteredPrompts.length && (
         <div ref={loaderRef} className="h-20 w-full flex items-center justify-center mt-8">
             <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce mx-1"></div>
             <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce mx-1" style={{ animationDelay: '0.1s' }}></div>
             <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce mx-1" style={{ animationDelay: '0.2s' }}></div>
         </div>
      )}

      {/* Scroll to Top Button - Using Portal to detach from parent transform/animations */}
      {typeof document !== 'undefined' && createPortal(
        <button
          onClick={scrollToTop}
          className={`fixed bottom-24 right-5 md:bottom-10 md:right-10 p-3 rounded-full bg-teal-600/90 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/50 backdrop-blur-sm border border-white/10 transition-all duration-300 transform z-[999] group ${
            showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'
          }`}
          aria-label="Volver arriba"
        >
          <ArrowUpIcon className="w-6 h-6 group-hover:-translate-y-1 transition-transform duration-300" />
        </button>,
        document.body
      )}
    </div>
  );
};
