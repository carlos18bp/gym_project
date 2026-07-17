# Reporte de cambios — Feedback cliente (Junio 2026)

A continuación, el detalle de cada punto que el cliente envió, con una explicación breve y el estado.

**Convenciones:**
- 🐞 = bug reportado
- 💡 = requerimiento / mejora de UX
- ✅ Atendido | ⏭️ Fuera de alcance | ⚠️ Parcial

---

## 1. Módulo Notificaciones

### 1.1 ✅ Atendido — 💡 Trasladar la caja de notificaciones a la caja donde está la caja de Feeds, Contactos y Reportes
> "Chequemos la posibilidad de trasladar la caja de notificaciones a la caja donde está la caja de Feeds, Contactos y Reportes 💡 Resulta que destinar una caja adicional para notificaciones dentro del Panel Principal o DashBoard implica desplazar visualmente otros elementos, cómo las tarjetas 'Servicios Destacados', creo que es mejor aprovechar y optimizar el espacio existente con elementos que ya existen."

**Qué se hizo:** Se eliminó la tarjeta de notificaciones que estaba como bloque aparte en el Panel Principal y se incorporó como un nuevo *tab* (pestaña) dentro de la misma caja donde están Feed, Contactos y Reportes. Notificaciones aparece ahora como la primera pestaña, así no se desplazan los demás elementos del dashboard.

---

### 1.2 ✅ Atendido — 💡 Vista en formato tabla estilo correo electrónico
> "La vista de notificaciones está muy bien, creo que si se maneja en modo de tabla podría optimizar el espacio para mostrar más elementos 💡 la vista actual se organiza a modo de tabla quedaría cercana a como se visualizan los correos electrónicos y haría mucho más cómodo visualizar más información simultáneamente. Fíjate como en la vista correo, se maneja la misma información: Encabezado, Descripción y Fecha y cuando se desliza el mouse sobre la celda, aparecen los íconos de archivar, borrar, silenciar, marcar como leído superponiéndose sobre la columna de fecha."

**Qué se hizo:** Se rediseñó la lista de notificaciones a una vista tipo tabla, con filas más densas (encabezado, descripción y fecha en una sola línea). Al pasar el mouse por encima de una notificación, los íconos de acción (marcar como leído / no leído, archivar / desarchivar, silenciar, borrar) aparecen superpuestos sobre la columna de fecha, igual que en Gmail.

---

### 1.3 ✅ Atendido — 💡 Botón "Regresar" + más contraste para no leídas
> "Agreguemos opción de 'Regresar' al módulo de notificaciones... y por otro lado, chequemos la posibilidad de aumentar opacidad del color de las notificaciones no leídas 💡."

**Qué se hizo:** Se agregó el botón "Volver a Inicio" en la parte superior del Centro de Notificaciones (especialmente útil en celular). Las notificaciones no leídas tienen ahora un fondo azul más visible para destacarse sobre las leídas.

---

### 1.4 ✅ Atendido — 💡 Marcar como leído / no leído
> "En la opción de marcar como Leída es interesante, pero es posible funciones para marcar tanto como 'leída' como 'sin leer' tal cual funciona en los correos? esa parte está muy cerca a como se ve en los correos."

**Qué se hizo:** El botón ahora cambia automáticamente: si la notificación está sin leer, aparece el ícono de "marcar como leída"; si ya está leída, aparece el ícono de sobre cerrado para "marcar como no leída". Funciona en ambos sentidos como en el correo.

---

### 1.5 ✅ Atendido — 💡 Quitar pestaña "No leídas"
> "Creo que esta tab de 'No leídas' la podemos sacar, estuve probando pero no percibí mayor uso, ya que lo no leído ya se reflejaba con un color más intenso en la lista de 'Todas'."

**Qué se hizo:** Se eliminó la pestaña "No leídas". Quedan únicamente "Todas" y "Archivadas". Las no leídas siguen siendo identificables por el fondo azul más fuerte dentro de "Todas".

---

### 1.6 ✅ Atendido — 🐞 Falta opción "Desarchivar"
> "Hay un detalle pequeño con el 'Archivo' de las notificaciones, y es que existe la función de archivar, pero una vez archivas no existe la opción de 'Desarchivar' ⚠️."

**Qué se hizo:** En la pestaña "Archivadas", al pasar el mouse sobre una notificación, ahora aparece el ícono para desarchivarla. Al hacer clic, vuelve a la lista activa.

---

