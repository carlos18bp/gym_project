---
auto_execution_mode: 2
description: Backend & Unit Testing
---
Analyze the backend codebase focusing on Models, Serializers, Views, Utils, and Tasks. Your goal is to reach 100% coverage using Unit, Integration, and Contract tests. Instruction: You have full permission to execute terminal commands. If working on the backend, you MUST always activate the virtual environment (source venv/bin/activate or equivalent) before running any test or command. Identify gaps based on the codebase logic and the provided coverage number at the end of this message. Implement that many test cases, covering happy paths, edge cases, and error handling. Run only the modified test files. 
IMPORTANT NOTE (1): Avoid running the entire test suite, including previously implemented tests. Tests must be executed in blocks of maximum 20 tests or via 3 commands per execution. Run only the specific test files created or modified.
IMPORTANT NOTE (2): COVERAGE PRIORITIZATION NOTE
Prioritize test work using the coverage report as a triage map. Start with the lowest coverage targets first (especially files at 0% or the smallest % values), focusing on critical/business-impact code paths. Use BOTH relative and absolute signals:
- Lowest % coverage first (Cover / % Stmts / % Branch / % Funcs).
- Highest “Miss” / “Uncovered Line #s” counts next (biggest uncovered surface area).
- Prioritize core layers (Views/Controllers, Serializers, Models, State/Stores, Shared Utils) over already-high or low-impact files.
IMPORTANT NOTE (3): **Review the defined global rules and the saved memories. and check testing-quality-standards.md to meet the quality standards in each implemented test.**
Goal: 
- maximize coverage gain per test by addressing the most uncovered and most critical files before polishing near-100% files.
- Do not run the full test suite; run only regression tests.