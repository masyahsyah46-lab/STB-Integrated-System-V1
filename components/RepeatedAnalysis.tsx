
import React, { useState, useMemo } from 'react';
import { ApplicationData } from '../types';
import { useStore } from '../store/useStore';

interface RepeatedProps {
}

const RepeatedAnalysis: React.FC<RepeatedProps> = () => {
  const { lang, t, applications: items } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';
  const [search, setSearch] = useState("");

  const repeatedGroups = useMemo(() => {
    const groups: Record<string, ApplicationData[]> = {};
    items.forEach(item => {
      // Group by company, CIDB, and application type
      const key = `${item.syarikat.toLowerCase()}|${item.cidb}|${(item.jenis || '').toLowerCase()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups)
      .filter(([_, apps]) => {
        // Only count as repeated if more than 1 application for the same type
        // AND at least one of them was rejected/frozen
        const hasRejection = apps.some(a => a.kelulusan?.includes('TOLAK') || a.kelulusan?.includes('BEKU'));
        return apps.length > 1 && hasRejection;
      })
      .map(([_, apps]) => {
        const sorted = apps.sort((a, b) => {
          const da = new Date(a.tarikh_lulus || a.tarikh_syor || a.start_date || 0).getTime();
          const db = new Date(b.tarikh_lulus || b.tarikh_syor || b.start_date || 0).getTime();
          return db - da;
        });
        const hasLulus = sorted.some(a => a.kelulusan?.includes('LULUS'));
        const attempts = sorted.length;
        return {
          name: sorted[0].syarikat,
          cidb: sorted[0].cidb,
          jenis: sorted[0].jenis,
          attempts,
          hasLulus,
          history: sorted
        };
      })
      .filter(group => {
        if (!search) return true;
        const q = search.toLowerCase();
        return group.name.toLowerCase().includes(q) || group.cidb.toLowerCase().includes(q);
      })
      .sort((a, b) => b.attempts - a.attempts);
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">🔄 {t('analisis_berulang')}</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
            {isEn ? "Analysis of companies with repeated rejections for the same type" : "Analisis syarikat dengan penolakan berulang bagi jenis yang sama"}
          </p>
        </div>
        <div className="relative flex-1 max-w-md">
          <input 
            type="text" 
            placeholder={t('cari_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
          />
          <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {repeatedGroups.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl p-20 rounded-3xl border border-slate-200 shadow-sm text-center">
             <p className="font-black text-slate-300 uppercase tracking-widest">{t('tiada_rekod')}</p>
          </div>
        ) : (
          repeatedGroups.map((group, i) => (
            <div key={i} className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase">{group.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.cidb}</p>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">• {group.jenis}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase">
                    {group.attempts} {isEn ? "Attempts" : "Cubaan"}
                  </span>
                  {group.hasLulus && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase">
                      {isEn ? "Finally Approved" : "Akhirnya Lulus"}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.history.map((app, j) => (
                  <div key={j} className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">{app.tarikh_lulus || app.tarikh_syor || app.start_date || '-'}</p>
                      <p className="text-[10px] font-black text-slate-800 uppercase mt-0.5">{app.jenis}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black ${
                      app.kelulusan?.includes('LULUS') ? 'bg-emerald-50 text-emerald-600' : 
                      (app.kelulusan?.includes('TOLAK') || app.kelulusan?.includes('BEKU')) ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {app.kelulusan || app.syor_status || 'PROSES'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RepeatedAnalysis;
