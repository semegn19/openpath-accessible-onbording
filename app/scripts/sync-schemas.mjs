// One source of truth: ../schema/*.json is copied into src/schemas/ before dev and build.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '../../schema');
const to = join(here, '../src/schemas');
mkdirSync(to, { recursive: true });

let n = 0;
if (existsSync(from)) {
  for (const dir of [from, join(from, 'templates')]) {
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        cpSync(join(dir, f), join(to, f));
        n++;
      }
    }
  }
  console.log(`sync-schemas: copied ${n} schema file(s) into src/schemas/`);
} else if (existsSync(to)) {
  const existing = readdirSync(to).filter((f) => f.endsWith('.json'));
  console.log(`sync-schemas: '${from}' not found (subfolder build); using ${existing.length} schema(s) in src/schemas/`);
} else {
  throw new Error(`sync-schemas: neither '${from}' nor '${to}' was found.`);
}

const publicAudioIndex = join(here, '../public/audio/index.json');
const srcAudioIndex = join(here, '../src/audio-index.json');
if (existsSync(publicAudioIndex)) {
  cpSync(publicAudioIndex, srcAudioIndex);
}
