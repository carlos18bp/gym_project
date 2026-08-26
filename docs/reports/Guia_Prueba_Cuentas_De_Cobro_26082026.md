### 1. ¿Qué es y para qué sirve?

Las cuentas de cobro permiten llevar, dentro de cada contrato firmado, el control de los cobros correspondientes a sus cuotas. La persona asignada al contrato carga el archivo y el abogado lo revisa, lo acepta o lo rechaza indicando el motivo; así ambas partes pueden ver el avance sin depender de correos o mensajes sueltos.

Esta guía utiliza contratos que ya están preparados en el ambiente de pruebas. No necesitas crear información nueva para comenzar.

### 2. Antes de empezar

- Abre el ambiente de pruebas en **https://gmconsultoresjuridicos.projectapp.co/sign_in** desde un computador y, de preferencia, usa Chrome o Edge.
- Para cargar y corregir cuentas de cobro, ingresa con `client1@example.com`. La contraseña es `password`. Esta cuenta aparece como usuario básico, pero para esta prueba actúa como la persona asignada al contrato y sí puede gestionar sus cuentas de cobro.
- Para revisar, aceptar o rechazar, ingresa con `lawyer1@example.com`. La contraseña es `password`.
- Usa las dos cuentas por separado. Si una misma persona carga y revisa su propio archivo, no se envían avisos por correo.
- Ten a mano un archivo PDF, JPG, PNG o DOCX de máximo 20 MB si quieres realizar una carga real.
- En la pestaña **Dcs. Formalizados** encontrarás cuatro contratos cuyos títulos comienzan por **[QA Cuentas de Cobro]**:

| Contrato | Qué permite comprobar |
|---|---|
| **Contrato con pago único** | Una cuota disponible para cargar; el resumen muestra **Pago único**. |
| **Contrato con dos cuotas aceptadas** | Progreso completo, contador **2/2** y total aceptado de $4.000.000. |
| **Contrato con cuota en revisión** | La cuota 1 está aceptada y la cuota 2 espera la decisión del abogado. |
| **Contrato con cuota rechazada** | La cuota 2 muestra el motivo del rechazo y está disponible para corregir. |

### 3. Paso a paso para probarlo

#### 3a. Revisar los ejemplos ya preparados

1. Entra en **https://gmconsultoresjuridicos.projectapp.co/sign_in** con `client1@example.com` y la contraseña `password`.
2. Abre **https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?tab=signed-documents** o entra por **Archivos Juridicos** y selecciona **Dcs. Formalizados**.
3. Busca **[QA Cuentas de Cobro]** para ver juntos los cuatro contratos de prueba.
4. Abre el menú de **Contrato con dos cuotas aceptadas** y pulsa **Ver Cuentas de Cobro**; comprueba que aparecen **2/2 cuotas aceptadas**, la barra completa y un total aceptado de $4.000.000.
5. Cierra la ventana, abre **Contrato con cuota en revisión** y pulsa **Ver Cuentas de Cobro**; comprueba que la cuota 2 dice **Cargada · En revisión** y que no aparece la opción para subir otra cuenta mientras el abogado no tome una decisión.
6. Cierra la ventana, abre **Contrato con cuota rechazada** y pulsa **Ver Cuentas de Cobro**; comprueba que la cuota 2 muestra **Rechazada**, el recuadro **Motivo del rechazo:** y el botón **Subir Cuenta de Cobro** para corregirla.

#### 3b. Cargar una cuenta de cobro

1. Continúa con `client1@example.com` en **https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?tab=signed-documents**.
2. Abre el menú de **Contrato con pago único** y pulsa **Subir Cuenta de Cobro**.
3. Haz clic en el recuadro punteado y selecciona un archivo PDF, JPG, PNG o DOCX de máximo 20 MB.
4. Escribe el **Monto de la cuota** y las **Notas adicionales** sólo si deseas incluirlos; ambos campos son opcionales.
5. Pulsa **Subir Cuenta de Cobro** y espera el mensaje de confirmación.
6. Vuelve a abrir el menú del contrato y pulsa **Ver Cuentas de Cobro**; la cuota debe aparecer como **Cargada · En revisión**.

#### 3c. Aceptar o rechazar como abogado

