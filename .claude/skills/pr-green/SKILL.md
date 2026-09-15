---
name: pr-green
description: "Cierre de sesión en un repo de PROYECTO del fleet: deja el PR de TU rama de sesión abierto y con CI verde, y PARA — nunca mergea. Usar cuando el trabajo está listo: 'dejá el PR listo', 'esperá el CI', 'arreglá lo rojo del PR', 'entregá esto', o cuando [[merge-queue]] te delega un conflicto/rojo. NO usar para mergear ([[merge-queue]] drena; [[merge-when-green]] es del operador), ni en vps-ops-toolkit (trunk flow: [[git-commit]]), ni en cron/headless."
allowed-tools: Bash, AskUserQuestion, TaskStop
argument-hint: "[--no-wait] [--autonomous] [--fix-nontest] [--max-iterations=N]"
---

> **⚠️ How to invoke**:
> - Sin argumento: `/pr-green` → opera sobre el **worktree de sesión del cwd**
>   (`~/webapps/.wt/<repo>/<slug>`) y sobre SU rama. No toma nombres de repo ni de
>   rama: una sesión entrega lo suyo, parada donde trabajó.
> - **Esta skill NO tiene fase de merge**, y no es un olvido: existe para que la
>   sesión frene donde debe. El DoD de una sesión es *árbol limpio + rama pusheada +
>   PR abierto + CI verde en ESE PR* (git-branch-protocol §10). El drenaje a la base
>   lo hace [[merge-queue]] o el operador a mano.
> - `--no-wait`: commit + push + PR y termina, **sin** esperar el CI.
> - `--autonomous`: el fix loop no pausa cuando el arreglo toca código de producción.
> - `--fix-nontest`: intenta arreglar también los gates no-test rojos (default: los reporta).
> - `--max-iterations=N`: tope del fix loop (default **5**).
> - `gh` es **obligatorio** (PR + checks): sin él no hay entrega verificable.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → directo, sin menú; (2)
intención clara en la sesión ("dejá el PR listo", "esperá el CI" tras el trabajo de
esta conversación) → proponer `/pr-green` en una línea y esperar confirmación; (3)
invocación ambigua → la única AskUserQuestion es la Q1 de abajo; (4) nunca en
cron/headless, ni dentro de un barrido, ni cuando [[merge-queue]] delegó un fix (ahí
el flujo viene decidido: entrás directo por la Phase 4).

**Q1 — Alcance del cierre** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Entregar (Recommended) | commit + push + PR + espera del CI + fix loop; termina en verde, sin mergear | `/pr-green` |
| Sólo commit+push+PR | deja el PR abierto y corta sin esperar el CI (lo mirás después) | `/pr-green --no-wait` |
| Abortar | salir sin tocar nada | — |

**Qué NO se pregunta:** el **merge** — no existe en esta skill — ni el método de
merge (blocklist §4: el drenaje es de [[merge-queue]]/operador, y una release la
autoriza `release_merge:` en projects.yml). `--autonomous` es un override
deliberadamente incómodo y jamás se ofrece; `--fix-nontest` y `--max-iterations=N`
son tuning simétrico al default y se tipean.

## Phase 0 — Guard de worktree + coordenada

> **Post-`EnterWorktree`: UN comando simple por llamada.** Adentro de un worktree
> nativo, Claude inspecciona el string literal y rechaza el comando que trae
> `$(...)`, `{a,b}`, un `for`/`while` o un heredoc con sustitución, y el que apunta
> al clon compartido (`git -C <clon principal>`, `cd <clon principal>`) — se cae el
> bloque entero, no la línea. Por eso esta skill **no computa nada en bash**: pide UN
> registro a `session-worktree.sh status` y escribe sus valores **literales** en las
> llamadas siguientes. Convención completa: `git-branch-protocol` §1 del CLAUDE.md
> del repo.

**Flags** — los parseás vos leyendo `$ARGUMENTS`; un bucle de parseo sería rechazado:

