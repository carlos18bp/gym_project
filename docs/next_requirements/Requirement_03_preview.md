# Requirement Document / Documento de Requerimiento

---

## 3. Previsualización de Plantillas con Variables Formateadas

---

### Descripción

Actualmente, cuando un abogado desea crear un nuevo documento a partir de una plantilla existente, el flujo de selección no ofrece la posibilidad de previsualizar el contenido de la plantilla antes de utilizarla. El abogado debe seleccionar directamente la plantilla y comenzar el proceso de creación sin poder verificar si es la adecuada para su caso.

Además, las variables dentro de las plantillas se muestran en su formato técnico (`{{variable_name}}`), lo cual dificulta la lectura y comprensión del contenido real del documento para usuarios no técnicos.

Esta limitación obliga a los abogados a "adivinar" cuál plantilla es la correcta basándose únicamente en el nombre, o a iniciar el proceso de creación para luego cancelarlo si la plantilla no es la adecuada.

---

### Propuesta de Mejora

Implementar una funcionalidad de previsualización en el flujo de selección de plantillas ("Nuevo Documento") que permita a los abogados ver el contenido de una plantilla antes de utilizarla, con las variables mostradas de forma legible:

#### Previsualización de Plantillas
• **Nueva Opción de Preview**: Agregar la opción "Previsualización" en el menú de acciones de cada plantilla en la tabla de selección.

• **Acceso Rápido**: Al hacer clic en una fila de la tabla, se abrirá un modal con las opciones disponibles (previsualización y usar plantilla), siguiendo el mismo patrón de interacción usado en otras tablas de la plataforma.

• **Modal de Vista Previa**: Utilizar el modal de previsualización existente en la plataforma para mostrar el contenido de la plantilla.

#### Formato Legible de Variables
• **Variables Conocidas**: Las variables definidas en el sistema se mostrarán como etiquetas visuales (pills) con su nombre en español, facilitando la lectura del documento.

• **Variables No Definidas**: Las variables que no estén registradas en el sistema se mostrarán en texto plano entre corchetes `[nombre_variable]`, indicando que requieren definición.

• **Solo en Previsualización**: Este formateo visual aplica únicamente en el modal de vista previa; el editor de documentos mantiene su comportamiento actual.

#### Menú de Acciones Mejorado
• **Dos Opciones Claras**: El menú de cada plantilla mostrará:
  - "Previsualización" - Para ver el contenido antes de usar
  - "Usar plantilla" - Para iniciar la creación del documento (comportamiento actual)

• **Consistencia de Interfaz**: El comportamiento será idéntico al de otras tablas de documentos en la plataforma, manteniendo una experiencia de usuario coherente.

---

### Beneficios Esperados

• **Mejor Toma de Decisiones**: Los abogados pueden verificar que la plantilla es adecuada antes de iniciar el proceso de creación.

• **Ahorro de Tiempo**: Evita iniciar y cancelar procesos de creación cuando la plantilla seleccionada no es la correcta.

• **Mayor Legibilidad**: Las variables mostradas en formato legible facilitan la comprensión del contenido real del documento.

• **Experiencia Consistente**: El flujo de interacción es coherente con otras secciones de la plataforma donde ya existe previsualización.

• **Reducción de Errores**: Disminuye la posibilidad de seleccionar una plantilla incorrecta por falta de información.

• **Facilidad de Uso**: Usuarios menos familiarizados con el sistema pueden entender mejor el contenido de las plantillas.

---

### Flujo de Operación

#### 1. Acceso a Selección de Plantillas
   ○ El abogado hace clic en "Nuevo Documento" desde el dashboard o menú de documentos.
   ○ Se muestra la tabla de plantillas disponibles (Published).
   ○ Cada fila muestra el nombre de la plantilla y un menú de acciones (⋮).

#### 2. Interacción con la Tabla (Opción A - Clic en Fila)
   ○ El abogado hace clic en cualquier parte de la fila de una plantilla.
   ○ Se abre un modal con dos opciones: "Previsualización" y "Usar plantilla".
   ○ Este comportamiento es idéntico al de otras tablas de documentos en la plataforma.

#### 3. Interacción con la Tabla (Opción B - Menú de Acciones)
   ○ El abogado hace clic en el menú (⋮) de una plantilla.
   ○ Se despliegan las opciones: "Previsualización" y "Usar plantilla".
   ○ El abogado selecciona la acción deseada.

