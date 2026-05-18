---
name: playwright-validation
description: "Validar/probar/debuggear UI de proyectos del fleet con Playwright MCP. Detecta entorno (staging vs production), valida fake data, reusa sesiones autenticadas, limpia artefactos. Production es read-only por contrato."
argument-hint: "[proyecto] [--url=...] [--user=...] [--viewport=mobile|tablet|desktop]"
allowed-tools: Bash, Read, Edit, Write, WebFetch
---

# Playwright Validation — Skill para el fleet VPS

Esta skill estandariza el uso de **Playwright MCP** (instalado en Claude Code) para validar, probar, debuggear y reproducir bugs sobre cualquier proyecto Django del fleet (`projects.yml`). Aplica reglas distintas según el entorno: staging puede mutar y crear fake data; production es **read-only por contrato**.

> **Autorización del operador (Gustavo):** Playwright MCP queda autorizado a correr lo que necesite sin pedir permiso paso a paso, **excepto** cualquier mutación contra un proyecto production (ver §5).

---

## 1. Cuándo activarse

Disparadores típicos en lenguaje del usuario:

- "valida el flujo X en `<proyecto>`"
- "self-QA, acabo de cambiar la UI de `<proyecto>`"
- "abre el navegador y prueba el login / checkout / form de `<proyecto>`"
- "reproduce el bug en `<dominio>`" / "no me carga el botón X"
- "regression triage" / "qué se rompió en este deploy"
- "genera tests E2E para `<flujo>` en `<proyecto>`"
- "repara los tests rotos de `<proyecto>`"
- "inspecciona la consola / network requests de `<dominio>`"
- "prueba responsive: mobile / tablet / desktop"
- "valida el menú móvil en 375px"

Si la solicitud encaja en cualquiera de estos, ejecutar el flujo de pre-flight checks (§2) **antes** de tocar `browser_*`.

---

## 2. Pre-flight checks (orden estricto, bloqueantes)

### Paso A — Detectar proyecto y entorno

```bash
# Cargar helpers del fleet (idéntico al patrón que usan server-alerts.sh, backup-mysql-and-media.sh)
OPS_ROOT=/home/ryzepeck/webapps/ops/vps
MODE=check
source "${OPS_ROOT}/scripts/lib/bootstrap-common.sh"
source "${OPS_ROOT}/scripts/lib/project-definitions.sh"

PROJ="$1"   # nombre del proyecto en projects.yml (snake_case)

if is_staging "$PROJ"; then
  ENV=staging
else
  ENV=production
fi

DOMAIN="${PROJECT_DOMAINS[$PROJ]}"        # ej. azurita.projectapp.co
DB_TYPE_VAL="${DB_TYPE[$PROJ]}"            # mysql | sqlite | postgres
DB_NAME_VAL="${DB_NAME[$PROJ]:-}"
GUNICORN_SVC_VAL="${GUNICORN_SVC[$PROJ]}"
PROJ_PATH="/home/ryzepeck/webapps/${PROJ}"

echo "Proyecto: ${PROJ} | Env: ${ENV} | Dominio: ${DOMAIN} | DB: ${DB_TYPE_VAL}"
```

Si `PROJECT_DOMAINS[$PROJ]` está vacío: detener y preguntar al operador (proyecto no registrado en `projects.yml` o nombre mal escrito).

### Paso B — Validar fake data (solo si `ENV=staging`)

En production este paso **se salta completo**.

```bash
"${PROJ_PATH}/.venv/bin/python" "${PROJ_PATH}/backend/manage.py" shell -c '
from django.apps import apps
for m in apps.get_models():
    print(f"{m._meta.label}: {m.objects.count()}")
'
```

- Si los modelos relevantes para el flujo a probar tienen `0` registros → invocar el comando de seed del proyecto:
  ```bash
  "${PROJ_PATH}/.venv/bin/python" "${PROJ_PATH}/backend/manage.py" populate_fake_data
  ```
