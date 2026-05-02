
import React from 'react';

export const NEGERI_OPTIONS = [
  "JOHOR", "KEDAH", "KELANTAN", "MELAKA", "NEGERI SEMBILAN", 
  "PAHANG", "PERAK", "PERLIS", "PULAU PINANG", "SABAH", 
  "SARAWAK", "SELANGOR", "TERENGGANU", "W.P. KUALA LUMPUR", 
  "W.P. LABUAN", "W.P. PUTRAJAYA"
];

export const GRED_OPTIONS = ["G1", "G2", "G3", "G4", "G5", "G6", "G7"];

export const JENIS_PERMOHONAN = [
  { id: 'baru', label: 'BARU' },
  { id: 'pembaharuan', label: 'PEMBAHARUAN' },
  { id: 'ubah_maklumat', label: 'UBAH MAKLUMAT' },
  { id: 'ubah_gred', label: 'UBAH GRED' }
];

export const KEPUTUSAN_OPTIONS = [
  "LULUS", "LULUS BERSYARAT", "SIASAT", "TOLAK", 
  "TOLAK & BEKU 3 BULAN", "TOLAK & BEKU 6 BULAN"
];

export const ALASAN_OPTIONS = [
  "Dokumen tidak lengkap", 
  "Tidak memenuhi PK1.5", 
  "Gagal lawatan premis", 
  "Pemalsuan Dokumen"
];

export const Icons = {
  Dashboard: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>📊</span>,
  Form: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>✓</span>,
  Filter: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>⚡</span>,
  Cart: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>🛒</span>,
  Database: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>📂</span>,
  Drafts: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>📋</span>,
  Submitted: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>✅</span>,
  Inbox: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>📥</span>,
  Decision: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>⚖️</span>,
  History: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>📜</span>,
  CheckCircle: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>✅</span>,
  Upload: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>📤</span>,
  User: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>👤</span>,
  Print: ({ size = 20 }: { size?: number }) => <span style={{ fontSize: size }}>🖨️</span>,
};
