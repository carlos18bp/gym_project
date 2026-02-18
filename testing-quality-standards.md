# Testing Quality Standards

## Overview

This document defines test quality standards to ensure maintainable, reliable, and meaningful test suites across the project. Following these standards helps prevent flaky tests, reduces maintenance burden, and ensures tests serve as living documentation of system behavior.

---

## Scope

This document applies to:

| Test Type | Location | Runner |
|-----------|----------|--------|
| Backend unit/integration | `backend/core_app/tests/**` | pytest |
| Frontend unit/component | `frontend/test/**` | Jest |
| Frontend E2E flows | `frontend/e2e/**` | Playwright |

> **Note:** These standards focus on test quality and maintainability only. They do not change production business logic.

---

## Mandatory Rules (Pass/Fail)

### 1. Single-Purpose Test Names

Each test must express **one specific behavior**. The name should answer: "What behavior is being verified?"

```python
# ✅ CORRECT - Single, clear behavior
def test_create_order_returns_201_with_valid_payload():
    ...

def test_create_order_fails_with_empty_cart():
    ...

# ❌ WRONG - Multiple behaviors, vague purpose
def test_order_creation_batch_coverage():
    ...

def test_order_api_deep_validation():
    ...
```

```javascript
// ✅ CORRECT
it('displays error message when login fails with invalid credentials', ...)

// ❌ WRONG
it('login flow batch tests', ...)
it('covers authentication edge cases', ...)
```

---

### 2. Forbidden Naming Tokens

The following tokens are **prohibited** in test identifiers:

| Token | Reason |
|-------|--------|
| `batch` | Implies multiple unrelated behaviors |
| `cov` / `coverage` | Tests should verify behavior, not chase metrics |
| `deep` | Vague; doesn't describe specific behavior |
| `all` | Suggests unfocused scope |
| `misc` / `various` | Indicates poor test organization |

**Applies to:**
- Python test class names (`class Test*`)
- Python test function names (`def test_*`)
- JavaScript/TypeScript `describe`, `it`, `test` titles
- Test file names

---

### 3. Correct Location by Domain

Tests must be organized by domain/layer, not by coverage goals.

**Backend Structure:**

```
backend/core_app/tests/
├── models/           # Model unit tests (validation, properties, methods)
│   ├── test_user.py
│   ├── test_product.py
│   └── test_order.py
├── serializers/      # Serializer unit tests (validation, transformation)
│   ├── test_user_serializers.py
│   └── test_product_serializers.py
├── views/            # API endpoint tests (integration-light)
│   ├── test_auth_views.py
│   └── test_product_views.py
├── services/         # Business logic service tests
│   └── test_email_service.py
├── utils/            # Utility function tests
│   └── test_helpers.py
└── tasks/            # Background task tests (Celery, jobs)
    └── test_notification_tasks.py
```

**Frontend Structure:**

```
frontend/
├── test/                    # Unit/component tests (Jest)
│   ├── stores/              # Pinia store tests
│   ├── components/          # Vue component tests
│   ├── composables/         # Composable/hook tests
│   ├── router/              # Router guard tests
│   └── shared/              # Shared test utilities
└── e2e/                     # E2E flows (Playwright)
    ├── auth/                # Authentication flows
    ├── products/            # Product management flows
    └── helpers/             # E2E utilities and mocks
```

---

### 4. No Duplicate Test Names

Duplicate test names cause confusion and may hide failures.

**Rules:**
- No duplicate `test_*` functions at module level
- No duplicate `test_*` methods within the same test class
- No duplicate `it()`/`test()` titles within the same `describe()` block

```python
# ❌ WRONG - Duplicate names
class TestUserModel:
    def test_validation(self):  # First occurrence
        ...
    
    def test_validation(self):  # DUPLICATE - will override!
        ...

# ✅ CORRECT - Specific, unique names
class TestUserModel:
    def test_validation_fails_with_invalid_email_format(self):
        ...
    
    def test_validation_fails_with_empty_password(self):
        ...
```

---

### 5. Behavior-First Assertions

Tests must assert **observable outcomes**, not implementation details.

