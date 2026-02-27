# G&M Internal Management Tool

## Table of Contents

- [Overview](#overview)
- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Development Quickstart](#development-quickstart)
  - [System dependencies (Linux)](#system-dependencies-linux)
  - [Clone the repository](#clone-the-repository)
  - [Backend (Django)](#backend-django)
  - [Frontend (Vue 3 + Vite)](#frontend-vue-3--vite)
- [Testing](#testing)
  - [Backend tests](#backend-tests)
  - [Backend tests in blocks](#backend-tests-in-blocks)
  - [Frontend unit tests](#frontend-unit-tests)
  - [Frontend E2E tests (Playwright)](#frontend-e2e-tests-playwright)
  - [E2E coverage](#e2e-coverage)
  - [Test Quality Gate](#test-quality-gate-backend--frontend)
  - [Run all test suites](#run-all-test-suites)
- [Environment Configuration](#environment-configuration)
- [Backups](#backups)
- [Performance Monitoring](#performance-monitoring)
- [Task Queue](#task-queue)
- [Documentation](#documentation)
- [Project change guidelines](#project-change-guidelines)

## Overview

G&M Internal Management Tool is a full-stack web application for managing legal processes, organizations, subscriptions, and document workflows within a law firm. It streamlines interactions between **lawyers** and **clients** through a **role-based system**, enabling case tracking, dynamic document generation, electronic signatures, organization management, and subscription-based billing.

The platform is built as a **Progressive Web App (PWA)** with a **Django REST API** backend and a **Vue 3 SPA** frontend. Key capabilities include:

- **Legal case management** with stages, case files, and activity tracking
- **Dynamic document builder** with template variables, permissions, tags, folders, and relationships
- **Electronic signatures** (draw or image upload)
- **Organization management** with invitations, memberships, and posts
- **Legal and corporate request workflows** with file attachments and responses
- **Subscription billing** via Wompi payment gateway with automated Huey tasks
- **Google OAuth** and **reCAPTCHA** integration
- **Offline-ready PWA** with service worker and installable app support

## Main Features

### 1. **User Management**
   - Role-based access system with three roles: **Client**, **Lawyer**, and **Basic**.
   - Clients track their legal cases; lawyers manage cases, upload documents, and update statuses.
   - User profiles include activity feeds, electronic signatures, and email verification.
   - Authentication via **JWT (SimpleJWT)**, **Google OAuth**, and **reCAPTCHA** protection.

### 2. **Process Management**
   - Legal cases with authority, plaintiff, defendant, case type, subcase, and file number.
   - Each process tracks stages (timestamped phases) and attached case files.
   - Recent-process tracking for quick access from the dashboard.

### 3. **Dynamic Documents**
   - Template-based document builder with injectable **variables** (text, date, signature fields).
   - **Visibility and usability permissions** control who can view or edit each document.
   - Documents support **tags**, **folders**, and **relationships** between documents.
   - Recent-document tracking for quick access.

### 4. **Electronic Signatures**
   - Users can sign documents by **drawing** on a canvas or **uploading an image**.
   - Signatures are stored per user and can be applied to dynamic documents.

### 5. **Organizations**
   - Create and manage organizations with **invitations** and **memberships**.
   - Organization **posts** for internal communication.
   - Corporate request workflows tied to organizations.

### 6. **Legal Requests**
   - Clients submit legal requests categorized by **type** and **discipline**.
   - File attachments and lawyer **responses** for each request.

### 7. **Corporate Requests**
   - Similar to legal requests but for corporate matters.
   - Categorized by **type**, with file attachments and **responses**.

### 8. **Subscriptions & Payments**
   - Subscription plans with recurring billing via **Wompi** payment gateway.
   - Automated monthly payment processing through **Huey** scheduled tasks.
   - Payment history tracking and automatic role downgrade on payment failure.

### 9. **Dashboard & Activity Feed**
   - Centralized dashboard with recent processes, recent documents, and reports.
   - Activity feed tracking user actions across the platform.
   - Report generation with PDF and Excel export (xhtml2pdf, openpyxl, XlsxWriter).

### 10. **Intranet**
   - Internal legal document library and user profiles for the firm.

### 11. **Legal Updates**
   - Lawyers can publish legal updates visible to clients.

### 12. **PWA Support**
   - Progressive Web App with **service worker**, **offline readiness**, and **installable** app experience.
   - Install prompts and instructions modal for supported platforms.

## Technology Stack

### Backend

| Category | Technology |
|----------|-----------|
| Framework | Django 5.0.6, Django REST Framework 3.15.2 |
| Authentication | SimpleJWT, Google OAuth (google-auth) |
| Task queue | Huey 2.5.2 + Redis |
| Database | SQLite (development) |
| PDF generation | xhtml2pdf, PyMuPDF, reportlab |
| Document processing | python-docx, PyPDF2, pypdf, openpyxl, XlsxWriter, pandas |
| Image processing | Pillow, opencv-python-headless |
| Digital signatures | pyHanko |
| QR codes | qrcode |
| Email | Django SMTP backend |
| Test data | Faker |
| Linting | Ruff |
| Testing | pytest, pytest-django, pytest-cov, coverage |

### Frontend

| Category | Technology |
|----------|-----------|
| Framework | Vue 3.4 |
| Build tool | Vite 6 |
| State management | Pinia |
| Routing | Vue Router 4 |
| Styling | TailwindCSS 3, Flowbite |
| UI components | Headless UI, Heroicons |
| HTTP client | Axios |
| Rich text editor | TinyMCE 7 |
| Animations | GSAP |
| Alerts | SweetAlert2 |
| Carousel | Swiper |
| Document export | docx (JS), file-saver |
| Auth | vue3-google-login, vue3-recaptcha2 |
| PWA | vite-plugin-pwa |
| Unit testing | Jest 29, Vue Test Utils |
| E2E testing | Playwright |
| Linting | ESLint (jest, jest-dom, playwright plugins) |

### DevOps & Tooling

| Category | Technology |
|----------|-----------|
| Pre-commit | pre-commit hooks with custom test quality gate |
| CI | GitHub Actions (`.github/workflows/test-quality-gate.yml`) |
| Quality gate | Custom Python analyzer (`scripts/test_quality_gate.py`) |

## Architecture Overview

The backend is organized around the following model domains (defined in `backend/gym_app/models/`):

| Domain | Models | Description |
|--------|--------|-------------|
| **Users** | `User`, `ActivityFeed`, `UserSignature` | Role-based users (client, lawyer, basic), activity tracking, electronic signatures |
| **Processes** | `Process`, `Case`, `Stage`, `CaseFile`, `RecentProcess` | Legal cases with stages, attached files, and recent-access tracking |
| **Dynamic Documents** | `DynamicDocument`, `DocumentVariable`, `DocumentSignature`, `RecentDocument`, `Tag`, `DocumentVisibilityPermission`, `DocumentUsabilityPermission`, `DocumentFolder`, `DocumentRelationship` | Template-based document builder with variables, permissions, tags, folders, and relationships |
| **Organizations** | `Organization`, `OrganizationInvitation`, `OrganizationMembership`, `OrganizationPost` | Organization management with invitations, memberships, and posts |
| **Legal Requests** | `LegalRequest`, `LegalRequestType`, `LegalDiscipline`, `LegalRequestFiles`, `LegalRequestResponse` | Client legal request workflows |
| **Corporate Requests** | `CorporateRequest`, `CorporateRequestType`, `CorporateRequestFiles`, `CorporateRequestResponse` | Corporate request workflows |
| **Subscriptions** | `Subscription`, `PaymentHistory` | Subscription plans and Wompi payment history |
| **Intranet** | `LegalDocument`, `IntranetProfile` | Internal legal document library and profiles |
| **Legal Updates** | `LegalUpdate` | Lawyer-published legal updates |
| **Auth helpers** | `PasswordCode`, `EmailVerificationCode` | Password reset and email verification codes |

## Project Structure

```
gym_project/
├── backend/                    # Django project
│   ├── gym_project/            #   Django settings, urls, tasks, wsgi/asgi
│   ├── gym_app/                #   Main application
│   │   ├── models/             #     Domain models (user, process, dynamic_document, organization, ...)
│   │   ├── views/              #     API views + dynamic_documents/ and layouts/ sub-modules
│   │   ├── serializers/        #     DRF serializers
│   │   ├── utils/              #     Auth, captcha, email notification helpers
│   │   ├── management/commands/#     Fake data creation/deletion commands
│   │   ├── templates/          #     Email and PDF templates
│   │   ├── tests/              #     pytest tests (models, serializers, tasks, utils, views, commands)
│   │   ├── tasks.py            #     Huey tasks (subscription billing)
│   │   ├── urls.py             #     API URL routing
│   │   └── admin.py            #     Django admin configuration
│   ├── scripts/                #   run-tests-blocks.py (block-based test runner)
│   ├── requirements.txt        #   Production dependencies
│   └── requirements-dev.txt    #   Dev dependencies (pre-commit, ruff)
├── frontend/                   # Vue 3 + Vite project
│   ├── src/
│   │   ├── views/              #     Page-level Vue components (auth, dashboard, process, ...)
│   │   ├── components/         #     Reusable components (dynamic_document, electronic_signature, ...)
│   │   ├── stores/             #     Pinia stores (auth, corporate_requests, dynamic_document, ...)
│   │   ├── composables/        #     Vue composables (useIdleLogout, usePWAInstall, useSearch, ...)
│   │   ├── router/             #     Vue Router configuration
│   │   ├── shared/             #     Shared utilities (alerts, color palette, submit handler)
│   │   └── animations/         #     GSAP animation helpers
│   ├── test/                   #   Jest unit tests (stores, components, composables, views, ...)
│   ├── e2e/                    #   Playwright E2E tests + helpers + reporters
│   ├── scripts/                #   E2E helper scripts (modules, coverage, AST parser)
│   ├── package.json            #   npm dependencies and scripts
│   ├── vite.config.js          #   Vite + PWA + E2E coverage instrumentation
│   ├── tailwind.config.js      #   TailwindCSS configuration
│   ├── playwright.config.mjs   #   Playwright configuration
│   └── jest.config.cjs         #   Jest configuration
├── scripts/                    # Repository-level scripts
│   ├── test_quality_gate.py    #   Test quality gate analyzer
│   ├── run-tests-all-suites.py #   Parallel test suite runner
│   └── quality/                #   Quality gate analyzers (backend, frontend-unit, frontend-e2e)
├── docs/                       # Project documentation
├── .github/workflows/          # CI workflows (test-quality-gate.yml)
├── .pre-commit-config.yaml     # Pre-commit hook configuration
└── .nvmrc                      # Node.js version (22.13.0)
```

## Development Quickstart

### System dependencies (Linux)

```bash
sudo apt install python3-pip
sudo apt install python3-virtualenv
sudo apt install npm
sudo apt install silversearcher-ag
sudo apt install libpangocairo-1.0-0 libpangoft2-1.0-0 libffi-dev libcairo2
```

Frontend tooling baseline: **Node.js >= 22.13.0**.
If you use `nvm`, run `nvm use` from the repository root (the version is pinned in `.nvmrc`).

### Clone the repository

```bash
git clone git@github.com:carlos18bp/gym_project.git
cd gym_project
```

### Backend (Django)

Create and activate a virtual environment, then install dependencies:

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
```

Run migrations and create a superuser:

```bash
python backend/manage.py migrate
python backend/manage.py createsuperuser
```

Create and delete fake data:

```bash
python backend/manage.py create_fake_data
python backend/manage.py delete_fake_data --confirm
```

Run the backend dev server:

```bash
python backend/manage.py runserver
```

### Frontend (Vue 3 + Vite)

Install dependencies and start dev server:

```bash
cd frontend
npm install
npm run dev
```

Build the frontend for production:

```bash
cd frontend
npm run build
```

## Testing

### Backend tests

Run targeted backend tests:

```bash
cd backend
pytest gym_app/tests/<domain>/test_<feature>.py -v
pytest gym_app/tests/<domain>/test_<feature>.py gym_app/tests/<domain>/test_<feature>_regression.py -v
```

### Backend tests in blocks

For low-RAM environments, the block runner splits tests by marker and group:

```bash
python backend/scripts/run-tests-blocks.py
```

Tip: the examples below assume repo root. If you are already inside `backend/`, drop the
`backend/` prefix (e.g. `python scripts/run-tests-blocks.py`).

How blocks are built:

- Marker blocks: `edge`, `contract`, `integration`, `rest`.
- `rest` means tests without `edge`, `contract`, or `integration` markers.
- Groups are discovered from `gym_app/tests/` (models, serializers, tasks, utils, views, root, ...).
- Final blocks are `marker x group` combinations (views can be split further).

Definitions (from pytest output):

- **EMPTY**: pytest collected 0 tests in a block (exit code 5 or "collected 0 items").
- **deselected**: tests were found but excluded by filters (`-m`, `-k`, etc.).

Usage:

```bash
python backend/scripts/run-tests-blocks.py [options] -- [pytest args]
```

Option manual (with examples):

Selection / discovery

- `--markers edge,contract,integration,rest`: filter marker blocks.
  Example: `python backend/scripts/run-tests-blocks.py --markers edge,contract`
- `--no-markers`: run all tests without marker filtering (mutually exclusive with `--markers`).
  Generates one block per group/chunk instead of one per marker.
  Example: `python backend/scripts/run-tests-blocks.py --no-markers --groups models,serializers`
- `--groups models,serializers,tasks,utils,views,root`: filter test groups.
  Example: `python backend/scripts/run-tests-blocks.py --groups models,serializers`
- `--list`: list all blocks and exit.
  Example: `python backend/scripts/run-tests-blocks.py --list`
- `--status-and-run`: show block completion status before running.
  Auto-enabled when `--run-id` is set.

Chunking / views splitting

- `--chunk-size N`: split blocks by number of test files (default: 22, use 0 to disable).
  Chunks are **balanced by file size** (round-robin): each chunk gets a similar total load.
  Recommended value: **30 or less**.
  Example: `python backend/scripts/run-tests-blocks.py --chunk-size 30`
- `--views-per-file`: one views block per file (before chunking).
  Example: `python backend/scripts/run-tests-blocks.py --groups views --views-per-file`
- `--views-fast-start`: shortcut for views-heavy runs (default to `rest` markers).
  Example: `python backend/scripts/run-tests-blocks.py --groups views --views-fast-start`
- `--no-skip-empty-markers`: disable automatic skipping of empty marker blocks
  (enabled by default; useful for debugging marker detection).
  Example: `python backend/scripts/run-tests-blocks.py --no-skip-empty-markers`
- `--no-views-rest-default`: disable defaulting to `rest` when only views are selected.
  Example: `python backend/scripts/run-tests-blocks.py --groups views --no-views-rest-default`

Execution controls

- `--sleep SECS`: wait between blocks to reduce RAM/CPU spikes (default: 2).
  Example: `python backend/scripts/run-tests-blocks.py --chunk-size 30 --sleep 3`
- `--block-timeout SECS`: max seconds per block before terminating it (0 = no timeout).
  Example: `python backend/scripts/run-tests-blocks.py --block-timeout 900`
- `--timeout-grace SECS`: grace period before killing a timed-out block.
  Example: `python backend/scripts/run-tests-blocks.py --block-timeout 900 --timeout-grace 15`
- `--max-blocks N`: run only the next N blocks.
  Example: `python backend/scripts/run-tests-blocks.py --max-blocks 5`

Reports / resume

- `--run-id ID`: name the report folder (required for `--resume`). Auto-enables `--status-and-run`.
  Example: `python backend/scripts/run-tests-blocks.py --run-id backend-20260207`
- `--report-dir PATH`: override base report directory.
  Example: `python backend/scripts/run-tests-blocks.py --report-dir /tmp/backend-blocks`
- `--resume`: skip blocks already `ok/empty` in summary.
  Example: `python backend/scripts/run-tests-blocks.py --run-id backend-20260207 --resume`
- `--resume-all`: skip any block already recorded in summary (including failed/timeout).
  Useful with `--max-blocks` to continue with never-run blocks.
  Example: `python backend/scripts/run-tests-blocks.py --run-id backend-20260207 --resume-all`

Database behavior

- `--reuse-db`: reuse pytest DB (default).
- `--no-reuse-db`: recreate DB per block.
  Example: `python backend/scripts/run-tests-blocks.py --no-reuse-db`

Passing extra pytest arguments

- `-- <pytest args>`: everything after `--` is forwarded to pytest.
  Example: `python backend/scripts/run-tests-blocks.py -- --maxfail=1 -q`

Reports are stored under `backend/test-reports/backend-blocks/<run-id>/`:

- `summary.jsonl` contains one JSON line per block
- `blocks/` contains per-block logs

Internal behavior notes:

- Files are always sorted by size (largest first) before distribution.
- When `--chunk-size > 0`, files are distributed across chunks using round-robin to balance load.
- Empty marker blocks are skipped by default; use `--no-skip-empty-markers` to disable.
- When running only views without `--markers`, the runner defaults to `rest` markers
  (use `--no-views-rest-default` to disable).
- Using the same `--run-id` appends new entries to `summary.jsonl` (no deletion).
- Timed-out blocks are recorded with `status=timeout`; rerun them with `--resume` to complete coverage.
- For a clean report, delete the run-id folder or use a new run id.

Recommended command (run all backend tests with coverage):

```bash
RUN_ID=backend-$(date +%Y%m%d)
BLOCK_TIMEOUT=900     # 15 min per block
TIMEOUT_GRACE=15      # 15s before kill

python backend/scripts/run-tests-blocks.py --run-id $RUN_ID \
  --chunk-size 30 --sleep 3 \
  --block-timeout $BLOCK_TIMEOUT --timeout-grace $TIMEOUT_GRACE \
  -- --cov=gym_app --cov-append --cov-report=term --cov-report=html
```

Common recipes:

```bash
# List blocks
python backend/scripts/run-tests-blocks.py --list

# List blocks with chunking
python backend/scripts/run-tests-blocks.py --list --chunk-size 30

# Run all tests without marker filtering (fastest for groups without markers)
python backend/scripts/run-tests-blocks.py --no-markers --groups models,serializers,tasks,utils

# Narrow by markers/groups
python backend/scripts/run-tests-blocks.py --markers edge,contract --groups models,serializers

# Resume interrupted run
python backend/scripts/run-tests-blocks.py --run-id $RUN_ID --resume \
  --chunk-size 30 --sleep 3 \
  --block-timeout $BLOCK_TIMEOUT --timeout-grace $TIMEOUT_GRACE \
  -- --cov=gym_app --cov-append --cov-report=term --cov-report=html

# Views by file
python backend/scripts/run-tests-blocks.py --run-id $RUN_ID \
  --groups views --views-per-file --chunk-size 1 --sleep 3 \
  -- --cov=gym_app --cov-append --cov-report=term --cov-report=html

# Views in batches of 10 blocks (repeat with --resume until done)
python backend/scripts/run-tests-blocks.py --run-id $RUN_ID \
  --groups views --views-per-file --chunk-size 1 --sleep 3 \
  --max-blocks 10 \
  --block-timeout $BLOCK_TIMEOUT --timeout-grace $TIMEOUT_GRACE \
  -- --cov=gym_app --cov-append --cov-report=term --cov-report=html

# Marker-specific: edge-only for views
python backend/scripts/run-tests-blocks.py --run-id $RUN_ID \
  --groups views --markers edge --chunk-size 30 --sleep 3 \
  -- --cov=gym_app --cov-append --cov-report=term --cov-report=html
```

### Frontend unit tests

Run targeted unit tests (Jest + Vue Test Utils):

```bash
cd frontend
npm run test -- test/stores/<store>.test.js
npm run test -- test/components/<component>.test.js test/composables/<composable>.test.js
```

Run unit tests with coverage:

```bash
cd frontend
npm run test:coverage
```

### Frontend E2E tests (Playwright)

Install Playwright browsers (first time only):

```bash
cd frontend
npx playwright install chromium
```

Run targeted E2E tests:

```bash
cd frontend
npm run e2e -- e2e/<flow>.spec.js
npm run e2e -- e2e/<flow>.spec.js e2e/<related-flow>.spec.js
```

By default, `npm run e2e` runs tests on **Desktop Chrome**. The configuration
supports additional viewports (Mobile Chrome, Tablet) which can be enabled in
`playwright.config.mjs`. To run a specific viewport:

```bash
cd frontend
npm run e2e:desktop                               # Desktop Chrome only
npm run e2e:mobile                                # Mobile Chrome (Pixel 5) only
npm run e2e:tablet                                # Tablet (iPad Mini) only
npm run e2e:desktop -- e2e/auth/auth-login.spec.js  # Desktop + specific spec
npm run e2e:mobile -- e2e/auth/auth-login.spec.js   # Mobile + specific spec
```

Optional: enable Playwright console/page error logs (silenced by default):

```bash
cd frontend
E2E_LOG_ERRORS=1 npm run e2e
```

List available E2E modules (from `flow-definitions.json`):

```bash
cd frontend
npm run e2e:modules
```

Run E2E tests for a single module (example: `auth`):

```bash
cd frontend
npm run e2e:module -- auth
npm run e2e:module -- --module auth --clean
```

> `npm run e2e:module` runs `npm run e2e -- --grep @module:<name>` under the hood.

### E2E coverage

Run E2E coverage (Playwright + Istanbul instrumentation via Vite):

```bash
cd frontend
npx playwright install chromium
npm run e2e:coverage
```

Run coverage for a single module (example: `auth`):

```bash
cd frontend
clear && npm run e2e:clean && npm run e2e:coverage -- --grep @module:auth
```

> `--grep @module:<name>` only runs tests tagged with that module. The flow coverage report will still list other modules as missing because the subset was not executed.

Helper command for the same flow (optional):

```bash
cd frontend
npm run e2e:coverage:module -- auth
npm run e2e:coverage:module -- --module auth --clean
```

To collect coverage for a specific viewport:

```bash
cd frontend
E2E_COVERAGE=1 npm run e2e:mobile -- e2e/<spec>.js
```

Enable page/console error logs during coverage runs:

```bash
cd frontend
E2E_LOG_ERRORS=1 npm run e2e:coverage
```

### Test Quality Gate (Backend + Frontend)

This repository includes a modular **test quality gate** that audits test quality for:

- Backend tests (`pytest`)
- Frontend unit tests (`Jest`)
- Frontend E2E tests (`Playwright`)

The gate is an analysis tool for test quality patterns and **does not change production business logic**.

Detailed architecture, algorithm, rule semantics, and complete CLI options are documented in:

- `docs/TEST_QUALITY_GATE_REFERENCE.md`

#### Practical commands (most common)

Run from repository root:

```bash
# 1) Staged test files only (local pre-commit behavior)
pre-commit run test-quality-gate

# 2) All tracked test files via pre-commit hook
pre-commit run test-quality-gate --all-files

# 3) All suites directly (backend + frontend unit + frontend E2E)
python3 scripts/test_quality_gate.py --repo-root .

# 4) One suite only
python3 scripts/test_quality_gate.py --repo-root . --suite backend
python3 scripts/test_quality_gate.py --repo-root . --suite frontend-unit
python3 scripts/test_quality_gate.py --repo-root . --suite frontend-e2e

# 5) Scoped run by one file (example)
python3 scripts/test_quality_gate.py --repo-root . --suite backend \
  --include-file backend/gym_app/tests/models/test_dynamic_document.py

# 6) Strict semantic mode + external lint integration
python3 scripts/test_quality_gate.py --repo-root . \
  --semantic-rules strict --external-lint run --strict --verbose

# 7) Optional performance budgets (warning findings when exceeded)
python3 scripts/test_quality_gate.py --repo-root . \
  --suite-time-budget-seconds 30 --total-time-budget-seconds 120
```

Behavior notes:

- Default semantic rollout mode is `soft`.
- `--semantic-rules off` suppresses semantic findings across backend, frontend unit, and frontend E2E suites.
- `--semantic-rules strict` escalates selected semantic findings (for example `waitForTimeout` in E2E).
- `--external-lint run` executes Ruff (curated PT checks) and ESLint, then normalizes/merges findings.
- Exception markers require documented justification: `quality: disable ... (reason)` and `quality: allow-* (reason)`.
- Supported `allow-*` markers are: `quality: allow-call-contract`, `quality: allow-fragile-selector`, `quality: allow-serial`, and `quality: allow-multi-render` (always with reason).
- For other justified exceptions, use `quality: disable RULE_ID (reason)`.

Quality gate CI workflow:

- `.github/workflows/test-quality-gate.yml`

### Run all test suites

Run all test suites in parallel (backend block runner + frontend unit + frontend E2E):

```bash
python scripts/run-tests-all-suites.py
```

This runs all three suites concurrently, displays a live progress spinner, generates log
files in `test-reports/`, and prints a final summary when all suites complete.

The backend suite delegates to `backend/scripts/run-tests-blocks.py` to run pytest in
memory-safe blocks instead of a single large process. Coverage is appended across all
blocks, so the final report reflects cumulative data.

#### Backend block runner defaults

The following parameters are used by default. Override them with the flags documented
in the next section.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--chunk-size` | `3` | Test files per block |
| `--sleep` | `3` | Seconds between blocks |
| `--block-timeout` | `1200` | Max seconds per block (20 min) |
| `--timeout-grace` | `15` | Grace seconds before kill |
| `--run-id` | `backend-YYYYMMDD` | Report folder name |

Pytest args passed to each block: `--cov=gym_app --cov-branch --cov-append --cov-report=term --cov-report=html`

Before the backend suite starts, the script automatically:
1. Runs `coverage erase` to reset accumulated data.
2. Removes the previous run report directory (`backend/test-reports/backend-blocks/<run-id>`).

#### Coverage report

Coverage is **always shown** in the final report for all three suites:

- **Backend**: Statements, Branches, Lines, and a combined Total (branch-aware).
- **Frontend unit**: Statements, Branches, Functions, and Lines (from Jest JSON summary).
- **Frontend E2E**: Flow coverage percentage (from `e2e-results/flow-coverage.json`).

Coverage percentages are color-coded in the terminal output:

| Range | Color |
|-------|-------|
| > 80% | Green |
| 50 – 80% | Yellow |
| < 50% | Red |

#### Available flags

```bash
# Skip individual suites
python scripts/run-tests-all-suites.py --skip-backend
python scripts/run-tests-all-suites.py --skip-unit
python scripts/run-tests-all-suites.py --skip-e2e

# Run sequentially instead of in parallel
python scripts/run-tests-all-suites.py --sequential

# Show full output and force sequential execution
python scripts/run-tests-all-suites.py --verbose

# Filter backend blocks by block marker (edge, contract, integration, rest)
python scripts/run-tests-all-suites.py --backend-block-markers "edge,contract"

# Filter backend tests by pytest marker expression (-m)
python scripts/run-tests-all-suites.py --backend-markers "edge or contract"

# Pass extra args to run-tests-blocks.py (before --)
python scripts/run-tests-all-suites.py --backend-block-args "--no-markers"

# Override backend block runner parameters
python scripts/run-tests-all-suites.py --chunk-size 10
python scripts/run-tests-all-suites.py --sleep 5
python scripts/run-tests-all-suites.py --block-timeout 900
python scripts/run-tests-all-suites.py --timeout-grace 30
python scripts/run-tests-all-suites.py --run-id my-run-20260101
python scripts/run-tests-all-suites.py --resume

# Forward extra args to each runner
python scripts/run-tests-all-suites.py --backend-args "-x -q"
python scripts/run-tests-all-suites.py --unit-args "--testPathPattern=store"
python scripts/run-tests-all-suites.py --e2e-args "--grep @smoke"

# Control parallelism
python scripts/run-tests-all-suites.py --unit-workers 4
python scripts/run-tests-all-suites.py --e2e-workers 2

# Custom log output directory (default: test-reports/)
python scripts/run-tests-all-suites.py --report-dir ci-reports
```

## Environment Configuration

This project uses environment variables for configuration via `python-decouple`. Copy the example file and configure your environment:

```bash
cp backend/.env.example backend/.env
# Edit .env with your values
```

See `backend/.env.example` for all available options. In development, most settings have safe defaults (SQLite, console email, etc.).

## Backups

Automated backups run every 20 days via Huey task queue. Backups are stored in the path configured by `BACKUP_STORAGE_PATH` (default: `/var/backups/gym_project/`) with 90-day retention (~5 backups).

Manual backup:

```bash
source backend/venv/bin/activate
python backend/manage.py dbbackup --compress
python backend/manage.py mediabackup --compress
```

## Performance Monitoring

Query profiling is powered by **django-silk** and is disabled by default. It is only intended for development and debugging — never enable it in production under sustained load.

### Enabling Silk

Set `ENABLE_SILK=true` in `backend/.env`, then run migrations to create Silk's tables:

```bash
source backend/venv/bin/activate
python backend/manage.py migrate
python backend/manage.py runserver
```

Access the dashboard at **`/silk/`** (staff users only).

### What you can explore in the Silk dashboard

| Section | What it shows |
|---------|--------------|
| **Requests** | Every HTTP request with URL, method, status code, total time, and number of SQL queries |
| **SQL queries** | All queries executed per request, with raw SQL, execution time, and stack trace |
| **Summary** | Aggregate statistics: slowest requests, most-queried endpoints, average response times |

Active settings when Silk is enabled:

| Setting | Value | Description |
|---------|-------|-------------|
| `SILKY_ANALYZE_QUERIES` | `True` | Parse and annotate SQL queries |
| `SILKY_MAX_RECORDED_REQUESTS` | `10000` | Cap on stored request records |
| `SILKY_IGNORE_PATHS` | `/admin/`, `/static/`, `/media/`, `/silk/` | Paths excluded from profiling |
| `SILKY_MAX_REQUEST_BODY_SIZE` | `1024` | Max bytes of request body stored per record |
| `SILKY_MAX_RESPONSE_BODY_SIZE` | `1024` | Max bytes of response body stored per record |
| `SLOW_QUERY_THRESHOLD_MS` | `500` | Threshold for the weekly slow-query report |
| `N_PLUS_ONE_THRESHOLD` | `10` | Min queries/request to flag as N+1 suspect |

### `silk_garbage_collect` management command

Deletes Silk `Request` records (and their cascaded SQL query / profiling data) older than a configurable number of days.

```bash
# Delete records older than 7 days (default)
python backend/manage.py silk_garbage_collect

# Delete records older than 14 days
python backend/manage.py silk_garbage_collect --days=14

# Preview what would be deleted without deleting anything
python backend/manage.py silk_garbage_collect --dry-run

# Combine: preview with a custom retention window
python backend/manage.py silk_garbage_collect --days=3 --dry-run
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--days N` | `7` | Retention period in days; records older than this are deleted |
| `--dry-run` | `False` | Print the count of matching records without deleting |

**Example output (normal run):**

```
Silk records older than 2026-02-19 04:00:00+00:00:
  - Requests to delete: 312
Deleted 1247 records
```

> The deleted count is higher than "requests to delete" because each `Request` cascades to its associated `SQLQuery` and profiling records.

**Example output (dry-run):**

```
Silk records older than 2026-02-19 04:00:00+00:00:
  - Requests to delete: 312
DRY RUN: Nothing was deleted
```

### Automated cron jobs (Huey)

Both tasks run automatically via the Huey task queue when `ENABLE_SILK=true`. They are no-ops when Silk is disabled.

#### 1. Daily garbage collection

| Property | Value |
|----------|-------|
| Task | `silk_garbage_collection` in `gym_project/tasks.py` |
| Schedule | Every day at **04:00 UTC** |
| Action | Calls `silk_garbage_collect --days=7` |
| Configurable | Change `--days` value directly in the task source |

#### 2. Weekly slow-query report

| Property | Value |
|----------|-------|
| Task | `weekly_slow_queries_report` in `gym_project/tasks.py` |
| Schedule | Every **Monday at 08:00 UTC** |
| Output file | `backend/logs/silk-weekly-report.log` (appended each week) |
| Slow-query threshold | `SLOW_QUERY_THRESHOLD_MS` (default: `500` ms) |
| N+1 threshold | `N_PLUS_ONE_THRESHOLD` (default: `10` queries per request) |

The report covers the **last 7 days** of recorded requests and contains two sections:

- **Slow queries** — top 50 SQL queries exceeding the threshold, sorted by execution time descending.
- **N+1 suspects** — top 20 endpoints with more DB queries per request than the threshold, sorted by query count descending.

**Example report (`backend/logs/silk-weekly-report.log`):**

```
============================================================
WEEKLY QUERY REPORT - 2026-02-24
============================================================

## SLOW QUERIES (>500ms)
----------------------------------------
[1243ms] /api/processes/ - SELECT "gym_app_process"."id", "gym_app_process"."title"...
[872ms] /api/documents/ - SELECT "gym_app_dynamicdocument"."id", "gym_app_dynamicdocument"."title"...
[603ms] /api/organizations/ - SELECT "gym_app_organization"."id", "gym_app_organization"."title"...

## POTENTIAL N+1 (>10 queries/request)
----------------------------------------
[34 queries] /api/processes/123/
[18 queries] /api/documents/456/
[12 queries] /api/organizations/7/

============================================================
```

If no issues are found, each section reads `No slow queries found this week` or `No N+1 patterns detected this week`.

## Task Queue

This project uses Huey with Redis for background tasks (backups, monitoring, subscription billing).

In development, Huey runs in immediate mode (synchronous). In production, ensure the Huey service is running:

```bash
sudo systemctl status gym-project-huey
```

See `scripts/systemd/README.md` for installation instructions.

## Documentation

Project documentation lives in the `docs/` directory:

| Document | Description |
|----------|-------------|
| `docs/STANDARD_ARCHITECTURE.md` | Project architecture standard |
| `docs/DJANGO_VUE_ARCHITECTURE_STANDARD.md` | Django + Vue architecture patterns |
| `docs/TESTING_QUALITY_STANDARDS.md` | Testing quality criteria and rules |
| `docs/TEST_QUALITY_GATE_REFERENCE.md` | Quality gate CLI reference and algorithm |
| `docs/BACKEND_AND_FRONTEND_COVERAGE_REPORT_STANDARD.md` | Coverage report standards |
| `docs/E2E_FLOW_COVERAGE_REPORT_STANDARD.md` | E2E flow coverage standards |
| `docs/FUNCTIONAL_GUIDE_BY_ROLE.md` | Feature guide by user role |
| `docs/USER_FLOW_MAP.md` | User flow maps |
| `docs/GLOBAL_RULES_GUIDELINES.md` | Global development rules and guidelines |

## Project change guidelines

Before implementing changes, review:

- `guidelines.md`
- `CHANGE_GUIDELINES.md`
