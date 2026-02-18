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

### 2. No Conjunctions in Test Names

Test names containing **conjunctions** (`and`, `y`, `&`) are a signal that the test verifies multiple behaviors and should be split.

```python
# ❌ WRONG - Conjunction suggests multiple behaviors
def test_create_user_and_send_welcome_email():
    ...

def test_login_fails_and_shows_error_and_locks_account():
    ...

# ✅ CORRECT - Split into focused tests
def test_create_user_returns_201():
    ...

def test_create_user_triggers_welcome_email():
    ...

def test_login_fails_with_invalid_password():
    ...

def test_login_locks_account_after_three_failures():
    ...
```

> **Note:** In E2E tests, this rule is more lenient since flows are naturally more verbose. Treat as informational signal.

---

### 3. Forbidden Naming Tokens

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

### 4. Correct Location by Domain

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

### 5. No Duplicate Test Names

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

### 6. Behavior-First Assertions

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

### 7. No Conditionals or Loops in Test Body

The body of a test **must not contain conditional logic** (`if/elif/else`) or **loops for iterating inputs** (`for/while`). These are signals that the test is doing too much or should use parameterization.

```python
# ❌ WRONG - Conditional logic in test
def test_discount_calculation():
    order = create_order(100)
    if order.total > 50:
        order.apply_discount('SAVE10')
    assert order.total == 90

# ❌ WRONG - Loop iterating over inputs
def test_validation_rejects_invalid_emails():
    invalid_emails = ['bad', 'no@', '@domain.com', 'spaces here@x.com']
    for email in invalid_emails:
        with pytest.raises(ValidationError):
            User.objects.create(email=email)

# ✅ CORRECT - Use parameterization
@pytest.mark.parametrize('invalid_email', [
    'bad',
    'no@',
    '@domain.com',
    'spaces here@x.com',
])
def test_validation_rejects_invalid_email(invalid_email):
    with pytest.raises(ValidationError):
        User.objects.create(email=invalid_email)
```

```javascript
// ❌ WRONG - Loop in test
it('validates all required fields', () => {
  const fields = ['name', 'email', 'password'];
  for (const field of fields) {
    expect(wrapper.find(`[data-testid="${field}-error"]`).exists()).toBe(true);
  }
});

// ✅ CORRECT - Parameterization with test.each
it.each(['name', 'email', 'password'])('shows error for missing %s field', (field) => {
  expect(wrapper.find(`[data-testid="${field}-error"]`).exists()).toBe(true);
});
```

**Exception:** Loops that verify items in a **collection result** (not inputs) are acceptable with lower severity:

```python
# ✅ ACCEPTABLE - Verifying collection result
def test_bulk_create_returns_all_items():
    items = service.bulk_create(['a', 'b', 'c'])
    assert len(items) == 3
    for item in items:
        assert item.status == 'created'  # Verifying result, not iterating inputs
```

---

### 8. No Assertions Inside Loops

Assertions inside loops often indicate a test verifying multiple behaviors or missing parameterization.

```python
# ❌ WRONG - Assert inside loop (unclear which iteration fails)
def test_all_products_have_valid_price():
    products = Product.objects.all()
    for product in products:
        assert product.price > 0

# ✅ CORRECT - Use parameterization or aggregate assertion
@pytest.mark.parametrize('product_id', [1, 2, 3])
def test_product_has_valid_price(product_id):
    product = Product.objects.get(id=product_id)
    assert product.price > 0

# ✅ ALSO CORRECT - Aggregate with clear message
def test_all_products_have_valid_price():
    products = Product.objects.all()
    invalid = [p.id for p in products if p.price <= 0]
    assert not invalid, f"Products with invalid price: {invalid}"
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

### Use Factories for Complex Payloads

When test data requires many fields, **use factories or builders** instead of inline dictionaries. This improves readability and maintainability.

```python
# ❌ WRONG - Large inline payload (hard to read, duplicated across tests)
def test_create_order():
    response = api_client.post('/api/orders/', {
        'user_id': 1,
        'shipping_address': '123 Main St',
        'shipping_city': 'New York',
        'shipping_state': 'NY',
        'shipping_zip': '10001',
        'shipping_country': 'US',
        'billing_address': '123 Main St',
        'billing_city': 'New York',
        'billing_state': 'NY',
        'billing_zip': '10001',
        'billing_country': 'US',
        'items': [{'product_id': 1, 'quantity': 2, 'price': '29.99'}],
        'payment_method': 'card',
        'card_last_four': '4242',
    })
    assert response.status_code == 201

