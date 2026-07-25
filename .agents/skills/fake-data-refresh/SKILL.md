---
name: fake-data-refresh
description: "Borra y recrea fake data en un proyecto Django. Refusa en producción. Detecta automáticamente las management commands del proyecto (delete_fake_data + create_fake_data) y las ejecuta con guardrails. Funciona en staging del fleet, dev local y proyectos no registrados."
argument-hint: "[proyecto] [--records=N] [--skip-delete] [--dry-run]"
allowed-tools: Bash, Read
---

# Fake Data Refresh

Skill para refrescar (`delete + create`) la fake data de un proyecto Django. Diseñada con un **gate inverso de producción**: detecta señales afirmativas de prod y refusa; en cualquier otro caso (staging del fleet, dev local, proyectos no registrados en `projects.yml`) procede.

> **Autorización:** Gustavo autoriza ejecutar los management commands del proyecto sin confirmación adicional, **excepto** cuando se detecta producción — ahí el bloqueo es absoluto.

---

## 1. Cuándo activarse

Disparadores:

- "refresca fake data en `<proyecto>`" / "borra y recrea data" / "reseed staging X"
- Encadenada por el conductor [[qa]] (Fase 3) cuando el trabajo necesita fixtures frescas — con el MISMO gate inverso de producción: en prod el conductor la saltea de entrada
- Después de un cambio de modelo / FK / lógica de negocio (referenciado por `new-feature-checklist`)
- Cuando los counts de modelos quedaron en 0 o incoherentes
- Como paso intermedio antes de invocar `playwright-validation` si el flujo a probar necesita data fresca

No invocar:

- Cuando el proyecto está en producción (la skill se niega de todos modos, pero perder tiempo invocándola es tonto)
- Cuando solo necesitas crear sin borrar — usa el comando del proyecto directamente

---

## 2. Ejecución completa — UN SOLO bloque bash (obligatorio)

> **Por qué un solo bloque:** entre bloques bash de una skill SÓLO persiste el
> cwd — las variables mueren (gotcha conocido del repo; con `set -u` la versión
> multi-bloque moría con `unbound variable` en §3). Todo el flujo — parser de
> flags, gate, detección, delete, create, verificación — corre acá.

