---
description: Agentic debug mode — diagnose and analyze bugs without modifying code
auto_execution_mode: 2
---

# Debug Mode

Act as an expert debugger. Your job is to **analyze and diagnose only**. Follow these phases sequentially. Do not skip phases. Do not guess — gather evidence first.

> **⛔ STRICT RULE — READ-ONLY WORKFLOW**
> You must **NEVER** modify, edit, create, or delete any file during this workflow.
> You may: search code, read files, run read-only terminal commands (`git log`, `git diff`, `grep`).
> You must NOT: write code, apply fixes, run tests, create files, or make any changes to the codebase.
> Your deliverable is a **diagnosis + recommended fix** — the user decides when and how to apply it.

---

## Phase 1 — Error Capture & Context Gathering

1. If the user provided an error message or stack trace, read it carefully. If not, **ask for it** before proceeding. Request:
   - The full error message or unexpected behavior description.
   - The complete stack trace (if applicable).
   - The file and line where it occurs.
   - What changed recently before the error appeared.

2. Read the failing file and its direct dependencies (imports, called functions, referenced modules):
   - Use `code_search` or `grep_search` to locate the relevant code paths.
   - Use `read_file` to read the failing file and every file referenced in the stack trace.
   - Read upstream callers and downstream callees to understand the full execution flow.

3. Check recent changes that may have introduced the bug:
```bash
git log --oneline -10
```
```bash
git diff HEAD~3 --stat
```
If a specific file is suspect, inspect its recent diff:
```bash
git log --oneline -5 -- path/to/suspect/file
```

4. If the project maintains an error documentation or known-issues file, check it for previously resolved similar issues.

---

## Phase 2 — Root Cause Analysis

Analyze the error using structured reasoning. You **must** present findings in this exact format:

### OBSERVATIONS
- What the error message says literally.
- Where it occurs (file, line, function).
- What the data/state looks like at the point of failure.
- Any patterns in the stack trace (repeated frames, async boundaries, middleware layers).

### HYPOTHESIS
- The most likely root cause, stated as a single sentence.
- If multiple causes are possible, rank them by probability (most likely first) and explain why each is or isn't likely.

### EVIDENCE
- Specific code lines (with file path and line numbers) that confirm the hypothesis.
- Variable states, data flow, or execution paths that lead to the failure.
- If applicable, the specific git commit or diff that introduced the bug.

**Rules for this phase:**
- If you are **not confident** in the hypothesis, do NOT proceed to Phase 3. Go back to Phase 1 and gather more context. Suggest where the user could add strategic logging to collect more data.
- Always identify the **root cause**, not symptoms. Think upstream, not downstream.
- Consider all categories: wrong logic, stale state, race condition, missing validation, incorrect data shape assumption, dependency version mismatch, environment difference, configuration error, unhandled edge case.

---

## Phase 3 — Recommended Fix

Present the recommended fix **without applying it**. Structure as:

### 3.1 Root Cause Summary
One paragraph explaining why the bug exists — what assumption was wrong, what state was unexpected, or what path was unhandled.

### 3.2 Proposed Change
Describe the minimal change needed. Show **before/after** code snippets with exact file paths and line numbers so the user can apply them directly:

```
File: path/to/file.ext (lines X–Y)

// BEFORE
<current code>

// AFTER
<recommended code>
```

If the fix involves multiple files, show each one separately.

### 3.3 Why This Works
Explain why this change addresses the root cause, not just the symptom. Connect it back to the evidence from Phase 2.

### 3.4 Risk Assessment
- Side effects or areas that could be affected by this change.
- Edge cases the user should manually verify.
- Whether this change could break other functionality.

### 3.5 Prevention
How to avoid this class of bug in the future (e.g., type guard, input validation, lint rule, test coverage, architectural pattern).

> **Reminder: do NOT apply the fix.** The user will apply it in Code mode or manually.

---

## Phase 4 — Verification Plan

Give the user a concrete plan to verify the fix **after they apply it**:

1. **Reproduce** — The exact steps or command to trigger the original bug (so they can confirm it exists before patching).
2. **Validate** — The specific test(s) or command(s) to run after applying the fix to confirm it works.
3. **Regression** — Which related tests, modules, or flows should be checked for unintended side effects.

---

## Iteration Protocol

If the user reports the recommended fix did not work or introduced a new error:

1. Read the new error output carefully.
2. Return to **Phase 2** with the additional context — do not repeat Phase 1 unless new files need to be read.
3. Recommend **reverting** the failed fix before trying a different approach. Never recommend stacking workarounds.
4. After **2 failed recommendations**, pause and explicitly ask the user for:
   - Runtime logs or terminal output.
   - The exact state of the code after their changes.
   - Any additional context they haven't shared yet.
