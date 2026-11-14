/**
 * Generate the missing clips ONCE, with the adopter's own key, at build time.
 *
 * The runtime never calls a TTS provider. This script does, and writes ordinary audio files that
 * are then served like any other asset — offline, cacheable, no per-request cost, no third-party
 * request, nothing to leak. That is the whole point: **pay once per string, not once per learner.**
 *
 *   npm run audio:generate                              # dry run: what would it cost and produce
 *   npm run audio:generate -- --provider=fake --write    # prove the plumbing, no key needed
 *   TTS_API_KEY=… npm run audio:generate -- --provider=openai --write --limit-chars=20000
 *
 * Safety rules, in order of how much they cost if broken:
 *  1. The key is read from the environment and never written anywhere. It must never reach a
 *     browser — a key in the bundle is a key on the internet.
 *  2. Dedupe by clip id: a string that already has a clip is never generated twice. Re-running
 *     after an edit only pays for the string that changed.
 *  3. Dry run is the default. `--write` is required to spend anything, and `--limit-chars` caps
 *     the run before the invoice does.
 *  4. Provenance is recorded per clip (provider, voice, when) so a form that mixes a human
 *     recording with a generated one is a thing we can see, not a thing a learner notices.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collect } from './_strings.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const a = args.find((x) => x.startsWith(`${f}=`)); return a ? a.split('=').slice(1).join('=') : d; };

const provider = val('--provider', 'none');
const WRITE = has('--write');
const OUT = val('--out', new URL('../public/audio/', import.meta.url).pathname);
const LIMIT = Number(val('--limit-chars', '0')) || Infinity;
const LANGS_ONLY = val('--lang', null);
const KEY = process.env.TTS_API_KEY ?? '';

/** Rough list prices, USD per 1M characters. Update when a provider changes its sheet. */
const PRICE_PER_M = { openai: 15, azure: 16, elevenlabs: 150, fake: 0 };

async function synthesize(text, lang) {
  if (provider === 'fake') return silence();
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'alloy', input: text, response_format: 'opus' }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return Buffer.from(await r.arrayBuffer());
  }
  // Azure / ElevenLabs / a self-hosted endpoint: 30 lines each, same shape as above.
  throw new Error(`provider "${provider}" is not implemented yet — see docs/audio-generation.md §5`);
}

/** A real, playable 0.25 s silent WAV, so `--provider=fake` exercises the whole path. */
function silence(seconds = 0.25, rate = 16000) {
  const n = Math.floor(rate * seconds);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

const ext = provider === 'fake' ? 'wav' : 'opus';

mkdirSync(OUT, { recursive: true });
const present = new Set(readdirSync(OUT).filter((f) => /\.(opus|ogg|mp3|m4a|wav)$/i.test(f)).map((f) => f.replace(/\.[^.]+$/, '')));
const strings = collect().filter((s) => !LANGS_ONLY || s.lang === LANGS_ONLY);
const missing = strings.filter((s) => !present.has(s.id));

const chars = missing.reduce((n, s) => n + s.text.length, 0);
const cost = (chars / 1_000_000) * (PRICE_PER_M[provider] ?? 0);

console.log(`provider:   ${provider}${provider === 'none' ? '  (nothing to do — see --provider)' : ''}`);
console.log(`strings:    ${strings.length} total · ${strings.length - missing.length} already have a clip · ${missing.length} missing`);
console.log(`characters: ${chars}`);
if (provider in PRICE_PER_M) console.log(`estimate:   $${cost.toFixed(3)} at $${PRICE_PER_M[provider]}/1M chars`);
else console.log('estimate:   unknown provider — add its price to PRICE_PER_M');

if (!WRITE) {
  console.log('\ndry run — nothing was generated and no money was spent. Add --write to generate.');
  for (const m of missing.slice(0, 8)) console.log(`  ${m.id}.${ext}  ${m.lang}  ${m.text.slice(0, 50)}`);
  if (missing.length > 8) console.log(`  … and ${missing.length - 8} more`);
  process.exit(0);
}

if (provider !== 'fake' && !KEY) {
  console.error('\nTTS_API_KEY is not set. It is read from the environment on purpose: a key in a');
  console.error('file, a bundle or a schema is a key on the internet.');
  process.exit(1);
}
if (chars > LIMIT) {
  console.error(`\nrefusing: ${chars} characters is over the --limit-chars cap of ${LIMIT}.`);
  process.exit(1);
}

const provenancePath = join(OUT, 'provenance.json');
const provenance = existsSync(provenancePath) ? JSON.parse(readFileSync(provenancePath, 'utf8')) : {};
let made = 0;
const done = new Set();
for (const s of missing) {
  // The same string appears in several forms ("ስምዎን ይጻፉ" in learner and job). One clip serves
  // all of them: the id is the text, so paying twice for it would be paying for nothing.
  if (done.has(s.id) || present.has(s.id)) continue;
  try {
    const audio = await synthesize(s.text, s.lang);
    writeFileSync(join(OUT, `${s.id}.${ext}`), audio);
    done.add(s.id);
    provenance[s.id] = { source: provider === 'fake' ? 'fake' : 'generated', provider, lang: s.lang, chars: s.text.length, at: new Date().toISOString(), text: s.text };
    made++;
    console.log(`  ✓ ${s.id}.${ext}  ${s.text.slice(0, 46)}`);
  } catch (e) {
    console.error(`  ✗ ${s.id}: ${e.message}`);
    break;                                  // stop at the first failure: a half-run is resumable
  }
}
writeFileSync(provenancePath, JSON.stringify(provenance, null, 1) + '\n');

// index.json is what the app reads; keep it in step with the files that now exist
const files = readdirSync(OUT).filter((f) => /\.(opus|ogg|mp3|m4a|wav)$/i.test(f));
const index = {};
for (const f of files) index[f.replace(/\.[^.]+$/, '')] = f;
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index) + '\n');

console.log(`\ngenerated ${made} unique clip(s) · index.json now has ${Object.keys(index).length} · spent about $${((missing.slice(0, made).reduce((n, s) => n + s.text.length, 0) / 1e6) * (PRICE_PER_M[provider] ?? 0)).toFixed(3)}`);
console.log('These files are now static assets. Nothing calls the provider again.');
