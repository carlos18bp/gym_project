---
description: "Levanta el entorno de desarrollo local de un proyecto Django (venv, deps, migrate, runserver + frontend dev) y monitorea logs. Auto-descubre desde projects.yml. Solo dev machine."
auto_execution_mode: 2
---

## Entorno requerido

**Esta skill SOLO funciona desde la dev machine** — bootstrapea un entorno local
(venv + SQLite + servers en background). En el VPS los servers corren como
servicios systemd; ahí usá `/deploy-and-check`, no esta skill.

**Verificación obligatoria ANTES de cualquier otro paso**:

```bash
# Gate genérico: refusa si detecta producción (usuario ryzepeck del VPS) o si el
# proyecto ya corre como servicio systemd en esta máquina.
PROJECT_NAME=$(basename "$(pwd)")
GUN_SVC_GUESS="${PROJECT_NAME%_staging}"
if [[ -d /home/ryzepeck/webapps ]] \
   || systemctl is-active --quiet "$GUN_SVC_GUESS.service" 2>/dev/null \
   || systemctl is-active --quiet "$PROJECT_NAME.service" 2>/dev/null; then
  echo "❌ Esto parece un VPS / entorno de producción."
  echo "   Esta skill es solo para la dev machine."
  echo "   En el VPS los servers corren como servicios — usá /deploy-and-check."
  exit 2
fi
echo "✅ Dev machine detectada, procediendo."
```

Si el bloque aborta con ❌, **NO continuar** — no es error, es un safety gate.

---

# Dev Up — Bootstrap & Serve (local dev)

Levanta backend (Django runserver, SQLite) y, si el proyecto tiene frontend, el
servidor de desarrollo del frontend (`npm run dev`), resolviendo de paso el
bootstrap completo del entorno. Pensada para un checkout limpio donde todavía no
hay venv, `node_modules` ni base de datos.

- **Stack dev**: Django 5 + DRF (SQLite, settings `*_dev`) + frontend dev server (si aplica)
- **Genérica**: auto-descubre metadata del proyecto desde `~/webapps/vps-ops-toolkit/projects.yml` (con defaults si no está registrado).
- **Idempotente**: cada fase detecta si ya está hecho y saltea. Re-invocarla es seguro.
- **Logs**: `/tmp/<proyecto>-dev/{backend,frontend}.log` (+ `.pid`). Cero footprint en el repo.

> **⚠️ How to invoke**:
> - `/dev-up` → bootstrap (si hace falta) + arranca lo que no esté arriba + monitorea.
> - `/dev-up --restart` → mata los servers viejos y relanza.
> - `/dev-up --backend-port=8001 --frontend-port=3001` → puertos custom.
> - `/dev-up --frontend-cmd='npm run serve'` → comando de dev del frontend custom.
>
> Claude Code substituye `$ARGUMENTS` con los flags pasados (vacío si se omiten).
> Para bajar los servers usar `/dev-down`.

---

## Phase 0 — Discovery

