---
name: integrate-new-project
description: "Integrar un nuevo proyecto Django al ecosistema VPS (14 pasos: DB, venv, build frontend, .env, migrations, systemd incl. Next.js, nginx + SSL 2-fase, backups, logrotate, health, projects.yml, verificación)"
argument-hint: "[project_name domain light|standard] [--frontend-kind=nextjs-runtime|bake-into-django|none]"
allowed-tools: Bash, Read, Edit, Write
---

## Entorno requerido

**Esta skill SOLO funciona desde un VPS** — necesita `mysql`, `systemctl`, `certbot`, `nginx`, y paths `/home/ryzepeck/webapps/...`. Si la invocás desde la dev machine, los primeros pasos van a fallar con "command not found" o pueden dejar archivos huérfanos en `/etc/...`.

**Verificación obligatoria ANTES de cualquier otro paso**:

```bash
if [[ -d /home/dev-env/repos ]]; then
  echo "❌ Esta skill no se puede ejecutar desde la dev machine."
  echo "   SSH primero al VPS destino:"
  echo "     ssh vps-projectapp   (o vps-gym)"
  echo "     cd ~/webapps/ops/vps && claude → /integrate-new-project ..."
  exit 2
fi
echo "✅ Entorno VPS detectado, procediendo."
```

Si el bloque aborta con ❌, **NO continuar** con los pasos siguientes — SSH al VPS destino y re-invocar la skill allí.

---

Argumentos recibidos: **$ARGUMENTS**

Si `$ARGUMENTS` está vacío o incompleto, pedir al usuario antes de continuar:
- **project** — directorio (snake_case, ej. `mi_proyecto`)
- **domain** — FQDN (ej. `miproyecto.projectapp.co`)
- **profile** — `light` (150M/250M/40%) o `standard` (300M/512M/50%)
- **frontend-kind** — `nextjs-runtime` (servicio dedicado en puerto), `bake-into-django` (build:django + collectstatic), `none`

> **Regla DB:** producción = MySQL. Solo staging (con "staging" en nombre o dominio) puede usar SQLite. Si el usuario pide SQLite para prod, advertir y recomendar MySQL.

---

## Derivaciones automáticas

| Variable | Regla | Ejemplo |
|----------|-------|---------|
| `PROJECT` | tal cual | `mimittos_project` |
| `PROJECT_SLUG` | kebab, sin `_project` | `mimittos` |
| `DJANGO_PROJECT` | leer `DJANGO_SETTINGS_MODULE` en `manage.py` / `wsgi.py` | `base_feature_project` |
| `DB_NAME` | `<PROJECT>_db` | `mimittos_project_db` |
| `DB_USER` | `<PROJECT>_user` | `mimittos_project_user` |
| `SOCKET` | `/run/<PROJECT>.sock` (patrón actual) | `/run/mimittos_project.sock` |
| `BACKUP_DIR` | `/var/backups/<PROJECT>` | — |
| `GUNICORN_SERVICE` | igual a `PROJECT` | `mimittos_project` |
| `HUEY_SERVICE` | `<PROJECT_SLUG>-huey` | `mimittos-huey` |
| `FRONTEND_SERVICE` | `<PROJECT_SLUG>-frontend` (si `nextjs-runtime`) | `mimittos-frontend` |
| `FRONTEND_PORT` | siguiente libre en la tabla abajo | `3002` |

### Puertos frontend Next.js asignados (srv571894)

| Proyecto | Puerto |
|---|---|
| tuhuella_project | 3001 |
| mimittos_project | 3002 |
| **próximo libre** | **3003** |

Verificar con `ss -lntp | grep -E ':300[0-9]'` antes de asignar.

### Redis DB slots (srv571894)

Slots 0–10 usados (0 kore, 1 candle, 2 crushme, 3 taptag, 4 tenndalux-suspended, 5 projectapp, 6 azurita, 7 fernando, 8 candle_staging, 9 tuhuella, 10 mimittos). **Próximo libre: 11.**

Confirmar con `redis-cli INFO keyspace`.

