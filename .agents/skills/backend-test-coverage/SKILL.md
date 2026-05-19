---
name: backend-test-coverage
description: "Backend test coverage strategy — analyze pytest coverage reports and implement tests to reach 100% coverage, prioritizing lowest-coverage highest-impact files."
---

# Backend Test Coverage Strategy

## Goal

Analyze the backend codebase focusing on **Models, Serializers, Views, Utils, and Tasks**. Reach 100% coverage using Unit, Integration, and Contract tests.

## Quality Standards Reference

Before writing any test, consult: `docs/TESTING_QUALITY_STANDARDS.md`

## Execution Rules

1. **Activate virtual environment**: `source venv/bin/activate`
2. **Run only modified test files**: `pytest path/to/test_file.py -v`
3. **Maximum per execution**: 20 tests per batch, 3 commands per cycle

## Coverage Prioritization

| Priority | Criteria | Rationale |
|----------|----------|-----------|
| 1 | Lowest % coverage (0% first) | Maximum impact per test |
| 2 | Highest "Miss" count | Biggest uncovered surface |
| 3 | Views → Serializers → Models → Utils → Tasks | Business-critical first |
| 4 | Files with partial coverage | Complete before polishing |

## Per-Test Checklist

- Test name describes ONE specific behavior
- No conditionals or loops in test body
- Assertions verify observable outcomes
- Test is deterministic
- Test is isolated
- Mocks have explicit return_value/side_effect
- Follows AAA pattern

## Workflow

1. Review the coverage report
2. Identify lowest-coverage, highest-impact files
3. Consult quality standards
4. Implement tests
5. Run only new/modified test files
6. Verify tests pass and coverage improves

## Output Format

```
### File: <test_file_path>
- Tests added: <count>
- Coverage before: <X%>
- Coverage after: <Y%>
- Command executed: pytest <path> -v
```

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de
`/backend-test-coverage`:

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

Si quedan archivos sin alcanzar 100% pero el batch consumió su límite (20
tests / 3 ciclos), reemplazar el ✅ de "Coverage delta" por ⚠️ y agregar
`## Next steps` con los archivos pendientes y el siguiente lote.
