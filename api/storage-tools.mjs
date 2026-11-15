/** Offline maintenance only. Never log records, credentials, connection URLs or keys. */
import pg from 'pg';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, readdir, mkdir, mkdtemp, open, rename, rm, lstat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export class StorageToolError extends Error {
  constructor(code, line) { super(code); this.code=code; this.line=line; }
}
const fail=code=>{throw new StorageToolError(code);};
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
export function dataKey(value, name='data-key') {
  if (typeof value!=='string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(`invalid-${name}`);
  const key=Buffer.from(value,'base64');
  if(key.length!==32 || key.toString('base64')!==value) fail(`invalid-${name}`);
  return key;
}
export function seal(value,key,config=false) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]).toString('base64');
  return config ? {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted}
    : {enc:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ct:encrypted};
}
export function unseal(box,key,config=false) {
  if(!key)fail('source-key-required');
  try {
    const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));
    cipher.setAuthTag(Buffer.from(box.tag,'base64'));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(config?box.data:box.ct,'base64')),cipher.final()]).toString('utf8'));
  } catch {fail('cannot-decrypt');}
}
const privateFields=new Set(['support','accessibility-prefs','accommodations','medical','disability','diagnosis']);
async function policies(directory) {
  const result=new Map();
  for(const name of await readdir(directory))if(name.endsWith('.json')) {
    const schema=JSON.parse(await readFile(join(directory,name),'utf8'));
    if(schema.id && Array.isArray(schema.steps))result.set(schema.id,new Map(schema.steps.map(s=>[s.id,s])));
  }
  if(!result.size)fail('schemas-missing');return result;
}
function checkedRecord(value) {
  if(!object(value) || !/^sub_[A-Za-z0-9_-]{16}$/.test(value.id) || typeof value.formId!=='string'
    || typeof value.receivedAt!=='string' || !Number.isFinite(Date.parse(value.receivedAt)) || !object(value.answers)
    || (value.clientRef!==undefined && !/^[A-Za-z0-9_-]{8,64}$/.test(value.clientRef))
    || (value.stripped!==undefined && (!Array.isArray(value.stripped) || !value.stripped.every(v=>typeof v==='string')))
    || (value.encryptedFields!==undefined && (!Array.isArray(value.encryptedFields) || !value.encryptedFields.every(v=>typeof v==='string'))))fail('invalid-record');
  return value;
}
function plainRecord(value,key) {
  checkedRecord(value);
  const answers=Object.create(null);
  for(const [name,answer]of Object.entries(value.answers)) {
    if(object(answer) && 'enc' in answer && answer.enc!==1)fail('unsupported-encryption');
    answers[name]=object(answer) && answer.enc===1 ? unseal(answer,key):answer;
  }
  const {encryptedFields,...rest}=value;
  return {...rest,answers};
}
function importedRecord(value,key,schemas) {
  const allowed=new Set(['id','formId','clientRef','receivedAt','answers','stripped','encryptedFields']);
  if(!object(value) || Object.keys(value).some(k=>!allowed.has(k)))fail('unknown-record-property');
  const plain=plainRecord(value,key),schema=schemas.get(plain.formId);
  if(!schema)fail('unknown-form');
  const stripped=new Set(plain.stripped || []),answers=Object.create(null);
  for(const [name,answer]of Object.entries(plain.answers)) {
    if(privateFields.has(name) || schema.get(name)?.localOnly) {stripped.add(name);continue;}
    if(!schema.has(name))fail('unknown-answer-field');
    answers[name]=answer;
  }
  return {...plain,receivedAt:new Date(plain.receivedAt).toISOString(),answers,stripped:[...stripped].sort()};
}
function protectRecord(plain,original,key,schemas) {
  const schema=schemas.get(plain.formId);if(!schema)fail('unknown-form');
  const answers=Object.create(null),encryptedFields=[];
  for(const [name,value]of Object.entries(plain.answers)) {
    const sensitive=['personal','sensitive'].includes(schema.get(name)?.pii)
      || original.encryptedFields?.includes(name) || original.answers[name]?.enc===1;
    answers[name]=sensitive?seal(value,key):value;if(sensitive)encryptedFields.push(name);
  }
  return {...plain,answers,encryptedFields:encryptedFields.sort()};
}
function checkedConfig(value) {
  if(!object(value) || !['disabled','openai','gemini','anthropic','ollama','custom'].includes(value.provider)
    || !Number.isSafeInteger(value.revision) || value.revision<1 || typeof value.apiKey!=='string'
    || typeof value.model!=='string' || typeof value.endpoint!=='string'
    || !Number.isInteger(value.requestsPerDay) || value.requestsPerDay<1 || value.requestsPerDay>100000)fail('invalid-provider-config');
  return value;
}
async function fingerprint(path) {
  try {const s=await stat(path,{bigint:true});if(!s.isFile())fail('source-not-file');return `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}`;}
  catch(e){if(e.code==='ENOENT')return null;throw e;}
}
async function sourceFiles(directory) {
  const submissions=join(directory,'submissions.jsonl'),config=join(directory,'assistant-config.enc.json');
  const snapshot=[await fingerprint(submissions),await fingerprint(config)];
  if(snapshot.every(v=>v===null))fail('source-empty');
  return {submissions:snapshot[0]?submissions:null,config:snapshot[1]?config:null,
    async verify(){if(!isDeepStrictEqual(snapshot,[await fingerprint(submissions),await fingerprint(config)]))fail('source-changed');}};
}
async function* records(path) {
  if(!path)return;
  let pending='',line=0;
  const parse=text=>{try{return JSON.parse(text);}catch{throw new StorageToolError('invalid-jsonl',line);}};
  for await(const chunk of createReadStream(path,{encoding:'utf8'})) {
    pending+=chunk;let end;
    while((end=pending.indexOf('\n'))>=0) {
      const text=pending.slice(0,end);pending=pending.slice(end+1);line++;
      if(Buffer.byteLength(text)>1048576)throw new StorageToolError('source-line-too-large',line);
      if(text.trim())yield {value:parse(text),line};
    }
    if(Buffer.byteLength(pending)>1048576)throw new StorageToolError('source-line-too-large',line+1);
  }
  if(pending.trim()){line++;yield {value:parse(pending),line};}
}
async function readConfig(path,key) {
  if(!path)return null;
  if((await stat(path)).size>1048576)fail('config-too-large');
  let box;try{box=JSON.parse(await readFile(path,'utf8'));}catch{fail('invalid-provider-config');}
  return checkedConfig(unseal(box,key,true));
}
async function transaction(databaseURL,apply,operation) {
  const client=new pg.Client({connectionString:databaseURL,connectionTimeoutMillis:5000,statement_timeout:30000});
  await client.connect();
  try {
    await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");
    await client.query('SELECT pg_advisory_xact_lock(72460402)');
    await client.query('LOCK TABLE roha_submissions, roha_ai_config, roha_sessions IN ACCESS EXCLUSIVE MODE');
    const report=await operation(client);await client.query(apply?'COMMIT':'ROLLBACK');return {...report,applied:apply};
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{await client.end();}
}
function offline(apply,acknowledged){if(apply && !acknowledged)fail('offline-acknowledgement-required');}
async function match(client,table,record) {
  // table is an internal constant, never supplied by the CLI.
  return (await client.query(`SELECT record FROM ${table} WHERE id=$1 OR (form_id=$2 AND client_ref=$3)`,[record.id,record.formId,record.clientRef || null])).rows;
}
export async function importExisting({sourceDir,databaseURL,sourceKey,targetKey,schemaDir,apply=false,acknowledgeOffline=false}) {
  offline(apply,acknowledgeOffline);
  const files=await sourceFiles(sourceDir),schemas=await policies(schemaDir);
  const config=await readConfig(files.config,sourceKey);
  return transaction(databaseURL,apply,async client=>{
    // Reject an incorrect destination key before mixing ciphertext from different keys.
    let after='';
    while(true) {
      const rows=(await client.query('SELECT id,record FROM roha_submissions WHERE id>$1 ORDER BY id LIMIT 250',[after])).rows;
      if(!rows.length)break;
      for(const row of rows)plainRecord(row.record,targetKey);
      after=rows.at(-1).id;
    }
    const targetConfig=(await client.query('SELECT revision,encrypted FROM roha_ai_config WHERE id=1')).rows[0];
    if(targetConfig) {
      const value=checkedConfig(unseal(targetConfig.encrypted,targetKey,true));
      if(value.revision!==targetConfig.revision)fail('config-revision-mismatch');
    }
    await client.query('CREATE TEMP TABLE roha_import (LIKE roha_submissions INCLUDING ALL) ON COMMIT DROP');
    const report={operation:'import',records:0,inserted:0,existing:0,sourceDuplicates:0,strippedFields:0,config:false};
    for await(const {value,line}of records(files.submissions)) {
      try {
        const plain=importedRecord(value,sourceKey,schemas),record=protectRecord(plain,value,targetKey,schemas);
        report.records++;report.strippedFields+=Object.keys(value.answers).length-Object.keys(record.answers).length;
        const staged=await match(client,'roha_import',record);
        if(staged.length) {
          if(staged.length!==1 || !isDeepStrictEqual(importedRecord(staged[0].record,targetKey,schemas),plain))fail('source-conflict');
          report.sourceDuplicates++;continue;
        }
        const existing=await match(client,'roha_submissions',record);
        if(existing.length) {
          if(existing.length!==1 || !isDeepStrictEqual(importedRecord(existing[0].record,targetKey,schemas),plain))fail('destination-conflict');
          report.existing++;
        }else report.inserted++;
        await client.query('INSERT INTO roha_import(id,form_id,client_ref,received_at,record) VALUES($1,$2,$3,$4,$5)',[record.id,record.formId,record.clientRef || null,record.receivedAt,record]);
      }catch(e){if(e instanceof StorageToolError)e.line=line;throw e;}
    }
    if(config) {
      const existing=(await client.query('SELECT revision,encrypted FROM roha_ai_config WHERE id=1')).rows[0];
      if(existing && (existing.revision!==config.revision || !isDeepStrictEqual(unseal(existing.encrypted,targetKey,true),config)))fail('provider-config-conflict');
      if(!existing)await client.query('INSERT INTO roha_ai_config(id,revision,encrypted) VALUES(1,$1,$2)',[config.revision,seal(config,targetKey,true)]);
      report.config=true;
    }
    // Matching records are re-encrypted too, so pre-existing plaintext cannot survive import.
    await client.query(`INSERT INTO roha_submissions SELECT * FROM roha_import
      ON CONFLICT(id) DO UPDATE SET record=EXCLUDED.record`);
    await files.verify();return report;
  });
}
export async function rotateDatabase({databaseURL,oldKey,newKey,schemaDir,apply=false,acknowledgeOffline=false}) {
  offline(apply,acknowledgeOffline);if(oldKey.equals(newKey))fail('keys-must-differ');
  const schemas=await policies(schemaDir);
  return transaction(databaseURL,apply,async client=>{
    let after='',count=0;
    while(true) {
      const batch=(await client.query('SELECT id,record FROM roha_submissions WHERE id>$1 ORDER BY id LIMIT 250',[after])).rows;
      if(!batch.length)break;
      for(const row of batch) {
        const plain=plainRecord(row.record,oldKey);if(plain.id!==row.id)fail('record-id-mismatch');
        const record=protectRecord(plain,row.record,newKey,schemas);
        await client.query('UPDATE roha_submissions SET record=$1 WHERE id=$2',[record,row.id]);count++;
      }
      after=batch.at(-1).id;
    }
    const saved=(await client.query('SELECT revision,encrypted FROM roha_ai_config WHERE id=1')).rows[0];
    if(saved) {
      const config=checkedConfig(unseal(saved.encrypted,oldKey,true));if(config.revision!==saved.revision)fail('config-revision-mismatch');
      await client.query('UPDATE roha_ai_config SET encrypted=$1 WHERE id=1',[seal(config,newKey,true)]);
    }
    const sessions=(await client.query('DELETE FROM roha_sessions')).rowCount;
    return {operation:'rotate-database',records:count,config:Boolean(saved),sessionsRevoked:sessions};
  });
}
export async function rotateFiles({sourceDir,outputDir,oldKey,newKey,schemaDir,apply=false,acknowledgeOffline=false}) {
  offline(apply,acknowledgeOffline);if(oldKey.equals(newKey))fail('keys-must-differ');
  if(!outputDir || resolve(sourceDir)===resolve(outputDir))fail('new-output-directory-required');
  if(await lstat(outputDir).catch(e=>{if(e.code==='ENOENT')return null;throw e;}))fail('output-already-exists');
  const files=await sourceFiles(sourceDir),schemas=await policies(schemaDir);
  const config=await readConfig(files.config,oldKey);let staging,handle,count=0;
  try {
    if(apply) {
      await mkdir(dirname(resolve(outputDir)),{recursive:true});
      staging=await mkdtemp(join(dirname(resolve(outputDir)),'.roha-rotation-'));
      if(files.submissions)handle=await open(join(staging,'submissions.jsonl'),'wx',0o600);
    }
    for await(const {value,line}of records(files.submissions)) {
      try {
        const record=protectRecord(plainRecord(value,oldKey),value,newKey,schemas);count++;
        if(handle)await handle.writeFile(JSON.stringify(record)+'\n');
      }catch(e){if(e instanceof StorageToolError)e.line=line;throw e;}
    }
    if(handle){await handle.sync();await handle.close();handle=null;}
    if(config && staging) {
      const out=await open(join(staging,'assistant-config.enc.json'),'wx',0o600);
      try{await out.writeFile(JSON.stringify(seal(config,newKey,true)));await out.sync();}finally{await out.close();}
    }
    await files.verify();
    if(staging) {
      if(await lstat(outputDir).catch(e=>{if(e.code==='ENOENT')return null;throw e;}))fail('output-already-exists');
      const dir=await open(staging,'r');try{await dir.sync();}finally{await dir.close();}
      await rename(staging,outputDir);staging=null;
      const parent=await open(dirname(resolve(outputDir)),'r');try{await parent.sync();}finally{await parent.close();}
    }
    return {operation:'rotate-files',records:count,config:Boolean(config),applied:apply};
  }finally{await handle?.close();if(staging)await rm(staging,{recursive:true,force:true});}
}
