# Requirement Document / Documento de Requerimiento

---

## 11. Ejecución del Contrato — Seguimiento de Pagos y Cuentas de Cobro

---

### Descripción

Actualmente, cuando un documento jurídico es completamente firmado por todas las partes, el sistema lo marca como "Completamente Firmado" y permite su descarga, pero no ofrece ningún mecanismo para dar seguimiento a la ejecución del contrato una vez firmado. Muchos contratos involucran pagos periódicos (cuotas, honorarios, mensualidades), y hoy en día no existe una forma de registrar, gestionar o verificar dentro de la plataforma el cumplimiento de dichos pagos.

Los clientes no tienen un espacio dentro del sistema para cargar sus cuentas de cobro por cada cuota pactada, y la firma jurídica tampoco cuenta con un registro digital de los comprobantes de pago recibidos. Este seguimiento se realiza de manera informal por fuera de la plataforma (correos, WhatsApp, carpetas físicas), lo que genera desorganización, falta de trazabilidad y riesgo de inconsistencias entre las partes.

Adicionalmente, el modelo de variables del documento jurídico no contempla actualmente la definición del número de pagos o cuotas pactadas como un campo de resumen del contrato.

---

### Propuesta de Mejora

Implementar un **submódulo de Ejecución del Contrato** dentro de los documentos jurídicos con estado "Completamente Firmado", que permita llevar un registro ordenado de las cuentas de cobro por cada cuota pactada:

#### Nuevo Campo: Forma de Pago en Variables del Documento
• **Campo "Forma de pago"**: Nuevo tipo de variable de resumen en los documentos jurídicos que permite registrar el número de cuotas o pagos pactados en el contrato (ej: 1 pago único, 3 cuotas, 12 mensualidades).

• **Visible en el resumen del documento**: Una vez configurado, el número de cuotas pactadas se refleja en el resumen del contrato junto con el valor y el plazo.

#### Registro Secuencial de Cuentas de Cobro
• **Habilitación por cuotas**: Cuando un documento está firmado y tiene una forma de pago con N cuotas, se generan N espacios de carga. El primer espacio siempre está disponible. Cada espacio siguiente se habilita únicamente cuando el anterior ha sido completado (cuenta de cobro cargada).

• **Carga de cuenta de cobro**: El cliente (o el abogado en su nombre) puede cargar el archivo de cuenta de cobro correspondiente a cada cuota. El sistema acepta archivos en formato PDF, JPG, PNG o DOCX de hasta 20 MB.

• **Ficha de registro por cuota**: Cada cuenta de cobro cargada genera un registro con:
  - Número de cuota (ej: Cuota 1 de 3)
  - Archivo adjunto (cuenta de cobro)
  - Monto de la cuota (campo opcional)
  - Notas adicionales (campo opcional)
  - Fecha y hora de carga
  - Usuario que realizó la carga
  - Estado: Pendiente / Cargada / Aceptada / Rechazada
  - Motivo de rechazo (si aplica)

• **Notificación al abogado**: En cuanto el cliente sube una cuenta de cobro, el abogado (creador del documento) recibe una notificación informándole que hay una nueva cuenta de cobro disponible para revisión.

• **Aceptación o rechazo por el abogado**: El abogado creador del documento puede revisar la cuenta de cobro cargada, descargar el archivo adjunto y tomar una de dos acciones:
  - **Aceptar**: La cuenta de cobro queda marcada como "Aceptada" y se habilita la siguiente cuota para que el cliente pueda cargarla.
  - **Rechazar**: La cuenta de cobro queda marcada como "Rechazada" con un motivo de rechazo obligatorio. El cliente puede corregir y volver a cargar la cuenta de cobro para esa misma cuota.

#### Visualización del Detalle de Cuentas de Cobro
• **Vista de resumen de pagos**: Una sección dentro del documento firmado muestra el estado de todas las cuotas (pendiente, cargada, aceptada, rechazada), el progreso general de ejecución del contrato y la contabilidad de los montos registrados.

• **Descarga de comprobante**: Desde el detalle, cualquier parte autorizada puede descargar el archivo de cuenta de cobro registrado para cada cuota.

#### Acciones en el Documento Firmado
• **Acción "Subir Cuenta de Cobro"**: Disponible en el menú de acciones de documentos con estado "Completamente Firmado" que tengan forma de pago configurada y cuotas pendientes. Abre un formulario para seleccionar la cuota a cargar y adjuntar el archivo.

• **Acción "Ver Cuentas de Cobro"**: Disponible en el menú de acciones de documentos firmados con forma de pago. Abre la vista de detalle con el historial y estado de todas las cuentas de cobro del contrato.

---

### Beneficios Esperados

• **Trazabilidad Completa**: Registro centralizado de cada pago dentro de la plataforma, con fecha, archivo y responsable.

• **Organización**: Elimina el seguimiento informal por fuera del sistema, concentrando toda la información del contrato en un solo lugar.

• **Visibilidad para Ambas Partes**: El cliente sabe exactamente en qué cuota va y qué le falta cargar; el abogado puede verificar el estado de cada pago en tiempo real.

• **Contabilidad de Pagos**: La vista de detalle ofrece un resumen de los montos registrados por cuota, facilitando la gestión financiera del contrato.

