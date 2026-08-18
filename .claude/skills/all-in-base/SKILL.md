---
name: all-in-base
description: "Usar al cerrar una sesión de trabajo: '¿ya está todo en main/master?', '¿quedó algo sin mergear?', '¿todo el trabajo de esta sesión ya aterrizó?', '¿puedo cerrar?'. Responde SÍ/NO por repo — default: los repos que ESTA sesión tocó (la lista sale del contexto de la conversación; git la verifica), fallback el repo del cwd — chequeando tree limpio + commits sin push + contenido en la base (misma mecánica ya-en-base de merge-when-green, cubre squash) + PRs de la sesión abiertos. Si el veredicto es NO y no se pasó --check-only, lo TERMINA delegando: 1 rama pendiente → flujo merge-when-green; varias ramas/repos → merge-queue; toolkit → Path B. Una release sin release_merge queda ⏸️, jamás se mergea. NO usar para drenar ramas ajenas a la sesión ([[merge-queue]]) ni para un merge puntual ya decidido ([[merge-when-green]]), ni en cron/headless. Sesgo heredado: ante duda dice NO — jamás un SÍ falso."
allowed-tools: Bash, AskUserQuestion, TaskStop, ListAgents, SendMessage
argument-hint: "[--check-only] [--all-repos]"
---

> **⚠️ How to invoke**:
> - Sin argumento: `/all-in-base` → responde la pregunta "¿todo el trabajo de ESTA
>   sesión ya está en `main`/`master`?" y, si la respuesta es NO, lo termina.
> - **Alcance default = los repos que esta sesión tocó**: la lista sale del contexto
>   de la conversación (vos sabés qué repos editaste/commiteaste en esta sesión);
>   cada candidato se verifica con `[ -d ~/webapps/<repo>/.git ]`. Si el contexto no
>   identifica ningún repo (sesión recién resumida, contexto compactado), fallback:
>   el repo del **cwd**.
> - `--check-only`: sólo el veredicto (tabla SÍ/NO por repo), cero mutación — ni
>   delegación, ni sweep de watchers (se listan como ℹ️).
> - `--all-repos` (**sólo desde `vps-ops-toolkit`**, error duro fuera): audita
>   `LOCAL_PROJECTS` + toolkit — responde por TODO el trabajo pendiente del host,
>   sea o no de esta sesión.
> - `--all` / `--all-vps` → **error duro**: no se audita ni mergea a ciegas en
>   clones de otros VPS.
> - Esta skill **no audita ramas ajenas a la sesión** en el modo default: si el
>   censo las ve, van como ℹ️ con puntero a [[merge-queue]] (que es quien drena
>   colas multi-rama).
>
> **Qué significa "terminarlo":** la delegación es decision-complete — cada repo
> pendiente entra al flujo de [[merge-when-green]] (o [[merge-queue]] si hay varias
> unidades) por la fase de su primer faltante, con defaults (squash) y sin
> re-preguntar. Los guards de coordenada (wrong-host, release) son siempre-ON y
> nunca se saltan: una release sin `release_merge:` se integra y espera su CI, pero
> queda ⏸️ — el veredicto honesto es "NO va a estar en la base hasta autorizarla".

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → directo, sin menú; (2)
intención clara en la sesión ("¿ya quedó todo mergeado?", "¿puedo cerrar?") →
proponer `/all-in-base` en una línea y esperar confirmación; (3) invocación ambigua
→ la única AskUserQuestion es la Q1 de abajo (post-veredicto); (4) nunca en
cron/headless ni dentro de un barrido.

**Q1 — Terminar lo pendiente** (`multiSelect: false`; SÓLO si el veredicto global
es NO y no se pasó `--check-only`):

