---
description: Audit the whole test corpus for junk tests — specs that raise coverage without verifying behavior. Classifies every finding, decides DELETE / REWRITE / MERGE / KEEP, and applies the cleanup in operator-approved batches. Default dry-run.
auto_execution_mode: 2
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

## Relationship to the other test skills

| Skill | Question it answers |
|---|---|
| [[test-quality-gate]] | How do I raise the gate score on tests I am keeping? |
| [[fix-broken-tests]] | Why is this specific test failing? |
| **test-audit** | **Which of these tests should exist at all?** |

Only this skill will conclude that a test should be deleted.

## Invocation

- `/test-audit` — full audit, **report only** (default, writes nothing)
- `/test-audit --apply` — audit, then propose cleanup batches for approval
- `/test-audit --suite=e2e|unit|backend` — restrict the scope
- `/test-audit --since=<git-ref>` — only tests added since a ref (post-campaign check)

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

Sort every finding into one of seven classes.

| # | Class | Signal | Default verdict |
|---|-------|--------|-----------------|
| 1 | **No interaction** | `no_user_interaction` — E2E that never touches the UI | REWRITE, or DELETE if the flow is covered elsewhere |
| 2 | **Lying tag** | `flow_tag_mismatch` — claims an action it does not perform, or mutates without asserting the change | REWRITE |
| 3 | **Weak assertion** | `weak_assertion`, `tautological_selector` — cannot fail | REWRITE |
| 4 | **Duplicate** | `duplicate_coverage` — identical body, or repeated name in one file | MERGE into the stronger one |
| 5 | **Tests the mock** | `mock_call_contract_only` — asserts a spy was called and nothing else | REWRITE |
| 6 | **Implementation-coupled** | `implementation_coupling`, `wrapper.vm.*` | REWRITE |
| 7 | **No subject** | Covers constants, barrels, re-exports, trivial wrappers | DELETE |

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
  `quality: allow-*` marker with the reason so the gate stops reporting it.

Prioritize `junk-only` flows above everything else: they report green today, so
they are actively misleading, unlike an honestly missing flow.

## Phase 4 — Report

Write `docs/audits/test-audit-<YYYY-MM-DD>.md` with the inventory, the class
breakdown, the triage table, and the before/after coverage figures. Then report
per [[_output-protocol]].

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
   explicitly so the drop is not read as a regression.
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
  `missing` in `docs/USER_FLOW_MAP.md` before deleting.
- **A false positive is a finding about the rules**, not about the test. Record
  it and report it so the detectors get calibrated.

---

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
| Cobertura antes/después | ℹ️ | 189 covered → N (los junk-only pasan a missing) |
| Aplicación | ⏭️ | modo --check: no se escribió nada |
```

## Next steps
- `/test-audit --apply` — proponer los lotes de limpieza para aprobación
- (por cada KEEP) agregar `// quality: allow-<regla> (razón)` al test
