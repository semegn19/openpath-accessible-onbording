import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseFixture } from './database-fixture.mjs';
import { connectDatabase } from '../database.mjs';
const fixture=await databaseFixture();const db=await connectDatabase(fixture.url);
const directory=await mkdtemp(join(tmpdir(),'roha-backup-test-'));const archive=join(directory,'test.dump');
const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
const ciphertext=Buffer.concat([cipher.update(JSON.stringify('private recovery test')),cipher.final()]);
const box={enc:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ct:ciphertext.toString('base64')};
const record={id:'test-recovery',formId:'test-form',clientRef:'recovery-ref',receivedAt:new Date().toISOString(),answers:{name:box}};
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',timeout:30000});assert.equal(r.status,0,command+' failed: '+(r.stderr || r.error?.message));}
try {
  await db.migrate();await db.saveSubmission(record);await db.setConfig({encryptedTest:box},0);
  const start=performance.now();
  run('pg_dump',['--dbname',process.env.TEST_DATABASE_URL,'--schema',fixture.schema,'--format=custom','--file',archive]);
  // Drop only this test's newly created random schema to simulate total data loss.
  await fixture.dropSchema();
  run('pg_restore',['--dbname',process.env.TEST_DATABASE_URL,'--no-owner','--exit-on-error',archive]);
  await db.ready();console.log('✓ schema and migration metadata restored');
  const restored=await db.getSubmission(record.id);const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(restored.answers.name.iv,'base64'));decipher.setAuthTag(Buffer.from(restored.answers.name.tag,'base64'));
  assert.equal(JSON.parse(Buffer.concat([decipher.update(Buffer.from(restored.answers.name.ct,'base64')),decipher.final()]).toString()),'private recovery test');console.log('✓ restored personal answer decrypts with the separately retained key');
  assert.deepEqual(await db.getConfig(),{encryptedTest:box});console.log('✓ encrypted provider configuration restored');
  const retry=await db.saveSubmission({...record,id:'new-attempt'});assert.ok(retry.duplicate && retry.record.id===record.id);console.log('✓ restored idempotency returns the original receipt');
  console.log(`4/4 local backup/restore checks passed in ${Math.round(performance.now()-start)}ms (synthetic data; not deployment RTO)`);
} finally {await db.close();await fixture.cleanup();await rm(directory,{recursive:true,force:true});}
