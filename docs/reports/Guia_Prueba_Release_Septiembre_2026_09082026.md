# Guía de Prueba — Release Septiembre 2026

Esta guía explica, en lenguaje sencillo, cómo probar y validar las tres funcionalidades nuevas de la plataforma: la **Reasignación de Datos de Abogado**, el **Seguimiento de Cuentas de Cobro** y el **Tour Guiado**. Cada una tiene su propio recorrido, pensado para que cualquier persona pueda seguirlo sin conocimientos técnicos.

---

## A. Reasignación de Datos de Abogado

### ¿Qué es y para qué sirve?

Es una herramienta para administradores que permite pasar los procesos y documentos de un abogado a otro sin tener que hacerlo uno por uno. Sirve, por ejemplo, cuando un abogado deja la firma, sale de vacaciones o hay que repartir mejor la carga de trabajo del equipo.

Además, permite "archivar" al abogado que se va: su cuenta queda cerrada y deja de recibir correos, pero todo su historial se conserva intacto. Si más adelante vuelve, se puede reactivar con un clic.

### Antes de empezar

- **Necesitas una cuenta con rol de administrador.** Las cuentas de prueba que trae el sistema son de cliente y de abogado, pero ninguna es de administrador: pídele una al equipo técnico antes de comenzar.
- Ten a mano al menos dos abogados en el sistema, y que uno de ellos tenga procesos o documentos asignados.
- Cuentas de prueba disponibles: `lawyer1@example.com` en adelante (abogados) y `client1@example.com` en adelante (clientes). La contraseña de todas es `password`.
- Existe también `abogado.archivado@example.com`, una cuenta que ya viene archivada. Te sirve para comprobar el bloqueo de acceso y el botón de restaurar.
- Usa un computador de escritorio; la pantalla de reasignación se aprovecha mejor en pantalla ancha.

### Paso a paso para probarlo

1. Inicia sesión con la cuenta de administrador.
2. En el menú lateral izquierdo, haz clic en **"Reasignación de Datos"**. Esta opción sólo aparece si tu cuenta es de administrador.
3. Verás el título **"Reasignación de Datos"** y, debajo, el bloque **"Seleccionar abogados"** con dos listas.
4. En **"Abogado origen"**, elige el abogado cuyos datos vas a transferir. Los abogados que ya están archivados aparecen en esta lista con la palabra **"(archivado)"** al lado, para que puedas mover sus datos incluso después de haberlos cerrado.
5. Espera un momento: aparece el mensaje "Cargando datos del abogado..." y luego se muestran dos tarjetas con todo lo que ese abogado tiene.
6. En **"Abogado destino"**, elige quién recibirá los datos. Fíjate en que el abogado que elegiste como origen **no aparece** en esta segunda lista.
7. Revisa la tarjeta **"Procesos"**, que muestra entre paréntesis cuántos hay. Marca las casillas de los que quieras transferir, o usa **"Seleccionar todos"** arriba a la derecha de la tarjeta.
8. Revisa la tarjeta **"Documentos"** de la misma forma. Al final de esa tarjeta encontrarás el bloque **"No transferibles"**: son los documentos que el sistema protege y no deja mover. Cada uno lleva una etiqueta roja con el motivo: *En proceso de firma*, *Firmado*, *Rechazado* o *Vencido*.
9. Si quieres cerrar la cuenta del abogado origen al terminar, marca la casilla **"Archivar abogado origen al finalizar."**. Debajo se explica que no podrá iniciar sesión, que no aparecerá en los listados y que la acción se puede deshacer.
10. Abajo verás una frase que resume lo que va a pasar: *"Se transferirán 3 proceso(s) y 5 documento(s) a Pérez Juan."* Confirma que los números coincidan con lo que marcaste.
11. Haz clic en el botón azul **"Reasignar datos"**.
12. Se abre una ventana de **"Confirmar reasignación"** con el mismo resumen. Haz clic en **"Confirmar"**.

### Cómo sabes que funcionó

