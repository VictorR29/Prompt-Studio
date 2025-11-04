import React, { useState, useEffect } from 'react';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { JsonEditor } from './JsonEditor';

interface JsonDisplayProps {
  jsonString: string;
}

export const JsonDisplay: React.FC<JsonDisplayProps> = ({ jsonString }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [jsonString]);

  const handleCopy = () => {
    if (jsonString) {
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative w-full flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-200">JSON Prompt</h2>
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500 transition-colors"
          aria-label="Copiar JSON"
        >
          {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
        </button>
      </div>
      
      <div className="relative flex-grow min-h-[16rem] md:min-h-0">
        <div className="absolute inset-0 bg-gray-800 rounded-lg p-4 text-gray-300 overflow-y-auto ring-1 ring-gray-700 custom-scrollbar">
            <JsonEditor jsonString={jsonString} />
        </div>
      </div>
    </div>
  );
};