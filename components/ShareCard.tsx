
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
  const { className: typeBadgeClass, text: typeText } = PROMPT_TYPE_CONFIG[promptData.type] || PROMPT_TYPE_CONFIG['style'];
  const isHybrid = promptData.isHybrid || promptData.type === 'hybrid';

  return (
    <div 
        ref={ref} 
        className="w-[1600px] h-[900px] bg-[#0A0814] relative overflow-hidden flex font-sans"
    >
        {/* Background Gradients */}
        <div className="absolute inset-0 z-0">
             {/* Subtle gradients to give life to the dark background */}
            <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-[120px] opacity-50"></div>
            <div className="absolute bottom-[-20%] right-[30%] w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] opacity-50"></div>
        </div>

        {/* LEFT PANEL: CONTEXT (60%) */}
        <div className="w-[60%] h-full p-16 flex flex-col justify-between relative z-10">
            
            {/* Header */}
            <div className="flex items-center gap-5">
                 <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                    <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.686-2.686L11 17.25l1.938-.648a3.375 3.375 0 002.686-2.686L16.25 12l.648 1.938a3.375 3.375 0 002.686 2.686L21.5 17.25l-1.938.648a3.375 3.375 0 00-2.686 2.686z" /></svg>
                 </div>
                 <span className="text-3xl font-bold tracking-tight text-white/90">Prompt Studio</span>
            </div>

            {/* Main Info */}
            <div className="flex flex-col gap-6 flex-grow justify-center">
                 <div className="space-y-4">
                     <div className="flex items-center gap-4">
                        <span className="text-teal-400 font-bold uppercase tracking-widest text-base">{promptData.category}</span>
                        <div className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide flex items-center gap-2 border border-white/10 ${typeBadgeClass}`}>
                             {isHybrid && <DNAIcon className="w-4 h-4" />}
                             {typeText}
                        </div>
                     </div>
                     <h1 className="text-6xl font-extrabold text-white leading-[1.1] line-clamp-2">
                        {promptData.title}
                     </h1>
                 </div>

                 {/* Prompt Snippet Box */}
                 <div className="bg-white/5 rounded-[2rem] p-10 border border-white/10 backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-teal-400 to-indigo-500"></div>
                     <p className="text-3xl leading-relaxed font-mono text-gray-200 line-clamp-[6] whitespace-pre-wrap">
                        {promptData.prompt}
                    </p>
                 </div>
            </div>

            {/* Footer */}
            <div className="pt-8 text-gray-500 font-medium text-xl flex items-center gap-2">
                <span>Hecho con</span>
                <span className="text-teal-500 font-bold">Prompt Studio AI</span>
            </div>
        </div>

        {/* RIGHT PANEL: FUNCTION (40%) */}
        <div className="w-[40%] h-full bg-white text-gray-900 flex flex-col items-center justify-center relative z-20">
             {/* Decorative 'Cut' Line */}
             <div className="absolute left-0 top-0 bottom-0 border-l-[6px] border-dashed border-gray-300"></div>
             <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-6 h-12 bg-[#0A0814] rounded-r-full"></div>

             <div className="w-[80%] flex flex-col items-center text-center space-y-8">
                 <div>
                     <p className="text-2xl font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Compartir Prompt</p>
                     <h2 className="text-5xl font-black text-gray-900 leading-tight">
                        ESCANEAR
                     </h2>
                 </div>

                 {/* QR Container: Massive, High Contrast, No shadows near code */}
                 {/* p-8 provides a large quiet zone. shape-rendering: crispEdges prevents anti-aliasing blur. */}
                 <div className="bg-white p-8 rounded-xl">
                    {shareUrl && (
                        <div style={{ width: '480px', height: '480px' }}>
                            <QRCode 
                                value={shareUrl} 
                                size={480}
                                level="L" 
                                fgColor="#000000"
                                bgColor="#FFFFFF"
                                style={{ height: "auto", maxWidth: "100%", width: "100%", shapeRendering: "crispEdges" }}
                            />
                        </div>
                    )}
                 </div>

                 <div className="space-y-2">
                    <p className="text-xl text-gray-600 font-medium">para cargar en</p>
                    <div className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-2xl shadow-lg">
                        prompt-studio.app
                    </div>
                 </div>
             </div>
        </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';
