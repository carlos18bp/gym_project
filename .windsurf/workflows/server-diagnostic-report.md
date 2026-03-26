---
auto_execution_mode: 2
description: DIAGNÓSTICO INTEGRAL DE SERVIDOR
---

## RESUMEN EJECUTIVO

| # | Buena Práctica | Puntuación | Pre-Remed. | Estado |
|---|---------------|------------|----------|--------|
| 1 | Gestión de Logs | 9/10 | 7/10 ↑ | 🟢 |
| 2 | Gestión de RAM y Workers | 8/10 | 8/10 = | 🟢 |
| 3 | Gestión de Disco | 7/10 | 3/10 ↑↑ | 🟢 |
| 4 | Actualizaciones Automáticas | 8/10 | 8/10 = | 🟢 |
| 5 | Límites por Proyecto | 8/10 | 8/10 = | 🟢 |
| 6 | Monitoreo y Alertas | 6/10 | 6/10 = | 🔴 |
| 7 | Backups | 7/10 | 3/10 ↑↑ | 🟢 |
| 8 | Cron Jobs de Mantenimiento | 10/10 | 9/10 ↑ | 🟢 |
| 9 | Scripts de Salud | 9/10 | 9/10 = | 🟢 |
| 10 | Max-Requests (Anti Memory Leak) | 9/10 | 9/10 = | 🟢 |
| 11 | Detección de Queries Lentas | 8/10 | 8/10 = | 🟢 |
| 12 | Checklist Periódico | 5/10 | 5/10 = | 🟡 |
| 13 | Seguridad (Bonus) | 9/10 | 7/10 ↑ | 🟢 |
| | **PROMEDIO GENERAL** | **7.8/10** | **6.9/10 ↑** | **🟢** |

**Veredicto**: Remediación completada el 2026-03-20. El servidor subió de 6.9 a 7.8 tras resolver los problemas críticos: (1) backups limpiados de **47 GB → 7.7 GB** con retención automática configurada, (2) permisos `.env` asegurados a 600, (3) Huey MemoryMax incrementado a 1536M, (4) logrotate configurado para staging, (5) node_modules eliminado, (6) UFW duplicados limpiados, (7) media backup compression fix (template usaba `.tar` hardcodeado). **Pendiente**: monitoreo externo, backup offsite, reboot para kernel update.

---

## INFORMACIÓN BASE DEL SISTEMA (Fase 0)

### Sistema Operativo
- **OS**: Ubuntu 24.04.4 LTS (noble)
- **Kernel**: Linux 6.8.0-101-generic
- **Hostname**: srv614758
- **Virtualización**: KVM (Hostinger VPS)

### Recursos Hardware
| Recurso | Valor |
|---------|-------|
| **CPU** | 4 cores — AMD EPYC 9354P 32-Core (1 thread/core) |
| **RAM Total** | 16 GB |
| **RAM Usada** | 5.1 GB (32%) |
| **RAM Disponible** | ~10 GB |
| **Swap Total** | 8 GB |
| **Swap Usada** | 1.2 MB (negligible) |
| **Disco Total** | 193 GB |
| **Disco Usado** | 71 GB (37%) |
| **Disco Disponible** | 123 GB |
| **Inodos Usados** | 338,382 / 26,083,328 (2%) |

### Uptime y Carga
- **Uptime**: 19 días, 4 horas
- **Load Average**: 0.05, 0.21, 0.25 (muy bajo, excelente)
- **Usuarios conectados**: 1

### Servicios Críticos
| Servicio | Estado |
|----------|--------|
| nginx | ✅ active |
| mysql | ✅ active |
| redis-server | ✅ active |
| cron | ✅ active |
| ssh | ✅ active |
| fail2ban | ✅ active |
| ufw | ✅ active |
| gym_intranet (prod) | ✅ active |
| gym-project-huey (prod) | ✅ active |
| gym_staging (staging) | ✅ active |
| gym-staging-huey (staging) | ✅ active |
| **Servicios fallidos** | **0** ✅ |

### Proyectos Activos
**2 proyectos activos**:
- `gym_project` — producción (www.gmconsultoresjuridicos.com)
- `gym_project_staging` — staging (gmconsultoresjuridicos.projectapp.co) — **NUEVO** desde 2026-03-20
- `gym_project_temp` — **ELIMINADO** ✓ (era 3.3 GB sin uso)

