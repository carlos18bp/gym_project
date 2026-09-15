---
name: "client-response"
description: "Analiza mensajes entrantes de clientes por correo o WhatsApp y prepara una respuesta fundamentada, sin mezclar etapas ni ampliar el alcance. Revisa hilos, documentos contractuales, requerimientos y código; clasifica cambios, pide decisión para posibles cortesías, genera documento formal cuando corresponde y guarda borradores de correo + WhatsApp en ProjectApp. Nunca envía mensajes ni implementa cambios. Para avisos salientes simples usa client-message."
---

# Client Response — responder con contexto, alcance y trazabilidad

Esta skill atiende un **mensaje entrante** del cliente. Reconstruye la conversación,
separa los temas por etapa, contrasta cada afirmación con las fuentes correctas y
prepara un solo paquete coherente: documento formal cuando aplica, correo y WhatsApp.

No es una skill de implementación ni de envío. Una definición que cambie el sistema
queda pendiente de aceptación expresa del cliente antes de pasar a desarrollo.

> **Enrutamiento:**
> - Mensaje entrante que exige análisis, respuesta, alcance o decisión → esta skill.
> - Aviso saliente simple sobre una entrega, documento o aprobación ya resuelta →
>   $client-message.
> - Reporte de cambios ya implementados y guía para validarlos → $client-report.

## Cómo invocarla

- `$client-response --email 1234` → abre ese UID y reconstruye su hilo.
- `$client-response --email "asunto o texto"` → busca el mensaje en las carpetas
  configuradas para el cliente y abre el hilo completo.
- `$client-response --whatsapp "<mensaje pegado>"` → usa el texto literal como
  entrada; no intenta buscarlo en correo.
- `$client-response` → usa el mensaje entrante inequívoco que el operador acaba de
  pegar o mencionar. Si no existe, busca el correo reciente del contacto configurado.

Con argumentos explícitos no pregunta cuál mensaje atender. Sin argumentos, si hay
varios candidatos plausibles, muestra remitente, fecha y asunto y pregunta una sola
vez cuál corresponde. Nunca elige entre conversaciones ambiguas.

## Fase 0 — identidad y perfil (read-only)

La skill se ejecuta dentro del repo del cliente. Resuelve la fecha desde el sistema,
el `codebase` desde `remote.origin.url`, y lee:

- `config/client-comms/profile.yml` del toolkit;
- `config/client-comms/clients/<codebase>.yml`;
- `projects.yml` para el nombre canónico, entorno y coordenada de trabajo.

El perfil puede declarar remitentes, carpetas IMAP, contextos, carpetas del Gestor,
`client_id`, `project_id` y `thread_id`. Todos son datos de ayuda: antes de escribir
en ProjectApp se confirma su vigencia con los MCP read-only disponibles.

Si no existe un perfil per-cliente, la skill sigue con los datos verificables del
hilo y propone guardar únicamente la configuración no sensible que haya resuelto.
No mezcla perfiles de otros clientes.

## Fase 1 — reconstruir la conversación completa

### Correo

1. Busca primero en las carpetas configuradas del cliente; no barre buzones ajenos.
2. Abre el mensaje completo, incluidos `Message-ID`, `In-Reply-To`, `References`,
   remitente, destinatarios y fecha.
3. Recorre mensajes relacionados en entrada y enviados hasta reconstruir el hilo.
4. Conserva el asunto existente. La respuesta usa `Re: <asunto>` sin duplicar un
   prefijo `Re:` ya presente.

### WhatsApp

El texto pegado es la fuente primaria. Si el operador incluyó fecha, remitente o
mensajes anteriores, se preservan como contexto; lo que no fue pegado no se inventa.
Si el mensaje alude a «lo anterior» y falta ese antecedente, se pide en una sola
pregunta de texto antes de redactar.

### Hilos previos de ProjectApp

Cuando está disponible el Gestor de Comunicaciones, localiza el cliente y abre los
hilos del mismo contexto. Los usa para evitar repetir respuestas, contradecir una
aprobación anterior o volver a pedir algo ya recibido. Un borrador no enviado nunca
cuenta como comunicación al cliente.

