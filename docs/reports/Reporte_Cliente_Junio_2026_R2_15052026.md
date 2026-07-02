# Reporte de cambios — Revisión de feedback (Junio 2026 — R2)

A continuación, el detalle de cada punto revisado, con el estado actualizado.

**Convenciones:**
- 🐞 = bug reportado
- 💡 = requerimiento / mejora de UX
- ✅ Atendido | ⏭️ Fuera de alcance | ⚠️ Parcial | 🔄 En curso

---

## 1. Módulo Notificaciones

### 1.1 ✅ Atendido — 🐞 Tabs en móvil se desbordan y la pestaña de notificaciones no permite scroll
> "En la vista dashboard, en móvil, tenemos Notificaciones, Feed, Contactos, Reportes. Reportes se desborda, se sale del contenedor de los tabs. Solo que ajustar el texto dentro de la tarjeta en vista celular ⚠️ incluso para el tema de notificaciones y reducir espacio del texto podría ser solo el ícono de la campanita, o texto más pequeño. Y en el tab de notificaciones no me permite deslizar hacia abajo para ojear las demás notificaciones, diferente a las opciones de Feed y Contactos que sí permiten deslizar ⚠️"

**Qué se hizo:** Dos ajustes en la tarjeta de inicio:

- **Desbordamiento de las pestañas:** Las cuatro pestañas (Notificaciones, Feed, Contactos, Reportes) ahora son más compactas en celular. La pestaña "Notificaciones" muestra únicamente el ícono de campanita en pantallas pequeñas y el texto completo en pantallas más grandes; las demás pestañas usan un texto más pequeño con salto de línea desactivado. Si el espacio es insuficiente, la barra desliza horizontalmente sin desbordar el contenedor.

- **Scroll en la pestaña Notificaciones:** La lista de notificaciones dentro de la tarjeta de inicio ahora tiene desplazamiento vertical, igual que las pestañas de Feed y Contactos. Se muestran hasta 10 notificaciones recientes y el usuario puede deslizar hacia abajo para verlas todas sin salir del dashboard.

**Antes de probar necesitas:**
- Cualquier rol (cliente, abogado, cliente corporativo o básico).
- Tener al menos 3–4 notificaciones recibidas en tu cuenta.
- Estar en el **Panel Principal (Dashboard)**, en la tarjeta con las pestañas Notificaciones / Feed / Contactos / Reportes.

**Cómo validar que funciona:**
1. Inicia sesión y ve al **Panel Principal**.
2. Abre el sitio desde un celular (o reduce el ancho de la ventana del navegador hasta simular una pantalla pequeña).
3. Observa la barra de pestañas: las cuatro opciones deben caber sin salirse del borde. La pestaña "Notificaciones" mostrará solo el ícono de campanita; las demás mostrarán su texto completo en tamaño reducido.
4. Haz clic en la pestaña **Notificaciones** y desliza hacia abajo dentro de la lista. Verás que puedes navegar por tus notificaciones sin que la página entera se mueva.

---

### 1.9 ✅ Atendido — 🐞 Parpadeo de alerta desvanece el texto (revisión)
> "Hay un detalle visual en las alertas que parpadean, el texto se está desvaneciendo con cada parpadeo, creo que es mejor que solo se desvanezca solamente el background en cada parpadeo nada más, y aumentar un poco más la opacidad del background para ser más llamativo. Quedó pendiente ⚠️ — el texto sigue desvaneciéndose, el parpadeo sigue igual que antes."

**Qué se hizo:** Se reemplazó la animación anterior (que afectaba la opacidad de todo el elemento, incluyendo el texto) por una animación propia que actúa únicamente sobre el fondo y el borde de la tarjeta. El texto permanece completamente visible durante todo el ciclo del parpadeo. Esto aplica tanto en la vista de detalle de un **Proceso Judicial** como en la vista de detalle de una **Solicitud de Servicio**.

**Antes de probar necesitas:**
- Ingresar como **abogado** o **cliente** vinculado a un proceso que tenga una alerta activa.
- Abrir el proceso desde **Mis procesos** o desde la notificación.

**Cómo validar que funciona:**
1. Inicia sesión y ve a **Mis procesos**.
2. Abre un proceso que tenga la alerta activa (aparece resaltado con un borde azul).
3. Observa la animación de parpadeo: el fondo de la tarjeta cambia de intensidad con cada ciclo, pero el texto del título, la descripción y las etiquetas permanecen estables y completamente legibles en todo momento.

