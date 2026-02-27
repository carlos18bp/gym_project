# Plan: Reasignación de Datos de Abogado y Módulo de Administración

Implementar un módulo de administración que permita a usuarios con permiso especial (`is_manager`) reasignar procesos y documentos dinámicos de un abogado a otro, con opción de archivar al abogado origen.

---

## Resumen de Requerimientos

1. **Reasignación selectiva**: Transferir procesos y/o documentos dinámicos de un abogado (origen) a otro (destino), seleccionando individualmente o en bloque.
2. **Archivado de abogado**: No eliminar al abogado; en su lugar, marcarlo como archivado (`is_archived`).
3. **Nuevo permiso `is_manager`**: Campo booleano en `User` que habilita acceso al módulo de administración.
4. **Documentos excluidos**: No se transfieren documentos en estados `PendingSignatures`, `FullySigned`, o `Rejected`.
5. **`created_by` NO cambia**: Solo se reasigna el campo `lawyer` (procesos) y `managed_by` (documentos). El `created_by` del documento permanece intacto.

---

## Fase 1 — Backend: Modelo y Migración

### 1.1 Nuevos campos en `User` (`backend/gym_app/models/user.py`)
- Agregar `is_archived = models.BooleanField(default=False)` — para marcar abogados archivados.
- Agregar `is_manager = models.BooleanField(default=False)` — permiso para acceder al módulo de reasignación.

### 1.2 Nuevo campo `managed_by` en `DynamicDocument` (`backend/gym_app/models/dynamic_document.py`)
- Agregar `managed_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="managed_documents", on_delete=models.SET_NULL, null=True, blank=True)`.
- Migración de datos: `UPDATE gym_app_dynamicdocument SET managed_by_id = created_by_id WHERE created_by_id IS NOT NULL`.

### 1.3 Cambio de `on_delete` en `Process.lawyer`  (`backend/gym_app/models/process.py`)
- **Crítico**: Cambiar `Process.lawyer` de `on_delete=models.CASCADE` a `on_delete=models.PROTECT`.
- Esto **previene** la eliminación accidental de un abogado que tenga procesos asociados.
- Impacto: Este es un cambio de comportamiento de seguridad necesario y explícitamente solicitado por el requerimiento.

### 1.4 Generar migración Django
- `python manage.py makemigrations` + `python manage.py migrate`

---

## Fase 2 — Backend: Endpoint de Reasignación

### 2.1 Nuevo archivo de vistas: `backend/gym_app/views/reassignment.py`

**Endpoint 1: `GET /api/reassignment/preview/`**
- Parámetro: `source_user_id`
- Devuelve:
  - Lista de procesos del abogado origen (todos).
  - Lista de documentos dinámicos transferibles (`created_by=source_user` y estados NO en `PendingSignatures`, `FullySigned`, `Rejected`).
- Permiso: Solo usuarios con `is_manager=True`.

**Endpoint 2: `POST /api/reassignment/execute/`**
- Payload:
  ```json
  {
    "source_user_id": 5,
    "target_user_id": 8,
    "process_ids": [1, 3, 7],         // o "all" para todos
    "document_ids": [10, 15, 22],      // o "all" para todos los transferibles
    "archive_source": true             // opcional: archivar al abogado origen
  }
  ```
- Lógica (en transacción atómica):
  1. Validar que `source` y `target` son abogados activos (target no archivado).
  2. Validar que los IDs de procesos pertenecen al `source_user`.
  3. Validar que los IDs de documentos son elegibles (estados permitidos, `created_by=source`).
  4. `Process.objects.filter(id__in=process_ids).update(lawyer=target_user)`
  5. Para documentos: `DynamicDocument.objects.filter(id__in=document_ids).update(managed_by=target_user)`. **`created_by` NO se toca** — auditoría preservada.
  6. Si `archive_source=true`: `source_user.is_archived = True; source_user.save()`
  7. Registrar actividad en `ActivityFeed` para ambos usuarios.
- Respuesta: Resumen de lo transferido (conteos).
- Permiso: Solo `is_manager=True`.

**Endpoint 3: `GET /api/reassignment/lawyers/`**
- Devuelve lista de abogados activos (no archivados) para los dropdowns de origen y destino.
- Permiso: Solo `is_manager=True`.

### 2.2 Serializers: `backend/gym_app/serializers/reassignment.py`
- `ReassignmentPreviewSerializer` — Para la respuesta del preview.
- `ReassignmentExecuteSerializer` — Para validar el payload de ejecución.
- `LawyerListSerializer` — Para la lista de abogados (id, nombre, email, conteos).

