---
name: test-audit
description: "Audit the whole test corpus for junk tests — specs that raise coverage without verifying behavior. Classifies every finding, decides DELETE / REWRITE / MERGE / KEEP, and applies the cleanup in operator-approved batches. Default dry-run."
argument-hint: "[--check | --apply] [--suite=e2e|unit|backend] [--since=<ref>]"
---

# Test Audit

Audit an entire test corpus and decide **which tests deserve to exist**.

## Why this exists

A manual audit of one fleet project found roughly **a third of the suite was
junk**: tests that raise the coverage number without verifying behavior. This was
not carelessness, it was the incentive. The coverage reporter marked a flow
`covered` as soon as one tagged test passed, the coverage skills asked for 100%,
and the quality gate only checked *form* — so `goto` + `toBeVisible` was the
cheapest legal move. Measured with the junk detectors:

| Signal | Measured |
|---|---|
| E2E tests performing no user interaction | 301 / 966 (31%) |
| Flows whose only coverage is junk (`junk-only`) | 72 |
| Duplicated unit tests | 146 |
| Assertions too weak to fail | 164 |

These figures are from **projectapp (2026-07-24)**; fleet-wide the no-interaction
count is **1152 / 3271 E2E tests (35%)** (`docs/audits/test-junk-audit-2026-07-24.md`).

## Relationship to the other test skills

| Skill | Question it answers |
|---|---|
| [[test-quality-gate]] | How do I raise the gate score on tests I am keeping? |
| [[fix-broken-tests]] | Why is this specific test failing? |
| [[qa]] | Runs this audit as its Phase 6 (junk purge) inside the full QA chain |
| **test-audit** | **Which of these tests should exist at all?** |

Only this skill will conclude that a test should be deleted.

## Invocation

- `/test-audit` — full audit, **report only** (default, writes nothing)
- `/test-audit --check` — explicit alias of the default dry-run (same behavior)
- `/test-audit --apply` — audit, then propose cleanup batches for approval
- `/test-audit --suite=e2e|unit|backend` — restrict the scope
- `/test-audit --since=<ref>` — only tests added since a ref (post-campaign check).
  Not a gate flag: it materializes as
  `git diff --name-only <ref> -- '*test*' '*spec*'`, feeding one repeated
  `--include-file` per changed file into `test_quality_gate.py`.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → ejecutar directo, sin
