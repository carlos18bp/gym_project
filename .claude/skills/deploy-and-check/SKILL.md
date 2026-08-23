---
name: deploy-and-check
description: "VPS-only — Deploy a project (any environment). Defaults to current git branch; pass a branch name as argument to switch. Auto-discovers project metadata from projects.yml."
disable-model-invocation: true
allowed-tools: Bash, AskUserQuestion
argument-hint: "[branch-name (opcional — default: rama actual del repo)]"
---

## Entorno requerido

**Esta skill SOLO funciona desde un VPS** — necesita `systemctl`, `nginx`, `journalctl`, y paths `/home/ryzepeck/webapps/...`. Si la invocás desde la dev machine, los restarts de servicio fallarán y los logs no estarán disponibles.

**Verificación obligatoria ANTES de cualquier otro paso**:

```bash
# canon: is_dev_machine() (bootstrap-common.sh) — cubre los dir-candidates de dev
# Y el override FLEET_ENV=dev|vps; no hand-rollear el check de paths acá.
export OPS_ROOT="$HOME/webapps/vps-ops-toolkit" MODE=--check
source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
if is_dev_machine; then
  echo "❌ Esta skill no se puede ejecutar desde la dev machine."
  echo "   SSH primero al VPS destino:"
  echo "     ssh vps-projectapp-staging · vps-projectapp-prod · vps-gym"
  echo "     cd ~/webapps/<proyecto> && claude → /deploy-and-check"
  exit 2
fi
echo "✅ Entorno VPS detectado, procediendo."
```

Si el bloque aborta con ❌, **NO continuar** con las fases siguientes — SSH al VPS destino y re-invocar la skill allí.

---

# Deploy & Check — Generic

Despliegue del proyecto actual (auto-detectado desde `pwd` + `~/webapps/vps-ops-toolkit/projects.yml`). Funciona para staging y producción.

- **Stack**: Django + Gunicorn + Nginx + (MySQL 8 | SQLite) + Redis + Huey
- **Frontends soportados**: Vite (build estático), Next.js export (estático), Next.js SSR
- **Branch**: por defecto usa la rama en que está parado el repositorio. Pasar argumento para hacer checkout a otra rama.

> **⚠️ How to invoke**:
> - Sin argumento: `/deploy-and-check` → despliega en la rama actual del repo.
> - Con argumento: `/deploy-and-check release/may-2026` → hace checkout a esa rama y despliega.
>
> Claude Code will substitute `$ARGUMENTS` in all commands below with the provided branch name (empty if omitted).

---

## Cómo invocar este skill (picker pre-run — §4)

Skill **manual-only por política** (`disable-model-invocation: true`): no es
auto-invocable ni ofrecible como opción clickeable por otras skills — este picker
aplica sólo cuando el operador la invoca por slash. Gating ([[_output-protocol]] §4):

1. Con argumento (`/deploy-and-check <rama>`) → ejecutar directo, sin menú.
2. Rama clara por el contexto de la sesión → proponer el comando en una línea y
   esperar confirmación.
3. Sin argumento e intención difusa → UNA `AskUserQuestion` (Q1). Nunca en modo
   fleet/headless/cron.

**Q1 — Rama** (single-select):

| label | description | preview |
|---|---|---|
| Rama actual del clon (Recommended) | despliega la rama en que está parado el repo (`git rev-parse --abbrev-ref HEAD`, el default de Phase 0) | `/deploy-and-check` |
| Otra rama | elegir Other y tipear el nombre — hace checkout a esa rama y despliega | `/deploy-and-check <rama>` |

**Qué NO se pregunta:** nada oculto — el único argumento es la rama.

---

## Phase 0 — Discovery

