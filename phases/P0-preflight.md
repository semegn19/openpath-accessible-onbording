# P0 — Pre-flight: Detailed Implementation Plan

| | |
|---|---|
| **Phase** | P0 of 8 · **1 working week** (calendar week −1 to 0, i.e. immediately before the hackathon) |
| **Parent plan** | [`../openpath-build-plan.md`](../openpath-build-plan.md) v1.1 — this document implements §15 and ADR set-up |
| **Audience** | A coding agent executing **Track C**; a human lead executing **Track H** |
| **Effort** | Track C ≈ **8.5 eng-days** · Track H ≈ 13–16 human hours |
| **Product features shipped** | **Zero.** P0 is deliberately feature-free |

---

## 0. Read this first

### 0.1 What this phase is

P0 exists to ensure that **nothing in P1 (hackathon) or P2 (foundation) is blocked by something P0 could have started.** There are two failure modes it prevents:

1. *"We can't build because we're waiting on X"* — hosting quotes, auditor bookings, an Amharic editor, devices, API keys.
2. *"We built on an unverified assumption"* — a calendar converter nobody checked, a schema format that can't express conditional branching, a design token set that fails contrast.

P0 therefore produces **two tracks**:

| Track | Who | Nature |
|---|---|---|
| **Track C — Code & repo artifacts** | The coding agent | Everything in §3. Fully specified, testable, no external accounts needed |
| **Track H — Human & procurement** | The human lead | Everything in §6. Bookings, accounts, contracts, purchases. **The agent must not attempt these** |

### 0.2 Hard scope boundary

> **P0 ships no product features.** If you find yourself writing a form component, a speech adapter, a React hook that renders something, or any UI — stop. That is P2 work.
>
> The output of P0 is: a green, empty-but-correct monorepo; a machine-checkable schema and its linter; the fixture harnesses that P2 will fill; governance documents; and a procurement register.

### 0.3 Three things you must not fabricate

These are the highest-risk items in the phase. Getting them wrong is worse than leaving them visibly unfinished:

| Domain | The rule | Why |
|---|---|---|
| **Ethiopian ⇄ Gregorian dates** | **Do not hand-roll the conversion.** Wire the verified library pair (C6) behind an adapter with a range guard, and never edit a fixture row to force agreement. | A hand-rolled converter that looks right is a one-day error in one year in four — invisible to any single-year test, and a data-integrity bug in an official record. The library pair is already cross-validated on 2,399 dates. |
| **Ethiopian administrative data** (regions, zones, woredas, kebeles) | Import from OCHA HDX COD-AB with provenance metadata; ship a **3-record sample marked `synthetic: true`** alongside the importer. Never type names from memory. | Inventing woreda names produces a form that looks complete and rejects real citizens. The real dataset is stale and internally conflicting anyway (C6.7). |
| **Amharic UI strings** | Seed the `am` locale with the same key set as `en`, value `""`, and `_meta.status: "untranslated"`. Do not machine-translate, do not approximate orthography. | Human-reviewed copy is a §6 non-negotiable. Digit words (C6.3) are the one exception, and they ship with `reviewStatus: "unreviewed"`. |

### 0.4 Assumptions (override only with a written instruction)

| Assumption | Value |
|---|---|
| Repo state | **Empty** (confirmed) — you scaffold everything |
| Environment | Node 22 LTS, pnpm 9, **network available**, can install deps and run Chromium |
| CI | **GitHub Actions**, `ubuntu-latest` |
| Licence | **Apache-2.0**; npm scope **`@openpath`** |
| Language | Code, comments, docs, commit messages in **English**; Amharic only in content files |
| Package manager | pnpm workspaces + Turborepo |
| `packageManager` pin | `pnpm@9.12.0` (use `corepack enable`) |
| TypeScript | 5.6+, `strict`, ESM-first |
| Branching | Trunk-based; `main` protected; short-lived branches |

---

## 1. Deliverables at a glance

| ID | Artifact | Track | Verified by |
|---|---|---|---|
| C1 | Monorepo scaffold + toolchain (pnpm, turbo, tsconfig, eslint, prettier) | C | `pnpm build lint typecheck test` all exit 0 |
| C2 | 9 package skeletons with enforced dependency boundaries | C | `pnpm verify:boundaries` (incl. a negative test that must fail) |
| C3 | CI pipeline + PR template + CODEOWNERS | C | `pnpm ci` runs the same gates locally |
| C4 | Schema types + zod + JSON Schema export + `schema-lint` (10 rules) + demo schema | C | 10 bad fixtures each rejected with the right code |
| C5 | String catalogue (en/am) + `strings-lint` + i18n runtime | C | Missing/placeholder rules fire; am coverage reported |
| C6 | Ethiopian module: verified calendar adapter (library pair + 60 vectors), digit words (unreviewed), HDX address importer + synthetic sample | C | `pnpm ethiopia:verify` reports 60/60 agreement and enforces the range guard |
| C7 | Design tokens + `.op-root`/`@layer` CSS skeleton + contrast validator | C | `pnpm tokens:contrast` green; bad pair fixture detected |
| C8 | ADR-0001…0014 + governance docs (contributing, host contract, device lab, a11y statement) | C | `pnpm docs:lint` requires sections |
| C9 | Baseline measurement kit (protocol, consent script, scoring script) | C | `pnpm test` covers median/percentage math |
| C11 | Savanna theme tokens (audited) + host-collision fixture scaffold | C | `pnpm tokens:contrast --theme=savanna` green for both themes |
| C10 | Procurement & bookings register + budget file | C | `pnpm ops:lint` validates rows |
| H1–H13 | Bookings, accounts, contracts, devices, baseline sessions | **H** | Human sign-off in `ops/preflight-register.csv` |

---

## 2. Target repository structure

Create exactly this. Nothing more in P0 (no `components/`, no `speech/` implementation, no demo app UI):

