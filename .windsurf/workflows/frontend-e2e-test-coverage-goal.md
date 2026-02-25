---
description: End-to-End (E2E) Testing
auto_execution_mode: 2
---
# E2E Test Coverage Strategy

## Goal

Review E2E coverage and identify all untested user flows. Reach **100% E2E flow coverage** for all main features and integration points, focusing on the **contract between Frontend and Backend** to ensure data integrity across the stack.

## Quality Standards Reference

Before writing any E2E test, you **must consult**:

```
docs/USER_FLOW_MAP.md
docs/TESTING_QUALITY_STANDARDS.md
```

This document defines **all user flows** and the **mandatory quality criteria** for every test. Key sections for E2E:

| When writing... | Consult section... |
|-----------------|-------------------|
| Any E2E test | **E2E-Specific Standards** |
| Locators/selectors | **Selector Hierarchy** (getByRole > getByTestId > locator) |
| Waits/timeouts | **No Hardcoded Timeouts** (condition-based waits) |
| Multi-step flows | **Avoid Excessive Sequential Actions**, **Serial Tests Require Justification** |
| Test data | **No Hardcoded Test Data**, **Data Isolation and Cleanup** |
| Exceptions needed | **Documented Exceptions** (`quality: allow-*`) |

> ⚠️ Every test you write must comply with these standards. Do not invent patterns.

---

## Execution Rules

1. **Start necessary services** before testing:
   ```bash
   # Backend
   source venv/bin/activate && python manage.py runserver
   
   # Frontend
   npm run dev
   ```

2. **Run only modified test files** — never the entire suite:
   ```bash
   # Standard run
   npx playwright test e2e/path/to/spec.spec.ts

   # Reuse already running dev server (faster)
   E2E_REUSE_SERVER=1 npx playwright test e2e/path/to/spec.spec.ts

   # Serial flows (describe.serial) — always use single worker
   npx playwright test e2e/path/to/spec.spec.ts --workers=1
   ```

3. **Maximum per execution:**
   - 20 tests per batch
   - 3 commands per execution cycle

---

## Coverage Prioritization

Use the coverage report as a **triage map**. Prioritize in this order:

| Priority | Criteria | Examples |
|----------|----------|----------|
| 1 | Core user journeys (0% coverage) | Auth (sign-in, sign-up, forgot password, OAuth), Checkout/subscriptions |
| 2 | Critical CRUD flows | Documents (create/edit/send/sign/permissions), Dashboard widgets |
| 3 | Integration points | API contracts, state sync between frontend/backend |
| 4 | Error states | Network failures, validation errors, permission denied |
| 5 | Edge cases | Empty states, pagination limits, concurrent actions |

**Do not** spend time on low-impact flows until critical paths are covered.

---

## Test Implementation Requirements

For each flow you test, cover:

- ✅ **Happy paths** — successful user journey completion
- ✅ **Error states** — API failures, validation errors, network issues
- ✅ **Edge cases** — empty data, boundary conditions, timeouts
- ✅ **Contract validation** — data integrity between frontend and backend

### Test File Naming & Directory Convention

```
e2e/<module>/<action>-<context>.spec.ts

Examples:
  e2e/documents/document-send-email-flow.spec.ts
  e2e/auth/auth-register-branches.spec.ts
  e2e/checkout/subscription-checkout-branches.spec.ts
  e2e/organizations/corporate/organizations-corporate-posts-edit.spec.ts
```

- Place specs under the **module subdirectory** matching the flow's `module` field in `flow-definitions.json`
- Use lowercase kebab-case for all filenames
- Suffix branch/multi-path tests with `-branches`
- Suffix consolidated flow tests with `-flow`

### Per-Test Checklist (from Testing Quality Standards)

