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
- `python3 scripts/test_quality_gate.py --repo-root . --external-lint run --semantic-rules strict` — re-correr el gate y confirmar el score
