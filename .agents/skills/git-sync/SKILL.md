---
name: "git-sync"
description: "Sync the current branch: inspecciona stashes existentes (marca obsoletos/viejos), detecta PRs abiertos vía gh CLI y elige target PR-aware (protocolo por sesión: una rama pusheada con PR se sincroniza sólo contra su propio upstream — la base movida se absorbe con merge, nunca rebase; N PRs de sesión son estado normal), luego fetch + rebase + conflict resolution. Dos ejes ortogonales combinables: --all-repos (todos los repos de ESTE host) y --all-vps (el toolkit en TODOS los VPS). Sin flags: el repo del cwd. --all quedó retirado (error) por ambiguo."
---

# Git Sync

Rebase the current branch onto its parent (`main` / `master`) so it picks up work that teammates have merged. Also pulls the current branch's own remote first, handles dirty working trees, and walks through any rebase conflicts.

> **⚠️ How to invoke** — dos ejes **ortogonales y combinables**: *qué repos* y
> *en qué hosts*.
>
> | Invocación | Repos | Hosts |
> |---|---|---|
> | `$git-sync` | el repo del cwd | este host |
> | `$git-sync --all-repos` | `LOCAL_PROJECTS` + toolkit | este host |
> | `$git-sync --all-vps` | **sólo `vps-ops-toolkit`** | todos los VPS |
> | `$git-sync --all-repos --all-vps` | toolkit + `LOCAL_PROJECTS` de cada host | todos los VPS |
>
> - **Sin argumento**: opera sobre el repo git del **cwd** — el repo desde el que
>   se lanzó Claude Code. Se resuelve con `git rev-parse --show-toplevel`; **NO se
>   asume `vps-ops-toolkit`**. ⚠️ **Ignorá el estado del hook `SessionStart`**
>   (siempre reporta el toolkit) para decidir el target — lo manda el cwd.
> - **`--all-repos`**: en un VPS son los proyectos cuyo `server:` matchea el
>   hostname; en dev, todos los `status: active`.
> - **`--all-vps`** solo, en cada VPS remoto opera sobre `vps-ops-toolkit`: es el
>   único repo con el mismo path en todos los hosts.
> - **`--all` quedó retirado** (error con guía): era ambiguo entre los dos ejes.
>
> No acepta nombres de proyecto individuales — para operar en un repo
> específico, lanzá Claude Code desde ese repo (o `cd` a él antes de invocar).

> **⚠️ Qué reciben los hosts REMOTOS (`--all-vps`)**: el **core no-interactivo**
> (`git fetch` + `git rebase --autostash`), **sin** stash inspection, **sin**
> retargeting PR-aware y **sin** resolución de conflictos — nada de eso se hace a
> ciegas en un host remoto. Un conflicto ⇒ `git rebase --abort` + reporte, working
> tree intacto; resolvelo con una sesión en ese host.
>
> Target del rebase remoto: el **toolkit** va contra `origin/master` (siempre vive
> en master); un **repo de proyecto** va contra **su propio upstream (`@{u}`)**,
> nunca cross-branch — hay clones legítimamente parados en ramas de release
> (p.ej. `projectapp` en `feat/…` y `gym_project_staging` en `release-august-2026-c`),
> y rebasarlos sobre master los rompería.

## Cómo invocar este skill

Gating ($output-protocol §4): (1) flags explícitos → ejecutar directo, sin
menú; (2) intención clara por la sesión (p.ej. "sincronizá todo el fleet") →
proponer el comando en una línea y esperar confirmación; (3) sin argumentos /
intención difusa → UNA sola AskUserQuestion con Q1; (4) nunca dentro de un
barrido `--all-repos`/`--all-vps` ni en headless/cron — sólo en sesión
interactiva single-target.

**Q1 — Alcance** (`multiSelect: false` — los dos ejes combinados forman 4 modos excluyentes):

| label | description | preview |
|---|---|---|
| Repo actual (Recommended) | el repo del cwd contra su upstream + target PR-aware, sólo este host | `$git-sync` |
| --all-repos (este host) | LOCAL_PROJECTS + toolkit de ESTE host, flujo interactivo completo | `$git-sync --all-repos` |
| --all-vps (fleet) | sólo `vps-ops-toolkit` en TODOS los VPS; el remoto recibe el core no-interactivo (conflicto ⇒ abort + reporte, sin stash inspection ni retargeting PR-aware) | `$git-sync --all-vps` |
| Ambos ejes | toolkit + LOCAL_PROJECTS de cada host del fleet; en los remotos siempre el core no-interactivo | `$git-sync --all-repos --all-vps` |