---

## Paso 1: MySQL DB + Redis slot

### 1a. Generar password
```bash
python3 -c "import secrets,string; c=string.ascii_letters+string.digits+'!@#%^&*'; print(''.join([secrets.choice(string.ascii_uppercase),secrets.choice(string.ascii_lowercase),secrets.choice(string.digits),secrets.choice('!@#%^&*')]+[secrets.choice(c) for _ in range(20)]))"
```
Guardar la password en el gestor de secretos del operador. **Solo escribirla en `backend/.env` chmod 600**; NO crear `config/credentials/mysql-users.env` a partir del template si ese archivo no existe en el working tree — los placeholders `CHANGEME` pueden corromper el bootstrap de otros proyectos si alguien re-ejecuta `setup-mysql.sh`.

### 1b. Crear DB y usuario
> **Permisos sudo requeridos** para leer `/etc/mysql/debian.cnf`. Si el sandbox/guardrail lo bloquea, el operador debe ejecutar el bloque en su propia shell (prefijo `! ` en Claude Code).

```bash
DEBIAN_PASS=$(sudo awk -F '= ' '/^password/ {print $2; exit}' /etc/mysql/debian.cnf)
mysql -u debian-sys-maint -p"$DEBIAN_PASS" <<SQL
CREATE DATABASE IF NOT EXISTS <DB_NAME> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '<DB_USER>'@'localhost' IDENTIFIED BY '<GENERATED_PASSWORD>';
GRANT ALL PRIVILEGES ON <DB_NAME>.* TO '<DB_USER>'@'localhost';
FLUSH PRIVILEGES;
SQL
```

### 1c. Verificar Redis slot
```bash
redis-cli INFO keyspace   # confirmar que <REDIS_DB> no aparece
```

---

## Paso 2: Backend venv + dependencias

```bash
python3 -m venv /home/ryzepeck/webapps/<PROJECT>/backend/venv
source /home/ryzepeck/webapps/<PROJECT>/backend/venv/bin/activate
pip install --upgrade pip wheel
pip install -r /home/ryzepeck/webapps/<PROJECT>/backend/requirements.txt gunicorn mysqlclient
```

---

## Paso 3: Frontend — build ANTES de systemd

**Este paso detecta bugs del template temprano.** Si `npm run build` falla en TypeScript, parar aquí y arreglar en el repo del proyecto (ver apartado "Bugs comunes del template" al final).

### Si `frontend-kind=nextjs-runtime`:
```bash
source ~/.nvm/nvm.sh
nvm use 20.19.4                 # o la versión del .nvmrc del proyecto
cd /home/ryzepeck/webapps/<PROJECT>/frontend
npm ci
NEXT_PUBLIC_BACKEND_ORIGIN=https://<DOMAIN> npm run build
```

### Si `frontend-kind=bake-into-django`:
```bash
source ~/.nvm/nvm.sh && nvm use <NODE_VERSION>
cd /home/ryzepeck/webapps/<PROJECT>/frontend && npm ci && bash build_to_django.sh
```

### Si `frontend-kind=none`: saltar.

---

## Paso 4: `.env` de producción

```bash
cp /home/ryzepeck/webapps/<PROJECT>/backend/.env.example /home/ryzepeck/webapps/<PROJECT>/backend/.env
chmod 600 /home/ryzepeck/webapps/<PROJECT>/backend/.env
```

Editar con valores reales. Variables **obligatorias**:

| Variable | Valor |
|---|---|
| `DJANGO_ENV` | `production` |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_ALLOWED_HOSTS` | `<DOMAIN>` (sin comas, solo el dominio prod) |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://<DOMAIN>` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://<DOMAIN>` |
| `DJANGO_DB_ENGINE` | `django.db.backends.mysql` |
| `DB_NAME` | `<DB_NAME>` |
| `DB_USER` | `<DB_USER>` |
| `DB_PASSWORD` | `<GENERATED_PASSWORD>` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `REDIS_URL` | `redis://localhost:6379/<REDIS_DB>` |
| `BACKUP_STORAGE_PATH` | `/var/backups/<PROJECT>` |
| `ENABLE_SILK` | `false` (salvo que necesites profiling) |

