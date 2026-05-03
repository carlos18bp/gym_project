---
name: implement
description: "Implement a Azurita feature or fix using the repo's existing architecture and minimal targeted verification. Use when the user asks to build, code, or fix something."
argument-hint: "[feature, refactor, bugfix, or concrete implementation request]"
---

# Implement Workflow

## Before Editing
- Read the relevant scope instructions and touched code.
- Read only the memory files that materially affect the change.
- Identify the smallest useful verification commands before changing code.

## Azurita Rules
- Backend DRF views stay function-based unless the user explicitly asks otherwise.
- Keep business logic out of views when a service, serializer, helper, or model method is the better fit.
- Frontend stores use Pinia Options API.
- Keep content/admin requests on `stores/services/request_http.js`.
- Keep platform/auth requests on `usePlatformApi.js`.
- Preserve existing public response shapes unless the task explicitly changes them.

## Implementation Sequence
1. Confirm the affected files, contracts, and side effects.
2. Make the smallest coherent change that solves the request.
3. Update tests or add focused coverage for the changed behavior.
4. Run only the smallest relevant verification slice.
5. Update docs or memory files only if the user asked for it or the change materially alters runtime guidance, architecture, or workflows.

## Output Contract
When done, report:
- what changed
- why the change fits existing project patterns
- what verification ran
- what could not be verified
