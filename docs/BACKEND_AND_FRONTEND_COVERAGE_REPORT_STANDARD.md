# Backend and Frontend Coverage Report Standard

This document defines the **standard configuration** for generating unified, human-readable coverage reports in both **backend (Django/pytest)** and **frontend unit tests (Jest)**. Follow this guide step-by-step to replicate the same report format in any project.

> **Scope:** Backend + Frontend unit tests only. E2E test coverage has its own standard (see `E2E_FLOW_COVERAGE_REPORT_STANDARD.md`).

---

## Table of Contents

1. [Report Design Goals](#1-report-design-goals)
2. [Backend — pytest Coverage Report](#2-backend--pytest-coverage-report)
3. [Frontend — Jest Unit Test Coverage Report](#3-frontend--jest-unit-test-coverage-report)
4. [Expected Output Examples](#4-expected-output-examples)
5. [Quick-Start Checklist](#5-quick-start-checklist)

---

## 1. Report Design Goals

| Principle | Description |
|-----------|-------------|
| **Consistency** | Both backend and frontend reports use the same color thresholds and visual language |
| **Actionable** | Reports highlight the files that need the most attention first |
| **Minimal noise** | Default verbose reporters are suppressed; only the custom summary is shown |
| **Portable** | Works in any terminal (CI or local) — uses ANSI colors and Unicode block characters |

### Color Thresholds (shared)

| Coverage % | Color | Meaning |
|------------|-------|---------|
| > 80% | 🟢 Green | Good coverage |
| 50–80% | 🟡 Yellow | Needs improvement |
| < 50% | 🔴 Red | Critical — prioritize immediately |

---

## 2. Backend — pytest Coverage Report

### 2.1 Dependencies

Add these to your `requirements.txt`:

```txt
pytest==8.3.2
pytest-cov==5.0.0
pytest-django==4.8.0
coverage==7.6.1
```

> **Note:** `pytest-cov` and `coverage` work together. `pytest-cov` is the pytest plugin; `coverage` is the underlying engine used by the custom reporter to read `.coverage` data.

### 2.2 `pytest.ini`

Create `backend/pytest.ini` in your backend root:

```ini
[pytest]
DJANGO_SETTINGS_MODULE = base_feature_project.settings_dev
python_files = test_*.py
addopts = -q
```

| Option | Purpose |
|--------|---------|
| `DJANGO_SETTINGS_MODULE` | Points to your Django settings (change per project) |
| `python_files` | Test file discovery pattern |
| `addopts = -q` | Quiet mode — reduces default output noise so the custom report stands out |

### 2.3 `conftest.py` — Custom Coverage Reporter

Create `backend/conftest.py` in your backend root. This file contains three pytest hooks that:

1. **Suppress** the default `pytest-cov` terminal report.
2. **Read** the `.coverage` data file directly.
3. **Render** a custom colored table with per-file stats and a summary footer.

```python
import os

import coverage as coverage_module
import pytest

# Bar widths: per-file bars use MINI, the TOTAL row uses WIDE
_MINI_W = 13
_WIDE_W = 15


def _color_for(pct):
    """Return a pytest terminal color name based on coverage percentage."""
    if pct > 80:
        return "green"
    if pct >= 50:
        return "yellow"
    return "red"


def _bar(pct, width):
    """Build a Unicode progress bar: █ for covered, · for uncovered."""
    filled = round(pct / 100 * width)
    return "█" * filled + "·" * (width - filled)


def pytest_sessionstart(session) -> None:
    """
    Suppress the default pytest-cov terminal summary.
    This runs at session start and replaces the built-in hook with a no-op
    so it doesn't print its own coverage table.
    """
    cov_plugin = session.config.pluginmanager.get_plugin("_cov")
    if cov_plugin is None:
        return
    hook = session.config.pluginmanager.hook.pytest_terminal_summary
    for impl in hook.get_hookimpls():
        if impl.plugin is cov_plugin:
            impl.function = lambda *args, **kw: None
            break


@pytest.hookimpl(tryfirst=True)
def pytest_configure(config):
    """
    Remove any 'term' report formats from pytest-cov options.
    This prevents pytest-cov from printing its default terminal coverage table,
    while still allowing it to generate the .coverage data file.
    """
    try:
        if hasattr(config.option, "cov_report"):
            config.option.cov_report = [
                r for r in config.option.cov_report
                if not r.startswith("term")
            ]
    except Exception:
        pass


@pytest.hookimpl(trylast=True)
def pytest_terminal_summary(terminalreporter, exitstatus, config):
    """
    Custom coverage report printed after all tests finish.

    Reads the .coverage data file, filters to app-specific source files
    (excluding test files), and prints:
      1. A per-file table: path | stmts | missing | pct% | [bar]
      2. A TOTAL summary row
      3. A "Top-N files to focus on" or "All files fully covered" footer
    """
    cov_file = os.path.join(os.path.dirname(__file__), ".coverage")
    if not os.path.exists(cov_file):
        return

    try:
        cov = coverage_module.Coverage(data_file=cov_file)
        cov.load()
    except Exception:
        return

    results = []
    try:
        measured = cov.get_data().measured_files()
    except Exception:
        return

    for filepath in measured:
        norm = filepath.replace("\\", "/")
        # ┌─────────────────────────────────────────────────────────────┐
        # │ ADAPT THIS: Change "base_feature_app" to your app name.    │
        # │ This filters to only your application source files and      │
        # │ excludes test files from the coverage report.               │
        # └─────────────────────────────────────────────────────────────┘
        if "base_feature_app" not in norm or "/tests/" in norm:
            continue
        try:
            analysis = cov._analyze(filepath)
            stmts = len(analysis.statements)
            if stmts == 0:
                continue
            missing = len(analysis.missing)
            pct = (stmts - missing) / stmts * 100
            idx = norm.find("base_feature_app")
            short = norm[idx:] if idx >= 0 else norm
            results.append(
                {
                    "path": short,
                    "stmts": stmts,
                    "missing": missing,
                    "pct": pct,
                    "missing_lines": list(analysis.missing),
                }
            )
        except Exception:
            continue

    if not results:
        return

    results.sort(key=lambda r: r["path"])

    total_stmts = sum(r["stmts"] for r in results)
    total_missing = sum(r["missing"] for r in results)
    total_pct = (total_stmts - total_missing) / total_stmts * 100 if total_stmts > 0 else 0

    # Top-N: up to 3 files with the lowest coverage (only those with missing lines)
    top_n = sorted(
        [r for r in results if r["missing"] > 0],
        key=lambda x: (x["pct"], -x["missing"]),
    )[:3]

    # Calculate dynamic column width based on terminal width
    try:
        term_w = terminalreporter._tw._width
    except AttributeError:
        import shutil
        term_w = shutil.get_terminal_size().columns

    # fixed cols: 2 indent + 2 sep + 5 stmts + 2 sep + 4 miss + 2 sep + 7 pct% + 2 sep + 1 [ + MINI_W + 1 ]
    _FIXED = 2 + 2 + 5 + 2 + 4 + 2 + 7 + 2 + 1 + _MINI_W + 1
    max_path_w = max(term_w - _FIXED - 2, 20)  # -2 safety margin
    actual_max = max((len(r["path"]) for r in results), default=40)
    path_w = min(max_path_w, actual_max)
    path_w = max(path_w, 20)

    for r in results:
        if len(r["path"]) > path_w:
            r["path"] = r["path"][: path_w - 1] + "…"

    # ── Section 1: Per-file table ──
    tw = terminalreporter
    tw.write_sep("=", "COVERAGE REPORT", bold=True)
    tw.write("\n")

    for r in results:
        color = _color_for(r["pct"])
        mini = _bar(r["pct"], _MINI_W)
        tw.write(f"  {r['path']:<{path_w}}  {r['stmts']:>5}  {r['missing']:>4}  ")
        tw.write(f"{r['pct']:>6.1f}%  ", **{color: True})
        tw.write("[")
        tw.write(mini, **{color: True})
        tw.write("]\n")

    # ── Section 2: TOTAL row ──
    tw.write("\n")
    c = _color_for(total_pct)
    wide = _bar(total_pct, _WIDE_W)
    tw.write(f"  {'TOTAL':<{path_w}}  {total_stmts:>5}  {total_missing:>4}  ", bold=True)
    tw.write(f"{total_pct:>6.1f}%  ", bold=True, **{c: True})
    tw.write("[", bold=True)
    tw.write(wide, bold=True, **{c: True})
    tw.write("]\n\n", bold=True)

    # ── Section 3: Focus footer ──
    dash = "─" * 10
    n = len(top_n)
    label = f"Top-{n} files to focus on" if top_n else "All files fully covered"
    tw.write(f"  {dash}  {label}  ", bold=True)
    tw.write(f"(total project: {total_pct:.1f}%)  ", bold=True)
    tw.write(f"{dash}\n", bold=True)

    if not top_n:
        tw.write("\n", green=True)
    else:
        for i, r in enumerate(top_n, 1):
            color = _color_for(r["pct"])
            mini = _bar(r["pct"], _MINI_W)
            tw.write(f"  {i}.  ")
            tw.write(f"{r['pct']:>5.1f}%", **{color: True})
            tw.write("  [")
            tw.write(mini, **{color: True})
            tw.write(f"]  {r['path']}")
            tw.write(f"   ({r['missing']} lines uncovered)\n")
        tw.write("\n")
```

### 2.4 How to Run

```bash
cd backend
source venv/bin/activate
pytest --cov
```

The `--cov` flag tells `pytest-cov` to collect coverage data into `.coverage`. The custom `conftest.py` hooks suppress the default report and print the custom one instead.

### 2.5 Adaptation Notes

When applying to a new project, change these items:

| What to change | Where | Example |
|----------------|-------|---------|
| App name filter | `conftest.py` line with `"base_feature_app"` | Change to `"your_app_name"` |
| Django settings module | `pytest.ini` → `DJANGO_SETTINGS_MODULE` | Change to your project settings |
| Top-N count | `conftest.py` → `[:3]` slice | Increase if you want more files listed |

---

## 3. Frontend — Jest Unit Test Coverage Report

### 3.1 Dependencies

Add these to your `package.json` → `devDependencies`:

```json
{
  "devDependencies": {
    "@babel/core": "^7.24.7",
    "@babel/preset-env": "^7.24.7",
    "@testing-library/jest-dom": "^6.4.6",
    "@vue/test-utils": "^2.4.6",
    "@vue/vue3-jest": "^29.2.6",
    "babel-jest": "^29.7.0",
    "identity-obj-proxy": "^3.0.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "jest-transform-stub": "^2.0.0"
  }
}
```

> **Note:** If your project uses React instead of Vue, replace `@vue/vue3-jest` and `@vue/test-utils` with the appropriate React testing packages. The coverage reporter script is framework-agnostic.

### 3.2 `jest.config.cjs`

Create `frontend/jest.config.cjs`:

```js
module.exports = {
    moduleFileExtensions: ['js', 'json', 'vue'],
    transform: {
      '^.+\\.vue$': '@vue/vue3-jest',
      '^.+\\.js$': 'babel-jest',
      ".+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$": "jest-transform-stub"
    },
    testEnvironment: 'jest-environment-jsdom',
    testEnvironmentOptions: {
      customExportConditions: ["node", "node-addons"],
    },
    testPathIgnorePatterns: ['/node_modules/', '/test/e2e/', '/e2e/'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '\\.(css|less|scss|sass|png)$': 'identity-obj-proxy',
    },
    transformIgnorePatterns: ['/node_modules/'],
    setupFilesAfterEnv: ['./jest.setup.js'],
    coverageReporters: ['text', 'text-summary', 'json-summary'],
  };
```

Key settings for coverage:

| Option | Purpose |
|--------|---------|
| `coverageReporters: ['text', 'text-summary', 'json-summary']` | `text` prints the per-file table; `text-summary` prints the Coverage summary block (Statements/Branches/Functions/Lines totals); `json-summary` writes `coverage/coverage-summary.json` which the custom script reads |
| `testPathIgnorePatterns` | Excludes E2E tests from unit test runs |

### 3.3 `babel.config.cjs`

Create `frontend/babel.config.cjs`:

```js
module.exports = {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }]
    ]
  };
```

### 3.4 `jest.setup.js`

Create `frontend/jest.setup.js`:

```js
import '@testing-library/jest-dom';
```

### 3.5 `scripts/coverage-summary.cjs` — Custom Coverage Reporter

Create `frontend/scripts/coverage-summary.cjs`. This script runs **after** Jest finishes and reads the `json-summary` output to print a styled report.

```js
'use strict';

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';

/**
 * Return ANSI color code based on coverage percentage.
 * Thresholds match the backend: green >80%, yellow 50-80%, red <50%.
 */
function colorFor(pct) {
  if (pct > 80)  return GREEN;
  if (pct >= 50) return YELLOW;
  return RED;
}

/**
 * Build a Unicode progress bar: █ for covered, ░ for uncovered.
 * @param {number} pct  - Coverage percentage (0-100)
 * @param {number} width - Total bar width in characters
 */
function progressBar(pct, width = 30) {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Format a percentage for display, right-aligned with 1 decimal.
 */
function fmt(pct) {
  if (pct == null || isNaN(pct)) return '  N/A%';
  return `${pct.toFixed(1).padStart(5)}%`;
}

// ── Read the coverage-summary.json generated by Jest ──
const summaryPath = path.resolve(__dirname, '../coverage/coverage-summary.json');
if (!fs.existsSync(summaryPath)) {
  console.log('\nNo coverage/coverage-summary.json found — run with --coverage first.\n');
  process.exit(0);
}

const raw   = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = raw.total;

// ── Build per-file data ──
const files = Object.entries(raw)
  .filter(([k]) => k !== 'total')
  .map(([filePath, data]) => {
    const stmts   = data.statements.total;
    const covered = data.statements.covered;
    const missing = stmts - covered;
    const pct     = stmts > 0 ? (covered / stmts) * 100 : 100;
    // ┌────────────────────────────────────────────────────────────┐
    // │ ADAPT THIS: Change the regex to match your source root.   │
    // │ This strips the absolute path down to a relative path.    │
    // └────────────────────────────────────────────────────────────┘
    const rel     = filePath.replace(/.*\/src\//, 'src/');
    return {
      path:   rel,
      stmts,
      missing,
      pct,
      branch: data.branches.pct,
      funcs:  data.functions.pct,
      lines:  data.lines.pct,
    };
  });

// ── Compute totals ──
const totalPct   = total.statements.pct;
const totalMiss  = total.statements.total - total.statements.covered;
const totalStmts = total.statements.total;

// ── Bucket counts ──
const greenCount  = files.filter(f => f.pct > 80).length;
const yellowCount = files.filter(f => f.pct >= 50 && f.pct <= 80).length;
const redCount    = files.filter(f => f.pct < 50).length;

// ── Top 10: files with the most uncovered statements ──
const top10 = [...files]
  .filter(f => f.missing > 0)
  .sort((a, b) => b.missing - a.missing)
  .slice(0, 10);

// ── Render the report ──
const sep = '─'.repeat(78);
const c   = colorFor(totalPct);
const bar = progressBar(totalPct);

// Section 1: Header + total bar
console.log(`\n${BOLD}${'='.repeat(30)} COVERAGE SUMMARY ${'='.repeat(30)}${RESET}`);
console.log(`\n  Total   ${totalStmts} stmts   ${totalMiss} missing   ${c}[${bar}]  ${totalPct.toFixed(2)}%${RESET}\n`);

// Section 2: Bucket summary
console.log(
  `  ${GREEN}${String(greenCount).padStart(3)} files${RESET} > 80%` +
  `     ${YELLOW}${String(yellowCount).padStart(3)} files${RESET} 50-80%` +
  `     ${RED}${String(redCount).padStart(3)} files${RESET} < 50%\n`
);

// Section 3: Top 10 uncovered files
console.log(`  ${BOLD}${sep}${RESET}`);
console.log(`  ${BOLD}Top 10 — files with most uncovered statements${RESET}`);
console.log(`  ${BOLD}${sep}${RESET}`);

if (top10.length === 0) {
  console.log(`  ${GREEN}All files fully covered.${RESET}\n`);
} else {
  const hdr =
    `  ${'#'.padEnd(4)} ${'File'.padEnd(46)} ` +
    `${'Stmts'.padStart(5)} ${'Miss'.padStart(5)} ${'Stmts%'.padStart(7)} ${'Branch%'.padStart(8)} ${'Lines%'.padStart(7)}`;
  console.log(`${BOLD}${hdr}${RESET}`);
  console.log(`  ${sep}`);
  top10.forEach((f, i) => {
    const fc = colorFor(f.pct);
    const row =
      `  ${String(i + 1).padEnd(4)} ${f.path.padEnd(46)} ` +
      `${String(f.stmts).padStart(5)} ` +
      `${fc}${String(f.missing).padStart(5)} ${fmt(f.pct)} ${fmt(f.branch)} ${fmt(f.lines)}${RESET}`;
    console.log(row);
  });
  console.log('');
}
```

### 3.6 `package.json` Script

Add this to your `package.json` → `scripts`:

```json
{
  "scripts": {
    "test:coverage": "NODE_OPTIONS='--no-deprecation' jest --config jest.config.cjs --coverage && node scripts/coverage-summary.cjs"
  }
}
```

The `&&` ensures the custom summary script only runs after Jest exits successfully.

### 3.7 How to Run

```bash
cd frontend
npm run test:coverage
```

This will:
1. Run all unit tests with Jest coverage collection.
2. Jest writes `coverage/coverage-summary.json` (via `json-summary` reporter).
3. `coverage-summary.cjs` reads the JSON and prints the styled report.

### 3.8 Adaptation Notes

When applying to a new project, change these items:

| What to change | Where | Example |
|----------------|-------|---------|
| Source path regex | `coverage-summary.cjs` → `filePath.replace(...)` | Change `/.*\/src\//` to match your source directory |
| Jest transform rules | `jest.config.cjs` → `transform` | Adjust for your framework (React, Svelte, etc.) |
| Module aliases | `jest.config.cjs` → `moduleNameMapper` | Match your project's import aliases |
| Top-N count | `coverage-summary.cjs` → `.slice(0, 10)` | Adjust if you want more or fewer files |
| `NODE_OPTIONS` | `package.json` script | Add `--no-deprecation` if needed to suppress Node.js warnings |

---

## 4. Expected Output Examples

### 4.1 Backend Output

```
=============================================== COVERAGE REPORT ================================================

  base_feature_app/admin.py                                        71     0   100.0%  [█████████████]
  base_feature_app/apps.py                                          4     0   100.0%  [█████████████]
  base_feature_app/forms/blog.py                                   23     0   100.0%  [█████████████]
  base_feature_app/models/blog.py                                  18     0   100.0%  [█████████████]
  base_feature_app/views/auth.py                                   53     0   100.0%  [█████████████]
  ...

  TOTAL                                                           923     0   100.0%  [███████████████]

  ──────────  All files fully covered  (total project: 100.0%)  ──────────
```

When there are files with missing coverage:

```
=============================================== COVERAGE REPORT ================================================

  base_feature_app/views/auth.py                                   53     8    84.9%  [███████████··]
  base_feature_app/views/blog_crud.py                              54    20    63.0%  [████████·····]
  base_feature_app/views/product_crud.py                           54     0   100.0%  [█████████████]
  ...

  TOTAL                                                           923    28    97.0%  [██████████████·]

  ──────────  Top-2 files to focus on  (total project: 97.0%)  ──────────
  1.   63.0%  [████████·····]  base_feature_app/views/blog_crud.py   (20 lines uncovered)
  2.   84.9%  [███████████··]  base_feature_app/views/auth.py   (8 lines uncovered)
```

### 4.2 Frontend Output

The frontend output has **three sections** in this order:

1. **Per-file table** — produced by Jest's `text` reporter
2. **Coverage summary** — produced by Jest's `text-summary` reporter (Statements/Branches/Functions/Lines totals)
3. **Custom summary** — produced by `scripts/coverage-summary.cjs` (progress bar, bucket counts, top-10 uncovered)

```
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
All files             |     100 |      100 |     100 |     100 |
 stores               |     100 |      100 |     100 |     100 |
  auth.js             |     100 |      100 |     100 |     100 |
  ...                 |     ... |      ... |     ... |     ... |
----------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 100% ( 536/536 )
Branches     : 100% ( 240/240 )
Functions    : 100% ( 108/108 )
Lines        : 100% ( 502/502 )
================================================================================

Test Suites: 24 passed, 24 total
Tests:       267 passed, 267 total
Snapshots:   0 total
Time:        19.12 s

============================== COVERAGE SUMMARY ==============================

  Total   536 stmts   0 missing   [██████████████████████████████]  100.00%

   24 files > 80%       0 files 50-80%       0 files < 50%

  ──────────────────────────────────────────────────────────────────────────────
  Top 10 — files with most uncovered statements
  ──────────────────────────────────────────────────────────────────────────────
  All files fully covered.
```

When there are files with missing coverage:

```
=============================== Coverage summary ===============================
Statements   : 97.2% ( 521/536 )
Branches     : 95.0% ( 228/240 )
Functions    : 96.3% ( 104/108 )
Lines        : 97.0% ( 487/502 )
================================================================================

============================== COVERAGE SUMMARY ==============================

  Total   536 stmts   15 missing   [████████████████████████████░░]  97.20%

   22 files > 80%       1 files 50-80%       1 files < 50%

  ──────────────────────────────────────────────────────────────────────────────
  Top 10 — files with most uncovered statements
  ──────────────────────────────────────────────────────────────────────────────
  #    File                                           Stmts  Miss  Stmts%  Branch%  Lines%
  ──────────────────────────────────────────────────────────────────────────────
  1    src/stores/auth.js                                45     8  82.2%    75.0%   82.2%
  2    src/composables/useAuth.js                        30     7  76.7%    66.7%   76.7%
```

---

## 5. Quick-Start Checklist

### Backend

1. Install dependencies:
   ```bash
   pip install pytest pytest-cov pytest-django coverage
   ```
2. Create `backend/pytest.ini` with your `DJANGO_SETTINGS_MODULE`.
3. Copy the full `conftest.py` from [Section 2.3](#23-conftestpy--custom-coverage-reporter) into `backend/conftest.py`.
4. Update the app name filter in `conftest.py` (replace `"base_feature_app"` with your app name).
5. Run: `pytest --cov`
6. Verify the custom coverage report appears after the test results.

### Frontend

1. Install dependencies:
   ```bash
   npm install --save-dev jest jest-environment-jsdom @babel/core @babel/preset-env babel-jest jest-transform-stub identity-obj-proxy @testing-library/jest-dom
   ```
   For Vue projects, also install:
   ```bash
   npm install --save-dev @vue/vue3-jest @vue/test-utils
   ```
2. Create `frontend/jest.config.cjs` from [Section 3.2](#32-jestconfigcjs).
3. Create `frontend/babel.config.cjs` from [Section 3.3](#33-babelconfigcjs).
4. Create `frontend/jest.setup.js` from [Section 3.4](#34-jestsetupjs).
5. Create `frontend/scripts/coverage-summary.cjs` from [Section 3.5](#35-scriptscoverage-summarycjs--custom-coverage-reporter).
6. Add the `test:coverage` script to `package.json` from [Section 3.6](#36-packagejson-script).
7. Update the source path regex in `coverage-summary.cjs` if your source directory is not `src/`.
8. Run: `npm run test:coverage`
9. Verify the custom coverage summary appears after Jest's default table.