| Token | Efecto |
|---|---|
| `--no-wait` | commit + push + PR y termina, **sin** esperar el CI |
| `--autonomous` | el fix loop no pausa cuando el arreglo toca código de producción |
| `--fix-nontest` | intenta arreglar también los gates no-test rojos |
| `--max-iterations=N` | tope del fix loop (default **5**) |
| `--merge-method=…` · `--all` · `--all-repos` · `--all-vps` | **ERROR**: esta skill no mergea ni barre repos. Drenar varias ramas/PRs → `/merge-queue` (operador). |
| cualquier otro | **ERROR**: argumento desconocido |

```bash
bash ~/webapps/vps-ops-toolkit/scripts/maintenance/session-worktree.sh status
```

- **rc 2** → no hay registro que emitir: estás en el clon principal, fuera de un repo
  git, o en `vps-ops-toolkit` (flujo trunk, sin PR → `/git-commit`). Mostrá la razón
  que imprimió y **abortá** con la receta de alta —
  `bash ~/webapps/vps-ops-toolkit/scripts/maintenance/session-worktree.sh create <prefijo> <slug>`,
  después Claude: `EnterWorktree path=<el worktree= que imprimió>` · Codex:
  `cd <worktree=>` — y re-invocá desde ahí.
- **rc 0** → el registro trae TODO lo que usan las fases siguientes: `repo` `branch`
  `base` `worktree` `default_branch` `resolved_branch` `registered_branch`
  `deploy_branch` `open_pr` `pr_state_coord` `release_merge` `host_status` `pr_number`
  `pr_state` `pr_url` `ci` `dirty` `unpushed` `in_base` `verdict`. **No lo recalcules por fase**:
  de ahí salen los literales.

`gh` es **obligatorio** (PR + checks): sin él no hay entrega verificable.

```bash
gh auth status
```

Guards — se resuelven comparando valores del registro, sin bash. Son siempre-ON y no
hay flag que los saltee:

1. **`host_status=wrong-host`** → ⏭️ el trabajo de este repo vive en otro VPS:
   **terminá** sin tocar nada. El nombre del VPS correcto (`vps_work=`) sale de un
   comando simple más, con el `project` del registro:
   `bash ~/webapps/vps-ops-toolkit/scripts/maintenance/resolve-work-coordinate.sh --check <project literal>`
   → reportá `tailscale ssh ryzepeck@<vps_work>`.
2. **Rama BASE** — `branch` igual a `default_branch`, `resolved_branch`,
   `registered_branch`, `deploy_branch` o `base`. Son ramas compartidas, jamás de una
   sesión: ❌ acá no se commitea, no se pushea y no se entrega nada. Cortá tu rama
   desde ella (`session-worktree.sh create <prefijo> <slug>`) y abortá. Se comparan
   TODAS y sin mirar `pr_state_coord`: con `ambiguous` (>1 release abierta, caso
   rutinario) `resolved_branch` nombra sólo una, y parado en la OTRA el chequeo
   pasaría.
3. **Candidata a release** — `branch` aparece en `open_pr` (los PRs abiertos con
   base=default, separados por comas; `none` ⇒ este guard no aplica) y no matcheó el
   guard 2. O es una release que el yml no registra, o —lo habitual— un PR de sesión
   mal basado: ❌ abortá con la corrección exacta
   `gh pr edit <pr_number> --base <resolved_branch>`, o, si de verdad es la release,
   cortá tu rama desde ella.

Reportá `🎯 pr-green — repo=<repo> rama=<branch> base=<base> worktree=<worktree> no-wait=<0|1>`.

## Phase 1 — Commit + push

En TU rama, dentro de TU worktree. Nunca en el clon principal, nunca sobre la base.
El cwd YA es el worktree (entraste con `EnterWorktree`): **no hay `cd`** que hacer.

- `git status --porcelain` vacío → nada que commitear; seguí a Phase 1.5 (la rama ya
  debería estar pusheada). **No** saltes a Phase 2: con el tree limpio el caso más
  probable es que el trabajo ya haya aterrizado.
