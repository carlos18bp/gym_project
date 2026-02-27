# Plan: Preview con Variables Formateadas en UseDocumentTable

Agregar previsualización con variables formateadas al flujo "Nuevo Documento" del abogado, reutilizando `DocumentActionsModal` (ya usado en todas las demás tablas) y `menuOptionsHelper.js` para agregar opciones "Previsualización" y "Usar plantilla".

## Alcance Confirmado

- **Dónde:** `UseDocumentTable` — tabla de plantillas al hacer clic en "Nuevo Documento"
- **Formateo:** `{{var_en}}` → pills inline con `name_es` (sin tooltip)
- **Variables huérfanas:** `[nombre_variable]` texto plano, sin estilo
- **Solo en preview modal** — no afecta TinyMCE

## UX Confirmada

**Antes (actual):**
- Menú ⋮ → solo "Usar plantilla"
- Clic en fila → abre directamente modal de nombrar documento

**Después (nuevo):**
- Menú ⋮ → dos opciones: "Previsualización" y "Usar plantilla"
- Clic en fila → abre `DocumentActionsModal` con ambas opciones (patrón idéntico a `DocumentListTable`)
- "Previsualización" → abre preview global (Dashboard) con variables formateadas
- "Usar plantilla" → abre modal de nombrar documento (comportamiento existente)

## Pasos de Implementación

### 1. Modificar `getProcessedDocumentContent()` — `document_utils.js`
Agregar bloque para `Draft`/`Published` (dos pasos):
1. **Paso 1:** Iterar variables conocidas, reemplazar `{{var_en}}` → `<span style="pill-styles">name_es</span>`
2. **Paso 2:** Catch-all regex para `{{anything}}` huérfanas → `[anything]` texto plano
- No alterar lógica de estados finales (`Completed`, `PendingSignatures`, `FullySigned`)

### 2. Agregar contexto `'use-document'` en `menuOptionsHelper.js`
Dentro de `cardConfigs.lawyer.getMenuOptions`, agregar al inicio:
```javascript
if (context === 'use-document' && document.state === 'Published') {
  return [
    { label: "Previsualización", action: "preview" },
    { label: "Usar plantilla", action: "use" },
  ];
}
```

### 3. Actualizar `UseDocumentTable.vue`
Reutilizar el patrón exacto de `DocumentListTable`:
- Importar `DocumentActionsModal`, `openPreviewModal`
- Row click → `selectedDocumentForActions = document; showActionsModal = true`
- Agregar `<DocumentActionsModal>` con `cardType="lawyer"` y `context="use-document"`
- Manejar acciones: `preview` → `openPreviewModal(document)`, `use` → `openUseModal(document.id)`
- Actualizar menú ⋮ con las mismas dos opciones
- **No necesita instancia propia de DocumentPreviewModal** — Dashboard.vue tiene modal global

### 4. Corregir props en `DocumentListTable.vue`
- `:is-open` → `:isVisible`
- `:document` → `:documentData`

### 5. Tests unitarios
- `getProcessedDocumentContent()` con Published → pills HTML
- Con Draft → pills HTML
- Con variable huérfana → `[nombre]`
- Con Completed → comportamiento existente sin cambios
- Actualizar `UseDocumentTable.test.js` y `menuOptionsHelper.test.js` existentes

### 6. Actualizar Manual de Usuario

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/shared/document_utils.js` | Formateo variables Draft/Published |
| `frontend/src/components/dynamic_document/cards/menuOptionsHelper.js` | Contexto `'use-document'` con 2 opciones |
| `frontend/src/components/dynamic_document/client/UseDocumentTable.vue` | Reutilizar `DocumentActionsModal` + row click |
| `frontend/src/components/dynamic_document/common/DocumentListTable.vue` | Fix props (2 líneas) |
| `frontend/test/.../menuOptionsHelper.test.js` | Test nuevo contexto |
| `frontend/test/.../UseDocumentTable.test.js` | Test nuevas acciones |
| Tests unitarios (nuevo) | `getProcessedDocumentContent` |
| Manual de Usuario | Documentar preview |

## Notas Técnicas

- **Patrón existente reutilizado:** `DocumentActionsModal` ya se usa en 6 tablas (`DocumentListTable`, `DocumentListClientTable`, `DocumentListLawyer`, etc.)
- **Flujo idéntico:** row click → `showActionsModal=true` → `handleModalAction` → delegate
- **Inline styles obligatorios:** `v-html` en `DocumentPreviewModal` no aplica scoped CSS
- **Data completa en lista:** API usa `DynamicDocumentSerializer` con `prefetch_related('variables')` → no requiere fetch extra
- **Sin cambios backend, sin migraciones**
- **Riesgo:** bajo — reutiliza componentes probados

## Estimación: ~4-6 horas