> ⚠️ **Trampa conocida del template `base_feature_project`:** `settings.py` (dev) lee `DJANGO_DB_NAME`, pero `settings_prod.py` lee `DB_NAME`. En producción siempre usar `DB_NAME=...` (no `DJANGO_DB_NAME=...`). Idem para `FRONTEND_URL`: debe ser `https://<DOMAIN>`, nunca `localhost`.

> ⚠️ **Wompi / integraciones de pago:** si el cliente solo entregó claves sandbox (`pub_test_*`, `prv_test_*`), dejarlo documentado en `projects.yml` `notes:` y en un comentario del `.env`. Migrar a producción es un TODO explícito.

### 4b. Template versionado para el repo ops
```bash
mkdir -p /home/ryzepeck/webapps/ops/vps/config/project-env-templates/<PROJECT>
# copiar backend/.env.example → backend.env reemplazando valores por <placeholders>
```

---

## Paso 5: Migraciones + collectstatic

```bash
cd /home/ryzepeck/webapps/<PROJECT>/backend
source venv/bin/activate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py migrate --noinput
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py collectstatic --noinput
```

---

## Paso 6: Systemd services

Crear cada unit file en `/etc/systemd/system/` **Y DUPLICAR en `/home/ryzepeck/webapps/ops/vps/config/systemd/`** (idéntica, sin comentarios distintos). Si no lo duplicás, `verify-state.sh` reporta drift.

### 6a. Socket (gunicorn)
Archivo `/etc/systemd/system/<PROJECT>.socket`:
```ini
[Unit]
Description=<PROJECT> Gunicorn Socket

[Socket]
ListenStream=/run/<PROJECT>.sock
SocketUser=www-data

[Install]
WantedBy=sockets.target
```

### 6b. Gunicorn service
`/etc/systemd/system/<PROJECT>.service`:
```ini
[Unit]
Description=Gunicorn daemon for <PROJECT>
Requires=<PROJECT>.socket
After=network.target

[Service]
Type=notify
User=ryzepeck
Group=www-data
WorkingDirectory=/home/ryzepeck/webapps/<PROJECT>/backend
Environment="DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod"
ExecStart=/home/ryzepeck/webapps/<PROJECT>/backend/venv/bin/gunicorn \
    --workers 2 \
    --max-requests 800 \
    --max-requests-jitter 80 \
    --timeout 30 \
    --graceful-timeout 20 \
    --bind unix:/run/<PROJECT>.sock \
    <DJANGO_PROJECT>.wsgi:application
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### 6c. Huey service
`/etc/systemd/system/<HUEY_SERVICE>.service`:
```ini
[Unit]
Description=<PROJECT> Huey Task Queue
After=network.target redis-server.service

[Service]
Type=simple
User=ryzepeck
Group=www-data
WorkingDirectory=/home/ryzepeck/webapps/<PROJECT>/backend
Environment="DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod"
ExecStart=/home/ryzepeck/webapps/<PROJECT>/backend/venv/bin/python \
          manage.py run_huey --workers 1
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 6d. Frontend service (solo si `nextjs-runtime`)
`/etc/systemd/system/<FRONTEND_SERVICE>.service`:
```ini
[Unit]
Description=<PROJECT> Next.js Frontend
After=network.target

[Service]
Type=simple
User=ryzepeck
Group=www-data
WorkingDirectory=/home/ryzepeck/webapps/<PROJECT>/frontend
Environment="NODE_ENV=production"
Environment="PORT=<FRONTEND_PORT>"
Environment="NEXT_PUBLIC_BACKEND_ORIGIN=https://<DOMAIN>"
ExecStart=/home/ryzepeck/.nvm/versions/node/v20.19.4/bin/node \
    /home/ryzepeck/webapps/<PROJECT>/frontend/node_modules/.bin/next \
    start -p <FRONTEND_PORT>
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 6e. Overrides (drop-ins de recursos)
Crear `/etc/systemd/system/<PROJECT>.service.d/override.conf`:

Perfil **light** (default):
```ini
[Service]
MemoryHigh=150M
MemoryMax=250M
CPUQuota=40%
TasksMax=50
OOMScoreAdjust=300
Restart=on-failure
RestartSec=5
```

Perfil **standard**:
```ini
[Service]
MemoryHigh=300M
MemoryMax=512M
CPUQuota=50%
TasksMax=50
OOMScoreAdjust=300
Restart=on-failure
RestartSec=5
```

Análogos para `<HUEY_SERVICE>` (CPU 20%) y `<FRONTEND_SERVICE>` (200/300M, CPU 25%).

### 6f. Activar
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now <PROJECT>.socket <PROJECT>.service <HUEY_SERVICE>.service [<FRONTEND_SERVICE>.service]
systemctl is-active <PROJECT> <HUEY_SERVICE> [<FRONTEND_SERVICE>]   # deben ser 'active'
```

