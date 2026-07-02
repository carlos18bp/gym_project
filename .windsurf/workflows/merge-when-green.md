---
auto_execution_mode: 2
description: "Commit + push + merge del PR de la rama actual cuando el CI de GitHub Actions esta en verde; si falla, descubre los tests rotos del CI y corre fix-broken-tests en loop hasta el verde, y recien mergea. Opera sobre el repo del cwd; no aplica a vps-ops-toolkit (commit directo a master)."
---

> **⚠️ How to invoke**:
> - Sin argumento: `/merge-when-green` → opera sobre el repo git del **cwd**
>   (resuelto con `git rev-parse --show-toplevel`). Commitea lo pendiente,
>   asegura el PR de la rama, espera el CI, y mergea cuando está verde. Si el CI
>   falla, arregla los tests rotos en loop antes de mergear.
> - Requiere `gh` autenticado (dependencia obligatoria, igual que `git-sync`).
> - **No aplica a `vps-ops-toolkit`**: ese repo commitea directo a `master` sin
>   PR (ver "Git en este repo" en su CLAUDE.md) → la skill avisa y sugiere
>   `/git-commit`.
>
> **Defaults (seguros; override con flags):**
> - Merge con `--squash` + `--delete-branch`. (`--merge-method=merge|rebase`.)
> - Si la rama no tiene PR abierto, lo crea. (`--no-create-pr` para no crearlo.)
> - El fix loop **pausa pidiendo aprobación** si `fix-broken-tests` necesita
>   tocar código de producción. (`--autonomous` para no pausar.)
> - Un check **no-test** rojo (lint / quality-gate / design-tokens / flow-sync)
>   **frena y reporta**; no se intenta arreglar. (`--fix-nontest` para intentarlo.)
> - Máximo **5** iteraciones del fix loop. (`--max-iterations=N`.)

## Phase 0 — Preflight

```bash
ARGS_RAW="${ARGUMENTS:-}"
MERGE_METHOD="squash"; CREATE_PR=1; AUTONOMOUS=0; FIX_NONTEST=0; MAX_ITER=5
for tok in $ARGS_RAW; do
    case "$tok" in
        --merge-method=squash|--merge-method=merge|--merge-method=rebase) MERGE_METHOD="${tok#--merge-method=}" ;;
        --no-create-pr)   CREATE_PR=0 ;;
        --autonomous)     AUTONOMOUS=1 ;;
        --fix-nontest)    FIX_NONTEST=1 ;;
        --max-iterations=*) MAX_ITER="${tok#--max-iterations=}" ;;
        *) echo "❌ ERROR: argumento desconocido '$tok'."; exit 2 ;;
    esac
done

# Resolver el repo del cwd (NO asumir el toolkit; ignorar el hook SessionStart).
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "❌ ERROR: el cwd no es un repo git. Lanzá Claude Code desde el repo a mergear."
    exit 2
}
cd "$REPO_ROOT"
REPO_NAME="$(basename "$REPO_ROOT")"

# gh es dependencia obligatoria (PR detection + checks + merge).
command -v gh >/dev/null || { echo "❌ ERROR: gh CLI no instalada — obligatoria."; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "❌ ERROR: gh sin auth — corré 'gh auth login'."; exit 2; }

# El toolkit commitea directo a master, sin PR → la skill no aplica.
if [ "$REPO_NAME" = "vps-ops-toolkit" ]; then
    echo "⏭️  vps-ops-toolkit commitea directo a master (sin PR/merge). Usá /git-commit."
    exit 0
fi

DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
echo "🎯 Repo: $REPO_NAME  |  rama: $CURRENT  |  base: $DEFAULT_BRANCH  |  merge: $MERGE_METHOD"
```

**Resolver la rama de trabajo (git-branch-protocol).** Si `CURRENT` es
`main`/`master`: buscá una rama abierta para reutilizar (`gh pr list --state open
--json headRefName,url`); si hay una, `git checkout` a ella; si no hay ninguna y
tenés cambios para commitear, creá una rama nueva (`<prefijo>/<DDMMYYYY>-<desc>`,
fecha con `date +%d%m%Y`) — ver el protocolo en el `CLAUDE.md` del proyecto. **No
se mergea `main`/`master` sobre sí mismo.**

## Phase 1 — Commit + push

Reutilizá el flujo de `/git-commit` sobre la rama de trabajo:

- `git status --porcelain` vacío → no hay nada que commitear; seguí a Phase 2 (la
  rama ya debe estar pusheada).
- Con cambios → inspeccioná `git status` + `git diff`, generá un mensaje
  `FEAT/FIX/DOCS` propio, `git add` selectivo + `git commit -m "…"` + `git push`
  (con `-u origin <rama>` si no hay upstream). Mostrá cada comando antes de correrlo.
- Si el push falla → reportá y **abortá** (sin PR pusheado no hay CI que esperar).

## Phase 2 — Asegurar el PR

```bash
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
PR_JSON="$(gh pr view "$CURRENT" --json number,url,state,baseRefName 2>/dev/null || echo '')"
```

- Si existe un PR **abierto** para `CURRENT` → usalo (`number`, `url`).
- Si no existe y `CREATE_PR=1` → `gh pr create --base "$DEFAULT_BRANCH" --fill`
  (título/cuerpo desde los commits). Capturá la URL.
- Si no existe y `CREATE_PR=0` → **frená** y reportá: "rama sin PR abierto; pasá sin
  `--no-create-pr` o abrí el PR a mano".

