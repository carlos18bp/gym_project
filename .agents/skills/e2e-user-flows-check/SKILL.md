---
name: e2e-user-flows-check
description: "User flow mapping — walk every view, module and component and enumerate the real user interactions in four outcome classes (success, error, failure, display), then map each to a qualifying E2E test and report the gaps."
---

# User Flow Map — per view, per outcome

You are a Senior QA/Product Analyst. Your mission is to produce a **complete map
of the real interactions a user can perform**, view by view, and to identify
which of them no qualifying test exercises.

## What changed and why

This skill used to enumerate flows from product docs and route lists. That
produced a flat inventory dominated by "view X exists" entries, which is exactly
the shape that gets closed with a `goto` + `toBeVisible` spec. An audit found
**72 flows whose only coverage was a test that never interacted with the UI**,
and **8 modules with no error or failure flow at all** — mapped entirely on the
happy path.

The unit of the map is therefore no longer "a view". It is **an interaction with
an outcome**.

## The four outcome classes

For **every view, module and component**, enumerate all four. A module that
declares only `success` has not been analyzed — it has been skimmed.

| Class | What to enumerate | Example |
|-------|-------------------|---------|
| `success` | Actions that complete and produce a success state or message | Submit the form → "Saved" appears, row added |
| `error` | Actions that produce a validation or permission error message | Submit empty → field errors; non-admin opens admin URL → denied |
| `failure` | Actions attempted that fail server-side | Payment declined, upload rejected, 5xx handled, timeout |
| `display` | Information that can be viewed: tables, lists, detail views, empty states | Invoice table lists the milestones; empty state when there are none |

Rules that keep the map honest:

- **Every entry must be an action a user can actually perform in the browser.**
  If a real user cannot do it through the UI, it is not an E2E flow — it belongs
  in a unit or integration test. Record it as such and move on.
- **`display` flows carry two extra requirements**, because for them
  reachability *is* the behavior: the test must arrive by **navigating the UI**
  (not a deep link) and assert **real data** (a cell value, a row count against
  the fixture), never bare visibility.
- **Do not invent flows.** Everything traceable to a route, component, endpoint
  or doc. If unclear, ask.

## Phases

### Phase 0 — Scope
Identify roles/personas and modules. Confirm boundaries with the operator.

### Phase 1 — Source inventory
Collect evidence: UI routes, view/page components, forms and their validation,
backend endpoints (including their error responses), product docs, existing
specs. Endpoint error responses are the best source for the `failure` class.

### Phase 2 — Per-view interaction matrix
For **each view / module / component**, produce a row per interaction:

| View | Interaction | Class | Role | Start → steps → end state |
|------|-------------|-------|------|---------------------------|

Walk the four classes explicitly for each view. Where a class genuinely does not
apply (a static legal page has no `failure`), write `n/a` **with the reason** —
an empty cell is indistinguishable from an unanalyzed one.

### Phase 3 — Normalize
Merge duplicates, split flows that bundle several interactions, assign priority
P1–P4. One flow = one interaction with one outcome class.

### Phase 4 — Coverage mapping
Run the audit, which grants credit only to qualifying tests:

```bash
python3 scripts/flow_coverage_audit.py --repo-root . --json test-results/flow-audit.json
```

Map each interaction to `covered` / `partial` / **`junk-only`** / `missing`.
`junk-only` means tests exist but none exercise the flow — treat it as worse than
`missing`, because it reports green today.

### Phase 5 — Gaps and risks
Report, in this order: `junk-only` flows, missing P1/P2, missing `error` and
`failure` classes by module, then everything else.

### Phase 6 — Register
Write the map to **both**:

1. `docs/USER_FLOW_MAP.md` — the narrative map, one section per view
2. `frontend/e2e/flow-definitions.json` — the machine-readable inventory, using
   the outcomes schema:

```json
"admin-blog-delete": {
  "name": "Delete Blog Post",
  "module": "admin",
  "roles": ["admin"],
  "priority": "P2",
  "description": "Admin deletes a post from the blog list and confirms.",
  "outcomes": ["success", "error", "display"]
}
```

`outcomes` replaces the old `expectedSpecs`. Under the old field a flow counted
as covered once any single tagged test passed; under `outcomes` each declared
class needs its own qualifying test.

### Phase 7 — Output
1. The per-view interaction matrix
2. Gap list with suggested flow ids and priority
3. Modules missing whole outcome classes
4. Open questions

---

## Output final

Reportar siguiendo [[_output-protocol]]. Una fila por vista/módulo auditado:

```markdown
🟡 e2e-user-flows-check OK con N warning(s)

| Dimensión | Estado | Detalle |
|---|---|---|
| Login / registro | ⚠️ | success ✅ · error ❌ falta · failure ❌ falta · display n/a |
| Blog admin | ⚠️ | delete es junk-only (test no interactúa) |
| Facturación | ✅ | 4 clases cubiertas con tests calificados |
| ... (una fila por vista, con el estado de las 4 clases) | | |
```

Cerrar con el conteo agregado (interacciones totales / cubiertas / junk-only /
faltantes), el desglose por clase de outcome, y la confirmación de que el mapa
quedó registrado en `docs/USER_FLOW_MAP.md` + `flow-definitions.json`.

Si la tabla supera 15 filas, anteponer `### Top 3 acciones prioritarias` con los
`junk-only` y los P1 sin cobertura.

## Next steps
- (por cada `junk-only`) reescribir el spec para que ejecute el flujo — es
  prioritario sobre cualquier flow `missing`, porque hoy reporta verde
- (por cada clase faltante) `npx playwright codegen <url>` para el flujo nuevo
- `python3 scripts/flow_coverage_audit.py --repo-root .` — confirmar el delta
