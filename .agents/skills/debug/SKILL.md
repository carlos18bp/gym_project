---
name: debug
description: "Read-only diagnosis workflow for Azurita bugs, failing flows, or unexpected behavior. Use when the user asks for investigation without applying a fix yet."
argument-hint: "[error message, failing behavior, or suspected regression]"
---

# Debug Workflow

## Goal
Diagnose the issue and recommend the most likely fix without changing files.

## Rules
- Read-only workflow: do not edit, create, or delete repo files.
- Gather evidence before naming a root cause.
- Prefer exact file references, stack traces, diffs, and failing commands over speculation.

## Steps
1. Capture the error, failing behavior, repro steps, and recent changes.
2. Read the failing file and direct dependencies.
3. Check relevant history or docs such as `docs/methodology/error-documentation.md`.
4. State:
   - observations
   - ranked root-cause hypothesis
   - evidence with file references
   - recommended fix
   - verification plan

## Output Contract
Return diagnosis first. Do not apply the fix unless the user separately asks for implementation.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill (read-only: diagnostica, NO aplica el fix):

🟢 debug OK   (🟡 si la hipótesis no alcanzó confianza alta; 🔴 si no se pudo reunir evidencia)

| Dimensión | Estado | Detalle |
|---|---|---|
| Causa raíz | ✅ | identificada, con evidencia (archivo:línea) |
| Fix recomendado | ✅ | before/after propuesto — NO aplicado (read-only) |
| Riesgo de regresión | ✅ | side-effects + edge cases a verificar anotados |
| Plan de verificación | ✅ | repro + validate + tests de regresión listados |

## Next steps
- (manual, operador) aplicar el fix before/after propuesto — esta skill no modifica archivos
- tras aplicar: correr el comando de "Plan de verificación" para validar + chequear regresión