- Con cambios → inspeccioná `git status` + `git diff`, generá un mensaje Conventional
  Commits propio (`feat:`/`fix:`/`docs:`…), `git add` **selectivo** +
  `git commit -m "…"` + `git push` (la primera vez `git push -u origin <branch literal>`).
  Un comando por llamada; mostrá cada uno antes de correrlo.
- Si el push falla → reportá y **abortá** (sin rama pusheada no hay PR ni CI que
  esperar). Nunca `--force`.

## Phase 1.5 — ¿El trabajo ya está en la base?

Si el contenido de la rama ya aterrizó (la queue o el operador mergearon con squash),
no hay PR nuevo que abrir ni CI que esperar. Corre acá y no antes: Phase 1 ya
commiteó y pusheó lo pendiente — y por eso el registro se **relee** (el de Phase 0 es
anterior a tu commit):

```bash
bash ~/webapps/vps-ops-toolkit/scripts/maintenance/session-worktree.sh status
```

`in_base` sale del mismo par de capas que usaba el bloque viejo (`rev-list --count`
sobre `origin/<base>` + `merge-tree --write-tree` squash-aware, rc leído sin pipe),
pero calculado adentro del helper — que sí puede componer comandos.

- **`in_base=yes`** → reportá **⏭️ ya en la base** con la evidencia del mismo registro
  (`pr_number`, `pr_state`, `pr_url`) y **terminá**: sin PR, sin espera de CI, sin
  merge. No hagas checkout de la base ni la "dejes al día" — eso vive en el clon
  principal, que no se toca. El worktree lo retira `/all-in-base` cuando lo verifique.
- **`in_base=no`** → seguí a Phase 2.
- **`in_base=?`**, o **`dirty>0`** → **no evaluable**: NO se corta, sigue el flujo
  normal. Sesgo a **falso negativo** (misma mecánica que [[merge-when-green]] Phase
  1.5 — se cita como referencia, no se ejecuta nada de esa skill): falta
  `origin/<base>`, el merge de 3 vías dio conflicto, git < 2.38, o hay trabajo sin
  commitear (que por definición no está en la base). Un falso positivo dejaría
  trabajo sin entregar; un falso negativo sólo cuesta una espera.

## Phase 2 — Asegurar el PR

Del registro de Phase 1.5 salen `pr_number`, `pr_state`, `pr_url` y `base`.

- **`pr_state=OPEN`** → usalo (`pr_number`, `pr_url`); su `baseRefName` ya ES el
  `base` del registro — no lo recalcules.
- **`pr_state=MERGED` o `CLOSED`** → **no** cuenta como PR abierto. Llegar acá con un
  `MERGED` significa que Phase 1.5 ya vio que hay trabajo NUEVO sobre una rama
  reusada tras su merge → abrir un PR nuevo es lo correcto.
- **`pr_state=none`** (o cerrado/mergeado) → crealo contra la base de integración, con
  el ownership del protocolo por sesión en el body (git-branch-protocol §9).
  **`<base>` va LITERAL**, tal como lo imprimió `status`: post-entry no hay bash que
  la calcule, y un `--base ""` hace fallar el create.

  ```bash
  gh pr create --base <base literal del registro> --fill --body "Sesión: <nombre de tu sesión, o el slug de la rama>
  Intención: <1 línea: qué entrega esta rama>

  <resumen de los commits>"
  ```

  El body es texto literal entre comillas dobles con saltos de línea reales —
  **nunca** `--body "$(printf …)"`: la sustitución de comando muere en Gate A y se
  cae el `gh pr create` entero. Las líneas `Sesión:` / `Intención:` son **contrato**:
  [[merge-queue]] las usa para saber a quién delegarle conflictos y fixes. No las
  omitas.

Imprimí `PR URL: <url>` acá mismo — es la mitad de la entrega.

## Phase 3 — Esperar el CI

Con `--no-wait` esta fase **no corre**: reportá `PR URL:` + `CI: ⏸️ no esperado` y andá al Output final.

`<n>` es el `pr_number` literal del registro. Si Phase 2 acaba de crear el PR, releé
el registro (`session-worktree.sh status`) para tenerlo — o tomalo de la URL que
imprimió `gh pr create`.

```bash
gh pr checks <n> --watch --fail-fast=false
```