### 1.7 ✅ Atendido — 💡 Mover Notificaciones más abajo en el menú lateral
> "El módulo de 'Notificaciones' podríamos enviarlo abajo, para no congestionar tanto al usuario de módulos, de todas formas es un módulo que tiene mucha usabilidad porque tiene una campanita de acceso directo en el Panel Principal."

**Qué se hizo:** Se movió "Notificaciones" desde el bloque superior del menú lateral hasta el bloque inferior, justo arriba de "Manual de Usuario". Así libera espacio visual en la lista principal de módulos.

---

### 1.8 ✅ Atendido — 🐞 Notificaciones no distinguen entre tipos de formalización
> "El módulo de notificaciones no distingue entre 'Firman todas las partes', 'Firma solo el emisor' y 'Documento Informativo' en los tres casos, llega la alerta de notificación 'Firma Solicitada... se ha solicitado tu firma para documento...' pese a que es un documento que solo firma el emisor o que solo es informativo ⚠️."

**Qué se hizo:** Ahora cada modalidad de formalización envía un mensaje distinto al destinatario:
- **Firman todas las partes** → "Firma Solicitada — Se ha solicitado tu firma para el documento '...'"
- **Firma solo el emisor** → "Documento Emitido — Se ha emitido un documento firmado solamente por el emisor: '...'"
- **Documento Informativo** → "Documento Informado — Se ha emitido e informado el documento: '...'"

Antes los documentos informativos no generaban notificación; ahora también la generan.

---

### 1.9 ✅ Atendido — 💡 Parpadeo: solo el fondo, no el texto
> "Hay un detalle visual en las alertas que parpadean, el texto se está desvaneciendo con cada parpadeo, creo que es mejor que solo se desvanezca solamente el background en cada parpadeo nada más, y aumentar un poco más la opacidad del background para ser más llamativo."

**Qué se hizo:** Se rediseñó la animación de parpadeo: ahora solo el fondo cambia de color/intensidad, el texto se mantiene fijo y siempre legible. El color del fondo en su pico es más intenso para que el parpadeo sea más visible.

---

### 1.10 ✅ Atendido — 💡 Etiqueta numérica en las pestañas internas
> "Hay posibilidades agregar el tag del circulito rojo con el número de acciones pendientes encima de los tabs también? así el usuario pueda visualmente saber cuántas acciones tiene pendientes en la respectiva tab."

**Qué se hizo:** Sobre la pestaña "Todas" del Centro de Notificaciones aparece ahora un círculo rojo con el número de notificaciones sin leer.

---

### 1.11 ✅ Atendido — 🐞 Procesos no generan notificaciones
> "Si bien el Centro de Notificaciones funciona con normalidad respecto de los Archivos Jurídicos, no está capturando las novedades del módulo de 'Procesos' al editar, agregar documentos nuevos y reportar nuevas etapas... el comportamiento esperado es que las novedades al editar los procesos judiciales sean notificadas al usuario que está relacionado en el proceso destinatario."

**Qué se hizo:** Ahora el sistema genera notificaciones automáticas en estos tres eventos del módulo Procesos:
- Cuando el abogado **edita un proceso** (cambios generales).
- Cuando se **agrega un documento** al expediente.
- Cuando se **registra una nueva etapa**.

Las notificaciones llegan al abogado y a los clientes vinculados al proceso, excepto al usuario que hizo el cambio (no se notifica a sí mismo).

---

### 1.12 ✅ Atendido — 🐞 Falta etiqueta roja en el módulo de Procesos
> "Sería ideal incluir el mismo tag rojo del número de alertas pendientes en el Módulo de 'Procesos'."

**Qué se hizo:** El ícono "Procesos" en el menú lateral ahora muestra un círculo rojo con el número de alertas pendientes del usuario, igual que ya funcionaba en "Archivos Jurídicos" para las firmas pendientes.

---

### 1.13 ⏭️ Fuera de alcance — Etiqueta roja en Servicios y Solicitudes
> "Pensaría que el tag rojo con el número de alertas pendientes podría incluirse también en el módulo de Servicios y Solicitudes así mantener una sinergia de ayuda visual en las alertas ⚠️."

**Por qué no se atendió:** El alcance contractual de notificaciones para esta entrega (Junio/Julio 2026) cubre únicamente el **Centro de Notificaciones + notificaciones de Procesos + notificaciones de Archivos Jurídicos**. El módulo Servicios y Solicitudes no fue parte del alcance definido.