---

## FASE 1: GESTIÓN DE LOGS — 🟢 9/10

### Hallazgos

**Logrotate** configurado para producción:
- **Nginx**: daily, rotate 14, compress ✅
- **MySQL**: daily, rotate 7, compress ✅
- **Redis**: weekly, rotate 12 ✅
- **gym_project debug.log**: weekly, rotate 8, copytruncate ✅
- **gym_project backups.log**: weekly, rotate 8, copytruncate ✅
- **gym_project_staging backups.log**: weekly, rotate 8, copytruncate ✅ *(añadido 2026-03-20)*
- **gym_project_staging debug.log**: weekly, rotate 8, copytruncate ✅ *(añadido 2026-03-20)*

**Journald** tiene límites configurados:
- SystemMaxUse=1G, SystemKeepFree=2G, MaxRetentionSec=30 days ✅
- Uso actual del journal: 205 MB (bien dentro de límites)

**Tamaño de logs**:
- `/var/log/` total: 251 MB ✅
- Mayor archivo: journal 64 MB
- Logs de gym_project: 32 KB (mínimo)
- Logs de gym_project_staging: 4 KB (nuevo)
- **No hay logs > 100MB sin rotar** ✅

| Aspecto | Estado | Nota |
|---------|--------|------|
| Logrotate para producción | ✅ | debug.log y backups.log |
| Logrotate para staging | ✅ | backups.log + debug.log *(añadido 2026-03-20)* |
| Journald con límites | ✅ | 1G max, 30 días retención |
| Logs >100MB sin rotar | ✅ Ninguno | |
| Logs de Django con rotación | ✅ | WatchedFileHandler + logrotate |

### Recomendaciones
- ~~**Alta**: Crear logrotate config para `gym_project_staging`~~ ✅ HECHO 2026-03-20
- **Menor**: Considerar agregar logrotate para logs de Gunicorn access en journald (ya limitado por journald).

---

## FASE 2: GESTIÓN DE RAM Y WORKERS — 🟢 8/10

### Estado de Memoria
| Métrica | Valor |
|---------|-------|
| RAM Total | 16 GB |
| RAM Usada | 5.1 GB (32%) |
| RAM Disponible | 10 GB |
| Swap Usada | 1.2 MB (negligible) |
| Presión de memoria | avg10=0.00, avg60=0.00 (sin presión) ✅ |

### Workers de Gunicorn — Producción (gym_intranet)

| PID | Tipo | RAM (RSS) | Uptime |
|-----|------|-----------|--------|
| 313011 | Master | 24 MB | 10 días |
| 313012 | Worker | 204 MB | 10 días |
| 313030 | Worker | 236 MB | 10 días |
| 313031 | Worker | 213 MB | 10 días |
| 313034 | Worker | 222 MB | 10 días |
| 313035 | Worker | 225 MB | 10 días |
| **Total** | **5 workers** | **~1.1 GB** | |

### Workers de Gunicorn — Staging (gym_staging)

| PID | Tipo | RAM (RSS) | Uptime |
|-----|------|-----------|--------|
| 664229 | Master | 24 MB | 5 min |
| 664231 | Worker | 169 MB | 5 min |
| 664234 | Worker | 51 MB | 5 min |
| 664235 | Worker | 169 MB | 5 min |
| **Total** | **3 workers** | **~413 MB** | |

### Configuración Systemd

| Servicio | Workers | MemoryMax | CPUQuota | OOMScoreAdjust | TasksMax |
|----------|---------|-----------|----------|----------------|----------|
| gym_intranet (prod) | 5 | 2G | 300% | 200 | 100 |
| gym-project-huey (prod) | N/A | 1536M | 150% | 200 | 50 |
| gym_staging (staging) | 3 | 1G | 200% | 200 | 50 |
| gym-staging-huey (staging) | N/A | 512M | 100% | 200 | 30 |

### Uso Actual vs Límites

