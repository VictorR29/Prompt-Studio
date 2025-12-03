
import React, { forwardRef } from 'react';
import { SavedPrompt } from '../types';
import { PROMPT_TYPE_CONFIG } from '../config';
import { DNAIcon } from './icons/DNAIcon';
import QRCode from 'react-qr-code';

interface ShareCardProps {
  promptData: SavedPrompt;
  shareUrl: string;
}

// 16:9 Aspect Ratio (1600x900) - Horizontal Layout
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(({ promptData, shareUrl }, ref) => {
  // Defensive check: Ensure we have fallback if promptData.type is invalid/missing
  const config = PROMPT_TYPE_CONFIG[promptData.type] || PROMPT_TYPE_CONFIG['style'];
  const { className: typeBadgeClass, text: typeText } = config;
  const isHybrid = promptData.isHybrid || promptData.type === 'hybrid';
  
  // Defensive check: Ensure ID exists before slicing
  const safeId = promptData.id ? String(promptData.id) : 'UNKNOWN';

  return (
    <div 
        ref={ref} 
        className="w-[1600px] h-[900px] bg-[#0A0814] relative overflow-hidden flex font-sans"
    >
        {/* Background Pattern - Left Side */}
        <div className="absolute inset-0 z-0 bg-[#0A0814]">
             {/* Subtle dot pattern */}
             <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#303440 1.5px, transparent 1.5px)', backgroundSize: '30px 30px' }}></div>
             
             {/* Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-[120px] opacity-60"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] opacity-60"></div>
        </div>

        {/* LEFT PANEL: CONTEXT (60%) */}
        <div className="w-[60%] h-full p-16 flex flex-col justify-between relative z-10 border-r-2 border-dashed border-gray-700/50">
            {/* Notches for ticket effect - simulating holes with black circles */}
            <div className="absolute -right-6 top-0 w-12 h-12 bg-black rounded-full translate-y-[-50%] z-20"></div>
            <div className="absolute -right-6 bottom-0 w-12 h-12 bg-black rounded-full translate-y-[50%] z-20"></div>

            {/* Header */}
            <div className="flex items-center gap-5">
                 <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20 ring-1 ring-white/20">
                    <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.686-2.686L11 17.25l1.938-.648a3.375 3.375 0 002.686-2.686L16.25 12l.648 1.938a3.375 3.375 0 002.686 2.686L21.5 17.25l-1.938.648a3.375 3.375 0 00-2.686 2.686z" /></svg>
                 </div>
                 <div>
                    <span className="text-3xl font-bold tracking-tight text-white block">Prompt Studio</span>
                    <span className="text-sm font-medium text-teal-400 uppercase tracking-widest">Share Pass</span>
                 </div>
            </div>

            {/* Main Info */}
            <div className="flex flex-col gap-8 flex-grow justify-center mt-8">
                 <div className="space-y-4">
                     <div className="flex items-center gap-4">
                        <span className="text-teal-400 font-bold uppercase tracking-widest text-lg">{promptData.category || 'General'}</span>
                        <div className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide flex items-center gap-2 border border-white/10 ${typeBadgeClass}`}>
                             {isHybrid && <DNAIcon className="w-4 h-4" />}
                             {typeText}
                        </div>
                     </div>
                     <h1 className="text-7xl font-black text-white leading-[1.05] tracking-tight line-clamp-3 drop-shadow-lg">
                        {promptData.title || 'Untitled Prompt'}
                     </h1>
                 </div>

                 {/* Prompt Snippet Box */}
                 <div className="bg-white/5 rounded-3xl p-10 border border-white/10 backdrop-blur-md relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-0 w-3 h-full bg-gradient-to-b from-teal-400 to-indigo-500"></div>
                     <p className="text-3xl leading-relaxed font-mono text-gray-200 line-clamp-[5] whitespace-pre-wrap">
                        {promptData.prompt}
                    </p>
                 </div>
            </div>

            {/* Footer */}
            <div className="pt-8 flex justify-between items-end border-t border-white/5">
                <div className="text-gray-500 font-medium text-xl flex items-center gap-2">
                    <span>Generated by</span>
                    <span className="text-teal-500 font-bold">Prompt Studio AI</span>
                </div>
                <div className="text-gray-600 text-sm font-mono">
                    ID: {safeId.slice(-8).toUpperCase()}
                </div>
            </div>
        </div>

        {/* RIGHT PANEL: FUNCTION (40%) */}
        <div className="w-[40%] h-full bg-slate-50 text-gray-900 flex flex-col items-center justify-center relative z-20">
             
             <div className="w-[80%] flex flex-col items-center text-center space-y-10">
                 
                 <div className="space-y-2">
                     <div className="flex items-center justify-center gap-3 text-gray-400 font-bold uppercase tracking-[0.3em] text-lg">
                        <span className="w-8 h-[2px] bg-gray-300"></span>
                        Scan to Load
                        <span className="w-8 h-[2px] bg-gray-300"></span>
                     </div>
                     <h2 className="text-6xl font-black text-slate-900 leading-tight">
                        ACCESS
                     </h2>
                 </div>

                 {/* QR Container */}
                 <div className="relative">
                    {/* Viewfinder Corners */}
                    <div className="absolute -top-4 -left-4 w-12 h-12 border-t-[6px] border-l-[6px] border-slate-900 rounded-tl-xl z-10"></div>
                    <div className="absolute -top-4 -right-4 w-12 h-12 border-t-[6px] border-r-[6px] border-slate-900 rounded-tr-xl z-10"></div>
                    <div className="absolute -bottom-4 -left-4 w-12 h-12 border-b-[6px] border-l-[6px] border-slate-900 rounded-bl-xl z-10"></div>
                    <div className="absolute -bottom-4 -right-4 w-12 h-12 border-b-[6px] border-r-[6px] border-slate-900 rounded-br-xl z-10"></div>

                    {/* The Code */}
                    <div className="bg-white p-6 rounded-3xl shadow-2xl relative overflow-hidden">
                        {shareUrl && (
                            <div style={{ width: '480px', height: '480px' }}>
                                <QRCode 
                                    value={shareUrl} 
                                    size={480}
                                    level="L" 
                                    fgColor="#0F172A"
                                    bgColor="#FFFFFF"
                                    style={{ height: "auto", maxWidth: "100%", width: "100%", shapeRendering: "crispEdges" }}
                                />
                            </div>
                        )}
                    </div>
                 </div>

                 <div className="space-y-2">
                    <p className="text-xl text-slate-500 font-medium tracking-wide">Open in Prompt Studio</p>
                    <div className="inline-block bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-2xl shadow-xl tracking-wide">
                        prompt-studio.app
                    </div>
                 </div>
             </div>
        </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';
