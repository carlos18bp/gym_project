---
auto_execution_mode: 2
description: Backend & Unit Testing
---
# Backend Test Coverage Strategy

## Goal

Analyze the backend codebase focusing on **Models, Serializers, Views, Utils, and Tasks**. Reach 100% coverage using Unit, Integration, and Contract tests.

## Quality Standards Reference

Before writing any test, you **must consult**:

```
testing-quality-standards.md
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

## Execution Rules

1. **Activate virtual environment** before any command:
   ```bash
   source venv/bin/activate
   ```

2. **Run only modified test files** — never the entire suite:
   ```bash
   pytest path/to/test_file.py -v
   ```

3. **Maximum per execution:**
   - 20 tests per batch
   - 3 commands per execution cycle

---

## Coverage Prioritization

Use the coverage report as a **triage map**. Prioritize in this order:

| Priority | Criteria | Rationale |
|----------|----------|-----------|
| 1 | Lowest % coverage (0% first) | Maximum impact per test |
| 2 | Highest "Miss" / "Uncovered Lines" count | Biggest uncovered surface |
| 3 | Core layers: Views → Serializers → Models → Utils → Tasks | Business-critical code first |
| 4 | Files with partial coverage | Complete before polishing |

**Do not** spend time polishing near-100% files until low-coverage files are addressed.

---

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

---

## Workflow

1. **Review** the coverage report provided below
2. **Identify** the lowest-coverage, highest-impact files
3. **Consult** `testing-quality-standards.md` for applicable standards
4. **Implement** tests following the quality criteria
5. **Run** only the new/modified test files
6. **Verify** tests pass and coverage improves

---

## Output Format

For each batch of tests, report:

```
### File: <test_file_path>
- Tests added: <count>
- Coverage before: <X%>
- Coverage after: <Y%>
- Command executed: pytest <path> -v
```

---

## Coverage Report

<!-- Paste coverage data here -->