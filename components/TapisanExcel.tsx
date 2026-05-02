
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ApplicationData, ExcelRow } from '../types';
import { useStore } from '../store/useStore';
import { JENIS_PERMOHONAN } from '../constants';
import { toast } from 'sonner';
import { FileUp, Trash2, ShoppingCart, CheckCircle2, Filter, Search, Loader2, Calendar, Edit3, BarChart3 } from 'lucide-react';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

interface TapisanProps {
  view: 'filtering' | 'cart';
  existingApps?: ApplicationData[];
}

const TapisanExcel: React.FC<TapisanProps> = ({ view, existingApps = [] }) => {
  const { user, lang, t, setActiveApplication, setActiveTab } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';

  const onProses = (item: Partial<ApplicationData>) => {
    const newApp: any = {
      id: `app-${Date.now()}`,
      ...item,
      pengesyor: user?.name,
      pengesyor_id: user?.id,
      tarikh_mohon: item.date_submit || new Date().toISOString().split('T')[0],
      input_ubah_maklumat: item.jenis === 'UBAH MAKLUMAT' ? item.update_type : '',
      input_ubah_gred: item.jenis === 'UBAH GRED' ? item.update_type : '',
      tatatertib: 'TIADA',
      syor_lawatan: 'TIDAK',
      personnel: [],
      docs: { carta: '', peta: '', gambar: '', sewa: '' },
      kwsp: { m1: '', s1: '', m2: '', s2: '', m3: '', s3: '' }
    };
    setActiveApplication(newApp);
    setActiveTab('borang');
    toast.success(isEn ? "Data loaded to form!" : "Data dimuatkan ke borang!");
  };

  const [excelData, setExcelData] = useState<ExcelRow[]>([]);
  const [cartItems, setCartItems] = useState<ExcelRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeDistricts, setActiveDistricts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkCategory, setBulkCategory] = useState('BARU');
  const [isSyncing, setIsSyncing] = useState(false);
  const [cartFilter, setCartFilter] = useState<string>('ALL');

  // Real-time cart from Firebase
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      const authOk = await ensureFirebaseAuth();
      if (!authOk || !isMounted) {
        if (!authOk) console.error("Skipping cart listener: Auth failed");
        return;
      }
      const q = query(
        collection(db, "applications"), 
        where("processedBy", "==", user.id),
        where("status", "==", "Pending")
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const items: ExcelRow[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id, // Use Firestore Doc ID
            company: data.company,
            cidb: data.cidb,
            grade: data.grade,
            district: data.district,
            date: data.dateSubmitted,
            transactionCode: data.transactionCode,
            category: data.category,
            updateType: data.updateType,
            bpkuStatus: data.bpkuStatus,
            meetingStatus: data.meetingStatus
          };
        });
        setCartItems(items.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        }));
      }, (error) => {
        console.error("Firestore Cart Error:", error);
        toast.error(isEn ? "Failed to sync cart with Firebase" : "Gagal menyelaraskan bakul dengan Firebase");
      });
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, isEn]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (data.length < 2) {
        toast.error(isEn ? "Excel file is empty or invalid." : "Fail Excel kosong atau tidak sah.");
        return;
      }

      const headers = data[0].map(h => String(h).toLowerCase().trim());
      
      // Dynamic column detection
      const colIdx = {
        company: headers.findIndex(h => h.includes('syarikat') || h.includes('company') || h.includes('nama')),
        cidb: headers.findIndex(h => h.includes('cidb') || h.includes('reg') || h.includes('no pendaftaran')),
        grade: headers.findIndex(h => h.includes('gred') || h.includes('grade')),
        district: headers.findIndex(h => h.includes('daerah') || h.includes('district') || h.includes('disctrict') || h.includes('negeri')),
        date: headers.findIndex(h => h.includes('tarikh') || h.includes('date') || h.includes('submitted')),
        transaction: headers.findIndex(h => h.includes('transaction') || h.includes('transaksi') || h.includes('ref')),
        category: headers.findIndex(h => h.includes('category') || h.includes('kategori')),
        updateType: headers.findIndex(h => h.includes('update type') || h.includes('jenis perubahan') || h.includes('perubahan') || h.includes('update')),
        bpku: headers.findIndex(h => h.includes('bpku')),
        meeting: headers.findIndex(h => h.includes('meeting') || h.includes('mesyuarat')),
        address: headers.findIndex(h => h.includes('alamat') || h.includes('address') || h.includes('lokasi'))
      };

      const CHUNK_SIZE = 500;
      let index = 1;
      const rows: ExcelRow[] = [];
      const gradeRegex = /^G[4-7]/i;
      const numberMap: Record<string, string> = {'0':'K', '1':'S', '2':'D', '3':'T', '4':'E', '5':'L', '6':'E', '7':'T', '8':'L', '9':'S'};

      const processChunk = () => {
        const end = Math.min(index + CHUNK_SIZE, data.length);
        for (let i = index; i < end; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const company = String(row[colIdx.company] || '').trim();
          const cidb = String(row[colIdx.cidb] || '').trim();
          const grade = String(row[colIdx.grade] || '').trim();
          const district = String(row[colIdx.district] || '').trim();
          
          let date = '';
          if (colIdx.date !== -1) {
            const rawDate = row[colIdx.date];
            if (typeof rawDate === 'number') {
              const d = new Date((rawDate - 25569) * 86400 * 1000);
              date = d.toISOString().split('T')[0];
            } else {
              date = String(rawDate || '').trim();
            }
          }

          const transaction = colIdx.transaction !== -1 ? String(row[colIdx.transaction] || '').trim() : '';
          const category = colIdx.category !== -1 ? String(row[colIdx.category] || '').trim() : '';
          const updateType = colIdx.updateType !== -1 ? String(row[colIdx.updateType] || '').trim() : '';
          const bpkuStatus = colIdx.bpku !== -1 ? String(row[colIdx.bpku] || '').trim() : '';
          const meetingStatus = colIdx.meeting !== -1 ? String(row[colIdx.meeting] || '').trim() : '';
          const address = colIdx.address !== -1 ? String(row[colIdx.address] || '').trim() : '';

          if (!company || !cidb || !grade) continue;
          if (!gradeRegex.test(grade)) continue;

          const lastDigit = cidb.slice(-1);
          if (user.cidbEndsWith && user.cidbEndsWith.length > 0) {
            if (!user.cidbEndsWith.includes(lastDigit)) continue;
          }

          if (user.alphaSplit && user.alphaSplit[lastDigit]) {
            const range = user.alphaSplit[lastDigit];
            const [start, endRange] = range.split('-').map(s => s.trim().toUpperCase());
            let firstChar = company.charAt(0).toUpperCase();
            if (/[0-9]/.test(firstChar)) {
              firstChar = numberMap[firstChar] || firstChar;
            }
            if (firstChar < start || firstChar > endRange) continue;
          }

          const id = transaction || `${cidb}-${date}` || `xl-${i}-${Date.now()}`;
          rows.push({
            id, company, cidb, grade, district: district || 'TIADA MAKLUMAT',
            date, transactionCode: transaction, category, updateType, bpkuStatus, meetingStatus,
            alamatPerniagaan: address
          });
        }

        index = end;
        if (index < data.length) {
          // Continue in next frame to keep UI responsive
          requestAnimationFrame(processChunk);
        } else {
          setExcelData(rows);
          setActiveDistricts(new Set(rows.map(r => r.district)));
          toast.success(isEn ? `Imported ${rows.length} records matching your criteria.` : `Berjaya import ${rows.length} rekod mengikut kriteria anda.`);
        }
      };

      processChunk();
    };
    reader.readAsBinaryString(file);
  };

  const districts = useMemo(() => {
    const set = new Set<string>();
    excelData.forEach(r => set.add(r.district));
    return Array.from(set).sort();
  }, [excelData]);

  const filteredData = useMemo(() => {
    return excelData
      .filter(r => {
        const matchDistrict = activeDistricts.has(r.district);
        const matchSearch = r.company.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            r.cidb.toLowerCase().includes(searchQuery.toLowerCase());
        return matchDistrict && matchSearch;
      })
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
  }, [excelData, activeDistricts, searchQuery]);

  const cartKeys = useMemo(() => {
    const keys = new Set(cartItems.map(item => `${item.company.toLowerCase()}|${item.cidb}|${item.date || ''}|${item.transactionCode || ''}`));
    existingApps.forEach(app => {
      keys.add(`${app.syarikat.toLowerCase()}|${app.cidb}|${app.tarikh_mohon || ''}|${app.transaction_code || ''}`);
    });
    return keys;
  }, [cartItems, existingApps]);

  const toggleSelect = (row: ExcelRow) => {
    const key = `${row.company.toLowerCase()}|${row.cidb}|${row.date || ''}|${row.transactionCode || ''}`;
    if (cartKeys.has(key)) return;

    const next = new Set(selectedRows);
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    setSelectedRows(next);
  };

  const toggleSelectAll = () => {
    const selectable = filteredData.filter(r => !cartKeys.has(`${r.cidb}-${r.transactionCode || ''}`));
    if (selectedRows.size === selectable.length && selectable.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(selectable.map(r => r.id)));
    }
  };

  const addToCart = async () => {
    if (selectedRows.size === 0) {
      toast.error(isEn ? "Please select items first." : "Sila pilih item terlebih dahulu.");
      return;
    }

    if (!user?.id) {
      console.error("Session Error: User object is invalid", user);
      toast.error(isEn ? "Session error. Please logout and login again." : "Ralat sesi. Sila log keluar dan masuk semula.");
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading(isEn ? "Adding to Firebase..." : "Menambah ke Firebase...");

    try {
      await ensureFirebaseAuth();
      const toAdd = excelData.filter(r => selectedRows.has(r.id));
      
      if (toAdd.length === 0) {
        toast.error(isEn ? "No valid items selected." : "Tiada item sah dipilih.", { id: toastId });
        setIsSyncing(false);
        return;
      }

      const batch = writeBatch(db);
      
      toAdd.forEach(item => {
        const docRef = doc(collection(db, "applications"));
        batch.set(docRef, {
          company: item.company || 'N/A',
          cidb: item.cidb || 'N/A',
          grade: item.grade || 'N/A',
          district: item.district || 'N/A',
          transactionCode: item.transactionCode || '',
          category: bulkCategory || 'BARU',
          updateType: item.updateType || '',
          status: 'Pending',
          processedBy: user.id,
          processedByName: user.name || 'Unknown',
          dateSubmitted: item.date || '',
          bpkuStatus: item.bpkuStatus || '',
          meetingStatus: item.meetingStatus || '',
          alamatPerniagaan: item.alamatPerniagaan || '',
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast.success(isEn ? `Added ${toAdd.length} items to cart.` : `Ditambah ${toAdd.length} item ke bakul.`, { id: toastId });
      setSelectedRows(new Set());
    } catch (error: any) {
      console.error("Firebase Add Error Details:", error);
      const errorMsg = error?.message || (isEn ? "Check your connection or permissions." : "Semak sambungan atau kebenaran anda.");
      toast.error(`${isEn ? "Failed to add to Firebase" : "Gagal menambah ke Firebase"}: ${errorMsg}`, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const removeFromCart = async (docId: string) => {
    try {
      await deleteDoc(doc(db, "applications", docId));
      toast.success(isEn ? "Removed from cart" : "Dibuang dari bakul");
    } catch (error) {
      console.error("Firebase Delete Error:", error);
      toast.error(isEn ? "Failed to remove item" : "Gagal membuang item");
    }
  };

  const updateCartItem = async (id: string, updates: Partial<ExcelRow>) => {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, "applications", id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      toast.success(isEn ? "Item updated!" : "Item dikemaskini!", { duration: 1000 });
    } catch (e) {
      console.error("Update Item Error:", e);
      toast.error(isEn ? "Failed to update item" : "Gagal kemaskini item");
    }
  };

  const updateCartItemCategory = async (id: string, company: string, newCategory: string) => {
    if (!confirm(isEn 
      ? `Are you sure you want to change the application type for ${company}?` 
      : `Adakah anda pasti ingin menukar jenis permohonan bagi syarikat ${company}?`)) {
      return;
    }
    updateCartItem(id, { category: newCategory });
  };

  const cartCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: cartItems.length };
    JENIS_PERMOHONAN.forEach(j => {
      counts[j.label] = cartItems.filter(item => item.category === j.label).length;
    });
    return counts;
  }, [cartItems]);

  const filteredCartItems = useMemo(() => {
    if (cartFilter === 'ALL') return cartItems;
    return cartItems.filter(item => item.category === cartFilter);
  }, [cartItems, cartFilter]);

  const accentBg = `bg-${themeColor}-600`;

  if (view === 'cart') {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-32">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl text-white space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                <ShoppingCart size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight uppercase">{isEn ? 'Process Cart' : 'Bakul Proses'}</h2>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">{cartItems.length} {isEn ? 'Items Ready' : 'Item Sedia'}</p>
              </div>
            </div>
            
            {cartItems.length > 0 && (
              <button 
                onClick={() => {
                  if (confirm(isEn ? "Clear all items in cart?" : "Kosongkan semua item dalam bakul?")) {
                    setCartItems([]);
                  }
                }}
                className="text-white/40 hover:text-rose-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
              >
                <Trash2 size={14} /> {isEn ? 'Clear All' : 'Kosongkan'}
              </button>
            )}
          </div>

          {/* Cart Filters */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setCartFilter('ALL')}
              className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all border ${cartFilter === 'ALL' ? 'bg-white text-slate-900 border-transparent shadow-lg' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
            >
              {isEn ? 'All' : 'Semua'} ({cartCounts.ALL})
            </button>
            {JENIS_PERMOHONAN.map(j => (
              <button 
                key={j.id}
                onClick={() => setCartFilter(j.label)}
                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all border ${cartFilter === j.label ? 'bg-white text-slate-900 border-transparent shadow-lg' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
              >
                {j.label} ({cartCounts[j.label] || 0})
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredCartItems.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <p className="text-white/20 font-black uppercase tracking-[0.3em]">{isEn ? 'No items in this category' : 'Tiada item dalam kategori ini'}</p>
              </div>
            ) : (
              filteredCartItems.map((item) => (
                <div key={item.id} className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-all">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center gap-3">
                        <input 
                          value={item.company}
                          onChange={(e) => updateCartItem(item.id, { company: e.target.value.toUpperCase() })}
                          className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 outline-none font-black text-sm uppercase tracking-tight py-1 w-full"
                        />
                        <span className="px-2 py-0.5 bg-white/10 rounded-md text-[9px] font-black text-white/60 shrink-0">{item.grade}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-wrap">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{item.district}</p>
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] font-black text-white/20 uppercase tracking-widest Shrink-0">CIDB:</span>
                           <input 
                            value={item.cidb}
                            onChange={(e) => updateCartItem(item.id, { cidb: e.target.value.toUpperCase() })}
                            className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 outline-none text-[10px] font-bold text-white/40 tracking-widest w-32"
                          />
                        </div>
                        {item.date && (
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={10} /> {item.date}
                          </p>
                        )}
                        {item.updateType && (
                          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                            <Edit3 size={10} /> {item.updateType}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Jenis:</span>
                          <select 
                            value={item.category || 'BARU'}
                            onChange={(e) => updateCartItemCategory(item.id, item.company, e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase outline-none focus:border-white/30 transition-all text-white/60"
                          >
                            {JENIS_PERMOHONAN.map(j => (
                              <option key={j.id} value={j.label} className="bg-slate-900">{j.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="w-10 h-10 flex items-center justify-center text-white/30 hover:text-rose-500 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button 
                      onClick={() => onProses({
                        syarikat: item.company,
                        cidb: item.cidb,
                        gred: item.grade,
                        negeri: item.district,
                        jenis: item.category || 'BARU',
                        date_submit: item.date,
                        bpku_status: item.bpkuStatus,
                        meeting_status: item.meetingStatus,
                        transaction_code: item.transactionCode,
                        update_type: item.updateType,
                        alamat_perniagaan: item.alamatPerniagaan,
                        firebaseDocId: item.id // This is the Firestore Doc ID
                      })}
                      className={`${accentBg} text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2`}
                    >
                      <CheckCircle2 size={14} /> {isEn ? 'Process' : 'Proses'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      {/* Upload Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${accentBg} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
              <BarChart3 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">{isEn ? 'Excel Filtering' : 'Tapisan Excel'}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isEn ? `Filtering for ${user.name}` : `Tapisan untuk ${user.name}`}
                {user.cidbEndsWith && user.cidbEndsWith.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded text-slate-500">
                    CIDB: *{user.cidbEndsWith.join(',')}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className={`cursor-pointer ${accentBg} text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:opacity-90 transition-all flex items-center gap-2`}>
              <FileUp size={16} /> {isEn ? 'Upload Excel' : 'Muat Naik Excel'}
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>

            {excelData.length > 0 && (
              <button 
                onClick={() => {
                  if (confirm(isEn ? "Reset all imported data?" : "Padam semua data yang diimport?")) {
                    setExcelData([]);
                    setSelectedRows(new Set());
                    toast.success(isEn ? "Excel data cleared" : "Data Excel dikosongkan");
                  }
                }}
                className="bg-white text-rose-500 px-6 py-4 rounded-2xl font-black text-xs uppercase border-2 border-rose-100 hover:bg-rose-50 transition-all flex items-center gap-2"
              >
                <Trash2 size={16} /> {isEn ? 'Reset' : 'Set Semula'}
              </button>
            )}
          </div>
        </div>

        {excelData.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* District Filters */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Filter size={12} /> {isEn ? 'Filter by District' : 'Tapis Mengikut Daerah'}
              </label>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => {
                    if (activeDistricts.size === districts.length) setActiveDistricts(new Set());
                    else setActiveDistricts(new Set(districts));
                  }}
                  className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm border ${activeDistricts.size === districts.length ? `${accentBg} text-white border-transparent` : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                >
                  {isEn ? 'Toggle All' : 'Pilih Semua'} ({excelData.length})
                </button>
                {districts.map(d => (
                  <button 
                    key={d}
                    onClick={() => {
                      const next = new Set(activeDistricts);
                      if (next.has(d)) next.delete(d);
                      else next.add(d);
                      setActiveDistricts(next);
                    }}
                    className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm border ${activeDistricts.has(d) ? `${accentBg} text-white border-transparent` : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {d} ({excelData.filter(r => r.district === d).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[300px]">
                <input 
                  type="text" 
                  placeholder={isEn ? "Search company or CIDB..." : "Cari syarikat atau CIDB..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                />
                <Search className="absolute left-4 top-4 text-slate-400" size={20} />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100">
                <select 
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="bg-transparent px-4 py-2 text-[10px] font-black uppercase outline-none"
                >
                  {JENIS_PERMOHONAN.map(j => (
                    <option key={j.id} value={j.label}>{j.label}</option>
                  ))}
                </select>
                <button 
                  onClick={addToCart}
                  disabled={isSyncing}
                  className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />} 
                  {isEn ? 'Add to Cart' : 'Tambah ke Bakul'} ({selectedRows.size})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-5 w-12">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={(() => {
                          const selectable = filteredData.filter(r => !cartKeys.has(`${r.cidb}-${r.transactionCode || ''}`));
                          return selectable.length > 0 && selectedRows.size === selectable.length;
                        })()}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{isEn ? 'Company' : 'Syarikat'}</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{isEn ? 'CIDB No' : 'No CIDB'}</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{isEn ? 'Grade' : 'Gred'}</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{isEn ? 'District' : 'Daerah'}</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{isEn ? 'Type' : 'Jenis'}</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{isEn ? 'Update' : 'Perubahan'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.map(row => {
                    const rowKey = `${row.company.toLowerCase()}|${row.cidb}|${row.date || ''}|${row.transactionCode || ''}`;
                    const isDuplicate = cartKeys.has(rowKey);
                    return (
                      <tr 
                        key={row.id} 
                        className={`transition-all ${isDuplicate ? 'bg-emerald-100/80 cursor-not-allowed' : 'hover:bg-slate-50/50 cursor-pointer'} ${selectedRows.has(row.id) ? 'bg-blue-50/30' : ''}`}
                        onClick={() => !isDuplicate && toggleSelect(row)}
                      >
                        <td className="p-5" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className={`w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${isDuplicate ? 'opacity-20 cursor-not-allowed' : ''}`}
                            checked={selectedRows.has(row.id) || isDuplicate}
                            disabled={isDuplicate}
                            onChange={() => !isDuplicate && toggleSelect(row)}
                          />
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{row.company}</p>
                            {isDuplicate && (
                              <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] font-black rounded uppercase">
                                {isEn ? 'Exists' : 'Wujud'}
                              </span>
                            )}
                          </div>
                          {row.date && (
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                              <Calendar size={10} /> {row.date}
                            </p>
                          )}
                        </td>
                        <td className="p-5 text-xs font-bold text-slate-500">{row.cidb}</td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black`}>{row.grade}</span>
                        </td>
                        <td className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.district}</td>
                        <td className="p-5">
                          <span className="text-[10px] font-black text-slate-500 uppercase">{row.category || '-'}</span>
                        </td>
                        <td className="p-5">
                          <span className="text-[10px] font-black text-amber-600 uppercase">{row.updateType || '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredData.length === 0 && (
                <div className="p-20 text-center bg-white">
                  <p className="text-slate-300 font-black uppercase tracking-widest">{isEn ? 'No matching records found' : 'Tiada rekod yang sepadan'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TapisanExcel;