Reportá la URL del PR (`PR URL: <url>`).

## Phase 3 — Esperar el CI

```bash
# Bloquea hasta que todos los checks resuelvan; no aborta al primer fallo.
gh pr checks "$PR_NUMBER" --watch --fail-fast=false; RC=$?
# Estado por check (nombre + conclusión) para clasificar:
gh pr checks "$PR_NUMBER" --json name,state,bucket 2>/dev/null \
  || gh pr view "$PR_NUMBER" --json statusCheckRollup \
       -q '.statusCheckRollup[] | "\(.name)\t\(.conclusion // .state)"'
```

- `RC == 0` (todos los checks en verde/`bucket=pass`) → **Phase 5 (merge)**.
- Algún check en `fail` → **Phase 4 (fix loop)**.
- Checks `pending` que nunca resuelven (timeout del `--watch`) → reportá y frená.
- Si el PR **no tiene checks** (repo sin CI en esa rama) → avisá "sin checks; no
  hay verde que esperar" y frená (no mergees a ciegas salvo que el operador lo pida).

## Phase 4 — Fix loop (máx `MAX_ITER` iteraciones)

Por cada check en `fail`, clasificalo:

- **Test jobs**: `backend-tests` (pytest), `frontend-unit-tests` (jest),
  `frontend-e2e-tests` (playwright, sharded).
- **Gates no-test**: `test-quality-gate`, `design-tokens-guard`,
  `e2e-flow-definitions-sync`, `shellcheck`, `yaml-validation`, `config-integrity`,
  y los agregadores `coverage-summary` / `e2e-merge-reports`.

**Si falla un gate no-test:**
- Con `FIX_NONTEST=0` (default) → **frená y reportá** el gate + su log
  (`gh run view <run-id> --log-failed`). No lo intentes arreglar. `## Next steps`
  con el comando local equivalente (ej. `npm run check:design-tokens:strict`).
- Con `FIX_NONTEST=1` → intentá el arreglo directo (ej. reemplazar el color-literal,
  regenerar `flow-definitions.json` con `npm run ci:e2e-flow-summary`), commiteá y
  volvé a Phase 3.

**Si fallan test jobs:**
1. Traé los logs del run fallido: `gh run view <run-id> --log-failed` (el `<run-id>`
   sale del `link` del check o de `gh run list --branch "$CURRENT" --limit 1`).
2. **Extraé los IDs concretos** de los tests fallidos de esos logs:
   - pytest → líneas `FAILED path/test_x.py::TestClase::test_y`
   - jest → nombre del `describe > it` y el archivo `.spec/.test`
   - playwright → el spec `e2e/xxx.spec.ts` + título del test
3. Invocá la skill **`/fix-broken-tests`** pasándole ESA lista (ella corre sólo esos
   tests + regresión del módulo, nunca la suite completa). Respeta sus estándares
   (`docs/TESTING_QUALITY_STANDARDS.md`).
4. **Aprobación de código de prod**: si `fix-broken-tests` reporta que tuvo que tocar
   **código de producción** (fila ⚠️ en su output), y `AUTONOMOUS=0` (default),
   **PAUSÁ**: mostrá el cambio propuesto y pedí aprobación del operador antes de
   commitear. Con `AUTONOMOUS=1`, seguí sin pausar.
5. Commiteá el arreglo (`git commit -m "fix: <test> …"`) + `git push`. Volvé a
   **Phase 3** (el CI re-corre la suite completa y confirma el verde).
6. Contá la iteración. Si superás `MAX_ITER` sin llegar a verde → frená y reportá el
   estado (qué sigue rojo, hipótesis, comando exacto para el próximo intento).

## Phase 5 — Merge

```bash
# Confirmar que el PR es realmente mergeable antes de mergear (nunca forzar).
gh pr view "$PR_NUMBER" --json mergeStateStatus,reviewDecision,mergeable \
  -q '"mergeable=\(.mergeable) state=\(.mergeStateStatus) review=\(.reviewDecision)"'
```

- Si `mergeable != MERGEABLE` o `mergeStateStatus` es `BLOCKED` (review/ruleset
  requerido, o checks no verdes) → **frená y reportá**; no fuerces el merge.
- Si está limpio → mergeá:
  ```bash
  gh pr merge "$PR_NUMBER" --"$MERGE_METHOD" --delete-branch
  ```

## Phase 6 — Post-merge

```bash
git checkout "$DEFAULT_BRANCH" && git pull --ff-only origin "$DEFAULT_BRANCH"
```

Reportá el PR mergeado + el SHA del merge en `$DEFAULT_BRANCH`.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de
`/merge-when-green`:

```markdown
🟢 merge-when-green OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Commit + push | ✅ | <sha> en la rama <rama> |
| PR | ✅ | #<n> — <url> |
| CI checks | ✅ | N/N en verde (pytest, jest, playwright, gates) |
| Fix loop | ⏭️ | no hizo falta (CI verde de una) |
| Merge | ✅ | --<method> a <base>, rama borrada |
```

Reemplazá ✅ por ⚠️/❌/⏸️ según corresponda y agregá `## Next steps`:
- Fix loop que pausó por código de prod → ⏸️ + el cambio a aprobar.
- Gate no-test rojo (sin `--fix-nontest`) → ❌ + el comando local para reproducirlo.
- Merge bloqueado por review/ruleset → ❌ + `gh pr view <n> --web` para revisar.
- Superó `MAX_ITER` sin verde → ❌ + qué test sigue rojo y el comando del próximo intento.
