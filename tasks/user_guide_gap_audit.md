# User Guide — Auditoría de Cobertura (Gap Analysis)

**Fecha**: 2026-04-22
**Alcance**: Comparar módulos/flujos/vistas del sistema real vs. contenido en `frontend/src/stores/user_guide/`

---

## 1. Resumen ejecutivo

El User Guide actual documenta **10 módulos con 65 secciones** (~2.800 líneas). El sistema real expone **63 rutas frontend, 181 endpoints backend y ~13 dominios funcionales**. La cobertura es **alta en los módulos presentes (95–100%)** pero **faltan 2 módulos completos y varias secciones puntuales**. Lista completa abajo.

### Gaps críticos
1. 🔴 **Módulo SECOP** — ausente en `modules.js` (sistema tiene ruta `/secop`, 19 endpoints, vistas `SecopList`/`SecopDetail`, tabs, alertas, vistas guardadas, UNSPSC, export Excel).
2. 🔴 **Módulo Servicios y Trámites** — ausente en `modules.js` (sistema tiene `/services`, 18 endpoints, `ServicesHub` con 3 tabs, `ServiceDetail`, `ServicesAdmin`, formularios dinámicos por etapas, radicado `YYYY-NNNNN`, PDFs automáticos).

### Gaps de secciones
3. 🟡 Dashboard: falta sección sobre **Servicios Destacados** (`FeaturedServicesGrid`).
4. 🟡 Archivos Jurídicos: falta sección **Configuración de Variables** (ruta `/dynamic_document_dashboard/lawyer/variables-config`, vista `DocumentVariablesConfig.vue`).
5. 🟡 Archivos Jurídicos: falta sección dedicada a **Permisos** (15 endpoints backend: público, por usuario, por rol, combinados). Mencionados sueltos, no como flujo.
6. 🟡 Autenticación y Cuenta: falta sección sobre **Firma Digital del usuario** (`POST /api/users/update_signature/{user_id}/` + upload de letterhead a nivel perfil).
7. 🟡 Suscripciones: faltan **Actualizar método de pago** (`update_payment_method`) e **Historial de pagos** (`get_payment_history`).

### Desactualizaciones
8. 🟠 Archivos Jurídicos → `lawyer-tabs`: los labels dicen *"Por Firmar / Firmados / Archivados"*. Los reales (post-commit `d60eeb4`) son **"Dcs. Por Firmar / Dcs. Formalizados / Dcs. Archivados"**. Ver `Dashboard.vue:965-977`.
9. 🟠 Agendar Cita: la sección documenta *"tipos de cita, recordatorios, integración calendarios propios"* que **no existen** — la vista real es solo un widget Calendly embebido (`calendly.com/infogym/cita-abogado`).

### Gaps menores / opcionales
10. Directorio: no menciona edición de perfil del usuario desde el modal (solo para lawyers).
11. Procesos: no cubre **eliminación** de proceso (si existe — verificar endpoint).
12. Organizaciones: los 29 endpoints backend están bien cubiertos por las 9 secciones; revisar solo **estadísticas del dashboard corporativo** (`corporate_get_dashboard_stats`) para verificar que la sección `corporate-dashboard` lo documenta.

---

## 2. Plan de acción — propuesta de implementación

### Fase A · Gaps críticos (añadir 2 módulos nuevos)

**A.1 — Crear módulo SECOP**
- `frontend/src/stores/user_guide/modules.js` → nueva entry `{ id: 'secop', name: 'SECOP — Contratación Estatal', icon: BriefcaseIcon, roles: ['lawyer','client','corporate_client','basic'], description: '...' }`.
- `frontend/src/stores/user_guide/content/secop.js` → nuevo archivo con ~5 secciones:
  - `secop-tabs`: Todos / Clasificados / Alertas (con contador).
  - `secop-search-filters`: búsqueda, tags/palabras clave, filtros (departamento, modalidad, estado, entidad, UNSPSC multi-select).
  - `secop-classifications`: estados (INTERESTING / UNDER_REVIEW / APPLIED / DISCARDED), flujo de clasificación.
  - `secop-alerts`: crear alerta (criterios), editar, activar/desactivar, notificaciones.
  - `secop-saved-views`: crear vista guardada, editar, marcar favorita, aplicar filtros combinados.
  - `secop-export-sync`: exportar Excel, sincronización manual, estado de sync.
  - Sección de restricciones: rol `basic` ve overlay deshabilitado.
