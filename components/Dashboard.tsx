
import React, { useState, useMemo } from 'react';
import { ApplicationData, UserRole } from '../types';
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
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface DashboardProps {
}

const MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun", 
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

const parseDate = (dateStr?: string) => {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  return new Date(dateStr);
};

const Dashboard: React.FC<DashboardProps> = () => {
  const { user, lang, systemUsers, applications, t } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const role = user?.role || 'pengesyor';
  const isEn = lang === 'en';

  const data = useMemo(() => {
    if (!user) return [];
    const uName = (user.name || '').trim().toUpperCase();
    const uId = (user.id || '').trim().toUpperCase();

    if (user.role === 'pengesyor') {
      return applications.filter(a => {
        const pName = (a.pengesyor || '').trim().toUpperCase();
        const pId = (a.pengesyor_id || '').trim().toUpperCase();
        return (pName !== '' && pName === uName) || (pId !== '' && pId === uId);
      });
    }
    if (user.role === 'pelulus') {
      return applications.filter(a => {
        const plName = (a.pelulus || '').trim().toUpperCase();
        const plId = (a.pelulus_id || '').trim().toUpperCase();
        return (plName !== '' && plName === uName) || (plId !== '' && plId === uId);
      });
    }
    return applications;
  }, [applications, user]);

  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  const selectedUser = useMemo(() => {
    return systemUsers.find(u => u.id === selectedUserId);
  }, [systemUsers, selectedUserId]);

  const effectiveRole = useMemo(() => {
    if (selectedUser) return selectedUser.role;
    return role === 'ks_sptb' ? 'pelulus' : role;
  }, [selectedUser, role]);

  const filteredData = useMemo(() => {
    return (data || []).filter(item => {
      // Filter by user if selected
      if (selectedUserId !== 'all') {
        if (item.pengesyor_id !== selectedUserId && item.pelulus_id !== selectedUserId) return false;
      }

      const dateStr = item.start_date || item.tarikh_syor || item.tarikh_lulus;
      if (!dateStr) return filterMonth === 'all' && (filterYear === 'all' || filterYear === '');
      const date = parseDate(dateStr);
      if (!date) return filterMonth === 'all' && filterYear === 'all';
      const mMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
      const yMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      return mMatch && yMatch;
    });
  }, [data, filterMonth, filterYear, selectedUserId]);

  // Basic Stats
  const { total, successCount, rejectCount, inProcessCount, rate } = useMemo(() => {
    const total = filteredData.length;
    const successCount = filteredData.filter(a => effectiveRole === 'pengesyor' ? a.syor_status === 'SOKONG' : a.kelulusan?.includes('LULUS')).length;
    const rejectCount = filteredData.filter(a => effectiveRole === 'pengesyor' ? a.syor_status === 'TIDAK DISOKONG' : (a.kelulusan?.includes('TOLAK') || a.kelulusan?.includes('BEKU'))).length;
    const inProcessCount = total - (successCount + rejectCount);
    const rate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    return { total, successCount, rejectCount, inProcessCount, rate };
  }, [filteredData, effectiveRole]);

  // Chart Data: Status (Doughnut)
  const statusChartData = useMemo(() => ({
    labels: [effectiveRole === 'pengesyor' ? t('sokong') : t('lulus'), effectiveRole === 'pengesyor' ? t('tolak') : t('gagal'), t('proses')],
    datasets: [{
      data: [successCount, rejectCount, inProcessCount],
      backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
      borderWidth: 0,
    }]
  }), [effectiveRole, successCount, rejectCount, inProcessCount, t]);

  // Chart Data: Monthly Trend (Bar)
  const monthlyTrendData = useMemo(() => {
    const counts = new Array(12).fill(0);
    data.forEach(item => {
      const date = parseDate(item.start_date || item.tarikh_syor);
      if (date && date.getFullYear().toString() === filterYear) {
        counts[date.getMonth()]++;
      }
    });
    return {
      labels: MONTHS.map(m => m.substring(0, 3).toUpperCase()),
      datasets: [{
        label: isEn ? 'Applications' : 'Permohonan',
        data: counts,
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      }]
    };
  }, [data, filterYear, isEn]);

  // Chart Data: Type Breakdown (Pie)
  const typeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const type = (item.jenis || 'Lain').toUpperCase();
      counts[type] = (counts[type] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
        borderWidth: 0,
      }]
    };
  }, [filteredData]);

  // Approver Specific: Rejection Reasons (Horizontal Bar)
  const rejectionReasonChartData = useMemo(() => {
    const reasons: Record<string, number> = {};
    filteredData.filter(a => a.kelulusan?.includes('TOLAK') || a.kelulusan?.includes('BEKU')).forEach(item => {
      const reason = (item.alasan || 'Lain-lain').split('|')[0].trim();
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return {
      labels: Object.keys(reasons).map(r => r.length > 15 ? r.substring(0, 15) + '...' : r),
      datasets: [{
        label: isEn ? 'Count' : 'Jumlah',
        data: Object.values(reasons),
        backgroundColor: '#ef4444',
        borderRadius: 4,
      }]
    };
  }, [filteredData, isEn]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { size: 9, weight: 'bold' as any },
          boxWidth: 10,
        }
      },
    }
  };

  // Repeated Application Analysis
  const repeatedApps = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toUpperCase();
    const matches = data.filter(item => 
      item.syarikat.toUpperCase().includes(q) || 
      item.cidb.toUpperCase().includes(q)
    );
    
    // Group by company
    const groups: Record<string, ApplicationData[]> = {};
    matches.forEach(m => {
      if (!groups[m.syarikat]) groups[m.syarikat] = [];
      groups[m.syarikat].push(m);
    });
    return Object.entries(groups).map(([name, apps]) => ({
      name,
      cidb: apps[0].cidb,
      history: apps.sort((a, b) => {
        const da = parseDate(a.tarikh_lulus || a.tarikh_syor || a.start_date) || new Date(0);
        const db = parseDate(b.tarikh_lulus || b.tarikh_syor || b.start_date) || new Date(0);
        return db.getTime() - da.getTime();
      })
    }));
  }, [data, searchQuery]);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tighter">{t('system_name')}</h1>
        <h2 className="text-lg font-bold uppercase mt-1">{t('analisis_permohonan')}</h2>
        <div className="grid grid-cols-2 gap-4 mt-4 text-[10px] font-bold uppercase">
          <p>📅 {isEn ? 'Period' : 'Tempoh'}: {filterMonth === 'all' ? (isEn ? 'All Months' : 'Semua Bulan') : MONTHS[parseInt(filterMonth)-1].toUpperCase()} {filterYear}</p>
          <p>👤 {isEn ? 'User' : 'Pengguna'}: {selectedUser ? selectedUser.name.toUpperCase() : (isEn ? 'All Users' : 'Semua Pengguna')}</p>
          <p>🏷️ {isEn ? 'Role' : 'Peranan'}: {effectiveRole.toUpperCase()}</p>
          <p>🕒 {isEn ? 'Printed on' : 'Dicetak pada'}: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">📊 {t('analisis_permohonan')}</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
             {role === 'pengesyor' ? t('dashboard_role_note_pengesyor') : t('dashboard_role_note_pelulus')}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          {role === 'ks_sptb' && (
            <select 
              value={selectedUserId} 
              onChange={e => setSelectedUserId(e.target.value)} 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none shadow-sm"
            >
              <option value="all">{isEn ? 'ALL USERS' : 'SEMUA PENGGUNA'}</option>
              {systemUsers.filter(u => u.role === 'pengesyor' || u.role === 'pelulus').map(u => (
                <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
              ))}
            </select>
          )}
          <button 
            onClick={() => window.print()} 
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <span>🖨️</span> {t('cetak')}
          </button>
          <div className="relative">
            <input 
              type="text" 
              placeholder={isEn ? "Search Company History..." : "Cari Sejarah Syarikat..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 pl-8 text-[10px] font-black uppercase outline-none shadow-sm w-48 md:w-64"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none shadow-sm">
            <option value="all">{t('semua_bulan')}</option>
            {MONTHS.map((m, i) => <option key={m} value={(i + 1).toString()}>{m.toUpperCase()}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none shadow-sm">
            {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Repeated Application Search Results */}
      {searchQuery && (
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="text-xl">🔍</span> {isEn ? "Repeated Application Analysis" : "Analisis Permohonan Berulang"}
          </h3>
          {repeatedApps.length === 0 ? (
            <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-8">{isEn ? "No matching records found" : "Tiada rekod sepadan ditemui"}</p>
          ) : (
            <div className="space-y-4">
              {repeatedApps.map((group, i) => (
                <div key={i} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase">{group.name} <span className="text-slate-400 ml-2">({group.cidb})</span></h4>
                    <span className="text-[9px] font-black text-slate-400 uppercase">{group.history.length} {isEn ? "Applications" : "Permohonan"}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.history.map((app, j) => {
                      const isLulus = app.kelulusan?.includes('LULUS');
                      const isTolak = app.kelulusan?.includes('TOLAK') || app.kelulusan?.includes('BEKU');
                      return (
                        <div key={j} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">{app.tarikh_lulus || app.tarikh_syor || app.start_date || '-'}</p>
                            <p className="text-[10px] font-black text-slate-800 uppercase mt-0.5">{app.jenis}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-black ${
                            isLulus ? 'bg-emerald-50 text-emerald-600' : 
                            isTolak ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {app.kelulusan || app.syor_status || 'PROSES'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <StatCard label={t('jumlah')} value={total} color="blue" />
        <StatCard label={effectiveRole === 'pengesyor' ? t('sokong') : t('lulus')} value={successCount} color="emerald" />
        <StatCard label={effectiveRole === 'pengesyor' ? t('tolak') : t('gagal')} value={rejectCount} color="rose" />
        <StatCard label={t('peratus')} value={`${rate}%`} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-2">
        <ChartCard title={t('trend_bulanan')}>
          <Bar data={monthlyTrendData} options={chartOptions} />
        </ChartCard>

        <ChartCard title={t('status_syor_keputusan')}>
          <Doughnut data={statusChartData} options={chartOptions} />
        </ChartCard>

        {effectiveRole === 'pengesyor' ? (
          <ChartCard title={t('jenis_pecahan')}>
            <Pie data={typeChartData} options={chartOptions} />
          </ChartCard>
        ) : (
          <ChartCard title={isEn ? "Rejection Reason Distribution" : "Taburan Alasan Penolakan"}>
            <Bar 
              data={rejectionReasonChartData} 
              options={{
                ...chartOptions,
                indexAxis: 'y' as const,
              }} 
            />
          </ChartCard>
        )}
      </div>

      {/* Print-only Summary Table */}
      <div className="hidden print:block mt-8">
        <h3 className="text-sm font-black uppercase mb-4 border-b pb-2">{isEn ? 'Detailed Statistics Summary' : 'Ringkasan Statistik Terperinci'}</h3>
        <table className="w-full text-[10px] border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left">{isEn ? 'Metric' : 'Metrik'}</th>
              <th className="border border-slate-300 p-2 text-right">{isEn ? 'Value' : 'Nilai'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 p-2">{isEn ? 'Total Applications' : 'Jumlah Permohonan'}</td>
              <td className="border border-slate-300 p-2 text-right font-bold">{total}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2">{effectiveRole === 'pengesyor' ? t('sokong') : t('lulus')}</td>
              <td className="border border-slate-300 p-2 text-right font-bold text-emerald-600">{successCount}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2">{effectiveRole === 'pengesyor' ? t('tolak') : t('gagal')}</td>
              <td className="border border-slate-300 p-2 text-right font-bold text-rose-600">{rejectCount}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2">{t('proses')}</td>
              <td className="border border-slate-300 p-2 text-right font-bold text-amber-600">{inProcessCount}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2">{t('peratus')}</td>
              <td className="border border-slate-300 p-2 text-right font-bold">{rate}%</td>
            </tr>
          </tbody>
        </table>

        {effectiveRole === 'pelulus' && Object.keys(rejectionReasonChartData.labels).length > 0 && (
          <div className="mt-6">
            <h4 className="text-[10px] font-black uppercase mb-2">{isEn ? 'Rejection Reasons' : 'Alasan Penolakan'}</h4>
            <table className="w-full text-[9px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-300 p-2 text-left">{isEn ? 'Reason' : 'Alasan'}</th>
                  <th className="border border-slate-300 p-2 text-right">{isEn ? 'Count' : 'Jumlah'}</th>
                </tr>
              </thead>
              <tbody>
                {rejectionReasonChartData.labels.map((label: any, idx: number) => (
                  <tr key={idx}>
                    <td className="border border-slate-300 p-2 uppercase">{label}</td>
                    <td className="border border-slate-300 p-2 text-right">{rejectionReasonChartData.datasets[0].data[idx]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
            {filterMonth === 'all' ? (isEn ? "Monthly Analysis" : "Analisis Bulanan") : (isEn ? "Weekly Analysis" : "Analisis Mingguan")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] font-bold">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 uppercase tracking-tighter">
                <th className="px-6 py-4">{filterMonth === 'all' ? (isEn ? "Month" : "Bulan") : (isEn ? "Week" : "Minggu")}</th>
                <th className="px-6 py-4">{isEn ? "Total Apps" : "Jumlah Permohonan"}</th>
                <th className="px-6 py-4">{isEn ? "Success" : "Berjaya"}</th>
                <th className="px-6 py-4">{isEn ? "Failed" : "Gagal"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {useMemo(() => {
                if (filterMonth === 'all') {
                  // Monthly view
                  const monthly: Record<number, { total: number, success: number, fail: number }> = {};
                  filteredData.forEach(item => {
                    const date = parseDate(item.start_date || item.tarikh_syor || item.tarikh_lulus);
                    if (date) {
                      const m = date.getMonth();
                      if (!monthly[m]) monthly[m] = { total: 0, success: 0, fail: 0 };
                      monthly[m].total++;
                      if (role === 'pengesyor' ? item.syor_status === 'SOKONG' : item.kelulusan?.includes('LULUS')) monthly[m].success++;
                      if (role === 'pengesyor' ? item.syor_status === 'TIDAK DISOKONG' : (item.kelulusan?.includes('TOLAK') || item.kelulusan?.includes('BEKU'))) monthly[m].fail++;
                    }
                  });
                  return Object.entries(monthly).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([m, stats]) => (
                    <tr key={m} className="hover:bg-white/50 transition-all">
                      <td className="px-6 py-4 text-slate-800 uppercase">{MONTHS[parseInt(m)]}</td>
                      <td className="px-6 py-4 text-slate-500">{stats.total}</td>
                      <td className="px-6 py-4 text-emerald-600">{stats.success}</td>
                      <td className="px-6 py-4 text-rose-600">{stats.fail}</td>
                    </tr>
                  ));
                } else {
                  // Weekly view for selected month
                  const weeks: Record<number, { total: number, success: number, fail: number }> = {};
                  filteredData.forEach(item => {
                    const date = parseDate(item.start_date || item.tarikh_syor || item.tarikh_lulus);
                    if (date) {
                      // Calculate week of month
                      const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                      const weekNum = Math.ceil((date.getDate() + firstDayOfMonth.getDay()) / 7);
                      if (!weeks[weekNum]) weeks[weekNum] = { total: 0, success: 0, fail: 0 };
                      weeks[weekNum].total++;
                      if (role === 'pengesyor' ? item.syor_status === 'SOKONG' : item.kelulusan?.includes('LULUS')) weeks[weekNum].success++;
                      if (role === 'pengesyor' ? item.syor_status === 'TIDAK DISOKONG' : (item.kelulusan?.includes('TOLAK') || item.kelulusan?.includes('BEKU'))) weeks[weekNum].fail++;
                    }
                  });
                  return Object.entries(weeks).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([week, stats]) => (
                    <tr key={week} className="hover:bg-white/50 transition-all">
                      <td className="px-6 py-4 text-slate-800 uppercase">{isEn ? `Week` : `Minggu`} {week}</td>
                      <td className="px-6 py-4 text-slate-500">{stats.total}</td>
                      <td className="px-6 py-4 text-emerald-600">{stats.success}</td>
                      <td className="px-6 py-4 text-rose-600">{stats.fail}</td>
                    </tr>
                  ));
                }
              }, [filteredData, role, isEn, filterMonth])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = React.memo(({ label, value, color }: { label: string, value: any, color: string }) => (
  <div className={`p-6 rounded-3xl border border-slate-100 bg-white/70 backdrop-blur-xl flex flex-col items-center justify-center shadow-sm border-t-4 border-t-${color}-500 transition-all hover:-translate-y-1 print:shadow-none print:border-slate-200 print:rounded-xl print:p-4`}>
    <span className={`text-3xl font-black text-slate-800 print:text-xl`}>{value}</span>
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 text-center print:text-[8px]">{label}</span>
  </div>
));

const ChartCard = React.memo(({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[320px] print:shadow-none print:border-slate-200 print:rounded-xl print:h-[250px] print:p-4">
    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2 print:mb-2 print:text-[8px]">{title}</h3>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
));

export default Dashboard;
