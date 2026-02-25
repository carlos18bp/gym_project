---
auto_execution_mode: 2
description: Phased plan to raise the Test Quality Gate score by refactoring a small, high-impact set of backend + frontend tests—running only the tests that were changed.
---
# Test Quality Improvement Strategy

## Goal

Create and execute a phased strategy to improve test quality by selecting a critical, meaningful subset of tests (backend + frontend) to refactor/fix first, rather than trying to fix everything.

## Non-negotiable Constraints

1. **Only run tests that were refactored or improved.**
   - Do not run the entire backend suite, entire Jest suite, or entire Playwright suite.
2. **Do not change production code** unless it's strictly necessary to make tests deterministic/stable.
3. **Do not add code comments** unless explicitly required.
4. **Prefer small, incremental changes** that reduce fragility and nondeterminism.

## Quality Standards Reference

Before refactoring any test, you **must consult** the document:

```
docs/TESTING_QUALITY_STANDARDS.md
```

This document contains the **complete definition of quality criteria** that every test must meet. It includes:

- **Mandatory rules** (naming, atomicity, assertions, determinism, isolation)
- **Correct and incorrect examples** for each criterion
- **Frontend-specific standards** (no `wrapper.vm.*`, stable selectors, single mount per test)
- **E2E-specific standards** (selector hierarchy, no hardcoded timeouts, serial justification)
- **Anti-patterns to avoid** with solutions
- **Documented exceptions syntax** (`quality: disable RULE_ID (reason)`)

When you identify an issue in a test, reference the corresponding standard from this document to understand:
1. **Why** it's a problem
2. **How** to fix it correctly
3. **What patterns** to apply

> ⚠️ Do not invent refactor patterns. Follow the standards defined in `testing-quality-standards.md`.

## Required Output (Your Plan)

Produce a plan with phases, and for each phase include:

