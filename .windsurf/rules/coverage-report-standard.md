---
trigger: model_decision
description: Coverage report configuration for pytest and Jest. Use when setting up coverage, modifying conftest.py coverage hooks, configuring Jest coverage reporters, or interpreting coverage output.
---

# Backend & Frontend Coverage Report Standard

Full reference: `docs/BACKEND_AND_FRONTEND_COVERAGE_REPORT_STANDARD.md`

## Shared Color Thresholds

| Coverage % | Color | Meaning |
|------------|-------|---------|
| > 80% | 🟢 Green | Good |
| 50–80% | 🟡 Yellow | Needs improvement |
| < 50% | 🔴 Red | Critical — prioritize |

## Backend — pytest Coverage

### Dependencies

`pytest`, `pytest-cov`, `pytest-django`, `coverage` — all in `backend/requirements.txt`.

### Config: `backend/pytest.ini`

```ini
[pytest]
DJANGO_SETTINGS_MODULE = gym_project.settings
python_files = tests.py test_*.py *_tests.py
markers =
    contract: API contract tests for response schemas
    integration: integration tests exercising DB + permissions + side effects
    edge: edge-case and mocking-focused tests
```

### Custom Reporter: `backend/conftest.py`

The `conftest.py` contains 3 pytest hooks that:
1. **Suppress** default `pytest-cov` terminal report
2. **Read** `.coverage` data file directly
3. **Render** custom colored table with per-file stats + focus footer

**Adaptation points when modifying:**
- App name filter: search for the app name string in `conftest.py` (filters source files, excludes `/tests/`)
- Top-N focus count: the `[:3]` slice controls how many low-coverage files appear in the footer
- Bar widths: `_MINI_W` (per-file) and `_WIDE_W` (total row)

### Run Command

```bash
source venv/bin/activate && pytest --cov
```

### Report Sections

1. **Per-file table**: path | stmts | missing | pct% | [bar]
2. **TOTAL summary row**
3. **Focus footer**: "Top-N files to focus on" or "All files fully covered"

---

## Frontend — Jest Coverage

### Config: `frontend/jest.config.cjs`

Key setting: `coverageReporters: ['text', 'text-summary', 'json-summary']`
- `text` → per-file table
- `text-summary` → Statements/Branches/Functions/Lines totals
- `json-summary` → writes `coverage/coverage-summary.json` for the custom script

### Custom Reporter: `frontend/scripts/coverage-summary.cjs`

Reads `coverage/coverage-summary.json` after Jest finishes and prints:
1. **Header + total bar** with progress indicator
2. **Bucket summary**: count of files >80%, 50-80%, <50%
3. **Top 10** files with most uncovered statements

**Adaptation points when modifying:**
- Source path regex: `filePath.replace(/.*\/src\//, 'src/')` — adjust for your source directory
- Top-N count: `.slice(0, 10)` controls the number of files shown

### Run Command

```bash
npm run test:coverage
```

This runs: `jest --config jest.config.cjs --coverage && node scripts/coverage-summary.cjs`

### Report Sections (3 in sequence)

1. **Jest `text` reporter**: per-file table (Stmts/Branch/Funcs/Lines)
2. **Jest `text-summary`**: Coverage summary block
3. **Custom `coverage-summary.cjs`**: progress bar, bucket counts, top-10 uncovered

---

## Interpreting Coverage Output

- **Prioritize** files with lowest % and highest "Miss" count
- **Priority order**: Views → Serializers → Models → Utils → Tasks (backend); Stores → Composables → Components (frontend)
- **Do not** polish near-100% files until low-coverage files are addressed
- Coverage measures lines executed, **not** behavior verified — a test with no assertions gives coverage but no value
