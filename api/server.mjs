/**
 * OpenPath forms API — Level 2 of the adoptability ladder.
 *
 * Four endpoints, zero dependencies, zero secrets to configure, no database.
 *   GET  /api/health
 *   GET  /api/forms/{formId}
 *   POST /api/submissions
 *   GET  /api/submissions/{id}
 *
 * Storage is one append-only JSONL file. That is a deliberate choice for a two-day
 * build: it is crash-safe on write, trivially backupable, and it fails loudly rather
 * than corrupting. Swap `store` for Postgres without touching a route.
 */
import { createServer } from 'node:http';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateJobPostingFromSchema, generateJobPostingFromSubmission } from './jsonld.mjs';
import { sendSms, formatResumeMessage, normalizePhone } from './sms.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// Auto-load .env from app/src/.env or api/.env if SMS_KEY or ADDIS_AI_API_KEY is missing
if (!process.env.SMS_KEY || !process.env.ADDIS_AI_API_KEY) {
  const envPath = existsSync(join(here, '..', 'app', 'src', '.env'))
    ? join(here, '..', 'app', 'src', '.env')
    : existsSync(join(here, '.env'))
    ? join(here, '.env')
    : null;
  if (envPath) {
    try {
      const lines = readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].trim();
        }
      }
    } catch { /* ignore */ }
  }
}

const checkpoints = new Map();

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? join(here, 'data');
const SCHEMA_DIR = process.env.SCHEMA_DIR ?? join(here, '..', 'schema');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*';
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN ?? 30);
const TRUST_PROXY = process.env.TRUST_PROXY !== '0';   // behind nginx, remoteAddress is nginx
const MAX_BODY = Number(process.env.MAX_BODY_BYTES ?? 32 * 1024);
/** Speech-to-text is OPT-IN. Unset = the endpoint says so and the UI falls back to buttons.
 *  Either Addis AI, an OpenAI-compatible endpoint, or a self-hosted whisper.cpp server works. */
const ASR_URL = process.env.ASR_URL ?? '';
const ASR_KEY = process.env.ASR_KEY ?? '';
const ASR_MODEL = process.env.ASR_MODEL ?? 'whisper-1';
const ADDIS_AI_API_KEY = process.env.ADDIS_AI_API_KEY ?? '';
const HAS_ASR = Boolean(ASR_URL || ADDIS_AI_API_KEY);
const MAX_AUDIO = Number(process.env.MAX_AUDIO_BYTES ?? 2 * 1024 * 1024);
const VERSION = '1.3.0';

/* ------------------------------------------------------- encryption at rest */

// Names, phone numbers and ID numbers are personal data. A stolen file or a leaked volume
// should not hand them over in the clear. Set DATA_KEY (32 bytes, base64) to turn this on.
const KEY = process.env.DATA_KEY ? Buffer.from(process.env.DATA_KEY, 'base64') : null;
if (KEY && KEY.length !== 32) {
  console.error('DATA_KEY must be exactly 32 bytes, base64-encoded. Refusing to start.');
  process.exit(1);
}
if (!KEY) {
  console.warn('DATA_KEY not set — personal answers are stored in PLAINTEXT. Development only.');
}

const encrypt = (value) => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return { enc: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') };
};

const decrypt = (box) => {
  const d = createDecipheriv('aes-256-gcm', KEY, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(Buffer.from(box.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(box.ct, 'base64')), d.final()]).toString('utf8'));
};

/* ------------------------------------------------------------------ schemas */

/** The API validates against the same JSON the form renders from. One source of truth. */
function loadSchemas() {
  const map = new Map();
  const dir = existsSync(SCHEMA_DIR) ? SCHEMA_DIR : join(here, '..', 'schema');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (s?.id && Array.isArray(s.steps)) map.set(s.id, s);
    } catch {
      console.error(`schema ${f} is not valid JSON — skipped`);
    }
  }
  return map;
}

const schemas = loadSchemas();
if (!schemas.size) {
  console.error(`no schemas found in ${SCHEMA_DIR} — every submit will be rejected`);
}

/* ------------------------------------------------------------------ storage */

const DATA_FILE = join(DATA_DIR, 'submissions.jsonl');
const store = new Map();

function initStore() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) return;
  for (const line of readFileSync(DATA_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec?.answers && KEY) {
        for (const [k, v] of Object.entries(rec.answers)) {
          if (v && typeof v === 'object' && v.enc === 1) rec.answers[k] = decrypt(v);
        }
      }
      if (rec?.id) store.set(rec.id, rec);
    } catch {
      console.error('skipped one corrupt line in submissions.jsonl');
    }
  }
}
initStore();


