# Reporte de cambios — Revisión de bugs Archivos Jurídicos y Dashboard (2 de julio de 2026)

> Respuesta al reporte de bugs enviado el **02/07/2026** (`reporte_bugs_02072026.md`), con dos puntos de la sección **Archivos Jurídicos**, uno de generación de documentos y uno del **Dashboard**. Los 4 puntos quedaron atendidos y se pueden probar en el ambiente de **staging** de G&M Consultores Jurídicos.

**Convenciones:**
- 🐞 = bug reportado
- 💡 = requerimiento / mejora de UX
- ✅ Atendido | ⏭️ Fuera de alcance | ⚠️ Parcial | 🔄 En curso

**Ambiente de pruebas:** `https://gmconsultoresjuridicos.projectapp.co` (es el ambiente de **pruebas/staging**, separado del sitio real; podés probar con confianza sin afectar producción).

**Cómo iniciar sesión (una sola vez, sirve para los 4 puntos):**
1. Abre en el navegador `https://gmconsultoresjuridicos.projectapp.co/sign_in`.
2. Ingresa con una cuenta de **abogado** (correo y contraseña de abogado que te compartimos). Los puntos 1, 2 y 3 son del módulo Archivos Jurídicos y requieren rol abogado; el punto 4 se ve con cualquier rol.
3. Al entrar, quedarás en el **Panel Principal (Dashboard)**. Desde ahí seguís las URLs de cada punto (si abrís una URL sin haber iniciado sesión, el sistema te llevará primero al login y luego a la página).

---

## Resumen rápido

| Clasificación | Cantidad |
|---|---:|
| ✅ Atendido | 4 |
| **Total puntos** | **4** |

| # | Punto | Estado |
|---|---|---|
| 1 | Espaciado alterado entre párrafos y cuadros al exportar a Word/PDF | ✅ Atendido |
| 2 | Documentos "Archivados" se previsualizan sin diligenciar | ✅ Atendido |
| 3 | No permite fijar fecha límite de firma al reenviar un documento archivado | ✅ Atendido |
| 4 | El texto del tab seleccionado se desplaza hacia arriba (notificaciones del dashboard) | ✅ Atendido |

---

## 1. ✅ Atendido — 🐞 Espaciado alterado entre párrafos y cuadros al exportar a Word/PDF

> **Observación del cliente:** "El documento deja demasiado separados los párrafos respecto de los cuadros (tablas), y también los cuadros entre sí. Aunque en el editor de texto los cuadros y párrafos se visualizan con el espaciado correcto, al generar el documento en Word o PDF el espaciado se altera."

**Qué se hizo:** Se unificó el espaciado en los tres lugares donde se ve el documento: el **editor de texto**, el archivo **Word** y el archivo **PDF**. Ahora los tres usan exactamente la misma separación entre párrafos y cuadros, de modo que lo que se ve en el editor es lo que sale en el documento exportado.

Durante la revisión encontramos, además, un problema más profundo en la generación de **Word** que aprovechamos para corregir: en documentos con cuadros, el contenido podía salir **duplicado** (el texto de las celdas se repetía como párrafos sueltos después de cada cuadro). Eso también quedó resuelto: cada párrafo y cada cuadro aparece una sola vez y en su lugar.

**Nota sobre este cambio:** los documentos Word que se descarguen de ahora en adelante se verán un poco **más compactos** que los anteriores (la separación entre párrafos ahora es la del editor). Es el comportamiento solicitado: el exportado respeta lo que muestra el editor.

**Dónde se ve / URL:** `https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?lawyerTab=legal-documents` — módulo **Archivos Jurídicos** → pestaña **Minutas** (o **Mis Documentos**, según dónde tengas el contrato con cuadros) → menú de acciones del documento → **Editar** / **Descargar PDF** / **Descargar Word**.

**Antes de probar necesitas:**
- Iniciar sesión como **abogado** (ver "Cómo iniciar sesión" arriba).
- Un documento de tipo contrato que combine párrafos y cuadros (tablas), como el contrato de compraventa del ejemplo del reporte. Si no tenés uno a mano, avísanos y lo dejamos cargado.
- Empezar desde la URL de arriba (módulo **Archivos Jurídicos** → pestaña **Minutas**).