# ✅ CORRECT - Use factory
def test_create_order(order_payload_factory):
    payload = order_payload_factory(items_count=1)
    response = api_client.post('/api/orders/', payload)
    assert response.status_code == 201
```

Consider using `factory_boy` for models or custom builders for API payloads.

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

### Mock Configuration Rules

Mocks must be **explicitly configured** with expected behavior. "Silent mocks" that return `MagicMock` without configuration are a code smell.

```python
# ❌ WRONG - Silent mock (no return_value, no side_effect)
@patch('myapp.services.email_service.send_email')
def test_registration_sends_email(mock_send):
    register_user('test@example.com')
    mock_send.assert_called_once()  # What did send_email return? Unknown!

# ✅ CORRECT - Explicit mock configuration
@patch('myapp.services.email_service.send_email')
def test_registration_sends_email(mock_send):
    mock_send.return_value = {'status': 'sent', 'message_id': 'abc123'}
    
    result = register_user('test@example.com')
    
    mock_send.assert_called_once_with(
        to='test@example.com',
        template='welcome'
    )
    assert result.email_sent is True  # Observable effect!
```

---

### Verify Observable Effects, Not Just Calls

When using `assert_called*`, **also verify an observable effect** of the mocked behavior. The exception is when the test contract IS the call itself (event emission, email sending).

```python
# ❌ WRONG - Only verifies call, no observable effect
@patch('myapp.tasks.send_notification')
def test_order_triggers_notification(mock_notify):
    create_order(user_id=1)
    mock_notify.assert_called_once()  # So what? What changed?

# ✅ CORRECT - Verifies call AND observable effect
@patch('myapp.tasks.send_notification')
def test_order_triggers_notification(mock_notify):
    mock_notify.return_value = True
    
    order = create_order(user_id=1)
    
    mock_notify.assert_called_once_with(user_id=1, order_id=order.id)
    assert order.notification_sent is True  # Observable state change

# ✅ ALSO CORRECT - When the call IS the contract (contract test)
# quality: allow-call-contract (testing event emission contract)
@patch('myapp.events.publish')
def test_order_publishes_created_event(mock_publish):
    order = create_order(user_id=1)
    
    mock_publish.assert_called_once_with(
        'order.created',
        {'order_id': order.id, 'user_id': 1}
    )
```

---

### Avoid Over-Mocking in Integration Tests

Integration tests should test **real integrations**. If you're mocking most dependencies, reconsider whether it should be a unit test.

```python
# ❌ WRONG - Integration test that mocks everything
@pytest.mark.integration
@patch('myapp.services.inventory.check_stock')
@patch('myapp.services.pricing.calculate_total')
@patch('myapp.services.shipping.get_rates')
@patch('myapp.services.payment.charge')
@patch('myapp.services.email.send_confirmation')
def test_checkout_integration(mock_email, mock_pay, mock_ship, mock_price, mock_stock):
    # This is not testing integration - it's testing the orchestration
    ...

# ✅ CORRECT - Integration test with real dependencies, only external boundaries mocked
@pytest.mark.integration
@patch('myapp.clients.stripe.Charge.create')  # External payment API
@patch('myapp.clients.sendgrid.send')          # External email API
def test_checkout_integration(mock_sendgrid, mock_stripe, db):
    # Real inventory, pricing, shipping logic; only external APIs mocked
    ...
```

---

### Deterministic Tests

Tests must produce the same result every time, regardless of:
- Execution order
- System time
- Random values
- External state

#### Time-Related Non-Determinism

**Never use these without explicit control:**

| Source | Risk |
|--------|------|
| `datetime.now()` | Fails at midnight, DST transitions |
| `datetime.utcnow()` | Same issues |
| `timezone.now()` (Django) | Same issues |
| `time.time()` | Timestamp comparisons fail |
| `Date.now()` (JS) | Same issues |
| `new Date()` (JS) | Same issues |

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

```javascript
// ❌ WRONG - Non-deterministic
it('sets creation date to now', () => {
  const item = createItem();
  expect(item.createdAt).toBeCloseTo(Date.now(), -2); // Flaky!
});