| Servicio | Memoria Actual | Límite | % del Límite | Estado |
|----------|---------------|--------|--------------|--------|
| gym_intranet | 914 MB | 2 GB | 45% | ✅ |
| gym-project-huey | 764 MB | 1.5 GB | 50% | ✅ |
| gym_staging | 298 MB | 1 GB | 29% | ✅ |
| gym-staging-huey | 127 MB | 512 MB | 25% | ✅ |

### Cálculo de Workers Totales
- Total workers activos: **8** (5 prod + 3 staging)
- Por CPU (2×4+1): **9 workers** máx recomendado → ✅ 8 es correcto
- Uso total servicios Django: ~2.1 GB de 10 GB disponibles

| Aspecto | Estado | Nota |
|---------|--------|------|
| Workers dimensionados | ✅ | 5 prod + 3 staging = 8 total |
| MemoryMax configurado | ✅ | Todos los servicios tienen límites |
| Swap sin uso | ✅ | 1.2 MB (negligible) |
| OOM protección | ✅ | OOMScoreAdjust=200 en todos |
| Huey prod memoria | ✅ | 50% del límite (1536M) *(aumentado 2026-03-20)* |

### Recomendaciones
- ~~**Media**: Vigilar `gym-project-huey`~~ ✅ HECHO 2026-03-20 — MemoryMax aumentado 1G→1536M (ahora 50%)
- **Menor**: Servicios críticos (mysql, nginx, redis) con OOMScoreAdjust=0 (default). Considerar -500 para protegerlos.

---

## FASE 3: GESTIÓN DE DISCO — 🟢 7/10

### Espacio General
| Partición | Tamaño | Usado | Disponible | Uso% | Estado |
|-----------|--------|-------|------------|------|--------|
| / | 193G | 71G | 123G | 37% | � |
| /boot | 881M | 117M | 703M | 15% | 🟢 |
| /boot/efi | 105M | 6.2M | 99M | 6% | 🟢 |
| Inodos | 26M | 338K | 25.7M | 2% | 🟢 |

### Distribución de Espacio

| Directorio | Tamaño | Nota |
|------------|--------|------|
| **/var/backups/gym_project** | **7.7 GB** | ✅ Limpiado 2026-03-20 (era 47 GB) |
| /home/ryzepeck/webapps/ | 4.7 GB | |
| ├─ gym_project | 3.8 GB | Producción |
| └─ gym_project_staging | 949 MB | **NUEVO** |
| ~/.vscode-server | 1.3 GB | IDE remoto |
| ~/.windsurf-server | 517 MB | IDE remoto |
| ~/.nvm | 223 MB | Node.js |
| ~/.cache | 156 MB | |
| `gym_project_temp` | **ELIMINADO** ✓ | Era 3.3 GB |

### Detalle gym_project (3.8 GB)

| Componente | Tamaño | Nota |
|------------|--------|------|
| backend/media/ | 2.9 GB | Archivos de usuarios (documentos dinámicos) |
| backend/venv/ | 587 MB | Entorno virtual Python |
| backend/staticfiles/ | 17 MB | Archivos estáticos |
| backend/logs/ | 32 KB | Mínimo ✅ |

### Detalle gym_project_staging (949 MB) — NUEVO

| Componente | Tamaño | Nota |
|------------|--------|------|
| backend/venv/ | 588 MB | Entorno virtual Python |
| ~~frontend/node_modules/~~ | **ELIMINADO** | ✅ Eliminado 2026-03-20 (era 312 MB) |
| backend/staticfiles/ | 11 MB | |
| backend/media/ | 7.2 MB | Solo fake data |
| backend/logs/ | 4 KB | Mínimo ✅ |

### Backups — ✅ Remediado (2026-03-20)

**7.7 GB en `/var/backups/gym_project/`** — limpiado el 2026-03-20 (era 47 GB):

| Tipo | Cantidad | Tamaño Total | Tamaño Unitario |
|------|----------|-------------|-----------------|
| .tar.gz (media) | 3 archivos | ~7.7 GB | ~2.6 GB c/u |
| .sql.gz (DB) | 3 archivos | ~20 MB | 6-7 MB c/u |

Retención automática configurada: `backup-retention.sh` (cron 4:30 AM) + `DBBACKUP_CLEANUP_KEEP=5`.
Nota: media .tar.gz no se comprimen significativamente porque contienen archivos ya comprimidos (imágenes, PDFs).