```
openpath/
├── .github/
│   ├── workflows/ci.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── .changeset/config.json
├── .editorconfig
├── .gitignore                      # must include .env*, node_modules, dist, coverage, playwright-report
├── .nvmrc                          # 22
├── LICENSE                         # Apache-2.0 full text
├── README.md
├── package.json                    # root, private
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── tsconfig.json                   # solution file with project references
├── eslint.config.js                # flat config
├── .prettierrc.json
├── dependency-cruiser.config.cjs
├── .size-limit.json                # budgets declared, nothing to measure yet
├── apps/
│   ├── server/                     # skeleton only: package.json + src/index.ts exporting `createServer` stub
│   ├── demo/                       # skeleton only + host-bootstrap/index.html (fixture scaffold, no components)
│   └── docs/                       # skeleton only: package.json + README
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # explicit named exports only
│   │       ├── schema/  (types.ts, zod.ts, json-schema.ts, registry.ts)
│   │       └── i18n/    (types.ts, t.ts)
│   ├── ethiopia/
│   │   ├── package.json                    # deps: ethiopian-calendar-date-converter; devDeps: kenat
│   │   ├── tsconfig.json
│   │   ├── fixtures/
│   │   │   ├── ec-gc.vectors.csv           # COPY of phases/assets/ec-gc.vectors.csv
│   │   │   ├── ec-gc.vectors.README.md     # COPY of the provenance notes
│   │   │   ├── am-digits.json
│   │   │   └── address.sample.json         # synthetic: true, 3 records
│   │   └── src/
│   │       ├── index.ts
│   │       ├── calendar/ (adapter.ts, range.ts, types.ts, errors.ts)
│   │       ├── numbers/  (fidel.ts)
│   │       └── address/   (types.ts, loader.ts, provenance.ts)
│   ├── speech/                     # skeleton: package.json + src/index.ts exporting `SpeechProviderAdapter` type only
│   ├── react/                      # skeleton: package.json + src/styles/{layers,tokens,base}.css + themes/savanna.css
│   ├── wc/                         # skeleton: package.json + src/index.ts (empty custom element, not registered)
│   └── testing/                    # skeleton: package.json + src/index.ts exporting test config helpers
├── content/
│   ├── strings/en.json
│   ├── strings/am.json
│   └── glossary.json               # the civic/disability term list (§6), 10 seed terms, status: draft
├── schemas/
│   ├── savanna-onboarding-v1.json
│   └── fixtures/bad/               # 10 files, one per schema-lint rule
├── scripts/
│   ├── schema-lint.ts
│   ├── strings-lint.ts
│   ├── tokens-contrast.ts
│   ├── ethiopia-verify.ts
│   ├── generate-ec-vectors.ts              # dev-only cross-check generator (kenat + melaku-z)
│   ├── import-admin.ts                     # HDX COD-AB importer → JSON + provenance
│   ├── count-components.ts
│   ├── docs-lint.ts
│   ├── ops-lint.ts
│   ├── score-baseline.ts
│   ├── fetch-host-fixture.sh                # shallow-clones Savanna-static-pages at a pinned commit
│   ├── verify-boundaries.ts
│   └── fonts.ts                    # prints the Noto Sans Ethiopic subsetting TODO (no-op in P0)
├── docs/
│   ├── a11y/savanna-theme-contrast.md      # COPY of phases/assets/savanna-theme-contrast.md
│   ├── adr/0000-template.md … 0014-*.md
│   ├── CONTRIBUTING.md
│   ├── host-contract.md
│   ├── device-lab.md
│   ├── a11y-statement-template.md
│   ├── conformance-evidence.md
│   ├── decisions/ec-verification.md       # supersedes ec-epoch.md: records the library decision + sign-off checklist
│   └── research/baseline-protocol.md
├── ops/
│   ├── README.md
│   ├── preflight-register.csv
│   └── budget.csv
└── templates/
    ├── baseline-results.csv
    └── P0-report.md               # filled in by the agent at the end (§7)
```

---

## 3. Track C — work packages

Work in the order given. **Do not skip a checkpoint** (§4): if checkpoint 1 fails, fixing it before writing C4 saves you an hour of rework.

### C1 · Monorepo scaffold and toolchain — 1.0 d

**Objective:** a clean clone installs, builds, lints, typechecks and tests with zero warnings.

**Files:** as listed in §2 for root config, plus `README.md`.

**Requirements**

1. `packageManager: "pnpm@9.12.0"`, `engines.node: ">=22"`, `private: true`.
2. Root `package.json` scripts — exactly these names (other tooling depends on them):

```json
{
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "depcruise": "depcruise --config dependency-cruiser.config.cjs packages apps",
    "verify:boundaries": "tsx scripts/verify-boundaries.ts",
    "schema:lint": "tsx scripts/schema-lint.ts",
    "strings:lint": "tsx scripts/strings-lint.ts",
    "tokens:contrast": "tsx scripts/tokens-contrast.ts",
    "ethiopia:verify": "tsx scripts/ethiopia-verify.ts",
    "count:components": "tsx scripts/count-components.ts",
    "docs:lint": "tsx scripts/docs-lint.ts",
    "ops:lint": "tsx scripts/ops-lint.ts",
    "verify": "pnpm run verify:boundaries && pnpm run schema:lint && pnpm run strings:lint && pnpm run tokens:contrast && pnpm run ethiopia:verify && pnpm run count:components && pnpm run docs:lint && pnpm run ops:lint",
    "ci": "pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm verify"
  }
}
```

