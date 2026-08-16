---
name: merge-queue
description: "Usar cuando VARIAS ramas/PRs pendientes (trabajo de N sesiones paralelas) deben integrarse en orden: 'mergeá todo lo pendiente', 'drená las ramas', 'cerrá el trabajo de todas las sesiones', 'merge queue/train'. Censa el trabajo pendiente (PRs abiertos + ramas con remoto sin PR + local-only + gone + ya-en-base), arma la estrategia (release autorizada → batch de verdes disjuntos → tren por solapamiento → holds) y ejecuta cada merge reutilizando el flujo de merge-when-green con TODOS sus guards. Es el mecanismo de drenaje de vuelta a la convención 'máx 1 PR feature activo'. NO usar para una sola rama ([[merge-when-green]]), ni para commits sueltos ([[git-commit]]), ni para sync sin merge ([[git-sync]]), ni en cron/headless. Nunca rebasea ramas pusheadas (force push denegado en el fleet): actualiza con gh pr update-branch o mergeando la base en la rama."
allowed-tools: Bash, AskUserQuestion, ListAgents, SendMessage, TaskStop
argument-hint: "[--all-repos] [--plan-only] [--batch-only] [--include-no-pr=r1,r2] [--autonomous] [--max-iterations=N]"
---

> **⚠️ How to invoke**:
> - Sin argumento: `/merge-queue` → arma y ejecuta la cola de merges del repo git
>   del **cwd** (resuelto con `git rev-parse --show-toplevel`). Pensada para el
>   estado que N sesiones paralelas dejan atrás: varias ramas/PRs pendientes que,
>   mergeados sin orden, generan conflictos y reprocesos.
> - Con `--all-repos` (**sólo desde `vps-ops-toolkit`**): una cola por cada repo de
>   `LOCAL_PROJECTS` del host. Los repos son independientes entre sí: primero se
>   integra todo (los CI corren en paralelo), después se mergea repo por repo. El
>   toolkit NO es unidad de cola (trunk flow, sin ramas): sólo aparece al cierre,
>   para commitear en UN solo paso el `projects.yml` que los merges de release
>   hayan dejado dirty.
> - `--all` / `--all-vps` → **error duro**: no se mergea a ciegas en clones de
>   otros VPS (mismo racional que [[merge-when-green]]).
> - `--plan-only`: censo + estrategia + tabla del plan, sin ejecutar nada.
> - `--batch-only`: ejecuta sólo el batch (verdes disjuntos, server-side); el tren
>   queda planificado en Next steps.
> - `--include-no-pr=r1,r2`: incluye esas ramas sin PR en la cola sin preguntar
>   (útil para re-invocar tras un primer censo).
>
> **Qué ejecuta cada merge:** el flujo de [[merge-when-green]] (espera de CI, fix
> loop con pausa por código de producción salvo `--autonomous`, guard de
> mergeable, `gh pr merge --squash --delete-branch`, consumo de `release_merge`).
> Esta skill NO re-implementa el merge: ordena, prepara (push/PR/update
> just-in-time) y secuencia. Defaults heredados: squash, fix loop máx 5
> iteraciones (`--max-iterations=N`).
>
> **Guards siempre ON (heredados):** coordenada (`resolve-work-coordinate.sh`) —
> `wrong-host` ⇒ el repo entero se salta; una rama release se mergea SÓLO si
> `release_merge:` en projects.yml la nombra (sin autorización: se integra, se
> espera el CI y queda en hold, jamás se ofrece mergearla); tree sucio ⇒ nunca
> checkout ni stash automático; la tabla del plan SIEMPRE se muestra antes de
> ejecutar — con o sin flags, el operador puede cortar ahí (patrón C1 de
> merge-when-green).
>
> **Nunca force push:** `git push --force*` está denegado a nivel permisos del
> fleet (cubre `--force-with-lease`), así que esta skill **no rebasea ramas
> pusheadas jamás**. Una rama BEHIND se actualiza server-side
> (`gh pr update-branch`); una CONFLICTING se pone al día mergeando
> `origin/<base>` DENTRO de la rama (push fast-forward normal). Con squash como
> merge method, esos merge commits intermedios desaparecen del historial final.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → ejecutar directo, sin
menú — la tabla del plan (Phase 2) se muestra igual y el operador puede cortar;
con flags, las ramas sin PR quedan **excluidas por default** (se re-invoca con
`--include-no-pr=`); (2) intención clara en la sesión ("drená todo lo pendiente")
→ proponer el comando en una línea y esperar confirmación; (3) invocación sin
flags → censo primero y UNA sola AskUserQuestion sobre el plan (Q1+Q2 fusionadas
en una llamada); (4) nunca en cron/headless ni dentro de un barrido.

