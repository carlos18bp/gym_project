---
name: frontend-unit-test-coverage
description: "Frontend unit coverage — cover untested behavior in stores, composables and components with tests that would fail if the behavior broke. Coverage is the readout, not the goal."
argument-hint: "[--apply (escribe los tests; default dry-run: describe el diff)] [--files=<a,b> (acota el lote)] [--semantic-rules strict] [--junk-severity=error]"
---

# Frontend Unit Test Coverage

> **Cadena:** el conductor [[qa]] corre esta skill como Fase 4 (subagente
> `qa-engineer-unit`, que la precarga vía `skills:`). Invocable suelta para
> trabajo puntual de una capa.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → ejecutar directo, sin
menú; (2) intención clara en la sesión ("cubrí el store del carrito") →
proponer el comando en una línea y esperar confirmación; (3) sin argumentos en
sesión interactiva → UNA sola AskUserQuestion (Q1).

> **Invocada como subagente por [[qa]] (el conductor) o en un barrido fleet:
> NUNCA pregunta — hereda el gating del conductor (regla 4 de §4).**

**Q1 — Modo** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Análisis (Recommended) | enumera behaviors sin test en stores/composables/componentes y describe el diff; no escribe archivos | `/frontend-unit-test-coverage` |
| Escribir los tests | implementa al DoD de 3 puntos y valida el lote con el gate; bajo `/qa --apply` quedan staged sin commitear | `/frontend-unit-test-coverage --apply` |
| Lote acotado | escribe sólo sobre los archivos indicados | `/frontend-unit-test-coverage --apply --files=<a,b>` |

**Qué NO se pregunta:** el tuning del gate se tipea (`--files=`, `--suite
frontend-unit`, `--semantic-rules`, `--junk-severity=`); los markers de escape
(`// quality: allow-mock-only` / `allow-reimpl`) se escriben con razón dentro
del test, jamás se ofrecen; bajo [[qa]] el modo lo fija el conductor.

## Goal

Cover untested **behavior** in state management, shared logic and components.

**The goal is not a percentage.** This skill used to say "reach 100% coverage in
all files". Mounting a component and asserting that some element exists satisfies
a line-coverage target while verifying nothing. An audit of one suite found
**146 duplicated tests and 148 assertions too weak to fail.** The target is that
**every behavior has a test that would fail if that behavior broke.**

## Definition of done — per test, all three required

1. **Ejecuta el comportamiento real** (llamar la action / montar con props /
   disparar el evento).
2. **Asserta un resultado observable con VALOR CONCRETO** — nunca
   visibilidad/existencia/truthiness.
3. **Nombra el bug que atraparía** — en un comentario sobre el test. Si no podés
   escribir esa línea, el test no se escribe.

Ejemplo que cumple los tres puntos:

```js
// Falla si addItem deja de acumular el total.
it('addItem accumulates the running total', () => {
  setActivePinia(createPinia());
  const store = useCartStore();

  store.addItem({ id: 1, price: 100 });
  store.addItem({ id: 2, price: 50 });

  expect(store.total).toBe(150);
});
```

### Assertions that do not qualify

| Anti-pattern | Why it cannot fail | Instead |
|---|---|---|
| `expect(wrapper.find('.x').exists()).toBe(true)` | matches incidental markup | assert the rendered text or `data-testid` |
| `expect(items.length).toBeGreaterThanOrEqual(n)` | any surplus passes | assert the exact count |
| `expect(x).toBeTruthy()` / `toBeDefined()` | almost anything is truthy | assert the value |
| `expect(spy).toHaveBeenCalled()` alone | tests the mock, not the code — reported as `mock_only_assertion` | assert the resulting state, or pin it: `toHaveBeenCalledWith(payload)` / `toHaveBeenCalledTimes(n)` |
| `expect(sum(a, b)).toBe(a + b)` | re-derives the result with the SUT's own operator — reported as `reimplements_sut` | a hand-verified literal (`toBe(7)`) |

Counting matches of a CSS-class selector with a `>=` matcher is reported as
`tautological_selector`; the class list can change without the assertion ever
failing.

Excepción genuina: `// quality: allow-mock-only (razón)` /
`// quality: allow-reimpl (razón)` — DENTRO del bloque del test, razón
obligatoria.

## Before writing: check for an existing test

```bash
# buscá en el dir de unit del proyecto (`.testquality.yml: frontend_unit_dir`)
# o en los `**/__tests__/` colocados (Next)
grep -rn "<component or store name>" frontend/ --include='*.test.*' --include='*.spec.*'
```