1. Cierra la sesión del usuario asignado e ingresa en **https://gmconsultoresjuridicos.projectapp.co/sign_in** con `lawyer1@example.com` y la contraseña `password`.
2. Abre **https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?lawyerTab=signed-documents** o entra por **Archivos Juridicos** y selecciona **Dcs. Formalizados**.
3. Busca **[QA Cuentas de Cobro]**, abre el menú de **Contrato con cuota en revisión** y pulsa **Ver Cuentas de Cobro**.
4. Haz clic en el nombre del archivo de la cuota 2 para descargarlo y revisarlo.
5. Si el archivo es correcto, pulsa **Aceptar**; el estado cambia a **Aceptada** y queda disponible la cuota 3.
6. Si quieres probar un rechazo en lugar de aceptarlo, pulsa **Rechazar**, escribe el **Motivo del rechazo (obligatorio)** y pulsa **Confirmar rechazo**; la cuota cambia a **Rechazada** y el usuario asignado puede cargar la corrección.

#### 3d. Corregir una cuenta rechazada

1. Cierra la sesión del abogado y vuelve a ingresar con `client1@example.com`.
2. Abre **https://gmconsultoresjuridicos.projectapp.co/dynamic_document_dashboard?tab=signed-documents** y entra en **Ver Cuentas de Cobro** del contrato que rechazaste o del ejemplo **Contrato con cuota rechazada**.
3. Lee el texto de **Motivo del rechazo:** para saber qué debe corregirse.
4. Pulsa **Subir Cuenta de Cobro**, selecciona el archivo corregido y confirma la carga.
5. Comprueba que esa misma cuota vuelve a quedar como **Cargada · En revisión**; el sistema no salta a la cuota siguiente hasta que el abogado la acepte.

#### 3e. Opcional: preparar un contrato desde cero

1. Ingresa como `lawyer1@example.com`, abre **Archivos Juridicos** y entra en **Minutas**.
2. Crea una minuta o abre una existente y entra en la configuración de sus variables.
3. En la variable destinada al número de cuotas, selecciona **Forma de pago (N cuotas)** en **Campo resumen**; el campo quedará preparado para recibir un número.
4. Guarda la minuta, úsala para crear un documento y escribe la cantidad de cuotas acordada.
5. Asigna el documento a la persona que cargará las cuentas de cobro y completa las firmas de todas las partes.
6. Cuando el documento aparezca en **Dcs. Formalizados**, repite los pasos de carga y revisión de esta guía.

### 4. Cómo sabes que funcionó

- La ventana **Cuentas de Cobro** muestra una ficha por cuota, el contador de cuotas aceptadas, la barra de avance y el total de los montos aceptados.
- Al cargar un archivo, la cuota cambia a **Cargada · En revisión** y no se habilita la siguiente mientras el abogado no decida.
- Al aceptar, la cuota cambia a **Aceptada**, avanza el contador y se habilita la siguiente cuota.
- Al rechazar, aparece **Motivo del rechazo:** y queda disponible la carga de una corrección sobre esa misma cuota.
- Cada archivo cargado muestra quién lo subió y la fecha y hora de la carga.
- Con las dos cuentas de prueba separadas, la otra parte recibe el aviso correspondiente cuando se carga, acepta o rechaza una cuenta de cobro.

### 5. Si algo no sale como esperabas

- **No encuentras los contratos** → confirma que estás en **Archivos Juridicos**, pestaña **Dcs. Formalizados**, y busca el texto **[QA Cuentas de Cobro]**.
- **No aparece Subir Cuenta de Cobro** → abre **Ver Cuentas de Cobro** y revisa el estado: si una cuota está **Cargada · En revisión**, debes esperar la decisión del abogado; si todas están aceptadas, el contrato ya terminó su recorrido.
- **No aparecen las opciones de cuentas de cobro** → confirma que entraste con `client1@example.com` o `lawyer1@example.com` y que abriste uno de los cuatro contratos indicados en esta guía.
- **El archivo no se puede cargar** → usa PDF, JPG, PNG o DOCX y verifica que no supere 20 MB.
- **Confirmar rechazo está desactivado** → escribe primero el motivo; es obligatorio para que la otra persona sepa qué corregir.
- **El ejemplo ya no tiene el estado descrito** → otra persona pudo haber realizado la prueba antes. Solicita al equipo técnico que restablezca los contratos de demostración.
- Si el problema continúa, avisa al equipo técnico y adjunta una captura de pantalla donde se vea el título del contrato y el mensaje mostrado.
