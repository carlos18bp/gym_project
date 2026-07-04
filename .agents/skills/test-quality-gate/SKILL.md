---
name: test-quality-gate
description: "Improve Azurita's test-quality gate by fixing the highest-value issues first with targeted test runs only."
---

# Test Quality Gate Workflow

## Rules
- Never run the full test suite.
- Read `docs/TESTING_QUALITY_STANDARDS.md` before refactoring tests.
- Prefer fixing representative fragile patterns that unlock multiple future files.
- Avoid production code changes unless test determinism genuinely requires them.

## Priorities
1. Gate-breaking errors
2. Determinism issues
3. Fragile E2E locators on core flows
4. High-value unit or integration tests
5. Warnings and style issues

## Validation Commands
- Backend: `source .venv/bin/activate && cd backend && pytest path/to/test_file.py -v`
- Frontend unit: `npm --prefix frontend test -- path/to/file.spec.js`
- Frontend E2E: `npm --prefix frontend run e2e -- path/to/spec.js`
- Gate script: `python3 scripts/test_quality_gate.py --repo-root . --report-path test-results/test-quality-report.json --frontend-unit-dir test --verbose`

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