---

### 1.10 ✅ Atendido — 💡 Etiqueta numérica sobre las pestañas del Centro de Notificaciones (revisión)
> "Hay posibilidades agregar el tag del circulito rojo con el número de acciones pendientes encima de los tabs también? así el usuario pueda visualmente saber cuántas acciones tiene pendientes en la respectiva tab. Quedó pendiente ⚠️ — en el documento que me enviaste la respuesta no tiene relación, se menciona una opción de 'Todas' que no existe."

**Qué se hizo:** El círculo rojo con el número de notificaciones sin leer ya está implementado sobre la pestaña **"Todas"** dentro del Centro de Notificaciones (accesible desde el menú lateral). Si tienes 5 notificaciones sin leer, verás el número "5" en rojo encima de esa pestaña.

La pestaña efectivamente se llama **"Todas"** (no "No leídas" — esa se eliminó en la entrega anterior por solicitud en el punto 1.5). Si en tu navegador aún aparece la versión anterior, por favor recarga la página con Ctrl+F5 o limpia el caché para ver la versión actualizada.

**Antes de probar necesitas:**
- Cualquier rol.
- Al menos una notificación **sin leer** en tu cuenta.
- Estar en el módulo **Notificaciones** (menú lateral).

**Cómo validar que funciona:**
1. Inicia sesión y abre el menú lateral.
2. Haz clic en **Notificaciones**.
3. Mira la barra de pestañas en la parte superior del listado: sobre la pestaña **"Todas"** verás un círculo rojo con el número de notificaciones sin leer.
4. Abre varias notificaciones hasta dejarlas todas como leídas y confirma que el círculo desaparece.

---

### 1.15 ✅ Atendido — 🐞 Abogado no recibe notificación al activar alerta (revisión)
> "Al momento que el abogado activa la alerta en procesos judiciales ya llega al centro de notificaciones del cliente ✅ pero no está llegando al centro de notificaciones del abogado ⚠️."

**Qué se hizo:** Al activar una alerta en un proceso (al crearlo o editarlo), ahora se genera una notificación inmediata tanto para los **clientes** vinculados como para el **propio abogado** que activó la alerta. El comportamiento anterior excluía al abogado-actor, dejándolo sin el aviso en su Centro de Notificaciones.

**Antes de probar necesitas:**
- Ingresar como **abogado**.
- Tener o crear un proceso con al menos una etapa.

**Cómo validar que funciona:**
1. Inicia sesión como abogado y ve a **Mis procesos**.
2. Abre o crea un proceso y activa el toggle **"Alerta activa"** en la sección de etapas.
3. Guarda el proceso.
4. Ve al **Centro de Notificaciones** (menú lateral → Notificaciones): verás la notificación de alerta recién activada tanto en tu cuenta (abogado) como, si marcaste "Notificar al cliente", en la cuenta del cliente vinculado.

---

## 2. Módulo Procesos

### 2.1 ✅ Atendido — 🐞 Editar un proceso no envía correo electrónico a los involucrados
> "No está llegando notificación al correo electrónico de las ediciones de los procesos judiciales ⚠️"

**Qué se hizo:** Cuando el abogado o administrador edita un proceso, ahora se envía automáticamente un correo electrónico al abogado y a todos los clientes vinculados al proceso, resumiendo que hubo una actualización. El correo llega con el asunto **"Proceso actualizado — [referencia del proceso]"**.

Si el envío del correo falla por un problema técnico temporal (por ejemplo, el servidor de correo no responde), la plataforma no muestra un error al usuario — la edición se guarda correctamente de todas formas.

**Antes de probar necesitas:**
- Ingresar como **abogado** o **administrador**.
- Tener un proceso con al menos un cliente vinculado (cuyo correo sea válido y accesible).

**Cómo validar que funciona:**
1. Inicia sesión como abogado y ve a **Mis procesos**.
2. Abre cualquier proceso y edita cualquier campo (por ejemplo, la autoridad o el demandante).
3. Guarda los cambios.
4. Revisa el correo del abogado y del cliente vinculado: ambos deben recibir un mensaje con el asunto **"Proceso actualizado — [referencia]"**.

---

## 3. Unificación visual

