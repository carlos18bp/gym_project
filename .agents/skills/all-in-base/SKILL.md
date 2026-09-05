---
name: "all-in-base"
description: "Usar al cerrar una sesión de trabajo: '¿ya está todo en main/master?', '¿quedó algo sin mergear?', '¿todo el trabajo de esta sesión ya aterrizó?', '¿puedo cerrar?'. Responde SÍ/NO por repo — default: los repos que ESTA sesión tocó (la lista sale del contexto de la conversación; git la verifica), fallback el repo del cwd — chequeando tree limpio + sin push + PR abierto con CI verde (= ENTREGADO) + contenido en la base (informativo; misma mecánica ya-en-base de merge-when-green, cubre squash). Si el veredicto es NO y no se pasó --check-only, lo TERMINA hasta el DoD de sesión vía $pr-green (commit/push/PR/CI) — NUNCA mergea; el drenaje es de $merge-queue/operador. Una release sin release_merge queda ⏸️, jamás se mergea. NO usar para drenar ramas ajenas a la sesión ($merge-queue) ni para mergear ($merge-when-green es del operador), ni en cron/headless. Sesgo heredado: ante duda dice NO — jamás un SÍ falso."
---

> **⚠️ How to invoke**:
> - Sin argumento: `$all-in-base` → responde la pregunta "¿el trabajo de ESTA sesión
>   está **ENTREGADO**?" — tree limpio ∧ pusheado ∧ (PR abierto con CI verde ∨ ya
>   contenido en la base) — y, si la respuesta es NO, lo termina hasta ese DoD.
>   **"En la base" es informativo**: el merge no es de la sesión.
> - **Alcance default = los repos que esta sesión tocó**: la lista sale del contexto
>   de la conversación (vos sabés qué repos editaste/commiteaste en esta sesión);
>   cada candidato se verifica con `ls -d ~/webapps/<repo>/.git`. Si el contexto no
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
>   censo las ve, van como ℹ️ con puntero a $merge-queue (que es quien drena
>   colas multi-rama).
>
> **Qué significa "terminarlo":** llevar el trabajo hasta el **DoD de sesión** (PR
> abierto + CI verde), nunca hasta el merge. La delegación es decision-complete:
> cada repo pendiente entra a $pr-green por la fase de su primer faltante
> (commit → push → PR → CI), sin re-preguntar. Los guards de coordenada (wrong-host,
> release) son siempre-ON y nunca se saltan: una release sin `release_merge:` queda
> ⏸️ — el veredicto honesto es "NO va a estar en la base hasta que el operador la
> autorice". El **drenaje** (mergear) es de $merge-queue o del operador.

## Cómo invocar este skill

Gating ($output-protocol §4): (1) flags explícitos → directo, sin menú; (2)
intención clara en la sesión ("¿ya quedó todo mergeado?", "¿puedo cerrar?") →
proponer `$all-in-base` en una línea y esperar confirmación; (3) invocación ambigua
→ la única AskUserQuestion es la Q1 de abajo (post-veredicto); (4) nunca en
cron/headless ni dentro de un barrido.

**Q1 — Terminar lo pendiente** (`multiSelect: false`; SÓLO si el veredicto global
es NO y no se pasó `--check-only`):

| label | description | preview |
|---|---|---|
| Terminar lo pendiente (Recommended) | llevar cada repo al DoD de sesión vía $pr-green (commit/push/PR/CI); NO mergea, releases quedan ⏸️ | la columna "Falta" de la tabla |
| Sólo responder | quedarse con el veredicto (equivale a `--check-only`) | `$all-in-base --check-only` |
| Abortar | salir sin tocar nada | — |

**Qué NO se pregunta:** el **merge** — esta skill no mergea nada, ni una release
(lo decide `release_merge:` en projects.yml + el operador; blocklist §4) ni un PR de
sesión (eso es $merge-queue); el método de merge, por lo mismo; qué repos auditar
(lo dicta el contexto de la sesión o el flag). La delegación entra a $pr-green
sin re-abrir su picker (regla (4) de su gating).

