import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { connectDatabase } from '../database.mjs';
import { databaseFixture } from './database-fixture.mjs';
const fixture=await databaseFixture();
const a = await connectDatabase(fixture.url);
const b = await connectDatabase(fixture.url);
const prefix = 'test-'+randomBytes(8).toString('hex');
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log(`✓ ${label}`);};
try {
  await Promise.all([a.migrate(),b.migrate()]);await a.ready();check(true,'concurrent migrations are serialized and repeatable');
  const record={id:prefix,formId:'test-form',clientRef:prefix,receivedAt:new Date().toISOString(),answers:{}};
  const start=performance.now();
  const receipts=await Promise.all(Array.from({length:100},(_,i)=>(i%2?a:b).saveSubmission({...record,id:prefix+'-'+i})));
  check(new Set(receipts.map(r=>r.record.id)).size === 1 && receipts.filter(r=>!r.duplicate).length === 1,'100 concurrent retries across two pools create exactly one receipt');
  console.log(`100 concurrent idempotent writes: ${Math.round(performance.now()-start)}ms (local database, not a capacity guarantee)`);
  const reservations=await Promise.all(Array.from({length:40},(_,i)=>(i%2?a:b).reserve(prefix,7,60000)));
  check(reservations.filter(Boolean).length === 7,'shared usage budget permits exactly 7 of 40 simultaneous reservations');
  await a.createSession(prefix);check(await b.hasSession(prefix),'session recognized by another worker');
  await b.deleteSession(prefix);check(!await a.hasSession(prefix),'logout revocation shared across workers');
  const other=await b.saveSubmission({...record,id:prefix+'-other',formId:'other-form'});
  check(!other.duplicate && other.record.formId === 'other-form','idempotency scoped to form');
  // The dedicated test database must not contain an operator configuration.
  const previous=await a.getConfig();
  assert.equal(previous,undefined,'Use an empty test database for configuration concurrency checks');
  const writes=await Promise.allSettled([a.setConfig({test:prefix},0),b.setConfig({test:prefix},0)]);
  check(writes.filter(r=>r.status==='fulfilled').length === 1 && writes.some(r=>r.status==='rejected' && r.reason.status===409),'only one initial config revision can win across workers');
  check((await b.getConfig()).test===prefix,'saved configuration is shared');
  const expired={...record,id:prefix+'-expired',clientRef:prefix+'-expired',receivedAt:'2000-01-01T00:00:00Z'};
  await a.saveSubmission(expired);check(await a.cleanup(3650)>=1 && !await b.getSubmission(expired.id),'retention removes expired submissions');
} finally {await a.close();await b.close();await fixture.cleanup();}
console.log(`${checks}/${checks} PostgreSQL checks passed`);