### 3.1 ✅ Atendido — 💡 Botones "Firma" y "Membrete" alineados a la izquierda para todos los roles (revisión)
> "Actualmente el usuario Rol Admin tiene una vista de los botones 'firma' y 'membrete' con fondo blanco en el lado izquierdo de la pantalla que luce muy bien ✅ Lo ideal sería replicar o unificar esa misma vista para todos los roles de esos botones a la izquierda con background blanco. El background blanco de los botones quedó OK ✅ solo que no fueron trasladados a la parte izquierda de la pantalla ⚠️."

**Qué se hizo:** Los botones **"Firma Electrónica"** y **"Membrete Global"** ahora están alineados a la izquierda para todos los roles, con el mismo estilo de fondo blanco que ya tenía el rol Admin. La alineación y el estilo son uniformes independientemente del rol con el que se ingrese.

**Antes de probar necesitas:**
- Ingresar con un rol distinto a Admin — por ejemplo, **cliente**, **abogado** o **cliente corporativo**.
- Estar en el módulo **Archivos Jurídicos**.

**Cómo validar que funciona:**
1. Inicia sesión con tu usuario habitual (no Admin).
2. Ve a **Archivos Jurídicos**.
3. Observa los botones "Firma Electrónica" y "Membrete Global": deben aparecer alineados a la **izquierda** de la barra de acciones, con fondo blanco, igual que como los ve un Admin.

---

### 3.2 ✅ Atendido — 💡 Barras de acciones en Procesos y Archivos Jurídicos con diseño unificado (revisión)
> "Unificar visualmente la barra de acciones en las secciones 'Archivos Jurídicos' y 'Procesos'. Las barras de las secciones 'Contratación Estatal' y 'Servicios y Solicitudes' mantienen un diseño estandarizado que luce muy bien, solo que la misma línea de diseño no se mantiene en las demás secciones. Sigue pendiente ⚠️."

**Qué se hizo:** Las barras de pestañas y filtros de los módulos **Procesos** y **Archivos Jurídicos** ahora tienen el mismo estilo que Contratación Estatal y Servicios y Solicitudes: tarjeta blanca con esquinas redondeadas, sombra suave y borde sutil. La identidad visual es consistente en toda la plataforma.

**Antes de probar necesitas:**
- Cualquier rol con acceso a los módulos Procesos y Archivos Jurídicos.

**Cómo validar que funciona:**
1. Inicia sesión y ve a **Mis procesos**: observa que la barra de búsqueda y las pestañas de estado están dentro de una tarjeta blanca con borde suave.
2. Ve a **Archivos Jurídicos**: la barra de pestañas (Pendientes, Firmados, Archivados, etc.) tiene el mismo estilo de tarjeta.
3. Compara con **Contratación Estatal** o **Servicios y Solicitudes**: el aspecto visual debe ser idéntico en todos los módulos.

---

### 3.3 ✅ Atendido — 💡 Botón "+ Nueva Carpeta" demasiado grande en celular (revisión)
> "Reducir botón '+ Nueva Carpeta' a tamaño estándar y en la vista celular ese botón se ve muy grande. El botón continúa con el mismo tamaño ⚠️."

**Qué se hizo:** El botón "+ Nueva Carpeta" se redujo al tamaño estándar de los demás botones de la plataforma (mismo relleno, mismo tamaño de texto e ícono). En celular ya no ocupa el ancho completo de la pantalla sino que se ajusta al contenido, como los demás botones.

**Antes de probar necesitas:**
- Cualquier rol con acceso al módulo de Archivos Jurídicos.
- Ver desde un celular o reducir el ancho de la ventana del navegador.

**Cómo validar que funciona:**
1. Abre la plataforma desde tu celular (o simula la vista de celular en el navegador).
2. Ve a **Archivos Jurídicos**.
3. Observa el botón "+ Nueva Carpeta": debe ser del mismo tamaño que los otros botones del módulo, sin ocupar el ancho completo de la pantalla.

---

## 4. Módulo Servicios y Solicitudes — Administración

### 4.1 ✅ Atendido — 💡 Aumentar límite de caracteres en el campo "Texto de Ayuda"
> "Hay posibilidad de aumentar el número de caracteres que se pueden ingresar en la opción de Texto Ayuda — subir el límite de 255 caracteres a 1.000 caracteres, es que hay algunos formularios donde suministramos amplia información para que la gente lo diligencie bien y no haya reprocesos."

**Qué se hizo:** El campo **"Texto de Ayuda"** en el editor de formularios de servicios ahora acepta hasta **1.000 caracteres** (antes el límite era 255). El cambio aplica al crear o editar cualquier campo de un formulario de servicio. Los textos de ayuda existentes que ya tenían 255 caracteres o menos no se ven afectados.

