---
name: "responsive-pass"
description: "Mejora continua de responsividad de UN módulo (o una pestaña) de un proyecto del fleet, verificada por $qa. Usar cuando el operador dice 'mejorá la responsividad del módulo X', 'X se rompe en celular/tableta', 'pasada responsive de la pestaña Y', 'el panel no se ve bien en tablet vertical', 'hacé responsive el módulo X', 'revisá cómo queda X en 835/412'. Procedimiento fijo y comparable entre corridas: inventario (estático + en vivo a 412/835/1195/1440/2560, tableta vertical obligatoria) → contraste contra docs/RESPONSIVE_STANDARDS.md → hallazgos por tipo de elemento → propuesta → aplicación (--apply: rama de sesión + PR) → handoff a $qa (flows declarados + guion brief-e2e por ancho) → registro en config/responsive-ledger/. Default diagnóstico. NO usar para escribir/correr tests ni validar un fix ($qa); para ver, validar o debuggear cómo queda la UI a un ancho SIN corregir nada ($playwright-validation); para rediseño visual o cambios funcionales (fuera de alcance: quedan como observaciones); para 'toda la app' de una vez (rechazado: propone el orden por módulo); para un bug funcional ($debug). Sin estándar canónico no corrige (inventaría y propone definirlo); si sólo falta la copia del repo, contrasta contra el canónico del toolkit y pide el sync. Un módulo por corrida, siempre."
---

# Responsive module — un módulo por corrida

Sos el responsable de responsividad de UN módulo de un proyecto del fleet. Tu salida es
**hallazgos contrastados contra el estándar + cambios acotados al módulo + un guion de
pruebas por ancho para $qa** — no un rediseño, no una suite de tests, no una pasada por
toda la app. La secuencia de fases es fija (Fase 0 → 6) para que dos corridas sean
comparables, y **la verificación la hace `$qa`, nunca esta skill**: una skill que se da por
buena a sí misma no está verificando nada.

**Declaración de alcance — se imprime SIEMPRE antes de la Fase 1:**

> 🎯 responsive-pass — `<proyecto>` → módulo `<id>` · modo `<diagnóstico|aplicar>` ·
> anchos `compact` 412×915 · `portrait` 835×1194 (atención especial) · `landscape` 1195×835 ·
> `desktop` 1440×900 · `wide` 2560×1440. Esta corrida trabaja UN módulo y NO barre la app;
> el resto queda en el ledger (`N` pendientes; próximo sugerido: `<id>`).

Un pedido de "toda la app" se rechaza en esa misma línea y se responde con el orden propuesto
(la lista del ledger, Fase 0): un módulo por corrida, el siguiente en `## Next steps`.

## Cómo invocar este skill

