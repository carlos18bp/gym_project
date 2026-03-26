---
name: frontend-e2e-test-coverage
description: "E2E test coverage strategy — analyze Playwright flow coverage and implement tests for untested user flows, focusing on the contract between frontend and backend."
---

# E2E Test Coverage Strategy

## Goal

Review E2E coverage and identify all untested user flows. Reach **100% flow coverage** focusing on the **contract between Frontend and Backend**.

## Core Principle: Real User Interactions

Every test must exercise the full UI flow — from the user's perspective — without shortcuts.

| Real user interaction | NOT a real user interaction |
|----------------------|---------------------------|
| Clicking buttons, links, menus | Calling backend API directly |
| Filling and submitting forms | Setting store values programmatically |
| Navigating between pages via UI | Using `page.goto()` to skip steps |
| Uploading files through inputs | Injecting data into DB directly |

## Quality Standards Reference

Before writing any E2E test, consult:
- `docs/USER_FLOW_MAP.md`
- `docs/TESTING_QUALITY_STANDARDS.md`

## Execution Rules

1. **Run only modified test files**: `npx playwright test e2e/path/to/spec.spec.ts`
2. Use `E2E_REUSE_SERVER=1` when dev server is running
3. **Maximum per execution**: 20 tests per batch, 3 commands per cycle

## Coverage Prioritization

| Priority | Criteria |
|----------|----------|
| 1 | Core user journeys (auth, checkout) |
| 2 | Critical CRUD flows (documents, dashboard) |
| 3 | Integration points (API contracts) |
| 4 | Error states |
| 5 | Edge cases |

## Per-Test Checklist

- Test has `@flow:<flow-id>` tag matching `flow-definitions.json`
- Selectors: `getByRole` > `getByTestId` > `locator`
- No `page.waitForTimeout()` — use condition-based waits
- No hardcoded test data — use fixtures
- Assertions verify user-observable outcomes
- Test simulates real user interaction through UI

## Workflow

1. Read `e2e/flow-definitions.json` and `e2e-results/flow-coverage.json`
2. Identify untested/partial flows by priority
3. Look up target flow in `docs/USER_FLOW_MAP.md`
4. Consult quality standards
5. Implement tests
6. Run only new/modified tests
7. Validate quality: `python scripts/test_quality_gate.py --files e2e/path/to/spec.spec.ts`
8. Regenerate coverage: `node frontend/scripts/generate-coverage.js`
