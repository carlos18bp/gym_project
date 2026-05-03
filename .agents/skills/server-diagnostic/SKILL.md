---
name: server-diagnostic
description: "Diagnóstico integral del servidor de producción basado en las 15 buenas prácticas para servidores saludables"
allowed-tools: Bash
---
# DIAGNÓSTICO INTEGRAL DE SERVIDOR DE PRODUCCIÓN
## Basado en las 15 Buenas Prácticas para Servidores Saludables
---

## CONTEXTO DE MI INFRAESTRUCTURA

### Stack Tecnológico
- **Sistema Operativo**: Ubuntu (VPS en Hostinger)
- **Backend**: Django + Gunicorn
- **Frontend**: Vue.js / React (embebido o separado)
- **Base de Datos**: MySQL 8.x
- **Web Server**: Nginx (reverse proxy)
- **Cache/Queue**: Redis (también broker para Huey task queue)
- **Task Queue**: Huey (tareas periódicas: backups, Silk GC, reportes)
- **Backups**: django-dbbackup (DB + media, semanal, comprimido)
- **Profiling**: Silk (query profiling, N+1 detection, condicional via ENABLE_SILK)
- **Config**: python-decouple (settings split: base + dev + prod)
- **SSL**: Let's Encrypt (Certbot)
- **Firewall**: UFW
- **Protección**: Fail2ban + Geo-blocking + Rate limiting nginx
- **Monitoreo**: Scripts bash (alertas cada 5min, reportes semanales, diagnóstico, tráfico)
- **Email**: msmtp (envío de alertas y reportes a team@projectapp.co)

### Ubicación de Proyectos
- **Proyectos Django**: `/home/ryzepeck/webapps/`
- **Archivos estáticos**: `/var/www/` (algunos)
- **Configuración Nginx**: `/etc/nginx/sites-available/` y `/etc/nginx/sites-enabled/`
- **Servicios Systemd**: `/etc/systemd/system/`
- **Certificados SSL**: `/etc/letsencrypt/`
- **Scripts de monitoreo**: `/home/ryzepeck/webapps/ops/vps/scripts/`
- **Reportes generados**: `/home/ryzepeck/webapps/ops/vps/reports/`
- **Backups django-dbbackup**: `/var/backups/<proyecto>/`
- **Cron de monitoreo**: `/etc/cron.d/srv-monitoring`
- **Config msmtp**: `/home/ryzepeck/.config/msmtp/config`

### Registro de Proyectos (fuente de verdad)

El archivo `~/webapps/projects.yml` es la fuente de verdad para determinar qué proyectos están activos, inactivos o dados de baja. **Siempre leer este archivo al inicio del diagnóstico.**

```bash
echo "=== REGISTRO DE PROYECTOS ==="
cat ~/webapps/projects.yml
```

- Los proyectos bajo `active:` se evalúan en **todas** las fases del diagnóstico.
- Los proyectos bajo `inactive:` solo se verifican para limpieza (archivos huérfanos, servicios residuales).

> **candle_project** y **kore_project** son los proyectos más actualizados y deben usarse como referencia/template para evaluar los demás.

### Detección de Proyectos Nuevos

Después de leer `projects.yml`, verificar si hay directorios en `/home/ryzepeck/webapps/` que no estén listados ni en `active:` ni en `inactive:`:

```bash
echo "=== DETECCIÓN DE PROYECTOS NUEVOS ==="
KNOWN=$(grep '^\s*- name:' ~/webapps/projects.yml | awk '{print $3}')
KNOWN="$KNOWN ops"
for dir in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$dir")
    if ! echo "$KNOWN" | grep -qw "$nombre"; then
        echo "⚠️ PROYECTO NUEVO DETECTADO: $nombre (no está en projects.yml)"
    fi
done
```
Si se detecta un proyecto nuevo, incluirlo en el diagnóstico y sugerir agregarlo a `projects.yml`.

---

## PERMISOS DE EJECUCIÓN

You have permission to run any terminal commands you need without asking me for confirmation. Do not ask "May I run this?"—just proceed.

**EXCEPCIONES (Pedir aprobación explícita antes de ejecutar):**
- `git commit` o `git push` (cualquier variante)
- Comandos que eliminen datos (`rm -rf`, `DROP DATABASE`, `truncate`, etc.)
- Comandos que reinicien servicios (`systemctl restart`, `reboot`)
- Modificaciones a archivos de configuración en producción
- Cualquier acción destructiva o irreversible

Treat this as a standing rule throughout the entire session.

---

## OBJETIVO DEL DIAGNÓSTICO

Realizar un análisis exhaustivo del servidor evaluando las **15 Buenas Prácticas para Servidores Saludables**:

1. Gestión de Logs
2. Gestión de RAM y Workers
3. Gestión de Disco
4. Actualizaciones Automáticas
5. Límites por Proyecto
6. Monitoreo y Alertas
7. Backups
8. Cron Jobs y Huey Tasks
9. Scripts de Salud
10. Max-Requests (Anti Memory Leak)
11. Silk — Profiling y Detección de Queries Lentas
12. Checklist Periódico
13. Seguridad
14. Reportes Periódicos y Notificaciones por Email
15. Estandarización de Proyecto (Settings Split + Decouple)

---

## FASE 0: INFORMACIÓN BASE DEL SISTEMA

Antes de evaluar las buenas prácticas, recopilar información básica:

### 0.1 Sistema Operativo
```bash
uname -a
lsb_release -a
hostnamectl
```

### 0.2 Recursos Generales
```bash
# CPU
nproc
lscpu | grep -E "Model name|CPU\(s\)|Thread"

# RAM y Swap
free -h
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree"

# Disco
df -h
df -i  # Inodos
```

### 0.3 Uptime y Carga
```bash
uptime
w
cat /proc/loadavg
```

### 0.4 Servicios Críticos (Estado Rápido)
```bash
systemctl is-active nginx mysql redis-server cron ssh fail2ban ufw 2>/dev/null | paste - - - - - - -
systemctl --failed
```

---

## FASE 1: GESTIÓN DE LOGS ✓

**Objetivo**: Verificar que los logs no crezcan infinitamente y tengan rotación automática.

### 1.1 Configuración de Logrotate
```bash
# ¿Existe configuración de logrotate para proyectos?
ls -la /etc/logrotate.d/
cat /etc/logrotate.d/nginx 2>/dev/null
cat /etc/logrotate.d/mysql* 2>/dev/null

# ¿Hay configuración custom para los proyectos Django?
cat /etc/logrotate.d/*proyecto* 2>/dev/null
cat /etc/logrotate.d/*gunicorn* 2>/dev/null
cat /etc/logrotate.d/*django* 2>/dev/null
```

### 1.2 Configuración de Journald
```bash
# Límites de journald
cat /etc/systemd/journald.conf | grep -v "^#" | grep -v "^$"
ls -la /etc/systemd/journald.conf.d/ 2>/dev/null
cat /etc/systemd/journald.conf.d/*.conf 2>/dev/null

# Tamaño actual del journal
journalctl --disk-usage
```

### 1.3 Tamaño de Logs del Sistema
```bash
# Logs del sistema
du -sh /var/log/
du -sh /var/log/* 2>/dev/null | sort -rh | head -15

# Archivos de log mayores a 50MB
find /var/log -type f -size +50M -exec ls -lh {} \; 2>/dev/null
```

### 1.4 Logs de Proyectos Django
```bash
# Buscar directorios de logs en los proyectos
find /home/ryzepeck/webapps -type d -name "logs" 2>/dev/null

# Tamaño de logs por proyecto
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    if [ -d "$proyecto/backend/logs" ]; then
        tamaño=$(du -sh "$proyecto/backend/logs" 2>/dev/null | cut -f1)
        echo "$nombre: $tamaño"
    elif [ -d "$proyecto/logs" ]; then
        tamaño=$(du -sh "$proyecto/logs" 2>/dev/null | cut -f1)
        echo "$nombre: $tamaño"
    else
        echo "$nombre: Sin directorio de logs"
    fi
done

# Logs de Gunicorn en journald por proyecto
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    servicio=$(echo "$nombre" | sed 's/_project//' | sed 's/_/-/g')
    echo "=== Logs de $nombre (últimas líneas de errores) ==="
    journalctl -u "gunicorn-$servicio" -u "$servicio" -u "${nombre}" --no-pager -n 5 --priority=err 2>/dev/null || echo "No encontrado"
done
```

