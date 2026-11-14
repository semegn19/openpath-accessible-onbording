# Agent instructions

**Read [`HANDOFF.md`](HANDOFF.md) first.** It is the full context for this repo: what the project is, the exact state of the tree, how to run the gate, what is unfinished, the user's standing rules, and the landmines.

The five things to know before your first command:

1. **The gate needs a dev server.** `cd app && npm install && npx playwright install chromium`, then `npm run dev` (leave it on **:5173** — if the port is taken Vite quietly moves to 5174 and every test then hits a stale build). Then `npm run check` in a second shell → expect **EXIT=0, 257 assertions, 0 failures**.
2. **Verify before changing.** If the gate is not green on the tree you were handed, report that instead of editing.
3. **Plan first, ask, then execute, then report** — one wave at a time. Do not present the user a menu of dense options; explain plainly what is risky, why, and how much is touched.
4. **Measure before asserting a defect**, and state the command, the number and the diff when you claim something works. Several confident claims in this repo's history had to be withdrawn after a probe.
5. **Do not start the `App.tsx` hook extraction** (Wave 2b–2e) without explicit approval — see HANDOFF §8.1. Do not rewrite `.git` (392 MB) before submission; use a shallow clone.

Schema is the source of truth: edit `schema/*.json`, then `npm run sync:schemas && npm run validate`. `app/src/schemas/` is generated and gitignored.
