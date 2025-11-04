import React, { useState, useEffect, useRef } from 'react';
import { ExtractionMode } from '../types';
import { EXTRACTION_MODES } from '../config';

interface ExtractorModeSelectorProps {
  mode: ExtractionMode;
  setMode: (mode: ExtractionMode) => void;
}

export const ExtractorModeSelector: React.FC<ExtractorModeSelectorProps> = ({ mode, setMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  useEffect(() => {
    if (containerRef.current) {
      const activeButton = containerRef.current.querySelector(`[role="radio"][aria-checked="true"]`) as HTMLButtonElement;
      if (activeButton) {
        setIndicatorStyle({
          width: `${activeButton.offsetWidth}px`,
          height: `${activeButton.offsetHeight}px`,
          transform: `translate(${activeButton.offsetLeft}px, ${activeButton.offsetTop}px)`,
        });
      }
    }
  }, [mode]);

  return (
    <div className="w-full">
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Modo de Extracción</h2>
        <div className="p-1 bg-gray-900/50 rounded-lg">
            <div ref={containerRef} className="relative grid grid-cols-3 gap-1" role="radiogroup" aria-label="Modo de extracción">
                <div 
                    className="absolute bg-teal-600 rounded-md shadow transition-transform duration-300 ease-in-out"
                    style={indicatorStyle}
                    aria-hidden="true"
                />
                {EXTRACTION_MODES.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setMode(item.id)}
                        role="radio"
                        aria-checked={mode === item.id}
                        className={`relative z-10 w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500 ${mode === item.id ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );
};