// ✅ CORRECT - Use fake timers
it('sets creation date to now', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-15T10:00:00Z'));
  
  const item = createItem();
  
  expect(item.createdAt).toEqual(new Date('2026-01-15T10:00:00Z'));
  
  jest.useRealTimers(); // Always restore!
});
```

#### Random Values Non-Determinism

**Never use these without explicit control:**

| Source | Risk |
|--------|------|
| `random.random()` | Different values each run |
| `random.choice()` | Unpredictable selection |
| `uuid.uuid4()` | Can't assert exact value |
| `Math.random()` (JS) | Same issues |

```python
# ❌ WRONG - Non-deterministic
def test_generate_code():
    code = generate_verification_code()
    assert len(code) == 6  # Can't verify actual value!

# ✅ CORRECT - Seed random or inject value
def test_generate_code_with_seed():
    random.seed(42)
    code = generate_verification_code()
    assert code == '839471'  # Deterministic with seed

# ✅ ALSO CORRECT - Inject UUID via fixture
def test_create_order_with_reference(mocker):
    mocker.patch('uuid.uuid4', return_value=UUID('12345678-1234-5678-1234-567812345678'))
    order = create_order()
    assert order.reference == '12345678-1234-5678-1234-567812345678'
```

```javascript
// ❌ WRONG - Non-deterministic
it('generates random token', () => {
  const token = generateToken();
  expect(token).toHaveLength(32); // Can't verify value
});

// ✅ CORRECT - Mock Math.random
it('generates deterministic token', () => {
  const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  
  const token = generateToken();
  
  expect(token).toBe('expected-token-value');
  mockRandom.mockRestore();
});
```

---

### Arbitrary Sleeps

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

Each test must be independent and leave no side effects.

#### Database Isolation

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

#### Global State Isolation

**Do not mutate global state** without reverting. This includes:

| Global State | Isolation Requirement |
|--------------|----------------------|
| `os.environ` | Restore after test |
| Django settings | Use `@override_settings` or restore |
| Module-level variables | Avoid or restore |
| Singletons | Reset between tests |

```python
# ❌ WRONG - Mutates os.environ without cleanup
def test_feature_flag():
    os.environ['FEATURE_X_ENABLED'] = 'true'
    assert is_feature_enabled('X')
    # Environment polluted for next test!

# ✅ CORRECT - Use monkeypatch (auto-reverts)
def test_feature_flag(monkeypatch):
    monkeypatch.setenv('FEATURE_X_ENABLED', 'true')
    assert is_feature_enabled('X')
    # Automatically restored after test

# ✅ CORRECT - Use Django's override_settings
from django.test import override_settings

@override_settings(FEATURE_X_ENABLED=True)
def test_feature_flag():
    assert is_feature_enabled('X')
```

#### File System Isolation

```python
# ❌ WRONG - Writes to actual filesystem
def test_export_report():
    export_report('/tmp/report.csv')
    assert os.path.exists('/tmp/report.csv')
    # File persists, may conflict with other tests

# ✅ CORRECT - Use tmp_path fixture
def test_export_report(tmp_path):
    report_path = tmp_path / 'report.csv'
    export_report(str(report_path))
    assert report_path.exists()
    # Automatically cleaned up
```

#### Frontend State Isolation

```javascript
// ❌ WRONG - localStorage not cleaned
it('persists user preference', () => {
  localStorage.setItem('theme', 'dark');
  expect(getTheme()).toBe('dark');
  // localStorage polluted for next test!
});

// ✅ CORRECT - Clean up in afterEach
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it('persists user preference', () => {
  localStorage.setItem('theme', 'dark');
  expect(getTheme()).toBe('dark');
});
```

#### Timer Restoration

```javascript
// ❌ WRONG - Fake timers not restored
it('debounces input', () => {
  jest.useFakeTimers();
  // ... test code ...
  // Forgot to restore - breaks subsequent tests!
});

// ✅ CORRECT - Always restore timers
it('debounces input', () => {
  jest.useFakeTimers();
  
  // ... test code ...
  
  jest.useRealTimers(); // Always restore!
});

