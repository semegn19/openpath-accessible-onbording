import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROMPTS_FILE = fileURLToPath(new URL('../../docs/audio-recording-prompts.md', import.meta.url));
const AUDIO_DIR = fileURLToPath(new URL('../public/audio/', import.meta.url));
const ENV_FILE = fileURLToPath(new URL('../../api/.env', import.meta.url));
const ALT_ENV_FILE = fileURLToPath(new URL('../src/.env', import.meta.url));

function getApiKey() {
  if (process.env.ADDIS_AI_API_KEY) return process.env.ADDIS_AI_API_KEY;
  for (const envPath of [ENV_FILE, ALT_ENV_FILE]) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      const match = content.match(/ADDIS_AI_API_KEY=([^\r\n]+)/);
      if (match) return match[1].trim();
    }
  }
  return '';
}

const API_KEY = getApiKey();
if (!API_KEY) {
  console.error('ERROR: ADDIS_AI_API_KEY not found in api/.env or environment.');
  process.exit(1);
}

const content = readFileSync(PROMPTS_FILE, 'utf8');
const onboardSection = content.split('## Job Application Form')[0];
const lines = onboardSection.split('\n');

const items = [];
for (const line of lines) {
  const trimmed = line.trim();
  const match = trimmed.match(/^([a-z0-9_.-]+\.(om|ti)(?:\.simple)?\.mp3)\s*:\s*"(.*)"$/);
  if (match) {
    const [, filename, lang, text] = match;
    items.push({
      filename,
      lang,
      text: text.replace(/\\"/g, '"'),
    });
  }
}

console.log(`Found ${items.length} prompts for onboarding in Afaan Oromoo (om) and Tigrinya (ti):`);
let totalChars = 0;
for (const item of items) {
  totalChars += item.text.length;
  console.log(`  - [${item.lang}] ${item.filename} (${item.text.length} chars): ${item.text.slice(0, 50)}...`);
}
console.log(`\nTotal characters: ${totalChars}`);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

if (DRY_RUN) {
  console.log('\nDRY RUN complete. Use without --dry-run to generate.');
  process.exit(0);
}

const VOICE_MAP = {
  om: 'om-bikila',
  ti: 'ti-berhane',
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateClip(item) {
  const destPath = join(AUDIO_DIR, item.filename);
  if (existsSync(destPath) && !args.includes('--force')) {
    console.log(`⏭ Skipping (already exists): ${item.filename}`);
    return;
  }

  const voiceId = VOICE_MAP[item.lang];
  const clientRequestId = `openpath-${item.filename.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`;

  console.log(`🎙 Generating [${item.lang}] ${item.filename} with voice ${voiceId}...`);

  const res = await fetch('https://api.addisassistant.com/api/v1/voice/generations', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_request_id: clientRequestId,
      voice_id: voiceId,
      language: item.lang,
      text: item.text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to generate ${item.filename} (HTTP ${res.status}): ${errText}`);
  }

  const resData = await res.json();
  const audioData = resData.data?.audio;
  let audioBuffer;

  if (audioData && audioData.startsWith('data:audio')) {
    const base64Data = audioData.split(',')[1];
    audioBuffer = Buffer.from(base64Data, 'base64');
  } else if (resData.data?.audio_url) {
    const audioFetch = await fetch(resData.data.audio_url);
    if (!audioFetch.ok) throw new Error(`Failed to download audio from ${resData.data.audio_url}`);
    audioBuffer = Buffer.from(await audioFetch.arrayBuffer());
  } else {
    throw new Error(`No audio data received in response for ${item.filename}`);
  }

  writeFileSync(destPath, audioBuffer);
  console.log(`✓ Saved ${item.filename} (${audioBuffer.length} bytes, duration: ${resData.data?.duration_seconds}s)`);
}

async function main() {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await generateClip(item);
      // Small pause between requests to be polite to the rate limiter
      await sleep(300);
    } catch (err) {
      console.error(`✗ Error generating ${item.filename}:`, err.message);
      // Continue with remaining or break? Let's stop if auth or quota error
      if (err.message.includes('401') || err.message.includes('403') || err.message.includes('insufficient')) {
        break;
      }
    }
  }
}

main();
