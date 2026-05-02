
import React, { useState, useRef, useEffect } from 'react';
import { ApplicationData, Personnel } from '../types';
import { JENIS_PERMOHONAN, GRED_OPTIONS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/useStore';
import { gasService } from '../services/gasService';
import { toast } from 'sonner';
import SnailProgress from './SnailProgress';
import { FileUp, Printer, Save, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import PrintLayout from './PrintLayout';

interface BorangProps {
}

const BorangSemakan: React.FC<BorangProps> = () => {
  const { user, lang, t, activeApplication: initialData, setActiveTab, syncApplication: onSave, setIsAutoSaved } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const isEn = lang === 'en';
  const printRef = useRef<HTMLDivElement>(null);

  const defaultFormData: ApplicationData = {
    id: uuidv4(),
    syarikat: '',
    cidb: '',
    gred: '',
    jenis: 'BARU',
    input_ubah_maklumat: '',
    input_ubah_gred: '',
    negeri: '',
    tarikh_mohon: new Date().toISOString().split('T')[0],
    tatatertib: 'TIADA',
    syor_lawatan: 'TIDAK',
    pautan: '',
    justifikasi: '',
    justifikasi_lawatan: '',
    spkk_duration: '',
    stb_duration: '',
    ssm_date: '',
    ssm_status: '',
    bank_date: '',
    bank_sign: '',
    bank_status: '',
    bpku_status: '',
    meeting_status: '',
    transaction_code: '',
    date_submit: '',
    alamat_perniagaan: '',
    jenis_konsultansi: '',
    personnel: [{ id: uuidv4(), name: '', isCompany: false, roles: [], s_ic: '', s_sb: '', s_epf: '' }],
    docs: { carta: '', peta: '', gambar: '', sewa: '' },
    kwsp: { m1: '', s1: '', m2: '', s2: '', m3: '', s3: '' },
    catatan: '',
    pengesyor: '',
    syor_status: '',
    fileName: ''
  };

  const [formData, setFormData] = useState<ApplicationData>(() => {
    const saved = localStorage.getItem('stb_form_persistence');
    if (saved && !initialData) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultFormData;
      }
    }
    if (!initialData) return { ...defaultFormData, id: uuidv4() };
    return {
      ...defaultFormData,
      ...initialData,
      id: initialData.id || uuidv4(),
      personnel: initialData.personnel || defaultFormData.personnel,
      docs: { ...defaultFormData.docs, ...(initialData.docs || {}) },
      kwsp: { ...defaultFormData.kwsp, ...(initialData.kwsp || {}) }
    };
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [showReview, setShowReview] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('stb_form_persistence', JSON.stringify(formData));
      // Trigger a custom event for the "Saved" indicator in App.tsx if needed
      window.dispatchEvent(new CustomEvent('stb_autosave_success'));
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData]);

  const updateField = (path: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      if (parts.length === 1) (next as any)[parts[0]] = value;
      else if (parts.length === 2) (next as any)[parts[0]][parts[1]] = value;
      return next;
    });
  };

  const updatePersonnel = (id: string, updates: Partial<Personnel>) => {
    const newList = formData.personnel.map(p => p.id === id ? { ...p, ...updates } : p);
    updateField('personnel', newList);
  };

  const handleFileUpload = async (file: File, mode: 'ai' | 'manual') => {
    if (!file || file.type !== 'application/pdf') {
      toast.error(isEn ? "Please upload PDF only." : "Sila muat naik fail PDF sahaja.");
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setFormData(prev => ({ ...prev, fileName: file.name }));

    try {
      if (!(window as any).pdfjsLib) {
        throw new Error("PDF.js library not found on window");
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setProgress(30);
      
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
        setProgress(30 + (i / pdf.numPages) * 20);
      }

      let aiData: any = {};
      if (mode === 'ai') {
        setProgress(60);
        try {
          // Identify if it's a form or profile based on context (default borang)
          const selectionType = formData.syarikat ? 'profile' : 'borang';
          aiData = await gasService.processAI(fullText, selectionType);
        } catch (aiErr: any) {
          console.error("AI Extraction Error:", aiErr);
          toast.error(isEn ? `AI Error: ${aiErr.message || 'Unknown error'}` : `Ralat AI: ${aiErr.message || 'Ralat tidak diketahui'}`);
          setIsProcessing(false);
          return;
        }
        
        // Slow progress from 60 to 95
        for (let p = 61; p <= 95; p++) {
          await new Promise(r => setTimeout(r, 40)); 
          setProgress(p);
        }
      } else {
        // Manual Regex Extraction
        const cleanText = fullText.toUpperCase();
        const companyMatch = cleanText.match(/NAMA SYARIKAT\s*:\s*(.*)/i) || cleanText.match(/SYARIKAT\s*:\s*(.*)/i);
        const cidbMatch = cleanText.match(/NO\.?\s*CIDB\s*:\s*([A-Z0-9]+)/i) || cleanText.match(/NO\.?\s*PENDAFTARAN\s*:\s*([A-Z0-9]+)/i);
        const gredMatch = cleanText.match(/GRED\s*:\s*(G[1-7])/i);
        
        aiData = {
          companyName: companyMatch ? companyMatch[1].trim() : '',
          cidbNumber: cidbMatch ? cidbMatch[1].trim() : '',
          grade: gredMatch ? gredMatch[1].trim() : '',
          directors: [],
          shareholders: [],
          nominees: [],
          signatories: []
        };
        
        // Simple name extraction (very basic, usually needs AI for accuracy)
        const nameLines = cleanText.split('\n').filter(l => l.length > 5 && l.includes(' '));
        if (nameLines.length > 0) {
           aiData.directors = nameLines.slice(0, 3);
        }
      }

      setExtractedData(aiData);
      setShowReview(true);
    } catch (error) {
      console.error("PDF Processing Error:", error);
      toast.error(isEn ? "Failed to process PDF." : "Gagal memproses PDF.");
    } finally {
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 800);
    }
  };

  const applyExtractedData = () => {
    if (!extractedData) return;

    const normalizeName = (name: string) => {
      return name.replace(/^(DATO'|DATIN|HAJI|HJ|DR|PROF|TUN|TAN SRI|PUAN SRI)\.?\s+/i, '').trim().toUpperCase();
    };

    const personnelMap = new Map<string, Set<string>>();
    
    const addRole = (names: string[], role: string) => {
      (names || []).forEach(name => {
        const clean = normalizeName(name);
        if (!clean) return;
        if (!personnelMap.has(clean)) personnelMap.set(clean, new Set());
        personnelMap.get(clean)!.add(role);
      });
    };

    addRole(extractedData.directors, 'PENGARAH');
    addRole(extractedData.shareholders, 'P.EKUITI');
    addRole(extractedData.nominees, 'P.SPKK');
    addRole(extractedData.signatories, 'T.T CEK');

    const mergedPersonnel = Array.from(personnelMap.entries()).map(([name, roles]) => ({
      id: uuidv4(),
      name,
      isCompany: false,
      roles: Array.from(roles),
      s_ic: '', s_sb: '', s_epf: ''
    }));

    setFormData(prev => ({
      ...prev,
      syarikat: extractedData.companyName?.toUpperCase() || prev.syarikat,
      cidb: extractedData.cidbNumber?.toUpperCase() || prev.cidb,
      gred: extractedData.grade?.toUpperCase() || prev.gred,
      negeri: extractedData.negeri?.toUpperCase() || prev.negeri,
      alamat_perniagaan: extractedData.alamatPerniagaan?.toUpperCase() || prev.alamat_perniagaan,
      alamat_operasi: extractedData.alamatOperasi?.toUpperCase() || prev.alamat_operasi,
      spkk_duration: extractedData.spkkStart && extractedData.spkkEnd ? `${extractedData.spkkStart} - ${extractedData.spkkEnd}` : prev.spkk_duration,
      stb_duration: extractedData.stbStart && extractedData.stbEnd ? `${extractedData.stbStart} - ${extractedData.stbEnd}` : prev.stb_duration,
      personnel: mergedPersonnel.length > 0 ? mergedPersonnel : prev.personnel
    }));

    setShowReview(false);
    toast.success(isEn ? "Data applied to form!" : "Data telah dimasukkan ke borang!");
  };

  const handlePrint = async () => {
    if (!formData.syarikat) {
      toast.error(isEn ? "Enter company name first" : "Sila isi nama syarikat dahulu");
      return;
    }

    if (confirm(isEn ? "Would you like to save this form to the company's Drive folder before printing?" : "Adakah anda ingin menyimpan borang ini ke folder Drive syarikat sebelum mencetak?")) {
      const toastId = toast.loading(isEn ? "Saving to Drive..." : "Menyimpan ke Drive...");
      try {
        await gasService.submitToGas({
          action: 'saveToDrive',
          data: {
             ...formData,
             // Ensure legacy flags are sent to GAS
             is_pemutihan: formData.is_pemutihan === true,
             jenis: formData.jenis
          },
          user: user?.name,
          source: user?.source
        });
        toast.success(isEn ? "Saved and Email Triggered!" : "Berjaya disimpan dan Emel dicetuskan!", { id: toastId });
      } catch (err) {
        toast.error(isEn ? "Failed to save to Drive" : "Gagal simpan ke Drive", { id: toastId });
      }
    }

    setHasPrinted(true);
    window.print();
  };

  const accentBg = `bg-${themeColor}-600`;

  return (
    <>
      <div className="space-y-8 pb-32 print:hidden">
      {/* PDF Upload Section */}
      <div 
        className={`glass rounded-3xl p-8 border-2 border-dashed transition-all ${isDragging ? `border-${themeColor}-500 bg-${themeColor}-50/50` : 'border-slate-200'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFileUpload(file, 'ai');
        }}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl">📄</div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Muat Naik PDF CIDB untuk Auto-Isi</h3>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Seret & Lepas fail PDF di sini atau pilih fail</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.fileName && (
                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black border border-emerald-100 animate-in fade-in zoom-in duration-300">
                  ✅ {formData.fileName}
                </div>
              )}
              {extractedData && (
                <button 
                  onClick={() => setShowReview(true)}
                  className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-black border border-blue-100 transition-all animate-bounce"
                >
                  🔍 LIHAT HASIL EKSTRAKSI
                </button>
              )}
              <button 
                onClick={() => {
                  if (confirm(isEn ? "Are you sure you want to clear the form?" : "Adakah anda pasti ingin mengosongkan borang?")) {
                    localStorage.removeItem('stb_form_persistence');
                    setFormData(initialData || defaultFormData);
                    toast.error(isEn ? "Form Cleared" : "Borang Dikosongkan");
                  }
                }}
                className="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-black border border-rose-100 transition-all"
              >
                🔄 SET SEMULA BORANG
              </button>
            </div>
          </div>
          <div className="flex gap-2 w-full max-w-md">
            <label className={`flex-1 ${accentBg} text-white py-3 rounded-xl font-black text-[10px] uppercase cursor-pointer text-center hover:opacity-90 transition-all`}>
              Pilih Fail
              <input type="file" className="hidden" accept=".pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'ai')} />
            </label>
          </div>
        </div>

        {isProcessing && (
          <div className="mt-6 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm animate-in zoom-in-95">
            <SnailProgress progress={progress} label={isEn ? "Analyzing PDF..." : "Menganalisis PDF..."} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-12 relative overflow-hidden">
        {/* Animated Background Accent */}
        <div className="absolute top-0 left-0 w-full h-1 animated-bg opacity-50" />

        <SectionHeader num="1" title={t('maklumat_asas')} themeColor={themeColor} />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-6 space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('jenis_permohonan')}</label>
            <div className="flex flex-wrap gap-1">
              {['BARU', 'PEMBAHARUAN', 'UBAH MAKLUMAT', 'UBAH GRED'].map(j => (
                <button 
                  key={j} 
                  onClick={() => updateField('jenis', j)} 
                  className={`px-4 py-3 rounded-xl border-2 text-[8px] font-black transition-all ${formData.jenis === j ? `bg-${themeColor}-50 border-${themeColor}-600 text-${themeColor}-700` : 'bg-slate-50 border-transparent text-slate-400'}`}
                >
                  {j}
                </button>
              ))}
            </div>

            {/* Conditional Inputs */}
            {formData.jenis === 'UBAH MAKLUMAT' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <InputGroup 
                  label="BUTIRAN PERUBAHAN MAKLUMAT" 
                  value={formData.input_ubah_maklumat || ''} 
                  onChange={v => updateField('input_ubah_maklumat', v.toUpperCase())} 
                  themeColor={themeColor} 
                  placeholder="NYATAKAN PERUBAHAN..."
                />
              </div>
            )}
            {formData.jenis === 'UBAH GRED' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <InputGroup 
                  label="BUTIRAN PERUBAHAN GRED" 
                  value={formData.input_ubah_gred || ''} 
                  onChange={v => updateField('input_ubah_gred', v.toUpperCase())} 
                  themeColor={themeColor} 
                  placeholder="DARI G? KE G?..."
                />
              </div>
            )}
          </div>
          <div className="lg:col-span-2">
            <InputGroup label={t('tarikh_mohon')} type="date" value={formData.tarikh_mohon || ''} onChange={v => updateField('tarikh_mohon', v)} themeColor={themeColor} />
          </div>
          <div className="lg:col-span-2 space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STATUS PEMUTIHAN</label>
             <div className="flex gap-1 h-[48px]">
               {[true, false].map(v => (
                 <button 
                  key={String(v)} 
                  onClick={() => updateField('is_pemutihan', v)} 
                  className={`flex-1 rounded-xl border-2 text-[10px] font-black ${formData.is_pemutihan === v ? `bg-rose-50 border-rose-600 text-rose-700` : 'bg-slate-50 border-transparent text-slate-400'}`}
                 >
                   {v ? 'PEMUTIHAN' : 'NORMAL'}
                 </button>
               ))}
             </div>
          </div>
          <div className="lg:col-span-2 space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('semakan_tatatertib')}</label>
             <div className="flex gap-1 h-[48px]">
               {['ADA', 'TIADA'].map(v => <button key={v} onClick={() => updateField('tatatertib', v)} className={`flex-1 rounded-xl border-2 text-[10px] font-black ${formData.tatatertib === v ? `bg-${themeColor}-50 border-${themeColor}-600 text-${themeColor}-700` : 'bg-slate-50 border-transparent text-slate-400'}`}>{v}</button>)}
             </div>
          </div>
          <InputGroup label={t('justifikasi_lawatan')} value={formData.justifikasi_lawatan || ''} onChange={v => updateField('justifikasi_lawatan', v)} themeColor={themeColor} className="lg:col-span-2" placeholder="SEBAB LAWATAN..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <InputGroup label={t('nama_syarikat')} value={formData.syarikat} onChange={v => updateField('syarikat', v.toUpperCase())} themeColor={themeColor} className="md:col-span-2 lg:col-span-2" />
          <InputGroup label={t('no_cidb')} value={formData.cidb} onChange={v => updateField('cidb', v.toUpperCase())} themeColor={themeColor} />
          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('gred')}</label>
             <select value={formData.gred} onChange={e => updateField('gred', e.target.value)} className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl font-black text-xs px-3 outline-none">
                <option value="">G?</option>
                {GRED_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
             </select>
          </div>
          <InputGroup label={t('tempoh_spkk')} value={formData.spkk_duration || ''} onChange={v => updateField('spkk_duration', v)} themeColor={themeColor} />
          <InputGroup label="TEMPOH STB" value={formData.stb_duration || ''} onChange={v => updateField('stb_duration', v)} themeColor={themeColor} />
          <InputGroup label="ALAMAT PERNIAGAAN" value={formData.alamat_perniagaan || ''} onChange={v => updateField('alamat_perniagaan', v.toUpperCase())} themeColor={themeColor} className="md:col-span-3 lg:col-span-6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
           <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('tarikh_ssm')} type="date" value={formData.ssm_date || ''} onChange={v => updateField('ssm_date', v)} themeColor={themeColor} light />
              <StatusToggle label={t('status_ssm')} value={formData.ssm_status || ''} onChange={v => updateField('ssm_status', v)} />
           </div>
           <div className="grid grid-cols-3 gap-4">
              <InputGroup label={t('tarikh_bank')} type="date" value={formData.bank_date || ''} onChange={v => updateField('bank_date', v)} themeColor={themeColor} light />
              <InputGroup label={t('syarat_cek')} value={formData.bank_sign || ''} onChange={v => updateField('bank_sign', v)} themeColor={themeColor} light />
              <StatusToggle label={t('status_bank')} value={formData.bank_status || ''} onChange={v => updateField('bank_status', v)} />
           </div>
        </div>

        <SectionHeader num="2" title={t('personel_header')} themeColor={themeColor} />
        <div className="space-y-4">
          {formData.personnel.map((p, idx) => (
            <div key={p.id} className="p-6 bg-white border-2 border-slate-100 rounded-3xl relative group hover:border-blue-400 transition-all shadow-sm">
              <button onClick={() => updateField('personnel', formData.personnel.filter(per => per.id !== p.id))} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 font-black text-sm">✕</button>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                 <div className="lg:col-span-4">
                    <InputGroup label={`PERSONEL ${idx+1}`} value={p.name} onChange={v => updatePersonnel(p.id, { name: v.toUpperCase() })} themeColor={themeColor} placeholder="NAMA..." />
                 </div>
                 <div className="lg:col-span-4 flex flex-wrap gap-1 pt-4">
                    {['PENGARAH', 'P.EKUITI', 'P.SPKK', 'T.T CEK'].map(r => (
                      <button key={r} onClick={() => {
                        const roles = (p.roles || []).includes(r) ? p.roles.filter(x => x !== r) : [...(p.roles || []), r];
                        updatePersonnel(p.id, { roles });
                      }} className={`px-2 py-1 rounded-lg border-2 text-[8px] font-black transition-all ${(p.roles || []).includes(r) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-transparent text-slate-400'}`}>{r}</button>
                    ))}
                 </div>
                 <div className="lg:col-span-4 grid grid-cols-3 gap-2 pt-4">
                    <StatusToggle label="IC" value={p.s_ic} onChange={v => updatePersonnel(p.id, { s_ic: v })} compact />
                    <StatusToggle label="SB" value={p.s_sb} onChange={v => updatePersonnel(p.id, { s_sb: v })} compact />
                    <StatusToggle label="EPF" value={p.s_epf} onChange={v => updatePersonnel(p.id, { s_epf: v })} compact />
                 </div>
              </div>
            </div>
          ))}
          <button onClick={() => setFormData(p => ({...p, personnel: [...p.personnel, {id: uuidv4(), name: '', isCompany: false, roles: [], s_ic: '', s_sb: '', s_epf: ''}]}))} className={`w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-${themeColor}-400 hover:text-${themeColor}-600 transition-all`}>+ {t('tambah_personel')}</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8 border-t border-slate-100">
          <div className="space-y-6">
             <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">🏢 {t('dokumen_umum')}</h3>
             <div className="grid grid-cols-4 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <StatusToggle label={t('carta_organisasi')} value={formData.docs.carta} onChange={v => updateField('docs.carta', v)} />
                <StatusToggle label={t('peta_lakaran')} value={formData.docs.peta} onChange={v => updateField('docs.peta', v)} />
                <StatusToggle label={t('gambar_premis')} value={formData.docs.gambar} onChange={v => updateField('docs.gambar', v)} />
                <StatusToggle label={t('perjanjian_sewa')} value={formData.docs.sewa} onChange={v => updateField('docs.sewa', v)} />
             </div>
          </div>
          <div className="space-y-6">
             <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">💰 {t('semakan_kwsp')}</h3>
             <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="grid grid-cols-2 gap-4 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BULAN {i}</label>
                      <input 
                        type="month" 
                        value={(formData.kwsp as any)[`m${i}`] || ''} 
                        onChange={e => updateField(`kwsp.m${i}`, e.target.value)} 
                        className="w-full h-[40px] px-3 rounded-xl border-2 bg-white font-black text-xs outline-none focus:border-blue-600 transition-all"
                      />
                    </div>
                    <StatusToggle 
                      label="STATUS" 
                      value={(formData.kwsp as any)[`s${i}`] || ''} 
                      onChange={v => updateField(`kwsp.s${i}`, v)} 
                    />
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}

      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 no-print z-50 w-full max-w-xl px-4">
        <button onClick={() => { 
          if (confirm(isEn ? "Are you sure you want to clear the form?" : "Adakah anda pasti ingin mengosongkan borang?")) {
            localStorage.removeItem('stb_form_persistence'); 
            setFormData(initialData || defaultFormData); 
            toast.error(isEn ? "Form Cleared" : "Borang Dikosongkan");
          }
        }} className="flex-1 bg-white text-slate-400 py-4 rounded-2xl font-black text-xs border-2 border-slate-200 shadow-xl uppercase flex items-center justify-center gap-2">
          <Trash2 size={14} /> {t('kosongkan_borang')}
        </button>
        <button onClick={handlePrint} className="flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black text-xs shadow-xl uppercase flex items-center justify-center gap-2">
          <Printer size={14} /> Cetak
        </button>
        <button onClick={async () => {
          if (!hasPrinted) {
            toast.error(isEn ? "Please print the form first." : "Sila cetak borang terlebih dahulu.");
            return;
          }
          if (confirm(isEn ? "Enter this data into Input Database?" : "Masukkan data ini ke Input Database?")) {
            localStorage.removeItem('stb_form_persistence'); 
            const success = await onSave(formData); 
            if (success) {
              toast.success(isEn ? "Draft saved and moving to Input Database" : "Draf disimpan dan beralih ke Input Database");
              setActiveTab('database');
            } else {
              toast.error(isEn ? "Sync error. Try again." : "Ralat Penyelarasan. Cuba lagi.");
            }
          }
        }} className={`flex-[2] ${hasPrinted ? accentBg : 'bg-slate-300'} text-white py-4 rounded-2xl font-black text-xs shadow-2xl hover:opacity-90 active:scale-95 transition-all uppercase flex items-center justify-center gap-2`}>
          <Save size={14} /> {hasPrinted ? 'TERUSKAN KE INPUT DATABASE' : 'CETAK DAHULU UNTUK TERUSKAN'} &raquo;
        </button>
      </div>

      {/* Review Modal */}
      {showReview && extractedData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className={`p-8 ${accentBg} text-white`}>
               <h2 className="text-2xl font-black uppercase tracking-tight">{isEn ? "Review Extracted Data" : "Semakan Data Ekstraksi"}</h2>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">{isEn ? "Verify AI results before applying" : "Sila sahkan hasil AI sebelum digunakan"}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <ReviewItem label="Syarikat" value={extractedData.companyName} />
                  <ReviewItem label="No CIDB" value={extractedData.cidbNumber} />
                  <ReviewItem label="Gred" value={extractedData.grade} />
                  <ReviewItem label="Negeri" value={extractedData.negeri} />
               </div>
               
               <ReviewItem label="Alamat Perniagaan" value={extractedData.alamatOperasi} />
               
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Personel Terlibat</h3>
                  <div className="flex flex-wrap gap-2">
                     {Array.from(new Set([
                       ...(extractedData.directors || []),
                       ...(extractedData.shareholders || []),
                       ...(extractedData.nominees || []),
                       ...(extractedData.signatories || [])
                     ])).map((name, i) => (
                       <span key={i} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase">{name}</span>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
               <button onClick={() => setShowReview(false)} className="flex-1 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-xs uppercase text-slate-400">{isEn ? "Cancel" : "Batal"}</button>
               <button onClick={applyExtractedData} className={`flex-[2] py-4 ${accentBg} text-white rounded-2xl font-black text-xs uppercase shadow-lg`}>{isEn ? "Use Data for Form" : "Gunakan Data untuk Borang"}</button>
            </div>
          </div>
        </div>
      )}
      <PrintLayout data={formData} themeColor={themeColor} />
    </>
  );
};

