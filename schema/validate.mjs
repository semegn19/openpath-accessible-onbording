#!/usr/bin/env node
// schema/validate.mjs — no dependencies. `node schema/validate.mjs schema/*.json`
// Exit 0 clean, 1 on any error. Errors are printed as file:step: CODE message.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';

const INPUT_TYPES = new Set(['text', 'tel', 'email', 'number', 'textarea', 'select', 'radio', 'checkbox', 'file', 'date-ec-gc', 'language', 'statement']);
const STEP_TYPES = new Set([...INPUT_TYPES, 'review', 'submit']);
const CHOICE_TYPES = new Set(['radio', 'checkbox', 'language']);  // statement carries one consent option, not a choice
const RULES = new Set(['required', 'phone-et', 'email', 'minLength', 'maxLength', 'minValue', 'maxValue', 'exclusiveOption']);
const LANGS = ['am', 'en', 'om', 'ti'];

const errors = [];
const warn = [];
const err = (file, step, code, msg) => errors.push(`${file}:${step || '-'}: ${code} ${msg}`);
const warning = (file, step, code, msg) => warn.push(`${file}:${step || '-'}: ${code} ${msg}`);

function checkI18n(file, step, path, val, { required = true } = {}) {
  if (val === undefined || val === null) {
    if (required) err(file, step, 'E01', `missing localized text at ${path}`);
    return;
  }
  if (typeof val !== 'object' || Array.isArray(val)) {
    err(file, step, 'E01', `${path} must be an object {am,en}`);
    return;
  }
  for (const l of LANGS) {
    if (typeof val[l] !== 'string' || val[l].trim() === '') {
      err(file, step, 'E01', `${path}.${l} is empty`);
    }
  }
  const extra = Object.keys(val).filter((k) => !LANGS.includes(k));
  if (extra.length) warning(file, step, 'W01', `${path} has unknown language keys: ${extra.join(',')}`);
  const holes = (txt) => new Set([...(txt ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  const baseHoles = holes(val[LANGS[0]]);
  for (let i = 1; i < LANGS.length; i++) {
    const l = LANGS[i];
    const lHoles = holes(val[l]);
    for (const h of baseHoles) {
      if (!lHoles.has(h)) err(file, step, 'E27', `{${h}} is in .${LANGS[0]} but not .${l} at ${path}`);
    }
    for (const h of lHoles) {
      if (!baseHoles.has(h)) err(file, step, 'E27', `{${h}} is in .${l} but not .${LANGS[0]} at ${path}`);
    }
  }
}


/** Runtime copy: the strings the app prints that are not form questions.
 *  Shared by all three forms, so it lives once, in its own document. */
function validateRuntimeCopy(file, doc) {
  const docLangs = doc.langs || (file.includes('roha-') ? ['am', 'en'] : LANGS);
  const strings = doc.strings;
  if (!strings || typeof strings !== 'object' || Array.isArray(strings)) {
    err(file, null, 'E26', `strings must be an object of key -> {${docLangs.join(',')}}`);
    return;
  }
  const seenByLang = Object.fromEntries(docLangs.map((l) => [l, new Map()]));
  for (const [key, val] of Object.entries(strings)) {
    if (!/^[a-z][A-Za-z0-9]*(\.[a-zA-Z0-9]+)+$/.test(key)) {
      err(file, key, 'E26', 'key must look like "area.name" — dot-separated, lowerCamel segments');
    }
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      err(file, key, 'E26', `must be an object {${docLangs.join(',')}}`);
      continue;
    }
    for (const l of docLangs) {
      if (typeof val[l] !== 'string' || val[l].trim() === '') err(file, key, 'E26', `missing or empty .${l}`);
    }
    // A placeholder that exists in one language and not the other renders "{count}" to a user.
    const holes = (txt) => new Set([...(txt ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    const a = holes(val.am); const b = holes(val.en);
    for (const h of a) if (!b.has(h)) err(file, key, 'E27', `{${h}} is in .am but not .en`);
    for (const h of b) if (!a.has(h)) err(file, key, 'E27', `{${h}} is in .en but not .am`);
    // Identical sentences under two keys become two clips and two things to keep in step.
    for (const l of docLangs) {
      const t = val[l]?.trim();
      if (!t) continue;
      const seen = seenByLang[l];
      if (seen.has(t)) warning(file, key, 'W12', `.${l} is identical to ${seen.get(t)}`);
      else seen.set(t, key);
    }
  }
  console.log(`${file.padEnd(42)} ${Object.keys(strings).length} runtime string(s)`);
}

const files = process.argv.slice(2).flatMap((p) => {
  if (!p.includes('*') && !p.includes('?')) return [p];
  const d = dirname(p);
  const re = new RegExp('^' + basename(p).replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  try {
    return readdirSync(d).filter((f) => re.test(f)).map((f) => join(d, f));
  } catch {
    return [p];
  }
});

for (const file of files) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    err(file, null, 'E00', `cannot read file: ${e.message}`);
    continue;
  }
  let s;
  try {
    s = JSON.parse(raw);
  } catch (e) {
    err(file, null, 'E00', `invalid JSON: ${e.message}`);
    continue;
  }

  if (s.kind === 'runtime-copy') { validateRuntimeCopy(file, s); continue; }
  if (s.kind === 'jobs-catalog') { continue; }

  for (const k of ['id', 'version', 'defaultLang', 'langs', 'title', 'steps']) {
    if (s[k] === undefined) err(file, null, 'E02', `missing top-level "${k}"`);
  }
  if (!Array.isArray(s.steps) || s.steps.length === 0) {
    err(file, null, 'E02', 'steps must be a non-empty array');
    continue;
  }
  if (s.defaultLang && !LANGS.includes(s.defaultLang)) err(file, null, 'E03', `defaultLang "${s.defaultLang}" not in ${LANGS}`);
  checkI18n(file, null, 'title', s.title);
  if (s.intro) checkI18n(file, null, 'intro', s.intro, { required: false });
  // The simple-words intro is optional, but when it exists every language must have it —
  // otherwise the simplest screen falls back to the long paragraph in one language only.
  if (s.introSimple) checkI18n(file, null, 'introSimple', s.introSimple, { required: false });
  if (s.contentStatus !== 'reviewed' && !String(s.contentStatus || '').includes('unreviewed')) {
    warning(file, null, 'W02', 'contentStatus should be "reviewed" or contain "unreviewed" while Amharic is draft');
  }

  const ids = new Map();
  s.steps.forEach((st, i) => {
    const step = st.id || `#${i}`;
    if (!st.id) err(file, step, 'E04', 'step has no id');
    if (ids.has(st.id)) err(file, step, 'E04', `duplicate step id (also at index ${ids.get(st.id)})`);
    ids.set(st.id, i);

    if (!STEP_TYPES.has(st.type)) err(file, step, 'E05', `unknown type "${st.type}"`);
    // one question per screen, enforced structurally
    if (st.fields) err(file, step, 'E06', 'step has "fields[]" — one question per screen means one step per question');
    if (st.type === 'date-ec-gc' && s.calendar === undefined) err(file, step, 'E06', 'date step requires top-level "calendar"');

    const labelKey = CHOICE_TYPES.has(st.type) ? 'legend' : 'label';
    checkI18n(file, step, labelKey, st[CHOICE_TYPES.has(st.type) ? 'legend' : 'label']);
    if (st.label && CHOICE_TYPES.has(st.type)) checkI18n(file, step, 'label', st.label, { required: false });
    for (const opt of ['hint', 'why', 'simple', 'simpleHint', 'simpleWhy', 'simpleBody', 'body', 'submitLabel']) {
      if (st[opt] !== undefined) checkI18n(file, step, opt, st[opt], { required: false });
    }
    // Option labels have a simple-words form too; a missing translation there leaves one language
    // reading the long label while the other reads the short one, with nothing failing.
    for (const o of st.options ?? []) {
      if (o.simple !== undefined) checkI18n(file, step, `option[${o.value}].simple`, o.simple, { required: false });
    }

    if (st.type === 'language') {
      if (!Array.isArray(st.options) || st.options.length < 2) err(file, step, 'E07', 'language step needs at least 2 options');
      else for (const o of st.options) {
        if (!s.langs?.includes(o.value)) err(file, step, 'E21', `language option "${o.value}" is not in the schema langs`);
        checkI18n(file, step, `option[${o.value}].label`, o.label);
      }
      if (s.steps[0]?.id !== st.id) warning(file, step, 'W08', 'language step should be first — ask language before anything else');
    }
    if (st.type === 'select') {
      if (!Array.isArray(st.options) || st.options.length < 2) err(file, step, 'E07', 'select must have at least 2 options');
      else for (const o of st.options) checkI18n(file, step, `option[${o.value}].label`, o.label);
    }
    if (st.type === 'file') {
      if (!st.accept) warning(file, step, 'W06', 'file step has no "accept" — set one (e.g. "image/*,application/pdf")');
      if (st.required === true) err(file, step, 'E20', 'file must never be required — the brief forbids blocking on documents');
    }
    if (st.type === 'number' && st.inputmode !== 'numeric') warning(file, step, 'W07', 'number step should set inputmode:"numeric"');
    if (st.type === 'statement') {
      if (!st.body) err(file, step, 'E07', 'statement step must have a "body" explaining what will happen');
      if (!Array.isArray(st.options) || st.options.length < 1) err(file, step, 'E07', 'statement step must have at least 1 consent option');
      else for (const o of st.options) checkI18n(file, step, `option[${o.value}].label`, o.label);
    } else if (CHOICE_TYPES.has(st.type)) {
      if (!Array.isArray(st.options) || st.options.length < 2) {
        err(file, step, 'E07', `${st.type} must have at least 2 options`);
      } else {
        const vals = new Set();
        for (const o of st.options) {
          if (!o.value) err(file, step, 'E07', 'option without value');
          if (vals.has(o.value)) err(file, step, 'E07', `duplicate option value "${o.value}"`);
          vals.add(o.value);
          checkI18n(file, step, `option[${o.value}].label`, o.label);
          if (o.exclusive && st.validation?.some((v) => v.rule === 'exclusiveOption')) {
            const rule = st.validation.find((v) => v.rule === 'exclusiveOption');
            if (rule.option !== o.value) err(file, step, 'E08', `exclusiveOption names "${rule.option}" but exclusive option is "${o.value}"`);
          }
        }
        if (st.validation?.some((v) => v.rule === 'exclusiveOption') && !st.options.some((o) => o.exclusive)) {
          err(file, step, 'E08', 'exclusiveOption rule present but no option is marked exclusive');
        }
      }
    } else if (st.options) {
      // submit / statement consent checkboxes
      for (const o of st.options) checkI18n(file, step, `option[${o.value}].label`, o.label);
    }

    // conditional routing must point backwards only
    if (st.showIf) for (const cond of (Array.isArray(st.showIf) ? st.showIf : [st.showIf])) {
      if (!cond.step) err(file, step, 'E09', 'showIf.step missing');
      else if (!ids.has(cond.step)) err(file, step, 'E09', `showIf.step "${cond.step}" does not exist before this step`);
      if (!Array.isArray(cond.in) || cond.in.length === 0) err(file, step, 'E09', 'showIf.in must be a non-empty array');
      // A typo in here ("referal") hides a step for ever, silently. Check against real options.
      const dep = s.steps.find((x) => x.id === cond.step);
      if (dep && Array.isArray(cond.in)) {
        const allowed = new Set((dep.options ?? []).map((o) => o.value));
        for (const v of cond.in) {
          if (allowed.size && !allowed.has(v)) err(file, step, 'E09', `showIf.in "${v}" is not an option of "${dep.id}" (has: ${[...allowed].join(', ')})`);
        }
      }
    }

    // privacy: local-only fields must never be required, and must be sensitive
    if (st.localOnly === true) {
      if (st.required === true) err(file, step, 'E10', 'localOnly field cannot be required — it would block a user whose data we never send');
      if (st.pii !== 'sensitive') err(file, step, 'E10', 'localOnly field must be pii:"sensitive"');
    }
    if (INPUT_TYPES.has(st.type) && !['none', 'personal', 'sensitive'].includes(st.pii)) {
      err(file, step, 'E11', `pii must be none|personal|sensitive (got "${st.pii}")`);
    }
    if (!INPUT_TYPES.has(st.type) && st.pii && !['none', 'personal', 'sensitive'].includes(st.pii)) {
      err(file, step, 'E11', `pii must be none|personal|sensitive (got "${st.pii}")`);
    }

    // the co-designer gate: everything asked must be reachable by voice and by listening
    if (INPUT_TYPES.has(st.type) && st.type !== 'statement' && st.type !== 'language') {
      if (st.type !== 'file' && st.voice !== true) err(file, step, 'E12', 'voice:true missing — brief requires voice input on every field');
      if (st.readAloud !== true) err(file, step, 'E13', 'readAloud:true missing — brief requires read-aloud questions');
    }

    // A dropdown cannot show an option's icon, and this form puts an icon on every option so a
    // low-literacy reader can scan the choices instead of reading them. `job-category` was a
    // `select` with six icons that rendered as none, in a control that also hid all six choices
    // behind one tap. If the options carry icons, the widget has to be one that can draw them.
    if (st.type === 'select' && (st.options ?? []).some((o) => o.icon)) {
      err(file, step, 'E25', 'a "select" dropdown cannot show option icons — use type "radio"');
    }
    // The voice path matches what someone says against a list of option labels. A dropdown used
    // to hand the transcript nowhere, so a spoken answer was accepted and then thrown away.
    if (st.type === 'select' && st.voice === true) {
      warning(file, step, 'W11', 'voice on a dropdown has no option list to match against — a radio group is the voice-answerable choice widget');
    }

    // A transcript must never look like consent, and a consent body must be readable aloud.
    if (st.type === 'statement' || st.type === 'submit') {
      if (st.voice === true) err(file, step, 'E22', 'voice must not be true on a consent screen — dictation must never fill a consent box');
      if (st.readAloud !== true) err(file, step, 'E22', 'readAloud:true missing on a consent screen — the body must be hearable');
    }

    // data flow: sharing is a claim about where personal data goes, so it is checked too
    if (st.sharing) {
      if (st.localOnly === true) err(file, step, 'E23', 'a localOnly step cannot declare sharing — the data never leaves');
      if (!['personal', 'sensitive'].includes(st.pii)) err(file, step, 'E23', 'a step with sharing must be pii:personal or sensitive');
      if (!Array.isArray(st.sharing.fields) || st.sharing.fields.length === 0) err(file, step, 'E23', 'sharing.fields must name what is shared');
      if (!st.sharing.recipient) err(file, step, 'E23', 'sharing.recipient missing — say who receives it');
      // A step that IS shared must not tell the person that only they (and the programme) see it.
      // This exact contradiction shipped in the job form: the hint said "shown to the employer"
      // and the why, one line below, said "only you and the programme team see this".
      // The pattern is deliberately narrow — "only your name and phone number" is a true and
      // common sentence about sharing, and must not trip it.
      const claims = (obj) => ['am', 'en'].map((l) => obj?.[l]).filter(Boolean);
      for (const [key, val] of Object.entries({ hint: st.hint, simpleHint: st.simpleHint, why: st.why, simpleWhy: st.simpleWhy, body: st.body, simpleBody: st.simpleBody })) {
        for (const text of claims(val)) {
          if (/only you and/i.test(text) || /እርስዎና[^።]{0,40}ብቻ/.test(text)) {
            err(file, step, 'E24', `${key} claims only the person sees this, but the step declares sharing with "${st.sharing.recipient}"`);
          }
        }
      }
      if (st.sharing.recipient === 'partner' && !s.partner) {
        warning(file, step, 'W09', 'sharing.recipient is "partner" but the schema has no top-level "partner" block naming it');
      }
    }

    // A preferences step whose options apply nothing changes no behaviour. This is how the
    // `applies` wiring was silently lost once already.
    if (st.localOnly === true && ['checkbox', 'radio'].includes(st.type)) {
      const applies = (st.options ?? []).filter((o) => o.applies);
      if (!applies.length) {
        warning(file, step, 'W10', 'localOnly choice step has no option with "applies" — choosing these changes nothing');
      }
      for (const o of applies) {
        if (!['readAloud', 'big', 'simple'].includes(o.applies)) {
          err(file, step, 'E24', `option "${o.value}" applies "${o.applies}", which the renderer does not implement`);
        }
      }
    }

    // SC 1.3.5 Identify Input Purpose: a phone or email field is exactly what a browser can fill
    // for someone who cannot easily type it. Asking for it by hand is a fail, not a gap.
    if (['tel', 'email'].includes(st.type) && !st.autocomplete) {
      warning(file, step, 'W11', `type "${st.type}" has no "autocomplete" token — WCAG 1.3.5 expects one (e.g. "tel", "email")`);
    }
    if (st.autocomplete !== undefined && typeof st.autocomplete !== 'string') {
      err(file, step, 'E25', '"autocomplete" must be a string HTML autocomplete token');
    }

    // validation vocabulary
    if (st.validation) {
      if (!Array.isArray(st.validation)) err(file, step, 'E14', 'validation must be an array');
      else for (const v of st.validation) {
        if (!RULES.has(v.rule)) err(file, step, 'E14', `unknown rule "${v.rule}"`);
        if (['minLength', 'maxLength'].includes(v.rule) && typeof v.value !== 'number') {
          err(file, step, 'E14', `rule ${v.rule} needs a numeric "value"`);
        }
        const codeName = String(v.rule).replace(/-et$/, '');
        const hasCode =
          s.errors && Object.keys(s.errors).some((k) => k === v.rule || k === codeName);
        if (!hasCode) err(file, step, 'E15', `no error message for rule "${v.rule}"`);
      }
    }
    if (st.required === true && !st.validation?.some((v) => v.rule === 'required')) {
      err(file, step, 'E16', 'required:true but no {"rule":"required"} in validation');
    }

    // phone/tel ergonomics
    if (st.type === 'tel') {
      if (st.inputmode !== 'tel') err(file, step, 'E17', 'tel step must set inputmode:"tel"');
      if (!st.validation?.some((v) => v.rule === 'phone-et')) warning(file, step, 'W03', 'tel step without phone-et validation');
    }
    if (st.inputmode && !['tel', 'numeric', 'email', 'text'].includes(st.inputmode)) {
      err(file, step, 'E17', `unknown inputmode "${st.inputmode}"`);
    }

    // simple-mode support
    // A heading of one or two words needs no simpler twin — the fallback IS the simple version.
    // The same threshold is used by tests/parity.mjs, so the two cannot disagree.
    const headingEn = (st.label?.en ?? st.legend?.en ?? '');
    if (INPUT_TYPES.has(st.type) && st.type !== 'statement' && !st.simple && headingEn.length > 20) {
      warning(file, step, 'W04', 'no "simple" label — SimpleMode will fall back to the full label');
    }
    if (INPUT_TYPES.has(st.type) && !st.icon) warning(file, step, 'W05', 'no icon — low-literacy path loses its visual cue');
  });

  // structural order: exactly one review, one submit, submit last
  const types = s.steps.map((x) => x.type);
  const reviews = types.filter((t) => t === 'review').length;
  const submits = types.filter((t) => t === 'submit').length;
  if (reviews !== 1) err(file, null, 'E18', `expected exactly 1 review step, found ${reviews}`);
  if (submits !== 1) err(file, null, 'E19', `expected exactly 1 submit step, found ${submits}`);
  if (types[types.length - 1] !== 'submit') err(file, null, 'E19', 'submit must be the last step');
  if (reviews === 1 && submits === 1 && types.lastIndexOf('review') > types.lastIndexOf('submit')) {
    err(file, null, 'E18', 'review must come before submit');
  }

  const questions = s.steps.filter((x) => INPUT_TYPES.has(x.type) && x.type !== 'statement').length;
  console.log(`${file.padEnd(42)} ${s.steps.length} steps, ${questions} questions, ${s.langs?.join('/')}`);
}

for (const w of warn) console.warn('  warn  ' + w);
for (const e of errors) console.error('  ERROR ' + e);
console.log(`\n${errors.length} error(s), ${warn.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
