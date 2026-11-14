// Error messages: no placeholder may ever reach the screen, in any language, in any form.
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.URL || 'http://127.0.0.1:5173/onboard';
// The expected number comes from the schema, never from the test: a hardcoded 3 would pass while
// the real rule said 2, which is exactly how a placeholder bug hides.
const onboard = JSON.parse(readFileSync(join('../schema', 'savanna-onboard-v1.json'), 'utf8'));
const NAME_MIN = onboard.steps.find((s) => s.id === 'name')?.validation?.find((r) => r.rule === 'minLength')?.value;
let fail = 0;
const ok = (c, label, extra = '') => { if (!c) fail++; console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };

/* ---------- 1. static: every placeholder has something to fill it ---------- */
const RULES_WITH_PARAMS = new Set(['minLength', 'maxLength', 'minValue', 'maxValue']);
const FORMS = ['savanna-onboard-v1', 'savanna-job-v1', 'employer-accommodations-v1'];
const placeholders = [];
for (const f of FORMS) {
  const d = JSON.parse(readFileSync(join('../schema', `${f}.json`), 'utf8'));
  for (const [rule, msg] of Object.entries(d.errors ?? {})) {
    for (const lang of ['am', 'en']) {
      const text = msg?.[lang] ?? '';
      if (!text) { placeholders.push({ f, rule, lang, problem: 'empty message' }); continue; }
      for (const m of text.matchAll(/\{(\w+)\}/g)) {
        placeholders.push({ f, rule, lang, token: m[1], problem: RULES_WITH_PARAMS.has(rule) ? null : `rule "${rule}" supplies no {${m[1]}}` });
      }
    }
  }
}
const bad = placeholders.filter((p) => p.problem);
ok(bad.length === 0, 'every {placeholder} in every error message belongs to a rule that fills it',
   bad.length ? bad.map((b) => `${b.f}/${b.rule}: ${b.problem}`).join('; ') : `${placeholders.length} placeholders, all fillable`);

/* ---------- 2. live: trigger the minLength error and read the words ---------- */
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });

await p.getByRole('radio', { name: /አማርኛ/ }).check();
await p.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await p.waitForTimeout(150);
await p.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await p.waitForTimeout(150);
await p.getByRole('radio', { name: /አይ፣ ራሴ|No, I will fill it myself/ }).check();
await p.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await p.waitForTimeout(200);

// one letter is under the minimum of three
await p.locator('input[type="text"]').first().fill('ሳ');
await p.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await p.waitForTimeout(250);
const msg = (await p.locator('.op-error').first().innerText().catch(() => '')).trim();
console.log('  error shown:', JSON.stringify(msg));
ok(msg.length > 0, 'the minLength error appears');
ok(!msg.includes('{') && !msg.includes('}'), 'no raw placeholder in the message', msg);
ok(msg.includes(String(NAME_MIN)), `the number (${NAME_MIN}) is actually in the message`, msg);

const summary = (await p.locator('.op-error-summary').innerText().catch(() => '')).trim();
ok(!summary.includes('{'), 'the error summary has no placeholder either', summary.replace(/\s+/g, ' ').slice(0, 60));

// and in English
await p.getByRole('button', { name: /English/ }).first().click();
await p.waitForTimeout(200);
await p.getByRole('button', { name: /Next/ }).first().click();
await p.waitForTimeout(250);
const msgEn = (await p.locator('.op-error').first().innerText().catch(() => '')).trim();
ok(new RegExp(`at least ${NAME_MIN}`).test(msgEn) && !msgEn.includes('{'), 'the English message interpolates too', msgEn);

await b.close();
console.log(fail ? `\nFAIL — ${fail} problem(s)` : '\nPASS — 0 problem(s)');
process.exit(fail ? 1 : 0);
