---
name: methodology-setup
description: "Initialize or refresh Azurita memory-bank files when the user asks for it or when verified repo/runtime guidance has drifted after major changes."
---

# Methodology Setup / Refresh

## When To Use
- The user explicitly asks to update memory files.
- Project structure, runtime surfaces, or recurring workflow guidance changed materially.
- The existing memory files are obviously stale and the task requires refreshing them.

## Workflow
1. Read the current memory files before changing them.
2. Inspect the real codebase and count or verify only the facts you update.
3. Update only the relevant memory files; do not churn unrelated sections.
4. Keep runtime guidance aligned with the actual repo layout:
   - `AGENTS.md` scopes
   - `.agents/skills/*`
   - `.codex/config.toml`
   - compatibility surfaces under `.claude/` and `.windsurf/` when they matter

## Core Files
- `docs/methodology/product_requirement_docs.md`
- `docs/methodology/technical.md`
- `docs/methodology/architecture.md`
- `docs/methodology/error-documentation.md`
- `docs/methodology/lessons-learned.md`
- `tasks/tasks_plan.md`
- `tasks/active_context.md`