**Cómo validar que funciona:**
1. Abre `https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?lawyerTab=legal-documents` (si no iniciaste sesión, primero te llevará al login). La página abre en la pestaña **Minutas**.
2. Ubica el contrato con cuadros y abre su **menú de acciones** (el botón de opciones de la fila, con forma de tres puntos; se abre una ventana con las acciones disponibles). Elige **Editar** para verlo en el **editor de texto** y observa la separación entre el primer cuadro, el párrafo de la cláusula y el segundo cuadro: esa es la referencia "correcta".
3. Vuelve a abrir el **menú de acciones** del mismo documento y elige **Descargar PDF**; abre el archivo descargado: la separación entre párrafos y cuadros debe verse **igual que en el editor**, sin espacios en blanco amplios.
4. Otra vez en el **menú de acciones**, elige **Descargar Word**; abre el archivo: mismo espaciado que el editor, **sin texto duplicado** después de los cuadros y sin cuadros pegados entre sí.
5. Resultado esperado: los tres (editor, PDF y Word) muestran la misma separación; el Word ya no repite el texto de las celdas ni deja huecos grandes.

---

## 2. ✅ Atendido — 🐞 Documentos "Archivados" se previsualizan sin diligenciar

> **Observación del cliente:** "Los documentos que están en estado 'Archivado', al previsualizarlos, se muestran sin diligenciar. En la previsualización aparecen las variables del documento entre llaves (`{{ nombre_variable }}`) sin renderizar; es decir, se muestra el nombre de la variable en lugar del valor que debería tomar cada una."

**Qué se hizo:** La previsualización de los documentos archivados ahora muestra el documento **diligenciado**, con cada variable reemplazada por su valor real (nombre del contratista, número de contrato, fechas, etc.), igual que ocurre con los documentos formalizados o firmados. El problema era que la previsualización solo reemplazaba las variables para algunos estados del documento y los archivados quedaban por fuera.

**Observación adicional del reporte:** la diferencia detectada entre `{{ Numero_porroga }}` (con typo) y `{{ Numero_prorroga }}` es un error de escritura **dentro de la plantilla de ese documento específico**, no un problema de la plataforma. Si en algún documento esa variable no se reemplaza, es porque el nombre escrito en la plantilla no coincide con la variable definida; contamos con una herramienta interna para corregir esos casos — si lo ven en algún documento, indíquennos cuál y lo corregimos.

**Dónde se ve / URL:** `https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?lawyerTab=archived-documents` — módulo **Archivos Jurídicos** → pestaña **Dcs. Archivados** → acción **Previsualizar** de un documento.

**Antes de probar necesitas:**
- Iniciar sesión como **abogado**.
- Tener al menos un documento en la pestaña **Dcs. Archivados** (un documento rechazado o expirado), por ejemplo la prórroga del ejemplo del reporte.
- Empezar desde la URL de arriba (te deja directo en la pestaña de archivados).

**Cómo validar que funciona:**
1. Abre `https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?lawyerTab=archived-documents` (si no iniciaste sesión, primero te llevará al login). La página abre en la pestaña **Dcs. Archivados**.
2. Sobre el documento archivado, abre su **menú de acciones** (el botón de opciones de la fila, con forma de tres puntos; se abrirá una ventana con las acciones disponibles) y elige **Previsualizar**.
3. Resultado esperado: el documento se ve **diligenciado**, con los **valores reales** (nombres, cédulas, fechas, números de contrato) en lugar de los marcadores `{{ ... }}`. No debe quedar ningún texto entre llaves visible.

---

## 3. ✅ Atendido — 🐞 No permite fijar fecha límite de firma al reenviar un documento archivado

> **Observación del cliente:** "Cuando un documento se archiva y luego se retoma para enviarlo a firma, el sistema no permite fijar una fecha límite para la firma: la opción no aparece."

**Qué se hizo:** Al retomar un documento archivado para reenviarlo a firma, ahora aparece el campo **"Fecha límite para firmar (opcional)"**, igual que en el envío a firma por primera vez.

Además corregimos un problema relacionado que detectamos durante la revisión: si el documento se había **expirado** con una fecha límite ya vencida, al reenviarlo el sistema conservaba esa fecha vieja por dentro y el documento podía volver a expirar de inmediato. Ahora la fecha vencida se descarta: el campo aparece vacío (o con la fecha anterior solo si todavía es futura), y si se deja vacío el documento se reenvía **sin** fecha límite.