3. `tsconfig.base.json` must enable, at minimum: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `target: "ES2022"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `declaration: true`, `skipLibCheck: false`.
4. `turbo.json`: tasks `build` (dependsOn `^build`, outputs `dist/**`), `lint`, `typecheck` (dependsOn `^build`), `test` (dependsOn `^build`, outputs `coverage/**`).
5. ESLint flat config: TypeScript ESLint recommended-type-checked + `eslint-plugin-import` + `eslint-plugin-jsx-a11y` (config ready, no JSX yet) + Prettier compat. **Zero warnings allowed** (`--max-warnings=0`).
6. `.size-limit.json` declares the §4.11 budgets with the artifact paths that will exist later; add `"brotli": true`. Add script `"size": "size-limit"` but **do not** wire it into `ci` yet (nothing is built).
7. `README.md`: 40 lines max — what OpenPath is (2 sentences), repo layout table, `pnpm install && pnpm ci` quickstart, pointer to the parent plan and `docs/CONTRIBUTING.md`.

**Acceptance**

```bash
corepack enable && pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # all exit 0
```

**Guardrails:** no `postinstall` scripts; no dependency outside this list without noting it in the report — `typescript tsx vitest turbo eslint prettier @typescript-eslint/* eslint-plugin-import eslint-plugin-jsx-a11y eslint-config-prettier dependency-cruiser size-limit @size-limit/preset-small-lib zod`.

---

### C2 · Package skeletons and dependency boundaries — 0.75 d

**Objective:** the nine packages/apps exist, export typed stubs, and **cannot** violate the architectural boundaries of §4.1.

**Requirements**

1. Every package: `package.json` with `name`, `version: "0.0.2"`, `private: true` for apps, `"type": "module"`, `exports` map pointing at `dist`, scripts `build` (tsup or tsc), `lint`, `typecheck`, `test`; `tsconfig.json` extending base with `references` to its deps.
2. `src/index.ts` in each package exports only the stub types named in §2. No implementation. `packages/react/src/index.ts` exports nothing yet (only the CSS files exist).
3. **Boundary rules** in `dependency-cruiser.config.cjs`, each as a `forbidden` rule with a distinct name:

| Rule name | Forbids |
|---|---|
| `core-no-react` | any import of `react`, `react-dom`, `preact` from `packages/core/**` |
| `core-no-dom` | any import from `packages/core/**` of DOM-only modules (see list in config comment: `window`, `document`, `localStorage`, `indexedDB` references in source) |
| `ethiopia-no-react` | same, for `packages/ethiopia/**` |
| `no-app-imports` | any `packages/**` importing from `apps/**` |
| `no-internal-deep-import` | any import resolving into another package's `src/` (must go through package entry points) |
| `no-circular` | circular dependencies across packages |
| `speech-no-react` | `packages/speech/**` must not import React (it is UI-agnostic) |

4. `scripts/verify-boundaries.ts` — **the negative test**: writes a temporary file `packages/core/src/__boundary_probe.ts` containing `import 'react';`, runs depcruise, asserts it **fails** with rule `core-no-react`, then deletes the probe. If the probe *passes*, the script exits 1 with the message `BOUNDARY RULES ARE NOT ACTIVE`.

**Acceptance**

```bash
pnpm build && pnpm depcruise && pnpm verify:boundaries   # exit 0, and the probe is reported as caught
```

**Guardrails:** do not add React as a dependency of `core` "for types". If `core` needs a UI-adjacent type, define a structural type locally.

---

### C3 · CI pipeline and PR hygiene — 0.75 d

**Objective:** CI enforces what a reviewer would otherwise have to remember.

**Files:** `.github/workflows/ci.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`.

**Requirements**

1. `ci.yml` — triggers on `pull_request` and `push` to `main`; Node 22 with pnpm cache; `concurrency` cancel-in-progress; jobs:

| Job | Steps |
|---|---|
| `static` | install → `pnpm lint` → `pnpm typecheck` → `pnpm docs:lint` → `pnpm ops:lint` |
| `test` | install → `pnpm build` → `pnpm test` → `pnpm verify` (schema/strings/tokens/ethiopia/count/boundaries) |
| `a11y-smoke` | install → `pnpm build` → `pnpm exec playwright install --with-deps chromium` → `pnpm test:a11y` *(job is allowed to be skipped in P0: no components exist. Add the job but guard it with `if: hashFiles('packages/react/src/components/**') != ''` and document that)* |

2. `PULL_REQUEST_TEMPLATE.md` — sections: **What & why**, **Accessibility** (checkbox list condensed from parent plan §5.2: native element used, programmatic name = visible label, keyboard-operable, AT-verified with NVDA *and* TalkBack or "N/A — no UI", axe-clean, 48px targets, 400% zoom, forced-colors), **Tests added**, **Docs updated**, **Screenshots/AT log**.
3. `CODEOWNERS`: `packages/core/ @<core-owner>`, `schemas/ @<core-owner>`, `content/ @<content-owner>`, `docs/adr/ @<lead>`. Use placeholder handles in a comment block if real handles are unknown, and note it in the report.

**Acceptance**

```bash
pnpm ci    # green locally
# YAML sanity:
node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')" && echo ok
```

**Guardrails:** no secrets, no deploy steps, no third-party actions beyond `actions/checkout`, `pnpm/action-setup`, `actions/setup-node`, `actions/cache` (pin major versions).

---

### C4 · Schema v0, `schema-lint`, and the demo schema — 1.5 d

**Objective:** the canonical form schema exists as executable types, can be serialised to JSON Schema, and **ten classes of authoring mistake are machine-caught**.

**C4.1 Types and validation — `packages/core/src/schema/`**

- `types.ts`: implement the `OpenPathSchema` / `Chapter` / `Step` / `Field` interfaces from parent plan §4.2. `Field` must include: `id, type, label, hint?, instructions?, optional?, validation?, prefill?, readAloud?, ethsl? (reserved), easyRead?, conditional?, pii, hideInReview?, noAudioReason?`.
- `zod.ts`: a zod schema mirroring the types, with `field.type` as a discriminated union of exactly: `text | email | tel | number | textarea | select | radio | checkbox | date-ec-gc | address-et | name-et | file | password`.
- `json-schema.ts`: `toJsonSchema(schema)` via `zod-to-json-schema` **or** a hand-written emitter if you prefer not to add the dep (note the choice).
- `registry.ts`: `FORM_SCHEMA_VERSION = "1.0.0"`, `parseSchema(json)` (throws `SchemaValidationError` with a path), `listFields(schema)`.

**C4.2 `scripts/schema-lint.ts`** — CLI: `pnpm schema:lint <file...>`, exit 1 on any error, prints `file:field: CODE message` lines and a summary. Implement exactly these ten rules (the bad fixtures in C4.4 map 1:1):

| Code | Rule | Severity |
|---|---|---|
| `OP001` | Unknown/unsupported `field.type` | error |
| `OP002` | `radio`/`checkbox` group missing `legend` | error |
| `OP003` | `hint` exceeds 90 chars, contains `.`/`።` mid-string, or contains a URL/`<a` | error |
| `OP004` | `conditional` trigger or route target does not exist in the schema graph | error |
| `OP005` | Duplicate `field.id` or `step.id` anywhere in the schema | error |
| `OP006` | `pii !== "none"` but neither `readAloud` nor `noAudioReason` is present | error |
| `OP007` | Field is not represented in any `review` step and has no `hideInReview: true` | error |
| `OP008` | `conditional.mode === "next-page"` used where the branch is a single field (must be `inline-single`) | error |
| `OP009` | `field.id` is not URL-safe (`^[a-z][a-z0-9-]*$`) | error |
| `OP010` | Every `label`/`hint`/`legend` key missing from `content/strings/en.json` | error |

**C4.3 Demo schema — `schemas/savanna-onboarding-v1.json`**

Author it to exactly this structure (5 chapters). Do not invent extra fields; do not rename IDs.

| Chapter | Steps and fields |
|---|---|
| **1. Personal identity** (`identity`) | `name-et` group `full-name` (fields `given-name`, `father-name`, `grandfather-name`, each `pii: personal`); `date-ec-gc` `date-of-birth` with `allowYearOnly: true`, `pii: personal`; `radio` `sex` (legend "Sex", options `female`/`male`); `text` `fayda-fcn` optional, 16 digits, `pii: sensitive`; `file` `id-document` optional, `pii: sensitive` |
| **2. Contact & location** (`contact`) | `tel` `phone` (`pii: personal`); `email` `email` optional; `address-et` `address`; `select` `preferred-language` (`am`/`en`); `radio` `contact-method` (`phone`/`sms`/`email`) with **inline-single** conditional child `contact-method-phone` (tel) shown when `sms` |
| **3. Filter — identity method** (`identity-method`) | `filter` step: `radio` `identity-method` (`fayda` → `education` / `document` → `education` / `witness` → `accommodations`) |
| **4. Education & skills** (`education`) | `radio` `highest-education` (5 options); `checkbox` `skills` (legend "Skills", 6 options, max 3); `number` `years-experience` (0–50) |
| **5. Accommodations & review** (`accommodations`) | `checkbox` `accommodations` (legend "Accommodations", `pii: sensitive`); `textarea` `experience-summary` with `hideInReview: false`; **`review`** step `review`; `checkbox` `declaration` (single option, `pii: none`); conditional witness block shown when `identity-method === "witness"` |

Content rules to demonstrate: **no asterisks for required fields**, `optional: true` on optional ones, every `pii !== "none"` field carries a `readAloud` block, hints are one short sentence with no links.

**C4.4 Bad fixtures — `schemas/fixtures/bad/`**

Ten files, `op001.json` … `op010.json`, each a minimal valid schema with exactly one rule violated (so the code reported is unambiguous). Add `fixtures/bad/README.md` mapping file → expected code.

**Acceptance**

```bash
pnpm schema:lint schemas/savanna-onboarding-v1.json           # exit 0
pnpm test --filter @openpath/core                              # includes the fixture table test
pnpm schema:lint schemas/fixtures/bad/op003.json; echo $?      # exit 1, prints OP003
```

The unit test must iterate **all ten** fixtures and assert the exact code — not just that it fails.

**Guardrails:** the demo schema is authored content, not translated content. Every label in `en.json` is a real English string an applicant could read; no `Lorem ipsum`, no `TODO` labels.

---

### C5 · String catalogue, `strings-lint`, i18n runtime — 0.75 d

**Objective:** every user-visible string is a keyed, locale-complete, lint-checked asset — and the missing-Amharic gap is *visible as a number*, not hidden.

**Requirements**

1. `content/strings/en.json` — flat namespace, dotted keys mirroring schema IDs: `form.identity.fullName.label`, `error.required`, `error.dateInFuture`, `help.whyWeAsk.faydaFcn`, `action.continue`, `action.back`, `a11y.optional`, `a11y.errorPrefix`, etc. Populate from the C4 demo schema. Target 80–120 keys.
2. `content/strings/am.json` — **identical key set**, every value `""`, plus `_meta: { "locale": "am", "status": "untranslated", "reviewer": null, "reviewedAt": null }`.
3. `content/strings/_schema.json` — declares which keys are `plural`/`interpolated` and their placeholders, e.g. `{"form.skills.error.max": {"placeholders": ["max"]}}`.
4. `scripts/strings-lint.ts` — CLI `pnpm strings:lint [--require-locale=am]`, exit 1 on errors. Rules:

| Code | Rule | Severity |
|---|---|---|
| `STR001` | Key present in `en` but missing in another locale | error (except when the locale's `_meta.status === "untranslated"` → **warning**, counted) |
| `STR002` | Key in a locale file but not in `en` (orphan) | warning |
| `STR003` | Placeholder set differs between locales for the same key | error |
| `STR004` | Value contains a URL or HTML tag | error |
| `STR005` | `en` value is empty or whitespace | error |
| `STR006` | Key not in alphabetical order (keeps diffs reviewable) | warning |

Output must end with a coverage line: `am coverage: 0/104 keys (0.0%) — BLOCKED pending native review`.
5. `packages/core/src/i18n/t.ts` — `t(key, { locale, params })`: looks up, interpolates `{name}` placeholders, falls back to `en`, then to the key itself prefixed `⟦missing:key⟧`. Loader accepts an injected catalogue object (no `fetch`, no DOM — remember `core-no-dom`). Unit tests: interpolation, fallback chain, unknown key, missing param throws in dev mode only.

**Acceptance**

```bash
pnpm strings:lint                                   # exit 0, prints am coverage 0%
pnpm strings:lint --require-locale=am; echo $?      # exit 1 (this is the P2 gate, wired later)
pnpm test --filter @openpath/core
```

**Guardrails:** no machine translation, no transliteration, no Amharic invented by the agent. Empty is correct.

---

### C6 · Ethiopian module: verified calendar adapter, digit words, HDX address importer — 0.75 d

**Objective:** conversions that are *proven*, not invented — using two independently authored libraries. The verification work is already done and committed; your job is to wire it up and guard it.

> **Context you must not repeat:** on 13 Nov 2026 the two candidate libraries were installed, compared on 2,399 dates across 1900–2100 with **zero disagreements**, and 60 golden vectors were generated and committed to `phases/assets/ec-gc.vectors.csv`. Read `phases/assets/ec-gc.vectors.README.md` before touching this module. Do not re-derive the calendar, and do not "improve" the arithmetic.

**C6.1 Dependencies — exact versions**

- `dependencies`: `ethiopian-calendar-date-converter@2.1.6` (MIT, measured **1.15 KB gzipped** — this is the one that ships).
- `devDependencies`: `kenat@4.0.0` (MIT, zero-dep — **20.9 KB gzipped even tree-shaken**, so it verifies, never ships).
- Record both in the report's dependency section. Do not add a third calendar library.

**C6.2 `src/calendar/types.ts` + `errors.ts`**

```ts
export type CalendarSystem = 'EC' | 'GC';
export interface CalendarDate { calendar: CalendarSystem; year: number; month: number; day: number }
export interface YearOnlyDate { calendar: CalendarSystem; year: number; precision: 'year' }
export class CalendarOutOfRangeError extends Error {}   // name + message must include the accepted range
export class CalendarInputError extends Error {}
```

**C6.3 `src/calendar/range.ts` — the guard (this is the safety-critical part)**

```ts
export const SUPPORTED_GC_RANGE = { min: '1900-03-01', max: '2099-09-11' } as const;
export const SUPPORTED_EC_YEARS  = { min: 1892, max: 2091 } as const;
export function assertGcInRange(y: number, m: number, d: number): void;
export function assertEcInRange(y: number, m: number, d: number): void;
```

The upper bound is **not arbitrary**: `kenat.toGC` is one day early for GC `2099-09-12 … 2100-12-31`, and the runtime library throws beyond `2100-02-01`. Tests must assert that `2099-09-12` and `2100-03-01` are **rejected** with `CalendarOutOfRangeError`, and that `2099-09-11` is accepted.

**C6.4 `src/calendar/adapter.ts` — the only place either library is imported**

```ts
export function gcToEc(y: number, m: number, d: number): CalendarDate;      // uses the runtime library
export function ecToGc(date: CalendarDate): { year: number; month: number; day: number };
export function dayOfYear(date: CalendarDate): number;
export function isEcLeapYear(year: number): boolean;                        // year % 4 === 3
export function daysInEcMonth(year: number, month: number): number;         // 30, or 5/6 for month 13
export const EC_MONTHS_AM: readonly string[];  // መስከረም … ጳጉሜ
export const EC_MONTHS_EN: readonly string[];
```

Rules: every public function validates input and range first; library errors are wrapped in our error types (never leak a library stack trace to a form UI); no other file in the repo may import a calendar library (add a `dependency-cruiser` rule `calendar-adapter-only`).

**C6.5 `scripts/ethiopia-verify.ts`**

- Copies-or-diffs `phases/assets/ec-gc.vectors.csv` against `packages/ethiopia/fixtures/ec-gc.vectors.csv` and fails on drift.
- For every row: recompute GC→EC with **both** libraries. Report `rows, agreement, mismatches, human_signoff pending/confirmed`.
- Flags: `--require-agreement` (CI, always on from P0) and `--require-human-signoff` (P2 gate, off in P0).
- Expected P0 output:
  `vectors: 60 · agreement: 60/60 · human_signoff: 0 confirmed / 60 pending · RANGE GUARD: ok`
  then `PENDING: converter may ship to staging only. Run with --require-human-signoff before production.`
- Exit 0 in P0. `--require-human-signoff` exits 1 while any row is `pending` — that is the correct behaviour, not a bug.

**C6.6 `scripts/generate-ec-vectors.ts`** — regenerates the CSV from both libraries, asserts zero mismatches, **refuses to write** if any row disagrees. Structure-labelled rows only (New Year, Pagume edges, Gregorian month boundaries, birth-date class, range bounds). **Never label a row with a holiday claim** — see the README's oscillation caveat (7 January is Tahsas 29 in most years but Tahsas 28 in 2024 and 2028).

**C6.7 `src/numbers/fidel.ts` + `fixtures/am-digits.json`** — unchanged from the previous revision of this plan:

- Digit-by-digit reader only: `0 ዜሮ, 1 አንድ, 2 ሁለት, 3 ሶስት, 4 አራት, 5 አምስት, 6 ስድስት, 7 ሰባት, 8 ስምንት, 9 ዘጠኝ`, stored as data with `_meta: { reviewStatus: "unreviewed" }`.
- `digitsToFidel('0912 437 158')` preserves separators. Cardinals (መቶ/ሺህ…) throw `NotImplementedInThisPhase` (P2/E3).
- Tests for the digit map, separator preservation, empty string.

**C6.8 Address: importer + loader + synthetic sample**

- `src/address/types.ts`: `Region → ZoneOrSubCity → Woreda → { kebeleFreeText, landmark }`, plus `provenance: { source, sourceUrl, retrievedAt, adminLevelCounts, knownGaps }` and `synthetic?: boolean`.
- `src/address/loader.ts`: zod-validates the dataset; `findRegions()`, `findZones(regionId)`, `findWoredas(zoneId)`; returns `[]` (never throws) when the dataset is absent, so the form degrades to free text.
- `scripts/import-admin.ts`: reads an OCHA HDX COD-AB CSV/XLSX **if present locally** (do not download in CI) and emits `data/admin/et-admin.json` with provenance and level counts. If the file is absent, print `SKIP: no HDX source file present — form falls back to free text` and exit 0.
- `fixtures/address.sample.json`: exactly **3 records**, `synthetic: true`, names reading `SAMPLE REGION — NOT REAL`. Never type real woreda names from memory.

**Acceptance**

```bash
pnpm test --filter @openpath/ethiopia
pnpm ethiopia:verify                            # 60/60 agreement, range guard ok, exit 0
pnpm ethiopia:verify --require-human-signoff; echo $?   # exit 1 (expected in P0)
pnpm tsx scripts/generate-ec-vectors.ts --dry-run       # 0 mismatches
pnpm depcruise                                  # calendar-adapter-only rule active
```

**Guardrails:** never edit a vector row to make it agree; never patch `node_modules`; never import a calendar library outside `adapter.ts`; never present a converted date as verified while `human_signoff` is `pending`.

### C7 · Tokens, CSS skeleton, contrast validator — 0.75 d

**Objective:** a token layer that provably meets contrast, and a CSS isolation strategy that works on Android 8–12 WebViews (see ADR-009).

**C7.1 `packages/react/src/styles/`**

- `layers.css`: `@layer openpath.tokens, openpath.base, openpath.components, openpath.utilities;`
- `tokens.css`: `--op-*` custom properties on `:where(.op-root)` and `[data-op-surface="..."]` for **four surfaces** — `light` (#FFFFFF), `cream` (#FAF8F5), `dark`, `yellow-on-black`. Include: text, muted text, surface, surface-alt, border (#111111 on light), focus (#FCC934), error text, error surface, `--op-target-min: 48px`, `--op-font-scale: 1`, `--op-letter-spacing: normal`, `--op-line-height: 1.65`, spacing scale (4/8/12/16/24/32), radii, and font stacks with `"Noto Sans Ethiopic"` fallback **after** system Ethiopic fonts.
- `base.css`: `.op-root` scoping (every selector prefixed), focus-visible ring `outline: 3px solid var(--op-color-focus); outline-offset: 2px`, `scroll-margin-block: 96px` on focusables, 48px min target utility, `@media (forced-colors: active)`, `@media (prefers-contrast: more)`, `@media (prefers-reduced-motion: reduce)`, and `@media (min-resolution)` no-ops for clarity. **No `@scope` dependency** — add `@supports (selector(:scope))` only as an enhancement comment, not as behaviour.
- `tokens.pairs.json`: an explicit list of `{ fg, bg, min, usage }` pairs to validate — text/surface for each of the 4 surfaces (min 4.5), border/surface (min 3), focus/surface (min 3), error text/error surface (min 4.5), muted text/surface (min 4.5).

**C7.2 `scripts/tokens-contrast.ts`**

- Parses `tokens.css` for hex/rgb values, resolves `var()` for the declared pairs, computes WCAG 2.x contrast (`(L1+0.05)/(L2+0.05)`), prints a table `pair | ratio | required | PASS/FAIL`, exits 1 on any failure.
- Unit tests with known values: `#111111` on `#FFFFFF` ≈ 18.9 (±0.1); `#767676` on `#FFFFFF` ≈ 4.54 (±0.02); `#FCC934` on `#111111` ≈ 12.1 (±0.2); and a deliberately failing pair fixture that must be reported.

**Acceptance**

```bash
pnpm tokens:contrast    # exit 0, every pair PASS
pnpm test --filter @openpath/react   # contrast math tests pass
```

**Guardrails:** no utility framework, no CSS-in-JS, no icon font, no `!important`. Total CSS must be < 22 KB uncompressed at this stage.

---

### C8 · ADRs and governance documents — 0.75 d

**Objective:** the fourteen irreversible decisions are written down *before* anyone codes against them.

**Requirements**

1. `docs/adr/0000-template.md` with required sections: `# NNNN — Title`, `Status` (Proposed/Accepted/Superseded), `Date`, `Owner`, `Context`, `Decision`, `Consequences`, `Alternatives considered`, `Verification` (how a reviewer checks the decision was followed).
2. `docs/adr/0001…0014-*.md` — one per decision in parent plan §4.10, each with `Status: Proposed`, `Owner: UNASSIGNED`, and a `Verification` section stating the **machine check** where one exists (e.g. ADR-007 Light DOM → "`pnpm test` includes `wc-no-shadow-dom` asserting `createRenderRoot` is overridden"; ADR-009 → "`grep -r '@scope' packages/` finds no non-comment usage").
3. `docs/CONTRIBUTING.md`: trunk-based flow, commit format (`type(scope): subject`), review rules (2 approvals for `core`, `schemas`, auth, PII), how to run `pnpm ci`, where content lives and who signs off (editor), ADR requirement for irreversible decisions, and the "any addition must name its displacement in §3.5" rule.
4. `docs/host-contract.md`: the 10-line checklist an embedding institution must satisfy (from parent plan §4.6) — plus the runtime `checkHostEnvironment()` behaviours P2 will implement.
5. `docs/device-lab.md`: the 8 device/AT configurations from parent plan §5.4 with columns `config | hardware/software | owner | last run | result`.
6. `docs/a11y-statement-template.md` + `docs/conformance-evidence.md`: templates aligned to WCAG-EM structure; the evidence file lists what each future audit must attach.
7. `docs/research/baseline-protocol.md`: purpose, participant profile, 5 tasks, timing rules, consent script (English + Amharic placeholder block marked `TODO: native review`), data-handling and deletion, and the "no participant ID documents photographed" rule.

**Acceptance**

```bash
pnpm docs:lint   # every .md under docs/ has valid relative links and ADRs have all required sections; exit 0
```

`docs-lint` must also fail if an ADR is missing any required section — write it so a deliberately broken ADR fixture in `docs/adr/__fixtures__/bad.md` (excluded from the count) proves the check works.

---

### C9 · Baseline measurement kit — 0.5 d

**Objective:** the U0 baseline (parent plan §11.2) is runnable by a non-engineer, and its numbers are computed by code, not by hand.

**Requirements**

1. `templates/baseline-results.csv` — header `participant_id,group,task_id,completed,seconds,errors_assisted,errors_unassisted,notes` with 3 sample rows.
2. `scripts/score-baseline.ts` — reads a results CSV, prints a markdown table: completion rate per group, median and IQR seconds per task, error counts, and a `n=` column; refuses to report a group with `n < 3` (prints `INSUFFICIENT n`). Unit tests for median/IQR with odd, even and single-element inputs.
3. `docs/research/baseline-protocol.md` (from C8.7) must specify the 5 tasks against the **current Savanna form** and the exact timing start/stop rule.
4. `ops/README.md` must contain the sentence: *"Baseline is taken before any OpenPath UI exists — it measures the incumbent form, not our product."*

**Acceptance**

```bash
pnpm tsx scripts/score-baseline.ts templates/baseline-results.csv   # prints the table
pnpm test --filter scripts                                          # median/IQR tests pass
```

---

### C10 · Procurement and bookings register — 0.25 d

**Objective:** the human track is a checklist with owners and dates, not a memory exercise.

**Requirements**

1. `ops/preflight-register.csv` — columns `id,item,track,owner,needed_by,blocks_phase,status,evidence_url,notes`; one row per item H1–H13 in §6, pre-filled with `status: not_started`.
2. `ops/budget.csv` — columns `id,item,currency,low,high,kind,status,notes`; rows from parent plan §12.1 and §12.2 (one-off and recurring), with the removed EthSL line **absent** and a `notes` field on the Easy-Read line saying "16 blocks, no pictogram curation (§3.5 K3)".
3. `scripts/ops-lint.ts` — validates both CSVs against zod schemas (enum-checked `status`, `track`, date format, numeric currency fields, no duplicate ids) and asserts every `blocks_phase` value is one of `P1…P7`. Exit 1 on any violation or empty required cell.
4. `ops/README.md` — how to update the register, what counts as evidence (a dated email, a booking reference, an invoice), and the rule that **a row is not `done` without an `evidence_url`**.

**Acceptance**

```bash
pnpm ops:lint   # exit 0 with all rows not_started
```

---

### C11 · Savanna theme tokens and host-collision fixture — 0.75 d

**Objective:** components built in P1/P2 land already looking native inside Savanna, and the biggest embed risk (a Bootstrap host with 1.5 MB of global CSS) is framed before any component exists.

> Read [`assets/savanna-theme-contrast.md`](assets/savanna-theme-contrast.md) first — it contains the measured audit, the accessible variants and the reasoning. Do not re-derive the colours.

**C11.1 `packages/react/src/styles/themes/savanna.css`**

Implement the token block from §4 of the audit verbatim, inside `@layer openpath.tokens`, scoped to `:where(.op-root)[data-op-theme="savanna"]`. Every value that differs from Savanna's own brand colour carries an inline comment with the measured ratio and the reason, e.g.:

```css
--op-color-text-muted: #6e767f;   /* Savanna #98a3ae = 2.57:1 — fails AA; this = 4.60:1 */
--op-color-focus:      #002b56;   /* Savanna green #05f283 = 1.50:1 — unusable as a focus ring */
```

**C11.2 Extend `tokens.pairs.json`**

Add the Savanna theme as a second theme with **every** pair the audit lists, including the four accessible variants (`#d83d3d`, `#6e767f`, `#8b95a0`, `#028749`, `#03ab5d`, `#457d95`, `#569dbb`). `scripts/tokens-contrast.ts` gains `--theme=savanna|default|all`. It must fail if someone restores a failing brand colour.