```bash
PROJECT_DIR=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR")
OPS_YML="$HOME/webapps/vps-ops-toolkit/projects.yml"
[ -f "$OPS_YML" ] || { echo "❌ ERROR: $OPS_YML no encontrado"; exit 1; }

yml_get() {
    local proj="$1" field="$2"
    awk -v p="$proj" -v f="$field" '
        /^[[:space:]]*-[[:space:]]+name:/{n=$NF; gsub(/"/,"",n)}
        n==p && $0 ~ "^[[:space:]]+"f":" {
            sub("^[[:space:]]+"f":[[:space:]]*", ""); gsub(/"/, ""); print; exit
        }
    ' "$OPS_YML"
}

GUNICORN_SVC=$(yml_get "$PROJECT_NAME" gunicorn_service)
HUEY_SVC=$(yml_get "$PROJECT_NAME" huey_service)
DOMAIN=$(yml_get "$PROJECT_NAME" domain)
ENV=$(yml_get "$PROJECT_NAME" environment)
HAS_FRONTEND=$(yml_get "$PROJECT_NAME" has_frontend)
NODE_VERSION=$(yml_get "$PROJECT_NAME" node_version)
DB_TYPE=$(yml_get "$PROJECT_NAME" db)
FRONTEND_BUILD=$(yml_get "$PROJECT_NAME" frontend_build)
COLLECTSTATIC=$(yml_get "$PROJECT_NAME" collectstatic)
VENV_PATH=$(yml_get "$PROJECT_NAME" venv_path)

# Defaults
[ -z "$VENV_PATH" ] && VENV_PATH="backend/venv/bin/python"
[ -z "$FRONTEND_BUILD" ] && FRONTEND_BUILD="npm ci && npm run build"
GIT_CURRENT_BRANCH=$(cd "$PROJECT_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
BRANCH="${ARGUMENTS:-$GIT_CURRENT_BRANCH}"
[ -n "$BRANCH" ] || { echo "❌ ERROR: no se pudo determinar la rama actual y no se especificó argumento"; exit 1; }

# manage.py defaultea a *_dev (SQLite) en varios proyectos del fleet, así que
# migrate/collectstatic DEBEN usar el módulo de prod o pegan a la base equivocada.
# Fuente primaria: el Environment= del unit systemd de gunicorn. Fallback: backend/.env.
# Los pasos 5 (migrate) y 7 (collectstatic) lo re-derivan (el env no persiste entre pasos del skill).
DJANGO_SETTINGS_MODULE=$(systemctl show "$GUNICORN_SVC" -p Environment --value 2>/dev/null \
        | tr ' ' '\n' | grep '^DJANGO_SETTINGS_MODULE=' | head -1 | cut -d= -f2-)
[ -z "$DJANGO_SETTINGS_MODULE" ] && DJANGO_SETTINGS_MODULE=$(grep -hE '^DJANGO_SETTINGS_MODULE=' \
        "$PROJECT_DIR/backend/.env" 2>/dev/null | head -1 | cut -d= -f2-)
# NO exportar vacío: un env var vacío ANULA el setdefault de manage.py/wsgi → ImproperlyConfigured.
# Sólo exportar si resolvió; si no, unset para que aplique el default (env-aware) del proyecto.
if [ -n "$DJANGO_SETTINGS_MODULE" ]; then export DJANGO_SETTINGS_MODULE; else unset DJANGO_SETTINGS_MODULE; fi
if [ -z "$DJANGO_SETTINGS_MODULE" ]; then
    echo "⚠️  DJANGO_SETTINGS_MODULE no resuelto (ni systemd ni .env) — manage.py usará su setdefault (¡puede apuntar a dev/SQLite!)"
fi

cat <<EOF
✅ Discovery OK:
  PROJECT_NAME:    $PROJECT_NAME
  PROJECT_DIR:     $PROJECT_DIR
  ENVIRONMENT:     ${ENV:-production}
  DOMAIN:          $DOMAIN
  GUNICORN_SVC:    $GUNICORN_SVC
  HUEY_SVC:        $HUEY_SVC
  DB_TYPE:         $DB_TYPE
  DJANGO_SETTINGS: ${DJANGO_SETTINGS_MODULE:-<unset → manage.py default>}
  HAS_FRONTEND:    $HAS_FRONTEND
  NODE_VERSION:    $NODE_VERSION
  BRANCH:          $BRANCH
EOF
```

---

## Phase 1 — Pre-deploy checks