**Assert these (observable):**
- HTTP status codes and response payloads
- Database state changes (records created, updated, deleted)
- Rendered UI elements and their content
- Emitted events and their payloads
- Side effects (emails sent, files created, cache updated)

**Avoid these (implementation details):**
- Internal method call counts (unless testing boundaries)
- Private variable values
- Specific SQL queries generated
- Internal state that users/consumers cannot observe

```python
# ✅ CORRECT - Asserts observable behavior
def test_create_user_stores_hashed_password(api_client):
    response = api_client.post('/api/users/', {'email': 'a@b.com', 'password': 'secret'})
    
    assert response.status_code == 201
    user = User.objects.get(email='a@b.com')
    assert user.check_password('secret')  # Observable: password works
    assert user.password != 'secret'       # Observable: not stored plain

# ❌ WRONG - Asserts implementation details
def test_create_user_calls_hasher(api_client, mocker):
    mock_hasher = mocker.patch('django.contrib.auth.hashers.make_password')
    api_client.post('/api/users/', {'email': 'a@b.com', 'password': 'secret'})
    mock_hasher.assert_called_once()  # Implementation detail
```

---

## Recommended Practices

### AAA Pattern (Arrange/Act/Assert)

Structure every test with clear sections:

```python
def test_apply_discount_reduces_order_total():
    # Arrange - Set up test data and preconditions
    order = Order.objects.create(subtotal=Decimal('100.00'))
    discount = Discount.objects.create(code='SAVE20', percent=20)
    
    # Act - Execute the behavior under test
    order.apply_discount(discount)
    
    # Assert - Verify the expected outcome
    assert order.total == Decimal('80.00')
    assert order.applied_discount == discount
```

---

### Fixture Best Practices

**Keep fixtures explicit and minimal:**

```python
# ✅ CORRECT - Explicit, minimal fixture
@pytest.fixture
def active_product():
    return Product.objects.create(
        name_en='Test Product',
        name_es='Producto de Prueba',
        price=Decimal('29.99'),
        stock=10,
        is_active=True
    )

# ❌ WRONG - Implicit, bloated fixture
@pytest.fixture
def product():
    # Creates 50 related objects, external API calls, etc.
    return create_full_product_ecosystem()
```

**Use factories for complex objects:**

```python
# With factory_boy or manual factories
@pytest.fixture
def order_factory():
    def _create_order(user=None, status='pending', items_count=1):
        user = user or User.objects.create(email=f'{uuid4()}@test.com')
        order = Order.objects.create(user=user, status=status)
        for i in range(items_count):
            OrderItem.objects.create(order=order, quantity=1, price=Decimal('10.00'))
        return order
    return _create_order
```

---

### Mocking Guidelines

**Mock only at external boundaries:**

| Mock This | Don't Mock This |
|-----------|-----------------|
| External HTTP APIs | Internal service classes |
| Email/SMS providers | Database queries |
| Payment gateways | Model methods |
| File storage (S3, etc.) | Serializers |
| CAPTCHA validation | Business logic |
| System clock (for time-sensitive tests) | Internal helpers |

```python
# ✅ CORRECT - Mock external boundary
@pytest.fixture
def mock_payment_gateway(mocker):
    return mocker.patch(
        'core_app.services.payment_service.stripe.Charge.create',
        return_value={'id': 'ch_test123', 'status': 'succeeded'}
    )

# ❌ WRONG - Mock internal implementation
@pytest.fixture
def mock_order_service(mocker):
    return mocker.patch.object(OrderService, 'calculate_total')  # Internal logic
```

---

### Deterministic Tests

Tests must produce the same result every time, regardless of:
- Execution order
- System time
- Random values
- External state

**Rules:**

```python
# ❌ WRONG - Non-deterministic
def test_order_created_today():
    order = Order.objects.create()
    assert order.created_at.date() == date.today()  # Fails at midnight!

# ✅ CORRECT - Freeze time
from freezegun import freeze_time

@freeze_time('2026-01-15 10:00:00')
def test_order_created_at_specific_time():
    order = Order.objects.create()
    assert order.created_at == datetime(2026, 1, 15, 10, 0, 0)
```

