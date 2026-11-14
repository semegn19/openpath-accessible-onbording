/**
 * Forms must not drift apart in richness.
 *
 * The job application was a thinner form than the onboarding one: no intro, no "why we ask this",
 * no simple-words layer, a two-key `ui` block and three missing error messages. Nothing broke —
 * which is exactly why it went unnoticed. This test measures each form against the richest one and
 * fails when a form falls behind, so "make the other form like that" is checked rather than hoped.
 *
 *   node tests/parity.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../schema/', import.meta.url));
const FORMS = ['savanna-onboard-v1', 'savanna-job-v1', 'employer-accommodations-v1'];
/** Forms being brought up to parity on purpose, with the reason. Remove an entry by fixing it.
 *  Empty as of 13 Nov: all three forms are measured against the richest one. */
const EXEMPT = {};

let fail = 0;
const ok = (cond, label, extra = '') => { if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };
const load = (id) => JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));
const forms = Object.fromEntries(FORMS.map((f) => [f, load(f)]));

/* ---------- what the richest form has, as a vocabulary ---------- */
const richest = forms[FORMS[0]];
const uiKeys = Object.keys(richest.ui ?? {});
for (const [id, s] of Object.entries(forms)) {
  const missing = uiKeys.filter((k) => !(s.ui ?? {})[k]);
  const why = EXEMPT[id] ? ` (exempt: ${EXEMPT[id]})` : '';
  if (EXEMPT[id]) console.log(`• ${id}: ${missing.length} ui key(s) missing — exempt, ${EXEMPT[id]}`);
  else ok(missing.length === 0, `${id}: every UI string the app can print is declared`, missing.join(', ') || 'none missing');
}

/* ---------- one button says one thing, whichever form you are on ----------
   The employer form's English read-aloud and mic labels were changed to "Listen" / "Speak answer"
   while the other two kept "Read the question" / "Speak your answer". Every form passed, because
   each was only ever checked against itself. A person moving between the three gets two different
   words on the same button. */
{
  const drift = [];
  const shared = ['readAloud', 'speak', 'choose', 'next', 'back', 'edit', 'optional', 'weHeard', 'accept', 'retry', 'typeInstead'];
  for (const key of shared) {
    for (const lang of ['am', 'en']) {
      const seen = new Map();
      for (const [id, s] of Object.entries(forms)) {
        const v = s.ui?.[key]?.[lang];
        if (!v) continue;
        if (!seen.has(v)) seen.set(v, []);
        seen.get(v).push(id);
      }
      if (seen.size > 1) {
        drift.push(`${key}.${lang}: ` + [...seen.entries()].map(([v, ids]) => `"${v}" (${ids.join(', ')})`).join(' vs '));
      }
    }
  }
  ok(drift.length === 0, 'the three forms print the same words on the same controls', drift.join(' | ') || 'all identical');
}

/* ---------- an error message for every rule the form can actually raise ---------- */
for (const [id, s] of Object.entries(forms)) {
  if (EXEMPT[id]) continue;
  const used = new Set();
  for (const st of s.steps) for (const r of st.validation ?? []) used.add(r.rule);
  const missing = [...used].filter((r) => !s.errors?.[r]);
  ok(missing.length === 0, `${id}: every validation rule has a written message`, missing.join(', ') || `${used.size} rules covered`);
  const halfWritten = Object.entries(s.errors ?? {}).filter(([, v]) => !v?.am || !v?.en).map(([k]) => k);
  ok(halfWritten.length === 0, `${id}: no error message is missing a language`, halfWritten.join(', '));
  const placeholders = Object.entries(s.errors ?? {})
    .flatMap(([k, v]) => [`${k}.am`, `${k}.en`].filter((_, i) => /\{\w+\}/.test(i ? v.en : v.am)))
    .filter((n) => !/minLength|maxLength|minValue|maxValue/.test(n));
  ok(placeholders.length === 0, `${id}: only the messages whose rules supply a number use {placeholders}`, placeholders.join(', ') || 'clean');
}