**Qué NO se pregunta:** `--all` (retirado, error-by-design con guía) jamás se
ofrece; los drops de stash no son picker pre-run — se ofrecen post-run,
per-stash y con la evidencia OBSOLETO/VIEJO de esta corrida (ya están en
`## Acciones disponibles`).

---

## Phase 0 — Resolución de la lista de repos

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"

# Dos ejes ortogonales, combinables y en orden libre.
ALL_REPOS=0
ALL_VPS=0
for tok in $ARGS_RAW; do
    case "$tok" in
        --all-repos) ALL_REPOS=1 ;;
        --all-vps)   ALL_VPS=1 ;;
        --all)
            echo "❌ ERROR: --all es ambiguo y quedó retirado de git-sync."
            echo "   ¿Todos los repos de ESTE host?   → $git-sync --all-repos"
            echo "   ¿El toolkit en TODOS los VPS?    → $git-sync --all-vps"
            echo "   ¿Ambos ejes?                     → $git-sync --all-repos --all-vps"
            exit 2
            ;;
        *)
            echo "❌ ERROR: argumento desconocido '$tok'."
            echo "   Válidos: --all-repos (repos de este host) | --all-vps (todos los VPS). Combinables."
            exit 2
            ;;
    esac
done

if (( ALL_REPOS == 1 )); then
    source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
    PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
    REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
    MODE_LABEL="--all-repos (${#REPOS[@]} repos)"
elif (( ALL_VPS == 1 )); then
    # --all-vps solo: el repo con el mismo path en todo el fleet es el toolkit.
    cd "$OPS_ROOT"
    REPOS=("vps-ops-toolkit")
    REPO_DIR_OVERRIDE="$OPS_ROOT"
    MODE_LABEL="--all-vps (toolkit, local + fleet)"
else
    # Repo actual — el del cwd (donde se lanzó Claude Code)
    REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
        echo "❌ ERROR: el directorio actual no es un repo git."
        echo "   Lanzá Claude Code desde el repo a sincronizar (o cd a él), o usá --all-repos."
        exit 2
    }
    cd "$REPO_ROOT"                        # anclar el cwd al top del repo
    REPOS=("$(basename "$REPO_ROOT")")
    REPO_DIR_OVERRIDE="$REPO_ROOT"
    MODE_LABEL="default (repo actual: ${REPOS[0]} → $REPO_ROOT)"
fi
(( ALL_VPS == 1 )) && MODE_LABEL+=" | fleet: ON (Phase 8)"
export ALL_REPOS ALL_VPS

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
- `origin/<base-de-integración>` para una rama local sin PR (la release en
  repos que participan del flujo release)
- **vacío** para una rama pusheada con PR: sin rebase de base — Phase 4 (su
  upstream) + merge opcional de la base en Phase 5 Case C

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

**Política del operador (protocolo por sesión, 2026-08-17):** N PRs de sesión
abiertos son **estado normal** (1 sesión = 1 rama = 1 PR); el conteo total ya no
dispara warnings. Lo que sí se vigila: que haya a lo sumo **1 candidato a
release** (PR con base=default) y que los PRs de sesión no envejezcan sin drenar.

```bash
RELEASE_CANDIDATES=$(echo "$PR_JSON" | jq --arg d "$PARENT" '[.[] | select(.baseRefName==$d)] | length')
SESSION_PRS=$(echo "$PR_JSON" | jq --arg d "$PARENT" '[.[] | select(.baseRefName!=$d)] | length')
echo "Candidatos a release (base=${PARENT}): ${RELEASE_CANDIDATES}  |  PRs de sesión: ${SESSION_PRS}"

if [[ "$RELEASE_CANDIDATES" -gt 1 ]]; then
    echo "⚠️  ${RELEASE_CANDIDATES} PRs con base=${PARENT}: release ambigua. En repos con"
    echo "    release activa los PRs de sesión van con base=<release> (stacked) —"
    echo "    re-basar los mal abiertos: gh pr edit <n> --base <release>."
fi
# PRs de sesión >48h sin actividad = deuda de drenaje (sugerir $merge-queue)
echo "$PR_JSON" | jq -r --arg d "$PARENT" \
  '.[] | select(.baseRefName!=$d) | select((now - (.updatedAt|fromdateiso8601)) > 172800) | "⚠️  PR de sesión frío (>48h): #\(.number) \(.headRefName) — drenar con $merge-queue"'
```

### Sub-fase 2c — Resolver `TARGET` del rebase