## Fase 2 — expediente mínimo y dos ejes de verdad

Antes de concluir, consulta sólo las fuentes necesarias para los puntos del mensaje:

- levantamiento y versiones aceptadas de requerimientos;
- propuesta económica y sus exclusiones;
- Otrosí y contrato firmado;
- documentos de Fase 1, Fase 1.5, Fase 2 u otras fases nombradas;
- respuestas, actas, correos y WhatsApp anteriores;
- código, tests y estado real del sistema para saber qué existe hoy.

Mantén separados estos dos ejes:

| Pregunta | Precedencia |
|---|---|
| ¿Qué se acordó? | contrato/Otrosí firmado → propuesta o requerimiento aceptado → aprobación fechada en hilo → borrador |
| ¿Qué hace hoy el sistema? | estado real → código y tests → documentación técnica vigente |

El código prueba comportamiento, no alcance contractual. Un documento comercial
prueba alcance, no que algo esté implementado. Si discrepan, la respuesta explica
ambos hechos sin corregirlos en silencio.

Para cada afirmación que llegará al cliente conserva una referencia concreta:
documento e ID/versión, mensaje y fecha, archivo/ruta de código, prueba o estado real.
La referencia detallada va en una nota privada, no en el texto comercial.

## Fase 3 — separar por contexto e inventariar estado

Identifica la fase, etapa, módulo o hilo activo del mensaje. Luego clasifica cada
punto en uno de estos grupos:

1. **Pertenece al contexto activo:** se responde aquí.
2. **Depende del contexto activo:** se aclara sólo la dependencia necesaria.
3. **Pertenece a otra etapa o asunto:** se reconoce y se redirige a su hilo, sin
   resolverlo ni reabrir decisiones en esta respuesta.
4. **Contexto incierto:** se pregunta al operador; no se adivina.

Construye además un inventario fechado:

- **Hecho e implementado:** evidencia de código/estado real.
- **Aprobado:** quién aprobó, qué versión y fecha exacta.
- **Pendiente del cliente:** información, prueba, firma o aceptación.
- **Pendiente nuestro:** análisis o trabajo ya incluido y todavía no cerrado.
- **No acordado / fuera de alcance:** fundamento contractual o de requerimientos.

Una aprobación exige evidencia explícita. El silencio, una reunión sin acta o un
borrador compartido no se convierten en aprobación.

## Fase 4 — clasificar cada punto y decidir la respuesta

| Clase | Respuesta obligatoria |
|---|---|
| Pregunta | Responder de forma directa y justificar con la fuente adecuada. |
| Bug contra comportamiento acordado | Reconocerlo, indicar estado y siguiente validación; no llamarlo requerimiento nuevo. |
| Cambio ya acordado | Resumir la definición vigente y pedir aceptación si la nueva precisión altera la implementación. |
| Cambio menor posiblemente de cortesía | Detenerse y preguntar al operador si se incluye como cortesía. |
| Cambio material o fuera de alcance | Explicar el límite y encauzarlo por paquete de horas, estimación o propuesta. |
| Duda nuestra | Formularla antes de prometer, estimar o redactar una conclusión falsa. |

### Gate de cortesía

Sólo se ofrece al operador la decisión de cortesía cuando la evidencia indica un
ajuste pequeño, localizado, sin nueva vista, flujo, rol, integración, modelo de datos,
regla transversal ni riesgo relevante. Muestra:

- qué pidió exactamente el cliente;
- por qué parece menor;
- impacto observable y riesgo conocido;
- qué se respondería si se acepta o se rechaza la cortesía.

Pregunta: **«¿Lo incluimos como cortesía, dejando claro que no crea precedente?»**
No le menciona al cliente la posibilidad hasta recibir la decisión del operador.

Si el cambio es material, no fuerza una falsa decisión de cortesía: explica que debe
estimarse y consumirse del paquete de horas o cotizarse por separado, de acuerdo con
la fuente comercial aplicable. Nunca inventa horas, precio ni fecha.

## Fase 5 — decidir si existe documento formal

Se crea o actualiza un documento de respuesta cuando se cumple al menos una condición:

