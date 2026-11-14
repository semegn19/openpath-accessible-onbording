// Contract tests for api/server.mjs. Spawns a real server on a scratch data dir.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8099;
const DATA = mkdtempSync(join(tmpdir(), 'openpath-api-'));
const SCHEMA = fileURLToPath(new URL('../../schema', import.meta.url));
const B = `http://127.0.0.1:${PORT}/api`;

const srv = spawn('node', ['../api/server.mjs'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, SCHEMA_DIR: SCHEMA, RATE_LIMIT_PER_MIN: '1000', TRUST_PROXY: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => process.stderr.write('  api stderr: ' + d));

process.on('exit', () => srv.kill('SIGKILL'));

let fail = 0;
const ok = (cond, label, extra = '') => { if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };
const post = async (body, headers = { 'Content-Type': 'application/json' }) => {
  const r = await fetch(`${B}/submissions`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: r.status, headers: r.headers, json: await r.json().catch(() => null) };
};

// wait for boot
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${B}/health`); if (r.ok) break; } catch { /* retry */ }
  await new Promise((r) => setTimeout(r, 100));
}

const VALID = {
  formId: 'savanna-onboard-v1',
  // the answer keys are step ids, exactly as the form sends them (`submit` holds the consent box)
  answers: { language: 'am', assistance: 'no-thanks', name: 'ሳራ ተስፋዬ', phone: '0912345678',
             'id-route': 'fayda', 'id-value': '3910028475', submit: ['consent-programme'] },
};

/* --- 1. health & forms --- */
{
  const r = await (await fetch(`${B}/health`)).json();
  ok(r.ok === true && r.forms.length === 3, 'GET /health', `${r.forms.length} forms, v${r.version}`);
  const f = await (await fetch(`${B}/forms/savanna-onboard-v1`)).json();
  ok(Array.isArray(f.steps) && f.steps.length > 5, 'GET /forms/{id} returns the schema', `${f.steps?.length} steps`);
  ok((await fetch(`${B}/forms/nope`)).status === 404, 'GET /forms/{unknown} → 404');
}

/* --- 2. happy path --- */
let id;
{
  const r = await post(VALID);
  id = r.json?.id;
  ok(r.status === 201 && /^sub_[A-Za-z0-9_-]{16}$/.test(id ?? ''), 'POST /submissions → 201 + id', id);
  ok(r.headers.get('location') === `/api/submissions/${id}`, 'Location header points at it');
  const back = await (await fetch(`${B}/submissions/${id}`)).json();
  ok(back.answers.phone === '+251912345678', 'phone normalised on the server', back.answers.phone);
  ok(back.answers.name === 'ሳራ ተስፋዬ', 'Amharic name survives round trip');
  ok(back.answers.support === undefined, 'support is not in the stored record');
}

/* --- 3. THE privacy claim, tested rather than promised --- */
{
  const r = await post({ ...VALID, answers: { ...VALID.answers, support: ['large-text', 'read-aloud'], medical: 'x' } });
  ok(r.status === 201, 'a client that sends support data still gets 201');
  ok(JSON.stringify(r.json.stripped) === '["support","medical"]', 'stripped names what was dropped', JSON.stringify(r.json.stripped));
  const back = await (await fetch(`${B}/submissions/${r.json.id}`)).json();
  ok(!('support' in back.answers) && !('medical' in back.answers), 'and none of it reached the store');
  const onDisk = readFileSync(join(DATA, 'submissions.jsonl'), 'utf8');
  ok(!onDisk.includes('large-text') && !onDisk.includes('read-aloud'), 'nor the file on disk', `${onDisk.split('\n').filter(Boolean).length} record(s)`);
}

/* --- 4. server-side validation (a client can lie) --- */
{
  const cases = [
    ['missing required', { formId: VALID.formId, answers: { ...VALID.answers, name: '' } }, 'name', 'required'],
    ['bad phone', { formId: VALID.formId, answers: { ...VALID.answers, phone: '12345' } }, 'phone', 'phone-et'],
    ['radio value not in schema', { formId: VALID.formId, answers: { ...VALID.answers, 'id-route': 'hacked' } }, 'id-route', 'not-an-option'],
    ['unknown field', { formId: VALID.formId, answers: { ...VALID.answers, extra: 'x' } }, 'extra', 'unknown-field'],
    ['unknown form', { formId: 'nope', answers: {} }, 'formId', 'unknown-form'],
  ];
  for (const [label, body, field, rule] of cases) {
    const r = await post(body);
    const hit = r.json?.error?.fields?.some((f) => f.field === field && f.rule === rule);
    ok(r.status === 422 && hit, `422 ${label}`, `${r.status} ${JSON.stringify(r.json?.error?.fields ?? [])}`.slice(0, 80));
  }
}

/* --- 5. transport hardening --- */
{
  ok((await post('{not json')).status === 400, 'bad JSON → 400');
  ok((await post(VALID, { 'Content-Type': 'text/plain' })).status === 415, 'wrong Content-Type → 415');
  const big = { formId: VALID.formId, answers: { ...VALID.answers, name: 'x'.repeat(40 * 1024) } };
  ok((await post(big)).status === 413, '40 KB body → 413');
  ok((await fetch(`${B}/submissions/sub_doesnotexist`)).status === 404, 'unknown submission → 404');
  const h = await fetch(`${B}/submissions`);
  ok(h.status === 404, 'there is no list endpoint (cannot enumerate)');
  const opts = await fetch(`${B}/submissions`, { method: 'OPTIONS' });
  ok(opts.headers.get('access-control-allow-origin') === '*', 'CORS preflight answered for embedding');
  const sub = await fetch(`${B}/submissions/${id}`);
  ok(sub.headers.get('cache-control') === 'no-store', 'submissions are never cached');
}

/* --- 5b. encryption at rest — a stolen file must not hand over names and ID numbers --- */
{
  const KEY = Buffer.from('k'.repeat(32)).toString('base64');
  const DATA2 = mkdtempSync(join(tmpdir(), 'openpath-enc-'));
  const srv3 = spawn('node', ['../api/server.mjs'], {
    env: { ...process.env, PORT: '8096', DATA_DIR: DATA2, SCHEMA_DIR: SCHEMA, DATA_KEY: KEY, TRUST_PROXY: '0' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:8096/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

  const res = await fetch('http://127.0.0.1:8096/api/submissions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(VALID),
  });
  const { id: encId } = await res.json();
  ok(res.status === 201, 'submission accepted with DATA_KEY set', encId);

  const onDisk = readFileSync(join(DATA2, 'submissions.jsonl'), 'utf8');
  ok(!onDisk.includes('ሳራ') && !onDisk.includes('3910028475') && !onDisk.includes('+251912345678'),
     'name, phone and ID number are NOT readable on disk');
  ok(onDisk.includes('"enc":1'), 'they are stored as AES-256-GCM boxes');

  const back = await (await fetch(`http://127.0.0.1:8096/api/submissions/${encId}`)).json();
  ok(back.answers?.name === 'ሳራ ተስፋዬ' && back.answers?.['id-value'] === '3910028475',
     'and the API still returns them in the clear to a caller holding the id');
  srv3.kill('SIGKILL');
}

