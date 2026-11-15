import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';

function autoApiServer() {
  let apiProcess: ChildProcess | null = null;

  return {
    name: 'auto-api-server',
    configureServer(server: any) {
      // Check if port 8080 is already running
      const socket = createConnection({ port: 8080, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
      });
      socket.once('error', () => {
        socket.destroy();
        if (apiProcess) return;
        const apiPath = resolve(__dirname, '../api/server.mjs');
        apiProcess = spawn('node', [apiPath], {
          stdio: 'inherit',
          env: process.env,
        });

        apiProcess.on('error', (err) => {
          console.error('[auto-api] Failed to start API server:', err);
        });
      });

      const cleanup = () => {
        if (apiProcess && apiProcess.pid) {
          try {
            if (process.platform === 'win32') {
              spawn('taskkill', ['/pid', String(apiProcess.pid), '/f', '/t'], { stdio: 'ignore' });
            } else {
              apiProcess.kill('SIGTERM');
            }
          } catch {
            // ignore
          }
          apiProcess = null;
        }
      };

      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      server.httpServer?.on('close', cleanup);
    },
  };
}

export default defineConfig({
  plugins: [react(), autoApiServer()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res: any) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'API server warming up or unavailable' }));
            }
          });
        },
      },
    },
  },
  build: { target: 'es2019', cssTarget: 'chrome80' },
});
