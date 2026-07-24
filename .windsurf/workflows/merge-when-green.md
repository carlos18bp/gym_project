---
description: Integra la rama actual cuando el CI está en verde. En repos de proyecto: commit + push + PR + espera el CI de GitHub Actions y mergea cuando pasa (con fix loop de tests rotos si falla). En vps-ops-toolkit (commit directo a master, sin PR): corre los validadores del CI localmente como green gate y, si pasan, hace commit + push a master, propaga al fleet y confirma el run de CI en master. Defaults seguros; flags para override.
auto_execution_mode: 2
---

> **⚠️ How to invoke**:
> - Sin argumento: `/merge-when-green` → opera sobre el repo git del **cwd**
>   (resuelto con `git rev-parse --show-toplevel`). El comportamiento se bifurca
>   según el repo:
> - **Repo de proyecto** (con PR + CI) → **Path A**: commitea lo pendiente, asegura
>   el PR de la rama, espera el CI de GitHub Actions, y mergea cuando está verde. Si
>   el CI falla, arregla los tests rotos en loop antes de mergear. `gh` obligatorio.
> - **`vps-ops-toolkit`** (commit directo a `master`, sin PR — ver "Git en este
>   repo" en su CLAUDE.md) → **Path B (trunk flow)**: valida el verde localmente con
>   los mismos checks del CI (`scripts/ci/*` + `bash -n` + shellcheck si está), y si
>   pasan hace commit + push a `master`, propaga al fleet vía Tailscale, y confirma
>   el run de `validation-coverage` en master. `gh` es **opcional** acá.
>
> **Defaults de proyecto (Path A; override con flags):**
> - Merge con `--squash` + `--delete-branch`. (`--merge-method=merge|rebase`.)
> - Si la rama no tiene PR abierto, lo crea. (`--no-create-pr` para no crearlo.)
> - El fix loop **pausa pidiendo aprobación** si `fix-broken-tests` necesita
>   tocar código de producción. (`--autonomous` para no pausar.)
> - Un check **no-test** rojo (lint / quality-gate / design-tokens / flow-sync)
>   **frena y reporta**; no se intenta arreglar. (`--fix-nontest` para intentarlo.)
> - Máximo **5** iteraciones del fix loop. (`--max-iterations=N`.)
>
> **Defaults del toolkit (Path B; override con flags):**
> - Green gate local ON: si un validador que corre da error, **frena** sin pushear.
>   (`--no-verify` para saltarlo.)
> - Propaga el commit al fleet vía Tailscale. (`--no-propagate` para no propagar.)
> - Confirma el run de CI en master post-push si hay `gh`. (`--no-ci-watch` lo salta.)
> - Los flags de proyecto (`--merge-method`, `--no-create-pr`, `--autonomous`,
>   `--fix-nontest`, `--max-iterations`) son **no-ops** en el toolkit.
>
> **Guards de coordenada de trabajo (Path A y C, siempre ON):** antes de tocar
> nada se resuelve la coordenada del repo con `resolve-work-coordinate.sh`
> (misma fuente que usa [[all-projects]]):
> - **Rama release** (`pr_state=single`, el head del PR abierto) → se hace todo el
>   flujo (commit + push + espera del CI + fix loop) pero **NO se mergea**: una
>   release no se mergea hasta el lanzamiento. Override: `--allow-release-merge`.
> - **Host equivocado** (`host_status=wrong-host`) → **aborta sin tocar nada**. El
>   trabajo de ese proyecto vive en el clon de otro VPS; commitear en éste deja el
>   fleet inconsistente.
>
> **Modo multi-repo (`--all-repos`, sólo desde `vps-ops-toolkit`) → Path C:**
> recorre `LOCAL_PROJECTS` de este host + el toolkit en **dos fases** — primero
> integra todos (commit + push, sin esperas), después espera los CI y mergea. Los
> runs de GitHub corren en paralelo mientras sigue el barrido, así que el tiempo
> total es ≈ el del CI más lento, no la suma. Invocarlo desde un repo de proyecto
> es **error duro**. No existe eje `--all-vps`: no se mergea a ciegas en clones de
> otros VPS.

## Phase 0 — Preflight + ruteo

```bash
ARGS_RAW="${ARGUMENTS:-}"
# Flags de proyecto (Path A: PR/CI):
MERGE_METHOD="squash"; CREATE_PR=1; AUTONOMOUS=0; FIX_NONTEST=0; MAX_ITER=5
# Flags del toolkit (Path B: trunk flow):
VERIFY=1; PROPAGATE=1; CI_WATCH=1
# Multi-repo (Path C) + override del guard de release:
ALL_REPOS=0; ALLOW_RELEASE_MERGE=0
for tok in $ARGS_RAW; do
    case "$tok" in
        --merge-method=squash|--merge-method=merge|--merge-method=rebase) MERGE_METHOD="${tok#--merge-method=}" ;;
        --no-create-pr)     CREATE_PR=0 ;;
        --autonomous)       AUTONOMOUS=1 ;;
        --fix-nontest)      FIX_NONTEST=1 ;;
        --max-iterations=*) MAX_ITER="${tok#--max-iterations=}" ;;
        --no-verify)        VERIFY=0 ;;
        --no-propagate)     PROPAGATE=0 ;;
        --no-ci-watch)      CI_WATCH=0 ;;
        --all-repos)            ALL_REPOS=1 ;;
        --allow-release-merge)  ALLOW_RELEASE_MERGE=1 ;;
        --all|--all-vps)
            echo "❌ ERROR: '$tok' no existe en merge-when-green."
            echo "   ¿Todos los repos de ESTE host? → --all-repos (sólo desde vps-ops-toolkit)"
            echo "   No hay eje fleet: no se mergea a ciegas en clones de otros VPS."
            exit 2 ;;
        *) echo "❌ ERROR: argumento desconocido '$tok'."; exit 2 ;;
    esac
done
export ALL_REPOS ALLOW_RELEASE_MERGE

# Resolver el repo del cwd (NO asumir el toolkit; ignorar el hook SessionStart).
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "❌ ERROR: el cwd no es un repo git. Lanzá Claude Code desde el repo a integrar."
    exit 2
}
cd "$REPO_ROOT"
REPO_NAME="$(basename "$REPO_ROOT")"

# --all-repos es una acción de operador del fleet: el toolkit es su punto de
# entrada. Desde un repo de proyecto no se permite — barrer los repos vecinos
# desde adentro de uno de ellos es fácil de disparar sin querer.
if (( ALL_REPOS == 1 )) && [ "$REPO_NAME" != "vps-ops-toolkit" ]; then
    echo "❌ ERROR: --all-repos sólo se invoca desde vps-ops-toolkit."
    echo "   Estás en '$REPO_NAME'. Para integrar SÓLO este repo: /merge-when-green (sin flags)."
    exit 2
fi

# RUTEO: --all-repos → Path C. Toolkit sin flag → Path B. Cualquier otro → Path A.
if (( ALL_REPOS == 1 )); then
    echo "🎯 --all-repos desde el toolkit → Path C (multi-repo, dos fases)."
elif [ "$REPO_NAME" = "vps-ops-toolkit" ]; then
    echo "🎯 vps-ops-toolkit → Path B (trunk flow). verify=$VERIFY propagate=$PROPAGATE ci-watch=$CI_WATCH"
    echo "   (flags de proyecto ignorados: este repo no usa PR/merge)"
else
    # Path A: gh es obligatorio (PR detection + checks + merge).
    command -v gh >/dev/null || { echo "❌ ERROR: gh CLI no instalada — obligatoria."; exit 2; }
    gh auth status >/dev/null 2>&1 || { echo "❌ ERROR: gh sin auth — corré 'gh auth login'."; exit 2; }
    DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo master)"
    CURRENT="$(git rev-parse --abbrev-ref HEAD)"
    echo "🎯 Repo: $REPO_NAME  |  rama: $CURRENT  |  base: $DEFAULT_BRANCH  |  merge: $MERGE_METHOD"
fi
```

**Ruteo:** con `--all-repos` ejecutá **sólo el Path C** (Phases C1–C2). Si no, y el
repo es `vps-ops-toolkit`, ejecutá **sólo el Path B** (Phases T1–T4) y saltá las
Phases 0.5–6. Para cualquier otro repo, ejecutá **Path A** (Phases 0.5–6) y saltá
los Paths B y C.

---

# Path A — repos de proyecto (PR + CI + merge)

**Resolver la rama de trabajo (git-branch-protocol).** Si `CURRENT` es
`main`/`master`: buscá una rama abierta para reutilizar (`gh pr list --state open
--json headRefName,url`); si hay una, `git checkout` a ella; si no hay ninguna y
tenés cambios para commitear, creá una rama nueva (`<prefijo>/<DDMMYYYY>-<desc>`,
fecha con `date +%d%m%Y`) — ver el protocolo en el `CLAUDE.md` del proyecto. **No
se mergea `main`/`master` sobre sí mismo.**

## Phase 0.5 — Coordenada de trabajo (guards)

Antes de tocar el working tree, resolvé dónde y sobre qué rama corresponde
trabajar. La fuente es `resolve-work-coordinate.sh` — la misma que usa
[[all-projects]] — que valida la rama contra los **PRs abiertos**, no contra el
`projects.yml` estático.

```bash
COORD="$(bash "$HOME/webapps/vps-ops-toolkit/scripts/maintenance/resolve-work-coordinate.sh" \
         --check "$REPO_NAME" 2>/dev/null)"
PR_STATE="$(sed -n 's/^pr_state=//p'   <<<"$COORD")"
HOST_ST="$(sed -n 's/^host_status=//p' <<<"$COORD")"
VPS_WORK="$(sed -n 's/^vps_work=//p'   <<<"$COORD")"
OPEN_PR="$(sed -n 's/^open_pr=//p'     <<<"$COORD")"
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
MERGE_ALLOWED=1; RELEASE_HOLD=0

# Guard 1 — host equivocado. El trabajo de este proyecto vive en el clon de otro
# VPS; commitear acá deja el fleet inconsistente (los scripts que filtran por
# server: empiezan a saltarlo, y el commit aterriza en la rama equivocada).
if [ "$HOST_ST" = "wrong-host" ]; then
    echo "⏭️  $REPO_NAME trabaja en $VPS_WORK, no en este host — abortando sin tocar nada."
    echo "    Continuá allá:  tailscale ssh ryzepeck@$VPS_WORK"
    exit 0
fi

# Guard 2 — rama release. La condición NO es "hay un solo PR abierto" sino "la
# rama que estás pisando es el head de un PR release". Con pr_state=ambiguous
# (dos PRs release abiertos, caso real de vastago: release-may-2026-v2 +
# release-may-2026) seguís parado sobre una release igual, y un guard que sólo
# mirara `single` la mergearía.
IS_RELEASE_BRANCH=0
if [ -n "$OPEN_PR" ] && [ "$OPEN_PR" != "none" ]; then
    while IFS= read -r head; do
        [ "$head" = "$CURRENT" ] && IS_RELEASE_BRANCH=1
    done < <(tr ',' '\n' <<<"$OPEN_PR")
fi

if (( IS_RELEASE_BRANCH == 1 )) && (( ALLOW_RELEASE_MERGE == 0 )); then
    MERGE_ALLOWED=0; RELEASE_HOLD=1
    echo "⏸️  '$CURRENT' es rama release (head de PR abierto; pr_state=$PR_STATE)."
    echo "    Se integrará y se esperará el CI, pero NO se mergea."
    echo "    Override: --allow-release-merge"
fi

# Sin coordenada resoluble (repo fuera de projects.yml, gh caído) no se puede
# afirmar que NO es una release. Se continúa, pero decirlo — un guard que falla
# en silencio es peor que no tenerlo.
case "$PR_STATE" in
    ""|gh-error|gh-unavailable|no-repo)
        echo "ℹ️  coordenada no resoluble (pr_state='${PR_STATE:-vacío}') — el guard de"
        echo "    release NO pudo evaluarse. Verificá la rama a mano antes de mergear." ;;
esac
```

Reportá `PR_STATE`, `HOST_ST` y el valor final de `MERGE_ALLOWED` en la tabla de
salida: el operador tiene que ver por qué se mergeó o por qué no.

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

**Guard de release primero** (Phase 0.5). Si la rama es la del PR release, acá
termina el flujo: el trabajo ya está integrado y el CI ya dio su veredicto, que
es lo que se venía a saber.

```bash
if [ "${MERGE_ALLOWED:-1}" = "0" ]; then
    echo "⏸️  Rama release ($CURRENT, PR #$PR_NUMBER) — commit y CI hechos, merge NO."
    echo "    Una release no se mergea hasta el lanzamiento."
    echo "    Para lanzarla igual:  /merge-when-green --allow-release-merge"
    # Saltar Phase 6. El PR queda abierto a propósito.
fi
```

Con `MERGE_ALLOWED=1`, seguí normalmente:

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

**No corras esta fase si `MERGE_ALLOWED=0`** — no hubo merge y la rama release
sigue siendo la rama de trabajo del proyecto.

```bash
git checkout "$DEFAULT_BRANCH" && git pull --ff-only origin "$DEFAULT_BRANCH"
```

Reportá el PR mergeado + el SHA del merge en `$DEFAULT_BRANCH`.

---

# Path B — vps-ops-toolkit (trunk flow, sin PR)

Este repo commitea **directo a `master`, sin rama feature ni PR** (política del
CLAUDE.md). El análogo de "merge when green" acá es: **validar el verde localmente
ANTES de integrar → commit + push a master → propagar al fleet → confirmar el run de
CI en master**. El "verde" son los mismos checks que corre
`.github/workflows/validation-coverage.yml`.

## Phase T1 — Green gate local (pre-push)

Con `VERIFY=1` (default), correr los validadores del CI contra el working tree.
Reportar SIEMPRE qué gate corrió y cuál se saltó (sin caps silenciosos). Este es un
bloque autocontenido: recomputa todo desde el cwd e imprime `GATE:GREEN` o `GATE:RED`.

```bash
cd "$(git rev-parse --show-toplevel)"
if [ "${VERIFY:-1}" = "0" ]; then
    echo "⏭️  green gate saltado (--no-verify) — se integra sin validar localmente."
else
    fails=0
    # (a) Sintaxis: bash -n sobre cada .sh cambiado/untracked.
    mapfile -t CHANGED_SH < <(git status --porcelain | sed 's/^...//' | grep -E '\.sh$' || true)
    if [ "${#CHANGED_SH[@]}" -gt 0 ]; then
        for f in "${CHANGED_SH[@]}"; do
            [ -f "$f" ] || continue
            if bash -n "$f"; then echo "  ✅ bash -n  $f"; else echo "  ❌ bash -n  $f"; fails=$((fails+1)); fi
        done
    else
        echo "  ⏭️  bash -n — sin scripts .sh cambiados"
    fi
    # (b) shellcheck si está instalado (mismo umbral de fallo que el CI: error-level).
    if command -v shellcheck >/dev/null; then
        if [ "${#CHANGED_SH[@]}" -gt 0 ]; then
            if printf '%s\n' "${CHANGED_SH[@]}" | xargs -r shellcheck --severity=error \
                 --exclude=SC1090,SC1091,SC2154; then echo "  ✅ shellcheck (error-level)"
            else echo "  ❌ shellcheck (error-level)"; fails=$((fails+1)); fi
        fi
    else
        echo "  ⏭️  shellcheck — no instalado en este host (lo confirma T4 vía CI de master)"
    fi
    # (c) validadores del CI: correr el .sh (escribe ci-results/*.json) y leer 'errors'.
    for pair in "validate-projects-yml:yaml-validation-summary.json" \
                "validate-config-integrity:config-integrity-summary.json"; do
        v="${pair%%:*}"; j="ci-results/${pair##*:}"
        bash "scripts/ci/$v.sh" >/dev/null 2>&1 || true
        errs="$(python3 -c "import json;print(json.load(open('$j'))['errors'])" 2>/dev/null || echo '?')"
        if [ "$errs" = "0" ]; then echo "  ✅ scripts/ci/$v.sh (0 errores)"
        else echo "  ❌ scripts/ci/$v.sh ($errs errores)"; fails=$((fails+1)); fi
    done
    [ "$fails" -gt 0 ] && echo "GATE:RED ($fails gate(s) en rojo)" || echo "GATE:GREEN"
fi
```

- `GATE:RED` → 🔴 **STOP**: NO commitees ni pushees. Reportá los gates rojos + el
  comando local para reproducirlos (`bash scripts/ci/<x>.sh`). **Distinguí el origen**:
  si el rojo lo introdujo TU cambio → arreglalo y reinvocá. Si es un rojo
  **pre-existente / no relacionado** (el repo ya estaba rojo antes de tocar nada) →
  surfacealo como item aparte y, si querés integrar igual, usá `--no-verify` (o
  `/git-commit`); no arrastres el arreglo del drift ajeno a este commit.
- `GATE:GREEN` (o `--no-verify`) → seguí a T2.

## Phase T2 — Commit + push a master

Sólo con `GATE:GREEN` (o `--no-verify`). Reutilizá el flujo de `/git-commit` sobre
`master` (sin rama feature ni PR):

- `git status --porcelain` vacío → nada que commitear; si hay algo ya pusheado
  pendiente de propagar, saltá a T3; si no, terminá "0 cambios".
- Con cambios → inspeccioná `git status` + `git diff`, generá un mensaje
  `FEAT/FIX/DOCS` propio, `git add` **selectivo** (sólo lo de este cambio) +
  `git commit -m "…"` + `git push`. Mostrá cada comando antes de correrlo. El hook
  `pre-commit` corre igual (guard de credenciales).
- Si `git push` falla → reportá y **saltá la propagación** (T3): el commit local
  queda; no hay nada nuevo en el remoto que jalar.

Capturá el SHA pusheado: `git rev-parse HEAD`.

## Phase T3 — Propagación al fleet (ON por defecto)

Con `PROPAGATE=1` (default) y sólo si T2 hizo un commit real **y** el push tuvo
éxito: sincronizá la copia del toolkit en los otros hosts del fleet (otros VPS + dev
si está prendida) con el commit recién pusheado, corriendo el core de `git-sync` en
cada host remoto vía Tailscale.

```bash
if [ "$(basename "$(git rev-parse --show-toplevel)")" != "vps-ops-toolkit" ]; then
    echo "⏭️  Repo no-toolkit — sin propagación."
else
    bash "$HOME/webapps/vps-ops-toolkit/scripts/maintenance/propagate-toolkit-commit.sh" --apply
fi
```

- **Exit code `75`** (Tailscale pide autorización interactiva): el script imprimió un
  link `https://login.tailscale.com/...`. **Mostrale el link tal cual al operador**,
  pedile que lo abra y autorice con la cuenta del fleet, esperá su confirmación, y
  **re-ejecutá el mismo comando** (idempotente). Repetí hasta que el exit deje de ser
  `75`. Una autorización habilita TODOS los VPS de la ventana de re-auth. NO caigas a
  `ssh` directo, NO abortes, NO asumas que un VPS está caído (ver CLAUDE.md "Flujo de
  auth de Tailscale SSH").
- Reportá por host: `SYNCED <sha>` (actualizado) / `CONFLICT_NEEDS_MANUAL_SYNC`
  (divergencia real; quedó con el working tree intacto → requiere `git-sync` manual;
  no bloquea el commit ya hecho) / `UNREACHABLE` (dev apagada / VPS caído; warning,
  seguí).

Con `--no-propagate` (`PROPAGATE=0`) → omitir esta fase y decirlo en el resumen.

## Phase T4 — Confirmar CI en master (post-push, best-effort)

Con `CI_WATCH=1` (default), `gh` disponible + autenticado, y un push exitoso en T2:
confirmá que `validation-coverage` quedó en verde para el SHA pusheado.

```bash
SHA="$(git rev-parse HEAD)"
if [ "${CI_WATCH:-1}" = "0" ] || ! command -v gh >/dev/null || ! gh auth status >/dev/null 2>&1; then
    echo "⏭️  CI watch saltado (--no-ci-watch o sin gh). El run corre igual en GitHub Actions."
else
    RUN_ID="$(gh run list --branch master --commit "$SHA" \
        --workflow=validation-coverage.yml --json databaseId -q '.[0].databaseId' 2>/dev/null || true)"
    # El run puede tardar unos segundos en aparecer; reintentá 1-2 veces si viene vacío.
    if [ -n "$RUN_ID" ]; then
        gh run watch "$RUN_ID" --exit-status; echo "CI_RC=$?"
    else
        echo "⚠️  aún no aparece el run para $SHA; revisá: gh run list --branch master --limit 3"
    fi
fi
```

- `CI_RC=0` → ✅ run en verde (cubre el shellcheck que quizá no corrió local en T1).
- `CI_RC≠0` → ⚠️ **CI rojo en master**: reportá el job fallido +
  `gh run view <RUN_ID> --log-failed`. `master` ya está integrado (direct-to-master:
  no se puede "des-pushear") → el operador arregla **hacia adelante** con un commit de
  fix. NO revierte el commit ya hecho.
- Sin `gh` → saltar; el run corre igual en GitHub Actions (revisar a mano).

---

# Path C — `--all-repos` (multi-repo de ESTE host, dos fases)

Sólo alcanzable desde `vps-ops-toolkit` (gate en Phase 0). Recorre los repos del
host — misma lista que `/git-commit --all-repos` — reusando los Paths A y B por
repo, pero **separando la integración de la espera del CI**: si se hiciera repo
por repo de punta a punta, el tiempo total sería la suma de todos los CI. Al
pushear todo primero, los runs de GitHub corren en paralelo y el total es ≈ el
del CI más lento.

**No hay eje `--all-vps`**: no se mergea a ciegas en clones de otros VPS, que
pueden estar sucios o parados en una rama de release.

```bash
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"
source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
echo "🔧 Path C — ${#REPOS[@]} repos en este host:"
printf '   - %s\n' "${REPOS[@]}"
```

## Phase C1 — Integrar todos (rápido, sin esperas)

Por cada repo en `REPOS`, con `cd "$HOME/webapps/<repo>"`:

1. **Nada que hacer** — `git status --porcelain` vacío **y** sin commits sin
   pushear (`git log @{u}..HEAD`) → ⏭️ `skipped:sin-cambios`. No generes mensaje
   ni toques nada.
2. **Coordenada** (Phase 0.5). `host_status=wrong-host` → ⏭️
   `skipped:wrong-host:<vps_work>`; ese repo se trabaja en otro VPS.
   `pr_state=single` → marcar `release-hold`.
3. **Toolkit** → Path B completo (T1 green gate → T2 commit+push → T3
   propagación). Un `GATE:RED` marca `failed:green-gate` para **ese** repo y
   sigue con el resto.
4. **Proyecto** → Path A Phases 1–2 (commit + push + asegurar PR). Sobre una
   rama release **no se crea PR nuevo**: el del release ya existe y es el que
   `gh pr view "$CURRENT"` encuentra.
5. **Registrar** una fila: `repo · rama · PR# · clasificación`, con clasificación
   en `mergeable` / `release-hold` / `skipped:<razón>` / `failed:<razón>`.

Al cerrar C1, mostrá la tabla de integración antes de entrar a C2 — el operador
tiene que poder cortar ahí si algo no le cierra.

## Phase C2 — Esperar CI y mergear

Sólo sobre los repos cuya clasificación es `mergeable` o `release-hold` (los
`skipped` y `failed` no tienen nada corriendo). Por cada uno:

1. Phase 3 (esperar el CI) → si rojo, Phase 4 (fix loop, con las mismas reglas:
   pausa si hay que tocar código de producción salvo `--autonomous`).
2. `mergeable` → Phase 5 (merge) + Phase 6 (post-merge).
3. `release-hold` → reportá el veredicto del CI y **no mergees** (⏸️). Es el
   caso normal, no un error.

**Política de errores**: ningún fallo individual corta el barrido. Un repo que
falla queda con su razón en la tabla y se sigue con el siguiente. El reporte
final lista los N repos con su estado.

---

## Output final

Reportar siguiendo [[_output-protocol]].

**Path A — proyecto (`/merge-when-green` en un repo con PR/CI):**

```markdown
🟢 merge-when-green OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Coordenada | ✅ | pr_state=<x> · host=<on-work-host> · merge permitido |
| Commit + push | ✅ | <sha> en la rama <rama> |
| PR | ✅ | #<n> — <url> |
| CI checks | ✅ | N/N en verde (pytest, jest, playwright, gates) |
| Fix loop | ⏭️ | no hizo falta (CI verde de una) |
| Merge | ✅ | --<method> a <base>, rama borrada |
```

Reemplazá ✅ por ⚠️/❌/⏸️ según corresponda y agregá `## Next steps`:
- **Rama release** (`pr_state=single`) → veredicto `⏸️ merge-when-green — release
  integrada y verde, sin mergear`, fila `Merge` en ⏸️ con "rama release; se mergea
  en el lanzamiento" y next step `/merge-when-green --allow-release-merge`.
- **Host equivocado** (`host_status=wrong-host`) → `⏭️ merge-when-green — N/A`,
  fila `Coordenada` en ⏭️ y next step `tailscale ssh ryzepeck@<vps_work>`.
- **Coordenada no resoluble** → fila `Coordenada` en ℹ️ diciendo que el guard de
  release no pudo evaluarse; nunca omitir la fila.
- Fix loop que pausó por código de prod → ⏸️ + el cambio a aprobar.
- Gate no-test rojo (sin `--fix-nontest`) → ❌ + el comando local para reproducirlo.
- Merge bloqueado por review/ruleset → ❌ + `gh pr view <n> --web` para revisar.
- Superó `MAX_ITER` sin verde → ❌ + qué test sigue rojo y el comando del próximo intento.

**Path B — toolkit (`/merge-when-green` en `vps-ops-toolkit`):**

```markdown
🟢 merge-when-green (toolkit) OK
✨ master integrado y en verde.

| Dimensión | Estado | Detalle |
|---|---|---|
| Green gate local | ✅ | bash -n N/N · projects.yml 0 err · config-integrity 0 err (shellcheck ⏭️ no local) |
| Commit + push | ✅ | <sha> → master |
| Propagación fleet | ✅ | vps-X SYNCED · vps-Y SYNCED · dev UNREACHABLE |
| CI master | ✅ | validation-coverage verde (<run-url>) |
```

Reemplazá ✅ por ⚠️/❌/⏸️ según corresponda y agregá `## Next steps`:
- Green gate rojo → ❌ + el validador que falló y su comando local (`bash scripts/ci/<x>.sh`).
- Push falló → ❌ + causa (no upstream / conflicto remoto) + `/git-sync`.
- Propagación con `CONFLICT_NEEDS_MANUAL_SYNC` → ⚠️ + los hosts que requieren `git-sync` manual.
- CI rojo en master post-push → ⚠️ + el job fallido + `gh run view <id> --log-failed` (fix hacia adelante).

**Path C — `--all-repos` (multi-repo):** una fila por repo, columna `Repo` antes
de `Dimensión`. Es tabla grande (>15 filas con varios repos) → anteponer
`### Resumen ejecutivo` con el conteo por clasificación.

```markdown
🟡 merge-when-green (--all-repos) OK con N warning(s) — 11 repos

### Resumen ejecutivo
mergeados: N · release-hold: N · sin cambios: N · wrong-host: N · fallidos: N

| Repo | Rama | PR | CI | Resultado |
|---|---|---|---|---|
| projectapp | feat/… | #124 | ✅ verde | ✅ mergeado (squash) |
| vastago_project_staging | release-may-2026-v2 | #12 | ✅ verde | ⏸️ release — no se mergea |
| kore_project | — | — | — | ⏭️ wrong-host → vps-projectapp-staging |
| mimittos_project | — | — | — | ⏭️ sin cambios |
| vps-ops-toolkit | master | — | ✅ verde | ✅ push + fleet SYNCED |
```

`## Next steps` sólo con lo accionable: los `failed:*`, los `release-hold` que ya
estén listos para lanzar, y los `wrong-host` con el `tailscale ssh` de destino.
