---
name: test-quality-gate
description: "Phased plan to raise the Test Quality Gate score by refactoring high-impact backend and frontend tests. Use when the user wants to improve test quality or fix quality gate failures."
---

# Test Quality Improvement Strategy

## Goal

Create and execute a phased strategy to improve test quality by selecting a critical, meaningful subset of tests (backend + frontend) to refactor/fix first, rather than trying to fix everything.

## Relationship to the other test skills

| Skill | Question it answers |
|---|---|
| [[test-audit]] | Which of these tests should exist at all? |
| [[fix-broken-tests]] | Why is this specific test failing? |
| [[qa]] | Runs this gate as its Phase 5 via `qa-agent.sh --verify` |
| **test-quality-gate** | **How do I raise the gate score on tests I am keeping?** |

## Non-negotiable Constraints

1. **Only run tests that were refactored or improved.** Do not run entire suites.
2. **Do not change production code** unless strictly necessary for test determinism.
3. **Do not add code comments** unless explicitly required.
4. **Prefer small, incremental changes** that reduce fragility and nondeterminism.

## Quality Standards Reference

Before refactoring any test, you **must consult**: `docs/TESTING_QUALITY_STANDARDS.md`

## Las 9 reglas anti-basura y el ratchet

Besides the form checks, the gate runs the nine junk rules from the canonical
core: `no_user_interaction` · `flow_tag_mismatch` · `deep_link_entry` ·
`no_data_assertion` · `weak_assertion` · `duplicate_coverage` ·
`tautological_selector` · `mock_only_assertion` · `reimplements_sut`.

Their severity is decided against `.junk-baseline.json` (the ratchet): with
`--junk-severity=error`, any finding **not** in the baseline is an error and
**breaks the gate**; baselined findings stay warnings. The baseline only ever
shrinks — after cleaning a batch, regenerate it with
`--semantic-rules strict --write-junk-baseline`.

A false positive is excused with a `quality: allow-*` marker. Six exist —
`allow-no-interaction`, `allow-deep-link`, `allow-render-only`,
`allow-duplicate`, `allow-mock-only`, `allow-reimpl` — the reason in
parentheses is **mandatory**, and the marker goes **inside the test block**:
`// quality: allow-mock-only (fire-and-forget; the effect lives in the collaborator)`.

Governance: the core is canonical in the toolkit — **never patch it locally**;
anything per-project goes in `.testquality.yml`.

## Severity Levels

| Severity | Gate Impact | When to Fix |
|----------|-------------|-------------|
| **error** | Fails the gate | Phase 0-3 |
| **warning** | Lowers the score | Phase 1.5 (junk) / Phase 4 |
| **info** | Style | Phase 5 |

The gate PASSES/FAILS on `errors == 0` (with `--strict`, warnings fail too).
The 0-100 Quality Score is informational and dilutes on large suites — it is
**not** the pass criterion.

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

### Phase 1.5 — Junk Sweep
Baselined junk findings surface as WARNING — do **not** leave them for the
warning sweep: they are the debt that lies the most. Attack them here, rule by
rule, starting with the two disqualifying ones (`no_user_interaction`,
`flow_tag_mismatch`).

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

# Scope it to what you touched: --include-file <file> (repeatable) or --include-glob '<pattern>'
python3 scripts/test_quality_gate.py --repo-root . --external-lint run --semantic-rules strict \
    --include-file backend/core_app/tests/models/test_x.py \
    --include-glob 'frontend/e2e/auth-*.spec.js'
```

The JSON report lands at `test-results/test-quality-report.json` by default.

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill
(una fila por fase del plan; ⏭️ si la fase queda fuera del scope elegido):

```markdown
🟢 test-quality-gate OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Gate inicial leído | ✅ | severity breakdown errores/warnings/info |
| Phase 0 — Unblock | ✅ | ESLint/jest-dom rules corregidas |
| Phase 1 — Backend determinism | ✅ | timezone.now y nondet fuentes arregladas |
| Phase 1.5 — Junk sweep | ✅ | junk baselineado atacado por regla, descalificantes primero |
| Phase 2 — E2E locators | ✅ | role/testid en specs P1/P2 |
| Phase 3 — High-value units | ✅ | fragilidad/coupling resueltos |
| Phase 4 — Warning sweep | ✅ | warnings eliminados |
| Phase 5 — Info/style | ✅ | info-level findings resueltos |
| Gate final | ✅ | score subió X → Y, errores=0 |
```

Solo se corren los tests refactorizados (nunca la suite entera). Si una fase
quedó incompleta (Phase 5 opcional, batch consumió límite, warnings/info no
cerrados), reemplazar el ✅ por ⚠️ o ⏭️, omitir la línea ✨ y agregar
`## Next steps` con los archivos restantes + el comando del gate.

## Next steps
- `python3 scripts/test_quality_gate.py --repo-root . --external-lint run --semantic-rules strict` — re-correr el gate y confirmar errores=0 (acotar con `--include-file <archivo>` repetible o `--include-glob '<patrón>'`; reporte en `test-results/test-quality-report.json`)