### 1.5 Logging con RotatingFileHandler en Proyectos Django
```bash
echo "=== ROTATINGFILEHANDLER Y BACKUPS.LOG POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # Buscar RotatingFileHandler en settings
    rfh=$(grep -r "RotatingFileHandler" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$rfh" ]; then
        echo "  ✅ RotatingFileHandler configurado"
    else
        echo "  ❌ RotatingFileHandler NO configurado"
    fi
    
    # Verificar handler 'backup_file' en LOGGING
    bf=$(grep -r "backup_file" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$bf" ]; then
        echo "  ✅ Handler backup_file presente"
    else
        echo "  ❌ Handler backup_file NO presente"
    fi
    
    # Verificar que backups.log existe
    if [ -f "$proyecto/backend/logs/backups.log" ]; then
        tamaño=$(du -sh "$proyecto/backend/logs/backups.log" 2>/dev/null | cut -f1)
        echo "  ✅ backups.log existe ($tamaño)"
    else
        echo "  ⚠️ backups.log no encontrado"
    fi
done
```

### 1.6 Evaluación de Buena Práctica #1
Generar tabla:

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| Logrotate configurado para proyectos | ✅/❌ | Configurar si falta |
| Journald con límites | ✅/❌ | Limitar a 500MB |
| Logs >100MB sin rotar | ✅/❌ | Rotar o limpiar |
| Logs de Django con rotación | ✅/❌ | Usar RotatingFileHandler |

---

## FASE 2: GESTIÓN DE RAM Y WORKERS ✓

**Objetivo**: Verificar que los workers de Gunicorn estén dimensionados correctamente para la RAM disponible.

### 2.1 Memoria del Sistema
```bash
free -h
vmstat 1 5
cat /proc/pressure/memory 2>/dev/null
```

### 2.2 Procesos por Consumo de Memoria
```bash
ps aux --sort=-%mem | head -20
```

### 2.3 Workers de Gunicorn por Proyecto
```bash
echo "=== WORKERS GUNICORN POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    echo ""
    echo "--- $nombre ---"
    
    # Buscar procesos gunicorn de este proyecto
    pgrep -fa "gunicorn.*$nombre" 2>/dev/null || pgrep -fa "gunicorn.*$(echo $nombre | sed 's/_project//')" 2>/dev/null || echo "No hay procesos corriendo"
    
    # Contar workers
    workers=$(pgrep -fc "gunicorn.*$nombre.*worker" 2>/dev/null || pgrep -fc "gunicorn.*$(echo $nombre | sed 's/_project//').*worker" 2>/dev/null || echo "0")
    echo "Workers activos: $workers"
    
    # Memoria por worker
    pgrep -f "gunicorn.*$nombre" 2>/dev/null | while read pid; do
        mem=$(ps -o rss= -p $pid 2>/dev/null | awk '{print $1/1024 "MB"}')
        tiempo=$(ps -o etime= -p $pid 2>/dev/null | xargs)
        echo "  PID $pid: $mem (uptime: $tiempo)"
    done
done
```

### 2.4 Configuración de Workers en Systemd
```bash
echo "=== CONFIGURACIÓN SYSTEMD DE GUNICORN ==="
for unit in /etc/systemd/system/gunicorn*.service /etc/systemd/system/*_project*.service /etc/systemd/system/*-project*.service; do
    if [ -f "$unit" ]; then
        echo ""
        echo "--- $(basename $unit) ---"
        grep -E "ExecStart|MemoryMax|MemoryHigh|CPUQuota|workers|max-requests" "$unit" 2>/dev/null
    fi
done 2>/dev/null
```

### 2.5 Swap
```bash
swapon --show
cat /proc/swaps
free -h | grep Swap

# ¿Cuánto swap se está usando activamente?
vmstat 1 3 | tail -1 | awk '{print "Swap in: "$7" | Swap out: "$8}'
```

### 2.6 Configuración OOM Killer
```bash
# Verificar protección OOM para servicios críticos
for servicio in mysql nginx redis-server; do
    oom=$(systemctl show $servicio 2>/dev/null | grep OOMScoreAdjust)
    echo "$servicio: $oom"
done
```

### 2.7 Cálculo de Workers Recomendados
```bash
# Fórmula: Workers = min((2 × CPU) + 1, RAM_disponible / RAM_por_worker)
cores=$(nproc)
ram_mb=$(free -m | awk '/Mem:/ {print $7}')  # Memoria disponible
ram_por_worker=200  # MB estimados por worker

workers_por_cpu=$((2 * cores + 1))
workers_por_ram=$((ram_mb / ram_por_worker))

echo "CPU cores: $cores"
echo "RAM disponible: ${ram_mb}MB"
echo "Workers recomendados por CPU: $workers_por_cpu"
echo "Workers máximos por RAM: $workers_por_ram"
echo "RECOMENDACIÓN: Usar el menor de ambos valores"
```

### 2.8 Evaluación de Buena Práctica #2
Generar tabla:

| Proyecto | Workers Config | Workers Runtime | RAM/Worker | Estado | Recomendación |
|----------|----------------|-----------------|------------|--------|---------------|
| proyecto1 | X | Y | ZMB | ✅/❌ | Ajustar a N |

---

## FASE 3: GESTIÓN DE DISCO ✓

**Objetivo**: Verificar espacio disponible e identificar qué consume más espacio.

### 3.1 Espacio en Disco
```bash
df -h
df -i  # Inodos
```

### 3.2 Top Directorios por Tamaño
```bash
# Directorios más pesados en /
du -h --max-depth=1 / 2>/dev/null | sort -rh | head -15

# Directorios más pesados en /home
du -h --max-depth=2 /home 2>/dev/null | sort -rh | head -15

# Directorios más pesados en webapps
du -h --max-depth=1 /home/ryzepeck/webapps 2>/dev/null | sort -rh | head -15
```

### 3.3 Tamaño Detallado por Proyecto
```bash
echo "=== TAMAÑO DETALLADO POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    echo ""
    echo "--- $nombre ---"
    
    # Total
    total=$(du -sh "$proyecto" 2>/dev/null | cut -f1)
    echo "Total: $total"
    
    # Backend
    [ -d "$proyecto/backend" ] && echo "  backend/: $(du -sh "$proyecto/backend" 2>/dev/null | cut -f1)"
    
    # Media/Uploads
    for media_dir in "media" "uploads" "backend/media" "backend/uploads"; do
        [ -d "$proyecto/$media_dir" ] && echo "  $media_dir/: $(du -sh "$proyecto/$media_dir" 2>/dev/null | cut -f1)"
    done
    
    # Static
    for static_dir in "static" "staticfiles" "backend/static" "backend/staticfiles"; do
        [ -d "$proyecto/$static_dir" ] && echo "  $static_dir/: $(du -sh "$proyecto/$static_dir" 2>/dev/null | cut -f1)"
    done
    
    # Logs
    for log_dir in "logs" "backend/logs"; do
        [ -d "$proyecto/$log_dir" ] && echo "  $log_dir/: $(du -sh "$proyecto/$log_dir" 2>/dev/null | cut -f1)"
    done
    
    # Venv
    for venv_dir in "venv" "backend/venv" ".venv" "backend/.venv" "env"; do
        [ -d "$proyecto/$venv_dir" ] && echo "  $venv_dir/: $(du -sh "$proyecto/$venv_dir" 2>/dev/null | cut -f1)"
    done
    
    # Node modules (si existe frontend)
    for node_dir in "node_modules" "frontend/node_modules"; do
        [ -d "$proyecto/$node_dir" ] && echo "  ⚠️ $node_dir/: $(du -sh "$proyecto/$node_dir" 2>/dev/null | cut -f1) (NO debería estar en producción)"
    done
done
```

### 3.4 Archivos Más Grandes
```bash
echo "=== ARCHIVOS > 100MB ==="
find /home/ryzepeck/webapps -type f -size +100M 2>/dev/null -exec ls -lh {} \; | sort -k5 -rh | head -20

echo ""
echo "=== ARCHIVOS > 50MB EN /var ==="
find /var -type f -size +50M 2>/dev/null -exec ls -lh {} \; | sort -k5 -rh | head -10
```

### 3.5 Archivos Candidatos a Limpieza
```bash
echo "=== CANDIDATOS A LIMPIEZA ==="

# Cache de pip
echo "Cache de pip: $(du -sh ~/.cache/pip 2>/dev/null | cut -f1 || echo 'No existe')"

# Cache de apt
echo "Cache de apt: $(du -sh /var/cache/apt 2>/dev/null | cut -f1)"

# Logs comprimidos viejos
echo "Logs .gz en /var/log mayores a 30 días:"
find /var/log -name "*.gz" -mtime +30 -exec ls -lh {} \; 2>/dev/null | wc -l
echo " archivos encontrados"

# Thumbnails y cache de usuario
du -sh ~/.cache 2>/dev/null

# Backups locales antiguos
find /home -name "*.bak" -o -name "*.backup" -o -name "*~" 2>/dev/null | head -10
```

