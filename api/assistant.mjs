/** Server-owned AI configuration. No provider secret is returned to a browser. */
import { createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const providers = new Set(['disabled', 'openai', 'gemini', 'anthropic', 'ollama', 'custom']);
const safeIntents = new Set(['text_scale', 'contrast', 'simple_mode', 'reduced_motion', 'read', 'explain', 'focus', 'pause', 'resume', 'undo', 'chat', 'navigate', 'reset_preferences']);
const idPattern = /^[a-z][a-z0-9_.-]{0,79}$/;
const hash = value => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(hash(a), hash(b));
const failure = (status, code) => Object.assign(new Error(code), { status, code });

export function createAssistant({ directory, env = process.env, fetchImpl = fetch, persistence } = {}) {
  const adminToken = env.ROHA_ADMIN_TOKEN || '';
  const key = env.DATA_KEY ? Buffer.from(env.DATA_KEY, 'base64') : null;
  const enabled = adminToken.length >= 32 && key?.length === 32;
  const origin = env.ROHA_ADMIN_ORIGIN || 'http://localhost:5173';
  const secure = new URL(origin).protocol === 'https:';
  if (env.NODE_ENV === 'production' && enabled && !secure) throw new Error('ROHA_ADMIN_ORIGIN must use HTTPS in production');
  const approved = new Set((env.ROHA_AI_ENDPOINTS || '').split(',').map(s => s.trim()).filter(Boolean));
  const configFile = join(directory, 'assistant-config.enc.json');
  const buckets = new Map();
  const sessions = new Map();
  let active = 0;
  const stats = { requests: 0, failures: 0, rejected: 0 };
  const disabled = { provider: 'disabled', model: '', endpoint: '', apiKey: '', revision: 0, requestsPerDay: 1000 };
  const protect = value => {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  };
  const reveal = box => {
    const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
    cipher.setAuthTag(Buffer.from(box.tag, 'base64'));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(box.data, 'base64')), cipher.final()]).toString());
  };
  async function load() {
    let saved = null;
    if (enabled) {
      if (persistence) {
        const box = await persistence.getConfig();
        if (box) saved = reveal(box);
      } else {
        try {
          saved = reveal(JSON.parse(await readFile(configFile, 'utf8')));
        } catch (e) {
          if (e.code !== 'ENOENT') throw failure(503, 'configuration-unavailable');
        }
      }
    }
    if (saved && saved.provider && saved.provider !== 'disabled') {
      return saved;
    }
    if (env.GEMINI_API_KEY) {
      return {
        provider: 'gemini',
        model: env.GEMINI_MODEL || 'gemini-1.5-flash-latest',
        endpoint: '',
        apiKey: env.GEMINI_API_KEY,
        revision: saved?.revision || 1,
        requestsPerDay: 5000,
      };
    }
    return saved || disabled;
  }
  let saving = Promise.resolve();
  function save(config) {
    // Serialize file updates; PostgreSQL supplies optimistic revision checks for replicas.
    const result = saving.then(async () => {
      const current = await load();
      if (config.revision !== current.revision) throw failure(409, 'configuration-changed');
      const next = { ...config, revision: current.revision + 1 };
      const box = protect(next);
      if (persistence) await persistence.setConfig(box, current.revision);
      else {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const tmp = `${configFile}.${randomBytes(8).toString('hex')}.tmp`;
        await writeFile(tmp, JSON.stringify(box), { mode: 0o600 }); await rename(tmp, configFile);
      }
      return next;
    });
    saving = result.catch(() => {}); return result;
  }
  function publicConfig(c) {
    return { provider: c.provider, model: c.model, endpoint: c.endpoint, hasKey: Boolean(c.apiKey), revision: c.revision, requestsPerDay: c.requestsPerDay };
  }
  async function reserve(bucket, limit, duration = 60000) {
    if (persistence) return persistence.reserve(bucket, limit, duration);
    const now = Date.now();
    for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
    const value = buckets.get(bucket) || { count: 0, until: now + duration };
    if (buckets.size >= 10000 && !buckets.has(bucket)) return false;
    value.count++; buckets.set(bucket, value); return value.count <= limit;
  }
  function normalize(input, previous) {
    if (!input || !providers.has(input.provider)) throw failure(422, 'invalid-provider');
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw failure(422, 'revision-required');
    const model = String(input.model || '').trim();
    const endpoint = String(input.endpoint || '').trim();
    if (input.provider !== 'disabled' && (!model || model.length > 160 || !/^[a-zA-Z0-9._:/-]+$/.test(model))) throw failure(422, 'invalid-model');
    if (['custom', 'ollama'].includes(input.provider)) {
      let url; try { url = new URL(endpoint); } catch { throw failure(422, 'invalid-endpoint'); }
      if (!approved.has(url.href) || url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw failure(422, 'endpoint-not-approved');
    } else if (endpoint) throw failure(422, 'endpoint-not-allowed');
    const requestsPerDay = Number(input.requestsPerDay ?? previous.requestsPerDay);
    if (!Number.isInteger(requestsPerDay) || requestsPerDay < 1 || requestsPerDay > 100000) throw failure(422, 'invalid-request-limit');
    const apiKey = input.clearKey ? '' : String(input.apiKey || (input.provider === previous.provider && endpoint === previous.endpoint ? previous.apiKey : ''));
    if (apiKey.length > 4096 || /[\r\n]/.test(apiKey)) throw failure(422, 'invalid-key');
    if (['openai', 'gemini', 'anthropic'].includes(input.provider) && !apiKey) throw failure(422, 'key-required');
    return { provider: input.provider, model: input.provider === 'disabled' ? '' : model,
      endpoint, apiKey: input.provider === 'disabled' ? '' : apiKey, requestsPerDay, revision: input.revision };
  }
  function sessionId(req) {
    const value = /(?:^|;\s*)roha_admin=([^;]+)/.exec(req.headers.cookie || '')?.[1] || '';
    return hash(value).toString('hex');
  }
  async function authorized(req) {
    if (persistence) return persistence.hasSession(sessionId(req));
    for (const [id, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(id);
    return (sessions.get(sessionId(req)) || 0) > Date.now();
  }
  function cookie(value, age = 3600) { return `roha_admin=${value}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${age}${secure ? '; Secure' : ''}`; }
  const send = (res, status, value, extra = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(JSON.stringify(value));
  };
  async function json(req) {
    if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') throw failure(415, 'json-required');
    const parts = []; let size = 0;
    for await (const part of req.iterator({ destroyOnReturn: false })) { size += part.length; if (size > 32768) throw failure(413, 'request-too-large'); parts.push(part); }
    try { return JSON.parse(Buffer.concat(parts)); } catch { throw failure(400, 'invalid-json'); }
  }
  function context(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure(422, 'invalid-request');
    if (body.consent !== true) throw failure(403, 'consent-required');
    if (typeof body.utterance !== 'string' || !body.utterance.trim() || body.utterance.length > 1000) throw failure(422, 'invalid-request');
    const map = body.map;
    if (!map || !idPattern.test(map.mapId) || !Number.isSafeInteger(map.mapVersion) || map.mapVersion < 1 || !Array.isArray(map.resources) || map.resources.length > 100) throw failure(422, 'invalid-map');
    if (map.resources.some(r => !r || typeof r !== 'object' || !idPattern.test(r.id))) throw failure(422, 'invalid-map');
    const resources = map.resources.filter(r => r.privacy === 'page-metadata').map(r => ({
      id: r.id, allowedIntents: Array.isArray(r.allowedIntents) ? r.allowedIntents.filter(i => safeIntents.has(i)) : [],
    }));
    if (!resources.length) throw failure(422, 'no-public-targets');
    const screenContext = (body.screenContext && typeof body.screenContext === 'object') ? {
      activeQuestion: String(body.screenContext.activeQuestion || '').slice(0, 300),
      description: String(body.screenContext.description || '').slice(0, 500),
      options: Array.isArray(body.screenContext.options) ? body.screenContext.options.slice(0, 15).map(o => String(o || '').slice(0, 100)) : [],
    } : undefined;
    return { utterance: body.utterance, mapId: map.mapId, mapVersion: map.mapVersion, resources, locale: body.locale || 'am', screenContext };
  }
  function validate(proposal, ctx) {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) throw failure(502, 'invalid-ai-response');
    if (!proposal.intent || !safeIntents.has(proposal.intent)) {
      if (typeof proposal.message === 'string' && proposal.message.trim()) {
        proposal.intent = 'chat';
        proposal.targetId = 'page.main';
        proposal.payload = {};
      } else {
        throw failure(502, 'invalid-ai-response');
      }
    }
    const allowedKeys = new Set(['intent', 'targetId', 'payload', 'message']);
    if (Object.keys(proposal).some(k => !allowedKeys.has(k))) throw failure(502, 'invalid-ai-response');
    if (proposal.message !== undefined && typeof proposal.message !== 'string') throw failure(502, 'invalid-ai-response');

    if (proposal.intent === 'chat' && (!proposal.targetId || !ctx.resources.some(r => r.id === proposal.targetId))) {
      proposal.targetId = 'page.main';
    }
    const target = ctx.resources.find(r => r.id === proposal.targetId);
    if (!target?.allowedIntents.includes(proposal.intent) && proposal.intent !== 'chat') throw failure(502, 'invalid-ai-target');
    const p = proposal.payload;
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw failure(502, 'invalid-ai-payload');
    const keys = Object.keys(p);
    const valid = proposal.intent === 'text_scale' ? keys.length === 1 && [100,125,150,175,200].includes(p.percent)
      : proposal.intent === 'contrast' ? keys.length === 1 && ['default','high-contrast'].includes(p.theme)
      : ['simple_mode','reduced_motion'].includes(proposal.intent) ? keys.length === 1 && typeof p.enabled === 'boolean'
      : proposal.intent === 'navigate' ? (keys.length === 0 || (keys.length === 1 && ['back', 'forward'].includes(p.direction)))
      : proposal.intent === 'chat' ? (keys.length === 0 || (keys.length === 1 && typeof p.message === 'string'))
      : keys.length === 0;
    if (!valid) throw failure(502, 'invalid-ai-payload');
    return { schemaVersion: '2.0', utteranceId: `ai-${randomBytes(8).toString('hex')}`, mapId: ctx.mapId, mapVersion: ctx.mapVersion, ...proposal };
  }
  function generateContextualFallback(ctx) {
    const utt = (ctx.utterance || '').toLowerCase();
    const isAm = ctx.locale === 'am' || /[\u1200-\u137F]/.test(ctx.utterance);
    const q = ctx.screenContext?.activeQuestion || '';
    const opts = (ctx.screenContext?.options || []).filter(Boolean);
    const optsStr = opts.join(', ');

    if (/ምን|ጠይ|ፊት|ስክሪን|እርዳ|አብራራ|what|screen|question|help|explain/iu.test(utt)) {
      const msg = isAm
        ? (q ? `በአሁኑ ሰዓት በስክሪኑ ላይ የቀረበው ጥያቄ "${q}" ነው። ${optsStr ? 'አማራጮቹ፡ ' + optsStr + ' ናቸው።' : ''} የትኛውን መምረጥ ይፈልጋሉ?` : 'በስክሪኑ ላይ የቀረበውን ጥያቄ ለመመለስ አግዝዎታለሁ። ምን እንዲደረግልዎ ይፈልጋሉ?')
        : (q ? `Currently on screen, the question is "${q}". ${optsStr ? 'The options are: ' + optsStr + '.' : ''} Which one would you like to choose?` : 'I am here to help you complete this step. What would you like to do?');
      return { intent: 'chat', targetId: 'page.main', payload: {}, message: msg };
    }

    if (/ሰላም|እንደምን|ጤና|hi|hello|hey/iu.test(utt)) {
      const msg = isAm
        ? 'ሰላም! እኔ ሮሃ ነኝ። የምዝገባ ቅጹን በቀላሉ እንዲሞሉ ልረዳዎት ዝግጁ ነኝ።'
        : 'Hello! I am Roha. I am ready to help you complete your onboarding smoothly.';
      return { intent: 'chat', targetId: 'page.main', payload: {}, message: msg };
    }

    if (/አንብብ|ስማ|ድምጽ|read|listen|speak/iu.test(utt)) {
      const msg = isAm ? 'ጥያቄውን ላንብብልዎት።' : 'Let me read the question for you.';
      return { intent: 'read', targetId: 'page.main', payload: {}, message: msg };
    }

    if (/ቀጣይ|ወደፊት|ቀጥል|next|forward|continue/iu.test(utt)) {
      const msg = isAm ? 'ወደ ቀጣዩ ደረጃ እየሄድን ነው።' : 'Moving to the next step.';
      return { intent: 'navigate', targetId: 'page.main', payload: { direction: 'forward' }, message: msg };
    }

    if (/ተመለስ|ወደኋላ|back|previous/iu.test(utt)) {
      const msg = isAm ? 'ወደ ቀደመው ደረጃ ተመልሰናል።' : 'Going back to the previous step.';
      return { intent: 'navigate', targetId: 'page.main', payload: { direction: 'back' }, message: msg };
    }

    if (/ትልቅ|ጽሑፍ|አተልቅ|big|larger|zoom/iu.test(utt)) {
      const msg = isAm ? 'የጽሑፉ መጠን እንዲተልቅ ተደርጓል።' : 'Text size has been increased.';
      return { intent: 'text_scale', targetId: 'page.main', payload: { percent: 150 }, message: msg };
    }

    const defaultMsg = isAm
      ? (q ? `ጥያቄው "${q}" ነው። አማራጮችዎን መምረጥ ወይም ጥያቄ መጠየቅ ይችላሉ።` : 'እርስዎን ለመርዳት ዝግጁ ነኝ።')
      : (q ? `The question is "${q}". You can select an option or ask me any question.` : 'I am here to help you.');
    return { intent: 'chat', targetId: 'page.main', payload: {}, message: defaultMsg };
  }

  async function interpret(config, ctx) {
    if (config.provider === 'disabled') throw failure(503, 'ai-disabled');
    const prompt = 'You are Roha (ሮሃ), an empathetic, intelligent bilingual (Amharic and English) AI onboarding assistant for OpenPath. '
      + (ctx.screenContext?.activeQuestion ? `\nCURRENT SCREEN IN FRONT OF THE USER:\n- Active Question: "${ctx.screenContext.activeQuestion}"\n- Description/Instructions: "${ctx.screenContext.description || ''}"\n- Options/Choices: ${JSON.stringify(ctx.screenContext.options || [])}\nWhen the user asks what is being asked, what to do, or asks about what is in front of them, explain this active question and the choices warmly and clearly in their language!\n` : '')
      + 'OpenPath makes onboarding accessible to everyone. User locale: ' + (ctx.locale || 'am') + '. '
      + 'Return ONLY JSON with intent, targetId, payload, and message. '
      + 'In "message", provide a warm, helpful, natural conversational reply in the language used by the user (Amharic or English). '
      + 'If the user greets, asks a question, or chats, use intent "chat" with targetId "page.main" and payload {}. '
      + 'Targets and allowed intents: ' + JSON.stringify(ctx.resources)
      + '. Payloads: text_scale {"percent":150}, contrast {"theme":"high-contrast"}, simple_mode/reduced_motion {"enabled":true}, navigate {"direction":"back"}; others {}. '
      + 'Never submit, fill answers, invent targets or execute code.';
    const headers = { 'Content-Type': 'application/json' };
    let url, body;
    if (config.provider === 'openai') {
      url = 'https://api.openai.com/v1/responses'; headers.Authorization = `Bearer ${config.apiKey}`;
      body = { model: config.model, instructions: prompt, input: ctx.utterance, store: false, max_output_tokens: 512, text: { format: { type: 'json_object' } } };
    } else if (config.provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`; headers['x-goog-api-key'] = config.apiKey;
      body = { systemInstruction: { parts: [{ text: prompt }] }, contents: [{ role: 'user', parts: [{ text: ctx.utterance }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 512 } };
    } else if (config.provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages'; headers['x-api-key'] = config.apiKey; headers['anthropic-version'] = '2023-06-01';
      body = { model: config.model, max_tokens: 512, system: prompt, messages: [{ role: 'user', content: ctx.utterance }] };
    } else if (config.provider === 'ollama') {
      url = config.endpoint; body = { model: config.model, system: prompt, prompt: ctx.utterance, format: 'json', stream: false, options: { num_predict: 512 } };
    } else {
      url = config.endpoint; if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
      body = { model: config.model, instructions: prompt, input: ctx.utterance };
    }
    if (active >= 8) throw failure(429, 'ai-busy');
    active++;
    try {
      stats.requests++;
      let response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(12000) });
      if (!response.ok && config.provider === 'gemini' && response.status === 404) {
        const altUrls = [
          `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(config.model.replace(/^models\//, ''))}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(config.apiKey)}`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(config.apiKey)}`,
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        ];
        for (const altUrl of altUrls) {
          if (altUrl === url) continue;
          const altRes = await fetchImpl(altUrl, { method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(12000) }).catch(() => null);
          if (altRes && altRes.ok) {
            response = altRes;
            break;
          }
        }
      }
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[AI Provider Error] ${config.provider} returned HTTP ${response.status}:`, errText);
        const fallback = generateContextualFallback(ctx);
        if (fallback) return validate(fallback, ctx);
        throw failure(response.status === 429 ? 429 : 502, 'provider-unavailable');
      }
      let bytes = 0; const parts = [];
      for await (const part of response.body) { bytes += part.length; if (bytes > 65536) throw failure(502, 'provider-response-too-large'); parts.push(part); }
      const data = JSON.parse(Buffer.concat(parts).toString());
      const text = config.provider === 'openai' ? data.output?.flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('')
        : config.provider === 'gemini' ? data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('')
        : config.provider === 'anthropic' ? data.content?.filter(c => c.type === 'text').map(c => c.text).join('')
        : config.provider === 'ollama' ? data.response : null;
      const cleanJson = (text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return validate(cleanJson ? JSON.parse(cleanJson) : data, ctx);
    } catch (e) {
      stats.failures++;
      if (e.status && e.status !== 502) throw e;
      const fallback = generateContextualFallback(ctx);
      if (fallback) return validate(fallback, ctx);
      throw failure(502, 'provider-unavailable');
    }
    finally { active--; }
  }
  async function handle(req, res, path) {
    if (!path.startsWith('/api/admin/') && !path.startsWith('/api/assistant/')) return false;
    try {
      const isLocalDev = env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.headers.origin || '');
      const allowedOrigins = new Set([origin, ...(env.ROHA_EMBED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)]);
      if ((path.startsWith('/api/assistant/') || path.startsWith('/api/admin/')) && (allowedOrigins.has(req.headers.origin) || isLocalDev)) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          send(res, 200, {}); return true;
        }
      }
      if (req.method === 'GET' && path === '/api/assistant/config') {
        const c = await load(); send(res, 200, { provider: c.provider, model: c.model, revision: c.revision, consentRequired: true }); return true;
      }
      if (path.startsWith('/api/admin/')) {
        if (!enabled) throw failure(503, 'administrator-not-configured');
        if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) throw failure(405, 'method-not-allowed');
        if (req.method !== 'GET' && req.headers.origin !== origin && !isLocalDev) throw failure(403, 'origin-not-allowed');
        if (path === '/api/admin/session' && req.method === 'POST') {
          if (!await reserve(`login:${hash(req.socket.remoteAddress || '').toString('hex')}`, 10)) throw failure(429, 'try-later');
          const value = String(req.headers.authorization || '').replace(/^Bearer /, '');
          if (!equal(value, adminToken)) throw failure(401, 'sign-in-required');
          const token = randomBytes(32).toString('base64url');
          const id = hash(token).toString('hex');
          if (persistence) await persistence.createSession(id);
          else { if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value); sessions.set(id, Date.now() + 3600000); }
          send(res, 200, { ok: true }, { 'Set-Cookie': cookie(token) }); return true;
        }
        if (!await authorized(req)) throw failure(401, 'sign-in-required');
        if (path === '/api/admin/session' && req.method === 'DELETE') {
          if (persistence) await persistence.deleteSession(sessionId(req)); else sessions.delete(sessionId(req));
          send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) }); return true;
        }
        if (path === '/api/admin/config' && req.method === 'GET') { send(res, 200, publicConfig(await load())); return true; }
        if (path === '/api/admin/metrics' && req.method === 'GET') { send(res, 200, { ...stats, active }); return true; }
        if ((path === '/api/admin/config' && req.method === 'PUT') || (path === '/api/admin/test' && req.method === 'POST')) {
          const config = normalize(await json(req), await load());
          if (path === '/api/admin/test') {
            if (!await reserve('admin-tests', 10)) throw failure(429, 'try-later');
            const ctx = { mapId: 'connection-test', mapVersion: 1, utterance: 'Make the text bigger', resources: [{ id: 'page.main', allowedIntents: ['text_scale'] }] };
            await interpret(config, ctx); send(res, 200, { ok: true, provider: config.provider });
          } else { send(res, 200, publicConfig(await save(config))); }
          return true;
        }
      }
      if (path === '/api/assistant/interpret' && req.method === 'POST') {
        // Origin checks are deployment policy, not authentication. The public endpoint
        // additionally has a shared installation budget and bounded concurrency.
        if (!allowedOrigins.has(req.headers.origin) && !isLocalDev) throw failure(403, 'origin-not-allowed');
        const input = await json(req); const ctx = context(input); const config = await load();
        if (config.provider === 'disabled') throw failure(503, 'ai-disabled');
        console.log(`[Roha AI] User utterance: "${input.utterance}"`);
        if (!await reserve('ai-minute', 60) || !await reserve('ai-day', config.requestsPerDay, 86400000)) throw failure(429, 'usage-limit');
        const intent = await interpret(config, ctx);
        console.log(`[Roha AI] Gemini proposed intent:`, intent);
        send(res, 200, { intent }); return true;
      }
      throw failure(404, 'not-found');
    } catch (e) {
      console.error('Handle error:', e);
      stats.rejected++;
      if (e.status === 413) res.on('finish', () => req.destroy());
      send(res, e.status || 503, { error: { code: e.code || 'service-unavailable' } }, e.status === 413 ? {Connection:'close'} : {});
      return true;
    }
  }
  return { handle, stats, enabled };
}
