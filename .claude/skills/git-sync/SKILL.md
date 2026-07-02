---
name: git-sync
description: "Sync the current branch: inspecciona stashes existentes (marca obsoletos/viejos), detecta PRs abiertos vía gh CLI y elige target de rebase PR-aware (política: máx 1 PR release, máx 2 con error), luego fetch + rebase + conflict resolution. Defaults to the current repo (cwd); pass --all para iterar LOCAL_PROJECTS + toolkit."
allowed-tools: Bash
argument-hint: "[--all (opcional — itera todos los repos locales del host)]"
---

# Git Sync

Rebase the current branch onto its parent (`main` / `master`) so it picks up work that teammates have merged. Also pulls the current branch's own remote first, handles dirty working trees, and walks through any rebase conflicts.

> **⚠️ How to invoke**:
> - Sin argumento: `/git-sync` → opera sobre el repo git del **directorio
>   actual (cwd)** — el repo desde el que se lanzó Claude Code. Se resuelve
>   con `git rev-parse --show-toplevel`; **NO se asume `vps-ops-toolkit`**.
>   ⚠️ **Ignorá el estado del hook `SessionStart`** (siempre reporta el
>   toolkit) para decidir el target — el target lo manda el cwd, no ese reporte.
> - Con `--all`: `/git-sync --all` → itera sobre `LOCAL_PROJECTS` del host
>   + `vps-ops-toolkit`. En un VPS reporta solo los proyectos cuyo `server:`
>   matchea el hostname; en dev, todos los `status: active`.
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

Las Phases 1-7 siguientes se ejecutan **una vez por cada repo** en
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

**Política de errores**: si una iteración termina en conflicto, error de
fetch o de rebase, reportar el error con el comando exacto para resolverlo
(`cd $REPO_DIR && git rebase --abort` o similar), marcar el repo como FALLO
en el summary final, y **continuar con el siguiente repo**. No abortar el
loop completo. Si un rebase queda a medio resolver, registrar el repo como
"⚠️ con conflictos pendientes" y notificar al operador al cierre.

En modo default (sin `--all`), `VALID_REPOS` contiene solo el repo
actual (resuelto desde el cwd) y no hay loop real — las phases corren una vez.

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
    echo "❌ ERROR: gh CLI no autenticada."
    echo "   Correr: gh auth login"
    echo "   Selección recomendada: GitHub.com → HTTPS → Login with web browser."
    exit 2
fi

GH_VERSION="$(gh --version 2>/dev/null | head -1 | awk '{print $3}')"
echo "✅ gh CLI ${GH_VERSION} — autenticado"
```

---

## Phase 0.5 — Stash inspection (visibilidad + obsoletos + viejos)

Antes de tocar el working tree, listar y clasificar los stashes existentes.
El operador debe saber qué hay acumulado **antes** de que la skill cree su
propio stash en Phase 1.

```bash
STASH_COUNT=$(git stash list | wc -l)

if [[ "$STASH_COUNT" -eq 0 ]]; then
    echo "✅ Phase 0.5 — Sin stashes existentes"
else
    echo "🔍 Phase 0.5 — ${STASH_COUNT} stash(es) existente(s):"
    echo ""

    OBSOLETE_STASHES=()
    OLD_STASHES=()

    for i in $(seq 0 $((STASH_COUNT - 1))); do
        STASH_REF="stash@{$i}"
        STASH_MSG=$(git stash list --format='%gs' | sed -n "$((i+1))p")
        STASH_DATE=$(git log -1 --format='%ci' "$STASH_REF" 2>/dev/null || echo "?")
        STASH_REL=$(git log -1 --format='%cr' "$STASH_REF" 2>/dev/null || echo "?")
        STASH_FILES=$(git stash show --stat "$STASH_REF" 2>/dev/null | tail -1 || true)

        echo "  ${STASH_REF}: ${STASH_MSG}"
        echo "    Fecha: ${STASH_DATE} (${STASH_REL})"
        echo "    Archivos: ${STASH_FILES:-(sin diff disponible)}"

        # Heurística — stash viejo (>30 días)
        STASH_EPOCH=$(git log -1 --format='%ct' "$STASH_REF" 2>/dev/null || echo 0)
        NOW_EPOCH=$(date +%s)
        AGE_DAYS=$(( (NOW_EPOCH - STASH_EPOCH) / 86400 ))
        if [[ "$AGE_DAYS" -gt 30 ]]; then
            echo "    ⚠️  VIEJO — ${AGE_DAYS} días, considerar drop"
            OLD_STASHES+=("$STASH_REF")
        fi

        # Heurística — stash obsoleto (cambios ya aplicados upstream)
        # `git stash apply --check` exit !=0 cuando todos los hunks chocarían
        # con el árbol actual — fuerte indicio de que el contenido ya vive
        # en commits.
        if ! git stash apply --check "$STASH_REF" >/dev/null 2>&1; then
            echo "    ⚠️  OBSOLETO probable — apply --check falla (cambios ya commiteados?)"
            OBSOLETE_STASHES+=("$STASH_REF")
        fi

        echo ""
    done

    # Reportar candidatos a drop al cierre de la fase
    if [[ "${#OBSOLETE_STASHES[@]}" -gt 0 || "${#OLD_STASHES[@]}" -gt 0 ]]; then
        echo "📋 Candidatos a drop (revisar antes de ejecutar):"
        for s in "${OBSOLETE_STASHES[@]}"; do
            echo "    git stash drop ${s}    # OBSOLETO"
        done
        for s in "${OLD_STASHES[@]}"; do
            echo "    git stash drop ${s}    # VIEJO (>30d)"
        done
        echo ""
        echo "    NO se borran automáticamente — copy-paste manual cuando el operador apruebe."
    fi
