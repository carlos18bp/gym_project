# Alertas Visuales y Emails en Archivos Juridicos v3

Sistema completo de alertas para el modulo Archivos Juridicos: alertas visuales (pulse en SlideBar y documentos), redireccion automatica a firmas pendientes, emails por eventos de firma, email diario recordatorio, y notificaciones in-app para cada evento de firma.

## Decisiones Confirmadas

- **Pulse en SlideBar**: Desaparece para el resto de la sesion una vez que el usuario hace click
- **Auto-redirect a tab firmas**: Solo la primera vez que entra despues del login (no en visitas posteriores)
- **Pulse en documentos**: TODOS los documentos pendientes pulsan (no solo los nuevos)
- **Emails por evento**: Cada evento de firma genera email al destinatario correspondiente
- **Email recordatorio**: Diario a las 9:00 AM para firmas pendientes
- **Notificaciones in-app**: Cada evento de firma crea notificacion via `notification_service` (del Notification Center)

## Eventos de Firma — Emails y Notificaciones In-App

| Evento | In-App a | Email a | Category |
|---|---|---|---|
| Firma solicitada | Firmantes | Creator (resumen doc/firmantes) | signature_requested |
| Alguien firmo (progreso) | Todos los firmantes | Todos los firmantes (existente) | signature_progress |
| Documento completamente firmado | Creator + firmantes | Todos (existente) | signature_completed |
| Documento rechazado | Creator | Creator (existente) | signature_rejected |
| Documento expirado | Creator | Creator (existente) | signature_expired |
| Firmas reabiertas | Todos los firmantes | (no hay email aun) | signature_reopened |
| Recordatorio diario 9AM | — | Firmantes con pendientes | pending_signature_reminder |

## Estado Actual del Sistema

- **SlideBar**: "Archivos Juridicos" navega a `/dynamic_document_dashboard` sin query params (linea 506-517)
- **Dashboard.vue**: Ya soporta query params `?tab=pending-signatures` y `?lawyerTab=pending-signatures` via watcher inmediato (linea 982)
- **Defaults**: `activeTab = 'folders'` (client), `activeLawyerTab = 'legal-documents'` (lawyer) (linea 592-593)
- **SignaturesListTable.vue**: Tabla con `<tr>` por documento, props: state, searchQuery, selectedTags (linea 622-636)
- **Backend**: `GET /api/dynamic-documents/pending-signatures/` existe pero NO hay endpoint de conteo rapido
- **Emails existentes**: Algunos emails de firma ya existen en signature_views.py (sign/reject) pero NO hay recordatorios periodicos ni email al creator al solicitar firma
- **No hay** notificaciones in-app para ningun evento

## Implementacion

### Fase 1: Backend — Endpoint de conteo

**Nuevo endpoint** en `signature_views.py`:
- `GET /api/dynamic-documents/pending-signatures-count/` → `{ "count": N }`
- Query: DocumentSignature(signer=user, signed=False, rejected=False, document__state='PendingSignatures')
- Ligero, sin serializacion

### Fase 2: Backend — Hook Points para notificaciones in-app + emails

Usa `notification_service` del plan Notification Center para crear notificaciones in-app. Complementa con emails donde aplique.

**Hook Points** (donde se invoca `notification_service.create_notification` + envio de email):
1. `serializers/dynamic_document.py` create() y update() — signature_requested + email resumen al creator
2. `views/dynamic_documents/signature_views.py` sign_document() — signature_progress + signature_completed
3. `views/dynamic_documents/signature_views.py` reject_document() — signature_rejected
4. `views/dynamic_documents/signature_views.py` expire_overdue_documents() — signature_expired
5. `views/dynamic_documents/signature_views.py` reopen_document_signatures() — signature_reopened

**Nuevo**: `send_signature_creation_email(creator, document, signers)` — email resumen al creator cuando se crea documento para firma (titulo, condiciones, lista de firmantes).

### Fase 3: Frontend — Composable + Session State

**Nuevo `composables/usePendingSignatures.js`**:
- State: `pendingCount`, `hasVisitedDocuments` (sessionStorage flag)
- `fetchPendingCount()`: llama al endpoint
- `markAsVisited()`: setea sessionStorage flag + detiene pulse
- Session flag se limpia automaticamente al cerrar navegador/tab
- Tambien se limpia en `auth.js` logout() para que re-login en misma tab reactive el pulse

