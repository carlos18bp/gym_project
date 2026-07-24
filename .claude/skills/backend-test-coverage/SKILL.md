---
name: backend-test-coverage
description: "Backend test coverage — cover untested behavior in models, serializers, views, utils and tasks with tests that would fail if the behavior broke. Coverage is the readout, not the goal."
---

# Backend Test Coverage

## Goal

Cover untested **behavior** across Models, Serializers, Views, Utils and Tasks.

**The goal is not a percentage.** This skill used to say "reach 100% coverage".
A line-coverage target is satisfied by any test that executes the line — which is
how a suite ends up with tests that call a function, assert the mock was called,
and verify nothing. The target is that **every behavior has a test that would
fail if that behavior broke.**

## Definition of done — per test, all three required

If you cannot write the third line, **do not write the test.**

1. **It exercises the real unit** with real input — not a mock standing in for
   the thing under test. Mock at boundaries (network, clock, third-party SDKs)
   only.
2. **It asserts an observable outcome with a concrete value** — the returned
   object, the persisted row, the response body, the raised exception. Asserting
   only that a patched function was called tests the mock, not the code.
3. **It names the bug it would catch.** One line in the test's docstring:
   *"fails if the serializer stops rejecting a negative amount."*

## Before writing: check for an existing test

```bash
grep -rn "def test_.*<behavior>" backend/<app>/tests/
grep -rn "<the function or endpoint you plan to test>" backend/<app>/tests/
```

If the behavior is already covered, **extend that test** rather than adding a
near-copy. Structurally identical tests are reported as `duplicate_coverage` and
will come back as audit findings.

## Prioritization — by risk, not by percentage

| Priority | Criteria | Why |
|----------|----------|-----|
| 1 | Behavior with no test at all | Real exposure |
| 2 | Business rules: validation, permissions, money, state machines | Highest blast radius |
| 3 | Error paths and edge cases of covered functions | Where users hit bugs |
| 4 | Views → Serializers → Models → Utils → Tasks | Business-critical first |

A file at 40% whose uncovered lines are error handling matters more than a file
at 90% whose gap is a `__repr__`.

## Abstention is a valid outcome

Constants, plain data classes, `__str__`, re-exports and generated migrations
have no behavior worth a test. Record them as *not testable, with the reason*,
rather than fabricating a test to close the number. Coverage not reached by
declared abstention **is not a failure**.

## Per-test checklist

- Name describes ONE specific behavior
- No conditionals or loops in the body (use `pytest.mark.parametrize`)
- Assertions verify observable outcomes, not internal calls
- Deterministic: no real clock, no network, no ordering assumptions
  (`freeze_time` at class level is supported by the gate)
- Isolated: no dependence on another test having run
- Mocks have explicit `return_value` / `side_effect`
- AAA: Arrange → Act → Assert

## Execution rules

1. Activate the virtualenv: `source venv/bin/activate`
2. Run only the files you touched: `pytest path/to/test_file.py -v`
3. **Quality ceiling beats volume:** if the gate reports a junk finding on your
   batch, stop and fix it before writing another test.
4. **Engine check before any DB work.** `projects.yml` declares the engine in
   `db:`. For a `db: mysql` project run `manage.py` with `DJANGO_ENV=production`
   from the project's `backend/`, so Django connects to MySQL and not the sqlite
   fallback.

## Workflow

1. Read the coverage report, and re-read it as a list of *behaviors*, not lines.
2. Pick by risk (table above), not by lowest percentage.
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
🟢 backend-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Coverage leído como comportamiento | ✅ | N behaviors sin test identificados |
| Priorizado por riesgo | ✅ | reglas de negocio y error paths primero |
| Búsqueda anti-duplicado | ✅ | N ya cubiertos → se extendió el existente |
| Tests agregados | ✅ | N tests con assert de valor concreto |
| Definition of done | ✅ | unidad real + outcome observable + "qué bug atrapa" |
| Abstenciones declaradas | ℹ️ | N archivos sin comportamiento testeable, con razón |
| Quality gate | ✅ | cero hallazgos junk en los archivos tocados |
```

Cobertura no alcanzada por **abstención declarada** se marca ⏭️ con la razón —
no es un fallo.
