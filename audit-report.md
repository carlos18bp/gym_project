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

---

## Major Follow-up — tzdata 2026.3 (2026-08-27)

### Decision

- Applied `tzdata` 2025.3 -> 2026.3 in isolation; no other dependency pin
  changed.
- Kept Django's time-zone settings and application code unchanged. The package
  remains the fallback IANA database used by `zoneinfo` and pandas.
- Current remaining direct outdated dependencies: 24 (23 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Packaged-data smoke loaded tzdata 2026.3 and `America/Bogota`.
- Report-model slice: 10 passed; process-alert task slice: 16 passed using an
  isolated SQLite test database.
- No migration or staging database command ran.

---

## Major Follow-up — pytz 2026.3.post1 (2026-08-27)

### Decision

- Applied `pytz` 2025.2 -> 2026.3.post1 in isolation; no other dependency pin
  changed.
- Preserved the existing pandas and django-dbbackup integrations without code or
  configuration changes.
- Current remaining direct outdated dependencies: 23 (22 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- pytz and pandas both preserved Bogotá's `-05:00` UTC offset.
- `manage.py help dbbackup` loaded the command without executing a backup.
- Report-model slice: 10 passed using an isolated SQLite test database.
- No migration, backup or staging database command ran.

---

## Major Follow-up — packaging 26.3 (2026-08-27)

### Decision

- Applied `packaging` 24.2 -> 26.3 in isolation; no other dependency pin
  changed.
- Preserved its existing consumers, pytest and Gunicorn, without application or
  server configuration changes.
- Current remaining direct outdated dependencies: 22 (21 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Version and specifier parsing smoke passed through `packaging` 26.3, pytest
  9.1.1 and Gunicorn 23.0.0.
- Gunicorn's WSGI configuration check passed; health slice: 11 passed using an
  isolated SQLite test database.
- No migration or staging database command ran.

---

## Major Follow-up — termcolor 3.3.0 (2026-08-27)

### Decision

- Applied `termcolor` 2.5.0 -> 3.3.0 in isolation; no other dependency pin
  changed.
- Preserved the existing `fire` 0.7.1 integration without application or
  management-command changes.
- Current remaining direct outdated dependencies: 21 (20 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- ANSI color, no-color and Fire command-dispatch smoke passed with termcolor
  3.3.0 and Fire 0.7.1.
- Django's management-command registry loaded normally; health slice: 11 passed
  using an isolated SQLite test database.
- No migration or staging database command ran.

---

## Major Follow-up — chardet 7.6.0 (2026-08-27)

### Decision

- Applied `chardet` 5.2.0 -> 7.6.0 in isolation; no other dependency pin
  changed.
- Confirmed the repository has no direct chardet imports or reverse package
  dependencies, so no application API migration was required.
- Current remaining direct outdated dependencies: 20 (19 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- UTF-8 and legacy-byte detection passed through `detect` and the supported
  top-level `UniversalDetector` import; the chardet CLI loaded normally.
- Health slice: 11 passed using an isolated SQLite test database.
- No migration or staging database command ran.

---

## Major Follow-up — webencodings 0.6.1 (2026-08-27)

### Decision

- Applied `webencodings` 0.5.1 -> 0.6.1 in isolation; no other dependency pin
  changed.
- Preserved its cssselect2, html5lib, tinycss2 and tinyhtml5 consumers and the
  existing WeasyPrint/xhtml2pdf rendering paths without code changes.
- Current remaining direct outdated dependencies: 19 (18 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Encoding alias/decode, HTML parsing, CSS parsing/selector and direct
  WeasyPrint PDF-rendering smoke passed.
- Document-render regression: 2 passed; service/trámite PDF slice: 13 passed
  using an isolated SQLite test database.
- No migration or staging database command ran.

---

## Major Follow-up — uritools 6.1.3 (2026-08-27)

### Decision

- Applied `uritools` 4.0.3 -> 6.1.3 in isolation; no other dependency pin
  changed.
- Preserved its pyhanko-certvalidator consumer and the existing pyHanko and
  xhtml2pdf signature/PDF dependency paths without application changes.
- Current remaining direct outdated dependencies: 18 (17 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- HTTPS/LDAP URI parsing, joining, reconstruction and certificate name-tree
  matching passed through uritools and pyhanko-certvalidator.
- Signature PDF slice: 4 passed; health slice: 11 passed using isolated SQLite
  test databases.
- No migration or staging database command ran.

---

## Major Follow-up — pycparser 3.0 (2026-08-27)

### Decision

- Applied `pycparser` 2.23 -> 3.0 in isolation; no other dependency pin
  changed.
- Preserved its cffi consumer and the cryptography, WeasyPrint and signature/PDF
  dependency paths without application changes.
- Current remaining direct outdated dependencies: 17 (16 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- C AST parsing, cffi declarations/dynamic calls and an Ed25519 sign/verify
  round trip passed with pycparser 3.0.
- Signature PDF slice: 4 passed; service/trámite PDF generation slice: 7 passed
  using isolated SQLite test databases.
- No migration or staging database command ran.

---

## Major Follow-up — zopfli 0.4.3 (2026-08-27)

### Decision

- Applied `zopfli` 0.2.3.post1 -> 0.4.3 in isolation; no other dependency pin
  changed.
- Preserved the optional FontTools WOFF compression path and the existing
  WeasyPrint/xhtml2pdf PDF-generation paths without application changes.
- Current remaining direct outdated dependencies: 16 (15 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Zlib/gzip round trips and FontTools' explicit Zopfli compression path passed
  with zopfli 0.4.3.
- Document-render slice: 2 passed; service/trámite PDF generation slice: 7
  passed using isolated SQLite test databases.
- No migration or staging database command ran.

---

## Major Follow-up — cachetools 7.1.7 (2026-08-27)

### Decision

- Applied `cachetools` 5.5.2 -> 7.1.7 in isolation; no other dependency pin
  changed.
- Confirmed the repository and installed dependency graph have no direct
  cachetools consumer requiring an API migration; the Google OAuth path remains
  operational with google-auth 2.57.0.
- Current remaining direct outdated dependencies: 15 (14 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- TTL expiry, LRU eviction and memoization smoke passed with cachetools 7.1.7;
  the google-auth transport imported normally.
- Google login slice: 10 passed; health slice: 11 passed using isolated SQLite
  test databases.
- No migration or staging database command ran.

---

## Major Follow-up — pydyf 0.12.1 (2026-08-27)

### Decision

- Applied `pydyf` 0.11.0 -> 0.12.1 in isolation; no other dependency pin
  changed.
- Preserved WeasyPrint 69.0's low-level PDF writer integration without
  application or rendering code changes.
- Current remaining direct outdated dependencies: 14 (13 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- A real WeasyPrint document retained its PDF header, page count, title metadata
  and link annotation when parsed back through pypdf.
- Document-render slice: 2 passed; service/trámite PDF generation slice: 7
  passed using isolated SQLite test databases.
- No migration or staging database command ran.

---

## Major Follow-up — pyphen 0.18.1 (2026-08-27)

### Decision

- Applied `pyphen` 0.17.2 -> 0.18.1 in isolation; no other dependency pin
  changed.
- Preserved WeasyPrint 69.0's language-aware hyphenation integration without
  application or template changes.
- Current remaining direct outdated dependencies: 13 (12 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Spanish (`es-CO` -> `es`) dictionary fallback, word splitting and narrow
  automatic-hyphenation PDF rendering passed with pyphen 0.18.1.
- Document-render slice: 2 passed; service/trámite PDF generation slice: 7
  passed using isolated SQLite test databases.
- No migration or staging database command ran.

---

## Major Follow-up — cssselect2 0.9.0 (2026-08-27)

### Decision

- Applied `cssselect2` 0.8.0 -> 0.9.0 in isolation; no other dependency pin
  changed.
- Preserved both direct consumers, WeasyPrint 69.0 and svglib 1.5.1, without
  application, SVG or rendering code changes.
- Current remaining direct outdated dependencies: 12 (11 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Compound selector matching, SVG CSS-to-PDF conversion and styled WeasyPrint
  rendering passed with cssselect2 0.9.0.
- Document-render slice: 2 passed; service/trámite PDF generation slice: 7
  passed using isolated SQLite test databases.
- No migration or staging database command ran.

---

## Major Follow-up — gunicorn 26.2.0 (2026-08-27)

### Decision

- Applied `gunicorn` 23.0.0 -> 26.2.0 in isolation; no other dependency pin
  changed.
- Preserved the repository's three-worker Unix-socket systemd configuration
  and `gym_project.wsgi:application` entry point without service-file changes.
- Current remaining direct outdated dependencies: 11 (10 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Gunicorn 26.2.0 accepted the WSGI application, access log, three-worker and
  Unix-socket settings through both configuration check and print modes.
- Health slice: 11 passed using an isolated SQLite test database.
- No service was started or restarted; no migration or staging database command
  ran.

---

## Major Follow-up — django-cleanup 9.0.0 (2026-08-27)

### Decision

- Applied `django-cleanup` 8.1.0 -> 9.0.0 in isolation; no other dependency pin
  changed.
- Confirmed that `django_cleanup` is not registered in `INSTALLED_APPS` and is
  not imported by repository code, so this upgrade does not activate automatic
  file-deletion signals or otherwise change runtime behavior.
- Current remaining direct outdated dependencies: 10 (9 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Package import and version metadata passed while confirming its intentionally
  inactive application status.
- Four model-level physical-file deletion tests and two service/trámite
  replacement-cleanup tests passed using isolated SQLite test databases.
- No migration or staging database command ran.

---

## Major Follow-up — django-dbbackup 5.3.0 (2026-08-27)

### Decision

- Applied `django-dbbackup` 4.3.0 -> 5.3.0 in isolation; no other dependency
  pin changed.
- Migrated the removed `DBBACKUP_STORAGE` and `DBBACKUP_STORAGE_OPTIONS`
  settings to Django's `STORAGES["dbbackup"]` alias while preserving the same
  filesystem backend and `BACKUP_STORAGE_PATH` location.
- Kept explicit `default` and `staticfiles` aliases so the new `STORAGES`
  declaration preserves Django's pre-existing file and static-file behavior.
- Current remaining direct outdated dependencies: 9 (8 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- The default, staticfiles and dbbackup storage aliases instantiated with the
  expected classes and configured backup path.
- Both backup commands retained `--compress` and `--clean`; the scheduled task
  dispatched both commands with those flags.
- A real isolated SQLite database produced a compressed backup and valid
  metadata through `dbbackup` 5.3.0; the health slice passed 11 tests.
- No migration or staging database command ran.

---

## Major Follow-up — redis 8.1.0 (2026-08-27)

### Decision

- Applied `redis` 5.3.1 -> 8.1.0 in isolation; no other dependency pin
  changed.
- Preserved the `Redis.from_url` health-check API and Huey 2.6.0's
  `ConnectionPool.from_url` integration without application or settings changes.
- Current remaining direct outdated dependencies: 8 (7 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- Against an ephemeral local Redis server, redis-py 8.1.0 passed ping, string
  reads/writes and pipeline operations.
- Huey passed queue enqueue/dequeue, result storage and scheduled-task Lua
  operations; the real health endpoint reported both database and Redis healthy.
- Health slice: 11 passed using an isolated SQLite test database.
- No production/staging Redis connection, migration or staging database command
  ran.

---

## Major Follow-up — Huey 3.3.4 (2026-08-27)

### Decision

- Applied Huey 2.6.0 -> 3.3.4 in isolation; no other dependency pin changed.
- Preserved Django integration, all 14 registered tasks, the `run_huey`
  consumer, periodic schedules, retries and distributed locks.
- Materialized `REDIS_URL` once in Django settings so Huey and the health
  endpoint share the same source without depending on storage implementation
  attributes.
- Current remaining direct outdated dependencies: 7 (6 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced); `run_huey --help` loaded the
  Django management command and consumer options.
- Against an ephemeral local Redis server, Huey 3.3.4 enqueued and executed a
  real task, returned its result and enforced lock contention.
- Health slice: 11 passed; notification, signature reminder and SECOP task
  slices: 19 passed using isolated SQLite test databases.
- No production/staging Redis connection, migration or staging database command
  ran.

---

## Major Follow-up — pandas 3.0.5 (2026-08-27)

### Decision

- Applied pandas 2.3.3 -> 3.0.5 in isolation; no other dependency pin changed.
- Preserved the report subsystem's DataFrame transformations and Excel output
  without application code changes.
- Current remaining direct outdated dependencies: 6 (5 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- The new string dtype, missing values, timezone removal and grouped summaries
  behaved as expected; real Excel round-trips passed through XlsxWriter and
  openpyxl.
- Report-function slice: 10 passed; report-view slice: 19 passed, 1 skipped
  and 1 deliberately deselected to keep the batch at no more than 20 tests.
- No migration or staging database command ran.

---

## Major Follow-up — opencv-python-headless 5.0.0.93 (2026-08-27)

### Decision

- Applied `opencv-python-headless` 4.14.0.94 -> 5.0.0.93 in isolation; no
  other dependency pin changed.
- Confirmed that repository code has no direct `cv2` imports, so no application
  API migration was needed; the unused direct pin remains a future cleanup
  candidate.
- Current remaining direct outdated dependencies: 5 (4 upgrade candidates
  plus the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success using a
  prebuilt Linux wheel.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- OpenCV 5.0.0 and NumPy 2.5.2 passed color conversion, resize, Gaussian blur,
  PNG encoding/decoding, thresholding and contour extraction.
- Health slice: 11 passed using an isolated SQLite test database.
- No migration or staging database command ran.

---

## Major Follow-up — pyhanko-certvalidator 0.31.4 standalone hold (2026-08-27)

### Decision

- Attempted `pyhanko-certvalidator` 0.26.8 -> 0.31.4 as an isolated candidate.
- The clean resolver rejected the combination because pyHanko 0.25.3 requires
  `pyhanko-certvalidator>=0.26.5,<0.27`.
- Reverted the pin to 0.26.8. The target will be retried atomically with the
  next pyHanko candidate because the two packages form a resolver-enforced
  compatibility unit.
- Current remaining direct outdated dependencies: 5 (3 upgrade candidates plus
  held `pyhanko-certvalidator` and `svglib` candidates).

### Verification

- The failure occurred during clean dependency resolution, before package
  installation or runtime execution.
- Installed metadata independently confirmed pyHanko 0.25.3's `<0.27` upper
  bound; xhtml2pdf 0.2.17 accepts both packages without an additional upper
  bound.
- The reverted cumulative requirements installed cleanly; `pip check` passed,
  `pip-audit` reported no known vulnerabilities and Django reported no issues.
- No application, migration, database, staging or production service was
  touched.

---

## Major Follow-up — pyHanko 0.36.2 + pyhanko-certvalidator 0.31.4 (2026-08-27)

### Decision

- Applied pyHanko 0.25.3 -> 0.36.2 and `pyhanko-certvalidator` 0.26.8 ->
  0.31.4 atomically, resolving the preceding standalone-validator hold.
- Installed metadata confirms that pyHanko 0.36.2 requires
  `pyhanko-certvalidator>=0.31.4,<0.32`; no repository module imports either
  package directly, and the application reaches the stack through xhtml2pdf.
- No application code migration was required.
- Current remaining direct outdated dependencies: 3 (`reportlab`, Django and
  the held `svglib` candidate).

### Verification

- Clean Python 3.12 venv + full cumulative `requirements.txt`: success.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- xhtml2pdf produced a real one-page service-style PDF whose header and content
  were parsed back with pypdf.
- pyhanko-certvalidator accepted a locally generated RSA root/signer chain with
  network fetching disabled and the expected digital-signature key usage.
- Service/trámite PDF slice: 13 passed; signature-PDF slice: 4 passed;
  xhtml2pdf/current-color slice: 4 passed (21 focused tests total).
- No application migration, database command, staging/production service or
  external certificate endpoint was touched.

---

## Major Follow-up — reportlab 5.0.1 standalone hold (2026-08-27)

### Decision

- Attempted reportlab 4.5.1 -> 5.0.1 as an isolated candidate against the full
  cumulative requirements.
- The clean resolver rejected the target because xhtml2pdf 0.2.17 requires
  `reportlab>=4.0.4,<5`. Xhtml2pdf is the active service/trámite PDF engine and
  0.2.17 is its latest published release, so no compatible package-only update
  exists in the current stack.
- Restored the exact reportlab 4.5.1 pin. Replacing the PDF engine is outside
  this dependency-candidate campaign and requires a separate migration plan.
- Current remaining direct outdated dependencies: 3 (the Django candidate plus
  held `reportlab` and `svglib`).

### Verification

- The failure occurred during clean dependency resolution, before package
  installation or runtime execution.
- The restored cumulative requirements installed successfully in a fresh
  Python 3.12 environment.
- `pip check`: no broken requirements; `pip-audit`: no known vulnerabilities.
- `python manage.py check`: no issues (0 silenced).
- No application code, migration, database, staging/production service or PDF
  engine was changed.

---

## Major Follow-up — Django 6.1 infrastructure hold (2026-08-27)

### Decision

- Attempted Django 5.2.17 -> 6.1 against the full cumulative requirements.
- The dependency set resolved and the application loaded under Python 3.12 and
  SQLite, but Django 6.1's MySQL backend requires MySQL 8.4 or newer. This
  host's active MySQL service and server binary are version 8.0.46.
- Restored Django 5.2.17 because the repository's CI backend uses SQLite and
  cannot prove compatibility with the deployed MySQL engine.
- Django 6.1 also exposed the next framework migration: the legacy `EMAIL_*`
  settings emit `RemovedInDjango70Warning` and should move to `MAILERS` before
  Django 7.0.
- Current remaining direct outdated dependencies: 3 (the `svglib` candidate
  plus held Django and `reportlab`).

### Verification

- Clean Python 3.12 resolution with Django 6.1: success; `pip check` and
  `pip-audit` reported no broken requirements or known vulnerabilities.
- Django 6.1 system check under isolated SQLite: no issues (0 silenced), with
  only the documented Django 7 email-setting deprecations.
- Health slice: 11 passed; email-path slice: 3 passed under isolated SQLite.
- The restored Django 5.2.17 cumulative environment installed cleanly and
  again passed `pip check`, the zero-finding audit and Django's system check.
- No migration, deployed database query, application code, staging/production
  service or MySQL configuration was changed.