## Phase 0 — Alcance + preflight

> **Post-`EnterWorktree`: UN comando simple por llamada.** Adentro de un worktree
> nativo, Claude rechaza el comando con `$(...)`, `{a,b}`, `for`/`while` o heredoc
> con sustitución, y el que apunta al clon compartido (`git -C <clon principal>`,
> `cd <clon principal>`) — se cae el bloque entero. Esta skill no computa nada en
> bash: el censo sale de `session-worktree.sh` y los valores se escriben
> **literales**. Convención completa: `git-branch-protocol` §1 del CLAUDE.md del repo.

**Flags** — los parseás vos leyendo `$ARGUMENTS`; un bucle de parseo sería rechazado:

| Token | Efecto |
|---|---|
| `--check-only` | sólo el veredicto, cero mutación (ni delegación ni sweep de watchers) |
| `--all-repos` | **sólo desde `vps-ops-toolkit`** (error duro fuera): audita `LOCAL_PROJECTS` + toolkit |
| `--all` · `--all-vps` | **ERROR**: no hay eje fleet — no se audita a ciegas en clones de otros VPS. ¿Todo lo pendiente de ESTE host? → `--all-repos` |
| cualquier otro | **ERROR**: argumento desconocido |

```bash
gh auth status
```

`gh` es obligatorio: sin él no se puede afirmar SÍ sobre un squash (merge-tree
necesita la base fresca, y los PRs de la sesión no se pueden consultar). Sin `gh` la
respuesta honesta es **"no evaluable"** — que NUNCA se reporta como SÍ.

Reportá `🎯 all-in-base — check-only=<0|1> all-repos=<0|1>`.

**Armado de la lista de repos:**
- **Default**: enumerá los repos que ESTA sesión tocó — editó, commiteó — según tu
  propio contexto de la conversación. Verificá cada candidato con
  `ls -d ~/webapps/<repo>/.git` (una llamada por repo; `[ -d … ]` en un bucle sería
  rechazado). Si el contexto no identifica ninguno (sesión nueva/resumida): el repo
  del cwd, y decilo en el reporte.
- **Dónde se censa cada repo:** en el **worktree de la sesión**
  (`~/webapps/.wt/<repo>/<slug>`), donde vive su rama — nunca en el clon principal,
  que es el checkout de deploy. El helper resuelve el path solo (Phase 1); si querés
  verlos todos: `session-worktree.sh list --all --porcelain`.
- **`--all-repos`**: corre desde el clon del toolkit (no hay worktree ni gates ahí):
  `source scripts/lib/bootstrap-common.sh` +
  `PROJECT_DEFS_QUIET=1 source scripts/lib/project-definitions.sh` →
  `REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")`.

## Phase 1 — Censo por repo (read-only)

El censo lo hace el helper, que resuelve de una sola vez el worktree, la base de
integración **stacked** (la del PR abierto; si no, la release cuando el resolver
reporta `pr_state=single`; si no, la default), el PR y el `in_base` con las dos capas
de la Phase 1.5 de $merge-when-green (`rev-list --count` + `merge-tree
--write-tree` squash-aware, rc leído sin pipe). **Diferencia deliberada con 1.5:**
allá un tree sucio significa "no evaluable ⇒ seguir el flujo"; acá la pregunta es
"¿está en la base?" y trabajo sin commitear NO está en la base por definición ⇒
**`dirty>0` = NO rotundo**, no abstención.

**a) El repo donde estás parado** (tu worktree de sesión) — un registro completo:

```bash
bash ~/webapps/vps-ops-toolkit/scripts/maintenance/session-worktree.sh status
```