### 3.6 Evaluación de Buena Práctica #3
Generar tabla:

| Partición | Uso | Estado | Acción |
|-----------|-----|--------|--------|
| / | X% | 🟢/🟡/🔴 | - |
| /home | X% | 🟢/🟡/🔴 | - |

| Categoría | Tamaño | Acción Sugerida |
|-----------|--------|-----------------|
| Cache de apt | XMB | `apt clean` |
| Logs viejos | XMB | Eliminar >30 días |
| node_modules en prod | XMB | Eliminar |

---

## FASE 4: ACTUALIZACIONES AUTOMÁTICAS ✓

**Objetivo**: Verificar que las actualizaciones de seguridad se apliquen automáticamente.

### 4.1 Estado de Unattended Upgrades
```bash
# ¿Está instalado?
dpkg -l | grep unattended-upgrades

# ¿Está activo?
systemctl status unattended-upgrades --no-pager

# Configuración
cat /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null
cat /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null | grep -v "^//" | grep -v "^$" | head -30
```

### 4.2 Actualizaciones Pendientes
```bash
# Actualizar lista de paquetes
apt update 2>/dev/null

# Paquetes actualizables
apt list --upgradable 2>/dev/null

# ¿Se requiere reinicio?
[ -f /var/run/reboot-required ] && echo "⚠️ REINICIO REQUERIDO" && cat /var/run/reboot-required.pkgs || echo "✅ No se requiere reinicio"
```

### 4.3 Últimas Actualizaciones Aplicadas
```bash
# Historial reciente de apt
grep -E "install|upgrade" /var/log/apt/history.log 2>/dev/null | tail -20

# Logs de unattended-upgrades
cat /var/log/unattended-upgrades/unattended-upgrades.log 2>/dev/null | tail -30
```

### 4.4 Evaluación de Buena Práctica #4

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| unattended-upgrades instalado | ✅/❌ | Instalar |
| unattended-upgrades activo | ✅/❌ | Activar |
| Actualizaciones pendientes | X paquetes | Actualizar |
| Reinicio pendiente | ✅/❌ | Programar reinicio |

---

## FASE 5: LÍMITES POR PROYECTO ✓

**Objetivo**: Verificar que cada proyecto tenga límites de recursos para evitar que uno afecte a los demás.

### 5.1 Límites en Systemd por Servicio
```bash
echo "=== LÍMITES DE RECURSOS EN SYSTEMD ==="
for unit in /etc/systemd/system/gunicorn*.service /etc/systemd/system/*project*.service; do
    if [ -f "$unit" ]; then
        nombre=$(basename "$unit" .service)
        echo ""
        echo "--- $nombre ---"
        
        # Límites de memoria
        grep -E "MemoryMax|MemoryHigh|MemoryLimit" "$unit" 2>/dev/null || echo "  MemoryMax: No configurado ⚠️"
        
        # Límites de CPU
        grep -E "CPUQuota|CPUWeight" "$unit" 2>/dev/null || echo "  CPUQuota: No configurado"
        
        # Límites de tareas/procesos
        grep -E "TasksMax|LimitNPROC" "$unit" 2>/dev/null || echo "  TasksMax: No configurado"
        
        # Límites de archivos abiertos
        grep "LimitNOFILE" "$unit" 2>/dev/null || echo "  LimitNOFILE: No configurado"
        
        # Protección OOM
        grep "OOMScoreAdjust" "$unit" 2>/dev/null || echo "  OOMScoreAdjust: No configurado"
    fi
done 2>/dev/null
```

### 5.2 Uso Actual vs Límites
```bash
echo "=== USO ACTUAL DE RECURSOS POR SERVICIO ==="
for servicio in $(systemctl list-units --type=service --state=running | grep -E "gunicorn|project" | awk '{print $1}'); do
    echo ""
    echo "--- $servicio ---"
    systemctl status "$servicio" --no-pager 2>/dev/null | grep -E "Memory:|CPU:|Tasks:" || echo "No disponible"
done
```

### 5.3 Evaluación de Buena Práctica #5

| Proyecto | MemoryMax | CPUQuota | OOMScoreAdjust | Estado |
|----------|-----------|----------|----------------|--------|
| proyecto1 | XMB | X% | X | ✅/❌ |

---

## FASE 6: MONITOREO Y ALERTAS ✓

**Objetivo**: Verificar que existan mecanismos de monitoreo y alertas.

### 6.1 Scripts de Monitoreo Existentes
```bash
# Buscar scripts de monitoreo
find /home -name "*monitor*" -o -name "*health*" -o -name "*check*" 2>/dev/null | grep -E "\.(sh|py)$"

# Buscar en cron
crontab -l 2>/dev/null | grep -i "monitor\|health\|check\|alert"
cat /etc/cron.d/* 2>/dev/null | grep -i "monitor\|health\|check\|alert"
```

### 6.2 Health Checks en Django
```bash
echo "=== HEALTH CHECK ENDPOINTS EN PROYECTOS ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    echo ""
    echo "--- $nombre ---"
    
    # Buscar en urls.py
    grep -r "health" "$proyecto/backend/"**/urls.py 2>/dev/null | head -3 || echo "No encontrado en urls.py"
    
    # Buscar vista de health
    grep -r "def health" "$proyecto/backend/" 2>/dev/null | head -3
done
```

### 6.3 Servicios de Monitoreo Externos
```bash
# ¿Está instalado algún agente de monitoreo?
dpkg -l | grep -E "datadog|newrelic|prometheus|grafana|zabbix|nagios" 2>/dev/null || echo "No se detectaron agentes de monitoreo"

# ¿Sentry u otro servicio de errores?
grep -r "SENTRY_DSN\|sentry_sdk\|raven" /home/ryzepeck/webapps/*/backend/ 2>/dev/null | head -5
```

### 6.4 Evaluación de Buena Práctica #6

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| Script de health check | ✅/❌ | Implementar |
| Alertas por email/Slack | ✅/❌ | Configurar |
| Monitoreo de SSL | ✅/❌ | Agregar |
| Health endpoints en apps | ✅/❌ | Agregar /api/health/ |

---

## FASE 7: BACKUPS ✓

**Objetivo**: Verificar que existan backups automáticos y funcionales.

### 7.1 Scripts de Backup
```bash
# Buscar scripts de backup
find /home -name "*backup*" 2>/dev/null | grep -E "\.(sh|py)$"
find /var -name "*backup*" 2>/dev/null | grep -E "\.(sh|py)$"
find /root -name "*backup*" 2>/dev/null | grep -E "\.(sh|py)$"

# Buscar en cron
crontab -l 2>/dev/null | grep -i "backup\|dump\|mysqldump"
cat /etc/cron.d/* 2>/dev/null | grep -i "backup\|dump"
cat /etc/cron.daily/* 2>/dev/null | grep -i "backup\|dump"
```

### 7.2 Backups Existentes
```bash
# Buscar archivos de backup
echo "=== ARCHIVOS DE BACKUP ENCONTRADOS ==="
find /home -name "*.sql" -o -name "*.sql.gz" -o -name "*backup*" -o -name "*.dump" 2>/dev/null | head -20
find /var/backups -type f 2>/dev/null | head -10

# Backups recientes (últimos 7 días)
echo ""
echo "=== BACKUPS RECIENTES (últimos 7 días) ==="
find /home /var/backups -name "*.sql*" -o -name "*backup*" -mtime -7 2>/dev/null | head -10
```

### 7.3 Backup de MySQL
```bash
# ¿Hay backups automáticos de MySQL?
ls -la /var/lib/automysqlbackup/ 2>/dev/null
ls -la /var/backups/mysql/ 2>/dev/null

# Tamaño de bases de datos (para estimar backup)
mysql -e "SELECT table_schema AS 'Database', 
       ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' 
       FROM information_schema.tables 
       GROUP BY table_schema 
       ORDER BY SUM(data_length + index_length) DESC;" 2>/dev/null || echo "No se pudo conectar a MySQL (credenciales requeridas)"
```

