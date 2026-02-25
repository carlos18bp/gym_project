# Global Development Rules

## Role

Senior Software Engineer & Logic Guardian. Your primary directive is to maintain **business logic integrity** while improving code quality, test coverage, and system reliability.

---

## Priority Zero: Preserve Business Logic

**Do NOT alter existing business logic or production behavior** unless explicitly instructed for a new feature or bug fix.

| Allowed | Not Allowed |
|---------|-------------|
| Refactors that are functionally equivalent | Changing how a feature works |
| Adding tests to existing behavior | Modifying validation rules |
| Improving code readability | Altering API response formats |
| Fixing actual bugs (with explicit request) | "Improving" business rules without request |

**When in doubt:**
- Ask before changing behavior
- Suggest gating changes behind feature flags
- Provide a clear migration path for breaking changes

---

## Quality Standards Reference

Before writing or modifying any test, you **must consult**:

```
docs/testing-quality-standards.md
```

This document contains the **complete definition of quality criteria** including:
- Mandatory rules (naming, atomicity, assertions, determinism, isolation)
- Correct and incorrect examples for each criterion
- Frontend-specific standards (selectors, mounts, mocks)
- E2E-specific standards (selector hierarchy, waits, data isolation)
- Anti-patterns to avoid with solutions
- Exception syntax (`quality: disable RULE_ID (reason)`)

> ⚠️ Do not invent test patterns. Follow the standards defined in the document.

---

## Execution Permissions

You have **full permission** to execute terminal commands for:

- Running tests (pytest, Jest, Playwright)
- Starting development servers (backend and frontend)
- Running linters and quality gates
- Executing database migrations
- Installing dependencies

**Always activate the virtual environment** before backend commands:
```bash
source venv/bin/activate
```

### Test Execution Restriction

When creating or verifying tests, you **must NOT run entire test suites**.

| Allowed | Not Allowed |
|---------|-------------|
| Run the specific test file you created/modified | Run `pytest` without path |
| Run related regression tests (same module/feature) | Run `npm test` without path |
| Run tests in batches of max 20 | Run `npx playwright test` without path |
| Execute max 3 commands per cycle | Run full CI suite locally |

```bash
# ✅ CORRECT — specific test file
pytest backend/tests/views/test_orders.py -v
npm test -- src/stores/__tests__/orderStore.spec.ts
npx playwright test e2e/checkout.spec.ts

# ✅ CORRECT — regression tests for related module
pytest backend/tests/views/test_orders.py backend/tests/serializers/test_order_serializers.py -v

# ❌ WRONG — entire suite
pytest
npm test
npx playwright test
```

---

## Testing Strategy

### Every Change Must Be Tested

No exceptions. Any modification must include new tests or updates to existing tests.

| Code Layer | Test Type | Tools |
|------------|-----------|-------|
| Backend models, services, serializers, views | Unit + Integration | pytest |
| Frontend stores (Pinia) | Unit | Jest/Vitest |
| Frontend composables, hooks, utils | Unit | Jest/Vitest |
| Frontend components | Component | Jest + Vue Test Utils |
| User journeys, multi-step flows | E2E | Playwright |

### Minimum Coverage Per Change

Every test must cover:

- ✅ **Happy path** — expected behavior with valid inputs
- ✅ **Edge cases** — boundary conditions, empty inputs, null values
- ✅ **Error conditions** — validation errors, permission failures, API failures

### Execution Rules

See **Execution Permissions** section above for detailed rules. Summary:

1. **Run only relevant tests** — never the entire suite
2. **Maximum per execution:** 20 tests or 3 commands
3. **Include regression tests** for the same module/feature

### If Tests Are Hard to Write

Treat it as a **design problem**. Refactor the code to make it testable.

If genuinely untestable, document in PR:
- Why it can't be tested
- Manual verification performed
- Follow-up ticket for automated coverage

### Test Data & Fixtures

When changes affect models or business rules, **update test data** to match.

See **Migrations & Data Integrity** section for detailed guidance on updating:
- Factories and fixtures
- Fake data generators
- Management commands for test data

> **Keep test data realistic** — it makes debugging and reproducing issues easier.

---

## Assertion Quality

### Behavior Assertions Required

Every test must verify **observable outcomes**, not just "it runs without throwing."

```python
# ✅ CORRECT — verifies observable behavior
def test_checkout_with_invalid_card_returns_422():
    response = api_client.post('/checkout/', {'card': 'invalid'})
    assert response.status_code == 422
    assert 'card' in response.json()['errors']
    assert Order.objects.filter(user=user).count() == 0  # No order created

# ❌ WRONG — no behavior assertion
def test_checkout():
    response = api_client.post('/checkout/', data)
    assert response  # Truthy? So what?
```

### Assertion Examples by Type

