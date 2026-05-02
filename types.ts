
export type Language = 'ms' | 'en';

export type UserRole = 'pengesyor' | 'pelulus' | 'ks_spi' | 'pegawai_siasatan_1' | 'pegawai_siasatan_2' | 'pegawai_siasatan_biasa' | 'pemerhati' | 'pegawai_tatatertib' | 'penyiasat' | 'ks_sptb' | 'pp_sptb';

export interface User {
  id: string;
  name: string;
  pin: string;
  role: UserRole;
  color?: string;
  cidbEndsWith?: string[];
  alphaSplit?: Record<string, string>;
  hasSpiAccess?: boolean;
  source?: 'STB' | 'SPI';
  dateline_spi?: string | null;
  phone?: string;
  imageUrl?: string;
}

export interface ProfileData {
  syarikat: string;
  cidb: string;
  gred: string;
  nama_pemohon: string;
  jawatan_pemohon: string;
  ic_pemohon: string;
  telefon_pemohon: string;
  email_pemohon: string;
  jenis_pendaftaran: string;
  tarikh_daftar: string;
  alamat_perniagaan: string;
  no_telefon_syarikat: string;
  no_fax: string;
  email_syarikat: string;
  web: string;
  pautan_drive: string;
  jenis_perubahan: string;
  ssm_berdaftar: boolean;
}

export interface NotifikasiMessage {
  id: string;
  appId: string;
  syarikat: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  receiverRole?: UserRole | string;
  message: string;
  status: 'BELUM LIHAT' | 'TELAH LIHAT' | 'DISAHKAN';
  type_kes: 'BIASA' | 'PEMUTIHAN';
  createdAt: any;
}

export interface Personnel {
  id: string;
  name: string;
  isCompany: boolean;
  // Specific roles: PENGARAH, P.EKUITI, P.SPKK, T.T CEK
  roles: string[]; 
  s_ic: string;
  s_sb: string;
  s_epf: string;
}

export interface ApplicationData {
  id: string;
  row?: number;
  syarikat: string;
  cidb: string;
  gred: string;
  jenis: string;
  fileName?: string;
  input_ubah_maklumat?: string;
  input_ubah_gred?: string;
  negeri: string;
  tarikh_mohon?: string;
  tarikh_surat_terdahulu?: string;
  start_date?: string;
  date_submit?: string;
  tatatertib: string;
  syor_lawatan: string;
  pautan: string;
  justifikasi: string;
  
  // Recommender fields
  pengesyor: string;
  pengesyor_id?: string;
  syor_status: string;
  tarikh_syor?: string;
  
  // Aliran Kerja Baharu PP/KS SPTB (Checklist)
  target_semakan?: 'KS SPTB' | 'PP SPTB' | '';
  status_semakan?: 'LENGKAP' | 'TIDAK LENGKAP' | 'DALAM SEMAKAN' | '';
  alasan_tolak_semakan?: string;
  tarikh_hantar_semakan?: string;
  tarikh_selesai_semakan?: string;
  semak_oleh?: string;
  semak_oleh_id?: string;
  is_checked_spi?: boolean; // Checkbox pengesahan semakan

  // Pemutihan Logic
  is_pemutihan?: boolean;
  tarikh_pemutihan_spi?: string;

  // Detailed fields from V6.1.9
  justifikasi_lawatan?: string;
  alamat_perniagaan?: string;
  jenis_konsultansi?: string;
  spkk_duration?: string;
  stb_duration?: string;
  ssm_date?: string;
  ssm_status?: string;
  bank_date?: string;
  bank_sign?: string;
  bank_status?: string;
  bpku_status?: string;
  meeting_status?: string;
  transaction_code?: string;
  update_type?: string;
  firebaseDocId?: string;
  catatan?: string;
  alamat_operasi?: string;
  date_submit_spi?: string;
  pengagih_id?: string;
  penerima_proses?: string;
  status_spi?: 'BARU' | 'DALAM PROSES' | 'SELESAI';
  tarikh_sah_terima_spi?: string;
  catatan_agihan_spi?: string;
  pic_lawatan_spi?: 'HQ' | 'NEGERI';
  pic_negeri_spi?: string;
  tarikh_hantar_negeri_spi?: string;
  tarikh_terima_negeri_spi?: string;
  tarikh_lawatan_spi?: string;
  masa_lawatan_spi?: string;
  keputusan_syor_spi?: 'SOKONG' | 'TIDAK DISOKONG' | 'TIDAK PERLU LAWATAN';
  laporan_siasatan_spi?: string;
  lampiran_siasatan_spi?: string;
  tarikh_hantar_sptb_spi?: string;
  dateline_spi?: string;
  is_beku?: boolean;
  tarikh_mula_beku?: string;
  tarikh_tamat_beku?: string;

  // Approver fields
  kelulusan?: string;
  alasan?: string;
  tarikh_lulus?: string;
  pelulus?: string;
  pelulus_id?: string;

  personnel: Personnel[];
  docs: {
    carta: string;
    peta: string;
    gambar: string;
    sewa: string;
  };
  kwsp: {
    m1: string; s1: string;
    m2: string; s2: string;
    m3: string; s3: string;
  };
}

export interface ExcelRow {
  id: string;
  company: string;
  cidb: string;
  grade: string;
  district: string;
  date?: string;
  transactionCode?: string;
  category?: string;
  updateType?: string;
  bpkuStatus?: string;
  meetingStatus?: string;
}

export interface DashboardStats {
  total: number;
  success: number;
  reject: number;
  process: number;
  rate: number;
}