### 7.4 django-dbbackup Config en Cada Proyecto
```bash
echo "=== DJANGO-DBBACKUP CONFIG POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # dbbackup en INSTALLED_APPS
    has_dbbackup=$(grep -r "'dbbackup'" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$has_dbbackup" ]; then
        echo "  ✅ dbbackup en INSTALLED_APPS"
    else
        echo "  ❌ dbbackup NO en INSTALLED_APPS"
    fi
    
    # DBBACKUP_STORAGE o STORAGES['dbbackup'] configurado
    has_storage=$(grep -rE "DBBACKUP_STORAGE|BACKUP_STORAGE_PATH|'dbbackup'" "$proyecto/backend/"**/settings*.py 2>/dev/null | grep -v "INSTALLED" | head -1)
    if [ -n "$has_storage" ]; then
        echo "  ✅ Storage configurado"
        # Mostrar path de backup
        grep -oP "BACKUP_STORAGE_PATH.*?default='([^']+)'" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1
    else
        echo "  ❌ Storage NO configurado"
    fi
    
    # DBBACKUP_CLEANUP_KEEP
    cleanup=$(grep -r "DBBACKUP_CLEANUP_KEEP" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$cleanup" ]; then
        echo "  ✅ $cleanup"
    else
        echo "  ⚠️ DBBACKUP_CLEANUP_KEEP no definido (sin límite de retención)"
    fi
    
    # scheduled_backup en tasks.py
    has_task=$(grep -r "def scheduled_backup" "$proyecto/backend/"**/tasks.py 2>/dev/null | head -1)
    if [ -n "$has_task" ]; then
        echo "  ✅ scheduled_backup en tasks.py"
        # Mostrar schedule
        grep -B1 "def scheduled_backup" "$proyecto/backend/"**/tasks.py 2>/dev/null | grep "crontab" | head -1
    else
        echo "  ❌ scheduled_backup NO en tasks.py"
    fi
    
    # Directorio de backup existe y tiene archivos
    bdir="/var/backups/${nombre}"
    if [ -d "$bdir" ]; then
        bcount=$(find "$bdir" -type f \( -name "*.sql*" -o -name "*.tar*" \) 2>/dev/null | wc -l)
        latest=$(find "$bdir" -type f \( -name "*.sql*" -o -name "*.tar*" \) -printf '%T@ %f\n' 2>/dev/null | sort -rn | head -1 | awk '{print $2}')
        echo "  ✅ /var/backups/$nombre/ ($bcount archivos, último: ${latest:-ninguno})"
    else
        echo "  ❌ /var/backups/$nombre/ NO existe"
    fi
done
```

### 7.5 Evaluación de Buena Práctica #7

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| django-dbbackup en INSTALLED_APPS | ✅/❌ | Agregar a todos |
| BACKUP_STORAGE_PATH configurado | ✅/❌ | Apuntar a /var/backups/PROJECT/ |
| DBBACKUP_CLEANUP_KEEP definido | ✅/❌ | Configurar 4 (retención 1 mes) |
| scheduled_backup en tasks.py (Huey) | ✅/❌ | Agregar tarea semanal |
| Directorio /var/backups/PROJECT/ | ✅/❌ | Crear con permisos correctos |
| Archivos de backup recientes | ✅/❌ | Último backup <10 días |
| Backup de media incluido | ✅/❌ | mediabackup --compress --clean |
| Backup remoto/offsite | ✅/❌ | Considerar S3/rsync |

---

## FASE 8: CRON JOBS Y HUEY TASKS ✓

**Objetivo**: Verificar tareas programadas del sistema (cron, timers) y tareas periódicas de Django (Huey).

### 8.1 Cron del Sistema
```bash
echo "=== CRONTAB DE ROOT ==="
crontab -l 2>/dev/null || echo "No hay crontab de root"

echo ""
echo "=== CRONTAB DEL USUARIO ==="
crontab -u ryzepeck -l 2>/dev/null || echo "No hay crontab del usuario"

echo ""
echo "=== /etc/cron.d/ ==="
ls -la /etc/cron.d/
for f in /etc/cron.d/*; do
    echo "--- $f ---"
    cat "$f" 2>/dev/null | grep -v "^#" | grep -v "^$"
done

echo ""
echo "=== CRON DIARIO/SEMANAL/MENSUAL ==="
ls /etc/cron.daily/ 2>/dev/null
ls /etc/cron.weekly/ 2>/dev/null
ls /etc/cron.monthly/ 2>/dev/null
```

### 8.2 Timers de Systemd
```bash
systemctl list-timers --all
```

### 8.3 Huey Config y Servicios Systemd
```bash
echo "=== HUEY CONFIG EN SETTINGS POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # Huey en INSTALLED_APPS
    has_huey=$(grep -r "huey.contrib.djhuey" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$has_huey" ]; then
        echo "  ✅ huey.contrib.djhuey en INSTALLED_APPS"
    else
        echo "  ❌ Huey NO en INSTALLED_APPS"
    fi
    
    # RedisHuey config
    redis_cfg=$(grep -rE "RedisHuey|HUEY\s*=" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$redis_cfg" ]; then
        echo "  ✅ HUEY configurado"
        # Mostrar Redis DB
        grep -oP "redis://[^'\"]*" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1
    else
        echo "  ❌ HUEY NO configurado"
    fi
done

echo ""
echo "=== HUEY SYSTEMD SERVICES ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    # Buscar servicio Huey
    for svc in "${nombre}-huey" "$(echo $nombre | sed 's/_project//' | sed 's/_/-/g')-huey" "${nombre//_/-}-huey"; do
        state=$(systemctl is-active "${svc}.service" 2>/dev/null || echo "not-found")
        if [ "$state" != "not-found" ]; then
            echo "$nombre: ${svc}.service → $state"
            break
        fi
    done
done
```

### 8.4 Huey Tasks por Proyecto (4 tareas esperadas)
```bash
echo "=== HUEY TASKS POR PROYECTO ==="
EXPECTED_TASKS="scheduled_backup silk_garbage_collection weekly_slow_queries_report silk_reports_cleanup"

for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # Buscar tasks.py
    tasks_file=$(find "$proyecto/backend" -name "tasks.py" -not -path "*/venv/*" -not -path "*/__pycache__/*" 2>/dev/null | head -1)
    if [ -z "$tasks_file" ]; then
        echo "  ❌ tasks.py NO encontrado"
        continue
    fi
    echo "  📄 $tasks_file"
    
    # Verificar cada tarea esperada
    for task in $EXPECTED_TASKS; do
        if grep -q "def $task" "$tasks_file" 2>/dev/null; then
            schedule=$(grep -B1 "def $task" "$tasks_file" | grep "crontab" | head -1 | sed 's/.*crontab(//' | sed 's/).*//')
            echo "  ✅ $task — crontab($schedule)"
        else
            echo "  ❌ $task NO definida"
        fi
    done
done
```

### 8.5 Tareas de Mantenimiento Esperadas
Verificar si existen tareas para:
- [ ] Limpieza de archivos temporales
- [ ] Rotación/limpieza de logs
- [ ] Backup de bases de datos (django-dbbackup via Huey)
- [ ] Renovación de certificados SSL
- [ ] Limpieza de sesiones Django (`clearsessions`)
- [ ] Optimización de MySQL
- [ ] Health checks
- [ ] Silk garbage collection (diario via Huey)
- [ ] Silk weekly slow query report (semanal via Huey)
- [ ] Silk reports cleanup (mensual via Huey)

### 8.6 Evaluación de Buena Práctica #8

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| Huey en INSTALLED_APPS (7/7) | ✅/❌ | Agregar a todos |
| HUEY config con Redis | ✅/❌ | RedisHuey con DB asignada |
| Huey systemd service activo | ✅/❌ | Crear unit y habilitar |
| tasks.py con scheduled_backup | ✅/❌ | Tarea semanal |
| tasks.py con silk_garbage_collection | ✅/❌ | Tarea diaria |
| tasks.py con weekly_slow_queries_report | ✅/❌ | Tarea semanal |
| tasks.py con silk_reports_cleanup | ✅/❌ | Tarea mensual |
| Certbot timer activo | ✅/❌ | certbot.timer |
| Cron srv-monitoring configurado | ✅/❌ | /etc/cron.d/srv-monitoring |

---

## FASE 9: SCRIPTS DE SALUD ✓

**Objetivo**: Verificar si existen scripts de diagnóstico rápido.

