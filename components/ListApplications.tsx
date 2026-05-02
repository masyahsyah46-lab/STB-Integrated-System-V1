
import React, { useState, useMemo } from 'react';
import { ApplicationData } from '../types';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';

interface ListProps {
  type: 'drafts' | 'submitted' | 'inbox' | 'history' | 'all_drafts' | 'all_history' | 'inbox_semakan' | 'semakan' | 'telah_semak';
}

const ListApplications: React.FC<ListProps> = ({ type }) => {
  const { user, lang, t, applications, setActiveApplication, setActiveTab } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  const items = useMemo(() => {
    if (!user) return [];
    const uName = (user.name || '').trim().toUpperCase();
    const uId = (user.id || '').trim().toUpperCase();

    let list: ApplicationData[] = [];
    switch (type) {
      case 'drafts':
        list = applications.filter(a => {
          const isOwn = (a.pengesyor?.trim().toUpperCase() === uName) || (a.pengesyor_id?.trim().toUpperCase() === uId);
          return isOwn && (!a.tarikh_syor || !a.syor_status);
        });
        break;
      case 'submitted':
        list = applications.filter(a => {
          const isOwn = (a.pengesyor?.trim().toUpperCase() === uName) || (a.pengesyor_id?.trim().toUpperCase() === uId);
          return (isOwn || user.role === 'ks_sptb' || user.role === 'pp_sptb') && (!!a.tarikh_syor && !!a.syor_status);
        });
        break;
      case 'inbox_semakan':
        list = applications.filter(a => {
          const isTarget = a.target_semakan === (user.role === 'ks_sptb' ? 'KS SPTB' : 'PP SPTB');
          return isTarget && (!a.status_semakan || a.status_semakan === 'DALAM SEMAKAN');
        });
        break;
      case 'semakan':
        list = applications.filter(a => {
          const isTarget = a.target_semakan === (user.role === 'ks_sptb' ? 'KS SPTB' : 'PP SPTB');
          return isTarget && a.status_semakan === 'DALAM SEMAKAN';
        });
        break;
      case 'telah_semak':
        list = applications.filter(a => {
          const isTarget = a.target_semakan === (user.role === 'ks_sptb' ? 'KS SPTB' : 'PP SPTB');
          return isTarget && a.status_semakan === 'LENGKAP' && !a.tarikh_syor;
        });
        break;
      case 'inbox':
        list = applications.filter(a => !!a.tarikh_syor && !a.tarikh_lulus);
        break;
      case 'history':
        if (user.role === 'pelulus') {
          list = applications.filter(a => {
            const isMe = (a.pelulus?.trim().toUpperCase() === uName) || (a.pelulus_id?.trim().toUpperCase() === uId);
            return (isMe && !!a.tarikh_lulus);
          });
        } else {
          list = applications.filter(a => !!a.tarikh_lulus);
        }
        break;
      case 'all_drafts':
        list = applications.filter(a => !a.tarikh_syor || !a.syor_status);
        break;
      case 'all_history':
        list = applications.filter(a => !!a.tarikh_lulus);
        break;
    }
    return list;
  }, [applications, user, type]);

  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState("all");
  const [filterSpi, setFilterSpi] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");

  const staffOptions = useMemo(() => {
    const list = new Set<string>();
    items.forEach(i => {
      const name = type.includes('history') ? i.pelulus : i.pengesyor;
      if (name) list.add(name);
    });
    return Array.from(list).sort();
  }, [items, type]);

  const jenisOptions = useMemo(() => {
    const list = new Set<string>();
    items.forEach(i => { if (i.jenis) list.add(i.jenis); });
    return Array.from(list).sort();
  }, [items]);

  const jenisCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(i => {
      if (i.jenis) counts[i.jenis] = (counts[i.jenis] || 0) + 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      const matchSearch = (i.syarikat || '').toUpperCase().includes(search.toUpperCase()) || (i.cidb || '').toUpperCase().includes(search.toUpperCase());
      const matchJenis = filterJenis === 'all' || i.jenis === filterJenis;
      const matchSpi = filterSpi === 'all' || (filterSpi === 'YA' ? i.syor_lawatan === 'YA' : i.syor_lawatan !== 'YA');
      const staffName = type.includes('history') ? i.pelulus : i.pengesyor;
      const matchStaff = filterStaff === 'all' || staffName === filterStaff;
      return matchSearch && matchJenis && matchSpi && matchStaff;
    });
  }, [items, search, filterJenis, filterSpi, filterStaff, type]);

  const onAction = (item: ApplicationData) => {
    setActiveApplication(item);
    if (user?.role === 'ks_sptb' && type !== 'drafts' && type !== 'submitted') {
       setActiveTab('preview');
       return;
    }
    if (type === 'drafts') {
      setActiveTab('database');
    } else {
      setActiveTab('preview');
    }
  };

  const getButtonConfig = (item: ApplicationData) => {
    if (user?.role === 'ks_sptb' && type !== 'drafts' && type !== 'submitted') {
       return { label: isEn ? 'VIEW' : 'LIHAT', className: 'bg-slate-800 text-white' };
    }
    if (type === 'drafts') return { label: isEn ? 'EDIT' : 'KEMASKINI', className: `bg-${themeColor}-600 text-white` };
    if (type === 'inbox') return { label: isEn ? 'REVIEW' : 'SEMAK', className: 'bg-blue-600 text-white' };
    return { label: isEn ? 'VIEW' : 'LIHAT', className: 'bg-slate-800 text-white' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 min-w-[200px]">
          <input 
            type="text" 
            placeholder={isEn ? "Search Syarikat or CIDB..." : "Cari Syarikat atau CIDB..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:border-blue-500 shadow-sm"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0">
           {(type === 'all_drafts' || type === 'inbox' || type === 'history' || type === 'all_history') && (
             <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-[11px] font-black outline-none cursor-pointer min-w-[150px]">
                <option value="all">{type.includes('history') ? 'SEMUA PELULUS' : 'SEMUA PENGESYOR'}</option>
                {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           )}

           <select value={filterSpi} onChange={e => setFilterSpi(e.target.value)} className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-[11px] font-black outline-none cursor-pointer">
              <option value="all">ALL SPI STATUS</option>
              <option value="YA">HANTAR SPI</option>
              <option value="TIDAK">TIADA SPI</option>
           </select>

           <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)} className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-[11px] font-black outline-none cursor-pointer">
              <option value="all">ALL TYPES</option>
              {jenisOptions.map(j => <option key={j} value={j}>{j} ({jenisCounts[j]})</option>)}
           </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-20 text-center glass rounded-3xl">
             <div className="text-6xl mb-4 grayscale opacity-20">📋</div>
             <p className="font-black text-slate-300 uppercase tracking-[0.2em]">{t('tiada_rekod')}</p>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const btn = getButtonConfig(item);
            let typeColor = 'bg-slate-100 text-slate-600';
            if (item.jenis?.includes('BARU')) typeColor = 'bg-blue-100 text-blue-700';
            if (item.jenis?.includes('PEMBAHARUAN')) typeColor = 'bg-emerald-100 text-emerald-700';
            if (item.jenis?.includes('UBAH')) typeColor = 'bg-amber-100 text-amber-700';
            if (item.syor_lawatan === 'YA') typeColor = 'bg-rose-100 text-rose-700';

            return (
              <div 
                key={item.id || idx}
                className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-white rounded-[2rem] border-2 border-slate-100 hover:border-blue-400 transition-all group shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap text-sm md:text-base">
                    <span className="text-[10px] font-black text-slate-300 mr-2">
                       {idx + 1} ({String(item.row || 0).padStart(5, '0')})
                    </span>
                    <span className="font-black text-slate-800 truncate uppercase tracking-tight">{item.syarikat}</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${typeColor}`}>
                      {item.jenis}
                    </span>
                    {item.syor_lawatan === 'YA' && (
                      <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-900 text-white uppercase tracking-widest">
                        HANTAR SPI
                      </span>
                    )}
                  </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-slate-400 font-black uppercase tracking-wider">{item.cidb} • {item.gred} • {item.negeri || 'TIADA NEGERI'}</p>
                      
                      {item.jenis?.includes('UBAH') ? (
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-lg w-fit">
                           🔄 {item.input_ubah_maklumat || item.input_ubah_gred || 'PEMALAIAN MAKLUMAT'}
                        </p>
                      ) : (
                        item.catatan && <p className="text-[10px] font-medium text-slate-400 italic">“{item.catatan}”</p>
                      )}

                      {item.tarikh_syor && (
                        <p className="text-[10px] font-black text-slate-400">📅 {item.tarikh_syor}</p>
                      )}
                    </div>
                </div>
                
                <div className="flex gap-3 mt-4 md:mt-0">
                  {(type === 'submitted' || type === 'history' || type === 'all_history') && (
                    <button 
                       onClick={() => {
                         const undoType = (['submitted', 'all_drafts', 'drafts'] as string[]).includes(type) ? 'undo_syor' : 'undo_lulus';
                         if (confirm(isEn ? `Undo this action for record ${item.row}?` : `Undo tindakan untuk rekod ${item.row}?`)) {
                           useStore.getState().undoSync(item.row || 0, undoType);
                         }
                       }}
                       className="px-4 py-2 rounded-2xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all border border-amber-100 text-[10px] font-black uppercase"
                    >
                       Undo
                    </button>
                  )}
                  {type === 'drafts' && (
                    <button 
                       onClick={() => {
                         if (confirm(isEn ? "Delete this record?" : "Padam rekod ini?")) {
                           useStore.getState().deleteApplication(item.row || 0);
                         }
                       }}
                       className="w-12 h-12 flex items-center justify-center rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all border border-rose-100"
                    >
                       🗑️
                    </button>
                  )}
                  <button 
                    onClick={() => onAction(item)}
                    className={`px-10 py-4 rounded-2xl text-xs font-black transition-all shadow-lg active:scale-95 uppercase tracking-widest ${btn.className}`}
                  >
                    {btn.label}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
        {isEn ? `Showing ${filtered.length} records` : `Memaparkan ${filtered.length} rekod`}
      </div>
    </div>
  );
};

export default ListApplications;
