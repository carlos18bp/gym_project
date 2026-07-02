---
name: dev-down
description: "Detiene el entorno de desarrollo LOCAL levantado por /dev-up: mata los procesos de backend (runserver) y frontend (dev server) por PID file, con fallback por puerto, y verifica que queden libres. Solo dev machine — refusa en VPS/prod."
disable-model-invocation: true
allowed-tools: Bash, Read
argument-hint: "[--backend-port=8000] [--frontend-port=3000] [--clean-logs]"
---

## Entorno requerido

**Esta skill SOLO funciona desde la dev machine.** Mata procesos de servers de
desarrollo (no servicios systemd). En el VPS NUNCA debe correr — ahí se gestionan
con `systemctl stop`, no matando procesos.

**Verificación obligatoria ANTES de cualquier otro paso**:

```bash
PROJECT_NAME=$(basename "$(pwd)")
GUN_SVC_GUESS="${PROJECT_NAME%_staging}"
if [[ -d /home/ryzepeck/webapps ]] \
   || systemctl is-active --quiet "$GUN_SVC_GUESS.service" 2>/dev/null \
   || systemctl is-active --quiet "$PROJECT_NAME.service" 2>/dev/null; then
  echo "❌ Esto parece un VPS / entorno de producción."
  echo "   Esta skill solo detiene dev servers locales — en el VPS usá systemctl."
  exit 2
fi
echo "✅ Dev machine detectada, procediendo."
```

Si el bloque aborta con ❌, **NO continuar** — no es error, es un safety gate.

---

# Dev Down — Stop dev servers (local dev)

Detiene los servers de desarrollo que `/dev-up` dejó corriendo en background:
backend (Django `runserver`) y frontend (dev server). Idempotente: si ya están
caídos, lo reporta sin error.

> **⚠️ How to invoke**:
> - `/dev-down` → detiene backend + frontend de este proyecto.
> - `/dev-down --backend-port=8001 --frontend-port=3001` → puertos custom.
> - `/dev-down --clean-logs` → además borra los logs de `/tmp/<proyecto>-dev/`.
>
> Claude Code substituye `$ARGUMENTS` con los flags pasados (vacío si se omiten).

---

## Phase 0 — Discovery

```bash
set -o pipefail
ARGS="$ARGUMENTS"
PROJECT_DIR=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR")
LOG_DIR="/tmp/$PROJECT_NAME-dev"

CLEAN_LOGS=false; BACKEND_PORT=8000; FRONTEND_PORT=3000
case "$ARGS" in *--clean-logs*) CLEAN_LOGS=true;; esac
_bp=$(printf '%s\n' "$ARGS" | grep -oE -- '--backend-port=[0-9]+'  | cut -d= -f2); [ -n "$_bp" ] && BACKEND_PORT="$_bp"
_fp=$(printf '%s\n' "$ARGS" | grep -oE -- '--frontend-port=[0-9]+' | cut -d= -f2); [ -n "$_fp" ] && FRONTEND_PORT="$_fp"

cat <<EOF
✅ Discovery OK:
  PROJECT_NAME:   $PROJECT_NAME
  LOG_DIR:        $LOG_DIR $([ -d "$LOG_DIR" ] && echo "(existe)" || echo "(ausente)")
  BACKEND_PORT:   $BACKEND_PORT
  FRONTEND_PORT:  $FRONTEND_PORT
  CLEAN_LOGS:     $CLEAN_LOGS
EOF
```

---

## Phase 1 — Detener por PID file

Primer intento: matar por el PID que `/dev-up` guardó. `SIGTERM` y, si sigue
vivo tras 3s, `SIGKILL`. Mata también el árbol de hijos (runserver y nuxi/vite
spawnean subprocesos).