#### 4. Previsualización de Plantilla
   ○ Al seleccionar "Previsualización", se abre el modal de vista previa.
   ○ El contenido de la plantilla se muestra con las variables formateadas:
     - Variables conocidas aparecen como etiquetas visuales con nombre en español.
     - Variables no definidas aparecen como `[nombre_variable]` en texto plano.
   ○ El abogado puede revisar el contenido completo de la plantilla.
   ○ Puede cerrar el modal y seleccionar otra plantilla o proceder a usarla.

#### 5. Uso de Plantilla
   ○ Al seleccionar "Usar plantilla" (desde el modal de acciones o después de previsualizar).
   ○ Se abre el modal para nombrar el nuevo documento (comportamiento actual).
   ○ El flujo continúa normalmente con la creación del documento.

---

### Validaciones y Reglas de Negocio

• **Solo Plantillas Publicadas**: La previsualización está disponible únicamente para plantillas en estado "Published".

• **Formateo No Destructivo**: El formateo de variables es solo visual en el preview; no modifica el contenido real de la plantilla.

• **Variables Conocidas**: Se formatean las variables que están definidas en el sistema con su `name_es` correspondiente.

• **Variables Huérfanas**: Las variables con formato `{{algo}}` que no están en el sistema se muestran como `[algo]` sin estilo especial.

• **Sin Afectar Editor**: El editor TinyMCE mantiene su comportamiento actual; el formateo visual es exclusivo del modal de preview.

---

### Consideraciones Técnicas

• **Reutilización de Componentes**: Se utilizan componentes existentes (`DocumentActionsModal`, `DocumentPreviewModal`) que ya están probados en otras partes de la plataforma.

• **Sin Cambios en Backend**: La implementación es completamente frontend; no requiere modificaciones en la API ni migraciones de base de datos.

• **Datos Disponibles**: La información de variables ya viene incluida en la respuesta del API gracias al `prefetch_related` existente.

• **Estilos Inline**: El formateo de variables usa estilos inline debido a limitaciones de CSS scoped con `v-html`.

---

### Cambios Transversales en la Aplicación

La implementación de este requerimiento genera cambios que impactan otros módulos de la plataforma:

#### Manual de Usuario
• **Sección de Nuevo Documento**: Documentar la nueva opción de previsualización.
• **Flujo de Creación**: Actualizar las instrucciones para incluir el paso de preview opcional.
• **Capturas de Pantalla**: Agregar imágenes del modal de acciones y la vista previa con variables formateadas.

#### Dashboard / Panel de Control
• **Sin cambios requeridos**: El modal de previsualización global ya existe y será reutilizado.

#### Utilidades de Documentos
• **Función de Procesamiento**: Agregar lógica para formatear variables en estados Draft/Published.

#### Tabla de Selección de Plantillas
• **UseDocumentTable**: Integrar `DocumentActionsModal` y manejar las nuevas acciones.
• **Menú de Opciones**: Agregar contexto específico para este flujo.

#### Correcciones Menores
• **DocumentListTable**: Corregir nombres de props del modal (`:is-open` → `:isVisible`).

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los abogados puedan previsualizar plantillas antes de usarlas desde cualquier dispositivo, mejorando el proceso de selección independientemente de la plataforma utilizada.

• La implementación reutiliza componentes existentes (`DocumentActionsModal`, `DocumentPreviewModal`) que ya están probados y funcionando en otras secciones de la plataforma, lo que reduce el riesgo de introducir errores.

• El formateo de variables en la previsualización es puramente visual y no afecta el contenido almacenado de las plantillas ni el comportamiento del editor.

• **Importante**: La implementación de este requerimiento incluye la actualización del manual de usuario para documentar la nueva funcionalidad de previsualización.

---

## Análisis de Esfuerzo y Estimación de Precio

### Clasificación de Dificultad: **BAJO-MEDIO**

| Indicador | Presente |
|-----------|----------|
| Reutilización de componentes existentes | ✅ |
| Sin cambios en backend | ✅ |
| Patrón de UI ya establecido | ✅ |
| Lógica de formateo nueva | ✅ |
| Correcciones menores adicionales | ✅ |
| Sin migraciones de datos | ✅ |