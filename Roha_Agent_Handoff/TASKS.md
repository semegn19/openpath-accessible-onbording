# Roha task plan

This is a bounded build sequence, not a promise that all later-stage features fit in twelve hours. Read SPEC.md and retain the full feature backlog.

| Stage | Budget | Concrete output | Dependencies | Feature IDs |
| --- | --- | --- | --- | --- |
| T01 Inspect and reconcile | 0-1 h | Repository inventory, IMPLEMENTATION_PLAN.md, STATUS.md, selected demo profile; begin required downloads | Existing source/starter | D01-D06, L03, I02 |
| T02 Discover and act | 1-3 h | Generated maps, live registry, local commands, real text scaling, context navigation, simple explanations, reusable bundle | T01 | D01-D06, A01-A03, P01-P02, I01 |
| T03 Converse | 3-5 h | One real speech profile, turn-taking, correction, plain provider errors; tested foreground activation if available | T02 | V01-V06, O01-O04, L01-L03 |
| T04 Finish the task | 5-7 h | No-ID flow, support privacy, files, consent, review and minimal save/recovery; offline readiness/cache | T03 and host boundaries | O05-O09, P03, F01-F05 |
| T05 Career and adoption | 7-9 h | Shared job application, private filter, employer form, second-host install and available Savanna integration | T02-T04 | C01-C03, I01-I03 |
| T06 Verify and submit | 9-12 h | Real-device/co-designer results, axe fixes, evaluation report, README/Docker, evidence and demo | Working T02-T05 | A05, I03 and every implemented feature's AT test |

Useful P1 work can run within an owner's stage only when it improves the main task and does not consume the evaluation reserve. Do not mark an untested capability done just to match the schedule. Adjust the stage budgets to the actual time remaining.

## Suggested four-person ownership

| Owner | Focus | Pair-review |
| --- | --- | --- |
| 1 | Conversation, speech providers, correction and wake | Owner 4 on real learner experience |
| 2 | Discovery, registry, action validation, SDK and Savanna | Owner 3 on data/action boundaries |
| 3 | Offline, drafts, private support and career flows | Owner 2 on a second-host install |
| 4 | Co-design, native-language review, accessibility evidence and docs | Owner 1 on full task completion |

## After the required journey passes

P1: spelling/digit review, preview/undo, page orientation, error recovery, resume recap, shared-device reset, compatibility report, job context and measured language/device expansion.

P2: partner-assisted entry, SMS resume, private human handoff, optional reading aids, a practice task, JobPosting/extension distribution and dedicated/native wake hardening.

## Required implementation planning files

- IMPLEMENTATION_PLAN.md: chosen modules, dependencies, actual provider, demo profile and startup/test commands.
- STATUS.md: per-feature status and evidence, derived from STATUS_TEMPLATE.md.
- CAPABILITY_MATRIX.md: per device/language/runtime capability, with tested versions.
- ACCESSIBILITY_REPORT.md: actual evaluation results and unresolved issues.
- KNOWN_LIMITATIONS.md: honest scope, unsupported controls, unavailable integrations and provider requirements.

Every feature ID in FEATURES.json must appear in STATUS.md, even when deferred. Every working feature must link to a relevant test/evidence record; a screenshot alone is not proof of a working speech or private-data boundary.
