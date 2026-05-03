---
description: Checklist para integrar un nuevo proyecto Django al ecosistema del servidor vps-projectapp
---

# Integrar Nuevo Proyecto al Ecosistema

Guía paso a paso para desplegar e integrar un nuevo proyecto Django en el servidor de producción. Usar como referencia la configuración de azurita (perfil ligero) o kore_project (perfil estándar).

---

## Prerequisitos

Antes de empezar, necesitas:
- **Dominio** configurado con DNS apuntando al servidor (A record → IP del VPS)
- **Rama principal** del repo (main o master)
- **Redis DB number** libre (ver `redis-cli INFO keyspace` para DBs en uso)

> **Regla de base de datos:** Todo proyecto de produccion debe usar MySQL. Solo los entornos de staging (identificados por "staging" en el nombre o dominio) pueden usar SQLite. Si el usuario solicita SQLite para un proyecto de produccion, advertir y recomendar MySQL.

---

## Paso 1: Base de datos MySQL

```bash
# Generar password seguro
python3 -c "import secrets,string; c=string.ascii_letters+string.digits+'!@#%^&*'; print(''.join(secrets.choice(string.ascii_uppercase)+secrets.choice(string.ascii_lowercase)+secrets.choice(string.digits)+secrets.choice('!@#%^&*')+''.join(secrets.choice(c) for _ in range(20))))"

# Crear DB y usuario (usar debian-sys-maint desde /etc/mysql/debian.cnf)
mysql -u debian-sys-maint -p'<PASSWORD>' -e "
  CREATE DATABASE IF NOT EXISTS <PROJECT>_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS '<PROJECT>_user'@'localhost' IDENTIFIED BY '<GENERATED_PASSWORD>';
  GRANT ALL PRIVILEGES ON <PROJECT>_db.* TO '<PROJECT>_user'@'localhost';
  FLUSH PRIVILEGES;"
```

## Paso 2: Virtualenv + dependencias

```bash
python3 -m venv /home/ryzepeck/webapps/<PROJECT>/backend/venv
source /home/ryzepeck/webapps/<PROJECT>/backend/venv/bin/activate
pip install -r /home/ryzepeck/webapps/<PROJECT>/backend/requirements.txt gunicorn mysqlclient
```

## Paso 3: Archivo .env (producción)

```bash
cp /home/ryzepeck/webapps/<PROJECT>/backend/.env.example /home/ryzepeck/webapps/<PROJECT>/backend/.env
chmod 600 /home/ryzepeck/webapps/<PROJECT>/backend/.env
# Editar con valores reales:
# - DJANGO_ENV=production, DJANGO_DEBUG=false
# - DJANGO_SECRET_KEY (generar nuevo)
# - DJANGO_ALLOWED_HOSTS=<DOMAIN>
# - DB credentials
# - REDIS_URL=redis://localhost:6379/<N>
# - BACKUP_STORAGE_PATH=/var/backups/<PROJECT>
# - ENABLE_SILK=true
```

## Paso 4: Migraciones + collectstatic

```bash
cd /home/ryzepeck/webapps/<PROJECT>/backend
source venv/bin/activate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py migrate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py collectstatic --noinput
```

## Paso 5: Systemd services

Crear 3 archivos (usar `sudo tee`):

**Gunicorn** (`/etc/systemd/system/<PROJECT>.service`):
- Type=notify, User=ryzepeck, Group=www-data
- Workers: 2, max-requests: 800, jitter: 80, timeout: 120
- Bind: unix socket en directorio del proyecto
- DJANGO_SETTINGS_MODULE apuntando a settings_prod

**Huey** (`/etc/systemd/system/<PROJECT_SLUG>-huey.service`):
- Type=simple, workers: 1
- NOTA: nombre del servicio usa guiones, no guiones bajos

**Override** (`/etc/systemd/system/<PROJECT>.service.d/override.conf`):
- Perfil ligero: MemoryHigh=150M, MemoryMax=250M, CPUQuota=40%
- Perfil estándar: MemoryHigh=300M, MemoryMax=512M, CPUQuota=50%
- Siempre: TasksMax=50, OOMScoreAdjust=300, Restart=on-failure

