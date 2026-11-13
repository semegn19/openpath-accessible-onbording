/**
 * Offline shell. Without this, "your answers are saved on this device" is only true while the
 * tab stays open: lose signal, reload, and the phone cannot even fetch index.html.
 *
 * Rules, in order of importance:
 *  - Answers are NEVER cached. /api/ is not intercepted at all.
 *  - The HTML shell is network-first, so a deploy can never leave someone on an old bundle —
 *    the failure mode this file would otherwise introduce.
 *  - Hashed bundles and fonts are cache-first: they cannot change, so there is nothing to be
 *    stale about.
 */

const VERSION = 'v1';
const SHELL = `openpath-shell-${VERSION}`;
const RUNTIME = `openpath-runtime-${VERSION}`;

const SHELL_FILES = [
  '/',
  '/index.html',
  '/fonts.css',
  '/fonts/poppins-400-latin.woff2',
  '/fonts/poppins-600-latin.woff2',
  '/fonts/noto-sans-ethiopic-var.woff2',   // 136 KB, the one file that hurts on 3G — cache it
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // One missing file must not fail the whole install.
      .then((c) => Promise.all(SHELL_FILES.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // never another origin
  if (url.pathname.startsWith('/api/')) return;           // answers are not content

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const c = await caches.open(SHELL);
          void c.put('/index.html', fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match('/index.html') ?? await caches.match('/');
        return cached ?? new Response('Offline and no cached copy.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts')) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh.ok) {
        const c = await caches.open(RUNTIME);
        void c.put(req, fresh.clone());
      }
      return fresh;
    })());
  }
});
