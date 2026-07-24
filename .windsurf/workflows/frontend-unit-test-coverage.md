---
description: Frontend unit coverage — cover untested behavior in stores, composables and components with tests that would fail if the behavior broke. Coverage is the readout, not the goal.
auto_execution_mode: 2
---

# Frontend Unit Test Coverage

## Goal

Cover untested **behavior** in state management, shared logic and components.

**The goal is not a percentage.** This skill used to say "reach 100% coverage in
all files". Mounting a component and asserting that some element exists satisfies
a line-coverage target while verifying nothing. An audit of one suite found
**146 duplicated tests and 148 assertions too weak to fail.** The target is that
**every behavior has a test that would fail if that behavior broke.**

## Definition of done — per test, all three required

If you cannot write the third line, **do not write the test.**

1. **It exercises the unit** with real input: call the action, mount with the
   props, trigger the event.
2. **It asserts a concrete expected value** — the exact rendered text, the emitted
   payload, the resulting state. Not that something merely exists.
3. **It names the bug it would catch.** *"fails if the badge stops translating an
   unknown status."*

### Assertions that do not qualify

| Anti-pattern | Why it cannot fail | Instead |
|---|---|---|
| `expect(wrapper.find('.x').exists()).toBe(true)` | matches incidental markup | assert the rendered text or `data-testid` |
| `expect(items.length).toBeGreaterThanOrEqual(n)` | any surplus passes | assert the exact count |
| `expect(x).toBeTruthy()` / `toBeDefined()` | almost anything is truthy | assert the value |
| `expect(spy).toHaveBeenCalled()` alone | tests the mock, not the code | assert the resulting state or payload |

Counting matches of a CSS-class selector with a `>=` matcher is reported as
`tautological_selector`; the class list can change without the assertion ever
failing.

## Before writing: check for an existing test

```bash
grep -rn "<component or store name>" frontend/test/
```

If a test already covers the behavior, **extend it**. Tests whose bodies are
identical apart from the title are reported as `duplicate_coverage`.

Tests that share a shape but assert different values are **not** duplicates —
they are real coverage that should be a `test.each` / `it.each` table.

## Prioritization

| Priority | Layer | Why |
|----------|-------|-----|
| 1 | State management (Pinia/Vuex) | Core business logic |
| 2 | Composables and shared utils | Reused everywhere |
| 3 | Components with logic (conditionals, formatting, emits) | User-facing behavior |
| 4 | Presentational components | Only where the render encodes a rule |

A component that only renders its props has no behavior worth a unit test. Cover
it where it is used instead.

## Per-test checklist

- Name describes ONE specific behavior
- No conditionals or loops (use `test.each`)
- Assertions verify observable output: rendered text, emitted events, state
- No `wrapper.vm.*` access — that is implementation, not behavior
- Selectors use `data-testid` or roles, never CSS classes
- One mount per test
- Mocks have explicit return values
- `jest.useFakeTimers()` restored with `jest.useRealTimers()`
- localStorage cleaned in `afterEach`

## Abstention is a valid outcome

Barrels, re-exports, constant files and trivial wrappers have no behavior.
Record them as *not testable, with the reason*. Coverage not reached by declared
abstention **is not a failure**.

## Execution rules

1. Run only the files you touched: `npm test -- path/to/file.spec.ts`
2. **Quality ceiling beats volume:** if the gate reports a junk finding on your
   batch, stop and fix it before writing another test.

## Workflow

1. Read the coverage report as a list of *behaviors*, not lines.
2. Prioritize by layer (table above).
3. Consult `docs/TESTING_QUALITY_STANDARDS.md`.
4. Search for an existing test to extend.
5. Implement, satisfying the three-part definition of done.
6. Run only the new or modified files.
7. Validate:
   `python3 scripts/test_quality_gate.py --repo-root . --semantic-rules strict --files <file>`

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟢 frontend-unit-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Coverage leído como comportamiento | ✅ | N behaviors sin test identificados |
| Layers priorizadas | ✅ | stores → composables → componentes con lógica |
| Búsqueda anti-duplicado | ✅ | N ya cubiertos → se extendió el existente |
| Tests agregados | ✅ | N tests con valor esperado concreto |
| Definition of done | ✅ | unidad real + valor concreto + "qué bug atrapa" |
| Abstenciones declaradas | ℹ️ | N archivos sin comportamiento testeable, con razón |
| Quality gate | ✅ | cero weak_assertion / tautological_selector / duplicate |
```
