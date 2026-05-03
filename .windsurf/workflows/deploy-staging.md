---
name: deploy-staging
description: "Deploy a release branch to a staging project for client UAT. Auto-discovers project metadata from projects.yml. Pass branch name as argument."
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[branch-name, e.g. release/march-2026]"
---

# Deploy to Staging — Generic

Despliegue de una branch de release al proyecto staging actual (auto-detectado desde `pwd` + `~/webapps/ops/vps/projects.yml`).

- **Stack base**: Django + Gunicorn + Nginx + (MySQL 8 | SQLite) + Redis + Huey
- **Frontends soportados**: Vite (build estático), Next.js SSR (con frontend service)
- **Restricción**: solo corre contra proyectos con `environment: staging` en `projects.yml`. Aborta si el cwd no es staging.

> **⚠️ How to invoke**: Pass the branch name as an argument when calling this command.
> Example: `/deploy-staging release/march-2026`
> If no branch is specified, Claude Code will ask before proceeding.
>
> Claude Code will substitute `$ARGUMENTS` in all commands below with the provided branch name.

---

## Phase 0 — Discovery (resuelve metadata del proyecto desde projects.yml)

```bash
PROJECT_DIR=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR")
OPS_YML="$HOME/webapps/ops/vps/projects.yml"
[ -f "$OPS_YML" ] || { echo "❌ ERROR: $OPS_YML no encontrado"; exit 1; }

# Helper: extraer un campo de un proyecto desde projects.yml
yml_get() {
    local proj="$1" field="$2"
    awk -v p="$proj" -v f="$field" '
        /^[[:space:]]*-[[:space:]]+name:/{n=$NF; gsub(/"/,"",n)}
        n==p && $0 ~ "^[[:space:]]+"f":" {
            sub("^[[:space:]]+"f":[[:space:]]*", "")
            gsub(/"/, "")
            print
            exit
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

# Guard: solo staging
[ "$ENV" = "staging" ] || { echo "❌ ERROR: $PROJECT_NAME tiene environment=$ENV (no staging). Usar /deploy-and-check para producción."; exit 1; }

# Guard: campos obligatorios
[ -n "$GUNICORN_SVC" ] || { echo "❌ ERROR: gunicorn_service vacío para $PROJECT_NAME en projects.yml"; exit 1; }
[ -n "$HUEY_SVC" ] || { echo "❌ ERROR: huey_service vacío para $PROJECT_NAME en projects.yml"; exit 1; }

# Defaults razonables
[ -z "$VENV_PATH" ] && VENV_PATH="backend/venv/bin/python"
[ -z "$FRONTEND_BUILD" ] && FRONTEND_BUILD="npm ci && npm run build"

cat <<EOF
✅ Discovery OK:
  PROJECT_NAME:    $PROJECT_NAME
  PROJECT_DIR:     $PROJECT_DIR
  ENVIRONMENT:     $ENV
  DOMAIN:          $DOMAIN
  GUNICORN_SVC:    $GUNICORN_SVC
  HUEY_SVC:        $HUEY_SVC
  DB_TYPE:         $DB_TYPE
  HAS_FRONTEND:    $HAS_FRONTEND
  NODE_VERSION:    $NODE_VERSION
  FRONTEND_BUILD:  $FRONTEND_BUILD
  COLLECTSTATIC:   $COLLECTSTATIC
  VENV_PATH:       $VENV_PATH
  BRANCH:          $ARGUMENTS
EOF
```

---

## Phase 1 — Pre-deploy checks

1. Verificar salud del servidor antes de desplegar:
```bash
bash $HOME/webapps/ops/vps/scripts/diagnostics/quick-status.sh
```
Si algún servicio crítico está caído o disco >85%, **detenerse y arreglar antes de desplegar**.

2. Estado de git (working tree limpio):
```bash
cd "$PROJECT_DIR" && git status
```
Esperado: `nothing to commit, working tree clean`. Si hay cambios sin commit, hacer stash o discard primero.

3. Verificar que la branch existe en remote:
```bash
cd "$PROJECT_DIR" && git fetch origin && git branch -r | grep -E " origin/$ARGUMENTS\$"
```
Si la branch no existe, **detenerse — nombre incorrecto o no pusheada aún**.

---

## Phase 2 — Pull & build

4. Checkout y pull:
```bash
cd "$PROJECT_DIR" && git fetch origin && git checkout "$ARGUMENTS" && git pull origin "$ARGUMENTS"
```

5. Backend deps + migrations:
```bash
cd "$PROJECT_DIR/backend" && \
    "$PROJECT_DIR/$VENV_PATH" -m pip install -r requirements.txt && \
    "$PROJECT_DIR/$VENV_PATH" manage.py migrate
```