```bash
set -uo pipefail

# ---- Parser de $ARGUMENTS (los flags documentados SE PARSEAN acá) ----
PROJ_PATH=""
RECORDS=50
SKIP_DELETE=false
DRY_RUN=false
for tok in $ARGUMENTS; do
  case "$tok" in
    --records=*)  RECORDS="${tok#*=}" ;;
    --skip-delete) SKIP_DELETE=true ;;
    --dry-run)     DRY_RUN=true ;;
    --*)           echo "FATAL: flag desconocida $tok"; exit 2 ;;
    *)             PROJ_PATH="$tok" ;;
  esac
done
[ -n "$PROJ_PATH" ] || PROJ_PATH="$(pwd)"
[ -d "$PROJ_PATH" ] || { echo "FATAL: $PROJ_PATH no existe"; exit 2; }
PROJ_NAME="$(basename "$PROJ_PATH")"

SIGNAL_A=false
SIGNAL_A_REASON=""
SIGNAL_B=false
SIGNAL_B_REASON=""
IN_FLEET=false

# Señal A — fleet metadata (autoritativa cuando el proyecto está en projects.yml)
# Reglas:
# - Si el proyecto aparece en projects.yml → IN_FLEET=true.
# - Si is_staging() devuelve true → permitido (no Signal A).
# - En cualquier otro caso (production explícita, sin field environment, etc.) → Signal A.
# Esto cubre el caso de proyectos production que no declaran `environment:`
# (el helper devuelve default=production por convención).
OPS_ROOT=/home/ryzepeck/webapps/vps-ops-toolkit
if [ -f "${OPS_ROOT}/projects.yml" ]; then
  MODE=check
  # shellcheck source=/dev/null
  source "${OPS_ROOT}/scripts/lib/bootstrap-common.sh" 2>/dev/null
  # shellcheck source=/dev/null
  source "${OPS_ROOT}/scripts/lib/project-definitions.sh" 2>/dev/null

  # Guard: si el source falló en silencio, is_staging no existe y `! is_staging`
  # sería true → REFUSED silencioso de un staging legítimo. Mejor morir claro.
  declare -F is_staging >/dev/null || { echo "FATAL: no pude cargar los helpers del toolkit (is_staging indefinido)"; exit 2; }

  if grep -qE "^[[:space:]]*-[[:space:]]+name:[[:space:]]+${PROJ_NAME}[[:space:]]*$" "${OPS_ROOT}/projects.yml"; then
    IN_FLEET=true
    if ! is_staging "$PROJ_NAME"; then
      SIGNAL_A=true
      SIGNAL_A_REASON="${PROJ_NAME} está en projects.yml y NO está marcado environment=staging"
    fi
  fi
fi

# Señal B — .env del proyecto. SOLO aplica si el proyecto NO está en el fleet.
# En este fleet TODOS los proyectos (staging y prod) usan DJANGO_ENV=production y
# DEBUG=False en .env por convención (staging mimica producción en settings; solo
# difiere en backups/alerts). Por eso .env no es discriminador para fleet projects;
# úsalo solo como fallback para detección de prod en proyectos locales no registrados.
if ! $IN_FLEET; then
  ENV_FILE=""
  for candidate in "${PROJ_PATH}/backend/.env" "${PROJ_PATH}/.env"; do
    [ -f "$candidate" ] && ENV_FILE="$candidate" && break
  done

  if [ -n "$ENV_FILE" ]; then
    if grep -qE '^[[:space:]]*DJANGO_ENV[[:space:]]*=[[:space:]]*production\b' "$ENV_FILE" 2>/dev/null; then
      SIGNAL_B=true
      SIGNAL_B_REASON="$ENV_FILE tiene DJANGO_ENV=production (proyecto fuera del fleet)"
    elif grep -qE '^[[:space:]]*DEBUG[[:space:]]*=[[:space:]]*False\b' "$ENV_FILE" 2>/dev/null; then
      SIGNAL_B=true
      SIGNAL_B_REASON="$ENV_FILE tiene DEBUG=False (proyecto fuera del fleet)"
    fi
  fi
fi

# Decisión
if $SIGNAL_A || $SIGNAL_B; then
  echo "REFUSED: ${PROJ_NAME} parece producción."
  $SIGNAL_A && echo "  - $SIGNAL_A_REASON"
  $SIGNAL_B && echo "  - $SIGNAL_B_REASON"
  echo "  fake-data-refresh no corre en producción. Edita projects.yml si el proyecto debería ser staging."
  exit 2
fi

if $IN_FLEET; then
  echo "OK: ${PROJ_NAME} marcado como staging en projects.yml. Procediendo."
else
  echo "OK: ${PROJ_NAME} no está en projects.yml y .env no marca producción. Asumiendo dev local."
fi

# ---- Detectar infraestructura ----
# Localizar manage.py
CMD_DIR="${PROJ_PATH}/backend"
[ -f "${CMD_DIR}/manage.py" ] || CMD_DIR="${PROJ_PATH}"
[ -f "${CMD_DIR}/manage.py" ] || { echo "FATAL: no manage.py en ${PROJ_PATH} ni en ${PROJ_PATH}/backend"; exit 2; }

# Localizar venv
VENV_PY="${PROJ_PATH}/.venv/bin/python"
[ -x "$VENV_PY" ] || VENV_PY="${PROJ_PATH}/venv/bin/python"
[ -x "$VENV_PY" ] || { echo "FATAL: no .venv/venv ejecutable en ${PROJ_PATH}"; exit 2; }

# Inventariar management commands. NO silenciar un `manage.py help` roto:
# distinguir "el proyecto no arranca" de "no tiene el comando".
if ! MGMT_OUT="$("$VENV_PY" "${CMD_DIR}/manage.py" help 2>&1)"; then
  echo "FATAL: manage.py help falló — el proyecto no arranca (settings/DB rotos):"
  printf '%s\n' "$MGMT_OUT" | tail -5
  exit 2
fi

HAS_DELETE="$(printf '%s\n' "$MGMT_OUT" | grep -oE '\b(delete_fake_data|flush_fake|reset_fake)\b' | head -1 || true)"
HAS_CREATE="$(printf '%s\n' "$MGMT_OUT" | grep -oE '\b(create_fake_data|populate_fake_data|seed_data|seed)\b' | head -1 || true)"

if [ -z "$HAS_CREATE" ]; then
  echo "FATAL: ${PROJ_NAME} no tiene management command de fake data create."
  echo "       Esperaba uno de: create_fake_data, populate_fake_data, seed_data, seed."
  exit 2
fi
echo "Create command detectado: ${HAS_CREATE}"
echo "Delete command detectado: ${HAS_DELETE:-(ninguno)}"

# ---- Sondear signatures vía --help ANTES de ejecutar ----
# (ejecutar-para-descubrir duplica registros si el create corre parcialmente
# antes de fallar por la flag; y un retry de delete puede colgarse en un prompt)
CREATE_HELP="$("$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_CREATE" --help 2>/dev/null || true)"
CREATE_ARGS=()
if grep -q -- '--number-of-records' <<<"$CREATE_HELP"; then
  CREATE_ARGS=(--number-of-records="$RECORDS")
elif grep -qE '^\s+records|positional arguments' <<<"$CREATE_HELP"; then
  CREATE_ARGS=("$RECORDS")
else
  echo "AVISO: ${HAS_CREATE} no expone cantidad en --help; correrá con sus defaults."
fi
DELETE_ARGS=()
if [ -n "$HAS_DELETE" ]; then
  "$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_DELETE" --help 2>/dev/null | grep -q -- '--confirm' \
    && DELETE_ARGS=(--confirm) \
    || echo "AVISO: ${HAS_DELETE} no soporta --confirm (parchear el comando; caso candle)."
fi

# ---- Dry-run: mostrar el plan exacto y salir ----
if $DRY_RUN; then
  echo "DRY-RUN — comandos que correría:"
  [ -n "$HAS_DELETE" ] && ! $SKIP_DELETE && echo "  $VENV_PY ${CMD_DIR}/manage.py $HAS_DELETE ${DELETE_ARGS[*]:-}"
  echo "  $VENV_PY ${CMD_DIR}/manage.py $HAS_CREATE ${CREATE_ARGS[*]:-}"
  exit 0
fi

# ---- Delete ----
if [ -n "$HAS_DELETE" ] && ! $SKIP_DELETE; then
  echo ">>> Ejecutando: ${HAS_DELETE} ${DELETE_ARGS[*]:-}"
  "$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_DELETE" "${DELETE_ARGS[@]:-}" || { echo "FATAL: ${HAS_DELETE} falló."; exit 2; }
elif $SKIP_DELETE; then
  echo "Saltando delete (--skip-delete)"
else
  echo "AVISO: sin delete cmd — los registros se acumularán (NO idempotente en este modo)."
fi

# ---- Create ----
echo ">>> Ejecutando: ${HAS_CREATE} ${CREATE_ARGS[*]:-} (objetivo: ${RECORDS})"
"$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_CREATE" "${CREATE_ARGS[@]:-}" || { echo "FATAL: ${HAS_CREATE} falló."; exit 2; }

# ---- Verificar resultado ----
echo ">>> Conteo post-create:"
"$VENV_PY" "${CMD_DIR}/manage.py" shell -c '
from django.apps import apps
for m in apps.get_models():
    try:
        c = m.objects.count()
    except Exception:
        c = "ERROR"
    print(f"{m._meta.label}: {c}")
' | tee "/tmp/fake-data-refresh-${PROJ_NAME}.log"
```