// ✅ BETTER - Use afterEach for safety
afterEach(() => {
  jest.useRealTimers();
});
```

#### Mock Restoration

```javascript
// ❌ WRONG - Global mock not restored
it('mocks fetch', () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  // ... test code ...
  // fetch stays mocked for all tests!
});

// ✅ CORRECT - Restore in afterEach
let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ✅ BETTER - Use jest.spyOn with mockRestore
it('mocks fetch', () => {
  const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
  
  // ... test code ...
  
  mockFetch.mockRestore();
});
```

---

## Frontend-Specific Standards

### No Implementation Coupling

Frontend unit tests must verify **user-observable behavior**, not internal implementation.

```javascript
// ❌ WRONG - Accessing component internals
it('updates counter state', () => {
  const wrapper = mount(Counter);
  wrapper.vm.count = 5;  // Directly mutating internal state!
  expect(wrapper.vm.count).toBe(5);  // Testing internal state!
});

// ❌ WRONG - Accessing internal methods
it('calculates total', () => {
  const wrapper = mount(Cart);
  const total = wrapper.vm.calculateTotal();  // Internal method!
  expect(total).toBe(100);
});

// ✅ CORRECT - Test through user interaction
it('increments counter when button clicked', async () => {
  const wrapper = mount(Counter);
  
  await wrapper.find('[data-testid="increment-btn"]').trigger('click');
  
  expect(wrapper.find('[data-testid="count-display"]').text()).toBe('1');
});

// ✅ CORRECT - Test observable output
it('displays calculated total', () => {
  const wrapper = mount(Cart, {
    props: { items: [{ price: 50 }, { price: 50 }] }
  });
  
  expect(wrapper.find('[data-testid="total"]').text()).toBe('$100');
});
```

---

### Stable Selectors in Unit Tests

**Do not use fragile selectors** that break when CSS classes or structure change.

| Selector Type | Stability | Example |
|---------------|-----------|---------|
| `data-testid` | ✅ Stable | `[data-testid="submit-btn"]` |
| Component name | ✅ Stable | `findComponent(SubmitButton)` |
| CSS class | ❌ Fragile | `.btn-primary` |
| Element ID | ❌ Fragile | `#submit` |
| Tag + structure | ❌ Fragile | `div > button:first-child` |

```javascript
// ❌ WRONG - Fragile selectors
wrapper.find('.btn-primary').trigger('click');
wrapper.find('#submit-button').trigger('click');
wrapper.find('div.form-actions > button').trigger('click');

// ✅ CORRECT - Stable selectors
wrapper.find('[data-testid="submit-btn"]').trigger('click');
wrapper.findComponent(SubmitButton).trigger('click');
wrapper.find('button[type="submit"]').trigger('click'); // Semantic HTML
```

---

### Single Mount Per Test

Each test should have **one mount/render cycle**. Multiple mounts suggest the test is verifying multiple behaviors.

```javascript
// ❌ WRONG - Multiple mounts in one test
it('handles form states', () => {
  // First mount - empty state
  let wrapper = mount(LoginForm);
  expect(wrapper.find('[data-testid="error"]').exists()).toBe(false);
  
  // Second mount - with error
  wrapper = mount(LoginForm, { props: { error: 'Invalid' } });
  expect(wrapper.find('[data-testid="error"]').text()).toBe('Invalid');
  
  // Third mount - loading state
  wrapper = mount(LoginForm, { props: { loading: true } });
  expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true);
});

// ✅ CORRECT - Separate tests for each state
it('shows no error initially', () => {
  const wrapper = mount(LoginForm);
  expect(wrapper.find('[data-testid="error"]').exists()).toBe(false);
});

it('displays error message from props', () => {
  const wrapper = mount(LoginForm, { props: { error: 'Invalid' } });
  expect(wrapper.find('[data-testid="error"]').text()).toBe('Invalid');
});

it('shows spinner when loading', () => {
  const wrapper = mount(LoginForm, { props: { loading: true } });
  expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true);
});
```

**Exception:** Tests that explicitly verify re-render behavior with changing props are acceptable:

```javascript
// ✅ ACCEPTABLE - Testing prop change behavior
// quality: allow-multi-render (testing reactive prop update)
it('updates display when count prop changes', async () => {
  const wrapper = mount(Counter, { props: { count: 0 } });
  expect(wrapper.text()).toContain('0');
  
  await wrapper.setProps({ count: 5 });
  
  expect(wrapper.text()).toContain('5');
});
```

