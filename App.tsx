
import React, { useEffect } from 'react';
import { User, UserRole, ApplicationData, Personnel } from './types';
import Login from './components/Login';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import FrozenApplications from './components/FrozenApplications';
import RepeatedAnalysis from './components/RepeatedAnalysis';
import BorangSemakan from './components/BorangSemakan';
import TapisanExcel from './components/TapisanExcel';
import InputDatabase from './components/InputDatabase';
import ListApplications from './components/ListApplications';
import DecisionPanel from './components/DecisionPanel';
import ReviewSummary from './components/ReviewSummary';
import ListSiasatan from './components/ListSiasatan';
import InboxPanel from './components/InboxPanel';
import SpiDashboard from './components/SpiDashboard';
import DashboardKS from './components/DashboardKS';
import ProfileSyarikat from './components/ProfileSyarikat';
import AudioController from './components/AudioController';
import InactivityHandler from './components/InactivityHandler';
import { Icons } from './constants';
import { gasService } from './services/gasService';
import { Toaster, toast } from 'sonner';
import SnailProgress from './components/SnailProgress';
import { db, ensureFirebaseAuth } from './services/firebaseService';
import { doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useStore } from './store/useStore';
import { audioManager } from './utils/audioManager';

export type Language = 'ms' | 'en';

const TabBtn: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string, disabled?: boolean }> = ({ active, onClick, icon, label, disabled }) => {
  const themeColor = useStore(state => state.getThemeColor());
  const colorClass = active ? `bg-${themeColor}-600 text-white shadow-md shadow-${themeColor}-500/20` : 'text-slate-600 hover:bg-slate-100';
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[11px] font-black transition-all ${colorClass} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {icon} <span className="hidden md:inline uppercase tracking-tighter">{label}</span>
    </button>
  );
};