- Si el proyecto no tiene `populate_fake_data` (u otro comando equivalente como `seed`, `loaddata`): **detener y avisar al operador**. No improvisar fixtures desde la skill.
- Validar coherencia mínima de FKs no-nulas:
  ```bash
  "${PROJ_PATH}/.venv/bin/python" "${PROJ_PATH}/backend/manage.py" check --deploy
  ```

> **Nota DB:** la mayoría del fleet usa **MySQL `localhost:3306`** (con credenciales en `config/credentials/mysql-users.env` por proyecto). Excepciones detectables vía `DB_TYPE[$PROJ]`: `azurita` y `candle_staging_project` usan **SQLite**; `vastago_project_staging` usa **PostgreSQL 16**. Para validación vía Django ORM esto es transparente.

### Paso C — Autenticación y storage state (split staging/prod)

Las sesiones se guardan en rutas **separadas por entorno**, jamás mezcladas:

| Entorno | Ruta de sesión |
|---|---|
| Staging | `/home/ryzepeck/webapps/<proyecto>/.playwright_staging/sessions/<username>.json` |
| Production | `/home/ryzepeck/webapps/<proyecto>/.playwright_prod/sessions/<username>.json` |

**Antes** de escribir cualquier sesión, garantizar que el dir esté gitignored:

```bash
cd "${PROJ_PATH}"
SESSIONS_BASE=$([ "$ENV" = "production" ] && echo ".playwright_prod" || echo ".playwright_staging")

# Asegurar entrada en .gitignore (idempotente)
if ! grep -qE "^${SESSIONS_BASE}/?$" .gitignore 2>/dev/null; then
  echo "${SESSIONS_BASE}/" >> .gitignore
fi

# Verificar que git efectivamente lo ignora
if ! git check-ignore -q "${SESSIONS_BASE}/" 2>/dev/null; then
  echo "FATAL: ${SESSIONS_BASE}/ no está siendo ignorado por git. Abortando para no leakear credenciales."
  exit 2
fi

mkdir -p "${PROJ_PATH}/${SESSIONS_BASE}/sessions"
chmod 700 "${PROJ_PATH}/${SESSIONS_BASE}" "${PROJ_PATH}/${SESSIONS_BASE}/sessions"
```

**Reglas de uso:**

- Si existe `<username>.json` y `mtime < 7 días`: reusar con `browser_set_storage_state` (cap `storage`). Internamente Playwright core ≥ 1.58 expone `setStorageState()` que aplica el state al context activo sin crear uno nuevo — más eficiente que el patrón viejo de `newContext({ storageState })` y compatible con Test Agents.
- Si no existe o expiró: hacer login interactivo en el browser, luego `browser_storage_state` para exportar; persistir con `chmod 600 <username>.json`.
- Si el proyecto guarda tokens en **IndexedDB** (ej. Firebase Auth, algunos SDKs SaaS): pasar `indexedDB: true` al exportar storage state — soportado desde Playwright 1.58. Default es solo cookies + localStorage.
- **Nunca** copiar manualmente un JSON entre `.playwright_staging/` y `.playwright_prod/`. Son dominios distintos y cookies cruzadas son un bug semántico.
- En production, si el operador no provee `--user=` y no hay sesión válida: detener y preguntar (no auto-loguear con credenciales adivinadas).

### Paso D — URL objetivo

- **Default:** `https://${PROJECT_DOMAINS[$PROJ]}` (dominio público HTTPS del fleet, gunicorn+nginx).
- Override con argumento `--url=...` (ej. `--url=http://localhost:8000` si el operador está corriendo `manage.py runserver` localmente).
- Antes de navegar, smoke-check:
  ```bash
  curl -sf -o /dev/null -w "%{http_code}\n" "https://${DOMAIN}/api/health/" || \
    echo "Aviso: health endpoint no responde 200. Revisar systemctl status ${GUNICORN_SVC_VAL}"
  ```

