# Test Quality Gate Criteria (Summary)

This document summarizes the quality criteria enforced by the Test Quality Gate.
The rules are derived from the analyzers in `scripts/quality/`.

For full implementation details (architecture, algorithm, CLI options, report schema,
exception handling, and rollout behavior), see `TEST_QUALITY_GATE_REFERENCE.md`.

## Cross-suite external lint integration

- The gate supports normalized ingestion of external lint findings (`ruff` and `eslint`) in `--external-lint run` mode.
- Ruff PT checks are enabled through a curated selection (not the entire PT rule set).
- Execution-state findings are explicit:
  - `linter_misconfigured`: emitted when an external linter fails due to configuration/runtime errors.
  - `tool_unavailable`: emitted when an external lint executable is not available.
- Dedupe across internal and external findings uses stable fingerprints based on normalized rule id and snippet hash context.

## Backend (Pytest)

**Test validity**
- Tests must not be empty.
- Tests must include assertions (no missing asserts).
- Useless or vague assertions are flagged.

**Naming and location**
- Test names must be descriptive and not generic.
- Forbidden tokens in test names are errors.
- Duplicate test names (module/class) are errors.
- Files must live under allowed backend test folders.

**Test size and density**
- Tests that are too long or too short are flagged.
- Too many assertions in a single test are flagged.

**Reliability and anti-patterns**
- `sleep()` calls are errors (flaky tests).
- `print()` statements are discouraged.
- Silent `try/except` blocks are errors.

**Mock discipline**
- Excessive patching is discouraged.
- Mocks must be verified (`assert_called*`).

**Documentation**
- Complex tests should include a docstring.

**Semantic robustness (backend)**
- Non-deterministic sources (`datetime/timezone/time/uuid/random`) without explicit control are flagged.
- Direct network/IO dependencies (`requests/httpx/boto3/open`) are flagged.
- Mock call-contract-only assertions (without observable outcome assertions) are flagged as contextual signal.
- Contextual call-contract checks can be documented with `quality: allow-call-contract (reason)`.
- `allow-call-contract` markers without reason are invalid and do not suppress findings.
- Large inline payloads are flagged (prefer factories/data builders).
- Global-state mutation signals (`os.environ`, `settings.*`, env mutation helpers) are flagged.

## Frontend Unit (Jest / Vue Test Utils)

**Test validity**
- Tests must parse cleanly and not be empty.
- Tests must contain `expect()` assertions.
- Useless assertions are flagged.

**Naming and structure**
- Test names must be descriptive (avoid generic names).
- Duplicate test names within a describe block are errors.
- Forbidden tokens in names are errors.

**Test size and stability**
- Hardcoded timeouts are discouraged.
- Too many assertions are discouraged.
- Very long tests are flagged.

**Semantic robustness (frontend unit)**
- Coupling to implementation details (`wrapper.vm.*`) is flagged.
- Fragile selectors (`.find('.class')`, `.find('#id')`, `querySelector`) are flagged.
- Multiple `mount`/`render` calls in one test are flagged unless documented with `quality: allow-multi-render (reason)`.
- Direct network dependencies (`fetch`/`axios`) are flagged.
- Contextual network smell is flagged when HTTP mocks are validated only via call-contract assertions without observable outcome checks.
- Non-deterministic time/random usage (`Date.now`, `new Date`, `Math.random`) is flagged unless explicit control exists (fake timers/system time/mocks).
- Global-state leaks are flagged for storage/timer/mock mutations without cleanup/restore.
- Snapshot overreliance is flagged for snapshot-only assertions or oversized inline snapshots without semantic assertions.

**Clean output**
- `console.log` is discouraged in unit tests.

**File location**
- Unit tests must live in `frontend/test/`.

## Frontend E2E (Playwright)

**Test validity**
- Tests must parse cleanly and not be empty.
- Missing assertions are warnings (E2E may rely on implicit checks).

**Naming and structure**
- Test names must be descriptive.
- Duplicate test names are errors.
- Forbidden tokens in names are errors.

**Reliability and stability**
- Hardcoded timeouts are errors in E2E.
- Excessive assertions and long tests are flagged.
- `console.log` is discouraged.

**Semantic robustness (frontend E2E)**
- `page.waitForTimeout(...)` is flagged as a brittle wait anti-pattern (`wait_for_timeout`, semantic rule).
- `test.describe.serial` without documented reason is flagged.
- Long action sequences with low strong-assert density are flagged as excessive steps.
- Weak-only assertions (truthy/falsy/null/undefined style) are flagged as vague assertions.
- Hardcoded brittle identifiers/emails/codes are flagged as fragile test data.
- Data creation signals without cleanup/reset indicators are flagged as data-isolation risk.

**Selector quality**
- Fragile selectors (class/id/nth/first/last) are flagged.
- Prefer resilient selectors like `getByRole` or `getByTestId`.
- Fragile selectors can be explicitly documented with `quality: allow-fragile-selector (reason)`.
- `allow-fragile-selector` markers without reason are invalid and do not suppress findings.

**File location**
- E2E tests must live in `frontend/e2e/`.

## Performance budget checks

- Optional CLI budgets (`--suite-time-budget-seconds`, `--total-time-budget-seconds`) emit `performance_budget` warning findings when exceeded.