### 2.3 URLs: Agregar a `backend/gym_app/urls.py`
```python
reassignment_urls = [
    path('reassignment/lawyers/', reassignment.list_lawyers, name='reassignment-lawyers'),
    path('reassignment/preview/', reassignment.preview_reassignment, name='reassignment-preview'),
    path('reassignment/execute/', reassignment.execute_reassignment, name='reassignment-execute'),
]
```

---

## Fase 3 — Backend: Filtrar usuarios archivados

### 3.1 Vista `user_list` (`backend/gym_app/views/user.py`)
- Agregar filtro para excluir usuarios archivados de las listas generales: `User.objects.filter(is_archived=False)`.

### 3.2 Vista `process_list` (`backend/gym_app/views/process.py`)
- Sin cambios — ya filtra por `lawyer=user` o por rol.

### 3.3 Serializer `UserSerializer`
- Incluir `is_archived` y `is_manager` en los campos serializados.

---

## Fase 4 — Backend: Tests

### 4.1 Archivo: `backend/gym_app/tests/views/test_reassignment.py`
Tests clave (comportamiento observable):
- **Permiso**: Usuario sin `is_manager` recibe `403` en todos los endpoints.
- **Preview**: Retorna procesos del abogado origen y documentos elegibles (excluye `PendingSignatures`, `FullySigned`, `Rejected`).
- **Ejecución exitosa**: `Process.lawyer` cambia al target, conteos correctos.
- **Documentos excluidos**: Documentos en estados prohibidos no se transfieren.
- **`created_by` intacto**: Verificar que `created_by` no cambia tras la transferencia.
- **Archivado**: `source_user.is_archived=True` después de ejecutar con `archive_source=true`.
- **Validaciones**: Source/target iguales → error, target archivado → error, IDs inválidos → error.
- **Atomicidad**: Si algo falla, ningún cambio persiste.

---

## Fase 5 — Frontend: Store y Ruta

### 5.1 Nuevo store: `frontend/src/stores/reassignment.js`
- `fetchLawyers()` → `GET /api/reassignment/lawyers/`
- `fetchPreview(sourceUserId)` → `GET /api/reassignment/preview/?source_user_id=X`
- `executeReassignment(payload)` → `POST /api/reassignment/execute/`

### 5.2 Nueva ruta en `frontend/src/router/index.js`
```javascript
{
  path: "/admin/reassignment",
  component: SlideBar,
  children: [{
    path: "",
    name: "admin_reassignment",
    component: () => import("@/views/admin/Reassignment.vue"),
    meta: { requiresAuth: true, requiresManager: true, title: "Reasignación de Datos" },
  }],
},
```

### 5.3 Guard del router
- Agregar verificación de `requiresManager` en el `beforeEach` guard (similar a `requiresLawyer`).

---

## Fase 6 — Frontend: Vista del Módulo

### 6.1 Nuevo componente: `frontend/src/views/admin/Reassignment.vue`

**Layout del formulario:**
1. **Paso 1 — Selección**: Dos dropdowns:
   - Abogado origen (solo abogados activos con data).
   - Abogado destino (abogados activos, excluyendo al origen).
2. **Paso 2 — Preview**: Al seleccionar origen, se carga el preview con:
   - Tabla de procesos (checkbox por cada uno + "Seleccionar todos").
   - Tabla de documentos elegibles (checkbox por cada uno + "Seleccionar todos").
   - Indicador de documentos NO elegibles (PendingSignatures, FullySigned, Rejected) como información.
3. **Paso 3 — Confirmación**: Botón "Reasignar" con modal de confirmación que muestra resumen (X procesos, Y documentos → abogado destino).
4. **Opción "Archivar abogado origen"**: Checkbox adicional.
5. **Resultado**: Mensaje de éxito con conteos.

### 6.2 Sidebar: Agregar entrada en `SlideBar.vue`
- Nueva entrada "Administración" visible solo si `currentUser.is_manager === true`.
- Icono: `CogIcon` o `WrenchScrewdriverIcon` de Heroicons.

---

## Fase 7 — Frontend: Tests

### 7.1 Store test: `frontend/src/stores/__tests__/reassignment.spec.js`
- Mock de HTTP requests, verificar estado del store.