Si todos los modelos relevantes para el proyecto quedan en `0`, el comando aparentemente "tuvo éxito" pero no creó nada — revisar argumentos o setup.

---

## 3. Reporte al operador

Cerrar con el bloque estándar de **Output final** (al pie): veredicto + tabla
de dimensiones + `## Next steps`. No imprimir listas ad-hoc de bullets.

---

## Argumentos soportados (parseados por el bloque §2)

| Flag | Default | Descripción |
|---|---|---|
| `[proyecto]` | `$(pwd)` | Path al proyecto. Si se omite, usa el CWD. |
| `--records=N` | `50` | Cantidad objetivo **por modelo principal** (50 alcanza para paginar 2 páginas en E2E). La signature real se sondea vía `--help`. |
| `--skip-delete` | `false` | Salta el delete y solo crea (⚠️ acumula registros — no idempotente). |
| `--dry-run` | `false` | Corre gate + detección + sondeo de signatures (reales) e imprime el plan exacto sin ejecutar delete/create. Exit 0. |

---

## Comportamiento por proyecto del fleet (referencia)

| Proyecto | Env | Create cmd | Delete cmd | Comportamiento esperado |
|---|---|---|---|---|
| `mimittos_project` | production | `create_fake_data` | `delete_fake_data --confirm` | **REFUSED** (gate Signal A — B no se evalúa para proyectos del fleet) |
| `kore_project` | production | `create_fake_data` | `delete_fake_data --confirm` | **REFUSED** (gate Signal A) |
| `fernando_aragon_project` | **production** (informativo — sirve dominio real) | `create_fake_data` | `delete_fake_data --confirm` | **REFUSED** (gate Signal A) |
| `candle_project_staging` | staging (**suspended** — offline-total) | `create_fake_data` | `delete_fake_data` (sin `--confirm`) | Gate OK (staging), pero probable **FATAL** en `manage.py help` — el proyecto está apagado |
| `azurita` | staging | (ninguno) | (ninguno) | **FATAL** — sin infraestructura |
| `tuhuella/vastago/tenndalux_project_staging` · `gym_project_staging` | staging activo | según proyecto | según proyecto | OK — los targets reales de refresh |