```python
# ❌ WRONG - Arbitrary sleep
def test_async_task_completes():
    trigger_async_task()
    time.sleep(5)  # Flaky! May not be enough, wastes time
    assert Task.objects.get().status == 'completed'

# ✅ CORRECT - Explicit wait or sync execution
def test_async_task_completes(celery_eager):
    trigger_async_task()  # Runs synchronously in test
    assert Task.objects.get().status == 'completed'
```

---

### Test Isolation

Each test must be independent and leave no side effects:

```python
# ✅ CORRECT - Uses transactions (pytest-django default)
@pytest.mark.django_db
def test_create_user():
    User.objects.create(email='test@example.com')
    assert User.objects.count() == 1
    # Database rolls back after test

# ❌ WRONG - Depends on previous test state
def test_user_count_after_creation():
    # Assumes test_create_user ran first - FRAGILE!
    assert User.objects.count() == 1
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **God Test** | Tests 10+ behaviors in one function | Split into focused tests |
| **Mystery Guest** | Uses fixtures/data without explanation | Use explicit inline setup |
| **Eager Mocking** | Mocks internal classes/methods | Mock only boundaries |
| **Test Interdependence** | Tests depend on execution order | Ensure full isolation |
| **Magic Numbers** | Uses unexplained values | Use named constants or comments |
| **Copy-Paste Tests** | Duplicated test code | Extract to fixtures/helpers |
| **Commented Tests** | Disabled tests left in codebase | Delete or fix immediately |
| **Assertion-Free Tests** | No assertions (false passing) | Always assert outcomes |

---

## Naming Conventions Summary

### Python (pytest)

```python
# File names
test_<domain>.py                    # e.g., test_user.py, test_auth_views.py

# Class names (optional, for grouping)
class Test<Entity><Aspect>:         # e.g., TestUserValidation, TestOrderCreation

# Function names
def test_<action>_<outcome>_<condition>():
    # Examples:
    # test_create_order_returns_201_with_valid_data
    # test_login_fails_with_invalid_password
    # test_product_price_includes_tax_when_region_is_eu
```

### JavaScript (Jest/Playwright)

```javascript
// describe blocks - noun phrase (what)
describe('ProductStore', () => {
  describe('fetchProducts', () => {
    
    // it/test blocks - verb phrase (behavior)
    it('returns empty array when no products exist', ...);
    it('sets isLoading to true while fetching', ...);
    it('handles API errors gracefully', ...);
  });
});
```

---

## Quality Gate

### Automated Validation

Run before commit and in CI:

```bash
python3 scripts/test_quality_gate.py \
  --repo-root . \
  --report-path test-results/test-quality-audit-report.json
```

### Integration Points

| Integration | File | Purpose |
|-------------|------|---------|
| Pre-commit hook | `.pre-commit-config.yaml` | Local validation before commit |
| CI workflow | `.github/workflows/test-quality-gate.yml` | PR validation |

### Modular Architecture

The quality gate is implemented as a modular Python package:

```
scripts/
├── test_quality_gate.py          # Main orchestrator
└── quality/
    ├── __init__.py               # Package exports
    ├── base.py                   # Shared types (Severity, Issue, Config)
    ├── patterns.py               # Compiled regex patterns
    ├── backend_analyzer.py       # Python/pytest analyzer (AST-based)
    ├── js_ast_bridge.py          # Bridge to Node.js Babel parser
    ├── frontend_unit_analyzer.py # Jest/Vue Test Utils analyzer
    └── frontend_e2e_analyzer.py  # Playwright E2E analyzer

