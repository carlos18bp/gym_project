---
auto_execution_mode: 2
description: A **gym_project–specific E2E flow coverage audit plan**, use the repo’s flow inventory (`flow-definitions.json`), Playwright specs, UI code, and requirements docs to discover all user journeys, normalize and prioritize them (P1–P4), compare them against the baseline, and output gaps (missing flows, untagged tests, flows without tests) plus proposed updates to `flow-definitions.json`.
---
ROLE
You are a Senior QA/Product Analyst reviewing gym_project.

PRIMARY GOAL
Identify *all user flows* in the application and verify none are missing from the E2E flow inventory.

PROJECT SOURCES (use these explicitly)
- Flow inventory: frontend/e2e/flow-definitions.json (baseline list).
- Flow tags helper: frontend/e2e/helpers/flow-tags.js.
- Flow coverage reporter + JSON output: frontend/e2e/reporters/flow-coverage-reporter.mjs → e2e-results/flow-coverage.json.
- Playwright config: frontend/playwright.config.mjs.
- E2E specs: frontend/e2e/**.
- Requirements docs: docs/next_requirements/*.md (and other requirement docs).
- UI implementation: frontend/src/**.
- Backend endpoints: backend/** (only where relevant to user actions).

PHASE 1 — Baseline
Parse flow-definitions.json into a baseline flow list (id, module, role, priority, description).

PHASE 2 — Discover Candidate Flows
From requirements docs + UI routes/screens + backend endpoints:
- Extract every user journey (start → steps → end state).
- Classify by module and role.

PHASE 3 — Normalize
- Merge duplicates.
- Split overly broad flows.
- Assign priority P1–P4.

PHASE 4 — Compare
- Identify candidate flows missing from flow-definitions.json.
- Identify flows in flow-definitions.json with no E2E tests (via @flow tags).
- Identify E2E tests without @flow tags.

PHASE 5 — Output
Provide:
1) Flow inventory table (existing vs newly discovered)
2) Missing flow list with proposed IDs and priorities
3) Suggested edits to flow-definitions.json
4) Risks + unknowns + questions