- `frontend/src/stores/user_guide/index.js` → importar y registrar el contenido en `guideContent`.

**A.2 — Crear módulo Servicios y Trámites**
- `frontend/src/stores/user_guide/modules.js` → nueva entry `{ id: 'services', name: 'Servicios y Trámites', icon: InboxArrowDownIcon, roles: ['lawyer','client','corporate_client','basic'], description: '...' }`.
  - Nota: usar un ícono distinto a `requests` (Solicitudes Legales) — ambos usan InboxArrowDown actualmente; considerar `ClipboardDocumentListIcon`.
- `frontend/src/stores/user_guide/content/services_tramites.js` → nuevo archivo con ~6 secciones:
  - `services-catalog`: grid de servicios, featured, búsqueda, click para detalle.
  - `services-dynamic-form`: etapas, tipos de campo (texto/archivo/selector), validación, help text, contador X/10 en archivos múltiples.
  - `services-draft`: guardar borrador automático, reanudar desde borrador, envío final.
  - `services-submission`: radicado automático `YYYY-NNNNN`, generación PDF corporativa, notificación email.
  - `services-my-requests`: listar mis solicitudes, estados, respuestas del abogado, archivos adjuntos.
  - `services-inbox` (lawyer): bandeja de solicitudes, cambio de estado, responder con archivos, notificaciones.
  - `services-admin` (admin): builder de servicios, validación exhaustiva, preview de ícono, activar/destacar.

### Fase B · Gaps de secciones (agregar a módulos existentes)

**B.1 — Dashboard → nueva sección `featured-services`**
- Archivo: `content/dashboard_directory.js`
- Contenido: grid de servicios destacados, CTA al detalle, rol-agnóstico.

**B.2 — Documentos → nueva sección `variables-config`**
- Archivo: `content/documents.js`
- Roles: `[lawyer]`
- Cubrir: ruta `/dynamic_document_dashboard/lawyer/variables-config`, definir tipos de campo, validaciones, tooltips/help text, reutilización entre minutas.

**B.3 — Documentos → nueva sección `document-permissions`**
- Archivo: `content/documents.js`
- Roles: `[lawyer]`
- Cubrir:
  - Acceso público (toggle) y URL compartible.
  - Permisos de visibilidad vs. usabilidad (diferencia).
  - Otorgar por usuario, por rol, combinados.
  - Revocación.
  - Uso del modal "Gestionar Permisos" en `DocumentListTable`.

**B.4 — Autenticación → nueva sección `user-signature`**
- Archivo: `content/services.js` (módulo authentication)
- Roles: todos.
- Cubrir: subir firma dibujada/imagen al perfil, requisitos (tamaño, formato), uso en firma electrónica.

**B.5 — Suscripciones → dos nuevas secciones**
- `payment-method-update`: cambiar tarjeta desde panel de suscripción, re-tokenización Wompi.
- `payment-history`: consultar historial, reintentos, estados.

### Fase C · Desactualizaciones (corregir contenido existente)

**C.1 — `lawyer-tabs` en `documents.js`**
- Actualizar features y content para usar los nombres reales:
  - "Por Firmar" → **"Dcs. Por Firmar"**
  - "Firmados" → **"Dcs. Formalizados"**
  - "Archivados" → **"Dcs. Archivados"**
- Archivo: `frontend/src/stores/user_guide/content/documents.js:43-52` (features array) y contenido descriptivo adyacente.

**C.2 — `schedule` en `services.js` (módulo appointments)**
- Eliminar afirmaciones falsas:
  - "tipos de cita (consulta, seguimiento, emergencia)" — no existen.
  - "integración con Google Calendar / Outlook" del lado nuestro — solo lo hace Calendly externamente.
- Dejar: widget Calendly embebido, selección de horario, confirmación email (las envía Calendly).
- Archivo: `frontend/src/stores/user_guide/content/services.js:145-202`.

### Fase D · Verificaciones adicionales (investigar antes de ejecutar)

- **D.1**: Revisar si Procesos tiene endpoint `delete`. Si sí, agregar mención en `edit-process` o crear `delete-process`.
- **D.2**: Verificar que `corporate-dashboard` documenta uso de `corporate_get_dashboard_stats` (estadísticas).
- **D.3**: Revisar si Directorio tiene edición de perfil en modal — si sí, añadir pasos.

---

## 3. Archivos críticos a modificar/crear