frontend/scripts/
└── ast-parser.cjs                # Babel AST parser for JavaScript
```

### Gate Checks

#### Backend (Python/pytest)

| Check | Severity | Description |
|-------|----------|-------------|
| Empty test | ERROR | Test with no body (pass, ...) |
| No assertions | ERROR | Test without assert/assertEqual |
| Useless assertion | WARNING | `assert True`, `self.assertTrue(True)` |
| Vague assertion | WARNING | `assert obj` without specific check |
| Forbidden token | ERROR | `batch`, `coverage`, `cov`, `deep` in name |
| Duplicate name | ERROR | Same test name in effective scope |
| Poor naming | WARNING | Generic names like `test_1`, `test_it` |
| Test too long | INFO | >50 lines (consider splitting) |
| Test too short | INFO | <3 lines (may be trivial) |
| Too many assertions | WARNING | >7 assertions (test does too much) |
| Sleep call | WARNING | `time.sleep()` indicates flaky test |
| Print statement | INFO | Forgotten debugging |
| Silent exception | WARNING | `try/except: pass` hides failures |
| Excessive mocking | WARNING | >5 patches (over-mocking) |
| Unverified mock | WARNING | Mock without `assert_called*` |
| Missing docstring | INFO | Complex test without documentation |
| Misplaced file | WARNING | Test file in wrong domain folder |

#### Frontend Unit (Jest)

| Check | Severity | Description |
|-------|----------|-------------|
| Empty test | ERROR | Test with no statements |
| No assertions | ERROR | Test without `expect()` |
| Useless assertion | WARNING | `expect(true).toBe(true)` |
| Forbidden token | ERROR | Banned tokens in title |
| Duplicate name | ERROR | Same test title in describe block |
| Poor naming | WARNING | Generic titles like "it works" |
| Console.log | WARNING | Forgotten debug statements |
| Too many assertions | WARNING | >7 expect() calls |
| Test too long | INFO | >50 lines |

#### Frontend E2E (Playwright)

| Check | Severity | Description |
|-------|----------|-------------|
| Empty test | ERROR | Test with no actions |
| No assertions | WARNING | May rely on implicit assertions |
| Hardcoded timeout | ERROR | `waitForTimeout(>500ms)` - flaky |
| Fragile selector | INFO | Class/index-based vs getByRole |
| Forbidden token | ERROR | Banned tokens in title |
| Duplicate name | ERROR | Same test title |
| Console.log | INFO | Less critical in E2E |

### CLI Usage

```bash
# Analyze all suites
python scripts/test_quality_gate.py --repo-root .

# Analyze specific suite
python scripts/test_quality_gate.py --suite backend
python scripts/test_quality_gate.py --suite frontend-unit
python scripts/test_quality_gate.py --suite frontend-e2e

# Verbose output with all issues
python scripts/test_quality_gate.py --verbose --show-all

# Strict mode (fail on warnings)
python scripts/test_quality_gate.py --strict

# JSON output only
python scripts/test_quality_gate.py --json-only
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All validations passed |
| 1 | Errors found (or warnings in strict mode) |
| 2 | Configuration or runtime error |

---

## Coverage Guidelines

While this document focuses on quality over quantity, reasonable coverage targets help identify gaps:

| Layer | Minimum Coverage | Notes |
|-------|------------------|-------|
| Models | 80% | Focus on validation, properties, methods |
| Serializers | 80% | Focus on validation, transformation |
| Views/API | 70% | Happy path + main error cases |
| Services | 85% | Business logic is critical |
| Utils | 90% | Pure functions should be fully tested |
| Frontend Stores | 75% | Actions and getters |
| Frontend Components | 60% | User interactions, conditional rendering |
| E2E | Critical paths | Login, checkout, main workflows |

> **Remember:** Coverage measures lines executed, not behavior verified. A test with no assertions gives coverage but no value.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEST QUALITY CHECKLIST                       │
├─────────────────────────────────────────────────────────────────┤
│  □ Test name describes ONE specific behavior                    │
│  □ No forbidden tokens (batch, cov, deep, misc, all)           │
│  □ Test is in correct domain folder                            │
│  □ No duplicate test names in scope                            │
│  □ Assertions verify observable outcomes                        │
│  □ Follows AAA pattern (Arrange/Act/Assert)                    │
│  □ Fixtures are explicit and minimal                           │
│  □ Only external boundaries are mocked                         │
│  □ Test is deterministic (no sleep, no time.now())            │
│  □ Test is isolated (no dependency on other tests)             │
└─────────────────────────────────────────────────────────────────┘
```

---

> **This document should be reviewed quarterly and updated when new patterns emerge or tooling changes.**