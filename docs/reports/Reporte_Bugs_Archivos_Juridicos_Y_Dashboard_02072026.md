# Reporte de cambios — Revisión de bugs Archivos Jurídicos y Dashboard (2 de julio de 2026)

> Respuesta al reporte de bugs enviado el **02/07/2026** (`reporte_bugs_02072026.md`),
> con dos puntos de la sección **Archivos Jurídicos**, uno de generación de
> documentos y uno del **Dashboard**. Los 4 puntos quedaron atendidos y se pueden
> probar en el ambiente de **staging** de G&M Consultores Jurídicos.

**Convenciones:**
- 🐞 = bug reportado
- 💡 = requerimiento / mejora de UX
- ✅ Atendido | ⏭️ Fuera de alcance | ⚠️ Parcial | 🔄 En curso

**Para todas las pruebas:** ingresa al ambiente de **staging** con una cuenta de
**abogado** (los puntos 1, 2 y 3 son del módulo Archivos Jurídicos; el punto 4
se ve con cualquier rol).

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

**Qué se hizo:** Se unificó el espaciado en los tres lugares donde se ve el
documento: el **editor de texto**, el archivo **Word** y el archivo **PDF**.
Ahora los tres usan exactamente la misma separación entre párrafos y cuadros,
de modo que lo que se ve en el editor es lo que sale en el documento exportado.

Durante la revisión encontramos, además, un problema más profundo en la
generación de **Word** que aprovechamos para corregir: en documentos con
cuadros, el contenido podía salir **duplicado** (el texto de las celdas se
repetía como párrafos sueltos después de cada cuadro). Eso también quedó
resuelto: cada párrafo y cada cuadro aparece una sola vez y en su lugar.

**Nota sobre este cambio:** los documentos Word que se descarguen de ahora en
adelante se verán un poco **más compactos** que los anteriores (la separación
entre párrafos ahora es la del editor). Es el comportamiento solicitado: el
exportado respeta lo que muestra el editor.

**Antes de probar necesitas:**
- Ingresar como **abogado**.
- Un documento de tipo contrato que combine párrafos y cuadros (tablas), como
  el contrato de compraventa del ejemplo del reporte.
- Estar en el módulo **Archivos Jurídicos**.

**Cómo validar que funciona:**
1. Abre el documento en el **editor de texto** y observa la separación entre el
   primer cuadro, el párrafo de la cláusula y el segundo cuadro.
2. Descarga el documento en **PDF** y compáralo con el editor: la separación
   entre párrafos y cuadros debe verse igual, sin espacios en blanco amplios.
3. Descarga el documento en **Word** y ábrelo: mismo espaciado que el editor,
   sin texto duplicado después de los cuadros y sin cuadros pegados entre sí.

---

## 2. ✅ Atendido — 🐞 Documentos "Archivados" se previsualizan sin diligenciar

> **Observación del cliente:** "Los documentos que están en estado 'Archivado', al previsualizarlos, se muestran sin diligenciar. En la previsualización aparecen las variables del documento entre llaves (`{{ nombre_variable }}`) sin renderizar; es decir, se muestra el nombre de la variable en lugar del valor que debería tomar cada una."

**Qué se hizo:** La previsualización de los documentos archivados ahora muestra
el documento **diligenciado**, con cada variable reemplazada por su valor real
(nombre del contratista, número de contrato, fechas, etc.), igual que ocurre
con los documentos formalizados o firmados. El problema era que la
previsualización solo reemplazaba las variables para algunos estados del
documento y los archivados quedaban por fuera.

**Observación adicional del reporte:** la diferencia detectada entre
`{{ Numero_porroga }}` (con typo) y `{{ Numero_prorroga }}` es un error de
escritura **dentro de la plantilla de ese documento específico**, no un
problema de la plataforma. Si en algún documento esa variable no se reemplaza,
es porque el nombre escrito en la plantilla no coincide con la variable
definida; contamos con una herramienta interna para corregir esos casos —
si lo ven en algún documento, indíquennos cuál y lo corregimos.

**Antes de probar necesitas:**
- Ingresar como **abogado**.
- Tener al menos un documento en el tab de **Documentos archivados** (un
  documento rechazado o expirado), por ejemplo la prórroga del ejemplo del
  reporte.

