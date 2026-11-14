import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAssistant } from '../assistant.mjs';

const directory = await mkdtemp(join(tmpdir(), 'roha-assistant-test-'));
const env = { ROHA_ADMIN_TOKEN: randomBytes(32).toString('hex'), DATA_KEY: randomBytes(32).toString('base64'),
  ROHA_ADMIN_ORIGIN: 'http://localhost:5173', ROHA_EMBED_ORIGINS: 'https://partner.example',
  ROHA_AI_ENDPOINTS: 'http://localhost:11434/api/generate,https://approved.example/interpret' };
const proposal = { intent: 'text_scale', targetId: 'page.main', payload: { percent: 150 } };
let reply = proposal, providerStatus = 200, calls = [], checks = 0, hold = null;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`✓ ${label}`); };
const assistant = createAssistant({ directory, env, fetchImpl: async (url, options) => {
  calls.push({ url, ...options, body: JSON.parse(options.body) });
  if (hold) await hold;
  const text = JSON.stringify(reply);
  const body = url.includes('openai.com') ? { output: [{ content: [{ type: 'output_text', text }] }] }
    : url.includes('googleapis.com') ? { candidates: [{ content: { parts: [{ text }] } }] }
    : url.includes('anthropic.com') ? { content: [{ type: 'text', text }] }
    : url.includes('11434') ? { response: text } : reply;
  return new Response(JSON.stringify(body), { status: providerStatus });
} });
const server = createServer(async (req, res) => { if (!await assistant.handle(req,res,new URL(req.url,'http://test').pathname)) { res.writeHead(404);res.end(); } });
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '';
async function request(path, method = 'GET', data, extra = {}) {
  const r = await fetch(base+path, { method, headers: { Origin: env.ROHA_ADMIN_ORIGIN, Cookie: cookie,
    ...(data !== undefined ? {'Content-Type':'application/json'} : {}), ...extra }, body: data === undefined ? undefined : JSON.stringify(data) });
  return { status:r.status, body:await r.json(), headers:r.headers };
}
const input = { consent: true, configRevision: 0, utterance: 'make this easier to see', map: { mapId:'roha-map', mapVersion:1, resources:[
  {id:'page.main', privacy:'page-metadata', allowedIntents:['text_scale','submit'], name:'PRIVATE LABEL', value:'PRIVATE VALUE'},
  {id:'private.name',privacy:'identity',allowedIntents:['read'],value:'PRIVATE NAME'}] } };
