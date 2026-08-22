# Estándar de Responsividad (fleet)

<!-- standard_version: 1.0.0 -->
**Versión:** 1.0.0 · **Vigente desde:** 2026-08-22 · **Canónico:** `vps-ops-toolkit/workflows/testing/RESPONSIVE_STANDARDS.md`

> Esta copia (`<proyecto>/docs/RESPONSIVE_STANDARDS.md`) la escribe
> `scripts/maintenance/sync-test-quality-core.sh` y **se sobrescribe en cada sync**.
> Lo que difiere por proyecto se declara en `.testquality.yml` con claves `responsive_*`
> (§9) — nunca editando este archivo. Lo consume la skill `/responsive-pass` (un
> módulo por corrida); la verificación la hace `/qa` bajo `TESTING_QUALITY_STANDARDS.md`.

---

## 1. Propósito y alcance

**Responsividad** = el mismo contenido, las mismas acciones y el mismo flujo, utilizables
en cada ancho de referencia (§2). Una mejora responsiva cambia **cómo se dispone y se
opera** la interfaz a un ancho; nunca cambia **qué** hace.

### Regla LÍMITES (pass/fail)

Cualquier cambio que altere funcionalidad, flujo, contenido, datos mostrados, textos,
marca (colores/tipografías/logos de identidad) o jerarquía de información está **fuera de
alcance** de una corrida responsiva. Se registra como hallazgo con estado `observación`
(§4) y se propone al operador; **nunca se aplica bajo `--apply`**.

| Dentro del alcance | Fuera del alcance (→ observación) |
|---|---|
| Tabla → tarjetas con **las mismas columnas** como pares etiqueta/valor | Quitar una columna "para que quepa" |
| Navegación → drawer/menú con **los mismos ítems y orden** | Esconder un botón o una acción en móvil |
| Modal → pantalla completa / bottom-sheet con **los mismos controles** | Acortar o reescribir un texto |
| Dos columnas → una columna, mismo orden lógico | Cambiar el orden de pasos de un formulario |
| Agregar `data-testid` / `aria-label` (markup inerte para verificar) | Rediseñar colores, tipografías, iconografía |

Otras reglas de alcance:

- **Una corrida = un módulo** (o una pestaña cuando el módulo es muy grande). Un componente
  compartido (header, footer, tabla genérica, layout) pertenece al módulo `layout` u otro
  dueño: se reporta como observación con puntero, no se toca desde otro módulo.
- La **verificación** es un test E2E conductual sujeto íntegramente a
  `TESTING_QUALITY_STANDARDS.md` (DoD de 3 partes + junk gate). Este documento no relaja
  ninguna regla de aquel.
- `playwright-validation` usa los mismos anchos de §2 como presets de `browser_resize`.

---

## 2. Anchos de referencia (fijos)

Matriz de equipos reales (PA-75). Son **viewports de aceptación**: el inventario y los tests
se corren exactamente a estos tamaños, nunca "un poco más o menos".

| Alias | Nombre | Viewport (px) | Dispositivo real de referencia | Tailwind default que gobierna | Por qué este ancho |
|---|---|---|---|---|---|
| `compact` | Celular | **412×915** | Pixel 7 / Galaxy S (Android); iPhone 14 Pro ≈ 393 | ninguno — `< sm` (640): sólo clases sin prefijo | base instalada mayoritaria (Android); piso realista |
| `portrait` | **Tableta vertical — atención especial** | **835×1194** | iPad Air 10.9" / iPad Pro 11" en retrato | `md` (≥ 768) | hereda layouts "de escritorio" (sidebar fijo + grids) con ~835 px útiles: es donde más se rompe el fleet |
| `landscape` | Tableta horizontal | **1195×835** | iPad Air / Pro 11" apaisado | `lg` (≥ 1024) | primer ancho donde conviven sidebar fijo + contenido + paneles laterales |
| `desktop` | Portátil | **1440×900** | MacBook Air/Pro 13–14"; portátiles de 15" | `xl` (≥ 1280) | ancho de trabajo del operador; preset desktop del fleet |
| `wide` | Monitor | **2560×1440** | monitor 27" QHD | `2xl` (≥ 1536) | techo: `max-width`, longitud de línea, "estirado" de tablas y grids |

