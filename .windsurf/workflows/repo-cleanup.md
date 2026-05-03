---
description: Systematic audit for obsolete, deprecated, orphaned, or unnecessary files — produces a prioritized cleanup report before any deletions
auto_execution_mode: 2
---

# Repo Cleanup — Systematic File Audit

## Goal
Scan the repository for files that should be deleted, updated, or added to `.gitignore`. Produce a prioritized action list the user can approve before any destructive operation.

## What To Search For

### 1. Build & Test Artifacts Tracked in Git
- Coverage reports (`*.json`, `*.xml`, `*.lcov`, `htmlcov/`)
- Test result logs, screenshots, or trace files
- Compiled/transpiled output (`.pyc`, `__pycache__/`, `.nuxt/`, `.output/`, `dist/`)
- Lock files or `node_modules/` committed by mistake
- Database dumps, `.sqlite3` files, or SQL scripts that were one-time use

### 2. Dead Code & Unused Source Files
- Backend: Python modules not imported anywhere (check with `grep -r` for the module/function name)
- Frontend: Vue components, composables, stores, or utilities not imported in any file
- Test files for source code that no longer exists
- Management commands that were one-off scripts

### 3. Backup & Temporary Files
- Files with suffixes: `_old`, `_backup`, `_copy`, `.bak`, `.orig`, `.tmp`
- Files with prefixes: `tmp_`, `temp_`, `debug_`
- Misspelled or duplicate filenames
- Demo/seed data files left in the project root

### 4. Orphaned Configuration
- Config files for tools no longer in the project (e.g., old linter configs, unused Docker files)
- Lock files at the wrong directory level (e.g., root `package-lock.json` when frontend has its own)
- Empty directories tracked by git

### 5. .gitignore Gaps
- Files that are tracked but match patterns that _should_ be in `.gitignore`
- Patterns in `.gitignore` that are too narrow and miss variants (e.g., `tmp_cov*.json` but not `cov*.json`)

### 6. Stale Documentation
- Docs that reference outdated stack names, removed features, or superseded standards
- Duplicate documentation covering the same topic in different files
- Empty or near-empty doc files

## Workflow

### Phase 1 — Inventory
1. List the full project tree (directories only, then key file types).
2. Run `git ls-files` to get the canonical list of tracked files.
3. Cross-reference tracked files against `.gitignore` patterns to find mismatches.
4. Identify files by age: `git log --diff-filter=A --format='%ai' -- <file>` for files that haven't changed since creation.

### Phase 2 — Dead Code Detection
5. For each composable, store, utility, and component in `frontend/`:
   - `grep -r "<name>" frontend/` excluding the file itself and its test.
   - If zero external references, flag as potentially unused.
6. For each non-standard Python module in `backend/` (exclude models, views, serializers, migrations, admin, urls, apps, conftest, tests):
   - `grep -r "<module_name>" backend/` excluding the file itself.
   - If zero external references, flag as potentially unused.

### Phase 3 — Artifact Detection
7. Search for large files that look like generated output:
   ```bash
   git ls-files -z | xargs -0 ls -la --sort=size 2>/dev/null | tail -30
   ```
8. Search for files matching artifact patterns:
   ```bash
   git ls-files | grep -iE '\.(bak|orig|tmp|old|backup|copy|log)$'
   git ls-files | grep -iE '(debug_|tmp_|temp_|_backup|_old|_copy)\.'
   ```
9. Look for coverage/test artifacts in unexpected locations:
   ```bash
   git ls-files | grep -iE '(coverage|cov_|test-results|test-reports)\.'
   ```

### Phase 4 — Report
10. Classify every finding into one of these categories:

| Priority | Category | Action |
|----------|----------|--------|
| HIGH | Tracked artifacts (coverage, builds, dumps) | `git rm` + update `.gitignore` |
| HIGH | Files containing secrets or credentials | Immediate removal |
| MEDIUM | Unused source code (dead imports) | Delete file + its test |
| MEDIUM | Orphaned configs or root-level leftovers | Delete |
| LOW | Stale documentation | Flag for review |
| LOW | Empty directories | Remove |

11. Present findings as a table with: file path, size, last modified, category, recommended action.

## Rules
- **Read-only until user approves.** Do not delete, edit, or move any file during the audit. Present the report and wait for confirmation.
- Do not flag files in `.agents/`, `.claude/`, `.windsurf/`, or `.codex/` as obsolete — these are intentional multi-tool compatibility layers.
- Do not flag Django migrations as obsolete unless they are clearly broken merge migrations.
- Do not flag `__init__.py` files as empty/unnecessary — they mark Python packages.
- Verify dead code claims: a file is only "unused" if it has zero imports AND is not referenced in URL configs, management commands, or template tags.
- When recommending `.gitignore` updates, show the exact lines to add.

## Output Contract
Return a structured report with:
1. **Summary** — total files audited, total findings, total reclaimable size.
2. **Action items** — grouped by priority (HIGH → LOW), each with file path, reason, and recommended command.
3. **`.gitignore` patch** — exact additions needed.
4. **No action needed** — brief confirmation that the rest of the repo is clean.
