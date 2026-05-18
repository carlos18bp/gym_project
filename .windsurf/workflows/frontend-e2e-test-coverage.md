---
description: E2E test coverage strategy — identify all untested user flows and implement Playwright tests, focusing on the contract between Frontend and Backend
auto_execution_mode: 2
---

# E2E Test Coverage Strategy

Review E2E coverage and identify all untested user flows. Reach **100% flow coverage** focusing on the **contract between Frontend and Backend**.

## Core principle: real user interactions

Every test must exercise the full UI flow — from the user's perspective — without shortcuts.

| Real user interaction | NOT a real user interaction |
|---|---|
| Clicking buttons, links, menus | Calling backend API directly |
| Filling and submitting forms | Setting store values programmatically |
| Navigating between pages via UI | Using `page.goto()` to skip steps |
| Uploading files through inputs | Injecting data into DB directly |

## Reference docs

- `docs/USER_FLOW_MAP.md` — flow inventory
- `docs/TESTING_QUALITY_STANDARDS.md` — quality rules
- `e2e/flow-definitions.json` — canonical flow registry
- `e2e-results/flow-coverage.json` — current coverage state

## Execution rules

- Run only modified test files: `npx playwright test e2e/path/to/spec.spec.ts`
- Use `E2E_REUSE_SERVER=1` when dev server is running
- **Max 20 tests per batch, 3 commands per cycle**

## Coverage prioritization

| Priority | Criteria |
|---|---|
| 1 | Core user journeys (auth, checkout) |
| 2 | Critical CRUD flows (documents, dashboard) |
| 3 | Integration points (API contracts) |
| 4 | Error states |
| 5 | Edge cases |

## Per-test checklist

- Test has `@flow:<flow-id>` tag matching `flow-definitions.json`
- Selectors: `getByRole` > `getByTestId` > `locator`
- No `page.waitForTimeout()` — use condition-based waits
- No hardcoded test data — use fixtures
- Assertions verify user-observable outcomes
- Test simulates real user interaction through UI

## Workflow

1. Read `e2e/flow-definitions.json` and `e2e-results/flow-coverage.json`
2. Identify untested/partial flows by priority
3. Look up target flow in `docs/USER_FLOW_MAP.md`
4. Implement tests respecting quality standards
5. Run only new/modified tests
6. Validate quality: `python scripts/test_quality_gate.py --files e2e/path/to/spec.spec.ts`
7. Regenerate coverage: `node frontend/scripts/generate-coverage.js`

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/frontend-e2e-test-coverage`:

```markdown
🟢 frontend-e2e-test-coverage OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Flow inventory leído | ✅ | flow-definitions.json + flow-coverage.json |
| Flows priorizados | ✅ | P1/P2 first, contract FE↔BE, errores, edge |
| Tests agregados | ✅ | N specs con @flow:<id>, batch ≤20, ciclos ≤3 |
| Real-user only | ✅ | getByRole, sin page.goto shortcut, sin API direct |
| Quality gate | ✅ | test_quality_gate.py pasa en archivos tocados |
| Coverage delta | ✅ | flow-coverage.json regenerado, gaps cerrados |
```

Si quedan flows sin cobertura o algún test falla con el quality gate, reemplazar el ✅ correspondiente por ⚠️ o ❌, omitir la línea ✨ y agregar `## Next steps` con el flow-id pendiente y el spec a crear.
