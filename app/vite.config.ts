import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    // In dev the API is a separate process (node api/server.mjs). If it is not running the
    // proxy fails and the form falls back to "saved on this device" — which is a path worth
    // seeing, not an error to hide.
    proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false } },
  },
  build: { target: 'es2019', cssTarget: 'chrome80' },
});
