
import React, { useState, useEffect, useMemo } from 'react';
import { ApplicationData } from '../types';
import { NEGERI_OPTIONS, Icons } from '../constants';
import { useStore } from '../store/useStore';
import { gasService, MAIN_DRIVE_URL } from '../services/gasService';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Save, ArrowLeft } from 'lucide-react';

interface DatabaseProps {
}

const InputDatabase: React.FC<DatabaseProps> = () => {
  const { user, lang, t, activeApplication: activeApp, syncApplication: onUpdate, setActiveTab, systemUsers, applications } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  const onBack = () => setActiveTab('borang');

  const [data, setData] = useState<ApplicationData | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveStatus, setDriveStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [pelulusWhatsapp, setPelulusWhatsapp] = useState("");
  const [targetSemakan, setTargetSemakan] = useState<'KS SPTB' | 'PP SPTB' | "">("");

  const [konsultansiState, setKonsultansiState] = useState({
    emel: { active: false, date: '' },
    whatsapp: { active: false, date: '' },
    call: { active: false, date: '' }
  });

  const approvers = useMemo(() => {
    return systemUsers.filter(u => u.role === 'pelulus');
  }, [systemUsers]);

  const reviewTargets = useMemo(() => {
    return systemUsers.filter(u => u.role === 'ks_sptb' || u.role === 'pp_sptb');
  }, [systemUsers]);

  useEffect(() => {
    if (activeApp && user) {
      setData({
        ...activeApp,
        pengesyor: user.name,
        pengesyor_id: user.id,
        tarikh_syor: activeApp.tarikh_syor || new Date().toISOString().split('T')[0],
        start_date: activeApp.start_date || new Date().toISOString().split('T')[0]
      });
    } else if (!activeApp && user && applications.length > 0) {
       // Auto select first draft if none active
       const firstDraft = applications.find(a => !a.tarikh_syor);
       if (firstDraft) {
          useStore.getState().setActiveApplication(firstDraft);
       }
    }
  }, [activeApp, user, applications]);

  if (!data || !user) return (
    <div className="p-20 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center">
      <p className="text-slate-300 font-black uppercase tracking-[0.3em] mb-4">Pilih Rekod Dahulu</p>
      <button onClick={onBack} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">« Kembali</button>
    </div>
  );

  const handleCreateFolder = async () => {
    setDriveStatus('creating');
    setIsCreatingFolder(true);
    try {
      const result = await gasService.createFolder({
        company_name: data.syarikat,
        month_year: data.tarikh_syor ? data.tarikh_syor.substring(0, 7) : new Date().toISOString().substring(0, 7),
        application_type: data.jenis,
        user_name: user.name
      });
      if (result.success && result.folder_url) {
        setData(prev => prev ? ({ ...prev, pautan: result.folder_url! }) : null);
        setDriveStatus('success');
        toast.success(isEn ? "Drive Folder Created!" : "Folder Drive Berjaya Dicipta!");
      } else { 
        setDriveStatus('error'); 
        toast.error(isEn ? "Failed to create folder." : "Gagal mencipta folder.");
      }
    } catch (err) { 
      setDriveStatus('error'); 
      toast.error("Error: " + err);
    } finally { setIsCreatingFolder(false); }
  };

  const handleSave = async () => {
    if (!data) return;

    if (data.syor_lawatan === 'YA' && !data.tarikh_hantar_semakan) {
      toast.error(isEn ? "Please confirm application is ready to be sent for review." : "Sila sahkan permohonan sedia untuk dihantar semakan.");
      return;
    }

    if (data.syor_lawatan === 'YA' && !targetSemakan) {
      toast.error(isEn ? "Please select review target (KS or PP)." : "Sila pilih sasaran semakan (KS atau PP).");
      return;
    }

    if (!confirm(isEn ? "Are you sure you want to sync this data to Google Sheets?" : "Adakah anda pasti ingin menyelaraskan data ini ke Google Sheets?")) {
      return;
    }
    setIsSyncing(true);
    const toastId = toast.loading(isEn ? "Syncing to Google Sheets..." : "Menyelaras ke Google Sheets...");
    try { 
      // Construct jenis_konsultansi string
      const parts: string[] = [];
      if (konsultansiState.emel.active) parts.push(`Emel, ${konsultansiState.emel.date}`);
      if (konsultansiState.whatsapp.active) parts.push(`WhatsApp, ${konsultansiState.whatsapp.date}`);
      if (konsultansiState.call.active) parts.push(`Call, ${konsultansiState.call.date}`);

      // Hardcode tarikh_syor to today if confirmed
      const today = new Date().toISOString().split('T')[0];
      const updatedData = { 
        ...data, 
        tarikh_syor: isConfirmed ? today : '',
        syor_status: isConfirmed ? data.syor_status : '',
        jenis_konsultansi: parts.join(' - '),
        target_semakan: targetSemakan,
        status_semakan: (data.syor_lawatan === 'YA' ? 'DALAM SEMAKAN' : '') as ApplicationData['status_semakan']
      };

      const success = await onUpdate(updatedData); 

      if (success) {
        // WhatsApp Notification for Approver (Only if not YA)
        if (isConfirmed && notifyWhatsapp && pelulusWhatsapp && data.syor_lawatan !== 'YA') {
           const message = `*NOTIFIKASI PERMOHONAN STB*\n\nSyarikat: ${data.syarikat}\nNo. CIDB: ${data.cidb}\nJenis: ${data.jenis}\nStatus Syor: ${data.syor_status}\nTarikh Syor: ${today}\n\nSila semak sistem STB untuk tindakan selanjutnya.`;
           const waUrl = `https://wa.me/${pelulusWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
           window.open(waUrl, '_blank');
        }

        // WhatsApp Notification for Review (When Syor Lawatan: YA)
        if (data.syor_lawatan === 'YA' && targetSemakan) {
          const targetUser = reviewTargets.find(u => (u.role === 'ks_sptb' || u.role === 'pp_sptb') && (targetSemakan === 'KS SPTB' ? u.role === 'ks_sptb' : u.role === 'pp_sptb'));
          if (targetUser && targetUser.phone) {
            const message = `*NOTIFIKASI SEMAKAN PERMOHONAN STB*\n\nSyarikat: ${data.syarikat}\nNo. CIDB: ${data.cidb}\nJenis: ${data.jenis}\nSTATUS: MENUNGGU SEMAKAN\nTarikh Hantar: ${today}\n\nMohon semak di Inbox Semakan sistem STB.`;
            const waUrl = `https://wa.me/${targetUser.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
          }
        }

        // Targeted Notification to SPI (Zon) for Kes Biasa
        if (updatedData.syor_lawatan === 'YA') {
          try {
            await ensureFirebaseAuth();
            const notifMsg = `PERMOHONAN BAHARU: Syarikat ${data.syarikat} (CIDB: ${data.cidb}) memerlukan siasatan zon. Sila sahkan penerimaan.`;
            
            // Send to both PS1 and PS2 roles
            const rolesToNotify = ['pegawai_siasatan_1', 'pegawai_siasatan_2'];
            for (const role of rolesToNotify) {
              await addDoc(collection(db, "notifications"), {
                appId: data.id,
                syarikat: data.syarikat,
                senderId: user.id,
                senderName: user.name,
                receiverRole: role,
                message: notifMsg,
                status: 'BELUM LIHAT',
                type_kes: 'BIASA',
                createdAt: serverTimestamp()
              });
            }
          } catch (notifErr) {
            console.error("Failed to send SPI notification:", notifErr);
          }
        }

        toast.success(isEn ? "Data Synced Successfully!" : "Data Berjaya Diselaras!", { id: toastId });
        
        // SPI Email Notification (from USER REQUEST)
        if (updatedData.syor_lawatan === 'YA' && updatedData.date_submit) {
           if (confirm(isEn ? "Would you like to auto-send an email notification to SPI?" : "Adakah anda ingin hantar emel notifikasi ke SPI secara automatik?")) {
              const emailToast = toast.loading(isEn ? "Sending email to SPI..." : "Menghantar emel ke SPI...");
              try {
                await gasService.submitToGas({
                  ...updatedData,
                  update_type: 'hantar_emel_spi'
                });
                toast.success(isEn ? "Email sent to SPI!" : "Emel berjaya dihantar ke SPI!", { id: emailToast });
              } catch (err) {
                toast.error(isEn ? "Failed to send email to SPI" : "Gagal hantar emel ke SPI", { id: emailToast });
              }
           }
        }

        setActiveTab('submitted');
      } else {
        toast.error(isEn ? "Sync Failed" : "Penyelarasan Gagal", { id: toastId });
      }
    } catch (error) {
       console.error("Sync Error:", error);
       toast.error(isEn ? "Critical Sync Error" : "Ralat Penyelarasan Kritikal", { id: toastId });
    } finally {
       setIsSyncing(false);
    }
  };

  const accentBg = `bg-${themeColor}-600`;
  const accentText = `text-${themeColor}-600`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32">
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-12 shadow-sm space-y-12">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
           <div className={`w-12 h-12 ${accentBg} text-white rounded-2xl flex items-center justify-center text-3xl shadow-lg`}>📂</div>
           <div className="flex-1">
             <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('input_pangkalan_data')}</h2>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.syarikat}</p>
           </div>
           <button 
            onClick={() => {
              if (confirm(isEn ? "Reset this draft?" : "Set semula draf ini?")) {
                setData(null);
                useStore.getState().setActiveApplication(null);
              }
            }}
            className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-xl transition-all border border-rose-100"
           >
             Set Semula
           </button>
        </div>

        <div className={`p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-200 space-y-8`}>
           <div className="flex items-center justify-between flex-wrap gap-4">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-3 uppercase tracking-widest">
                <span className="text-2xl">🔗</span> {t('google_drive_system')}
              </h3>
              <div className="flex gap-2">
                 <button onClick={handleCreateFolder} disabled={isCreatingFolder || !!data.pautan} className={`${accentBg} text-white px-6 py-3 rounded-xl font-black text-[10px] shadow-lg disabled:opacity-50 uppercase`}>{isCreatingFolder ? 'PROSES...' : t('cipta_folder')}</button>
                 <button onClick={() => window.open(MAIN_DRIVE_URL, '_blank')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] shadow-lg uppercase">{t('buka_folder_saya')}</button>
              </div>
           </div>
           {data.pautan && (
             <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
               <span className="text-[10px] font-black text-emerald-700 uppercase">✓ FOLDER DRIVE READY</span>
               <a href={data.pautan} target="_blank" rel="noopener" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-sm">Buka Link</a>
             </div>
           )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           <InputGroup label={t('nama_syarikat')} value={data.syarikat} onChange={v => setData({...data, syarikat: v.toUpperCase()})} className="md:col-span-2" />
           <InputGroup label={t('no_cidb')} value={data.cidb} onChange={v => setData({...data, cidb: v.toUpperCase()})} />
           
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('negeri_operasi')}</label>
              <select value={data.negeri} onChange={e => setData({...data, negeri: e.target.value})} className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all">
                <option value="">PILIH NEGERI...</option>
                {NEGERI_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
           </div>
           <InputGroup label={t('tarikh_surat')} type="date" value={data.tarikh_surat_terdahulu || ''} onChange={v => setData({...data, tarikh_surat_terdahulu: v})} />
           <InputGroup label={t('start_date')} type="date" value={data.start_date || ''} onChange={v => setData({...data, start_date: v})} />
           
           <div className="md:col-span-3">
             <InputGroup label={isEn ? "BUSINESS ADDRESS" : "ALAMAT PERNIAGAAN"} value={data.alamat_perniagaan || ''} onChange={v => setData({...data, alamat_perniagaan: v.toUpperCase()})} placeholder="MASUKKAN ALAMAT PENUH..." />
           </div>

           {data.jenis?.includes('UBAH') ? (
             <>
               <InputGroup label="UBAH MAKLUMAT" value={data.input_ubah_maklumat || ''} onChange={v => setData({...data, input_ubah_maklumat: v})} placeholder="CONTOH: UBAH ALAMAT/NAMA..." />
               <InputGroup label="UBAH GRED" value={data.input_ubah_gred || ''} onChange={v => setData({...data, input_ubah_gred: v})} placeholder="CONTOH: G1 KE G2..." />
             </>
           ) : (
             <div className="md:col-span-3">
               <InputGroup label="CATATAN" value={data.catatan || ''} onChange={v => setData({...data, catatan: v})} placeholder="MASUKKAN CATATAN JIKA PERLU..." />
             </div>
           )}
           
           <div className="md:col-span-3 space-y-4 pt-4 border-t border-slate-100">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                 <Icons.Form size={14} /> {isEn ? "CONSULTATION TYPE" : "JENIS KONSULTANSI"}
               </label>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  {(['emel', 'whatsapp', 'call'] as const).map(type => (
                    <div key={type} className="space-y-2">
                       <label className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={konsultansiState[type].active}
                            onChange={(e) => setKonsultansiState({
                              ...konsultansiState, 
                              [type]: { ...konsultansiState[type], active: e.target.checked }
                            })}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-[10px] font-black text-slate-600 uppercase group-hover:text-blue-600 transition-colors">
                            {type === 'emel' ? 'Emel' : type === 'whatsapp' ? 'WhatsApp' : 'Panggilan (Call)'}
                          </span>
                       </label>
                       {konsultansiState[type].active && (
                         <input 
                           type="date"
                           value={konsultansiState[type].date}
                           onChange={(e) => setKonsultansiState({
                             ...konsultansiState,
                             [type]: { ...konsultansiState[type], date: e.target.value }
                           })}
                           className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                         />
                       )}
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('syor_lawatan')}</label>
               <div className="flex gap-2 h-[52px]">
                 {['YA', 'TIDAK', 'PEMUTIHAN'].map(opt => (
                   <button key={opt} onClick={() => setData({...data, syor_lawatan: opt})} className={`flex-1 rounded-xl border-2 font-black text-xs transition-all ${data.syor_lawatan === opt ? `bg-${themeColor}-50 border-${themeColor}-600 text-${themeColor}-700` : 'bg-slate-50 border-transparent text-slate-300'}`}>{opt}</button>
                 ))}
               </div>
            </div>
           <InputGroup label="JUSTIFIKASI LAWATAN" value={data.justifikasi_lawatan || ''} onChange={v => setData({...data, justifikasi_lawatan: v})} className="md:col-span-2" />
           {(data.syor_lawatan === 'YA' || data.syor_lawatan === 'PEMUTIHAN') && (
             <InputGroup label="ALAMAT OPERASI (DARI AI)" value={data.alamat_operasi || ''} onChange={v => setData({...data, alamat_operasi: v})} className="md:col-span-3" />
           )}
           {data.syor_lawatan === 'YA' && (
             <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-amber-50 border-2 border-amber-200 rounded-[2.5rem]">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-1">Hantar Untuk Semakan (KS/PP)?</label>
                 <div 
                   onClick={() => setData({...data, tarikh_hantar_semakan: data.tarikh_hantar_semakan ? '' : new Date().toISOString().split('T')[0]})}
                   className={`w-full h-[52px] px-4 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${data.tarikh_hantar_semakan ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-amber-200 text-amber-400'}`}
                 >
                   <span className="text-[10px] font-black uppercase">{data.tarikh_hantar_semakan ? '✓ SEDIA DISEMAK' : 'KLIK UNTUK HANTAR'}</span>
                   <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 ${data.tarikh_hantar_semakan ? 'bg-white border-white text-amber-500' : 'bg-slate-50 border-slate-200'}`}>
                     {data.tarikh_hantar_semakan && '✓'}
                   </div>
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-1">Pilih Sasaran Semakan</label>
                 <select 
                   value={targetSemakan} 
                   onChange={e => setTargetSemakan(e.target.value as any)}
                   className="w-full h-[52px] bg-white border-2 border-amber-200 rounded-xl px-4 font-black text-xs outline-none focus:border-amber-500 transition-all"
                 >
                   <option value="">PILIH KS / PP SPTB...</option>
                   <option value="KS SPTB">KETUA SEKSYEN (KS SPTB)</option>
                   <option value="PP SPTB">PENOLONG PENGARAH (PP SPTB)</option>
                 </select>
               </div>

               {data.alasan_tolak_semakan && (
                 <div className="md:col-span-2 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                   <span className="text-xl">⚠️</span>
                   <div>
                     <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Alasan Penolakan Semakan:</p>
                     <p className="text-xs font-bold text-slate-700 mt-1">{data.alasan_tolak_semakan}</p>
                   </div>
                 </div>
               )}
             </div>
           )}
        </div>

        <div className="space-y-4">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('pautan_drive')}</label>
           <div className="flex gap-2">
             <input type="text" value={data.pautan} onChange={e => setData({...data, pautan: e.target.value})} placeholder="https://drive.google.com/..." className="flex-1 h-[52px] px-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs text-blue-600 outline-none focus:border-blue-500 transition-all" />
             <button 
               onClick={() => data.pautan && window.open(data.pautan, '_blank')}
               className="bg-slate-100 text-slate-600 px-6 rounded-xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all flex items-center gap-2"
             >
               📂 Buka
             </button>
           </div>
        </div>

        <div className="p-10 bg-slate-900 rounded-[2.5rem] space-y-8 text-white">
           <div className="flex items-center gap-4 border-b border-white/10 pb-4">
              <span className="text-2xl">📋</span>
              <h3 className="text-sm font-black uppercase tracking-[0.3em]">{t('bahagian_pengesyor')}</h3>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">{t('nama_pengesyor')}</label>
                 <div className="bg-white/5 p-4 rounded-xl font-black text-xs uppercase">{data.pengesyor}</div>
              </div>
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">KEPUTUSAN SYOR</label>
                 <select value={data.syor_status} onChange={e => setData({...data, syor_status: e.target.value})} className="w-full h-[48px] bg-white/10 border border-white/20 rounded-xl px-4 font-black text-xs outline-none focus:bg-white focus:text-slate-900 transition-all">
                    <option value="" className="text-slate-900">SILA PILIH...</option>
                    <option value="SOKONG" className="text-slate-900">SOKONG</option>
                    <option value="TIDAK DISOKONG" className="text-slate-900">TIDAK DISOKONG</option>
                 </select>
              </div>
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">{t('tarikh_syor')}</label>
                 <div className="w-full h-[48px] bg-white/5 border border-white/20 rounded-xl px-4 font-black text-[10px] text-white/30 flex items-center cursor-not-allowed uppercase">
                    DIJANA AUTOMATIK SEMASA HANTAR
                 </div>
              </div>
              
              <div className="lg:col-span-3 space-y-4">
                 <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <input 
                      type="checkbox" 
                      id="db_sah_syor" 
                      checked={isConfirmed}
                      onChange={(e) => setIsConfirmed(e.target.checked)}
                      className="w-5 h-5 roundedaccent-blue-500"
                    />
                    <label htmlFor="db_sah_syor" className="text-[11px] font-black text-white/80 uppercase tracking-tight cursor-pointer">
                      {isEn ? "I confirm this application data is true and accurate." : "Saya mengesahkan permohonan ini adalah benar dan tepat."}
                    </label>
                 </div>

                 {isConfirmed && data.syor_status === 'SOKONG' && (
                   <div className="space-y-4 p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-3">
                         <input 
                           type="checkbox" 
                           id="cb_notify_whatsapp" 
                           checked={notifyWhatsapp}
                           onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                           className="w-5 h-5 rounded accent-blue-500"
                         />
                         <label htmlFor="cb_notify_whatsapp" className="text-[11px] font-black text-blue-300 uppercase tracking-tight cursor-pointer">
                           {isEn ? "Send WhatsApp Notification to Approver" : "Hantar Notifikasi WhatsApp kepada Pelulus"}
                         </label>
                      </div>
                      
                      {notifyWhatsapp && (
                        <div className="space-y-2 pt-2 border-t border-white/5">
                           <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-1">
                             {isEn ? "Select Approver" : "Pilih Pelulus"}
                           </label>
                           <select 
                             value={pelulusWhatsapp}
                             onChange={(e) => setPelulusWhatsapp(e.target.value)}
                             className="w-full h-[48px] bg-slate-800 border border-white/10 rounded-xl px-4 font-black text-xs text-white outline-none"
                           >
                              <option value="">- {isEn ? "SELECT APPROVER" : "PILIH PELULUS"} -</option>
                              {approvers.map(a => (
                                <option key={a.id} value={a.phone || ''}>
                                  {a.name} {a.phone ? `(${a.phone})` : ''}
                                </option>
                              ))}
                           </select>
                        </div>
                      )}
                   </div>
                 )}
              </div>

              <div className="space-y-2 lg:col-span-3">
                 <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Catatan (Simpan di Firebase)</label>
                 <textarea 
                   value={data.catatan || ''} 
                   onChange={e => setData({...data, catatan: e.target.value})} 
                   placeholder="Masukkan catatan atau link..."
                   className="w-full p-4 bg-white/10 border border-white/20 rounded-xl font-bold text-xs outline-none focus:bg-white focus:text-slate-900 transition-all resize-none"
                   rows={2}
                 />
              </div>
           </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print z-50 w-full max-w-xl px-4">
        <button onClick={onBack} className="flex-1 bg-white text-slate-400 py-4 rounded-2xl font-black text-xs border-2 border-slate-200 shadow-xl uppercase flex items-center justify-center gap-2">
          <ArrowLeft size={14} /> {isEn ? "Back" : "Kembali"}
        </button>
        <button onClick={handleSave} disabled={isSyncing} className={`flex-[2] ${accentBg} text-white py-4 rounded-2xl font-black text-xs shadow-2xl hover:opacity-90 active:scale-95 transition-all uppercase flex items-center justify-center gap-2`}>
          <Save size={14} /> {isSyncing ? 'SENDING...' : t('simpan_hantar_sheet')} &raquo;
        </button>
      </div>
    </div>
  );
};

const InputGroup: React.FC<{ label: string, value: string, type?: string, onChange?: (v: string) => void, readOnly?: boolean, className?: string, placeholder?: string }> = ({ label, value, type = 'text', onChange, readOnly, className, placeholder }) => {
  const hasValue = value && String(value).trim() !== "";
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type={type} 
        value={value} 
        readOnly={readOnly} 
        placeholder={placeholder} 
        onChange={e => onChange?.(e.target.value)} 
        className={`w-full h-[52px] px-4 rounded-xl border-2 font-black text-xs outline-none transition-all ${
          readOnly 
            ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
            : hasValue 
              ? 'bg-white border-blue-500/30 text-slate-900 shadow-sm' 
              : 'bg-amber-50/30 border-amber-200/50 text-slate-400 placeholder-slate-300'
        } focus:border-blue-600 focus:bg-white focus:shadow-md`} 
      />
    </div>
  );
};

export default InputDatabase;