6. Frontend build (solo si `HAS_FRONTEND=true`):
```bash
if [ "$HAS_FRONTEND" = "true" ]; then
    bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        source \"\$NVM_DIR/nvm.sh\"
        nvm use $NODE_VERSION
        cd \"$PROJECT_DIR/frontend\" && $FRONTEND_BUILD && rm -rf node_modules
    "
else
    echo "⏭️ HAS_FRONTEND=$HAS_FRONTEND, skip build"
fi
```
> `rm -rf node_modules` solo corre si el build tiene éxito. Libera ~200–800 MB.

6b. (Opcional) Verificar que se borraron los node_modules (solo proyectos con build estático — Next.js SSR los necesita):
```bash
if [ "$HAS_FRONTEND" = "true" ] && [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
    echo "✅ node_modules removidos"
elif [ "$HAS_FRONTEND" = "true" ]; then
    echo "ℹ️ node_modules conservados (probablemente Next.js SSR runtime)"
fi
```

7. Collectstatic (solo si `COLLECTSTATIC=true`):
```bash
if [ "$COLLECTSTATIC" = "true" ]; then
    cd "$PROJECT_DIR/backend" && "$PROJECT_DIR/$VENV_PATH" manage.py collectstatic --noinput
fi
```

---

## Phase 3 — Restart services

8. Reiniciar Gunicorn y Huey del staging:
```bash
sudo systemctl restart "$GUNICORN_SVC" && sudo systemctl restart "$HUEY_SVC"
# Si tiene frontend Next.js SSR (mimittos, tuhuella, xpandia), reiniciar también el frontend service:
FRONTEND_SVC="${PROJECT_NAME%_project}-frontend"
if systemctl list-units --all 2>/dev/null | grep -q "$FRONTEND_SVC.service"; then
    sudo systemctl restart "$FRONTEND_SVC"
fi
```

---

## Phase 4 — Post-deploy verification

9. Servicios activos:
```bash
systemctl is-active "$GUNICORN_SVC" && systemctl is-active "$HUEY_SVC"
```
Esperado: `active`, `active`.

10. Health endpoint:
```bash
curl -s "https://$DOMAIN/api/health/" | python3 -m json.tool
```
Esperado: `{"app": "ok", "database": "ok", "redis": "ok"}` con HTTP 200.

11. Confirmar branch desplegada:
```bash
cd "$PROJECT_DIR" && git log --oneline -1
```
Verificar que el commit coincide con el último de `$ARGUMENTS`.

---

## Phase 5 — Troubleshooting (solo si algo falla)

12. Logs Gunicorn:
```bash
sudo journalctl -u "$GUNICORN_SVC" --no-pager -n 50
```

13. Logs Huey:
```bash
sudo journalctl -u "$HUEY_SVC" --no-pager -n 50
```

14. Logs Nginx error:
```bash
sudo tail -30 /var/log/nginx/error.log
```

15. Logs Django (si existen):
```bash
tail -50 "$PROJECT_DIR/backend/logs/django.log" 2>/dev/null || \
tail -50 "$PROJECT_DIR/backend/debug.log" 2>/dev/null
```

16. Estado systemd detallado:
```bash
sudo systemctl status "$GUNICORN_SVC" --no-pager -l
sudo systemctl status "$HUEY_SVC" --no-pager -l
```

---

## Phase 6 — Notify (opcional)

17. Una vez que la verificación pase, notificar al cliente que staging está listo para UAT:
- **URL**: `https://$DOMAIN`
- **Branch**: `$ARGUMENTS`
- **Fecha**: (fecha actual)

---

## Notas

- Este workflow **NO hace merge a main/master**. Solo despliega una release branch a staging para aprobación del cliente.
- Tras aprobación del cliente, usar `/deploy-and-check` para desplegar a producción (después del merge).
- La branch se especifica al invocar — no editar este archivo por release.
- Staging usa **DB y `.env` separados** de producción — el testing del cliente no afecta datos productivos.
- Para staging, el `.env` debe tener `BACKUPS_ENABLED=False` y `ENABLE_SLOW_QUERIES_REPORT=False` (tareas Huey desactivadas por convención del fleet).
- Este skill es **genérico** — auto-resuelve servicios, dominios y rutas desde `~/webapps/ops/vps/projects.yml`. La fuente canónica vive en `ops/vps/workflows/.claude/deploy-staging.md` y se distribuye con `scripts/maintenance/sync-deploy-staging-skill.sh`.
