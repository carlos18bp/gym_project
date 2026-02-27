# Requirement Document / Documento de Requerimiento

---

## 4. Tour Guiado / Onboarding Interactivo

---

### Descripción

Actualmente, la plataforma no cuenta con un sistema de guía interactiva que oriente a los usuarios nuevos en el uso de las diferentes funcionalidades. Los usuarios deben descubrir por sí mismos cómo navegar y utilizar el sistema, lo que puede generar confusión, subutilización de funcionalidades y una curva de aprendizaje más prolongada.

Si bien existe un manual de usuario accesible desde un modal, este requiere que el usuario lo busque activamente y lea el contenido de forma pasiva. No existe una experiencia de aprendizaje guiada que muestre directamente sobre la interfaz cómo utilizar cada elemento.

Esta carencia afecta especialmente a usuarios nuevos y puede resultar en consultas frecuentes al soporte técnico sobre funcionalidades básicas.

---

### Propuesta de Mejora

Implementar un sistema de tour guiado (Product Tour) que oriente a los usuarios paso a paso en el uso de la plataforma, comenzando por el módulo de Archivos Jurídicos:

#### Tour Interactivo Paso a Paso
• **Overlay Visual**: Al iniciar el tour, se oscurece la pantalla excepto el elemento que se está explicando, creando un efecto de "spotlight" que enfoca la atención del usuario.

• **Popover Explicativo**: Junto al elemento resaltado, aparece un cuadro con título y descripción explicando la funcionalidad.

• **Navegación del Tour**: Botones "Siguiente", "Anterior" y "Omitir" permiten al usuario controlar el ritmo del recorrido.

• **Cambio Automático de Contexto**: El tour cambia automáticamente la pestaña activa cuando necesita mostrar elementos que solo son visibles en ciertas secciones.

#### Diferenciación por Rol de Usuario
• **Tour para Abogados**: Enfocado en creación de minutas, gestión de documentos, asignación a clientes, configuración de firma y membrete (10 pasos).

• **Tour para Clientes**: Enfocado en consulta de documentos, completar información requerida, proceso de firma electrónica (7 pasos).

• **Contenido Relevante**: Cada rol ve únicamente los pasos pertinentes a sus funciones y permisos en la plataforma.

#### Persistencia y Repetición
• **Registro en Backend**: El progreso del tour se guarda en el servidor, permitiendo que el sistema recuerde si el usuario ya completó la guía.

• **Repetición Mensual**: El tour se ofrece nuevamente después de 30 días desde la última vez que se completó, permitiendo refrescar el conocimiento.

• **Modal de Confirmación**: En repeticiones mensuales, se pregunta al usuario si desea ver la guía nuevamente (no se fuerza).

#### Acceso Manual
• **Botón de Ayuda Permanente**: Un botón "?" visible en la interfaz permite al usuario re-lanzar el tour en cualquier momento que lo necesite.

#### Tooltips Informativos Permanentes
• **Iconos de Información**: Pequeños iconos junto a elementos clave que al pasar el cursor muestran una descripción breve.

• **Complemento al Tour**: Estos tooltips permanecen disponibles después del tour como referencia rápida.

---

### Beneficios Esperados

• **Reducción de Curva de Aprendizaje**: Los usuarios nuevos aprenden a usar la plataforma de forma guiada e intuitiva.

• **Menor Carga de Soporte**: Disminuyen las consultas básicas al soporte técnico sobre cómo usar funcionalidades.

• **Mayor Adopción de Funcionalidades**: Los usuarios descubren características que podrían no haber encontrado por sí mismos.

• **Experiencia de Usuario Mejorada**: Una introducción guiada genera una primera impresión positiva de la plataforma.

• **Contenido Personalizado**: Cada tipo de usuario recibe orientación relevante para su rol específico.

• **Refuerzo Periódico**: La repetición mensual ayuda a recordar funcionalidades poco utilizadas o nuevas características.

• **Autonomía del Usuario**: El botón de ayuda permanente permite acceder a la guía cuando sea necesario, sin depender de soporte.

---

### Flujo de Operación

#### 1. Primer Ingreso del Usuario
   ○ El usuario inicia sesión en la plataforma por primera vez (o después de 30 días).
   ○ El sistema verifica si debe mostrar el tour según el historial del usuario.
   ○ Si es primer ingreso: el tour inicia automáticamente después de que la página carga.
   ○ Si es repetición mensual: aparece un modal preguntando "¿Quieres ver la guía del módulo?"

#### 2. Inicio del Tour (Abogados)
   ○ **Paso 1**: Se resaltan las pestañas de navegación con explicación general.
   ○ **Paso 2**: Se enfoca la pestaña "Minutas" explicando su propósito.
   ○ **Paso 3**: El sistema cambia a la pestaña Minutas y resalta el botón "Nueva Minuta".
   ○ **Paso 4**: Se explica la pestaña "Mis Documentos".
   ○ **Paso 5**: Se resalta el botón "Nuevo Documento" explicando cómo crear documentos desde minutas.
   ○ **Paso 6**: Se explica la pestaña "Documentos Por Firmar".
   ○ **Paso 7**: Se explica la pestaña "Carpetas" para organización.
   ○ **Paso 8**: Se explica la pestaña "Documentos de Clientes".
   ○ **Paso 9**: Se resalta el botón de "Firma Electrónica" para configuración.
   ○ **Paso 10**: Se resalta el botón de "Membrete Global".