```bash
sudo systemctl daemon-reload
sudo systemctl enable <PROJECT> <PROJECT_SLUG>-huey
sudo systemctl start <PROJECT> <PROJECT_SLUG>-huey
```

## Paso 6: Nginx + SSL

```bash
# Crear site config en /etc/nginx/sites-available/<PROJECT>
# Incluir: geo-block, rate-limit, proxy a socket, /static/, /media/
# Si tiene frontend SPA: root + try_files para /
sudo ln -sf /etc/nginx/sites-available/<PROJECT> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d <DOMAIN> --non-interactive --agree-tos --redirect
```

## Paso 7: Backup directory

```bash
sudo mkdir -p /var/backups/<PROJECT>
sudo chown ryzepeck:ryzepeck /var/backups/<PROJECT>
```

## Paso 8: Health endpoint

Verificar que `/api/health/` existe en urls.py. Si no, agregar:

```python
from django.http import JsonResponse
def health_check(request):
    return JsonResponse({'status': 'ok'})
urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    # ...
]
```

## Paso 9: Ajustes en código

- **settings.py**: HUEY name debe ser único (nombre del proyecto)
- **settings.py**: DBBACKUP_CLEANUP_KEEP = 4
- **tasks.py**: Asignar horarios únicos que no colisionen con otros proyectos
  - Verificar slots existentes: `grep -h "crontab" /home/ryzepeck/webapps/*/backend/*/tasks.py`

## Paso 10: Integrar en scripts de métricas

Agregar el proyecto a estos archivos (arrays de proyectos):

| Script | Ubicación |
|--------|-----------|
| `server-weekly-report.sh` | `/home/ryzepeck/webapps/ops/vps/scripts/diagnostics/` |
| `server-diagnostic-report.sh` | `/home/ryzepeck/webapps/ops/vps/scripts/diagnostics/` |
| `server-traffic-report.sh` | `/home/ryzepeck/webapps/ops/vps/scripts/diagnostics/` |
| `server-alerts.sh` | `/home/ryzepeck/webapps/ops/vps/scripts/monitoring/` |
| `vps-healthcheck.sh` | `/home/ryzepeck/webapps/ops/vps/scripts/monitoring/` |
| `post-deploy-check.sh` | `/home/ryzepeck/webapps/ops/vps/scripts/deployment/` |
| `post-boot-check.sh` | `/home/ryzepeck/webapps/ops/vps/scripts/deployment/` |
| `deploy-and-check.md` | `~/webapps/.windsurf/workflows/` |

También actualizar:
- `/etc/cron.d/srv-monitoring` (comentario de cantidad de proyectos)
- `/home/ryzepeck/webapps/projects.yml` (lista de proyectos)

## Paso 11: Workflow deploy-and-check del proyecto

Crear/actualizar `.windsurf/workflows/deploy-and-check.md` dentro del repo del proyecto.

## Paso 12: Verificación final

```bash
# Servicios activos
systemctl is-active <PROJECT>
systemctl is-active <PROJECT_SLUG>-huey

# Health check HTTPS
curl -s https://<DOMAIN>/api/health/

# Backup manual
cd /home/ryzepeck/webapps/<PROJECT>/backend
source venv/bin/activate
DJANGO_SETTINGS_MODULE=<DJANGO_PROJECT>.settings_prod python manage.py dbbackup --compress

# Post-deploy check
bash /home/ryzepeck/webapps/ops/vps/scripts/deployment/post-deploy-check.sh <PROJECT>
```

---

## Convenciones de nombres

| Elemento | Formato | Ejemplo |
|----------|---------|---------|
| Directorio | snake_case | `fernando_aragon_project` |
| Gunicorn service | igual que directorio | `fernando_aragon_project.service` |
| Huey service | guiones, sin `_project` | `fernando-aragon-huey.service` |
| MySQL DB | `<proyecto>_db` | `fernando_aragon_db` |
| MySQL user | `<proyecto>_user` | `fernando_aragon_user` |
| Backup dir | `/var/backups/<directorio>` | `/var/backups/fernando_aragon_project` |
| Socket | en directorio del proyecto | `fernando_aragon_project.sock` |
