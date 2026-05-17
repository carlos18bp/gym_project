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
- Después de un cambio de modelo / FK / lógica de negocio (referenciado por `new-feature-checklist`)
- Cuando los counts de modelos quedaron en 0 o incoherentes
- Como paso intermedio antes de invocar `playwright-validation` si el flujo a probar necesita data fresca

No invocar:

- Cuando el proyecto está en producción (la skill se niega de todos modos, pero perder tiempo invocándola es tonto)
- Cuando solo necesitas crear sin borrar — usa el comando del proyecto directamente

---

## 2. Pre-flight: gate inverso de producción (BLOQUEANTE)

```bash
set -uo pipefail
PROJ_PATH="${1:-$(pwd)}"
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
# Esto cubre el caso de proyectos production sin field `environment:` (ej. kore_project),
# donde el helper devuelve default=production por convención.
OPS_ROOT=/home/ryzepeck/webapps/ops/vps
if [ -f "${OPS_ROOT}/projects.yml" ]; then
  MODE=check
  # shellcheck source=/dev/null
  source "${OPS_ROOT}/scripts/lib/bootstrap-common.sh" 2>/dev/null
  # shellcheck source=/dev/null
  source "${OPS_ROOT}/scripts/lib/project-definitions.sh" 2>/dev/null

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
```

**Notas:**

- Si **ambas** señales son falsas o ausentes (proyecto local fuera del fleet, sin `.env`, dev en laptop) → procede.
- **No hay flag para saltar el gate.** Si la skill detecta prod, no se corre. Si crees que es un falso positivo, corrige el `.env` o `projects.yml`.

---

## 3. Detectar infraestructura del proyecto

```bash
# Localizar manage.py
CMD_DIR="${PROJ_PATH}/backend"
[ -f "${CMD_DIR}/manage.py" ] || CMD_DIR="${PROJ_PATH}"
[ -f "${CMD_DIR}/manage.py" ] || { echo "FATAL: no manage.py en ${PROJ_PATH} ni en ${PROJ_PATH}/backend"; exit 2; }

# Localizar venv
VENV_PY="${PROJ_PATH}/.venv/bin/python"
[ -x "$VENV_PY" ] || VENV_PY="${PROJ_PATH}/venv/bin/python"
[ -x "$VENV_PY" ] || { echo "FATAL: no .venv/venv ejecutable en ${PROJ_PATH}"; exit 2; }

# Inventariar management commands
MGMT_OUT="$("$VENV_PY" "${CMD_DIR}/manage.py" help 2>/dev/null || true)"

HAS_DELETE="$(printf '%s\n' "$MGMT_OUT" | grep -oE '\b(delete_fake_data|flush_fake|reset_fake)\b' | head -1)"
HAS_CREATE="$(printf '%s\n' "$MGMT_OUT" | grep -oE '\b(create_fake_data|populate_fake_data|seed_data|seed)\b' | head -1)"

if [ -z "$HAS_CREATE" ]; then
  echo "FATAL: ${PROJ_NAME} no tiene management command de fake data create."
  echo "       Esperaba uno de: create_fake_data, populate_fake_data, seed_data, seed."
  echo "       Implementa uno antes de correr fake-data-refresh."
  exit 2
fi

echo "Create command detectado: ${HAS_CREATE}"
echo "Delete command detectado: ${HAS_DELETE:-(ninguno)}"
```

---

## 4. Ejecutar delete

```bash
SKIP_DELETE=${SKIP_DELETE:-false}

if [ -n "$HAS_DELETE" ] && ! $SKIP_DELETE; then
  echo ">>> Ejecutando: ${HAS_DELETE} --confirm"
  if ! "$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_DELETE" --confirm 2>&1; then
    echo "WARNING: ${HAS_DELETE} --confirm falló. Reintentando sin --confirm..."
    if ! "$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_DELETE" 2>&1; then
      echo "FATAL: ${HAS_DELETE} falló sin y con --confirm. Revisa el comando."
      exit 2
    fi
    echo "AVISO: el comando ${HAS_DELETE} se ejecutó SIN flag --confirm. Considera agregar la flag para futuras ejecuciones más seguras."
  fi
elif $SKIP_DELETE; then
  echo "Saltando delete (--skip-delete)"
else
  echo "AVISO: ${PROJ_NAME} no tiene delete_fake_data. Los registros se acumularán."
fi
```

---

## 5. Ejecutar create

