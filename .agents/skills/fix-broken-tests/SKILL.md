---
name: fix-broken-tests
description: "Fix a user-provided set of broken Azurita tests with minimal code changes and only targeted regression runs."
---

# Fix Broken Tests Workflow

## Rules
- Run only the failing tests plus a tight regression slice in the same module.
- Never run the full suite.
- Read `docs/TESTING_QUALITY_STANDARDS.md` before modifying tests.
- Avoid production code changes unless the failing behavior proves the production code is wrong.

## Commands
- Backend: `source .venv/bin/activate && cd backend && pytest path/to/test_file.py::TestClass::test_name -v`
- Frontend unit: `npm --prefix frontend test -- path/to/file.spec.js`
- Frontend E2E: `npm --prefix frontend run e2e -- path/to/spec.js`
- If a dev server is already running for E2E: `cd frontend && E2E_REUSE_SERVER=1 npx playwright test path/to/spec.js`

## Workflow
1. Reproduce the failing test exactly.
2. Read the test and the production code it exercises.
3. Apply the smallest correct fix.
4. Re-run the failing test.
5. Run the narrowest useful regression slice in the same file or module.

## Output Contract
Report:
- original failure
- root cause
- change applied
- exact verification commands
- regression result

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de
`/fix-broken-tests`:

```markdown
🟢 fix-broken-tests OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Tests rotos capturados | ✅ | N tests con error + traceback |
| Causa raíz identificada | ✅ | API drift / mock / selector / determinism |
| Quality standards | ✅ | docs/TESTING_QUALITY_STANDARDS.md respetados |
| Tests arreglados | ✅ | N/N pasan tras el fix |
| Regresión del módulo | ✅ | archivo completo del test pasa, sin vecinos rotos |
| Suite no completa | ✅ | solo tests indicados + regresión, no full suite |
```

Si algún test sigue fallando tras el fix, o la regresión del módulo rompe
vecinos, reemplazar el ✅ correspondiente por ❌, omitir la línea ✨ y agregar
`## Next steps` con el test pendiente, la hipótesis para el siguiente
intento, y el comando exacto a correr.

Si para arreglar el test fue necesario modificar código de producción,
reportarlo explícitamente en una fila adicional con ⚠️ — esa modificación
necesita aprobación del operador antes de commitear.