| label | description | preview |
|---|---|---|
| Terminar lo pendiente (Recommended) | delegar cada repo según la tabla (merge-when-green / merge-queue); releases quedan ⏸️ | la columna "Falta" de la tabla |
| Sólo responder | quedarse con el veredicto (equivale a `--check-only`) | `/all-in-base --check-only` |
| Abortar | salir sin tocar nada | — |

**Qué NO se pregunta:** el merge de una release — lo decide `release_merge:` en
projects.yml (blocklist §4); el método de merge (squash default — la delegación
entra a merge-when-green sin re-abrir su picker, regla (4) de su gating); qué
repos auditar (lo dicta el contexto de la sesión o el flag).

## Phase 0 — Alcance + preflight

```bash
ARGS_RAW="${ARGUMENTS:-}"
CHECK_ONLY=0; ALL_REPOS=0
for tok in $ARGS_RAW; do
    case "$tok" in
        --check-only) CHECK_ONLY=1 ;;
        --all-repos)  ALL_REPOS=1 ;;
        --all|--all-vps)
            echo "❌ ERROR: '$tok' no existe en all-in-base."
            echo "   ¿Todo el trabajo pendiente de ESTE host? → --all-repos (sólo desde vps-ops-toolkit)"
            echo "   No hay eje fleet: no se audita a ciegas en clones de otros VPS."
            exit 2 ;;
        *) echo "❌ ERROR: argumento desconocido '$tok'."; exit 2 ;;
    esac
done

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "❌ ERROR: el cwd no es un repo git."; exit 2; }
cd "$REPO_ROOT"

if (( ALL_REPOS == 1 )) && [ "$(basename "$REPO_ROOT")" != "vps-ops-toolkit" ]; then
    echo "❌ ERROR: --all-repos sólo se invoca desde vps-ops-toolkit."
    echo "   Para el veredicto de la sesión desde acá: /all-in-base (sin flags)."
    exit 2
fi

# gh es obligatorio: sin él no se puede afirmar SÍ sobre un squash (merge-tree
# necesita la base fresca, y los PRs de la sesión no se pueden consultar).
# Sin gh la respuesta honesta es "no evaluable" — que NUNCA se reporta como SÍ.
command -v gh >/dev/null || { echo "⚠️ gh no disponible — veredicto degradado a 'no evaluable' (jamás SÍ)."; }
gh auth status >/dev/null 2>&1 || echo "⚠️ gh sin auth — ídem."

echo "🎯 all-in-base — check-only=$CHECK_ONLY all-repos=$ALL_REPOS"
```

**Armado de la lista de repos:**
- **Default**: enumerá los repos que ESTA sesión tocó — editó, commiteó, mergeó —
  según tu propio contexto de la conversación. Verificá cada candidato con
  `[ -d "$HOME/webapps/<repo>/.git" ]`. Si el contexto no identifica ninguno
  (sesión nueva/resumida): el repo del cwd, y decilo en el reporte.
- **`--all-repos`**: `source scripts/lib/bootstrap-common.sh` +
  `PROJECT_DEFS_QUIET=1 source scripts/lib/project-definitions.sh` →
  `REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")`.

## Phase 1 — Censo por repo (read-only)

Un bloque autocontenido por repo (las variables no persisten entre bloques). La
mecánica "¿el contenido ya está en la base?" es la MISMA de la Phase 1.5 de
[[merge-when-green]] (dos capas: rev-list + merge-tree squash-aware, rc sin pipe).
**Diferencia deliberada con 1.5:** allá un tree sucio significa "no evaluable ⇒
seguir el flujo"; acá la pregunta es "¿está en la base?" y trabajo sin commitear
NO está en la base por definición ⇒ **tree sucio = NO rotundo**, no abstención.