let config = { provider:'openai',model:'test-model',apiKey:'test-key-never-public',endpoint:'',revision:0,requestsPerDay:1000 };
try {
  check((await request('/api/assistant/config')).body.provider === 'disabled', 'AI starts disabled');
  check((await request('/api/admin/config')).status === 401, 'settings require authentication');
  check((await request('/api/admin/session','POST',undefined,{Authorization:'Bearer incorrect'})).status === 401,'invalid login rejected');
  check((await request('/api/admin/session','POST',undefined,{Authorization:`Bearer ${env.ROHA_ADMIN_TOKEN}`,Origin:'https://evil.example'})).status === 403,'cross-origin login rejected');
  const login = await request('/api/admin/session','POST',undefined,{Authorization:`Bearer ${env.ROHA_ADMIN_TOKEN}`});
  cookie = login.headers.get('set-cookie').split(';')[0];
  check(login.status === 200 && /HttpOnly/.test(login.headers.get('set-cookie')) && /SameSite=Strict/.test(login.headers.get('set-cookie')), 'session uses protected cookie');
  const saved = await request('/api/admin/config','PUT',config);
  check(saved.status === 200 && saved.body.hasKey && !JSON.stringify(saved.body).includes(config.apiKey), 'saving never returns the provider secret');
  check(!(await readFile(join(directory,'assistant-config.enc.json'),'utf8')).includes(config.apiKey),'credential encrypted on disk');
  config.revision = saved.body.revision; input.configRevision = config.revision;
  check((await request('/api/admin/config','PUT',{...config,revision:0})).status === 409,'stale configuration update rejected');
  check((await request('/api/admin/config','PUT',config,{Origin:'https://evil.example'})).status === 403,'cross-origin configuration write rejected');
  check((await request('/api/admin/config','PUT',{...config,provider:'custom',endpoint:'http://169.254.169.254/'})).status === 422,'unapproved destination rejected');
  check((await request('/api/assistant/interpret','POST',{...input,consent:false})).status === 403 && calls.length === 0,'no AI request without consent');
  check((await request('/api/assistant/interpret','POST',{...input,configRevision:0})).status === 409,'provider changes require fresh consent');
  check((await request('/api/assistant/interpret','POST',input,{Origin:'https://evil.example'})).status === 403,'unapproved embedding origin rejected');
  const interpreted = await request('/api/assistant/interpret','POST',input);
  check(interpreted.status === 200 && interpreted.body.intent.payload.percent === 150,'valid bounded proposal returned');
  check(!JSON.stringify(calls[0].body).includes('PRIVATE') && !JSON.stringify(calls[0].body).includes('private.name'),'labels, field values and private resources never reach provider');
  check(calls[0].body.store === false && calls[0].redirect === 'error','OpenAI storage disabled and redirects refused');
  for (const provider of ['gemini','anthropic','ollama','custom']) {
    config = {...config,provider,endpoint:provider === 'ollama' ? 'http://localhost:11434/api/generate' : provider === 'custom' ? 'https://approved.example/interpret' : ''};
    const r = await request('/api/admin/config','PUT',config); assert.equal(r.status,200); config.revision=r.body.revision;input.configRevision=config.revision;
    check((await request('/api/assistant/interpret','POST',input)).status === 200,`${provider} request/response adapter works with controlled provider response`);
  }
  for (const [bad,label] of [
    [{intent:'submit',targetId:'page.main',payload:{}},'submit action'],
    [{...proposal,targetId:'private.name'},'private target'],
    [{...proposal,payload:{percent:10000}},'unbounded scale'],
    [{...proposal,script:'alert(1)'},'extra executable field'],
  ]) { reply=bad;check((await request('/api/assistant/interpret','POST',input)).status === 502,`${label} rejected`); }
  reply=proposal;providerStatus=500;
  check((await request('/api/assistant/interpret','POST',input)).body.error.code === 'provider-unavailable','upstream errors safely translated');providerStatus=200;
  let release; hold=new Promise(resolve=>{release=resolve;});
  const parallel=Array.from({length:8},()=>request('/api/assistant/interpret','POST',input));
  for(let i=0;i<100 && assistant.stats.requests<18;i++) await new Promise(r=>setTimeout(r,10));
  check((await request('/api/assistant/interpret','POST',input)).status === 429,'concurrent provider work bounded at eight');
  release();hold=null;await Promise.all(parallel);
  const cors=await request('/api/assistant/config','OPTIONS',undefined,{Origin:'https://partner.example'});
  check(cors.headers.get('access-control-allow-origin') === 'https://partner.example','approved embed preflight supported');
  check((await request('/api/admin/metrics')).body.active === 0,'active capacity released after requests');
  check((await request('/api/assistant/interpret','POST',{...input,map:{...input.map,resources:[null]}})).status === 422,'malformed resource map returns validation error');
  check((await request('/api/assistant/interpret','POST',{...input,utterance:'x'.repeat(40000)})).status === 413,'oversized request gets a clean 413 response');
  check((await request('/api/admin/config','PUT',{...config,revision:undefined})).status === 422,'configuration updates must provide a revision');
  check((await request('/api/admin/session','DELETE')).status === 200 && (await request('/api/admin/config')).status === 401,'logout revokes even a copied session cookie');
} finally { server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true}); }
console.log(`${checks}/${checks} server assistant checks passed (mock providers; no external calls)`);
