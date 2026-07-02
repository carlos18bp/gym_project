---
name: git-sync
description: "Sync the current branch: inspecciona stashes existentes (marca obsoletos/viejos), detecta PRs abiertos via gh CLI y elige target de rebase PR-aware (politica: max 1 PR release, max 2 con error), luego fetch + rebase + conflict resolution. Defaults to the current repo (cwd); pass --all para iterar LOCAL_PROJECTS + toolkit."
allowed-tools: Bash
argument-hint: "[--all (opcional — itera todos los repos locales del host)]"
---

# Git Sync

Sync the current local branch with its remote counterpart. Handles dirty working trees, incoming commits, and merge conflicts. **PR-aware**: si hay un PR abierto y la rama actual no es la del PR, rebase apilado sobre la rama del PR (no contra master).

> **⚠️ How to invoke**:
> - Sin argumento: `/git-sync` → opera sobre el repo git del **directorio
>   actual (cwd)** — el repo desde el que se lanzó Claude Code. Se resuelve
>   con `git rev-parse --show-toplevel`; **NO se asume `vps-ops-toolkit`**.
>   ⚠️ **Ignorá el estado del hook `SessionStart`** (siempre reporta el
>   toolkit) para decidir el target — el target lo manda el cwd, no ese reporte.
> - Con `--all`: `/git-sync --all` → itera sobre `LOCAL_PROJECTS` del host
>   + `vps-ops-toolkit`.
>
> No acepta nombres de proyecto individuales — para operar en un repo
> específico, lanzá Claude Code desde ese repo (o `cd` a él antes de invocar).

---

## Phase 0 — Resolución de la lista de repos

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"

case "$ARGS_RAW" in
    "")
        # Repo actual — el del cwd (donde se lanzó Claude Code)
        REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
            echo "❌ ERROR: el directorio actual no es un repo git."
            echo "   Lanzá Claude Code desde el repo a sincronizar (o cd a él), o usá --all."
            exit 2
        }
        cd "$REPO_ROOT"                        # anclar el cwd al top del repo
        REPOS=("$(basename "$REPO_ROOT")")
        REPO_DIR_OVERRIDE="$REPO_ROOT"
        MODE_LABEL="default (repo actual: ${REPOS[0]} → $REPO_ROOT)"
        ;;
    "--all")
        source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
        PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
        REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
        MODE_LABEL="--all (${#REPOS[@]} repos)"
        ;;
    *)
        echo "❌ ERROR: argumento desconocido '$ARGS_RAW'."
        echo "   Válido: (vacío) → repo actual  |  --all → todos los locales."
        exit 2
        ;;
esac

if [ -n "${REPO_DIR_OVERRIDE:-}" ]; then
    # Modo default: el repo actual ya fue validado por git rev-parse
    VALID_REPOS=("${REPOS[@]}")
else
    VALID_REPOS=()
    for r in "${REPOS[@]}"; do
        if [ -d "$HOME/webapps/$r/.git" ]; then
            VALID_REPOS+=("$r")
        else
            echo "⏭️  $r — dir no existe o no es repo git (skip)"
        fi
    done
fi

echo "🔧 Modo: $MODE_LABEL — repos a procesar: ${#VALID_REPOS[@]}"
printf '   - %s\n' "${VALID_REPOS[@]}"
```

---

## Iteración sobre `VALID_REPOS`

Las Phases siguientes se ejecutan **una vez por cada repo** en
`VALID_REPOS`. Antes de empezar cada iteración, resolver `REPO_DIR` según el
modo — **las variables de Phase 0 no persisten entre bloques bash, así que el
modo default se reancla al cwd en vez de leer una variable perdida**:

**Modo default (sin `--all`)** — hay un solo repo, el del cwd:

```bash
# Reanclar SIEMPRE desde el cwd. Es robusto entre bloques bash (el cwd
# persiste y el modo default nunca sale del repo) y NO cae al fallback
# ~/webapps/ ni al toolkit si una variable se perdió.
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "❌ ERROR: el cwd dejó de ser un repo git — abortando (no asumo ~/webapps ni el toolkit)."
    exit 2
}
cd "$REPO_DIR"
echo ""
echo "═══════════════════════════════════════════════"
echo "  🎯 Repo objetivo: $REPO_DIR  ($(git -C "$REPO_DIR" branch --show-current))"
echo "═══════════════════════════════════════════════"
```

**Modo `--all`** — Claude itera `VALID_REPOS` y entra a cada repo bajo
`~/webapps/<repo>`:

```bash
REPO_DIR="$HOME/webapps/$REPO"
cd "$REPO_DIR"
echo ""
echo "═══════════════════════════════════════════════"
echo "  🎯 Repo objetivo: $REPO_DIR  ($(git -C "$REPO_DIR" branch --show-current))"
echo "═══════════════════════════════════════════════"
```

**Política de errores**: si un repo falla (conflicto, error de fetch/rebase),
reportar el error y el comando para resolverlo, marcar como FALLO en el
summary, y **continuar con el siguiente repo**. No abortar el loop.

En modo default (sin `--all`), `VALID_REPOS` contiene solo el repo actual
(resuelto desde el cwd), no hay loop real.

---

## Phase 0.3 — Verificar `gh` CLI (dependencia obligatoria)

```bash
if ! command -v gh >/dev/null 2>&1; then
    echo "❌ ERROR: gh CLI no instalada — dependencia obligatoria para PR detection."
    echo "   Instalar con:"
    echo "     sudo bash $HOME/webapps/vps-ops-toolkit/scripts/bootstrap/install-github-cli.sh --apply"
    echo "   Y luego: gh auth login"
    exit 2