| Acción | Archivo | Propósito |
|---|---|---|
| **Crear** | `frontend/src/stores/user_guide/content/secop.js` | Módulo SECOP completo |
| **Crear** | `frontend/src/stores/user_guide/content/services_tramites.js` | Módulo Servicios y Trámites completo |
| **Editar** | `frontend/src/stores/user_guide/modules.js` | Registrar 2 módulos nuevos + ícono |
| **Editar** | `frontend/src/stores/user_guide/index.js` | Importar contenidos nuevos y fusionarlos en `guideContent` |
| **Editar** | `frontend/src/stores/user_guide/content/dashboard_directory.js` | Agregar sección `featured-services` |
| **Editar** | `frontend/src/stores/user_guide/content/documents.js` | Actualizar labels tabs (Dcs.*), agregar secciones `variables-config` y `document-permissions` |
| **Editar** | `frontend/src/stores/user_guide/content/services.js` | Ajustar sección `schedule`, agregar `user-signature`, `payment-method-update`, `payment-history` |
| **Editar** | `frontend/src/views/user_guide/QuickLinksCard.vue` | Si lista accesos rápidos por rol, añadir SECOP/Servicios según corresponda |

---

## 4. Tests afectados

### Unit tests — `frontend/test/stores/user_guide.test.js`
- Verificar que `initializeGuideContent` incluye los 2 módulos nuevos.
- Verificar `getModulesForRole` devuelve SECOP/Servicios para roles correctos.
- Verificar `searchGuideContent` encuentra términos clave ("alerta", "radicado", "UNSPSC", "borrador").
- No es necesario agregar tests nuevos si el contenido sigue el mismo esquema — el store ya es agnóstico al contenido.

### E2E — `frontend/e2e/user-guide/user-guide-main.spec.js`
- Añadir 2 specs: `user-guide-secop.spec.js` y `user-guide-services.spec.js` (o ampliar el principal) verificando que cada nuevo módulo se renderiza, tiene búsqueda funcional, y sus secciones se navegan.
- Rol basic debería ver los 2 módulos (ambos lo incluyen); lawyer también.

---

## 5. Verificación end-to-end

```bash
# 1. Unit tests del store
cd frontend && npm test -- test/stores/user_guide.test.js

# 2. Smoke manual en navegador
#    - Login lawyer → /user_guide → ver 12 módulos (antes 10)
#    - Click SECOP → ver tabs/alertas/saved views documentados
#    - Click Servicios → ver catálogo/borrador/admin documentados
#    - Buscar "alerta" → 1+ resultado en SECOP
#    - Buscar "radicado" → resultado en Servicios
#    - Login basic → ver SECOP, Servicios, Inicio, Procesos, Docs, Citas, Orgs, Auth, Suscripciones (9 módulos)

# 3. E2E
cd frontend && E2E_REUSE_SERVER=1 npx playwright test e2e/user-guide/

# 4. Verificar que NO haya 404 al navegar por cada sección
```

---

## 6. Orden recomendado de ejecución

1. **Fase C** primero (correcciones): 2 archivos, cambios chicos, sin crear archivos nuevos. Bajo riesgo.
2. **Fase B** después (secciones faltantes): ampliar archivos existentes, patrón ya establecido.
3. **Fase A** al final (módulos nuevos): más volumen de contenido, requiere más tiempo.
4. **Fase D** en paralelo a B: investigaciones puntuales.

---

## 7. Estimación de esfuerzo

| Fase | Archivos | Líneas nuevas aprox | Complejidad |
|---|---|---|---|
| A · 2 módulos nuevos | 3 | ~800 | Media (contenido denso) |
| B · secciones faltantes | 3 | ~400 | Baja (patrón conocido) |
| C · correcciones | 2 | ~30 netas | Trivial |
| D · verificaciones | varios | 0–100 | Variable |
| Tests E2E | 1–2 nuevos | ~200 | Baja |
| **Total** | ~6 | ~1.500 | Media |

---

## 8. Decisión requerida del usuario

Tres opciones de alcance:

- **Full**: ejecutar Fases A + B + C + D + tests (todo). Entrega manual 100% alineado con el sistema.
- **Mínimo viable**: sólo Fase A (agregar SECOP y Servicios — los 2 gaps críticos). Deja secciones menores y desactualizaciones para después.
- **Correcciones primero**: sólo Fase C + Fase B (sin módulos nuevos). Corrige todo lo visible sin riesgo, deja SECOP/Servicios para una iteración dedicada.