fi
```

**Reglas:**
- La skill **nunca** ejecuta `git stash drop` por su cuenta — solo sugiere.
- Estados posibles en el Output final:
  - ✅ — sin stashes o todos legítimos (no obsoletos, no >30d)
  - ⚠️ — N candidatos a drop reportados en `## Next steps`
  - ❌ — error leyendo stashes (raro)

---

## Phase 1 — Inspect current state

```bash
git status
git branch -vv
git log --oneline -5
```

**Rules:**
- If `git status` shows uncommitted changes: **warn the user** and offer to stash first with `git stash`, then `git stash pop` after syncing. Do not proceed without their confirmation.
- Note the current branch name and its upstream (if any).

---

## Phase 2 — Detect parent branch + resolve PR-aware rebase target

Esta fase resuelve **dos cosas**: el parent default (master/main) y el
`TARGET` real contra el que se va a rebasear, que puede ser:

- `origin/<parent>` (default, comportamiento clásico)
- `origin/<rama-del-PR>` cuando el operador apila trabajo sobre un PR abierto

### Sub-fase 2a — Parent default

```bash
PARENT=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')

# Fallbacks ordenados
if [[ -z "$PARENT" ]]; then
    if git show-ref --verify --quiet refs/remotes/origin/main; then
        PARENT=main
    elif git show-ref --verify --quiet refs/remotes/origin/master; then
        PARENT=master
    else
        echo "❌ ERROR: no se puede determinar el parent branch (no hay origin/main ni origin/master)."
        exit 2
    fi
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Parent: ${PARENT}  |  Current: ${CURRENT_BRANCH}"
```

### Sub-fase 2b — PRs abiertos (vía gh CLI)

```bash
# Listar PRs abiertos del repo actual. gh resuelve el repo desde origin.
PR_JSON=$(gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,updatedAt 2>/dev/null || echo "[]")
PR_COUNT=$(echo "$PR_JSON" | jq 'length')
echo "PRs abiertos detectados: ${PR_COUNT}"

if [[ "$PR_COUNT" -gt 0 ]]; then
    echo "$PR_JSON" | jq -r '.[] | "  #\(.number) [\(if .isDraft then "DRAFT" else "OPEN" end)] \(.headRefName) → \(.baseRefName)  — \(.title)"'
fi
```

**Política del operador** (máx 1 PR release, máx 2 con error):

```bash
if [[ "$PR_COUNT" -gt 2 ]]; then
    echo "⚠️  POLÍTICA: el repo tiene ${PR_COUNT} PRs abiertos. La regla del fleet"
    echo "    es máx 1 PR normal (próximo release) o máx 2 con error operativo."
    echo "    Revisar y mergear/cerrar antes de continuar."
fi
```

### Sub-fase 2c — Resolver `TARGET` del rebase

```bash
# Lista de heads de PRs abiertos (las ramas en review)
PR_HEADS=$(echo "$PR_JSON" | jq -r '.[].headRefName' 2>/dev/null || true)

# Default: rebase contra el parent
TARGET="origin/${PARENT}"
TARGET_REASON="default (parent branch)"

# Caso especial: master/main no cambian target — siempre rebase contra origin/parent
if [[ "$CURRENT_BRANCH" == "$PARENT" ]]; then
    TARGET="origin/${PARENT}"
    TARGET_REASON="current branch ES el parent (Case A)"

# Caso: current es la rama de UN PR abierto → rebase contra master normal
elif echo "$PR_HEADS" | grep -qxF "$CURRENT_BRANCH"; then
    TARGET="origin/${PARENT}"
    TARGET_REASON="current branch ES la rama del PR — rebase contra parent normal"

# Caso: current NO es de ningún PR
else
    case "$PR_COUNT" in
        0)
            TARGET="origin/${PARENT}"
            TARGET_REASON="0 PRs abiertos — default"
            ;;
        1)
            PR_HEAD=$(echo "$PR_JSON" | jq -r '.[0].headRefName')
            PR_NUM=$(echo "$PR_JSON" | jq -r '.[0].number')
            TARGET="origin/${PR_HEAD}"
            TARGET_REASON="1 PR abierto (#${PR_NUM} ${PR_HEAD}) — rebase apilado sobre el PR"
            echo "⚠️  Cambiando target a la rama del PR #${PR_NUM}: ${PR_HEAD}"
            echo "    Si no querés esto (preferís rebase contra ${PARENT}), abortá ahora con Ctrl-C"
            echo "    o checkout a otra rama y re-invocar."
            ;;
        2)
            echo "🛑 2 PRs abiertos y current branch no coincide con ninguno."
            echo "    No infiero contra cuál rebasear — el operador debe decidir."
            echo "    PRs abiertos:"
            echo "$PR_JSON" | jq -r '.[] | "      #\(.number) \(.headRefName)"'
            echo "    Acción del operador: checkout a la rama del PR objetivo y re-invocar."
            exit 2
            ;;
        *)
            # >2 PRs → fallback conservador a parent
            TARGET="origin/${PARENT}"
            TARGET_REASON=">2 PRs abiertos — fallback conservador al parent"
            ;;
    esac
fi

echo "🎯 Rebase target: ${TARGET}"
echo "   Razón: ${TARGET_REASON}"

# Asegurar que TARGET existe localmente como ref. Si es una rama del PR,
# necesitamos git fetch específico de esa rama.
TARGET_BRANCH="${TARGET#origin/}"
if ! git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    git fetch origin "${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}" || {
        echo "❌ No se pudo fetch ${TARGET_BRANCH}"
        exit 2
    }
fi
```