/** step ids whose answers must never touch the disk in the clear */
const sensitiveIds = new Map();
for (const [formId, schema] of schemas) {
  sensitiveIds.set(formId, new Set(
    schema.steps.filter((st) => ['personal', 'sensitive'].includes(st.pii)).map((st) => st.id),
  ));
}

const newId = () => `sub_${randomBytes(12).toString('base64url')}`;

/** clientRef → submission id. A retry that arrives after the response was lost must not make a
 *  second record: the learner would be registered twice, or worse, called twice. */
const byClientRef = new Map();
const REF_RE = /^[A-Za-z0-9_-]{8,64}$/;

const rememberRef = (ref, id) => {
  if (!ref) return;
  byClientRef.set(ref, id);
  if (byClientRef.size > 50000) byClientRef.delete(byClientRef.keys().next().value); // bounded
};

// Rebuild the index from disk, so a restart does not resurrect the double-submit that the
// retry was protecting against.
for (const rec of store.values()) if (rec.clientRef) byClientRef.set(rec.clientRef, rec.id);

function save(record) {
  // append + rename-free: an interrupted write leaves a partial LAST line, which initStore
  // skips on the next boot. Nothing before it is ever damaged.
  let forDisk = record;
  if (KEY) {
    const ids = sensitiveIds.get(record.formId) ?? new Set();
    const answers = {};
    for (const [k, v] of Object.entries(record.answers)) {
      answers[k] = ids.has(k) ? encrypt(v) : v;
    }
    forDisk = { ...record, answers, encryptedFields: [...Object.keys(record.answers)].filter((k) => ids.has(k)) };
  }
  appendFileSync(DATA_FILE, JSON.stringify(forDisk) + '\n', { mode: 0o600 });
  store.set(record.id, record);          // memory keeps the plaintext: the API returns what was sent
}

/* --------------------------------------------------------------- validation */

/** Mirrors app/src/validation.ts. Duplicated on purpose: the client rule is for the user,
 *  this one is for the attacker. Never trust a browser. */
