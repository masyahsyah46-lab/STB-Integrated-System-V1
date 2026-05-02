import { create } from 'zustand';
import { User, ApplicationData, Language, UserRole } from '../types';
import { translations } from '../translations';
import { gasService } from '../services/gasService';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot, getDocs, setDoc, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface AppState {
  // Auth & User
  user: User | null;
  systemUsers: User[];
  setUser: (user: User | null) => void;
  setSystemUsers: (users: User[]) => void;
  
  // App Data
  applications: ApplicationData[];
  activeApplication: ApplicationData | null;
  setApplications: (apps: ApplicationData[]) => void;
  setActiveApplication: (app: ApplicationData | null) => void;
  
  // UI State
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  isLoading: boolean;
  loadingStep: number;
  setIsLoading: (loading: boolean) => void;
  setLoadingStep: (step: number) => void;
  isAutoSaved: boolean;
  setIsAutoSaved: (saved: boolean) => void;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  cartCount: number;
  setCartCount: (count: number) => void;
  isInboxOpen: boolean;
  setIsInboxOpen: (open: boolean) => void;
  
  // Audio State
  bgmVolume: number;
  sfxVolume: number;
  isBgmPlaying: boolean;
  setBgmVolume: (vol: number) => void;
  setSfxVolume: (vol: number) => void;
  setIsBgmPlaying: (playing: boolean) => void;
  
  // Derived / Actions
  t: (key: keyof typeof translations.ms) => string;
  getThemeColor: () => string;
  toggleLang: () => void;
  loadInitialData: () => Promise<void>;
  handleLogout: () => void;
  syncApplication: (data: ApplicationData) => Promise<boolean>;
  undoSync: (row: number, type: 'undo_syor' | 'undo_lulus') => Promise<boolean>;
  deleteApplication: (row: number) => Promise<boolean>;
  processAIExtraction: (text: string, type?: 'borang' | 'profile') => Promise<any>;
}