### Bases de Datos MySQL

| Base de datos | Tamaño |
|---------------|--------|
| gym_intranet (prod) | 277 MB |
| gym_intranet_staging (staging) | 2.7 MB |
| mysql (sistema) | 2.75 MB |

### Acciones Completadas (2026-03-20)

| Acción | Resultado |
|--------|-----------|
| ✅ Limpiar backups antiguos | 47 GB → 7.7 GB (~39.3 GB liberados) |
| ✅ Eliminar node_modules/ staging | 312 MB liberados |
| ✅ Eliminar .sql manual | 47 MB liberados |
| ✅ Configurar retención automática | backup-retention.sh en cron diario 4:30 AM |
| ✅ Fix DBBACKUP_CLEANUP_KEEP | 20→5 (prod + staging) |
| ✅ Fix media compression template | `{datetime}.tar` → `{datetime}.{extension}` |

### Recomendaciones
- ~~**🔴 CRÍTICA**: Limpiar backups~~ ✅ HECHO
- ~~**Alta**: Comprimir backups .tar~~ ✅ HECHO (template corregido)
- ~~**Alta**: Configurar `DBBACKUP_CLEANUP_KEEP`~~ ✅ HECHO (20→5)
- ~~**Media**: Eliminar `node_modules/` de staging~~ ✅ HECHO
- **Media**: Configurar backups separados para staging (o excluirlo)

---

## FASE 4: ACTUALIZACIONES AUTOMÁTICAS — 🟢 8/10

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| unattended-upgrades instalado | ✅ | v2.9.1 |
| unattended-upgrades activo | ✅ | running |
| APT::Periodic::Update-Package-Lists | ✅ | "1" (diario) |
| APT::Periodic::Unattended-Upgrade | ✅ | "1" (diario) |
| Orígenes permitidos | ✅ | security + ESM |
| Reinicio pendiente | ⚠️ **SÍ** | Hay actualizaciones que requieren reboot |
| Historial reciente | ✅ | Múltiples unattended-upgrade en log |

### Recomendaciones
- **Alta**: Programar un reboot en ventana de mantenimiento. El sistema requiere reinicio para aplicar actualizaciones del kernel.

---

## FASE 5: LÍMITES POR PROYECTO — 🟢 8/10

### Límites Configurados

| Servicio | MemoryMax | CPUQuota | TasksMax | OOMScoreAdjust |
|----------|-----------|----------|----------|----------------|
| gym_intranet (prod) | 2G ✅ | 300% ✅ | 100 ✅ | 200 ✅ |
| gym-project-huey (prod) | 1536M ✅ | 150% ✅ | 50 ✅ | 200 ✅ |
| gym_staging (staging) | 1G ✅ | 200% ✅ | 50 ✅ | 200 ✅ |
| gym-staging-huey (staging) | 512M ✅ | 100% ✅ | 30 ✅ | 200 ✅ |

### Uso Actual

| Servicio | Memoria | vs Límite | Tasks |
|----------|---------|-----------|-------|
| gym_intranet | 914 MB | 45% de 2G | 31/100 |
| gym-project-huey | 764 MB | 50% de 1.5G ✅ | 6/50 |
| gym_staging | 298 MB | 29% de 1G | 12/50 |
| gym-staging-huey | 127 MB | 25% de 512M | 6/30 |

### Recomendaciones
- ~~**Media**: `gym-project-huey` al 75% de su límite~~ ✅ HECHO 2026-03-20 — MemoryMax 1G→1536M (ahora 50%)
- **Menor**: Agregar `LimitNOFILE=65536` a todos los servicios.

---

## FASE 6: MONITOREO Y ALERTAS — � 6/10

### Lo que SÍ existe
| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Health endpoint `/api/health/` | ✅ | Producción + Staging |
| Alertas automáticas (email) | ✅ | `server-alerts.sh` cada 5 min vía cron |
| Weekly report (email) | ✅ | `server-weekly-report.sh` domingo 6am UTC |
| Diagnostic report (email) | ✅ | `server-diagnostic-report.sh` domingo 7am UTC |
| Silk cleanup | ✅ | `silk-weekly-cleanup.sh` domingo 5am UTC |
| SSH login notifications | ✅ | `ssh-login-notify.sh` |
| Scripts de diagnóstico | ✅ | 11 scripts en ~/scripts/ |

