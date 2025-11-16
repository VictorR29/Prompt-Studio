import React from 'react';
import { SavedPrompt } from '../types';
import { PROMPT_TYPE_CONFIG } from '../config';
import { CheckIcon } from './icons/CheckIcon';

interface PromptCardProps {
  promptData: SavedPrompt;
  onClick: () => void;
  isSelected?: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({ promptData, onClick, isSelected = false }) => {
  const { className: typeBadgeClass, text: typeText } = PROMPT_TYPE_CONFIG[promptData.type] || PROMPT_TYPE_CONFIG['style'];

  return (
    <div
      className="group cursor-pointer mb-6 break-inside-avoid relative"
      onClick={onClick}
    >
      <div className={`relative w-full rounded-xl shadow-lg overflow-hidden bg-gray-800 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-teal-500/10 group-hover:-translate-y-1 ${isSelected ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-teal-400' : ''}`}>
        {promptData.coverImage ? (
          <img 
            src={promptData.coverImage} 
            alt={promptData.title} 
            className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105 bg-gray-800"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
        <div className="absolute inset-0 flex flex-col justify-end p-4">
            <div className={`absolute top-3 right-3 text-xs font-bold uppercase px-2 py-1 rounded-full ring-1 ${typeBadgeClass}`}>
                {typeText}
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight drop-shadow-md">{promptData.title}</h3>
              <p className="text-teal-300 text-xs font-medium mt-1 drop-shadow-sm">
                {promptData.category}
              </p>
            </div>
        </div>
        {isSelected && (
          <div className="absolute inset-0 bg-teal-500/30 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="bg-teal-500 rounded-full p-2">
              <CheckIcon className="w-8 h-8 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};