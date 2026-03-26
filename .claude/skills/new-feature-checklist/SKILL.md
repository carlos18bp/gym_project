---
name: new-feature-checklist
description: "Checklist for new features — ensures fake data creation follows business rules and test coverage is complete across backend, frontend unit, and E2E layers."
---

# New Feature Checklist

## 1. Fake Data Creation / Validation (Backend)

Before creating test data, verify that fake data complies with:
- **Business rules**: Data reflects valid real-world scenarios
- **Model validations**: Constraints, types, ranges, formats
- **Expected exceptions**: Error cases and edge cases
- **Model dependencies**: FK relationships, referential integrity, creation order

> Do not generate random data without context. Each factory/fixture must represent a valid system state.

## 2. Test Coverage

### Create tests for the new functionality:

| Layer | Test Types |
|-------|-----------|
| Backend | Unit, Integration, Contract, Edge Cases |
| Frontend | Unit |
| Frontend | E2E (user flows) |

### Quality Standards Reference

Before writing any test, consult: `docs/TESTING_QUALITY_STANDARDS.md`

### Backend Tests
Cover: happy paths, edge cases, error handling.
Per-test: ONE behavior, no conditionals, observable assertions, deterministic, isolated, AAA pattern.

### Frontend Unit Tests
Cover: happy paths, edge cases, error handling, all branches.
Per-test: ONE behavior, no `wrapper.vm.*`, stable selectors, one mount, timers restored.

### Frontend E2E Tests
Cover: happy paths, error states, edge cases, contract validation.
Per-test: `@flow:` tag, role-based selectors, no `waitForTimeout()`, real user interactions only.

## 3. Update User Flow Map

Update `docs/USER_FLOW_MAP.md` if new user flows are created.

## Execution Order

1. **First**: Run only the new tests → Must pass
2. **Then**: Run only regression tests
3. **Never**: Run the full test suite

### Limits
- Frontend E2E: max 20 tests per batch, 3 commands per cycle
- Backend: activate venv first (`source venv/bin/activate`)
