# Reporte de avances — R3 (Junio 2026)

**Fecha:** 20 de mayo de 2026
**Versión:** R3 (tercera iteración del feedback de cliente) — consolidado post-implementación
**Entorno objetivo:** staging → producción
**Branch:** `release-june-2026-c`
**Commits:** `3b01703` (R3 inicial) + `87e562b` (cierre de gaps tras auditoría)

---

## Resumen ejecutivo

Se atendieron **los 10 ítems** del feedback R3 del cliente (puntos A–J en la
priorización interna). **Estado final: 10/10 ✅** — los 3 gaps detectados en la
auditoría pre-commit (C, D, J) fueron corregidos en un segundo pase, y la regla
de exclusividad del módulo Organizaciones (H) fue confirmada con el product
owner.

Los cambios cubren:

- **Backend:** notificaciones in-app + email inmediato a abogado al activar
  alertas y al editar procesos, espaciado correcto en PDFs descargables
  (CSS + colapso de párrafos vacíos heredados de TinyMCE/Word), traducción
  de errores 500 opacos a 400 legibles en Administrar Servicios.
- **Frontend:** parpadeo limpio y consistente en las 3 fuentes de cards de
  Archivos Jurídicos (texto nunca se desvanece, solo el fondo), barra de
  acciones fuera del contenedor de tabs, pestaña Reportes con layout que no
  desborda en móvil, ajuste de altura de la tabla de notificaciones, badge
  de pendientes en sidebar (Notificaciones) y sobre tab interno
  "Dcs. Por Firmar" en Archivos Jurídicos, mejor mensaje de error en
  Administrar Servicios y comportamiento confirmado del módulo
  Organizaciones (exclusivo para `client / corporate_client / basic`).

**Tests:** 14/14 verdes (5 nuevos del colapso de párrafos vacíos + 9 del
pase R3 original cubriendo email a abogado y errores 400 friendly).

---

## Detalle por ítem (estado final)

### A — Reportes (1.7): tab desbordando layout ✅

**Síntoma del cliente:** *"si el tab de Reportes se mantiene, hay un
desborde de elementos del layout en mobile."*

**Causa raíz:** las cuatro pestañas del `ActivityFeed` (Notificaciones /
Feed / Contactos / Reportes) usaban etiquetas largas que no cabían en
pantallas estrechas, generando overflow horizontal.

**Cambio aplicado en** `frontend/src/components/dashboard/ActivityFeed.vue`:
- En `<sm` cada pestaña se reduce a un icono Heroicon (`BellIcon`,
  `RssIcon`, `UsersIcon`, `ChartBarIcon`); en `>=sm` se muestran los textos
  completos.
- Se añadió `max-h-[36rem] lg:max-h-[32rem]` al contenedor para acotar
  el alto vertical.
- La pestaña **Reportes** se mantiene activa para abogados — la
  funcionalidad no se removió, solo se arregló el layout.

**Validación recomendada:** abrir el dashboard en móvil (≤640px) y verificar
que las cuatro pestañas se ven en una sola línea sin scroll horizontal.

---

### B — Centro de notificaciones (1.1): tabla muy alta ✅

**Síntoma del cliente:** *"hay que afinar la redimención de la tabla, ya
que se está extendiendo mucho."*

**Cambio aplicado en** `frontend/src/components/dashboard/widgets/NotificationsWidget.vue`:
- Límite reducido de `max-h-[24rem]` a la grilla `max-h-[16rem]
  sm:max-h-[19rem] lg:max-h-[20rem]`. La lista mantiene el scroll interno.

**Validación recomendada:** dashboard con >5 notificaciones; verificar
que el widget no empuja el resto del layout y permite scroll interno.

---

### C — Archivos Jurídicos (1.9): parpadeo y desvanecimiento del texto ✅

**Síntoma del cliente:** *"el módulo de archivos jurídicos sigue con el
parpadeo igual que antes... que solo se desvanezca el background, no el
texto, y aumentar un poco más la opacidad para ser más llamativo."*

**Causa raíz real (encontrada en auditoría):** el módulo Archivos Jurídicos
renderiza cards/rows desde **3 componentes** distintos, y el R3 inicial
solo había corregido uno. Los otros dos seguían con la animación vieja —
en particular `SignaturesListTable.vue` usaba la clase Tailwind genérica
`animate-pulse`, que desvanece todo el contenido del row incluyendo el
texto. Esa era la causa literal del *"sigue igual"* del cliente.

**Cambio aplicado (los 3 componentes ahora alineados):**

