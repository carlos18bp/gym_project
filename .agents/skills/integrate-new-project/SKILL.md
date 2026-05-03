---
name: integrate-new-project
description: "Integrar un nuevo proyecto Django al ecosistema del servidor vps-projectapp (12 pasos: DB, venv, .env, migrations, systemd, nginx, backups, health, scripts de métricas)"
argument-hint: "[project_name domain light|standard]"
allowed-tools: Bash, Read, Edit
---

Argumentos recibidos: **$ARGUMENTS**

Si `$ARGUMENTS` está vacío o incompleto, pedir al usuario antes de continuar:
- **project** — nombre del directorio del proyecto (snake_case, ej. `mi_proyecto`)
- **domain** — dominio completo (ej. `miproyecto.projectapp.co`)
- **profile** — perfil de recursos: `light` (150M/250M/40%) o `standard` (300M/512M/50%)

Ejecutar cada paso en orden. No omitir ninguno.

> **Regla de base de datos:** Todo proyecto de produccion debe usar MySQL. Solo los entornos de staging (identificados por "staging" en el nombre o dominio) pueden usar SQLite. Si el usuario solicita SQLite para un proyecto de produccion, advertir y recomendar MySQL.

---

## Derivaciones automáticas (calcular antes de empezar)

A partir del nombre del proyecto, derivar:

| Variable | Regla | Ejemplo |
|----------|-------|---------|
| `PROJECT` | Tal cual | `fernando_aragon_project` |
| `PROJECT_SLUG` | kebab-case, sin `_project` | `fernando-aragon` |
| `DJANGO_PROJECT` | Detectar en `manage.py` o `wsgi.py` del repo | `base_feature_project` |
| `DB_NAME` | `<PROJECT>_db` | `fernando_aragon_project_db` |
| `DB_USER` | `<PROJECT>_user` | `fernando_aragon_project_user` |
| `SOCKET` | `/home/ryzepeck/webapps/<PROJECT>/<PROJECT>.sock` | — |
| `BACKUP_DIR` | `/var/backups/<PROJECT>` | — |
| `GUNICORN_SERVICE` | igual que `PROJECT` | `fernando_aragon_project` |
| `HUEY_SERVICE` | `<PROJECT_SLUG>-huey` | `fernando-aragon-huey` |

Para `DJANGO_PROJECT`: leer el archivo `manage.py` del proyecto y extraer el valor de `DJANGO_SETTINGS_MODULE`.

Para `PROFILE`:
- `light` → MemoryHigh=150M, MemoryMax=250M, CPUQuota=40%
- `standard` → MemoryHigh=300M, MemoryMax=512M, CPUQuota=50%

---

## Paso 1: Base de datos MySQL

```bash
# Generar password seguro
python3 -c "import secrets,string; c=string.ascii_letters+string.digits+'!@#%^&*'; print(''.join(secrets.choice(string.ascii_uppercase)+secrets.choice(string.ascii_lowercase)+secrets.choice(string.digits)+secrets.choice('!@#%^&*')+''.join(secrets.choice(c) for _ in range(20))))"
```

Guardar el password generado. Luego crear DB y usuario (leer password de debian-sys-maint desde `/etc/mysql/debian.cnf`):

```bash
mysql -u debian-sys-maint -p'<DEBIAN_PASS>' -e "
  CREATE DATABASE IF NOT EXISTS <DB_NAME> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS '<DB_USER>'@'localhost' IDENTIFIED BY '<GENERATED_PASSWORD>';
  GRANT ALL PRIVILEGES ON <DB_NAME>.* TO '<DB_USER>'@'localhost';
  FLUSH PRIVILEGES;"
```

Verificar Redis DB disponible:

```bash
redis-cli INFO keyspace
```

Anotar el número de DB libre para el `.env`.

---

## Paso 2: Virtualenv + dependencias

```bash
python3 -m venv /home/ryzepeck/webapps/<PROJECT>/backend/venv
source /home/ryzepeck/webapps/<PROJECT>/backend/venv/bin/activate
pip install -r /home/ryzepeck/webapps/<PROJECT>/backend/requirements.txt gunicorn mysqlclient
```

---

## Paso 3: Archivo .env (producción)

```bash
cp /home/ryzepeck/webapps/<PROJECT>/backend/.env.example /home/ryzepeck/webapps/<PROJECT>/backend/.env
chmod 600 /home/ryzepeck/webapps/<PROJECT>/backend/.env
```