menú; (2) intención clara en la sesión ("auditá la basura de tests", "aplicá la
limpieza") → proponer el comando en una línea y esperar confirmación; (3) sin
argumentos → UNA sola AskUserQuestion (Q1); (4) nunca en modo fleet/headless/cron
ni como subagente de [[qa]] (Phase 6 del conductor): ahí NUNCA pregunta — hereda
el modo con el que corre el conductor.

**Q1 — Modo** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| --check (Recommended) | dry-run: triage completo DELETE/REWRITE/MERGE/KEEP + reporte, no escribe nada | `/test-audit --check` |
| --apply | borra/reescribe tests POR LOTES con aprobación del operador — es la única skill que concluye que un test debe morir | `/test-audit --apply` |

**Qué NO se pregunta:** `--suite=`, `--since=`, `--json` y `--name-only` son
tuning de alcance y formato — se tipean cuando hacen falta, no van en el picker.

## Phase 0 — Preflight

1. Confirm the repo root and read `.testquality.yml`. If absent, note it: the
   audit runs on canonical defaults and the paths may be wrong.
2. `git status` must be clean, or the changes stashed, **before** any `--apply`.
   Refuse to apply on a dirty tree — the cleanup must be revertible on its own.
3. Resolve the work coordinate before touching anything:
   `bash scripts/maintenance/resolve-work-coordinate.sh --check <project>`
   Staging projects and those with `vps_work` work on the open release PR branch;
   production repos without a redirect take a feature branch off `main`/`master`.

## Phase 1 — Inventory

Count what exists, per layer, so the later percentages mean something.

```bash
python3 scripts/test_quality_gate.py --repo-root . --semantic-rules strict --suite frontend-e2e
python3 scripts/test_quality_gate.py --repo-root . --semantic-rules strict --suite frontend-unit
python3 scripts/test_quality_gate.py --repo-root . --semantic-rules strict --suite backend
python3 scripts/flow_coverage_audit.py --repo-root . --json test-results/flow-audit.json
```

The gate runs over the **whole corpus**, not just changed files — that is the
difference from its normal use.

**If the AST bridge is unavailable** (`@babel/parser` missing on hosts that prune
dev dependencies), the junk detectors still run because they read source. Say so
explicitly in the report: the AST-based rules were skipped.

## Phase 2 — Classify

Sort every finding into one of nine classes.

| # | Class | Signal | Default verdict |
|---|-------|--------|-----------------|
| 1 | **No interaction** | `no_user_interaction` — E2E that never touches the UI | REWRITE, or DELETE if the flow is covered elsewhere |
| 2 | **Lying tag** | `flow_tag_mismatch` — claims an action it does not perform, or mutates without asserting the change | REWRITE |
| 3 | **Weak assertion** | `weak_assertion`, `tautological_selector` — cannot fail | REWRITE |
| 4 | **Duplicate** | `duplicate_coverage` — structurally identical body (a shared name alone is deliberately not a signal) | MERGE into the stronger one |
| 5 | **Tests the mock** | `mock_only_assertion` — asserts the spy was called, never the effect; the escape is `toHaveBeenCalledWith`/`toHaveBeenCalledTimes` | REWRITE |
| 6 | **Reimplements the SUT** | `reimplements_sut` — the expected side recomputes the result with the SUT's own operator (`toBe(a + b)`) | REWRITE to a hand-verified literal |
| 7 | **Deep-link display** | `deep_link_entry` — fires only on `@outcome:display` flows entered via a deep URL instead of navigating the UI | REWRITE |
| 8 | **No data assertion** | `no_data_assertion` — asserts only visibility, so it passes on an empty or wrong dataset | REWRITE |
| 9 | **No subject** | Covers constants, barrels, re-exports, trivial wrappers | DELETE |

> **Only 2 rules DISQUALIFY coverage credit**: `no_user_interaction` and
> `flow_tag_mismatch` (the audit's `DISQUALIFYING_RULES`). The other 7 are
> quality findings — the test still counts as evidence the flow is exercised.
> Batch priority follows: disqualifying classes first (they are what uncovers
> `junk-only` flows), quality classes after.

Two findings that are **not** junk and must not be swept in:

- Tests sharing a shape but asserting **different values** are real coverage that
  should become a `test.each` table. Never merge them — that deletes coverage.
- `toBeVisible()` on a **content-bearing locator** (`getByText('Phase 1')`,
  `getByRole(..., {name})`) IS a data assertion: the expected value lives in the
  locator, so the test fails if the content changes.

## Phase 3 — Triage

For each junk test decide, and record the reason in one line:

- **DELETE** — no behavior is lost. Requires naming the test that still covers
  the behavior, or stating that there is no behavior to cover.
- **REWRITE** — the flow matters but the test does not exercise it. Note the
  interaction and the assertion it needs.
- **MERGE** — a duplicate. Name the survivor.
- **KEEP** — the finding is a false positive. **Record why**, and add the
  matching `quality: allow-*` marker so the gate stops reporting it. Six exist:
  `allow-no-interaction`, `allow-deep-link`, `allow-render-only`,
  `allow-duplicate`, `allow-mock-only`, `allow-reimpl`. The reason in
  parentheses is **mandatory**, and the marker goes **inside the test block**
  it excuses — e.g. `// quality: allow-no-interaction (asserts the API contract; no UI exists)`.

Prioritize `junk-only` flows above everything else: they report green today, so
they are actively misleading, unlike an honestly missing flow.

## Phase 4 — Report

Write `docs/audits/test-audit-<YYYY-MM-DD>.md` with the inventory, the class
breakdown, the triage table, and the before/after coverage figures. Coverage
states are `covered` / `partial` / `junk-only` / `missing` / `exempt` —
`exempt` (`expectedSpecs: 0`) is a deliberate exemption, NOT a gap and not a
cleanup candidate. Then report per [[_output-protocol]].

**In `--check` mode this is the end. Nothing is written to the test corpus.**

## Phase 5 — Apply, in operator-approved batches

Only with `--apply`, and only after the operator approves each batch.

1. Group by class, smallest blast radius first: DELETE-no-subject → MERGE
   duplicates → REWRITE weak assertions → REWRITE no-interaction.
2. Present each batch as a list of `file:line — test name — verdict — reason`
   and **wait for explicit approval of that batch.** Never chain batches.
3. Apply the approved batch and commit it **alone**, so it can be reverted by
   itself. Message: `TEST: audit batch N — <class> (<n> tests)`.
4. After each batch run the affected test files plus the module's regression —
   never the whole suite.
5. Stop on the first regression and report; do not continue to the next batch.

## Phase 6 — Verify

1. Re-run the gate over the touched files: the class just cleaned must be gone.
2. Re-run `flow_coverage_audit.py`. **Coverage will drop, and that is the point:**
   flows previously credited to junk become `missing`. State the before/after
   explicitly so the drop is not read as a regression. `exempt` flows
   (`expectedSpecs: 0`) stay `exempt` — a deliberate exemption, not a gap.
3. Confirm the corpus still passes: run the affected modules, not the suite.

## Guardrails

- **Default is report-only.** Deleting a test is destructive and irreversible in
  review terms; it requires explicit per-batch approval.
- **Never modify production code.** If a test is wrong because the code is wrong,
  report it and stop.
- **Never run the full suite** — touched files plus the affected module only,
  consistent with [[fix-broken-tests]] and [[test-quality-gate]].
- **Never delete a test whose behavior is not covered elsewhere** unless there is
  no behavior to cover. A junk test still marks intent; deleting it silently
  loses the record that the flow was meant to be covered. Register the flow as
  `missing` in `docs/USER_FLOW_MAP.md` before deleting. Exception: if the flow
  is `exempt` (`expectedSpecs: 0`) there is no transition to `missing` — the
  DELETE proceeds and the exemption is noted; do not register it in
  USER_FLOW_MAP as a gap.
- **A false positive is a finding about the rules**, not about the test. Record
  it and report it so the detectors get calibrated.

---

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de [[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Aplicar lotes de limpieza | propone cada lote como lista `file:line — test — verdict — reason` y espera aprobación POR LOTE; un commit aislado por lote | `/test-audit --apply` |
| Re-auditar una suite | re-corre el triage acotado a una capa tras limpiar | `/test-audit --suite=e2e` |

Los DELETE jamás se ofrecen sueltos ni sin evidencia: siempre por lote, con la
lista visible y la aprobación explícita de ese lote (blocklist §4).

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟡 test-audit OK con N warning(s) — 520 tests con señal de basura sobre 5652

### Top 3 acciones prioritarias
1. 72 flows `junk-only` — reportan verde sin cubrir nada (`--apply` batch 4)
2. 146 duplicados unit — MERGE, cero pérdida de cobertura (batch 2)
3. 164 assertions que no pueden fallar (batch 3)

| Dimensión | Estado | Detalle |
|---|---|---|
| Preflight | ✅ | .testquality.yml leído, tree limpio, coordenada resuelta |
| Inventario | ℹ️ | e2e 966 / unit 4686 / backend N tests |
| AST bridge | ⚠️ | no disponible: reglas AST omitidas, detectores sí corrieron |
| Clase 1 sin interacción | ⚠️ | 301 tests → 280 REWRITE / 21 DELETE |
| Clase 2 tag mentiroso | ⚠️ | 168 tests → REWRITE |
| Clase 3 assert débil | ⚠️ | 164 tests → REWRITE |
| Clase 4 duplicados | ⚠️ | 146 tests → MERGE |
| Falsos positivos | ℹ️ | N marcados KEEP con razón + marcador allow-* |
| Cobertura antes/después | ℹ️ | 189 covered → N (los junk-only pasan a missing; los `exempt` con `expectedSpecs: 0` son exención deliberada, no gap ni candidato) |
| Aplicación | ⏭️ | modo --check: no se escribió nada |
```

## Next steps
- `/test-audit --apply` — proponer los lotes de limpieza para aprobación
- (por cada KEEP) agregar DENTRO del bloque del test el marcador que corresponda —
  `allow-no-interaction` / `allow-deep-link` / `allow-render-only` /
  `allow-duplicate` / `allow-mock-only` / `allow-reimpl` — con la razón entre
  paréntesis (obligatoria): `// quality: allow-<marker> (razón)`