const App: React.FC = () => {
  const {
    user, setUser,
    systemUsers,
    activeTab, setActiveTab,
    isLoading,
    loadingStep,
    applications, setApplications,
    activeApplication, setActiveApplication,
    isAutoSaved, setIsAutoSaved,
    cartCount, setCartCount,
    lang, setLang,
    unreadCount, setUnreadCount,
    setIsInboxOpen,
    t, loadInitialData, handleLogout
  } = useStore();

  const themeColor = useStore(state => state.getThemeColor());

  // Initialize Global Audio
  useEffect(() => {
    audioManager.setupGlobalClicks();
    
    // Auto-resume BGM on first user interaction (browser policy compliance)
    const handleFirstInteraction = () => {
      audioManager.playBGM();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // Real-time unread notifications count
  useEffect(() => {
    if (!user?.id) return;

    let unsubId: (() => void) | undefined;
    let unsubRole: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      const authOk = await ensureFirebaseAuth();
      if (!authOk || !isMounted) {
        if (!authOk) console.error("Skipping notification listener: Auth failed");
        return;
      }
      
      // Query for unread messages where receiverId is user.id
      const qId = query(
        collection(db, "notifications"),
        where("receiverId", "==", user.id),
        where("status", "==", "BELUM LIHAT")
      );

      // Query for unread messages where receiverRole is user.role
      const qRole = query(
        collection(db, "notifications"),
        where("receiverRole", "==", user.role),
        where("status", "==", "BELUM LIHAT")
      );

      let countId = 0;
      let countRole = 0;

      unsubId = onSnapshot(qId, (snapshot) => {
        countId = snapshot.size;
        setUnreadCount(countId + countRole);
      }, (error) => {
        console.warn("Firestore Unread Count (ID) Error:", error);
      });

      unsubRole = onSnapshot(qRole, (snapshot) => {
        countRole = snapshot.size;
        setUnreadCount(countId + countRole);
      }, (error) => {
        console.warn("Firestore Unread Count (Role) Error:", error);
      });
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubId) unsubId();
      if (unsubRole) unsubRole();
    };
  }, [user?.id, user?.role, setUnreadCount]);

  // Real-time cart count for badge
  useEffect(() => {
    if (!user?.id || user.role !== 'pengesyor') return;

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      const authOk = await ensureFirebaseAuth();
      if (!authOk || !isMounted) {
        if (!authOk) console.error("Skipping cart count listener: Auth failed");
        return;
      }
      const q = query(
        collection(db, "applications"), 
        where("processedBy", "==", user.id),
        where("status", "==", "Pending")
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        setCartCount(snapshot.size);
      }, (error) => {
        console.warn("Firestore Cart Count Error:", error);
      });
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, user?.role, setCartCount]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleLogin = async (u: User) => {
    setUser(u);
    await ensureFirebaseAuth();
    setActiveTab('dashboard');
    toast.success(lang === 'ms' ? `Selamat Datang, ${u.name}` : `Welcome, ${u.name}`);
  };

  const renderTabContent = () => {
    if (!user) return null;

    if (user.role === 'pengesyor') {
      switch (activeTab) {
        case 'dashboard': return <Dashboard />;
        case 'borang': return (
          <BorangSemakan />
        );
        case 'tapisan': return (
          <TapisanExcel 
            view="filtering"
          />
        );
        case 'bakul': return (
          <TapisanExcel 
            view="cart"
          />
        );
        case 'database': return (
          <InputDatabase />
        );
        case 'drafts': {
          return <ListApplications type="drafts" />;
        }
        case 'submitted': {
          return <ListApplications type="submitted" />;
        }
        case 'profile': return <ProfileSyarikat />;
        case 'preview': return <ReviewSummary />;
        case 'spi_dashboard':
          return (
            <SpiDashboard />
          );
        case 'siasatan': 
          return (
            <ListSiasatan 
              view="dashboard"
            />
          );
        default: return <Dashboard />;
      }
    } else if (user.role === 'ks_sptb' || user.role === 'pp_sptb') {
      switch (activeTab) {
        case 'dashboard_ks': return <DashboardKS />;
        case 'inbox_semakan': return <ListApplications type="inbox_semakan" />;
        case 'semakan': return <ListApplications type="semakan" />;
        case 'telah_semak': return <ListApplications type="telah_semak" />;
        case 'all_drafts': return <ListApplications type="all_drafts" />;
        case 'all_inbox': return <ListApplications type="inbox" />;
        case 'all_history': return <ListApplications type="history" />;
        case 'preview': return <ReviewSummary />;
        case 'beku': return <FrozenApplications />;
        case 'analisis_berulang': return <RepeatedAnalysis />;
        default: return <DashboardKS />;
      }
    } else if (user.role.includes('spi') || user.role.includes('siasatan') || ['pemerhati', 'pegawai_tatatertib', 'penyiasat'].includes(user.role)) {
      // SPI Module Routing
      switch (activeTab) {
        case 'dashboard': return (
          <SpiDashboard />
        );
        case 'siasatan': 
          return (
            <ListSiasatan 
              view={activeTab as any}
            />
          );
        case 'preview': return <ReviewSummary />;
        default: return (
          <SpiDashboard />
        );
      }
    } else {
      const pendingApps = (applications || []).filter(a => !!a.tarikh_syor && !a.tarikh_lulus);
      
      switch (activeTab) {
        case 'dashboard': return <Dashboard />;
        case 'inbox': return <ListApplications type="inbox" />;
        case 'preview': return <ReviewSummary />;
        case 'spi_dashboard':
          return (
            <SpiDashboard />
          );
        case 'decision': return <DecisionPanel />;
        case 'history': return <ListApplications type="history" />;
        case 'siasatan': 
          return (
            <ListSiasatan 
              view="dashboard"
            />
          );
        default: return <Dashboard />;
      }
    }
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 relative overflow-hidden">
      <Toaster position="top-center" richColors />
      <InactivityHandler />
      {/* Animated Background Layer */}
      <div className="fixed inset-0 animated-bg opacity-5 pointer-events-none z-0 print:hidden" />
      
      <div className="relative z-10 flex flex-col min-h-screen print:min-h-0">
        <Header />
        
        <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-6 pb-20 print:p-0 print:max-w-none">
        <div className="mb-6">
          <AudioController />
        </div>
        <nav className="flex bg-white/80 backdrop-blur rounded-xl p-1 mb-6 border border-slate-200 shadow-sm sticky top-4 z-40 overflow-x-auto no-scrollbar print:hidden">
          {user.role === 'pengesyor' ? (
            <>
              <TabBtn active={activeTab === 'dashboard'} onClick={() => { setActiveApplication(null); setActiveTab('dashboard'); }} icon={<Icons.Dashboard />} label={t('dashboard')} />
              <TabBtn active={activeTab === 'tapisan'} onClick={() => { setActiveApplication(null); setActiveTab('tapisan'); }} icon={<Icons.Filter />} label={t('tapisan')} />
              <TabBtn 
                active={activeTab === 'bakul'} 
                onClick={() => { setActiveApplication(null); setActiveTab('bakul'); }} 
                icon={
                  <div className="relative">
                    <Icons.Cart />
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in">
                        {cartCount}
                      </span>
                    )}
                  </div>
                } 
                label={t('bakul')} 
              />
              <TabBtn active={activeTab === 'borang'} onClick={() => { 
                if (activeTab !== 'borang' || activeApplication !== null) {
                  localStorage.removeItem('stb_form_persistence');
                }
                setActiveApplication(null); 
                setActiveTab('borang'); 
              }} icon={<Icons.Form />} label={t('borang_semakan')} />
              <TabBtn active={activeTab === 'database'} onClick={() => setActiveTab('database')} icon={<Icons.Database />} label={t('input_database')} />
              <TabBtn active={activeTab === 'drafts'} onClick={() => { setActiveApplication(null); setActiveTab('drafts'); }} icon={<Icons.Drafts />} label={t('belum_hantar')} />
              <TabBtn active={activeTab === 'submitted'} onClick={() => { setActiveApplication(null); setActiveTab('submitted'); }} icon={<Icons.Submitted />} label={t('telah_disyor')} />
              <TabBtn active={activeTab === 'profile'} onClick={() => { setActiveApplication(null); setActiveTab('profile'); }} icon={<Icons.Form />} label="Profile Syarikat" />
              {user.hasSpiAccess && (
                <>
                  <TabBtn active={activeTab === 'spi_dashboard'} onClick={() => { setActiveApplication(null); setActiveTab('spi_dashboard'); }} icon={<Icons.Dashboard />} label="Dashboard SPI" />
                  <TabBtn active={activeTab === 'siasatan'} onClick={() => { setActiveApplication(null); setActiveTab('siasatan'); }} icon={<Icons.Filter />} label="Siasatan SPI" />
                </>
              )}
            </>
          ) : (user.role === 'ks_sptb' || user.role === 'pp_sptb') ? (
            <>
              <TabBtn active={activeTab === 'dashboard_ks'} onClick={() => setActiveTab('dashboard_ks')} icon={<Icons.Dashboard />} label="Utama" />
              <TabBtn active={activeTab === 'inbox_semakan'} onClick={() => setActiveTab('inbox_semakan')} icon={<Icons.Inbox />} label="Inbox Semakan" />
              <TabBtn active={activeTab === 'semakan'} onClick={() => setActiveTab('semakan')} icon={<Icons.Form />} label="Semakan" />
              <TabBtn active={activeTab === 'telah_semak'} onClick={() => setActiveTab('telah_semak')} icon={<Icons.CheckCircle />} label="Telah Semak" />
              <TabBtn active={activeTab === 'all_drafts'} onClick={() => setActiveTab('all_drafts')} icon={<Icons.Filter />} label="Belum Syor" />
              <TabBtn active={activeTab === 'all_inbox'} onClick={() => setActiveTab('all_inbox')} icon={<Icons.Inbox />} label="Inbox Pelulus" />
              <TabBtn active={activeTab === 'all_history'} onClick={() => setActiveTab('all_history')} icon={<Icons.History />} label="Sejarah" />
            </>
          ) : user.role === 'pelulus' ? (
            <>
              <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard />} label={t('dashboard')} />
              <TabBtn active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} icon={<Icons.Inbox />} label={t('inbox')} />
              <TabBtn active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Icons.Form />} label={t('semakan')} disabled={!activeApplication} />
              <TabBtn active={activeTab === 'decision'} onClick={() => setActiveTab('decision')} icon={<Icons.Decision />} label={t('keputusan')} disabled={!activeApplication} />
              <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Icons.History />} label={t('sejarah')} />
              {user.hasSpiAccess && (
                <>
                  <TabBtn active={activeTab === 'spi_dashboard'} onClick={() => { setActiveApplication(null); setActiveTab('spi_dashboard'); }} icon={<Icons.Dashboard />} label="Dashboard SPI" />
                  <TabBtn active={activeTab === 'siasatan'} onClick={() => { setActiveApplication(null); setActiveTab('siasatan'); }} icon={<Icons.Filter />} label="Siasatan SPI" />
                </>
              )}
            </>
          ) : (user.role === 'ks_spi' || user.role === 'pemerhati') ? (
            <>
              <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard />} label="Dashboard" />
              <TabBtn active={activeTab === 'monitoring'} onClick={() => setActiveTab('monitoring')} icon={<Icons.Filter />} label="Pemantauan" />
              <TabBtn active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} icon={<Icons.CheckCircle />} label="Telah Selesai" />
              <TabBtn active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Icons.Form />} label="Butiran" disabled={!activeApplication} />
            </>
          ) : (user.role === 'pegawai_siasatan_1' || user.role === 'pegawai_siasatan_2' || user.role === 'pegawai_tatatertib') ? (
            <>
              <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard />} label="Dashboard" />
              <TabBtn active={activeTab === 'inbox_biasa'} onClick={() => setActiveTab('inbox_biasa')} icon={<Icons.Inbox />} label="Peti Masuk (Biasa)" />
              <TabBtn active={activeTab === 'inbox_pemutihan'} onClick={() => setActiveTab('inbox_pemutihan')} icon={<Icons.Inbox />} label="Peti Masuk (Pemutihan)" />
              <TabBtn active={activeTab === 'processing_biasa'} onClick={() => setActiveTab('processing_biasa')} icon={<Icons.History />} label="Proses (Biasa)" />
              <TabBtn active={activeTab === 'processing_pemutihan'} onClick={() => setActiveTab('processing_pemutihan')} icon={<Icons.History />} label="Proses (Pemutihan)" />
              <TabBtn active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} icon={<Icons.CheckCircle />} label="Selesai" />
              <TabBtn active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Icons.Form />} label="Butiran" disabled={!activeApplication} />
            </>
          ) : (user.role === 'pegawai_siasatan_biasa' || user.role === 'penyiasat') ? (
            <>
              <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard />} label="Dashboard" />
              <TabBtn active={activeTab === 'mytasks'} onClick={() => setActiveTab('mytasks')} icon={<Icons.Inbox />} label="Tugasan Saya" />
              <TabBtn active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} icon={<Icons.CheckCircle />} label="Selesai" />
              <TabBtn active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Icons.Form />} label="Butiran" disabled={!activeApplication} />
            </>
          ) : (
            <>
              <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Icons.Dashboard />} label={t('dashboard')} />
              <TabBtn active={activeTab === 'siasatan'} onClick={() => setActiveTab('siasatan')} icon={<Icons.Filter />} label="Siasatan SPI" />
              <TabBtn active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Icons.Form />} label="Butiran" disabled={!activeApplication} />
            </>
          )}
        </nav>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {renderTabContent()}
        </div>
      </main>

      <InboxPanel />

      {isAutoSaved && (
        <div className={`fixed bottom-6 right-6 bg-${themeColor}-500 text-white px-4 py-2 rounded-full shadow-lg text-[10px] font-black uppercase animate-bounce z-50 flex items-center gap-2 print:hidden`}>
          ✓ {lang === 'ms' ? 'Disimpan' : 'Saved'}
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-md">
            <SnailProgress 
              progress={loadingStep} 
              label={lang === 'ms' ? 'Menghubungkan ke Sistem...' : 'Connecting to System...'} 
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default App;