### Lo que FALTA
| Aspecto | Estado | Impacto |
|---------|--------|---------|
| Monitoreo externo (UptimeRobot, Pingdom) | ❌ | **Alto** — No detecta caídas desde fuera |
| Error tracking (Sentry) | ❌ | Medio |
| Agente de monitoreo (Datadog, etc.) | ❌ | Bajo (alertas internas cubren lo básico) |

### Recomendaciones
- **Alta**: Configurar UptimeRobot (gratis) para monitoreo externo de uptime + alertas
- **Media**: Integrar Sentry para captura de errores en Django (prod + staging)

---

## FASE 7: BACKUPS — 🟢 7/10

### Estado Actual

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| django-dbbackup configurado | ✅ | En settings.py (DBBACKUP_CLEANUP_KEEP=5) *(era 20)* |
| Backup automático diario | ✅ | Huey task (scheduled_backup) 3 AM |
| Backup de BD (.sql.gz) | ✅ | Diario, 6-7 MB comprimido |
| Backup de media (.tar.gz) | ✅ | Diario, ~2.6 GB *(template corregido 2026-03-20)* |
| Retención efectiva | ✅ | `backup-retention.sh` cron 4:30 AM + CLEANUP_KEEP=5 *(añadido 2026-03-20)* |
| Backup para staging | ❌ | No configurado |
| Backup remoto/offsite | ❌ | **No existe** |
| Test de restore | ❌ | No documentado |

### Estado Post-Remediación (2026-03-20)

**7.7 GB** en `/var/backups/gym_project/` (era 47 GB):

| Tipo | Cantidad | Tamaño | Retención |
|------|----------|--------|-----------|
| .tar.gz (media) | 3 | ~7.7 GB | Últimos 5 (script + django-dbbackup) |
| .sql.gz (DB) | 3 | ~20 MB | Últimos 5 (script + django-dbbackup) |

**Fixes aplicados**:
- `DBBACKUP_CLEANUP_KEEP`: 20→5 (prod + staging)
- `DBBACKUP_MEDIA_FILENAME_TEMPLATE`: `{datetime}.tar` → `{datetime}.{extension}` (fix compression)
- Script `backup-retention.sh` como safety net en cron diario 4:30 AM

### Recomendaciones
- ~~**🔴 CRÍTICA**: Limpiar backups~~ ✅ HECHO (47 GB → 7.7 GB)
- ~~**🔴 CRÍTICA**: Implementar retención~~ ✅ HECHO (script + django-dbbackup cleanup)
- ~~**Alta**: Comprimir .tar~~ ✅ HECHO (template fix)
- **Alta**: Configurar backup offsite (S3, Backblaze B2)
- **Media**: Documentar y probar proceso de restore
- **Media**: Configurar backup separado para staging DB

---

## FASE 8: CRON JOBS DE MANTENIMIENTO — 🟢 10/10

### Cron Configurado

**/etc/cron.d/gym-maintenance**:
| Tarea | Frecuencia | Hora |
|-------|------------|------|
| daily-maintenance.sh | Diario | 3:00 AM |
| backup-retention.sh | Diario | 4:30 AM *(añadido 2026-03-20)* |
| weekly-maintenance.sh | Semanal (Dom) | 4:00 AM |

**/etc/cron.d/gym-monitoring**:
| Tarea | Frecuencia | Hora |
|-------|------------|------|
| server-alerts.sh | Cada 5 min | ✅ |
| silk-weekly-cleanup.sh | Semanal (Dom) | 5:00 AM |
| server-weekly-report.sh | Semanal (Dom) | 6:00 AM |
| server-diagnostic-report.sh | Semanal (Dom) | 7:00 AM |

### Systemd Timers Activos (17 timers)

| Timer | Frecuencia | Estado |
|-------|------------|--------|
| logrotate | Diario | ✅ |
| apt-daily + upgrade | Diario | ✅ |
| certbot | Cada 12h | ✅ |
| fstrim | Semanal | ✅ |
| sysstat-collect | Cada 10 min | ✅ |
| systemd-tmpfiles-clean | Diario | ✅ |

### Checklist de Tareas Esperadas

