import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true, // expose on LAN so table QR codes are scannable from a phone
    fs: {
      // the dev server may be launched through the C:\dev\qarta junction;
      // realpaths resolve into OneDrive, so allow both roots explicitly
      allow: ['C:/Users/abrax/OneDrive/Desktop/projects/Restaurant app/qarta', 'C:/dev/qarta'],
    },
    proxy: {
      '/api': { target: 'http://localhost:5056', changeOrigin: true },
    },
  },
});
