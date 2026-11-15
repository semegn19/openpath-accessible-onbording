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
    const desc = ctx.screenContext?.description || '';
    const opts = (ctx.screenContext?.options || []).filter(Boolean);
    const optsStr = opts.join(isAm ? '፣ ' : ', ');

    // Greeting
    if (/ሰላም|እንደምን|ጤና|hi|hello|hey/iu.test(utt)) {
      const msg = isAm
        ? 'ሰላም! እኔ ሮሃ ነኝ። ቅጹን በቀላሉ እንዲሞሉ ልረዳዎት ዝግጁ ነኝ።'
        : 'Hello! I am Roha, your onboarding assistant. I am here to help you complete this form easily.';
      return { intent: 'chat', targetId: 'page.main', payload: {}, message: msg };
    }

    // What is on screen / explain current step
    if (/ምን|ጠይ|ፊት|ስክሪን|እርዳ|አብራራ|what|screen|question|help|explain|ምን\s*ማለት|ምን\s*ዓይነት/iu.test(utt)) {
      const msg = isAm
        ? (q ? `አሁን ያለው ጥያቄ፡ "${q}"${desc ? ' — ' + desc : ''}${optsStr ? '። አማራጮቹ፡ ' + optsStr + '።' : '።'} ከዚህ ውስጥ አንዱን ይምረጡ።` : 'ቅጹን ለማስሟላት ለመርዳት ዝግጁ ነኝ። ምን ማድረግ ይፈልጋሉ?')
        : (q ? `The current question is: "${q}"${desc ? ' — ' + desc : ''}${optsStr ? '. Options are: ' + optsStr + '.' : '.'} Please choose one.` : 'I am here to help you complete this step. What would you like to do?');
      return { intent: 'chat', targetId: 'page.main', payload: {}, message: msg };
    }

    // Simple / child-friendly explanation
    if (/ቀላል|ቀጥተኛ|ቀላሉ|simply|simple|easy|kid|child/iu.test(utt)) {
      const msg = isAm
        ? (q ? `ቀላሉን ቃል እንጠቀም። ጥያቄው፡ "${q}"${optsStr ? '። ምረጡ፡ ' + optsStr : ''}።` : 'ቀላሉን ቃል እንጠቀም። ምን ማድረግ ይፈልጋሉ?')
        : (q ? `Let me explain simply. The question is: "${q}"${optsStr ? '. Your choices: ' + optsStr : ''}.` : 'Let me explain simply. What would you like to know?');
      return { intent: 'chat', targetId: 'page.main', payload: {}, message: msg };
    }

    // Read / speak
    if (/አንብብ|ስማ|ድምጽ|read|listen|speak/iu.test(utt)) {
      const msg = isAm ? 'ጥያቄውን ላንብብልዎት።' : 'Let me read the question for you.';
      return { intent: 'read', targetId: 'page.main', payload: {}, message: msg };
    }

    // Next / forward
    if (/ቀጣይ|ወደፊት|ቀጥል|next|forward|continue/iu.test(utt)) {
      if (ctx.screenContext?.hasError) {
        const err = ctx.screenContext.errorMessage;
        const msg = isAm ? `ስህተት ስላለ ማለፍ አይቻልም፦ ${err}` : `Cannot continue due to an error: ${err}`;
        return { intent: 'chat', targetId: 'page.main', payload: {}, message: msg };
      }
      const msg = isAm ? 'ወደ ቀጣዩ ደረጃ እየሄድን ነው።' : 'Moving to the next step.';
      return { intent: 'navigate', targetId: 'page.main', payload: { direction: 'forward' }, message: msg };
    }

    // Back / previous
    if (/ተመለስ|ወደኋላ|back|previous/iu.test(utt)) {
      const msg = isAm ? 'ወደ ቀደመው ደረጃ ተመልሰናል።' : 'Going back to the previous step.';
      return { intent: 'navigate', targetId: 'page.main', payload: { direction: 'back' }, message: msg };
    }

    // Text size
    if (/ትልቅ|ጽሑፍ|አተልቅ|big|larger|zoom/iu.test(utt)) {
      const msg = isAm ? 'የጽሑፉ መጠን እንዲተልቅ ተደርጓል።' : 'Text size has been increased.';
      return { intent: 'text_scale', targetId: 'page.main', payload: { percent: 150 }, message: msg };
    }

    // What comes next
    if (/ቀጣዩ\s*ምን|ቀጣይ\s*ምን|what.*next|what.*after|what.*come/iu.test(utt)) {
      const msg = isAm
        ? (q ? `አሁን ያለው ጥያቄ \"${q}\" ነው። ሲጨርሱ ወደ ቀጣዩ ደረጃ ይሸጋገራሉ።` : 'ቀጣዩን ደረጃ ለማወቅ ወደፊት ብሎ ማለፍ ያስፈልጋል።')
        : (q ? `You are on "${q}". Once you answer, you will move to the next step.` : 'Complete this step to see what comes next.');
      return { intent: 'chat', targetId: 'page.main', payload: {}, message: msg };
    }

    // Direct answer dictation when on a text/phone input screen without multiple choices
    if (opts.length === 0 && q && utt.length >= 1) {
      const cleanAns = ctx.utterance.trim()
        .replace(/^(?:my\s*name\s*is\s+|i\s*am\s+|call\s*me\s+|it\s*is\s+|answer\s*:?\s*|ስሜ\s+|ስሜ\s*የሚባለው\s+|የምባለው\s+|መልስ\s*:?\s*|ይህ\s*ነው\s*|ስም\s*:?\s*|ቁጥሬ\s*|ቁጥሬ\s*ነው\s*|የስልክ\s*ቁጥሬ\s*)/iu, '')
        .replace(/(?:\s+ነው|\s+ናቸው|\s+ይባላል)$/iu, '')
        .trim();
      if (cleanAns) {
        const msg = isAm ? `«${cleanAns}» አስገብቻለሁ።` : `Entered "${cleanAns}".`;
        return { intent: 'propose_answer', targetId: 'page.main', payload: { value: cleanAns }, message: msg };
      }
    }

    // Generic fallback with context
    const defaultMsg = isAm
      ? (q ? `ጥያቄው "${q}" ነው።${optsStr ? ' አማራጮቹ፡ ' + optsStr + '።' : ''} ምን ማድረግ ይፈልጋሉ?` : 'እርስዎን ለመርዳት ዝግጁ ነኝ። ምን ማድረግ ይፈልጋሉ?')
      : (q ? `The question is "${q}".${optsStr ? ' Options: ' + optsStr + '.' : ''} How can I help you?` : 'I am here to help you. What would you like to do?');
    return { intent: 'chat', targetId: 'page.main', payload: {}, message: defaultMsg };
  }

  async function interpret(config, ctx) {
    if (config.provider === 'disabled') throw failure(503, 'ai-disabled');
    const isAm = ctx.locale === 'am' || /[\u1200-\u137F]/.test(ctx.utterance);
    const sc = ctx.screenContext;
    const errorBlock = sc?.hasError
      ? `\n\n=== ACTIVE ERROR ON SCREEN ===\n"${sc.errorMessage}"\nDo NOT navigate forward or say you are moving to the next step! Tell the user about this error and how to fix it.\n=== END ERROR ===\n`
      : '';
    const screenBlock = (sc?.activeQuestion
      ? `\n\n=== CURRENT SCREEN (what the user sees right now) ===\nQuestion: "${sc.activeQuestion}"\nDescription: "${sc.description || ''}"\nOptions: ${JSON.stringify(sc.options || [])}\n=== END SCREEN ===\n\nIf the user asks what is on the screen, what to choose, what this means, or asks any question about this form step, answer it warmly and clearly using the screen info above.\n`
      : '') + errorBlock;
    const prompt = 'You are Roha (ሮሃ), a warm, smart, bilingual (Amharic/English) AI voice assistant for OpenPath onboarding. '
      + 'You speak naturally like a helpful friend — not robotic. You respond in the same language the user speaks. '
      + 'You can answer ANY question the user asks: about the form, about what a word means, about what comes next, about accessibility, or general questions. '
      + 'If the user asks about something outside the form, give a short helpful answer, then gently guide them back.'
      + screenBlock
      + 'User locale: ' + (ctx.locale || 'am') + '. '
      + 'RESPONSE FORMAT: Return ONLY valid JSON with these fields: intent, targetId, payload, message. '
      + 'In "message": write a warm, natural, conversational reply in ' + (isAm ? 'Amharic' : 'English') + '. Keep it concise (1-3 sentences). '
      + 'For greetings, questions, clarifications, explanations — use intent "chat", targetId "page.main", payload {}. '
      + 'If the user provides an answer to the current field (e.g. gives their name, phone number, ID number, or text answer) or selects an option shown on the screen, use intent "propose_answer", targetId: "page.main", payload {"value": "<the_exact_answer_or_option>"}. '
      + 'For navigation: intent "navigate", payload {"direction":"forward"} or {"direction":"back"}. '
      + 'For text size: intent "text_scale", payload {"percent":150}. '
      + 'For contrast: intent "contrast", payload {"theme":"high-contrast"}. '
      + 'For simple mode: intent "simple_mode", payload {"enabled":true}. '
      + 'Available targets: ' + JSON.stringify(ctx.resources) + '. '
      + 'NEVER submit forms, fill unprompted answers, or invent fake targets. '
      + 'ALWAYS include a "message" field with a helpful spoken reply.';
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
