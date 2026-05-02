
import React, { useState } from 'react';
import { ApplicationData } from '../types';
import { KEPUTUSAN_OPTIONS, ALASAN_OPTIONS } from '../constants';
import { useStore } from '../store/useStore';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Gavel, FileText } from 'lucide-react';

interface DecisionProps {
}

const DecisionPanel: React.FC<DecisionProps> = () => {
  const { user, lang, t, activeApplication: activeApp, syncApplication: onDecision, setActiveTab } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  const [keputusan, setKeputusan] = useState("");
  const [alasan, setAlasan] = useState("");
  const [ulasan, setUlasan] = useState("");
  const [isOverride, setIsOverride] = useState(false);
  const [overrideJustifikasi, setOverrideJustifikasi] = useState("");

  if (!user || !activeApp) return null;

  const handleSubmit = async () => {
    if (!keputusan) {
      toast.error(isEn ? "Please select decision." : "Sila pilih keputusan.");
      return;
    }
    
    const requiresReason = keputusan === 'SIASAT' || keputusan.includes('TOLAK') || keputusan.includes('BEKU');
    if (requiresReason && !alasan) {
      toast.error(isEn ? "Please select a reason." : "Sila nyatakan alasan.");
      return;
    }

    if (isOverride && !overrideJustifikasi) {
      toast.error(isEn ? "Please provide justification for Pemutihan." : "Sila nyatakan justifikasi untuk Pemutihan.");
      return;
    }

    if (!confirm(isEn ? "Confirm this decision?" : "Sahkan keputusan ini?")) return;

    let hantarSpi = false;
    if (isOverride) {
      hantarSpi = confirm(isEn ? "Would you like to send this 'PEMUTIHAN' application to SPI automatically?" : "Adakah anda ingin hantar permohonan 'PEMUTIHAN' ini ke SPI secara automatik?");
    }

    // Targeted Notification to SPI (Zon) for PEMUTIHAN override
    if (isOverride) {
      try {
        await ensureFirebaseAuth();
        const notifMsg = `KES PEMUTIHAN: Syarikat ${activeApp.syarikat} (CIDB: ${activeApp.cidb}) telah ditukar ke PEMUTIHAN oleh Pelulus. Sila sahkan penerimaan.`;
        
        // Send to both PS1 and PS2 roles
        const rolesToNotify = ['pegawai_siasatan_1', 'pegawai_siasatan_2'];
        for (const role of rolesToNotify) {
          await addDoc(collection(db, "notifications"), {
            appId: activeApp.id,
            syarikat: activeApp.syarikat,
            senderId: user.id,
            senderName: user.name,
            receiverRole: role,
            message: notifMsg,
            status: 'BELUM LIHAT',
            type_kes: 'PEMUTIHAN',
            createdAt: serverTimestamp()
          });
        }
      } catch (notifErr) {
        console.error("Failed to send SPI notification:", notifErr);
      }
    }

    const updatedApp = {
      ...activeApp,
      kelulusan: keputusan,
      alasan: ulasan ? `${alasan} | ${ulasan.toUpperCase()}` : alasan,
      tarikh_lulus: new Date().toISOString().split('T')[0],
      pelulus: user.name,
      pelulus_id: user.id,
      syor_lawatan: isOverride ? 'PEMUTIHAN' : activeApp.syor_lawatan,
      justifikasi_lawatan: isOverride ? overrideJustifikasi : activeApp.justifikasi_lawatan,
      is_pemutihan: isOverride
    };

    const success = await onDecision(updatedApp);

    if (success) {
      if (hantarSpi) {
        const emailToast = toast.loading(isEn ? "Sending email to SPI..." : "Menghantar emel ke SPI...");
        try {
          await useStore.getState().syncApplication({
             ...updatedApp,
             update_type: 'hantar_emel_spi_pemutihan'
          });
          toast.success(isEn ? "Email sent to SPI!" : "Emel berjaya dihantar ke SPI!", { id: emailToast });
        } catch (err) {
          toast.error(isEn ? "Failed to send email to SPI" : "Gagal hantar emel ke SPI", { id: emailToast });
        }
      }
      toast.success(isEn ? "Decision Submitted!" : "Keputusan Berjaya Dihantar!");
      setActiveTab('history');
    } else {
      toast.error(isEn ? "Sync error. Try again." : "Ralat Penyelarasan. Cuba lagi.");
    }
  };

  const showAlasan = keputusan === 'SIASAT' || keputusan.includes('TOLAK') || keputusan.includes('BEKU');

  const accentBg = `bg-${themeColor}-600`;
  const accentRing = `focus:ring-${themeColor}-500/20`;

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Full Review Display */}
      <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
           <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><FileText size={20} /></div>
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{isEn ? "Full Review" : "Semakan Penuh"}</h3>
        </div>

        <div className="space-y-6">
           <ReviewSection title={isEn ? "Company Details" : "Butiran Syarikat"}>
              <ReviewRow label="Syarikat" value={activeApp.syarikat} />
              <ReviewRow label="No CIDB" value={activeApp.cidb} />
              <ReviewRow label="Gred" value={activeApp.gred} />
              <ReviewRow label="Negeri" value={activeApp.negeri} />
           </ReviewSection>

           <ReviewSection title={isEn ? "Application Info" : "Info Permohonan"}>
              <ReviewRow label="Jenis" value={activeApp.jenis} />
              <ReviewRow label="Tarikh Mula" value={activeApp.start_date} />
              <ReviewRow label="Tempoh SPKK" value={activeApp.spkk_duration} />
              <ReviewRow label="Tempoh STB" value={activeApp.stb_duration} />
           </ReviewSection>

           <ReviewSection title={isEn ? "Recommendation" : "Syor Pengesyor"}>
              <ReviewRow label="Pengesyor" value={activeApp.pengesyor} />
              <ReviewRow label="Status Syor" value={activeApp.syor_status} highlight={activeApp.syor_status === 'SOKONG'} />
              <ReviewRow label="Tarikh Syor" value={activeApp.tarikh_syor} />
              <ReviewRow label="Syor Lawatan" value={activeApp.syor_lawatan} highlight={activeApp.syor_lawatan !== 'TIDAK'} />
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                 <button 
                   onClick={() => {
                     if (!isOverride) {
                       if (confirm(isEn ? "Are you sure you want to change this recommender's recommendation to Pemutihan?" : "Adakah anda pasti ingin membuat perubahan syor pengesyor ini kepada Pemutihan?")) {
                         setIsOverride(true);
                       }
                     } else {
                       setIsOverride(false);
                     }
                   }}
                   className={`w-full py-2 rounded-xl font-black text-[10px] uppercase transition-all border-2 ${isOverride ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'}`}
                 >
                   {isOverride ? '✓ SYOR DITUKAR KE PEMUTIHAN' : '⚠ TUKAR KE PEMUTIHAN'}
                 </button>
                 
                 {isOverride && (
                   <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
                     <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest ml-1">Justifikasi Lawatan (Pemutihan)</label>
                     <textarea 
                       value={overrideJustifikasi}
                       onChange={e => setOverrideJustifikasi(e.target.value)}
                       placeholder="Masukkan justifikasi lawatan..."
                       className="w-full p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold outline-none focus:border-rose-500 transition-all resize-none"
                       rows={3}
                     />
                   </div>
                 )}
              </div>
           </ReviewSection>
        </div>
      </div>

      {/* Decision Form */}
      <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl shadow-lg"><Gavel className="text-white" /></div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('keputusan_pelulus')}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t('sedang_diproses')}</p>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('pilih_keputusan')}</label>
            <select 
              value={keputusan}
              onChange={e => setKeputusan(e.target.value)}
              className={`w-full mt-2 p-5 bg-white border-2 border-slate-100 rounded-2xl font-black text-lg text-slate-800 outline-none focus:border-blue-500 transition-all ${accentRing} appearance-none shadow-sm`}
            >
              <option value="">- {isEn ? 'CHOOSE DECISION' : 'SILA PILIH'} -</option>
              {KEPUTUSAN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {showAlasan && (
            <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div>
                <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">{t('alasan_penolakan')}</label>
                <select 
                  value={alasan}
                  onChange={e => setAlasan(e.target.value)}
                  className="w-full mt-2 p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl font-black text-xs text-rose-800 outline-none focus:border-rose-500 transition-all shadow-sm"
                >
                  <option value="">- {isEn ? 'SELECT REASON' : 'PILIH ALASAN'} -</option>
                  {ALASAN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('ulasan_tambahan')}</label>
                <textarea 
                  placeholder="..."
                  value={ulasan}
                  onChange={e => setUlasan(e.target.value)}
                  className="w-full mt-2 p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all shadow-sm"
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('tarikh_kelulusan')}</label>
               <div className="w-full mt-2 p-4 bg-slate-100 rounded-2xl font-black text-xs text-slate-400 uppercase border-2 border-transparent cursor-not-allowed">
                 DIJANA AUTOMATIK
               </div>
             </div>
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('nama_pelulus')}</label>
               <div className="w-full mt-2 p-4 bg-slate-100 rounded-2xl font-black text-xs text-slate-400 uppercase border-2 border-transparent">
                 {user.name}
               </div>
             </div>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          className={`w-full mt-8 py-5 ${accentBg} text-white font-black rounded-3xl shadow-xl shadow-slate-500/10 active:scale-95 transition-all uppercase tracking-[0.2em] text-xs`}
        >
          {t('hantar_keputusan_akhir')}
        </button>
      </div>
    </div>
  );
};

const ReviewSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
    <div className="space-y-2">{children}</div>
  </div>
);

const ReviewRow: React.FC<{ label: string, value?: string, highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between text-[10px] font-bold border-b border-slate-50 pb-2">
    <span className="text-slate-400 uppercase">{label}</span>
    <span className={`uppercase ${highlight ? 'text-emerald-600 font-black' : 'text-slate-800'}`}>{value || '-'}</span>
  </div>
);

export default DecisionPanel;