Editar `.env` con valores reales. Variables obligatorias:
- `DJANGO_ENV=production`
- `DJANGO_DEBUG=false`
- `DJANGO_SECRET_KEY` — generar con `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`
- `DJANGO_ALLOWED_HOSTS=<DOMAIN>`
- DB credentials (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST=localhost`)
- `REDIS_URL=redis://localhost:6379/<N>` (N = DB libre del paso 1)
- `BACKUP_STORAGE_PATH=/var/backups/<PROJECT>`
- `ENABLE_SILK=true`

---

## Paso 4: Migraciones + collectstatic

```bash
cd /home/ryzepeck/webapps/<PROJECT>/backend
source venv/bin/activate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py migrate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py collectstatic --noinput
```

---

## Paso 5: Systemd services

Crear los tres archivos con `sudo tee`:

**Gunicorn** (`/etc/systemd/system/<PROJECT>.service`):

```bash
sudo tee /etc/systemd/system/<PROJECT>.service > /dev/null << 'EOF'
[Unit]
Description=Gunicorn daemon for <PROJECT>
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
    --timeout 120 \
    --bind unix:<SOCKET> \
    <DJANGO_PROJECT>.wsgi:application
ExecReload=/bin/kill -s HUP $MAINPID
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
```

**Huey** (`/etc/systemd/system/<HUEY_SERVICE>.service`):

```bash
sudo tee /etc/systemd/system/<HUEY_SERVICE>.service > /dev/null << 'EOF'
[Unit]
Description=Huey worker for <PROJECT>
After=network.target

[Service]
Type=simple
User=ryzepeck
WorkingDirectory=/home/ryzepeck/webapps/<PROJECT>/backend
Environment="DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod"
ExecStart=/home/ryzepeck/webapps/<PROJECT>/backend/venv/bin/python manage.py run_huey --workers 1
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
```

**Override** de recursos (`/etc/systemd/system/<PROJECT>.service.d/override.conf`):

```bash
sudo mkdir -p /etc/systemd/system/<PROJECT>.service.d
sudo tee /etc/systemd/system/<PROJECT>.service.d/override.conf > /dev/null << 'EOF'
[Service]
MemoryHigh=<MEMORY_HIGH>
MemoryMax=<MEMORY_MAX>
CPUQuota=<CPU_QUOTA>
TasksMax=50
OOMScoreAdjust=300
Restart=on-failure
EOF
```

Activar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable <PROJECT> <HUEY_SERVICE>
sudo systemctl start <PROJECT> <HUEY_SERVICE>
```

---

## Paso 6: Nginx + SSL

Crear `/etc/nginx/sites-available/<PROJECT>` con:
- `geo $blocked_country` para bloqueo geográfico
- `limit_req_zone` para rate limiting
- `proxy_pass` al socket `<SOCKET>`
- location `/static/` → `backend/staticfiles/`
- location `/media/` → `backend/media/`
- Si tiene frontend SPA: `root` + `try_files` para `/`

```bash
sudo ln -sf /etc/nginx/sites-available/<PROJECT> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d <DOMAIN> --non-interactive --agree-tos --redirect
```

---

## Paso 7: Directorio de backups

```bash
sudo mkdir -p /var/backups/<PROJECT>
sudo chown ryzepeck:ryzepeck /var/backups/<PROJECT>
```

---

## Paso 8: Health endpoint

Verificar que existe `/api/health/` en `urls.py`:

```bash
grep -r "health" /home/ryzepeck/webapps/<PROJECT>/backend --include="urls.py" -l
```

Si no existe, agregar al `urls.py` principal:

```python
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    # ... resto de urls
]
```

---

## Paso 9: Ajustes en código

Verificar y ajustar en `settings.py` (o `settings_prod.py`):

```python
# HUEY name debe ser único por proyecto
HUEY = {
    'name': '<PROJECT>',  # único en el servidor
    ...
}

# Retención de backups
DBBACKUP_CLEANUP_KEEP = 4
```

Verificar horarios de Huey que no colisionen con otros proyectos:

```bash
grep -h "crontab" /home/ryzepeck/webapps/*/backend/*/tasks.py 2>/dev/null
```

Asignar horarios únicos en `tasks.py` del nuevo proyecto.

---

## Paso 10: Registrar en projects.yml

Agregar el nuevo proyecto a `/home/ryzepeck/webapps/projects.yml` bajo la sección `active:`. Incluir todos los campos requeridos: `name`, `label`, `domain`, `branch`, `db`, `db_name`, `redis_db`, `gunicorn_service`, `huey_service`, `memory_max`, `has_frontend`, `frontend_build`, `media_path`, `venv_path`, `socket_path`, y `notes`.

**Este es el único paso necesario para integrar el proyecto en los scripts de métricas.** Todos los scripts de monitoreo, diagnóstico, backup y mantenimiento leen automáticamente de `projects.yml` via la librería compartida `project-definitions.sh`.

También actualizar:
- `/etc/cron.d/srv-monitoring` — actualizar comentario con nueva cantidad de proyectos

---

## Paso 11: Workflow deploy del proyecto

Crear `.claude/commands/deploy-and-check.md` dentro del directorio del proyecto (si aplica), siguiendo el patrón de `tenndalux_project/.claude/commands/deploy-and-check.md`.

---

## Paso 12: Verificación final

```bash
# Servicios activos
systemctl is-active <PROJECT>
systemctl is-active <HUEY_SERVICE>

# Health check HTTPS
curl -s https://<DOMAIN>/api/health/

# Backup manual de prueba
cd /home/ryzepeck/webapps/<PROJECT>/backend
source venv/bin/activate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py dbbackup --compress

# Post-deploy check
bash /home/ryzepeck/webapps/ops/vps/scripts/deployment/post-deploy-check.sh <PROJECT>
```

Reportar resultado final:
- Estado de servicios (Gunicorn + Huey)
- Respuesta de `/api/health/`
- Resultado del backup de prueba
- Cualquier error encontrado durante el proceso

---

## Convenciones de nombres (referencia)

| Elemento | Formato | Ejemplo |
|----------|---------|---------|
| Directorio | snake_case | `fernando_aragon_project` |
| Gunicorn service | igual que directorio | `fernando_aragon_project.service` |
| Huey service | kebab-case, sin `_project` + `-huey` | `fernando-aragon-huey.service` |
| MySQL DB | `<directorio>_db` | `fernando_aragon_project_db` |
| MySQL user | `<directorio>_user` | `fernando_aragon_project_user` |
| Backup dir | `/var/backups/<directorio>` | `/var/backups/fernando_aragon_project` |
| Socket | en directorio del proyecto | `fernando_aragon_project.sock` |