### 9.1 Scripts Existentes
```bash
# Buscar scripts de diagnóstico/salud
find /home -name "*diagnostic*" -o -name "*health*" -o -name "*status*" 2>/dev/null | grep -E "\.(sh|py)$"

# ¿Hay un directorio de scripts de mantenimiento?
ls -la /home/ryzepeck/scripts/ 2>/dev/null
ls -la /var/www/shared/scripts/ 2>/dev/null
ls -la /root/scripts/ 2>/dev/null
```

### 9.2 Evaluación de Buena Práctica #9

| Script | Existe | Ubicación | Recomendación |
|--------|--------|-----------|---------------|
| quick-status.sh | ✅/❌ | - | Crear |
| full-diagnostic.sh | ✅/❌ | - | Crear |
| post-deploy-check.sh | ✅/❌ | - | Crear |

---

## FASE 10: MAX-REQUESTS (Anti Memory Leak) ✓

**Objetivo**: Verificar que Gunicorn esté configurado para reiniciar workers periódicamente.

### 10.1 Configuración en Systemd
```bash
echo "=== MAX-REQUESTS EN CONFIGURACIÓN ==="
for unit in /etc/systemd/system/gunicorn*.service /etc/systemd/system/*project*.service; do
    if [ -f "$unit" ]; then
        nombre=$(basename "$unit" .service)
        max_req=$(grep -o "\-\-max-requests[= ][0-9]*" "$unit" 2>/dev/null | head -1)
        jitter=$(grep -o "\-\-max-requests-jitter[= ][0-9]*" "$unit" 2>/dev/null | head -1)
        
        if [ -n "$max_req" ]; then
            echo "$nombre: $max_req $jitter ✅"
        else
            echo "$nombre: No configurado ⚠️"
        fi
    fi
done 2>/dev/null
```

### 10.2 Verificación en Runtime
```bash
echo "=== MAX-REQUESTS EN PROCESOS CORRIENDO ==="
ps aux | grep gunicorn | grep -v grep | while read line; do
    if echo "$line" | grep -q "max-requests"; then
        pid=$(echo "$line" | awk '{print $2}')
        max_req=$(echo "$line" | grep -o "\-\-max-requests[= ][0-9]*")
        echo "PID $pid: $max_req ✅"
    else
        pid=$(echo "$line" | awk '{print $2}')
        cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i}')
        echo "PID $pid: max-requests NO configurado ⚠️"
    fi
done
```

### 10.3 Análisis de Memory Leaks
```bash
echo "=== WORKERS CON MUCHA RAM Y MUCHO UPTIME (Posible Memory Leak) ==="
ps aux | grep "gunicorn.*worker" | grep -v grep | while read line; do
    pid=$(echo "$line" | awk '{print $2}')
    mem_pct=$(echo "$line" | awk '{print $4}')
    
    # Obtener uptime del proceso
    uptime=$(ps -o etime= -p $pid 2>/dev/null | xargs)
    mem_mb=$(ps -o rss= -p $pid 2>/dev/null | awk '{print int($1/1024)}')
    
    # Alertar si usa >200MB y lleva más de 1 día
    if [ "$mem_mb" -gt 200 ]; then
        echo "⚠️ PID $pid: ${mem_mb}MB RAM, uptime: $uptime"
    fi
done
```

### 10.4 Evaluación de Buena Práctica #10

| Proyecto | max-requests Config | max-requests Runtime | Jitter | Estado |
|----------|---------------------|----------------------|--------|--------|
| proyecto1 | X | X | X | ✅/❌ |

**Valores recomendados:**
- E-commerce/API normal: `--max-requests 1000 --max-requests-jitter 100`
- Uploads/Media: `--max-requests 500 --max-requests-jitter 50`

---

## FASE 11: SILK — PROFILING Y DETECCIÓN DE QUERIES LENTAS ✓

**Objetivo**: Verificar que Silk esté configurado correctamente en cada proyecto para detectar queries lentas y patrones N+1, y que MySQL tenga slow_query_log activo.

### 11.1 Configuración de MySQL Slow Query Log
```bash
echo "=== CONFIGURACIÓN DE SLOW QUERY LOG ==="

# En archivo de configuración
grep -r "slow_query" /etc/mysql/ 2>/dev/null
grep -r "long_query_time" /etc/mysql/ 2>/dev/null

# Variables runtime
mysql -e "SHOW VARIABLES LIKE 'slow_query%';" 2>/dev/null || echo "No se pudo conectar a MySQL"
mysql -e "SHOW VARIABLES LIKE 'long_query_time';" 2>/dev/null

# ¿Existe el archivo de slow query log?
ls -la /var/log/mysql/mysql-slow.log 2>/dev/null || echo "Slow query log no encontrado"
du -sh /var/log/mysql/mysql-slow.log 2>/dev/null
```

### 11.2 Silk Config Completa por Proyecto
```bash
echo "=== SILK CONFIG COMPLETA POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # 1. ENABLE_SILK en settings
    enable_silk=$(grep -r "ENABLE_SILK" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$enable_silk" ]; then
        echo "  ✅ ENABLE_SILK definido"
    else
        echo "  ❌ ENABLE_SILK NO definido"
    fi
    
    # 2. 'silk' en INSTALLED_APPS (condicional)
    has_silk_app=$(grep -r "'silk'" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$has_silk_app" ]; then
        echo "  ✅ silk en INSTALLED_APPS (condicional)"
    else
        echo "  ❌ silk NO en INSTALLED_APPS"
    fi
    
    # 3. SilkyMiddleware
    has_middleware=$(grep -r "SilkyMiddleware" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$has_middleware" ]; then
        echo "  ✅ SilkyMiddleware configurado"
    else
        echo "  ❌ SilkyMiddleware NO configurado"
    fi
    
    # 4. SILKY_ANALYZE_QUERIES
    analyze=$(grep -r "SILKY_ANALYZE_QUERIES" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$analyze" ]; then
        echo "  ✅ SILKY_ANALYZE_QUERIES = True"
    else
        echo "  ⚠️ SILKY_ANALYZE_QUERIES no definido"
    fi
    
    # 5. SILKY_AUTHENTICATION y SILKY_AUTHORISATION
    auth=$(grep -r "SILKY_AUTHENTICATION\|SILKY_AUTHORISATION" "$proyecto/backend/"**/settings*.py 2>/dev/null | wc -l)
    if [ "$auth" -ge 2 ]; then
        echo "  ✅ Silk auth protegido (AUTHENTICATION + AUTHORISATION)"
    else
        echo "  ⚠️ Silk auth NO protegido ($auth/2 flags)"
    fi
    
    # 6. SILKY_MAX_RECORDED_REQUESTS
    max_req=$(grep -r "SILKY_MAX_RECORDED_REQUESTS\b" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$max_req" ]; then
        echo "  ✅ $max_req"
    else
        echo "  ⚠️ SILKY_MAX_RECORDED_REQUESTS no definido (crecimiento ilimitado)"
    fi
    
    # 7. SILKY_IGNORE_PATHS
    ignore=$(grep -r "SILKY_IGNORE_PATHS" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$ignore" ]; then
        echo "  ✅ SILKY_IGNORE_PATHS configurado"
    else
        echo "  ⚠️ SILKY_IGNORE_PATHS no definido"
    fi
    
    # 8. Thresholds (SLOW_QUERY_THRESHOLD_MS, N_PLUS_ONE_THRESHOLD)
    threshold=$(grep -r "SLOW_QUERY_THRESHOLD_MS\|N_PLUS_ONE_THRESHOLD" "$proyecto/backend/"**/settings*.py 2>/dev/null)
    if [ -n "$threshold" ]; then
        echo "  ✅ Thresholds definidos:"
        echo "$threshold" | sed 's/^/    /'
    else
        echo "  ⚠️ Thresholds NO definidos (SLOW_QUERY_THRESHOLD_MS, N_PLUS_ONE_THRESHOLD)"
    fi
    
    # 9. silk en urls.py
    silk_url=$(grep -r "silk" "$proyecto/backend/"**/urls.py 2>/dev/null | head -1)
    if [ -n "$silk_url" ]; then
        echo "  ✅ silk en urls.py"
    else
        echo "  ⚠️ silk NO en urls.py"
    fi
    
    # 10. silk_garbage_collect management command
    gc_cmd=$(find "$proyecto/backend" -path "*/management/commands/silk_garbage_collect.py" 2>/dev/null | head -1)
    if [ -n "$gc_cmd" ]; then
        echo "  ✅ silk_garbage_collect management command"
    else
        echo "  ⚠️ silk_garbage_collect management command NO encontrado"
    fi
done
```

