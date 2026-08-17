---
name: frontend-e2e-test-coverage
description: "E2E coverage — close untested user flows with specs that exercise real interactions. Coverage is the readout, not the goal: a flow counts only when a qualifying test drives it through the UI."
argument-hint: "[--apply (escribe los specs; default dry-run: describe el diff)] [--files=<a,b> (acota el lote)] [--semantic-rules strict] [--junk-severity=error]"
---

# E2E Test Coverage

> **Cadena:** el conductor [[qa]] corre esta skill como Fase 4 (subagente
> `qa-engineer-e2e`, que la precarga vía `skills:`); el flow-map que consume lo
> refresca [[e2e-user-flows-check]] en la Fase 1. Invocable suelta para trabajo
> puntual de una capa.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → ejecutar directo, sin
menú; (2) intención clara en la sesión ("cerrá los flows de checkout") →
proponer el comando en una línea y esperar confirmación; (3) sin argumentos en
sesión interactiva → UNA sola AskUserQuestion (Q1).

> **Invocada como subagente por [[qa]] (el conductor) o en un barrido fleet:
> NUNCA pregunta — hereda el gating del conductor (regla 4 de §4).**

**Q1 — Modo** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Análisis (Recommended) | corre el flow audit, prioriza junk-only/P1 y describe los specs propuestos; no escribe archivos | `/frontend-e2e-test-coverage` |
| Escribir los specs | implementa specs `@flow`/`@outcome` al DoD de 3 puntos y valida con el gate; bajo `/qa --apply` quedan staged sin commitear | `/frontend-e2e-test-coverage --apply` |
| Lote acotado | escribe sólo sobre los specs indicados | `/frontend-e2e-test-coverage --apply --files=<a,b>` |

**Qué NO se pregunta:** el tuning se tipea (`--files=`, `--suite frontend-e2e`,
`--semantic-rules`, `--junk-severity=`, `E2E_REUSE_SERVER=1`); los markers de
escape (`allow-no-interaction`, `allow-deep-link`, …) se escriben con razón
dentro del test, jamás se ofrecen; bajo [[qa]] el modo lo fija el conductor.

## Goal

Close flows that no test exercises, by writing specs that would fail if the
feature broke.

**The goal is not a percentage.** Until 2026-07-23 this skill said "reach 100%
flow coverage". Combined with a reporter that marked a flow `covered` as soon as
one tagged test passed, the cheapest way to hit that target was `page.goto()`
plus `toBeVisible()`. An audit of one suite found **301 of 966 E2E tests
performed no user interaction at all**, and **72 flows were backed exclusively by
such tests** while reporting as covered. Coverage went up; nothing was verified.

Coverage is a lagging indicator. The target is that **every behavior a user can
observe has a test that would fail if that behavior broke.**

## Core principle: real user interactions

| Real user interaction | NOT a real user interaction |
|----------------------|---------------------------|
| Clicking buttons, links, menus | Calling the backend API directly |
| Filling and submitting forms | Setting store values programmatically |
| Navigating between pages via UI | `page.goto()` to skip the steps under test |
| Uploading files through inputs | Injecting rows into the DB |

## Definition of done — per test, all three required

1. **Ejecuta el comportamiento real** (la interacción real en la UI).
2. **Asserta un resultado observable con VALOR CONCRETO** — nunca
   visibilidad/existencia/truthiness.
3. **Nombra el bug que atraparía** — en el comentario de cabecera del spec. Si
   no podés escribir esa línea, el test no se escribe.

For a **mutating action** (create / update / delete / send / pay), assert what
changed: the row is gone, the count dropped, the confirmation appeared, the URL
moved on. A delete test that only asserts the table is still visible has not
tested the delete.

## Before writing: check for an existing test

Search the corpus first — by flow id, by selector, by the text asserted. If a
test already covers the behavior, **extend it instead of adding one.** One suite
carried 146 duplicated unit tests; new specs are not free.