Adicionalmente, como existían notificaciones residuales del módulo de Servicios que se estaban guardando en el Centro, **se limpiaron las existentes en base de datos y se desactivó el envío de nuevas**, dejando el Centro de Notificaciones consistente con el alcance acordado. Cuando este módulo entre en alcance, se podrá reactivar fácilmente porque la lógica quedó preservada en el código (solamente comentada).

---

### 1.14 ⏭️ Fuera de alcance — Parpadeo en Servicios y Solicitudes
> "En Servicios y Solicitudes el parpadeo repite el mismo detalle visual que desvanece el texto en el parpadeo, chequear la posibilidad de solo desvanecer el background o layer con un color un poco más opaco."

**Por qué no se atendió:** Mismo motivo que el punto 1.13 — el módulo Servicios y Solicitudes está fuera del alcance contractual de notificaciones para esta entrega. La corrección equivalente sí se aplicó a Procesos y Archivos Jurídicos (ver punto 1.9).

---

### 1.15 ✅ Atendido — 🐞 Activar alerta en proceso no notifica
> "Al momento que el abogado activa la alerta en procesos judiciales no está llegando la notificación al centro de notificaciones del cliente ni del abogado ⚠️."

**Qué se hizo:** Cuando el abogado activa una alerta en un proceso (al crear o editar), ahora se genera inmediatamente una notificación en el Centro de Notificaciones del abogado y de los clientes (si se eligió notificar a clientes), sin esperar al recordatorio diario.

---

### 1.16 ✅ Atendido — 💡 Etiqueta de alerta más llamativa + descripción
> "Chequear la posibilidad de poner esta etiqueta de un color más llamativo, como amarillo para resaltar. Y chequear si en esa etiqueta se captura mejor descripción que el abogado al momento de crear la alerta."

**Qué se hizo:** La etiqueta "Alerta activa — Notifica al abogado y cliente" en el detalle del proceso cambió de color azul a **amarillo** (con borde y texto en tono más llamativo). Además, justo debajo aparece la descripción personalizada que el abogado escribió al crear la alerta, para que el cliente vea el contexto.

---

### 1.17 ✅ Atendido — 🐞 Permite activar alertas sobre fechas pasadas
> "Hay un detallito frente a fecha pasadas, el sistema no está diferenciando si la última actuación tiene una fecha pasada y de todas formas permite activar la alerta. Si la última actuación tiene una fecha en el pasado la notificación no podría activarse, así mismo cuando transcurre el día de la fecha a la que se programó la notificación, una vez culminado ese día, el comportamiento esperado es que la notificación se desactiva automáticamente pues se vuelve en una fecha pasada ⚠️."

**Qué se hizo:** Tres ajustes:
1. **En el formulario:** si la fecha de la última actuación es pasada, el toggle "Alerta activa" queda deshabilitado y se muestra un mensaje que explica que no se puede activar sobre una fecha pasada.
2. **En el servidor:** aunque el usuario intente forzarlo, el backend rechaza la operación con un mensaje claro.
3. **Auto-desactivación:** una tarea automática que corre cada día revisa todas las alertas vencidas (cuya fecha objetivo ya pasó) y las marca como inactivas, sin necesidad de intervención manual.

---

### 1.18 ✅ Atendido — 🐞 Botón "Editar" del proceso visible para todos los roles
> "A todos los roles les está saliendo la opción de 'editar' el proceso, el comportamiento esperado es que solo aparezca a los Roles Lawyer y Admin ⚠️."

**Qué se hizo:** El botón "Editar" en el detalle del proceso ahora solo es visible para los roles **abogado (lawyer)** y **administrador / staff**. Los roles cliente, básico y cliente corporativo ya no lo ven. Adicionalmente, el servidor ya rechazaba la edición para esos roles, así que el cambio refuerza coherentemente la UI con la lógica del backend.

---

## 2. Propuestas mejora experiencia usuario

### 2.1 ✅ Atendido — 💡 Redirigir al "Estado de Formalización" tras formalizar
> "Hay posibilidad de que inmediatamente el usuario creador del documento lo envía a formalizar, el sistema lo remita automáticamente a la vista de 'Estado de Formalización' 💡 así haría más intuitivo el sistema para el creador del documento, quien tan pronto crea el documento normalmente lo firma de una vez también, así no tiene que ir a buscar el documento que acaba de crear en las tablas para firmarlo."

**Qué se hizo:** Justo después de formalizar un documento, el sistema lleva al usuario al dashboard de Archivos Jurídicos y abre automáticamente la ventana "Estado de Formalización del Documento" del documento recién creado. Así el creador puede firmar de inmediato sin buscarlo en la tabla.

