---
name: deploy-and-check
description: "Deploy a project (any environment). Defaults to current git branch; pass a branch name as argument to switch. Auto-discovers project metadata from projects.yml."
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[branch-name (opcional — default: rama actual del repo)]"
---

# Deploy & Check — Generic

Despliegue del proyecto actual (auto-detectado desde `pwd` + `~/webapps/ops/vps/projects.yml`). Funciona para staging y producción.

- **Stack**: Django + Gunicorn + Nginx + (MySQL 8 | SQLite) + Redis + Huey
- **Frontends soportados**: Vite (build estático), Next.js export (estático), Next.js SSR
- **Branch**: por defecto usa la rama en que está parado el repositorio. Pasar argumento para hacer checkout a otra rama.

> **⚠️ How to invoke**:
> - Sin argumento: `/deploy-and-check` → despliega en la rama actual del repo.
> - Con argumento: `/deploy-and-check release/may-2026` → hace checkout a esa rama y despliega.
>
> Claude Code will substitute `$ARGUMENTS` in all commands below with the provided branch name (empty if omitted).

---

## Phase 0 — Discovery

```bash
PROJECT_DIR=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR")
OPS_YML="$HOME/webapps/ops/vps/projects.yml"
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

cat <<EOF
✅ Discovery OK:
  PROJECT_NAME:    $PROJECT_NAME
  PROJECT_DIR:     $PROJECT_DIR
  ENVIRONMENT:     ${ENV:-production}
  DOMAIN:          $DOMAIN
  GUNICORN_SVC:    $GUNICORN_SVC
  HUEY_SVC:        $HUEY_SVC
  DB_TYPE:         $DB_TYPE
  HAS_FRONTEND:    $HAS_FRONTEND
  NODE_VERSION:    $NODE_VERSION
  BRANCH:          $BRANCH
EOF
```

---

## Phase 1 — Pre-deploy checks

1. Salud del servidor:
```bash
bash $HOME/webapps/ops/vps/scripts/diagnostics/quick-status.sh
```

2. Working tree limpio:
```bash
cd "$PROJECT_DIR" && git status
```

3. Branch existe en remote:
```bash
cd "$PROJECT_DIR" && git fetch origin && git branch -r | grep -E " origin/$BRANCH\$"
```

---

## Phase 2 — Pull & build

4. Checkout y pull:
```bash
cd "$PROJECT_DIR" && git fetch origin && git checkout "$BRANCH" && git pull origin "$BRANCH"
```

5. Backend deps + migrations:
```bash
cd "$PROJECT_DIR/backend" && \
    "$PROJECT_DIR/$VENV_PATH" -m pip install -r requirements.txt && \
    "$PROJECT_DIR/$VENV_PATH" manage.py migrate
```

6. Frontend build (si aplica):
```bash
if [ "$HAS_FRONTEND" = "true" ]; then
    bash -c "
        export NVM_DIR=\"\$HOME/.nvm\"
        source \"\$NVM_DIR/nvm.sh\"
        [ -n \"$NODE_VERSION\" ] && nvm use $NODE_VERSION
        cd \"$PROJECT_DIR/frontend\" && $FRONTEND_BUILD
        FRONTEND_SVC=\"${PROJECT_NAME%_project}-frontend\"
        if ! systemctl list-units --all 2>/dev/null | grep -q \"\$FRONTEND_SVC.service\"; then
            rm -rf node_modules
            echo \"✅ node_modules removidos (build estático)\"
        else
            echo \"ℹ️ node_modules conservados (frontend service runtime)\"
        fi
    "
fi
```

7. Collectstatic (si aplica):
```bash
if [ "$COLLECTSTATIC" = "true" ]; then
    cd "$PROJECT_DIR/backend" && "$PROJECT_DIR/$VENV_PATH" manage.py collectstatic --noinput
fi
```

---

## Phase 3 — Restart services

8. Reiniciar gunicorn + huey + frontend:
```bash
sudo systemctl restart "$GUNICORN_SVC" && sudo systemctl restart "$HUEY_SVC"
FRONTEND_SVC="${PROJECT_NAME%_project}-frontend"
if systemctl list-units --all 2>/dev/null | grep -q "$FRONTEND_SVC.service"; then
    sudo systemctl restart "$FRONTEND_SVC"
fi
```

---

## Phase 4 — Post-deploy verification

9. Estado servicios:
```bash
systemctl is-active "$GUNICORN_SVC" && systemctl is-active "$HUEY_SVC"
```

10. Health endpoint:
```bash
curl -s "https://$DOMAIN/api/health/" | python3 -m json.tool
```

11. Confirmar branch:
```bash
cd "$PROJECT_DIR" && git log --oneline -1
```

12. Post-deploy check del repo ops:
```bash
bash $HOME/webapps/ops/vps/scripts/deployment/post-deploy-check.sh "$PROJECT_NAME"
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

- Skill **genérico** — auto-resuelve servicios, dominios y rutas desde `~/webapps/ops/vps/projects.yml`. Funciona para staging y producción.
- Sin argumento despliega en la rama actual (`git rev-parse --abbrev-ref HEAD`). Con argumento hace checkout a la rama indicada.
- Fuente canónica: `ops/vps/workflows/.claude/deploy-and-check.md`. Las versiones en `.windsurf/` y `.agents/skills/` son copias del mismo contenido.