Después de esta fase quedan resueltas las variables `PARENT`, `CURRENT_BRANCH`,
`TARGET`, `TARGET_BRANCH`, `PR_COUNT`, `TARGET_REASON` — usadas en las
Phases 4, 5 y 7.

---

## Phase 3 — Fetch all remote refs

```bash
git fetch origin
```

This updates both `origin/<parent>` and `origin/<current-branch>` locally.

---

## Phase 4 — Sync the current branch with its own remote

**Skip this phase** if the current branch **is** the parent (handled in Phase 5) or if there is no upstream configured.

Otherwise, preview incoming commits from the current branch's own remote:

```bash
git log --oneline HEAD..origin/<current-branch> --
```

- If empty: nothing to pull from own remote — continue to Phase 5.
- If there are commits: pull with rebase:
  ```bash
  git pull --rebase origin <current-branch>
  ```

If this rebase stops with conflicts → Phase 6. When it finishes cleanly, continue to Phase 5.

---

## Phase 5 — Rebase against the resolved `TARGET`

Usa la variable `TARGET` resuelta en Phase 2 (default `origin/<parent>`, o
`origin/<rama-del-PR>` si hay 1 PR abierto y current branch difiere).

**Case A — current branch IS the parent (`main`/`master`):**

```bash
git pull --rebase origin "${PARENT}"
```

Then skip to Phase 7. (En este caso `TARGET == origin/${PARENT}` siempre.)

**Case B — current branch is a feature branch:**

Preview qué tiene `TARGET` que current no tiene:

```bash
git log --oneline "HEAD..${TARGET}" --
```

- If empty: already up to date with `TARGET` — skip to Phase 7.
- If there are commits: rebase onto `TARGET`:
  ```bash
  git rebase "${TARGET}"
  ```

Si la skill cambió `TARGET` a una rama de PR (caso 1 PR abierto, current
distinta), **comunicar visualmente** al operador antes de ejecutar:

```bash
echo ""
echo "🎯 Rebase: ${CURRENT_BRANCH} → onto ${TARGET}"
echo "   (${TARGET_REASON})"
echo ""
```

If the rebase stops with conflicts → Phase 6.

---

## Phase 6 — Conflict resolution (only if a rebase stops with conflicts)

1. Run `git status` to identify all conflicted files.
2. For each conflicted file:
   - Read the file and show the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Explain what **our side** (the branch being rebased) contains vs what **their side** (the incoming commit) contains.
   - Resolve the conflict by editing the file to keep the correct code (remove markers).
3. Stage resolved files:
   ```bash
   git add <resolved-file>
   ```
4. Continue the rebase:
   ```bash
   git rebase --continue
   ```
5. Repeat until the rebase completes.

**If the conflict is too complex to auto-resolve:** stop, show the conflict in full, and ask the user how to proceed. Never guess on conflict resolution.

---

## Phase 7 — Confirmation

```bash
git log --oneline -8
git status
git stash list
```

Report:
- Current branch and the rebase target used (`TARGET` + `TARGET_REASON`)
- PRs abiertos detectados (`PR_COUNT` + lista breve)
- Stashes pre-existentes (cantidad + candidatos a drop)
- Commits pulled from the current branch's own remote (if any)
- Commits brought in from `TARGET` (if any)
- Number of conflicts resolved (if any)
- Whether the skill's own stash was restored (if Phase 1 stashed)
- Current working tree status

---

## Safety rules

- **Never** run `git reset --hard` or `git push --force` without explicit user confirmation.
- **Never** resolve a conflict by blindly keeping one side — always inspect both sides.
- **Never** commit during this workflow — this skill only syncs, not commits.
- **Never** ejecutar `git stash drop` automáticamente. Solo sugerir en Next steps.
- If the parent branch cannot be detected, stop and ask the user.
- If in doubt about a conflict, stop and ask the user.
- **Política de PRs:** máx 1 PR abierto (próximo release), máx 2 con error
  operativo. Si hay >2, emitir warning destacado pero NO bloquear el sync.

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