---

## Paso 7: Nginx + SSL (2-phase dance)

> **Por qué 2 fases:** la config nginx final referencia `/etc/letsencrypt/live/<DOMAIN>/fullchain.pem` pero el cert todavía no existe → `nginx -t` falla. Certbot no puede actuar si nginx no puede validar su config. Romper el ciclo con una config HTTP-only temporal.

### 7a. Instalar config final en el repo (no habilitarla aún)

Crear `/home/ryzepeck/webapps/ops/vps/config/nginx/sites-available/<PROJECT>` copiando el patrón de `tuhuella_project`:
- `server_name <DOMAIN>`
- `/static/` → `backend/staticfiles/`
- `/media/` → `backend/media/`
- `/api/`, `/admin/`, `/admin-gallery/` → `proxy_pass http://unix:/run/<PROJECT>.sock`
- Si `nextjs-runtime`: `location / { proxy_pass http://127.0.0.1:<FRONTEND_PORT>; ... }`
- `client_max_body_size 15M` (o más, según `MAX_UPLOAD_*`)
- Incluir `snippets/geo-block.conf` y `limit_req`
- `listen 443 ssl` + SSL certs de `/etc/letsencrypt/live/<DOMAIN>/`

Instalar en `/etc/nginx/sites-available/<PROJECT>` pero **NO** symlinkear todavía.

### 7b. Alternativa automatizada (recomendada)

Si existe `scripts/bootstrap/emit-ssl-cert.sh <DOMAIN>`, invocarlo para obtener el cert antes de habilitar la config final. El helper hace el dance completo.

### 7c. Dance manual (si no usas el helper)

```bash
# 1. Config temporal HTTP-only
sudo tee /etc/nginx/sites-available/<PROJECT>.http-only >/dev/null <<'EOF'
server {
    listen 80;
    server_name <DOMAIN>;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 404; }
}
EOF
sudo ln -sfn /etc/nginx/sites-available/<PROJECT>.http-only /etc/nginx/sites-enabled/<PROJECT>.http-only
sudo nginx -t && sudo systemctl reload nginx

# 2. Emitir cert vía webroot
sudo mkdir -p /var/www/html/.well-known/acme-challenge
sudo chown -R www-data:www-data /var/www/html
sudo certbot certonly --webroot -w /var/www/html -d <DOMAIN> \
    --non-interactive --agree-tos --email <OPERATOR_EMAIL>

# 3. Cambiar a config final
sudo rm /etc/nginx/sites-enabled/<PROJECT>.http-only /etc/nginx/sites-available/<PROJECT>.http-only
sudo ln -sfn /etc/nginx/sites-available/<PROJECT> /etc/nginx/sites-enabled/<PROJECT>
sudo nginx -t && sudo systemctl reload nginx
```

### 7d. Smoke test
```bash
curl -sI https://<DOMAIN>/                  # → 200
curl -s  https://<DOMAIN>/api/health/       # → {"status":"ok"}
curl -sI http://<DOMAIN>/                   # → 301 → https
```