---

## Troubleshooting

| Síntoma | Causa | Acción |
|---|---|---|
| `REFUSED: ... parece producción` con razones extrañas | `.env` mal configurado o `projects.yml` desactualizado | Revisar y corregir las fuentes; la skill no se salta el gate |
| `FATAL: no manage.py` | El CWD no es un proyecto Django, o el proyecto usa estructura no estándar | Pasar `[proyecto]` explícito o invocar desde la raíz correcta |
| `FATAL: no .venv/venv ejecutable` | Venv no creado | `python -m venv .venv && .venv/bin/pip install -r requirements.txt` |
| `FATAL: ... no tiene management command de fake data create` | El proyecto nunca tuvo seed | Implementar `create_fake_data` siguiendo el patrón de `mimittos_project` o `kore_project` |
| Aviso "no soporta --confirm" | El `--help` del delete no expone la flag (se sondea ANTES de ejecutar, nunca retry a ciegas) | Parchear el comando del proyecto para aceptar `--confirm` |
| FATAL "manage.py help falló" | El proyecto no arranca (settings/DB rotos o suspendido) — distinto de "no tiene el comando" | Revisar `.env`/servicios antes de reintentar |
| Counts en 0 después de create | Comando no acepta argumento de cantidad y su default es 0, o falla silencioso | Ejecutar manualmente con verbose: `python manage.py <cmd> --verbosity=3` |

---

## Garantías

- **Producción intocable:** dos señales independientes (`projects.yml` y `.env`) — si cualquiera dispara, refusa.
- **Adaptativo:** detecta los comandos del proyecto (no asume nombres fijos).
- **Idempotente CUANDO hay delete cmd y no se usa `--skip-delete`** (delete + create da el mismo estado final). Sin delete, o con `--skip-delete`, los registros se acumulan.
- **Reportable:** siempre imprime counts y warnings; el operador sabe qué pasó.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill:

```markdown
🟢 fake-data-refresh OK — <proyecto>
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Gate inverso de producción | ✅ | staging (fleet) o dev local, no es prod |
| Detección manage.py + venv | ✅ | <CMD_DIR>/manage.py + <venv>/bin/python |
| Comandos detectados | ✅ | create=<HAS_CREATE>, delete=<HAS_DELETE or n/a> |
| Delete ejecutado | ✅ | <HAS_DELETE> --confirm OK |
| Create ejecutado | ✅ | <HAS_CREATE> records=<RECORDS> OK |
| Counts post-refresh | ✅ | top 10 modelos poblados, sin 0 inesperados |
```

Casos de veredicto distinto a 🟢:

- 🚫 **REFUSED** — gate disparó (Signal A: projects.yml prod, Signal B:
  `.env` prod). Tabla muestra `🚫` en el gate con la razón. No hay
  `## Next steps` ejecutables — solo `(operador) revisar projects.yml o
  .env` si cree que es falso positivo.
- ⚠️ — delete corrió sin `--confirm`, o algún modelo principal quedó en 0
  tras create, o `.env` sin `DEBUG`/`DJANGO_ENV` declarados. Agregar
  `## Next steps` con el patch sugerido al management command del proyecto.
- ❌ — `FATAL: no manage.py` / `no .venv` / `no create_fake_data` / create
  falló con las 3 signatures. Agregar `## Next steps` con el setup pendiente.

En modo `--dry-run`, todas las filas que serían ejecutadas van con ⏭️ y la
sección Next steps lista los comandos que correría en una invocación real.