fi
if ! gh auth status >/dev/null 2>&1; then
    echo "❌ ERROR: gh CLI no autenticada. Correr: gh auth login"
    exit 2
fi
echo "✅ gh CLI $(gh --version | head -1 | awk '{print $3}') — autenticado"
```

---

## Phase 0.5 — Stash inspection (visibilidad + obsoletos + viejos)

```bash
STASH_COUNT=$(git stash list | wc -l)
if [[ "$STASH_COUNT" -eq 0 ]]; then
    echo "✅ Phase 0.5 — Sin stashes existentes"
else
    echo "🔍 Phase 0.5 — ${STASH_COUNT} stash(es):"
    for i in $(seq 0 $((STASH_COUNT - 1))); do
        STASH_REF="stash@{$i}"
        STASH_MSG=$(git stash list --format='%gs' | sed -n "$((i+1))p")
        STASH_REL=$(git log -1 --format='%cr' "$STASH_REF" 2>/dev/null || echo "?")
        STASH_EPOCH=$(git log -1 --format='%ct' "$STASH_REF" 2>/dev/null || echo 0)
        AGE_DAYS=$(( ($(date +%s) - STASH_EPOCH) / 86400 ))
        echo "  ${STASH_REF}: ${STASH_MSG} (${STASH_REL})"
        if [[ "$AGE_DAYS" -gt 30 ]]; then
            echo "    ⚠️  VIEJO — ${AGE_DAYS} dias, considerar drop: git stash drop ${STASH_REF}"
        fi
        if ! git stash apply --check "$STASH_REF" >/dev/null 2>&1; then
            echo "    ⚠️  OBSOLETO probable — apply --check falla, considerar drop: git stash drop ${STASH_REF}"
        fi
    done
fi
```

**Regla:** la skill **nunca** ejecuta `git stash drop`. Solo sugiere comandos exactos para que el operador apruebe manualmente.

---

## Phase 1 — Inspect current state

Run these commands to understand the current situation:

```bash
git status
git branch -vv
git log --oneline -5
```

**Rules:**
- If `git status` shows uncommitted changes: **warn the user** and offer to stash first with `git stash`, then `git stash pop` after syncing. Do not proceed without their confirmation.
- Show the current branch name and its remote tracking branch (`origin/<branch>`).
- If there is no upstream tracking branch set, run: `git branch --set-upstream-to=origin/<branch> <branch>` before continuing.

---

## Phase 2 — Fetch + parent + PR-aware rebase target

```bash
git fetch origin
```

Detect parent default (master/main) and **resolve `TARGET` PR-aware**:

```bash
PARENT=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
if [[ -z "$PARENT" ]]; then
    git show-ref --verify --quiet refs/remotes/origin/main && PARENT=main
    [[ -z "$PARENT" ]] && git show-ref --verify --quiet refs/remotes/origin/master && PARENT=master
    [[ -z "$PARENT" ]] && { echo "❌ no parent branch"; exit 2; }
fi
CURRENT=$(git rev-parse --abbrev-ref HEAD)

PR_JSON=$(gh pr list --state open --json number,title,headRefName,baseRefName,isDraft 2>/dev/null || echo "[]")
PR_COUNT=$(echo "$PR_JSON" | jq 'length')
PR_HEADS=$(echo "$PR_JSON" | jq -r '.[].headRefName')

# Politica: max 1 PR normal, max 2 con error
[[ "$PR_COUNT" -gt 2 ]] && echo "⚠️  POLITICA: ${PR_COUNT} PRs abiertos (max 2). Revisar."

# Resolver TARGET
TARGET="origin/${PARENT}"; TARGET_REASON="default"
if [[ "$CURRENT" == "$PARENT" ]]; then
    TARGET_REASON="current ES parent (Case A)"
elif echo "$PR_HEADS" | grep -qxF "$CURRENT"; then
    TARGET_REASON="current ES rama del PR — rebase contra parent"