```bash
RECORDS="${RECORDS:-50}"

echo ">>> Ejecutando: ${HAS_CREATE} (registros objetivo: ${RECORDS})"

# Probar tres signatures distintas (positional, --number-of-records, defaults)
if "$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_CREATE" "$RECORDS" 2>&1; then
  :
elif "$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_CREATE" --number-of-records="$RECORDS" 2>&1; then
  :
elif "$VENV_PY" "${CMD_DIR}/manage.py" "$HAS_CREATE" 2>&1; then
  echo "AVISO: ${HAS_CREATE} corrió con sus defaults (no acepta argumento de cantidad)"
else
  echo "FATAL: ${HAS_CREATE} falló con todas las signatures conocidas."
  exit 2
fi
```

---

## 6. Verificar resultado

```bash
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

## 7. Reporte al operador

Imprimir resumen estructurado:

- ✅ Comando(s) ejecutados
- ✅ Counts post-refresh por modelo (top 10 con más registros)
- ⚠️ Warnings:
  - Proyecto sin `--confirm` en su delete
  - Proyecto sin delete command (data acumulada)
  - Modelos principales con count=0 después del create
  - `.env` del proyecto sin `DEBUG`/`DJANGO_ENV` declarados (no es prod, pero es ambiguo)
- 📌 Sugerencias accionables si algo no salió ideal

---

## Dry-run mode

Si la invocación incluye `--dry-run`:

- Ejecuta el gate de producción (real, para mostrar la decisión).
- Detecta los management commands (real).
- **No ejecuta** delete ni create.
- Imprime los comandos exactos que correría con sus argumentos.
- Exit 0.

---

## Argumentos soportados

| Flag | Default | Descripción |
|---|---|---|
| `[proyecto]` | `$(pwd)` | Path al proyecto. Si se omite, usa el CWD. |
| `--records=N` | `50` | Cantidad objetivo de registros (se intenta como posicional o `--number-of-records`). |
| `--skip-delete` | `false` | Salta el delete y solo crea. Útil cuando quieres añadir más data sin borrar. |
| `--dry-run` | `false` | No ejecuta delete/create, solo simula. |

---

## Comportamiento por proyecto del fleet (referencia)

| Proyecto | Env | Create cmd | Delete cmd | Comportamiento esperado |
|---|---|---|---|---|
| `mimittos_project` | production | `create_fake_data` | `delete_fake_data --confirm` | **REFUSED** (gate Signal A + B) |
| `kore_project` | production | `create_fake_data` | `delete_fake_data --confirm` | **REFUSED** (gate Signal A) |
| `fernando_aragon_project` | staging | `create_fake_data` | `delete_fake_data --confirm` | OK — refresh users |
| `candle_staging_project` | staging | `create_fake_data` | `delete_fake_data` (sin `--confirm`) | OK con warning — el comando es destructivo sin flag, recomendar parche |
| `azurita` | staging | (ninguno) | (ninguno) | **FATAL** — sin infraestructura |

---

## Troubleshooting

| Síntoma | Causa | Acción |
|---|---|---|
| `REFUSED: ... parece producción` con razones extrañas | `.env` mal configurado o `projects.yml` desactualizado | Revisar y corregir las fuentes; la skill no se salta el gate |
| `FATAL: no manage.py` | El CWD no es un proyecto Django, o el proyecto usa estructura no estándar | Pasar `[proyecto]` explícito o invocar desde la raíz correcta |
| `FATAL: no .venv/venv ejecutable` | Venv no creado | `python -m venv .venv && .venv/bin/pip install -r requirements.txt` |
| `FATAL: ... no tiene management command de fake data create` | El proyecto nunca tuvo seed | Implementar `create_fake_data` siguiendo el patrón de `mimittos_project` o `kore_project` |
| Warning "comando se ejecutó SIN flag --confirm" | El delete del proyecto no soporta `--confirm` | Parchear el comando del proyecto para aceptar `--confirm` (caso `candle_staging_project`) |
| Counts en 0 después de create | Comando no acepta argumento de cantidad y su default es 0, o falla silencioso | Ejecutar manualmente con verbose: `python manage.py <cmd> --verbosity=3` |

---

## Garantías

- **Producción intocable:** dos señales independientes (`projects.yml` y `.env`) — si cualquiera dispara, refusa.
- **Adaptativo:** detecta los comandos del proyecto (no asume nombres fijos).
- **Idempotente:** correr la skill dos veces es seguro (delete + create da el mismo estado final).
- **Reportable:** siempre imprime counts y warnings; el operador sabe qué pasó.