Regla del protocolo por sesión: **una rama pusheada con PR jamás se rebasea
sobre su base** (el force push está denegado en el fleet — el rebase la dejaría
imposible de pushear). Su sync es contra su **propio upstream** (Phase 4), y una
base movida se absorbe con **merge** (Phase 5, Case C). El "rebase apilado sobre
el PR abierto" del protocolo viejo (todas las sesiones sobre una rama) quedó
retirado: parado en `main`/`master` ya no se adopta la rama de ningún PR.

```bash
# Lista de heads de PRs abiertos (las ramas en review)
PR_HEADS=$(echo "$PR_JSON" | jq -r '.[].headRefName' 2>/dev/null || true)

# Base de integración del repo: default, o la RELEASE si el repo participa del
# flujo release (resolver del toolkit; pr_state=single → resolved_branch).
# OJO worktrees: el nombre del proyecto sale del git-common-dir (el clon
# principal), no del toplevel — en un worktree el toplevel es ~/.../.wt/<slug>.
BASE_INT="${PARENT}"
OPS=~/webapps/vps-ops-toolkit
RESOLVER="$OPS/scripts/maintenance/resolve-work-coordinate.sh"
PROJ=$(basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")")
if [[ -x "$RESOLVER" ]]; then
    RB=$(bash "$RESOLVER" --check "$PROJ" 2>/dev/null | awk -F= '$1=="pr_state"{ps=$2} $1=="resolved_branch"{rb=$2} END{if(ps=="single") print rb}')
    [[ -n "$RB" ]] && BASE_INT="$RB"
fi

TARGET="origin/${PARENT}"
TARGET_REASON="default (parent branch)"

if [[ "$CURRENT_BRANCH" == "$PARENT" ]]; then
    # Case A — parado en el parent: pull --rebase clásico.
    TARGET="origin/${PARENT}"
    TARGET_REASON="current branch ES el parent (Case A)"

elif echo "$PR_HEADS" | grep -qxF "$CURRENT_BRANCH"; then
    # Case C — rama pusheada con PR (de sesión o release): SIN rebase de base.
    TARGET=""
    PR_BASE=$(echo "$PR_JSON" | jq -r --arg h "$CURRENT_BRANCH" '[.[] | select(.headRefName==$h)][0].baseRefName')
    TARGET_REASON="rama pusheada con PR (base=${PR_BASE}) — sync sólo contra su upstream; base movida se absorbe con merge, nunca rebase"

else
    # Rama local sin PR (aún no pusheada): rebase contra su base de integración
    # (la release en repos participantes, el parent en prod-directos).
    TARGET="origin/${BASE_INT}"
    TARGET_REASON="rama local sin PR — rebase contra su base de integración (${BASE_INT})"
fi

echo "🎯 Rebase target: ${TARGET:-<ninguno — Case C>}"
echo "   Razón: ${TARGET_REASON}"

# Asegurar que TARGET existe localmente como ref (si hay TARGET).
if [[ -n "$TARGET" ]]; then
    TARGET_BRANCH="${TARGET#origin/}"
    if ! git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
        git fetch origin "${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}" || {
            echo "❌ No se pudo fetch ${TARGET_BRANCH}"
            exit 2
        }
    fi
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

## Phase 5 — Rebase (o merge) against the resolved `TARGET`

Usa las variables de Phase 2: `TARGET` (default `origin/<parent>`, o la base de
integración para ramas locales sin PR, o **vacío** para ramas pusheadas con PR).

**Case A — current branch IS the parent (`main`/`master`):**

```bash
git pull --rebase origin "${PARENT}"
```

Then skip to Phase 7. (En este caso `TARGET == origin/${PARENT}` siempre.)

**Case B — rama local SIN PR (aún no pusheada):**

Preview qué tiene `TARGET` que current no tiene:

```bash
git log --oneline "HEAD..${TARGET}" --
```

- If empty: already up to date with `TARGET` — skip to Phase 7.
- If there are commits: rebase onto `TARGET`:
  ```bash
  git rebase "${TARGET}"
  ```

If the rebase stops with conflicts → Phase 6.

**Case C — rama pusheada con PR (`TARGET` vacío):**

El sync real ya ocurrió en Phase 4 (su propio upstream). Acá sólo se decide si
hace falta **absorber la base** (la base del PR — `${PR_BASE}` de Phase 2c — se
movió por merges de otras sesiones):

```bash
git fetch origin "${PR_BASE}" --quiet
BEHIND_BASE=$(git rev-list --count "HEAD..origin/${PR_BASE}" -- 2>/dev/null || echo 0)
echo "Commits de la base (${PR_BASE}) que esta rama no tiene: ${BEHIND_BASE}"
```

- `BEHIND_BASE == 0` → nada que absorber — skip to Phase 7.
- `BEHIND_BASE > 0` → **merge, nunca rebase** (la rama ya está pusheada y el
  force push está denegado en el fleet):
  ```bash
  git merge --no-edit "origin/${PR_BASE}"
  ```
  Conflictos → Phase 6 (resolverlos acá es exactamente "ir resolviendo a medida
  que las otras ramas avanzan"; el squash final del PR se come el merge commit).
  Absorber la base es **opcional** si no hay solapamiento con lo mergeado — ante
  la duda, absorbela: mejor conflicto chico hoy que grande en el drenaje.

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

---

## Phase 8 — Fleet (`--all-vps`)

**Skip esta fase** si `ALL_VPS=0`. Corre **después** de que el/los repo(s)
local(es) quedaron sincronizados (Phases 1-7): así el fleet se alinea contra un
local ya sano.

Delega en el orquestador multi-host, que conecta por Tailscale y corre el core
no-interactivo en cada VPS remoto (+ la dev si está online):

```bash
REPOS_FLAG="--repos=toolkit"
(( ALL_REPOS == 1 )) && REPOS_FLAG="--repos=all"