Gating ($output-protocol §4): (1) `--module=` explícito (con o sin `--apply`) → ejecutar
directo, sin menú; (2) intención clara en la sesión ("el panel de contabilidad se rompe en
tablet") → proponer en una línea `$responsive-pass <proyecto> --module=<id>` y esperar
confirmación, sin picker; (3) `$responsive-pass` pelado o pedido difuso ("mejorá la
responsividad") → UNA sola AskUserQuestion con Q1+Q2+Q3 fusionadas; (4) jamás en
fleet/headless/cron — esta skill no tiene modo fleet: `--all-repos`/`--all-vps` son error
duro; (5) máx 4 opciones por pregunta, lo que no entra se tipea en "Other" (el id del módulo)
o va a `## Next steps`; (6) Q1/Q2/Q3 son selección única a propósito — un módulo por corrida,
modos excluyentes; (7) un dato faltante posterior (p. ej. las rutas de una pestaña) se pide
en texto plano, ≤3 bullets, nunca un segundo picker; (8) en Codex (sin AskUserQuestion) las
mismas filas se muestran como lista numerada y se espera la respuesta tipeada.

**Antes del picker corre la Fase 0** (el helper del ledger arma las filas de Q1): fila 1 =
`next_suggested` (primer `pending` en el orden del mapa de módulos; si no hay, primer
`diagnosed`; si no, primer `verified` con estándar más viejo que el vigente), marcada
`(Recommended)`; fila 2 = el módulo que nombró la conversación, si hay; fila 3 = el último
módulo tocado que no esté `verified` ("retomar"); fila 4 = el siguiente `pending`. Sin
duplicados; los `verified` vigentes no se ofrecen.

**Q1 — Módulo** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| `<next_suggested>` (Recommended) | próximo pendiente del ledger · `pending` · N flows · N rutas | `$responsive-pass <proyecto> --module=<id>` |
| `<módulo nombrado>` | lo que pidió el operador · estado `<status>` en el ledger | `$responsive-pass <proyecto> --module=<id>` |
| `<último tocado>` (retomar) | corrida `<fecha>` quedó en `<diagnosed\|applied>` · N pendientes | `$responsive-pass <proyecto> --module=<id>` |
| `<siguiente pending>` | siguiente en el orden del mapa | `$responsive-pass <proyecto> --module=<id>` |

**Q2 — Modo** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Diagnóstico (Recommended) | inventario + contraste + propuesta + guion; no escribe en el proyecto; registra en el ledger del toolkit | `$responsive-pass <proyecto> --module=<id>` |
| Aplicar | además edita el módulo en rama de sesión + PR, declara flows en el registro y deja el handoff a $qa | `$responsive-pass <proyecto> --module=<id> --apply` |

**Q3 — Caso no cubierto por el estándar** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Registrar como observación, NO corregir (Recommended) | el hallazgo queda en reporte y ledger con razón `no-cubierto` + propuesta de extensión al estándar | `--uncovered=observe` |
| Criterio conservador documentado | corrige con el criterio más conservador, marcado `[fuera-de-estándar]`, y adjunta la propuesta de extensión | `--uncovered=conservative` |

**Qué NO se pregunta:** los anchos (los fija el estándar; no existe flag); el proyecto (sale
del cwd; el posicional es un override que se tipea); la rama/base (la resuelve
`resolve-work-coordinate.sh` a través del preflight); si correr `$qa` (siempre queda como
Next step, nunca se corre inline); barrer toda la app (rechazado por diseño — se ofrece el
orden, nunca un multiSelect de módulos). `--record-qa` se tipea: es un modo posterior a `$qa`.

## Safety rails — siempre ON

1. **Diagnóstico por default.** Sin `--apply` no se escribe nada en el proyecto: ni
   componentes, ni `data-testid`, ni flows del registro, ni `.testquality.yml`.
2. **Sin estándar canónico no hay corrección.** `standard=no-canonical` (no existe
   `workflows/testing/RESPONSIVE_STANDARDS.md` en el toolkit) ⇒ inventario de roturas + Next
   step "definir el estándar primero"; con `--apply` ⇒ 🚫 REFUSED para la parte de aplicar (el
   inventario se entrega igual). El estándar no se inventa. `absent`/`stale` (la copia del repo
   falta o difiere) NO bloquea: se contrasta contra el canónico del toolkit, la fila Estándar
   queda ⚠️ y el Next step es el sync; bajo `--apply` la copia canónica se agrega a `docs/` en la
   misma rama de sesión (es lo que haría `sync-test-quality-core.sh`).
3. **Sólo responsividad** (regla LÍMITES del estándar §1). Nada de rediseño, features, copy,
   rutas, API, stores, composables de datos ni semántica de flows. Lo que lo requiera es
   **observación**.
4. **Sólo archivos del módulo.** Un componente compartido (header/footer/tabla genérica/
   layout) pertenece al módulo `layout` u otro dueño: observación con puntero, no se toca.
5. **Producción sólo read-only** para el inventario (contrato de $playwright-validation
   §producción): navegar y abrir menús/modales desde triggers no mutantes; nunca fill/submit;
   sesión únicamente desde `.playwright_prod/` si ya existe. Local/staging: lo mismo más
   abrir formularios (sin enviarlos).
6. **`host_status=wrong-host`** ⇒ `--apply` aborta 🚫 y nombra el VPS correcto; el
   diagnóstico puede seguir, marcado ⚠️ y declarado en el veredicto.
7. **Protocolo por sesión.** La edición ocurre en un worktree propio con rama
   `fix/<DDMMYYYY>-responsive-<slug>` cortada de la base resuelta; jamás en el clon principal
   ni sobre la release; PR al primer push con `Sesión:`/`Intención:`. **Nunca se mergea.**
8. **La verificación es de `$qa`.** Esta skill no corre tests ni "verifica" con capturas; el
   único autocontrol es el guard estático del diff (Fase 4).
9. **Ledger sin métricas:** estados + pendientes con razón; se re-inventaría cada corrida;
   commit propio en master del toolkit, nunca mezclado con el commit del proyecto.

## Fase 0 — Preflight (una llamada; los valores viajan en el contexto, nunca se re-ejecuta)

```bash
OPS="$HOME/webapps/vps-ops-toolkit"
PROJ="${ARG_PROYECTO:-$(basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")")}"
bash "$OPS/scripts/qa/qa-agent.sh" --preflight "$PROJ"
#   → projdir · registry · production · staging · layers · app_reachable · resolved_branch · host_status · pr_state
bash "$OPS/scripts/responsive/responsive-ledger.sh" --show "$PROJ" ${MODULE:+--module="$MODULE"}
#   → codebase · ledger · standard (ok|stale|absent|no-canonical) · standard_version · lineage ·
#     responsive_cfg · widths · breakpoints · project_doc · viewport_helper · module_source ·
#     modules=[id:status,…] · next_suggested · ledger_orphans ·
#     (con --module) module_known · module_status · tabs · module_paths · module_routes · module_flows
```

Qué se decide con cada clave:

- **Del preflight de `$qa`** (no se reimplementa): `projdir`, `app_reachable`, `resolved_branch`,
  `host_status`, `pr_state`, `registry`, `layers`. `abstain=yes` NO abstiene esta skill (no
  necesita infra de tests); sólo degrada el handoff: sin capa `frontend-e2e` ⇒ `Handoff QA ⏭️`
  y el estado final de un `--apply` es `applied`, no `qa-pending`. `registry=absent` ⇒
  coordenada no confiable: `--apply` sólo con confirmación explícita de la rama.
- **Sonda propia de producción** cuando `app_reachable=no` y `production=yes` (el preflight de
  `$qa` nunca sondea prod): `curl -fsS --max-time 8 https://<domain>/api/health/` →
  `inventory_target=prod-readonly:<url>`. Si no, `inventory_target` = `local:<port>` /
  `staging:<url>` del preflight, o `none`.
- **`standard`**: `ok` sigue · `stale`/`absent` ⇒ se usa el canónico
  `$OPS/workflows/testing/RESPONSIVE_STANDARDS.md`, fila ⚠️ y Next step
  `bash $OPS/scripts/maintenance/sync-test-quality-core.sh --apply --project=<proyecto>` ·
  `no-canonical` ⇒ rail 2.
- **`project_doc`** (p. ej. projectapp `docs/methodology/responsive-standard.md`): es el
  contrato de **CÓMO** corregir dentro de su alcance (componentes, variantes, patrones); el
  canónico fija el **QUÉ** (invariantes). Se lee UNA vez en la Fase 2.
- **`responsive_cfg=no`** ⇒ breakpoints por default del framework (Tailwind: sm 640 · md 768 ·
  lg 1024 · xl 1280 · 2xl 1536) y mapa de módulos derivado (`module_source`); se declara en
  el reporte. Un proyecto con tema custom se detecta en la Fase 1 (`globals.css` /
  `tailwind.config.*`) y se propone el override.
- **Módulo**: `module_known=no` ⇒ pregunta en texto (≤3 bullets: qué módulos existen, cómo se
  llaman, cuál se sugiere). Un módulo con `tabs=[…]` (>40 flows, segmentos de ≥5) se trabaja
  por pestaña: si el operador pasó sólo `admin`, se propone `admin/<pestaña con más flows>` en
  la misma línea y se espera confirmación. `ledger_orphans` (módulos del ledger que ya no
  existen) se corrigen en la Fase 6 de esta misma corrida.
- **Rutas**: `module_routes` (cap 6: índice/listado → detalle → formulario/modal). Sin rutas
  derivables ⇒ se piden en el mismo texto. Un módulo grande sin pestañas (más rutas que el cap)
  se trabaja en **corridas sucesivas por grupos de rutas**: las rutas que quedan fuera se listan
  en el reporte y en `observations` del ledger ("corrida N: rutas pendientes …"), nunca se
  leen "de pasada".

Cierra imprimiendo la declaración de alcance.

## Fase 1 — Inventario (una sola lectura, dos fuentes)

**1a. Estático.** UN `grep -nE` sobre los archivos de `module_paths` (extensiones
vue/tsx/jsx/ts/js/css/scss; sin `*.test.*`, `*.spec.*`, `__tests__/`, `e2e/`):

```bash
grep -rnE --include='*.vue' --include='*.tsx' --include='*.jsx' --include='*.ts' --include='*.js' --include='*.css' --include='*.scss' \
  '(^|[^a-z-])(sm|md|lg|xl|2xl|panel-[a-z]+|tablet):|@media|useBreakpoint|useMediaQuery|innerWidth|matchMedia|<table|<(U|Data|El|V|Base(Responsive)?)Table|overflow-(x|y|auto|hidden|scroll)|w-\[[0-9]+px\]|min-w-\[|grid-cols-[0-9]|(^|\s)hidden(\s|")|flex-nowrap|whitespace-nowrap|truncate|<(Modal|Drawer|Dialog|USlideover|Sheet|Popover|Base(Modal|Drawer))|position: ?fixed|(^|\s)(fixed|sticky)(\s|")' \
  <module_paths> | grep -vE '\.(test|spec)\.|__tests__/|/e2e/'
```

Luego `Read` UNA vez: los page/view files de las rutas + los componentes que el grep marcó
(cap orientativo 20 archivos; muchos más ⇒ proponer partir en pestañas, nunca leer de a pedazos). Se anotan `file:line` de:
breakpoints usados (y su px efectivo según `breakpoints`), tablas, formularios,
modales/drawers, media, anchos fijos, `hidden`/`nowrap`/`truncate`, lógica JS de viewport
(`innerWidth`/`matchMedia` sólo en mount ⇒ en 1b hay que recargar tras `browser_resize`).

**1b. En vivo** — sólo con `inventory_target ≠ none`. Pre-flight A–E de
$playwright-validation por referencia (entorno, sesión en `.playwright_<env>/sessions/`,
URL = `inventory_target`, artefactos en `/tmp/playwright-mcp-<proj>/<RUN_ID>`). Por ruta (≤6)
y por ancho (5; **`portrait` 835×1194 primero y obligatorio**): `browser_resize` → recarga si
1a lo indica → `browser_snapshot` → sonda de overflow (`browser_evaluate`, read-only) →
`browser_take_screenshot` sólo cuando hay rotura (evidencia). En `compact` y `portrait`
además la sonda de targets táctiles (44 px). Modales/drawers se abren desde triggers no
mutantes. Sin sesión válida para una ruta ⇒ ⏸️ esa ruta, sigue el resto.

```js
// overflow horizontal + primeros 8 elementos que se salen (read-only)
(() => { const de = document.documentElement; const over = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > de.clientWidth + 1; }).slice(0, 8).map(e => e.tagName.toLowerCase() + (e.dataset.testid ? `[data-testid=${e.dataset.testid}]` : '') + '.' + [...e.classList].slice(0, 3).join('.')); return { vw: de.clientWidth, sw: de.scrollWidth, hOverflow: de.scrollWidth > de.clientWidth, over }; })()
// targets táctiles menores a 44 px (read-only)
(() => [...document.querySelectorAll('a,button,[role=button],input,select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); }).slice(0, 8).map(e => e.dataset.testid || e.getAttribute('aria-label') || e.textContent.trim().slice(0, 20)))()
```

**Salida de la fase** (viaja a las siguientes; no se recalcula): matriz `ruta × ancho` con ✅ /
`F<n>` / ⏸️, y la lista de evidencias `file:line` + salidas de sonda en texto. Las capturas son
material de trabajo, no entregable: se borran al cierre (§cleanup de playwright-validation).
`inventory_target=none` ⇒ sólo 1a, fila `Inventario en vivo ⏭️` y Next step (`$dev-up` en la
dev machine o la URL de staging); nunca un ❌. Misma degradación si `browser_navigate` falla
porque el host no tiene navegador (caso típico en un VPS: el MCP de Playwright sin Chromium):
se declara `inventario en vivo: sin navegador en <host>` y el Next step es correr la misma
invocación desde la dev machine. **Nunca** `playwright install` ni ningún cambio del sistema.

## Fase 2 — Contraste contra el estándar

`Read` UNA vez el estándar (`docs/RESPONSIVE_STANDARDS.md` del proyecto si `standard=ok`; si
no, el canónico del toolkit), `project_doc` si existe, y las claves `responsive_*` de
`.testquality.yml`. Cada rotura de la Fase 1 se vuelve un hallazgo `R-<module>-NN`:

| ID | Tipo | Invariante | Ancho(s) | Severidad | Evidencia | Clase |
|---|---|---|---|---|---|---|

- **Tipo** (fijo, siempre los mismos 9 del estándar §3): NAV · LAY · TAB · FORM · MOD · MED ·
  TIP · TAC · CON.
- **Severidad** (estándar §4): bloqueante (contenido o acción inalcanzable) · mayor (usable con
  fricción) · menor (estético).
- **Clase:** `corregible` (cubierto por el estándar, sin cambio funcional, dentro de
  `module_paths`) · `observación` (exige cambio funcional/rediseño, toca un componente
  compartido, o contradice el `project_doc`) · `no-cubierto` (el estándar no lo contempla ⇒
  política `--uncovered`, default `observe`).

Sin estándar canónico (`no-canonical`): la tabla se entrega sin Invariante/Clase bajo el
título "Inventario de roturas" y la corrida salta a la Fase 6 con el módulo en `pending`.

## Fase 3 — Propuesta

Por hallazgo `corregible`: qué cambia (clase/markup/CSS, usando las variantes y componentes del
`project_doc` cuando el módulo cae en su alcance — projectapp `/panel/**`: `panel-*` +
`BaseResponsiveTable`/`BaseResponsiveTabs`, nunca Tailwind crudo), en qué `file:line`, qué
ancho(s) arregla, y riesgo (¿el archivo lo usa otro módulo? ⇒ observación con el módulo
dueño). Agregar `data-testid` / `aria-label` a los elementos que el guion va a usar ES parte
de la propuesta (markup inerte que habilita a `$qa`). Las observaciones van en lista aparte
con su razón. Los `no-cubierto` llevan su propuesta de extensión del estándar (1–2 líneas por
regla, para un PR al canónico `workflows/testing/RESPONSIVE_STANDARDS.md`). En diagnóstico,
de acá se salta a la Fase 5 (sin escribir).

## Fase 4 — Aplicar (sólo `--apply`)

Precondiciones: `standard≠no-canonical` · `host_status≠wrong-host` · identidad git
(`git var GIT_COMMITTER_IDENT`; si falla, `user.name`/`user.email` repo-local, nunca
`--global`) · tree limpio en el clon. Rama y worktree por el protocolo por sesión del
CLAUDE.md del proyecto (`git-branch-protocol`); si la sesión YA tiene su worktree/rama, se
reutiliza:

```bash
TODAY=$(date +%d%m%Y); REPO="$PROJ"; SLUG="<module-slug>"      # admin/accounting → admin-accounting
BASE="<resolved_branch si pr_state=single; main/master si no>"
cd "$HOME/webapps/$REPO" && git fetch origin "$BASE" --quiet
git worktree add "$HOME/webapps/.wt/$REPO/responsive-$SLUG" -b "fix/${TODAY}-responsive-${SLUG}" "origin/$BASE"
cd "$HOME/webapps/.wt/$REPO/responsive-$SLUG" && git rev-parse --show-toplevel   # debe caer bajo ~/webapps/.wt/
```

Edición: sólo los `file:line` de la propuesta; sin dependencias nuevas; sin tocar `*store*`,
`composables/use*Api*`, `api/`, `router`, `middleware`, `server/`, `backend/`. Si falta el
helper de anchos (`viewport_helper`), se crea con el contenido del estándar §5 (re-exportando
los viewports del proyecto si ya existen en código). Si `standard=absent|stale`, se copia el
canónico a `docs/RESPONSIVE_STANDARDS.md` en la misma rama. Si `.testquality.yml` no tiene ninguna
clave `responsive_`, se anexa el bloque comentado del estándar §9 descomentando sólo lo que la
corrida necesitó. **Guard estático antes de commitear:** `git diff --name-only` ⊆
`module_paths` ∪ {helper, `.testquality.yml`, archivos del registro de flows} y sin esos
patrones; si falla ⇒ `git checkout -- <archivo>` y el hallazgo pasa a observación (❌ sólo si no
se puede aislar). No se corre la app desde el worktree ni se "verifica" con capturas: el dev
server sirve el clon principal o staging, no este tree.

Después la Fase 5a (flows) en el mismo tree, y UN solo commit:

```bash
git add <archivos del módulo> <helper> <.testquality.yml> <shards/docs de flows regenerados>
git commit -m "fix(responsive): <module> — <qué arregla, ≤60 chars>"
git push -u origin "fix/${TODAY}-responsive-${SLUG}"
gh pr create --base "$BASE" --title "fix(responsive): <module>" --body "$(printf 'Sesión: %s\nIntención: responsive %s — %s hallazgos corregidos\n\n%s' '<sesión>' '<module>' '<N>' '<R-… → archivo, por línea>')"
```

`PR URL:` va al reporte. Sin merge.

## Fase 5 — Handoff a $qa (flows + guion)

**5a. Flows** (escritura sólo bajo `--apply`; en diagnóstico van al reporte como "flows a
declarar"). El comportamiento responsive pertenece al flow funcional dueño: se ACTUALIZA el
flow existente (se agrega `display`/`success` a `outcomes` si falta y una frase en
`description` con el ancho y el valor esperado). Flow nuevo `<flow-base>-<alias>` o
`<module>-<elemento>-<alias>` sólo para un comportamiento sin dueño (drawer/hamburguesa,
toggle tabla→tarjetas, bottom-sheet), siempre con `expectedSpecs: 0` — nunca un módulo
`responsive` ni un flow "viewport" (estándar §6 y §8).

- Layout sharded (`.testquality.yml → flow_definitions_dir`): shard
  `frontend/<frontend_e2e_dir>/<dir>/<id>.json`; `_meta.json` (`version` patch +1,
  `lastUpdated` = hoy); si existe `docs/user-flows/`, doc `<id>.md` + id en la sección del
  módulo de `_assembly.json`; regenerar derivados con la copia del repo:
  `python3 scripts/generate_flow_registry.py --repo-root .` y luego `--check` (jamás editar
  `flow-tags.js` / `USER_FLOW_MAP.md` a mano).
- Monolito: `frontend/<frontend_e2e_dir>/flow-definitions.json` → `flows["<id>"]` +
  `lastUpdated` + constante en el `flow-tags` autorado con el idioma del archivo; si existe un
  `flow-definitions.schema.json` sin `outcomes`/`expectedSpecs`, extenderlo en el mismo commit.
- `priority`: P2 si el hallazgo era bloqueante, P3 si no; `roles` = los del módulo.

**5b. Guion de pruebas por ancho** — bloque ```` ```brief-e2e ```` con la forma exacta del
Architect de `$qa` (`~/.claude/agents/qa-architect.md`), un ítem por comportamiento×ancho,
conductual (actúa + afirma un valor concreto + nombra el bug) y ubicado en el módulo dueño.
Obligatorios: un ítem por hallazgo corregido bloqueante/mayor, y uno por comportamiento que
el estándar exige en `portrait` aunque ya estuviera bien (blindaje).

```brief-e2e
E1 · flow/behavior: platform-documents-list @835x1194 — la tabla de documentos es navegable sin overflow y conserva sus columnas · outcome_class: display
   · target: frontend/e2e/platform/platform-documents.spec.js (extender con describe '@ 835 (tableta vertical)' + test.use(viewportUse('portrait')))
   · assertion: click [data-testid=platform-nav-documents]; expect(rows).toHaveCount(<N del fixture>); expect(first row).toContainText('<valor>'); expect(scrollWidth <= innerWidth).toBe(true)
   · bug: la tabla vuelve a desbordar en tableta vertical (regresión de R-platform-02)
   · evidence: frontend/components/platform/DocumentsTable.vue:41 (wrapper overflow-x-auto, commit <sha>) · frontend/pages/platform/documents/index.vue:12
   · traps: setViewportSize NO es interacción (junk `no_user_interaction`) — el ítem incluye el click · el sidebar renderiza el nav 2× (desktop/drawer): no pinear counts globales
```

Cierra con `PRECONDITIONS: none | selector-convention required (e2e bounded)` si el módulo no
tiene selectores estables y no se pudieron agregar, y `HANDOFF: $qa <proyecto> --apply --layers=e2e`.

**5c. Puntero para `$qa`** (sólo `--apply`; toolkit): una línea en `watchlist` de
`config/qa-memory/<codebase>.yml` — `"RESPONSIVE pending (<fecha>): flows [<ids>] declarados por
responsive-pass para <module>; guion en docs/audits/<reporte>"` (respetar el cap de 10; la
memoria sólo ADD work). `$qa` la lee en su Fase 0 y el Architect toma el guion como hipótesis
a re-verificar. `--record-qa` la retira.

**5d.** Next step literal: `$qa <proyecto> --apply --layers=e2e`. `$qa` mide los flows declarados
como `missing/partial`, autoría conductual a esos anchos, corre Playwright en vivo (su Fase 5b)
y devuelve su veredicto. Misma sesión ⇒ el PR de QA se apila sobre `fix/…-responsive-…` (para
que su CI vea el fix); sin app que sirva el fix, sus specs quedan `draft-unvalidated` y se
validan en el siguiente `$qa --apply` — estado previsto por `$qa`, no un error.

## Fase 6 — Registro + reporte (en cualquier modo; registrar no es escribir en el proyecto)

1. **Reporte de la corrida** (Write, toolkit):
   `docs/audits/<YYYY-MM-DD>-<proyecto>-responsive-<module-slug>.md` (misma fecha ⇒ sufijo
   `-2`, `-3`; nunca `.bak.md`), secciones fijas: Alcance · Preflight (estándar versión/sync,
   `inventory_target`, coordenada) · Inventario (matriz ruta×ancho) · Hallazgos por tipo (tabla
   `R-…`) · Cambios aplicados (archivo:línea, commit, PR URL) · Observaciones fuera de alcance ·
   Flows declarados/a declarar · Guion de pruebas (bloque brief-e2e) · Pendientes con razón ·
   Propuesta de extensión al estándar (si hubo `no-cubierto`). El reporte es inmutable; el
   veredicto de QA vive en el ledger.
2. **Ledger** (schema y reglas: `config/responsive-ledger/README.md`):

```bash
bash "$OPS/scripts/responsive/responsive-ledger.sh" --record "$PROJ" <<'EOF'
module: <id>
status: <diagnosed|applied|qa-pending|blocked>     # pending si no hubo estándar
report: docs/audits/<YYYY-MM-DD>-<proyecto>-responsive-<slug>.md
branch: fix/<DDMMYYYY>-responsive-<slug>           # sólo --apply
pr: <url>                                          # sólo --apply
flows_declared: [<ids>]                            # sólo --apply
open_findings:
  - {id: R-<module>-03, tipo: TAB, widths: [portrait], why_pending: "exige ocultar columna → funcional"}
observations:
  - "Header desborda en compact → módulo layout"
EOF
git -C "$OPS" add "config/responsive-ledger/<codebase>.yml" "docs/audits/<reporte>.md" ${WATCHLIST:+config/qa-memory/<codebase>.yml}
git -C "$OPS" commit -m "docs(responsive): record <proyecto> <module> <status>"
```

Commit propio en master del toolkit, nunca mezclado con el commit del proyecto; el push sigue
la cadencia normal del toolkit (`$git-commit`). Mismatch ledger↔repo (`ledger_orphans`, flow
borrado, estándar bumpeado) se corrige en esta misma corrida. Cleanup de artefactos de
Playwright al cerrar.

## `--record-qa` — registrar el veredicto de $qa (modo posterior, se tipea)

```bash
bash "$OPS/scripts/responsive/responsive-ledger.sh" --record-qa "$PROJ" --module=<id>
#   mide: flow_coverage_audit.py --json sobre flows_declared + último docs/audits/<fecha>-<proyecto>-qa.md
#   posterior a la corrida → qa: {status, verdict, live_validation, flows, rejected_because}
```

`qa.status` es **calculado**, nunca tipeado: `verified` ⇔ todos los flows `covered` ∧ veredicto
≠ 🔴 ∧ validación en vivo ≠ no; `verified-unvalidated` si quedaron drafts (Next step: servir la
app + re-`$qa --apply`); `rejected` si algún flow es `junk-only` o `$qa` rechazó un spec del
módulo; `pending` si no hay reporte posterior. Después: retirar la línea `RESPONSIVE pending` del
`watchlist` de qa-memory, subir `expectedSpecs` de los flows `covered` al número medido (en la
rama de sesión del proyecto, nunca en el clon principal) y commit del toolkit
`docs(responsive): record <proyecto> <module> qa=<status>`.

## Contrato con $qa — qué se entrega, qué se espera

| Se le entrega a $qa | Se espera de vuelta |
|---|---|
| Flows del módulo declarados/actualizados en el registro (con `--apply`; en diagnóstico, listados "a declarar") | Veredicto de $qa: 🟢 / 🟡 / 🔴 (línea `**Veredicto:**` de su reporte) |
| Bloque ```brief-e2e `E1..En` con evidencia `file:line` (en el reporte; $qa lo re-verifica como hipótesis, jamás lo copia) | Conservación por ítem: `done` / `blocked(brief-conflict)` / `abstained`, con razón |
| Puntero en `watchlist` de qa-memory apuntando al guion | Fila "Validación e2e en vivo": ✅ en `<local\|staging>` o ⏭️ `draft-unvalidated` |
| Cambios aplicados: archivo:línea, commit, PR URL, rama `fix/…-responsive-…` (base para apilar el PR de QA) | Specs nuevos en el módulo dueño (`frontend/<e2e>/<module>/…`), nunca un módulo `responsive` |
| Observaciones fuera de alcance (para que $qa NO las testee) | `rejected_because` del Verifier si un spec es verde-pero-vacío |

## Errores comunes (señales de alarma)

- "Ya que estoy, arreglo también el header / otro módulo" → componente compartido = módulo
  `layout`, otra corrida. Un módulo por corrida.
- "Redimensioné y saqué captura: verificado" → eso es inventario; verifica $qa con un test
  conductual a ese ancho.
- "El dev server ya muestra mi fix" → sirve el clon principal/staging, no el worktree.
- "El estándar no lo dice, elijo lo que se ve mejor" → `--uncovered` (observar por default) +
  propuesta de extensión.
- "Vuelvo a leer el componente para confirmar" → se leyó en la Fase 1; las citas `file:line`
  viajan a las Fases 2–5.
- "Escondo la columna / saco el botón en móvil para que entre" → cambio funcional ⇒ observación.
- "Un `responsive.spec` que chequea que `body` es visible en 5 anchos" → anti-patrón
  Viewport-Only; el test va en el módulo dueño, con interacción.
- "Uso 375 / 768 porque es lo que usa Playwright por default" → los anchos son los del estándar
  (412/835/1195/1440/2560); un ancho fuera de matriz exige `responsive_widths`.
- "Pregunto el modo ahora y el módulo después" → una sola AskUserQuestion fusionada.
- "El PR es chico, lo mergeo" → `$merge-when-green` después de $qa. Nunca acá.
- "Anoto un % de responsividad en el ledger" → estados y pendientes; sin métricas (el helper
  rechaza `score`/`coverage`).
- "Cubro los huecos que las ramas hermanas no cubren" / "el jefe pidió el otro módulo" →
  el alcance es EL módulo, no el complemento del trabajo ajeno; lo demás va al ledger como
  pendiente y a `## Next steps`.
- "Sólo toco UN componente base compartido porque es la raíz del problema" → compartido =
  otro dueño; observación con puntero, aunque sea un `min-w-0`.
- "La condición estaba invertida, lo arreglo de paso" / "ignoro la preferencia guardada" →
  cambio de comportamiento = funcional ⇒ observación (o $debug), nunca bajo `--apply`.
- "Actualizo los tests unitarios para que reflejen el cambio" → esta skill no toca
  `*.test.*` ni `*.spec.*`: los tests los escribe $qa a partir del guion.
- "375×667 es donde rompen las grillas" / "tomo las reglas de la rama no mergeada" → los
  anchos y el criterio son los del estándar sincronizado + `project_doc`; nada de ramas ajenas.

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos (gating
$output-protocol §4), UNA AskUserQuestion. `(Recommended)` va en la fila 1 tras un
`--apply` y en la fila 2 tras un diagnóstico:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| QA del módulo | $qa autoría + ejecución en vivo de los E<n>; commitea tests en su propia rama | `$qa <proyecto> --apply --layers=e2e` |
| Aplicar la propuesta | edita el módulo en rama de sesión + PR, declara flows (sólo tras diagnóstico) | `$responsive-pass <proyecto> --module=<id> --apply` |
| Siguiente módulo | diagnóstico del próximo pendiente del ledger | `$responsive-pass <proyecto> --module=<next_suggested>` |
| Reporte para el cliente | reporte no técnico de esta pasada | `$client-report responsividad de <module> en <proyecto>` |

Nunca como fila: merge del PR (`$merge-when-green` va en Next steps), deploy, git destructivo
— blocklist §4.

## Output final

Reportar siguiendo $output-protocol. Plantilla específica de esta skill (el veredicto es
sobre ESTA corrida; el de $qa es una fila aparte):

```markdown
🟢 responsive-pass OK — <proyecto> / <module> (<diagnóstico|aplicado>)

| Dimensión | Estado | Detalle |
|---|---|---|
| Alcance | ✅ | 1 módulo: <id> (<n> rutas) · ledger: N pendientes · siguiente: <id> |
| Estándar | ✅ | docs/RESPONSIVE_STANDARDS.md v<x> · sync ok (⚠️ stale/absent → canónico · 🚫 no-canonical) · project_doc: <sí/no> |
| Inventario estático | ✅ | N archivos leídos 1 vez · N breakpoints · N tablas · N modales |
| Inventario en vivo | ✅ | <local:3000|staging|prod-readonly> · N rutas × 5 anchos (⏭️ sin app · ⏸️ login) |
| Hallazgos por tipo | ℹ️ | bloqueante N · mayor N · menor N — TAB N · FORM N · NAV N · TAC N |
| Cambios aplicados | ✅ | N/N corregibles · commit <sha> · PR #n (⏭️ diagnóstico · ⚠️ N bloqueados) |
| Observaciones fuera de alcance | ℹ️ | N (funcional N · compartido→layout N · no-cubierto N) |
| Handoff QA | ✅ | N flows declarados/actualizados · guion E1..En · watchlist (⏭️ diagnóstico: guion listo) |
| Resultado QA | ⏭️ | lo emite $qa (Next steps); se registra con --record-qa |
| Registro | ✅ | ledger <module>=<status> · commit toolkit <sha> |
| Pendientes con razón | ℹ️ | R-…-03 TAB@portrait → funcional · R-…-05 → estándar no cubre |

## Next steps
- `$qa <proyecto> --apply --layers=e2e` — guion en `docs/audits/<reporte>`; PR de QA apilado sobre `fix/…-responsive-<slug>`
- (operador, dev) `cd ~/webapps/.wt/<repo>/responsive-<slug>/frontend && npm ci && npm run dev` — app con el fix para la validación en vivo de $qa
- `$responsive-pass <proyecto> --module=<id> --record-qa` — tras $qa: registra el veredicto medido en el ledger
- `$responsive-pass <proyecto> --module=<next_suggested>` — siguiente módulo
- (tras QA) `$merge-when-green` — integrar el PR responsive (y el de QA) con CI verde
```

Casos de veredicto:

- 🟢 corrida completa: estándar vigente, inventario hecho (estático y, con app, en vivo),
  corregibles aplicados (o propuestos en diagnóstico), handoff escrito, ledger registrado. En
  diagnóstico, N hallazgos NO bajan el veredicto: son el producto.
- 🟡 estándar `stale`/`absent` (se usó el canónico; falta el sync); inventario en vivo parcial (⏸️ login en alguna ruta); corregibles
  bloqueados; `--uncovered=conservative` usado; `registry=absent`; sin capa e2e (handoff ⏭️,
  estado `applied`); diagnóstico en `wrong-host`; `responsive_cfg=no` con tema custom detectado.
- 🔴 guard del diff disparado sin poder aislar; `generate_flow_registry.py --check` falló;
  push/PR fallido; helper del ledger ausente o con error.
- 🚫 `--apply` sin estándar canónico (`no-canonical`), o `--apply` en `wrong-host` (el diagnóstico se entrega igual).
- ⏸️ el inventario en vivo exige login interactivo en todas las rutas (se entrega el estático).
- ⏭️ módulo no identificable tras la pregunta en texto (no se escribe nada).