---

## E2E-Specific Standards

### Selector Hierarchy

Use selectors in this **priority order** (most stable to least stable):

| Priority | Selector Type | Example | Why |
|----------|---------------|---------|-----|
| 1 | Role + accessible name | `getByRole('button', { name: 'Submit' })` | Resilient to UI refactors, tests accessibility |
| 2 | Test ID | `getByTestId('submit-btn')` | Explicit contract, stable |
| 3 | Data attribute | `locator('[data-testid="..."]')` | Same as above, Playwright syntax |
| 4 | Text content | `getByText('Submit')` | May break with i18n |
| 5 | ARIA attributes | `locator('[aria-label="Close"]')` | Stable if ARIA is maintained |
| ❌ | CSS class | `locator('.btn-primary')` | Breaks on style refactors |
| ❌ | Element ID | `locator('#submit')` | Often auto-generated or changed |
| ❌ | Position | `.nth(0)`, `.first()`, `.last()` | Breaks when order changes |

```javascript
// ❌ WRONG - Fragile selectors
await page.locator('.login-form .btn-primary').click();
await page.locator('#submit-button').click();
await page.locator('div.actions > button').first().click();

// ✅ CORRECT - Stable selectors
await page.getByRole('button', { name: 'Sign In' }).click();
await page.getByTestId('submit-btn').click();
await page.locator('[data-testid="submit-btn"]').click();
```

---

### No Hardcoded Timeouts

**Never use `waitForTimeout()`** with arbitrary values. Use condition-based waits instead.

```javascript
// ❌ WRONG - Hardcoded timeout (flaky!)
await page.click('[data-testid="submit"]');
await page.waitForTimeout(3000);  // Why 3 seconds? Will it always be enough?
expect(await page.locator('[data-testid="success"]').isVisible()).toBe(true);

// ✅ CORRECT - Wait for condition
await page.click('[data-testid="submit"]');
await expect(page.locator('[data-testid="success"]')).toBeVisible();

// ✅ CORRECT - Wait for network
await page.click('[data-testid="submit"]');
await page.waitForResponse(resp => resp.url().includes('/api/submit'));
await expect(page.locator('[data-testid="success"]')).toBeVisible();

// ✅ CORRECT - Wait for URL change
await page.click('[data-testid="submit"]');
await page.waitForURL('**/success');
```

---

### Serial Tests Require Justification

`test.describe.serial` creates test interdependence and should only be used with documented justification.

```javascript
// ❌ WRONG - Serial without justification
test.describe.serial('User flow', () => {
  test('creates account', ...);
  test('verifies email', ...);  // Depends on previous test
  test('completes profile', ...);  // Depends on previous tests
});

// ✅ CORRECT - With documented justification
// quality: allow-serial (multi-step user journey that must maintain session state)
test.describe.serial('Complete onboarding flow', () => {
  test('creates account', ...);
  test('verifies email', ...);
  test('completes profile', ...);
});

// ✅ BETTER - Isolated tests when possible
test.describe('User management', () => {
  test('can create account', async ({ page }) => {
    // Complete, isolated test
  });
  
  test('can verify email', async ({ page, verifiedUser }) => {
    // Uses fixture to set up precondition
  });
});
```

---

### Avoid Excessive Sequential Actions

E2E tests with too many actions are fragile and hard to debug. Consider splitting or using API shortcuts.

```javascript
// ⚠️ WARNING - Too many actions (hard to debug when it fails)
test('complete checkout flow', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="login"]');
  await page.fill('[data-testid="email"]', 'user@test.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="submit"]');
  await page.click('[data-testid="products"]');
  await page.click('[data-testid="product-1"]');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="cart"]');
  await page.click('[data-testid="checkout"]');
  await page.fill('[data-testid="address"]', '123 Main St');
  await page.fill('[data-testid="city"]', 'NYC');
  await page.fill('[data-testid="zip"]', '10001');
  await page.click('[data-testid="continue"]');
  await page.fill('[data-testid="card"]', '4242424242424242');
  await page.click('[data-testid="pay"]');
  // ... 20 more actions
});

// ✅ BETTER - Use API shortcuts for setup, test only the critical path
test('complete payment step', async ({ page, authenticatedUser, cartWithItems }) => {
  // User already logged in and cart populated via API/fixtures
  await page.goto('/checkout');
  await page.fill('[data-testid="card"]', '4242424242424242');
  await page.click('[data-testid="pay"]');
  await expect(page.locator('[data-testid="success"]')).toBeVisible();
});
```