**Perfiles de referencia** (rangos PA-75, recomendados para proyectos que definen `screens`
propios): `compact < 600` · `portrait 600–999` · `landscape 1000–1279` · `desktop 1280–1919`
· `wide ≥ 1920`. projectapp (panel) los implementa como `panel-portrait`/`panel-landscape`/
`panel-desktop`/`panel-wide` en `frontend/config/responsive.js`. Con Tailwind default los
umbrales son `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536 (min-width, mobile-first).
**Los breakpoints efectivos se declaran por proyecto** (`responsive_breakpoints`, §9); los
anchos de aceptación no.

### Trampas de mapeo

1. **Tailwind v4 declara los breakpoints en `rem`** (40/48/64/80/96 rem = 640/768/1024/1280/1536
   px con root de 16 px; kore/mimittos/xpandia `app/globals.css`). Si el proyecto cambia
   `html { font-size }`, los px se mueven: declarar los px efectivos en `responsive_breakpoints`.
2. **835 ≥ `md`**: la tableta vertical recibe TODO `md:*`. `hidden md:block` muestra el sidebar
   de escritorio y `md:hidden` esconde la barra móvil (projectapp `frontend/layouts/admin.vue`,
   mimittos `app/backoffice/layout.tsx` con `md:ml-[220px]`) dejando ~600 px de contenido —
   NAV-6 lo prohíbe. **1195 ≥ `lg`** y **1440 < `2xl`**.
3. **Variantes custom** (xpandia `--breakpoint-tablet: 900px` → `tablet:` aplica desde 900: en
   `landscape` sí, en `portrait` no) se declaran con su px real y se nombran en los hallazgos con
   su alias real, nunca traducidas a `md`/`lg`.
4. **Banda 768–834 px** (iPad 9.7"/10.2" en retrato) queda **fuera de la matriz** por decisión
   del 2026-08-22. Si un cliente la exige, se agrega por override (`responsive_widths`, alias
   adicional como `portrait-legacy=768x1024`); el estándar no cambia.
5. **Altura**: los altos de la tabla son los del inventario. Los invariantes de altura (MOD-1,
   FORM-4, CON-4) se verifican además con la barra de direcciones móvil visible (alto útil
   ≈ 915 − 110 en `compact`).

---

## 3. Invariantes por tipo de elemento

Checklist contra el que se contrasta cada módulo. Cada invariante tiene un **id estable** para
citarlo en los hallazgos (§4) y está redactado como una frase verificable. "En todos los
anchos" = los cinco de §2 salvo que se indique.

### NAV — Navegación

- **NAV-1** En `compact` y `portrait` la navegación principal se abre con **una** interacción
  (botón con nombre visible o `aria-label`) y el drawer/menú muestra **los mismos ítems, con el
  mismo texto y orden**, que la navegación de escritorio.
- **NAV-2** El control que abre el menú mide ≥ 44×44 px y es alcanzable sin scroll horizontal.
- **NAV-3** Un ítem de navegación se renderiza **visible una sola vez** por ancho; si existen
  variantes por ancho (desktop/tablet/mobile), las no activas están ocultas (`display:none`) y
  los tests las pinean por variante visible, nunca por conteo global (trampa triple-render:
  `config/qa-memory/tuhuella_project.yml`, `header-renders-animales-x3`).
- **NAV-4** Un bottom-nav no cubre contenido interactivo: el último elemento de la página es
  alcanzable con scroll (`padding-bottom` ≥ alto del bottom-nav).
- **NAV-5** El drawer se cierra con botón, tap fuera y tecla Escape; al cerrarse, el foco vuelve
  al control que lo abrió.
- **NAV-6** Sidebar fijo sólo desde `landscape`; en `portrait` nunca un sidebar fijo de ≥ 200 px
  que deje menos de 600 px de contenido.

### LAY — Layout y grid

- **LAY-1** Sin scroll horizontal del documento en ningún ancho:
  `document.documentElement.scrollWidth <= window.innerWidth`. Se asevera como aserción
  **adicional** dentro de un test conductual del ancho, nunca como test propio (§5).
- **LAY-2** Las columnas colapsan en orden de lectura (contenido primario primero); el orden
  visual no invierte el orden semántico del DOM.
- **LAY-3** Ningún elemento `fixed`/`sticky` (header, toolbar, FAB) se superpone a controles
  interactivos en ningún ancho.
- **LAY-4** El texto corrido tiene `max-width` en `desktop`/`wide` (≤ ~75 caracteres por línea);
  tablas y dashboards pueden ser full-width.
- **LAY-5** Padding de página ≥ 16 px en `compact`; ningún elemento toca el borde del viewport.

### TAB — Tablas

- **TAB-1** En `compact` la tabla se presenta como **lista de tarjetas** (una por fila, con los
  mismos campos como pares etiqueta/valor) **o** dentro de un contenedor con scroll horizontal
  **con affordance visible** (sombra/gradiente/indicador) y la **primera columna identificadora
  fija**. Nunca se recorta contenido.
- **TAB-2** En `portrait` la tabla conserva **todas** sus columnas (scroll interno permitido,
  TAB-1); quitar columnas es cambio de contenido (LÍMITES). Un proyecto con contrato propio de
  columnas priorizadas (`responsive_project_doc`, §9) aplica ese contrato: `keep`/`group`
  conservan el dato, `hide` exige declaración explícita.
- **TAB-3** Tarjetas y filas muestran el **mismo N de registros y los mismos valores** que la
  fuente (test: `toHaveCount(N del fixture)` + valor concreto de un registro).
- **TAB-4** Las acciones de fila (select de estado, botones) son operables a cada ancho: objetivo
  ≥ 44×44 px, dentro del viewport o del contenedor con scroll.
- **TAB-5** Paginación y filtros se mantienen visibles y operables en `compact` (pueden agruparse
  en un panel desplegable con nombre accesible).

### FORM — Formularios

- **FORM-1** Inputs a ancho completo en `compact` y `portrait`; etiquetas visibles (no sólo
  `placeholder`) y asociadas (`label for` / `aria-label`).
- **FORM-2** Objetivos táctiles ≥ 44×44 px (botones, checkboxes, radios, chips).
- **FORM-3** `font-size` ≥ 16 px en inputs en `compact` (evita el zoom automático de iOS Safari).
- **FORM-4** El botón de envío es alcanzable con el teclado virtual abierto: no queda bajo un
  elemento fijo y el campo enfocado hace scroll-into-view.
- **FORM-5** Errores y éxito se renderizan junto al campo o en una región `role=alert|status`
  visible sin scroll horizontal; el estado de éxito se puede asertar con un valor concreto.
- **FORM-6** Grupos de campos en varias columnas colapsan a una en `compact` sin perder el orden
  lógico de tabulación.

### MOD — Modales, drawers y bottom-sheets

- **MOD-1** El modal cabe en el viewport (alto ≤ alto útil) y **scrollea por dentro**; el fondo
  no scrollea.
- **MOD-2** El control de cierre está visible sin scroll y mide ≥ 44×44; Escape cierra; el foco
  queda atrapado dentro mientras está abierto.
- **MOD-3** En `compact` un modal con formulario largo puede presentarse como pantalla completa
  o bottom-sheet; los controles y textos son los mismos (LÍMITES).
- **MOD-4** El overlay no deja zonas "muertas": tap fuera cierra o no hace nada, pero nunca
  dispara acciones del fondo.

### MED — Media e imágenes

- **MED-1** `max-width: 100%; height: auto` (o equivalente) en toda imagen, vídeo e iframe; sin overflow.
- **MED-2** Relación de aspecto declarada (`aspect-ratio` o alto reservado) para evitar saltos de
  layout al cargar.
- **MED-3** Gráficos (SVG/canvas) se reescalan o se vuelven scrollables con affordance; nunca se
  recortan etiquetas de ejes ni leyendas.

### TIP — Tipografía

- **TIP-1** Texto base ≥ 14 px en `compact` (≥ 16 px en inputs, FORM-3); un H1 no supera 2 líneas
  en `compact`.
- **TIP-2** Sin truncado (`truncate`, `text-overflow`) que oculte **datos** (identificadores,
  montos, estados, nombres). Truncar es aceptable sólo en texto decorativo, con `title` o tooltip
  accesible.
- **TIP-3** Longitud de línea ≤ ~75 caracteres en texto corrido en `desktop`/`wide` (LAY-4).

### TAC — Interacción táctil

- **TAC-1** Toda affordance `hover`-only (menús desplegables, tooltips con acciones, botones que
  aparecen al pasar el mouse) tiene equivalente por tap/click/teclado en `compact` y `portrait`.
- **TAC-2** Drag-and-drop tiene alternativa sin arrastre (menú o teclado).
- **TAC-3** Gestos horizontales (carruseles, chips scrollables) no secuestran el scroll vertical.
- **TAC-4** Separación entre objetivos táctiles ≥ 8 px.

### CON — Contenido

- **CON-1** Ningún dato visible en `wide` desaparece en `compact`; puede reubicarse (tarjeta,
  acordeón, "ver más") pero sigue alcanzable **por UI** y asertable por valor.
- **CON-2** Estados vacíos, de error y de carga se renderizan completos en todos los anchos (sin
  cortar el CTA).
- **CON-3** Un header sticky no cubre la primera fila/registro tras hacer scroll al inicio; las
  anclas consideran el header (`scroll-margin-top`).
- **CON-4** Toasts y alerts no quedan bajo el bottom-nav ni bajo el teclado; se pueden leer y cerrar.

---

## 4. Clasificación de hallazgos

- **Id:** `R-<module>-NN` (`NN` incremental dentro del módulo; `module` = id del módulo según §9
  o el campo `module` del registro de flows). Único dentro del ledger del proyecto
  (`config/responsive-ledger/<codebase>.yml` en el toolkit).
- **Dimensiones obligatorias:** `tipo` (NAV/LAY/TAB/FORM/MOD/MED/TIP/TAC/CON) · `invariante`
  (p. ej. TAB-1) · `anchos afectados` (alias de §2, al menos uno) · `severidad` · `evidencia` (§5)
  · `propuesta` · `estado` ∈ {`corregido`, `propuesto` (diagnóstico), `observación` (LÍMITES o
  caso no cubierto), `descartado` (con razón)}.

| Severidad | Regla exacta | Ejemplos |
|---|---|---|
| **bloqueante** | Contenido inaccesible o acción imposible a ese ancho: no se puede leer un dato o completar una acción sin zoom ni scroll horizontal del documento | select de estado fuera del viewport en `portrait`; botón de envío bajo el bottom-nav; columna de montos recortada |
| **mayor** | Usable con fricción: exige zoom, scroll horizontal no señalizado, objetivos < 44 px, affordance hover-only o texto < 14 px | botón ✓ de 28 px; tooltip hover-only con acción; tabla scrollable sin affordance |
| **menor** | Estético o de consistencia, sin impacto en lectura ni acción | padding desigual; título a 3 líneas; salto de layout al cargar una imagen |

**Orden de trabajo:** bloqueante en `portrait` y `compact` primero, luego bloqueante en el resto,
luego mayor, luego menor. Una corrida puede cerrar sólo los bloqueantes y dejar el resto como
`propuesto`: se declara en el reporte y en el ledger como pendiente con razón.

---

## 5. Evidencia aceptada

### 5.1 Qué es un hallazgo

Un hallazgo válido tiene **los cuatro**: (1) captura o snapshot de accesibilidad al ancho W
(`browser_resize` a un alias de §2; artefactos bajo el `ARTIFACTS_DIR` de
`playwright-validation`), (2) el elemento (selector por rol/`data-testid` o ruta del componente
`file:line`), (3) el invariante violado (§3) y (4) el o los anchos. Sin los cuatro es una
sospecha, no un hallazgo. La evidencia estática (`file:line` de la clase/markup responsable)
se anota en la misma lectura: un archivo se lee una vez por corrida.

### 5.2 Qué es una corrección verificada

Un **test conductual** en el **módulo dueño** que pasa el junk gate:

1. **actúa** a ese ancho (click/fill/press/selectOption/tap — `INTERACTION_CALLS` del gate;
   `setViewportSize` y `browser_resize` **no** son interacciones),
2. **asserta un valor concreto** (`toHaveCount(N)`, `toHaveText`, `toHaveURL`, `toHaveAttribute`,
   `toBe(valor)`), y
3. **nombra el bug** que atraparía (el id `R-<module>-NN`).

**Prohibido como verificación:** "resize + screenshot + `toBeVisible`" (cae en
`no_user_interaction` + `no_data_assertion`), comparación de píxeles como único assert, y
`// quality: allow-no-interaction` para justificar un test de viewport.

