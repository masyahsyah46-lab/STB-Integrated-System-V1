
import React, { useState, useMemo, useCallback } from 'react';
import { ApplicationData, User } from '../types';
import { useStore } from '../store/useStore';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { doc, updateDoc, serverTimestamp, addDoc, collection, setDoc } from 'firebase/firestore';
import { calculateDateline } from '../utils/dateUtils';
import { toast } from 'sonner';
import { Search, Filter, UserPlus, CheckCircle2, MapPin, Calendar, Info, FileText, User as UserIcon, X, ClipboardList, Paperclip } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';

interface SiasatanProps {
  view: 'dashboard' | 'inbox' | 'inbox_biasa' | 'inbox_pemutihan' | 'processing' | 'processing_biasa' | 'processing_pemutihan' | 'completed' | 'monitoring' | 'mytasks' | 'siasatan';
}

const ListSiasatan: React.FC<SiasatanProps> = ({ view }) => {
  const { user, systemUsers, lang, applications: items, t, syncApplication: onUpdate, setActiveApplication, setActiveTab } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  if (!user) return null;

  const cleanObject = (obj: any) => {
    const result = { ...obj };
    Object.keys(result).forEach(key => {
      if (result[key] === undefined) delete result[key];
    });
    return result;
  };

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeInvestigation, setActiveInvestigation] = useState<ApplicationData | null>(null);
  const [catatanAgihan, setCatatanAgihan] = useState<Record<string, string>>({});

  const zon1States = ['PERLIS', 'KEDAH', 'PULAU PINANG', 'PERAK', 'JOHOR', 'MELAKA', 'NEGERI SEMBILAN'];
  const zon2States = ['KELANTAN', 'TERENGGANU', 'PAHANG', 'SELANGOR', 'W.P. KUALA LUMPUR', 'W.P. PUTRAJAYA'];

  const filteredItems = useMemo(() => {
    // 1. Filter by SPI trigger conditions
    let spiApps = items.filter(i => {
      const isNormalSpi = i.syor_lawatan === 'YA' && !!i.date_submit_spi;
      const isPemutihanSpi = i.syor_lawatan === 'PEMUTIHAN' && !!i.tarikh_lulus;
      return isNormalSpi || isPemutihanSpi;
    });

    // 2. Filter by View & Role logic
    if (view === 'monitoring') {
      spiApps = spiApps.filter(i => i.status_spi === 'DALAM PROSES');
    } else if (view === 'inbox' || view === 'inbox_biasa' || view === 'inbox_pemutihan') {
      spiApps = spiApps.filter(i => (i.status_spi || 'BARU') === 'BARU');
      
      if (view === 'inbox_biasa') spiApps = spiApps.filter(i => i.syor_lawatan === 'YA');
      if (view === 'inbox_pemutihan') spiApps = spiApps.filter(i => i.syor_lawatan === 'PEMUTIHAN');

      if (user.role === 'pegawai_siasatan_1') {
        spiApps = spiApps.filter(i => zon1States.includes(i.negeri?.toUpperCase()));
      } else if (user.role === 'pegawai_siasatan_2') {
        spiApps = spiApps.filter(i => zon2States.includes(i.negeri?.toUpperCase()));
      }
    } else if (view === 'processing' || view === 'processing_biasa' || view === 'processing_pemutihan') {
      spiApps = spiApps.filter(i => i.status_spi === 'DALAM PROSES');

      if (view === 'processing_biasa') spiApps = spiApps.filter(i => i.syor_lawatan === 'YA');
      if (view === 'processing_pemutihan') spiApps = spiApps.filter(i => i.syor_lawatan === 'PEMUTIHAN');

      if (user.role === 'pegawai_siasatan_1') {
        spiApps = spiApps.filter(i => zon1States.includes(i.negeri?.toUpperCase()));
      } else if (user.role === 'pegawai_siasatan_2') {
        spiApps = spiApps.filter(i => zon2States.includes(i.negeri?.toUpperCase()));
      }
    } else if (view === 'completed') {
      spiApps = spiApps.filter(i => i.status_spi === 'SELESAI');
      if (user.role === 'pegawai_siasatan_1') {
        spiApps = spiApps.filter(i => zon1States.includes(i.negeri?.toUpperCase()));
      } else if (user.role === 'pegawai_siasatan_2') {
        spiApps = spiApps.filter(i => zon2States.includes(i.negeri?.toUpperCase()));
      } else if (user.role === 'pegawai_siasatan_biasa') {
        spiApps = spiApps.filter(i => i.penerima_proses === user.id);
      }
    } else if (view === 'mytasks') {
      spiApps = spiApps.filter(i => i.status_spi === 'DALAM PROSES' && i.penerima_proses === user.id);
    }

    // 3. Search filter
    return spiApps.filter(i => {
      const matchSearch = i.syarikat.toLowerCase().includes(search.toLowerCase()) || 
                          i.cidb.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [items, user, search, view]);

  const handleAcknowledge = useCallback(async (item: ApplicationData) => {
    try {
      await ensureFirebaseAuth();
      const docId = item.firebaseDocId || item.id;
      const docRef = doc(db, "applications", docId);
      
      const today = new Date().toISOString().split('T')[0];
      const updates: any = {
        tarikh_sah_terima_spi: today,
        updatedAt: serverTimestamp()
      };

      // Calculate dateline: 21 working days from date_submit_spi or today (tarikh_sah_terima_spi)
      const baseDate = item.date_submit_spi || today;
      try {
        updates.dateline_spi = calculateDateline(baseDate);
      } catch (e) {
        console.warn("Dateline calculation failed", e);
      }

      const updatedItem = { ...item, ...updates };
      await setDoc(docRef, cleanObject(updatedItem), { merge: true });
      if (onUpdate) onUpdate(updatedItem);
      toast.success(isEn ? "Receipt acknowledged" : "Penerimaan disahkan");
    } catch (e) {
      console.error("Acknowledge Error:", e);
      toast.error(isEn ? "Failed to acknowledge" : "Gagal mengesahkan penerimaan");
    }
  }, [isEn]);

  const handleAgih = useCallback(async (item: ApplicationData, targetUserId: string) => {
    if (!targetUserId) return;
    const targetUser = systemUsers.find(u => u.id === targetUserId);
    const isSelf = targetUserId === user.id;

    const confirmMsg = isSelf 
      ? (isEn ? "Are you sure you want to process this yourself?" : "Adakah anda pasti ingin memproses sendiri permohonan ini?")
      : (isEn ? `Are you sure you want to assign this to ${targetUser?.name}?` : `Adakah anda pasti untuk mengagihkan permohonan ini kepada ${targetUser?.name}?`);

    if (!confirm(confirmMsg)) return;

    try {
      await ensureFirebaseAuth();
      const docId = item.firebaseDocId || item.id;
      const docRef = doc(db, "applications", docId);
      
      const updatedItem = {
        ...item,
        pengagih_id: user.id,
        penerima_proses: targetUserId,
        status_spi: 'DALAM PROSES' as const,
        catatan_agihan_spi: catatanAgihan[item.id] || '',
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, cleanObject(updatedItem), { merge: true });
      if (onUpdate) onUpdate(updatedItem);
      toast.success(isEn ? `Assigned successfully` : `Tugasan berjaya diagihkan`);
    } catch (e) {
      console.error("Agih Error:", e);
      toast.error(isEn ? "Failed to assign" : "Gagal mengagihkan tugasan");
    }
  }, [systemUsers, user, isEn, catatanAgihan]);

  const handleSubmitSptb = useCallback(async (item: ApplicationData) => {
    if (!confirm(isEn ? "Are you sure you want to send this to SPTB? Ensure investigation report is uploaded." : "Adakah anda pasti ingin menghantar permohonan ini ke SPTB? Pastikan laporan siasatan telah dimuat naik dalam pangkalan data awam utama.")) return;

    try {
      await ensureFirebaseAuth();
      const docId = item.firebaseDocId || item.id;
      const docRef = doc(db, "applications", docId);
      
      const updatedItem = {
        ...item,
        status_spi: 'SELESAI' as const,
        tarikh_hantar_sptb_spi: new Date().toISOString().split('T')[0],
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, cleanObject(updatedItem), { merge: true });
      if (onUpdate) onUpdate(updatedItem);

      // Auto Notification
      const receiverId = item.syor_lawatan === 'PEMUTIHAN' ? item.pelulus_id : item.pengesyor_id;
      if (receiverId) {
        await addDoc(collection(db, "notifications"), {
          appId: item.id,
          syarikat: item.syarikat,
          senderId: user.id,
          senderName: user.name,
          receiverId: receiverId,
          message: `SIASATAN SELESAI: Laporan siasatan bagi syarikat ${item.syarikat} telah disiapkan oleh ${user.name}. Sila semak butiran lanjut.`,
          status: 'BELUM LIHAT',
          type_kes: item.syor_lawatan === 'PEMUTIHAN' ? 'PEMUTIHAN' : 'BIASA',
          createdAt: serverTimestamp()
        });
      }

      toast.success(isEn ? "Sent to SPTB" : "Dihantar ke SPTB");
      setActiveInvestigation(null);
    } catch (e) {
      console.error("Submit SPTB Error:", e);
      toast.error(isEn ? "Failed to submit" : "Gagal menghantar ke SPTB");
    }
  }, [isEn, user]);

  const handleUpdateInvestigation = useCallback(async (data: Partial<ApplicationData>) => {
    const docId = activeInvestigation?.firebaseDocId || activeInvestigation?.id;
    if (!docId) return;
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, "applications", docId);
      const updatedItem = {
        ...activeInvestigation,
        ...data,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, cleanObject(updatedItem), { merge: true });
      if (onUpdate) onUpdate(updatedItem as ApplicationData);
      setActiveInvestigation(prev => prev ? { ...prev, ...data } : null);
      toast.success(isEn ? "Updated successfully" : "Berjaya dikemaskini");
    } catch (e) {
      console.error("Update Investigation Error:", e);
      toast.error(isEn ? "Failed to update" : "Gagal mengemaskini");
    }
  }, [activeInvestigation, isEn]);

  const handleUpdateStatus = async (item: ApplicationData, newStatus: 'BARU' | 'DALAM PROSES' | 'SELESAI') => {
    try {
      await ensureFirebaseAuth();
      const docId = item.firebaseDocId || item.id;
      const docRef = doc(db, "applications", docId);
      const updatedItem = {
        ...item,
        status_spi: newStatus,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, cleanObject(updatedItem), { merge: true });
      if (onUpdate) onUpdate(updatedItem);

      // Send notification back to original officer when completed
      if (newStatus === 'SELESAI') {
        const receiverId = item.syor_lawatan === 'PEMUTIHAN' ? item.pelulus_id : item.pengesyor_id;
        if (receiverId) {
          await addDoc(collection(db, "notifications"), {
            appId: item.id,
            syarikat: item.syarikat,
            senderId: user.id,
            senderName: user.name,
            receiverId: receiverId,
            message: `SIASATAN SELESAI: Laporan siasatan bagi syarikat ${item.syarikat} telah disiapkan oleh ${user.name}. Sila semak butiran lanjut.`,
            status: 'BELUM LIHAT',
            type_kes: item.syor_lawatan === 'PEMUTIHAN' ? 'PEMUTIHAN' : 'BIASA',
            createdAt: serverTimestamp()
          });
        }
      }

      toast.success(isEn ? "Status updated" : "Status dikemaskini");
    } catch (e) {
      console.error("Status Update Error:", e);
    }
  };

  const accentBg = `bg-${themeColor}-600`;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 ${accentBg} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
              <Search size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Sistem Maklumat Siasatan (SPI)</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modul Siasatan & Pemutihan Syarikat</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder={isEn ? "Search company or CIDB..." : "Cari syarikat atau CIDB..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
              />
              <Search className="absolute left-4 top-4 text-slate-400" size={20} />
            </div>
            <div className="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 text-slate-400 shadow-sm">
              <Filter size={14} />
              {view === 'inbox' ? 'Peti Masuk' : 
               view === 'processing' ? 'Dalam Proses' : 
               view === 'completed' ? 'Selesai' : 
               view === 'monitoring' ? 'Pemantauan' : 
               view === 'mytasks' ? 'Tugasan Saya' : 'Semua'}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <div className="mb-4 text-slate-200">
                <Search size={64} />
              </div>
              <p className="font-black text-slate-300 uppercase tracking-[0.2em]">{isEn ? 'No investigation records found' : 'Tiada rekod siasatan dijumpai'}</p>
            </div>
          ) : (
            <List
              height={600}
              itemCount={filteredItems.length}
              itemSize={300}
              width="100%"
              className="no-scrollbar"
            >
              {({ index, style }) => {
                const item = filteredItems[index];
                return (
                  <div style={style} className="p-8 hover:bg-slate-50/50 transition-all group border-b border-slate-100">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{item.syarikat}</h3>
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            item.status_spi === 'SELESAI' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            item.status_spi === 'DALAM PROSES' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-blue-50 text-blue-600 border-blue-100'
                          }`}>
                            {item.status_spi || 'BARU'}
                          </span>
                          {item.syor_lawatan === 'PEMUTIHAN' && (
                            <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[9px] font-black uppercase tracking-widest">PEMUTIHAN</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                            <MapPin className="text-blue-500 mt-1" size={18} />
                            <div>
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Alamat Operasi (Highlight)</p>
                              <p className="text-xs font-black text-slate-800 uppercase leading-relaxed">{item.alamat_operasi || 'TIADA ALAMAT'}</p>
                              <p className="text-[10px] font-black text-blue-600 uppercase mt-1">Negeri: {item.negeri}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                            <Calendar className="text-slate-400 mt-1" size={18} />
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tarikh Hantar SPI / Lulus</p>
                              <p className="text-xs font-black text-slate-700 uppercase">{item.date_submit_spi || item.tarikh_lulus || '-'}</p>
                            </div>
                          </div>
                        </div>

                        {item.penerima_proses && (
                          <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-xl w-fit">
                            <div className="w-6 h-6 bg-slate-800 text-white rounded-lg flex items-center justify-center">
                              <UserIcon size={14} />
                            </div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Ditugaskan Kepada: {systemUsers.find(u => u.id === item.penerima_proses)?.name}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        {/* Step 1: Sahkan Penerimaan */}
                        {(view === 'inbox' || view === 'inbox_biasa' || view === 'inbox_pemutihan') && !item.tarikh_sah_terima_spi && (
                          <button 
                            onClick={() => handleAcknowledge(item)}
                            className={`${accentBg} text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:opacity-90 transition-all`}
                          >
                            {isEn ? 'Acknowledge Receipt' : 'Sahkan Penerimaan'}
                          </button>
                        )}

                        {/* Step 2: Agihan (Only after Step 1) */}
                        {(view === 'inbox' || view === 'inbox_biasa' || view === 'inbox_pemutihan') && item.tarikh_sah_terima_spi && (
                          <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <textarea 
                              placeholder={isEn ? "Assignment notes..." : "Catatan agihan..."}
                              value={catatanAgihan[item.id] || ''}
                              onChange={(e) => setCatatanAgihan(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-full sm:w-64 p-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-blue-500 transition-all resize-none"
                              rows={1}
                            />
                            <div className="relative group/agih">
                              <select 
                                onChange={(e) => handleAgih(item, e.target.value)}
                                className="w-full bg-white border-2 border-slate-200 px-4 py-3 rounded-2xl font-black text-[10px] uppercase outline-none focus:border-blue-500 transition-all appearance-none pr-10"
                                defaultValue=""
                              >
                                <option value="" disabled>{isEn ? 'ASSIGN TO...' : 'AGIHKAN KEPADA...'}</option>
                                <option value={user.id}>{isEn ? 'SELF' : 'DIRI SENDIRI'}</option>
                                {systemUsers.filter(u => u.role === 'pegawai_siasatan_biasa').map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                              <UserPlus className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
                            </div>
                          </div>
                        )}

                        {/* Investigation Form Trigger */}
                        {(view === 'processing' || view === 'processing_biasa' || view === 'processing_pemutihan' || view === 'mytasks') && (
                          <button 
                            onClick={() => setActiveInvestigation(item)}
                            className={`${accentBg} text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:opacity-90 transition-all flex items-center gap-2`}
                          >
                            <FileText size={14} /> {isEn ? 'Update Investigation' : 'Kemaskini Siasatan'}
                          </button>
                        )}

                        {/* Status Update for PS Biasa (Legacy support if needed) */}
                        {user.role === 'pegawai_siasatan_biasa' && view === 'mytasks' && (
                          <select 
                            value={item.status_spi || 'BARU'}
                            onChange={(e) => handleUpdateStatus(item, e.target.value as any)}
                            className="bg-white border-2 border-slate-200 px-4 py-3 rounded-2xl font-black text-[10px] uppercase outline-none focus:border-blue-500 transition-all"
                          >
                            <option value="BARU">BARU</option>
                            <option value="DALAM PROSES">DALAM PROSES</option>
                            <option value="SELESAI">SELESAI</option>
                          </select>
                        )}

                        <button 
                          onClick={() => {
                            setActiveApplication(item);
                            setActiveTab('preview');
                          }}
                          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2"
                        >
                          <Info size={14} /> {isEn ? 'Details' : 'Butiran'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }}
            </List>
          )}
        </div>
      </div>

      {/* Investigation Form Modal */}
      {activeInvestigation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className={`p-8 ${accentBg} text-white flex items-center justify-between`}>
               <div>
                 <h2 className="text-2xl font-black uppercase tracking-tight">{isEn ? "Investigation Form" : "Borang Maklumat Siasatan"}</h2>
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">{activeInvestigation.syarikat} ({activeInvestigation.cidb})</p>
               </div>
               <button onClick={() => setActiveInvestigation(null)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all">
                 <X size={20} />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
               {/* Section 1: PIC Lawatan */}
               <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <MapPin size={20} className="text-blue-500" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{isEn ? "PIC Lawatan" : "PIC Lawatan"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PIC Lawatan</label>
                       <select 
                         value={activeInvestigation.pic_lawatan_spi || ''}
                         onChange={(e) => handleUpdateInvestigation({ pic_lawatan_spi: e.target.value as any })}
                         className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                       >
                         <option value="">SILA PILIH...</option>
                         <option value="HQ">HQ</option>
                         <option value="NEGERI">NEGERI</option>
                       </select>
                    </div>
                    {activeInvestigation.pic_lawatan_spi === 'NEGERI' && (
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Negeri</label>
                         <select 
                           value={activeInvestigation.pic_negeri_spi || ''}
                           onChange={(e) => handleUpdateInvestigation({ pic_negeri_spi: e.target.value })}
                           className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                         >
                           <option value="">PILIH NEGERI...</option>
                           {['JOHOR', 'KEDAH', 'KELANTAN', 'MELAKA', 'NEGERI SEMBILAN', 'PAHANG', 'PERAK', 'PERLIS', 'PULAU PINANG', 'SABAH', 'SARAWAK', 'SELANGOR', 'TERENGGANU', 'W.P. KUALA LUMPUR', 'W.P. LABUAN', 'W.P. PUTRAJAYA'].map(n => <option key={n} value={n}>{n}</option>)}
                         </select>
                      </div>
                    )}
                  </div>
                  {activeInvestigation.pic_lawatan_spi === 'NEGERI' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarikh Hantar ke Negeri</label>
                         <input 
                           type="date" 
                           value={activeInvestigation.tarikh_hantar_negeri_spi || ''}
                           onChange={(e) => handleUpdateInvestigation({ tarikh_hantar_negeri_spi: e.target.value })}
                           className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarikh Terima Emel dari Negeri</label>
                         <input 
                           type="date" 
                           value={activeInvestigation.tarikh_terima_negeri_spi || ''}
                           onChange={(e) => handleUpdateInvestigation({ tarikh_terima_negeri_spi: e.target.value })}
                           className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                         />
                      </div>
                    </div>
                  )}
               </div>

               {/* Section 2: Keputusan Lawatan */}
               <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <ClipboardList size={20} className="text-blue-500" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{isEn ? "Keputusan Lawatan" : "Keputusan Lawatan"}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarikh Lawatan</label>
                       <input 
                         type="date" 
                         value={activeInvestigation.tarikh_lawatan_spi || ''}
                         onChange={(e) => handleUpdateInvestigation({ tarikh_lawatan_spi: e.target.value })}
                         className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Masa Lawatan</label>
                       <input 
                         type="time" 
                         value={activeInvestigation.masa_lawatan_spi || ''}
                         onChange={(e) => handleUpdateInvestigation({ masa_lawatan_spi: e.target.value })}
                         className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Syor Lawatan</label>
                     <select 
                       value={activeInvestigation.keputusan_syor_spi || ''}
                       onChange={(e) => handleUpdateInvestigation({ keputusan_syor_spi: e.target.value as any })}
                       className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                     >
                       <option value="">SILA PILIH...</option>
                       <option value="SOKONG">SOKONG</option>
                       <option value="TIDAK DISOKONG">TIDAK DISOKONG</option>
                       <option value="TIDAK PERLU LAWATAN">TIDAK PERLU LAWATAN</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Laporan Siasatan</label>
                     <textarea 
                       value={activeInvestigation.laporan_siasatan_spi || ''}
                       onChange={(e) => handleUpdateInvestigation({ laporan_siasatan_spi: e.target.value.toUpperCase() })}
                       placeholder="Masukkan laporan siasatan penuh..."
                       className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-blue-500 transition-all resize-none"
                       rows={4}
                     />
                  </div>
               </div>

               {/* Section 3: Lampiran & Submit */}
               <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <Paperclip size={20} className="text-blue-500" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{isEn ? "Lampiran & Hantar" : "Lampiran & Hantar"}</h3>
                  </div>
                  <div 
                    className="p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center text-center space-y-3 transition-all hover:border-blue-400 hover:bg-blue-50/10 cursor-pointer group"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/10'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/10'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/10');
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        toast.info(isEn ? `File ${file.name} prepared` : `Fail ${file.name} disediakan`);
                        handleUpdateInvestigation({ lampiran_siasatan_spi: file.name });
                      }
                    }}
                    onClick={() => document.getElementById('file-upload-spi')?.click()}
                  >
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                      <FileText size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">
                        {activeInvestigation.lampiran_siasatan_spi ? 
                          (isEn ? "File Uploaded" : "Fail Dimuatnaik") : 
                          (isEn ? "Drop investigation report here" : "Letakkan laporan siasatan di sini")
                        }
                      </p>
                      <p className="text-[9px] font-black text-slate-400 uppercase">
                        {activeInvestigation.lampiran_siasatan_spi || (isEn ? "or click to browse files" : "atau klik untuk pilih fail")}
                      </p>
                    </div>
                    <input 
                      id="file-upload-spi"
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          toast.info(isEn ? `File ${file.name} selected` : `Fail ${file.name} terpilih`);
                          handleUpdateInvestigation({ lampiran_siasatan_spi: file.name });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{isEn ? "Attachment Link / Filename" : "Pautan Lampiran / Nama Fail"}</label>
                     <input 
                       type="text" 
                       placeholder={isEn ? "Or paste public link/filename..." : "Atau tampal link awam/nama fail..."}
                       value={activeInvestigation.lampiran_siasatan_spi || ''}
                       onChange={(e) => handleUpdateInvestigation({ lampiran_siasatan_spi: e.target.value })}
                       className="w-full h-[52px] px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-blue-500 transition-all"
                     />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarikh Hantar ke SPTB Semula</label>
                       <input 
                         type="date" 
                         value={activeInvestigation.tarikh_hantar_sptb_spi || ''}
                         onChange={(e) => handleUpdateInvestigation({ tarikh_hantar_sptb_spi: e.target.value })}
                         className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                       />
                    </div>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
               <button onClick={() => setActiveInvestigation(null)} className="flex-1 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-xs uppercase text-slate-400">{isEn ? "Close" : "Tutup"}</button>
               <button 
                 onClick={() => handleSubmitSptb(activeInvestigation)} 
                 className={`flex-[2] py-4 ${accentBg} text-white rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2`}
               >
                 <CheckCircle2 size={16} /> {isEn ? "Submit to SPTB" : "Hantar ke SPTB"}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListSiasatan;