**b) Cualquier otro repo que tocó la sesión** — post-entry no hay `cd` ni
`git -C <clon principal>` que valgan; el helper lo alcanza por nombre y devuelve una
fila por worktree enlazado:

```bash
bash ~/webapps/vps-ops-toolkit/scripts/maintenance/session-worktree.sh list --project=<repo> --porcelain
```

Columnas de `list --porcelain` (14, TSV):
`repo slug path branch dirty unpushed upstream pr pr_state base in_base age_h locked verdict`.
`status` agrega, para TU worktree, `default_branch resolved_branch registered_branch
deploy_branch open_pr pr_state_coord release_merge host_status pr_url ci` — de ahí
salen el hold de release y el estado del CI sin una sola línea de bash propia.

**CI del PR** (sólo hace falta en el caso b; `status` ya trae `ci=`):

```bash
gh pr checks <pr_number literal> --json bucket -q '[.[].bucket] | unique | join(",")'
```

**Variante toolkit** (trunk flow, sin PRs — mecánica T2 de merge-when-green). Es OTRO
repo, así que `git -C` sí está permitido; lo que no se hace nunca es `cd` al clon:

```bash
git -C ~/webapps/vps-ops-toolkit fetch origin master --quiet
```
```bash
git -C ~/webapps/vps-ops-toolkit status --porcelain
```
```bash
git -C ~/webapps/vps-ops-toolkit merge-base --is-ancestor HEAD origin/master
```

Exit `0` de ese último = `ancestor-de-origin/master=yes`; exit `1` = `no`.

**Veredicto por repo (lo clasificás vos con los datos):**
- **✅ ENTREGADO** ⇔ `dirty=0` ∧ `unpushed=0` ∧ (`in_base=yes` ∨ (`pr_state=OPEN` ∧
  `ci=pass`)). El toolkit (trunk, sin PR): tree limpio ∧ ancestor `yes`. **"En la
  base" ya no es requisito**: un PR verde esperando el drenaje ES la entrega de la
  sesión.
- **❌ NO** con la razón acumulada: tree sucio (`dirty>0`) · commits sin push
  (`unpushed>0`) · **sin PR abierto** (`pr_state=none`/`CLOSED`) · **CI rojo o
  pendiente** (`ci=fail|pending`). `in_base` sólo se informa (si es `yes`, alcanza
  para el ✅ aunque el PR ya esté mergeado/cerrado).
- **PR abierto sin checks** (`ci=none` — el repo no corre CI en esa rama) ⇒ se informa
  como **ℹ️ sin checks** y **NO bloquea el ✅**: no hay verde que esperar, así que
  exigirlo dejaría a ese repo en NO para siempre. Misma regla que $pr-green Phase 3.
- **⏸️ NO (hold)**: la rama es release sin `release_merge:`. Con `status` ya lo sabés
  sin consultar nada más: `branch` ∈ `open_pr` (candidatos a release) **y**
  `release_merge` no la nombra (`none` = release en hold). Para el caso b (`list`, que
  no trae esas claves) o si el registro no fuera concluyente, la fuente sigue siendo el
  resolver, con un comando simple:
  `bash ~/webapps/vps-ops-toolkit/scripts/maintenance/resolve-work-coordinate.sh --check <repo>`
  — si `CUR ∈ open_pr` y `release_merge=` no la nombra, es hold. Para un SÍ no hace
  falta el resolver.
- Sesgo heredado de 1.5: `in_base=?` o `ci=?`/`pr_state=?` (git < 2.38, conflicto del
  merge-tree, `gh` caído) ⇒ esa capa no puede afirmar nada ⇒ **nunca SÍ por esa vía**
  (se reporta "no evaluable" con el dato que falte).

## Phase 2 — Tabla de veredicto + la única pregunta

La tabla se muestra SIEMPRE. El veredicto global es **ENTREGADO ⇔ todos los repos
en ✅**.