```
□ Test name describes ONE specific user flow
□ Test has @flow: <flow-id> tag matching an ID in e2e/flow-definitions.json
□ Selectors use hierarchy: getByRole > getByTestId > locator
□ No .locator('.class') or .locator('#id') without justification
□ No .nth(), .first(), .last() without justification
□ No page.waitForTimeout() — use condition-based waits
□ No hardcoded IDs/emails/codes — use fixtures or generated data
□ Test data has cleanup/reset or runs in isolation
□ Serial tests (describe.serial) have documented justification
□ Assertions verify user-observable outcomes
```

### @flow: Tag Convention

```javascript
// The @flow: tag must appear in the describe or test title
describe('@flow: document-create — Create a new document', () => {
  test('creates a document with valid fields', async ({ page }) => { ... });
  test('shows validation error when title is empty', async ({ page }) => { ... });
});

// For branch specs covering multiple flows
describe('@flow: auth-register-branches — Registration branch scenarios', () => {
  test('@flow: auth-register-basic — registers as basic user', async ({ page }) => { ... });
  test('@flow: auth-register-lawyer — registers as lawyer', async ({ page }) => { ... });
});
```

### Selector Quick Reference

```javascript
// ✅ PREFERRED (in order)
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByTestId('submit-btn').click();

// ❌ AVOID
await page.locator('.btn-primary').click();
await page.locator('#submit-button').click();
await page.locator('div.actions > button').first().click();
```

### Wait Quick Reference

```javascript
// ✅ CORRECT — condition-based waits
await expect(page.locator('[data-testid="success"]')).toBeVisible();
await page.waitForResponse(resp => resp.url().includes('/api/submit'));
await page.waitForURL('**/dashboard');

// ❌ WRONG — hardcoded timeout
await page.waitForTimeout(3000);
```

---

## Workflow

1. **Read the current coverage files:**
   - `e2e/flow-definitions.json` — source of truth for all flow IDs, priorities, modules, and roles
   - `e2e-results/flow-coverage.json` — current coverage status per flow (`missing`, `partial`, `covered`, `failing`)
   - `e2e-results/results.json` — results from the last Playwright run
2. **Identify** untested or partial flows by filtering `flow-coverage.json` on `status: 'missing'` / `status: 'partial'`, ordered by priority
3. **Look up** the target flow in `docs/USER_FLOW_MAP.md` to understand its steps, branching conditions, and role restrictions before writing any code
4. **Consult** `docs/TESTING_QUALITY_STANDARDS.md` → **E2E-Specific Standards**
5. **Implement** tests following the quality criteria and naming conventions
6. **Run** only the new/modified test files
7. **Verify** tests pass and demonstrate contract integrity
8. **Validate quality compliance** after writing tests:
   ```bash
   python scripts/test_quality_gate.py --files e2e/path/to/spec.spec.ts
   ```
9. **Regenerate the coverage report** to confirm the flow is now tracked as covered:
   ```bash
   node frontend/scripts/generate-coverage.js
   ```

---

## Output Format

For each batch of tests, report:

```
### Flow: <user_flow_name>
### File: <test_file_path>

**Scenarios covered:**
- [ ] Happy path: <description>
- [ ] Error state: <description>
- [ ] Edge case: <description>

**Contract validated:**
- Frontend action: <what user does>
- Backend response: <expected API behavior>
- Data integrity: <what was verified>

**Command executed:**
npx playwright test <path> [--headed] [--workers=1]  # --headed for local debug only; --workers=1 for serial flows

**Result:** ✅ Pass / ❌ Fail (reason)
```

---

## Coverage Report

Read coverage files directly — do not paste data manually:

```
e2e/flow-definitions.json          — all defined flows (ID, module, role, priority)
e2e-results/flow-coverage.json     — status per flow: covered | partial | missing | failing
e2e-results/results.json           — results from the last Playwright run
```

To identify flows without coverage, filter `flow-coverage.json` by:
```json
{ "status": "missing" }
{ "status": "partial" }
{ "status": "failing" }
```

To regenerate after writing new tests:
```bash
node frontend/scripts/generate-coverage.js
```