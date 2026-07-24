---
description: E2E coverage — close untested user flows with specs that exercise real interactions. Coverage is the readout, not the goal: a flow counts only when a qualifying test drives it through the UI.
auto_execution_mode: 2
---

# E2E Test Coverage

## Goal

Close flows that no test exercises, by writing specs that would fail if the
feature broke.

**The goal is not a percentage.** Until 2026-07-23 this skill said "reach 100%
flow coverage". Combined with a reporter that marked a flow `covered` as soon as
one tagged test passed, the cheapest way to hit that target was `page.goto()`
plus `toBeVisible()`. An audit of one suite found **301 of 966 E2E tests
performed no user interaction at all**, and **72 flows were backed exclusively by
such tests** while reporting as covered. Coverage went up; nothing was verified.

Coverage is a lagging indicator. The target is that **every behavior a user can
observe has a test that would fail if that behavior broke.**

## Core principle: real user interactions

| Real user interaction | NOT a real user interaction |
|----------------------|---------------------------|
| Clicking buttons, links, menus | Calling the backend API directly |
| Filling and submitting forms | Setting store values programmatically |
| Navigating between pages via UI | `page.goto()` to skip the steps under test |
| Uploading files through inputs | Injecting rows into the DB |

## Definition of done — per test, all three required

A test is not finished until you can state all three. If you cannot write the
third line, **do not write the test.**

1. **It acts.** The test performs the interaction the flow is about
   (`click` / `fill` / `press` / `selectOption` / `setInputFiles`). Helpers count;
   the detectors resolve them.
2. **It asserts an observable outcome with a concrete value** — text, count,
   URL, or a locator carrying the expected content.
   `getByText('Phase 1 delivery')` pins content; a bare `toBeVisible()` on a CSS
   selector does not.
3. **It names the bug it would catch.** One line in the spec's header comment:
   *"fails if the reject button stops sending the rejection."* If no such bug
   exists, the test has no reason to exist.

For a **mutating action** (create / update / delete / send / pay), assert what
changed: the row is gone, the count dropped, the confirmation appeared, the URL
moved on. A delete test that only asserts the table is still visible has not
tested the delete.

## Before writing: check for an existing test

Search the corpus first — by flow id, by selector, by the text asserted. If a
test already covers the behavior, **extend it instead of adding one.** One suite
carried 146 duplicated unit tests; new specs are not free.

```bash
grep -rn "@flow:<flow-id>" frontend/e2e/
grep -rn "<the text or testid you plan to assert>" frontend/e2e/
```

## Outcome classes — what a flow must cover

Each flow declares its required outcome classes in `flow-definitions.json`. Tag
every spec with both `@flow:<id>` and `@outcome:<class>`; a test with no
`@outcome` grants no coverage credit.

| Class | What it covers |
|-------|----------------|
| `success` | The action completes and produces its success state |
| `error` | The action is rejected with a validation or permission message |
| `failure` | The action is attempted and fails server-side (declined payment, 5xx) |
| `display` | Information is viewed in a table, list or detail view |

`display` flows carry two extra requirements, because for them reachability *is*
the behavior under test: arrive by **navigating the UI** (not a deep link), and
assert **real data** (a cell value, a row count against the fixture).

## Execution rules

1. Run only the specs you touched: `npx playwright test e2e/path/to/spec.spec.ts`
2. Use `E2E_REUSE_SERVER=1` when the dev server is already running
3. **Quality ceiling beats volume.** The old limit (20 tests / 3 cycles) measured
   output. If the gate reports any junk finding on your batch, stop and fix it
   before writing another test.

## Prioritization

| Priority | Criteria |
|----------|----------|
| 1 | Core journeys (auth, checkout) — `success` **and** `error` |
| 2 | Critical CRUD — mutations must assert the mutation |
| 3 | Contract points between frontend and backend |
| 4 | Failure states (server errors, timeouts) |
| 5 | Display flows and edge cases |

## Abstention is a valid outcome

If a flow has no user-observable behavior to verify, record it as *not testable,
with the reason*, in `docs/USER_FLOW_MAP.md`. Coverage not reached by declared
abstention **is not a failure**. Fabricating a test to close the number is.

## Workflow

1. Read `e2e/flow-definitions.json` and run the audit:
   `python3 scripts/flow_coverage_audit.py --repo-root .`
2. Work `junk-only` flows **before** `missing` ones — a flow whose only tests are
   junk is worse than an uncovered one, because it reports green.
3. Look the flow up in `docs/USER_FLOW_MAP.md`; consult
   `docs/TESTING_QUALITY_STANDARDS.md`.
4. Search for an existing test to extend (see above).
5. Implement, satisfying the three-part definition of done.
6. Run only the new or modified specs.
7. Validate:
   `python3 scripts/test_quality_gate.py --repo-root . --semantic-rules strict --files <spec>`
8. Re-audit and confirm the flow moved to `covered`.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟢 frontend-e2e-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Audit inicial leído | ✅ | N covered / N junk-only / N missing |
| Flows priorizados | ✅ | junk-only antes que missing, P1/P2 primero |
| Búsqueda anti-duplicado | ✅ | N ya cubiertos → se extendió el test existente |
| Tests agregados | ✅ | N specs con @flow: + @outcome: |
| Definition of done | ✅ | interacción + assert con valor + "qué bug atrapa" |
| Quality gate | ✅ | cero hallazgos junk en los archivos tocados |
| Cobertura re-auditada | ✅ | los flows tocados pasaron a covered |
```

Si un flow quedó sin cobertura por **abstención declarada**, marcarlo ⏭️ con la
razón — no es un fallo. Si el gate reporta junk en el lote, ❌ y `## Next steps`
con el archivo y la regla.

## Next steps
- `python3 scripts/flow_coverage_audit.py --repo-root .` — confirmar el delta
