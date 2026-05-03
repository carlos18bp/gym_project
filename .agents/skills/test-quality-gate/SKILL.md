---
name: test-quality-gate
description: "Improve Azurita's test-quality gate by fixing the highest-value issues first with targeted test runs only."
---

# Test Quality Gate Workflow

## Rules
- Never run the full test suite.
- Read `docs/TESTING_QUALITY_STANDARDS.md` before refactoring tests.
- Prefer fixing representative fragile patterns that unlock multiple future files.
- Avoid production code changes unless test determinism genuinely requires them.

## Priorities
1. Gate-breaking errors
2. Determinism issues
3. Fragile E2E locators on core flows
4. High-value unit or integration tests
5. Warnings and style issues

## Validation Commands
- Backend: `source .venv/bin/activate && cd backend && pytest path/to/test_file.py -v`
- Frontend unit: `npm --prefix frontend test -- path/to/file.spec.js`
- Frontend E2E: `npm --prefix frontend run e2e -- path/to/spec.js`
- Gate script: `python3 scripts/test_quality_gate.py --repo-root . --report-path test-results/test-quality-report.json --frontend-unit-dir test --verbose`

## Output Contract
Provide:
- issue grouping by severity or pattern
- the first recommended phase of work
- exact targeted commands for the files you changed