### Paso E — Output dir para artefactos

Configurar el browser MCP con un output dir único por run, fuera del repo:

```bash
RUN_ID="$(date +%s)-$$"
ARTIFACTS_DIR="/tmp/playwright-mcp-${PROJ}/${RUN_ID}"
mkdir -p "${ARTIFACTS_DIR}/screenshots" "${ARTIFACTS_DIR}/traces" "${ARTIFACTS_DIR}/downloads"
echo "Artifacts: ${ARTIFACTS_DIR}"
```

Pasar a Playwright MCP `--output-dir=${ARTIFACTS_DIR}` cuando se invoque.

---

## 3. Capacidades disponibles (`@playwright/mcp` última + Playwright core 1.57+)

> Versiones a la fecha (2026-05): `@playwright/mcp` ≥ 0.0.75 y Playwright core ≥ 1.59. La skill no pina versión — usa la instalada en Claude Code. Test Agents (Planner/Generator/Healer) requieren Playwright core ≥ 1.57.

| Categoría | Tools | Uso típico |
|---|---|---|
| Navegación | `browser_navigate`, `browser_navigate_back`, `browser_close` | Ir a URLs, volver, cerrar |
| Interacción | `browser_click`, `browser_type`, `browser_fill_form`, `browser_hover`, `browser_drag`, `browser_drop`, `browser_press_key`, `browser_select_option`, `browser_file_upload`, `browser_handle_dialog` | Llenar formularios, click, drag&drop, uploads, alerts |
| Snapshot/observación | `browser_snapshot` (a11y tree, **default — preferir éste**), `browser_take_screenshot` (evidencia visual) | Identificar selectores reales del DOM, capturas |
| Inspección | `browser_console_messages`, `browser_network_request`, `browser_network_requests` (con opciones `responseBody`, `responseHeaders` para payloads), `browser_evaluate` (acepta expresiones planas, no solo function bodies — desde MCP 0.0.71), `browser_run_code_unsafe` (renombrado de `browser_run_code` en 0.0.72; **prohibido en production**) | Logs de consola, requests con bodies, ejecutar JS |
| Espera | `browser_wait_for` | Esperar selector/texto/timeout |
| Viewport / responsive | `browser_resize` | Presets: **375x812 (mobile)**, **768x1024 (tablet)**, **1440x900 (desktop)** |
| Multi-tab | `browser_tabs` (action: `list` / `open` / `switch` / `close`) | Trabajar con varias pestañas |
| Storage (cap `storage`) | `browser_storage_state`, `browser_set_storage_state`, `browser_cookie_*`, `browser_localstorage_*`, `browser_sessionstorage_*` | Sesiones reutilizables, manipular cookies |
| Network avanzado (cap `network`) | `browser_route`, `browser_unroute`, `browser_network_state_set` | **Prohibido en production** (intercept/mutate requests) |
| Vision (cap `vision`) | `browser_mouse_click_xy`, `browser_mouse_move_xy`, `browser_mouse_drag_xy`, `browser_mouse_down`, `browser_mouse_up`, `browser_mouse_wheel` | Solo si la a11y tree falla |
| Devtools (cap `devtools`) | `browser_start_tracing`, `browser_stop_tracing`, `browser_start_video`, `browser_stop_video`, `browser_video_chapter` (markers), `browser_highlight`, `browser_annotate` | Regression triage, evidencia con anotaciones (Screencast API de Playwright 1.59 permite overlays + frame capture) |
| Testing helpers (cap `testing`) | `browser_generate_locator`, `browser_verify_element_visible`, `browser_verify_text_visible`, `browser_verify_value` | Asserts naturales sin escribir Playwright TS |
| PDF (cap `pdf`) | `browser_pdf_save` | Exportar evidencia |

**Convención:** preferir `browser_snapshot` (a11y tree) para acciones; usar `browser_take_screenshot` solo cuando se necesite evidencia visual (regresiones, pruebas pixel-level, reportes al operador).