/* --- 6. rate limit --- */
{
  const srv2 = spawn('node', ['../api/server.mjs'], {
    env: { ...process.env, PORT: '8098', DATA_DIR: DATA, SCHEMA_DIR: SCHEMA, RATE_LIMIT_PER_MIN: '3', TRUST_PROXY: '0' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:8098/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch('http://127.0.0.1:8098/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(VALID) });
    codes.push(r.status);
  }
  ok(codes.slice(3).every((c) => c === 429), 'rate limit kicks in after the allowance', codes.join(','));
  srv2.kill('SIGKILL');
}

/* --- 7. the spec matches the code --- */
{
  const spec = await (await fetch(`${B}/openapi.yaml`)).text();
  ok(spec.startsWith('openapi: 3.1.0'), 'GET /openapi.yaml is served');
  for (const p of ['/health:', '/forms:', '/forms/{formId}:', '/submissions:', '/submissions/{id}:', '/openapi.yaml:']) {
    ok(spec.includes(`  ${p}`), `spec documents ${p.replace(':', '')}`);
  }
  const implemented = ['/health', '/forms', '/forms/{formId}', '/submissions', '/submissions/{id}'];
  const undocumented = implemented.filter((p) => !spec.includes(`  ${p}:`));
  ok(undocumented.length === 0, 'no endpoint is missing from the spec', undocumented.join(',') || 'parity');
}

/* ---------- idempotency: the offline outbox may flush twice, the learner registers once ---------- */
{
  const body = { ...VALID, clientRef: 'ref_test_idempotency_1' };
  const first = await post(body);
  const second = await post(body);
  ok(first.status === 201, 'first send with a clientRef is stored (201)', String(first.status));
  ok(second.status === 200 && second.json?.id === first.json?.id,
     'a retry with the same clientRef returns the same record, 200 not 201',
     `${second.status} ${second.json?.id} vs ${first.json?.id}`);
  ok(second.json?.duplicate === true, 'the retry is marked as a duplicate');

  const bad = await post({ ...body, clientRef: 'spaces are not allowed here' });
  ok(bad.status === 422, 'a malformed clientRef is refused', String(bad.status));
}

srv.kill('SIGKILL');
console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
