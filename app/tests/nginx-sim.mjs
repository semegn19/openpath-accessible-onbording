// Serves dist/ exactly the way app/nginx.conf does — try_files fallback plus the real
// security headers — so the production bundle can be tested without Docker.
//   node tests/nginx-sim.mjs 8081
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.argv[2] ?? 8081);
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors *; base-uri 'none'; object-src 'none'",
};

http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];

  // location /api/ { proxy_pass http://api:8080; } — same as nginx.conf
  if (url.startsWith('/api/')) {
    const upstream = http.request(
      { host: '127.0.0.1', port: Number(process.env.API_PORT ?? 8080), path: req.url, method: req.method, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, 'X-Content-Type-Options': 'nosniff' });
        up.pipe(res);
      },
    );
    upstream.on('error', () => { res.writeHead(502, { ...HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'bad-gateway', message: 'API is not running.' } })); });
    req.pipe(upstream);
    return;
  }
  if (url === '/healthz') { res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/plain' }); return res.end('ok\n'); }

  let file = join(root, normalize(decodeURIComponent(url)));
  const isFile = existsSync(file) && statSync(file).isFile();
  // try_files $uri /index.html
  if (!isFile) file = join(root, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, HEADERS); return res.end('not found'); }

  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  const cache = url.startsWith('/assets/') ? 'public, max-age=31536000, immutable'
    : url.startsWith('/fonts/') ? 'public, max-age=2592000'
    : file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, { ...HEADERS, 'Content-Type': type, 'Cache-Control': cache });
  res.end(readFileSync(file));
}).listen(port, '0.0.0.0', () => console.log(`serving dist on ${port} (nginx semantics)`));