- Aparece un aviso verde con el resultado: *"Se transfirieron 3 procesos y 5 documentos a Pérez Juan."* Si marcaste la casilla de archivar, se agrega: *"El abogado García Ana fue archivado."*
- El formulario se limpia solo y vuelve a quedar listo para otra reasignación.
- Cierra sesión y entra con el **abogado destino**: los procesos y documentos transferidos ya aparecen en sus listados.
- Si archivaste al abogado origen, intenta iniciar sesión con su cuenta: el sistema responde **"Tu cuenta ha sido archivada. Contacta al administrador."** Esto ocurre igual si intenta entrar con contraseña, con Google o con Microsoft.
- En la pantalla de **"Reasignación de Datos"** aparece la tarjeta **"Abogados archivados"** con un botón **"Restaurar"** al lado de cada uno. Púlsalo y verás el aviso *"El abogado García Ana fue restaurado."*; a partir de ahí puede volver a entrar.
- En el panel principal, como administrador, verás dos indicadores: **"Abogados activos"** y **"Abogados archivados"**, con sus cantidades actualizadas.
- También en el panel principal encontrarás el acceso rápido **"Reasignar Datos"**, con el subtítulo *"Transferir procesos y documentos"*, que te lleva directo a esta pantalla.
- Al crear o editar un proceso, el formulario ahora incluye el campo **"Abogado responsable"**, que viene preseleccionado con el abogado que está usando el sistema y permite cambiarlo por cualquier otro abogado activo.
- Los documentos transferidos siguen mostrando quién los creó originalmente: ese dato nunca cambia.

### Si algo no sale como esperabas

- **No ves "Reasignación de Datos" en el menú lateral** → tu cuenta no tiene rol de administrador. Pídele al equipo técnico que te la habilite.
- **El botón "Reasignar datos" está apagado y no se puede pulsar** → falta elegir el abogado destino, o no has marcado ningún proceso ni documento. Necesitas al menos un elemento seleccionado.
- **Un documento que esperabas transferir no aparece en la lista** → búscalo en el bloque "No transferibles". Los documentos que están en proceso de firma, ya firmados, rechazados o vencidos están protegidos a propósito, para no dañar la validez de las firmas.
- **El abogado destino no ve un documento que sí se transfirió** → los documentos que estaban asignados a un cliente conservan a ese cliente; sólo cambian de abogado responsable. Revisa el listado desde la vista del abogado, no desde la del cliente.
- **Restauraste un abogado y sigue sin poder entrar** → asegúrate de haberlo hecho desde el botón "Restaurar" de esta pantalla. Es el único camino que reactiva la cuenta completa.
- Si el problema persiste, avísale al equipo técnico con una captura de pantalla.

---

## B. Ejecución del Contrato — Cuentas de Cobro

### ¿Qué es y para qué sirve?

Cuando un contrato queda firmado por todas las partes y se pactaron pagos por cuotas, esta funcionalidad permite llevar el control de esos pagos dentro de la misma plataforma. El cliente sube la cuenta de cobro de cada cuota y el abogado la revisa, la acepta o la rechaza explicando por qué.

Es como una carpeta compartida ordenada por cuotas: ambas partes ven en qué van, quién subió qué y cuándo, sin tener que buscar en correos ni en WhatsApp.

### Antes de empezar

- Necesitas **dos cuentas distintas**: la del abogado que creó el documento y la del cliente al que está asignado. Si la misma persona sube y revisa, el sistema no envía correos — es a propósito, no es una falla.
- El documento debe estar **completamente firmado** y tener configurada una forma de pago con al menos una cuota.
- El sistema ya trae datos listos para probar: un documento firmado con **3 cuotas** (la primera aceptada y la segunda esperando revisión) y otro con **2 cuotas** sin ningún registro, donde la cuota 1 está lista para cargar.
- Ten a mano un archivo para subir: **PDF, JPG, PNG o DOCX**, de máximo **20 MB**.

### Paso a paso para probarlo

#### B1. Configurar la forma de pago (abogado)

1. Inicia sesión como abogado y entra a **"Archivos Juridicos"** desde el menú lateral.
2. Abre la pestaña **"Minutas"** y edita la minuta que vas a usar.
3. Ve a la configuración de variables de la minuta. Cada variable tiene una lista llamada **"Campo resumen"**.
4. En la variable que llevará el número de cuotas, elige la opción **"Forma de pago (N cuotas)"**. El tipo de campo cambia solo a numérico.
5. Guarda. Al generar el documento a partir de esta minuta, el número que se escriba en esa variable será la cantidad de cuotas pactadas.
6. Completa el documento y llévalo hasta que quede firmado por todas las partes.

#### B2. Subir la cuenta de cobro (cliente)

7. Inicia sesión como el cliente asignado al documento y entra a **"Archivos Juridicos"**.
8. Ubica el documento firmado y abre su menú de acciones. Verás dos opciones nuevas: **"Subir Cuenta de Cobro"** y **"Ver Cuentas de Cobro"**.
9. Haz clic en **"Subir Cuenta de Cobro"**. Se abre una ventana que indica claramente cuál cuota estás cargando, por ejemplo *"Cuota 1 de 3"*.
10. Arrastra el archivo al recuadro punteado o haz clic para seleccionarlo. Debajo se recuerda el límite: *"PDF, JPG, PNG o DOCX · máx. 20 MB"*.
11. Si quieres, escribe el **"Monto de la cuota"** y unas **"Notas adicionales"**. Ambos campos son opcionales.
12. Haz clic en **"Subir Cuenta de Cobro"** para confirmar.

