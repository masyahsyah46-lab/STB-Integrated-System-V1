
import React, { useState, useMemo } from 'react';
import { ApplicationData } from '../types';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';

interface FrozenProps {
}

const FrozenApplications: React.FC<FrozenProps> = () => {
  const { lang, t, applications: items, syncApplication: onUpdate } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';
  const [search, setSearch] = useState("");

  const frozenItems = useMemo(() => {
    return items.filter(i => i.is_beku || i.kelulusan?.includes('BEKU'));
  }, [items]);

  const filtered = useMemo(() => {
    return frozenItems.filter(i => 
      i.syarikat.toLowerCase().includes(search.toLowerCase()) || 
      i.cidb.toLowerCase().includes(search.toLowerCase())
    );
  }, [frozenItems, search]);

  const handleUnfreeze = async (item: ApplicationData) => {
    if (!confirm(isEn ? "Are you sure you want to unfreeze this application?" : "Adakah anda pasti ingin menyahbeku permohonan ini?")) return;
    
    const updated = {
      ...item,
      is_beku: false,
      kelulusan: 'DALAM PROSES', // Reset status
      updatedAt: new Date().toISOString()
    };
    await onUpdate(updated);
    toast.success(isEn ? "Application unfrozen" : "Permohonan dinyahbeku");
  };

  const handleUpdateEndDate = async (item: ApplicationData, newDate: string) => {
    const updated = {
      ...item,
      tarikh_tamat_beku: newDate,
      updatedAt: new Date().toISOString()
    };
    await onUpdate(updated);
    toast.success(isEn ? "End date updated" : "Tarikh tamat dikemaskini");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">❄️ {t('permohonan_beku')}</h2>
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] font-bold">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 uppercase tracking-tighter">
                <th className="px-6 py-4">{isEn ? "Company" : "Syarikat"}</th>
                <th className="px-6 py-4">{isEn ? "Start Date" : "Tarikh Mula"}</th>
                <th className="px-6 py-4">{isEn ? "End Date" : "Tarikh Tamat"}</th>
                <th className="px-6 py-4 text-right">{isEn ? "Actions" : "Tindakan"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-300 uppercase tracking-widest">
                    {t('tiada_rekod')}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4">
                      <p className="text-slate-800 uppercase">{item.syarikat}</p>
                      <p className="text-slate-400 text-[8px]">{item.cidb}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.tarikh_mula_beku || '-'}</td>
                    <td className="px-6 py-4">
                      <input 
                        type="date" 
                        defaultValue={item.tarikh_tamat_beku}
                        onBlur={(e) => handleUpdateEndDate(item, e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-black outline-none"
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleUnfreeze(item)}
                        className={`px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-700 transition-all`}
                      >
                        {t('nyah_beku')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FrozenApplications;
