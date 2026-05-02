import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Icons } from '../constants';

const AudioController: React.FC = () => {
  const { 
    isBgmPlaying, 
    bgmVolume, 
    sfxVolume, 
    setIsBgmPlaying, 
    setBgmVolume, 
    setSfxVolume,
    lang
  } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playlist = ['/audio/lagu1.mp3', '/audio/lagu2.mp3', '/audio/lagu3.mp3'];
  const currentTrack = useRef(0);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(playlist[currentTrack.current]);
      audioRef.current.loop = false;
      audioRef.current.addEventListener('ended', () => {
        currentTrack.current = (currentTrack.current + 1) % playlist.length;
        if (audioRef.current) {
          audioRef.current.src = playlist[currentTrack.current];
          if (isBgmPlaying) audioRef.current.play().catch(() => {});
        }
      });
    }

    if (isBgmPlaying) {
      audioRef.current.play().catch(() => {
        // Autoplay might be blocked by browser
        setIsBgmPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }

    return () => {
      // Keep playing or stop on unmount? Usually background audio stays
    };
  }, [isBgmPlaying, setIsBgmPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center gap-6 print:hidden">
      <button 
        onClick={() => setIsBgmPlaying(!isBgmPlaying)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${
          isBgmPlaying 
          ? `bg-${themeColor}-600 text-white shadow-lg shadow-${themeColor}-500/20` 
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        {isBgmPlaying ? <Icons.CheckCircle size={14} /> : <Icons.Drafts size={14} />}
        {isBgmPlaying 
          ? (isEn ? "Pause Music" : "Jeda Muzik") 
          : (isEn ? "Play Music" : "Main Muzik")}
      </button>

      <div className="flex items-center gap-3 min-w-[150px] flex-1">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
          {isEn ? "Music Vol" : "Vol Muzik"}
        </span>
        <input 
          type="range" 
          min="0" max="1" step="0.1" 
          value={bgmVolume}
          onChange={e => {
            const v = parseFloat(e.target.value);
            setBgmVolume(v);
            localStorage.setItem('stb_bgm_vol', v.toString());
          }}
          className={`h-1.5 flex-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-${themeColor}-600`}
        />
        <span className="text-[10px] font-bold text-slate-600 min-w-[30px]">
          {Math.round(bgmVolume * 100)}%
        </span>
      </div>

      <div className="flex items-center gap-3 min-w-[150px] flex-1 border-l border-slate-100 pl-6">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
          {isEn ? "SFX Vol" : "Vol SFX"}
        </span>
        <input 
          type="range" 
          min="0" max="1" step="0.1" 
          value={sfxVolume}
          onChange={e => {
            const v = parseFloat(e.target.value);
            setSfxVolume(v);
            localStorage.setItem('stb_sfx_vol', v.toString());
          }}
          className={`h-1.5 flex-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-${themeColor}-600`}
        />
        <span className="text-[10px] font-bold text-slate-600 min-w-[30px]">
          {Math.round(sfxVolume * 100)}%
        </span>
      </div>
    </div>
  );
};

export default AudioController;
