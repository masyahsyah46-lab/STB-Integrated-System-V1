
import React, { useState } from 'react';
import { useStore } from '../store/useStore';

interface LoginProps {}

const Login: React.FC<LoginProps> = ({}) => {
  const { systemUsers, isLoading, lang, toggleLang, t, setUser } = useStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const user = systemUsers.find(u => u.pin === pin);
    if (user) {
      setUser(user);
    } else {
      setError(t('invalid_pin'));
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 right-6">
        <button 
          onClick={toggleLang}
          className="bg-white/10 backdrop-blur hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-black transition-all border border-white/20"
        >
          {lang === 'ms' ? '🇺🇸 ENGLISH' : '🇲🇾 B. MALAYSIA'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-white/20">
        <div className="flex flex-col items-center mb-8">
          <div className="relative group mb-6">
            <div className="absolute inset-0 bg-slate-200 blur-2xl opacity-20 scale-150 rounded-full group-hover:opacity-30 transition-opacity"></div>
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Coat_of_arms_of_Malaysia.svg/500px-Coat_of_arms_of_Malaysia.svg.png" 
              alt="Jata Negara" 
              className="w-28 h-auto relative z-10 drop-shadow-2xl animate-in zoom-in duration-700"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight text-center uppercase leading-none">{t('system_name')}</h1>
          <p className="text-slate-400 font-black text-[10px] mt-2 tracking-widest uppercase">{t('version')}</p>
          <div className="mt-4 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">
              {lang === 'ms' ? 'SISTEM DALAMAN RASMI' : 'OFFICIAL INTERNAL SYSTEM'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-slate-400 font-black mb-2 text-[10px] uppercase tracking-[0.2em] text-center">{t('pin_label')}</label>
            <input 
              type="password" 
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full text-center text-3xl tracking-[1.5em] py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-blue-500 focus:bg-white transition-all outline-none font-black"
              placeholder="0000"
            />
          </div>

          {error && <p className="text-rose-500 text-center font-black text-[10px] uppercase animate-shake">{error}</p>}
          
          {systemUsers.length === 0 && !isLoading && (
            <div className="flex flex-col gap-2">
              <p className="text-amber-600 text-center font-black text-[10px] uppercase">
                {lang === 'ms' ? 'Tiada data pengguna ditemui.' : 'No user data found.'}
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="text-slate-500 hover:text-black text-[10px] font-bold underline uppercase"
              >
                {lang === 'ms' ? 'Muat Semula Halaman' : 'Reload Page'}
              </button>
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoading || systemUsers.length === 0}
            className="w-full py-5 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-black rounded-3xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            {isLoading ? `${t('processing')}...` : t('login')}
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
             <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
             <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest">
               {isLoading ? (lang === 'ms' ? 'Menghubungkan database...' : 'Connecting database...') : (lang === 'ms' ? 'Sistem Sedia' : 'System Ready')}
             </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 max-w-sm text-center">
        <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] leading-relaxed">
          {lang === 'ms' 
            ? 'Sistem ini adalah untuk kegunaan dalaman rasmi sahaja. Segala aktiviti akan direkodkan.' 
            : 'This system is for official internal use only. All activities are recorded.'}
        </p>
      </div>
    </div>
  );
};

export default Login;