**Dónde se ve / URL:** `https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?lawyerTab=archived-documents` — módulo **Archivos Jurídicos** → pestaña **Dcs. Archivados** → acción **Editar y reenviar para firma** de un documento.

**Antes de probar necesitas:**
- Iniciar sesión como **abogado**.
- Un documento en la pestaña **Dcs. Archivados** (rechazado o expirado).
- Empezar desde la URL de arriba (pestaña de archivados).

**Cómo validar que funciona:**
1. Abre `https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?lawyerTab=archived-documents` (si no iniciaste sesión, primero te llevará al login). Abre en la pestaña **Dcs. Archivados**.
2. Abre el **menú de acciones** del documento (el botón de opciones de la fila, con forma de tres puntos) y, en la ventana de acciones, elige **Editar y reenviar para firma**.
3. En el formulario de corrección, ubica el campo **"Fecha límite para firmar (opcional)"** (justo debajo aparece la nota: *"Después de esta fecha, el documento pasará automáticamente al estado 'Expirado' si no ha sido firmado completamente. Déjala vacía para reenviar sin fecha límite."*) y selecciona una **fecha futura**.
4. Presiona **Guardar y reenviar para firma**. Resultado esperado: el documento pasa a la pestaña **Dcs. Por Firmar** (`...?lawyerTab=pending-signatures`) y muestra la fecha límite elegida en la columna de fecha límite.
5. Repite el reenvío de otro documento archivado, esta vez **dejando el campo de fecha vacío**. Resultado esperado: el documento se reenvía **sin** fecha límite y **no** vuelve a expirar solo.

---

## 4. ✅ Atendido — 🐞 El texto del tab seleccionado se desplaza hacia arriba

> **Observación del cliente:** "Al seleccionar un tab (por ejemplo, Feeds, Abogados o Reportes), el texto del tab sube: parece 'saltar' y quedar un poco más arriba en comparación con la alineación que mantiene frente a los demás tabs."

**Qué se hizo:** Se corrigió la alineación de las pestañas del contenedor de notificaciones del **dashboard** (inicio). El texto del tab seleccionado ya no se desplaza hacia arriba: mantiene exactamente la misma altura que los demás tabs. El cambio de **color** del tab activo y la línea azul indicadora se conservan tal como estaban — solo se eliminó el salto de posición.

**Dónde se ve / URL:** `https://gmconsultoresjuridicos.projectapp.co/dashboard` — **Panel Principal (Dashboard)**, en la tarjeta de notificaciones con sus pestañas (los nombres varían según el rol; con cuenta de **abogado** son **Notificaciones / Feed / Contactos / Reportes**).

**Antes de probar necesitas:**
- Iniciar sesión con **cualquier rol** (cliente, abogado, cliente corporativo o básico).
- Empezar desde la URL de arriba (el Panel Principal).

**Cómo validar que funciona:**
1. Abre `https://gmconsultoresjuridicos.projectapp.co/dashboard` (si no iniciaste sesión, primero te llevará al login). Es la página de inicio tras entrar.
2. Ubica la tarjeta de notificaciones con sus pestañas. Con cuenta de **abogado** son **Notificaciones**, **Feed**, **Contactos** y **Reportes**; con otros roles la tercera se llama **Abogados** y la de **Reportes** no aparece. El defecto se ve igual en cualquiera de ellas.
3. Haz clic en cada pestaña alternando entre ellas y observa el texto de la pestaña seleccionada.
4. Resultado esperado: el texto de la pestaña activa **no sube ni baja**; todos los títulos permanecen alineados a la misma altura, cambiando solo el **color** y la **línea azul inferior**.

---

## Cierre

| Categoría | Total puntos | ✅ Atendidos | ⚠️ Parciales | ⏭️ Fuera de alcance |
|---|---|---|---|---|
| Archivos Jurídicos (1.x) | 3 | 3 | 0 | 0 |
| Notificaciones / Dashboard (2.x) | 1 | 1 | 0 | 0 |
| **TOTAL** | **4** | **4** | **0** | **0** |

Los 4 puntos del reporte quedaron atendidos y verificados con pruebas automatizadas. Quedamos atentos a cualquier duda o ajuste sobre algún punto, en especial a su visto bueno sobre el nuevo espaciado de los documentos Word.