- hay dos o más puntos sustantivos;
- se discute alcance, cortesía, horas, costo, contrato u Otrosí;
- se define o cambia comportamiento que requerirá aceptación;
- se registra aprobación, desacuerdo o una decisión con efecto posterior;
- el inventario aprobado/pendiente es necesario para ordenar el siguiente esfuerzo.

Una aclaración única, factual y sin efecto en alcance, implementación ni aprobación
usa **sólo el Gestor de Comunicaciones**. Ante duda razonable, usa documento formal.

El documento formal vive directamente en el Gestor de Documentos. Esta skill no crea
`docs/reports/` ni otro archivo de respuesta dentro del repo.

### Estructura del documento

```markdown
# Respuesta — <etapa y tema>

**Cliente:** <nombre>
**Contacto:** <contacto>
**Fecha:** <fecha del sistema>
**Contexto:** <fase / etapa / hilo>
**Mensaje respondido:** <canal, fecha y asunto o referencia>

## Respuesta ejecutiva
<qué queda aclarado o decidido, centrado en el contexto activo>

## Respuesta por puntos
### 1. <punto del cliente>
**Respuesta:** <respuesta directa y justificada, sin jerga interna>
**Estado:** <hecho / aprobado / pendiente / fuera de alcance>
**Siguiente paso:** <una acción o decisión concreta>

## Temas que corresponden a otro contexto
- <tema>: se atenderá en <fase/etapa/hilo>; no se redefine aquí.

## Estado consolidado
### Hecho y aprobado
- <ítem, versión y fecha de aprobación>

### Pendiente
- <ítem, responsable y condición de cierre>

## Confirmación solicitada
<definiciones que el cliente debe aceptar expresamente antes de implementar>
```

Omite secciones vacías. No expone hashes, rutas internas, IDs MCP ni discusión
operativa. Sí incluye nombres de documentos/versiones que el cliente reconoce.

## Fase 6 — redactar correo y WhatsApp

El correo es la respuesta completa en lenguaje no técnico y enlaza/nombra el
documento cuando existe. Reglas:

- noticia o respuesta principal en el primer párrafo;
- un bloque por punto del contexto activo;
- los temas externos se redirigen en una sola sección breve;
- fuera de alcance siempre lleva fundamento y vía de atención;
- si cambia una definición, termina pidiendo aceptación expresa antes de implementar;
- no promete plazo, costo, trabajo ni cortesía no autorizados;
- conserva el asunto del hilo con un solo `Re:`.

El WhatsApp tiene entre 35 y 80 palabras. Indica que la respuesta quedó en el correo,
nombra el tema activo y pide revisar o confirmar. No resume toda la discusión, no
abre otro alcance y no incluye firma formal.

Correo y WhatsApp se conservan idénticos entre el output, las notas privadas del
documento y los borradores del Gestor de Comunicaciones.

## Fase 7 — persistencia en ProjectApp

Primero ejecuta **todo el descubrimiento read-only**. Después muestra una única
propuesta de mutación y espera confirmación explícita del operador. La propuesta
incluye IDs/nombres resueltos y cada operación que se hará:

1. crear el cliente si no existe;
2. crear la carpeta documental si hace falta y el operador aprobó ese destino;
3. crear el hilo del contexto si no existe;
4. registrar el mensaje entrante si todavía no está en el hilo;
5. crear o actualizar el documento formal, si aplica;
6. crear un borrador saliente de email;
7. crear un borrador saliente de WhatsApp.

Una confirmación cubre ese lote exacto. Si cambia el destino, cliente, documento o
contenido después de confirmarlo, vuelve a mostrar el delta y pide nueva confirmación.

### Cliente e hilo

- Busca por empresa, contacto y correo. No crea duplicados por diferencias de
  mayúsculas, tildes o abreviaturas.
- Si falta el cliente, propone `create_client` con los datos verificables; los datos
  desconocidos se omiten.
- Reutiliza un hilo del mismo cliente y contexto. Un título recomendado es
  `<Cliente> — <Fase/Etapa>`; no acumula todas las fases en un hilo genérico.