### 7.2 E2E (Playwright): `frontend/e2e/reassignment.spec.js`
- Flujo completo: login como manager → seleccionar origen/destino → preview → ejecutar → verificar resultado.

---

## Decisión: Nuevo campo `managed_by` en DynamicDocument (Opción A ✅)

Se creará un nuevo campo `managed_by` en `DynamicDocument`:
- `managed_by = models.ForeignKey(User, related_name="managed_documents", on_delete=models.SET_NULL, null=True, blank=True)`
- **Migración de datos**: Inicializar `managed_by = created_by` para todos los documentos existentes.
- **Reasignación**: Al transferir documentos, solo se cambia `managed_by` al abogado destino. `created_by` permanece intacto (auditoría preservada).
- **Impacto en frontend**: El filtro "Mis documentos" debe considerar `managed_by` además de `created_by` para el abogado actual.

---

## Fase 8 — Actualización de Módulos Transversales

### 8.1 Dashboard — `QuickActionButtons.vue`
- Agregar botón **"Reasignar Datos"** visible solo si `user?.is_manager === true`.

### 8.2 Manual de Usuario — `stores/user_guide.js`
- Nuevo módulo `reassignment` en `initializeGuideContent()` con secciones: selección de abogados, preview, ejecución, archivado, restricciones.
- Nueva entrada en `getModulesForRole` con `roles: ['lawyer']`.

### 8.3 Django Admin — `admin.py`
- Agregar `is_archived`, `is_manager` a `fieldsets`, `list_display`, `list_filter` de `UserAdmin`.
- Agregar `managed_by` a la admin de `DynamicDocument`.

### 8.4 Filtro de Documentos Backend — `document_views.py`
- Cambiar filtro `lawyer_id` de `created_by_id` a `Q(created_by_id=lid) | Q(managed_by_id=lid)` para que "Mis Documentos" incluya reasignados.

### 8.5 Getter Frontend — `getters.js`
- `getDocumentsByLawyerId` debe considerar `managed_by` además de `created_by` para incluir documentos reasignados.

### 8.6 Vista `user_list` Backend — `views/user.py`
- Filtrar usuarios archivados: `User.objects.filter(is_archived=False)` en listas generales (o agregar parámetro `?include_archived=true`).

### 8.7 Directorio Frontend
- El directorio de abogados (SlideBar filter) ya filtra por rol. Verificar que usuarios archivados no aparezcan en dropdowns de asignación (proceso form, documento form).

### 8.8 Serializer `UserSerializer`
- Incluir `is_archived` e `is_manager` en campos serializados para que el frontend pueda condicionar la UI.

### 8.9 Selector de Abogado en `ProcessForm.vue`
- **Archivo**: `frontend/src/views/process/ProcessForm.vue`
- Agregar un **Combobox** de selección de abogado (estilo similar al Combobox de clientes existente).
- **Default**: El abogado logueado (`authStore.userAuth`) preseleccionado.
- **Datos**: Usar getter `lawyers` del `userStore` (nuevo getter que filtra `user.role === 'lawyer' && !user.is_archived`).
- **Ubicación en UI**: En la segunda fila del formulario, después de "Email de Autoridad" o como un nuevo campo en la primera fila.
- **Lógica de submit**: `formData.lawyerId = selectedLawyer.value?.id` en lugar de forzar `authStore.userAuth?.id`.
- **Edit mode**: `assignProcessToFormData` ya carga `process.lawyer.id` → preseleccionar ese abogado.
- **Backend**: `update_process` ya soporta `lawyerId` en el payload, no requiere cambios.
- **Nuevo getter en `userStore`**: `lawyers: (state) => state.users.filter(u => u.role === 'lawyer' && !u.is_archived)`

### 8.10 `DynamicDocumentSerializer` — agregar `managed_by`
- **Archivo**: `backend/gym_app/serializers/dynamic_document.py`
- Agregar `managed_by` a `Meta.fields` de `DynamicDocumentSerializer`.

---

## Double-Check: Notas de Revisión

### Inconsistencia corregida
- Línea 13 decía `assigned_to` → corregido a `managed_by` (coherente con Opción A).

### CASCADEs con User (riesgo si se elimina un usuario)
Estos modelos tienen `on_delete=CASCADE` hacia `User`:
- `DocumentSignature.signer`, `DocumentVisibilityPermission.user`, `DocumentUsabilityPermission.user`
- `RecentDocument.user`, `RecentProcess.user`, `ActivityFeed.user`
- `DocumentRelationship.created_by`, `DocumentFolder.owner`, `UserSignature.user`
- `LegalRequest.user`, `LegalRequestResponse.user`, `Subscription.user`

