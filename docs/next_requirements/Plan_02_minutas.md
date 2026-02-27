# Sistema de Gestión de Minutas — Plan de Implementación

Permitir que todos los abogados vean todas las minutas; los no-creadores solo pueden **crear una copia** (no editar/eliminar la original), con columna "Creado por" visible.

---

## Decisiones del Cliente

| Pregunta | Respuesta |
|---|---|
| ¿No-creadores pueden editar? | **No.** Solo crear una copia propia. |
| ¿Pueden eliminar minutas ajenas? | **Irrelevante** (solo copia). |
| ¿Mostrar creador? | **Sí** (columna "Creado por"). |
| ¿Minutas privadas? | **No existe** ese concepto. |

---

## Situación Actual (Root Cause)

**Restricción 100% frontend.** Getter `getDocumentsByLawyerId` (`getters.js:146`) filtra `doc.created_by === lawyerId`. Backend ya permite acceso total a cualquier abogado. Flujo de copia (`copyDocument` en `cards/index.js:200`) ya existe con acción "Crear una Copia" en menú.

---

## ⚠️ Hallazgos del Double-Check

### Double-Check #1
1. **Menú duplicado:** `BaseDocumentCard.vue:362-579` tiene `cardConfigs` interno **separado** de `menuOptionsHelper.js`. Tablas usan `menuOptionsHelper`, cards usan `BaseDocumentCard`. **Ambos necesitan restricción.**
2. **Serializer retorna solo ID:** `created_by` es `PrimaryKeyRelatedField` (solo número). Necesitamos agregar `created_by_name` → **cambio backend menor obligatorio.**
3. **Copy ya funciona correctamente:** `copyDocument()` → `createDocument()` sin `created_by` → serializer backend auto-asigna `request.user`. ✅

### Double-Check #2 — Hallazgos de Seguridad ⚠️
4. **Backend permite a CUALQUIER abogado update/delete CUALQUIER documento:**
   - `update_dynamic_document` usa `@require_document_usability('usability')` — abogados lo bypassean (nivel `lawyer` > `usability`)
   - `delete_dynamic_document` usa `@require_document_usability('owner')` — abogados lo bypassean (nivel `lawyer` > `owner`)
   - **Riesgo:** Ocultar menú en frontend es insuficiente; un abogado puede llamar al API directamente.
5. **DocumentEditor sin validación de creador:**
   - `saveDocumentDraft()` (línea 302) llama `store.updateDocument()` sin verificar `created_by`
   - Ruta `/dynamic_document_dashboard/lawyer/editor/edit/{id}` solo valida `requiresLawyer`, no que sea el creador
   - **Riesgo:** Un abogado podría navegar directamente a la URL del editor y modificar minutas ajenas.
6. **DocumentActionsModal** usa `menuOptionsHelper.js` (confirmado línea 154) → se arregla al corregir el helper. ✅
7. **Frontend no pasa `lawyerId` al API** — documentos se filtran client-side con el getter. No se necesita cambio en fetch. ✅

---

## Cambios Requeridos

### Decisión: Opción B — Frontend + Backend (protección completa)

### 1. Getter del Store *(Impacto: Bajo)*
**Archivo:** `frontend/src/stores/dynamic_document/getters.js`
- Modificar `getDocumentsByLawyerId` → retornar TODAS las minutas (`Draft`/`Published`) sin filtrar por `created_by`.

### 2. Restringir Menú para No-Creadores *(Impacto: Medio)*
**Archivos (2 configs duplicadas):**
- `cards/menuOptionsHelper.js` — usado por tablas (`DocumentListTable`, `DocumentListLawyer`, etc.)
- `cards/BaseDocumentCard.vue:362-579` — usado por cards (`DocumentCard`, `RecentDocumentsList`)

Cuando `document.created_by !== currentUser.id` en context `legal-documents`, mostrar solo:
- ✅ Previsualización / Crear una Copia / Descargar PDF-Word (si Published)
- ❌ Editar / Eliminar / Permisos / Publicar / Borrador / Membrete

**Nota:** `menuOptionsHelper` ya recibe `userStore`. `BaseDocumentCard` tiene `props.userStore` disponible pero no lo pasa a `getMenuOptions` — necesita refactor menor.

### 3. Columna "Creado por" en Tablas *(Impacto: Bajo)*
**Archivos:**
- `frontend/src/components/dynamic_document/common/DocumentListTable.vue`
- `frontend/src/components/dynamic_document/lawyer/DocumentListLawyer.vue` (deprecated)
- Agregar columna con nombre del creador. Verificar si serializer retorna `created_by_name` o si necesita ajuste menor en backend.

