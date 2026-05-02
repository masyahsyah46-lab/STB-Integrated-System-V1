import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // PENTING: Pastikan ini SAMA TEPAT dengan nama repo GitHub anda. 
      // Jika repo anda huruf kecil (cth: stb-integrated-system-v1), tukar di bawah:
      base: '/STB-Integrated-System-V1/', 
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
          'Cross-Origin-Embedder-Policy': 'unsafe-none',
        }
      },
      plugins: [react(), tailwindcss()],
      define: {
        // Tambah || '' supaya build tak 'crash' jika rahsia GitHub tiada
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});