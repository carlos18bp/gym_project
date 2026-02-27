# Requirement Document / Documento de Requerimiento

---

## 6. Alertas Visuales y Emails en Archivos Jurídicos

---

### Descripción

Actualmente, el módulo de Archivos Jurídicos no cuenta con un sistema de alertas visuales que notifique a los usuarios sobre documentos pendientes de firma. Los usuarios deben navegar manualmente a la sección de firmas para descubrir si tienen documentos esperando su acción, lo que puede resultar en retrasos y vencimientos de plazos importantes.

Además, aunque existen algunos emails para ciertos eventos de firma (cuando alguien firma o rechaza), no hay una cobertura completa de todos los eventos del ciclo de vida de firma, ni existe un sistema de recordatorios periódicos para firmas pendientes.

Esta carencia genera que documentos importantes permanezcan sin firmar por largos períodos, afectando la eficiencia operativa del despacho y la experiencia de los clientes.

---

### Propuesta de Mejora

Implementar un sistema completo de alertas para el módulo de Archivos Jurídicos que incluya indicadores visuales, redirección automática, emails por eventos y notificaciones in-app:

#### Alertas Visuales en Navegación
• **Indicador Pulsante en Menú**: El item "Archivos Jurídicos" en el menú lateral mostrará un efecto de pulso visual cuando el usuario tenga documentos pendientes de firma.

• **Comportamiento por Sesión**: El efecto pulsante desaparece una vez que el usuario hace clic en el menú, y no vuelve a aparecer durante esa sesión de navegación.

• **Redirección Inteligente**: Al hacer clic en "Archivos Jurídicos" con firmas pendientes, el usuario es llevado directamente a la pestaña de "Documentos Por Firmar" en lugar de la vista por defecto.

#### Redirección Automática al Primer Ingreso
• **Auto-navegación Post-Login**: La primera vez que el usuario accede al módulo de Archivos Jurídicos después de iniciar sesión, si tiene firmas pendientes, se le lleva automáticamente a la pestaña correspondiente.

• **Solo Primera Vez**: Este comportamiento ocurre únicamente en el primer acceso post-login; visitas posteriores respetan la navegación normal del usuario.

• **Respeto a Parámetros Explícitos**: Si el usuario navega con un parámetro específico en la URL, ese parámetro tiene prioridad sobre la redirección automática.

#### Destacado Visual de Documentos Pendientes
• **Efecto Pulse en Documentos**: Todos los documentos pendientes de firma en la tabla muestran un efecto visual pulsante que los hace destacar.

• **Duración Limitada**: El efecto visual dura aproximadamente 8 segundos para llamar la atención sin ser intrusivo.

• **Aplicación Universal**: El efecto aplica a todos los documentos pendientes, no solo a los nuevos.

#### Emails por Eventos de Firma
• **Firma Solicitada**: Email al creador del documento con resumen de firmantes y condiciones cuando se crea un documento para firma.

• **Progreso de Firma**: Email a todos los firmantes cuando alguien completa su firma (funcionalidad existente mejorada).

• **Documento Completamente Firmado**: Email a creador y todos los firmantes cuando se completan todas las firmas.

• **Documento Rechazado**: Email al creador cuando un firmante rechaza el documento.

• **Documento Expirado**: Email al creador cuando un documento expira sin completar firmas.

• **Firmas Reabiertas**: Notificación cuando se reabren las firmas de un documento.

#### Email de Recordatorio Diario
• **Recordatorio Automático**: Email diario a las 9:00 AM para usuarios con firmas pendientes.

• **Resumen de Pendientes**: El email lista todos los documentos que requieren firma del usuario.

• **Exclusión de Recientes**: No incluye documentos creados en las últimas 24 horas para evitar recordatorios prematuros.

#### Notificaciones In-App
• **Integración con Centro de Notificaciones**: Cada evento de firma genera una notificación in-app que aparece en el centro de notificaciones.

• **Categorías Específicas**: Las notificaciones se categorizan según el tipo de evento para fácil identificación.

• **Navegación Directa**: Al hacer clic en la notificación, el usuario es llevado al documento correspondiente.

---

### Beneficios Esperados

• **Reducción de Firmas Pendientes Olvidadas**: Las alertas visuales y recordatorios aseguran que los usuarios estén conscientes de sus tareas pendientes.

• **Menor Tiempo de Respuesta**: La redirección automática y los indicadores visuales aceleran el proceso de firma.

• **Comunicación Completa del Ciclo de Firma**: Todos los participantes reciben información oportuna sobre el estado de los documentos.

• **Menos Vencimientos**: Los recordatorios diarios previenen que documentos expiren por falta de atención.