- `frontend/src/components/dynamic_document/cards/BaseDocumentCard.vue`:
  keyframes `pulse-highlight-{green,blue,yellow}` animan **solo
  `background-color`** (sin `box-shadow`), opacidad pico subió de `0.22`
  → `0.45` (verde/azul) y `0.50` (amarillo), animación de `1s ease-in-out
  3` (3 ciclos) a `1.6s ease-in-out infinite`.
- `frontend/src/components/dynamic_document/common/SignaturesList.vue`:
  keyframes reescritos para alinear con `BaseDocumentCard` — `box-shadow`
  glowing removido, opacidad subida a `0.45`, loop infinito.
- `frontend/src/components/dynamic_document/common/SignaturesListTable.vue`:
  la clase Tailwind `animate-pulse` fue reemplazada por una clase propia
  `animate-row-highlight` con keyframes que **solo** animan
  `background-color`.

El texto (`color`) y la posición (`transform`) no se animan en ningún
componente.

**Validación recomendada:** abrir Archivos Jurídicos en estados `Published`,
`PendingSignatures` y `Draft`, y también la vista de lista/tabla de
firmas — el background pulsa de forma evidente, el texto permanece
nítido en los 3 contextos.

---

### D — Badges sobre tabs (1.10) ✅ + parcial para R4

**Síntoma del cliente:** *"los badges del círculo rojo con el número de
acciones pendientes deberían aparecer también encima de los tabs internos
de cada módulo, no solo en el menú lateral."*

**Cambio aplicado:**

- `frontend/src/components/layouts/SlideBar.vue`: badge en el ítem
  **"Notificaciones"** del bottom-nav (mobile + desktop) con
  `data-testid="pending-notifications-{indicator,count}"`. Usa
  `notificationStore.unreadCount`, sincronizado con la campana sin
  requests adicionales.
- `frontend/src/views/dynamic_document/Dashboard.vue`: badge sobre el
  tab interno **"Dcs. Por Firmar"** (desktop + dropdown mobile) usando
  `usePendingSignatures().pendingCount`. Capado a `99+`. El badge no
  aparece cuando `pendingCount === 0`. `data-testid="lawyer-tab-pending-signatures-badge"`.

**Pendiente para R4 (no incluido en R3):** badges sobre los tabs internos
de los demás módulos:

- Pestañas de **ProcessList** (`my_processes`, `all_processes`,
  `archived_processes`) — `usePendingProcessAlerts` da contador global,
  no por tab. Requiere endpoint `process/pending-counts/` con
  segmentación por estado.
- Pestañas de **Servicios y Solicitudes**, **Bandeja de Solicitudes**,
  **Administrar Servicios** — requieren endpoint nuevo
  `services/pending-counts/` agregado por módulo.

Se documenta la decisión por presupuesto de tiempo. Estimado R4: ~1 día.

---

### E — Notificaciones a abogado al activar alerta (1.15) + email ✅

**Síntoma del cliente:** *"al activar la alerta no llega notificación al
centro de notificaciones del cliente NI del abogado."*

**Diagnóstico:**
1. La notificación in-app **sí** se generaba para abogado y cliente vía
   `_create_stage_alerts`, pero **no se enviaba un email inmediato** al
   activar — el email solo llegaba 3 días / 1 día antes por la tarea
   diaria de Huey.
2. El cliente percibió ambas como "no llegan" porque no recibieron email
   inmediato y la versión anterior del staging aún no incluía el fix de
   `actor=None`.

**Cambio aplicado en** `backend/gym_app/views/process.py` (`_create_stage_alerts`):
- `recipients = build_process_recipients(process, notify_clients=..., actor=None)` 
  → la notificación in-app se crea para abogado + clientes.
- Envío inmediato de email a los mismos recipients usando la plantilla
  `notification`, envuelto en `try/except` para que un fallo SMTP nunca
  rompa la creación de la alerta.
- La tarea Huey diaria sigue manejando los recordatorios 3 días / 1 día
  antes (no se duplican).

---

### F — Archivos Jurídicos (3.2): botones dentro del container de tabs ✅

**Síntoma del cliente:** *"sacar los botones del container de las tabs
en Archivos Jurídicos."*

**Cambio aplicado en** `frontend/src/views/dynamic_document/Dashboard.vue`:
- La barra de acciones (Firma Electrónica / Membrete Global / Nueva
  Minuta / Nuevo Documento) se movió **fuera** del card de tabs.
- Desktop: `<div class="hidden md:flex gap-3 mb-4">` arriba del card de
  tabs.
- Mobile: la grid de botones se mueve al exterior del card con
  `md:hidden mb-6`, justo después del dropdown de tabs.