**Q1 — Ejecución del plan** (`multiSelect: false`; tras mostrar la tabla):

| label | description | preview |
|---|---|---|
| Ejecutar todo (Recommended) | release autorizada + batch + tren + holds según la tabla; CIs en paralelo, merges en orden | la cola completa de la tabla |
| Sólo el batch | mergea únicamente los PRs verdes disjuntos (server-side, minutos); el tren queda en Next steps | `/merge-queue --batch-only` |
| Sólo el plan | quedarse con el censo + estrategia, sin ejecutar | `/merge-queue --plan-only` |
| Abortar | salir sin tocar nada | — |

**Q2 — Ramas sin PR a incluir** (`multiSelect: true`; SÓLO si el censo encontró
ramas con trabajo y sin PR; va en la MISMA llamada AskUserQuestion que Q1):

- Con **≤4** ramas: una fila por rama; description = la evidencia del censo
  ("fría 3d · ahead 2 · remoto vivo" / "local-only · ahead 1 · ayer").
- Con **>4**: filas-grupo por evidencia («frías >24h con remoto (N)», «tibias
  <24h (M)», «sólo local-only (K)», «ninguna») — el detalle por rama ya está en
  la tabla del plan; nombres puntuales se tipean por "Other" o se re-invoca con
  `--include-no-pr=r1,r2`.

**Qué NO se pregunta:** el merge de una rama release — lo decide `release_merge:`
en projects.yml (blocklist §4), esta skill sólo lo refleja. `--autonomous` se
tipea (quita la pausa de aprobación del fix loop, deliberadamente incómodo). La
rama ACTUAL con tree sucio nunca se ofrece: es la firma de una sesión activa sin
terminar (advisory en la tabla). El borrado de ramas obsoletas no es parte del
run: va al menú post-run, con evidencia.

## Phase 0 — Preflight + flags + lock advisory

```bash
ARGS_RAW="${ARGUMENTS:-}"
ALL_REPOS=0; PLAN_ONLY=0; BATCH_ONLY=0; AUTONOMOUS=0; MAX_ITER=5; INCLUDE_NO_PR=""
for tok in $ARGS_RAW; do
    case "$tok" in
        --all-repos)        ALL_REPOS=1 ;;
        --plan-only)        PLAN_ONLY=1 ;;
        --batch-only)       BATCH_ONLY=1 ;;
        --autonomous)       AUTONOMOUS=1 ;;
        --max-iterations=*) MAX_ITER="${tok#--max-iterations=}" ;;
        --include-no-pr=*)  INCLUDE_NO_PR="${tok#--include-no-pr=}" ;;
        --all|--all-vps)
            echo "❌ ERROR: '$tok' no existe en merge-queue."
            echo "   ¿La cola de TODOS los repos de este host? → --all-repos (sólo desde vps-ops-toolkit)"
            echo "   No hay eje fleet: no se mergea a ciegas en clones de otros VPS."
            exit 2 ;;
        *) echo "❌ ERROR: argumento desconocido '$tok'."; exit 2 ;;
    esac
done

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "❌ ERROR: el cwd no es un repo git. Lanzá Claude Code desde el repo a drenar."
    exit 2
}
cd "$REPO_ROOT"
REPO_NAME="$(basename "$REPO_ROOT")"

# --all-repos es acción de operador del fleet: el toolkit es su punto de entrada
# (mismo guard que merge-when-green Path C).
if (( ALL_REPOS == 1 )) && [ "$REPO_NAME" != "vps-ops-toolkit" ]; then
    echo "❌ ERROR: --all-repos sólo se invoca desde vps-ops-toolkit."
    echo "   Estás en '$REPO_NAME'. Para la cola de SÓLO este repo: /merge-queue (sin flags)."
    exit 2
fi

# El toolkit no tiene cola propia (trunk flow: commit directo a master, sin ramas).
if (( ALL_REPOS == 0 )) && [ "$REPO_NAME" = "vps-ops-toolkit" ]; then
    echo "❌ El toolkit no tiene cola de ramas (trunk flow)."
    echo "   ¿La cola de los proyectos de este host? → /merge-queue --all-repos"
    echo "   ¿Integrar el toolkit en sí?             → /merge-when-green"
    exit 2
fi

# gh es obligatorio: sin PRs no hay cola.
command -v gh >/dev/null || { echo "❌ ERROR: gh CLI no instalada — obligatoria."; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "❌ ERROR: gh sin auth — corré 'gh auth login'."; exit 2; }

# Lock advisory per-repo en /tmp (a propósito: tiene que ser visible ENTRE
# sesiones de esta máquina; un scratchpad per-sesión no sirve acá). No es
# exclusión dura: protege del accidente de dos merge-queue simultáneos, no de un
# /merge-when-green suelto. TTL 30 min; cada fase re-toca el lock (los archivos
# SÍ persisten entre bloques bash, las variables no).
QDIR="/tmp/merge-queue-${REPO_NAME}"
if [ -f "$QDIR/lock" ] && [ -n "$(find "$QDIR/lock" -mmin -30 2>/dev/null)" ]; then
    echo "🚫 Lock advisory fresco: $(cat "$QDIR/lock")"
    echo "   ¿Otro /merge-queue en vuelo sobre $REPO_NAME? Si estás seguro de que no:"
    echo "   rm $QDIR/lock   (y re-invocá)"
    exit 1
fi
mkdir -p "$QDIR"; date -Is > "$QDIR/lock"

MODE_LABEL="repo actual ($REPO_NAME)"
(( ALL_REPOS == 1 )) && MODE_LABEL="--all-repos (cola por repo del host)"
echo "🎯 merge-queue — $MODE_LABEL | plan-only=$PLAN_ONLY batch-only=$BATCH_ONLY autonomous=$AUTONOMOUS max-iter=$MAX_ITER"
```