**Cómo validar que funciona:**
1. Ve a **Archivos Jurídicos** → tab **Dcs. Archivados**.
2. Abre las **acciones** del documento y presiona **Previsualizar**.
3. El documento debe verse con los **valores reales** (nombres, cédulas,
   fechas, números de contrato) en lugar de los marcadores `{{ ... }}`.

---

## 3. ✅ Atendido — 🐞 No permite fijar fecha límite de firma al reenviar un documento archivado

> **Observación del cliente:** "Cuando un documento se archiva y luego se retoma para enviarlo a firma, el sistema no permite fijar una fecha límite para la firma: la opción no aparece."

**Qué se hizo:** Al retomar un documento archivado para reenviarlo a firma,
ahora aparece el campo **"Fecha límite para firmar (opcional)"**, igual que en
el envío a firma por primera vez.

Además corregimos un problema relacionado que detectamos durante la revisión:
si el documento se había **expirado** con una fecha límite ya vencida, al
reenviarlo el sistema conservaba esa fecha vieja por dentro y el documento
podía volver a expirar de inmediato. Ahora la fecha vencida se descarta: el
campo aparece vacío (o con la fecha anterior solo si todavía es futura), y si
se deja vacío el documento se reenvía **sin** fecha límite.

**Antes de probar necesitas:**
- Ingresar como **abogado**.
- Un documento en el tab de **Documentos archivados** (rechazado o expirado).

**Cómo validar que funciona:**
1. Ve a **Archivos Jurídicos** → tab **Dcs. Archivados**.
2. Abre las acciones del documento y elige **Editar y reenviar para firma**.
3. En el formulario de corrección verás el campo **"Fecha límite para firmar
   (opcional)"**: selecciona una fecha futura.
4. Presiona **Guardar y reenviar para firma**: el documento pasa a
   **Dcs. Por Firmar** con la fecha límite elegida (visible en la columna de
   fecha límite).
5. Repite el reenvío dejando la fecha vacía: el documento se reenvía sin fecha
   límite y **no** vuelve a expirar solo.

---

## 4. ✅ Atendido — 🐞 El texto del tab seleccionado se desplaza hacia arriba

> **Observación del cliente:** "Al seleccionar un tab (por ejemplo, Feeds, Abogados o Reportes), el texto del tab sube: parece 'saltar' y quedar un poco más arriba en comparación con la alineación que mantiene frente a los demás tabs."

**Qué se hizo:** Se corrigió la alineación de las pestañas del contenedor de
notificaciones del **dashboard** (inicio). El texto del tab seleccionado ya no
se desplaza hacia arriba: mantiene exactamente la misma altura que los demás
tabs. El cambio de **color** del tab activo y la línea azul indicadora se
conservan tal como estaban — solo se eliminó el salto de posición.

**Antes de probar necesitas:**
- Cualquier rol.
- Estar en el **Panel Principal (Dashboard)**, en la tarjeta con las pestañas
  Notificaciones / Feed / Contactos / Reportes.

**Cómo validar que funciona:**
1. Inicia sesión y ve al **Panel Principal**.
2. Haz clic en cada pestaña (Notificaciones, Feed, Contactos, Reportes)
   alternando entre ellas.
3. Observa que el texto de la pestaña seleccionada **no sube ni baja**: todos
   los títulos permanecen alineados a la misma altura, cambiando solo el color
   y la línea azul inferior.

---

## Cierre

| Categoría | Total puntos | ✅ Atendidos | ⚠️ Parciales | ⏭️ Fuera de alcance |
|---|---|---|---|---|
| Archivos Jurídicos (1.x) | 3 | 3 | 0 | 0 |
| Notificaciones / Dashboard (2.x) | 1 | 1 | 0 | 0 |
| **TOTAL** | **4** | **4** | **0** | **0** |

Los 4 puntos del reporte quedaron atendidos y verificados con pruebas
automatizadas. Quedamos atentos a cualquier duda o ajuste sobre algún punto,
en especial a su visto bueno sobre el nuevo espaciado de los documentos Word.