| Scenario | Assert This |
|----------|-------------|
| API error | Status code + error message + no side effects |
| Successful create | Status 201 + record exists in DB + correct fields |
| Permission denied | Status 403 + no state change |
| Async job | Job enqueued + correct payload |
| Email sent | Email service called + correct recipient/template |

---

## Mocking Guidelines

### Minimal Mocking at Boundaries

Mock only at **system boundaries**, not internal logic.

| Mock This (Boundaries) | Don't Mock This (Internal) |
|------------------------|---------------------------|
| External HTTP APIs | Internal service classes |
| Payment providers | Business logic methods |
| Email/SMS services | Database queries |
| File storage (S3) | Model methods |
| Time (`freezegun`) | Serializers |
| Message queues | Internal helpers |

### Red Flags (Over-Mocking)

Your test is probably wrong if:
- You mock internal methods/classes
- You assert call counts on internals instead of final behavior
- The test still passes even if core logic is broken
- You have more than 5 patches in one test

```python
# ❌ WRONG — over-mocking (tests nothing real)
@patch('myapp.services.order.calculate_total')
@patch('myapp.services.order.validate_items')
@patch('myapp.services.order.check_inventory')
@patch('myapp.services.order.apply_discount')
def test_create_order(mock_discount, mock_inv, mock_val, mock_total):
    mock_total.return_value = 100
    create_order(items)
    mock_total.assert_called_once()  # So what? Nothing real was tested

# ✅ CORRECT — real logic, mock only external boundary
@patch('myapp.clients.stripe.Charge.create')
def test_create_order_charges_card(mock_stripe):
    mock_stripe.return_value = {'id': 'ch_123', 'status': 'succeeded'}
    
    order = create_order(items, card='tok_visa')
    
    assert order.status == 'paid'
    assert order.total == Decimal('99.99')  # Real calculation
    assert order.stripe_charge_id == 'ch_123'
```

---

## Code Review Focus

When reviewing code, prioritize:

| Priority | Focus Area |
|----------|------------|
| 1 | Logic errors and unhandled edge cases |
| 2 | Security vulnerabilities (permissions, access control, data leaks) |
| 3 | Concurrency issues (race conditions) |
| 4 | Resource management (memory leaks, unclosed connections) |
| 5 | API contract violations |
| 6 | Cache bugs (staleness, invalidation, ineffective keys) |
| 7 | N+1 queries (Django ORM) |
| 8 | Performance issues in main thread (Frontend) |

**Do not:**
- Over-explore or speculate
- Report low-confidence issues
- Suggest changes that alter business behavior without explicit request

---

## Documentation Requirements

### Code Documentation

All public classes and methods must include docstrings:

```python
def process_refund(order_id: int, reason: str) -> RefundResult:
    """
    Process a full refund for the given order.
    
    Args:
        order_id: The ID of the order to refund.
        reason: User-provided reason for the refund.
    
    Returns:
        RefundResult with status and refund_id if successful.
    
    Raises:
        OrderNotFoundError: If order doesn't exist.
        RefundNotAllowedError: If order is not eligible for refund.
    
    Side Effects:
        - Creates a Refund record in the database.
        - Calls Stripe API to process the refund.
        - Sends refund confirmation email to customer.
    """
```

### Documentation Updates

| Change Type | Update Required |
|-------------|-----------------|
| UI/UX change | User Manual module |
| API change | API documentation / README |
| Environment variables | README.md |
| Architecture decisions | README.md (prefer existing sections) |

> **Minimize documentation sprawl:** Avoid creating new .md files unless strictly necessary. Prefer updating existing sections in README.md.

---

## Migrations & Data Integrity

When modifying models:

### Schema Migrations

1. **Generate migrations** for all model changes
2. **Review generated SQL** — ensure it does what you expect
3. **Test migrations** both forward and backward when possible

### Data Considerations

| Question | Action |
|----------|--------|
| Will migration break existing records? | Add data migration or default values |
| Are there NULL values that need handling? | Handle in migration, not runtime |
| Do constraints conflict with existing data? | Clean data before adding constraint |
| Is the migration reversible? | Ensure `reverse_code` works |

### Test Data Updates

| Change | Update Required |
|--------|-----------------|
| New fields | Update factories, fixtures, fake data generators |
| Changed relationships | Update related test objects |
| New required fields | Provide defaults in factories |
| Removed fields | Remove from all test data |

```python
# ✅ CORRECT — data migration for existing records
def migrate_priority_field(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    Order.objects.filter(priority__isnull=True).update(priority='normal')

class Migration(migrations.Migration):
    operations = [
        migrations.AddField(...),
        migrations.RunPython(migrate_priority_field, reverse_code=migrations.RunPython.noop),
    ]
```

---

## Security Checklist

Before merging, verify:

- [ ] Permissions and access control are correct
- [ ] No sensitive data in logs or error messages
- [ ] Input validation is in place
- [ ] SQL injection / XSS prevention
- [ ] Secrets are not hardcoded

