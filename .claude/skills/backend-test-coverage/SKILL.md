---
name: backend-test-coverage
description: "Backend test coverage — cover untested behavior in models, serializers, views, utils and tasks with tests that would fail if the behavior broke. Coverage is the readout, not the goal."
argument-hint: "[--apply (escribe los tests; default dry-run: describe el diff)] [--files=<a,b> (acota el lote)] [--semantic-rules strict] [--junk-severity=error]"
---

# Backend Test Coverage

> **Cadena:** el conductor [[qa]] corre esta skill como Fase 4 (subagente
> `qa-engineer-backend`, que la precarga vía `skills:`). Invocable suelta para
> trabajo puntual de una capa.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → ejecutar directo, sin
menú; (2) intención clara en la sesión ("cubrí el serializer de pagos") →
proponer el comando en una línea y esperar confirmación; (3) sin argumentos en
sesión interactiva → UNA sola AskUserQuestion (Q1).

> **Invocada como subagente por [[qa]] (el conductor) o en un barrido fleet:
> NUNCA pregunta — hereda el gating del conductor (regla 4 de §4).**

**Q1 — Modo** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Análisis (Recommended) | enumera behaviors sin test y describe el diff propuesto; no escribe archivos | `/backend-test-coverage` |
| Escribir los tests | implementa al DoD de 3 puntos y valida el lote con el gate; bajo `/qa --apply` quedan staged sin commitear | `/backend-test-coverage --apply` |
| Lote acotado | escribe sólo sobre los archivos indicados | `/backend-test-coverage --apply --files=<a,b>` |

**Qué NO se pregunta:** el tuning del gate se tipea (`--files=`, `--suite
backend`, `--semantic-rules`, `--junk-severity=`); `DJANGO_ENV=production` no es
opcional (Execution rules); bajo [[qa]] el modo lo fija el conductor.

## Goal

Cover untested **behavior** across Models, Serializers, Views, Utils and Tasks.

**The goal is not a percentage.** This skill used to say "reach 100% coverage".
A line-coverage target is satisfied by any test that executes the line — which is
how a suite ends up with tests that call a function, assert the mock was called,
and verify nothing. The target is that **every behavior has a test that would
fail if that behavior broke.**

## Definition of done — per test, all three required

1. **Ejecuta el comportamiento real** (la unidad con entrada real, mock sólo en
   fronteras).
2. **Asserta un resultado observable con VALOR CONCRETO** — nunca
   visibilidad/existencia/truthiness.
3. **Nombra el bug que atraparía** — en el docstring. Si no podés escribir esa
   línea, el test no se escribe.

Ejemplo que cumple los tres puntos:

```python
def test_payment_serializer_rejects_negative_amount(self):
    """Falla si el serializer deja de rechazar montos negativos."""
    user = UserFactory()
    self.client.force_authenticate(user=user)

    resp = self.client.post("/api/payments/", {"amount": -100}, format="json")

    assert resp.status_code == 400
    assert "amount" in resp.json()
```

## Before writing: check for an existing test

```bash
grep -rn "def test_.*<behavior>" backend/<app>/tests/
grep -rn "<the function or endpoint you plan to test>" backend/<app>/tests/
```

If the behavior is already covered, **extend that test** rather than adding a
near-copy. Duplicate test NAMES in the same scope are reported by the backend
analyzer; same shape with different values is **not** a duplicate — make it a
`pytest.mark.parametrize` table.

## Prioritization — by risk, not by percentage

| Priority | Criteria | Why |
|----------|----------|-----|
| 1 | Behavior with no test at all | Real exposure |
| 2 | Business rules: validation, permissions, money, state machines | Highest blast radius |
| 3 | Error paths and edge cases of covered functions | Where users hit bugs |
| 4 | Views → Serializers → Models → Utils → Tasks | Business-critical first |

A file at 40% whose uncovered lines are error handling matters more than a file
at 90% whose gap is a `__repr__`.

### Matriz de permisos DRF (obligatoria por vista)

| Caso | Esperado |
|---|---|
| anónimo | 401 |
| autenticado sin permiso | 403 |
| dueño | 200 |
| otro tenant | 404 (si el queryset filtra por tenant) |

Autenticar con `force_authenticate()` (o `APIClient` + login); un caso por fila,
cada uno assertando el status code exacto.

### Recetas de casos negativos (4xx)

- Validación de serializer → `assert resp.status_code == 400` **y** el campo
  exacto en el body (`assert "amount" in resp.json()`).
- Permiso → autenticar el rol equivocado y `assert resp.status_code == 403`.
- No-existe → pk inexistente y `assert resp.status_code == 404`.
- Conflicto de estado → repetir la acción ya aplicada y assertar 409 (o 400,
  según el contrato de la API).