• **Experiencia de Usuario Mejorada**: Los indicadores visuales guían al usuario hacia donde necesita actuar.

• **Reducción de Consultas al Soporte**: Los usuarios pueden dar seguimiento a sus firmas sin necesidad de preguntar al equipo de soporte.

• **Trazabilidad Completa**: El historial de notificaciones in-app proporciona un registro de todos los eventos de firma.

---

### Flujo de Operación

#### 1. Detección de Firmas Pendientes
   ○ Al cargar la aplicación, el sistema consulta si el usuario tiene documentos pendientes de firma.
   ○ El conteo se obtiene de un endpoint ligero optimizado para esta consulta.
   ○ El resultado determina si se activan las alertas visuales.

#### 2. Indicador Pulsante en Menú Lateral
   ○ Si hay firmas pendientes y el usuario no ha visitado el módulo en esta sesión, el item "Archivos Jurídicos" muestra efecto pulse.
   ○ El efecto es una animación sutil pero visible que llama la atención.
   ○ Al hacer clic, el usuario es dirigido a la pestaña de firmas pendientes y el efecto desaparece.

#### 3. Primera Visita Post-Login al Módulo
   ○ El usuario hace clic en "Archivos Jurídicos" o navega al módulo.
   ○ Si es la primera visita después del login y hay firmas pendientes:
     - Se selecciona automáticamente la pestaña "Documentos Por Firmar".
     - Se marca la sesión como "visitada" para no repetir la redirección.
   ○ Si el usuario accede con un parámetro URL específico, ese parámetro tiene prioridad.

#### 4. Visualización de Documentos Pendientes
   ○ En la tabla de firmas pendientes, todos los documentos muestran efecto pulse.
   ○ El efecto dura 8 segundos y luego se detiene automáticamente.
   ○ El usuario puede identificar fácilmente los documentos que requieren su atención.

#### 5. Creación de Documento para Firma
   ○ Un abogado crea un documento y lo envía para firma a uno o más firmantes.
   ○ El sistema genera:
     - Notificación in-app para cada firmante (categoría: signature_requested).
     - Email al creador con resumen del documento y lista de firmantes.
   ○ Los firmantes ven el indicador pulsante en su menú lateral.

#### 6. Proceso de Firma
   ○ Un firmante completa su firma en el documento.
   ○ El sistema genera:
     - Notificación in-app a todos los firmantes (categoría: signature_progress).
     - Email a todos los firmantes informando del progreso.
   ○ Si es la última firma requerida:
     - Notificación in-app a creador y firmantes (categoría: signature_completed).
     - Email a todos los participantes con el documento completado.

#### 7. Rechazo de Documento
   ○ Un firmante rechaza el documento.
   ○ El sistema genera:
     - Notificación in-app al creador (categoría: signature_rejected).
     - Email al creador informando del rechazo.

#### 8. Vencimiento de Documento
   ○ Un documento alcanza su fecha de vencimiento sin completar firmas.
   ○ El sistema genera:
     - Notificación in-app al creador (categoría: signature_expired).
     - Email al creador informando del vencimiento.

#### 9. Reapertura de Firmas
   ○ Se reabren las firmas de un documento previamente cerrado.
   ○ El sistema genera:
     - Notificación in-app a todos los firmantes (categoría: signature_reopened).

#### 10. Recordatorio Diario
   ○ Todos los días a las 9:00 AM, el sistema ejecuta una tarea programada.
   ○ Identifica usuarios con firmas pendientes (excluyendo documentos < 24h).
   ○ Envía email de resumen a cada usuario con lista de documentos pendientes.
   ○ Crea notificación in-app con categoría pending_signature_reminder.

---

### Matriz de Eventos, Notificaciones y Emails

| Evento | Notificación In-App | Destinatario In-App | Email | Destinatario Email |
|--------|---------------------|---------------------|-------|-------------------|
| Firma solicitada | ✅ | Firmantes | ✅ | Creador (resumen) |
| Alguien firmó (progreso) | ✅ | Todos los firmantes | ✅ | Todos los firmantes |
| Documento completamente firmado | ✅ | Creador + firmantes | ✅ | Todos |
| Documento rechazado | ✅ | Creador | ✅ | Creador |
| Documento expirado | ✅ | Creador | ✅ | Creador |
| Firmas reabiertas | ✅ | Todos los firmantes | ❌ | — |
| Recordatorio diario 9AM | ✅ | — | ✅ | Firmantes con pendientes |

---

### Validaciones y Reglas de Negocio

• **Conteo Eficiente**: El endpoint de conteo es ligero y no serializa documentos completos, solo retorna el número.