---

### No Hardcoded Test Data

Avoid hardcoding IDs, emails, or codes that may change or conflict.

```javascript
// ❌ WRONG - Hardcoded values that may conflict or change
test('view specific product', async ({ page }) => {
  await page.goto('/products/12345');  // What if this ID doesn't exist?
  await page.fill('[data-testid="email"]', 'admin@company.com');  // Real email!
});

// ✅ CORRECT - Generate or use fixture data
test('view product details', async ({ page, testProduct }) => {
  await page.goto(`/products/${testProduct.id}`);  // Fixture-created product
});

test('submit contact form', async ({ page }) => {
  const testEmail = `test-${Date.now()}@example.com`;  // Unique, obviously fake
  await page.fill('[data-testid="email"]', testEmail);
});
```

---

### Data Isolation and Cleanup

E2E tests should either **isolate data** or **clean up** after themselves.

```javascript
// ✅ CORRECT - Create and clean up
test.describe('Product management', () => {
  let createdProductId;
  
  test.afterEach(async ({ request }) => {
    if (createdProductId) {
      await request.delete(`/api/products/${createdProductId}`);
    }
  });
  
  test('can create product', async ({ page }) => {
    // ... create product
    createdProductId = await page.locator('[data-testid="product-id"]').textContent();
  });
});

// ✅ ALSO CORRECT - Use isolated test database/tenant
test.describe('Product management', () => {
  test.use({ storageState: 'test-tenant-auth.json' });
  
  test('can create product', async ({ page }) => {
    // Runs in isolated tenant, data doesn't affect other tests
  });
});
```

---

## Suite-Level Standards

### Include Error Path Coverage

A test suite must include tests for **error conditions**, not just happy paths.

```python
# ❌ INCOMPLETE - Only happy path
class TestOrderCreation:
    def test_create_order_success(self):
        ...

# ✅ COMPLETE - Happy path + error paths
class TestOrderCreation:
    def test_create_order_success(self):
        ...
    
    def test_create_order_fails_with_empty_cart(self):
        ...
    
    def test_create_order_fails_with_insufficient_stock(self):
        ...
    
    def test_create_order_fails_with_invalid_payment(self):
        ...
```

**Signals that indicate error coverage:**
- `pytest.raises(...)` - Python exception testing
- `expect(...).rejects` - JavaScript promise rejection
- `4xx`/`5xx` status code assertions
- `fail`, `reject`, `error`, `exception` in test names
- `page.route()` simulating error responses in E2E

---

### Assertion Density

Tests should have a **reasonable ratio** of setup to assertions. A test with 50 lines of setup and 1 assertion may indicate:
- The test is doing too much
- The assertion is too weak
- The test should be split

> **Rule of thumb:** If `arrange_lines / assertions > 10`, review the test.

```python
# ⚠️ WARNING - Low assertion density
def test_complex_workflow():
    # 40 lines of setup...
    user = create_user()
    org = create_org(owner=user)
    team = create_team(org=org)
    # ... many more setup lines
    
    result = execute_workflow(user, org, team)
    
    assert result.success  # Only 1 assertion for all that setup?

# ✅ BETTER - Either split or add meaningful assertions
def test_workflow_creates_audit_log():
    # Focused setup for specific behavior
    ...
    
    assert AuditLog.objects.filter(action='workflow_executed').exists()
    assert result.audit_log_id is not None
```

---

## Documented Exceptions

When a standard rule doesn't apply to a specific case, **document the exception** with a reason.

### Exception Syntax

```python
# quality: disable RULE_ID (reason why this is acceptable)
# quality: allow-conditional (checking error type requires conditional)
# quality: allow-multi-render (testing reactive prop update)
# quality: allow-call-contract (testing event emission)
# quality: allow-fragile-selector (legacy component, refactor planned in JIRA-123)
```

### Example Usage