#### B3. Revisar, aceptar o rechazar (abogado)

13. Vuelve a entrar como el abogado creador del documento. Te habrá llegado un correo avisando que hay una cuenta de cobro nueva.
14. Abre el menú del documento y elige **"Ver Cuentas de Cobro"**.
15. Arriba verás el avance general: una barra de progreso, el texto *"1/3 cuotas aceptadas"* y, a la derecha, **"Total aceptado"** con la suma de los montos ya aprobados.
16. Debajo aparece una ficha por cada cuota con su estado: **Pendiente**, **Cargada · En revisión**, **Aceptada** o **Rechazada**.
17. Haz clic en el nombre del archivo para descargarlo y revisarlo.
18. Si está correcto, pulsa el botón verde **"Aceptar"**.
19. Si no, pulsa **"Rechazar"**: se abre un recuadro para escribir el **"Motivo del rechazo (obligatorio)"**. Escríbelo y pulsa **"Confirmar rechazo"**.

#### B4. Corregir un rechazo (cliente)

20. Entra de nuevo como cliente. Recibirás un correo con el motivo del rechazo.
21. En **"Ver Cuentas de Cobro"**, la cuota rechazada muestra un recuadro rojo con **"Motivo del rechazo:"** y la explicación del abogado.
22. Vuelve a usar **"Subir Cuenta de Cobro"** para cargar la versión corregida de **esa misma cuota**.

### Cómo sabes que funcionó

- El resumen del documento muestra ahora **"Forma de pago"** junto a "Valor" y "Plazo". Si es un solo pago dice *"Pago único"*; si son varios, dice por ejemplo *"3 cuotas"*.
- Después de que el abogado acepta una cuota, la etiqueta de esa cuota cambia a **"Aceptada"**, la barra de progreso avanza y el contador pasa de *"1/3 cuotas aceptadas"* a *"2/3"*.
- La cuota siguiente cambia su mensaje de *"Se habilita cuando la cuota anterior sea aceptada."* a **"Disponible para carga."**
- El valor de **"Total aceptado"** aumenta con el monto de la cuota recién aprobada.
- Cada ficha indica quién subió el archivo y en qué fecha y hora.
- El cliente recibe un correo cuando su cuenta de cobro es aceptada y otro cuando es rechazada, este último con el motivo incluido.

### Si algo no sale como esperabas

- **No aparecen "Subir Cuenta de Cobro" ni "Ver Cuentas de Cobro" en el menú del documento** → revisa tres cosas: que el documento esté completamente firmado, que tenga una forma de pago configurada con al menos una cuota, y que estés entrando con el abogado que lo creó o con el cliente asignado.
- **"Subir Cuenta de Cobro" desapareció del menú** → es normal: cuando hay una cuota esperando revisión, la opción se oculta hasta que el abogado acepte o rechace. Vuelve a aparecer después.
- **El sistema no acepta tu archivo** → revisa que sea PDF, JPG, PNG o DOCX y que no supere los 20 MB.
- **El botón "Confirmar rechazo" está apagado** → el motivo del rechazo es obligatorio; escríbelo y el botón se activa.
- **No llegó ningún correo** → si la misma persona subió la cuenta de cobro y también la revisó, el sistema no envía avisos. Usa dos cuentas distintas para verlos.
- **El "Total aceptado" no coincide con lo que esperabas** → sólo suma los montos de las cuotas ya aceptadas, y el monto es un campo opcional: si no se escribió al cargar, no suma nada.
- Si el problema persiste, avísale al equipo técnico con una captura de pantalla.

---

## C. Tour Guiado del módulo de Archivos Jurídicos

### ¿Qué es y para qué sirve?

Es un recorrido interactivo que aparece la primera vez que entras al módulo de Archivos Jurídicos. La pantalla se oscurece y se va iluminando, uno por uno, cada botón y cada pestaña, con una explicación breve de para qué sirve.

Es como si alguien se sentara al lado tuyo a mostrarte dónde queda cada cosa. El contenido cambia según quién seas: un abogado ve las funciones de creación y firma, y un cliente ve las de consulta y completado.

### Antes de empezar

- **Usa un computador de escritorio o una pantalla ancha.** En pantallas pequeñas el recorrido omite algunos pasos, porque varios botones quedan escondidos dentro de un menú plegable.
- **Entra al módulo desde el menú lateral**, no desde un enlace guardado en favoritos. Si la dirección ya trae una pestaña seleccionada, el recorrido no arranca solo.
- El recorrido automático aparece la **primera vez** que entras al módulo. Si ya lo viste, siempre puedes volver a lanzarlo con el botón de ayuda.
- Si quieres contar exactamente los pasos, usa una cuenta **sin documentos pendientes de firma**: cuando los hay, el recorrido agrega un paso extra.