• **Estado de Sesión**: El flag de "visitado" se almacena en sessionStorage, limpiándose automáticamente al cerrar el navegador.

• **Limpieza en Logout**: Al cerrar sesión, se limpia el estado de sesión para que el próximo login reactive las alertas.

• **Exclusión de Documentos Recientes**: El recordatorio diario no incluye documentos creados hace menos de 24 horas.

• **Agrupación de Recordatorios**: El email de recordatorio agrupa todos los documentos pendientes de un usuario en un solo mensaje.

• **Prioridad de Parámetros URL**: Los parámetros de navegación explícitos siempre tienen prioridad sobre la redirección automática.

---

### Consideraciones de Seguridad

• **Autenticación en Endpoints**: El endpoint de conteo requiere usuario autenticado.

• **Filtrado por Usuario**: Solo se cuentan y notifican documentos donde el usuario es firmante designado.

• **Emails Seguros**: Los emails no incluyen contenido sensible del documento, solo títulos y enlaces.

• **Notificaciones Personales**: Las notificaciones in-app son privadas para cada usuario.

---

### Cambios Transversales en la Aplicación

La implementación de este requerimiento genera cambios que impactan otros módulos de la plataforma:

#### Backend - Endpoint de Conteo
• **Nuevo Endpoint**: GET /api/dynamic-documents/pending-signatures-count/ retorna conteo rápido.
• **URL Registration**: Agregar ruta en urls.py.

#### Backend - Hooks de Notificación
• **signature_views.py**: Agregar llamadas a notification_service en sign, reject, expire, reopen.
• **dynamic_document.py (serializer)**: Hook en create/update para signature_requested.
• **Nuevo Email**: send_signature_creation_email al creador con resumen de firmantes.

#### Backend - Tarea Programada
• **signature_reminder_tasks.py**: Nueva tarea Celery para recordatorio diario.
• **Celery Beat**: Configurar schedule para ejecución diaria a las 9:00 AM.

#### Frontend - Composable
• **usePendingSignatures.js**: Lógica reutilizable para conteo, estado de sesión, y marcado de visita.

#### Frontend - Menú Lateral
• **SlideBar.vue**: Efecto pulse en nav item, navegación con parámetro de tab.

#### Frontend - Dashboard de Documentos
• **Dashboard.vue**: Lógica de auto-selección de tab, paso de prop pulseAll.

#### Frontend - Tabla de Firmas
• **SignaturesListTable.vue**: Prop pulseAll, animación CSS de pulse en filas.

#### Frontend - Autenticación
• **auth.js**: Limpieza de sessionStorage en logout.

#### Manual de Usuario
• **Nueva Sección**: Documentar sistema de alertas visuales y notificaciones.
• **Instrucciones**: Explicar comportamiento de pulse y redirección.

---

### Dependencias con Otros Módulos

| Módulo | Relación |
|--------|----------|
| **Centro de Notificaciones** | **REQUIERE** el modelo Notification y notification_service. Debe implementarse primero (al menos Fases 1-3 del Centro de Notificaciones). |
| **Tour Guiado** | Complementa estas alertas guiando al usuario a los tabs relevantes durante el onboarding. |

**Nota**: Este módulo tiene una dependencia fuerte con el Centro de Notificaciones. La implementación debe esperar a que estén disponibles el modelo Notification y el servicio notification_service.

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los usuarios reciban las alertas visuales y puedan acceder a sus documentos pendientes de firma desde cualquier dispositivo.

• El efecto pulse en el menú lateral usa sessionStorage, lo que significa que se resetea al cerrar el navegador pero persiste mientras el usuario tenga la pestaña abierta.

• Los emails de recordatorio diario se envían a las 9:00 AM hora del servidor; considerar timezone si los usuarios están en diferentes zonas horarias.

• La tarea Celery de recordatorios debe monitorearse para asegurar su ejecución correcta.

• **Prerrequisito**: El Centro de Notificaciones (Requerimiento #5) debe estar implementado antes de iniciar este desarrollo, al menos las fases del modelo y servicio.

• **Importante**: La implementación de este requerimiento incluye la actualización del manual de usuario para documentar el sistema de alertas y notificaciones.

---

## Análisis de Esfuerzo y Estimación de Precio

### Clasificación de Dificultad: **MEDIO**

| Indicador | Presente |
|-----------|----------|
| Nuevo endpoint backend | ✅ |
| Hooks en múltiples puntos | ✅ |
| Nueva tarea Celery | ✅ |
| Composable Vue nuevo | ✅ |
| Modificación de componentes existentes | ✅ |
| Animaciones CSS | ✅ |
| Lógica de sesión | ✅ |