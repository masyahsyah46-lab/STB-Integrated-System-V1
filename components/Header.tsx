
import React from 'react';
import { useStore } from '../store/useStore';
import { Mail, User, LogOut } from 'lucide-react';

const Header: React.FC = () => {
  const { user, lang, toggleLang, handleLogout, unreadCount, t, setIsInboxOpen } = useStore();
  const themeColor = useStore(state => state.getThemeColor());

  if (!user) return null;

  const colorStyles = {
    blue: 'bg-blue-600 shadow-blue-500/20',
    emerald: 'bg-emerald-600 shadow-emerald-500/20',
    orange: 'bg-orange-500 shadow-orange-500/20',
    indigo: 'bg-indigo-600 shadow-indigo-500/20',
    rose: 'bg-rose-600 shadow-rose-500/20',
    pink: 'bg-pink-600 shadow-pink-500/20',
    purple: 'bg-purple-600 shadow-purple-500/20',
    yellow: 'bg-yellow-500 shadow-yellow-500/20',
  }[themeColor] || 'bg-blue-600 shadow-blue-500/20';

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50 print:hidden">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center transition-all">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Coat_of_arms_of_Malaysia.svg/500px-Coat_of_arms_of_Malaysia.svg.png" 
              alt="Jata Negara" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-slate-800 font-black tracking-tight uppercase leading-none">{t('system_name')}</h1>
            <p className="text-[9px] font-black text-slate-400 tracking-widest mt-0.5">{t('version')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setIsInboxOpen(true)}
            className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-all group flex items-center justify-center"
          >
            <Mail size={22} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          <button 
            onClick={toggleLang}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-200 transition-all border border-slate-200"
          >
            {lang === 'ms' ? 'EN' : 'MS'}
          </button>

          <div 
            className="flex items-center gap-3 p-1 rounded-xl transition-all border border-transparent"
          >
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 leading-none mb-1 uppercase">{user.id}</p>
              <p className="text-sm font-black text-slate-800 leading-none uppercase">{user.name}</p>
            </div>
            <div className={`w-10 h-10 border-2 border-white shadow-sm overflow-hidden rounded-full flex items-center justify-center bg-slate-50 text-slate-400`}>
               <User size={20} />
            </div>
            <button 
              onClick={handleLogout}
              className="ml-2 p-2 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-all"
              title={t('logout')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