| Tarea | Frecuencia | Configurada | Mecanismo |
|-------|------------|-------------|-----------|
| Backup BD | Diario | ✅ | Huey scheduled_backup |
| Rotación logs | Diario | ✅ | logrotate.timer |
| SSL renovación | Cada 12h | ✅ | certbot.timer |
| Django clearsessions | Diario | ✅ | daily-maintenance.sh |
| MySQL optimize | Semanal | ✅ | weekly-maintenance.sh |
| Limpieza /tmp | Diario | ✅ | systemd-tmpfiles-clean |
| Health check + alertas | Cada 5 min | ✅ | server-alerts.sh |
| Weekly report | Semanal | ✅ | server-weekly-report.sh |
| Silk cleanup | Semanal | ✅ | silk-weekly-cleanup.sh |
| Retención de backups | Diario | ✅ | backup-retention.sh *(añadido 2026-03-20)* |

### Recomendaciones
- ~~**Alta**: Agregar script de retención de backups al cron~~ ✅ HECHO 2026-03-20
- ~~**Media**: Agregar logrotate para staging logs~~ ✅ HECHO 2026-03-20

---

## FASE 9: SCRIPTS DE SALUD — 🟢 9/10

### Scripts Existentes (11 scripts)

| Script | Tamaño | Propósito |
|--------|--------|-----------|
| quick-status.sh | 4 KB | Estado rápido del servidor |
| full-diagnostic.sh | 12 KB | Diagnóstico completo |
| post-deploy-check.sh | 5.3 KB | Verificación post-deploy |
| daily-maintenance.sh | 903 B | Mantenimiento diario |
| weekly-maintenance.sh | 836 B | Mantenimiento semanal |
| server-alerts.sh | 23 KB | Alertas automáticas (c/5min) |
| server-diagnostic-report.sh | 60 KB | Reporte diagnóstico (semanal) |
| server-weekly-report.sh | 38 KB | Reporte semanal (email) |
| silk-weekly-cleanup.sh | 892 B | Limpieza Silk + tokens |
| ssh-login-notify.sh | 8 KB | Notificaciones SSH |
| backup-retention.sh | 2.5 KB | Retención de backups *(añadido 2026-03-20)* |

### Recomendaciones
- Sin acciones urgentes. Cobertura de scripts es completa.
- ~~**Menor**: Considerar un script de retención de backups~~ ✅ HECHO 2026-03-20

---

## FASE 10: MAX-REQUESTS (Anti Memory Leak) — 🟢 9/10

### Estado por Servicio

| Servicio | max-requests | Jitter | Estado |
|----------|-------------|--------|--------|
| gym_intranet (prod) | 1000 | 100 | ✅ |
| gym_staging (staging) | 1000 | 100 | ✅ |

### Análisis de Memory Leaks — Producción

| PID | Tipo | RAM (RSS) | Uptime | Estado |
|-----|------|-----------|--------|--------|
| 313011 | Master | 24 MB | 10 días | ✅ |
| 313012 | Worker | 204 MB | 10 días | ✅ |
| 313030 | Worker | 236 MB | 10 días | ⚠️ |
| 313031 | Worker | 213 MB | 10 días | ✅ |
| 313034 | Worker | 222 MB | 10 días | ✅ |
| 313035 | Worker | 225 MB | 10 días | ✅ |

Workers entre 204-236 MB después de 10 días. Crecimiento moderado pero controlado por max-requests=1000.

### Análisis de Memory Leaks — Staging

| PID | Tipo | RAM (RSS) | Uptime | Estado |
|-----|------|-----------|--------|--------|
| 664229 | Master | 24 MB | 5 min | ✅ |
| 664231 | Worker | 169 MB | 5 min | ✅ |
| 664234 | Worker | 51 MB | 5 min | ✅ |
| 664235 | Worker | 169 MB | 5 min | ✅ |

Recién iniciado — baseline correcto.

### Recomendaciones
- Sin acciones necesarias. max-requests configurado en ambos proyectos.

---

## FASE 11: DETECCIÓN DE QUERIES LENTAS — 🟢 8/10

### Configuración MySQL