### 5.3 Mecanismo Playwright (único en el fleet)

- `test.use({ viewport, hasTouch })` a nivel `test.describe`, en el spec del módulo dueño o en un
  spec hermano `<módulo>-<elemento>-<alias>.spec.{ts,js}` dentro de la **misma carpeta del
  módulo**. Los anchos se importan del helper canónico (`responsive_viewport_helper`, default
  `frontend/e2e/helpers/viewports.ts` en React/Next y `viewports.js` en Vue/Nuxt).
- Tag informativo `@viewport:<alias>` en el `describe` (`npx playwright test --grep @viewport:portrait`).
  La cobertura la mide el **flow id** (§6), no el tag.
- Un cuerpo que repite el de otro ancho lleva, **dentro del test**,
  `// quality: allow-duplicate (per-viewport contract: <flow> @ <px>)`.
- **No** se usan `projects` de Playwright por dispositivo para toda la suite (multiplican cada spec
  × N anchos; el fleet los tiene comentados por eso), **no** `setViewportSize` a mitad de test
  (carrera con el primer render y anchos mágicos), **no** `isMobile` (no soportado en Firefox y
  altera el escalado).
- **Costo acotado:** un `describe` por ancho con hallazgo corregido, más `portrait` siempre
  (atención especial). Nunca "todos los specs × 5 anchos".

