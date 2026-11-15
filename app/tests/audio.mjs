// The audio pipeline without a provider: the strings come from the schema, the files come from a
// fake, and the index the app reads matches what is on disk. Runs in a temp dir — no repo churn.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect } from '../scripts/_strings.mjs';

let fail = 0;
const ok = (c, label, extra = '') => { if (!c) fail++; console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };

const strings = collect();
// Deliberate tripwire: the counts change only when the copy changes, and every change means new
// clips to record. If this fails after an intended edit, update the numbers beside this comment.
const EXPECTED = { total: 732, am: 183, om: 183, ti: 183 };
ok(strings.length === EXPECTED.total, 'every spoken string is derived from the schema',
   `${strings.length} strings — ${strings.length === EXPECTED.total ? 'unchanged' : 'copy changed: update EXPECTED and re-run npm run audio'}`);
ok(strings.filter((s) => s.lang === 'am').length === EXPECTED.am, `the Amharic set is ${EXPECTED.am} clips`,
   String(strings.filter((s) => s.lang === 'am').length));
ok(strings.filter((s) => s.lang === 'om').length === EXPECTED.om, `the Afaan Oromoo set is ${EXPECTED.om} clips`,
   String(strings.filter((s) => s.lang === 'om').length));
ok(strings.filter((s) => s.lang === 'ti').length === EXPECTED.ti, `the Tigrinya set is ${EXPECTED.ti} clips`,
   String(strings.filter((s) => s.lang === 'ti').length));
ok(new Set(strings.map((s) => s.id)).size < strings.length, 'duplicate strings share one clip id (no double payment)',
   `${strings.length} strings → ${new Set(strings.map((s) => s.id)).size} clips`);

const dir = mkdtempSync(join(tmpdir(), 'openpath-audio-'));
try {
  // dry run must not write
  const dry = execFileSync('node', ['scripts/audio-generate.mjs', '--provider=fake', `--out=${dir}`], { encoding: 'utf8' });
  ok(/dry run/.test(dry) && readdirSync(dir).length === 0, 'dry run writes nothing and spends nothing');

  const out = execFileSync('node', ['scripts/audio-generate.mjs', '--provider=fake', '--write', '--lang=am', `--out=${dir}`], { encoding: 'utf8' });
  const files = readdirSync(dir).filter((f) => f.endsWith('.wav'));
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  const prov = JSON.parse(readFileSync(join(dir, 'provenance.json'), 'utf8'));
  ok(files.length > 0, 'clips are written as ordinary files', `${files.length} files`);
  ok(Object.keys(index).length === files.length, 'index.json matches the files on disk exactly');
  ok(Object.values(index).every((f) => existsSync(join(dir, f))), 'every index entry points at a file that exists');
  ok(Object.keys(prov).length === Object.keys(index).length, 'provenance is recorded per clip (provider, voice, when)');
  ok(files.length < new Set(strings.filter((s) => s.lang === 'am').map((s) => s.id)).size + 1, 'Amharic run stays within the Amharic set');
  ok(/generated \d+ unique clip/.test(out), 'the report says "unique" — duplicates were not paid for twice');

  // the missing-key guard is the one that protects money
  let refused = false;
  try { execFileSync('node', ['scripts/audio-generate.mjs', '--provider=openai', '--write', `--out=${dir}`], { stdio: 'pipe' }); }
  catch (e) { refused = /TTS_API_KEY/.test(String(e.stderr)); }
  ok(refused, 'a real provider refuses to run without a key');

  let capped = false;
  try { execFileSync('node', ['scripts/audio-generate.mjs', '--provider=fake', '--write', '--limit-chars=5', `--out=${dir}`], { stdio: 'pipe' }); }
  catch (e) { capped = /limit-chars/.test(String(e.stderr)); }
  ok(capped, 'the character cap stops a run before the invoice does');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(fail ? `\nFAIL — ${fail} problem(s)` : '\nPASS — 0 problem(s)');
process.exit(fail ? 1 : 0);