### Paso a paso para probarlo

#### C1. Recorrido del abogado

1. Inicia sesión con una cuenta de abogado (o de administrador).
2. En el menú lateral, haz clic en **"Archivos Juridicos"**.
3. Medio segundo después, la pantalla se oscurece y aparece una tarjeta de bienvenida: **"Bienvenido a Archivos Jurídicos"**, con los botones **"Comenzar recorrido"** y **"Ahora no"**.
4. Pulsa **"Comenzar recorrido"**. En cada paso verás arriba la etiqueta *"Guía · Archivos Jurídicos"*, un título, una explicación, una barra de avance y el texto *"Paso 1 de 10"*.
5. Avanza con **"Siguiente"** y retrocede con **"Anterior"**. En cualquier momento puedes salir con **"Omitir guía"**.
6. Los diez pasos que verás, en orden, son: *Pestañas de navegación*, *Minutas*, *Nueva Minuta*, *Mis Documentos*, *Nuevo Documento*, *Documentos por firmar*, *Carpetas*, *Documentos de clientes*, *Firma Electrónica* y *Membrete Global*.
7. Fíjate en los pasos *Nueva Minuta* y *Nuevo Documento*: el sistema **cambia solo de pestaña** para poder mostrarte el botón del que está hablando.
8. Al terminar aparece una tarjeta de cierre, **"Hasta aquí el recorrido"**, que apunta al botón de ayuda y te explica cómo repetir la guía. Pulsa **"Entendido"**.

#### C2. Recorrido del cliente

9. Cierra sesión y entra con una cuenta de cliente.
10. Ve otra vez a **"Archivos Juridicos"**. El recorrido arranca igual, pero esta vez con **siete pasos**: *Pestañas de navegación*, *Carpetas*, *Mis Documentos*, *Documentos por firmar*, *Documentos formalizados*, *Nuevo Documento* y *Firma Electrónica*.

#### C3. Volver a ver la guía cuando quieras

11. En la franja superior del módulo, a la derecha, hay un botón redondo con un signo de interrogación. Al pasar el cursor muestra el texto *"Ver guía del módulo"*.
12. Haz clic ahí en cualquier momento y el recorrido empieza otra vez desde el principio.

#### C4. Textos de ayuda permanentes

13. Sin lanzar el recorrido, pasa el cursor por encima de los pequeños iconos de información que están junto a los botones **"Firma Electrónica"**, **"Membrete Global"** y **"Nuevo Documento"**.
14. Aparece una descripción corta de para qué sirve cada uno. Quedan siempre disponibles, sin necesidad de repetir la guía completa.

### Cómo sabes que funcionó

- La pantalla se oscurece y sólo queda iluminado el elemento del que se está hablando.
- El contador de pasos avanza y la barra de progreso se llena a medida que recorres.
- En los pasos que lo requieren, la pestaña activa **cambia sola** antes de mostrarte el botón.
- Al llegar al final y pulsar "Entendido", se lanza una pequeña animación de celebración.
- El puntito animado que estaba sobre el botón de ayuda desaparece una vez que completas u omites el recorrido.
- Si sales del módulo y vuelves a entrar, el recorrido **ya no arranca solo**: eso confirma que el sistema recordó que ya lo viste.
- Pasados 30 días, al volver a entrar aparece un aviso preguntando **"¿Quieres ver la guía del módulo de Archivos Jurídicos?"** con las opciones *"Ver la guía"* y *"Ahora no"*.

### Si algo no sale como esperabas

- **El recorrido no arranca solo** → puede que ya lo hayas visto antes con esa cuenta. Úsalo desde el botón de ayuda. También revisa que hayas entrado desde el menú lateral y no desde un enlace que ya trae una pestaña abierta.
- **Ves menos pasos de los que dice esta guía** → estás en una pantalla angosta. Amplía la ventana o pásate a un computador de escritorio.
- **Aparece un paso extra sobre firmas pendientes** → es normal y esperado: el recorrido lo agrega cuando la cuenta tiene documentos esperando tu firma.
- **Contaste 12 pantallas pero el contador decía "de 10"** → la tarjeta de bienvenida y la de cierre no se cuentan como pasos, porque no explican una función del módulo sino el recorrido en sí.
- **Quieres volver a ver el arranque automático** → pídele al equipo técnico que reinicie el registro de tu recorrido, o espera los 30 días en los que el sistema lo ofrece de nuevo por su cuenta.
- **Omitiste el recorrido y ya no aparece** → omitirlo también cuenta como haberlo visto. Usa el botón de ayuda para retomarlo.
- Si el problema persiste, avísale al equipo técnico con una captura de pantalla.
