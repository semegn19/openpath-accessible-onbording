import { randomBytes, createCipheriv } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiKey = process.argv[2]?.trim();

if (!apiKey) {
  console.error('Usage: node scripts/set-gemini-key.mjs <YOUR_GEMINI_API_KEY>');
  process.exit(1);
}

// Same DATA_KEY as in .env
const dataKeyBase64 = process.env.DATA_KEY || 'dGhpc2lzYTMyYnl0ZXNlY3JldGtleWZvcmVuY3J5cHQ=';
const key = Buffer.from(dataKeyBase64, 'base64');

const config = {
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  endpoint: '',
  apiKey: apiKey,
  revision: 1,
  requestsPerDay: 1000,
};

const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const data = Buffer.concat([cipher.update(JSON.stringify(config)), cipher.final()]);
const box = {
  iv: iv.toString('base64'),
  tag: cipher.getAuthTag().toString('base64'),
  data: data.toString('base64'),
};

const dataDir = join(here, '..', '..', 'api', 'data');
await mkdir(dataDir, { recursive: true });
const targetFile = join(dataDir, 'assistant-config.enc.json');
await writeFile(targetFile, JSON.stringify(box, null, 2), 'utf8');

console.log('✅ Successfully configured Gemini provider!');
console.log(`Saved encrypted configuration to ${targetFile}`);

