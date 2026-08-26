# Vulnerability Audit & Dependency Update Report

**Branch:** `chore/26082026-vuln-audit`  
**Date:** 2026-08-26  
**Base:** `release-september-2026-c` @ `d3fdca6`  
**Scope:** patch + minor updates only (no major version bumps)

## Summary

| Surface | Vulns (initial) | Outdated (initial) | Vulns (final) |
|---|---:|---:|---:|
| Frontend | 13 (0 critical / 12 high / 0 moderate / 1 low) | 24 rows | 0 |
| Backend | 109 across 13 packages | 64 installed packages (56 declared) | 85 across 9 packages |

The frontend audit is clean. The backend audit removed 24 vulnerability records and four vulnerable packages from the result. The 85 remaining records require major upgrades, migration away from a deprecated package, or an update to the environment's `pip` tooling; none can be resolved within this audit's patch/minor contract.

---

## Frontend — `npm audit` (initial)

Source: `/tmp/gym_project_staging-npm-audit.json`

| Package | Severity | Notes |
|---|---|---|
| `@babel/core` | low | Direct development dependency; fix available. |
| `axios` | high | Direct runtime dependency; fix available. |
| `brace-expansion` | high | Transitive; lockfile fix available. |
| `dompurify` | high | Direct runtime dependency; fix available. |
| `fast-uri` | high | Transitive; lockfile fix available. |
| `form-data` | high | Transitive; lockfile fix available. |
| `js-cookie` | high | Transitive; lockfile fix available. |
| `js-yaml` | high | Transitive; lockfile fix available. |
| `nanoid` | high | Transitive; lockfile fix available. |
| `postcss` | high | Direct development dependency; fix available. |
| `tinymce` | high | Direct runtime dependency; fix available. |
| `vite` | high | Direct development dependency; fix available. |
| `ws` | high | Transitive; lockfile fix available. |

**Totals:** 0 critical / 12 high / 0 moderate / 1 low.

## Frontend — `npm outdated` (initial)

Source: `/tmp/gym_project_staging-npm-outdated.json`

The initial snapshot reported 24 direct rows. Because `node_modules` was not present at scan time, npm emitted `current: null`; declared versions and safe targets were resolved from `package.json`, the lockfile, and registry metadata. The resulting plan contained 23 patch/minor bumps and 18 available major lines to skip.

Major updates intentionally skipped:

- `@azure/msal-browser` 3.30.0 → 5.19.0
- Babel 7 packages → 8.x (`@babel/core`, `@babel/parser`, `@babel/preset-env`, `@babel/traverse`)
- `@testing-library/jest-dom` 6.9.1 → 7.0.1
- `babel-jest` 29.7.0 → 30.4.1
- `babel-plugin-istanbul` 6.1.1 → 8.0.2
- `eslint` 9.39.4 → 10.9.1
- `flowbite` 2.5.2 → 4.0.2
- `jest` / `jest-environment-jsdom` 29.7.0 → 30.4.x
- `pinia` 2.3.1 → 4.0.3
- `swiper` 12.1.4 → 14.1.0
- `tailwindcss` 3.4.19 → 4.3.3
- `tinymce` 7.9.2 → 8.8.2
- `vite` 6.4.2 → 8.2.2
- `vue-router` 4.6.4 → 5.2.0

---

## Backend — `pip-audit` (initial)

Source: `/tmp/gym_project_staging-pip-audit.json`

| Package | Current | Vulns | Safe in-major action |
|---|---:|---:|---|
| `cryptography` | 44.0.1 | 7 | 44.0.3 available, but the recorded fixes require 46+ |
| `Django` | 5.2.14 | 9 | 5.2.17 fixes all 9 |
| `lxml` | 5.3.1 | 2 | 5.4.0 available, but the recorded fixes require 6.1+ |
| `pillow` | 10.4.0 | 24 | No in-major fix; recorded fixes require 12.1+ |
| `pyasn1` | 0.6.3 | 4 | 0.6.4 fixes all 4 |
| `PyJWT` | 2.12.0 | 9 | 2.13.0 fixes all 9 |
| `pypdf` | 5.3.0 | 37 | 5.9.0 available, but the recorded fixes require 6.x |
| `PyPDF2` | 3.0.1 | 1 | Deprecated package; migrate consumers to `pypdf` |
| `pytest` | 8.3.5 | 1 | 8.4.2 available, but the recorded fix requires 9.x |
| `soupsieve` | 2.8.3 | 2 | 2.9.2 fixes both |
| `sqlparse` | 0.5.5 | 4 | 0.6.0 is a policy-major for a 0.x package |
| `weasyprint` | 63.1 | 2 | Recorded fixes require 68+ |
| `pip` (tooling) | 24.0 | 7 | Not declared in `requirements.txt`; environment tooling update required |

## Backend — `pip list --outdated` (initial)

Source: `/tmp/gym_project_staging-pip-outdated.json`

- 64 installed packages were outdated; 56 mapped to direct declarations.
- 37 direct patch/minor updates were planned while preserving exact pins.
- 36 direct packages also had newer major lines, intentionally skipped.
- Major lines include Django 6, cryptography 50, lxml 6, Pillow 12, pypdf 6, pytest 9, Redis 8, WeasyPrint 69, pandas 3, OpenCV 5, and other breaking lines documented by the report-first plan.

---

## Plan

### Frontend

- Apply 23 direct patch/minor targets through `npm-check-updates --target minor`.
- Run `npm audit fix` without `--force` to refresh vulnerable transitives.
- Preserve all major lines for a separate compatibility project.

### Backend

