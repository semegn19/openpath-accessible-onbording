/**
 * Copy has one home: the schema.
 *
 * Every UI label used to exist twice — once in `ui` in the schema, once as a hardcoded fallback at
 * the call site. The two drifted: the mic button said በድምጽ መምረጥ in code and በድምጽ ይመልሱ in the
 * schema, and the read-aloud label was corrected in one of the three forms before anyone noticed
 * the code had its own opinion. A fallback that is never exercised is still a second answer to the
 * question "what does this screen say?".
 *
 * Two rules:
 *   1. No `t(ui?.key, lang, '<literal>')` anywhere. The schema is the only source.
 *   2. Copy that has no schema home yet may not grow. The number can only go down.
 *
 *   node tests/copy-source.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const FILES = readdirSync(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'i18n.ts');
/** Sentences that live in TSX and have no schema key yet: offline, saved, language changed, the
 *  "this browser cannot read Amharic" note, the file-demo notice. Wave 1 moves them into the schema
 *  (copy review + audio coverage). Until then, this ceiling only ratchets down. */
const CEILING = 37;

let fail = 0;
const ok = (cond, label, extra = '') => { if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };
const amharic = /[\u1200-\u137F]/;

/* 1. no hardcoded fallback beside a schema key */
const fallbacks = [];
for (const f of FILES) {
  const text = readFileSync(join(SRC, f), 'utf8');
  text.split('\n').forEach((line, i) => {
    // Third argument may be a quoted string or a `lang === 'am' ? …` ternary — the ternary is
    // exactly how the eighteen removed fallbacks were written, so it must be caught too.
    if (/t\((?:schema\.)?ui\?\.\w+,\s*\w+,\s*(?:['"]|(?:lang|v)\s*===)/.test(line)) fallbacks.push(`${f}:${i + 1}`);
  });
}
ok(fallbacks.length === 0, 'every ui label comes from the schema, with no hardcoded twin', fallbacks.join(', ') || 'no duplicates');

/* 2. runtime copy: declared and used, in both directions */
const copyDoc = JSON.parse(readFileSync(new URL('../../schema/runtime-copy-v1.json', import.meta.url), 'utf8'));
const declared = new Set(Object.keys(copyDoc.strings ?? {}));
const used = new Map();
// A key may be passed straight to c(), or looked up through a map (the microphone error causes
// are chosen by a runtime code), so count any quoted occurrence of the key anywhere in src.
const srcText = FILES.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]);
for (const key of declared) {
  for (const [f, text] of srcText) {
    if (text.includes(`'${key}'`) || text.includes(`"${key}"`) || text.includes(`\`${key}\``)) {
      if (!used.has(key)) used.set(key, []);
      used.get(key).push(f);
    }
  }
}
const undeclared = [...used.keys()].filter((k) => !declared.has(k));
const unused = [...declared].filter((k) => !used.has(k));
ok(undeclared.length === 0, 'every runtime string used is declared in runtime-copy-v1.json', undeclared.join(', ') || 'all declared');
ok(unused.length === 0, 'every declared runtime string is used somewhere', unused.join(', ') || 'none unused');

/* 3. copy with no schema home may not grow */
const perFile = FILES.map((f) => [f, readFileSync(join(SRC, f), 'utf8').split('\n').filter((l) => amharic.test(l)).length])
  .filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1]);
const total = perFile.reduce((s, [, n]) => s + n, 0);
ok(total <= CEILING,
   'copy without a schema key does not grow',
   `${total} line(s) in ${perFile.map(([f, n]) => `${f.replace('src/', '')} ${n}`).join(', ')} — ceiling ${CEILING}. Lower it when you move some into the schema.`);

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