Si una cap requerida (`storage`, `testing`) no está habilitada en la config global del MCP server, la skill **lo reporta** y pide al operador habilitarla. No intentar workaround.

---

## 4. Sub-agentes Playwright (Planner / Generator / Healer) — Test Agents 1.57+

Los sub-agentes oficiales se materializan en el repo del proyecto vía:

```bash
cd "${PROJ_PATH}"
if [ ! -d ".github/chatmodes" ]; then
  npx playwright init-agents --loop=claude
  echo "AVISO: revisa los archivos generados en .github/ antes de commitear (puede chocar con CI existente)."
fi
```

| Sub-agente | Qué hace | Cuándo invocar | Restricción |
|---|---|---|---|
| **Planner** | Explora la app vía MCP y escribe `specs/<flow>.md` describiendo el plan de tests | "genera plan de tests para X" | Requiere `tests/seed.spec.ts` con auth precargada (la skill lo crea apuntando a la sesión del paso C si falta) |
| **Generator** | Consume el spec del Planner y escribe `tests/<flow>.spec.ts` (TypeScript Playwright) | "convierte el spec en tests ejecutables" | Después de revisar el spec |
| **Healer** | Re-ejecuta tests fallidos y propone parche o `test.skip()` | "repara los tests rotos" | **Nunca en production** — puede silenciar fallos legítimos. Solo staging y siempre revisar diff antes de aceptar |

**Orden recomendado:** Planner → revisión humana del spec → Generator → primera corrida → Healer (solo staging, solo si rompió algo legítimo).

Los sub-agentes se invocan vía la herramienta `Agent` de Claude Code, no son tools MCP ni slash commands.

---

## 5. Reglas duras production (read-only)

Como Playwright MCP **no tiene un "read-only mode" técnico**, la regla es semántica e imperativa para Claude.

### Prohibido en `ENV=production`

- `browser_evaluate` con código que mute DOM, storage, cookies o localStorage de forma persistente.
- `browser_run_code_unsafe` (cualquier uso — el sufijo `_unsafe` no es decorativo, ejecuta arbitrario en el contexto del browser).
- `browser_route` / `browser_unroute` / `browser_network_state_set` (cap `network`). Si la cap está habilitada globalmente, no usar estas tools sobre dominio production.
- Click/submit en cualquier botón cuyo texto o handler implique mutación: `Eliminar`, `Borrar`, `Crear`, `Guardar`, `Pagar`, `Confirmar pedido`, `Enviar`, `Publicar`, `Cancelar pedido`, etc.
- `browser_file_upload` (escribe en backend).
- Generación de fake data (Paso B se salta).
- Sub-agente Healer.
- `populate_fake_data` u otros management commands de mutación.

### Permitido en `ENV=production`

- Navegación, hover, click en links de lectura (`<a href>` que no dispare POST/PUT/DELETE).
- `browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_request*` (lectura).
- `browser_resize` (viewport responsive).
- `browser_tabs` en modo lectura.
- `browser_verify_*` (asserts).
- Reproducción de bugs **sin** enviar formularios.

### Si la prueba requiere mutar en production

**Detener y avisar al operador**. Sugerir migrar la prueba al proyecto staging equivalente si existe. Mapeo conocido:

- `mimittos_project` → `mimittos` staging (si existe en `projects.yml`)
- `kore_project` → ver staging equivalente
- `tenndalux_project` (si production) → `tenndalux_project_staging`
- General: buscar `<base>_staging` en `projects.yml` antes de proponer.

### Verificación post-run en production

Comparar conteos por modelo Django **antes y después** del run para confirmar 0 deltas:

```bash
# Antes del run
"${PROJ_PATH}/.venv/bin/python" "${PROJ_PATH}/backend/manage.py" shell -c '
from django.apps import apps
for m in apps.get_models(): print(f"{m._meta.label}|{m.objects.count()}")
' > /tmp/playwright-mcp-${PROJ}/${RUN_ID}/counts-before.txt

# ... run de Playwright MCP ...

# Después del run
"${PROJ_PATH}/.venv/bin/python" "${PROJ_PATH}/backend/manage.py" shell -c '
from django.apps import apps
for m in apps.get_models(): print(f"{m._meta.label}|{m.objects.count()}")
' > /tmp/playwright-mcp-${PROJ}/${RUN_ID}/counts-after.txt

diff /tmp/playwright-mcp-${PROJ}/${RUN_ID}/counts-{before,after}.txt
# Si hay diff: ALERTA al operador. No auto-rollback, sí escalar.
```

---

## 6. Post-flight cleanup

Al terminar la sesión MCP (éxito o error):

### Borrar sin preguntar

```bash
rm -rf "/tmp/playwright-mcp-${PROJ}/${RUN_ID}"
# Si el operador no pidió conservar nada en otra ruta, borrar también runs viejos del mismo proyecto:
find "/tmp/playwright-mcp-${PROJ}" -mindepth 1 -maxdepth 1 -type d -mtime +1 -exec rm -rf {} +
# Limpiar artefactos accidentales en cwd (output-mode mal configurado):
find . -maxdepth 1 -type f \( -name 'page-*.png' -o -name 'page-*.jpeg' -o -name 'page-*.pdf' -o -name 'storage-state-*.json' \) -delete
```

### Conservar

- `/home/ryzepeck/webapps/<proyecto>/.playwright_staging/sessions/*.json` (sesiones staging gitignored)
- `/home/ryzepeck/webapps/<proyecto>/.playwright_prod/sessions/*.json` (sesiones prod gitignored, solo en server)
- `tests/*.spec.ts` y `specs/*.md` si el operador pidió generación persistente
- `.github/chatmodes/` si se ejecutó `init-agents` (avisar al operador para que decida commit)

### Solo si el operador pide conservar evidencia

Mover los archivos relevantes **antes** del `rm -rf` a una ruta explícita que el operador indique. Nunca dejar artefactos sueltos en `/tmp` ni en el repo del proyecto.

---

## 7. Ejemplos completos

### Ejemplo 1 — Self-QA staging

> "Acabo de cambiar el header de azurita, valida que el menú móvil funcione."

```bash
PROJ=azurita
# Paso A: detecta env=staging, DOMAIN=azurita.projectapp.co, DB=sqlite
# Paso B: count de modelos clave; si OK seguir, si vacío correr populate_fake_data
# Paso C: reusar /home/ryzepeck/webapps/azurita/.playwright_staging/sessions/admin.json
# Paso D: URL=https://azurita.projectapp.co
# Paso E: ARTIFACTS_DIR=/tmp/playwright-mcp-azurita/<RUN_ID>
```

Acciones MCP:

1. `browser_resize` → 375x812 (mobile)
2. `browser_navigate` → `https://azurita.projectapp.co`
3. `browser_set_storage_state` → admin.json
4. `browser_snapshot` → identificar botón hamburger
5. `browser_click` sobre el botón
6. `browser_snapshot` → verificar que el menú aparece
7. `browser_take_screenshot` → evidencia (en ARTIFACTS_DIR/screenshots/)
8. Cleanup: `rm -rf /tmp/playwright-mcp-azurita/<RUN_ID>`

### Ejemplo 2 — Reproducir bug production

> "En mimittos.com el botón 'Agregar al carrito' no responde en mobile."

```bash
PROJ=mimittos_project
# Paso A: env=production → activar reglas §5
# Paso B: SE SALTA (no fake data en prod)
# Paso C: sesión opcional desde .playwright_prod/sessions/ (solo lectura)
# Paso D: URL=https://mimittos.com
```

Acciones MCP (todas read-only):

