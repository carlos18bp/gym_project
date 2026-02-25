# Test Quality Gate Reference

This document is the complete technical reference for the `scripts/test_quality_gate.py` tooling (architecture, flow, rules rollout, dedupe, exceptions, and all CLI options).

## 1) Purpose and scope

The quality gate analyzes test code quality for:

- Backend tests (`pytest`)
- Frontend unit tests (`Jest` + Vue Test Utils)
- Frontend E2E tests (`Playwright`)

It is analysis-only and does not modify production business logic.

---

## 2) Architecture and file map

```text
scripts/
├── test_quality_gate.py            # Orchestrator (CLI, report build, dedupe, summaries)
└── quality/
    ├── base.py                     # Shared dataclasses, enums, semantic rule IDs
    ├── patterns.py                 # Regex/pattern helpers
    ├── backend_analyzer.py         # Python AST analyzer (pytest tests)
    ├── frontend_unit_analyzer.py   # Frontend unit analyzer (via JS AST bridge)
    ├── frontend_e2e_analyzer.py    # Frontend E2E analyzer (via JS AST bridge + selector checks)
    ├── js_ast_bridge.py            # Python bridge for Node/Babel parser
    └── external_lint.py            # Ruff/ESLint execution + normalization + fingerprinting

frontend/scripts/
└── ast-parser.cjs                  # Babel parser for JS/TS tests (unit + e2e signals)
```

---

## 3) Execution flow

1. Parse CLI arguments.
2. Discover test files by suite (`backend`, `frontend-unit`, `frontend-e2e`).
3. Run analyzers and collect raw issues.
4. Optionally run external lint (`ruff` + `eslint`) and attach normalized findings.
5. Apply optional include filters (`--include-file`, `--include-glob`).
6. Collect exception markers from analyzed files:
   - `quality: disable RULE_ID (reason)`
   - `quality: allow-* (reason)` markers
7. Apply valid `disable` suppressions.
8. Apply semantic rollout gating for `--semantic-rules off` (backend + frontend-unit + frontend-e2e semantic findings).
9. Deduplicate issues across internal/external sources.
10. Attach suite-level findings (`suite_findings`) and build summary.
11. Write JSON report.

---

## 4) Semantic rollout modes

`--semantic-rules` controls semantic signal strictness:

- `off`
  - suppresses semantic findings for backend, frontend unit, and frontend E2E analyzers,
  - keeps non-semantic hygiene checks active,
  - external lint findings remain informational.
- `soft` (default)
  - semantic findings are reported with default severities.
- `strict`
  - selected semantic findings escalate severity (e.g., `waitForTimeout` in E2E).

Central semantic rule identifiers are defined in `scripts/quality/base.py` (`SEMANTIC_RULE_IDS`) and include E2E anti-patterns such as `wait_for_timeout`.

---

## 5) External lint integration (`--external-lint`)

Modes:

- `off` (default): skip external lint execution.
- `run`: execute both engines and merge findings:
  - Ruff on backend test targets (curated PT rules)
  - ESLint on frontend test targets

Behavior in `run` mode:

- Status `ok`: findings are normalized and attached.
- Status `misconfigured`: emits `linter_misconfigured`.
- Status `unavailable`: emits `tool_unavailable`.

Normalization contract (per finding):

- `source`
- `file`
- `line`
- `col`
- `external_rule_id`
- `message`
- `severity_raw`
- `normalized_rule_id`
- `fingerprint`

---

## 6) Dedupe model

Cross-engine dedupe uses dual identity keys:

1. `fingerprint` when available (preferred)
2. canonical fallback: `file + line + normalized_rule_id`

Additionally, for known cross-engine overlaps where line numbers may differ (for example `wait_for_timeout` / `sleep_call`), a relaxed file+rule bridge is used when reconciling external findings against internal issues.

When two issues collide, the gate keeps the richer payload (identifier/suggestion/source/fingerprint/message detail).

