---
name: plan
description: "Planning workflow — read context, clarify requirements, formulate solution. Use when the user asks to plan a feature, design a solution, or think through an approach before coding."
argument-hint: "[description of the feature or problem to plan]"
---

Before starting, ALWAYS do these 3 things:
a. Read the existing documentation in `docs/methodology/`: `architecture.md`, `product_requirement_docs.md`, `technical.md`
b. Read the plans and context in `tasks/`: `active_context.md`, `tasks_plan.md`
c. Get required solution context from the code files in `backend/` and `frontend/`

---

# Planning Workflow

## 1. UNDERSTAND the REQUIREMENTS

- Always ask for clarifications and follow-ups.
- Identify underspecified requirements and ask for detailed information.
- Fully understand all aspects of the problem and gather details to make it precise and clear.
- Ask about all hypotheses and assumptions. Remove all ambiguities.
- Suggest solutions the user didn't think about — anticipate needs.
- Only after having 100% clarity, proceed to SOLUTION.

## 2. FORMULATE the SOLUTION

- Have a meta architecture plan for the solution.
- Break down the problem into key concepts and smaller sub-problems.
- Think about all possible ways to solve the problem.
- Set up evaluation criteria and trade-offs to assess solutions.
- Find the optimal solution and explain the criteria making it optimal.
- Use web search if needed to research best practices or documentation.
- Reason rigorously about optimality. Question every assumption.
- Think of better solutions, combining strongest aspects of different approaches.
- Iterate and refine until a strong solution is found.

## 3. SOLUTION VALIDATION

- Provide the PLAN with as much detail as possible.
- Break down the solution step-by-step with clarity.
- Reason out its optimality vs. other promising solutions.
- Explicitly state all assumptions, choices, and decisions.
- Explain trade-offs.

### Plan Features:
- **Extendable**: Future code can easily build on the current plan.
- **Detailed**: Takes care of every affected aspect.
- **Robust**: Plans for error scenarios and failure cases with fallbacks.
- **Accurate**: Components are in sync, interfaces are correct.

---

After every planning task, ALWAYS do 2 things:
a. Document the plan in `docs/methodology/`: `architecture.md`, `product_requirement_docs.md`, `technical.md`
b. Update planning context in `tasks/`: `active_context.md`, `tasks_plan.md`