```bash
set -o pipefail
ARGS="$ARGUMENTS"
PROJECT_DIR=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR")
OPS_YML="$HOME/webapps/vps-ops-toolkit/projects.yml"
LOG_DIR="/tmp/$PROJECT_NAME-dev"
mkdir -p "$LOG_DIR"

# --- Lectura de projects.yml (mismo helper que deploy-and-check) ---
yml_get() {
    local proj="$1" field="$2"
    [ -f "$OPS_YML" ] || return 0
    awk -v p="$proj" -v f="$field" '
        /^[[:space:]]*-[[:space:]]+name:/{n=$NF; gsub(/"/,"",n)}
        n==p && $0 ~ "^[[:space:]]+"f":" {
            sub("^[[:space:]]+"f":[[:space:]]*", ""); gsub(/"/, ""); print; exit
        }
    ' "$OPS_YML"
}
HAS_FRONTEND=$(yml_get "$PROJECT_NAME" has_frontend)
REQ_PATH=$(yml_get "$PROJECT_NAME" requirements_path)
DB_TYPE=$(yml_get "$PROJECT_NAME" db)
VENV_PATH_YML=$(yml_get "$PROJECT_NAME" venv_path)
[ -z "$REQ_PATH" ] && REQ_PATH="backend/requirements.txt"
# has_frontend: si no está en yml, inferir por existencia de frontend/package.json
if [ -z "$HAS_FRONTEND" ]; then
    [ -f "$PROJECT_DIR/frontend/package.json" ] && HAS_FRONTEND=true || HAS_FRONTEND=false
fi

# --- Resolución de venv: preferir uno EXISTENTE; si no, crear .venv ---
VENV=""
for cand in ".venv" "backend/venv" "venv" "$(dirname "$(dirname "$VENV_PATH_YML")" 2>/dev/null)"; do
    [ -n "$cand" ] && [ -x "$PROJECT_DIR/$cand/bin/python" ] && { VENV="$PROJECT_DIR/$cand"; break; }
done
[ -z "$VENV" ] && VENV="$PROJECT_DIR/.venv"   # default a crear
PY="$VENV/bin/python"

# --- Flags ---
RESTART=false; BACKEND_PORT=8000; FRONTEND_PORT=3000; FRONTEND_CMD="npm run dev"
case "$ARGS" in *--restart*) RESTART=true;; esac
_bp=$(printf '%s\n' "$ARGS" | grep -oE -- '--backend-port=[0-9]+'  | cut -d= -f2); [ -n "$_bp" ] && BACKEND_PORT="$_bp"
_fp=$(printf '%s\n' "$ARGS" | grep -oE -- '--frontend-port=[0-9]+' | cut -d= -f2); [ -n "$_fp" ] && FRONTEND_PORT="$_fp"
_fc=$(printf '%s\n' "$ARGS" | sed -n "s/.*--frontend-cmd=['\"]\([^'\"]*\)['\"].*/\1/p"); [ -n "$_fc" ] && FRONTEND_CMD="$_fc"

# --- Sanity ---
[ -f "$PROJECT_DIR/backend/manage.py" ] || { echo "❌ No encuentro backend/manage.py — ¿estás en la raíz del repo?"; exit 1; }

cat <<EOF
✅ Discovery OK:
  PROJECT_NAME:   $PROJECT_NAME
  PROJECT_DIR:    $PROJECT_DIR
  OPS_YML:        $([ -f "$OPS_YML" ] && echo "encontrado" || echo "<ausente → defaults>")
  VENV:           $VENV $([ -x "$PY" ] && echo "(existe)" || echo "(a crear)")
  REQ_PATH:       $REQ_PATH
  DB_TYPE:        ${DB_TYPE:-<desconocido>}
  HAS_FRONTEND:   $HAS_FRONTEND
  FRONTEND_CMD:   $FRONTEND_CMD
  BACKEND_PORT:   $BACKEND_PORT
  FRONTEND_PORT:  $FRONTEND_PORT
  LOG_DIR:        $LOG_DIR
  RESTART:        $RESTART
EOF
```

> Exportá estas variables al resto de las fases. Los bloques siguientes asumen
> `PROJECT_DIR`, `VENV`, `PY`, `REQ_PATH`, `HAS_FRONTEND`, `FRONTEND_CMD`,
> `LOG_DIR`, los puertos y `RESTART`.

---

## Phase 1 — Python venv + pip (idempotente)

`manage.py` defaultea al settings `*_dev` (DEBUG + SQLite + email a consola) en
los proyectos del fleet, así que **no hace falta `.env`**: los `config()` tienen
defaults razonables.

```bash
if [ -x "$PY" ]; then
  echo "ℹ️  venv ya existe ($VENV) — skip creación."
else
  echo "→ Creando venv en $VENV…"
  if python3 -m venv "$VENV" 2>/tmp/venv_err.txt; then
    echo "✅ venv creado con pip."
  else
    # Debian/Ubuntu sin python3-venv: ensurepip no disponible. Creamos sin pip
    # y lo bootstrapeamos con get-pip.py (no requiere sudo).
    echo "⚠️  ensurepip no disponible — creando venv --without-pip y bootstrapeando pip…"
    rm -rf "$VENV"
    python3 -m venv --without-pip "$VENV" || { echo "❌ No se pudo crear el venv"; cat /tmp/venv_err.txt; exit 1; }
    curl -fsSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py || { echo "❌ No se pudo descargar get-pip.py (¿sin internet?)"; exit 1; }
    "$PY" /tmp/get-pip.py -q || { echo "❌ Falló el bootstrap de pip"; exit 1; }
  fi
fi
"$PY" -m pip --version
```

---

## Phase 2 — Deps backend (idempotente)

```bash
if "$PY" -c "import django" 2>/dev/null; then
  echo "ℹ️  Django ya instalado — skip deps backend."
else
  echo "→ Instalando deps backend ($REQ_PATH)…"
  if "$PY" -m pip install -r "$PROJECT_DIR/$REQ_PATH"; then
    echo "✅ Deps backend instaladas."
  else
    # mysqlclient no compila sin libmysqlclient/pkg-config (requieren sudo).
    # En dev usamos SQLite, así que mysqlclient no es necesario: lo excluimos.
    echo "⚠️  Falló el install (probablemente mysqlclient). En dev usamos SQLite → reintento sin mysqlclient."
    grep -iv 'mysqlclient' "$PROJECT_DIR/$REQ_PATH" > /tmp/req-dev.txt
    "$PY" -m pip install -r /tmp/req-dev.txt || { echo "❌ Falló el install de deps backend"; exit 1; }
    echo "ℹ️  mysqlclient OMITIDO a propósito (no se usa en dev/SQLite)."
  fi
fi
```

