---
name: e2e-user-flows-check
description: "E2E coverage audit — enumerate all user flows from product docs, UI routes, and backend endpoints, map each to existing E2E tests, and report coverage gaps with priorities."
---

# E2E User Flows Audit

You are a Senior QA/Product Analyst. Your mission is to identify every user flow in the application and verify no flow is missing from E2E coverage.

## Constraints

- Use only evidence from the repo (docs, UI routes, tests, APIs).
- Do not invent flows. If unclear, ask clarifying questions.
- Provide traceability (paths + line refs if possible).
- Separate critical flows (P1/P2) from nice-to-have (P3/P4).
- **Every flow must correspond to a real user interaction** through the UI.

## Phases

### Phase 0 — Scope
Identify user roles/personas and modules. Confirm scope boundaries.

### Phase 1 — Source Inventory
Collect evidence from: product docs, UI routes, existing E2E tests, backend endpoints.

### Phase 2 — Extract Candidate Flows
For each source: Flow name, Start → steps → end state, Roles, Module.
Each flow MUST be traceable to a real user action in the browser.

### Phase 3 — Normalize
Merge duplicates, split overly broad flows, assign priority (P1-P4).

### Phase 4 — Coverage Mapping
Compare candidate flows vs E2E flow list. Map to tests or mark missing.

### Phase 5 — Gaps & Risks
Report: missing flows, missing tests, partial coverage, synthetic tests risk.

### Phase 6 — Register Missing Flows
Register every missing flow in BOTH:
1. `docs/USER_FLOW_MAP.md`
2. `frontend/e2e/flow-definitions.json`

### Phase 7 — Output
1. Master flow inventory table
2. Missing flow list (with suggested IDs + priority)
3. Proposed updates to flow definitions
4. Summary of flows added
5. Open questions / unknowns
