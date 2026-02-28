# Requirement Document / Documento de Requerimiento

---

## 10. Firmantes Requeridos e Informativos en Documentos Jurídicos

---

### Descripción

Actualmente, cuando un documento jurídico es enviado para firma electrónica, el sistema exige que **todas** las partes seleccionadas firmen el documento antes de que este sea marcado como "Completamente Firmado". Todas las personas incluidas en el proceso de firma son tratadas de manera idéntica: hasta que no firmen, el documento permanece en estado "Pendiente de firmas".

Sin embargo, existe un caso de uso frecuente donde únicamente el abogado necesita firmar el documento y las demás partes (clientes u otros participantes) deben ser notificadas del proceso, pero no se requiere su firma para que el documento quede legalmente válido y completado dentro de la plataforma. En el flujo actual no es posible hacer esta distinción: si se incluye a un cliente como participante del proceso de firma, el sistema lo obliga a firmar antes de considerar el documento finalizado, incluso cuando su firma no es un requisito.

Esta limitación genera demoras en la gestión de documentos y no refleja la realidad de ciertos flujos jurídicos donde una sola firma (la del abogado) es suficiente para dar por completado el proceso.

---

### Propuesta de Mejora

Implementar un sistema de **firmantes requeridos e informativos** en el flujo de firma electrónica de documentos jurídicos, que permita:

• **Clasificación de firmantes**: Al configurar el proceso de firma de un documento, el abogado puede marcar a cada participante como:
  - **Firmante requerido**: su firma es obligatoria para que el documento quede completamente firmado.
  - **Firmante informativo**: es notificado del proceso de firma y puede firmar si lo desea, pero su firma no bloquea la finalización del documento.

• **Finalización por firmantes requeridos**: El documento pasa automáticamente al estado "Completamente Firmado" en cuanto todos los firmantes requeridos hayan firmado, independientemente de si los firmantes informativos han firmado o no.

• **Firma voluntaria de informativos**: Los firmantes informativos mantienen la posibilidad de firmar el documento si así lo desean, pero no aparecerán en su lista de "Documentos pendientes por firmar", ya que su firma no es un requisito.

• **Rechazo exclusivo de requeridos**: Solo el rechazo de un firmante requerido cambia el estado del documento a "Rechazado". El rechazo de un firmante informativo queda registrado pero no afecta el estado del documento.

• **Visibilidad diferenciada**: En la vista de estado de firmas del documento, cada participante muestra una etiqueta indicando si su firma es "Requerida" o "Informativa", permitiendo a todas las partes entender su rol en el proceso.

• **Contador de firmas ajustado**: El contador de progreso de firmas (ej. "1 de 2 firmados") refleja únicamente los firmantes requeridos, ofreciendo una vista clara del estado real de avance hacia la completación.

---

### Beneficios Esperados

• **Mayor Flexibilidad Operativa**: Permite gestionar documentos donde solo una parte necesita firmar sin bloquear el flujo por los demás participantes.

• **Reducción de Demoras**: Los documentos avanzan al estado "Completamente Firmado" tan pronto como el firmante clave (el abogado) firma, sin esperar confirmación de partes informativas.

• **Claridad en el Proceso**: Cada participante sabe claramente si su firma es obligatoria o informativa, reduciendo confusiones y consultas.

• **Trazabilidad Completa**: Todas las firmas (requeridas e informativas) quedan registradas con fecha, hora y dirección IP, manteniendo la trazabilidad del proceso.

• **Adaptación a la Práctica Jurídica Real**: Refleja los flujos del mundo real donde ciertos documentos requieren solo la firma del abogado para ser válidos dentro de la gestión de la firma.

• **Sin Impacto en Flujos Existentes**: Los documentos configurados con todos los firmantes como requeridos (comportamiento actual) continúan funcionando exactamente igual.

---

### Flujo de Operación

1. **Configuración del Proceso de Firma**:
   ○ El abogado, al formalizar un documento, selecciona los participantes que recibirán el documento para firma.
   ○ Para cada participante seleccionado, puede elegir si su firma es **Requerida** (obligatoria) o **Informativa** (opcional).
   ○ El abogado mismo siempre puede ser marcado como requerido o informativo según el caso.

2. **Envío y Notificación**:
   ○ El documento es enviado a todos los participantes (requeridos e informativos) con una notificación por correo electrónico.
   ○ Los firmantes requeridos reciben una notificación indicando que su firma es obligatoria.
   ○ Los firmantes informativos reciben una notificación informándoles que están incluidos en el proceso pero que su firma es opcional.

3. **Proceso de Firma**:
   ○ Los firmantes requeridos ven el documento en su sección "Pendientes de firma" y deben firmarlo para avanzar el proceso.
   ○ Los firmantes informativos **no ven el documento** en su lista de pendientes (ya que no es un requisito), pero pueden acceder al documento si lo necesitan y firmar voluntariamente.
   ○ A medida que los firmantes requeridos van firmando, el contador de progreso se actualiza (ej. "1 de 1 requeridos firmados").

4. **Completación del Documento**:
   ○ En cuanto el último firmante requerido firma, el documento pasa automáticamente a estado "Completamente Firmado", independientemente del estado de los firmantes informativos.
   ○ Todos los participantes (requeridos e informativos) reciben una notificación indicando que el documento ha sido completamente firmado.

5. **Rechazo**:
   ○ Si un firmante requerido rechaza el documento, este pasa a estado "Rechazado" y el creador es notificado para corregir y reenviar.
   ○ Si un firmante informativo rechaza el documento, el rechazo queda registrado en el historial pero el documento no cambia de estado.

6. **Visualización del Estado**:
   ○ En la vista de detalle de firmas del documento, se muestra la lista completa de participantes con su tipo de firma (Requerida / Informativa) y su estado actual (Pendiente / Firmado / Rechazado).

---

### Cambios Transversales en la Aplicación

#### Vista de Estado de Firmas
• Nueva columna o etiqueta "Tipo de firma" en la tabla de firmantes, mostrando si la firma es "Requerida" o "Informativa" para cada participante.
• El contador de progreso (ej. "2/3 firmados") pasa a reflejar solo los firmantes requeridos.

#### Flujo de Formalización del Documento
• En el paso de selección de firmantes, se agrega un control por participante (toggle o selector) para marcar si su firma es requerida o informativa.
• Por defecto, todos los firmantes seleccionados son marcados como requeridos para preservar el comportamiento existente.

#### Manual de Usuario
• Nueva sección explicando la diferencia entre firmantes requeridos e informativos.
• Instrucciones para configurar el tipo de firma al formalizar un documento.

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los abogados puedan configurar el tipo de firma de cada participante desde cualquier dispositivo.

• El comportamiento predeterminado es que todos los firmantes sean **requeridos**, garantizando que los documentos ya existentes y los flujos actuales no se vean afectados.

• Un firmante informativo que ha firmado voluntariamente verá el documento reflejado en su sección "Firmados". Si no firmó, no aparece en ninguna sección especial.

• Esta funcionalidad aplica exclusivamente al módulo de **Archivos Jurídicos** y su flujo de firma electrónica.
