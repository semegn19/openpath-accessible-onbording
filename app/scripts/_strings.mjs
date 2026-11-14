/**
 * The closed set of spoken strings, derived from the schemas.
 *
 * Shared by `npm run audio` (which indexes clips) and `npm run audio:generate` (which creates
 * them), so the two can never disagree about what needs a voice. If they disagreed, the
 * generator would produce files the player never looks for — the most expensive kind of bug.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FORMS = ['savanna-onboard-v1', 'savanna-job-v1', 'employer-accommodations-v1'];
export const LANGS = ['am', 'en'];

/** FNV-1a 32-bit. Identical to clipName() in src/audio.ts — change both or neither. */
export const hash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

export const clipId = (lang, text) => hash(`${lang}|${text.trim()}`);

/** Every static string that could be spoken: { form, where, lang, text, id } */
export function collect(schemaDir) {
  const dir = schemaDir ?? new URL('../../schema/', import.meta.url).pathname;
  const out = [];
  const add = (form, where, obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const lang of LANGS) {
      const text = obj[lang];
      if (typeof text === 'string' && text.trim()) {
        out.push({ form, where, lang, text: text.trim(), id: clipId(lang, text.trim()) });
      }
    }
  };
  for (const form of FORMS) {
    let schema;
    try { schema = JSON.parse(readFileSync(join(dir, `${form}.json`), 'utf8')); } catch { continue; }
    add(form, 'intro', schema.intro);
    // The simple-words screen is read aloud too, so its shorter intro needs its own clip —
    // otherwise turning simple words on leaves read-aloud speaking the long paragraph.
    add(form, 'intro:simple', schema.introSimple);
    for (const step of schema.steps) {
      if (step.type === 'review') continue;
      add(form, `${step.id}:question`, step.legend ?? step.label);
      add(form, `${step.id}:question`, step.simple);
      add(form, `${step.id}:hint`, step.hint);
      add(form, `${step.id}:hint:simple`, step.simpleHint);
      add(form, `${step.id}:body`, step.body);
      add(form, `${step.id}:body:simple`, step.simpleBody);
      add(form, `${step.id}:why:simple`, step.simpleWhy);
      for (const opt of step.options ?? []) {
        add(form, `${step.id}:option:${opt.value}`, opt.label);
        add(form, `${step.id}:option:${opt.value}:simple`, opt.simple);
      }
    }
  }
  return out;
}