```bash
stop_by_pidfile() {
  local name="$1"
  # OJO: declarar pidf en su propia línea — en un mismo `local a=.. b=$a` los RHS
  # se expanden ANTES de asignarse, así que $name saldría vacío (gotcha de bash).
  local pidf="$LOG_DIR/$name.pid"
  [ -f "$pidf" ] || { echo "ℹ️  [$name] sin pidfile."; return 0; }
  local pid; pid=$(cat "$pidf" 2>/dev/null)
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "ℹ️  [$name] PID $pid ya no está vivo."; rm -f "$pidf"; return 0
  fi
  echo "→ [$name] SIGTERM al PID $pid (y su grupo)…"
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  for i in 1 2 3; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  if kill -0 "$pid" 2>/dev/null; then
    echo "→ [$name] seguía vivo — SIGKILL."; kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
  fi
  rm -f "$pidf"; echo "✅ [$name] detenido."
}

stop_by_pidfile backend
stop_by_pidfile frontend
```

---

## Phase 2 — Fallback por puerto

Si algún server quedó escuchando (p.ej. arrancado a mano, sin pidfile), liberar
el puerto matando SOLO el listener. `fuser -k` apunta al proceso que tiene el
puerto, sin tocar nada más.

```bash
free_port() {
  local name="$1" port="$2"
  if ss -ltn 2>/dev/null | grep -qE "[:.]$port[[:space:]]"; then
    echo "→ [$name] puerto $port aún ocupado — liberando (fuser -k $port/tcp)…"
    fuser -k "$port/tcp" 2>/dev/null || true
    sleep 2
  fi
}
free_port backend  "$BACKEND_PORT"
free_port frontend "$FRONTEND_PORT"
```

---

## Phase 3 — Verificación + limpieza

```bash
echo "=== Estado de puertos ==="
for p in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if ss -ltn 2>/dev/null | grep -qE "[:.]$p[[:space:]]"; then
    echo "🔴 puerto $p TODAVÍA ocupado:"; ss -ltnp 2>/dev/null | grep -E "[:.]$p[[:space:]]"
  else
    echo "✅ puerto $p libre."
  fi
done

if [ "$CLEAN_LOGS" = true ]; then
  rm -rf "$LOG_DIR"; echo "🧹 logs borrados ($LOG_DIR)."
else
  echo "ℹ️  logs conservados en $LOG_DIR (pasá --clean-logs para borrarlos)."
fi
```

---

## Notas

- Skill **solo dev machine**. El gate de arriba refusa en VPS/prod (no es error).
- **Idempotente**: si los servers ya están caídos, lo reporta sin fallar.
- Mata el **grupo de procesos** (PID negativo) para llevarse runserver/nuxi y sus
  hijos; con fallback `fuser -k <puerto>/tcp` para listeners huérfanos.
- Por defecto **conserva los logs** en `/tmp/<proyecto>-dev/` (útiles para post-mortem).
- Complementaria de `/dev-up`.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/dev-down`:

```markdown
🟢 dev-down OK — <proyecto> (dev machine)
✨ Servers de desarrollo detenidos; puertos libres.

| Dimensión | Estado | Detalle |
|---|---|---|
| Entorno | ✅ | Dev machine (no es VPS/prod) |
| Phase 1 — Stop por PID | ✅ | backend/frontend detenidos (o ya caídos) |
| Phase 2 — Fallback puerto | ✅ | puertos liberados si quedaban listeners |
| Phase 3 — Verificación | ✅ | puertos <b>/<f> libres; logs conservados |
```

Si el gate refusa (corriendo en VPS), reportar 🚫 con `## Next steps` indicando
usar `systemctl stop` — **no es error**, es safety gate.

Si un puerto queda ocupado tras el fallback, reemplazar ✅ por 🔴 y agregar
`## Next steps` con el `ss -ltnp` del listener remanente.

---

## Notas de fleet

- Fuente canónica: `vps-ops-toolkit/workflows/.claude/dev-down.md`. Las versiones
  en `.windsurf/` y `.agents/skills/` son copias (distintas por frontmatter).
- Skill complementaria: `/dev-up` (levanta y monitorea los servers).