**C11.3 Host fixture scaffold `apps/demo/host-bootstrap/index.html`**

A minimal page that (a) loads Bootstrap 5 and a Savanna stylesheet, (b) contains a `.op-root[data-op-theme="savanna"]` block rendering **token swatches only** (colour chips, a 48 px target, a focus ring, an Amharic sample string), and (c) carries a comment block stating that **from P2 this page must mount real components and run journey J-13**. No components in P0.

Source the host CSS via `scripts/fetch-host-fixture.sh`, which shallow-clones `https://github.com/alx-africa/Savanna-static-pages` into `.host-fixtures/savanna/` at a **pinned commit SHA** and adds that path to `.gitignore`. Do **not** vendor their 1.5 MB CSS or 76 fonts into our repo.

**C11.4 `docs/a11y/savanna-theme-contrast.md`**

Copy of the audit asset, plus a "how to re-run" section (the contrast script invocation) and the date of measurement.

**Acceptance**

```bash
pnpm tokens:contrast --theme=all        # exit 0; both default and savanna themes pass
pnpm tokens:contrast --theme=savanna --fixture=restore-brand-red; echo $?   # exit 1 (negative test)
bash scripts/fetch-host-fixture.sh      # exits 0, or prints SKIP with a reason when offline (never fails CI)
```