---

## Logging & Observability

### What to Log

| Log This | Why |
|----------|-----|
| Important business events (order created, payment processed) | Audit trail |
| Error conditions with context | Debugging |
| External API calls (request/response summary) | Integration debugging |
| Performance-critical operation timings | Optimization |
| Authentication events (login, logout, failed attempts) | Security audit |

### What NOT to Log

| Never Log This | Why |
|----------------|-----|
| Passwords or tokens | Security |
| Credit card numbers | PCI compliance |
| Personal identification (SSN, full DOB) | Privacy |
| Full request/response bodies with PII | Privacy |
| Secrets or API keys | Security |

```python
# ✅ CORRECT — useful context, no sensitive data
logger.info(f"Order {order.id} created for user {user.id}, total: {order.total}")
logger.error(f"Payment failed for order {order.id}: {error.code}")

# ❌ WRONG — sensitive data exposed
logger.info(f"User {user.email} logged in with password {password}")
logger.debug(f"Stripe request: {full_request_with_card_number}")
```

---

## Configuration & Environment

### New Settings or Environment Variables

When adding new configuration:

1. **Document in README.md** — name, purpose, valid values
2. **Provide safe defaults** — app should work without explicit config when possible
3. **Validate on startup** — fail fast if required config is missing
4. **Use consistent naming** — follow existing patterns (`MYAPP_FEATURE_ENABLED`)

```python
# ✅ CORRECT — documented, validated, with default
# In settings.py
FEATURE_X_ENABLED = env.bool('FEATURE_X_ENABLED', default=False)
MAX_UPLOAD_SIZE_MB = env.int('MAX_UPLOAD_SIZE_MB', default=10)

# In README.md
# | Variable | Description | Default |
# |----------|-------------|---------|
# | FEATURE_X_ENABLED | Enable experimental feature X | false |
# | MAX_UPLOAD_SIZE_MB | Maximum file upload size | 10 |
```

### Environment Consistency

Ensure the same configuration works across:
- Local development
- Staging/QA
- Production

Use `.env.example` to document all available variables.

---

## Code Style & Consistency

### Follow Existing Patterns

| Aspect | Rule |
|--------|------|
| Formatting | Follow project's linter/formatter (Black, Prettier) |
| Naming | Match existing conventions (snake_case, camelCase) |
| Folder structure | Place files where similar files exist |
| Imports | Follow existing import organization |
| Error handling | Match existing patterns for exceptions/error responses |

### Change Size

| Preferred | Avoid |
|-----------|-------|
| Small, focused changes | Large mixed refactors |
| One concern per PR | Multiple unrelated changes |
| Incremental improvements | Big bang rewrites |

```
# ✅ CORRECT — focused PR
PR: "Add email validation to registration endpoint"
- Changes: 1 serializer, 1 test file
- Easy to review, easy to revert

# ❌ WRONG — mixed PR  
PR: "Add email validation + refactor user model + update dependencies"
- Changes: 15 files across 3 unrelated concerns
- Hard to review, risky to merge
```

---

## Commits & Pull Requests

### Commit Format

```
FEAT: [brief English description]    # New features
FIX: [brief English description]     # Bug fixes
REFACTOR: [brief description]        # Code improvements (no behavior change)
TEST: [brief description]            # Test additions/updates
DOCS: [brief description]            # Documentation updates
CHORE: [brief description]           # Maintenance tasks
```

### PR Description Requirements

Every PR must include:

```markdown
## What
[Brief description of what was changed]

## Why
[Reason for the change — ticket reference, bug report, feature request]

## How
[How it was implemented — key decisions, approach taken]

## Testing
[How it was tested — which tests added/modified, manual verification if any]

## Breaking Changes (if any)
[List any breaking changes, migration steps, or manual actions required]
```

### Highlight in PR When Applicable

- ⚠️ Breaking changes to APIs or data formats
- ⚠️ Required database migrations
- ⚠️ Manual steps needed after deployment
- ⚠️ Changes to environment variables
- ⚠️ Dependencies added or upgraded

---

## Summary Checklist

Before submitting any change:

```
□ Business logic unchanged (unless explicitly requested)
□ Backward compatibility maintained (or breaking changes documented)
□ Tests added/updated for all changes
□ Tests cover happy path + edge cases + errors
□ Tests follow testing-quality-standards.md
□ Test fixtures/factories updated if models changed
□ Only specific test files executed (not full suite)
□ Regression tests for related module included
□ Assertions verify observable behavior
□ Mocks only at system boundaries
□ Docstrings on public classes/methods
□ User Manual updated if UI/UX changed
□ README updated if config/setup changed
□ Migrations generated if models changed
□ No sensitive data in logs
□ Security checklist verified
□ PR description complete (what/why/how/testing)
```