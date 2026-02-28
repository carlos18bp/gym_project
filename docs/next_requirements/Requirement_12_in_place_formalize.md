# Requirement Document / Documento de Requerimiento

---

## 12. Formalización Sin Copia — Cambio de Estado en el Mismo Documento Jurídico

---

### Descripción

Actualmente, cuando un abogado selecciona un documento jurídico con estado "Completado" y lo envía para firma electrónica, el sistema genera automáticamente una **copia** del documento original con un nuevo estado ("Pendiente de firmas"). El documento original permanece en la sección de archivos jurídicos con su estado "Completado", mientras que la copia aparece en una sección diferente como un documento nuevo, independiente y con un título modificado.

Este comportamiento ha generado confusión significativa entre los usuarios finales por las siguientes razones:

• **Duplicidad visible**: El mismo contrato aparece dos veces en la plataforma — una como el documento completado original y otra como una copia en estado "Pendiente de firmas" — generando incertidumbre sobre cuál es el documento oficial.

• **Pérdida de trazabilidad**: La copia y el original son objetos separados, lo que fragmenta el historial del documento y dificulta hacer seguimiento al ciclo de vida completo del contrato desde su creación hasta su firma.

• **Desconexión operativa**: Los usuarios no comprenden por qué el mismo documento aparece duplicado en distintas secciones y con nombres diferentes, lo que genera consultas frecuentes al equipo de soporte.

• **Acumulación innecesaria**: Con el tiempo, la plataforma acumula documentos "originales" completados que nunca fueron enviados a firma directamente, junto con sus copias duplicadas, dificultando la gestión del archivo.

---

### Propuesta de Mejora

Modificar el flujo de formalización para que, en lugar de crear una copia del documento, el **mismo documento original cambie de estado** directamente de "Completado" a "Pendiente de firmas" cuando el abogado lo envía para firma electrónica.

#### Comportamiento Propuesto

• **Sin duplicación**: Al formalizar un documento, el documento existente es el que entra al flujo de firmas. No se crea ninguna copia ni ningún objeto nuevo.

• **Cambio de estado en el mismo documento**: El documento que estaba en "Completado" pasa a "Pendiente de firmas" conservando su identidad, su historial y todas sus asociaciones previas.

• **Navegación coherente**: El documento desaparece de la sección "Completados" (o del tab correspondiente) y aparece en la sección "Pendientes de firmas", reflejando el nuevo estado dentro del mismo módulo de documentos jurídicos.

• **Título sin modificaciones**: El título original del documento se conserva tal como fue definido por el abogado, sin agregar sufijos ni modificaciones adicionales.

• **Registro de firmantes sobre el mismo documento**: Los usuarios seleccionados como firmantes quedan vinculados al documento original, y las solicitudes de firma se crean sobre el mismo objeto, no sobre una copia.

---

### Beneficios Esperados

• **Eliminación de la duplicidad**: El documento existe una sola vez en la plataforma durante todo su ciclo de vida, desde la creación hasta la firma.

• **Trazabilidad completa**: Toda la historia del documento — edición, formalización, firmas, descarga — queda registrada bajo el mismo objeto, facilitando auditorías y seguimiento.

• **Mejor experiencia de usuario**: Los abogados y clientes ven un único documento que cambia de estado de manera natural, tal como se espera en cualquier flujo de gestión documental.

• **Reducción de confusión**: Desaparece la pregunta recurrente de "¿cuál de los dos documentos es el oficial?" porque ahora solo existe uno.

• **Menos ruido en el archivo**: No se acumulan documentos huérfanos (los originales completados que quedaban sin uso después de formalizar).

• **Consistencia con el flujo de corrección**: El flujo de corrección de documentos rechazados ya funciona sobre el mismo documento (sin crear copias). Este cambio hace que el flujo de formalización sea consistente con ese comportamiento.

---

### Flujo de Operación

#### Antes del Cambio (flujo actual)

1. El abogado tiene un documento en estado "Completado".
2. Hace clic en "Formalizar y Agregar Firmas".
3. El sistema crea una **copia nueva** del documento con estado "Pendiente de firmas".
4. El documento original permanece en "Completado".
5. Aparecen dos documentos en la plataforma.

#### Después del Cambio (flujo propuesto)

1. **El abogado tiene un documento en estado "Completado"**.
   ○ El documento aparece en la sección correspondiente al estado "Completado" dentro del módulo de archivos jurídicos.

2. **Formalización**:
   ○ El abogado hace clic en "Formalizar y Agregar Firmas".
   ○ Completa el formulario de formalización: selecciona los firmantes, establece la fecha límite de firma si aplica, y confirma.

3. **Cambio de estado en el mismo documento**:
   ○ El sistema actualiza el **mismo documento** cambiando su estado de "Completado" a "Pendiente de firmas".
   ○ Se registran las solicitudes de firma sobre el mismo documento.
   ○ El documento **no se duplica** en ningún momento.

4. **Navegación automática**:
   ○ El documento desaparece del tab "Completados" y aparece en el tab "Pendientes de firmas" dentro del módulo de archivos jurídicos.
   ○ El abogado es redirigido automáticamente a la vista de documentos pendientes de firma donde puede ver el documento recién formalizado.

5. **Continuación del flujo de firmas** (sin cambios):
   ○ Los firmantes reciben su notificación.
   ○ El documento sigue el flujo de firma existente: firman, y eventualmente pasa a "Completamente Firmado" o "Rechazado" según corresponda.

---

### Cambios Transversales en la Aplicación

#### Módulo de Archivos Jurídicos
• El documento formalizado se mueve del tab "Completados" al tab "Pendientes de firmas" de forma natural al cambiar de estado.

#### Historial del Documento
• El historial y las asociaciones del documento se preservan al ser el mismo objeto. No hay pérdida de información por la formalización.

#### Notificaciones
• El comportamiento de notificaciones a los firmantes no cambia. Las notificaciones se envían exactamente igual que antes, solo que ahora apuntan al documento original en lugar de a una copia.

---

### Notas Importantes

• Este cambio es **transparente para el usuario final**: el flujo de uso desde la interfaz es idéntico. El único cambio visible es que ya no aparecen documentos duplicados.

• El flujo de **corrección de documentos rechazados** (cuando un firmante rechaza y el abogado corrige y reenvía) ya funcionaba sobre el mismo documento. Este requerimiento hace que el flujo de formalización inicial sea coherente con ese comportamiento.

• Los documentos que ya fueron formalizados con el flujo anterior (que ya tienen su copia creada) no se ven afectados. Este cambio aplica únicamente a las formalizaciones realizadas a partir de la implementación.

• Este es un cambio de bajo riesgo técnico dado que el flujo de actualización de documentos ya existe y es utilizado en otros contextos dentro del módulo.