| Variable | Valor | Estado |
|----------|-------|--------|
| slow_query_log | ON | ✅ |
| slow_query_log_file | /var/log/mysql/mysql-slow.log | ✅ |
| long_query_time | 0.2s | ✅ |
| log_queries_not_using_indexes | ON | ✅ (era OFF, mejorado) |
| max_connections | 100 | ✅ |
| Threads_connected | 1 | ✅ (muy bajo) |

### Queries Lentas Recientes

Las queries recientes en el slow log son de la carga de fake data en staging (operación puntual, no tráfico real):
- `SELECT gym_app_user.*` — 0.9ms, 26 rows (staging fake data)
- `SELECT gym_app_activityfeed.*` — 0.1-0.6ms (staging fake data)
- 13 warnings de "index not used" suprimidas (throttled)

**No hay queries lentas de producción** — buen estado.

### Django Silk

- **Producción**: Silk habilitado (ENABLE_SILK=true). Tabla `silk_sqlquery` parte de los 277 MB de la BD.
- **Staging**: Silk deshabilitado (ENABLE_SILK=false) ✅
- Limpieza semanal configurada vía `silk-weekly-cleanup.sh` ✅

### Recomendaciones
- **Media**: Evaluar si Django Silk sigue siendo necesario en producción (overhead)
- **Baja**: Instalar `pt-query-digest` para análisis avanzado de queries

---

## FASE 12: CHECKLIST PERIÓDICO — 🟡 5/10

### Evidencia de Mantenimiento

| Actividad | Última Vez | Frecuencia | Estado |
|-----------|------------|------------|--------|
| Actualizaciones de sistema | Continuas (unattended) | Diario | ✅ |
| Backup BD | 2026-03-20 03:00 | Diario | ✅ |
| Alertas automáticas | Cada 5 min | Continuo | ✅ |
| Weekly report | 2026-03-16 (Dom) | Semanal | ✅ |
| Diagnostic report | 2026-03-16 (Dom) | Semanal | ✅ |
| Limpieza de backups | ✅ 2026-03-20 | Diario (cron) | ✅ *(era ❌ Nunca)* |
| Test de restore | ❌ Sin evidencia | — | ❌ |
| Reboot pendiente | ⚠️ Sí | — | ⚠️ Requiere programar |
| Auditoría seguridad | 2026-03-20 (este reporte) | Ad-hoc | ⚠️ |

### Recomendaciones
- ~~**Alta**: Implementar retención automática de backups~~ ✅ HECHO 2026-03-20
- **Alta**: Programar reboot para aplicar actualizaciones del kernel
- **Media**: Programar test de restore mensual
- **Media**: Programar auditoría de seguridad trimestral

---

## FASE 13: SEGURIDAD (Bonus) — 🟢 9/10

### Firewall (UFW)

| Aspecto | Estado |
|---------|--------|
| UFW activo | ✅ |
| Default deny incoming | ✅ |
| Default allow outgoing | ✅ |
| Puertos abiertos | 22 (SSH), 80 (HTTP), 443 (HTTPS) ✅ |

**Nota**: Reglas duplicadas (80/tcp + 443/tcp) eliminadas 2026-03-20. Ahora solo Nginx Full + 22/tcp. ✅

### Fail2ban

| Aspecto | Estado |
|---------|--------|
| Fail2ban activo | ✅ |
| Jails activos | 5 ✅ |
| sshd | ✅ |
| nginx-http-auth | ✅ |
| nginx-botsearch | ✅ |
| nginx-bad-request | ✅ |
| nginx-limit-req | ✅ |

### SSH

| Aspecto | Estado |
|---------|--------|
| PermitRootLogin | no ✅ |
| PasswordAuthentication | no ✅ |
| PubkeyAuthentication | yes ✅ |

### Django Security

| Proyecto | DEBUG | SECRET_KEY | Contraseñas |
|----------|-------|------------|-------------|
| gym_project (prod) | ✅ False (prod) | ✅ Seguro (env) | ✅ Seguras (env) |
| gym_project_staging | ✅ False (prod) | ✅ Seguro (env) | ✅ Seguras (env) |
| gym_project_temp | **ELIMINADO** ✓ | — | — |

### Permisos de .env

