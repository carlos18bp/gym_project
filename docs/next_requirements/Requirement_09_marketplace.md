# Requirement Document / Documento de Requerimiento

---

## 9. Marketplace de Servicios

---

### Descripción

Actualmente, la plataforma gestiona procesos jurídicos, documentos, solicitudes y organizaciones, pero no existe un espacio donde la firma pueda publicar y ofrecer sus servicios de forma estructurada a los clientes. Los servicios disponibles se comunican de manera informal (por correo, llamadas o mensajes directos), lo que impide que los clientes conozcan la oferta completa, genera demoras en la solicitud y deja sin trazabilidad el historial de servicios solicitados.

No hay un mecanismo para que los clientes puedan explorar los servicios disponibles, solicitar uno mediante un formulario específico y hacer seguimiento de su solicitud. De igual forma, la firma no cuenta con una herramienta interna para publicar servicios con sus requisitos y recibir las solicitudes de forma centralizada.

Esta ausencia genera fricciones en la relación cliente-firma, pérdida de oportunidades de negocio y mayor carga operativa en la gestión de solicitudes de servicio.

---

### Propuesta de Mejora

Implementar un módulo de **Marketplace de Servicios** que funcione como un mini e-commerce de servicios jurídicos, donde los gestores de servicios pueden publicar servicios con formularios configurables y los usuarios pueden explorar, solicitar y hacer seguimiento de sus solicitudes:

#### Listado y Exploración de Servicios
• **Módulo independiente en el Sidebar**: Acceso desde la barra lateral bajo el nombre "Marketplace" visible para todos los usuarios autenticados.

• **Listado de servicios activos**: Tarjetas con nombre, descripción corta, categoría e ícono de cada servicio disponible.

• **Filtro por categoría**: El usuario puede filtrar servicios por categoría (Consultoría, Revisión de documentos, Trámites, Asesoría, Otro).

• **Servicios destacados en el Dashboard**: Un widget en el Dashboard principal muestra un máximo de 3 servicios destacados (`is_featured = true`) con acceso directo, visible para todos los roles.

#### Vista de Detalle y Solicitud de Servicio
• **Detalle del servicio**: Al ingresar a un servicio, se muestra la descripción completa, requisitos y el formulario dinámico para solicitar el servicio.

• **Formulario dinámico configurable**: Cada servicio tiene su propio formulario con campos del tipo: texto corto (input), área de texto, número, fecha, correo electrónico, selección única (select / radio) y selección múltiple (checkbox). Los campos pueden marcarse como obligatorios.

• **Envío de solicitud**: El usuario completa el formulario y lo envía. El sistema registra la solicitud con estado "Pendiente" y notifica al gestor del servicio.

#### Gestión de Servicios (Gestor de Servicios)
• **Creación de servicios**: Un usuario con el flag `is_service_manager` (abogado de la firma) puede crear nuevos servicios desde una vista de administración. Define: nombre, descripción, categoría, estado activo/inactivo, si es destacado, y los campos del formulario.

• **Constructor de formulario dinámico**: El gestor puede agregar, ordenar y eliminar campos del formulario del servicio. Para cada campo define: etiqueta, tipo de campo, placeholder, tooltip explicativo, opciones (para select/radio/checkbox), y si es obligatorio.

• **Edición y desactivación**: El gestor puede editar servicios existentes o desactivarlos sin eliminarlos.

• **Gestión de solicitudes recibidas**: Vista centralizada de todas las solicitudes recibidas. El gestor puede ver las respuestas de cada formulario, cambiar el estado (Pendiente → En revisión → Completado) y agregar notas internas.

#### Mis Solicitudes (Usuario)
• **Historial de solicitudes**: El usuario autenticado puede ver el historial de servicios que ha solicitado, con el estado actual de cada uno (Pendiente, En revisión, Completado).

---

### Beneficios Esperados

• **Visibilidad de la Oferta**: Los clientes pueden conocer todos los servicios disponibles de la firma en un solo lugar.

• **Trazabilidad Completa**: Cada solicitud queda registrada con estado, fecha, datos del formulario y notas del gestor.

• **Reducción de Fricciones**: Elimina la comunicación informal para solicitar servicios, reemplazándola por un flujo estructurado dentro de la plataforma.

• **Escalabilidad**: El sistema de formularios dinámicos permite crear nuevos tipos de servicios sin necesidad de desarrollo adicional.