Helper canónico (lo siembra `/responsive-pass` en el primer `--apply` si falta; es propiedad
del proyecto y ningún sync lo pisa; si el proyecto ya expone viewports en código — projectapp
`PANEL_VIEWPORTS` en `frontend/config/responsive.js` — el helper **re-exporta** desde ahí):

```ts
// frontend/e2e/helpers/viewports.ts — anchos de referencia (RESPONSIVE_STANDARDS.md §2, standard_version 1.0.0)
// Overrides: .testquality.yml → responsive_widths. Sembrado por /responsive-pass; propiedad del proyecto.
export const VIEWPORTS = {
  compact:   { width: 412,  height: 915  }, // celular · < sm
  portrait:  { width: 835,  height: 1194 }, // tableta vertical · ≥ md (atención especial)
  landscape: { width: 1195, height: 835  }, // tableta horizontal · ≥ lg
  desktop:   { width: 1440, height: 900  }, // portátil · ≥ xl
  wide:      { width: 2560, height: 1440 }, // monitor · ≥ 2xl
} as const;
export type ViewportAlias = keyof typeof VIEWPORTS;
/** Opciones para test.use(): táctil en celular y tabletas para que locator.tap() exista. */
export function viewportUse(alias: ViewportAlias) {
  const touch = alias === 'compact' || alias === 'portrait' || alias === 'landscape';
  return { viewport: VIEWPORTS[alias], hasTouch: touch };
}
```