### 4. DocumentListTable — documentsToDisplay *(Impacto: Bajo)*
**Archivo:** `frontend/src/components/dynamic_document/common/DocumentListTable.vue`
- Actualizar computed `documentsToDisplay` (línea 740-745) para usar getter modificado.

### 5. DocumentListLawyer (deprecated) *(Impacto: Bajo)*
**Archivo:** `frontend/src/components/dynamic_document/lawyer/DocumentListLawyer.vue`
- Actualizar `lawyerManagedNonFullySignedDocuments` (línea 783) para usar getter modificado.

---

## Impactos Transversales

### 6. Manual de Usuario
**Archivo:** `frontend/src/stores/user_guide.js`
- Actualizar `documents.overview` (línea ~853): "Plantillas creadas" → "Plantillas de todos los abogados"
- Actualizar `documents.sections[lawyer-tabs]` (línea ~886): describir nueva visibilidad
- Actualizar `documents.sections[document-actions]` (línea ~906): agregar "Crear Copia de minuta ajena"
- Actualizar `documents.sections[formalize-from-my-documents]` (línea ~973): reflejar uso de minutas de otros

### 7. Dashboard
- `QuickActionButtons.vue` — **Sin cambio** ("Nueva Minuta" redirige al dashboard de docs)
- `RecentDocumentsList.vue` — **Sin cambio** (muestra docs visitados, no filtrados por creador)
- `dashboard.vue` — **Sin cambio**

### 8. Serializer Backend — `created_by_name` *(Obligatorio)*
**Archivo:** `backend/gym_app/serializers/dynamic_document.py`
- Agregar campo `created_by_name` (`SerializerMethodField`) al `DynamicDocumentSerializer`. Retornar `first_name + last_name` del creador. Actualmente `created_by` (línea 195) es `PrimaryKeyRelatedField` que solo retorna el ID numérico.

### 9. Backend — Proteger update/delete de minutas ajenas *(Seguridad)*
**Archivos:**
- `backend/gym_app/views/dynamic_documents/document_views.py` (update + delete views)
- **O** `backend/gym_app/views/dynamic_documents/permissions.py` (nuevo decorator)

**Lógica:** Para documentos que son "minutas" (estado `Draft`/`Published` sin `assigned_to`), si el usuario es abogado pero NO es el creador (`created_by`), denegar update y delete con `403 Forbidden`. No afectar documentos con `assigned_to` (flujo cliente) donde abogados sí deben poder editar.

**Implementación sugerida:** Agregar validación directa en `update_dynamic_document` y `delete_dynamic_document`, **después** del decorator existente:
```python
# En update y delete: si es minuta ajena, denegar
if document.is_lawyer(request.user) and document.created_by != request.user:
    if not document.assigned_to:  # Es una minuta (template)
        return Response({'detail': 'Solo el creador puede modificar esta minuta.'}, status=403)
```

### 10. Frontend — Guard en DocumentEditor *(Seguridad)*
**Archivo:** `frontend/src/views/dynamic_document/DocumentEditor.vue`
- En `onMounted` (línea 56): después de cargar el documento, si el usuario es abogado y NO es el creador y el documento es minuta (sin `assigned_to`), redirigir al dashboard con notificación de error.
- Alternativa: agregar check en `saveDocumentDraft()` (línea 302).

---

## Testing

| Tipo | Alcance |
|---|---|
| **Unit (Jest)** | Getter modificado retorna minutas de todos los abogados |
| **Unit (Jest)** | MenuOptions restringe acciones para no-creadores |
| **Backend (pytest)** | Abogado B no puede update/delete minuta de Abogado A (403) |
| **Backend (pytest)** | Abogado B sí puede update documento con assigned_to (flujo cliente) |
| **E2E (Playwright)** | Abogado B ve minutas de A, crea copia, edita su copia |
| **E2E (Playwright)** | Abogado B no puede acceder al editor de minuta ajena |

---

## Estimación de Esfuerzo

| Tarea | Horas |
|---|---|
| Getter + componentes (1, 4, 5) | ~1h |
| Menú restringido no-creadores (2) | ~2h |
| Columna "Creado por" + serializer (3, 8) | ~2h |
| Manual de usuario (6) | ~1h |
| Backend protección update/delete (9) | ~2h |
| Frontend guard en DocumentEditor (10) | ~1h |
| Testing (unit + backend + E2E) | ~3h |
| **Total** | **~12h** |