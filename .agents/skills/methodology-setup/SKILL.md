---
name: methodology-setup
description: "Initialize or refresh the Memory Bank methodology system. Creates directory structure and populates 7 core memory files with verified codebase data. Use for new projects or when memory files need updating."
---

# Methodology Setup / Refresh

## When to Use

- **New project**: First-time setup of the Memory Bank system
- **Refresh**: After major feature additions, when counts drift, or after methodology updates
- **Chained**: the [[qa]] conductor runs this as its Phase 1 (product understanding) when `docs/methodology/` is missing or stale

## Step 1: Ensure Directory Structure

```bash
mkdir -p docs/methodology
mkdir -p docs/literature
mkdir -p tasks/rfc
```

## Step 2: Deep-Dive Codebase

Run verification commands to get exact counts (stack-agnostic — works on Vue/Nuxt and React/Next layouts):

```bash
# Models
find backend/ -name "*.py" -path "*/models*" ! -name "__init__.py" -not -path "*/venv/*" | wc -l

# Components (Vue or React/Next)
find frontend/components frontend/app frontend/src -type f \( -name '*.vue' -o -name '*.tsx' -o -name '*.jsx' \) 2>/dev/null | grep -v node_modules | wc -l

# Pages / routes (pages/ = Vue/Nuxt · app/ = Next App Router — count whichever exists)
[ -d frontend/pages ] && find frontend/pages -name '*.vue' | wc -l
[ -d frontend/app ] && find frontend/app -name 'page.*' -not -path '*/node_modules/*' | wc -l

# State / stores
[ -d frontend/stores ] && find frontend/stores -name '*.js' -o -name '*.ts' | wc -l || echo "0 (sin stores/ — estado colocado o context)"

# Composables / hooks (composables/ = Vue · lib/hooks/ = Next)
{ [ -d frontend/composables ] || [ -d frontend/lib/hooks ]; } && find frontend/composables frontend/lib/hooks -type f \( -name '*.js' -o -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | wc -l || echo "0 (sin composables/ ni hooks/)"

# Backend tests
find backend/ -name "test_*.py" -not -path "*/venv/*" | wc -l

# Frontend unit tests (recursive — same pattern as qa-agent.sh)
find frontend -type f \( -name '*.test.*' -o -name '*.spec.*' \) -not -path '*/node_modules/*' -not -path '*/e2e/*' | wc -l

# E2E tests
[ -d frontend/e2e ] && find frontend/e2e -name '*.spec.*' | wc -l || echo 0

# URL patterns (every urls.py, no hardcoded app names)
for u in $(find backend -name urls.py -not -path "*/venv/*"); do echo "$u: $(grep -c 'path(' "$u")"; done

# Service layer (if present)
find backend -maxdepth 3 -type d -name services -not -path "*/venv/*" -exec ls -la {} \;
```

## Step 3: Create / Refresh Memory Files

Update or create the 7 core memory files with verified data:

| # | File | Content |
|---|------|---------|
| 1 | `docs/methodology/product_requirement_docs.md` | PRD: overview, problems, features, users, business rules |
| 2 | `docs/methodology/technical.md` | Stack versions, dev setup, env config, design patterns, testing strategy |
| 3 | `docs/methodology/architecture.md` | Mermaid diagrams: system overview, request flow, ER diagram, deployment |
| 4 | `tasks/tasks_plan.md` | Feature status, known issues, testing status with exact counts |
| 5 | `tasks/active_context.md` | Current state, recent focus, active decisions, next steps |
| 6 | `docs/methodology/error-documentation.md` | Error tracking |
| 7 | `docs/methodology/lessons-learned.md` | Architecture patterns, code conventions, deployment, testing insights |

## Step 4: Cross-Reference

Verify every claim matches the codebase:
- Model counts match `find` output
- Component/page/store counts match
- Test file counts match
- FK relationships match model source code
- URL pattern counts match

Fix any discrepancies found.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de
`/methodology-setup`:

```markdown
🟢 methodology-setup OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Estructura de directorios | ✅ | docs/methodology, docs/literature, tasks/rfc creados |
| Deep-dive codebase (conteos) | ✅ | counts exactos: models, componentes, pages, estado (stores/hooks según stack), tests |
| 7 memory files creados/refrescados | ✅ | PRD, technical, architecture, tasks_plan, active_context… |
| Cross-reference vs código | ✅ | claims verificados con find/grep, discrepancias corregidas |
```

Si algún conteo declarado no matchea `find`/`grep`, o un memory file quedó
sin refrescar, reemplazar el ✅ por ⚠️/❌, omitir la línea ✨ y agregar
`## Next steps` con el archivo y el comando de verificación exacto.

## Next steps (si aplica)
- (manual, operador) revisar `tasks/active_context.md` — foco actual y next steps
- re-correr esta skill tras features grandes o cuando los conteos driften