bash "$OPS_ROOT/scripts/maintenance/propagate-toolkit-commit.sh" --check "$REPOS_FLAG"   # dry-run: behind por host/repo
bash "$OPS_ROOT/scripts/maintenance/propagate-toolkit-commit.sh" --apply "$REPOS_FLAG"
```

**Sentinel `exit 75` = pausa de auth de Tailscale**, NO es un fallo: el script
imprime el link de login. Mostráselo al operador tal cual, esperá a que autorice
(una sola autorización habilita todos los VPS) y **re-corré el mismo comando** —
es idempotente.

**Precondición**: para que el fleet reciba tus commits, el local debe estar
**pusheado**. Si `git status -sb` muestra `ahead`, avisá: los hosts remotos se
rebasan contra el remoto, no contra tu working copy.

Resultados por host: `SYNCED` · `CONFLICT_NEEDS_MANUAL_SYNC` (working tree intacto;
resolver con una sesión en ese host) · `UNREACHABLE`. Por repo de proyecto:
`REPO_SYNCED` · `REPO_CONFLICT` · `REPO_SKIP` (sin upstream/clon) · `REPO_FAIL`.

---

## Safety rules

- **Never** run `git reset --hard` or `git push --force` without explicit user confirmation.
- **Never** resolve a conflict by blindly keeping one side — always inspect both sides.
- **Never** commit during this workflow — this skill only syncs, not commits.
- **Never** ejecutar `git stash drop` automáticamente. Solo sugerir en Next steps.
- If the parent branch cannot be detected, stop and ask the user.
- If in doubt about a conflict, stop and ask the user.
- **Política de PRs (protocolo por sesión):** N PRs de sesión abiertos son
  estado normal. Warnings sólo por: >1 candidato a release (base=default) o
  PRs de sesión fríos (>48h) sin drenar. Nunca bloquear el sync por conteo.
- **Nunca** rebasear una rama pusheada con PR sobre su base — la base se
  absorbe con `git merge origin/<base>` (Case C).

---

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de $output-protocol §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| --all-repos (este host) | rebasa LOCAL_PROJECTS + toolkit de ESTE host | `$git-sync --all-repos` |
| --all-vps (toolkit en el fleet) | core no-interactivo en cada VPS vía Tailscale; conflicto ⇒ abort + reporte | `$git-sync --all-vps` |
| Ambos ejes | toolkit + LOCAL_PROJECTS de cada host del fleet | `$git-sync --all-repos --all-vps` |
| Drop de stash OBSOLETO/VIEJO | SÓLO los que ESTE run clasificó así, uno por uno y con su evidencia | `git stash drop stash@{N}` |

Blocklist ($output-protocol §4): nunca ofrecer drops masivos de stashes ni
`git reset --hard` — el drop es per-stash, sólo con la clasificación
OBSOLETO/VIEJO de esta corrida como evidencia visible.

## Output final

Reportar siguiendo $output-protocol. Plantilla específica de `$git-sync`:

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

- **>1 candidato a release** (⚠️ en Phase 2 PR target):
  ```markdown
  ## Next steps
  - (operador) release ambigua: PRs con base=<default>: #X, #Y. Re-basar los de
    sesión mal abiertos: `gh pr edit <n> --base <release>`.
  ```

- **PRs de sesión fríos (>48h)** (⚠️ en Phase 2 PR target):
  ```markdown
  ## Next steps
  - `$merge-queue` — drenar los PRs de sesión pendientes: #X (<rama>), #Y (<rama>).
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
