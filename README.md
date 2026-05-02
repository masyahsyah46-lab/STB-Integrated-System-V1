# SPTB Integrated System V3.0

## Deployment

> [!CAUTION]
> **WARNING:** Anda **WAJIB** memasukkan pembolehubah persekitaran (Environment Variables) berikut di papan pemuka Netlify (**Site settings > Environment variables**) sebelum melakukan deployment:
>
> 1. `GEMINI_API_KEY` (Diperlukan oleh `vite.config.ts`)
> 2. `VITE_FIREBASE_API_KEY`
> 3. `VITE_FIREBASE_AUTH_DOMAIN`
> 4. `VITE_FIREBASE_DATABASE_URL`
> 5. `VITE_FIREBASE_PROJECT_ID`
> 6. `VITE_FIREBASE_STORAGE_BUCKET`
> 7. `VITE_FIREBASE_MESSAGING_SENDER_ID`
> 8. `VITE_FIREBASE_APP_ID`
> 9. `VITE_FIREBASE_MEASUREMENT_ID`
>
> Jika tidak dimasukkan, aplikasi tidak akan dapat berhubung dengan Firebase atau proses build akan gagal.

## Setup Tempatan (Development)

1. Salin fail `.env.example` kepada `.env`.
2. Masukkan nilai yang betul bagi semua pembolehubah di dalam fail `.env`.
3. Jalankan `npm install` dan `npm run dev`.