else
    case "$PR_COUNT" in
        0) TARGET_REASON="0 PRs abiertos" ;;
        1)
            PR_HEAD=$(echo "$PR_JSON" | jq -r '.[0].headRefName')
            PR_NUM=$(echo "$PR_JSON" | jq -r '.[0].number')
            TARGET="origin/${PR_HEAD}"
            TARGET_REASON="1 PR abierto (#${PR_NUM} ${PR_HEAD}) — rebase apilado sobre el PR"
            git fetch origin "${PR_HEAD}:refs/remotes/origin/${PR_HEAD}" 2>/dev/null || true
            ;;
        2)
            echo "🛑 2 PRs abiertos, current no coincide con ninguno. Operador decide. PRs:"
            echo "$PR_JSON" | jq -r '.[] | "  #\(.number) \(.headRefName)"'
            exit 2
            ;;
        *) TARGET_REASON=">2 PRs — fallback parent" ;;
    esac
fi

echo "🎯 Target: ${TARGET}  (${TARGET_REASON})"
git log --oneline "HEAD..${TARGET}" -- || true
```

Si no hay commits nuevos en `TARGET`, la rama está al día — saltar a Phase 5.

---

## Phase 3 — Rebase contra `TARGET`

```bash
if [[ "$CURRENT" == "$PARENT" ]]; then
    git pull --rebase origin "$PARENT"   # Case A
else
    git rebase "$TARGET"                  # Case B
fi
```

**If the rebase completes cleanly** — skip to Phase 5.

**If the rebase stops with conflicts** — proceed to Phase 4.

---

## Phase 4 — Conflict resolution (only if rebase conflicts)

1. Run `git status` to identify all conflicted files.
2. For each conflicted file:
   - Read the file and show the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Explain what **our side** (local) contains vs what **their side** (remote) contains.
   - Resolve the conflict by editing the file to keep the correct code (remove markers).
3. Stage resolved files:
   ```bash
   git add <resolved-file>
   ```
4. Continue the rebase:
   ```bash
   git rebase --continue
   ```
5. Repeat steps 1–4 until the rebase completes.

**If the conflict is too complex to auto-resolve:** stop, show the conflict in full, and ask the user how to proceed. Never guess on conflict resolution.

---

## Phase 5 — Confirmation

Show the final state after syncing:

```bash
git log --oneline -5
git status
```

Report:
- ℹ️ Mode (default toolkit-only vs `--all`) and total repos processed
- Per repo: branch / remote synced / commits pulled / conflicts resolved /
  stash status / working tree
- ⚠️ If any repo finished with conflicts pending: command exact to abort
  (`cd ~/webapps/<repo> && git rebase --abort`) or to resume
  (`git rebase --continue`).
- Summary final con `N OK / M con warnings / K con fallo`.

---

## Safety rules

- **Never** run `git reset --hard` or `git push --force` without explicit user confirmation.
- **Never** resolve a conflict by blindly keeping one side — always inspect both sides.
- **Never** commit during this workflow — this skill only syncs, not commits.
- If in doubt about a conflict, stop and ask the user.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/git-sync`:

```markdown
🟢 git-sync OK — <repo> @ <SHA>
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| gh CLI + auth | ✅ | gh <version>, autenticado |
| Phase 0.5 — Stash inspection | ✅ | 0 stashes existentes |
| Phase 1 — Inspect | ✅ | working tree clean |
| Phase 2 — Parent + PR target | ✅ | <N> PRs abiertos → target=<TARGET> |
| Phase 3 — Fetch | ✅ | <N> commits nuevos |
| Phase 4 — Own remote sync | ⏭️ | current es parent (n/a) o sin upstream |
| Phase 5 — Rebase | ✅ | fast-forward o N commits rebased |
| Phase 6 — Conflictos | ⏭️ | sin conflictos |
| Phase 7 — Estado final | ✅ | branch up to date con TARGET |
```

Casos con acción pendiente (omitir línea ✨, agregar `## Next steps`):

- **Stashes obsoletos/viejos detectados** (⚠️ en Phase 0.5):
  ```markdown
  ## Next steps
  - `git stash drop stash@{0}` — OBSOLETO (apply --check falla)
  - `git stash drop stash@{1}` — VIEJO (>30 días, mensaje: <msg>)
  ```

- **>2 PRs abiertos** (⚠️ en Phase 2 PR target):
  ```markdown
  ## Next steps
  - (operador) revisar PRs abiertos: #X, #Y, #Z. Política del fleet: máx 2.
  ```

- **2 PRs abiertos y current branch no coincide** (❌ Phase 2 — exit):
  ```markdown
  ## Next steps
  - `git checkout <rama-PR-objetivo>` — decidir contra cuál PR rebasear y re-invocar.
  ```

- **Conflictos durante rebase** (❌ Phase 6):
  ```markdown
  ## Next steps
  - (manual, operador) Resolver conflictos en: <archivos>
  - `git add <archivos resueltos> && git rebase --continue`
  - O abortar: `git rebase --abort`
  ```

En modo `--all` (loop sobre repos), el reporte agrega columna `Repo` antes
de `Dimensión` y se considera tabla grande (>15 filas) — agregar
`### Resumen ejecutivo` con conteo y `### Top 3 acciones prioritarias`.