Con `--all-repos`, resolvé la lista de repos (el toolkit NO entra como unidad de
cola — sólo aparece en Phase 6):

```bash
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"
source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
echo "🔧 Colas a censar — ${#LOCAL_PROJECTS[@]} repos de proyecto:"
printf '   - %s\n' "${LOCAL_PROJECTS[@]}"
```

Las Phases 1–6 corren **por repo**. En modo default hay un solo repo (el del
cwd) y ningún loop real. En `--all-repos`, las Phases 1–2 se completan para TODOS
los repos antes de ejecutar nada (la tabla del plan es una sola, multi-repo), la
Phase 3 integra todo el host de una vez (CIs en paralelo), y las Phases 4–5
drenan repo por repo. Cada bloque bash **re-ancla** su contexto (cd al repo +
re-derivar `QDIR`/`DEFAULT`/`CURRENT` + `touch` del lock): las variables no
sobreviven entre bloques.

## Phase 1 — Censo (read-only, por repo)

Nada de esta fase muta el repo. Junta los datos crudos; la clasificación la hacés
vos (Claude) en contexto con las clases de abajo.

```bash
# Re-anclaje: en modo default, el repo del cwd; en --all-repos, cd al repo de la
# iteración bajo ~/webapps/<repo>.
cd "$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$PWD")"
QDIR="/tmp/merge-queue-${REPO_NAME}"
# En --all-repos cada repo tiene su propio lock: uno fresco ajeno ⇒ skipped:locked
# (se registra en la tabla y se sigue con el próximo repo).
if [ -f "$QDIR/lock" ] && [ -n "$(find "$QDIR/lock" -mmin -30 2>/dev/null)" ] \
   && ! grep -q "$(date -I)" "$QDIR/lock" 2>/dev/null; then
    echo "⏭️  $REPO_NAME: lock advisory ajeno fresco — skipped:locked"
fi
mkdir -p "$QDIR"; date -Is > "$QDIR/lock"

git fetch --prune origin --quiet
DEFAULT="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
echo "=== $REPO_NAME | base=$DEFAULT | rama actual=$CURRENT ==="
echo "--- tree (sucio = posible sesión activa sin terminar) ---"
git status --porcelain | head -5

echo "--- coordenada (guards heredados) ---"
bash "$HOME/webapps/vps-ops-toolkit/scripts/maintenance/resolve-work-coordinate.sh" \
     --check "$REPO_NAME" 2>/dev/null || true

echo "--- PRs abiertos (enumeración propia: el resolver NO lista PRs feature en prod-directos) ---"
gh pr list --state open \
   --json number,headRefName,baseRefName,createdAt,mergeable,mergeStateStatus,statusCheckRollup
echo "--- merges recientes (señal doble-orquestador: <10 min ⇒ ⚠️) ---"
gh pr list --state merged --limit 3 --json number,mergedAt,title

echo "--- ramas locales (upstream · track · edad) ---"
git for-each-ref refs/heads \
   --format='%(refname:short)|%(upstream:short)|%(upstream:track)|%(committerdate:iso8601)'

echo "--- por rama local: ahead/behind vs base + ya-en-base (merge-tree in-memory) ---"
BASE_TREE="$(git rev-parse "origin/${DEFAULT}^{tree}" 2>/dev/null || echo none)"
for BR in $(git for-each-ref refs/heads --format='%(refname:short)'); do
    [ "$BR" = "$DEFAULT" ] && continue
    AHEAD="$(git rev-list --count "origin/${DEFAULT}..${BR}" 2>/dev/null || echo '?')"
    BEHIND="$(git rev-list --count "${BR}..origin/${DEFAULT}" 2>/dev/null || echo '?')"
    # merge-tree es in-memory: evaluable aun con tree sucio (la restricción "tree
    # sucio ⇒ no evaluar" de merge-when-green aplica sólo a la rama ACTUAL, cuyo
    # trabajo sin commitear es de ella).
    MT="$(git merge-tree --write-tree "origin/${DEFAULT}" "$BR" 2>/dev/null | head -1)"
    if [ -n "$MT" ] && [ "$MT" = "$BASE_TREE" ]; then
        echo "$BR: YA-EN-BASE (mergearla sería no-op)"
    else
        echo "$BR: ahead=$AHEAD behind=$BEHIND"
    fi
done

echo "--- ramas remotas sin rama local (trabajo pusheado desde otra máquina) ---"
for RB in $(git for-each-ref refs/remotes/origin --format='%(refname:short)'); do
    B="${RB#origin/}"
    case "$B" in "$DEFAULT"|HEAD) continue ;; esac
    git show-ref --verify --quiet "refs/heads/$B" && continue
    AHEAD="$(git rev-list --count "origin/${DEFAULT}..${RB}" 2>/dev/null || echo 0)"
    [ "$AHEAD" != "0" ] && echo "remote-only $B: ahead=$AHEAD"
done
```

