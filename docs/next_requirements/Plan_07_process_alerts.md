# Alertas y Notificaciones en Procesos v3

Sistema de alertas automaticas por estado procesal: notificacion fija 1 dia y 3 dias antes de la fecha del ultimo estado procesal, con descripcion personalizable por el abogado, enviada por email y notificacion in-app al abogado y al cliente.

## Decisiones Confirmadas

- **Dias de recordatorio**: Fijos, siempre 1 dia y 3 dias antes (NO configurables)
- **Creacion automatica**: StageAlert se crea automaticamente para TODO proceso nuevo y para todo nuevo estado procesal
- **Ultimo estado**: Ultimo elemento del array formData.stages (el mas reciente)
- **Personalizable**: Solo la descripcion de la alerta (el abogado puede editarla)
- **Destinatarios**: Abogado + todos los clientes del proceso
- **Canales**: Email + notificacion in-app (alineado con Notification Center plan)

## Estado Actual del Sistema

- **Stage model** (`models/process.py:50-70`): `status` (CharField), `date` (DateField nullable), `created_at`
- **Process model** (`models/process.py:72-118`): `stages` ManyToMany(Stage), `clients` ManyToMany(User), `lawyer` FK(User)
- **update_process** (`views/process.py:231-255`): REEMPLAZA todos los stages (clear + recreate)
- **create_process** (`views/process.py:108-133`): Crea stages y los asocia al proceso
- **ProcessForm.vue** (`views/process/ProcessForm.vue:402-558`): Tabla de etapas procesales con status + date + botones agregar/eliminar
- **formData.stages**: Array de `{ status, date }` — NO tiene campo de alerta actualmente
- **No existe** ningun modelo de alerta ni tarea Celery para procesos

## Implementacion

### Fase 1: Backend — Modelo StageAlert

**Nuevo modelo** en `models/process.py`:
```
StageAlert:
  - stage: OneToOneField(Stage, related_name='alert')
  - description: TextField (descripcion personalizada por el abogado, default auto-generado)
  - is_active: BooleanField default=True
  - notified_3_days: BooleanField default=False (ya se envio recordatorio 3 dias antes)
  - notified_1_day: BooleanField default=False (ya se envio recordatorio 1 dia antes)
  - created_at: DateTimeField auto_now_add
```

Nota: `reminder_days` eliminado — los dias son fijos [1, 3], controlados en la tarea Celery.

**Logica de "ultimo estado"**: No se modela como restriccion de BD. La logica esta en el frontend (solo muestra config de alerta para el ultimo stage) y en el backend (la tarea Celery solo procesa alertas del ultimo stage de cada proceso).

### Fase 2: Backend — Serializer + API

**Modificar `StageSerializer`**: Incluir `alert` nested (StageAlertSerializer)
- StageAlertSerializer: fields = [id, description, is_active]

**Modificar `create_process`**: Al crear CADA stage, crear StageAlert automaticamente con descripcion auto-generada.

**Modificar `update_process`**: Al reemplazar stages (clear + recreate), crear StageAlert para CADA nuevo stage. Si el frontend envia descripcion custom para el ultimo stage, usarla.

### Fase 3: Frontend — UI de Alerta en ProcessForm

**Modificar `ProcessForm.vue`**:
- Debajo del ultimo stage en la tabla, mostrar seccion de configuracion de alerta
- Campos: descripcion (textarea), toggle activar/desactivar
- Dias de recordatorio mostrados como informacion (no editables): "1 dia antes" y "3 dias antes"
- Solo visible para el ULTIMO stage del array
- En `formData.stages`, el ultimo elemento tendra campo adicional `alert: { description, is_active }`

### Fase 4: Backend — Tarea Celery para envio de alertas

