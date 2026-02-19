# G&M Internal Management Tool

## Overview

G&M Internal Management Tool is a custom-built application designed for managing legal processes within the company. This tool helps streamline the interactions between **lawyers** and **clients**, allowing both roles to manage and track the progression of legal cases, files, and other related tasks in a more efficient and structured manner.

The application is built with a **role-based system** where users are either clients or lawyers. Clients can view and track the progress of their cases, while lawyers can manage the legal processes, update case statuses, and upload case files.

## Main Features

### 1. **User Management**
   - The **Users** model is at the core of the application and is built around a **role-based system**. Users can either be:
     - **Clients**: Users who have ongoing legal processes and need to track the status of their cases.
     - **Lawyers**: Legal professionals who manage the cases, update statuses, and upload necessary documents.
   - User roles determine what parts of the system the user can access and manage.

### 2. **Process Management**
   - The **Process** model represents the legal cases being handled within the system.
   - Each process can contain several key attributes, such as:
     - **Authority**: The entity managing the case.
     - **Plaintiff** and **Defendant**: The parties involved in the case.
     - **Case Type**: The classification of the legal matter (e.g., Civil, Criminal).
     - **Subcase**: A more specific classification within the case type.
     - **File Number**: A unique identifier for each case.

### 3. **Stage Management**
   - **Processes** can have different **Stages**, representing the current phase of the legal proceedings.
   - Each stage is timestamped, allowing users to track the evolution of the case over time.

### 4. **Case File Management**
   - Each **Process** can have one or more **Case Files** attached to it. These files may include important legal documents, evidence, or other files necessary for the process.
   - Case files can be uploaded by lawyers and viewed by clients, providing a centralized place for managing all relevant documentation.

## Core Models

### 1. **Users**
   The `User` model handles the application's role-based access system. Users can be either:
   - **Clients**: Users who have cases in the system and can monitor their progress.
   - **Lawyers**: Users who manage the cases, update the status, and upload case files.

### 2. **Processes**
   The `Process` model is the heart of the system, representing the legal cases. It contains essential information such as:
   - **Authority**: The court or legal authority overseeing the case.
   - **Plaintiff** and **Defendant**: The involved parties.
   - **Stage**: A Many-to-Many relationship with the stages, tracking the progress of the case.
   - **Case Files**: A Many-to-Many relationship representing all documents associated with the case.

### 3. **Stages**
   The `Stage` model represents the different stages of the legal process. Each stage can have:
   - **Status**: The current phase of the case (e.g., "Under Investigation", "In Court").
   - **Date Created**: The date the stage was reached.

### 4. **Case Files**
   The `Case File` model handles the files attached to each process. These could include:
   - **File Name**: The name of the file.
   - **Description**: A brief description of the contents of the file.
   - **Date Uploaded**: When the file was uploaded.

## Development Quickstart

This repository is organized as:

```
backend/   # Django project
frontend/  # Vue 3 project
```

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
python3 -m venv backend/.venv
source backend/.venv/bin/activate
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

Run backend tests:

```bash
cd backend
pytest gym_app/tests/<domain>/test_<feature>.py -v
pytest gym_app/tests/<domain>/test_<feature>.py gym_app/tests/<domain>/test_<feature>_regression.py -v
```

Run backend tests in blocks (low RAM, markers + test groups):

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

Run the backend dev server:

```bash
python backend/manage.py runserver
```

### Frontend (Vue 3)

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

Run frontend unit tests (targeted):

```bash
cd frontend
npm run test -- test/stores/<store>.test.js
npm run test -- test/components/<component>.test.js test/composables/<composable>.test.js
```

Run E2E tests (Playwright, targeted):

```bash
cd frontend
npx playwright install chromium
npm run e2e -- e2e/<flow>.spec.js
npm run e2e -- e2e/<flow>.spec.js e2e/<related-flow>.spec.js
```

Optional: enable Playwright console/page error logs (silenced by default):

```bash
cd frontend
E2E_LOG_ERRORS=1 npm run e2e
```

Run E2E coverage (Playwright + V8):

```bash
cd frontend
npx playwright install chromium
npm run e2e:coverage
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

- `TEST_QUALITY_GATE_REFERENCE.md`

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

Run the full test suite in blocks (backend blocks + frontend unit + E2E with coverage):

```bash
python scripts/run-tests-all-blocks.py
```

This generates log files in `test-reports/` and prints a final summary (coverage included).

Defaults per suite:

- **Backend**: runs `backend/scripts/run-tests-blocks.py` with default marker blocks
  (edge, contract, integration, rest), default chunk size **22**, and default sleep **2s**.
- **Frontend unit**: runs `npm run test -- --coverage --runInBand`.
- **Frontend E2E**: runs `npx playwright test --workers=1` with `E2E_COVERAGE=1`,
  then generates coverage via `npx nyc report`.

Optional flags:

```bash
python scripts/run-tests-all-blocks.py --skip-e2e
python scripts/run-tests-all-blocks.py --backend-markers edge,contract
python scripts/run-tests-all-blocks.py --backend-groups models,serializers
python scripts/run-tests-all-blocks.py --backend-args "--chunk-size 12"
python scripts/run-tests-all-blocks.py --backend-args "--chunk-size 22 --sleep 2"
```

Coverage output:

- Raw coverage JSON: `frontend/.nyc_output/`
- HTML report: `frontend/coverage-e2e/lcov-report/index.html`
- Console summary: printed after the run

To collect coverage for a single spec, run Playwright with `E2E_COVERAGE=1` and then build the report:

```bash
cd frontend
E2E_COVERAGE=1 npm run e2e -- e2e/subscriptions-flow.spec.js
nyc report --temp-dir .nyc_output --report-dir coverage-e2e --reporter=lcov --reporter=text-summary
```

Run only the Organizations E2E suite:

```bash
cd frontend
npm run e2e -- e2e/organizations*.spec.js
```

### Project change guidelines

Before implementing changes, review:

- `guidelines.md`
- `CHANGE_GUIDELINES.md`
