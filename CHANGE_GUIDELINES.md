# Change Implementation Guidelines

This document describes the standard steps to follow whenever a change is made to the project (backend or frontend). The goal is to preserve existing behavior, avoid regressions, and keep the system well-documented and testable.

## Mandatory Checklist

1. **Validate business logic around the change**

   - Confirm that the new behavior is consistent with the existing business rules.
   - Check for implicit contracts (API responses, error formats, background jobs, emails, etc.).
   - If a test requires changing existing behavior, explicitly decide whether the behavior or the test is the source of truth.

2. **Keep code documented with English docstrings**

   - Public functions, classes, and complex methods must have clear docstrings in English.
   - Docstrings should explain:
     - Purpose and intent ("what" and "why").
     - Parameters and return values.
     - Important side effects, invariants, or assumptions.
   - When modifying existing behavior, update the docstring so it stays accurate.

3. **Add or update automated tests**

   - For any new behavior, add tests that cover:
     - Happy path.
     - Relevant edge cases and error conditions.
   - When changing existing behavior:
     - Update tests so they describe the **intended** new behavior.
     - Avoid weakening assertions unless that is a deliberate design choice.
   - Run the full relevant test suite (backend and/or frontend) and ensure it passes before merging.

4. **Verify and maintain test data**

   - Review existing test fixtures and fake data used by the affected areas.
   - Update or extend backend fixtures, management commands, or fake-data generators when:
     - New fields are introduced.
     - Business rules change (e.g., new required relationships, new roles, new states).
   - Ensure test data stays realistic enough to make debugging and reproducing issues easier.

5. **Verify and update the User Manual module**

   - If any user-facing behavior changes (API, UI flows, emails, reports, roles/permissions, etc.), review the user manual or help content.
   - Update or add entries in the user manual so it reflects the current behavior.
   - When in doubt, document:
     - New features or flows.
     - Changes to existing flows (including error messages and edge cases that users might see).

## Optional / Recommended Considerations

These items are not always required, but they should be considered for any non-trivial change.

- **Database migrations and data integrity**
  - Check whether model changes require Django migrations.
  - Consider data migration scripts if existing records must be adapted.
  - Verify that constraints and defaults are still correct for production data.

- **Backward compatibility**
  - For public APIs, avoid breaking changes in request/response shape unless explicitly planned.
  - Where possible, deprecate behavior gradually (e.g., support both old and new fields for a time).

- **Performance and scalability**
  - Evaluate whether the change introduces heavier queries, N+1 issues, or expensive computations.
  - For critical paths, consider adding tests or instrumentation to detect regressions.

- **Security and permissions**
  - Re-check permission checks, access control, and visibility rules affected by the change.
  - Ensure that error messages do not leak sensitive information.
  - Review handling of user input, file uploads, and external integrations.

- **Logging and observability**
  - Add or adjust logging for important flows (success and failure paths) when helpful for debugging.
  - Avoid logging sensitive data (passwords, tokens, personal identification details).

- **Configuration and environment**
  - If new settings or environment variables are added, document them and provide safe defaults.
  - Ensure that local, staging, and production environments can be configured consistently.

- **Code style and consistency**
  - Follow the existing project style (formatting, naming, folder structure).
  - Prefer small, focused changes over large mixed refactors.

- **Review and communication**
  - When submitting changes, include a concise description of:
    - What was changed.
    - Why it was changed.
    - How it was tested.
  - Highlight any breaking changes, data migrations, or manual steps required after deployment.
  - Propose a very short commit message consistent with the type of change:
    - For a FEAT (feature/intent/adjustment), use a brief phrase that captures the intended behavior or feature in English.
    - For a FIX (bug correction), use a brief phrase that explicitly mentions the fix applied in English.
