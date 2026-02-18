---
description: End-to-End (E2E) Testing
auto_execution_mode: 2
---
# E2E Test Coverage Strategy

## Goal

Review E2E coverage and identify all untested user flows. Reach **100% E2E coverage** for all main features and integration points, focusing on the **contract between Frontend and Backend** to ensure data integrity across the stack.

## Quality Standards Reference

Before writing any E2E test, you **must consult**:

```
testing-quality-standards.md
```

This document defines the **mandatory quality criteria** for every test. Key sections for E2E:

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
   npx playwright test path/to/spec.spec.ts
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

### Per-Test Checklist (from Testing Quality Standards)

```
□ Test name describes ONE specific user flow
□ Selectors use hierarchy: getByRole > getByTestId > locator
□ No .locator('.class') or .locator('#id') without justification
□ No .nth(), .first(), .last() without justification
□ No page.waitForTimeout() — use condition-based waits
□ No hardcoded IDs/emails/codes — use fixtures or generated data
□ Test data has cleanup/reset or runs in isolation
□ Serial tests (describe.serial) have documented justification
□ Assertions verify user-observable outcomes
```

### Selector Quick Reference

```javascript
// ✅ PREFERRED (in order)
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByTestId('submit-btn').click();
await page.locator('[data-testid="submit-btn"]').click();

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

1. **Review** the coverage report provided below
2. **Identify** untested critical user flows
3. **Consult** `testing-quality-standards.md` → **E2E-Specific Standards**
4. **Implement** tests following the quality criteria
5. **Run** only the new/modified test files
6. **Verify** tests pass and demonstrate contract integrity

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
npx playwright test <path> --headed

**Result:** ✅ Pass / ❌ Fail (reason)
```

---

## Coverage Report

<!-- Paste coverage data or list of untested flows here -->