```bash
cd "$HOME/webapps/<repo>" || { echo "REPO=<repo> VERDICT=skip:no-existe"; exit 0; }
# Si la sesión trabajó en un worktree, el censo corre AHÍ (cd al worktree, no al
# clon principal): la rama de la sesión vive en el worktree.
CUR="$(git rev-parse --abbrev-ref HEAD)"
DEFAULT="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
# BASE_INT — la base de integración de ESTA rama (stacked): la del PR abierto si
# tiene; si no, la release en repo participante (resolver, pr_state=single); si
# no, la default. "¿Ya está TODO en la base?" se responde contra ESA base — para
# una rama de sesión stacked, aterrizar en la RELEASE es SÍ (release→default es
# un evento del operador, no un pendiente de la sesión).
BASE_INT="$DEFAULT"
PR_BASE="$(gh pr view "$CUR" --json baseRefName,state -q 'select(.state=="OPEN") | .baseRefName' 2>/dev/null || true)"
if [ -n "$PR_BASE" ]; then
    BASE_INT="$PR_BASE"
else
    PROJ="$(basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")")"
    RESOLVER="$HOME/webapps/vps-ops-toolkit/scripts/maintenance/resolve-work-coordinate.sh"
    if [ -x "$RESOLVER" ]; then
        RB="$(bash "$RESOLVER" --check "$PROJ" 2>/dev/null | awk -F= '$1=="pr_state"{ps=$2} $1=="resolved_branch"{rb=$2} END{if(ps=="single") print rb}')"
        [ -n "$RB" ] && [ "$RB" != "$CUR" ] && BASE_INT="$RB"
    fi
fi
git fetch origin "$BASE_INT" --quiet 2>/dev/null || true
BASE="origin/$BASE_INT"
DIRTY="$(git status --porcelain | wc -l)"
UNPUSHED="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo no-upstream)"
AHEAD="$(git rev-list --count "$BASE..HEAD" 2>/dev/null || echo '?')"
# Capa squash de mwg Phase 1.5 — OJO: rc SIN pipe en la asignación (con "| head"
# el $? sería el de head y se perdería el rc que distingue merge limpio de conflicto).
MT_OUT="$(git merge-tree --write-tree "$BASE" HEAD 2>/dev/null)"; MT_RC=$?
MT="$(printf '%s\n' "$MT_OUT" | head -1)"
BT="$(git rev-parse "$BASE^{tree}" 2>/dev/null || echo none)"
IN_BASE=no
if [ "$AHEAD" = "0" ]; then IN_BASE=yes
elif [ "$MT_RC" -eq 0 ] && [ -n "$MT" ] && [ "$MT" = "$BT" ]; then IN_BASE=yes; fi
PRS="$(gh pr list --state open --head "$CUR" --json number,mergeStateStatus \
      -q '.[] | "#\(.number):\(.mergeStateStatus)"' 2>/dev/null | paste -sd, -)"
echo "REPO=<repo> CUR=$CUR BASE=$BASE_INT DIRTY=$DIRTY UNPUSHED=$UNPUSHED AHEAD=$AHEAD IN_BASE=$IN_BASE PRS=${PRS:-none}"
```

**Variante toolkit** (trunk flow, sin PRs — mecánica T2 de merge-when-green):

```bash
cd "$HOME/webapps/vps-ops-toolkit"
git fetch origin master --quiet 2>/dev/null || true
DIRTY="$(git status --porcelain | wc -l)"
git merge-base --is-ancestor HEAD origin/master && ANC=yes || ANC=no
echo "REPO=vps-ops-toolkit DIRTY=$DIRTY ancestor-de-origin/master=$ANC"
```

**Veredicto por repo (lo clasificás vos con los datos):**
- **✅ SÍ** ⇔ `DIRTY=0` ∧ `IN_BASE=yes` (toolkit: `DIRTY=0` ∧ `ANC=yes`). Con el
  contenido ya en la base, `UNPUSHED` es diagnóstico (rama local vieja), no
  bloqueante.
- **❌ NO** con la razón acumulada: tree sucio (`DIRTY>0`) · commits sin push ·
  rama no contenida en la base (`AHEAD>0` y merge-tree ≠ base) · PR de la sesión
  abierto con CI pendiente.
