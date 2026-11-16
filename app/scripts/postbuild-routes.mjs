import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '../dist');
const indexHtml = join(dist, 'index.html');

if (existsSync(indexHtml)) {
  for (const slug of ['onboard', 'job', 'employer']) {
    const dir = join(dist, slug);
    mkdirSync(dir, { recursive: true });
    cpSync(indexHtml, join(dir, 'index.html'));
    cpSync(indexHtml, join(dist, `${slug}.html`));
  }
  console.log('postbuild: generated static route fallbacks for /onboard, /job, /employer');
}
