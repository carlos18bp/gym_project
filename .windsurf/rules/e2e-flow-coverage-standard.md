---
trigger: model_decision
description: E2E flow coverage reporter for Playwright. Use when creating/modifying E2E tests, tagging flows, updating flow-definitions.json, or analyzing flow coverage reports.
---

# E2E Flow Coverage Report Standard

Full reference: `docs/E2E_FLOW_COVERAGE_REPORT_STANDARD.md`

## Core Concept

The Flow Coverage Report measures E2E test coverage at the **user-flow level**, not code-line level. Every defined flow is tracked as: `covered`, `partial`, `failing`, or `missing`.

## Key Files

```
frontend/e2e/flow-definitions.json           # Source of truth: all user flows
frontend/e2e/reporters/flow-coverage-reporter.mjs  # Custom Playwright reporter
e2e-results/flow-coverage.json               # JSON artifact (auto-generated)
```

## flow-definitions.json Schema

```json
{
  "version": "1.0.0",
  "lastUpdated": "YYYY-MM-DD",
  "flows": {
    "<flow-id>": {
      "name": "Human-readable name",
      "module": "auth|documents|subscriptions|...",
      "roles": ["shared"] or ["lawyer", "client"],
      "priority": "P1|P2|P3|P4",
      "description": "What the flow does",
      "expectedSpecs": 1,
      "knownGaps": ["optional — documented limitations"]
    }
  }
}
```

**Flow ID naming**: kebab-case, prefixed with module: `auth-login-email`, `docs-create-template`.

## Tagging Tests

Every E2E test MUST have `@flow:<flow-id>` tag(s):

```javascript
test('user signs in with email', {
  tag: ['@flow:auth-login-email'],
}, async ({ page }) => { /* ... */ });
```

- Tag value must match a key in `flow-definitions.json`
- A test can have multiple `@flow:` tags
- Untagged tests appear in "Tests Without Flow Tag" section — aim for zero

## Status State Machine

Evaluated in order after all tests complete:

| Status | Condition |
|--------|-----------|
| `missing` | No tests exist (`tests.total === 0`) |
| `failing` | Any test failed or timed out (`tests.failed > 0`) |
| `covered` | All passed, none skipped |
| `partial` | Some passed but some skipped |

- `timedOut` counts as `failed`
- `failing` takes priority over `partial`

## Report Sections

| Section | When Shown |
|---------|-----------|
| Summary (totals + percentages) | Always |
| Missing Flows by Priority (P1→P3, excludes P4) | When any flow is `missing` |
| Failing Flows | When any flow is `failing` |
| Partial Coverage (with knownGaps) | When any flow is `partial` |
| Coverage by Module (progress bars) | Always |
| Tests Without Flow Tag | When any test lacks `@flow:` tag |

## Maintenance Rules

### Adding a new flow
1. Add entry to `flow-definitions.json` with all required fields
2. Bump `version`, update `lastUpdated`
3. Create/update spec files with `@flow:<new-flow-id>` tag
4. Register in `docs/USER_FLOW_MAP.md`

### Removing a flow
1. Delete from `flow-definitions.json`
2. Remove `@flow:<id>` tags from all spec files
3. Run suite — verify no tests became unmapped

### Renaming a flow ID
Must be atomic: update `flow-definitions.json` key AND all `@flow:` tags simultaneously. Mismatch = old ID shows as `missing`, new ID auto-detected under `unknown` module.

### Sync signals

| Signal | Action |
|--------|--------|
| "Missing Flows" section appears | Write tests or remove obsolete definition |
| "Tests Without Flow Tag" appears | Add `@flow:` tags to listed tests |
| Flow under module `unknown` | Tag references undefined ID — add definition |

## What is NOT a User Flow

| Concern | Why Not | Correct Approach |
|---------|---------|-----------------|
| Responsive layout | Design property, no user action | Playwright multi-project viewports |
| Performance (LCP) | Non-functional metric | Lighthouse CI |
| Accessibility | Cross-cutting compliance | axe-core integration |

**Exception**: If a viewport triggers different behavior (e.g., mobile hamburger menu), that IS a flow.

## JSON Output: `e2e-results/flow-coverage.json`

Auto-generated after every run. Contains `summary`, per-flow `status`/`tests`/`specs`, and `unmappedTests`. Add `e2e-results/` to `.gitignore`.

## Regenerate Coverage

```bash
npx playwright test                           # runs tests + generates report
node frontend/scripts/generate-coverage.js    # regenerates coverage from results
```