Bloquea hasta que todos los checks resuelvan; no aborta al primer fallo. Llamada
foreground: pasarle `timeout: 600000` al tool Bash (su default es 120000). Después,
el detalle por check:

```bash
gh pr checks <n> --json name,state,bucket
```

- Exit `0` (todos en `bucket=pass`) → **Phase 5** (reportar y parar).
- Algún check en `fail` → **Phase 4** (fix loop).
- El `--watch` foreground muere al tope de la tool Bash (600000 ms; exit 143 — les
  pasa a las suites E2E largas). Si expira: **NO re-bloquees con otro `--watch`**.
  Montá la variante PR-checks del watcher asíncrono — **contrato canónico en
  [[merge-when-green]] § «Cierre asíncrono de CI»; leé SÓLO esa sección y no ejecutes
  ninguna otra fase de esa skill** — con `NEXT:` verde = «reportar `PR URL` + `CI: ✅`
  y parar (pr-green Phase 5)» / rojo = «pr-green Phase 4 (fix loop)». Reportá
  `⏸️ CI en vuelo — CI-MONITOR [<repo>#<n>] montado` y cortá el turno.
- PR **sin checks** (repo sin CI en esa rama; el registro lo dice con `ci=none`) →
  decilo (`sin checks; no hay verde que esperar`) y terminá: no hay nada que arreglar
  ni nada que afirmar.

## Phase 4 — Fix loop (máx `MAX_ITER` iteraciones)

Por cada check en `fail`, clasificalo:

- **Test jobs**: `backend-tests` (pytest), `frontend-unit-tests` (jest),
  `frontend-e2e-tests` (playwright, sharded).
- **Gates no-test**: `test-quality-gate`, `design-tokens-guard`,
  `e2e-flow-definitions-sync`, `shellcheck`, `yaml-validation`, `config-integrity`, y
  los agregadores `coverage-summary` / `e2e-merge-reports`.

**Si falla un gate no-test:** con `FIX_NONTEST=0` (default) → **frená y reportá** el
gate + su log (`gh run view <run-id> --log-failed`); no lo intentes arreglar, y dejá
en `## Next steps` el comando local equivalente (ej.
`npm run check:design-tokens:strict`). Con `FIX_NONTEST=1` → intentá el arreglo
directo (reemplazar el color-literal, regenerar `flow-definitions.json` con
`npm run ci:e2e-flow-summary`), commiteá y volvé a Phase 3.

**Si fallan test jobs:**
1. Traé los logs del run fallido: `gh run view <run-id> --log-failed` (el `<run-id>`
   sale del `link` del check o de `gh run list --branch <branch literal del registro> --limit 1`).
2. **Extraé los IDs concretos** de los tests fallidos: pytest → líneas
   `FAILED path/test_x.py::TestClase::test_y` · jest → `describe > it` + el archivo
   `.spec/.test` · playwright → el spec `e2e/xxx.spec.ts` + título del test.
3. Invocá **`/fix-broken-tests`** pasándole ESA lista (corre sólo esos tests +
   regresión del módulo, nunca la suite completa). Respeta sus estándares
   (`docs/TESTING_QUALITY_STANDARDS.md`).
4. **Aprobación de código de prod**: si `fix-broken-tests` reporta que tuvo que tocar
   **código de producción** (fila ⚠️ en su output) y `AUTONOMOUS=0` (default),
   **PAUSÁ**: mostrá el cambio propuesto y pedí aprobación antes de commitear. Con
   `AUTONOMOUS=1`, seguí sin pausar.
5. Commiteá el arreglo (`git commit -m "fix: <test> …"`) + `git push` **a TU rama**.
   Volvé a **Phase 3**.
6. Contá la iteración. Si superás `MAX_ITER` sin verde → frená y reportá el estado
   (qué sigue rojo, hipótesis, comando exacto para el próximo intento).

Arreglá **sólo lo atribuible a tu cambio**: un rojo ajeno o pre-existente se reporta
como tal, no se arrastra a tu PR.

## Phase 5 — PARÁ