**Clasificación (una clase por unidad de trabajo — rama o PR):**

| Clase | Criterio | Destino |
|---|---|---|
| `con-PR` | head de un PR abierto (× CI verde/rojo/pendiente × MERGEABLE/CONFLICTING/UNKNOWN) | batch o tren |
| `remoto-sin-PR` | rama (local o remote-only) con remoto vivo, ahead>0, sin PR | operator-gated (Q2) |
| `local-only` | rama sin upstream, ahead>0 | operator-gated (Q2) |
| `gone-limpia` | upstream `[gone]` **y** ya-en-base | cleanup (sólo reporte) |
| `gone-con-trabajo` | upstream `[gone]` pero NO ya-en-base | operator-gated (Q2) |
| `ya-en-base` | merge-tree == árbol de la base | cleanup (sólo reporte) |
| `diverged` | local y su remoto ahead entre sí | excluida — irresoluble sin force push; nota en Next steps |
| `base-no-default` | PR con `baseRefName != base` (stacked) | excluida — drenar la pila a mano o `gh pr edit <n> --base <base>` |
| `release` | head ∈ `open_pr` del resolver | autorizada (`release_merge=` la nombra) → va PRIMERA · sin autorizar → hold |
| `rama-actual-sucia` | `CURRENT` con tree sucio | advisory "posible sesión activa" — excluida de auto-ejecución, jamás se ofrece |

`host_status=wrong-host` ⇒ el **repo entero** se salta (⏭️ con el
`tailscale ssh ryzepeck@<vps_work>` de destino), igual que merge-when-green.

## Phase 2 — Estrategia + tabla del plan + LA única pregunta

**Matriz de solapamiento** entre las unidades ejecutables (aproximación barata y
explicable; GitHub sigue siendo la autoridad al mergear — por eso Phase 4/5
re-verifican en vivo):

```bash
cd "$(git rev-parse --show-toplevel)"; REPO_NAME="$(basename "$PWD")"
QDIR="/tmp/merge-queue-${REPO_NAME}"; touch "$QDIR/lock"; mkdir -p "$QDIR/files"
DEFAULT="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
# <unidades>: las ramas ejecutables del censo. REF por unidad: origin/<rama> si el
# remoto vive; la local si es local-only.
for U in <unidades>; do
    git diff --name-only "origin/${DEFAULT}...${U}" 2>/dev/null | sort > "$QDIR/files/${U//\//_}"
done
for A in <unidades>; do for B in <unidades posteriores a A>; do
    N="$(comm -12 "$QDIR/files/${A//\//_}" "$QDIR/files/${B//\//_}" | wc -l)"
    (( N > 0 )) && echo "SOLAPA: $A ⇆ $B ($N archivo(s) en común)"
done; done
```

**Armado de la cola (el orden ES la estrategia):**

1. `[0] RELEASE AUTORIZADA` — absoluta primera: es la prioridad que el operador
   declaró en projects.yml, y mergearla primero convierte "release vs N features"
   en N updates chicos que el tren resuelve igual.
