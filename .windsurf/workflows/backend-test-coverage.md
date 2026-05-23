---
description: Backend test coverage strategy — analyze pytest coverage and add tests to reach 100% prioritizing lowest-coverage highest-impact files
auto_execution_mode: 2
---

# Backend Test Coverage Strategy

Analyze the backend codebase focusing on **Models, Serializers, Views, Utils, and Tasks**. Reach 100% coverage using Unit, Integration, and Contract tests.

Before writing any test, consult: `docs/TESTING_QUALITY_STANDARDS.md`.

## Execution rules

- Activate venv: `source venv/bin/activate`
- Run only modified test files: `pytest path/to/test_file.py -v`
- **Max 20 tests per batch, 3 commands per cycle**

## Coverage prioritization

| Priority | Criteria |
|---|---|
| 1 | Lowest % coverage (0% first) — maximum impact per test |
| 2 | Highest "Miss" count — biggest uncovered surface |
| 3 | Views → Serializers → Models → Utils → Tasks — business-critical first |
| 4 | Files with partial coverage — complete before polishing |

## Per-test checklist

- Test name describes ONE specific behavior
- No conditionals or loops in test body
- Assertions verify observable outcomes
- Deterministic, isolated
- Mocks have explicit `return_value` / `side_effect`
- AAA pattern (Arrange → Act → Assert)

## Workflow

1. Review coverage report
2. Identify lowest-coverage, highest-impact files
3. Consult quality standards
4. Implement tests
5. Run only new/modified test files
6. Verify tests pass and coverage improves

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/backend-test-coverage`:

```markdown
🟢 backend-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Coverage report leído | ✅ | pytest --cov ejecutado, JSON parseado |
| Files priorizados | ✅ | N archivos lowest-coverage × highest-impact |
| Tests agregados | ✅ | N tests, batch ≤20, ciclos ≤3 |
| Quality standards | ✅ | docs/TESTING_QUALITY_STANDARDS.md respetados |
| Coverage delta | ✅ | X% → Y% en los archivos tocados |
```

Si quedan archivos sin alcanzar 100% pero el batch consumió su límite, reemplazar el ✅ de "Coverage delta" por ⚠️ y agregar `## Next steps` con los archivos pendientes y el siguiente lote.