### Fase 4: Frontend — Pulse en SlideBar

**Modificar `SlideBar.vue`**:
- Importar composable usePendingSignatures
- En `onMounted` (despues de userStore.init): llamar `fetchPendingCount()`
- Si count > 0 Y !hasVisitedDocuments: agregar clase CSS pulse al nav item "Archivos Juridicos"
- Modificar accion del nav item: si count > 0, navegar con `?tab=pending-signatures` (client) o `?lawyerTab=pending-signatures` (lawyer) + llamar `markAsVisited()`
- Pulse desaparece al hacer click (session-scoped via sessionStorage)

### Fase 5: Frontend — Auto-redirect tab (solo primer ingreso)

**Modificar `Dashboard.vue`**:
- Importar composable
- En `onMounted`: si pendingCount > 0 Y !hasVisitedDocuments Y no hay query param explicito:
  - Auto-select tab pending-signatures segun rol
  - Llamar `markAsVisited()`
- Si hay query param, respetar (comportamiento actual preservado)

### Fase 6: Frontend — Pulse en TODOS los documentos pendientes

**Modificar `SignaturesListTable.vue`**:
- Nuevo prop `pulseAll` (Boolean, default false)
- Si `pulseAll === true` Y `state === 'PendingSignatures'`: todas las filas `<tr>` reciben clase `animate-pulse-row`
- El efecto se remueve despues de 8 segundos (setTimeout en onMounted)
- CSS: animacion custom con borde-left coloreado + shadow pulsante suave

**Modificar `Dashboard.vue`**:
- Pasar `:pulseAll="shouldPulseDocuments"` a SignaturesListTable
- `shouldPulseDocuments`: true si es la primera visita post-login (basado en composable)

### Fase 7: Backend — Email diario 9AM (Celery Beat)

**Nueva tarea**: `tasks/signature_reminder_tasks.py`
- `send_pending_signature_reminders`: crontab(hour=9, minute=0)
- Busca DocumentSignature(signed=False, rejected=False, document__state='PendingSignatures')
- Agrupa por signer, excluye documentos creados hace < 24h
- Email resumen por firmante: lista de documentos pendientes con titulos
- Usa EmailMessage existente
- Tambien crea notificacion in-app con category='pending_signature_reminder' via notification_service

**Registrar en `celery.py`**: agregar a beat_schedule

## Archivos Nuevos (~3)
1. `frontend/src/composables/usePendingSignatures.js`
2. `backend/gym_app/tasks/signature_reminder_tasks.py`
3. CSS animacion (inline en SignaturesListTable o tailwind.config)

## Archivos Modificados (~9)
1. `backend/gym_app/views/dynamic_documents/signature_views.py` — endpoint count + hooks notificacion en sign/reject/reopen/expire
2. `backend/gym_app/serializers/dynamic_document.py` — hook signature_requested + email creator en create/update
3. `backend/gym_app/urls.py` — ruta pending-signatures-count
4. `backend/gym_project/celery.py` — beat schedule email diario
5. `frontend/src/components/layouts/SlideBar.vue` — pulse + nav redirect
6. `frontend/src/views/dynamic_document/Dashboard.vue` — auto-tab + pulseAll prop
7. `frontend/src/components/dynamic_document/common/SignaturesListTable.vue` — pulseAll + animacion
8. `frontend/src/stores/auth/auth.js` — sessionStorage.removeItem en logout()

## Dependencias con Otros Planes

| Plan | Relacion |
|---|---|
| **Notification Center** | REQUIERE modelo Notification + `notification_service` para crear notificaciones in-app. Notification Center debe implementarse primero (al menos modelo + servicio). |
| **Guided Tour** | El tour del modulo Archivos Juridicos complementa estas alertas guiando al usuario a los tabs relevantes. |

## Orden de Implementacion
1. _(Prerequisito: Notification Center fases 1-3 — modelo + servicio)_
2. Backend: endpoint pending-signatures-count + URL
3. Backend: hooks notificacion in-app en signature_views + serializer + email creator
4. Frontend: composable usePendingSignatures
5. Frontend: SlideBar pulse + nav redirect
6. Frontend: Dashboard auto-tab + pulseAll
7. Frontend: SignaturesListTable pulseAll + CSS
8. Backend: Celery task email diario + notificacion in-app
9. Tests