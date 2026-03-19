---
trigger: always_on
description: Mandatory test quality standards for all backend (pytest), frontend unit (Jest), and E2E (Playwright) tests. Applies to every test file.
---

# Testing Quality Standards

Full reference: `docs/TESTING_QUALITY_STANDARDS.md`

## Mandatory Naming Rules

- Each test verifies **ONE specific behavior**. Name answers: "What behavior is being verified?"
- **No conjunctions** (`and`, `y`, `&`) in test names — split into separate tests
- **Forbidden tokens** in test names/classes/files: `batch`, `cov`, `coverage`, `deep`, `all`, `misc`, `various`
- **No duplicate** test names within the same scope
- Python: `test_<action>_<outcome>_<condition>` — JS: `it('verb phrase describing behavior', ...)`

## Assertions

- Assert **observable outcomes** (status codes, DB state, rendered UI, emitted events)
- Never assert implementation details (internal method calls, private variables, SQL queries)
- Every test must have meaningful assertions — no `assert response` or `expect(true).toBe(true)`
- When using `assert_called*`, also verify an observable effect

## Test Body Rules

- **No conditionals** (`if/elif/else`) in test body — use parameterization
- **No loops iterating inputs** — use `@pytest.mark.parametrize` or `it.each()`
- **No assertions inside loops** — aggregate or parameterize instead
- Follow **AAA pattern**: Arrange → Act → Assert

## Determinism

- Never use `datetime.now()`, `timezone.now()`, `Date.now()`, `new Date()` without control
- Never use `random.*`, `uuid.uuid4()`, `Math.random()` without seed/mock
- Python: use `freezegun` for time, `random.seed()` or `mocker.patch` for random
- JS: use `jest.useFakeTimers()` + `jest.setSystemTime()`, always restore with `jest.useRealTimers()`

## Test Isolation

- Each test independent — no dependency on execution order
- **DB**: pytest-django transactions auto-rollback
- **Global state**: use `monkeypatch` (Python) or `afterEach` cleanup (JS)
- **File system**: use `tmp_path` fixture (Python)
- **JS mocks**: always restore (`mockRestore()`, `afterEach`)
- **localStorage/sessionStorage**: clear in `afterEach`

## Mocking

Mock only at **system boundaries**:

| Mock This | Don't Mock This |
|-----------|-----------------|
| External HTTP APIs, payment, email, SMS, S3 | Internal services, DB queries, models |
| System clock (`freezegun`) | Serializers, business logic, helpers |

- Every mock must have explicit `return_value` / `side_effect` (Python) or `mockResolvedValue` / `mockReturnValue` (JS)
- No "silent mocks" — configure expected behavior

## Frontend-Specific

- **No `wrapper.vm.*`** — test through user interaction and observable output
- **Stable selectors**: `[data-testid="..."]` or `findComponent()` — never `.find('.class')` or `#id`
- **One mount per test** unless testing re-render behavior (`quality: allow-multi-render`)
- Timer restoration mandatory: `jest.useRealTimers()` in `afterEach`

## E2E-Specific (Playwright)

- **Selector hierarchy**: `getByRole` > `getByTestId` > `locator('[data-testid]')` — never CSS class/ID/position
- **No `waitForTimeout()`** — use `toBeVisible()`, `waitForResponse()`, `waitForURL()`
- **No hardcoded test data** (IDs, emails) — use fixtures or generated data
- **Serial tests** (`describe.serial`) require justification comment: `quality: allow-serial (reason)`
- Every E2E test must have `@flow:<flow-id>` tag matching `flow-definitions.json`

## Documented Exceptions

When a rule doesn't apply, document with:
```
# quality: disable RULE_ID (reason)
# quality: allow-conditional (reason)
# quality: allow-serial (reason)
# quality: allow-fragile-selector (reason)
```

## Coverage Targets

| Layer | Minimum | Layer | Minimum |
|-------|---------|-------|---------|
| Models | 80% | Frontend Stores | 75% |
| Serializers | 80% | Frontend Components | 60% |
| Views/API | 70% | E2E | Critical paths |
| Services | 85% | Utils | 90% |

## Anti-Patterns (Never Do)

God Test, Mystery Guest, Eager Mocking, Test Interdependence, Magic Numbers, Copy-Paste Tests, Commented Tests, Assertion-Free Tests, Silent Mocks, Time Bombs, Sleep Walking, Loop Testing, Selector Roulette.

## Quality Gate

Validate with: `python3 scripts/test_quality_gate.py --repo-root . --external-lint run --semantic-rules strict --report-path test-results/test-quality-audit-report.json`