**Guardrails:** do not modify Savanna's CSS to make a pair pass; do not copy their assets into the repo; no components, no React; do not introduce a CSS framework on our side. If Savanna publishes updated tokens, re-run the audit and record the change rather than silently keeping old values.

## 4. Execution order and checkpoints

Work in this sequence. Each checkpoint must be green before continuing — later packages assume earlier ones.

| # | After | Checkpoint command | Do not proceed if |
|---|---|---|---|
| 1 | C1 | `pnpm install --frozen-lockfile && pnpm build lint typecheck test` | Any warning or non-zero exit |
| 2 | C2 | `pnpm depcruise && pnpm verify:boundaries` | The negative probe is not caught |
| 3 | C3 | `pnpm ci` | CI script and local script diverge |
| 4 | C4 | `pnpm schema:lint schemas/savanna-onboarding-v1.json && pnpm test --filter @openpath/core` | Any of the 10 fixtures passes |
| 5 | C5 | `pnpm strings:lint && pnpm strings:lint --require-locale=am; echo $?` (expect `0` then `1`) | Exit codes inverted |
| 6 | C6 | `pnpm ethiopia:verify && pnpm ethiopia:verify --require-human-signoff; echo $?` (expect `0` then `1`) | Vector drift, or the range guard accepts `2099-09-12` |
| 7 | C7 | `pnpm tokens:contrast --theme=default` | Any pair FAIL, or a failing fixture not detected |
| 8 | C11 | `pnpm tokens:contrast --theme=savanna` and the negative brand-red test | A failing brand colour restored without a variant |
| 9 | C8 | `pnpm docs:lint` | Broken ADR fixture passes |
| 10 | C9–C10 | `pnpm tsx scripts/score-baseline.ts templates/baseline-results.csv && pnpm ops:lint` | Insufficient-n guard not triggered |
| 11 | All | `pnpm ci` on a clean clone (`git clone` to /tmp, install, run) | Anything fails from clean |

