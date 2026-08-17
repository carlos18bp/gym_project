---
name: new-feature-checklist
description: "Checklist for new features — ensures fake data creation follows business rules and test coverage is complete across backend, frontend unit, and E2E layers."
---

# New Feature Checklist

> **La forma canónica de ejecutar los pasos 1-3 es invocar [[qa]]** — el
> conductor corre flow-map → cobertura (backend/unit/e2e) → gate → test-audit
> como fases ordenadas con las guardas de producción ya cableadas (y salta
> fake-data en prod solo). Esta checklist queda como la vía granular manual.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): con `$ARGUMENTS` o intención clara en la sesión (la feature recién implementada) → ejecutar directo, PROHIBIDO preguntar el tema (un dato menor faltante se marca en el texto, no se convierte en pregunta). Sin argumentos ni contexto → UNA sola pregunta corta en texto por la feature a cubrir (no picker: el insumo es libre). Nunca en modo fleet/headless/cron.

Sin picker por diseño: no hay flags de modo — el argumento es la feature cuya fake data y cobertura se cierran.

## 1. Fake Data Creation / Validation (Backend)

Before creating test data, verify that fake data complies with:
- **Business rules**: Data reflects valid real-world scenarios
- **Model validations**: Constraints, types, ranges, formats
- **Expected exceptions**: Error cases and edge cases
- **Model dependencies**: FK relationships, referential integrity, creation order

> Do not generate random data without context. Each factory/fixture must represent a valid system state.

### Post-implementation refresh

After completing this implementation or fix, the previously-created fake data may have become incoherent: new model fields default to null/empty in old records, new FK relationships have no backing data, business rules added in this change are not reflected. Re-validate and refresh.

**Trigger refresh whenever this implementation/fix changed any of:**
- Model fields (new field, new constraint, modified validator)
- Foreign keys / relations (new FK, removed model, restructured M2M)
- Business logic (new validation, new domain rule, status transitions)
- Serializers/forms with required fields not previously enforced

**Quality target — "many records that make sense":**
- Multiple records per model (not 1–2 placeholders) so flows can be exercised with realistic permutations.
- FK chains populated end-to-end (e.g. for an Order: User → Cart → Items → Payment → StatusHistory all coherent).
- Edge cases represented: empty strings where allowed, max-length values, nullable fields exercised both filled and null, expected-error states.

**To execute the refresh:** invoke the `fake-data-refresh` skill on this project. It runs the project's own `delete_fake_data` then `create_fake_data` management commands and refuses on production environments.

## 2. Test Coverage

### Create tests for the new functionality:

| Layer | Test Types |
|-------|-----------|
| Backend | Unit, Integration, Contract, Edge Cases |
| Frontend | Unit |
| Frontend | E2E (user flows) |

### Quality Standards Reference

Before writing any test, consult: `docs/TESTING_QUALITY_STANDARDS.md`

### Backend Tests
Cover: happy paths, edge cases, error handling.
Per-test: ONE behavior, no conditionals, observable assertions, deterministic, isolated, AAA pattern.

### Frontend Unit Tests
Cover: happy paths, edge cases, error handling, all branches.
Per-test: ONE behavior, sin acceder a internals del componente (`wrapper.vm.*` en Vue, instancias internas en React), stable selectors, one mount, timers restored.

### Frontend E2E Tests
Cover: happy paths, error states, edge cases, contract validation.
Per-test: `@flow:` + `@outcome:<success|error|failure|display>` tags (un spec sin ambos tags no gana crédito de cobertura), role-based selectors, no `waitForTimeout()`, real user interactions only.

## 3. Update User Flow Map

Update the flow registry if new user flows are created — o invocar [[e2e-user-flows-check]], que lo mantiene en el layout del repo (sharded: un JSON por flow + doc por flow, agregados regenerados con `generate_flow_registry.py`; monolito: `docs/USER_FLOW_MAP.md` + `frontend/e2e/flow-definitions.json`).

## Execution Order

1. **First**: Run only the new tests → Must pass
2. **Then**: Run only regression tests
3. **Never**: Run the full test suite

### Limits
- Frontend E2E: max 20 tests per batch, 3 commands per cycle
- Backend: activate venv first (`source venv/bin/activate`); for `db: mysql` projects run tests with `DJANGO_ENV=production`

---

## Output final

Sin menú por diseño (§4): es un checklist-guía; la ejecución canónica es /qa.

Reportar siguiendo [[_output-protocol]]. Plantilla específica de
`/new-feature-checklist`:

```markdown
🟢 new-feature-checklist OK — <feature-name>
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| 1.a Fake data — business rules | ✅ | factories respetan validators + edge cases |
| 1.b Fake data — refresh post-impl | ✅ | fake-data-refresh corrido si tocó modelos/FK |
| 2.a Backend tests | ✅ | unit + integration + contract + edge |
| 2.b Frontend unit tests | ✅ | happy + edge + branches, selectores estables |
| 2.c Frontend E2E tests | ✅ | @flow:<id> + @outcome:<clase>, real-user interactions, sin shortcuts |
| 3 USER_FLOW_MAP.md | ✅ | nuevos flows registrados (si aplica) |
| Suite no completa | ✅ | solo nuevos + regresión, batch ≤20, ciclos ≤3 |
```

Si la skill detecta que el feature tocó modelos/FK pero no se corrió
`fake-data-refresh`, o algún layer de tests no fue cubierto, reemplazar el ✅
correspondiente por ⚠️/❌, omitir la línea ✨ y agregar `## Next steps` con la
skill o el comando exacto a invocar (ej. `/fake-data-refresh <proyecto>`,
`pytest <path>`, etc.).
