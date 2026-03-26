---
name: implement
description: "Implementation workflow — systematic code protocol with dependency analysis, step-by-step changes, and testing. Use when the user asks to build, code, or implement a feature or fix."
argument-hint: "[description of what to implement]"
---

Before starting, ALWAYS do 2 things:
a. Read and understand the documentation in `docs/` and `tasks/`
b. Get required code context from `backend/` and `frontend/`

---

# Implementation Workflow

## Programming Principles

- **Algorithm efficiency**: Use the most efficient algorithms and data structures
- **Modularity**: Write modular code, break complex logic into smaller atomic parts
- **File management**: Break long files into smaller, more manageable files
- **Import statements**: Prefer importing functions from other files instead of modifying them directly
- **Reuse**: Prefer to reuse existing code instead of writing from scratch
- **Code preservation**: Don't modify working components without necessity
- **Systematic sequence**: Complete one step completely before starting another
- **Design patterns**: Apply appropriate patterns for maintainability and scalability
- **Proactive testing**: Functionality code should be accompanied with proper tests

## Systematic Code Protocol

### Step 1: Analyze Code

**Dependency Analysis:**
- Which components will be affected?
- What dependencies exist?
- Is this local or does it affect core logic?
- What cascading effects will this change have?

**Flow Analysis:**
- Conduct complete end-to-end flow analysis from entry point to execution of all affected code.
- Track data and logic flow throughout all components.
- Document dependencies thoroughly.

### Step 2: Plan Code

- Outline a detailed plan including component dependencies and architectural considerations.
- Provide a proposal specifying: (1) what files/functions/lines are changed; (2) why; (3) impacted modules; (4) potential side effects; (5) trade-offs.

### Step 3: Make Changes

1. Document current state in memory files
2. Plan single logical change at a time:
   - One logical feature at a time
   - Fully resolve by accommodating changes in other parts
   - Adjust all existing dependencies
   - Ensure new code integrates with existing architecture
3. Simulation testing: simulate user interactions, dry runs, trace calls before applying
4. If simulation passes, do the actual implementation

### Step 4: Test

- Create unit tests for new functionality
- Run tests to confirm existing behavior is preserved
- Write test logic in separate files
- Think of exhaustive test plans covering edge cases

### Step 5: Loop Steps 1-4

Incorporate all changes systematically, one by one. Verify and test each.

### Step 6: Optimize

Optimize the implemented code after all changes are tested and verified.

---

After every implementation, ALWAYS do 2 things:
a. Update other possibly affected codes in `backend/` and `frontend/`
b. Update the documentation in `docs/` and `tasks/`
