---
auto_execution_mode: 2
description: DIAGNÓSTICO INTEGRAL DE SERVIDOR
---

## RESUMEN EJECUTIVO

| # | Buena Práctica | Puntuación | Estado |
|---|---------------|------------|--------|
| 1 | Gestión de Logs | 8/10 | 🟢 |
| 2 | Gestión de RAM y Workers | 9/10 | 🟢 |
| 3 | Gestión de Disco | 6/10 | 🟡 |
| 4 | Actualizaciones Automáticas | 10/10 | 🟢 |
| 5 | Límites por Proyecto | 8/10 | 🟢 |
| 6 | Monitoreo y Alertas | 4/10 | 🔴 |
| 7 | Backups | 6/10 | 🟡 |
| 8 | Cron Jobs de Mantenimiento | 8/10 | 🟢 |
| 9 | Scripts de Salud | 9/10 | 🟢 |
| 10 | Max-Requests (Anti Memory Leak) | 9/10 | 🟢 |
| 11 | Detección de Queries Lentas | 7/10 | 🟢 |
| 12 | Checklist Periódico | 5/10 | 🟡 |
| 13 | Seguridad (Bonus) | 9/10 | 🟢 |
| | **PROMEDIO GENERAL** | **7.5/10** | **🟢** |

**Veredicto**: El servidor está en buen estado general. Las áreas críticas (seguridad, RAM, workers, actualizaciones) están bien configuradas. Las mejoras pendientes son principalmente operativas: monitoreo externo, backup offsite, y limpieza del proyecto `gym_project_temp`.

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
| **RAM Usada** | 2.3 GB (14%) |
| **RAM Disponible** | ~13 GB |
| **Swap Total** | 8 GB |
| **Swap Usada** | 0 B |
| **Disco Total** | 193 GB |
| **Disco Usado** | 23 GB (12%) |
| **Disco Disponible** | 170 GB |
| **Inodos Usados** | 293,926 / 26,083,328 (1%) |

### Uptime y Carga
- **Uptime**: 25 minutos (recién reiniciado)
- **Load Average**: 0.40, 0.19, 0.11 (muy bajo, excelente)
- **Usuarios conectados**: 4

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
| **Servicios fallidos** | **0** ✅ |

### Proyectos Activos
Solo **1 proyecto activo**: `gym_project` (www.gmconsultoresjuridicos.com)
- `gym_project_temp` existe (~3.3 GB) pero **no tiene servicios corriendo**.
- **No se encontraron** los proyectos: azurita, candle_project, crushme_project, kore_project, projectapp, rainy_project, taptag, tenndalux_project.

---

## FASE 1: GESTIÓN DE LOGS — 🟢 8/10

### Hallazgos

**Logrotate** está configurado correctamente:
- **Nginx**: daily, rotate 14, compress ✅
- **MySQL**: daily, rotate 7, compress ✅
- **Redis**: weekly, rotate 12 ✅
- **gym_project debug.log**: weekly, rotate 8, copytruncate ✅
- **gym_project backups.log**: weekly, rotate 8, copytruncate ✅

**Journald** tiene límites configurados:
- SystemMaxUse=800M, SystemKeepFree=2G, MaxRetentionSec=21 days ✅
- Uso actual del journal: 73 MB (bien dentro de límites)

**Tamaño de logs**:
- `/var/log/` total: 166 MB ✅
- Mayor archivo: journal 64 MB
- syslog.1: 29 MB
- Logs de gym_project: 8 KB (mínimo)
- **No hay logs > 100MB sin rotar** ✅

| Aspecto | Estado | Nota |
|---------|--------|------|
| Logrotate configurado para gym_project | ✅ | debug.log y backups.log |
| Journald con límites | ✅ | 800M max, 21 días retención |
| Logs >100MB sin rotar | ✅ Ninguno | |
| Logs de Django con rotación | ✅ | WatchedFileHandler + logrotate |

### Recomendaciones
- **Faltante**: No hay logrotate para los otros proyectos listados (no existen aún, no es urgente).
- **Menor**: Considerar agregar logrotate para logs de Gunicorn access en journald (ya limitado por journald).