Snippet canónico (TypeScript; idioma de tags del fleet: constante del flow + `@outcome` **inline**):

```ts
// frontend/e2e/backoffice/backoffice-orders-table-compact.spec.ts — módulo dueño: backoffice
import { test, expect } from '@playwright/test';            // o el fixture del repo (p. ej. '../test-with-coverage')
import { viewportUse } from '../helpers/viewports';
import { BACKOFFICE_ORDER_MANAGEMENT_COMPACT } from '../helpers/flow-tags';
import { setupAdminMocks, ORDER_NUMBER } from './backoffice-order-fixtures'; // setup del módulo (2 pedidos)

test.describe('Pedidos @ 412 (celular)', { tag: [...BACKOFFICE_ORDER_MANAGEMENT_COMPACT, '@viewport:compact'] }, () => {
  test.use(viewportUse('compact'));

  test('la lista de pedidos se muestra como tarjetas con el mismo N de pedidos que la API',
    { tag: ['@outcome:display'] }, async ({ page }) => {
      await setupAdminMocks(page);
      await page.goto('/backoffice');
      await page.getByRole('button', { name: 'Abrir menú' }).click();   // interacción real (NAV-1)
      await page.getByRole('link', { name: 'Pedidos' }).click();        // el display se alcanza por UI (deep_link_entry)
      await expect(page).toHaveURL(/\/backoffice\/pedidos$/);
      const cards = page.getByTestId(/^order-card-/);
      await expect(cards).toHaveCount(2);                                // TAB-3: N del fixture
      await expect(cards.first()).toContainText(ORDER_NUMBER);           // valor concreto
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); // LAY-1
      // Bug que atrapa: la <table width:100%> de 7 columnas desborda a 412 y deja Estado y Guía fuera del viewport (R-backoffice-01).
    });

  test('cambiar el estado desde la tarjeta envía PATCH /status con el valor elegido',
    { tag: ['@outcome:success'] }, async ({ page }) => {
      // quality: allow-duplicate (per-viewport contract: backoffice-order-status-update @ 412)
      await setupAdminMocks(page);
      await page.route(`**/api/orders/${ORDER_NUMBER}/status/`, (route) => route.fulfill({ status: 200, body: '{"ok":true}' }));
      const patch = page.waitForRequest((r) => r.url().includes(`/api/orders/${ORDER_NUMBER}/status/`) && r.method() === 'PATCH');
      await page.goto('/backoffice');
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('link', { name: 'Pedidos' }).click();
      await page.getByTestId(`order-card-${ORDER_NUMBER}`).getByRole('combobox').selectOption('in_production');
      expect((await patch).postDataJSON().status).toBe('in_production');
      // Bug que atrapa: el <select> de estado queda fuera del viewport a 412 y la acción es imposible sin zoom (R-backoffice-01).
    });
});
```

