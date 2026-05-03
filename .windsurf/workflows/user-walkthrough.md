---
description: Genera una guía paso a paso, amigable y no técnica, para que un usuario pueda entender, probar y validar cualquier funcionalidad, vista u opción del sistema.
auto_execution_mode: 2
---

# User Walkthrough

## Objetivo
Entregar a una persona **no técnica** una guía clara y amigable para probar y validar una funcionalidad, vista, pantalla u opción del sistema.

## Antes de responder
1. Si el usuario **no especificó** qué funcionalidad, vista u opción quiere probar, **pregúntalo primero** con una sola pregunta corta (ej: "¿Qué funcionalidad, vista u opción quieres que explique?"). No inventes el tema.
2. Explora el código lo mínimo necesario para entender el comportamiento real (rutas, componentes de UI, permisos por rol, condiciones previas). **No muestres** esa exploración al usuario final.
3. Detecta si hay variantes por rol, plan o estado (ej: admin vs cliente, logueado vs invitado). Si las hay, sepáralas en secciones.

## Formato de la respuesta
Responde en **español**, con tono amigable y cercano. Usa exactamente estos cinco bloques, en este orden, con los mismos encabezados:

### 1. ¿Qué es y para qué sirve?
2–4 frases sencillas. Describe el beneficio para el usuario, no la implementación. Puedes usar analogías cotidianas. Evita nombres técnicos (clases, endpoints, tablas, frameworks).

### 2. Antes de empezar
Lista breve de requisitos previos:
- Acceso o rol necesario (y cómo conseguirlo si aplica).
- Datos de ejemplo o cuenta de prueba.
- Dispositivo, navegador o app recomendada.
- Cualquier configuración, permiso o paso previo indispensable.

### 3. Paso a paso para probarlo
Lista numerada. Cada paso describe **una sola acción visible**: "Entra a…", "Haz clic en…", "Escribe…", "Selecciona…". Describe lo que la persona ve y hace en pantalla, no lo que pasa por dentro. Si hay variantes por rol, crea sub-secciones ("### 3a. Si eres administrador", "### 3b. Si eres cliente").

### 4. Cómo sabes que funcionó
Señales visibles de éxito: un mensaje de confirmación, un cambio en pantalla, un correo, un elemento nuevo en una lista. Si puede verificarse desde otra vista, explica cómo llegar allí en lenguaje simple.

### 5. Si algo no sale como esperabas
2–4 problemas comunes con una posible solución para cada uno (ej: "No aparece el botón → revisa que hayas iniciado sesión con una cuenta de tipo X"). Cierra indicando a quién acudir si persiste ("avísale al equipo técnico con una captura de pantalla").

## Reglas estrictas
- **Español** siempre, sin importar el idioma del input.
- **Sin jerga técnica**: nada de "endpoint", "modelo", "migración", "request", "token", "serializer", "componente", "hook", "build", etc. Si un término técnico es inevitable, explícalo en una frase simple.
- **Sin** rutas de archivos, nombres de funciones/clases, snippets de código, comandos de terminal, URLs internas del repo ni IDs de base de datos.
- **Sin** preámbulos tipo "Aquí tienes la guía:". Empieza directo con el encabezado `### 1. ¿Qué es y para qué sirve?`.
- Mantén cada bloque breve: el usuario debería poder leer toda la guía en menos de 2 minutos.
- Si la funcionalidad aún no existe o no se puede identificar en el sistema, dilo con claridad y pide más contexto en lugar de inventar pasos.
