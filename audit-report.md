# Vulnerability Audit & Dependency Update Report

**Branch:** `chore/26082026-cffi-safe-update`
**Date:** 2026-08-26
**Base:** `release-september-2026-c` @ `f17c4e65ada75e2c0e56dea6a0558925622cd7b0`
**Scope:** backend only; patch + minor updates only (no major version bumps)

> **Major follow-ups (2026-08-27):** package-specific evaluations advance
> `pytest-cov` 6.3.0 to 7.1.0 and `Faker` 25.9.2 to 40.37.0. The original
> 2026-08-26 snapshot and remediation history below remain unchanged; each
> follow-up records its current dependency count and verification separately.

## Summary

| Surface | Vulns (initial) | Outdated (initial) | Vulns (final) |
|---|---:|---:|---:|
| Backend | 0 across 122 installed dependencies | 36 installed packages | 0 across 92 packages in the isolated verification environment |

The backend had no known vulnerabilities before this update. The only safe,
direct and installable in-policy update was `cffi` 2.0.0 -> 2.1.1. The update
keeps the dependency graph valid and preserves the existing cryptography and
PDF-signing imports.

---

## Backend — `pip-audit` (initial)

Source: `/tmp/gym_project_staging-pip-audit.json`

| Package | Current | Vulns | Min in-major fix |
|---|---:|---:|---|
| — | — | 0 | No remediation required |

**Totals:** 0 critical / 0 high / 0 moderate / 0 low findings across 122
installed dependencies.

## Backend — `pip list --outdated` (initial)

Source: `/tmp/gym_project_staging-pip-outdated.json`

The initial snapshot contained 36 outdated installed packages: 29 exact-pinned
application dependencies and 7 transitive or environment-tooling packages.

### In-policy direct candidates

| Package | Current | In-policy target | Decision |
|---|---:|---:|---|
| `cffi` | 2.0.0 | 2.1.1 | Applied; isolated resolver and runtime checks passed |
| `svglib` | 1.5.1 | 1.6.0 | Held; adds `rlpycairo`/`pycairo`, but the host lacks Cairo development support |

### Direct major lines intentionally skipped

The following 27 direct pins only have newer releases outside the patch/minor
policy. For 0.x packages, a minor-line change is treated as a policy-major.

- `cachetools` 5.5.2 -> 7.1.7
- `certifi` 2024.12.14 -> 2026.7.22
- `chardet` 5.2.0 -> 7.6.0
- `cssselect2` 0.8.0 -> 0.9.0
- `Django` 5.2.17 -> 6.1
- `django-cleanup` 8.1.0 -> 9.0.0
- `django-dbbackup` 4.3.0 -> 5.3.0
- `Faker` 25.9.2 -> 40.37.0
- `gunicorn` 23.0.0 -> 26.2.0
- `huey` 2.6.0 -> 3.3.4
- `opencv-python-headless` 4.14.0.94 -> 5.0.0.93
- `packaging` 24.2 -> 26.3
- `pandas` 2.3.3 -> 3.0.5
- `pycparser` 2.23 -> 3.0
- `pydyf` 0.11.0 -> 0.12.1
- `pyHanko` 0.25.3 -> 0.36.2
- `pyhanko-certvalidator` 0.26.8 -> 0.31.4
- `pyphen` 0.17.2 -> 0.18.1
- `pytest-cov` 6.3.0 -> 7.1.0
- `pytz` 2025.2 -> 2026.3.post1
- `redis` 5.3.1 -> 8.1.0
- `reportlab` 4.5.1 -> 5.0.1
- `termcolor` 2.5.0 -> 3.3.0
- `tzdata` 2025.3 -> 2026.3
- `uritools` 4.0.3 -> 6.1.3
- `webencodings` 0.5.1 -> 0.6.1
- `zopfli` 0.2.3.post1 -> 0.4.3

### Transitive and environment tooling

`distlib`, `filelock`, `platformdirs`, `pre-commit`, `python-discovery`, `ruff`
and `virtualenv` were observed in the staging virtualenv but are not direct pins
in `backend/requirements.txt`. They were not added or mutated by this scoped
application update. Tooling updates should be managed with the environment that
owns them; `ruff` also requires staying on its 0.15.x line under this policy.

---

## Plan

### Backend

- Update the exact pin `cffi==2.0.0` to `cffi==2.1.1`.
- Keep `svglib==1.5.1` until Cairo development support is deliberately added
  and its native build is validated in the deployment environment.