Con el CI en verde la entrega está hecha: reportá `PR URL: <url>` y `CI: ✅`, y **no
sigas**.

- **NO** `gh pr merge`, **NO** `/merge-when-green`, **NO** ningún otro camino a un
  merge: el merge no es de la sesión.
- **NO** tocar el clon principal (ni `checkout`, ni `pull` no-ff, ni "dejar la base al
  día") **ni** retirar el worktree acá: con el PR abierto la queue puede necesitarlo.
- **Quién mergea:** [[merge-queue]] (drenaje ordenado) o el operador a mano
  ([[merge-when-green]], manual-only). Si la queue te delega por mensaje un conflicto
  o un check rojo, resolvelo en TU worktree y pusheá — la señal de resuelto es el
  push, no una respuesta.
- **Rama release:** exactamente lo mismo. Su lanzamiento lo autoriza el operador con
  `release_merge:` en `projects.yml`; una sesión jamás la mergea ni lo ofrece.
- **Veredicto de cierre:** `/all-in-base --check-only` dice si el trabajo quedó
  ENTREGADO sin mutar nada. El retiro del worktree lo hace `/all-in-base` recién
  cuando el PR YA mergeó.

## Safety rules

- **Jamás mergea**: no hay fase de merge ni flag que la habilite.
- **Jamás force push** (denegado en el fleet) ni `git reset --hard`.
- **Jamás toca el clon principal** — ni `checkout`, ni `commit`, ni `stash`, ni `pull`
  sin `--ff-only`. Un hook `PreToolUse` lo deniega igual; la regla vale aunque el hook
  no esté instalado.
- **Jamás stashea**: el trabajo en curso se commitea en TU rama, que es tuya.
- **Jamás toca la rama ni el worktree de otra sesión.**
- Nunca en cron/headless.
- `TaskStop` sólo sobre watchers `CI-MONITOR [...]` **propios** y obsoletos
  (confirmados `completed` con UN `gh run view <id> --json status` antes de matar). En
  duda: reportar, no matar.

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos (gating
[[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| --fix-nontest | deja que el fix loop arregle también los gates no-test rojos (lint/quality-gate) | `/pr-green --fix-nontest` |
| Ver el PR en el browser | review manual del PR entregado | `gh pr view <n> --web` |
| Veredicto de cierre | responde si el trabajo de la sesión quedó ENTREGADO, sin mutar nada | `/all-in-base --check-only` |

NUNCA se ofrece una fila de merge (blocklist [[_output-protocol]] §4): esta skill no
mergea y el drenaje es de [[merge-queue]]/operador. `--autonomous` tampoco se ofrece
(quita la pausa de aprobación del fix loop): se tipea a propósito.

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill:

```markdown
🟢 pr-green — PR #<n> verde, listo para drenar (sin merge)
(🟡 con warnings · 🔴 si el CI sigue rojo tras el fix loop · ⏸️ si el CI quedó en
vuelo o se pasó --no-wait · ⏭️ si el trabajo ya estaba en la base)

| Dimensión | Estado | Detalle |
|---|---|---|
| Worktree | ✅ | ~/webapps/.wt/<repo>/<slug> · rama <rama> · base <base> |
| Commit | ✅ | <sha> — <mensaje> (⏭️ si no había nada que commitear) |
| Push | ✅ | <rama> → origin |
| PR | ✅ | #<n> — <url> (base: <base>) |
| CI | ✅ | N/N en verde (pytest, jest, playwright, gates) |
| Fix loop | ⏭️ | no hizo falta (o: N iteración(es), tests <ids>) |
```

Fila condicional `Monitor CI` (👁️ montado + label / 🧹 N barridos) sólo si Phase 3
montó o barrió watchers.

`## Next steps` — sólo accionables:
- `(operador) /merge-queue` — drenar la cola de este repo cuando corresponda.
- `/all-in-base --check-only` — veredicto de cierre de la sesión.
- Si [[merge-queue]] te delega un conflicto o un rojo → `/pr-green` otra vez (entra
  por Phase 4).
- Gate no-test rojo sin `--fix-nontest` → el comando local para reproducirlo.