• **Centralización de Solicitudes**: El gestor recibe todas las solicitudes en un mismo lugar con el historial completo de respuestas.

• **Mayor Conversión**: La exposición de servicios directamente en el Dashboard aumenta la visibilidad y la probabilidad de que los clientes los soliciten.

• **Autonomía del Gestor**: La creación y edición de servicios es autogestionable, sin requerir intervención técnica.

---

### Flujo de Operación

#### Flujo del Usuario Cliente

1. **Acceso al Marketplace**:
   ○ El usuario autenticado (cualquier rol) accede al módulo "Marketplace" desde el Sidebar.
   ○ Alternativamente, desde el Dashboard puede ver servicios destacados y acceder directamente.

2. **Exploración de Servicios**:
   ○ El usuario ve la lista de servicios activos organizados en tarjetas.
   ○ Puede filtrar por categoría para encontrar el servicio que necesita.
   ○ Al hacer clic en un servicio, accede a su vista de detalle.

3. **Solicitud de Servicio**:
   ○ El usuario lee la descripción completa del servicio.
   ○ Completa el formulario dinámico con los campos requeridos por el servicio.
   ○ El sistema valida los campos obligatorios antes de permitir el envío.
   ○ Al enviar, el sistema registra la solicitud con estado "Pendiente" y confirma el envío al usuario.

4. **Seguimiento de Solicitud**:
   ○ El usuario puede acceder a "Mis Solicitudes" desde el módulo Marketplace para ver el historial y estado de sus solicitudes.

#### Flujo del Gestor de Servicios

5. **Creación de un Nuevo Servicio**:
   ○ El gestor (usuario con rol `lawyer` + flag `is_service_manager`) accede a la vista de administración desde el Marketplace.
   ○ Crea un nuevo servicio: define nombre, descripción completa, categoría, estado y si es destacado.
   ○ Agrega campos al formulario usando el constructor: selecciona el tipo de campo, escribe la etiqueta, configura opciones si aplica, y marca si es obligatorio.
   ○ Ordena los campos arrastrando y soltando (o mediante botones de orden) según el flujo deseado.
   ○ Guarda y activa el servicio para que sea visible en el Marketplace.

6. **Gestión de Solicitudes Recibidas**:
   ○ El gestor ve un panel con todas las solicitudes recibidas, ordenadas por fecha.
   ○ Puede filtrar por servicio, estado o fecha.
   ○ Al abrir una solicitud, ve las respuestas del formulario y puede cambiar el estado (Pendiente → En revisión → Completado).
   ○ Puede agregar notas internas visibles para el equipo gestor.

---

### Cambios Transversales en la Aplicación

#### Dashboard
• **Widget de Servicios Destacados**: Nueva tarjeta en el Dashboard principal mostrando hasta 3 servicios marcados como destacados, con acceso directo al detalle del servicio. Visible para todos los roles.
• **Quick Action Button**: Nuevo botón de acceso rápido "Ir al Marketplace" en la sección de acciones rápidas del Dashboard.

#### Sidebar (Barra de Navegación)
• **Nuevo ítem "Marketplace"**: Agregado al array de navegación de `SlideBar.vue`, visible para todos los usuarios autenticados. Se posiciona después de "Archivos Jurídicos".

#### Manual de Usuario
• **Nueva sección "Marketplace de Servicios"**: Explicación de cómo explorar y solicitar servicios, cómo ver el historial de solicitudes.
• **Sección para gestores**: Instrucciones para crear servicios, configurar el constructor de formularios y gestionar solicitudes.

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los usuarios puedan explorar servicios, solicitar y hacer seguimiento desde cualquier dispositivo.

• La gestión de servicios (creación, edición) está restringida a usuarios con rol `lawyer` y el flag `is_service_manager = True`. Este flag es independiente del rol y debe habilitarse desde el panel de administración de Django.

• El constructor de formularios dinámicos soporta los siguientes tipos de campo: `input` (texto corto), `text_area` (texto largo), `number` (número), `date` (fecha), `email` (correo), `select` (desplegable), `radio` (opción única visual), `checkbox` (selección múltiple).

• La integración de notificaciones al gestor tras recibir una solicitud depende del módulo de Centro de Notificaciones (Requerimiento 05). En la primera versión, el gestor puede verificar solicitudes accediendo al panel de gestión.

• Este requerimiento requiere aprobación de diseño antes del desarrollo, especialmente para las vistas del constructor de formularios y las tarjetas del Marketplace.