### Datos: factory vs fixture

Factory para payloads variados por-test; fixture para setup compartido caro
(tenant, catálogo). `@pytest.mark.django_db` es el default; `transaction=True`
SÓLO si el test verifica commit/rollback real.

### Tasks (Huey/Celery)

Testear la **función** de la task directo, con entrada real y assert del efecto
(la fila creada, el mail encolado). Mockear sólo `.delay`/`.schedule` en la
vista que la encola — nunca la lógica interna de la task.

## Abstention is a valid outcome

Constants, plain data classes, `__str__`, re-exports and generated migrations
have no behavior worth a test. Record them as *not testable, with the reason*,
rather than fabricating a test to close the number. Coverage not reached by
declared abstention **is not a failure**.

## Per-test checklist

- Name describes ONE specific behavior
- No conditionals or loops in the body (use `pytest.mark.parametrize`)
- Assertions verify observable outcomes, not internal calls
- Deterministic: no real clock, no network, no ordering assumptions
  (`freeze_time` at class level is supported by the gate):

  ```python
  @freeze_time("2026-01-15")
  def test_report_uses_the_frozen_business_date(self): ...
  ```
- Isolated: no dependence on another test having run
- Mocks have explicit `return_value` / `side_effect`
- AAA: Arrange → Act → Assert

## Execution rules

1. Work from the backend: `cd backend && source venv/bin/activate`
2. Run only the files you touched, from `backend/`, with the production selector
   so the engine matches (rule 4): `DJANGO_ENV=production pytest path/to/test_file.py -v`
3. **Quality ceiling beats volume:** if the gate reports a backend finding on
   your batch — `nondeterministic`, `network_dependency`,
   `mock_call_contract_only`, `inline_payload`, `global_state_mutation` — stop
   and fix it before writing another test.
4. **Engine check before any DB work.** `projects.yml` declares the engine in
   `db:`. For a `db: mysql` project run `manage.py` and `pytest` with
   `DJANGO_ENV=production` from the project's `backend/`, so Django connects to
   MySQL and not the sqlite fallback.
5. Bajo `/qa --apply`: dejar los tests **staged, sin commitear** (el conductor
   commitea una vez). En dry-run: describir el diff sin escribir.

## Workflow

1. **Enumerate untested behaviors from the code** — walk Models, Serializers,
   Views, Utils and Tasks and list what each one *does* (validations, permissions,
   money, state transitions, error paths). The code is the entry point.
2. Pick by risk (table above), not by lowest percentage. Use the coverage report
   only as a *secondary readout* — to confirm which enumerated behavior has no line
   hit; a covered line with a weak assertion is still an untested behavior.
3. Consult `docs/TESTING_QUALITY_STANDARDS.md` — especially §Behavior-First
   Assertions and §Deterministic Tests.
4. Search for an existing test to extend.
5. Implement, satisfying the three-part definition of done.
6. Run only the new or modified files.
7. Validate:

   ```bash
   bash $HOME/webapps/vps-ops-toolkit/scripts/qa/qa-agent.sh --verify <proyecto> --files=<archivo1,archivo2>
   # equivalente crudo (fallback): python3 scripts/test_quality_gate.py --repo-root . \
   #   --suite backend --semantic-rules strict --junk-severity=error --include-file <archivo>
   ```

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de [[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Re-correr el gate sobre el lote | valida los archivos tocados contra las reglas anti-basura | `bash $HOME/webapps/vps-ops-toolkit/scripts/qa/qa-agent.sh --verify <proyecto> --files=<a,b>` |
| Correr sólo los tests nuevos | con el selector de producción, desde `backend/` | `DJANGO_ENV=production pytest <archivos> -v` |
| Pasar a escritura | implementar los tests que el análisis dejó descritos | `/backend-test-coverage --apply` |

Nunca ofrecer como fila clickeable `--write-junk-baseline` (el baseline sólo se
congela tipeado) ni `/deploy-and-check` (manual-only).

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟢 backend-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Comportamientos enumerados desde el código | ✅ | N behaviors sin test identificados |
| Priorizado por riesgo | ✅ | reglas de negocio y error paths primero |
| Búsqueda anti-duplicado | ✅ | N ya cubiertos → se extendió el existente |
| Tests agregados | ✅ | N tests con assert de valor concreto |
| Definition of done | ✅ | unidad real + outcome observable + "qué bug atrapa" |
| Abstenciones declaradas | ℹ️ | N archivos sin comportamiento testeable, con razón |
| Quality gate | ✅ | cero nondeterministic / network_dependency / mock_call_contract_only / inline_payload / global_state_mutation |
```

Cobertura no alcanzada por **abstención declarada** se marca ⏭️ con la razón —
no es un fallo.
