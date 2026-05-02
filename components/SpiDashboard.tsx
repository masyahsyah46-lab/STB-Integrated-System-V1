
import React, { useMemo } from 'react';
import { ApplicationData } from '../types';
import { useStore } from '../store/useStore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { AlertCircle, Clock, CheckCircle2, Users, MapPin, Activity, FileText, Upload, X } from 'lucide-react';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface SpiDashboardProps {}

const SpiDashboard: React.FC<SpiDashboardProps> = () => {
  const { user, systemUsers, lang, applications: items, t, syncApplication: onUpdate } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';
  
  if (!user) return null;
  const [activeInvestigation, setActiveInvestigation] = React.useState<ApplicationData | null>(null);

  const cleanObject = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
      if (newObj[key] === undefined) delete newObj[key];
    });
    return newObj;
  };

  const handleUpdateInvestigation = async (data: Partial<ApplicationData>) => {
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
  };

  const handleSubmitSptb = async (item: ApplicationData) => {
    if (!confirm(isEn ? "Are you sure you want to send this to SPTB?" : "Adakah anda pasti ingin menghantar permohonan ini ke SPTB?")) return;

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
  };

  const zon1States = ['PERLIS', 'KEDAH', 'PULAU PINANG', 'PERAK', 'JOHOR', 'MELAKA', 'NEGERI SEMBILAN'];
  const zon2States = ['KELANTAN', 'TERENGGANU', 'PAHANG', 'SELANGOR', 'W.P. KUALA LUMPUR', 'W.P. PUTRAJAYA'];

  // 1. All SPI eligible items
  const spiApps = useMemo(() => {
    return items.filter(i => {
      const isNormalSpi = i.syor_lawatan === 'YA' && !!i.date_submit_spi;
      const isPemutihanSpi = i.syor_lawatan === 'PEMUTIHAN' && !!i.tarikh_lulus;
      return isNormalSpi || isPemutihanSpi;
    });
  }, [items]);

  // 2. Stats
  const stats = useMemo(() => {
    const baru = spiApps.filter(i => (i.status_spi || 'BARU') === 'BARU').length;
    const proses = spiApps.filter(i => i.status_spi === 'DALAM PROSES').length;
    const selesai = spiApps.filter(i => i.status_spi === 'SELESAI').length;
    return { baru, proses, selesai, total: spiApps.length };
  }, [spiApps]);

  // 3. User Specific Stats
  const myTasks = useMemo(() => {
    return spiApps.filter(i => i.penerima_proses === user.id && i.status_spi === 'DALAM PROSES').length;
  }, [spiApps, user.id]);

  // 4. Zon Breakdown
  const zonStats = useMemo(() => {
    const z1 = spiApps.filter(i => zon1States.includes(i.negeri?.toUpperCase())).length;
    const z2 = spiApps.filter(i => zon2States.includes(i.negeri?.toUpperCase())).length;
    return { z1, z2 };
  }, [spiApps]);

  // 5. Chart Data: Status Overview
  const statusData = {
    labels: [isEn ? 'New' : 'Baru', isEn ? 'In Progress' : 'Dalam Proses', isEn ? 'Completed' : 'Selesai'],
    datasets: [{
      data: [stats.baru, stats.proses, stats.selesai],
      backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
      borderWidth: 0,
    }]
  };

  // 6. Chart Data: Assignee Breakdown (Top 5)
  const assigneeData = useMemo(() => {
    const counts: Record<string, number> = {};
    spiApps.filter(i => i.status_spi === 'DALAM PROSES').forEach(i => {
      const u = systemUsers.find(su => su.id === i.penerima_proses);
      const name = u ? u.name : (isEn ? 'Unassigned' : 'Tiada Agihan');
      counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      labels: sorted.map(s => s[0].length > 10 ? s[0].substring(0, 10) + '...' : s[0]),
      datasets: [{
        label: isEn ? 'Tasks' : 'Tugasan',
        data: sorted.map(s => s[1]),
        backgroundColor: '#3b82f6',
        borderRadius: 8,
      }]
    };
  }, [spiApps, systemUsers, isEn]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { font: { size: 10, weight: 'bold' as any }, boxWidth: 10 }
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header View */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <span className={`p-2 bg-${themeColor}-100 text-${themeColor}-600 rounded-2xl`}>
              <Activity size={24} />
            </span>
            SPI Dashboard
          </h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 ml-12">
            {isEn ? 'Investigation & Monitoring Overview' : 'Ringkasan Siasatan & Pemantauan'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl flex items-center gap-2 border border-emerald-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-tighter">System Live</span>
          </div>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label={isEn ? "Total Cases" : "Jumlah Kes"} 
          value={stats.total} 
          icon={<AlertCircle size={20} />} 
          color="blue" 
        />
        <StatCard 
          label={isEn ? "New (Pending)" : "Kes Baru"} 
          value={stats.baru} 
          icon={<Clock size={20} />} 
          color="rose" 
        />
        <StatCard 
          label={isEn ? "In Progress" : "Dalam Proses"} 
          value={stats.proses} 
          icon={<Activity size={20} />} 
          color="amber" 
        />
        <StatCard 
          label={isEn ? "Completed" : "Selesai"} 
          value={stats.selesai} 
          icon={<CheckCircle2 size={20} />} 
          color="emerald" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm flex flex-col h-[350px]">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity size={14} className="text-slate-400" />
            {isEn ? "Status Distribution" : "Taburan Status"}
          </h3>
          <div className="flex-1 min-h-0">
            <Doughnut data={statusData} options={chartOptions} />
          </div>
        </div>

        {/* Top Assignees */}
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm flex flex-col h-[350px]">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Users size={14} className="text-slate-400" />
            {isEn ? "Active Assignees" : "Pegawai Aktif"}
          </h3>
          <div className="flex-1 min-h-0">
            <Bar 
              data={assigneeData} 
              options={{
                ...chartOptions,
                plugins: { ...chartOptions.plugins, legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } },
                  x: { grid: { display: false }, ticks: { font: { size: 8, weight: 'bold' } } }
                }
              }} 
            />
          </div>
        </div>

        {/* Regional Focus */}
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm flex flex-col h-[350px]">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <MapPin size={14} className="text-slate-400" />
            {isEn ? "Regional Focus" : "Fokus Wilayah"}
          </h3>
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            <ZonProgress 
              label={isEn ? "Zon 1 (North/South)" : "Zon 1 (Utara/Selatan)"} 
              value={zonStats.z1} 
              total={stats.total} 
              color="blue" 
            />
            <ZonProgress 
              label={isEn ? "Zon 2 (Central/East)" : "Zon 2 (Tengah/Pantai Timur)"} 
              value={zonStats.z2} 
              total={stats.total} 
              color="indigo" 
            />
            <div className="pt-4 border-t border-slate-50">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-slate-100 text-slate-600 rounded-xl`}>
                    <Users size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-800 uppercase leading-none">My Assignments</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Pending action</p>
                  </div>
                </div>
                <span className="text-xl font-black text-slate-800">{myTasks}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Activity size={14} className="text-slate-400" />
          {isEn ? "Recent Investigations" : "Siasatan Terkini"}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] font-bold">
            <thead>
              <tr className="text-slate-400 border-b border-slate-50 uppercase tracking-tight">
                <th className="px-4 py-3 pb-4">{isEn ? 'Company' : 'Syarikat'}</th>
                <th className="px-4 py-3 pb-4">{isEn ? 'Status' : 'Status'}</th>
                <th className="px-4 py-3 pb-4">{isEn ? 'Assignee' : 'Pegawai'}</th>
                <th className="px-4 py-3 pb-4">{isEn ? 'Dateline' : 'Dateline'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {spiApps.slice(0, 10).sort((a,b) => {
                const da = a.tarikh_sah_terima_spi ? new Date(a.tarikh_sah_terima_spi).getTime() : 0;
                const db = b.tarikh_sah_terima_spi ? new Date(b.tarikh_sah_terima_spi).getTime() : 0;
                return db - da;
              }).map((item, idx) => {
                const assignee = systemUsers.find(u => u.id === item.penerima_proses);
                const canEdit = item.penerima_proses === user.id && item.status_spi !== 'SELESAI';
                return (
                  <tr key={idx} className={`hover:bg-white/50 transition-all group ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => canEdit && setActiveInvestigation(item)}>
                    <td className="px-4 py-4">
                      <p className={`text-slate-800 font-black uppercase text-[11px] ${canEdit ? 'group-hover:text-blue-600' : ''} transition-colors`}>{item.syarikat}</p>
                      <p className="text-[9px] text-slate-400 uppercase mt-0.5">{item.cidb}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                          item.status_spi === 'SELESAI' ? 'bg-emerald-50 text-emerald-600' :
                          item.status_spi === 'DALAM PROSES' ? 'bg-amber-50 text-amber-600' :
                          'bg-rose-50 text-rose-600'
                        }`}>
                          {item.status_spi || 'BARU'}
                        </span>
                        {canEdit && <Activity size={12} className="text-blue-500 animate-pulse" />}
                      </div>
                    </td>
                    <td className="px-4 py-4 uppercase text-slate-600">
                      {assignee ? assignee.name : '-'}
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-mono">
                      {item.dateline_spi || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {spiApps.length === 0 && (
            <div className="text-center py-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active investigations</p>
            </div>
          )}
        </div>
      </div>

      {/* Investigation Form Modal */}
      {activeInvestigation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className={`p-6 bg-slate-900 text-white flex items-center justify-between`}>
               <div>
                 <h2 className="text-xl font-black uppercase tracking-tight">{isEn ? "Quick Update" : "Kemaskini Pantas"}</h2>
                 <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">{activeInvestigation.syarikat}</p>
               </div>
               <button onClick={() => setActiveInvestigation(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                    <Upload size={14} className="text-blue-500" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Laporan Siasatan (SPI)</h3>
                  </div>
                  
                  {/* Drag and Drop Area */}
                  <div 
                    className="p-10 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center text-center space-y-3 transition-all hover:border-blue-400 hover:bg-blue-50/10 cursor-pointer group"
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
                    onClick={() => document.getElementById('dashboard-file-upload')?.click()}
                  >
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                      <FileText size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">
                        {activeInvestigation.lampiran_siasatan_spi ? (isEn ? "Document Attached" : "Dokumen Dilampirkan") : (isEn ? "Upload Investigation Report" : "Muatnaik Laporan Siasatan")}
                      </p>
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-2">
                        {activeInvestigation.lampiran_siasatan_spi || (isEn ? "Drag & drop or click to browse" : "Seret & lepas atau klik untuk pilih")}
                      </p>
                    </div>
                    <input 
                      id="dashboard-file-upload"
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
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Keputusan Syor</label>
                    <select 
                      value={activeInvestigation.keputusan_syor_spi || ''}
                      onChange={(e) => handleUpdateInvestigation({ keputusan_syor_spi: e.target.value as any, status_spi: 'DALAM PROSES' })}
                      className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-2xl px-4 font-black text-xs outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="">SILA PILIH...</option>
                      <option value="SOKONG">SOKONG</option>
                      <option value="TIDAK DISOKONG">TIDAK DISOKONG</option>
                      <option value="TIDAK PERLU LAWATAN">TIDAK PERLU LAWATAN</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan Ringkas</label>
                    <textarea 
                      value={activeInvestigation.laporan_siasatan_spi || ''}
                      onChange={(e) => handleUpdateInvestigation({ laporan_siasatan_spi: e.target.value.toUpperCase() })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500 transition-all h-24 resize-none"
                    />
                  </div>
                </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
               <button onClick={() => setActiveInvestigation(null)} className="flex-1 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-[10px] uppercase text-slate-400">{isEn ? "Cancel" : "Batal"}</button>
               <button 
                 onClick={() => handleSubmitSptb(activeInvestigation)} 
                 className={`flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all`}
               >
                 <CheckCircle2 size={16} /> {isEn ? "Complete & Submit" : "Selesai & Hantar"}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: { label: string, value: any, icon: any, color: string }) => (
  <div className={`bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-sm flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-lg`}>
    <div className="flex items-center justify-between">
      <span className={`p-2 bg-${color}-50 text-${color}-600 rounded-2xl`}>{icon}</span>
    </div>
    <div className="mt-4">
      <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    </div>
  </div>
);

const ZonProgress = ({ label, value, total, color }: { label: string, value: number, total: number, color: string }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{label}</span>
        <span className="text-[10px] font-black text-slate-800">{value}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-${color}-500 rounded-full transition-all duration-1000`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default SpiDashboard;