---

## FASE 2: GESTIÓN DE RAM Y WORKERS — 🟢 9/10

### Estado de Memoria
| Métrica | Valor |
|---------|-------|
| RAM Total | 16 GB |
| RAM Usada | 2.3 GB (14%) |
| RAM Disponible | 13 GB |
| Swap Usada | 0 B |
| Presión de memoria | avg10=0.00, avg60=0.00 (sin presión) ✅ |

### Workers de Gunicorn — gym_project

| PID | Tipo | RAM | Uptime |
|-----|------|-----|--------|
| 3306 | Master | 23.8 MB | 32 min |
| 3307 | Worker | 183.2 MB | 32 min |
| 3309 | Worker | 180.5 MB | 32 min |
| 3310 | Worker | 183.3 MB | 32 min |
| **Total** | | **~570 MB** | |

### Configuración Systemd

| Servicio | Workers | MemoryMax | CPUQuota | OOMScoreAdjust | TasksMax |
|----------|---------|-----------|----------|----------------|----------|
| gym_intranet (Gunicorn) | 3 | 800M | 200% | 200 | 50 |
| gym-project-huey | N/A | 600M | 80% | 200 | No config |

### Uso Actual vs Límites

| Servicio | Memoria Actual | Límite | % del Límite | Estado |
|----------|---------------|--------|--------------|--------|
| gym_intranet | 429.6 MB | 800 MB | 54% | ✅ |
| gym-project-huey | 221.8 MB | 600 MB | 37% | ✅ |

### Cálculo de Workers Recomendados
- Por CPU (2×4+1): **9 workers**
- Por RAM (13727/200): **68 workers**
- **Actual**: 3 workers → ✅ Conservador y correcto para un solo proyecto

| Aspecto | Estado | Nota |
|---------|--------|------|
| Workers dimensionados | ✅ | 3 workers, ~183 MB c/u |
| MemoryMax configurado | ✅ | 800M para Gunicorn, 600M para Huey |
| Swap sin uso | ✅ | 0 B usada |
| OOM protección | ✅ | OOMScoreAdjust=200 en servicios Django |

### Recomendaciones
- **Menor**: Los servicios críticos (mysql, nginx, redis) tienen OOMScoreAdjust=0 (default). Considerar poner OOMScoreAdjust=-500 para protegerlos.
- Con 13 GB libres hay margen amplio para futuros proyectos.

---

## FASE 3: GESTIÓN DE DISCO — 🟡 6/10

### Espacio General
| Partición | Tamaño | Usado | Disponible | Uso% | Estado |
|-----------|--------|-------|------------|------|--------|
| / | 193G | 23G | 170G | 12% | 🟢 |
| /boot | 881M | 117M | 703M | 15% | 🟢 |
| /boot/efi | 105M | 6.2M | 99M | 6% | 🟢 |
| Inodos | 26M | 294K | 25.8M | 2% | 🟢 |

### Distribución de Espacio

| Directorio | Tamaño | Nota |
|------------|--------|------|
| /home/ryzepeck/webapps/ | 6.4 GB | |
| ├─ gym_project | 3.1 GB | Proyecto activo |
| └─ gym_project_temp | 3.3 GB | ⚠️ **Sin usar, candidato a eliminar** |
| /var (total) | 3.2 GB | |
| ├─ /var/backups/gym_project | 2.3 GB | ⚠️ Backup tar de 2.2 GB |
| /usr | 3.1 GB | |
| ~/.vscode-server | 1.3 GB | IDE remoto |
| ~/.windsurf-server | 398 MB | IDE remoto |
| ~/.nvm | 223 MB | Node.js |

### Detalle gym_project (3.1 GB)

| Componente | Tamaño | Nota |
|------------|--------|------|
| backend/media/ | 2.5 GB | Archivos de usuarios (documentos dinámicos) |
| backend/venv/ | 587 MB | Entorno virtual Python |
| backend/staticfiles/ | 17 MB | Archivos estáticos |
| backend/static/ | 6.7 MB | |
| backend/logs/ | 8 KB | Mínimo ✅ |

