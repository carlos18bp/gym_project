---
name: test-quality-gate
description: "Phased plan to raise the Test Quality Gate score by refactoring high-impact backend and frontend tests. Use when the user wants to improve test quality or fix quality gate failures."
---

# Test Quality Improvement Strategy

## Goal

Create and execute a phased strategy to improve test quality by selecting a critical, meaningful subset of tests (backend + frontend) to refactor/fix first, rather than trying to fix everything.

## Non-negotiable Constraints

1. **Only run tests that were refactored or improved.** Do not run entire suites.
2. **Do not change production code** unless strictly necessary for test determinism.
3. **Do not add code comments** unless explicitly required.
4. **Prefer small, incremental changes** that reduce fragility and nondeterminism.

## Quality Standards Reference

Before refactoring any test, you **must consult**: `docs/TESTING_QUALITY_STANDARDS.md`

## Severity Levels

| Severity | Gate Impact | When to Fix |
|----------|-------------|-------------|
| **error** | Fails the gate | Phase 0-3 |
| **warning** | Lowers the score | Phase 4 |
| **info** | Style | Phase 5 |

## Selection Rules (Priority Order)

1. Tooling blockers (ESLint misconfiguration)
2. Core user journeys (auth, checkout, dashboard, documents)
3. Highest issue density files
4. Representative patterns (fix once, apply everywhere)
5. Warning-only files
6. Info/style issues

## Phases

### Phase 0 — Unblock the Gate
Fix ESLint/jest-dom rule mismatches.

### Phase 1 — Backend Determinism
Fix tests using `timezone.now` or other nondeterministic sources.

### Phase 2 — E2E Fragile Locators
Refactor critical Playwright specs to use stable locators.

### Phase 3 — High-Value Unit Tests
Refactor Jest tests with fragility/implementation coupling.

### Phase 4 — Warning Sweep
Eliminate all warning-level issues.

### Phase 5 — Info / Style Pass
Resolve all info-level findings for a clean gate report.

## Validation Commands

```bash
# Backend
pytest path/to/test_file.py

# Frontend Unit
npm test -- path/to/test_file.test.js

# Frontend E2E
npx playwright test path/to/spec.spec.js

# Quality Gate
python3 scripts/test_quality_gate.py --repo-root . --external-lint run --semantic-rules strict
```

## Deliverable

- A phased plan (Phase 0-5)
- Done conditions for each phase
- Per-phase test-run commands (only changed tests)
- Severity breakdown from initial gate run
