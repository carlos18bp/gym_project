---
auto_execution_mode: 2
description: Checklist for new features, ensures fake data respects business rules and test coverage follows the correct execution order (new tests → regression only).
---
### 1. Fake Data Validation (Backend)

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
|----------|-----------------------------------------
| Backend  | Unit, Integration, Contract, Edge Cases
| Frontend | Unit
| Frontend | E2E (flows)

#### Execution order:

1. **First**: Run only the new tests → Must pass ✅
2. **Then**: Run only regression tests
3. **Never**: Run the full test suite for backend or frontend

# Backend - activate virtual environment (REQUIRED)
source venv/bin/activate