**Parallelisation:** C4 and C5 can be done together (schema before strings). C6, C7, C8 and C11 are independent. C9/C10 are last. C11 must finish before P1 starts, because components get styled against the theme from their first commit.

---

## 5. Hard guardrails — do not do these

1. **No product UI.** No React components, no hooks that render, no Storybook stories. `packages/react/` contains CSS only.
2. **No Shadow DOM** anywhere (ADR-007), and no `@scope` used as behaviour (ADR-009).
3. **No custom ARIA widgets** — if you need a control, use the native element.
4. **No secrets, keys, `.env` files, or real endpoint URLs** committed. `.gitignore` covers `.env*`; add a `docs/SECRETS.md` note that keys live in the CI secret store.
5. **Do not hand-roll or "fix" the Ethiopian calendar.** Use the two pinned libraries behind `adapter.ts`, keep the range guard, and never edit a fixture row to force agreement.
6. **Do not invent Ethiopian administrative names** or population data.
7. **Do not machine-translate or invent Amharic.** Empty strings with `untranslated` status are the correct output.
8. **Do not add dependencies** beyond the C1 list without recording the addition and reason in the report.
9. **Do not weaken a test to make it pass.** If a check cannot pass, the correct action is to report it as blocked (§8).
10. **Do not write code comments that assert unverified facts** (calendrical, benchmark, or vendor claims). Link to `docs/decisions/` instead.
11. **Do not restyle Savanna's product.** We adapt our tokens to their palette, with documented accessible variants — we do not edit their CSS, and we do not silently "fix" their brand.