- Antes de registrar el entrante compara canal, fecha, asunto y contenido con el hilo
  completo. Si ya existe, reutiliza su `message_id` como `reply_to_id`.

### Documento formal

- Resuelve la carpeta desde `respuestas.contextos` del perfil. Ante contexto o
  documento ambiguo pregunta; no usa automáticamente la carpeta general.
- Busca una respuesta anterior del mismo hilo. Actualiza sólo si realmente es una
  revisión de ese documento; de lo contrario crea uno nuevo.
- Asocia `client_id` y, si existe y pertenece al cliente, `project_id`.
- Guarda el asunto, cuerpo de email y WhatsApp en los campos privados estándar.
- Guarda exactamente dos `client_custom_notes`, en este orden:
  1. **Índice de trazabilidad:** punto → mensaje/fecha → documento/versión o
     código/estado → clasificación.
  2. **Inventario de estado:** hecho/aprobado con fechas, pendientes por actor y
     asuntos fuera de alcance.

### Comunicaciones

- El mensaje entrante queda `incoming` y se registra como recibido.
- Email y WhatsApp salientes se crean con `direction=outgoing`; ProjectApp los deja
  en estado `draft` y no los entrega.
- Si existe documento formal, ambos borradores llevan su `document_id`.
- Ambos borradores responden al mensaje entrante cuando existe `message_id`.
- **Nunca** llama `mark_message_sent` durante la preparación. Sólo puede usarla en
  un turno posterior si el operador afirma expresamente que ese mensaje exacto ya se
  envió por fuera de ProjectApp; registra el hecho, no envía nada.

### Degradación segura

- Sin Gestor de Documentos: devuelve el markdown formal, pero declara que no quedó
  persistido.
- Sin Gestor de Clientes o Comunicaciones: devuelve los textos listos para copiar y
  declara qué registros no se crearon.
- Sin IMAP: para correo pide que el operador pegue el mensaje/hilo; para WhatsApp
  sigue normalmente.
- Nunca afirma «creado», «actualizado», «guardado» o «enviado» sin resultado MCP.

## Guardrails

1. No implementar, editar código ni abrir una tarea de desarrollo desde esta skill.
2. No enviar correo ni WhatsApp; sólo preparar borradores.
3. No mezclar etapas para «aprovechar» una respuesta.
4. No convertir una idea, cortesía o borrador en alcance aprobado.
5. No marcar una aprobación sin actor, objeto/versionado y fecha.
6. No declarar fuera de alcance sin citar el fundamento en la nota privada.
7. No prometer fechas, horas o precios no confirmados por el operador o una fuente.
8. No exponer al cliente la trastienda técnica ni datos privados del expediente.
9. No crear ni actualizar nada por MCP antes de la confirmación del lote.
10. No duplicar mensajes, clientes, hilos o documentos existentes.

## Output final

Excepción **output-es-el-producto** de $output-protocol: el documento y los dos
mensajes son el entregable. Muéstralos completos, seguidos por un estado compacto de
persistencia; no agregues un menú post-run.

Orden:

1. `### Documento de respuesta` con markdown, o `No aplica — aclaración simple`.
2. `### Correo` en bloque de texto plano, incluido `Asunto:`.
3. `### WhatsApp` en bloque de texto plano.
4. `### Inventario de estado` con hecho/aprobado y pendiente.
5. Tabla breve: entrada, cliente/hilo, documento, borrador email, borrador WhatsApp.
6. Veredicto:
   - `🟢 client-response OK — respuesta y borradores registrados` cuando todo el
     lote aprobado quedó persistido;
   - `🟡 client-response OK — textos listos; persistencia parcial o no disponible`;
   - `⏸️ client-response — decisión del operador pendiente` para cortesía, duda
     material o confirmación MCP todavía no resuelta.

## Notas de fleet

- Fuente canónica: `vps-ops-toolkit/workflows/.claude/client-response.md`.
- Mirror Codex: generado en `workflows/.agents/skills/client-response/`.
- Perfil y rutas: `config/client-comms/README.md`.
- Distribución inicial: Vástago; el diseño es fleet-wide y puede sincronizarse a
  cualquier proyecto elegible mediante $sync-ai-ecosystems.