2. `[BATCH]` — PRs con CI verde + `MERGEABLE` + **disjuntos entre sí y con la
   release**; orden: más viejo primero (`createdAt`). Merges consecutivos
   server-side, sin esperas entre sí.
3. `[TREN]` — el resto ejecutable (sin-PR incluidas por el operador, CI
   pendiente/rojo, CONFLICTING, solapadas); orden: **grado de solapamiento
   ascendente**, desempate más-viejo-primero. Así cada unidad se actualiza UNA
   sola vez en su turno y los "hubs" (mucho solape) absorben todos sus conflictos
   en UNA sesión al final — con FIFO un hub temprano fuerza updates en cadena de
   todo lo que le sigue.
4. `[HOLDS]` — releases sin autorizar: se integran y esperan su CI, sin merge
   (⏸️ es el caso normal, no un error). Van al final para que su veredicto sea el
   más fresco. Un hold CONFLICTING sólo se REPORTA — no se muta una release no
   autorizada.
5. `[CLEANUP]` — `ya-en-base` / `gone-limpia`: sólo reporte (el `-D` es del
   operador, menú post-run).

**Tabla del plan** (SIEMPRE se muestra, con o sin flags — el operador puede
cortar acá):

| # | Unidad (rama) | PR | Tipo | CI | Mergeable | Solapa con | Fase |
|---|---|---|---|---|---|---|---|

(En `--all-repos`: columna `Repo` primero, y la tabla cubre todos los repos antes
de ejecutar nada.)

Después de la tabla:
- `--plan-only` → saltar directo al Output final (y borrar el lock).
- Flags explícitos (`--all-repos`, `--batch-only`, `--include-no-pr=`) → ejecutar
  directo según el plan.
- Sin flags → **UNA llamada AskUserQuestion** con Q1 (+Q2 si hay ramas sin PR) —
  specs en "Cómo invocar este skill".

## Phase 3 — Integrar todo (C1-análogo: push + PR, sin esperas)

Para TODAS las unidades ejecutables de la cola (batch + tren + holds), de una
vez, así los runs de CI corren **en paralelo** y el tiempo total ≈ el del CI más
lento (racional del Path C de merge-when-green). Ningún fallo individual corta el
barrido: `failed:push` saca ESA unidad de la cola y se sigue.

```bash
cd "$(git rev-parse --show-toplevel)"; touch "/tmp/merge-queue-$(basename "$PWD")/lock"
DEFAULT="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
RAMA="<unidad>"
# Push sólo si hace falta (local-only o local por delante de su remoto):
git push -u origin "$RAMA" || echo "failed:push — $RAMA sale de la cola, se sigue"
# Asegurar PR (state=MERGED/CLOSED no cuenta como abierto — regla de Phase 2 de
# merge-when-green):
ST="$(gh pr view "$RAMA" --json state -q .state 2>/dev/null || echo none)"
if [ "$ST" != "OPEN" ]; then
    gh pr create --head "$RAMA" --base "$DEFAULT" --fill
fi
gh pr view "$RAMA" --json number,url -q '"PR #\(.number) — \(.url)"'
```

- Si la unidad es la rama ACTUAL e incluye cambios sin commitear que el operador
  pidió incluir explícitamente (vía "Other" en Q2): primero el flujo de
  [[git-commit]] sobre esa rama (add selectivo + commit + push), como la Phase 1
  de merge-when-green.
- Una release (autorizada o hold) ya tiene su PR: no se crea uno nuevo.

## Phase 4 — Batch (verdes disjuntos, server-side, cero checkouts)

Inmune al working tree: ningún checkout, así que las otras sesiones no se pisan.
Por cada PR del batch, **en orden**:

```bash
cd "$(git rev-parse --show-toplevel)"; touch "/tmp/merge-queue-$(basename "$PWD")/lock"
PR=<n>
# GitHub recomputa mergeable tras cada merge a la base: UNKNOWN transitorio.
# Poll c/5s, máx 60s — nunca mergear sobre UNKNOWN.
for i in $(seq 1 12); do
    ST="$(gh pr view "$PR" --json mergeable,mergeStateStatus -q '"\(.mergeable) \(.mergeStateStatus)"')"
    case "$ST" in "UNKNOWN"*) sleep 5 ;; *) break ;; esac
done
echo "PR #$PR → $ST"
# Checks siguen verdes (re-confirmación barata, sin --watch):
gh pr checks "$PR" >/dev/null 2>&1; CHECKS_RC=$?
case "$ST" in
    "MERGEABLE BLOCKED"*) echo "⏸️ #$PR BLOCKED (review/ruleset) → se degrada al tren" ;;
    MERGEABLE*)
        if [ "$CHECKS_RC" -eq 0 ]; then
            gh pr merge "$PR" --squash --delete-branch || echo "❌ #$PR falló el merge → tren"
        else
            echo "⚠️ #$PR con checks no-verdes ahora → se degrada al tren"
        fi ;;
    *) echo "⚠️ #$PR quedó $ST tras el merge anterior → se degrada al tren" ;;
esac
```

