# EC ⇄ GC golden vectors — provenance and caveats

Companion to `ec-gc.vectors.csv`. Generated **13 November 2026** during P0 scoping. This file exists so the next engineer does not have to re-derive what took an afternoon to establish — and so that whoever owns the calendar module knows exactly what is proven and what is not.

## 1. Decision

| Role | Package | Why |
|---|---|---|
| **Runtime** (ships in the browser bundle) | [`ethiopian-calendar-date-converter`](https://www.npmjs.com/package/ethiopian-calendar-date-converter) v2.1.6 — MIT, by melaku-z | **1.15 KB gzipped** (measured with esbuild, minified + gzip). Bidirectional (`EthDateTime.fromEuropeanDate` / `.toEuropeanDate`). Declares explicit supported limits: GC `1900-03-01 … 2100-02-01`, throws outside them. |
| **Dev / reference only** (`devDependencies`) | [`kenat`](https://www.npmjs.com/package/kenat) v4.0.0 — MIT, zero dependencies, TS types, `sideEffects: false` | Richer surface (Ge'ez numerals, holiday tables, Amharic month names, 6 language bindings, actively maintained May 2025 → Jul 2026). **20.9 KB gzipped even after tree-shaking to just `toEC`/`toGC`** — too heavy for a form that needs ~2 KB of logic. Used to generate and cross-check vectors. |
| Rejected | hand-rolled JDN arithmetic | See §5: the arithmetic is easy, the *epoch and cycle phase* are not. |

Pin both exact versions. The comparison script is the safety net for both.

## 2. What was verified

| Check | Result |
|---|---|
| Cross-library agreement, 15th of every month, GC 1900-03 → 2100-01 | **2,399 samples, 0 disagreements** |
| `kenat` self round-trip (`toEC` → `toGC`), daily, GC 1950 → 2100 | 7,811 / 7,827 (**16 mismatches — see §4**) |
| Reverse direction spot check: EC 2019-03-04 → GC 2026-11-13 | Agrees in both libraries |
| Invalid input (`EC 2019-14-01`, `2019-13-07`, `2019-02-31`) | `kenat` throws cleanly; melaku-z enforces its documented limits |
| This fixture file | **60 rows, 60 agreements, 0 quarantined** |

Conclusion: **the arithmetic is not in dispute.** Two independently authored MIT libraries, agreeing on 2,399 dates across two centuries, is stronger evidence than any prose rule we could cite.

## 3. The Sept 11 / Sept 12 rule (resolved, with a caveat)

Meskerem 1 falls on **11 September in three years out of four, and on 12 September in the year following an Ethiopian leap year** (EC year ≡ 3 mod 4; Pagume gets a 6th day). Verified chain from both libraries:

```
Meskerem 1, 2014 EC = 2021-09-11
Meskerem 1, 2015 EC = 2022-09-11
Meskerem 1, 2016 EC = 2023-09-12   ← after leap year 2015 EC
Meskerem 1, 2017 EC = 2024-09-11
Meskerem 1, 2018 EC = 2025-09-11
Meskerem 1, 2019 EC = 2026-09-11
Meskerem 1, 2020 EC = 2027-09-12   ← after leap year 2019 EC
```

This matches the published Enkutatash dates for 2023 (12 Sept) and 2026 (11 Sept). Earlier public tables claiming "2028 = 12 September" are **wrong** — the shift follows the *Ethiopian* leap year, not the Gregorian one.

**Caveat for content authors:** because the two calendars' leap days sit in different places, EC day-labels oscillate by one against the Gregorian calendar within each 4-year cycle. Concretely, 7 January maps to **Tahsas 29** in most years but **Tahsas 28** in 2024 and 2028 — even though popular sources describe Genna as "7 January = Tahsas 29" every year. The libraries agree on this; the popular shorthand does not. Treat holiday-date prose as unreliable input to a fixture, exactly as the plan's Appendix B warns.

## 4. Known defect in `kenat@4.0.0` (must stay excluded)

`toGC` returns **one day early** for every date in **2099-09-12 … 2100-12-31** (476 consecutive days). `toEC` is correct throughout; the fault is in the Gregorian reconstruction (most likely the 2100 non-leap-century rule).

```js
toEC(2099, 9, 12)  // → { year: 2092, month: 1, day: 1 }   ✅ agrees with melaku-z
toGC(2092, 1, 1)   // → { year: 2099, month: 9, day: 11 }  ❌ one day early
```

Impact on OpenPath: **none, provided the range guard holds.** Actions:

1. Our adapter must reject GC dates outside **1900-03-01 … 2099-09-11** and EC years outside **1892 … 2091**.
2. Do not "fix" it by patching the dependency. Range-guard and report.
3. File an upstream issue with the reproduction above (cheap, and it is an MIT project worth supporting).
4. melaku-z already throws beyond 2100-02-01, so the runtime path never reaches the defect window.

## 5. Why not hand-roll it

The JDN arithmetic is a solved exercise. The failure modes are not arithmetic — they are *the epoch constant* and *leap-cycle phase*, where a plausible-looking implementation silently produces a one-day error in one year in four. That is exactly the class of bug that corrupts an official birth record, and it is invisible to every test that only checks a single year. Hence: a maintained library, two of them cross-checked, plus this fixture.

## 6. What still needs a human (do not ship without this)

`human_signoff` is `pending` on every row. A human — the Amharic content lead with an Ethiopian calendar reference, not an engineer — must confirm:

- [ ] `2023-09-12` = Meskerem 1, 2016 EC (the shifted-year case)
- [ ] `2026-09-11` = Meskerem 1, 2019 EC
- [ ] `2027-09-12` = Meskerem 1, 2020 EC (the next shifted year)
- [ ] At least one *real* document pair (a Fayda card or Kebele ID showing both calendars), photographed with consent, decoded by hand — the 60 rows here are computed agreement, not documentary evidence
- [ ] The year-only birth-date convention against a current NIDP update-centre directive

When each is confirmed, flip `human_signoff` to `confirmed` and add the reviewer + date in `notes`. `pnpm ethiopia:verify --require-human-signoff` is the gate for shipping the converter to users; it fails until the box is ticked.

## 7. Regenerating

```bash
pnpm add -D kenat@4.0.0 ethiopian-calendar-date-converter@2.1.6
pnpm tsx scripts/generate-ec-vectors.ts   # writes ec-gc.vectors.csv, asserts 0 mismatches
```

The generator must fail loudly if any new row disagrees between libraries. Never hand-edit a row to make it agree.
