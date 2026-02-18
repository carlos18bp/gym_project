---
description: Frontend & Component Testing
auto_execution_mode: 2
---
# Frontend Unit Test Coverage Strategy

## Goal

Conduct a thorough analysis of frontend coverage reports. Reach **100% coverage** in all files, covering all logical branches and edge cases.

## Quality Standards Reference

Before writing any frontend unit test, you **must consult**:

```
testing-quality-standards.md
```

This document defines the **mandatory quality criteria** for every test. Key sections for Frontend Unit:

| When writing... | Consult section... |
|-----------------|-------------------|
| Any unit test | **Mandatory Rules** (naming, atomicity, assertions) |
| Component tests | **No Implementation Coupling**, **Single Mount Per Test** |
| Selectors | **Stable Selectors in Unit Tests** (data-testid, not CSS classes) |
| Time/random | **Deterministic Tests** (fake timers, Math.random mocks) |
| Mocks | **Mock Configuration Rules**, **Verify Observable Effects** |
| Global state | **Test Isolation** (localStorage, timers, mocks restoration) |
| Exceptions needed | **Documented Exceptions** (`quality: allow-*`) |

> ⚠️ Every test you write must comply with these standards. Do not invent patterns.

---

## Execution Rules

1. **Run only modified test files** — never the entire suite:
   ```bash
   npm test -- path/to/file.spec.ts
   # or
   npx jest --runTestsByPath path/to/file.spec.ts
   ```

2. **Maximum per execution:**
   - 20 tests per batch
   - 3 commands per execution cycle

---

## Coverage Prioritization

Use the coverage report as a **triage map**. Follow this layer priority:

| Priority | Layer | Rationale |
|----------|-------|-----------|
| 1 | **State Management** (Pinia/Vuex/Redux) | Core business logic, highest impact |
| 2 | **Shared Logic** (Composables/Hooks/Utils) | Reused across components, high leverage |
| 3 | **UI Components** (critical first) | User-facing, but prioritize interactive over presentational |

Within each layer, prioritize by:

| Signal | Action |
|--------|--------|
| Lowest % coverage (0% first) | Maximum impact per test |
| Highest "Uncovered Lines" count | Biggest surface area |
| Critical business logic | Revenue/auth/data flows first |

**Do not** polish near-100% files until low-coverage critical files are addressed.

---

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

## Workflow

1. **Review** the coverage report provided below
2. **Identify** lowest-coverage files in priority order (State → Shared → UI)
3. **Consult** `testing-quality-standards.md` → **Frontend-Specific Standards**
4. **Implement** tests following the quality criteria
5. **Run** only the new/modified test files
6. **Verify** tests pass and coverage improves

---

## Output Format

For each batch of tests, report:

```
### Layer: State Management | Shared Logic | UI Component
### File: <source_file_path>
### Test File: <test_file_path>

**Coverage before:** X% statements, Y% branches
**Coverage after:** X% statements, Y% branches

**Tests added:**
- [ ] test_name_1 (happy path)
- [ ] test_name_2 (edge case: empty input)
- [ ] test_name_3 (error: API failure)

**Branches covered:**
- Line XX: if condition (true/false)
- Line YY: ternary (both paths)

**Command executed:**
npm test -- <path>

**Result:** ✅ Pass / ❌ Fail (reason)
```

---

## Coverage Report

<!-- Paste coverage data here -->