**Riesgo aceptado y documentado:** el CI no se re-corre entre merges del batch —
válido sólo porque sus unidades son file-disjoint (la matriz de Phase 2); un
conflicto semántico cross-archivo lo atraparía el CI de la base, que Phase 6
mira. Todo lo degradado pasa **al frente del tren** conservando su orden
relativo.

## Phase 5 — Tren (una unidad por vez)

Por cada unidad del tren, en orden. Después de cada merge la base se movió: el
estado se consulta **en vivo** al inicio de cada turno, nunca del censo.

```bash
cd "$(git rev-parse --show-toplevel)"; touch "/tmp/merge-queue-$(basename "$PWD")/lock"
PR=<n>; RAMA="<head>"
DEFAULT="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
git fetch origin "$DEFAULT" --quiet
ST="$(gh pr view "$PR" --json mergeable,mergeStateStatus -q '"\(.mergeable) \(.mergeStateStatus)"')"
echo "PR #$PR ($RAMA) → $ST"
case "$ST" in
  *CONFLICTING*|*DIRTY*)
    # Única ruta que toca el working tree. Guard duro: tree limpio o la unidad
    # se pausa (nunca stash automático — otra sesión puede ser la dueña).
    if [ -n "$(git status --porcelain)" ]; then
        echo "⏸️ tree sucio — paused:tree-sucio; el tren sigue con la próxima unidad"
    else
        git checkout "$RAMA" && { git pull --ff-only origin "$RAMA" 2>/dev/null || true; }
        # JAMÁS git rebase acá: la rama está pusheada y el push posterior sería
        # force (denegado). El merge de la base es descendiente del head remoto
        # ⇒ push fast-forward normal; el squash final se lo come.
        git merge --no-edit "origin/$DEFAULT" \
            || echo "CONFLICTOS → resolución guiada (abajo), UNA sola vez acá"
    fi ;;
  *BEHIND*)
    # Server-side, sin checkout (semántica del botón "Update branch"):
    gh pr update-branch "$PR" || echo "update-branch falló → usar la ruta local de merge de arriba" ;;
  *)
    echo "✓ al día — directo a CI/merge" ;;
esac
```

**Conflictos del merge (ruta CONFLICTING):** reglas de la Phase 6 de
[[git-sync]] adaptadas — `git status` para ver los archivos, mostrar los markers,
explicar qué trae cada lado, resolver editando (nunca quedarse con un lado a
ciegas; si es demasiado complejo, frenar y preguntar), `git add <archivo>` +
`git commit --no-edit` + `git push origin "$RAMA"` (fast-forward normal).

**Después del update:** reusá por prosa las **Phases 3→4→5→6 de
[[merge-when-green]]** para esta unidad:

1. `gh pr checks "$PR" --watch --fail-fast=false` (espera del CI — foreground:
   pasarle `timeout: 600000` al tool Bash, su default es 120000). Si expira
   (exit 143): la unidad pasa a `deferred:ci-lento`, se monta el watcher
   variante PR-checks de [[merge-when-green]] § «Cierre asíncrono de CI» con
   label `CI-MONITOR [<repo>#<pr> tren]` y `NEXT: retomar el turno de esta
   unidad en el tren`, **y el tren SIGUE con la próxima unidad** — al llegar la
   notificación se retoma ese turno re-consultando el estado en vivo (regla de
   reanudación de esa sección).
2. Fix loop (máx `MAX_ITER`): tests rojos → `/fix-broken-tests` con la lista
   exacta; **pausa pidiendo aprobación si tocó código de producción** salvo
   `--autonomous`. Un gate no-test rojo ⇒ `failed:gate-<nombre>` para ESA unidad
   y **el tren sigue** (a diferencia del single-repo, acá no se frena todo).
3. Guard de merge: `mergeable=MERGEABLE` y no `BLOCKED` (review/ruleset ⇒
   `failed:blocked`, no se fuerza) → `gh pr merge "$PR" --squash --delete-branch`.
4. Si la unidad era la **release autorizada**: consumir `release_merge` con el
   awk de la Phase 5 de merge-when-green (el `projects.yml` del toolkit queda
   dirty y se ACUMULA para el cierre — no se commitea acá).