La columna **En la base** es **informativa** y nombra SIEMPRE la base evaluada —
para una rama de sesión stacked es la RELEASE. Un PR abierto con CI verde ya es
ENTREGADO aunque esa columna diga "ahead N": el drenaje no es de la sesión.

| Repo | Rama | Tree | Sin push | PR | CI | En la base (info) | Entregado | Falta |
|---|---|---|---|---|---|---|---|---|
| projectapp | fix/x | ✅ | 0 | #186 merged | ✅ | vs main: ya-en-base (no-op) | ✅ SÍ | — |
| mimittos_project | chore/y | ❌ 3 arch. | 1 | — | — | vs main: ahead 2 | ❌ NO | commit→push→PR→CI |
| kore_project | feat/z | ✅ | 0 | #61 OPEN | ✅ | vs july-release: ahead 3 | ✅ SÍ | — (drena `$merge-queue`) |
| tuhuella_project_staging | feat/w | ✅ | 0 | #22 OPEN | ❌ | vs release: ahead 1 | ❌ NO | fix loop del CI |
| vastago_project_staging | release-v2 | ✅ | 0 | #12 OPEN | ✅ | vs master: ahead 5 | ⏸️ NO (hold) | `release_merge:` (operador) |

Ramas del repo ajenas a la sesión con trabajo pendiente: fila ℹ️ con puntero a
`$merge-queue` (no entran al veredicto de la sesión).

- `--check-only` → saltá a Output final (el SÍ/NO va en la línea de veredicto).
- Veredicto global SÍ → saltá a Phase 4 (no hay nada que terminar).
- Hay repos NO y sin `--check-only` → **Q1** (specs en "Cómo invocar").

## Phase 3 — Terminar (delegación decision-complete)

Por prosa + wikilink — jamás el tool `Skill`. En orden de la tabla:

- **1 unidad pendiente de ESTA sesión** → ejecutá el flujo de $pr-green
  **entrando por la fase de su primer faltante**: tree sucio → su Phase 1 (commit) ·
  commits sin push → el push de esa misma Phase 1 · sin PR → su Phase 2 · CI
  pendiente o rojo → sus Phases 3-4. **Ahí termina**: `pr-green` no mergea, y esta
  skill tampoco. Sin re-preguntar (regla (4) de su gating: el flujo viene decidido
  del llamador); sus guards (worktree, wrong-host) **nunca se saltan**.
- **≥2 unidades propias** → una corrida de $pr-green **por unidad**, en el orden
  de la tabla (cada una en su worktree). No se agrupan: cada PR es de su sesión.
- **Ramas/PRs ajenos a esta sesión** → ℹ️ con puntero a $merge-queue; esta skill
  no los toca ni los cuenta en el veredicto.
- **≥2 repos pendientes** → repo por repo en el orden de la tabla.
- **Toolkit pendiente** → Path B de $merge-when-green (T1 green gate → T2
  commit+push → T3 propagación → T4): es trunk flow, sin PR, y sigue igual.
- **Release sin autorizar** → queda ⏸️: el hold es del operador. Next step exacto:
  setear `release_merge: <rama>` en projects.yml y que el **operador** corra
  `$merge-when-green`. La sesión no la mergea nunca.

Tras cada delegación, **re-corré el censo de Phase 1 de ese repo** y actualizá la
tabla: el SÍ final se afirma con evidencia, no por haber delegado.

## Phase 4 — Cierre asíncrono (instancia)

