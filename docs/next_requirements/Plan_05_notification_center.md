# Notification Center (Dashboard de Notificaciones) v4

Centro/dashboard tipo bandeja de correo para visualizar y gestionar todas las notificaciones generadas por otros modulos (Alertas Archivos Juridicos y Alertas Procesos). No genera notificaciones propias — solo las consume, muestra y gestiona.

## Decisiones Confirmadas

- **Campana**: Boton flotante fixed en content area (no en sidebar)
- **Vista**: Ruta propia `/notifications` con SlideBar parent
- **Roles**: Visible para TODOS (lawyer, client, corporate_client, basic)
- **UX modelo email**: leida/no-leida, archivar, eliminar, "recordar despues" (snooze)
- **Click en notificacion**: Navega al recurso referenciado (documento o proceso) + efecto pulse CSS
- **Alcance**: Solo dashboard/inbox — los eventos, emails y hooks los manejan los planes que generan las notificaciones

## Backend

### Modelo Notification (`models/notification.py`)
- user(FK), title, message
- category: ENUM — categorias definidas por los features que generan notificaciones:
  - Desde **Alertas Archivos Juridicos**: signature_requested, signature_progress, signature_completed, signature_rejected, signature_expired, signature_reopened, pending_signature_reminder
  - Desde **Alertas Procesos**: process_alert
  - General: general
- priority: ENUM (low, medium, high)
- status: ENUM (unread, read, archived, snoozed)
- snooze_until: DateTimeField nullable
- related_content_type: CharField (document, process, legal_request)
- related_object_id: IntegerField (ID del documento/proceso referenciado)
- created_at, read_at

### API (`views/notification.py` + serializer + urls)
- GET /api/notifications/ (paginada, filtrable por category y status)
- GET /api/notifications/unread-count/
- PATCH /api/notifications/{id}/ (cambiar status: read, archived, snoozed)
- PATCH /api/notifications/mark-all-read/
- DELETE /api/notifications/{id}/
- POST /api/notifications/{id}/snooze/ (con snooze_until)

### Servicio (`utils/notification_service.py`)
Interfaz publica que usan los otros features para crear notificaciones:
- `create_notification(user, title, message, category, related_content_type, related_object_id, priority)`
- `create_bulk_notifications(users, ...)`

### Celery Beat
- Tarea: `check_snoozed_notifications` (cada 15min, reactiva snoozed → unread)

## Frontend

### Campana flotante (`components/notifications/NotificationBell.vue`)
- Posicion: fixed top-right del content area (dentro de `div.lg:pl-72` en SlideBar.vue)
- BellIcon + badge rojo con unreadCount
- Click navega a /notifications

### Vista (`views/notifications/NotificationsList.vue`)
- Ruta: /notifications (SlideBar parent)
- Tabs: Todas | No leidas | Archivadas
- Cada notificacion: icono por categoria, titulo, mensaje, timestamp, estado visual leida/no-leida
- Acciones: marcar leida, archivar, snooze (1h, 3h, 1dia, 3dias), eliminar
- Click en notificacion → navega al recurso referenciado + marca como leida:
  - category signature_* → `/dynamic_document_dashboard?highlight=<doc_id>`
  - category process_alert → `/process/<id>` (o vista de detalle)

### Efecto Pulsante en recurso referenciado
- Documentos: Al llegar a `/dynamic_document_dashboard?highlight=<doc_id>`, el documento palpita (animacion CSS pulse, 5s o click)
- Procesos: Al llegar a la vista de proceso referenciado, indicador visual similar
- Se implementa en los componentes de lista/tabla existentes de cada modulo

### Store (`stores/notifications/notification.js`)
- State: notifications[], unreadCount, loading, filter
- Actions: fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead, archiveNotification, snoozeNotification, deleteNotification
- Polling: fetchUnreadCount cada 60s

### Router + SlideBar
- Nueva ruta /notifications en index.js
- Nuevo nav item "Notificaciones" en SlideBar navigation[] (visible para todos)
- BellIcon como icono, routes: ['/notifications']

## Impacto Transversal
- Dashboard: widget NotificationSummaryCard con conteo + ultimas 3
- User Guide store: nuevo modulo 'notifications'
- Admin: NotificationAdmin, seccion Notification Management

## Dependencias con Otros Planes

| Plan | Relacion |
|---|---|
| **Alertas Archivos Juridicos** | Genera notificaciones con categories signature_* y pending_signature_reminder via `notification_service` |
| **Alertas Procesos** | Genera notificaciones con category process_alert via `notification_service` |

**Orden de implementacion**: Este plan debe implementarse PRIMERO (modelo + servicio), ya que los otros dos planes dependen del modelo Notification y del notification_service para crear notificaciones in-app.

## Archivos Nuevos (~7)
1. `backend/gym_app/models/notification.py`
2. `backend/gym_app/serializers/notification.py`
3. `backend/gym_app/views/notification.py`
4. `backend/gym_app/utils/notification_service.py`
5. `backend/gym_app/tasks/notification_tasks.py` (Celery snooze)
6. `frontend/src/components/notifications/NotificationBell.vue`
7. `frontend/src/views/notifications/NotificationsList.vue`
8. `frontend/src/stores/notifications/notification.js`
9. `frontend/src/components/dashboard/NotificationSummaryCard.vue`

## Archivos Modificados (~6)
1. `backend/gym_app/models/__init__.py` — import Notification
2. `backend/gym_app/urls.py` — notification endpoints
3. `backend/gym_app/admin.py` — NotificationAdmin
4. `backend/gym_project/celery.py` — beat schedule snooze task
5. `frontend/src/router/index.js` — ruta /notifications
6. `frontend/src/components/layouts/SlideBar.vue` — campana flotante + nav item
7. `frontend/src/stores/user_guide.js` — modulo notifications
8. `frontend/src/views/dashboard/dashboard.vue` — NotificationSummaryCard

## Orden de Implementacion
1. Backend: Modelo Notification + migracion + admin
2. Backend: Serializer + API views + URLs
3. Backend: notification_service.py (interfaz publica)
4. Backend: Celery task snooze
5. Frontend: Store notifications
6. Frontend: NotificationBell + SlideBar integration
7. Frontend: NotificationsList view + router
8. Frontend: Efecto pulse en dashboard documentos + procesos
9. Frontend: NotificationSummaryCard en dashboard
10. Tests