---
description: End-to-End (E2E) Testing
auto_execution_mode: 2
---
Review the E2E coverage and identify all untested user flows. The target is 100% E2E coverage for all main features and integration points.
Focus on the 'contract' between the Frontend and Backend to ensure data integrity across the stack. Based on the number at the end, implement that many E2E scenarios using the project's tool (Playwright/Cypress). Validate real-world user behavior, including error states and complex navigations. You have permission to run necessary services and dev servers. 
IMPORTANT NOTE (1): Avoid running the entire test suite, including previously implemented tests. Tests must be executed in blocks of maximum 20 tests or via 3 commands per execution. Run only the specific test files created or modified.
IMPORTANT NOTE (2): COVERAGE PRIORITIZATION NOTE
Prioritize test work using the coverage report as a triage map. Start with the lowest coverage targets first (especially files at 0% or the smallest % values), focusing on critical/business-impact code paths. Use BOTH relative and absolute signals:
- Lowest % coverage first (Cover / % Stmts / % Branch / % Funcs).
- Highest “Miss” / “Uncovered Line #s” counts next (biggest uncovered surface area).
- Prioritize core layers (Views/Controllers, Serializers, Models, State/Stores, Shared Utils) over already-high or low-impact files.
Goal: maximize coverage gain per test by addressing the most uncovered and most critical files before polishing near-100% files.