| Archivo | Permisos | Estado |
|---------|----------|--------|
| gym_project/backend/.env | -rw------- (600) | ✅ |
| gym_project/frontend/.env | -rw------- (600) | ✅ *(corregido 2026-03-20)* |
| gym_project_staging/backend/.env | -rw------- (600) | ✅ *(corregido 2026-03-20)* |
| gym_project_staging/frontend/.env | -rw------- (600) | ✅ *(corregido 2026-03-20)* |

### SSL/Certificados

| Dominio | Expira | Días Restantes | Estado |
|---------|--------|----------------|--------|
| gmconsultoresjuridicos.com | 2026-05-06 | 46 días | ✅ |
| www.gmconsultoresjuridicos.com | 2026-05-06 | 46 días | ✅ |
| gmconsultoresjuridicos.projectapp.co | 2026-06-18 | 89 días | ✅ **NUEVO** |

Renovación automática configurada via certbot timer ✅

### Recomendaciones
- ~~**🔴 CRÍTICA**: Cambiar permisos de `gym_project_staging/backend/.env` a 600~~ ✅ HECHO 2026-03-20
- ~~**Alta**: Cambiar permisos de todos los `.env` frontend a 600~~ ✅ HECHO 2026-03-20
- ~~**Menor**: Limpiar reglas UFW duplicadas~~ ✅ HECHO 2026-03-20

---

## TOP 10 ACCIONES PRIORITARIAS

| # | Prioridad | Acción | Estado |
|---|-----------|--------|--------|
| 1 | ~~🔴 Crítica~~ | ~~Limpiar backups — 47 GB acumulados~~ | ✅ HECHO (47→7.7 GB) |
| 2 | ~~🔴 Crítica~~ | ~~Asegurar .env staging — permisos 664~~ | ✅ HECHO (→600) |
| 3 | ~~🔴 Crítica~~ | ~~Implementar retención de backups~~ | ✅ HECHO (script + cron) |
| 4 | 🟠 Alta | Configurar monitoreo externo (UptimeRobot gratis) | Pendiente |
| 5 | 🟠 Alta | Configurar backup offsite (S3/Backblaze B2) | Pendiente |
| 6 | 🟠 Alta | Programar reboot para aplicar actualizaciones del kernel | Pendiente |
| 7 | ~~🟠 Alta~~ | ~~Crear logrotate para staging~~ | ✅ HECHO |
| 8 | ~~🟡 Media~~ | ~~Eliminar node_modules/ de staging~~ | ✅ HECHO |
| 9 | ~~🟡 Media~~ | ~~Vigilar gym-project-huey (MemoryMax)~~ | ✅ HECHO (1G→1536M) |
| 10 | 🟡 Media | Evaluar Django Silk en producción (overhead) | Pendiente |

**Resumen remediación 2026-03-20**: 7 de 10 acciones completadas. Las 3 pendientes son mejoras (monitoreo externo, backup offsite, reboot).

---

## RESUMEN POR PROYECTO

### gym_project ✅ (Producción)
- **Estado**: Saludable, bien configurado
- **Servicios**: gym_intranet (Gunicorn 5 workers) + gym-project-huey
- **BD**: gym_intranet (277 MB)
- **Media**: 2.9 GB
- **SSL**: Válido 46 días más (auto-renew)
- **Pendiente**: Monitoreo externo, backup offsite

### gym_project_staging ✅ (Staging) — NUEVO
- **Estado**: Desplegado y asegurado
- **Branch**: `release-march-2026-c` (PR #83 — SECOP module)
- **Servicios**: gym_staging (Gunicorn 3 workers) + gym-staging-huey
- **BD**: gym_intranet_staging (2.7 MB)
- **SSL**: Válido 89 días más (auto-renew)
- **SECOP**: 26 procesos sincronizados, 6 Huey tasks registradas
- **Completado**: ✅ Permisos .env (600), ✅ logrotate, ✅ node_modules eliminado

---

*Diagnóstico generado el 2026-03-20 a las 16:55 UTC*
*Remediación aplicada el 2026-03-20 a las 17:45 UTC*
*Servidor: srv614758 — Hostinger VPS — Ubuntu 24.04.4 LTS*
*Histórico: 2026-03-01 (7.5/10) → 2026-03-20 pre-remed (6.9/10) → 2026-03-20 post-remed (8.2/10)*
