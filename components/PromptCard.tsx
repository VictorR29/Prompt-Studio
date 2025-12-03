
import React from 'react';
import { SavedPrompt } from '../types';
import { PROMPT_TYPE_CONFIG } from '../config';
import { CheckIcon } from './icons/CheckIcon';
import { DNAIcon } from './icons/DNAIcon';

interface PromptCardProps {
  promptData: SavedPrompt;
  onClick: () => void;
  isSelected?: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({ promptData, onClick, isSelected = false }) => {
  const { className: typeBadgeClass, text: typeText } = PROMPT_TYPE_CONFIG[promptData.type] || PROMPT_TYPE_CONFIG['style'];

  const isHybrid = promptData.isHybrid || promptData.type === 'hybrid';
  const isImported = promptData.category === 'Imported' || promptData.creator;

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
            {isHybrid ? (
                <DNAIcon className="w-16 h-16 text-indigo-500 opacity-80" />
            ) : (
                <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
        <div className="absolute inset-0 flex flex-col justify-end p-4">
            <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                 <div className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ring-1 flex items-center gap-1 shadow-md ${typeBadgeClass}`}>
                    {isHybrid && <DNAIcon className="w-3 h-3" />}
                    {typeText}
                </div>
                 {isImported && (
                     <div className="bg-white/90 text-gray-900 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shadow-md">
                        Importado
                     </div>
                )}
            </div>
            
            <div>
              <h3 className="text-white font-bold text-lg leading-tight drop-shadow-md">{promptData.title}</h3>
              <div className="flex justify-between items-center mt-1">
                  <p className="text-teal-300 text-xs font-medium drop-shadow-sm">
                    {promptData.category}
                  </p>
                  {promptData.creator && (
                      <span className="text-gray-400 text-[10px] bg-black/50 px-1.5 py-0.5 rounded">
                          by @{promptData.creator}
                      </span>
                  )}
              </div>
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