Al terminar la unidad (mergeada o failed/paused con su razón): la siguiente.
**Holds al final:** integrar + esperar CI + reportar veredicto, sin merge (⏸️).

## Phase 6 — Cierre

```bash
cd "$(git rev-parse --show-toplevel)"; REPO_NAME="$(basename "$PWD")"
DEFAULT="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
if [ -z "$(git status --porcelain)" ]; then
    git checkout "$DEFAULT" && git pull --ff-only origin "$DEFAULT"
else
    echo "⚠️ tree sucio — el clon se queda donde está (posible otra sesión)"
fi
echo "--- ramas obsoletas (se REPORTAN, jamás se borran: -D es del operador) ---"
git for-each-ref refs/heads --format='%(refname:short) %(upstream:track)'
echo "--- CI de la base post-drenaje (red de seguridad del batch, best-effort) ---"
gh run list --branch "$DEFAULT" --limit 3
rm -rf "/tmp/merge-queue-${REPO_NAME}"
```

**Cierre asíncrono** — regla completa en [[merge-when-green]] § «Cierre
asíncrono de CI»; instancia de esta skill, en este orden:

1. **Sweep primero** (TaskStop): sólo watchers `CI-MONITOR [...]` que ESTA
   sesión montó y quedaron obsoletos — PRs que este drenaje mergeó, o runs que
   UN `gh run view <id> --json status` confirme `completed` ANTES de matar.
   Nada sin el prefijo ni fuera del ledger de la sesión (un dev server de
   `dev-up` o una shell del operador NO se tocan; en duda, se reporta y no se
   mata). Fuente: el contexto propio, jamás `ps`.
2. **Mount después:** del snapshot `gh run list --branch <base> --limit 3`, si
   el run MÁS NUEVO (el del SHA final del drenaje) sigue `queued`/`in_progress`
   → UN watcher canónico con label `CI-MONITOR [<repo> base:<default>@<sha7>]`.
   Los runs intermedios de la base quedan supersedidos: **máx 1 watcher de base
   por repo** (también en `--all-repos`), y jamás watchers de PRs ya mergeados.
   Si ya está `completed` → veredicto inline, sin watcher. Los
   `deferred:ci-lento` ya montaron el suyo en Phase 5.
3. El reporte final lista el **ledger**: `label → qué vigila → acción al
   resolver` (referencia para cada notificación entrante).

**Toolkit (recolector de `release_merge`):**
- En `--all-repos`: si `projects.yml` quedó dirty por consumos de autorizaciones,
  UN solo commit al final reusando por prosa las Phases T1–T2 de
  [[merge-when-green]] (green gate local + commit directo a master + push; T3
  propagación incluida).
- En modo default (cwd = repo de proyecto): **NO se commitea el toolkit** desde
  acá — se reporta pendiente con `/git-commit` en Next steps (espejo exacto del
  comportamiento de merge-when-green Path A).

**Aviso a las sesiones activas** (si el harness expone las tools; si no, se
omite y va a Next steps): llamá `ListAgents`; por cada sesión local activa que no
sea ésta, `SendMessage` con un aviso corto:

> 🚂 merge-queue: se drenó la cola de `<repo>` — mergeadas: `<rama1>`, `<rama2>`
> (…). La base `<default>` se movió: corré `/git-sync` antes de seguir
> trabajando. Ramas en hold/pausadas: `<lista o "ninguna">`.
> CI de la base: `<verde confirmado | en vigilancia (run <id>)>`.

Un solo mensaje por sesión (no se puede mapear rama→sesión de forma confiable;
el aviso es informativo, no una orden).

## Safety rules

- **Nunca force push**, en ninguna variante — ni `--force`, ni `--force-with-lease`
  (los cubre el deny del fleet), ni el refspec `+` (sería evadir una policy que
  guarda contra accidentes). La alternativa SIEMPRE es `gh pr update-branch` o
  `git merge origin/<base>` dentro de la rama.
- **Nunca `git rebase` sobre una rama pusheada** (su push sería force). Rebase
  sólo sería aceptable en una rama local-only jamás pusheada — y aun ahí el
  merge es más simple y igual de válido con squash.
- **Nunca borrar ramas locales** (`-D` lo decide el operador; menú post-run con
  evidencia). Excepción documentada: el auto-delete REMOTO de
  `gh pr merge --delete-branch`, default heredado de merge-when-green.
- **El merge de una release lo decide sólo `release_merge:`** en projects.yml.
  Esta skill jamás lo ofrece, jamás lo asume, y consume la autorización
  (one-shot) tras el merge.