const normalizePhoneET = (raw) => {
  const d = String(raw).replace(/[\s\-()]/g, '');
  if (/^\+251[79]\d{8}$/.test(d)) return d;
  if (/^251[79]\d{8}$/.test(d)) return '+' + d;
  if (/^0[79]\d{8}$/.test(d)) return '+251' + d.slice(1);
  if (/^[79]\d{8}$/.test(d)) return '+251' + d;
  return null;
};

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const asNum = (v) => (v === '' || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function firstFailure(step, value) {
  for (const r of step.validation ?? []) {
    switch (r.rule) {
      case 'required':
        if (step.type === 'submit' || step.type === 'statement') {
          const need = (step.options ?? []).filter((o) => o.required).map((o) => o.value);
          if (need.length && !need.every((v) => Array.isArray(value) && value.includes(v))) return 'required';
        } else if (isEmpty(value)) return 'required';
        break;
      case 'phone-et':
        if (!isEmpty(value) && !normalizePhoneET(value)) return 'phone-et';
        break;
      case 'email':
        if (!isEmpty(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())) return 'email';
        break;
      case 'minLength':
        if (!isEmpty(value) && String(value).trim().length < (r.value ?? 1)) return 'minLength';
        break;
      case 'maxLength':
        if (!isEmpty(value) && String(value).trim().length > (r.value ?? Infinity)) return 'maxLength';
        break;
      case 'minValue':
        if (asNum(value) !== null && asNum(value) < (r.value ?? -Infinity)) return 'minValue';
        break;
      case 'maxValue':
        if (asNum(value) !== null && asNum(value) > (r.value ?? Infinity)) return 'maxValue';
        break;
      case 'exclusiveOption': {
        const exclusive = (step.options ?? []).find((o) => o.exclusive)?.value;
        if (Array.isArray(value) && exclusive && value.includes(exclusive) && value.length > 1) return 'exclusiveOption';
        break;
      }
      default:
        break;
    }
  }
  return null;
}

/** Fields that must never be stored or forwarded, whatever the client sends. */
const NEVER_STORED = new Set([
  'support',              // pre-1.2 name for accessibility-prefs, kept for old clients
  'accessibility-prefs',  // how the user wants the form displayed: never leaves the device
  'accommodations', 'medical', 'disability', 'diagnosis',
]);

function isStepVisible(step, answers) {
  if (!step.showIf) return true;
  const conds = Array.isArray(step.showIf) ? step.showIf : [step.showIf];
  return conds.every((c) => {
    const dep = answers[c.step];
    return typeof dep === 'string' && c.in.includes(dep);
  });
}

function validateSubmission(body) {
  const problems = [];
  const stripped = [];

  if (!body || typeof body !== 'object') return { problems: [{ field: '', rule: 'body' }], stripped };
  const formId = String(body.formId ?? '');
  const schema = schemas.get(formId);
  if (!schema) return { problems: [{ field: 'formId', rule: 'unknown-form' }], stripped };

  const answersIn = body.answers;
  if (!answersIn || typeof answersIn !== 'object' || Array.isArray(answersIn)) {
    return { problems: [{ field: 'answers', rule: 'required' }], stripped };
  }

  const answers = {};
  for (const step of schema.steps) {
    if (!isStepVisible(step, answersIn)) continue;
    const raw = answersIn[step.id];
    const isEmployerAccommodation = schema.kind === 'employer' && step.id === 'accommodations';
    if (!isEmployerAccommodation && (NEVER_STORED.has(step.id) || step.localOnly)) {
      if (raw !== undefined) stripped.push(step.id);
      continue;                       // never stored, never echoed, never logged
    }
    const fail = firstFailure(step, raw);
    if (fail) { problems.push({ field: step.id, rule: fail }); continue; }
    if (raw === undefined) continue;
    // only the option values the schema declares — no free text smuggled into a radio
    if (step.options?.length) {
      const allowed = new Set(step.options.map((o) => o.value));
      const picked = Array.isArray(raw) ? raw : [raw];
      const bad = picked.find((v) => !allowed.has(v));
      if (bad !== undefined) { problems.push({ field: step.id, rule: 'not-an-option' }); continue; }
    }
    answers[step.id] = step.type === 'tel' ? normalizePhoneET(raw) ?? raw : raw;
  }

  // Anything named medical/disability/diagnosis is dropped even if the schema never declared
  // it — a client that invents a field cannot get it stored either.
  const named = Object.keys(answersIn);
  for (const k of named) {
    if (schema.kind === 'employer' && k === 'accommodations') continue;
    if (NEVER_STORED.has(k) && !stripped.includes(k)) stripped.push(k);
  }
  const unknown = named.filter((k) => !schema.steps.some((s) => s.id === k) && !NEVER_STORED.has(k));
  if (unknown.length) problems.push({ field: unknown[0], rule: 'unknown-field' });

  return problems.length ? { problems, stripped } : { record: { formId, answers }, stripped };
}

/* ------------------------------------------------------------ rate limiting */

const hits = new Map();          // ip -> { count, resetAt }
function limited(ip) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + 60_000 }); return false; }
  e.count += 1;
  return e.count > RATE_LIMIT;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k); }, 60_000).unref();

/* ------------------------------------------------------------------ helpers */

function send(res, status, payload, extra = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...extra,
  });
  res.end(body);
}

const error = (res, status, code, message, extra = {}) =>
  send(res, status, { error: { code, message, ...extra } });

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (c) => {
      if (tooLarge) return;
      size += c.length;
      if (size > MAX_BODY) { tooLarge = true; chunks.length = 0; resolve({ tooLarge: true }); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve({ tooLarge: false, body: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', () => resolve({ tooLarge: false, body: '' }));
  });
}

/** Raw bytes, for audio. Same cap discipline as JSON, with its own (larger) limit. */
function readRaw(req, limit) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { tooLarge = true; chunks.length = 0; req.destroy(); resolve({ tooLarge: true }); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(tooLarge ? { tooLarge: true } : { body: Buffer.concat(chunks) }));
    req.on('error', () => resolve({ tooLarge: false, body: Buffer.alloc(0) }));
  });
}