```python
# quality: allow-conditional (different error types require different validation)
def test_validation_error_messages():
    if error_type == 'required':
        assert 'is required' in message
    elif error_type == 'format':
        assert 'invalid format' in message
```

```javascript
// quality: allow-fragile-selector (third-party component, no test IDs available)
await page.locator('.external-datepicker .day-15').click();
```

### Exception Tracking

All exceptions are tracked and reported:
- Visible in quality gate reports
- Audited periodically to prevent abuse
- High exception count triggers review

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
| **Silent Mocks** | Mocks without return_value/side_effect | Configure mock behavior |
| **Call-Only Verification** | assert_called without observable effect | Also verify effect |
| **Time Bombs** | Tests using current time | Freeze time |
| **Random Failures** | Tests using random without seed | Seed or inject values |
| **Global Pollution** | Tests that mutate shared state | Isolate and restore |
| **Selector Roulette** | CSS classes/IDs as selectors | Use test IDs or roles |
| **Sleep Walking** | Arbitrary waits | Condition-based waits |
| **Loop Testing** | Assertions in loops | Use parameterization |
| **Conjunction Tests** | "Test X and Y and Z" | Split by behavior |

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
| Conditional in test | WARNING | `if/elif/else` in test body |
| Loop in test | WARNING | `for/while` iterating inputs |
| Assert in loop | WARNING | Assertion inside loop |
| Conjunction in name | INFO/WARNING | `and`/`y` in test name |
| Non-deterministic time | WARNING | `datetime.now` without freeze |
| Non-deterministic random | WARNING | `random.*` without seed |
| Silent mock | WARNING | Mock without return_value/side_effect |
| Call-only assertion | INFO | `assert_called` without effect check |
| Global state mutation | WARNING | Modifying os.environ/settings |

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
| Implementation coupling | WARNING | Access to `wrapper.vm.*` |
| Fragile selector | WARNING | `.find('.class')`, `.find('#id')` |
| Multiple mounts | INFO | Multiple mount/render in one test |
| Non-deterministic | WARNING | `Date.now`, `Math.random` without control |
| Unrestored timers | WARNING | `useFakeTimers` without restore |
| Global state leak | WARNING | localStorage/mocks not cleaned |

#### Frontend E2E (Playwright)

| Check | Severity | Description |
|-------|----------|-------------|
| Empty test | ERROR | Test with no actions |
| No assertions | WARNING | May rely on implicit assertions |
| Hardcoded timeout | ERROR | `waitForTimeout(>500ms)` - flaky |
| Fragile selector | INFO/WARNING | Class/index-based vs getByRole |
| Forbidden token | ERROR | Banned tokens in title |
| Duplicate name | ERROR | Same test title |
| Console.log | INFO | Less critical in E2E |
| Serial without justification | WARNING | `describe.serial` undocumented |
| Excessive actions | INFO | Too many sequential actions |
| Hardcoded data | INFO | IDs/emails/codes hardcoded |
| No data cleanup | INFO | Test data without cleanup |

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
│  □ No conjunctions in name (and, y)                            │
│  □ Test is in correct domain folder                            │
│  □ No duplicate test names in scope                            │
│  □ No conditionals (if/else) in test body                      │
│  □ No loops for iterating inputs (use parameterize)            │
│  □ No assertions inside loops                                  │
│  □ Assertions verify observable outcomes                        │
│  □ Follows AAA pattern (Arrange/Act/Assert)                    │
│  □ Fixtures are explicit and minimal                           │
│  □ Complex payloads use factories                              │
│  □ Only external boundaries are mocked                         │
│  □ Mocks have explicit return_value/side_effect                │
│  □ assert_called* paired with observable effect                │
│  □ Test is deterministic (no time.now, no random)             │
│  □ Test is isolated (no dependency on other tests)             │
│  □ Global state is restored (env, settings, mocks)             │
│  □ Frontend: no wrapper.vm.* access                            │
│  □ Frontend: stable selectors (testid, not class)              │
│  □ Frontend: one mount per test                                │
│  □ E2E: no waitForTimeout()                                    │
│  □ E2E: prefer getByRole > getByTestId > locator               │
│  □ E2E: serial tests have documented justification             │
│  □ Suite includes error path tests                             │
│  □ Exceptions are documented with reason                       │
└─────────────────────────────────────────────────────────────────┘
```