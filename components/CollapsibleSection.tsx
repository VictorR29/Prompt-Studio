import React from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, isOpen, onToggle, children }) => {
  return (
    <div className="glass-pane rounded-xl overflow-hidden transition-all duration-300">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 bg-gray-900/50 hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
      >
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
          {title}
        </h2>
        <ChevronDownIcon 
          className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isOpen ? '' : '-rotate-90'}`} 
        />
      </button>
      {isOpen && (
        <div className="p-4 animate-fade-slide-in-up">
          {children}
        </div>
      )}
    </div>
  );
};