/* ------------------------------------------------------------------- routes */

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  // Behind nginx every request appears to come from the proxy, which would turn a per-IP
  // limit into one global bucket. Take the first hop X-Forwarded-For when we are proxied.
  const forwarded = TRUST_PROXY ? (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  const ip = (forwarded || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');

  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (path === '/api/health' && req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      version: VERSION,
      forms: [...schemas.keys()],
      submissions: store.size,
      uptimeSec: Math.round(process.uptime()),
      // "none" means the browser's own speech recognition is the only option, and it has no
      // Amharic model. An operator should never have to read source to learn that.
      transcription: HAS_ASR ? 'configured' : 'none',
      transcriptionLanguages: [
        ...(ADDIS_AI_API_KEY ? ['am', 'om', 'ti'] : []),
        ...(ASR_URL ? ['am', 'om', 'ti', 'en'] : []),
      ],
      encryption: KEY ? 'aes-256-gcm' : 'none',
    });
  }

  if (path === '/api/openapi.yaml' && req.method === 'GET') {
    const f = join(here, 'openapi.yaml');
    if (!existsSync(f)) return error(res, 404, 'not-found', 'Spec not bundled in this image.');
    return send(res, 200, readFileSync(f, 'utf8'), { 'Content-Type': 'application/yaml; charset=utf-8' });
  }

  if (path === '/api/forms' && req.method === 'GET') {
    return send(res, 200, {
      forms: [...schemas.values()].map((s) => ({ id: s.id, version: s.version, kind: s.kind, title: s.title, langs: s.langs })),
    });
  }

  const formJsonLdMatch = path.match(/^\/api\/forms\/([^/]+)\/jsonld$/);
  if (formJsonLdMatch && req.method === 'GET') {
    const s = schemas.get(decodeURIComponent(formJsonLdMatch[1]));
    if (!s) return error(res, 404, 'unknown-form', 'No form with that id.');
    if (s.generates !== 'schema.org/JobPosting') {
      return error(res, 422, 'not-supported', `Form ${s.id} does not generate schema.org structured data.`);
    }
    const lang = url.searchParams.get('lang') || 'en';
    const jsonLd = generateJobPostingFromSchema(s, { lang });
    return send(res, 200, jsonLd, { 'Content-Type': 'application/ld+json; charset=utf-8' });
  }

  const formMatch = path.match(/^\/api\/forms\/([^/]+)$/);
  if (formMatch && req.method === 'GET') {
    const s = schemas.get(decodeURIComponent(formMatch[1]));
    if (!s) return error(res, 404, 'unknown-form', 'No form with that id.');
    return send(res, 200, s);
  }

  if (path === '/api/submissions' && req.method === 'POST') {
    if (limited(ip)) return error(res, 429, 'rate-limited', `Too many submissions. Limit is ${RATE_LIMIT} per minute.`);
    const type = (req.headers['content-type'] ?? '').split(';')[0].trim();
    if (type !== 'application/json') return error(res, 415, 'unsupported-media-type', 'Send application/json.');

    const read = await readBody(req);
    if (read.tooLarge) {
      // Answer first and hang up second. Destroying the socket before the response is
      // flushed turns a clean 413 into a connection reset the client cannot explain.
      res.on('finish', () => req.destroy());
      return error(res, 413, 'too-large', `Body over ${MAX_BODY} bytes.`, { Connection: 'close' });
    }
    let body;
    try {
      body = JSON.parse(read.body);
    } catch {
      return error(res, 400, 'bad-json', 'Body is not valid JSON.');
    }

    // A retry of a submission we already stored. Answer with the same receipt (200, not 201)
    // and store nothing. This is what makes the offline outbox safe to flush twice.
    const clientRef = typeof body?.clientRef === 'string' ? body.clientRef : undefined;
    if (clientRef && !REF_RE.test(clientRef)) {
      return error(res, 422, 'invalid', 'Some answers need fixing.', { fields: [{ field: 'clientRef', rule: 'format' }] });
    }
    const seenId = clientRef ? byClientRef.get(clientRef) : undefined;
    if (seenId) {
      const seen = store.get(seenId);
      return send(res, 200, {
        id: seenId,
        receivedAt: seen?.receivedAt ?? new Date().toISOString(),
        stripped: seen?.stripped ?? [],
        duplicate: true,
      });
    }

    const result = validateSubmission(body);
    if (result.problems) {
      return error(res, 422, 'invalid', 'Some answers need fixing.', {
        // the same rule names the form already uses, so the client can reuse its messages
        fields: result.problems,
      });
    }

    const record = {
      id: newId(),
      receivedAt: new Date().toISOString(),
      ...result.record,
      stripped: result.stripped,                // field NAMES only — proves what never arrived
      ...(clientRef ? { clientRef } : {}),      // opaque token, not personal data
    };
    save(record);
    rememberRef(clientRef, record.id);
    console.log(`stored ${record.id} form=${record.formId}${result.stripped.length ? ` stripped=${result.stripped.join(',')}` : ''}`);
    return send(res, 201, {
      id: record.id,
      receivedAt: record.receivedAt,
      // telling the client what was dropped is a feature, not a leak: it proves the
      // support answers never arrived, rather than asking anyone to take it on trust
      stripped: result.stripped,
    }, { Location: `/api/submissions/${record.id}` });
  }

  /* ---- POST /api/transcribe — audio in, text out, through an engine the operator chose ---- */
  if (path === '/api/transcribe' && req.method === 'POST') {
    if (!HAS_ASR) {
      // Deliberately explicit: "not configured" is a different problem from "no speech heard",
      // and an adopter debugging their deployment needs to tell them apart.
      return error(res, 503, 'asr-not-configured',
        'Speech-to-text is not configured on this server. Set ADDIS_AI_API_KEY or ASR_URL to enable it, or the form will use the buttons.');
    }
    const type = String(req.headers['content-type'] ?? '');
    if (!/^audio\//.test(type)) {
      return error(res, 415, 'unsupported-media-type', 'Send audio/* (webm, ogg, wav or mp4).');
    }
    const read = await readRaw(req, MAX_AUDIO);
    if (read.tooLarge) return error(res, 413, 'audio-too-large', `Audio over ${MAX_AUDIO} bytes. Keep it under 30 seconds.`);
    if (!read.body?.length) return error(res, 400, 'empty-audio', 'No audio in the body.');

    const reqLang = (url.searchParams.get('lang') || req.headers['x-language'] || 'am').toLowerCase().trim();

    try {
      // If language is English, Addis AI does not support English transcription.
      if (reqLang === 'en') {
        if (!ASR_URL) {
          return error(res, 422, 'language-not-supported', 'Addis AI speech-to-text does not support English transcription.');
        }
      }

      // If language is an Ethiopian language (am, om, ti) and Addis AI is configured, transcribe via Addis AI
      if (['am', 'om', 'ti'].includes(reqLang) && ADDIS_AI_API_KEY) {
        const form = new FormData();
        const mimeType = type || 'audio/webm';
        form.append('audio', new Blob([read.body], { type: mimeType }), 'speech.webm');
        form.append('request_data', JSON.stringify({ language_code: reqLang }));

        const r = await fetch('https://api.addisassistant.com/api/v2/stt', {
          method: 'POST',
          headers: {
            'x-api-key': ADDIS_AI_API_KEY,
          },
          body: form,
          signal: AbortSignal.timeout(20000),
        });

        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          console.log(`Addis AI STT upstream ${r.status}: ${errText}`);
          return error(res, 502, 'asr-failed', 'The speech engine did not accept the audio.');
        }

        const data = await r.json().catch(() => ({}));
        const text = String(data?.data?.transcription ?? '').trim();
        if (!text) return error(res, 422, 'no-speech', 'No speech was recognised in that recording.');

        console.log(`transcribed (Addis AI [${reqLang}]) ${read.body.length}B → ${text.length} chars`);
        return send(res, 200, { text, engine: 'addis-ai', lang: reqLang });
      }

      // Generic Whisper / OpenAI-compatible multipart endpoint fallback (or when ASR_URL is explicitly set)
      if (ASR_URL) {
        const form = new FormData();
        form.append('file', new Blob([read.body], { type }), 'speech.webm');
        form.append('model', ASR_MODEL);
        const r = await fetch(ASR_URL, {
          method: 'POST',
          headers: ASR_KEY ? { Authorization: `Bearer ${ASR_KEY}` } : {},
          body: form,
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) {
          console.log(`transcribe upstream ${r.status}`);
          return error(res, 502, 'asr-failed', 'The speech engine did not accept the audio.');
        }
        const data = await r.json().catch(() => ({}));
        const text = String(data.text ?? data.transcription ?? '').trim();
        if (!text) return error(res, 422, 'no-speech', 'No speech was recognised in that recording.');
        console.log(`transcribed ${read.body.length}B → ${text.length} chars`);
        return send(res, 200, { text, engine: data.engine ?? 'remote' });
      }

      return error(res, 503, 'asr-not-configured', 'No speech engine available for this language.');
    } catch (e) {
      console.log(`transcribe error: ${e.message}`);
      return error(res, 504, 'asr-timeout', 'The speech engine did not answer in time.');
    }
  }

  const subJsonLdMatch = path.match(/^\/api\/submissions\/([^/]+)\/jsonld$/);
  if (subJsonLdMatch && req.method === 'GET') {
    const subId = decodeURIComponent(subJsonLdMatch[1]);
    const rec = store.get(subId);
    if (!rec) return error(res, 404, 'not-found', 'No submission with that id.');
    const s = schemas.get(rec.formId);
    if (!s || s.generates !== 'schema.org/JobPosting') {
      return error(res, 422, 'not-supported', `Submission ${rec.id} does not generate schema.org structured data.`);
    }
    const lang = url.searchParams.get('lang') || rec.answers?.language || 'en';
    const jsonLd = generateJobPostingFromSubmission(rec, s, { lang });
    return send(res, 200, jsonLd, { 'Content-Type': 'application/ld+json; charset=utf-8' });
  }

  const subMatch = path.match(/^\/api\/submissions\/([^/]+)$/);
  if (subMatch && req.method === 'GET') {
    const rec = store.get(decodeURIComponent(subMatch[1]));
    if (!rec) return error(res, 404, 'not-found', 'No submission with that id.');
    return send(res, 200, rec);
  }

  if (path === '/api/checkpoints' && req.method === 'POST') {
    const read = await readBody(req);
    let body;
    try { body = JSON.parse(read.body); } catch { return error(res, 400, 'bad-json', 'Invalid JSON'); }
    const token = body.token || randomBytes(16).toString('hex');
    const checkpoint = {
      token,
      formId: body.formId || 'savanna-onboard-v1',
      phone: body.phone,
      answers: body.answers || {},
      currentStep: body.currentStep ?? 0,
      stepId: body.stepId,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    checkpoints.set(token, checkpoint);
    const origin = body.origin || 'http://localhost:5173';
    const slug = checkpoint.formId.replace(/-v\d+$/, '').replace(/^savanna-/, '');
    const resumeUrl = `${origin}/${slug}?resume=${token}`;
    return send(res, 200, { ok: true, token, resumeUrl, checkpoint });
  }

  const cpMatch = path.match(/^\/api\/checkpoints\/([a-zA-Z0-9_-]+)$/);
  if (cpMatch && req.method === 'GET') {
    const token = cpMatch[1];
    const cp = checkpoints.get(token);
    if (!cp) return error(res, 404, 'not-found', 'Checkpoint not found');
    if (new Date(cp.expiresAt) < new Date()) {
      checkpoints.delete(token);
      return error(res, 410, 'expired', 'Checkpoint expired');
    }
    return send(res, 200, { ok: true, checkpoint: cp });
  }

  if (path === '/api/sms/send-resume' && req.method === 'POST') {
    const read = await readBody(req);
    let body;
    try { body = JSON.parse(read.body); } catch { return error(res, 400, 'bad-json', 'Invalid JSON'); }
    let token = body.token;
    let cp = token ? checkpoints.get(token) : null;
    if (!cp && body.answers) {
      token = token || randomBytes(16).toString('hex');
      cp = {
        token,
        formId: body.formId || 'savanna-onboard-v1',
        phone: body.phone,
        answers: body.answers || {},
        currentStep: body.currentStep ?? 0,
        stepId: body.stepId,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      };
      checkpoints.set(token, cp);
    }
    const phone = body.phone || cp?.phone || cp?.answers?.phone;
    if (!phone) return error(res, 400, 'missing-phone', 'No phone number for SMS resume link.');
    const origin = body.origin || 'http://localhost:5173';
    const slug = (cp?.formId || 'savanna-onboard-v1').replace(/-v\d+$/, '').replace(/^savanna-/, '');
    const resumeUrl = `${origin}/${slug}?resume=${token}`;
    const lang = body.lang || cp?.answers?.language || 'am';
    const text = formatResumeMessage(resumeUrl, lang);
    const simulate = Boolean(body.simulate || req.headers['x-simulate-sms'] || process.env.SMS_SIMULATE === 'true' || process.env.SMS_MODE === 'simulation');
    const smsResult = await sendSms({ to: phone, text, simulate });
    return send(res, 200, {
      ok: true,
      token,
      resumeUrl,
      sms: smsResult,
    });
  }

  return error(res, 404, 'not-found', `${req.method} ${path} is not an endpoint. See /api/openapi.yaml.`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`openpath api ${VERSION} on :${PORT} — ${schemas.size} form(s), ${store.size} submission(s), ${DATA_FILE}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  // Do not wait on keep-alive connections: a container that ignores SIGTERM for 10 s is a
  // container that gets SIGKILLed, and a test that hangs is a test nobody runs.
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