1. Salud del servidor:
```bash
bash $HOME/webapps/vps-ops-toolkit/scripts/diagnostics/quick-status.sh
```

2. Working tree limpio (abortar si está sucio — el checkout de Phase 2 pisaría
   o arrastraría cambios locales):
```bash
cd "$PROJECT_DIR" && git status
git diff --quiet && git diff --cached --quiet || { echo "❌ tree sucio en el clon de deploy — anomalía: reportá al operador; no commitees ni stashees acá"; exit 1; }
```

3. Branch existe en remote:
```bash
cd "$PROJECT_DIR" && git fetch origin && git branch -r | grep -E " origin/$BRANCH\$"
```

---

## Phase 2 — Pull & build

4. Checkout y pull. Usa el prefijo `FLEET_ALLOW_MAIN_CLONE_WRITE=1` en cada
   subcomando que toca el clon: es la escapatoria documentada del guard del
   clon principal — el deploy mueve legítimamente el checkout de servicio, que
   es justo lo que el guard protege de una sesión cualquiera. Pull-only si ya
   estás en `$BRANCH` (no hace falta el checkout):
```bash
cd "$PROJECT_DIR" && git fetch origin
if [ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ]; then
    FLEET_ALLOW_MAIN_CLONE_WRITE=1 git pull --ff-only origin "$BRANCH"
else
    FLEET_ALLOW_MAIN_CLONE_WRITE=1 git checkout "$BRANCH" \
        && FLEET_ALLOW_MAIN_CLONE_WRITE=1 git pull --ff-only origin "$BRANCH"
fi
```
   Si `--ff-only` falla (el clon de deploy divergió del remoto), **no** hagas
   `git reset --hard` ni ningún otro intento de forzarlo: reportá al operador
   — es el checkout del servicio, y puede tener cambios que el operador dejó
   ahí a propósito.

5. Backend deps + migrations:
```bash
# manage.py suele tener setdefault a un settings *_dev (SQLite u otra DB). migrate DEBE
# usar el settings REAL del servicio prod, y como el env NO persiste entre pasos del skill,
# se re-deriva acá (systemd → .env). Sin esto, migrás la base equivocada.
DJANGO_SETTINGS_MODULE=$(systemctl show "$GUNICORN_SVC" -p Environment --value 2>/dev/null \
        | tr ' ' '\n' | grep '^DJANGO_SETTINGS_MODULE=' | head -1 | cut -d= -f2-)
[ -z "$DJANGO_SETTINGS_MODULE" ] && DJANGO_SETTINGS_MODULE=$(grep -hE '^DJANGO_SETTINGS_MODULE=' \
        "$PROJECT_DIR/backend/.env" 2>/dev/null | head -1 | cut -d= -f2-)
# NO exportar vacío: un env var vacío ANULA el setdefault de manage.py/wsgi → ImproperlyConfigured.
# Sólo exportar si resolvió; si no, unset para que aplique el default (env-aware) del proyecto.
if [ -n "$DJANGO_SETTINGS_MODULE" ]; then export DJANGO_SETTINGS_MODULE; else unset DJANGO_SETTINGS_MODULE; fi
echo "→ migrate con DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-<manage.py default — puede ser dev!>}"
cd "$PROJECT_DIR/backend" && \
    "$PROJECT_DIR/$VENV_PATH" -m pip install -r requirements.txt && \
    "$PROJECT_DIR/$VENV_PATH" manage.py migrate
```

