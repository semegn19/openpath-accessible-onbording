import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_DIR = fileURLToPath(new URL('../../schema/', import.meta.url));
const OUT_FILE = fileURLToPath(new URL('../../docs/audio-recording-prompts.md', import.meta.url));

const FORMS = [
  { id: 'savanna-onboard-v1', title: 'Learner Onboarding Form (savanna-onboard-v1)', prefix: 'onboard' },
  { id: 'savanna-job-v1', title: 'Job Application Form (savanna-job-v1)', prefix: 'job' },
  { id: 'employer-accommodations-v1', title: 'Employer Accommodations Form (employer-accommodations-v1)', prefix: 'employer' }
];

function t(obj, lang) {
  if (!obj || typeof obj !== 'object') return '';
  return obj[lang] || obj['en'] || '';
}

function questionText(step, lang, simple) {
  const isGroup = step.type === 'radio' || step.type === 'checkbox' || step.type === 'language';
  const src = isGroup ? (step.legend || step.label) : step.label;
  const chosen = (simple && step.simple) ? step.simple : src;
  return t(chosen || src, lang);
}

function whyText(step, lang, simple) {
  return t((simple && step.simpleWhy) || step.why, lang);
}

function hintText(step, lang, simple) {
  return t((simple && step.simpleHint) || step.hint, lang);
}

function bodyText(step, lang, simple) {
  return t((simple && step.simpleBody) || step.body, lang);
}

function optionText(opt, lang, simple) {
  return t((simple && opt.simple) || opt.label, lang);
}

function getReadAloud(schema, step, index, lang, simple) {
  const parts = [questionText(step, lang, simple)];
  if (index === 0 && schema.intro) {
    const introObj = (simple && schema.introSimple) ? schema.introSimple : schema.intro;
    parts.push(t(introObj, lang));
  }
  if (step.why) parts.push(whyText(step, lang, simple));
  if (step.hint) parts.push(hintText(step, lang, simple));
  if (step.body) parts.push(bodyText(step, lang, simple));
  if (step.optional) parts.push(t(schema.ui?.optional, lang));
  if (step.options && step.options.length > 0) {
    for (const o of step.options) {
      parts.push(optionText(o, lang, simple));
    }
  }
  return parts.filter(Boolean).join(' ');
}

const lines = [
  '# Question Audio Recording Prompts',
  '',
  '> Structure: `<filename> : "<exact spoken text>"`',
  '> Drop the recorded files into `app/public/audio/` and run `npm run audio`.',
  '> Supported formats: `.mp3`, `.m4a`, `.opus`, `.wav`.',
  '',
];

for (const form of FORMS) {
  const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, `${form.id}.json`), 'utf8'));
  lines.push(`## ${form.title}`);
  lines.push('');
  lines.push(`### Amharic (አማርኛ) — Standard Mode`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'am', false);
    const text = rawText.replace(/"/g, '\\"');
    // For steps that differ across forms (like step 0 with form-specific intro, or submit consent),
    // use form prefix; for unique steps, use step.id directly.
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.am.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push(`### Amharic (አማርኛ) — Simple Words Mode (ቀላል ቃላት)`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'am', true);
    const text = rawText.replace(/"/g, '\\"');
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.am.simple.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push(`### English — Standard Mode`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'en', false);
    const text = rawText.replace(/"/g, '\\"');
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.en.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push(`### English — Simple Words Mode`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'en', true);
    const text = rawText.replace(/"/g, '\\"');
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.en.simple.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push(`### Afaan Oromoo — Standard Mode`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'om', false);
    const text = rawText.replace(/"/g, '\\"');
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.om.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push(`### Afaan Oromoo — Simple Words Mode (Jechoota Salphaa)`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'om', true);
    const text = rawText.replace(/"/g, '\\"');
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.om.simple.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push(`### Tigrinya (ትግርኛ) — Standard Mode`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'ti', false);
    const text = rawText.replace(/"/g, '\\"');
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.ti.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push(`### Tigrinya (ትግርኛ) — Simple Words Mode (ቀለልቲ ቃላት)`);
  lines.push('');
  schema.steps.forEach((step, idx) => {
    if (step.type === 'review') return;
    const rawText = getReadAloud(schema, step, idx, 'ti', true);
    const text = rawText.replace(/"/g, '\\"');
    const isShared = step.id === 'language' || step.id === 'submit';
    const prefix = isShared ? `${form.prefix}_` : '';
    const filename = `${prefix}${step.id}.ti.simple.mp3`;
    lines.push(`${filename} : "${text}"`);
    lines.push('');
  });

  lines.push('---', '');
}

writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
console.log(`Generated: ${OUT_FILE}`);