---

## 7) Exception markers

### 7.1 Generic disable marker

Format:

```text
quality: disable RULE_ID (reason)
```

Rules:

- `reason` is mandatory for suppression.
- Missing reason => marker is tracked under `summary.active_exceptions.invalid` and does not suppress.

### 7.2 Existing allow markers

The gate also tracks existing allow markers as active exceptions:

- `quality: allow-call-contract (reason)`
- `quality: allow-fragile-selector (reason)`
- `quality: allow-serial (reason)`
- `quality: allow-multi-render (reason)`

Rules:

- `reason` is mandatory for allow markers to be considered valid/active.
- Missing reason => marker is tracked under `summary.active_exceptions.invalid` and does not suppress.

### 7.3 Exception reporting

`summary.active_exceptions` includes:

- `total`
- `by_rule`
- `by_file`
- `details`
- `invalid` (`total`, `details`)

---

## 8) Report schema highlights

Top-level:

- `summary`
- `backend`
- `frontend.unit`
- `frontend.e2e`

`summary` key fields:

- `errors`, `warnings`, `info`, `quality_score`, `status`
- `issues_by_category`
- `semantic_rules`
- `semantic_suppressed_by_mode`
- `active_exceptions`
- `external_lint`
- `timings`

Each suite (`backend`, `frontend.unit`, `frontend.e2e`) includes:

- `files`, `tests`, `errors`, `warnings`, `info`
- `issues`
- `suite_findings`
- `file_details`

`suite_findings` currently includes:

- `semantic_issues_suppressed_by_mode`
- `active_exceptions_count`
- `error_count`
- `warning_count`

---

## 9) CLI options (complete)

| Option | Type / Values | Default | Description |
|---|---|---|---|
| `--repo-root` | path | `.` | Repository root |
| `--report-path` | path | `test-results/test-quality-report.json` | JSON output path |
| `--backend-app` | string | `gym_app` | Django app name for backend tests |
| `--suite` | `backend` \| `frontend-unit` \| `frontend-e2e` | all suites | Scope analysis to one suite |
| `--verbose`, `-v` | flag | false | Verbose runtime output |
| `--strict` | flag | false | Fail command on warnings too |
| `--semantic-rules` | `off` \| `soft` \| `strict` | `soft` | Semantic rollout mode |
| `--external-lint` | `off` \| `run` | `off` | External lint integration mode |
| `--suite-time-budget-seconds` | float | none | Optional per-suite budget warning |
| `--total-time-budget-seconds` | float | none | Optional total budget warning |
| `--show-all` | flag | false | Print info-level issue details in terminal |
| `--no-color` | flag | false | Disable ANSI colors |
| `--json-only` | flag | false | Print JSON to stdout |
| `--include-file` | repeatable path | none | Exact file include filter |
| `--include-glob` | repeatable glob | none | Glob include filter |
| `--max-test-lines` | int | `50` | Max lines before long-test finding |
| `--max-assertions` | int | `7` | Max assertions per test threshold |
| `--max-patches` | int | `5` | Max patch decorators per test threshold |

---

## 10) Common operational commands

```bash
# Full gate (all suites)
python3 scripts/test_quality_gate.py --repo-root .

# Strict CI-like run with external lint
python3 scripts/test_quality_gate.py --repo-root . \
  --semantic-rules strict --external-lint run --strict --verbose

# Single suite
python3 scripts/test_quality_gate.py --repo-root . --suite backend

# Scoped backend file
python3 scripts/test_quality_gate.py --repo-root . --suite backend \
  --include-file backend/gym_app/tests/models/test_dynamic_document.py
```

---

## 11) Pre-commit and CI

- Pre-commit hook definition: `.pre-commit-config.yaml`
- CI workflow: `.github/workflows/test-quality-gate.yml`

Pre-commit default behavior is staged-test-only scoping.
