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

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/debug`:

```markdown
🟢 debug OK — diagnóstico completo
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Phase 1 — Error capture & context | ✅ | error reproducido, contexto leído |
| Phase 2 — Root cause analysis | ✅ | hipótesis con evidencia (archivo:línea) |
| Phase 3 — Recommended fix | ✅ | before/after + riesgo + prevención |
| Phase 4 — Verification plan | ✅ | comandos repro + validate + regresión |
```

Si el diagnóstico no alcanzó confianza alta (Phase 2 sin evidencia suficiente,
hipótesis múltiples sin ranking, etc.), reemplazar el ✅ por ⚠️ y omitir la
línea ✨; agregar `## Next steps` con el contexto adicional que necesita el
operador (logs, repro exacto, estado del código).

Cuando el operador autoriza aplicar el fix → invocar `/implement`. Esta skill
**no** aplica cambios.