- **Nunca checkout con tree sucio, nunca stash automático** — el tree puede ser
  de otra sesión. La unidad se pausa y el tren sigue.
- **Conflictos nunca a ciegas** — mostrar ambos lados; si es complejo, frenar y
  preguntar (reglas de git-sync Phase 6).
- **Ningún fallo individual corta la cola** (política Path C): cada unidad
  termina en ✅/⏸️/⏭️/❌ con su razón, y se sigue.
- **El lock es advisory**: protege del doble-merge-queue accidental, NO de un
  `/merge-when-green` suelto en otra sesión. La mitigación real es de uso: al
  drenar multi-rama se usa esta skill EN VEZ de merge-when-green por sesión —
  para eso existe.
- **TaskStop sólo sobre watchers `CI-MONITOR` propios y obsoletos** — jamás una
  shell de fondo desconocida (puede ser un dev server u otra sesión). Orden
  fijo: sweep → mount. En duda: reportar, no matar.
- **Nunca en cron/headless**; la tabla del plan siempre se muestra antes de
  ejecutar, con o sin flags.

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos (reglas
de gating de [[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Ejecutar el tren pendiente | si corrió `--batch-only`/`--plan-only` o quedaron unidades pausadas | `/merge-queue` |
| Borrar ramas ya-en-base (lote con evidencia) | `-D` SÓLO las listadas arriba como ya-en-base/gone-limpia — el trabajo está verificado en la base | `git branch -D <r1> <r2>` |
| Ver un PR puntual | review manual en el browser | `gh pr view <n> --web` |
| Re-censo | refrescar el estado tras cambios externos | `/merge-queue --plan-only` |

NUNCA ofrecer `--autonomous` (se tipea) ni el merge de una release (lo decide
`release_merge:` en projects.yml).

## Output final

Reportar siguiendo [[_output-protocol]].

```markdown
🟢 merge-queue OK — cola drenada
(🟡 si quedaron holds/paused/excluidas · 🔴 si hubo failed · ⏸️ si TODO quedó en
hold de release · ⏭️ si la cola estaba vacía — nada que drenar)

### Resumen ejecutivo
mergeadas: N (batch B + tren T) · holds: N · paused: N · cleanup: N · excluidas: N · failed: N

| # | Unidad | PR | CI | Resultado |
|---|---|---|---|---|
| 1 | release-x (release autorizada) | #12 | ✅ | ✅ mergeada — release_merge consumida |
| 2 | fix/15082026-… | #186 | ✅ | ✅ mergeada (batch) |
| 3 | feat/16082026-… | #187 | ✅ | ✅ mergeada (tren, update-branch) |
| 4 | feat/16082026-… | #188 | 🔄 | ⏸️ paused:tree-sucio |
| 5 | release-y (sin autorizar) | #9 | ✅ | ⏸️ hold — release sin release_merge |
| 6 | feat/vieja | — | — | 🧹 ya-en-base (cleanup) |
| 7 | feat/stacked | #190 | — | ⏭️ excluida:base-no-default |
```

En `--all-repos`: columna `Repo` primero; >15 filas ⇒ anteponer
`### Top 3 acciones prioritarias`.

`## Next steps` — sólo lo accionable, con el comando exacto:
- `failed:*` → el comando del próximo intento (`gh run view <id> --log-failed`, …).
- Holds listos para lanzar → «setear `release_merge: <rama>` al proyecto en
  projects.yml (vps-ops-toolkit) y correr `/merge-when-green`».
- `paused:tree-sucio` → «cerrá/commiteá la sesión dueña del tree y re-invocá
  `/merge-queue`».
- Toolkit pendiente (consumo de `release_merge` en modo default) → `/git-commit`
  en vps-ops-toolkit.
- `excluida:base-no-default` → `gh pr edit <n> --base <default>` o drenar la pila
  a mano desde la hoja con `/merge-when-green`.
- `excluida:diverged` → reconciliar a mano (el force push está denegado; mirá
  `git log --oneline <rama>...origin/<rama>`).
- (manual) `git branch -D <ramas ya-en-base>` — borrado a decisión del operador.
- Si no se pudo avisar a las sesiones (harness sin ListAgents/SendMessage) →
  «en cada sesión abierta de este repo: `/git-sync` antes de seguir».
- Monitores en vuelo → una fila del ledger por watcher (`label → qué vigila →
  acción al resolver`) + respaldo manual `gh run watch <id> -R <repo>` por si la
  sesión se cierra antes de la notificación. (Con `--plan-only` no hay
  monitores: no se ejecutó nada.)