1. **Why this phase exists** (what it unlocks / why it's prioritized).
2. **Selection criteria** (how you chose the subset of tests in this phase).
3. **Chosen test files** (a short list of specific files; keep the set tight and impactful).
4. **Targeted issues per file** (e.g., fragile locators, nondeterminism, global state leak).
5. **Refactor approach** (concrete actions/patterns you will apply).
6. **Exactly which commands you will run to validate** — and they must execute only the changed test files.

## Severity Levels — How to Treat Each

The quality gate report emits issues at three severity levels. You must address **all three**, in order:

| Severity | Gate Impact | When to Fix |
|----------|-------------|-------------|
| **error** | Fails the gate | Phase 0–3 (must fix before declaring a phase done) |
| **warning** | Lowers the score | Phase 4 (dedicated warning sweep after errors are cleared) |
| **info** | Informational / style | Phase 5 (final pass; low risk, high readability gain) |

> ⚠️ Do not skip warnings or info items. They accumulate and drag the overall score down over time.

---

## Selection Rules (How You Pick the "Critical Subset")

Pick tests that maximize impact using this priority order:

| Priority | Severity | Category | Examples |
|----------|----------|----------|----------|
| 1 | error | Tooling blocker first | Anything that causes the gate to fail (e.g., ESLint misconfiguration) |
| 2 | error | Core user journeys (highest value E2E + unit) | Auth flows (sign-in/sign-up/forget password/google login), Checkout/subscriptions, Dashboard core widgets, Document flows (create/edit/send/sign/permissions) |
| 3 | error / warning | Highest issue density | Files with the most reported issues in the gate output |
| 4 | error / warning | Representative patterns | Files that, once fixed, provide a repeatable refactor pattern across many other tests |
| 5 | warning | Warning-only files | Files that pass but carry accumulated quality debt |
| 6 | info | Info / style issues | Files with minor style, naming, or documentation gaps |

---

## Phases

### Phase 0 — Unblock the Gate

**Objective:** Fix the ESLint/jest-dom rule mismatch by inspecting the installed plugin and updating config/rule names so ESLint runs cleanly in this repo.

> ⚠️ You must determine the correct rule name(s) by inspecting the installed `eslint-plugin-jest-dom` package (do not guess).

---

### Phase 1 — Backend Determinism

**Objective:** Fix a small set of backend tests that use `timezone.now` or other nondeterministic sources by freezing time or patching deterministically.

**Reference:** See `testing-quality-standards.md` → **Deterministic Tests** section for:
- Complete list of non-deterministic sources (`datetime.now`, `timezone.now`, `time.time`, `random.*`, `uuid.uuid4`)
- Correct patterns using `freezegun`, `monkeypatch`, `random.seed()`

---

### Phase 2 — E2E Fragile Locators

**Objective:** Refactor a small set of the most business-critical Playwright specs with high `fragile_locator` issues to use stable locators (role/name/testid) and resilient patterns.

**Reference:** See `testing-quality-standards.md` → **E2E-Specific Standards** section for:
- Selector hierarchy (`getByRole` > `getByTestId` > `locator`)
- No hardcoded timeouts (use condition-based waits)
- Serial tests require justification
- Data isolation and cleanup patterns

---

### Phase 3 — High-Value Unit Tests

**Objective:** Refactor a focused set of Jest unit tests with repeated fragility/implementation coupling patterns.

**Reference:** See `testing-quality-standards.md` → **Frontend-Specific Standards** section for:
- No implementation coupling (`wrapper.vm.*`)
- Stable selectors (`data-testid`, not CSS classes)
- Single mount per test
- Timer and mock restoration
- Global state isolation (`localStorage`, `sessionStorage`)

---

### Phase 4 — Warning Sweep

**Objective:** Eliminate all `warning`-level issues surfaced by the quality gate after Phases 0–3 are complete.

**How to identify targets:**
1. Run the quality gate and filter output to `warning` severity only.
2. Sort files by warning count (descending) and pick the top offenders.
3. Cross-reference the warning rule IDs against `docs/TESTING_QUALITY_STANDARDS.md` to understand the correct fix.

**Common warning categories to look for:**
- Weak or missing assertions (e.g., `assert response` with no field checks)
- Mocking internal logic instead of boundaries
- Tests that pass but rely on implicit/global state
- Missing edge-case or error-condition coverage
- Overly broad `except` / `catch` blocks in test helpers

**Done condition:** Quality gate output contains zero `warning`-level findings for all modified files.

---

### Phase 5 — Info / Style Pass

**Objective:** Resolve all `info`-level findings to achieve a clean, fully green quality gate report.

**How to identify targets:**
1. Run the quality gate and filter output to `info` severity only.
2. Group by rule ID to find patterns (e.g., naming conventions, missing docstrings, minor style gaps).
3. Fix in small, thematic batches — do not scatter unrelated changes across many files.

**Common info categories to look for:**
- Test function naming does not follow the `test_<what>_<condition>_<outcome>` pattern
- Test files missing a module-level description or grouping comment
- Redundant setup/teardown that could be extracted into shared fixtures
- `print` / `console.log` debug statements left in tests
- Unused imports or variables in test files

**Done condition:** Quality gate output contains zero `info`-level findings for all modified files, and the overall gate score has measurably improved vs. the Phase 0 baseline.

---

## Validation Commands Rule (Strict)

When you validate changes, you must run commands that target only the modified tests:

### Backend (pytest)

```bash
pytest path/to/test_file.py
```

### Frontend Unit (Jest)

```bash
npm test -- path/to/test_file.test.js
# or
npx jest --runTestsByPath ...
```

### Frontend E2E (Playwright)

```bash
npx playwright test path/to/spec.spec.js
```

### Quality Gate (After Each Phase)

```bash
python3 scripts/test_quality_gate.py --repo-root . --external-lint run --semantic-rules strict
```

---

## Deliverable Format

Return:

- [ ] A phased plan (Phase 0 → Phase 5)
- [ ] A short checklist of "done conditions" for each phase
- [ ] The exact per-phase test-run commands that comply with the "only changed tests" rule
- [ ] A severity breakdown from the initial gate run (error count / warning count / info count) so progress is measurable

---

## Important Reminder

**Do not propose fixing all files.** Focus on a tight, high-impact subset that measurably improves score and reduces the worst categories first.