- Apply 37 exact-pin patch/minor targets from the report-first plan.
- Reinstall into an isolated, ignored worktree environment (`backend/.venv`).
- Preserve all major lines and do not mutate the staging runtime virtualenv.

## Updates Applied

### Frontend (commit `11b6364` — `deps(frontend): apply patch+minor updates`)

- `axios` 1.16.1 → 1.20.0
- `docx` 9.6.1 → 9.7.1
- `dompurify` 3.4.4 → 3.4.14
- `driver.js` 1.6.0 → 1.8.0
- `sweetalert2` 11.26.24 → 11.26.25
- `swiper` 12.1.4 → 12.2.0
- `tinymce` 7.9.2 → 7.9.3
- `vue` 3.5.34 → 3.5.41
- `@babel/core` 7.29.0 → 7.29.7
- `@babel/parser` 7.29.3 → 7.29.8
- `@babel/preset-env` 7.29.5 → 7.29.7
- `@babel/traverse` 7.29.0 → 7.29.8
- `@playwright/test` 1.60.0 → 1.62.1
- `@vitejs/plugin-vue` 6.0.7 → 6.0.8
- `@vue/test-utils` 2.4.10 → 2.4.11
- `autoprefixer` 10.5.0 → 10.5.4
- `eslint` 9.39.4 → 9.39.5
- `eslint-plugin-jest` 29.15.2 → 29.16.2
- `eslint-plugin-jest-dom` 5.5.0 → 5.10.1
- `eslint-plugin-playwright` 2.10.2 → 2.11.0
- `postcss` 8.5.14 → 8.5.26
- `vite` 6.4.2 → 6.4.3
- Lockfile transitive remediation removed all seven transitive audit findings.
- Final `npm audit`: 0 critical / 0 high / 0 moderate / 0 low.
- Remaining outdated: 14 direct major lines intentionally skipped.

### Backend (commit `383b0cb` — `deps(backend): apply patch+minor updates`)

- `asgiref` 3.11.1 → 3.12.1
- `beautifulsoup4` 4.14.3 → 4.15.0
- `cachetools` 5.3.3 → 5.5.2
- `charset-normalizer` 3.4.7 → 3.5.1
- `click` 8.4.0 → 8.5.0
- `coverage` 7.14.0 → 7.15.4
- `cryptography` 44.0.1 → 44.0.3
- `Django` 5.2.14 → 5.2.17
- `django-dbbackup` 4.2.1 → 4.3.0
- `django-silk` 5.3.2 → 5.5.2
- `djangorestframework` 3.17.1 → 3.18.0
- `Faker` 25.9.1 → 25.9.2
- `google-auth` 2.53.0 → 2.57.0
- `huey` 2.5.2 → 2.6.0
- `idna` 3.15 → 3.19
- `lxml` 5.3.1 → 5.4.0
- `mysqlclient` 2.2.7 → 2.2.8
- `numpy` 2.4.5 → 2.5.2
- `opencv-python-headless` 4.13.0.92 → 4.14.0.94
- `pandas` 2.2.2 → 2.3.3
- `pyasn1` 0.6.3 → 0.6.4
- `pycparser` 2.22 → 2.23
- `pyhanko-certvalidator` 0.26.5 → 0.26.8
- `PyJWT` 2.12.0 → 2.13.0
- `PyMuPDF` 1.27.2.3 → 1.28.2
- `pypdf` 5.3.0 → 5.9.0
- `pytest` 8.3.5 → 8.4.2
- `pytest-cov` 6.1.0 → 6.3.0
- `pytest-django` 4.12.0 → 4.14.0
- `python-bidi` 0.6.10 → 0.6.11
- `redis` 5.2.1 → 5.3.1
- `soupsieve` 2.8.3 → 2.9.2
- `tqdm` 4.67.3 → 4.70.0
- `typing_extensions` 4.15.0 → 4.16.0
- `tzdata` 2025.2 → 2025.3
- `tzlocal` 5.3.1 → 5.4.4
- Final `pip-audit`: 85 vulnerability records across 9 packages.
- Remaining vulnerable packages: `cryptography` (7), `lxml` (2), `pillow` (24), `pip` (7), `pypdf` (37), `PyPDF2` (1), `pytest` (1), `sqlparse` (4), and `weasyprint` (2).
- Remaining outdated: 37 installed packages, all on major lines or otherwise outside the safe target policy.

## Rollbacks

- Frontend: `@testing-library/jest-dom` 6.10.0 was published as deprecated/breaking and explicitly recommends 6.9.1. The attempted bump was reverted to 6.9.1.
- Backend: `svglib` 1.6.0 requires `lxml >= 6.0.0`. Because lxml 6 is a major upgrade, `svglib` was restored to 1.5.1 and the compatible lxml 5.4.0 bump was retained.

## Verification Results

### Frontend

- `npm audit --json`: 0 critical / 0 high / 0 moderate / 0 low.
- `npm ls vue @vue/server-renderer @testing-library/jest-dom --depth=1`: dependency tree valid; Vue packages aligned at 3.5.41 and jest-dom at 6.9.1.
- `npm run build`: success with Vite 6.4.3. One pre-existing dynamic/static import chunking warning remains for `src/stores/auth/user.js`.

### Backend

- `python -m pip check`: no broken requirements found.
- `python manage.py check`: no issues (0 silenced).
- `pytest --collect-only -q`: 3,181 tests collected, 0 collection errors.
- Slice: `pytest gym_app/tests/views/test_health.py -q`: 11 passed.
- Non-blocking warnings: marks applied to fixtures will be unsupported in pytest 9, and `PyPDF2` is deprecated in favor of `pypdf`.
- No migrations or database-writing management commands were run.