---

## 6. Track H — human checklist (the agent creates the register, then stops)

The agent must create `ops/preflight-register.csv` with these rows and **must not attempt any of them**. Each row is a booking, purchase, contract or conversation.

| ID | Item | Blocks | Needed by | Notes |
|---|---|---|---|---|
| H1 | Ethiopian-region hosting: managed Postgres + object storage + backup SLA; written quote | P2, P5 | week 1 | Data-residency constraint (ADR-004) — do not scaffold on a US/EU database "temporarily" |
| H2 | Addis AI account + API key + a latency test **run from Addis Ababa** (record p50/p95) | P4 | week 10 | Compare against Azure's 1.05 s p50 before committing to a tier |
| H3 | Azure Speech resource + key (am-ET) | P4 | week 10 | Also confirm $15/1M char pricing on the actual subscription |
| H4 | Devices: 1× Redmi 9A-class (2 GB, Android 9), 1× Pixel-class (Android 13), 1× Windows laptop for NVDA, 1× BT switch | P1, P6 | hackathon day 1 | Buy, don't borrow — the lab is a standing asset |
| H5 | Amharic editor contract + string spec + glossary seed (10 terms) | P1, P2 | week 1 | **The long pole.** String freeze 1 lands in P2 |
| H6 | Studio booking + voice talent for ~120 Tier-0 prompts | P1 / P4 | hackathon day 2 | 1–2 days, 2 voices, includes retakes |
| H7 | External WCAG-EM auditor **booked** (engagement runs in P6) | P6 | week 2 | 6–10 week lead time; booking late is what slips releases |
| H8 | Penetration test **booked** (engagement in P6) | P6 | week 2 | Scope: web + API + auth flows |
| H9 | OPD partnership agreement: FEAPD/ENAB/ENAD/ENAID contact, recruitment fee, compensation policy (2,000 ETB + transport) | P1, P6 | week 2 | Pay recruiters and participants; share findings back |
| H10 | Legal: counsel engaged for Proclamation 1321/2024 gap analysis, DPIA scope, vendor DPA template | P2 | week 4 | Statute binds now even though ECA directives are pending |
| H11 | Licence & IP: confirm Apache-2.0, trademark position, and run the bundled-asset audit (`LICENSES.md`) | P7 | week 4 | Mulberry/Open Symbols + Noto (OFL) only; **no ARASAAC** |
| H12 | Baseline sessions scheduled: 5 participants on the incumbent Savanna **registration form** | P2 | week 2 | The shared static pages are the learner *dashboard*, not the form — the baseline must measure the actual registration flow. Baseline precedes any OpenPath UI |
| H14 | Savanna: written confirmation that `Savanna-static-pages` CSS/HTML may be used as a test fixture, plus the current official brand-token source of truth | P1 | week 1 | The `--savanna-aice-*` tokens were extracted from a frozen snapshot; confirm they are still current and get the licence in writing. Theme extraction is unaffected — only vendoring the fixture depends on this |
| H13 | Savanna: written sign-off on the §3.5 scope table; request their API/data-model spec; get an answer to Q9 (captions-only vs EthSL as launch requirement) | P2, P5 | week 2 | Scope sign-off is what stops P2 scope creep |

