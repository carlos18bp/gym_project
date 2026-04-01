---
auto_execution_mode: 2
description: Arregla una lista de tests rotos provistos por el usuario. Corre solo los tests fallidos + regresión del módulo afectado — nunca la suite completa.
---

# Fix Broken Tests

## Goal

Recibir una lista de tests rotos, entender por qué fallan, arreglarlos, y verificar que pasan junto con una regresión mínima del módulo afectado. Nunca correr la suite completa.

---

## Restricciones No Negociables

1. **Solo correr los tests que el usuario indicó + regresión del módulo afectado.** Nunca la suite completa.
2. **No modificar código de producción** salvo que sea estrictamente necesario para que el test sea válido.
3. **No agregar comentarios** al código salvo que el usuario lo pida explícitamente.
4. **Respetar los estándares de calidad**: consultar `docs/TESTING_QUALITY_STANDARDS.md` antes de tocar cualquier test.

---

## Referencia de Estándares

Antes de modificar cualquier test, leer: `docs/TESTING_QUALITY_STANDARDS.md`

---

## Pasos

### 1 — Capturar los errores actuales

Correr cada test fallido para obtener el error real. No asumir la causa — leer el output completo.

**Backend:**
```bash
cd backend && source venv/bin/activate && pytest <path>::<test_name> -v
```

**Frontend Unit:**
```bash
cd frontend && npm test -- <path>
```

**Frontend E2E:**
```bash
cd frontend && E2E_REUSE_SERVER=1 npx playwright test <path>
```

---

### 2 — Analizar el test y el código relacionado

Leer el archivo del test y el código de producción que prueba. Identificar:
- Qué comportamiento se está verificando
- Por qué está fallando (API cambió, mock incorrecto, selector frágil, estado global, fixture obsoleto)
- Si el problema está en el test o en el código de producción

---

### 3 — Aplicar la corrección

Hacer el cambio mínimo necesario siguiendo `docs/TESTING_QUALITY_STANDARDS.md`:
- Patrón AAA (Arrange → Act → Assert)
- Un comportamiento por test, sin condicionales en el cuerpo
- Mocks solo en boundaries externos (APIs, email, reloj)
- Selectores estables: `getByRole` > `getByTestId` > `locator`
- Tests deterministas: congelar tiempo si hay fechas, no depender de orden de ejecución

---

### 4 — Verificar los tests arreglados

Correr únicamente los tests modificados. Confirmar que todos pasan antes de continuar.

---

### 5 — Regresión del módulo afectado

Correr el archivo de tests completo donde vivían los tests rotos — no la suite entera. Verificar que el arreglo no rompió tests vecinos.

---

### 6 — Reportar resultados

Entregar un resumen estructurado con: qué falló, causa raíz, qué cambió, y resultado de regresión.

---

## Comandos de Validación

| Tipo | Comando |
|------|---------|
| Backend — test específico | `cd backend && source venv/bin/activate && pytest path/to/test.py::TestClass::test_name -v` |
| Backend — regresión módulo | `cd backend && source venv/bin/activate && pytest path/to/test_file.py -v` |
| Frontend Unit — test específico | `cd frontend && npm test -- path/to/file.spec.ts` |
| Frontend Unit — regresión módulo | `cd frontend && npm test -- path/to/file.spec.ts` |
| E2E — test específico | `cd frontend && E2E_REUSE_SERVER=1 npx playwright test path/to/spec.spec.ts` |
| E2E — regresión módulo | `cd frontend && E2E_REUSE_SERVER=1 npx playwright test path/to/spec.spec.ts` |

**Límite por ejecución:** máximo 20 tests por batch, 3 comandos por ciclo.

---

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
- Comando: <comando exacto ejecutado>
- Resultado: ✅ Sin regresiones / ⚠️ <detalle si hay problema>
```