- **⏸️ NO (hold)**: la rama es release sin `release_merge:` — para los repos NO,
  consultá la coordenada (`resolve-work-coordinate.sh --check <repo>`: si
  `CUR ∈ open_pr` y `release_merge=` no la nombra, es hold). Para un SÍ no hace
  falta el resolver.
- Sesgo heredado de 1.5: git < 2.38, conflicto del merge-tree, o `gh` caído ⇒
  esa capa no puede afirmar nada ⇒ **nunca SÍ por esa vía** (se reporta "no
  evaluable" con el dato que falte).

## Phase 2 — Tabla de veredicto + la única pregunta

La tabla se muestra SIEMPRE. El veredicto global es **SÍ ⇔ todos los repos en ✅**.

La columna **vs base** nombra SIEMPRE la base evaluada — para una rama de sesión
stacked es la RELEASE, y un ✅ ahí significa "en la release", no "en main"
(release→default queda como fila propia del hold, evento del operador):

| Repo | Rama | Tree | Sin push | vs base | PR sesión | Veredicto | Falta |
|---|---|---|---|---|---|---|---|
| projectapp | fix/x | ✅ | 0 | vs main: ya-en-base (no-op) | #186 merged | ✅ SÍ | — |
| mimittos_project | chore/y | ❌ 3 arch. | 1 | vs main: ahead 2 | — | ❌ NO | commit→push→PR→CI→merge |
| kore_project | feat/z | ✅ | 0 | vs july-release: ya-en-base | #61 merged | ✅ SÍ (en la release) | — |
| vastago_project_staging | release-v2 | ✅ | 0 | vs master: ahead 5 | #12 CI ✅ | ⏸️ NO (hold) | `release_merge:` |

Ramas del repo ajenas a la sesión con trabajo pendiente: fila ℹ️ con puntero a
`/merge-queue` (no entran al veredicto de la sesión).

- `--check-only` → saltá a Output final (el SÍ/NO va en la línea de veredicto).
- Veredicto global SÍ → saltá a Phase 4 (no hay nada que terminar).
- Hay repos NO y sin `--check-only` → **Q1** (specs en "Cómo invocar").

## Phase 3 — Terminar (delegación decision-complete)

Por prosa + wikilink — jamás el tool `Skill`. En orden de la tabla:

- **1 unidad pendiente en 1 repo** → ejecutá el flujo de [[merge-when-green]]
  **entrando por la fase del primer faltante**: tree sucio → Phase 1 (commit) ·
  commits sin push → el push de Phase 1 · sin PR → Phase 2 · CI pendiente →
  Phase 3 · verde sin mergear → Phase 5. Defaults (squash), sin re-preguntar
  (regla (4) de su gating: el flujo viene decidido del llamador). Los guards de
  coordenada (Phase 0.5: wrong-host, release) **nunca se saltan**.
- **≥2 unidades pendientes en un repo** → [[merge-queue]] desde ese repo (su censo
  completo manda; esta tabla es su input, no su reemplazo).
- **≥2 repos pendientes** → repo por repo en el orden de la tabla. Desde el
  toolkit con `--all-repos`, el atajo es [[merge-queue]] `--all-repos`.
- **Toolkit pendiente** → Path B de [[merge-when-green]] (T1 green gate → T2
  commit+push → T3 propagación → T4).
- **Release sin autorizar** → se integra y espera su CI si falta, pero queda ⏸️ —
  next step exacto: setear `release_merge: <rama>` en projects.yml y
  `/merge-when-green`.

Tras cada delegación, **re-corré el censo de Phase 1 de ese repo** y actualizá la
tabla: el SÍ final se afirma con evidencia, no por haber delegado.

## Phase 4 — Cierre asíncrono (instancia)

Regla completa en [[merge-when-green]] § «Cierre asíncrono de CI». Instancia de
esta skill:

1. **Sweep** (TaskStop): esta skill es el punto natural de higiene de fin de
   sesión — matá los watchers `CI-MONITOR [...]` que ESTA sesión montó y quedaron
   obsoletos (su run/PR ya `completed`/mergeado, confirmado con UN
   `gh run view <id> --json status` antes de matar). Nada sin el prefijo ni fuera
   del ledger de la sesión. Con `--check-only`: **no matar** — listarlos como ℹ️.
2. **Mount: nada propio.** Si Phase 3 delegó, el flujo delegado monta el suyo
   (regla de no-redundancia — jamás dos watchers del mismo objeto). Veredicto SÍ
   ⇒ no hay CI en vuelo causado por esta sesión; el run en vuelo de la base, si
   existe, no es de esta sesión (comando manual en Next steps si interesa).
3. **Retiro del worktree de sesión** (protocolo por sesión): con veredicto ✅ SÍ
   en un repo donde la sesión trabajó en `~/webapps/.wt/<repo>/<slug>`, el
   worktree ya cumplió — retiralo (con `--check-only`: sólo listarlo como
   retirable):
   ```bash
   cd "$HOME/webapps/<repo>"
   git worktree remove "$HOME/webapps/.wt/<repo>/<slug>"   # rechaza si está sucio — eso es un NO, no forzar
   git worktree prune
   ```
   Nunca `--force`: un worktree sucio contradice el SÍ y se reporta. La rama
   local obsoleta sigue siendo del operador (`-D` manual).

## Safety rules

- Read-only hasta la confirmación de Q1 (o flags explícitos); `--check-only` es
  cero mutación siempre.
- Jamás mergea una release sin `release_merge:` (blocklist §4) — el hold es el
  veredicto honesto, no un fallo.
- Jamás borra ramas (`-D` es del operador).
- **Sesgo a falso negativo**: un "NO" de más cuesta una mirada; un "SÍ" falso
  cuesta trabajo perdido. Ante cualquier duda (gh caído, git viejo, merge-tree en
  conflicto): NO / no-evaluable.
- TaskStop sólo sobre watchers `CI-MONITOR` propios y obsoletos; en duda,
  reportar en vez de matar.
- Nunca en cron/headless.

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos (gating
[[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Terminar lo pendiente | si corrió `--check-only` y el veredicto fue NO | `/all-in-base` |
| Drenar con merge-queue | si hay VARIAS ramas/PRs pendientes (de la sesión o ajenas) | `/merge-queue` |
| Ver un PR puntual | review manual en el browser | `gh pr view <n> --web` |
| Re-censar | refrescar el veredicto tras cambios externos | `/all-in-base --check-only` |

## Output final

Reportar siguiendo [[_output-protocol]].

```markdown
🟢 all-in-base — SÍ: todo el trabajo de la sesión está en la base (N repos verificados)
(🟡 si era NO y se terminó ahora — detalle en tabla · ⏸️ si queda una release en
hold · 🔴 si la terminación falló · con --check-only el veredicto SÍ/NO va en esta
misma línea, con ⏭️ si no había nada que evaluar)

| Repo | Rama | Tree | Sin push | vs base | PR sesión | Veredicto | Resultado |
|---|---|---|---|---|---|---|---|
```

(La columna `Resultado` sólo si corrió Phase 3: qué flujo lo terminó y el SHA/PR.
Fila condicional `Monitor CI` / `Sweep` sólo si Phase 4 actuó: 👁️ label montado
por la delegación / 🧹 N watchers barridos.)

`## Next steps` — sólo accionables: release en hold → `release_merge:` +
`/merge-when-green` · ramas locales obsoletas → `git branch -D <rama>` (manual) ·
monitores en vuelo → su ledger (`label → vigila → acción`) + respaldo manual
`gh run watch <id> -R <repo>` · repos ℹ️ con trabajo ajeno → `/merge-queue`.