- Defer the 27 major-line upgrades to package-specific compatibility plans.
- Do not promote transitive or environment tooling into application pins.

## Updates Applied

### Backend (commit `deps(backend): apply patch+minor updates`)

- `cffi` 2.0.0 -> 2.1.1.
- Final `pip-audit`: 0 known vulnerabilities across the 92 packages installed
  from the updated application requirements.
- Remaining direct outdated packages: 28 (27 skipped major lines plus
  `svglib`, held for the missing native Cairo toolchain).

## Rollbacks

- None. `svglib` was not changed: candidate-resolution discovery showed that
  1.6.0 introduces `pycairo`, whose metadata/build step cannot complete because
  `pkg-config cairo` and the Cairo development headers are absent on this host.

## Verification Results

### Backend

- Fresh Python 3.12 isolated virtualenv + full `requirements.txt` installation:
  success; the staging runtime virtualenv was not modified.
- `python -m pip check`: no broken requirements found.
- `pip-audit --path <isolated-site-packages>`: no known vulnerabilities found.
- Runtime smoke: `cffi==2.1.1`, RSA sign/verify with `cryptography`, and
  `pyHanko` import all passed.
- `python manage.py check`: no issues (0 silenced).
- `pytest --collect-only -q`: 3,187 tests collected, 0 collection errors.
- Slice: `pytest gym_app/tests/views/test_health.py -q`: 11 passed.
- No migrations or database-writing management commands were run.

---

## Major Follow-up — `pytest-cov` 7.1.0 (2026-08-27)

### Decision

- Applied `pytest-cov` 6.3.0 -> 7.1.0 in isolation; no other dependency pin changed.
- Kept `.coveragerc` unchanged. Version 7 removes automatic Python subprocess
  instrumentation, but this repository's subprocess-based tests execute Node
  tooling and CI measures only `gym_app`.
- Current remaining direct outdated dependencies: 27 (26 major-line skips plus
  the held `svglib` 1.6.0 candidate).

### Verification

- Clean Python 3.12 venv + full `requirements.txt`: success.
- `pip check`: no broken requirements.
- `python manage.py check`: no issues (0 silenced).
- `pytest --collect-only -q`: 3,187 tests collected, 0 collection errors.
- CI-style health slice with xdist and terminal/XML/JSON reports: 11 passed.
- Coverage parity vs 6.3.0: 10,877 statements, 3,441 covered lines, 2,918
  branches, 2 covered branches and 25% displayed coverage in both runs.
- `pip-audit`: 0 known vulnerabilities across 92 packages in the isolated venv.

---

## Major Follow-up — Faker 40.37.0 (2026-08-27)

### Decision

- Applied `Faker` 25.9.2 -> 40.37.0 in isolation; no other dependency pin changed.
- Kept all fake-data management commands unchanged. Their default and `es_CO`
  providers remain compatible, including the date, text, person, company,
  email, UUID and numeric APIs exercised by the project.
- Current remaining direct outdated dependencies: 26 (25 major-line skips plus
  the held `svglib` 1.6.0 candidate).

### Verification

- Clean Python 3.12 venv + full `requirements.txt`: success.
- `pip check`: no broken requirements.
- `python manage.py check`: no issues (0 silenced).
- `pytest --collect-only -q`: 3,187 tests collected, 0 collection errors.
- Provider smoke covered every Faker API used by the seeders, including
  locale-specific `es_CO` company data.
- Focused service, corporate-request and intranet seeder slice: 12 passed both
  on the 25.9.2 baseline and after the 40.37.0 upgrade.
- `pip-audit`: no known vulnerabilities in the isolated venv.
- No migration, fake-data refresh or database-writing management command ran.

---

## Major Follow-up — certifi 2026.7.22 (2026-08-27)

### Decision

- Applied `certifi` 2024.12.14 -> 2026.7.22 in isolation; no other dependency
  pin changed.
- Kept Requests and the SECOP client unchanged. Requests continues to resolve
  the canonical certifi CA bundle.
- Current remaining direct outdated dependencies: 25 (24 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements.
- `python manage.py check`: no issues (0 silenced).
- SSL/Requests smoke loaded 121 certificate authorities from the certifi path.
- Health slice: 11 passed; SECOP client regression: 21 passed.
- `pip-audit`: no known vulnerabilities in the isolated venv.
- No migration or database-writing management command ran.
