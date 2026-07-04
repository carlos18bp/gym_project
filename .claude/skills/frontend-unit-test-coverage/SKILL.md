---
name: frontend-unit-test-coverage
description: "Frontend unit test coverage strategy — analyze Jest/Vitest coverage reports and implement tests to reach 100% coverage across Pinia stores, composables, and UI components."
---

# Frontend Unit Test Coverage Strategy

## Goal

Conduct a thorough analysis of frontend coverage reports. Reach **100% coverage** in all files.

## Quality Standards Reference

Before writing any test, consult: `docs/TESTING_QUALITY_STANDARDS.md`

## Execution Rules

1. **Run only modified test files**: `npm test -- path/to/file.spec.ts`
2. **Maximum per execution**: 20 tests per batch, 3 commands per cycle

## Coverage Prioritization

| Priority | Layer | Rationale |
|----------|-------|-----------|
| 1 | State Management (Pinia) | Core business logic |
| 2 | Shared Logic (Composables/Utils) | Reused across components |
| 3 | UI Components (critical first) | User-facing |

## Per-Test Checklist

- Test name describes ONE specific behavior
- No conditionals or loops (use `test.each`)
- Assertions verify observable outcomes (rendered UI, events)
- No `wrapper.vm.*` access
- Selectors use `data-testid`, not CSS classes
- One mount per test
- Mocks have explicit return values
- `jest.useFakeTimers()` restored with `jest.useRealTimers()`
- localStorage cleaned in afterEach

## Workflow

1. Review coverage report
2. Identify lowest-coverage files in priority order
3. Consult quality standards
4. Implement tests
5. Run only new/modified test files
6. Verify tests pass and coverage improves

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de
`/frontend-unit-test-coverage`:

```markdown
🟢 frontend-unit-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Coverage report leído | ✅ | jest/vitest --coverage parseado |
| Layers priorizadas | ✅ | Stores → Composables/Utils → UI components |
| Tests agregados | ✅ | N tests, batch ≤20, ciclos ≤3 |
| Quality standards | ✅ | data-testid, no wrapper.vm.*, timers restored |
| Coverage delta | ✅ | X% → Y% statements/branches |
```

Si hay regresión en otros archivos o coverage no llegó al objetivo, reemplazar
el ✅ correspondiente por ⚠️ o ❌, omitir la línea ✨ y agregar `## Next steps`
con el archivo concreto y el comando para correrlo.
