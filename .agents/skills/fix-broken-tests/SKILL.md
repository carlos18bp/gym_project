---
name: fix-broken-tests
description: "Fix a specific list of broken tests provided by the user. Runs only the failing tests + a regression subset — never the full suite."
---

# Fix Broken Tests

## Goal

Recibir una lista de tests rotos, entender por qué fallan, arreglarlos y verificar que pasan — junto con una regresión mínima del módulo afectado. Nunca correr la suite completa.

## Restricciones No Negociables

1. **Solo correr los tests que el usuario indicó + regresión del módulo afectado.** Nunca la suite completa.
2. **No modificar código de producción** salvo que sea estrictamente necesario para que el test sea válido.
3. **No agregar comentarios** al código salvo que el usuario lo pida explícitamente.
4. **Respetar los estándares de calidad**: consultar `docs/TESTING_QUALITY_STANDARDS.md` antes de tocar cualquier test.

## Referencia de Estándares

Antes de modificar cualquier test, leer: `docs/TESTING_QUALITY_STANDARDS.md`

## Comandos por Tipo de Test

### Backend (pytest)
```bash
cd backend && source venv/bin/activate
pytest path/to/test_file.py::TestClass::test_name -v
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
```

## Flujo de Trabajo

### Paso 1 — Correr los tests rotos para capturar el error
Ejecutar cada test fallido y guardar el output completo (mensaje de error, traceback, línea exacta).

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

## Formato de Output

```
### Test: <nombre_del_test>
- Archivo: <ruta>
- Error original: <mensaje corto>
- Causa raíz: <explicación en 1-2 líneas>
- Cambio aplicado: <qué se modificó>
- Resultado: ✅ Pasa / ❌ Aún falla

### Regresión
- Archivo: <ruta del módulo>
- Comando: <comando exacto>
- Resultado: ✅ Sin regresiones / ⚠️ <detalle si hay problema>
```