---

## 6. Cómo se declara un flow responsivo

- **Cuándo:** por cada (a) comportamiento que el módulo ofrece **de forma distinta** a un ancho
  (drawer, tarjetas, bottom-sheet, tabs en lugar de dos columnas) o (b) hallazgo bloqueante/mayor
  **corregido** cuya corrección se verifica re-ejecutando la interacción clave a ese ancho.
  **Nunca** se declara un flow por "se ve bien a W" (anti-patrón, §8).
- **Dónde:** preferir **actualizar el flow dueño** (agregar `display`/`success` a `outcomes` y una
  frase en `description` con el ancho: "en 835×1194 la tabla es navegable sin overflow"). Crear un
  flow nuevo sólo para un comportamiento sin dueño.
- **id:** `<flow-base>-<alias>` cuando verifica el contrato por ancho de un flow existente
  (`backoffice-order-management-portrait`); `<module>-<elemento>-<alias>` cuando el comportamiento
  sólo existe a ese ancho (`navigation-drawer-compact`). kebab-case `^[a-z0-9-]+$`. Evitar en el id
  verbos mutantes (`login`, `update`, `delete`, `submit`) salvo que el test ejecute esa acción y
  asserte el cambio de estado (`flow_tag_mismatch`).
- **name:** `<Nombre base> @ <px> (<dispositivo>)` — p. ej. `Pedidos — tabla como tarjetas @ 412 (celular)`.
- **module:** el módulo dueño. **Prohibido** `viewport` o `responsive` como módulo.
- **roles / priority:** heredan del flow base; un bloqueante en `compact`/`portrait` sube a P1/P2.
- **description (contrato con `/qa`):** incluye **ancho en px, elemento, interacción, valor
  esperado concreto y bug que atrapa**. El Architect de `/qa` escribe su brief leyendo sólo el
  registro: la descripción debe bastar por sí sola.
