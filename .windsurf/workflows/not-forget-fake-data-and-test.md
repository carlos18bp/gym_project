---
auto_execution_mode: 2
description: Checklist for new features, ensures fake data respects business rules and test coverage follows the correct execution order (new tests → regression only).
---
### 1. Fake Data creation / Validation (Backend)

Before creating test data, verify that fake data complies with:

- **Business rules**: Data reflects valid real-world scenarios
- **Model validations**: Constraints, types, ranges, formats
- **Expected exceptions**: Error cases and edge cases
- **Model dependencies**: FK relationships, referential integrity, creation order

> ⚠️ Do not generate random data without context. Each factory/fixture must represent a valid system state.

---

### 2. Test Coverage

#### Create tests for the new functionality:

| Layer    | Test Types
|----------|----------------------------------------
| Backend  | Unit, Integration, Contract, Edge Cases
| Frontend | Unit
| Frontend | E2E (user flows)

## Quality Standards Reference

Before writing any test, you **must consult**:

```
docs/TESTING_QUALITY_STANDARDS.md
```

This document defines the **mandatory quality criteria** for every test. Key sections to review:

| When writing... | Consult section... |
|-----------------|-------------------|
| Any test | **Mandatory Rules** (naming, atomicity, assertions) |
| Tests with time/random | **Deterministic Tests** (freezegun, random.seed) |
| Tests with mocks | **Mock Configuration Rules**, **Verify Observable Effects** |
| Tests with fixtures | **Fixture Best Practices**, **Use Factories for Complex Payloads** |
| Integration tests | **Avoid Over-Mocking in Integration Tests** |

> ⚠️ Every test you write must comply with these standards. Do not invent patterns.

---

## Backend tests

## Test Implementation Requirements

For each file you test, cover:

- ✅ **Happy paths** — normal/expected behavior
- ✅ **Edge cases** — boundary conditions, empty inputs, limits
- ✅ **Error handling** — exceptions, invalid inputs, failure scenarios

### Per-Test Checklist (from Testing Quality Standards)

```
□ Test name describes ONE specific behavior
□ No conditionals or loops in test body
□ Assertions verify observable outcomes (not implementation)
□ Test is deterministic (no datetime.now, random without seed)
□ Test is isolated (no dependency on other tests)
□ Mocks have explicit return_value/side_effect
□ Follows AAA pattern (Arrange/Act/Assert)
```

## Frontend unit tests

## Test Implementation Requirements

For each file you test, cover:

- ✅ **Happy paths** — expected behavior with valid inputs
- ✅ **Edge cases** — empty arrays, null/undefined, boundary values
- ✅ **Error handling** — rejected promises, thrown exceptions, invalid states
- ✅ **All branches** — if/else, ternaries, switch cases, early returns

### Per-Test Checklist (from Testing Quality Standards)

```
□ Test name describes ONE specific behavior
□ No conditionals or loops in test body (use test.each for multiple cases)
□ Assertions verify observable outcomes (rendered UI, emitted events)
□ No access to wrapper.vm.* or internal component state
□ Selectors use data-testid, not CSS classes or IDs
□ One mount/render per test (unless testing re-render behavior)
□ Mocks have explicit return_value/mockResolvedValue
□ jest.useFakeTimers() is restored with jest.useRealTimers()
□ localStorage/sessionStorage cleaned in afterEach
□ Global mocks restored after each test
```

### Selector Quick Reference

```javascript
// ✅ CORRECT — stable selectors
wrapper.find('[data-testid="submit-btn"]').trigger('click');
wrapper.findComponent(SubmitButton).trigger('click');
wrapper.find('button[type="submit"]').trigger('click');

// ❌ WRONG — fragile selectors
wrapper.find('.btn-primary').trigger('click');
wrapper.find('#submit-button').trigger('click');
wrapper.find('div.form-actions > button').trigger('click');
```

### Component Testing Quick Reference

```javascript
// ✅ CORRECT — test observable behavior
it('displays error message when validation fails', async () => {
  const wrapper = mount(LoginForm);
  
  await wrapper.find('[data-testid="submit-btn"]').trigger('click');
  
  expect(wrapper.find('[data-testid="error-message"]').text()).toBe('Email is required');
});

// ❌ WRONG — testing implementation details
it('sets hasError to true', () => {
  const wrapper = mount(LoginForm);
  wrapper.vm.validate();
  expect(wrapper.vm.hasError).toBe(true);  // Internal state!
});
```

### Mock Quick Reference

```javascript
// ✅ CORRECT — explicit mock configuration
const mockFetch = jest.spyOn(api, 'fetchUser').mockResolvedValue({ id: 1, name: 'Test' });

// After test
expect(mockFetch).toHaveBeenCalledWith(1);
expect(wrapper.find('[data-testid="user-name"]').text()).toBe('Test'); // Observable!

mockFetch.mockRestore();

// ❌ WRONG — silent mock, no observable verification
jest.spyOn(api, 'fetchUser').mockResolvedValue({});
// ... no assertion on what changed in UI
```

### Determinism Quick Reference

```javascript
// ✅ CORRECT — controlled time
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-15T10:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ✅ CORRECT — controlled random
const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);
// ... test
mockRandom.mockRestore();
```

---

## Fronend e2e (user flows) tests

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

### 3. Update docs/USER_FLOW_MAP.md if new user flows are created.

#### Execution order:

1. **First**: Run only the new tests → Must pass ✅
2. **Then**: Run only regression tests
3. **Never**: Run the full test suite for backend or frontend

# Frontend e2e test - Maximum per execution:
  - 20 tests per batch
  - 3 commands per execution cycle

# Backend - activate virtual environment (REQUIRED)
source venv/bin/activate