---

## Phase 3 — Django check + migrate

```bash
cd "$PROJECT_DIR/backend"
"$PY" manage.py check || { echo "❌ django check falló"; exit 1; }
# migrate crea/actualiza la BD SQLite de dev (settings *_dev por el setdefault de manage.py).
"$PY" manage.py migrate --noinput || { echo "❌ migrate falló"; exit 1; }
cd "$PROJECT_DIR"
echo "✅ check + migrate OK (SQLite)."
```

---

## Phase 4 — Deps frontend (idempotente)

```bash
if [ "$HAS_FRONTEND" != true ] || [ ! -f "$PROJECT_DIR/frontend/package.json" ]; then
  echo "ℹ️  Proyecto sin frontend — skip."
elif [ -d "$PROJECT_DIR/frontend/node_modules" ]; then
  echo "ℹ️  node_modules ya existe — skip npm install. (Borralo para forzar reinstall.)"
else
  echo "→ npm install (puede tardar un par de minutos)…"
  npm --prefix "$PROJECT_DIR/frontend" install || { echo "❌ npm install falló"; exit 1; }
  echo "✅ Deps frontend instaladas."
fi
```

---

## Phase 5 — Arranque (port-aware, background)

Backend en `127.0.0.1`; el frontend dev server suele enlazar a `localhost` IPv6
(`[::1]`) — importante para el health check de Phase 6.

```bash
port_busy() { ss -ltn 2>/dev/null | grep -qE "[:.]$1[[:space:]]"; }

start_server() {
  local name="$1" port="$2" cmd="$3"
  local log="$LOG_DIR/$name.log" pidf="$LOG_DIR/$name.pid"
  if port_busy "$port"; then
    if [ "$RESTART" = true ]; then
      echo "→ [$name] puerto $port ocupado y --restart: matando proceso viejo…"
      [ -f "$pidf" ] && kill "$(cat "$pidf")" 2>/dev/null
      fuser -k "$port/tcp" 2>/dev/null || true
      sleep 2
    else
      echo "ℹ️  [$name] ya escuchando en $port — reuso (pasá --restart para relanzar)."
      return 0
    fi
  fi
  echo "→ [$name] arrancando en background → $log"
  nohup bash -c "$cmd" > "$log" 2>&1 &
  echo $! > "$pidf"
  echo "   PID $(cat "$pidf")"
}

start_server backend "$BACKEND_PORT" "cd '$PROJECT_DIR/backend' && '$PY' manage.py runserver 127.0.0.1:$BACKEND_PORT"
if [ "$HAS_FRONTEND" = true ] && [ -f "$PROJECT_DIR/frontend/package.json" ]; then
  start_server frontend "$FRONTEND_PORT" "npm --prefix '$PROJECT_DIR/frontend' run dev -- --port $FRONTEND_PORT"
fi
```

---

## Phase 6 — Verificación de salud

```bash
echo "→ Esperando backend (127.0.0.1:$BACKEND_PORT)…"
BACK_CODE=000
for i in $(seq 1 30); do
  # curl -w ya imprime 000 si la conexión falla; NO añadir '|| echo 000' (duplicaría a "000000").
  BACK_CODE=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$BACKEND_PORT/" 2>/dev/null)
  BACK_CODE=${BACK_CODE:-000}
  [ "$BACK_CODE" != 000 ] && break
  sleep 1
done
echo "backend  127.0.0.1:$BACKEND_PORT  → HTTP $BACK_CODE   (302/200/404 = vivo)"

if [ "$HAS_FRONTEND" = true ] && [ -f "$PROJECT_DIR/frontend/package.json" ]; then
  # Muchos dev servers (nuxi/vite) enlazan a localhost IPv6 ([::1]) — usar 'localhost', NO 127.0.0.1.
  echo "→ Esperando frontend (localhost:$FRONTEND_PORT)…"
  FRONT_CODE=000
  for i in $(seq 1 60); do
    if grep -qiE "Local:|Nitro server built|ready in|localhost:$FRONTEND_PORT" "$LOG_DIR/frontend.log" 2>/dev/null; then
      FRONT_CODE=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://localhost:$FRONTEND_PORT/" 2>/dev/null)
      FRONT_CODE=${FRONT_CODE:-000}
      [ "$FRONT_CODE" != 000 ] && break
    fi
    sleep 2
  done
  echo "frontend localhost:$FRONTEND_PORT → HTTP $FRONT_CODE  (abrir http://localhost:$FRONTEND_PORT — NO 127.0.0.1, bind IPv6)"
fi
```

---

## Phase 7 — Monitoreo de logs (snapshot + bajo demanda)