### 11.3 Reportes Silk y Limpieza
```bash
echo "=== REPORTES SILK Y LIMPIEZA POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # Directorio silk-reports
    silk_dir="$proyecto/backend/logs/silk-reports"
    if [ -d "$silk_dir" ]; then
        count=$(ls "$silk_dir"/silk-report-*.log 2>/dev/null | wc -l)
        latest=$(ls -t "$silk_dir"/silk-report-*.log 2>/dev/null | head -1)
        echo "  ✅ silk-reports/ ($count reportes)"
        [ -n "$latest" ] && echo "  📄 Último: $(basename "$latest")"
    else
        echo "  ❌ silk-reports/ NO existe"
    fi
    
    # silk_reports_cleanup en tasks.py
    cleanup_task=$(grep -r "def silk_reports_cleanup" "$proyecto/backend/"**/tasks.py 2>/dev/null | head -1)
    if [ -n "$cleanup_task" ]; then
        echo "  ✅ silk_reports_cleanup tarea mensual"
    else
        echo "  ❌ silk_reports_cleanup NO definida en tasks.py"
    fi
done
```

### 11.4 Evaluación de Buena Práctica #11

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| MySQL slow_query_log activo | ✅/❌ | Activar |
| ENABLE_SILK en settings (7/7) | ✅/❌ | Agregar a todos |
| silk en INSTALLED_APPS (condicional) | ✅/❌ | `if ENABLE_SILK: INSTALLED_APPS.append('silk')` |
| SilkyMiddleware (condicional) | ✅/❌ | Insertar en MIDDLEWARE |
| SILKY_ANALYZE_QUERIES = True | ✅/❌ | Para detectar queries lentas |
| SILKY_AUTHENTICATION + AUTHORISATION | ✅/❌ | Proteger acceso con is_staff |
| SILKY_MAX_RECORDED_REQUESTS | ✅/❌ | Limitar a 10000 |
| SILKY_IGNORE_PATHS | ✅/❌ | Excluir /admin/, /static/, /media/, /silk/ |
| SLOW_QUERY_THRESHOLD_MS + N_PLUS_ONE_THRESHOLD | ✅/❌ | 500ms y 10 queries |
| silk en urls.py | ✅/❌ | path('silk/', include('silk.urls')) |
| silk_garbage_collect mgmt command | ✅/❌ | Para limpieza diaria via Huey |
| silk-reports/ con reportes recientes | ✅/❌ | weekly_slow_queries_report |
| silk_reports_cleanup (mensual) | ✅/❌ | Limpieza >6 meses |

---

## FASE 12: CHECKLIST PERIÓDICO ✓

**Objetivo**: Evaluación general del estado de mantenimiento periódico.

### 12.1 Evidencia de Mantenimiento Reciente
```bash
echo "=== EVIDENCIA DE MANTENIMIENTO ==="

# Últimas actualizaciones del sistema
echo "Últimas actualizaciones de paquetes:"
grep -E "install|upgrade" /var/log/apt/history.log 2>/dev/null | tail -10

# Últimos reinicios de servicios
echo ""
echo "Últimos reinicios de servicios Django:"
for servicio in $(systemctl list-units --type=service | grep -E "gunicorn|project" | awk '{print $1}'); do
    last_start=$(systemctl show "$servicio" --property=ActiveEnterTimestamp 2>/dev/null | cut -d= -f2)
    echo "$servicio: $last_start"
done

# Último reinicio del servidor
echo ""
echo "Último reinicio del servidor:"
who -b
uptime -s
```

### 12.2 Evaluación de Buena Práctica #12

| Tarea | Frecuencia | Última Vez | Estado |
|-------|------------|------------|--------|
| Verificar espacio disco | Semanal | ? | ✅/❌ |
| Revisar logs de error | Semanal | ? | ✅/❌ |
| Actualizar sistema | Semanal | ? | ✅/❌ |
| Verificar backups | Semanal | ? | ✅/❌ |
| Optimizar MySQL | Mensual | ? | ✅/❌ |
| Revisar SSL | Mensual | ? | ✅/❌ |
| Test de restore | Mensual | ? | ✅/❌ |
| Auditoría seguridad | Trimestral | ? | ✅/❌ |

---

## FASE 13: SEGURIDAD ✓

### 13.1 Firewall
```bash
ufw status verbose
```

### 13.2 Fail2ban
```bash
systemctl status fail2ban --no-pager
fail2ban-client status 2>/dev/null
```

### 13.3 SSH
```bash
grep -E "PermitRootLogin|PasswordAuthentication|PubkeyAuthentication" /etc/ssh/sshd_config
```

### 13.4 DEBUG en Producción
```bash
echo "=== DEBUG EN SETTINGS DE DJANGO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    
    # Buscar DEBUG en settings
    debug_status=$(grep -r "^DEBUG\s*=" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    
    if echo "$debug_status" | grep -qi "true"; then
        echo "❌ $nombre: DEBUG=True (PELIGRO)"
    elif echo "$debug_status" | grep -qi "false"; then
        echo "✅ $nombre: DEBUG=False"
    else
        # Verificar en .env
        env_debug=$(grep "^DEBUG=" "$proyecto/backend/.env" 2>/dev/null | head -1)
        if [ -n "$env_debug" ]; then
            echo "🔍 $nombre: $env_debug (desde .env)"
        else
            echo "⚠️ $nombre: DEBUG no encontrado explícitamente"
        fi
    fi
done
```

### 13.5 Secretos Hardcodeados
```bash
echo "=== BÚSQUEDA DE SECRETOS HARDCODEADOS ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    
    # Buscar SECRET_KEY hardcodeado
    secret_key=$(grep -r "SECRET_KEY\s*=\s*['\"]" "$proyecto/backend/"**/settings*.py 2>/dev/null | grep -v "os.environ\|env(" | head -1)
    
    if [ -n "$secret_key" ]; then
        echo "❌ $nombre: SECRET_KEY hardcodeado"
    fi
    
    # Buscar contraseñas hardcodeadas
    passwords=$(grep -rE "(PASSWORD|PASSWD|EMAIL_HOST_PASSWORD)\s*=\s*['\"][^'\"]+['\"]" "$proyecto/backend/"**/settings*.py 2>/dev/null | grep -v "os.environ\|env(" | head -1)
    
    if [ -n "$passwords" ]; then
        echo "❌ $nombre: Contraseñas hardcodeadas"
    fi
done
```

### 13.6 Permisos de .env
```bash
echo "=== PERMISOS DE ARCHIVOS .env ==="
find /home/ryzepeck/webapps -name ".env" -exec ls -la {} \; 2>/dev/null
```

### 13.7 SSL/Certificados
```bash
echo "=== ESTADO DE CERTIFICADOS SSL ==="
certbot certificates 2>/dev/null || echo "No se pudo ejecutar certbot"

# Verificar expiración por dominio
for conf in /etc/nginx/sites-enabled/*; do
    dominio=$(grep -m1 "server_name" "$conf" 2>/dev/null | awk '{print $2}' | tr -d ';')
    if [ -n "$dominio" ] && [ "$dominio" != "_" ]; then
        expiry=$(echo | openssl s_client -servername "$dominio" -connect "$dominio:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ -n "$expiry" ]; then
            echo "$dominio: expira $expiry"
        fi
    fi
done
```

### 13.8 Seguridad Nginx (Geo-blocking, Rate Limiting, Fail2ban)
```bash
echo "=== SEGURIDAD NGINX ==="

# Geo-blocking
echo "--- Geo-blocking ---"
if [ -f /etc/nginx/conf.d/geo-block.conf ]; then
    echo "✅ geo-block.conf existe"
    countries=$(grep -c "1;" /etc/nginx/conf.d/geo-block.conf 2>/dev/null || echo "0")
    echo "  Países permitidos: $countries"
else
    echo "❌ geo-block.conf NO existe"
fi
if [ -f /etc/nginx/snippets/geo-block.conf ]; then
    echo "✅ snippet geo-block.conf existe"
else
    echo "❌ snippet geo-block.conf NO existe"
fi

# Rate limiting
echo ""
echo "--- Rate Limiting ---"
rate_zones=$(grep -c "limit_req_zone" /etc/nginx/nginx.conf 2>/dev/null || echo "0")
echo "Rate limit zones en nginx.conf: $rate_zones"
grep "limit_req_zone" /etc/nginx/nginx.conf 2>/dev/null | head -5

# Fail2ban jails
echo ""
echo "--- Fail2ban Jails ---"
fail2ban-client status 2>/dev/null || echo "fail2ban no accesible"

# Verificar que cada site config incluya geo-block y rate limiting
echo ""
echo "--- Sites con geo-block y rate limiting ---"
for conf in /etc/nginx/sites-enabled/*; do
    nombre=$(basename "$conf")
    has_geo=$(grep -c "geo-block" "$conf" 2>/dev/null || echo "0")
    has_rate=$(grep -c "limit_req" "$conf" 2>/dev/null || echo "0")
    geo_icon="✅"; [ "$has_geo" -eq 0 ] && geo_icon="❌"
    rate_icon="✅"; [ "$has_rate" -eq 0 ] && rate_icon="❌"
    echo "  $nombre: geo-block ${geo_icon} | rate-limit ${rate_icon}"
done
```