/* ---------- every screen explains itself ---------- */
for (const [id, s] of Object.entries(forms)) {
  if (EXEMPT[id]) continue;
  ok(Boolean(s.intro?.am && s.intro?.en), `${id}: there is a welcome line, in both languages`);
  ok(Boolean(s.introSimple?.am && s.introSimple?.en), `${id}: and a short form of it for simple words`);
  const silent = s.steps.filter((st) => st.type !== 'review' && st.type !== 'submit' && !st.hint && !st.body && !st.why);
  ok(silent.length === 0, `${id}: no screen asks for something without explaining why`, silent.map((x) => x.id).join(', ') || 'all explained');
  // Something that collects personal data owes the person a reason, not just a label.
  const unexplained = s.steps.filter((st) => st.pii && st.pii !== 'none' && !st.why && !st.hint && !st.body);
  ok(unexplained.length === 0, `${id}: every personal-data field says why it is asked`, unexplained.map((x) => x.id).join(', ') || 'all say why');
  const iconless = s.steps.filter((st) => !st.icon && st.type !== 'review' && st.type !== 'submit');
  ok(iconless.length === 0, `${id}: every question has an icon`, iconless.map((x) => x.id).join(', ') || 'all have one');
}

/* ---------- the simple-words layer reaches every long line ---------- */
for (const [id, s] of Object.entries(forms)) {
  if (EXEMPT[id]) continue;
  const longOptions = [];
  for (const st of s.steps) {
    for (const o of st.options ?? []) {
      // The threshold is where a label starts needing a second pass through the copy rules: longer
      // than a couple of words, i.e. a phrase rather than a word. "Questions in writing" (20) is
      // already plain; "I do not have any of these" (27) was not.
      if ((o.label?.en ?? '').length > 22 && !o.simple) longOptions.push(`${st.id}/${o.value}`);
    }
  }
  ok(longOptions.length === 0, `${id}: a long option label has a short twin`, longOptions.join(', ') || 'all long labels have one');
  // A "simple" twin that is word for word the default is not simpler — it is a second copy of the
  // same sentence, and a second clip to record and pay for.
  const pointlesslyIdentical = [];
  for (const st of s.steps) {
    for (const [simpleKey, baseKey] of [['simple', 'legend'], ['simple', 'label'], ['simpleHint', 'hint'], ['simpleBody', 'body'], ['simpleWhy', 'why']]) {
      const a = st[simpleKey], b = st[baseKey];
      if (!a || !b) continue;
      for (const lang of ['am', 'en']) {
        if (a[lang] && b[lang] && a[lang].trim() === b[lang].trim()) pointlesslyIdentical.push(`${st.id}.${simpleKey}.${lang}`);
      }
    }
    for (const o of st.options ?? []) {
      if (!o.simple) continue;
      for (const lang of ['am', 'en']) if (o.simple[lang] && o.label?.[lang] && o.simple[lang].trim() === o.label[lang].trim()) pointlesslyIdentical.push(`${st.id}/${o.value}.simple.${lang}`);
    }
  }
  ok(pointlesslyIdentical.length === 0, `${id}: every simple twin is actually different (no duplicate clips)`, pointlesslyIdentical.join(', ') || 'all differ');
  // A one-word heading needs no simple form — the rule is about long headings, not about every step.
  const missingSimpleHeading = s.steps.filter((st) => {
    if (st.type === 'review' || st.simple) return false;
    const heading = (st.legend ?? st.label)?.en ?? '';
    return heading.length > 20;
  });
  ok(missingSimpleHeading.length === 0, `${id}: every long heading has a simple one`, missingSimpleHeading.map((x) => x.id).join(', ') || 'all long headings have one');
}

/* ---------- the form says how reviewed its Amharic is ---------- */
for (const [id, s] of Object.entries(forms)) {
  if (EXEMPT[id]) continue;
  const statusOk = s.contentStatus === 'reviewed' || String(s.contentStatus ?? '').includes('unreviewed');
  ok(statusOk, `${id}: the review status is honest (reviewed, or something-unreviewed)`, String(s.contentStatus));
  ok(Boolean(s.contentReview?.am && s.contentReview?.en), `${id}: and it says who reviewed it, when`);
}

console.log(fail ? `\nFAIL — ${fail} problem(s)` : '\nPASS — 0 problem(s)');
process.exit(fail ? 1 : 0);