export const useStore = create<AppState>((set, get) => ({
  user: (() => {
    const saved = localStorage.getItem('stb_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      } catch (e) {}
    }
    return null;
  })(),
  systemUsers: [],
  applications: (() => {
    const saved = localStorage.getItem('stb_applications');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  })(),
  activeApplication: null,
  activeTab: 'dashboard',
  lang: (localStorage.getItem('stb_lang') as Language) || 'ms',
  isLoading: false,
  loadingStep: 0,
  isAutoSaved: false,
  unreadCount: 0,
  cartCount: 0,
  isInboxOpen: false,

  // Audio initial state
  bgmVolume: Number(localStorage.getItem('stb_bgm_vol')) || 0.5,
  sfxVolume: Number(localStorage.getItem('stb_sfx_vol')) || 0.7,
  isBgmPlaying: localStorage.getItem('stb_bgm_on') === 'true',

  setUser: (user) => {
    set({ user });
    if (user) {
      localStorage.setItem('stb_user', JSON.stringify(user));
      localStorage.setItem('stb_session_active', 'true');
    } else {
      localStorage.removeItem('stb_user');
      localStorage.removeItem('stb_user_email');
      localStorage.removeItem('stb_user_data');
      localStorage.removeItem('stb_session_active');
    }
  },
  
  setSystemUsers: (systemUsers) => set({ systemUsers }),
  setApplications: (applications) => {
    set({ applications });
    localStorage.setItem('stb_applications', JSON.stringify(applications));
  },
  setActiveApplication: (activeApplication) => set({ activeApplication }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLang: (lang) => {
    set({ lang });
    localStorage.setItem('stb_lang', lang);
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  setLoadingStep: (loadingStep) => set({ loadingStep }),
  setIsAutoSaved: (isAutoSaved) => {
    set({ isAutoSaved });
    if (isAutoSaved) setTimeout(() => set({ isAutoSaved: false }), 2000);
  },
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setCartCount: (cartCount) => set({ cartCount }),
  setIsInboxOpen: (isInboxOpen) => set({ isInboxOpen }),

  setBgmVolume: (bgmVolume) => {
    set({ bgmVolume });
    localStorage.setItem('stb_bgm_vol', String(bgmVolume));
  },
  setSfxVolume: (sfxVolume) => {
    set({ sfxVolume });
    localStorage.setItem('stb_sfx_vol', String(sfxVolume));
  },
  setIsBgmPlaying: (isBgmPlaying) => {
    set({ isBgmPlaying });
    localStorage.setItem('stb_bgm_on', String(isBgmPlaying));
  },

  t: (key) => {
    const { lang } = get();
    return translations[lang][key] || key;
  },

  getThemeColor: () => {
    const { user } = get();
    if (!user?.color) return 'blue';
    const c = user.color.toUpperCase();
    if (c === 'BIRU') return 'blue';
    if (c === 'HIJAU') return 'emerald';
    if (c === 'ORANGE' || c === 'ORANG' || c === 'OREN') return 'orange';
    if (c === 'UNGU') return 'purple';
    if (c === 'MERAH') return 'rose';
    if (c === 'MERAH JAMBU' || c === 'PINK') return 'pink';
    if (c === 'KUNING' || c === 'YELLOW') return 'yellow';
    return 'blue';
  },

  toggleLang: () => {
    const { lang } = get();
    const next = lang === 'ms' ? 'en' : 'ms';
    set({ lang: next });
    localStorage.setItem('stb_lang', next);
  },

  loadInitialData: async () => {
    const { user } = get();
    set({ isLoading: true, loadingStep: 10 });
    
    // Auto-login if session exists
    if (!user) {
      const email = localStorage.getItem('stb_user_email');
      const data = localStorage.getItem('stb_user_data');
      if (email && data) {
        try {
          const parsed = JSON.parse(data);
          set({ user: parsed });
        } catch (e) {}
      }
    }

    try {
      await ensureFirebaseAuth();
      const users = await gasService.fetchUsers();
      const normalizedUsers = (users || []).map(u => {
        let roleStr = String(u.role || 'pengesyor').toLowerCase().trim();
        let role: UserRole = 'pengesyor';
        
        if (roleStr.includes('ks spi') || roleStr.includes('ks_spi')) role = 'ks_spi';
        else if (roleStr.includes('ks sptb') || roleStr.includes('ks_sptb')) role = 'ks_sptb';
        else if (roleStr.includes('pp sptb') || roleStr.includes('pp_sptb')) role = 'pp_sptb';
        else if (roleStr.includes('pegawai siasatan 1') || roleStr.includes('pegawai_siasatan_1')) role = 'pegawai_siasatan_1';
        else if (roleStr.includes('pegawai siasatan 2') || roleStr.includes('pegawai_siasatan_2')) role = 'pegawai_siasatan_2';
        else if (roleStr.includes('pegawai siasatan biasa') || roleStr.includes('pegawai_siasatan_biasa')) role = 'pegawai_siasatan_biasa';
        else if (roleStr.includes('pemerhati')) role = 'pemerhati';
        else if (roleStr.includes('pegawai tatatertib')) role = 'pegawai_tatatertib';
        else if (roleStr.includes('penyiasat')) role = 'penyiasat';
        else if (roleStr.includes('pelulus')) role = 'pelulus';
        else if (roleStr.includes('pengesyor')) role = 'pengesyor';
        else role = 'pengesyor';

        let cidbEndsWith: string[] = [];
        let alphaSplit: Record<string, string> = {};

        if (roleStr.includes(' - ')) {
          const [r, details] = roleStr.split(' - ');
          const baseRole = r.trim().toLowerCase();
          if (baseRole.includes('pelulus')) role = 'pelulus';
          else if (baseRole.includes('pengesyor')) role = 'pengesyor';
          
          const parts = details.split(',').map(p => p.trim());
          parts.forEach(p => {
            const match = p.match(/(\d+)\((.*)\)/);
            if (match) {
              const digit = match[1];
              const range = match[2];
              cidbEndsWith.push(digit);
              alphaSplit[digit] = range;
            } else if (/^\d+$/.test(p)) {
              cidbEndsWith.push(p);
            }
          });
        }

        let rawCidb = u.cidbEndsWith;
        if (typeof rawCidb === 'string' && rawCidb.trim() !== '') {
          cidbEndsWith = rawCidb.split(',').map(s => s.trim());
        } else if (Array.isArray(rawCidb)) {
          cidbEndsWith = rawCidb;
        }

        let rawAlpha = u.alphaSplit;
        if (typeof rawAlpha === 'string' && rawAlpha.trim() !== '') {
          try {
            alphaSplit = JSON.parse(rawAlpha);
          } catch (e) {}
        } else if (typeof rawAlpha === 'object') {
          alphaSplit = rawAlpha;
        }

        return {
          ...u,
          id: String(u.id || u.pin || `user-${Math.random().toString(36).substr(2, 9)}`),
          pin: String(u.pin || ''),
          role,
          cidbEndsWith,
          alphaSplit,
          source: u.source,
          hasSpiAccess: u.hasSpiSource || 
                        roleStr.includes('spi') || 
                        roleStr.includes('siasatan') || 
                        roleStr.includes('penyiasat') || 
                        roleStr.includes('pemerhati') || 
                        roleStr.includes('tatatertib')
        };
      });
      set({ systemUsers: normalizedUsers, loadingStep: 40 });

      const remoteData = await gasService.fetchAll(user?.role, user?.source);
      set({ loadingStep: 60 });
      
      let firestoreApps: any[] = [];
      if (user?.id) {
        try {
          const q = query(collection(db, "applications"), where("pengesyor_id", "==", user.id));
          const querySnapshot = await getDocs(q);
          firestoreApps = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (e) {}
      }

      if (remoteData && Array.isArray(remoteData)) {
        const sanitizedData = remoteData.map((item: any) => {
          const id = item.id || (item.row ? `row-${item.row}` : crypto.randomUUID());
          const fsMatch = firestoreApps.find(fs => 
            fs.cidb === item.cidb && 
            (fs.transaction_code === item.transaction_code || fs.transactionCode === item.transactionCode)
          );
          return {
             ...item,
            id,
            catatan: fsMatch?.catatan || item.catatan || '',
            firebaseDocId: fsMatch?.id || item.firebaseDocId
          };
        });
        set({ applications: sanitizedData });
        localStorage.setItem('stb_applications', JSON.stringify(sanitizedData));
      }
    } catch (err) {
      console.error("Initialization Error:", err);
    } finally {
      set({ loadingStep: 100 });
      setTimeout(() => set({ isLoading: false, loadingStep: 0 }), 500);
    }
  },

  handleLogout: () => {
    const { lang } = get();
    if (confirm(lang === 'en' ? "Are you sure you want to logout?" : "Adakah anda pasti ingin log keluar?")) {
      set({ user: null, activeTab: 'dashboard', activeApplication: null });
      localStorage.removeItem('stb_user');
      localStorage.removeItem('stb_user_email');
      localStorage.removeItem('stb_user_data');
      localStorage.removeItem('stb_session_active');
      localStorage.removeItem('stb_applications');
      
      // Clear Google Auth token if needed or just reload to reset state
      window.location.reload();
    }
  },

  syncApplication: async (data: ApplicationData) => {
    const { user, applications, activeApplication } = get();
    const newList = applications.map(a => a.id === data.id ? data : a);
    
    const isUpdatingActive = activeApplication?.id === data.id;
    
    set({ 
      applications: newList, 
      isAutoSaved: true,
      activeApplication: isUpdatingActive ? data : activeApplication
    });
    localStorage.setItem('stb_applications', JSON.stringify(newList));
    
    // Add logic to handle auto-email to SPI if triggered
    const syncResult = await gasService.saveRecord(data, user?.role, user?.source);
    setTimeout(() => set({ isAutoSaved: false }), 2000);
    return syncResult.success;
  },

  undoSync: async (row: number, type: 'undo_syor' | 'undo_lulus') => {
    const { user, loadInitialData } = get();
    if (!user) return false;
    
    set({ isLoading: true });
    const success = await gasService.undoAction(row, type, user.name);
    if (success) {
      await loadInitialData();
      toast.success(type === 'undo_syor' ? "Syor telah dibatalkan" : "Keputusan telah dibatalkan");
    } else {
      toast.error("Gagal melakukan tindakan undo");
    }
    set({ isLoading: false });
    return success;
  },

  deleteApplication: async (row: number) => {
    const { user, loadInitialData } = get();
    if (!user) return false;

    set({ isLoading: true });
    const success = await gasService.deleteRecord(row, user.name);
    if (success) {
      await loadInitialData();
      toast.success("Rekod telah dipadam");
    } else {
      toast.error("Gagal memadam rekod");
    }
    set({ isLoading: false });
    return success;
  },

  processAIExtraction: async (text: string, type: 'borang' | 'profile' = 'borang') => {
    return await gasService.processAI(text, type);
  }
}));