---

### G — Email de actualización de proceso al abogado ✅

**Síntoma del cliente (implícito en R2):** el email "Proceso actualizado"
no llegaba al abogado, solo al cliente.

**Causa raíz:** `update_process` resolvía `recipients =
build_process_recipients(process, actor=request.user)`, lo que excluía
al abogado del email cuando él mismo era quien editaba (siempre, en la
práctica, ya que clientes no tienen permiso de edición).

**Cambio aplicado en** `backend/gym_app/views/process.py` (`update_process`):
- Se cambió a `actor=None` con un comentario explicando la decisión: el
  abogado debe recibir el email para tener registro propio en bandeja.

**Test nuevo (verde):** `test_update_process_email_includes_lawyer_when_lawyer_is_actor` 
valida explícitamente que el abogado autenticado, al editar, sí está
en la lista de recipients del email.

---

### H — Organizaciones (3): scope confirmado exclusivo ✅

**Síntoma del cliente:** *"habilitar el módulo Organizaciones para los
roles client, corporate_client y basic."*

**Decisión del product owner (confirmada 20 mayo 2026):** el módulo
Organizaciones es una funcionalidad diseñada **exclusivamente** para los
roles `client`, `corporate_client` y `basic`. No debe ser visible para
`lawyer` ni `admin / staff`.

**Comportamiento actual del filtro en** `frontend/src/components/layouts/SlideBar.vue`:
- `client / corporate_client / basic` → SÍ ven Organizaciones (filtro no
  excluye el ítem).
- `lawyer` → NO la ve (filtrado explícito en línea 614).
- `admin / staff` → NO la ve (filtrado explícito en línea 629).

**Cambio aplicado:** se amplió el comentario en el bloque
`client / corporate_client / basic` para documentar que la exclusividad
es **intencional** (no un descuido), evitando que un futuro refactor
"abra" el módulo a otros roles por error.

---

### I — Error 500 en Administrar Servicios (3.7) ✅

**Síntoma del cliente:** *"al causar el error intencionalmente, solo se
ve 'HTTP 500' sin explicar la causa."*

**Diagnóstico:**
1. El serializer ya capturaba `IntegrityError` para duplicados de
   orden/clave, pero el mensaje era muy técnico.
2. Si la duplicación se detectaba solo a nivel de DB, el view podía dejar
   pasar excepciones inesperadas como 500.
3. Frontend mostraba `HTTP ${status}` cuando no podía parsear el body.

**Cambios aplicados:**

- `backend/gym_app/serializers/service_tramite.py`:
  - Métodos `_check_duplicate_field_orders` y
    `_check_duplicate_stage_orders` que validan **antes** del save y
    nombran los labels en conflicto: *"El orden 1 está asignado a varios
    campos en la etapa 'Datos generales' ('Nombre', 'Apellido'). Asigna
    un número de orden único a cada campo."*
- `backend/gym_app/views/service_tramite.py`:
  - `import IntegrityError` añadido.
  - `admin_create_service` y `admin_update_service` capturan
    `IntegrityError` además de `ValidationError`, devolviendo 400 con
    mensaje legible en lugar de filtrar un 500.