6. Frontend build (si aplica):
```bash
if [ "$HAS_FRONTEND" = "true" ]; then
    # FRONTEND_SVC: preferir frontend_service: de projects.yml (fuente de verdad —
    # la derivación por nombre falla con los *_staging, p.ej. tuhuella-frontend).
    FRONTEND_SVC=$(awk -v p="$PROJECT_NAME" '
        /^[[:space:]]*-[[:space:]]+name:/{n=$NF; gsub(/"/,"",n)}
        n==p && /^[[:space:]]+frontend_service:/{print $NF; exit}
    ' "$HOME/webapps/vps-ops-toolkit/projects.yml")
    [ -z "$FRONTEND_SVC" ] && FRONTEND_SVC="${PROJECT_NAME%_project}-frontend"
    # Build en subshell con set -e: cualquier fallo corta el paso con exit ≠ 0.
    # Si falla, NO tocar node_modules (quedan para debug) y ABORTAR el deploy.
    if ! bash -ec "
        export NVM_DIR=\"\$HOME/.nvm\"
        source \"\$NVM_DIR/nvm.sh\" >/dev/null 2>&1 || true
        command -v nvm >/dev/null || { echo \"❌ nvm no disponible en \$NVM_DIR\"; exit 1; }
        if [ -n \"$NODE_VERSION\" ]; then nvm use $NODE_VERSION; fi
        cd \"$PROJECT_DIR/frontend\"
        $FRONTEND_BUILD
    "; then
        echo "❌ ERROR: frontend build FALLÓ ($FRONTEND_BUILD) — node_modules conservados; deploy abortado."
        exit 1
    fi
    if systemctl list-units --all 2>/dev/null | grep -q "$FRONTEND_SVC.service"; then
        echo "ℹ️ Build OK — node_modules conservados (frontend service runtime: $FRONTEND_SVC)"
    else
        rm -rf "$PROJECT_DIR/frontend/node_modules"
        echo "✅ Build OK — node_modules removidos (build estático)"
    fi
fi
```

7. Collectstatic (si aplica):
```bash
if [ "$COLLECTSTATIC" = "true" ]; then
    # Mismo motivo que migrate: usar el settings prod (STATIC_ROOT correcto). Re-derivar
    # porque el env no persiste entre pasos del skill.
    DJANGO_SETTINGS_MODULE=$(systemctl show "$GUNICORN_SVC" -p Environment --value 2>/dev/null \
            | tr ' ' '\n' | grep '^DJANGO_SETTINGS_MODULE=' | head -1 | cut -d= -f2-)
    [ -z "$DJANGO_SETTINGS_MODULE" ] && DJANGO_SETTINGS_MODULE=$(grep -hE '^DJANGO_SETTINGS_MODULE=' \
            "$PROJECT_DIR/backend/.env" 2>/dev/null | head -1 | cut -d= -f2-)
    # NO exportar vacío: un env var vacío ANULA el setdefault de manage.py/wsgi → ImproperlyConfigured.
    # Sólo exportar si resolvió; si no, unset para que aplique el default (env-aware) del proyecto.
    if [ -n "$DJANGO_SETTINGS_MODULE" ]; then export DJANGO_SETTINGS_MODULE; else unset DJANGO_SETTINGS_MODULE; fi
    cd "$PROJECT_DIR/backend" && "$PROJECT_DIR/$VENV_PATH" manage.py collectstatic --noinput
fi
```

---

## Phase 3 — Restart services

8. Reiniciar gunicorn + huey + frontend:
```bash
sudo systemctl restart "$GUNICORN_SVC"
# HUEY_SVC puede venir vacío (proyecto sin Huey): restart "" falla y cortaría el paso
[ -z "$HUEY_SVC" ] || sudo systemctl restart "$HUEY_SVC"
# FRONTEND_SVC: mismo lookup que el paso 6 (frontend_service: del yml, fallback legacy)
FRONTEND_SVC=$(awk -v p="$PROJECT_NAME" '
    /^[[:space:]]*-[[:space:]]+name:/{n=$NF; gsub(/"/,"",n)}
    n==p && /^[[:space:]]+frontend_service:/{print $NF; exit}
' "$HOME/webapps/vps-ops-toolkit/projects.yml")
[ -z "$FRONTEND_SVC" ] && FRONTEND_SVC="${PROJECT_NAME%_project}-frontend"
if systemctl list-units --all 2>/dev/null | grep -q "$FRONTEND_SVC.service"; then
    sudo systemctl restart "$FRONTEND_SVC"
fi
```

---

## Phase 4 — Post-deploy verification

9. Estado servicios:
```bash
systemctl is-active "$GUNICORN_SVC"
[ -z "$HUEY_SVC" ] || systemctl is-active "$HUEY_SVC"   # sin Huey: saltar
```

