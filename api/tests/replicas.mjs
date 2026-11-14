import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { databaseFixture } from './database-fixture.mjs';
import { connectDatabase } from '../database.mjs';
const fixture=await databaseFixture();const db=await connectDatabase(fixture.url);await db.migrate();
const token=randomBytes(32).toString('hex');const key=randomBytes(32).toString('base64');
const env={...process.env,DATABASE_URL:fixture.url,DATA_KEY:key,ROHA_DEPLOYMENT:'production',NODE_ENV:'production',ROHA_ADMIN_TOKEN:token,
  ROHA_ADMIN_ORIGIN:'https://admin.example',ALLOWED_ORIGIN:'https://forms.example',TRUST_PROXY:'0',RATE_LIMIT_PER_MIN:'1000'};
const serverPath=fileURLToPath(new URL('../server.mjs',import.meta.url));
const processes=[];let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log(`✓ ${label}`);};
async function start() {
  const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
  const child=spawn(process.execPath,[serverPath],{env:{...env,PORT:String(port)},stdio:['ignore','ignore','pipe']});processes.push(child);
  let error='';child.stderr.on('data',d=>{error+=d;});const url=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++) {if(child.exitCode!==null)throw new Error(error);try{if((await fetch(url+'/api/health')).ok)return url;}catch{}await new Promise(r=>setTimeout(r,50));}
  throw new Error('API did not become ready: '+error);
}
const body={formId:'savanna-onboard-v1',clientRef:'replica-test-'+randomBytes(8).toString('hex'),answers:{language:'am',assistance:'no-thanks',name:'PRIVATE TEST NAME',phone:'0912345678','id-route':'fayda','id-value':'3910028475',submit:['consent-programme'],'accessibility-prefs':['large-text']}};
async function submit(url){const r=await fetch(url+'/api/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,...await r.json()};}
try {
  const [a,b]=await Promise.all([start(),start()]);
  const responses=await Promise.all(Array.from({length:40},(_,i)=>submit(i%2?a:b)));
  check(responses.filter(r=>r.status===201).length===1 && responses.filter(r=>r.status===200).length===39 && new Set(responses.map(r=>r.id)).size===1,'two API workers return one receipt for 40 concurrent retries');
  const stored=await db.getSubmission(responses[0].id);
  check(!JSON.stringify(stored).includes('PRIVATE TEST NAME') && stored.answers.name.enc===1,'personal answers encrypted in PostgreSQL');
  check(!('accessibility-prefs' in stored.answers),'local accessibility preferences absent from database');
  const receipt=await(await fetch(a+'/api/submissions/'+stored.id)).json();
  check(!('answers' in receipt),'production receipt lookup does not disclose answers');
  const login=await fetch(a+'/api/admin/session',{method:'POST',headers:{Origin:env.ROHA_ADMIN_ORIGIN,Authorization:'Bearer '+token}});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const headers={Origin:env.ROHA_ADMIN_ORIGIN,Cookie:cookie,'Content-Type':'application/json'};
  check((await fetch(b+'/api/admin/config',{headers})).ok,'administrator session works on another API replica');
  const config={provider:'openai',model:'test-model',apiKey:'private-key-123',revision:0,requestsPerDay:10};
  check((await fetch(a+'/api/admin/config',{method:'PUT',headers,body:JSON.stringify(config)})).ok,'provider configuration saved');
  const visible=await(await fetch(b+'/api/admin/config',{headers})).json();
  check(visible.provider==='openai' && visible.hasKey && !JSON.stringify(await db.getConfig()).includes(config.apiKey),'encrypted provider settings shared across API replicas');
  await fetch(b+'/api/admin/session',{method:'DELETE',headers});check((await fetch(a+'/api/admin/config',{headers})).status===401,'logout invalidates session on both API replicas');
  const restarted=await start();check((await submit(restarted)).id===stored.id,'new API worker recovers durable idempotency');
  const guard=spawnSync(process.execPath,[serverPath],{env:{...env,DATABASE_URL:'',DATA_KEY:''},encoding:'utf8',timeout:5000});
  check(guard.status!==0 && guard.stderr.includes('Production requires'),'production refuses missing required storage and encryption configuration');
} finally {
  await Promise.all(processes.map(p=>new Promise(r=>{if(p.exitCode!==null)return r();p.once('exit',r);p.kill('SIGTERM');})));
  await db.close();await fixture.cleanup();
}
console.log(`${checks}/${checks} production API replica checks passed`);