```bash
# desde la raíz del repo
grep -rn "@flow:<flow-id>" frontend/e2e/
grep -rn "<the text or testid you plan to assert>" frontend/e2e/
```

Misma forma / distintos valores NO es duplicado — es cobertura real que va
parametrizada en un solo spec, no copiada.

## Outcome classes — what a flow must cover

Each flow declares its required outcome classes in `flow-definitions.json`. Tag
every spec with both `@flow:<id>` and `@outcome:<class>`; a test with no
`@outcome` grants no coverage credit.

| Class | What it covers |
|-------|----------------|
| `success` | The action completes and produces its success state |
| `error` | The action is rejected with a validation or permission message |
| `failure` | The action is attempted and fails server-side (declined payment, 5xx) |
| `display` | Information is viewed in a table, list or detail view |

`display` flows carry two extra requirements, because for them reachability *is*
the behavior under test: arrive by **navigating the UI** (not a deep link), and
assert **real data** (a cell value, a row count against the fixture).

Esquema dual en `flow-definitions.json`: el legacy `expectedSpecs` exige sólo
`success` (`expectedSpecs: 0` = `exempt`, exención deliberada — no es gap);
`outcomes: [...]` exige **cada clase declarada**; un spec sin `@outcome`
acredita a `success`.

### Sintaxis de tags (sin esto no hay crédito)

```ts
test('name', { tag: ['@flow:<id>', '@outcome:<class>'] }, async ({ page }) => { /* … */ });
```

### Ejemplo canónico

Adaptado de `workflows/testing/tests/fixtures/good.e2e.spec.js` (el corpus de
regresión de los detectores). Los helpers cuentan: los detectores los resuelven
(mismo archivo o import relativo).

```ts
// Las interacciones viven en un helper — sigue siendo interacción real.
async function loginAsAdmin(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Log in' }).click();
}

// Falla si el botón Reject deja de registrar el rechazo.
test('rejecting a proposal shows the rejection notice', {
  tag: ['@flow:proposal-respond', '@outcome:success'],
}, async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByRole('alert')).toHaveText('Proposal rejected');
});

// Falla si el form deja de validar el email antes de enviar.
test('submitting an invalid email shows the field error', {
  tag: ['@flow:proposal-respond', '@outcome:error'],
}, async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
});
```

### Auth y sesión

Login helper reutilizable o `storageState` de Playwright. El deep-link es
**legal como setup** fuera de los flows `@outcome:display` — la regla
`deep_link_entry` sólo dispara en display, donde llegar navegando ES el
comportamiento bajo test.

### Clase `failure` = stubbing de red

```ts
await page.route('**/api/pagos', r => r.fulfill({ status: 500 }));
```

…ejecutar la acción por la UI y assertar el mensaje de error visible
(`getByText('No pudimos procesar el pago')`).

### Aislamiento de datos

Nombres/emails únicos por corrida (sufijo `Date.now()`); nunca depender de
datos creados por otro spec.

### Anti-flake

Nunca `waitForTimeout`. Web-first assertions: `await expect(locator)…`
reintenta solo. Para estados async sin locator, `expect.poll`. Ver
§No Hardcoded Timeouts del estándar.

### Jerarquía de selectores

`getByRole` > `getByTestId` > `getByText` — nunca clase CSS ni posición.

### Markers de escape

`allow-no-interaction` · `allow-deep-link` · `allow-render-only` ·
`allow-duplicate` — como `// quality: allow-… (razón)` DENTRO del bloque del
test, razón obligatoria.

## Execution rules

1. Run only the specs you touched: `cd frontend && npx playwright test e2e/path/to/spec.spec.ts`
2. Use `E2E_REUSE_SERVER=1` when the dev server is already running
3. **Quality ceiling beats volume.** The old limit (20 tests / 3 cycles) measured
   output. If the gate reports any junk finding on your batch, stop and fix it
   before writing another test.
