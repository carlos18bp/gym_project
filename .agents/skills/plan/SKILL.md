---
name: plan
description: "Create a decision-complete implementation plan for a Azurita change. Use when the user asks to plan, design, scope, or compare approaches before coding."
argument-hint: "[feature, refactor, bugfix, or workflow to plan]"
---

# Plan Workflow

## Goal
Produce a plan another engineer or agent can implement without making new product or architecture decisions.

## Context To Read
- Relevant scope instructions in `AGENTS.md`, `backend/AGENTS.md`, and `frontend/AGENTS.md`
- Relevant memory files in `docs/methodology/` and `tasks/`
- The specific code paths the change will touch

## Workflow
1. Inspect the repo first. Do not ask for facts that can be derived from the codebase or docs.
2. Clarify only the product or tradeoff decisions that cannot be discovered locally.
3. Map the affected data flow, APIs, state, and test surface.
4. Prefer existing Azurita conventions over generic framework patterns.
5. Call out migrations, compatibility constraints, and rollout risks when they matter.

## Output Contract
Return a compact but decision-complete plan with:
- summary
- key implementation changes
- public or internal interface changes
- test plan
- assumptions/defaults chosen

## Rules
- This is a planning workflow, not an implementation workflow.
- Do not edit repo files while using this skill.
- Do not assume memory files need updates unless the user asks or the plan itself is about methodology/runtime changes.