1. counts-before.txt (snapshot de modelos)
2. `browser_resize` → 375x812
3. `browser_navigate` → `https://mimittos.com`
4. `browser_snapshot` → identificar botón
5. `browser_click` sobre "Agregar al carrito" — **permitido**: el click no muta DB en frontend (solo cambia estado del cart en localStorage del cliente, que es state efímero); pero **no** seguir hasta "Pagar" / "Confirmar pedido".
6. `browser_console_messages` → recuperar errores JS
7. `browser_network_requests` → ver si el POST falla
8. `browser_take_screenshot` → evidencia
9. counts-after.txt + diff → confirmar 0 deltas
10. Cleanup completo

Si el operador pide "ahora completa la compra para verificar el flujo entero" → **detener** y proponer migrar la prueba a staging.

### Ejemplo 3 — Generar suite E2E staging

> "Crea tests E2E para el flujo de checkout de candle_staging_project."

```bash
PROJ=candle_staging_project
# Paso A: env=staging
# Paso B: validar que existen Productos, Carritos, Usuarios; si no, populate_fake_data
# Paso C: sesión cliente.json en .playwright_staging/sessions/
```

Flujo:

1. Bootstrap sub-agentes:
   ```bash
   cd /home/ryzepeck/webapps/candle_staging_project
   [ ! -d .github/chatmodes ] && npx playwright init-agents --loop=claude
   ```
2. Crear/actualizar `tests/seed.spec.ts` con `storageState: '<ruta a cliente.json>'`.
3. Invocar Planner (Agent tool) → genera `specs/checkout.md`.
4. **Pausa para review humano del spec**.
5. Invocar Generator → genera `tests/checkout.spec.ts`.
6. Correr `npx playwright test tests/checkout.spec.ts`.
7. Si rompe: invocar Healer (solo permitido en staging).
8. Cleanup de artefactos `/tmp/`; conservar `tests/`, `specs/`, `.github/chatmodes/`.
9. Avisar al operador qué archivos quedaron para revisar/commitear.

---

## 8. Troubleshooting breve

| Síntoma | Causa probable | Acción |
|---|---|---|
| `browser_set_storage_state` falla con "capability not enabled" | Cap `storage` deshabilitada en MCP config global | Pedir al operador habilitarla; no usar workaround manual con cookies |
| Sesión expirada (cookies inválidas, redirect a /login) | JSON con >7d o token revocado | Borrar `<username>.json` y hacer login nuevamente |
| `browser_snapshot` no encuentra elemento | Render lento, JS no terminó, o elemento dentro de iframe | `browser_wait_for` antes; si persiste, fallback a cap `vision` con `browser_mouse_click_xy` |
| Healer "repara" rompiendo intención del test | Healer marcó como `skip` un test que detectaba bug real | Revisar diff antes de aceptar; nunca correr Healer en production |
| Dominio devuelve 5xx | Servicio caído, no bug del test | `systemctl status ${GUNICORN_SVC_VAL}` y `journalctl -u ${GUNICORN_SVC_VAL} -n 100` |
| `git check-ignore` retorna no-match para `.playwright_prod/` | `.gitignore` mal escrito o proyecto sin `.gitignore` | Crear/corregir `.gitignore`; **no escribir sesión prod hasta que git la ignore** |
| Artefactos quedaron en `cwd` (raíz del repo) | MCP corrió sin `--output-dir` | Borrar manualmente; en próximo run pasar `--output-dir=/tmp/playwright-mcp-${PROJ}/${RUN_ID}` |

---

## Resumen de garantías

- **Detección automática** de entorno por proyecto vía `is_staging`.
- **Hard refuse** ante mutaciones en production.
- **Aislamiento de credenciales** staging vs prod en dirs separados, ambos gitignored.
- **Cleanup automático** de screenshots/traces/downloads en `/tmp/playwright-mcp-${PROJ}/`.
- **Verificación de integridad** post-run en production (diff de counts).
- **Sub-agentes oficiales** (Planner/Generator/Healer) bootstrapeados on-demand cuando el operador pide tests persistentes.