### 13.9 Evaluación de Buena Práctica #13

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| UFW activo | ✅/❌ | Habilitar |
| Fail2ban activo | ✅/❌ | Instalar y activar |
| Fail2ban jails (6 esperados) | X/6 | sshd, nginx-limit-req, nginx-botsearch, nginx-bad-request, nginx-http-auth, recidive |
| SSH PasswordAuth=no | ✅/❌ | Desactivar |
| SSH PermitRootLogin=no | ✅/❌ | Desactivar |
| DEBUG=False en todos | ✅/❌ | Forzar False en prod |
| Secretos en .env (no hardcoded) | ✅/❌ | Migrar a python-decouple |
| .env con permisos 600 | ✅/❌ | chmod 600 |
| SSL >14 días | ✅/❌ | Certbot timer activo |
| Geo-blocking nginx | ✅/❌ | Allowlist Américas + España |
| Rate limiting nginx | ✅/❌ | general 10r/s + api 5r/s |

---

## FASE 14: REPORTES PERIÓDICOS Y NOTIFICACIONES POR EMAIL ✓

**Objetivo**: Verificar que el sistema de reportes automatizados esté completo y funcional — scripts, cron, email, y reportes recientes.

### 14.1 msmtp (Envío de Email)
```bash
echo "=== CONFIGURACIÓN DE EMAIL (msmtp) ==="

# msmtp instalado
which msmtp >/dev/null 2>&1 && echo "✅ msmtp instalado: $(which msmtp)" || echo "❌ msmtp NO instalado"

# Config file
msmtp_config="/home/ryzepeck/.config/msmtp/config"
if [ -f "$msmtp_config" ]; then
    perms=$(stat -c '%a' "$msmtp_config")
    echo "✅ Config: $msmtp_config (permisos: $perms)"
    [ "$perms" != "600" ] && echo "  ⚠️ Permisos deberían ser 600"
    # SMTP host (sin mostrar credenciales)
    grep "^host" "$msmtp_config" 2>/dev/null | head -1
    grep "^from" "$msmtp_config" 2>/dev/null | head -1
else
    echo "❌ Config NO encontrada en $msmtp_config"
fi

# Test de envío (solo verificar que el comando no falle, sin enviar)
echo "test" | msmtp --pretend -C "$msmtp_config" team@projectapp.co 2>/dev/null && echo "✅ msmtp --pretend OK" || echo "⚠️ msmtp --pretend falló"
```

### 14.2 Scripts de Reporting
```bash
echo "=== SCRIPTS DE REPORTING ==="
EXPECTED_SCRIPTS=(
    "server-alerts.sh:Alertas cada 5min (10 checks, cooldown 2h, HTML email)"
    "server-weekly-report.sh:Reporte semanal unificado (dom 06:00 UTC)"
    "server-diagnostic-report.sh:Diagnóstico 13+ fases con scoring /10 (dom 07:00 UTC)"
    "server-traffic-report.sh:Análisis de tráfico nginx por dominio (sáb 08:00 UTC)"
)

for entry in "${EXPECTED_SCRIPTS[@]}"; do
    script="${entry%%:*}"
    desc="${entry#*:}"
    path="/home/ryzepeck/scripts/$script"
    if [ -x "$path" ]; then
        size=$(stat -c '%s' "$path" | awk '{if($1>1024) printf "%.1fKB",$1/1024; else printf "%dB",$1}')
        echo "✅ $script ($size) — $desc"
    else
        echo "❌ $script NO encontrado o no ejecutable — $desc"
    fi
done
```

### 14.3 Cron de Monitoreo
```bash
echo "=== CRON DE MONITOREO ==="
cron_file="/etc/cron.d/srv-monitoring"
if [ -f "$cron_file" ]; then
    echo "✅ $cron_file existe"
    echo "Contenido:"
    cat "$cron_file" | grep -v "^#" | grep -v "^$" | sed 's/^/  /'
else
    echo "❌ $cron_file NO existe"
fi

echo ""
echo "=== ENTRADAS ESPERADAS EN CRON ==="
EXPECTED_CRON=(
    "server-alerts.sh:*/5 * * * *:Alertas cada 5 min"
    "server-weekly-report.sh:0 6 * * 0:Reporte semanal dom 06:00"
    "server-diagnostic-report.sh:0 7 * * 0:Diagnóstico dom 07:00"
    "server-traffic-report.sh:0 8 * * 6:Tráfico sáb 08:00"
)
for entry in "${EXPECTED_CRON[@]}"; do
    script="${entry%%:*}"
    if grep -q "$script" "$cron_file" 2>/dev/null; then
        schedule=$(grep "$script" "$cron_file" | awk '{print $1,$2,$3,$4,$5}')
        echo "  ✅ $script — $schedule"
    else
        echo "  ❌ $script NO en cron"
    fi
done
```

### 14.4 Timers Systemd
```bash
echo "=== TIMERS SYSTEMD ESPERADOS ==="
EXPECTED_TIMERS=(
    "vps-healthcheck.timer:cada 10 min"
    "vps-backup.timer:diario 02:30 UTC"
    "vps-housekeeping.timer:dom 03:30 UTC"
    "reboot-required-window.timer:dom 03:10 UTC"
    "certbot.timer:2x diario"
)
for entry in "${EXPECTED_TIMERS[@]}"; do
    timer="${entry%%:*}"
    desc="${entry#*:}"
    state=$(systemctl is-active "$timer" 2>/dev/null || echo "not-found")
    enabled=$(systemctl is-enabled "$timer" 2>/dev/null || echo "not-found")
    if [ "$state" = "active" ]; then
        echo "  ✅ $timer ($desc) — active, $enabled"
    else
        echo "  ❌ $timer ($desc) — $state, $enabled"
    fi
done

echo ""
echo "=== POST-BOOT SERVICE ==="
state=$(systemctl is-enabled "vps-postboot-check.service" 2>/dev/null || echo "not-found")
echo "  vps-postboot-check.service: $state"
```

### 14.5 Reportes Recientes
```bash
echo "=== REPORTES RECIENTES ==="
report_dir="/home/ryzepeck/scripts/reports"

# Diagnósticos
echo "--- Diagnósticos (.md) ---"
ls -lt "$report_dir"/diagnostico-*.md 2>/dev/null | head -3 || echo "  Ninguno"

# Semanales
echo "--- Semanales (.md) ---"
ls -lt "$report_dir"/reporte-semanal-*.md 2>/dev/null | head -3 || echo "  Ninguno"

# Tráfico
echo "--- Tráfico ---"
ls -ltd "$report_dir"/trafico/*/resumen.md 2>/dev/null | head -3 || echo "  Ninguno"

# Alertas recientes en journal
echo ""
echo "--- Últimas alertas enviadas (últimos 7 días) ---"
journalctl -t srv-alerts --since "7 days ago" --no-pager -q 2>/dev/null | tail -10 || echo "  Sin registros"
```

### 14.6 Evaluación de Buena Práctica #14

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| msmtp instalado y configurado | ✅/❌ | Instalar, config con permisos 600 |
| server-alerts.sh (cada 5 min) | ✅/❌ | 10 checks, cooldown 2h |
| server-weekly-report.sh (dom 06:00) | ✅/❌ | HTML + .md unificado |
| server-diagnostic-report.sh (dom 07:00) | ✅/❌ | 13+ fases, scoring /10 |
| server-traffic-report.sh (sáb 08:00) | ✅/❌ | Tráfico nginx por dominio |
| /etc/cron.d/srv-monitoring con 4 entradas | ✅/❌ | alerts, weekly, diagnostic, traffic |
| Timers systemd (5 esperados) | X/5 | healthcheck, backup, housekeeping, reboot-window, certbot |
| vps-postboot-check.service | ✅/❌ | Verificación post-reinicio |
| Reportes recientes (<7 días) | ✅/❌ | Verificar que se generen |
| Emails llegando correctamente | ✅/❌ | Revisar inbox team@projectapp.co |