If a test already covers the behavior, **extend it**. Tests whose bodies are
identical apart from the title are reported as `duplicate_coverage`.

Tests that share a shape but assert different values are **not** duplicates —
they are real coverage that should be a `test.each` / `it.each` table.

## Prioritization

| Priority | Layer | Why |
|----------|-------|-----|
| 1 | State management (Pinia/Vuex) | Core business logic |
| 2 | Composables and shared utils | Reused everywhere |
| 3 | Components with logic (conditionals, formatting, emits) | User-facing behavior |
| 4 | Presentational components | Only where the render encodes a rule |

A component that only renders its props has no behavior worth a unit test. Cover
it where it is used instead.

## Per-test checklist

- Name describes ONE specific behavior
- No conditionals or loops (use `test.each`)
- Assertions verify observable output: rendered text, emitted events, state
- No `wrapper.vm.*` access — that is implementation, not behavior
- Selectors use `data-testid` or roles, never CSS classes
- One mount per test
- Mocks have explicit return values
- Pinia: `setActivePinia(createPinia())` en `beforeEach` — la fuga #1 de estado
  entre tests
- Tras un trigger async: `await flushPromises()` (o `nextTick`) antes de
  assertar
- Fake timers restaurados al final — `vi.useFakeTimers()`/`jest.useFakeTimers()`
  con su `useRealTimers()` de cierre
- localStorage cleaned in `afterEach`

### Emits

Assert el payload exacto, y el caso negativo:

```js
expect(wrapper.emitted('submit')[0][0]).toEqual({ id: 7 });
expect(wrapper.emitted('submit')).toBeUndefined(); // cuando NO debe emitir
```

### Mock del cliente HTTP

Mockear el módulo API (`vi.mock('@/lib/api')`) con retorno explícito y con la
forma real de la respuesta — nunca el fetch global sin forma.

## Abstention is a valid outcome

Barrels, re-exports, constant files and trivial wrappers have no behavior.
Record them as *not testable, with the reason*. Coverage not reached by declared
abstention **is not a failure**.

## Execution rules

1. Run only the files you touched: `cd frontend && npm test -- path/to/file.spec.ts`
2. **Quality ceiling beats volume:** if the gate reports a junk finding on your
   batch, stop and fix it before writing another test.

## Workflow

1. **Enumerate untested behaviors from the code** — walk stores, composables and
   components-with-logic and list what each one *does* (state transitions, emitted
   payloads, formatting/branching rules), cross-referencing `docs/USER_FLOW_MAP.md`.
   The code is the entry point.
2. Prioritize by layer (table above). Use the coverage report only as a *secondary
   readout* — to confirm which enumerated behavior has no line hit; a covered line
   with a weak assertion is still an untested behavior.
3. Consult `docs/TESTING_QUALITY_STANDARDS.md`.
4. Search for an existing test to extend.
5. Implement, satisfying the three-part definition of done.
6. Run only the new or modified files.
7. Validate:

   ```bash
   bash $HOME/webapps/vps-ops-toolkit/scripts/qa/qa-agent.sh --verify <proyecto> --files=<archivo1,archivo2>
   # equivalente crudo (fallback): python3 scripts/test_quality_gate.py --repo-root . \
   #   --suite frontend-unit --semantic-rules strict --junk-severity=error --include-file <archivo>
   ```

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de [[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Re-correr el gate sobre el lote | valida los archivos tocados contra las reglas anti-basura | `bash $HOME/webapps/vps-ops-toolkit/scripts/qa/qa-agent.sh --verify <proyecto> --files=<a,b>` |
| Correr sólo los tests nuevos | los archivos tocados, no la suite entera | `cd frontend && npm test -- path/to/file.spec.ts` |
| Pasar a escritura | implementar los tests que el análisis dejó descritos | `/frontend-unit-test-coverage --apply` |

Nunca ofrecer como fila clickeable `--write-junk-baseline` (el baseline sólo se
congela tipeado) ni `/deploy-and-check` (manual-only).

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟢 frontend-unit-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Comportamientos enumerados desde el código | ✅ | N behaviors sin test identificados |
| Layers priorizadas | ✅ | stores → composables → componentes con lógica |
| Búsqueda anti-duplicado | ✅ | N ya cubiertos → se extendió el existente |
| Tests agregados | ✅ | N tests con valor esperado concreto |
| Definition of done | ✅ | unidad real + valor concreto + "qué bug atrapa" |
| Abstenciones declaradas | ℹ️ | N archivos sin comportamiento testeable, con razón |
| Quality gate | ✅ | cero weak_assertion / tautological_selector / mock_only_assertion / reimplements_sut / duplicate_coverage |
```
