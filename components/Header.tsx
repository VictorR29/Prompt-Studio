
import React from 'react';
import { AppView } from '../App';
import { PencilIcon } from './icons/PencilIcon';
import { GalleryIcon } from './icons/GalleryIcon';

export type View = 'generator' | 'gallery' | 'structurer' | 'assembler' | 'editor';

interface HeaderProps {
    view: View;
    setView: (view: View) => void;
}

const ExtractorIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.95-4.243-1.591 1.591M5.25 12H3m4.243-4.95L6 6m11.25 6.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
);
const StructurerIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
);
const AssemblerIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01" /></svg>
);


export const Header: React.FC<HeaderProps> = ({ view, setView }) => {
  const navButtonClasses = "flex items-center justify-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500";
  const activeClasses = "bg-teal-600 text-white shadow-lg";
  const inactiveClasses = "text-gray-300 hover:bg-white/10";

  const navButtons = [
    { view: 'generator', label: 'Extractor', icon: <ExtractorIcon /> },
    { view: 'structurer', label: 'Estructurador', icon: <StructurerIcon /> },
    { view: 'assembler', label: 'Ensamblador', icon: <AssemblerIcon /> },
    { view: 'editor', label: 'Editor', icon: <PencilIcon className="w-5 h-5" /> },
    { view: 'gallery', label: 'Galería', icon: <GalleryIcon className="w-5 h-5" /> },
  ];
  
  const activeIndex = navButtons.findIndex(button => button.view === view);

  return (
    <>
      <header className="sticky top-0 z-20 glass-pane border-b-0">
        <div className="container mx-auto flex items-center justify-between p-3">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
            Prompt Studio
          </h1>
          <nav className="hidden md:flex items-center space-x-1 bg-gray-900/50 p-1 rounded-full">
            {navButtons.map(button => (
              <button
                  key={button.view}
                  onClick={() => setView(button.view as View)}
                  className={`${navButtonClasses} ${view === button.view ? activeClasses : inactiveClasses}`}
              >
                  {button.icon}
                  <span>{button.label}</span>
              </button>
              ))}
          </nav>
        </div>
      </header>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-pane border-t border-[var(--glass-border)] z-30">
        <div className="grid grid-cols-5 items-center h-16 relative">
           <div
            className="absolute top-0 h-0.5 bg-teal-400 rounded-b-full transition-transform duration-300 ease-in-out"
            style={{
              width: '20%', // 100% / 5 buttons
              transform: `translateX(${activeIndex * 100}%)`,
            }}
            aria-hidden="true"
          />
          {navButtons.map(button => {
            const isActive = view === button.view;
            return (
              <button
                key={`mobile-${button.view}`}
                onClick={() => setView(button.view as View)}
                className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-colors duration-200 focus:outline-none ${isActive ? 'text-teal-400' : 'text-gray-400 hover:text-teal-300'}`}
                aria-current={isActive}
              >
                {React.cloneElement(button.icon, { className: `w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}` })}
                <span className="text-xs font-medium">{button.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  );
};