### Detalle gym_project_temp (3.3 GB) ⚠️

| Componente | Tamaño | Nota |
|------------|--------|------|
| backend/media/ | 2.5 GB | Duplicado de media |
| backend/venv/ | 579 MB | Entorno virtual innecesario |
| frontend/node_modules/ | 265 MB | ❌ No debería existir en producción |
| backend/static/ | 11 MB | |

### Archivos Grandes en /var

| Archivo | Tamaño | Nota |
|---------|--------|------|
| /var/backups/gym_project/2026-03-01-030037.tar | 2.2 GB | Backup diario (media incluido) |
| silk_sqlquery.ibd (MySQL) | 68 MB | Tabla de Django Silk |

### Candidatos a Limpieza

| Categoría | Tamaño | Acción Sugerida |
|-----------|--------|-----------------|
| **gym_project_temp/** | **3.3 GB** | **Eliminar si no se necesita** |
| frontend/node_modules/ (temp) | 265 MB | Eliminar |
| Backup tar 2.2 GB | 2.2 GB | Evaluar retención/compresión |
| silk_sqlquery (MySQL) | 68 MB | Considerar limpiar datos de profiling |
| Logs .gz >30 días | 44 archivos | Limpiar |
| Cache de pip | 4.2 MB | Mínimo |
| Cache de apt | 48 KB | Ya limpio |

### Recomendaciones
- **Alta prioridad**: Eliminar `gym_project_temp` (~3.3 GB liberados)
- **Media**: Comprimir el backup tar con gzip (2.2 GB → ~200-400 MB estimado)
- **Media**: Limpiar tabla `silk_sqlquery` si no se necesita el historial de profiling
- **Baja**: Limpiar logs .gz >30 días en /var/log

---

## FASE 4: ACTUALIZACIONES AUTOMÁTICAS — 🟢 10/10

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| unattended-upgrades instalado | ✅ | v2.9.1 |
| unattended-upgrades activo | ✅ | running |
| APT::Periodic::Update-Package-Lists | ✅ | "1" (diario) |
| APT::Periodic::Unattended-Upgrade | ✅ | "1" (diario) |
| Orígenes permitidos | ✅ | security + ESM |
| Reinicio pendiente | ✅ No | Recién reiniciado |
| Historial reciente | ✅ | Múltiples unattended-upgrade en log |

**Sin recomendaciones** — Configuración excelente.

---

## FASE 5: LÍMITES POR PROYECTO — 🟢 8/10

### Límites Configurados

| Servicio | MemoryMax | CPUQuota | TasksMax | LimitNOFILE | OOMScoreAdjust |
|----------|-----------|----------|----------|-------------|----------------|
| gym_intranet | 800M ✅ | 200% ✅ | 50 ✅ | ⚠️ No config | 200 ✅ |
| gym-project-huey | 600M ✅ | 80% ✅ | ⚠️ No config | ⚠️ No config | 200 ✅ |

### Uso Actual

| Servicio | Memoria | vs Límite | Tasks | CPU |
|----------|---------|-----------|-------|-----|
| gym_intranet | 429.6 MB | 54% de 800M | 13/50 | 8.6s |
| gym-project-huey | 221.8 MB | 37% de 600M | 6/default | 7.4s |

### Recomendaciones
- **Menor**: Agregar `TasksMax=20` a huey service
- **Menor**: Agregar `LimitNOFILE=65536` a ambos servicios

---

## FASE 6: MONITOREO Y ALERTAS — 🔴 4/10

### Lo que SÍ existe
| Aspecto | Estado |
|---------|--------|
| Health endpoint `/api/health/` | ✅ gym_project |
| Scripts de diagnóstico | ✅ full-diagnostic.sh, quick-status.sh, post-deploy-check.sh |
| Health check view | ✅ `gym_app/views/health.py` |

### Lo que FALTA
| Aspecto | Estado | Impacto |
|---------|--------|---------|
| Monitoreo externo (UptimeRobot, Pingdom) | ❌ | **Alto** — Nadie avisa si el sitio cae |
| Alertas por email/Slack | ❌ | **Alto** — No hay notificaciones automáticas |
| Agente de monitoreo (Datadog, etc.) | ❌ | Medio |
| Error tracking (Sentry) | ❌ | Medio |
| Health check en cron | ❌ | Medio — Scripts existen pero no se ejecutan automáticamente |

### Recomendaciones
- **Crítico**: Configurar UptimeRobot (gratis) para monitoreo de uptime + alertas
- **Alta**: Configurar alertas por email para fallos de servicios (systemd OnFailure=)
- **Media**: Integrar Sentry para captura de errores en Django
- **Media**: Agregar el health check al cron (cada 5 min) con alertas

---

## FASE 7: BACKUPS — 🟡 6/10

### Estado Actual

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| django-dbbackup configurado | ✅ | En settings.py |
| Backup automático diario | ✅ | Cron 3 AM → daily-maintenance.sh |
| Backup de BD | ✅ | SQL dump (47 MB sin comprimir, 2.9 MB gzip) |
| Backup de media | ✅ | Tar 2.2 GB (semanal, domingos 4 AM) |
| Directorio de backups | ✅ | /var/backups/gym_project/ |
| Retención configurada | ⚠️ | Solo 2 backups visibles |
| Backup remoto/offsite | ❌ | **No existe** |
| Test de restore | ❌ | No documentado |

### Backups Encontrados

| Archivo | Tamaño | Fecha |
|---------|--------|-------|
| 2026-02-28-170036.sql | 47 MB | 28 Feb (manual?) |
| 2026-03-01-030029.sql.gz | 2.9 MB | 1 Mar (automático) |
| 2026-03-01-030037.tar | 2.2 GB | 1 Mar (media semanal) |

### Base de Datos

| Base de datos | Tamaño |
|---------------|--------|
| gym_intranet | 88.02 MB |
| mysql | 2.75 MB |

### Recomendaciones
- **Crítico**: Configurar backup offsite (S3, Backblaze B2, o rsync a otro servidor)
- **Alta**: Comprimir backup tar con gzip (2.2 GB → estimado 200-400 MB)
- **Alta**: Configurar retención explícita (ej: mantener últimos 7 diarios + 4 semanales)
- **Media**: Documentar y probar proceso de restore mensualmente
- **Menor**: El .sql sin comprimir de 47 MB parece un backup manual — limpiar si no se necesita

---

## FASE 8: CRON JOBS DE MANTENIMIENTO — 🟢 8/10

### Cron Configurado (/etc/cron.d/gym-maintenance)

| Tarea | Frecuencia | Hora |
|-------|------------|------|
| daily-maintenance.sh | Diario | 3:00 AM |
| weekly-maintenance.sh | Semanal (Dom) | 4:00 AM |

### Systemd Timers Activos

| Timer | Frecuencia | Estado |
|-------|------------|--------|
| logrotate | Diario | ✅ |
| apt-daily | Diario | ✅ |
| apt-daily-upgrade | Diario | ✅ |
| certbot | Cada 12h | ✅ |
| fstrim | Semanal | ✅ |
| sysstat-collect | Cada 10 min | ✅ |
| systemd-tmpfiles-clean | Diario | ✅ |

### Checklist de Tareas Esperadas

| Tarea | Frecuencia | Configurada | Mecanismo |
|-------|------------|-------------|-----------|
| Backup BD | Diario | ✅ | daily-maintenance.sh |
| Rotación logs | Diario | ✅ | logrotate.timer |
| SSL renovación | Cada 12h | ✅ | certbot.timer + cron |
| Django clearsessions | Diario | ✅ | daily-maintenance.sh |
| MySQL optimize | Semanal | ✅ | weekly-maintenance.sh |
| Limpieza /tmp | Diario | ✅ | systemd-tmpfiles-clean |
| Media backup | Semanal | ✅ | weekly-maintenance.sh |
| Health check automático | Periódico | ❌ | No configurado |

### Recomendaciones
- **Media**: Agregar health check automático cada 5 min con notificación
- **Menor**: Considerar limpiar cache de pip periódicamente

---

## FASE 9: SCRIPTS DE SALUD — 🟢 9/10

### Scripts Existentes

| Script | Ubicación | Estado |
|--------|-----------|--------|
| quick-status.sh | ~/scripts/ | ✅ (4 KB) |
| full-diagnostic.sh | ~/scripts/ | ✅ (11.8 KB) |
| post-deploy-check.sh | ~/scripts/ | ✅ (5.3 KB) |
| daily-maintenance.sh | ~/scripts/ | ✅ (965 B) |
| weekly-maintenance.sh | ~/scripts/ | ✅ (898 B) |

### Recomendaciones
- **Menor**: Los scripts de diagnóstico no se ejecutan automáticamente. Considerar integrar `quick-status.sh` en un cron semanal con output a log.

---

## FASE 10: MAX-REQUESTS (Anti Memory Leak) — 🟢 9/10

### Estado por Servicio

| Servicio | max-requests (Config) | max-requests (Runtime) | Jitter | Estado |
|----------|-----------------------|------------------------|--------|--------|
| gym_intranet (Gunicorn) | 1000 | 1000 | 100 | ✅ |
| gym-project-huey | N/A (no es Gunicorn) | N/A | N/A | ✅ |

### Análisis de Memory Leaks

| PID | Tipo | RAM | Uptime | Estado |
|-----|------|-----|--------|--------|
| 3306 | Master | 23 MB | 32 min | ✅ |
| 3307 | Worker | 183 MB | 32 min | ✅ |
| 3309 | Worker | 180 MB | 32 min | ✅ |
| 3310 | Worker | 183 MB | 32 min | ✅ |

**Ningún worker supera 200 MB** — Sin indicios de memory leak.

### Recomendaciones
- Sin acciones necesarias. Configuración correcta.

---

## FASE 11: DETECCIÓN DE QUERIES LENTAS — 🟢 7/10

### Configuración MySQL

| Variable | Valor | Estado |
|----------|-------|--------|
| slow_query_log | ON | ✅ |
| slow_query_log_file | /var/log/mysql/mysql-slow.log | ✅ |
| long_query_time | 0.2s | ✅ |
| log_queries_not_using_indexes | OFF | ⚠️ |

### Queries Lentas Detectadas (desde último reinicio)

| Query | Tiempo | Rows | Nota |
|-------|--------|------|------|
| FLUSH LOGS | 7.36s | 0 | Operación de mantenimiento (normal) |
| SELECT * FROM `silk_sqlquery` | 3.10s | 2,784 | ⚠️ Tabla de Django Silk, 68 MB |
| SELECT * FROM `gym_app_dynamicdocument` | 2.41s | 449 | ⚠️ Backup dump (SQL_NO_CACHE) |

**Nota**: Las queries lentas registradas son del proceso de **backup** (`mysqldump`), no del tráfico normal de la aplicación. Esto es esperado.

### Django Silk

- Django Silk está configurado en gym_project (middleware de profiling)
- La tabla `silk_sqlquery` tiene 68 MB y 2,784 registros
- **Considerar**: ¿Silk está activo en producción? Puede impactar performance.

### Recomendaciones
- **Media**: Activar `log_queries_not_using_indexes` para detectar queries sin índices
- **Media**: Evaluar si Django Silk debería estar activo en producción (overhead)
- **Baja**: Instalar `pt-query-digest` para análisis avanzado de queries
- **Baja**: Limpiar periódicamente datos de Silk si se mantiene activo

---

## FASE 12: CHECKLIST PERIÓDICO — 🟡 5/10

### Evidencia de Mantenimiento

| Actividad | Última Vez | Frecuencia | Estado |
|-----------|------------|------------|--------|
| Actualizaciones de sistema | Continuas (unattended) | Diario | ✅ |
| Reinicio de servicios | 2026-03-01 12:37 | Hoy (reboot) | ✅ |
| Reinicio del servidor | 2026-03-01 12:37 | Hoy | ✅ |
| Backup BD | 2026-03-01 03:00 | Diario | ✅ |
| Verificar espacio disco | ¿? | ¿? | ⚠️ Sin evidencia |
| Revisar logs de error | ¿? | ¿? | ⚠️ Sin evidencia |
| Verificar backups | ¿? | ¿? | ⚠️ Sin evidencia |
| Test de restore | ¿? | ¿? | ❌ Sin evidencia |
| Auditoría seguridad | ¿? | ¿? | ⚠️ Sin evidencia |

### Recomendaciones
- **Alta**: Crear un checklist semanal documentado y seguirlo
- **Alta**: Automatizar verificaciones que puedan ser automatizadas (espacio, backups, SSL)
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

**Nota**: Hay reglas duplicadas (Nginx Full + 80/tcp + 443/tcp). Cosmético, no afecta seguridad.

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
| gym_project | 🔍 Desde .env | ✅ Seguro (env) | ✅ Seguras (env) |
| gym_project_temp | ⚠️ No verificable | ❌ Hardcodeado | ❌ Hardcodeadas |

### Permisos de .env

| Archivo | Permisos | Estado |
|---------|----------|--------|
| gym_project/backend/.env | -rw------- (600) | ✅ |
| gym_project/frontend/.env | -rw-rw-r-- (664) | ⚠️ Demasiado permisivo |

### SSL/Certificados

| Dominio | Expira | Días Restantes | Estado |
|---------|--------|----------------|--------|
| gmconsultoresjuridicos.com | 2026-05-06 | 65 días | ✅ |
| www.gmconsultoresjuridicos.com | 2026-05-06 | 65 días | ✅ |

Renovación automática configurada via certbot timer + cron ✅

### Recomendaciones
- **Alta**: Eliminar `gym_project_temp` (tiene secretos hardcodeados)
- **Media**: Cambiar permisos de `gym_project/frontend/.env` a 600
- **Menor**: Limpiar reglas UFW duplicadas

---

## TOP 10 ACCIONES PRIORITARIAS

| # | Prioridad | Acción | Impacto | Esfuerzo |
|---|-----------|--------|---------|----------|
| 1 | 🔴 Crítica | Configurar monitoreo externo (UptimeRobot gratis) | Alto | 15 min |
| 2 | 🔴 Crítica | Configurar backup offsite (S3/Backblaze B2) | Alto | 1-2h |
| 3 | 🟠 Alta | Eliminar gym_project_temp (~3.3 GB, secretos hardcodeados) | Medio | 5 min |
| 4 | 🟠 Alta | Comprimir backup tar con gzip | Medio | 15 min |
| 5 | 🟠 Alta | Configurar alertas por email/Slack para fallos | Alto | 30 min |
| 6 | 🟠 Alta | Crear checklist semanal de mantenimiento | Medio | 30 min |
| 7 | 🟡 Media | Evaluar Django Silk en producción (overhead) | Medio | 15 min |
| 8 | 🟡 Media | Cambiar permisos frontend/.env a 600 | Bajo | 1 min |
| 9 | 🟡 Media | Activar log_queries_not_using_indexes en MySQL | Bajo | 5 min |
| 10 | 🟡 Media | Agregar health check automatizado en cron | Medio | 15 min |

---

## RESUMEN POR PROYECTO

### gym_project ✅ (Producción)
- **Estado**: Saludable, bien configurado
- **Servicios**: gym_intranet (Gunicorn 3 workers) + gym-project-huey
- **BD**: gym_intranet (88 MB)
- **Media**: 2.5 GB
- **SSL**: Válido 65 días más
- **Pendiente**: Monitoreo externo, backup offsite

### gym_project_temp ⚠️ (Inactivo)
- **Estado**: Sin servicios, sin uso aparente
- **Riesgo**: Secretos hardcodeados, node_modules en producción
- **Tamaño**: 3.3 GB desperdiciados
- **Recomendación**: **ELIMINAR**

---

*Diagnóstico generado el 2026-03-01 a las 13:20 UTC*
*Servidor: srv614758 — Hostinger VPS — Ubuntu 24.04.4 LTS*
