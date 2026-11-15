# Roha specification and agent handoff

This package expands the supplied prompt into a product specification, implementation instructions, a prioritized feature catalog, test plan and schema contracts. It is not the Roha SDK or a claim that the agent is implemented.

## Start

1. Extract this package into the implementation repository or attach it alongside that repository and the Savanna starter.
2. Read SPEC.md, then paste AGENT_PROMPT.txt into the coding agent.
3. Let the agent inspect existing code, create IMPLEMENTATION_PLAN.md and STATUS.md, and immediately begin the first runnable implementation slice.

## Files

- AGENT_PROMPT.txt: exact instructions to the building agent, including which spec/status files to prepare and the execution order.
- SPEC.md: full product/engineering target with 60 feature IDs and acceptance conditions.
- FEATURES.json: machine-readable catalog; all entries initially planned.
- SOURCE_REQUIREMENTS.txt: unchanged supplied build prompt, retained so no original requirement is silently lost.
- ARCHITECTURE.md: module, host, trust, state, privacy and offline boundaries.
- TASKS.md: twelve-hour work sequence, ownership suggestion and later-stage work.
- ACCEPTANCE_TESTS.md: end-to-end and per-feature evaluation; runtime tests are not yet executed.
- STATUS_TEMPLATE.md: progress and evidence tracking for every feature.
- MODEL_SELECTION.md: candidate/provider evaluation worksheet, not a tested model recommendation.
- DEMO_SCRIPT.md: three-minute sequence tied to adoption, inclusion, privacy and offline evidence.
- openapi.json: proposed capability/structural-validation/optional-transcription endpoints; no implemented server is claimed.
- schemas/: JSON Schemas for page maps, proposed intents and language/device capabilities.
- examples/: validated illustrative maps/intents/capabilities and two ordinary HTML host fixtures.
- tests/validate_contracts.py: handoff contract validation and negative fixtures; not an SDK runtime test.

## Additional feature suggestions

The catalog adds preview/undo, spelling/digit review, where-am-I orientation, resume recap, clearer error recovery, shared-device reset, optional preference profiles, a host compatibility report, job context/checklists, and later optional human help/practice. They are prioritized so bonus work does not consume the accessibility evaluation reserve.

## Contract validation

Use Python with jsonschema installed, then run:

```sh
python -m pip install -r requirements-dev.txt
python tests/validate_contracts.py
```

The schema checker passing does not mean automatic discovery, voice, wake, offline operation, human accessibility or any host integration works. The implementation agent must run the runtime acceptance plan and record truthful capability statuses.

Source input SHA-256: 41b89b47fc10dea600b896d015a172d03aecc83bc477c78ed8850612180895ea
