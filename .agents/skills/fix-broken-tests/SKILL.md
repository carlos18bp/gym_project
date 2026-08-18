---
name: "fix-broken-tests"
description: "Fix a specific list of broken tests provided by the user. Runs only the failing tests + a regression subset — never the full suite."
---

# Fix Broken Tests

## Goal

Recibir una lista de tests rotos, entender por qué fallan, arreglarlos y verificar que pasan — junto con una regresión mínima del módulo afectado. Nunca correr la suite completa.

## Cómo invocar este skill

Sin picker por diseño: no hay flags; el insumo es la lista de tests.

Gating de datos ($output-protocol §4): si el operador no pasó la lista de
tests rotos, pedirla UNA sola vez en texto plano (≤3 bullets: qué tests, capa,
error observado) — es un dato, no un modo: nunca un picker. Con la lista en
mano, ejecutar directo. Invocada por $qa/$merge-when-green (fix loop):
hereda su gating, nunca pregunta. Tampoco preguntar en fleet/headless/cron.

## Restricciones No Negociables

1. **Solo correr los tests que el usuario indicó + regresión del módulo afectado.** Nunca la suite completa.
2. **No modificar código de producción** salvo que sea estrictamente necesario para que el test sea válido.
3. **No agregar comentarios** al código salvo que el usuario lo pida explícitamente.
4. **Respetar los estándares de calidad**: consultar `docs/TESTING_QUALITY_STANDARDS.md` antes de tocar cualquier test.
5. **≤ 3 intentos por test.** Si tras 3 intentos sigue rojo, STOP y reportar con la hipótesis y lo probado (mismo límite que el qa-healer).

## Referencia de Estándares

Antes de modificar cualquier test, leer: `docs/TESTING_QUALITY_STANDARDS.md`

## Comandos por Tipo de Test

### Backend (pytest)
```bash
cd backend && source venv/bin/activate
pytest path/to/test_file.py::TestClass::test_name -v
# Proyectos con `db: mysql` en projects.yml (engine check de $backend-test-coverage):
DJANGO_ENV=production pytest path/to/test_file.py::TestClass::test_name -v
```

### Frontend Unit (Jest)
```bash
cd frontend && npm test -- path/to/test_file.spec.ts
```

### Frontend E2E (Playwright)
```bash
cd frontend && npx playwright test path/to/spec.spec.ts
# Si el servidor ya está corriendo:
cd frontend && E2E_REUSE_SERVER=1 npx playwright test path/to/spec.spec.ts
# Nota: sólo kore honra E2E_REUSE_SERVER en su playwright.config; en el resto
# es no-op (reuseExistingServer ya es true en local fuera de CI).
```

## Flujo de Trabajo

### Paso 1 — Correr los tests rotos para capturar el error
Ejecutar cada test fallido y guardar el output completo (mensaje de error, traceback, línea exacta).

Si el fallo NO reproduce al re-correr → es **flaky**: clasificar la causa (timing / orden de ejecución / estado compartido) y hacer el test determinista — ese es el fix, no reintentar hasta que pase.

### Paso 2 — Leer y entender el test + el código que prueba
Leer el archivo del test y el código de producción relacionado. Identificar:
- Qué comportamiento se está probando
- Por qué está fallando (API cambió, mock incorrecto, estado global, selector frágil, etc.)
- Si el test en sí es correcto o si el código de producción cambió

### Paso 3 — Arreglar los tests
Aplicar la corrección mínima necesaria. Seguir los patrones de `docs/TESTING_QUALITY_STANDARDS.md`:
- Patrón AAA (Arrange → Act → Assert)
- Un comportamiento por test
- Sin condicionales en el cuerpo del test
- Mocks solo en boundaries externos
- Selectores estables (role > testId > locator)

### Paso 4 — Verificar que los tests arreglados pasan
Correr únicamente los tests que fueron modificados. Confirmar que todos pasan.

### Paso 5 — Regresión del módulo afectado
Correr el archivo de tests completo (no la suite) donde vivían los tests rotos, para verificar que el arreglo no rompió tests vecinos.

### Paso 6 — Reportar
Entregar un resumen con: qué falló, por qué, qué se cambió, y los comandos exactos ejecutados.

---

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de $output-protocol §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Re-run de los arreglados (Recommended) | re-ejecuta SOLO los tests tocados + el archivo del módulo, nunca la suite | `pytest <test> -v` · `npm test -- <archivo>` · `npx playwright test <spec>` según capa |
| Escalar a $debug | tras ≤3 intentos en rojo, o si la causa apunta a código de producción | `$debug "<mensaje de error del test>"` |

## Output final

Reportar siguiendo $output-protocol. Plantilla específica de
`$fix-broken-tests`:

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

Si arreglar el test requiere tocar código de producción: **detenerse y pedir
aprobación ANTES de aplicar cualquier cambio a código de producción**
(alineado con qa-healer). Una vez aprobado y aplicado, reportarlo
explícitamente en una fila adicional con ⚠️.