---

## Paso 8: Directorio de backups

```bash
sudo mkdir -p /var/backups/<PROJECT>
sudo chown ryzepeck:ryzepeck /var/backups/<PROJECT>
sudo chmod 755 /var/backups/<PROJECT>
```

---

## Paso 9: Logrotate para debug.log

**No olvidar** — este paso sólo lo cubre `bootstrap.sh` en una corrida completa. Para onboarding aislado, aplicarlo manualmente:

```bash
sudo sed 's/{PROJECT}/<PROJECT>/g' \
    /home/ryzepeck/webapps/ops/vps/config/logrotate/project-debug.template \
    | sudo tee /etc/logrotate.d/<PROJECT>-debug >/dev/null
```

Si existe `scripts/bootstrap/apply-logrotate.sh`, usarlo: `sudo bash scripts/bootstrap/apply-logrotate.sh --apply <PROJECT>`.

---

## Paso 10: Health endpoint

Verificar:
```bash
grep -Hrn "api/health" /home/ryzepeck/webapps/<PROJECT>/backend --include="urls.py"
```

Si falta, añadir al `urls.py` principal:
```python
from django.http import JsonResponse
def health_check(request):
    return JsonResponse({'status': 'ok'})
urlpatterns = [path('api/health/', health_check, name='health-check'), ...]
```

---

## Paso 11: Ajustes en código del proyecto

Estos cambios viven en el **repo del proyecto clonado** (`/home/ryzepeck/webapps/<PROJECT>`), NO en el repo ops. Hacer commit y push upstream:

1. **HUEY name único**: en `settings.py` (o `settings_prod.py` como override):
   ```python
   HUEY = RedisHuey(name='<PROJECT>', url=os.getenv('REDIS_URL', ...), ...)
   ```

2. **Retención backups**: `DBBACKUP_CLEANUP_KEEP = 4` (si usa django-dbbackup).

3. **Shift crontab Huey** para evitar colisiones con otros proyectos. Ejecutar:
   ```bash
   bash /home/ryzepeck/webapps/ops/vps/scripts/ci/validate-huey-schedules.sh   # (si existe)
   ```
   o manualmente:
   ```bash
   grep -h "crontab" /home/ryzepeck/webapps/*/backend/*/tasks.py
   ```
   y asignar minutos/horas únicos al nuevo proyecto en `tasks.py` (particularmente `scheduled_backup` y `cleanup_*` que son pesados).

---

## Paso 12: Registrar en `projects.yml`

Archivo: `/home/ryzepeck/webapps/ops/vps/projects.yml` (NO `/home/ryzepeck/webapps/projects.yml`, ese path está obsoleto en docs antiguos).

Añadir bajo `active:`:
```yaml
  - name: <PROJECT>
    status: active
    server: <HOSTNAME_SHORT>           # srv571894 o srv614758.hstgr.cloud
    environment: production
    label: <LABEL>
    domain: <DOMAIN>
    git_repo: <REPO_URL>
    branch: main                        # ¡confirmar con `git branch --show-current`!
    db: mysql
    db_name: <DB_NAME>
    redis_db: <REDIS_DB>
    gunicorn_service: <GUNICORN_SERVICE>
    huey_service: <HUEY_SERVICE>
    memory_max: 250M                    # según perfil: 250M light, 512M standard
    has_frontend: true                  # false si none
    python_version: "3.12"
    node_version: "20"                  # omit si no has_frontend
    requirements_path: backend/requirements.txt
    frontend_build: "npm ci && npm run build"
    collectstatic: true
    media_path: backend/media
    venv_path: backend/venv/bin/python
    socket_path: /run/<PROJECT>.sock
    log_files:
      - backend/logs/django.log
      - backend/logs/gunicorn-error.log
    notes: "<info relevante: puerto frontend, sandbox flags, suspended_reason…>"
```

Este es el **único paso** que conecta el proyecto a monitoring, backups, healthcheck y diagnóstico — todos los scripts leen `projects.yml` via `project-definitions.sh`.