---

## FASE 15: ESTANDARIZACIÓN DE PROYECTO (SETTINGS SPLIT + DECOUPLE) ✓

**Objetivo**: Verificar que cada proyecto siga la arquitectura estándar: settings split (base + dev + prod), python-decouple, DJANGO_ENV en producción.

### 15.1 Settings Split
```bash
echo "=== SETTINGS SPLIT POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # Buscar directorio de settings (varía: candle_project, core_project, config, etc.)
    settings_dir=$(find "$proyecto/backend" -name "settings.py" -not -path "*/venv/*" -not -path "*/__pycache__/*" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
    
    if [ -z "$settings_dir" ]; then
        echo "  ❌ settings.py NO encontrado"
        continue
    fi
    echo "  📂 $settings_dir"
    
    # settings.py (base)
    [ -f "$settings_dir/settings.py" ] && echo "  ✅ settings.py (base)" || echo "  ❌ settings.py (base)"
    
    # settings_dev.py
    [ -f "$settings_dir/settings_dev.py" ] && echo "  ✅ settings_dev.py" || echo "  ❌ settings_dev.py"
    
    # settings_prod.py
    [ -f "$settings_dir/settings_prod.py" ] && echo "  ✅ settings_prod.py" || echo "  ❌ settings_prod.py"
done
```

### 15.2 Python-Decouple (config())
```bash
echo "=== PYTHON-DECOUPLE POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # Verificar import de decouple en settings
    has_decouple=$(grep -r "from decouple import\|from decouple import config" "$proyecto/backend/"**/settings*.py 2>/dev/null | head -1)
    if [ -n "$has_decouple" ]; then
        echo "  ✅ python-decouple importado"
    else
        echo "  ❌ python-decouple NO importado"
    fi
    
    # Contar uso de config() vs hardcoded
    config_calls=$(grep -rc "config(" "$proyecto/backend/"**/settings*.py 2>/dev/null | awk -F: '{s+=$2}END{print s}')
    echo "  Usos de config(): ${config_calls:-0}"
    
    # Verificar .env.example existe
    [ -f "$proyecto/backend/.env.example" ] && echo "  ✅ .env.example existe" || echo "  ⚠️ .env.example NO existe"
done
```

### 15.3 DJANGO_ENV y DJANGO_SETTINGS_MODULE en Producción
```bash
echo "=== DJANGO_ENV Y SETTINGS MODULE POR PROYECTO ==="
for proyecto in /home/ryzepeck/webapps/*/; do
    nombre=$(basename "$proyecto")
    [[ "$nombre" == "ops" ]] && continue
    echo ""
    echo "--- $nombre ---"
    
    # DJANGO_ENV en .env
    env_file="$proyecto/backend/.env"
    if [ -f "$env_file" ]; then
        django_env=$(grep "^DJANGO_ENV=" "$env_file" 2>/dev/null | cut -d= -f2)
        if [ "$django_env" = "production" ]; then
            echo "  ✅ DJANGO_ENV=production"
        elif [ -n "$django_env" ]; then
            echo "  ⚠️ DJANGO_ENV=$django_env (debería ser 'production')"
        else
            echo "  ❌ DJANGO_ENV no definido en .env"
        fi
        
        # DJANGO_SETTINGS_MODULE
        dsm=$(grep "^DJANGO_SETTINGS_MODULE=" "$env_file" 2>/dev/null | cut -d= -f2)
        if [ -n "$dsm" ]; then
            echo "  📋 DJANGO_SETTINGS_MODULE=$dsm"
            echo "$dsm" | grep -q "prod" && echo "  ✅ Apunta a settings_prod" || echo "  ⚠️ NO apunta a settings_prod"
        else
            echo "  ⚠️ DJANGO_SETTINGS_MODULE no en .env"
        fi
    else
        echo "  ❌ .env NO existe"
    fi
    
    # Verificar en systemd service
    svc_file=$(find /etc/systemd/system -name "${nombre}*.service" -not -name "*huey*" 2>/dev/null | head -1)
    if [ -n "$svc_file" ] && [ -f "$svc_file" ]; then
        env_in_svc=$(grep "DJANGO_SETTINGS_MODULE\|Environment=" "$svc_file" 2>/dev/null | head -3)
        [ -n "$env_in_svc" ] && echo "  📋 En systemd: $env_in_svc"
    fi
done
```

### 15.4 Evaluación de Buena Práctica #15

| Aspecto | Estado | Recomendación |
|---------|--------|---------------|
| settings.py (base) existe (7/7) | ✅/❌ | Archivo base |
| settings_dev.py existe (7/7) | ✅/❌ | Overrides para desarrollo |
| settings_prod.py existe (7/7) | ✅/❌ | Overrides para producción |
| python-decouple importado (7/7) | ✅/❌ | `from decouple import config, Csv` |
| DJANGO_ENV=production en .env (7/7) | ✅/❌ | Variable de entorno |
| DJANGO_SETTINGS_MODULE apunta a *_prod | ✅/❌ | En .env o systemd |
| .env.example existe (7/7) | ✅/❌ | Documentación de variables |

---

## ENTREGABLES REQUERIDOS

### E1: Resumen Ejecutivo
Generar tabla de scoring con las 15 buenas prácticas:

| # | Buena Práctica | Score | Estado | Acción Prioritaria |
|---|---------------|-------|--------|-------------------|
| 1 | Gestión de Logs | X/10 | 🟢/🟡/🔴 | - |
| 2 | RAM y Workers | X/10 | 🟢/🟡/🔴 | - |
| 3 | Gestión de Disco | X/10 | 🟢/🟡/🔴 | - |
| 4 | Actualizaciones | X/10 | 🟢/🟡/🔴 | - |
| 5 | Límites por Proyecto | X/10 | 🟢/🟡/🔴 | - |
| 6 | Monitoreo y Alertas | X/10 | 🟢/🟡/🔴 | - |
| 7 | Backups | X/10 | 🟢/🟡/🔴 | - |
| 8 | Cron Jobs y Huey Tasks | X/10 | 🟢/🟡/🔴 | - |
| 9 | Scripts de Salud | X/10 | 🟢/🟡/🔴 | - |
| 10 | Max-Requests | X/10 | 🟢/🟡/🔴 | - |
| 11 | Silk (Profiling/Queries) | X/10 | 🟢/🟡/🔴 | - |
| 12 | Checklist Periódico | X/10 | 🟢/🟡/🔴 | - |
| 13 | Seguridad | X/10 | 🟢/🟡/🔴 | - |
| 14 | Reportes y Email | X/10 | 🟢/🟡/🔴 | - |
| 15 | Estandarización Proyecto | X/10 | 🟢/🟡/🔴 | - |
| | **PROMEDIO GENERAL** | **X/10** | | |

**Criterios de scoring:**
- 🟢 9-10/10 = Excelente
- 🟡 7-8/10 = Aceptable, mejoras menores
- 🔴 <7/10 = Requiere acción inmediata

### E2: Tabla Comparativa por Proyecto
Generar una tabla que muestre el estado de cada componente estándar por proyecto:

| Componente | candle ⭐ | kore ⭐ | azurita | crushme | projectapp | taptag | tenndalux |
|------------|----------|--------|---------|---------|------------|--------|-----------|
| settings_dev.py | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| settings_prod.py | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| python-decouple | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| DJANGO_ENV=production | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| django-dbbackup | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| Huey + tasks.py | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| scheduled_backup | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| ENABLE_SILK | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| Silk config completa | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| silk_garbage_collection | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| weekly_slow_queries_report | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| silk_reports_cleanup | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| RotatingFileHandler | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| /api/health/ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| Gunicorn service | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| Huey service | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| MemoryMax/CPUQuota | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| max-requests + jitter | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| .env permisos 600 | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |

> **candle_project** y **kore_project** (⭐) son los proyectos de referencia. Los demás deben igualar su configuración.

### E3: Top Acciones Prioritarias
Listar las acciones ordenadas por prioridad (🔴 Crítica > 🟠 Alta > 🟡 Media):

| # | Prioridad | Proyecto(s) | Acción | Componente faltante |
|---|-----------|-------------|--------|---------------------|
| 1 | 🔴/🟠/🟡 | nombre(s) | Descripción | Fase X |

### E4: Proyectos Nuevos Detectados
Si se detectó algún proyecto nuevo en la sección 0, listar aquí con checklist completo de lo que necesita para cumplir el estándar.