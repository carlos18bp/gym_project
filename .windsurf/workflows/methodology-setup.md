---
description: Initialize or refresh the Memory Bank methodology system for a project
---

# Methodology Setup / Refresh

This workflow initializes or refreshes the Memory Bank system based on [rules_template](https://github.com/Bhartendu-Kumar/rules_template).

---

## When to Use

- **New project**: First-time setup of the Memory Bank system
- **Refresh**: After major feature additions, when counts drift, or after methodology updates

---

## Step 1: Ensure Directory Structure

```bash
mkdir -p docs/methodology
mkdir -p docs/literature
mkdir -p tasks/rfc
mkdir -p .windsurf/rules/methodology
```

## Step 2: Verify Methodology Rules Exist

Check that these 8 files exist in `.windsurf/rules/methodology/`:

| File | Trigger | Purpose |
|------|---------|---------|
| `rules.md` | always_on | General rules |
| `memory.md` | always_on | Memory file system definition |
| `directory-structure.md` | always_on | Project directory map |
| `plan.md` | model_decision | Planning workflow |
| `implement.md` | model_decision | Implementation workflow |
| `debug.md` | model_decision | Debugging workflow |
| `error-documentation.md` | model_decision | Known issues and error tracking |
| `lessons-learned.md` | model_decision | Project intelligence and patterns |

If missing, fetch from [rules_template](https://github.com/Bhartendu-Kumar/rules_template) `.cursor/rules/` and adapt:
- Rename `.mdc` → `.md`
- Replace `mdc:` prefix links with standard markdown paths
- Replace `src/` references with actual project directories (`backend/`, `frontend/`, etc.)
- Replace `.cursor/rules/` references with `.windsurf/rules/methodology/`
- Update frontmatter: replace `globs:` / `alwaysApply:` with `trigger:` format

## Step 3: Deep-Dive Codebase

// turbo
Run verification commands to get exact counts:

```bash
# Model files
find backend/gym_app/models/ -name "*.py" ! -name "__init__.py" | wc -l

# Model classes
grep -r "^class " backend/gym_app/models/ --include="*.py" | wc -l

# View files
find backend/gym_app/views/ -name "*.py" ! -name "__init__.py" | wc -l

# Backend tests
find backend/gym_app/tests/ -name "test_*.py" | wc -l

# URL patterns
grep -c "path(" backend/gym_app/urls.py

# Email/PDF templates
find backend/gym_app/templates/ -type f | wc -l

# Management commands
find backend/gym_app/management/commands/ -name "*.py" ! -name "__init__.py" | wc -l

# Service files
ls -la backend/gym_app/services/

# Components
find frontend/src/components/ -name "*.vue" | wc -l

# Views (pages)
find frontend/src/views/ -name "*.vue" | wc -l

# Stores
find frontend/src/stores/ -name "*.js" ! -path "*/services/*" | wc -l

# Composables
find frontend/src/composables/ -name "*.js" | wc -l

# Frontend unit tests
find frontend/test/ -name "*.test.*" | wc -l

# E2E tests
find frontend/e2e/ -name "*.spec.*" | wc -l
```

## Step 4: Create / Refresh Memory Files

Update or create the 7 core memory files with verified data:

| # | File | Content |
|---|------|---------|
| 1 | `docs/methodology/product_requirement_docs.md` | PRD: overview, problems, features, users, business rules |
| 2 | `docs/methodology/technical.md` | Stack versions, dev setup, env config, design patterns, testing strategy, project structure tree |
| 3 | `docs/methodology/architecture.md` | Mermaid diagrams: system overview, dev architecture, request flow, ER diagram, service layer, page routing, store architecture, async tasks, deployment |
| 4 | `tasks/tasks_plan.md` | Feature status, known issues, testing status with exact counts, documentation status |
| 5 | `tasks/active_context.md` | Current state, recent focus, active decisions, verified metrics, next steps |
| 6 | `.windsurf/rules/methodology/error-documentation.md` | Error tracking template |
| 7 | `.windsurf/rules/methodology/lessons-learned.md` | Architecture patterns, code conventions, deployment, testing insights |

## Step 5: Cross-Reference

After creating/updating all files, verify every claim matches the codebase:
- Model counts match `find` output
- Component/page/store counts match `find` output
- Test file counts match `find` output
- FK relationships match model source code
- URL pattern counts match `grep` output

Fix any discrepancies found.

## Step 6: Configure Windsurf Settings

Go to **Windsurf → Settings → Cascade → Rules** and verify triggers match:

| File | Expected Mode |
|------|--------------|
| `methodology/rules.md` | Always On |
| `methodology/memory.md` | Always On |
| `methodology/directory-structure.md` | Always On |
| `methodology/plan.md` | Model Decision |
| `methodology/implement.md` | Model Decision |
| `methodology/debug.md` | Model Decision |
| `methodology/error-documentation.md` | Model Decision |
| `methodology/lessons-learned.md` | Model Decision |
