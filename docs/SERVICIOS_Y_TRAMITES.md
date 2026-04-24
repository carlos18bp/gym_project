# Servicios y Trámites

## Resumen

Se implementó un módulo completo para publicar servicios jurídicos y gestionar solicitudes de trámites con trazabilidad de extremo a extremo:

- Catálogo de servicios (lista completa y destacados en dashboard)
- Formularios dinámicos por etapas/fases
- Guardado parcial (borrador)
- Radicado automático en formato `AÑO-CONSECUTIVO`
- Generación automática de PDF resumen por solicitud
- Notificaciones por correo al solicitante y equipo jurídico
- Gestión de estados por abogado/administrador
- Seguimiento por cliente en "Mis Solicitudes"

## Flujo por Rol

### Cliente / Usuario final

1. Ve servicios destacados en dashboard y todos en `/services`.
2. Abre un servicio y diligencia formulario por fases (`/services/:id`).
3. Puede guardar borrador y retomar.
4. Al enviar, recibe radicado y puede descargar PDF.
5. Consulta estado y respuestas en `/service_requests/my` y `/service_requests/:id`.

### Abogado

1. Recibe solicitudes en `/service_requests/inbox`.
2. Filtra por estado, servicio, fecha, radicado o solicitante.
3. Abre detalle y actualiza estado/mensaje/adjunto.
4. El solicitante recibe notificación de actualización.

### Administrador

1. Gestiona catálogo en `/services_admin`.
2. Crea/edita servicio, etapas y campos del formulario.
3. Activa/desactiva servicios y marca destacados.
4. También puede gestionar la bandeja de solicitudes.

## Estados del Trámite

- `OPEN` (Abierto)
- `IN_STUDY` (En Estudio)
- `IN_PROGRESS` (En Trámite)
- `ANSWERED` (Contestado)
- `FINALIZED` (Finalizado)

## Backend (Django)

### Modelos principales

- `Service`
- `ServiceStage`
- `ServiceField`
- `ServiceRequest`
- `ServiceRequestSequence`
- `ServiceRequestAnswer`
- `ServiceRequestFieldFile`
- `ServiceRequestLawyerResponse`
- `ServiceRequestLawyerResponseFile`

### API endpoints

- Catálogo:
  - `GET /api/services/`
  - `GET /api/services/featured/`
  - `GET /api/services/<service_id>/`
- Administración (admin):
  - `GET /api/services/admin/list/`
  - `POST /api/services/admin/create/`
  - `PUT /api/services/admin/<service_id>/update/`
  - `POST /api/services/admin/<service_id>/toggle-active/`
  - `POST /api/services/admin/<service_id>/toggle-featured/`
- Solicitudes:
  - `POST /api/service-requests/save/` (guardar/enviar)
  - `GET /api/service-requests/service/<service_id>/draft/`
  - `GET /api/service-requests/my/`
  - `GET /api/service-requests/inbox/`
  - `GET /api/service-requests/<request_id>/`
  - `POST /api/service-requests/<request_id>/manage/`
- Descargas:
  - `GET /api/service-requests/<request_id>/document/download/`
  - `GET /api/service-requests/<request_id>/field-files/<file_id>/download/`
  - `GET /api/service-requests/<request_id>/responses/<response_id>/files/<file_id>/download/`

### Migrations

- `0057_servicefield_servicerequestsequence_alter_user_role_and_more.py`
- `0058_seed_registro_marcario_service.py`

La migración `0058` crea el servicio inicial **Registro Marcario** con 4 fases.

## Frontend (Vue 3)

### Store

- `src/stores/services_tramites.js`

### Vistas

- `src/views/services/ServicesList.vue`
- `src/views/services/ServiceDetail.vue`
- `src/views/services/MyServiceRequests.vue`
- `src/views/services/ServiceRequestsInbox.vue`
- `src/views/services/ServiceRequestDetail.vue`
- `src/views/services/ServicesAdmin.vue`

### Integraciones transversales

- Dashboard: `FeaturedServicesGrid.vue`
- Sidebar: nuevos accesos a Servicios, Mis Solicitudes, Bandeja, Administrar
- Router: rutas y guardas por rol para inbox/admin

## Caso semilla: Registro Marcario

Se dejó parametrizado como plantilla inicial:

- Fase 1: Datos del Solicitante
- Fase 2: Información de la Marca
- Fase 3: Documentos (.jpg, .png, .pdf)
- Fase 4: Confirmación

## Validación ejecutada

- Backend:
  - `venv/bin/python -m pytest gym_app/tests/views/test_service_tramite_views.py -q`
  - Resultado: `6 passed`
- Frontend:
  - `npm run build`
  - Resultado: compilación exitosa