- **outcomes:** `display` (la presentación a ese ancho, alcanzada navegando por UI y asertando datos
  reales) + `success` (la interacción clave completa a ese ancho). `error`/`failure` sólo si el
  ancho tiene superficie de error propia (toast bajo el bottom-nav, validación cortada).
- **`expectedSpecs: 0` al declarar** = "declarado, pendiente de autoría": el CI del proyecto no lo
  exige referenciado y el audit lo juzga por `outcomes` → `missing` → entra en `missing_flows` de
  `/qa`. `/responsive-pass --record-qa` lo sube al número medido cuando el flow queda `covered`.
- **Layout sharded** (`.testquality.yml → flow_definitions_dir`): shard
  `frontend/<e2e>/<dir>/<id>.json`, doc `docs/user-flows/<id>.md`, `_meta.json` (`version` patch +1,
  `lastUpdated`), y regenerar derivados con `python3 scripts/generate_flow_registry.py --repo-root .`
  (+ `--check`). Nunca editar `flow-tags.js` ni `USER_FLOW_MAP.md` a mano.
- **Layout monolito:** entrada en `flow-definitions.json` con las mismas claves + constante en el
  `flow-tags` autorado, con el idioma del archivo. Si existe un `flow-definitions.schema.json` con
  `additionalProperties: false` sin `outcomes`/`expectedSpecs` (kore), se extiende en el mismo commit.

---

## 7. Cuando el estándar no cubre un caso · versionado

- Se registra como **observación** (`R-<module>-NN`, estado `observación`, invariante `N/A`) con
  evidencia §5 y se **propone la extensión del estándar por PR al toolkit**
  (`workflows/testing/RESPONSIVE_STANDARDS.md`). Nunca criterios locales en el proyecto: esta
  copia se pisa en cada sync. La política `--uncovered=conservative` de la skill permite corregir
  con el criterio más conservador marcado `[fuera-de-estándar]`, siempre adjuntando la propuesta.
- **`standard_version`** (semver, encabezado): patch = redacción · minor = invariante o alias nuevo
  · major = cambio de un ancho de referencia o de severidades. El ledger guarda la versión con la
  que se trabajó cada módulo; una versión **major** nueva invalida el estado `verified` de los
  módulos anteriores (se re-inventarían).

---

## 8. Anti-patrones

| Anti-patrón | Problema | Solución |
|---|---|---|
| **Viewport-Only Module** (`e2e/viewport/`) | Tests que sólo cambian el tamaño y miran `body`; cero conducta (`TESTING_QUALITY_STANDARDS.md`, "Viewport-Only Module") | Test conductual en el módulo dueño con `test.use` (§5.3). La carpeta `viewport` sigue permitida **sólo para legado**; crear módulos viewport-only nuevos está prohibido y la skill los reporta como deuda |
| **Anchos mágicos** (`setViewportSize({ width: 820 })`) | Decenas de anchos ad-hoc en el fleet; 820/800/390/1366/1600 no son umbrales de nada | Importar `VIEWPORTS` del helper; un ancho fuera de §2 exige `responsive_widths` en `.testquality.yml` |
| **`hidden` para "arreglar" el desborde** | Oculta contenido: es cambio de contenido (LÍMITES) | Contenedor scrollable con affordance, tarjetas, reflow |
| **Feature de escritorio que "no existe" en móvil** | Cambio funcional silencioso | Observación + propuesta al operador; nunca bajo `--apply` |
| **`overflow: hidden` como curita** | Tapa el síntoma (LAY-1) y recorta datos (TIP-2) | Arreglar el ancho mínimo, el grid o el `flex-wrap` |
| **Resize + screenshot + `toBeVisible`** | Junk por definición (`no_user_interaction`, `no_data_assertion`) | DoD de 3 partes a ese ancho (§5.2) |
| **Pinear conteos globales de nav** | El triple-render (desktop/tablet/mobile) rompe `toHaveCount` | Scope por variante visible (NAV-3) |
| **`projects` de Playwright por dispositivo para todo** | Runtime × N; proyectos comentados que driftean | `test.use` por `describe` sólo donde hay contrato por ancho |
| **`isMobile: true`** | No soportado en Firefox; cambia el escalado | `viewport` + `hasTouch` |
| **Corregir con Tailwind crudo donde el proyecto tiene contrato propio** | Dos sistemas de breakpoints en el mismo módulo | Seguir `responsive_project_doc` (§9): variantes y componentes del proyecto |

