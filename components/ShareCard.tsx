import React, { forwardRef } from 'react';
import { SavedPrompt } from '../types';
import { PROMPT_TYPE_CONFIG } from '../config';
import { DNAIcon } from './icons/DNAIcon';
import QRCode from 'react-qr-code';

interface ShareCardProps {
  promptData: SavedPrompt;
  shareUrl: string;
}

// Fixed dimensions for a "Story" or high-res mobile format
// 1080px wide is standard for high quality social sharing
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(({ promptData, shareUrl }, ref) => {
  const { className: typeBadgeClass, text: typeText } = PROMPT_TYPE_CONFIG[promptData.type] || PROMPT_TYPE_CONFIG['style'];
  const isHybrid = promptData.isHybrid || promptData.type === 'hybrid';

  return (
    <div 
        ref={ref} 
        className="w-[1080px] h-[1620px] bg-[#0A0814] relative overflow-hidden flex flex-col font-sans text-white"
        style={{
            backgroundImage: `
                radial-gradient(at 27% 37%, hsla(190, 98%, 61%, 0.08) 0px, transparent 50%),
                radial-gradient(at 97% 21%, hsla(175, 98%, 72%, 0.1) 0px, transparent 50%),
                radial-gradient(at 52% 99%, hsla(45, 98%, 76%, 0.1) 0px, transparent 50%)
            `
        }}
    >
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

        {/* Content Container */}
        <div className="flex-grow p-12 flex flex-col z-10">
            
            {/* Header / Branding */}
            <div className="flex justify-between items-center mb-8 opacity-80">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                       <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.686-2.686L11 17.25l1.938-.648a3.375 3.375 0 002.686-2.686L16.25 12l.648 1.938a3.375 3.375 0 002.686 2.686L21.5 17.25l-1.938.648a3.375 3.375 0 00-2.686 2.686z" /></svg>
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-white">Prompt Studio</span>
                </div>
                <div className="px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-sm font-medium text-gray-300">
                    AI Generated
                </div>
            </div>

            {/* Main Image Card */}
            <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 relative mb-10 bg-gray-800">
                {promptData.coverImage ? (
                    <img src={promptData.coverImage} alt={promptData.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                        <span className="text-gray-500 text-2xl font-mono">NO IMAGE</span>
                    </div>
                )}
                {/* Badge Overlay */}
                <div className={`absolute top-6 right-6 px-5 py-2 rounded-full font-bold text-lg shadow-lg uppercase tracking-wide flex items-center gap-2 ${typeBadgeClass}`}>
                    {isHybrid && <DNAIcon className="w-5 h-5" />}
                    {typeText}
                </div>
            </div>

            {/* Metadata Section */}
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 leading-tight line-clamp-2">
                    {promptData.title}
                </h1>
                <div className="flex items-center gap-4 text-2xl text-teal-400 font-medium">
                    <span>{promptData.category}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                    <span className="text-indigo-300">{promptData.artType}</span>
                </div>
            </div>

            {/* Prompt Box */}
            <div className="flex-grow bg-white/5 rounded-3xl p-8 border border-white/10 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-500 to-indigo-600"></div>
                <h3 className="text-gray-400 text-lg font-bold uppercase tracking-widest mb-4">Prompt</h3>
                <p className="text-2xl leading-relaxed font-mono text-gray-100 whitespace-pre-wrap">
                    {promptData.prompt.length > 550 
                        ? promptData.prompt.substring(0, 550) + "..." 
                        : promptData.prompt}
                </p>
                
                {promptData.negativePrompt && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <h3 className="text-red-400 text-base font-bold uppercase tracking-widest mb-2">Negative</h3>
                        <p className="text-lg leading-relaxed font-mono text-red-200/80">
                            {promptData.negativePrompt.length > 150 
                                ? promptData.negativePrompt.substring(0, 150) + "..."
                                : promptData.negativePrompt}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer with QR Code */}
            <div className="mt-8 flex justify-between items-end h-32">
                <div className="text-gray-500 font-mono text-sm self-end pb-2">
                    <p>ID: {promptData.id.slice(-8)}</p>
                    <p>{new Date().toLocaleDateString()}</p>
                </div>
                
                {shareUrl && (
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="text-right">
                            <p className="text-white font-bold text-lg leading-none mb-1">SCAN TO EDIT</p>
                            <p className="text-teal-400 text-xs font-mono uppercase tracking-wider">Load in App</p>
                        </div>
                        <div className="p-2 bg-white rounded-lg">
                            <QRCode 
                                value={shareUrl} 
                                size={80} 
                                level="L"
                                fgColor="#000000"
                                bgColor="#FFFFFF"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';