**Decisión**: No se cambian. `PROTECT` solo en `Process.lawyer` es suficiente. El flujo solo archiva, nunca elimina.

### `ProcessForm.vue` — agregar selector de abogado ✅
El formulario siempre asigna `lawyerId = authStore.userAuth?.id`. Se debe agregar un **Combobox de abogado** (similar al de clientes) con el abogado logueado preseleccionado. Ver Fase 8.9.

### Permisos de documentos — todos los abogados ven todo ✅
`get_user_permission_level()` otorga nivel `'lawyer'` a cualquier usuario con `role == 'lawyer'`. El campo `managed_by` solo afecta el filtro **"Mis Documentos"** (backend: `created_by_id=lawyer_id`, frontend: `getDocumentsByLawyerId`), NO los permisos de visibilidad/edición. **Confirmado por el usuario**.

### `DynamicDocumentSerializer` — agregar `managed_by`
El serializer lista campos explícitos (no usa `__all__`). Se debe agregar `managed_by` a `Meta.fields` para que el frontend lo reciba.

### Celery tasks — sin impacto
Solo procesan subscriptions, no referencian abogados ni procesos.

### 🚨 CRITICO: Login no bloquea usuarios archivados
`sign_in()` en `userAuth.py:131` NO verifica `is_archived` ni `is_active`. Un abogado archivado puede seguir logueándose. Lo mismo aplica para `google_login()` en `userAuth.py:197`.
- **Acción requerida (Fase 3)**: Agregar verificación en `sign_in` y `google_login`:
  ```python
  if user.is_archived:
      return Response({'error': 'Account archived'}, status=403)
  ```

### 🚨 CRITICO: `managed_by` no se inicializa al crear documentos
`DynamicDocumentSerializer.create()` (línea 412) establece `created_by` al usuario actual pero NO establece `managed_by`. Los documentos nuevos tendrían `managed_by=NULL`.
- **Acción requerida (Fase 1)**: En el modelo `DynamicDocument`, el campo `managed_by` debe tener `default` lógico: inicializar `managed_by = created_by` en el serializer `create()` si no se provee explícitamente.
  ```python
  # En DynamicDocumentSerializer.create(), después de crear el documento:
  if not document.managed_by and document.created_by:
      document.managed_by = document.created_by
      document.save(update_fields=['managed_by'])
  ```

### Email notifications filtra `is_active` pero no `is_archived`
`email_notifications.py:157` filtra `User.objects.filter(role='lawyer', is_active=True)`. Con el nuevo campo, debería también excluir `is_archived=True`.
- **Acción requerida (Fase 5)**: Agregar `is_archived=False` al filtro.

### `google_login` crea usuarios sin verificar archivado
`google_login()` usa `get_or_create` y no verifica si el usuario existente está archivado antes de generar tokens.
- **Acción requerida (Fase 3)**: Verificar `is_archived` después del `get_or_create`.

---

## Orden de Implementación

| Paso | Descripción | Estimación |
|------|-------------|------------|
| 1 | Modelo: campos `is_archived`, `is_manager`, `managed_by`, cambio `on_delete` | ~30 min |
| 2 | Migración Django (schema + data migration `managed_by = created_by`) | ~20 min |
| 3 | Endpoints backend (3 vistas reasignación + serializers + URLs) | ~2-3 hrs |
| 3b | **🚨 Bloqueo de login**: `sign_in` y `google_login` rechazan usuarios archivados | ~30 min |
| 4 | Tests backend (reasignación + login archivados) | ~1-2 hrs |
| 5 | Transversales backend: admin.py, user_list, document_views filter, DynamicDocumentSerializer (`managed_by` en fields + inicialización en `create()`), email_notifications | ~1.5 hrs |
| 6 | Store frontend (reassignment.js + getter `lawyers` en userStore) | ~1 hr |
| 7 | Vista/componente de reasignación + sidebar + guard del router | ~3-4 hrs |
| 8 | ProcessForm.vue: Combobox de abogado con default al logueado | ~1-2 hrs |
| 9 | Transversales frontend: QuickActionButtons, getters.js, directorio, user_guide.js | ~2-3 hrs |
| 10 | Tests frontend + E2E | ~2 hrs |
| **Total estimado** | | **~16-20 hrs** |