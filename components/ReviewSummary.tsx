
import React, { useState } from 'react';
import { ApplicationData, UserRole } from '../types';
import { useStore } from '../store/useStore';
import PrintLayout from './PrintLayout';
import { 
  Printer, 
  CheckCircle, 
  XCircle, 
  Send, 
  ArrowLeft, 
  ChevronRight, 
  Building, 
  User, 
  Scale, 
  ClipboardCheck 
} from 'lucide-react';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface ReviewProps {
}

const ReviewSummary: React.FC<ReviewProps> = () => {
  const { user, lang, t, setActiveTab, activeApplication: item, syncApplication } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  const [reviewStatus, setReviewStatus] = useState<'LENGKAP' | 'TIDAK LENGKAP' | ''>(item?.status_semakan === 'LENGKAP' || item?.status_semakan === 'TIDAK LENGKAP' ? item.status_semakan : '');
  const [alasanTolak, setAlasanTolak] = useState(item?.alasan_tolak_semakan || '');
  const [isCheckedSpi, setIsCheckedSpi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item) return null;

  const onBack = () => {
    if (user?.role === 'ks_sptb' || user?.role === 'pp_sptb') setActiveTab('inbox_semakan');
    else if (user?.role === 'pelulus') setActiveTab('inbox');
    else if (user?.role?.includes('spi') || (user?.role && ['pemerhati', 'pegawai_tatatertib', 'penyiasat'].includes(user.role))) setActiveTab('siasatan');
    else setActiveTab('submitted');
  };

  const handleReviewSubmit = async () => {
    if (!reviewStatus) {
      toast.error("Sila pilih status semakan.");
      return;
    }

    if (reviewStatus === 'LENGKAP' && !isCheckedSpi) {
      toast.error("Sila tandakan pengesahan dokumen lengkap.");
      return;
    }

    if (reviewStatus === 'TIDAK LENGKAP' && !alasanTolak) {
      toast.error("Sila nyatakan alasan penolakan.");
      return;
    }

    if (!confirm("Sahkan semakan ini?")) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Memproses semakan...");

    try {
      const updatedApp: ApplicationData = {
        ...item,
        status_semakan: reviewStatus,
        alasan_tolak_semakan: reviewStatus === 'TIDAK LENGKAP' ? alasanTolak : '',
        semak_oleh: user?.name,
        semak_oleh_id: user?.id,
        tarikh_selesai_semakan: new Date().toISOString().split('T')[0],
        is_checked_spi: reviewStatus === 'LENGKAP',
        // Jika tidak lengkap, padam tarikh dokumen lengkap (tarikh_hantar_semakan)
        tarikh_hantar_semakan: reviewStatus === 'TIDAK LENGKAP' ? '' : item.tarikh_hantar_semakan
      };

      const success = await syncApplication(updatedApp);

      if (success) {
        if (reviewStatus === 'LENGKAP') {
          // AUTO-HANTAR EMEL KE SPI
          await syncApplication({
            ...updatedApp,
            update_type: 'hantar_emel_spi'
          });
          toast.success("Dokumen lengkap. Emel dihantar ke SPI.", { id: toastId });
        } else {
          // NOTIFIKASI WHATSAPP KEPADA PENGESYOR
          if (item.pengesyor_id) {
            const pengesyor = useStore.getState().systemUsers.find(u => u.id === item.pengesyor_id);
            if (pengesyor?.phone) {
              const waMsg = `*NOTIFIKASI PENOLAKAN SEMAKAN STB*\n\nSyarikat: ${item.syarikat}\nStatus: TIDAK LENGKAP\nAlasan: ${alasanTolak}\n\nSila semak semula permohonan anda.`;
              const waUrl = `https://wa.me/${pengesyor.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMsg)}`;
              window.open(waUrl, '_blank');
            }
          }
          toast.success("Semakan ditolak. Notifikasi dihantar kepada pengesyor.", { id: toastId });
        }
        onBack();
      } else {
        toast.error("Gagal mengemaskini data.", { id: toastId });
      }
    } catch (err) {
      toast.error("Ralat: " + err, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onNext = () => {
    setActiveTab('decision');
  };

  const Section: React.FC<{ title: string, children: React.ReactNode, icon: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
       <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-2">
          <div className="text-slate-400">{icon}</div>
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</span>
       </div>
       <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
          {children}
       </div>
    </div>
  );

  const Row: React.FC<{ label: string, value: string | React.ReactNode }> = ({ label, value }) => (
    <div className="flex flex-col">
       <span className="text-[10px] font-black text-slate-400 uppercase mb-0.5">{label}</span>
       <span className="text-sm font-bold text-slate-800 break-words">{value || '-'}</span>
    </div>
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl text-white shadow-xl no-print">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="font-black text-lg leading-tight uppercase">{item.syarikat}</h2>
            <p className="text-xs text-white/50 font-bold">{item.cidb}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl font-black text-xs transition-all uppercase flex items-center gap-2"
          >
            <Printer size={14} /> {isEn ? 'PRINT' : 'CETAK'}
          </button>
          {user?.role === 'pelulus' && !item.tarikh_lulus && (
            <button onClick={onNext} className="bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-400 transition-all uppercase flex items-center gap-2">
              {isEn ? 'CONTINUE TO DECISION' : 'TERUSKAN KE KEPUTUSAN'} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 no-print">
         <Section title={isEn ? "Application Information" : "Maklumat Permohonan"} icon={<Building size={16} />}>
            <Row label={isEn ? "Type" : "Jenis"} value={item.jenis.toUpperCase()} />
            <Row label={isEn ? "Grade" : "Gred"} value={item.gred} />
            <Row label={isEn ? "Consultation Type" : "Jenis Konsultansi"} value={item.jenis_konsultansi} />
            <Row label={isEn ? "Operating State" : "Negeri Operasi"} value={item.negeri} />
            <Row label={isEn ? "Business Address" : "Alamat Perniagaan"} value={item.alamat_perniagaan} />
            {item.syor_lawatan === 'YA' && (
              <Row 
                label={isEn ? "SPI Status" : "Status SPI"} 
                value={<span className="px-2 py-0.5 bg-rose-500 text-white rounded-md text-[9px] font-black">HANTAR SPI</span>} 
              />
            )}
            <Row label={isEn ? "Document Link" : "Pautan Dokumen"} value={item.pautan ? <a href={item.pautan} target="_blank" rel="noopener" className="text-blue-600 underline">{isEn ? 'Open Drive' : 'Buka Drive'}</a> : 'TIADA'} />
            <Row label={isEn ? "Uploaded File Name" : "Nama Fail Dimuat Naik"} value={item.fileName || 'TIADA'} />
         </Section>

        <Section title={isEn ? "Recommender Comments" : "Ulasan Pengesyor"} icon={<User size={16} />}>
           <Row label={t('nama_pengesyor')} value={`${item.pengesyor} (ID: ${item.pengesyor_id || '-'})`} />
           <Row label={t('tarikh_syor')} value={item.tarikh_syor} />
           <Row label={isEn ? "Recommendation Decision" : "Keputusan Syor"} value={
             <span className={`px-2 py-0.5 rounded-md text-xs font-black ${item.syor_status === 'SOKONG' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {item.syor_status === 'SOKONG' ? (isEn ? 'SUPPORT' : 'SOKONG') : (isEn ? 'NOT SUPPORT' : 'TIDAK DISOKONG')}
             </span>
           } />
           <Row label={isEn ? "Justification" : "Justifikasi"} value={item.justifikasi} />
        </Section>

        {item.tarikh_lulus && (
          <Section title={t('keputusan_pelulus')} icon={<Scale size={16} />}>
            <Row label={t('nama_pelulus')} value={`${item.pelulus} (ID: ${item.pelulus_id || '-'})`} />
            <Row label={t('tarikh_kelulusan')} value={item.tarikh_lulus} />
            <Row label={t('keputusan')} value={
              <span className={`px-2 py-0.5 rounded-md text-xs font-black ${item.kelulusan?.includes('LULUS') ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  {item.kelulusan}
              </span>
            } />
            <Row label={isEn ? "Reason" : "Alasan"} value={item.alasan} />
          </Section>
        )}

        {(user?.role === 'ks_sptb' || user?.role === 'pp_sptb') && (
          <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-200 shadow-xl space-y-6 animate-in slide-in-from-top-4">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4 text-slate-800">
                <ClipboardCheck size={20} className="text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-widest">Panel Semakan Dokumen</h3>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Semakan</label>
                   <div className="flex gap-2">
                      <button 
                         onClick={() => setReviewStatus('LENGKAP')}
                         className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 border-2 ${reviewStatus === 'LENGKAP' ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-slate-50 border-transparent text-slate-400'}`}
                      >
                         <CheckCircle size={14} /> LENGKAP
                      </button>
                      <button 
                         onClick={() => setReviewStatus('TIDAK LENGKAP')}
                         className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 border-2 ${reviewStatus === 'TIDAK LENGKAP' ? 'bg-rose-500 border-rose-600 text-white' : 'bg-slate-50 border-transparent text-slate-400'}`}
                      >
                         <XCircle size={14} /> TIDAK LENGKAP
                      </button>
                   </div>
                </div>

                {reviewStatus === 'LENGKAP' && (
                   <div className="space-y-3 animate-in fade-in">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pengesahan SPI</label>
                      <div 
                         onClick={() => setIsCheckedSpi(!isCheckedSpi)}
                         className={`w-full p-4 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-all ${isCheckedSpi ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                      >
                         <input type="checkbox" checked={isCheckedSpi} readOnly className="w-4 h-4" />
                         <span className="text-[10px] font-black uppercase">Telah disemak dan lengkap bersedia untuk dihantar ke SPI</span>
                      </div>
                   </div>
                )}

                {reviewStatus === 'TIDAK LENGKAP' && (
                   <div className="space-y-3 animate-in fade-in">
                      <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">Alasan Penolakan</label>
                      <textarea 
                         value={alasanTolak}
                         onChange={e => setAlasanTolak(e.target.value.toUpperCase())}
                         placeholder="CONTOH: DOKUMEN KWSP TIDAK JELAS..."
                         className="w-full p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-black outline-none focus:border-rose-500 transition-all resize-none"
                         rows={2}
                      />
                   </div>
                )}
             </div>

             <button 
                onClick={handleReviewSubmit}
                disabled={isSubmitting}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
             >
                <Send size={14} /> {isSubmitting ? 'MEMPROSES...' : 'HANTAR SEMAKAN SEKARANG'}
             </button>
          </div>
        )}
      </div>

      <PrintLayout data={item} themeColor={themeColor} />
    </div>
  );
};

export default ReviewSummary;