**Antes de probar necesitas:**
- Ingresar como **administrador** o **abogado** con acceso a Administrar Servicios.
- Estar en la vista de edición de un servicio.

**Cómo validar que funciona:**
1. Inicia sesión como administrador y ve a **Administrar Servicios**.
2. Abre cualquier servicio y edita uno de sus campos de formulario.
3. En el campo **"Texto de Ayuda"**, escribe o pega un texto de más de 255 caracteres (hasta 1.000).
4. Guarda el cambio: la plataforma debe aceptarlo sin mostrar error de longitud.

---

### 4.2 ✅ Atendido — 🐞 Error 500 al guardar en Administrar Servicios
> "En el equipo me reportaron que el Módulo Administrar Servicios está apareciendo un error código 500 cuando van a dar guardar y no se sabe el motivo."

**Qué se hizo:** Se identificaron dos situaciones que provocaban ese error:

1. **Orden duplicado en los campos:** si al reorganizar los campos de un formulario dos campos quedaban con el mismo número de orden, el sistema fallaba internamente en lugar de mostrar un mensaje claro. Ahora el sistema detecta el conflicto y muestra un mensaje de error específico indicando cuál campo tiene el orden repetido.

2. **Campo de selección sin opciones:** si se guardaba un campo de tipo "Selección" sin haber definido las opciones de la lista, también producía el error 500. Ahora la validación ocurre antes de guardar y se muestra el mensaje: "Las opciones son obligatorias para campos de selección."

En ambos casos, el proceso ya no falla silenciosamente — el usuario recibe un mensaje que le indica qué corregir, y los datos no se pierden.

**Antes de probar necesitas:**
- Ingresar como **administrador** o **abogado** con acceso a Administrar Servicios.
- Estar en la vista de edición de un servicio con al menos un campo de formulario.

**Cómo validar que funciona:**
1. Inicia sesión como administrador y ve a **Administrar Servicios**.
2. Edita un servicio y asigna el mismo número de orden a dos campos distintos. Al guardar, debe aparecer un mensaje de error claro indicando el conflicto, en lugar del error 500.
3. Crea o edita un campo de tipo **"Selección simple"** (o doble) y guarda sin agregar opciones. Debe aparecer el mensaje: "Las opciones son obligatorias para campos de selección."

---

## 5. Documentos PDF

### 5.1 ✅ Atendido — 🐞 Los PDFs generados muestran el texto corrido sin espaciado
> "Los documentos que genera la intranet están saliendo con textos corridos — PDFs ⚠️"

**Qué se hizo:** Los PDFs generados por la plataforma (tanto los documentos de Archivos Jurídicos como los de Solicitudes de Servicio) ahora respetan los saltos de línea, párrafos y espaciado del texto original. El problema se presentaba cuando el texto contenía palabras largas o párrafos sin espacios, que se "pegaban" entre sí al renderizar el PDF. Esto ya no ocurre.

**Antes de probar necesitas:**
- Cualquier rol con acceso a generar o descargar PDFs.
- Tener un proceso, archivo jurídico o solicitud de servicio con documentos adjuntos o generados.

**Cómo validar que funciona:**
1. Inicia sesión y ve a cualquier documento que puedas descargar como PDF (por ejemplo, desde **Archivos Jurídicos** o desde el detalle de una **Solicitud de Servicio**).
2. Descarga o genera el PDF.
3. Abre el archivo: el texto debe mostrarse con párrafos, saltos de línea y espaciado normal, sin bloques de texto pegados o corridos.

---

## Resumen de cobertura

| Categoría | Total puntos | ✅ Atendidos | ⚠️ Parciales | ⏭️ Fuera de alcance |
|---|---|---|---|---|
| Módulo Notificaciones (1.x) | 4 | 4 | 0 | 0 |
| Módulo Procesos (2.x) | 1 | 1 | 0 | 0 |
| Unificación visual (3.x) | 3 | 3 | 0 | 0 |
| Administrar Servicios (4.x) | 2 | 2 | 0 | 0 |
| Documentos PDF (5.x) | 1 | 1 | 0 | 0 |
| **TOTAL** | **11** | **11** | **0** | **0** |

Los 11 puntos de esta segunda revisión quedaron atendidos en su totalidad. Quedamos atentos a cualquier ajuste o duda sobre algún punto específico.