• **Flujo Guiado**: El sistema habilita las cuotas de forma secuencial: la siguiente cuota solo se activa cuando la anterior es **aceptada** por el abogado, garantizando que los pagos se registren y validen en orden.

• **Descarga de Comprobantes**: Ambas partes pueden descargar los archivos de cuentas de cobro en cualquier momento desde la plataforma.

• **Control de Calidad**: El flujo de aceptación/rechazo garantiza que solo comprobantes válidos avanzan el contrato, dando al abogado control total sobre la ejecución.

• **Sin Impacto en Documentos Existentes**: Documentos firmados sin forma de pago configurada no se ven afectados.

---

### Flujo de Operación

#### Configuración del Contrato (Abogado)

1. **Definición de Forma de Pago**:
   ○ Al crear o editar las variables de un documento jurídico, el abogado puede agregar una variable de tipo "Forma de pago (N cuotas)" y definir el número de cuotas pactadas (ej: 3).
   ○ Este campo queda registrado en el resumen del contrato junto con el valor y el plazo.

2. **Firma del Documento**:
   ○ Una vez que el documento completa el proceso de firma y pasa a estado "Completamente Firmado", el submódulo de ejecución queda habilitado automáticamente si el documento tiene una forma de pago configurada.

#### Ejecución del Contrato (Cliente)

3. **Acceso al Submódulo**:
   ○ El cliente ve en el menú de acciones del documento firmado las opciones "Subir Cuenta de Cobro" y "Ver Cuentas de Cobro".
   ○ La opción "Subir Cuenta de Cobro" está habilitada si hay al menos una cuota en estado "Pendiente" o "Rechazada" que esté disponible para carga.

4. **Carga de Cuenta de Cobro**:
   ○ El cliente selecciona la cuota disponible (ej: Cuota 1 de 3).
   ○ Adjunta el archivo de cuenta de cobro (PDF, JPG, PNG, DOCX, máx. 20 MB).
   ○ Opcionalmente ingresa el monto de la cuota y notas adicionales.
   ○ Confirma la carga. El sistema registra la ficha con fecha, hora y usuario, y envía una notificación al abogado para que la revise.

5. **Seguimiento**:
   ○ El cliente puede ver en "Ver Cuentas de Cobro" el historial completo: qué cuotas están aceptadas, cuáles están pendientes, cuáles están en revisión (cargadas pero sin decisión) y cuáles fueron rechazadas con su motivo.
   ○ Para cuotas rechazadas, el cliente ve el motivo del rechazo y puede volver a cargar el archivo corregido.

#### Revisión y Decisión por el Abogado

6. **Notificación y Revisión**:
   ○ El abogado recibe una notificación (correo electrónico) cuando el cliente carga una nueva cuenta de cobro.
   ○ Accede a "Ver Cuentas de Cobro" desde el documento firmado en su vista.
   ○ Puede descargar el archivo adjunto para verificarlo.

7. **Aceptar o Rechazar**:
   ○ **Aceptar**: El abogado acepta la cuenta de cobro. La cuota queda en estado "Aceptada" y se habilita automáticamente la siguiente cuota para carga.
   ○ **Rechazar**: El abogado rechaza la cuenta de cobro e ingresa obligatoriamente un motivo de rechazo. La cuota vuelve a estar disponible para que el cliente cargue una versión corregida.
   ○ El cliente es notificado en ambos casos (aceptación o rechazo).

---

### Cambios Transversales en la Aplicación

#### Variables del Documento Jurídico
• **Nuevo campo de resumen "Forma de pago"**: Aparece junto al valor y el plazo en el resumen de las tarjetas del documento.

#### Menú de Acciones del Documento Firmado
• **"Subir Cuenta de Cobro"**: Nueva acción visible para documentos con estado "Completamente Firmado" y forma de pago configurada con cuotas pendientes.
• **"Ver Cuentas de Cobro"**: Nueva acción visible para documentos con estado "Completamente Firmado" y forma de pago configurada.

#### Manual de Usuario
• Nueva sección sobre el submódulo de Ejecución del Contrato: cómo configurar la forma de pago, cómo cargar una cuenta de cobro y cómo revisar el historial de pagos.

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los clientes puedan cargar cuentas de cobro y consultar el historial desde cualquier dispositivo.

• El submódulo de ejecución del contrato aplica **exclusivamente** a documentos jurídicos con estado "Completamente Firmado" que tengan una variable de tipo "Forma de pago (N cuotas)" configurada con un valor mayor a cero.

• La carga de cuentas de cobro puede ser realizada por el cliente asignado al documento (`assigned_to`) o por el abogado creador en nombre del cliente.

• La habilitación de cuotas es **secuencial**: la cuota N+1 se habilita únicamente cuando la cuota N ha sido **aceptada** por el abogado. Una cuota rechazada puede ser re-enviada por el cliente sin necesidad de crear un nuevo registro.

• Los archivos aceptados son: PDF, JPG, PNG, DOCX con un tamaño máximo de 20 MB por archivo.

• Cuando una cuenta de cobro es rechazada, el cliente recibe una notificación con el motivo del rechazo y puede volver a cargar el archivo para esa misma cuota.

• Este requerimiento requiere aprobación de diseño antes del desarrollo, especialmente para la vista de detalle de cuentas de cobro, el formulario de carga, y el panel de aceptación/rechazo del abogado.
