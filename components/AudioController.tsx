import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Icons } from '../constants';
import { audioManager } from '../utils/audioManager';

const AudioController: React.FC = () => {
  const { 
    lang
  } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';
  
  const [isMuted, setIsMuted] = useState(false);
  const [bgmVol, setBgmVol] = useState(0.3);
  const [sfxVol, setSfxVol] = useState(0.5);

  const toggleMute = () => {
    const newMuteStatus = audioManager.toggleMute();
    setIsMuted(newMuteStatus);
  };

  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center gap-6 print:hidden">
      <button 
        onClick={toggleMute}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${
          !isMuted 
          ? `bg-${themeColor}-600 text-white shadow-lg shadow-${themeColor}-500/20` 
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        {!isMuted ? <Icons.CheckCircle size={14} /> : <Icons.Drafts size={14} />}
        {!isMuted 
          ? (isEn ? "Audio Active" : "Audio Aktif") 
          : (isEn ? "Muted" : "Senyap")}
      </button>

      <div className="flex items-center gap-3 min-w-[150px] flex-1">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
          {isEn ? "Global Audio Control" : "Kawalan Audio Global"}
        </p>
      </div>

      <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
           {isEn ? "Browser Autoplay Optimized" : "Optimasi Autoplay Pelayar"}
        </p>
      </div>
    </div>
  );
};

export default AudioController;
