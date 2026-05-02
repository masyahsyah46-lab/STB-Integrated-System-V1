
import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Bar } from 'react-chartjs-2';
import { 
  Building, 
  FolderOpen, 
  Inbox, 
  History, 
  BarChart3, 
  Gavel, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock 
} from 'lucide-react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const DashboardKS: React.FC = () => {
  const { user, applications, systemUsers, lang, t } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  const stats = useMemo(() => {
    const total = applications.length;
    const lulus = applications.filter(a => a.kelulusan?.includes('LULUS')).length;
    const tolak = applications.filter(a => a.kelulusan?.includes('TOLAK') || a.kelulusan?.includes('BEKU')).length;
    const proses = total - (lulus + tolak);

    // Apps by Recommender
    const byPengesyor: Record<string, number> = {};
    applications.forEach(a => {
      const name = a.pengesyor || 'TIADA NAMA';
      byPengesyor[name] = (byPengesyor[name] || 0) + 1;
    });

    // Apps by Approver
    const byPelulus: Record<string, number> = {};
    applications.forEach(a => {
      if (a.pelulus) {
        byPelulus[a.pelulus] = (byPelulus[a.pelulus] || 0) + 1;
      }
    });

    // Rejection Reasons
    const reasons: Record<string, number> = {};
    applications.forEach(a => {
      if (a.kelulusan?.includes('TOLAK') || a.kelulusan?.includes('BEKU')) {
        const r = (a.alasan || 'Lain-lain').split('|')[0].trim();
        reasons[r] = (reasons[r] || 0) + 1;
      }
    });

    // Consultation Counts
    const consultation: Record<string, number> = {};
    applications.forEach(a => {
       if (a.pengesyor && a.jenis_konsultansi) {
          consultation[a.pengesyor] = (consultation[a.pengesyor] || 0) + 1;
       }
    });

    return { total, lulus, tolak, proses, byPengesyor, byPelulus, reasons, consultation };
  }, [applications]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 10, weight: 'bold' as any } } }
    }
  };

  const accentBg = `bg-${themeColor}-600`;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Dashboard Ketua Seksyen</h2>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1">Global Overview & Team Performance</p>
        </div>
        <div className="absolute right-0 top-0 p-8 opacity-10 rotate-12">
          <Building size={140} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KSCard label="Jumlah Permohonan" value={stats.total} color="blue" icon={<TrendingUp size={24} />} />
        <KSCard label="Telah Diluluskan" value={stats.lulus} color="emerald" icon={<CheckCircle2 size={24} />} />
        <KSCard label="Telah Ditolak" value={stats.tolak} color="rose" icon={<XCircle size={24} />} />
        <KSCard label="Masih Diproses" value={stats.proses} color="amber" icon={<Clock size={24} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Permohonan Mengikut Pengesyor</h3>
          <div className="h-[300px]">
             <Bar 
               data={{
                 labels: Object.keys(stats.byPengesyor),
                 datasets: [{ label: 'Jumlah', data: Object.values(stats.byPengesyor), backgroundColor: '#3b82f6', borderRadius: 8 }]
               }}
               options={chartOptions}
             />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Permohonan Mengikut Pelulus</h3>
          <div className="h-[300px]">
             <Bar 
               data={{
                 labels: Object.keys(stats.byPelulus),
                 datasets: [{ label: 'Jumlah', data: Object.values(stats.byPelulus), backgroundColor: '#10b981', borderRadius: 8 }]
               }}
               options={chartOptions}
             />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
           <div className={`p-8 rounded-[2.5rem] ${accentBg} text-white shadow-xl shadow-${themeColor}-500/20 relative overflow-hidden group`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                <Gavel size={120} />
              </div>
              <div className="relative z-10">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Peranan Anda</h4>
                <h3 className="text-2xl font-black mb-4 uppercase leading-tight">{user?.role === 'ks_sptb' ? 'Ketua Seksyen' : 'Penolong Pengarah'}</h3>
                <p className="text-xs font-medium opacity-70 leading-relaxed">
                  {user?.role === 'ks_sptb' 
                    ? 'Pantau prestasi unit dan pastikan semua permohonan disyor dan diluluskan mengikut prosedur kualiti.' 
                    : 'Uruskan semakan dokumen dan pastikan semuanya lengkap sebelum dihantar ke SPI.'}
                </p>
                <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                   <div className="text-center">
                      <p className="text-[10px] opacity-60 font-black uppercase mb-1">Total</p>
                      <p className="text-xl font-black">{stats.total}</p>
                   </div>
                   <div className="text-center">
                      <p className="text-[10px] opacity-60 font-black uppercase mb-1">Lulus</p>
                      <p className="text-xl font-black">{stats.lulus}</p>
                   </div>
                   <div className="text-center">
                      <p className="text-[10px] opacity-60 font-black uppercase mb-1">Status</p>
                      <p className="text-sm font-black bg-white/20 px-2 py-1 rounded-lg uppercase">Aktif</p>
                   </div>
                </div>
              </div>
           </div>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 h-full">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Navigasi Pantas</h4>
           <div className="grid grid-cols-2 gap-3">
              <QuickNav 
                icon={<FolderOpen size={20} />} 
                label="Belum Syor" 
                onClick={() => useStore.getState().setActiveTab('all_drafts')} 
              />
              <QuickNav 
                icon={<Inbox size={20} />} 
                label="Inbox Review" 
                onClick={() => useStore.getState().setActiveTab('inbox_semakan')} 
              />
              <QuickNav 
                icon={<History size={20} />} 
                label="Sejarah" 
                onClick={() => useStore.getState().setActiveTab('history')} 
              />
              <QuickNav 
                icon={<BarChart3 size={20} />} 
                label="Semua Data" 
                onClick={() => useStore.getState().setActiveTab('all_history')} 
              />
           </div>
        </div>
      </div>
    </div>
  );
};

const KSCard = ({ label, value, color, icon }: { label: string, value: any, color: string, icon: React.ReactNode }) => (
  <div className={`bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm flex flex-col items-center justify-center border-b-8 border-b-${color}-500 transition-all hover:-translate-y-1`}>
    <div className={`mb-2 text-${color}-500 opacity-20`}>{icon}</div>
    <span className="text-4xl font-black text-slate-800">{value}</span>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{label}</span>
  </div>
);

const QuickNav = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-blue-500 hover:bg-white hover:shadow-md transition-all gap-2 group"
  >
    <div className="text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all">
      {icon}
    </div>
    <span className="text-[9px] font-black uppercase text-slate-600">{label}</span>
  </button>
);

export default DashboardKS;