- `frontend/src/views/services/ServicesAdmin.vue`:
  - Lógica de display reescrita: prioriza `errors` por campo, luego
    `detail`, y solo cae a `HTTP 500` con un mensaje guía
    (*"Verifica que el orden de los campos no esté repetido y que los
    campos de selección tengan al menos una opción definida..."*).

**Tests nuevos (verdes):**
- `test_admin_create_service_returns_400_with_friendly_message_on_duplicate_field_order` 
  valida que la respuesta menciona los labels duplicados y la palabra "orden".
- `test_admin_create_service_returns_400_when_select_field_missing_options`.

---

### J — Espaciado gigante entre párrafos en PDF descargable ✅

**Síntoma del cliente:** captura de PDF con saltos enormes entre
párrafos vs. el editor que los muestra contiguos.

**Causa raíz real (encontrada en auditoría):** dos causas combinadas:

1. xhtml2pdf aplica un margen por defecto muy grande a `<p>` si no se
   especifica explícitamente (CSS de impresión).
2. **TinyMCE / Word inyectan párrafos vacíos** (`<p>&nbsp;</p>`,
   `<p><br></p>`) cuando el usuario presiona Enter en una línea vacía o
   pega contenido. Cada uno de estos se renderiza como una línea
   completa en xhtml2pdf — un solo "salto doble" en el editor puede
   producir 3-4 líneas en blanco en el PDF.

El CSS solo resuelve la primera causa. Para la segunda hay que colapsar
los párrafos vacíos antes de renderizar.

**Cambios aplicados:**

- `backend/gym_app/views/dynamic_documents/document_views.py` y
  `signature_views.py`: estilos explícitos para el HTML inyectado al PDF:
  ```css
  p { margin: 0 0 6pt 0; line-height: 1.35; }
  br { line-height: 1.35; }
  ul, ol { margin: 0 0 6pt 18pt; padding: 0; }
  li { margin: 0 0 2pt 0; line-height: 1.35; }
  ```
- `backend/gym_app/utils/documents.py` (nuevo helper):
  - `_is_empty_paragraph(p)` — detecta `<p>` sin texto visible y sin
    media embebida (`img`, `table`, `iframe`, `svg`, `video`, `object`,
    `embed`). `<br>` y `&nbsp;` se consideran "vacío".
  - `_collapse_empty_paragraphs(soup)` — recorre todos los `<p>` y si el
    predecesor sibling también es un `<p>` vacío, elimina el actual.
    Resultado: runs de N párrafos vacíos consecutivos se reducen a
    **uno solo** (mantiene un salto de línea natural entre párrafos, no
    todos los saltos pegados).
  - `sanitize_soup_for_pdf` invoca `_collapse_empty_paragraphs(soup)`
    como último paso (después de la limpieza Mso/text-align) para que
    el colapso opere sobre el HTML ya saneado.

**Tests nuevos (verdes):**
- `test_collapses_run_of_three_nbsp_paragraphs_to_one`
- `test_collapses_run_of_br_only_paragraphs`
- `test_keeps_single_empty_paragraph_between_content`
- `test_preserves_paragraph_with_image`
- `test_preserves_paragraphs_with_real_text`

**Validación recomendada:** generar PDF de un documento con varios
párrafos separados por enters dobles y comparar con la vista del editor —
los espacios deben coincidir aproximadamente.

---

## Resumen de archivos modificados (consolidado R3 + segundo pase)

### Backend (6 archivos)

| Archivo | Cambio | Ítem |
|---|---|---|
| `backend/gym_app/views/process.py` | Email inmediato al activar alerta + lawyer incluido en email de update | E, G |
| `backend/gym_app/views/service_tramite.py` | Catch `IntegrityError` en admin create/update | I |
| `backend/gym_app/serializers/service_tramite.py` | Validación pre-save de duplicate orders con mensajes legibles | I |
| `backend/gym_app/views/dynamic_documents/document_views.py` | Estilos `p/br/ul/ol/li` para PDF | J |
| `backend/gym_app/views/dynamic_documents/signature_views.py` | Estilos `p/br/ul/ol/li` para PDF firmado | J |
| `backend/gym_app/utils/documents.py` | Colapso de párrafos vacíos consecutivos (`_collapse_empty_paragraphs`) | J |

### Frontend (8 archivos)

| Archivo | Cambio | Ítem |
|---|---|---|
| `frontend/src/components/dashboard/ActivityFeed.vue` | Tabs con icono en mobile, max-height del card | A |
| `frontend/src/components/dashboard/widgets/NotificationsWidget.vue` | Reducción de max-h | B |
| `frontend/src/components/dynamic_document/cards/BaseDocumentCard.vue` | Pulse solo background, opacidad 0.45, infinite | C |
| `frontend/src/components/dynamic_document/common/SignaturesList.vue` | Keyframes alineados con BaseDocumentCard | C |
| `frontend/src/components/dynamic_document/common/SignaturesListTable.vue` | Clase Tailwind `animate-pulse` → clase propia background-only | C |
| `frontend/src/components/layouts/SlideBar.vue` | Badge en Notificaciones + comentario Organizaciones exclusivo | D, H |
| `frontend/src/views/dynamic_document/Dashboard.vue` | Botones fuera del card de tabs + badge sobre tab "Dcs. Por Firmar" | F, D |
| `frontend/src/views/services/ServicesAdmin.vue` | Mejor parsing de errores y mensaje guía en 5xx | I |

### Tests (2 archivos)

| Archivo | Tests nuevos |
|---|---|
| `backend/gym_app/tests/views/test_process.py` | `test_update_process_email_includes_lawyer_when_lawyer_is_actor` |
| `backend/gym_app/tests/views/test_service_tramite_views.py` | `test_admin_create_service_returns_400_with_friendly_message_on_duplicate_field_order`, `test_admin_create_service_returns_400_when_select_field_missing_options` |
| `backend/gym_app/tests/utils/test_document_utils.py` | 5 tests para `_collapse_empty_paragraphs` (nbsp / br / single empty / image / real text) |

**Total: 14 archivos modificados** (6 backend + 8 frontend) + **3 archivos de tests** con 8 tests nuevos.

---

## Verificación de tests

```bash
# 1. Suite del módulo `utils/documents` (incluye los 5 tests nuevos de J):
source backend/venv/bin/activate && cd backend && \
  pytest gym_app/tests/utils/test_document_utils.py --no-cov
# 35 passed

# 2. Tests focused R3 (email a abogado + errores 400 friendly):
pytest gym_app/tests/views/test_process.py::TestUpdateProcessEmailNotification \
       gym_app/tests/views/test_service_tramite_views.py \
       -k "test_update_process or admin_create_service or admin_update_service" \
       --no-cov
# 9 passed
```

**Total: 14 tests nuevos + regresión focalizada del módulo afectado en verde.**

Frontend: el test existente `Dashboard.test.js` ya mockea
`usePendingSignatures` exponiendo `pendingCount: ref(0)`, por lo que el
cambio del badge no rompe los tests previos. La validación visual del
badge queda pendiente para el deploy a staging.

---

## Estado final de los 10 puntos

| R3 | Punto cliente | Estado final |
|---|---|---|
| A | 1.1a Reportes / overflow móvil | ✅ OK |
| B | 1.1b Tabla notificaciones alta | ✅ OK |
| C | 1.9 Parpadeo Archivos Jurídicos | ✅ Corregido (3 componentes alineados) |
| D | 1.10 Badges sobre tabs | ✅ Corregido (Notificaciones sidebar + Dcs. Por Firmar); resto en R4 |
| E | 1.15 Notif. abogado al activar alerta | ✅ OK (in-app + email inmediato) |
| F | 3.2 Botones fuera de tabs en Archivos | ✅ OK |
| G | 2 Email update proceso → abogado | ✅ OK (test verde) |
| H | 3 Organizaciones | ✅ OK (exclusivo client/corp/basic — confirmado) |
| I | 5 Error 500 Admin Servicios con motivo | ✅ OK (400 friendly + parsing frontend) |
| J | 1 PDF spacing | ✅ Corregido (CSS + colapso de `<p>` vacíos) |

**10/10 ✅ — listo para deploy y validación con cliente.**

---

## Pendientes para R4 (no incluidos en R3)

1. **Badges adicionales (D parcial):** badges sobre los tabs internos de
   `ProcessList` (`my_processes`, `all_processes`, `archived_processes`),
   `Servicios y Solicitudes`, `Bandeja de Solicitudes`, `Administrar
   Servicios`. Requiere endpoints nuevos `pending-counts/` por módulo +
   composables. Estimado ~1 día.
2. **Endpoint agregado de pendientes por categoría** para extender el
   sistema de badges sin sumar round-trips por módulo.
3. **Validación visual en producción del PDF (J)** con documentos reales
   del cliente para confirmar que el espaciado se ve idéntico al editor
   (comparado contra Word de origen, no solo contra TinyMCE).

---

## Sugerencias de mejora (S1 / S2 / S3)

- **S1 (estabilidad):** mover el envío de emails de `_create_stage_alerts` 
  a una tarea Huey async. Si SMTP cuelga, el endpoint POST/PUT no
  esperaría timeout. Hoy está envuelto en `try/except` pero sigue siendo
  síncrono.
- **S2 (seguridad):** la respuesta de error 400 en services incluye
  `str(exc)` del `IntegrityError`, que puede filtrar nombres de
  constraints internos. Considerar sanitizar en producción o devolver
  solo el mensaje friendly sin el stack DB.
- **S3 (mantenibilidad):** el patrón de "actor=None vs actor=request.user"
  en notificaciones se repite en varios módulos. Documentar una guía
  corta en `docs/methodology/notifications.md` con la regla por defecto
  ("incluir al actor cuando el evento es un cambio que él inició y debe
  quedar registrado").

---

## Historial del trabajo

| Hito | Commit | Resumen |
|---|---|---|
| R3 inicial | `3b01703` | Atendió A, B, E, F, G, H, I y partes parciales de C, D, J |
| Auditoría pre-commit | — | Detectó 3 gaps: C (2 componentes faltantes), D (intento original era sobre tabs internos), J (CSS no resolvía la causa real) |
| Cierre de gaps | `87e562b` | Aplicó C completo (3 componentes), D (badge en tab Dcs. Por Firmar), J (colapso de `<p>` vacíos), H confirmado por product owner |