Regla completa en $merge-when-green § «Cierre asíncrono de CI». Instancia de
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
3. **Retiro del worktree de sesión** (protocolo por sesión). El worktree se retira
   **sólo cuando el trabajo ya aterrizó** — `pr_state=MERGED` o `in_base=yes` en el
   censo —, no por estar ENTREGADO (con `--check-only`: sólo listarlo como retirable):
   ```bash
   bash ~/webapps/vps-ops-toolkit/scripts/maintenance/session-worktree.sh remove <slug> --project=<repo>
   ```
   Sin `--force`, nunca (el helper no lo tiene). **Git rechaza retirar el worktree en
   el que estás parado**: si el retirable es el TUYO, reportalo como retirable y
   dejalo — lo junta una corrida posterior desde otro tree o el gc del operador.
   `remove` sale `1` si el worktree está sucio: eso se **reporta**, no se fuerza (el
   helper no tiene `--force`, y el hook deniega `git worktree remove --force`).
   **Entregado pero sin mergear** (PR abierto y verde) → **el worktree queda vivo**:
   la cola puede delegarte un conflicto o un rojo y vas a necesitarlo. Lo retira una
   corrida posterior de `$all-in-base` (cuando vea el PR mergeado) o el gc del
   operador (`session-worktree.sh gc --apply`). Decilo así en la tabla
   (`conservado — PR #n abierto`). La rama local obsoleta sigue siendo del operador
   (`-D` manual).

## Safety rules

- Read-only hasta la confirmación de Q1 (o flags explícitos); `--check-only` es
  cero mutación siempre.
- **Jamás mergea nada** — ni un PR de sesión (eso es $merge-queue/operador) ni
  una release sin `release_merge:` (blocklist §4). El hold es el veredicto honesto,
  no un fallo.
- Jamás borra ramas (`-D` es del operador).
- **Sesgo a falso negativo**: un "NO" de más cuesta una mirada; un "SÍ" falso
  cuesta trabajo perdido. Ante cualquier duda (gh caído, git viejo, merge-tree en
  conflicto): NO / no-evaluable.
- TaskStop sólo sobre watchers `CI-MONITOR` propios y obsoletos; en duda,
  reportar en vez de matar.
- Nunca en cron/headless.

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos (gating
$output-protocol §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Terminar lo pendiente | si corrió `--check-only` y el veredicto fue NO; lleva al DoD de sesión (no mergea) | `$all-in-base` |
| Ver un PR puntual | review manual en el browser | `gh pr view <n> --web` |
| Re-censar | refrescar el veredicto tras cambios externos | `$all-in-base --check-only` |

**Nunca se ofrece `$merge-queue` como fila clickeable**: el drenaje es del operador
(o del orquestador), jamás una acción que una sesión elige de un menú. Va como texto
`(operador) $merge-queue` en `## Next steps` — misma lógica que la blocklist
$output-protocol §4 para el merge.

## Output final

Reportar siguiendo $output-protocol.

```markdown
🟢 all-in-base — ENTREGADO: el trabajo de la sesión está pusheado y con PR verde (N repos verificados)
(🟡 si era NO y se terminó ahora — detalle en tabla · ⏸️ si queda una release en
hold · 🔴 si la terminación falló · con --check-only el veredicto va en esta misma
línea, con ⏭️ si no había nada que evaluar)

| Repo | Rama | Tree | Sin push | PR | CI | En la base (info) | Entregado | Worktree | Resultado |
|---|---|---|---|---|---|---|---|---|---|
```

(La columna `Resultado` sólo si corrió Phase 3: qué flujo lo terminó y el SHA/PR.
`Worktree`: `retirado` (PR mergeado / ya-en-base) · `conservado — PR #n abierto` ·
`n/a`. Fila condicional `Monitor CI` / `Sweep` sólo si Phase 4 actuó: 👁️ label
montado por la delegación / 🧹 N watchers barridos.)

`## Next steps` — sólo accionables: **PR verde sin mergear → `(operador)
$merge-queue`** · release en hold → `release_merge:` + `(operador)
$merge-when-green` · ramas locales obsoletas → `git branch -D <rama>` (manual) ·
monitores en vuelo → su ledger (`label → vigila → acción`) + respaldo manual
`gh run watch <id> -R <repo>` · repos ℹ️ con trabajo ajeno → `$merge-queue`.
