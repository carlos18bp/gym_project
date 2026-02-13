---
description: Frontend & Component Testing
auto_execution_mode: 2
---
Conduct a thorough analysis of the frontend coverage reports. Our mandate is to reach 100% coverage in all files.
Strategy: Prioritize State Management (Pinia/Redux/Context), then Shared Logic (Composables/Hooks/Utils), and finally UI Components.
Identify the most critical gaps and 'uncovered lines'. Based on the number provided at the end, implement that many test cases using the designated tool (Jest/Vitest). Ensure you cover all logical branches and edge cases. Run only the relevant tests to maintain efficiency.
IMPORTANT NOTE (1): Avoid running the entire test suite, including previously implemented tests. Tests must be executed in blocks of maximum 20 tests or via 3 commands per execution. Run only the specific test files created or modified.
IMPORTANT NOTE (2): COVERAGE PRIORITIZATION NOTE
Prioritize test work using the coverage report as a triage map. Start with the lowest coverage targets first (especially files at 0% or the smallest % values), focusing on critical/business-impact code paths. Use BOTH relative and absolute signals:
- Lowest % coverage first (Cover / % Stmts / % Branch / % Funcs).
- Highest “Miss” / “Uncovered Line #s” counts next (biggest uncovered surface area).
- Prioritize core layers (Views/Controllers, Serializers, Models, State/Stores, Shared Utils) over already-high or low-impact files.
Goal: maximize coverage gain per test by addressing the most uncovered and most critical files before polishing near-100% files.