**Nueva tarea**: `tasks/process_alert_tasks.py`
- `send_process_stage_alerts`: crontab(hour=9, minute=0) — misma hora que signature reminders
- Logica:
  1. Buscar todos los procesos activos (ultimo stage != "Fallo")
  2. Para cada proceso, obtener el ULTIMO stage (ultimo en M2M por pk, = ultimo en array frontend)
  3. Si stage.date existe y (stage.date - hoy) == 3 dias Y !notified_3_days → enviar + marcar
  4. Si stage.date existe y (stage.date - hoy) == 1 dia Y !notified_1_day → enviar + marcar
  5. Enviar email a: process.lawyer + process.clients.all()
  6. Crear notificacion in-app (usa notification_service del Notification Center) con category='process_alert'
- Email incluye: nombre del proceso (ref, subcase), estado procesal, fecha, descripcion de la alerta

**Registrar en `celery.py`**: agregar a beat_schedule

### Fase 5: Frontend — Visualizacion en ProcessDetail

**Modificar `ProcessDetail.vue`**:
- Si el ultimo stage tiene alerta, mostrar indicador visual (icono campana + texto)
- En ProcessHistoryModal: mostrar alerta junto al ultimo stage

## Archivos Nuevos (~3)
1. `backend/gym_app/models/stage_alert.py` (o agregar a process.py)
2. `backend/gym_app/serializers/stage_alert.py`
3. `backend/gym_app/tasks/process_alert_tasks.py`

## Archivos Modificados (~8)
1. `backend/gym_app/models/__init__.py` — import StageAlert
2. `backend/gym_app/models/process.py` — StageAlert model (si se agrega aqui)
3. `backend/gym_app/serializers/process.py` — StageSerializer con alert nested
4. `backend/gym_app/views/process.py` — create/update hooks para StageAlert
5. `backend/gym_app/urls.py` — (si se necesita endpoint standalone)
6. `backend/gym_project/celery.py` — beat schedule
7. `frontend/src/views/process/ProcessForm.vue` — UI de alerta en ultimo stage
8. `frontend/src/views/process/ProcessDetail.vue` — visualizacion de alerta

## Dependencias con Otros Planes

| Plan | Relacion |
|---|---|
| **Notification Center** | REQUIERE modelo Notification + `notification_service` para crear notificaciones in-app con category='process_alert'. Notification Center debe implementarse primero (al menos modelo + servicio). |
| **Alertas Archivos Juridicos** | Independientes. Comparten el mismo notification_service y modelo Notification, pero no tienen dependencia directa entre si. Ambos registran tareas Celery a las 9AM. |

## Edge Cases Considerados

- **Stage sin fecha**: No se dispara alerta (fecha es requerida para calcular dias)
- **Update que reemplaza stages**: `process.stages.clear()` solo remueve la relacion M2M, NO borra los Stage objects. Con StageAlert (OneToOne), los stages viejos quedan huerfanos. **Solucion**: cambiar `clear()` por `process.stages.all().delete()` para borrar los Stage objects (cascade borra StageAlerts). Esto es un safe refactor — el comportamiento actual ya no usa stages viejos.
- **Proceso archivado (ultimo stage = "Fallo")**: No enviar alertas — verificado en frontend store (`processesWithClosedStatus` usa `stages[stages.length - 1].status === 'Fallo'`)
- **Multiples clientes**: Un email/notificacion por destinatario
- **Ultimo stage**: Confirmado = `stages[stages.length - 1]` tanto en frontend store como en backend (ultimo Stage.pk en M2M)

## Orden de Implementacion
1. _(Prerequisito: Notification Center fases 1-3 — modelo + servicio)_
2. Backend: Modelo StageAlert + migracion
3. Backend: StageAlertSerializer + modificar StageSerializer
4. Backend: Hooks en create_process/update_process
5. Frontend: UI alerta en ProcessForm.vue (ultimo stage)
6. Frontend: Visualizacion en ProcessDetail.vue
7. Backend: Celery task process_alert_tasks (usa notification_service)
8. Tests