Si `/etc/cron.d/srv-monitoring` tiene comentario con cantidad de proyectos, actualizarlo.

---

## Paso 13: Workflow deploy del proyecto

Crear `/home/ryzepeck/webapps/<PROJECT>/.claude/commands/deploy-and-check.md` usando como plantilla `tenndalux_project/.claude/commands/deploy-and-check.md` (adaptar branch `main` vs `master`, nombres de servicios, puerto frontend, comando de build).

---

## Paso 14: Verificación final

```bash
# 1. Servicios activos
systemctl is-active <PROJECT> <HUEY_SERVICE> [<FRONTEND_SERVICE>]

# 2. HTTPS
curl -sI https://<DOMAIN>/
curl -s  https://<DOMAIN>/api/health/

# 3. Backup manual
cd /home/ryzepeck/webapps/<PROJECT>/backend && source venv/bin/activate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py dbbackup --compress
ls /var/backups/<PROJECT>/

# 4. Post-deploy check (solo el proyecto, sin ruido global)
bash /home/ryzepeck/webapps/ops/vps/scripts/deployment/post-deploy-check.sh --project-only <PROJECT>

# 5. Sin drift / missing
bash /home/ryzepeck/webapps/ops/vps/scripts/bootstrap/verify-state.sh | tail -3
#    Debe mostrar: DRIFT=0 | MISSING=0

# 6. projects.yml OK
bash /home/ryzepeck/webapps/ops/vps/scripts/ci/validate-projects-yml.sh

# 7. Sin colisiones de Huey (si existe el script)
bash /home/ryzepeck/webapps/ops/vps/scripts/ci/validate-huey-schedules.sh
```

Reportar:
- Estado servicios + `systemctl is-active`
- `{"status":"ok"}` en `/api/health/`
- Tamaño del backup generado
- `PASS=N FAIL=0 WARN=?` en post-deploy-check
- Credenciales sensibles (SECRET_KEY, DB_PASSWORD) → al operador por canal seguro
- Wompi / integraciones en sandbox → seguimiento en `projects.yml` notes

---

## Bugs comunes del template `base_feature_project`

Estos bugs rompen `npm run build` de producción y se detectan en **Paso 3**. Si aparecen, arreglarlos en el repo del proyecto y commitear:

1. **`lib/types.ts`: falta `export type Blog`**. Shape mínima:
   ```ts
   export type Blog = { id: number; title: string; category?: string; description?: string; image_url?: string }
   ```
2. **`lib/types.ts`: falta `export type Product`**. Suele ser alias de `Peluch`:
   ```ts
   export type Product = Peluch
   ```
3. **`app/page.tsx` y `app/products/[productId]/page.tsx`**: `addToCart(item, qty)` con 2 args. La firma del store es `(item: CartItem) => void`. Fix: `addToCart({...item, quantity: qty})` o actualizar la firma del store.
4. **`HUEY name` hardcoded** a `base_feature_project`. Cambiar a `<PROJECT>` o hacerlo env-driven.
5. **`DJANGO_DB_NAME` vs `DB_NAME`**: template inconsistente. En prod siempre `DB_NAME=...`.

## Convenciones de nombres (referencia)

| Elemento | Formato | Ejemplo |
|---|---|---|
| Directorio | snake_case | `mimittos_project` |
| Gunicorn service | igual al directorio | `mimittos_project.service` |
| Huey service | slug (sin `_project`) + `-huey` | `mimittos-huey.service` |
| Frontend service | slug + `-frontend` | `mimittos-frontend.service` |
| MySQL DB / user | `<dir>_db` / `<dir>_user` | `mimittos_project_db` / `mimittos_project_user` |
| Backup dir | `/var/backups/<dir>` | `/var/backups/mimittos_project` |
| Socket | `/run/<dir>.sock` | `/run/mimittos_project.sock` |
| Logrotate | `/etc/logrotate.d/<dir>-debug` | `/etc/logrotate.d/mimittos_project-debug` |
