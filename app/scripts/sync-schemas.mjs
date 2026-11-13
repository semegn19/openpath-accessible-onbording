// One source of truth: ../schema/*.json is copied into src/schemas/ before dev and build.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '../../schema');
const to = join(here, '../src/schemas');
mkdirSync(to, { recursive: true });

let n = 0;
for (const dir of [from, join(from, 'templates')]) {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    cpSync(join(dir, f), join(to, f));
    n++;
  }
}
console.log(`sync-schemas: copied ${n} schema file(s) into src/schemas/`);
