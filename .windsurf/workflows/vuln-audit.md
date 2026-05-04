---
auto_execution_mode: 2
description: Audit & apply patch+minor dependency updates (backend + frontend) with 3 separate commits and a generated audit-report.md
---

# vuln-audit — Vulnerability & Dependency Audit

Replicate the manual `audit-report.md` flow used across the repos: scan vulns + outdated, apply **patch + minor** updates only (no majors), respect pins from `requirements.txt` / `CLAUDE.md`, verify with minimal checks, leave 3 separate commits on the current branch.

**Argument:** `$ARGUMENTS` is optional. Allowed values:
- empty → audit both `backend/` and `frontend/`
- `backend` → Python only
- `frontend` → npm only

## Hard rules
- Work on the current branch. Do **not** create branches, do **not** push.
- Never run `npm audit fix --force`. Never bump across a major (including `0.x → 0.y` with `y > x`).
- Never run the full test suite. Use `pytest --collect-only` + 1 slice.
- Never `git reset --hard`. Never commit with `--no-verify`.
- Do **not** add `Co-Authored-By: Claude` or any AI-generated footer to commits.

## Step 0 — Pre-flight

1. Run `git status --porcelain`. If output is non-empty, stop and tell the user the working tree must be clean.
2. Detect surfaces:
   - Frontend present iff `frontend/package.json` exists.
   - Backend present iff `backend/requirements.txt` exists.
3. If `$ARGUMENTS` requests a surface that is not present, stop with a clear message.
4. Detect venv (use the first that exists): `backend/.venv/bin/activate` or `backend/venv/bin/activate`. If neither exists and backend will be audited, stop.
5. Detect base branch: try `origin/main`, then `origin/master`. Capture `BASE_SHA = git merge-base HEAD origin/<base>` (short).
6. Read `CLAUDE.md` and `AGENTS.md` at repo root if present, to capture pin policies and recommended test slices.
7. Set `PROJ = $(basename $(pwd))` for `/tmp` filenames.

## Step 1 — Frontend (skip if `$ARGUMENTS == "backend"` or no frontend)

1. Snapshot:
   ```
   cd frontend
   npm audit --json > /tmp/${PROJ}-npm-audit.json || true
   npm outdated --json > /tmp/${PROJ}-npm-outdated.json || true
   ```
   Note: `npm outdated` exits 1 when packages are outdated — that's expected, not an error.

2. Parse both JSONs. Build:
   - Vulnerability table: `{package, severity, notes}` plus totals by severity.
   - Outdated table: `{current, wanted, latest}`. Mark a row as **skip** if `latest` crosses the major of `current` (including `0.x → 0.y` with `y > x`).

3. Apply updates:
   ```
   npm audit fix
   npx --yes npm-check-updates -u --target minor
   npm install
   ```

4. If `npm install` fails with `ERESOLVE`:
   - Identify the offending package from the error message.
   - Edit `package.json` to roll that single package back to the latest version compatible with current peer deps (typically the previous minor).
   - Run `npm install` again.
   - Record the rollback in the `Rollbacks` section of the report.
   - If the retry fails too, stop with a clear error.

5. Verify:
   ```
   npm audit
   npm run build
   ```
   If `npm run build` fails: if a commit was already made, run `git reset --soft HEAD~1`. Stop and report the failure.

6. Commit (only if `package.json` or `package-lock.json` actually changed):
   ```
   git add frontend/package.json frontend/package-lock.json
   git commit -m "deps(frontend): apply patch+minor updates"
   ```

## Step 2 — Backend (skip if `$ARGUMENTS == "frontend"` or no backend)

1. Activate the venv detected in Step 0:
   ```
   source backend/.venv/bin/activate || source backend/venv/bin/activate
   ```

2. Ensure `pip-audit` is installed:
   ```
   pip show pip-audit >/dev/null 2>&1 || pip install pip-audit
   ```
   If install fails, stop.

3. Snapshot:
   ```
   cd backend
   pip-audit --format json > /tmp/${PROJ}-pip-audit.json
   pip list --outdated --format json > /tmp/${PROJ}-pip-outdated.json
   ```

4. Build the plan:
   - Parse `requirements.txt` to capture the pin operator for each package (`==`, `>=A,<B`, none, etc.).
   - For each outdated package, choose `target` = highest version that does **not** cross the current major **and** respects the pin. If `target == current`, skip.
   - Packages whose vulns require a major bump (or violate a pin) → list them as **remaining** in the report; do not bump them.

5. Apply: edit `requirements.txt` (preserve the operator: `==X` stays `==<new>`; rangers keep their upper bound). Then:
   ```
   pip install -r requirements.txt
   pip-audit --format json > /tmp/${PROJ}-pip-audit-final.json || true
   ```

6. Verify:
   ```
   python manage.py check
   pytest --collect-only -q
   ```
   Run one minimal test slice:
   - If `CLAUDE.md` lists an example test command, use the first one.
   - Else use the first `tests/test_*.py` found via `find . -path '*/tests/test_*.py' | head -1`.
   - If no tests exist, skip the slice and note it in the report.

   If anything fails: if a commit was made, `git reset --soft HEAD~1`. Stop and report.

7. Commit (only if `requirements.txt` actually changed):
   ```
   git add backend/requirements.txt
   git commit -m "deps(backend): apply patch+minor updates"
   ```

## Step 3 — Generate report and commit it

Always run, even if no updates were applied.

1. Write `audit-report.md` at the repo root (overwrite). Use this template (omit sections for surfaces not audited):

   ```markdown
   # Vulnerability Audit & Dependency Update Report

   **Branch:** <current branch>
   **Date:** <YYYY-MM-DD>
   **Base:** <base branch> @ <BASE_SHA>
   **Scope:** patch + minor updates only (no major version bumps)

   ## Summary
   | Surface  | Vulns (initial) | Outdated (initial) |
   |----------|-----------------|--------------------|
   | Frontend | ...             | ...                |
   | Backend  | ...             | ...                |

   ## Frontend — `npm audit` (initial)
   ...
   ## Frontend — `npm outdated` (initial)
   ...
   ## Backend — `pip-audit` (initial)
   ...
   ## Backend — `pip list --outdated` (initial)
   ...

   ## Plan
   ### Frontend
   - ...
   ### Backend
   - ...

   ## Updates Applied
   ### Frontend (commit `deps(frontend): apply patch+minor updates`)
   - <pkg> <old> -> <new>
   - Final `npm audit`: <totals>.
   - Remaining outdated (majors skipped intentionally): ...

   ### Backend (commit `deps(backend): apply patch+minor updates`)
   - <pkg> <old> -> <new>
   - `pip-audit` final: <remaining count> in <N> packages.

   ## Rollbacks
   - <if any, with reason. Otherwise: "None.">

   ## Verification Results
   ### Frontend
   - `npm audit`: ...
   - `npm run build`: ...

   ### Backend
   - `python manage.py check`: ...
   - `pytest --collect-only`: <N tests collected>.
   - Slice: `<command>`: <N passed>.
   ```

2. Commit it:
   ```
   git add audit-report.md
   git commit -m "docs: vulnerability audit report (<YYYY-MM-DD>)"
   ```

## Final output

Print a short summary:
```
vuln-audit completed
- Frontend: <X commits>, <vulns before → after>
- Backend:  <X commits>, <vulns before → after>
- Report:   audit-report.md (commit <SHA>)
```

If aborted: print the reason and any `/tmp` files generated before the abort.