4. Bajo `/qa --apply`: dejar los specs **staged, sin commitear** (el conductor
   commitea una vez). En dry-run: describir el diff sin escribir.

## Prioritization

| Priority | Criteria |
|----------|----------|
| 1 | Core journeys (auth, checkout) — `success` **and** `error` |
| 2 | Critical CRUD — mutations must assert the mutation |
| 3 | Contract points between frontend and backend |
| 4 | Failure states (server errors, timeouts) |
| 5 | Display flows and edge cases |

## Abstention is a valid outcome

If a flow has no user-observable behavior to verify, record it as *not testable,
with the reason*, in `docs/USER_FLOW_MAP.md`. Coverage not reached by declared
abstention **is not a failure**. Fabricating a test to close the number is.

## Workflow

1. Read the flow registry (monolith `e2e/flow-definitions.json`, or the
   per-flow shards under `e2e/<flow_definitions_dir>/` if `.testquality.yml`
   declares it) and run the audit desde la raíz del repo:
   `python3 scripts/flow_coverage_audit.py --repo-root .` (the audit reads both
   layouts itself). En repos sharded, `flow-tags.js` es GENERADO — tras agregar
   flows corré `python3 scripts/generate_flow_registry.py --repo-root .`, nunca
   lo edites a mano.
2. Work `junk-only` flows **before** `missing` ones — a flow whose only tests are
   junk is worse than an uncovered one, because it reports green.
3. Look the flow up in `docs/USER_FLOW_MAP.md`; consult
   `docs/TESTING_QUALITY_STANDARDS.md`.
4. Search for an existing test to extend (see above).
5. Implement, satisfying the three-part definition of done.
6. Run only the new or modified specs.
7. Validate:

   ```bash
   bash $HOME/webapps/vps-ops-toolkit/scripts/qa/qa-agent.sh --verify <proyecto> --files=<archivo1,archivo2>
   # equivalente crudo (fallback): python3 scripts/test_quality_gate.py --repo-root . \
   #   --suite frontend-e2e --semantic-rules strict --junk-severity=error --include-file <archivo>
   ```

8. Re-audit and confirm the flow moved to `covered` — o a `partial` si le
   faltan clases (nombrar cuáles): resultado legítimo, no fallo.

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de [[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Re-auditar cobertura de flows | confirma que los flows tocados pasaron a covered/partial | `python3 scripts/flow_coverage_audit.py --repo-root .` |
| Re-correr el gate sobre el lote | valida los specs tocados contra las reglas anti-basura | `bash $HOME/webapps/vps-ops-toolkit/scripts/qa/qa-agent.sh --verify <proyecto> --files=<a,b>` |
| Pasar a escritura | implementar los specs que el análisis dejó descritos | `/frontend-e2e-test-coverage --apply` |

Nunca ofrecer como fila clickeable `--write-junk-baseline` (el baseline sólo se
congela tipeado) ni `/deploy-and-check` (manual-only).

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟢 frontend-e2e-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Audit inicial leído | ✅ | N covered / N partial / N junk-only / N missing / N exempt |
| Flows priorizados | ✅ | junk-only antes que missing, P1/P2 primero |
| Búsqueda anti-duplicado | ✅ | N ya cubiertos → se extendió el test existente |
| Tests agregados | ✅ | N specs con @flow: + @outcome: |
| Definition of done | ✅ | interacción + assert con valor + "qué bug atrapa" |
| Quality gate | ✅ | cero hallazgos junk en los archivos tocados |
| Cobertura re-auditada | ✅ | los flows tocados pasaron a covered (o partial, con las clases faltantes nombradas) |
```

Si un flow quedó sin cobertura por **abstención declarada**, marcarlo ⏭️ con la
razón — no es un fallo. `exempt` (`expectedSpecs: 0`) tampoco es gap. Si el gate
reporta junk en el lote, ❌ y `## Next steps` con el archivo y la regla.

## Next steps
- `python3 scripts/flow_coverage_audit.py --repo-root .` — confirmar el delta
