
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { gasService } from '../services/gasService';
import { signInWithGoogle } from '../services/firebaseService';
import { toast } from 'sonner';

/**
 * Legacy PIN Mapping for SPTB Integrated System V3
 * Maps specific staff emails to their required system PINs
 */
const EMAIL_PIN_MAPPING: Record<string, string> = {
  'khairulfitri.kamaruddin@kuskop.gov.my': '5381',
  'zariff.zainudin@kuskop.gov.my': '0707',
  'norhamizi.hamdzah@kuskop.gov.my': '5757',
  'ilyanadia.azmi@kuskop.gov.my': '6166'
};

const Login: React.FC = () => {
  const { lang, toggleLang, t, setUser, isLoading, setIsLoading } = useStore();
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      const googleUser = await signInWithGoogle();
      const email = googleUser.email?.toLowerCase() || '';

      // Domain validation
      if (!email.endsWith("@kuskop.gov.my") && !email.endsWith("@medac.gov.my")) {
        setError(lang === 'ms' ? "Sila guna e-mel rasmi @kuskop.gov.my" : "Please use official @kuskop.gov.my email");
        setIsLoading(false);
        return;
      }

      // Verify access and get profile from Google Sheets
      const result = await gasService.checkAuth(email);
      
      // TAMBAHAN: Kita tambah "&& result.user" untuk pastikan data pengguna wujud sebelum teruskan
      if (result && result.status === 'success' && result.user) {
        const userData = result.user;
        
        // Inject PIN for legacy Firebase functionality
        if (EMAIL_PIN_MAPPING[email]) {
          userData.pin = EMAIL_PIN_MAPPING[email];
          console.log(`PIN mapping applied for ${email}`);
        }

        // Save session
        localStorage.setItem('stb_user_email', email);
        localStorage.setItem('stb_user_data', JSON.stringify(userData));
        setUser(userData);
        
        toast.success(lang === 'ms' ? `Selamat Datang, ${userData.name}` : `Welcome, ${userData.name}`);
      } else {
        setError(lang === 'ms' 
          ? "Akses Ditolak: Profil e-mel anda tiada dalam pangkalan data sistem (Google Sheets)." 
          : "Access Denied: Your email profile is not in the system database (Google Sheets).");
      }

        // Save session
        localStorage.setItem('stb_user_email', email);
        localStorage.setItem('stb_user_data', JSON.stringify(userData));
        setUser(userData);
        
        toast.success(lang === 'ms' ? `Selamat Datang, ${userData.name}` : `Welcome, ${userData.name}`);
      } else {
        setError(lang === 'ms' 
          ? "Akses Ditolak: E-mel anda tiada dalam pangkalan data sistem." 
          : "Access Denied: Your email is not in the system database.");
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(lang === 'ms' ? "Ralat log masuk Google. Sila cuba lagi." : "Google Login Error. Please try again.");
      }
    } finally {
      setIsLoading(false);
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

      <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-white/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
        
        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="relative group mb-8">
            <div className="absolute inset-0 bg-slate-200 blur-2xl opacity-20 scale-150 rounded-full group-hover:opacity-30 transition-opacity"></div>
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Coat_of_arms_of_Malaysia.svg/500px-Coat_of_arms_of_Malaysia.svg.png" 
              alt="Jata Negara" 
              className="w-32 h-auto relative z-10 drop-shadow-2xl animate-in zoom-in duration-700"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight text-center uppercase leading-none px-4">
            {lang === 'ms' ? 'SISTEM TERSEPADU SPTB' : 'SPTB INTEGRATED SYSTEM'}
          </h1>
          <p className="text-slate-400 font-black text-[10px] mt-3 tracking-[0.3em] uppercase">{t('version')}</p>
          
          <div className="mt-6 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center leading-relaxed">
              {lang === 'ms' 
                ? 'Sila log masuk menggunakan E-mel Rasmi Kementerian (@kuskop.gov.my)' 
                : 'Please login using Official Ministry Email (@kuskop.gov.my)'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-100 p-4 rounded-2xl hover:bg-slate-50 hover:border-blue-500 transition-all group active:scale-95 disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            <span className="text-sm font-black text-slate-700 uppercase tracking-widest">
              {isLoading ? (lang === 'ms' ? "Memproses..." : "Processing...") : (lang === 'ms' ? "Log Masuk Google" : "Sign In with Google")}
            </span>
          </button>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl w-full text-center">
              <p className="text-rose-600 font-black text-[10px] uppercase tracking-wide leading-relaxed">{error}</p>
            </div>
          )}
        </div>
        
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-100">
             <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
             <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest">
               {lang === 'ms' ? 'Pusat Log Masuk Berpusat (SSO)' : 'Centralized Login Center (SSO)'}
             </p>
          </div>
        </div>
      </div>
      
      <div className="mt-10 max-w-sm text-center px-4">
        <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] leading-relaxed">
          {lang === 'ms' 
            ? 'Akses terhad untuk kakitangan KUSKOP sahaja. Segala transaksi dan aktiviti direkodkan untuk tujuan audit.' 
            : 'Access restricted to KUSKOP staff only. All transactions and activities are recorded for audit purposes.'}
        </p>
      </div>
    </div>
  );
};

export default Login;