const SectionHeader: React.FC<{ num: string, title: string, themeColor: string }> = ({ num, title, themeColor }) => (
  <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
    <span className={`w-8 h-8 bg-${themeColor}-600 text-white rounded-lg flex items-center justify-center font-black text-sm`}>{num}</span>
    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h2>
  </div>
);

const InputGroup: React.FC<{ label: string, value: string, type?: string, onChange: (v: string) => void, themeColor: string, className?: string, placeholder?: string, light?: boolean }> = ({ label, value, type = 'text', onChange, themeColor, className, placeholder, light }) => {
  const hasValue = value && String(value).trim() !== "";
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
        className={`w-full h-[48px] px-4 rounded-xl border-2 font-black text-xs outline-none transition-all ${
          hasValue 
            ? `bg-white border-${themeColor}-500/30 text-slate-900 shadow-sm shadow-${themeColor}-500/5` 
            : 'bg-amber-50/30 border-amber-200/50 text-slate-500'
        } focus:border-${themeColor}-600 focus:bg-white focus:shadow-lg`} 
      />
    </div>
  );
};

const StatusToggle: React.FC<{ label: string, value: string, onChange: (v: string) => void, compact?: boolean }> = ({ label, value, onChange, compact }) => {
  const hasValue = value && value.trim() !== "";
  return (
    <div className="space-y-1.5 flex flex-col items-center w-full">
      <label className="text-[8px] font-black text-slate-400 uppercase tracking-tighter truncate w-full text-center">{label}</label>
      <div className="relative w-full">
         <input 
           type="text" 
           maxLength={7} 
           value={value} 
           onChange={e => onChange(e.target.value.toUpperCase())}
           className={`w-full h-[40px] pl-3 ${compact ? 'pr-10' : 'pr-16'} rounded-xl border-2 font-black text-[10px] outline-none transition-all ${
             hasValue ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-100/50 border-slate-200 text-slate-400'
           } focus:border-blue-600 focus:bg-white`}
           placeholder="..."
         />
         <div className="absolute right-1 top-1 bottom-1 flex gap-0.5">
            <button 
              onClick={() => onChange('✓')} 
              className={`${compact ? 'w-4' : 'w-7'} h-full rounded-lg font-black text-xs transition-all ${value === '✓' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-emerald-600 hover:bg-emerald-50'}`}
            >
              ✓
            </button>
            <button 
              onClick={() => onChange('X')} 
              className={`${compact ? 'w-4' : 'w-7'} h-full rounded-lg font-black text-xs transition-all ${value === 'X' ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-50 text-rose-600 hover:bg-rose-50'}`}
            >
              ✗
            </button>
         </div>
      </div>
    </div>
  );
};

const ReviewItem: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="space-y-1">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs text-slate-800 uppercase min-h-[40px] flex items-center">{value || '-'}</div>
  </div>
);

export default BorangSemakan;
