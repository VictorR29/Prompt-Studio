
import React, { useState } from 'react';
import { SavedPrompt } from '../types';
import { PROMPT_TYPE_CONFIG } from '../config';
import { CheckIcon } from './icons/CheckIcon';
import { DNAIcon } from './icons/DNAIcon';
import { BanIcon } from './icons/BanIcon';
import { 
    PaletteIcon, 
    UserIcon, 
    BodyIcon, 
    FaceIcon, 
    ShirtIcon, 
    MountainIcon, 
    CubeIcon, 
    FrameIcon, 
    DropIcon,
    CodeBracketIcon,
    CloudDownloadIcon
} from './icons/CategoryIcons';

interface PromptCardProps {
  promptData: SavedPrompt;
  onClick: () => void;
  isSelected?: boolean;
}

export const PromptCard: React.FC<PromptCardProps> = ({ promptData, onClick, isSelected = false }) => {
  const { className: typeBadgeClass, text: typeText } = PROMPT_TYPE_CONFIG[promptData.type] || PROMPT_TYPE_CONFIG['style'];
  const [imgError, setImgError] = useState(false);

  const isHybrid = promptData.isHybrid || promptData.type === 'hybrid';
  const isImported = promptData.category === 'Imported' || (promptData.creator && promptData.creator !== 'Anon');

  // Helper to determine the correct icon component based on type
  const getIconForType = () => {
      // 1. Hybrid / Fusion gets priority
      if (isHybrid) return <DNAIcon className="w-16 h-16 text-indigo-500 opacity-80" />;

      // 2. Specific Fragments
      switch (promptData.type) {
          case 'style': return <PaletteIcon className="w-16 h-16 text-green-500 opacity-80" />;
          case 'subject': return <UserIcon className="w-16 h-16 text-red-500 opacity-80" />;
          case 'pose': return <BodyIcon className="w-16 h-16 text-blue-500 opacity-80" />;
          case 'expression': return <FaceIcon className="w-16 h-16 text-amber-500 opacity-80" />;
          case 'outfit': return <ShirtIcon className="w-16 h-16 text-pink-500 opacity-80" />;
          case 'scene': return <MountainIcon className="w-16 h-16 text-teal-500 opacity-80" />;
          case 'object': return <CubeIcon className="w-16 h-16 text-indigo-500 opacity-80" />;
          case 'composition': return <FrameIcon className="w-16 h-16 text-cyan-500 opacity-80" />;
          case 'color': return <DropIcon className="w-16 h-16 text-orange-500 opacity-80" />;
          case 'negative': return <BanIcon className="w-16 h-16 text-red-600 opacity-80" />;
          case 'structured': return <CodeBracketIcon className="w-16 h-16 text-purple-500 opacity-80" />;
          
          // 3. Master / Default
          case 'master': 
          default:
              if (isImported) return <CloudDownloadIcon className="w-16 h-16 text-gray-500 opacity-80" />;
              // The classic generic icon for Master prompts
              return <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
      }
  };

  return (
    <div
      className="group cursor-pointer mb-3 md:mb-6 break-inside-avoid relative"
      onClick={onClick}
    >
      <div className={`relative w-full rounded-xl shadow-lg overflow-hidden bg-gray-800 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-teal-500/10 group-hover:-translate-y-1 ${isSelected ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-teal-400' : ''}`}>
        {promptData.coverImage && !imgError ? (
          <img 
            src={promptData.coverImage} 
            alt={promptData.title} 
            className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105 bg-gray-800"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            {getIconForType()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
        <div className="absolute inset-0 flex flex-col justify-end p-3 md:p-4">
            <div className="absolute top-2 right-2 md:top-3 md:right-3 flex flex-col items-end gap-1">
                 <div className={`text-[9px] md:text-[10px] font-bold uppercase px-1.5 py-0.5 md:px-2 md:py-1 rounded-full ring-1 flex items-center gap-1 shadow-md ${typeBadgeClass}`}>
                    {isHybrid && <DNAIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                    {typeText}
                </div>
                 {isImported && (
                     <div className="bg-white/90 text-gray-900 text-[9px] md:text-[10px] font-bold uppercase px-1.5 py-0.5 md:px-2 rounded-full shadow-md">
                        Importado
                     </div>
                )}
            </div>
            
            <div>
              <h3 className="text-white font-bold text-sm md:text-lg leading-tight drop-shadow-md line-clamp-2 md:line-clamp-none">{promptData.title}</h3>
              <div className="flex justify-between items-center mt-1">
                  <p className="text-teal-300 text-[10px] md:text-xs font-medium drop-shadow-sm truncate pr-2">
                    {promptData.category}
                  </p>
                  {promptData.creator && (
                      <span className="text-gray-400 text-[9px] md:text-[10px] bg-black/50 px-1.5 py-0.5 rounded flex-shrink-0">
                          by @{promptData.creator}
                      </span>
                  )}
              </div>
            </div>
        </div>
        {isSelected && (
          <div className="absolute inset-0 bg-teal-500/30 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="bg-teal-500 rounded-full p-2">
              <CheckIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