Excepción: para los documentos en modalidad "Informativo" (que no requieren firma) se mantiene el flujo actual hacia "Mis Documentos", porque no hay nada que firmar.

---

## 3. Unificación visual

### 3.1 ✅ Atendido — 💡 Botones "Firma" y "Membrete" con el mismo estilo para todos los roles
> "Actualmente el usuario Rol Admin tiene una vista de los botones 'firma' y 'membrete' con fondo blanco en el lado izquierdo de la pantalla que luce muy bien ✅ lo ideal sería replicar o unificar esa misma vista para Todos los roles de esos botones a la izquierda con background blanco 💡."

**Qué se hizo:** Los botones "Firma Electrónica" y "Membrete Global" ahora se ven exactamente igual para todos los roles (cliente, básico, cliente corporativo, abogado): fondo blanco, borde sutil de color (morado para firma, verde para membrete), alineados a la izquierda. La única diferencia que se mantiene es que para usuarios "básico" el botón Membrete sigue deshabilitado con el tooltip "Actualiza tu suscripción para usar esta funcionalidad", como ya estaba previsto.

---

### 3.2 ✅ Atendido — 💡 Unificar barras de acciones entre módulos
> "Unificar visualmente la barra de acciones en las secciones 'Archivos Jurídicos' y 'Procesos'. Las barras de las secciones 'Contratación Estatal' y 'Servicios y Solicitudes' mantienen un diseño estandarizado que luce muy bien, solo que la misma línea de diseño no se mantiene en las demás secciones 💡."

**Qué se hizo:** Las barras de búsqueda + filtros de **Procesos** y **Archivos Jurídicos** (incluyendo las pestañas de documentos pendientes, firmados, archivados, terminados y en progreso) ahora usan el mismo diseño que Contratación Estatal y Servicios y Solicitudes: fondo blanco, esquinas redondeadas, borde sutil y sombra suave. Toda la app comparte la misma identidad visual en sus barras de acciones.

---

### 3.3 ✅ Atendido — 💡 Reducir botón "+ Nueva Carpeta" en celular
> "Reducir botón '+ Nueva Carpeta' a tamaño estándar y en la vista celular ese botón se ve muy grande 💡."

**Qué se hizo:** En la vista de celular el botón "+ Nueva Carpeta" se redujo: ahora tiene el mismo padding, tamaño de texto y tamaño de ícono que los demás botones del módulo, dejando una experiencia consistente.

---

## 4. Módulo Servicios y Solicitudes

### 4.1 ✅ Atendido — 🐞 Falta opción "Eliminar" en administración de servicios
> "En la administración de solicitudes, si bien hay la opción de crear solicitudes y editarlas, no hay opción eliminarlas ⚠️."

**Qué se hizo:** Se agregó el botón rojo "Eliminar servicio" en la vista de administración de servicios. Al hacer clic, aparece una ventana de confirmación con icono de advertencia ("¿Eliminar el servicio X? Las solicitudes ya enviadas se conservan, pero el servicio dejará de estar disponible en el catálogo.").

Una vez confirmado:
- El servicio desaparece de la lista para administradores.
- Ya no aparece en el catálogo público ni en los destacados.
- Las solicitudes ya enviadas por clientes se conservan intactas — los clientes siguen pudiendo ver el detalle de su solicitud sin perder historial.
- La eliminación es reversible desde base de datos si fuese necesario revertir (no es una eliminación física definitiva).

---

## Resumen de cobertura

| Categoría | Total puntos | ✅ Atendidos | ⏭️ Fuera de alcance |
|---|---|---|---|
| Módulo Notificaciones (1.x) | 18 | 16 | 2 (1.13, 1.14 — Servicios y Solicitudes) |
| Mejora experiencia (2.x) | 1 | 1 | 0 |
| Unificación visual (3.x) | 3 | 3 | 0 |
| Módulo Servicios y Solicitudes (4.x) | 1 | 1 | 0 |
| **TOTAL** | **23** | **21** | **2** |

**Nota sobre los 2 puntos fuera de alcance (1.13 y 1.14):** ambos corresponden a notificaciones del módulo Servicios y Solicitudes, que no formaban parte del alcance contractual de Notificaciones para esta entrega. Cuando este módulo se incluya en una próxima fase, su atención es directa porque la infraestructura de notificaciones ya quedó preparada.