#### 3. Inicio del Tour (Clientes)
   ○ **Paso 1**: Se resaltan las pestañas de navegación con explicación general.
   ○ **Paso 2**: Se explica la pestaña "Carpetas".
   ○ **Paso 3**: Se explica la pestaña "Mis Documentos" para documentos asignados.
   ○ **Paso 4**: Se explica la pestaña "Documentos Por Firmar".
   ○ **Paso 5**: Se explica la pestaña "Documentos Firmados".
   ○ **Paso 6**: Se resalta el botón "Nuevo Documento".
   ○ **Paso 7**: Se resalta el botón de "Firma Electrónica".

#### 4. Navegación Durante el Tour
   ○ El usuario puede avanzar con "Siguiente" o retroceder con "Anterior".
   ○ En cualquier momento puede seleccionar "Omitir" para cerrar el tour.
   ○ Al completar todos los pasos o al omitir, se registra en el backend.

#### 5. Acceso Manual al Tour
   ○ El usuario puede hacer clic en el botón "?" (ayuda) en cualquier momento.
   ○ Se inicia el tour desde el primer paso.
   ○ Útil para usuarios que omitieron el tour inicial o necesitan un repaso.

#### 6. Tooltips Permanentes
   ○ Después del tour, los iconos de información permanecen junto a elementos clave.
   ○ Al pasar el cursor sobre ellos, aparece una breve descripción de la funcionalidad.
   ○ Sirven como referencia rápida sin necesidad de re-ejecutar el tour completo.

---

### Validaciones y Reglas de Negocio

• **Un Tour por Usuario por Módulo**: Se registra un único registro de progreso por combinación usuario-módulo.

• **Cálculo de 30 Días**: La repetición se calcula desde la fecha de última completación, no desde el primer ingreso.

• **Tour Completo o Parcial**: El tour se marca como completado tanto si el usuario llega al final como si lo omite.

• **Detección de Rol**: El sistema determina automáticamente qué versión del tour mostrar según el rol del usuario.

• **Elementos Visibles**: El tour solo intenta resaltar elementos que existen en el DOM; si un botón no está visible, el paso se omite.

• **Selectores Estables**: Se utilizan atributos `data-tour` en lugar de clases CSS para identificar elementos, evitando problemas con cambios de estilos.

---

### Consideraciones de Seguridad

• **Autenticación Requerida**: Los endpoints de progreso de tour solo son accesibles para usuarios autenticados.

• **Datos del Usuario Propio**: Cada usuario solo puede ver y modificar su propio progreso de tour.

• **Sin Información Sensible**: El tour no expone ni manipula datos sensibles; solo registra progreso.

---

### Cambios Transversales en la Aplicación

La implementación de este requerimiento genera cambios que impactan otros módulos de la plataforma:

#### Backend - Nuevo Modelo y API
• **Modelo TourProgress**: Nueva tabla para registrar el progreso de tours por usuario.
• **Endpoints REST**: GET para consultar tours completados, POST para marcar completación.
• **Serializer**: Validación y transformación de datos del tour.

#### Frontend - Nueva Librería
• **Driver.js**: Instalación de librería especializada en product tours (~5KB, sin dependencias).
• **Composable useGuidedTour**: Lógica reutilizable para iniciar tours, verificar progreso y completar.

#### Frontend - Configuración de Tours
• **Archivo tourSteps.js**: Definición centralizada de los pasos de cada tour por rol.
• **Atributos data-tour**: Marcadores en elementos del DOM para identificación estable.

#### Dashboard de Archivos Jurídicos
• **Atributos de Tour**: Agregar `data-tour` a tabs, botones y secciones.
• **Trigger Automático**: Lógica en `onMounted` para verificar e iniciar tour.
• **Botón de Ayuda**: Nuevo botón "?" para acceso manual al tour.

#### Componente de Tooltip
• **InfoTooltip.vue**: Nuevo componente reutilizable para tooltips informativos.
• **Implementación en Dashboard**: Agregar tooltips junto a elementos clave.

#### Manual de Usuario
• **Nueva Sección**: Documentar el sistema de tour guiado.
• **Instrucciones**: Explicar cómo acceder manualmente al tour.
• **Capturas**: Mostrar ejemplos del tour en acción.

#### Integración con Alertas de Archivos Legales
• **Step Condicional**: Si el usuario tiene firmas pendientes, el tour incluye un paso destacando esa sección.
• **Complemento Visual**: El tour refuerza las alertas visuales existentes de documentos pendientes.

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los usuarios reciban la guía interactiva desde cualquier dispositivo, adaptando la experiencia de tour a las características de cada plataforma.

• La primera iteración se enfoca únicamente en el módulo de Archivos Jurídicos. El sistema está diseñado para ser extensible a otros módulos en el futuro (Procesos, Solicitudes, etc.).

• La librería Driver.js es ligera (~5KB) y no tiene dependencias externas, minimizando el impacto en el rendimiento de la aplicación.

• Los selectores utilizan atributos `data-tour` en lugar de clases CSS para garantizar estabilidad ante cambios de diseño.

• **Importante**: La implementación de este requerimiento incluye la actualización del manual de usuario para documentar el sistema de tour guiado y cómo acceder a él manualmente.

---

## Análisis de Esfuerzo y Estimación de Precio

### Clasificación de Dificultad: **MEDIO**

| Indicador | Presente |
|-----------|----------|
| Nuevo modelo en backend | ✅ |
| Instalación de librería externa | ✅ |
| Nuevo composable Vue | ✅ |
| Lógica condicional por rol | ✅ |
| Modificación de componente existente | ✅ |
| Nuevo componente reutilizable | ✅ |
| Integración con sistema existente | ✅ |