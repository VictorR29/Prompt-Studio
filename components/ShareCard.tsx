
import React, { forwardRef } from 'react';
import { SavedPrompt } from '../types';
import { PROMPT_TYPE_CONFIG } from '../config';
import { DNAIcon } from './icons/DNAIcon';
import QRCode from 'react-qr-code';

interface ShareCardProps {
  promptData: SavedPrompt;
  shareUrl: string;
}

// Fixed dimensions for a "Story" format (9:16 Aspect Ratio)
// 1080x1920px is standard for high quality social sharing
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(({ promptData, shareUrl }, ref) => {
  const { className: typeBadgeClass, text: typeText } = PROMPT_TYPE_CONFIG[promptData.type] || PROMPT_TYPE_CONFIG['style'];
  const isHybrid = promptData.isHybrid || promptData.type === 'hybrid';

  return (
    <div 
        ref={ref} 
        className="w-[1080px] h-[1920px] bg-[#0A0814] relative overflow-hidden flex flex-col font-sans"
    >
        {/* === TOP SECTION: VISUALS (75% Height) === */}
        <div className="h-[75%] relative p-12 flex flex-col">
            {/* Background Gradients */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-teal-500/20 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2 opacity-60"></div>
                <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[150px] translate-y-1/3 -translate-x-1/3 opacity-60"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                       <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.686-2.686L11 17.25l1.938-.648a3.375 3.375 0 002.686-2.686L16.25 12l.648 1.938a3.375 3.375 0 002.686 2.686L21.5 17.25l-1.938.648a3.375 3.375 0 00-2.686 2.686z" /></svg>
                    </div>
                    <span className="text-3xl font-bold tracking-tight text-white drop-shadow-md">Prompt Studio</span>
                </div>
                <div className={`px-6 py-2 rounded-full font-bold text-xl uppercase tracking-wide flex items-center gap-2 border border-white/20 backdrop-blur-md bg-black/30 ${typeBadgeClass}`}>
                    {isHybrid && <DNAIcon className="w-6 h-6" />}
                    {typeText}
                </div>
            </div>

            {/* Main Image */}
            <div className="w-full aspect-[16/10] rounded-[2rem] overflow-hidden shadow-2xl shadow-black/60 border border-white/10 relative bg-gray-800 mb-10 flex-shrink-0">
                {promptData.coverImage ? (
                    <img src={promptData.coverImage} alt={promptData.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                        <span className="text-gray-500 text-3xl font-mono opacity-50">NO PREVIEW</span>
                    </div>
                )}
            </div>

            {/* Titles & Prompt */}
            <div className="flex-grow flex flex-col relative z-10 overflow-hidden">
                <div className="mb-6">
                    <h2 className="text-2xl text-teal-400 font-semibold mb-2 drop-shadow-md tracking-wide uppercase">{promptData.category}</h2>
                    <h1 className="text-6xl font-extrabold text-white leading-[1.1] line-clamp-3 drop-shadow-lg">
                        {promptData.title}
                    </h1>
                </div>

                <div className="flex-grow bg-black/20 rounded-[2rem] p-10 border border-white/10 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-teal-400 to-indigo-500"></div>
                    <p className="text-3xl leading-relaxed font-mono text-gray-100 whitespace-pre-wrap">
                        {promptData.prompt.length > 380 
                            ? promptData.prompt.substring(0, 380) + "..." 
                            : promptData.prompt}
                    </p>
                    {promptData.negativePrompt && (
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <span className="text-red-400 font-bold text-xl uppercase tracking-widest mr-4">NO:</span>
                            <span className="text-2xl font-mono text-red-200/80">{promptData.negativePrompt.substring(0, 80)}...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* === BOTTOM SECTION: QR FOOTER (25% Height) === */}
        {/* Solid white/light background for maximum contrast and "Ticket" look */}
        <div className="h-[25%] bg-white text-gray-900 p-12 flex items-center justify-between relative z-20">
            {/* Left side: Call to Action */}
            <div className="flex flex-col justify-center h-full max-w-[60%]">
                <p className="text-2xl font-bold text-gray-400 uppercase tracking-widest mb-2">Create & Edit</p>
                <h3 className="text-5xl font-black text-gray-900 leading-tight mb-4">
                    Escanea para cargar este prompt
                </h3>
                <div className="flex items-center gap-3">
                    <span className="bg-indigo-600 text-white px-4 py-1 rounded-md font-bold text-lg">APP</span>
                    <p className="text-xl text-indigo-600 font-medium">prompt-studio.app</p>
                </div>
            </div>

            {/* Right side: Giant QR Code */}
            <div className="h-full aspect-square bg-white border-4 border-gray-900 rounded-3xl p-4 flex items-center justify-center shadow-xl">
                {shareUrl && (
                    <QRCode 
                        value={shareUrl} 
                        size={280} // Massive size for easy scanning
                        level="L" // Lower error correction = less dots = easier to scan
                        fgColor="#000000"
                        bgColor="#FFFFFF"
                    />
                )}
            </div>
            
            {/* Decor */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#0A0814] rounded-full"></div>
            <div className="absolute top-0 left-0 w-full border-t-4 border-dashed border-gray-300"></div>
        </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';