**Definition of done for Track H:** every row has `status` ≠ `not_started` and a non-empty `evidence_url`. The agent reports the register as created-but-unfilled; the human lead owns completion.

---

## 7. Handoff report — `templates/P0-report.md` (the agent fills this in)

Produce this file at the end of the phase, with these exact headings:

```markdown
# P0 completion report
## 1. Status
One of: COMPLETE / COMPLETE WITH DEVIATIONS / BLOCKED
## 2. Deliverables
Table: ID | delivered? | path | verification command | result
## 3. Verification transcript
Paste the final `pnpm ci` output (tail 40 lines) and the exit code.
## 4. Deviations from spec
Anywhere you did something different, with the reason and the risk.
## 5. Dependency additions
Anything installed beyond the C1 allow-list, and why.
## 6. Deliberately-blocked items
The EC calendar (expected), Amharic coverage (expected), and anything else — with the
exact command a future engineer runs to see the block.
## 7. Open questions for the human lead
Numbered, specific, each with your recommended default.
## 8. What P1/P2 can now start
Bullet list: which of the parent plan's P1 pre-work items are unblocked by this phase.
```

---

## 8. If you get blocked

| Situation | Do this | Do **not** do this |
|---|---|---|
| A dependency won't install | Record it, use a documented alternative or defer the package, note it in the report | Silence it by editing tsconfig/eslint rules |
| A lint/test rule can't be satisfied by the code you wrote | Fix the code | Loosen the rule or delete the test |
| A library disagrees with its own vector | Quarantine the row, keep the fixture green minus that row, report it | Adjust the expected value to match the code (circular) |
| You're unsure whether something is P0 or P2 | Treat it as P2 and list it in §7 open questions | Build it "because it's small" |
| The spec contradicts itself | Follow the parent plan, flag the contradiction in the report | Pick silently |
| Network/tooling unavailable mid-phase | Finish all file-writing work, mark executable checks as `UNVERIFIED`, report | Fake an exit code or claim a check passed |

**The one thing worse than an incomplete P0 is a P0 that looks complete but quietly encodes a wrong assumption.** Every "blocked" marker in this document is intentional and is checked by a command, so a future engineer cannot miss it.

---

## 9. Next phase

**P1 — Hackathon demo (10 days).** P0 unblocks it by providing: a green monorepo, the demo schema, the string pipeline, the token/contrast layer, a **working and verified calendar adapter**, the ADRs that constrain implementation, and (via Track H) devices, an editor and a recording slot. The P1 implementation plan will be written as `phases/P1-hackathon.md` once this phase's report exists — because three of its pre-work items depend on what Track H actually delivers.