10. Health endpoint:
```bash
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/health/")
if [ "$HTTP_CODE" = "404" ]; then
    # 404 = ⚠️, no ❌: endpoint no estándar en este proyecto (algunos SSR no lo exponen)
    echo "⚠️ /api/health/ → 404 — endpoint no estándar en este proyecto; verificar el sitio a mano"
else
    echo "HTTP $HTTP_CODE"
    curl -s "https://$DOMAIN/api/health/" | python3 -m json.tool
fi
```

11. Confirmar branch:
```bash
cd "$PROJECT_DIR" && git log --oneline -1
```

12. Post-deploy check del repo ops:
```bash
bash $HOME/webapps/vps-ops-toolkit/scripts/deployment/post-deploy-check.sh "$PROJECT_NAME"
```

---

## Phase 5 — Troubleshooting

13. Logs:
```bash
sudo journalctl -u "$GUNICORN_SVC" --no-pager -n 50
sudo journalctl -u "$HUEY_SVC" --no-pager -n 50
sudo tail -30 /var/log/nginx/error.log
tail -50 "$PROJECT_DIR/backend/logs/django.log" 2>/dev/null || tail -50 "$PROJECT_DIR/backend/debug.log" 2>/dev/null
```

14. Estado detallado:
```bash
sudo systemctl status "$GUNICORN_SVC" --no-pager -l
sudo systemctl status "$HUEY_SVC" --no-pager -l
```

---

## Notas

- Skill **genérico** — auto-resuelve servicios, dominios y rutas desde `~/webapps/vps-ops-toolkit/projects.yml`. Funciona para staging y producción.
- Sin argumento despliega en la rama actual (`git rev-parse --abbrev-ref HEAD`). Con argumento hace checkout a la rama indicada.
- Fuente canónica: `vps-ops-toolkit/workflows/.claude/deploy-and-check.md`. La versión en `.agents/skills/` es la copia generada para Codex.

---

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de [[_output-protocol]] §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Re-correr sólo el check (Recommended) | read-only: re-valida servicios + health del proyecto sin redeployar | `bash ~/webapps/vps-ops-toolkit/scripts/deployment/post-deploy-check.sh <proyecto>` |
| Ver logs del servicio | últimas 50 líneas del journal de gunicorn/huey (Phase 5) | `sudo journalctl -u <gunicorn_svc> --no-pager -n 50` |
| Re-probar health endpoint | curl a /api/health/ del dominio (Phase 4, paso 10) | `curl -s https://<dominio>/api/health/` |

Blocklist §4: ningún restart de servicio se ofrece como fila — los restarts ya
corrieron en Phase 3 y cualquier restart extra exige leer el journal antes.

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de
`/deploy-and-check`:

```markdown
🟢 deploy-and-check OK — <proyecto> @ <rama>
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Entorno VPS | ✅ | hostname <srv>, no es dev-machine |
| Phase 0 — Discovery | ✅ | projects.yml leído: <svc>, <dominio>, <env> |
| Phase 1 — Pre-deploy | ✅ | quick-status OK, working tree clean, rama existe |
| Phase 2 — Pull & build | ✅ | git pull, pip install, migrate, frontend build |
| Phase 3 — Restart services | ✅ | gunicorn + huey + (frontend) reiniciados |
| Phase 4 — Health endpoint | ✅ | curl /api/health/ → 200 OK |
| Phase 4 — post-deploy-check | ✅ | post-deploy-check.sh PASS para <proyecto> |
```

Si la verificación de entorno falla (corriendo en dev-machine), reportar
🚫 con `## Next steps` indicando el SSH al VPS destino — **no es error**,
es safety gate.

Si gunicorn/huey no levanta, health 5xx, o post-deploy-check FAIL, reemplazar
✅ por ❌, omitir la línea ✨ y agregar `## Next steps` con los `journalctl
-u <svc> -n 50` y los logs específicos (`backend/logs/django.log`,
`/var/log/nginx/error.log`).

**No duplicar contadores con el output del script bash:** el reporte de la
skill va DESPUÉS de cualquier `print_summary` que emita post-deploy-check.sh.