Snapshot inicial + ventana corta para cazar errores de arranque o crashes.

```bash
ERR_RE="Traceback|ModuleNotFoundError|SystemCheckError|ImportError|EADDRINUSE|address already in use|ELIFECYCLE|Cannot find module|Error:|that port is already in use"
SERVERS="backend"; { [ "$HAS_FRONTEND" = true ] && [ -f "$PROJECT_DIR/frontend/package.json" ]; } && SERVERS="backend frontend"

for s in $SERVERS; do echo "=== $s.log (últimas 40) ==="; tail -n 40 "$LOG_DIR/$s.log" 2>/dev/null; done

STATUS="🟢 limpio"
for i in 1 2 3; do
  sleep 8
  for s in $SERVERS; do
    pidf="$LOG_DIR/$s.pid"
    if [ -f "$pidf" ] && ! kill -0 "$(cat "$pidf")" 2>/dev/null; then
      echo "🔴 [$s] el proceso murió. Últimas líneas:"; tail -n 20 "$LOG_DIR/$s.log"; STATUS="🔴 crash"
    fi
    if grep -nE "$ERR_RE" "$LOG_DIR/$s.log" 2>/dev/null | tail -n 5 | grep -q .; then
      echo "⚠️  [$s] señales de error en el log:"; grep -nE "$ERR_RE" "$LOG_DIR/$s.log" | tail -n 5; STATUS="🔴 errores"
    fi
  done
done
echo "Monitoreo: $STATUS"

cat <<EOF

Seguimiento (bajo demanda):
  tail -f $LOG_DIR/backend.log
  tail -f $LOG_DIR/frontend.log
Bajar los servers:
  /dev-down            (o: kill \$(cat $LOG_DIR/*.pid) 2>/dev/null)
EOF
```

> **Monitoreo continuo**: por defecto es snapshot. Si el usuario lo pide, seguí
> vigilando releyendo los logs (`tail`/`Read`) cada cierto tiempo y reportá
> cualquier `Traceback`/`EADDRINUSE`/crash que aparezca.

---

## Notas

- Skill **solo dev machine**. El gate de arriba refusa en VPS/prod (no es error).
- **Genérica**: auto-descubre `has_frontend`, `requirements_path`, `venv_path`, `db`
  desde `projects.yml`. Si el proyecto no está registrado, usa defaults
  (`backend/requirements.txt`, frontend por `frontend/package.json`, venv `.venv`).
- **Idempotente**: reutiliza venv, `node_modules`, db y servers vivos.
- Sin `--restart` reusa servers ya escuchando; con `--restart` los relanza.
- No requiere `.env` ni Redis: settings `*_dev` usa SQLite y el cache cae a local.
- `mysqlclient` se omite a propósito en dev (solo se usa con MySQL en prod).
- La BD SQLite arranca **vacía**. Para datos usar `/fake-data-refresh`; para acceso
  al panel, `manage.py createsuperuser`.
- Para detener: `/dev-down`.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/dev-up`:

```markdown
🟢 dev-up OK — <proyecto> (dev machine)
✨ Backend (y frontend) arriba y monitoreados.

| Dimensión | Estado | Detalle |
|---|---|---|
| Entorno | ✅ | Dev machine (no es VPS/prod) |
| Phase 0 — Discovery | ✅ | projects.yml leído; puertos <b>/<f>; logs en /tmp/<proyecto>-dev |
| Phase 1 — venv + pip | ✅ | venv listo (o creado con --without-pip + get-pip) |
| Phase 2 — Deps backend | ✅ | requirements instaladas (mysqlclient omitido si MySQL) |
| Phase 3 — check + migrate | ✅ | SQLite migrada |
| Phase 4 — Deps frontend | ✅ | node_modules listo (o N/A sin frontend) |
| Phase 5 — Arranque | ✅ | backend PID <x> (+ frontend PID <y>) |
| Phase 6 — Health | ✅ | backend 302 (+ frontend 200 en http://localhost:<f>) |
| Phase 7 — Monitoreo | ✅ | logs limpios (~24s de vigilancia) |
```

Si el gate refusa (corriendo en VPS), reportar 🚫 con `## Next steps` indicando
`/deploy-and-check` — **no es error**, es safety gate.

Si un server no levanta, health 000, o aparece un crash/error en los logs,
reemplazar ✅ por 🔴, omitir la línea ✨ y agregar `## Next steps` con el extracto
relevante de `/tmp/<proyecto>-dev/{backend,frontend}.log`.

---

## Notas de fleet

- Fuente canónica: `vps-ops-toolkit/workflows/.claude/dev-up.md`. Las versiones en
  `.windsurf/` y `.agents/skills/` son copias del mismo contenido (distintas por frontmatter).
- Skill complementaria: `/dev-down` (detiene los servers que esta skill levanta).