---

## 9. Overrides por proyecto (`.testquality.yml`)

Sólo **claves planas** (el parser del core no soporta mappings anidados). Todo es opcional:
omitir = defaults de este estándar. Precedencia: flag de la skill > `.testquality.yml` > estándar.

```yaml
# --- Responsive (consumido por /responsive-pass; el quality gate lo IGNORA) ---
# responsive_widths: ["compact=412x915", "portrait=835x1194", "landscape=1195x835", "desktop=1440x900", "wide=2560x1440"]
# responsive_breakpoints: ["sm=640", "md=768", "lg=1024", "xl=1280", "2xl=1536"]   # px efectivos; custom: "panel-portrait=600", "tablet=900"
# responsive_breakpoints_source: frontend/config/responsive.js                     # de dónde salen (tailwind.config.js, globals.css…)
# responsive_modules: ["admin", "platform", "public"]                                # ids explícitos; si falta, se derivan (registro de flows → pages/app/views)
# responsive_module_paths: ["platform=frontend/pages/platform,frontend/components/platform"]  # acota inventario y guard del diff
# responsive_exclude: ["styleguide=página interna de tokens"]                        # fuera de alcance, con razón (se reporta ⏭️)
# responsive_project_doc: docs/methodology/responsive-standard.md                   # contrato CÓMO del proyecto (componentes/variantes); este estándar fija el QUÉ
# responsive_viewport_helper: frontend/e2e/helpers/viewports.js                     # default .ts (React/Next) · .js (Vue/Nuxt)
```

- `responsive_widths` **no puede eliminar `portrait`** (atención especial); sí puede agregar alias.
- `responsive_project_doc` apunta al estándar/design-system propio del proyecto cuando existe
  (projectapp: `docs/methodology/responsive-standard.md`, alcance `/panel/**`). Gobierna el **cómo**
  (componentes, variantes, patrones) dentro de su alcance; los invariantes de §3 gobiernan el
  **qué** en todo el proyecto. Un conflicto entre ambos se reporta como observación.
- La skill valida alias desconocidos, `portrait` ausente o rutas inexistentes y corta antes de `--apply`.

---

## 10. Quick Reference

| Qué | Valor |
|---|---|
| Anchos | `compact` 412×915 · `portrait` 835×1194 (obligatorio) · `landscape` 1195×835 · `desktop` 1440×900 · `wide` 2560×1440 |
| Severidad | bloqueante (inaccesible/imposible) · mayor (fricción) · menor (estético) |
| Id de hallazgo | `R-<module>-NN` con tipo · invariante · anchos · evidencia · propuesta · estado |
| Tipos | NAV · LAY · TAB · FORM · MOD · MED · TIP · TAC · CON |
| Mecanismo de test | `test.describe('… @ <px>', { tag: [...FLOW, '@viewport:<alias>'] }, () => { test.use(viewportUse('<alias>')); … })` |
| Duplicado por ancho | `// quality: allow-duplicate (per-viewport contract: <flow> @ <px>)` dentro del test |
| Flow declarado | `outcomes: [display, success]` + `expectedSpecs: 0` + `description` con px/elemento/interacción/valor/bug |
| Fuera de alcance | funcionalidad, flujo, contenido, textos, marca → `observación`, nunca `--apply` |
| Caso no cubierto | observación + propuesta de extensión por PR al toolkit |
| Overrides | `.testquality.yml` claves planas `responsive_*` (§9) |
