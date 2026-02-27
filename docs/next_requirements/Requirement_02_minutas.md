# Requirement Document / Documento de Requerimiento

---

## 2. Sistema de Gestión de Minutas - Visibilidad Compartida entre Abogados

---

### Descripción

Actualmente, cada abogado en la plataforma solo puede visualizar las minutas (plantillas de documentos jurídicos) que él mismo ha creado. Esta restricción limita la colaboración entre el equipo legal y genera duplicación de esfuerzos, ya que los abogados no pueden reutilizar plantillas ya elaboradas por sus colegas.

La falta de visibilidad compartida obliga a cada abogado a crear sus propias minutas desde cero, incluso cuando otro miembro del equipo ya ha desarrollado una plantilla similar que podría servir como base.

---

### Propuesta de Mejora

Implementar un sistema de visibilidad compartida de minutas que permita a todos los abogados ver las plantillas creadas por cualquier miembro del equipo, con controles apropiados para proteger la autoría original:

#### Visibilidad Compartida
• **Acceso Universal a Minutas**: Todos los abogados podrán visualizar todas las minutas existentes en la plataforma, independientemente de quién las haya creado.

• **Identificación del Creador**: Se mostrará una columna "Creado por" en los listados de documentos, indicando el nombre del abogado que creó cada minuta.

• **Sin Concepto de Minutas Privadas**: Todas las minutas serán visibles para todo el equipo legal, fomentando la colaboración y reutilización.

#### Control de Acciones según Autoría
• **Creador - Control Total**: El abogado que creó la minuta mantiene todos los permisos: editar, eliminar, publicar, cambiar a borrador, configurar permisos y membrete.

• **No Creadores - Acciones Limitadas**: Los abogados que no son creadores de una minuta solo podrán:
  - Previsualizar el documento
  - Crear una copia propia (que podrán editar libremente)
  - Descargar en PDF o Word (si está publicada)

• **Protección de Acciones Restringidas**: Las opciones de editar, eliminar, publicar, permisos y membrete estarán ocultas y bloqueadas para no creadores.

#### Funcionalidad de Copia
• **Crear Copia Propia**: Los abogados podrán crear una copia de cualquier minuta existente, convirtiéndose en los creadores de la nueva copia.

• **Independencia de la Copia**: La copia es completamente independiente del original; el nuevo creador tiene control total sobre ella.

• **Flujo Existente**: Se aprovecha la funcionalidad de copia ya existente en la plataforma.

---

### Beneficios Esperados

• **Mayor Colaboración**: Facilita el trabajo en equipo al permitir que los abogados conozcan y aprovechen el trabajo de sus colegas.

• **Reducción de Duplicación**: Evita que múltiples abogados creen minutas similares desde cero, optimizando el tiempo del equipo.

• **Reutilización de Conocimiento**: Las mejores prácticas y plantillas bien elaboradas pueden ser aprovechadas por todo el equipo legal.

• **Protección de Autoría**: El creador original mantiene control exclusivo sobre su minuta, evitando modificaciones no autorizadas.

• **Aprendizaje del Equipo**: Los abogados nuevos o con menos experiencia pueden aprender de las plantillas creadas por colegas más experimentados.

• **Estandarización**: Facilita la adopción de formatos y estructuras consistentes en los documentos del despacho.

• **Eficiencia Operativa**: Reduce el tiempo necesario para crear nuevos documentos al partir de plantillas existentes.

---

### Flujo de Operación

#### 1. Visualización de Minutas
   ○ El abogado accede al módulo de documentos jurídicos / minutas.
   ○ El sistema muestra todas las minutas existentes en la plataforma, no solo las propias.
   ○ Cada minuta muestra una columna "Creado por" con el nombre del abogado creador.
   ○ El abogado puede identificar fácilmente cuáles minutas son propias y cuáles de colegas.

#### 2. Interacción con Minutas Propias (Creador)
   ○ El abogado visualiza sus propias minutas con todas las opciones disponibles.
   ○ Puede editar, eliminar, publicar, cambiar a borrador, configurar permisos y membrete.
   ○ El flujo de trabajo permanece igual al actual para las minutas propias.

#### 3. Interacción con Minutas de Otros Abogados (No Creador)
   ○ El abogado visualiza las minutas de sus colegas con opciones limitadas.
   ○ Al abrir el menú de acciones, solo aparecen: Previsualizar, Crear una Copia, Descargar PDF/Word.
   ○ Las opciones de Editar, Eliminar, Publicar, Permisos y Membrete no están disponibles.
   ○ Si intenta acceder directamente a la URL del editor de una minuta ajena, es redirigido al dashboard con un mensaje de error.

#### 4. Creación de Copia de Minuta Ajena
   ○ El abogado selecciona "Crear una Copia" en una minuta de otro colega.
   ○ El sistema genera una copia idéntica asignando al abogado actual como creador.
   ○ La nueva copia aparece en el listado del abogado con control total.
   ○ El abogado puede editar, personalizar y gestionar su copia libremente.
   ○ La minuta original permanece intacta y bajo control de su creador original.

#### 5. Búsqueda y Filtrado
   ○ El abogado puede buscar minutas por nombre, contenido o creador.
   ○ Puede filtrar para ver solo sus minutas o las de todo el equipo.
   ○ Los filtros existentes continúan funcionando con el conjunto ampliado de minutas.

---

### Validaciones y Reglas de Negocio

• **Permisos por Autoría**: Solo el creador original puede modificar o eliminar una minuta.

• **Protección Backend**: Las restricciones se aplican tanto en la interfaz como en el servidor, previniendo accesos no autorizados vía API directa.

• **Documentos con Cliente Asignado**: Esta restricción NO aplica a documentos que tienen un cliente asignado (flujo de trabajo cliente-abogado), donde los abogados mantienen permisos de edición.

• **Copia Independiente**: Al crear una copia, no existe ninguna relación entre el documento original y la copia; son documentos completamente independientes.

• **Estados Aplicables**: La visibilidad compartida aplica a minutas en estado "Borrador" y "Publicado".

• **Acceso al Editor Bloqueado**: Los no creadores no pueden acceder a la vista de edición de minutas ajenas, ni siquiera navegando directamente a la URL.

---

### Consideraciones de Seguridad

• **Validación en Backend**: Las operaciones de actualización y eliminación verifican que el usuario sea el creador antes de permitir la acción.

• **Protección contra Acceso Directo**: Aunque un usuario intente acceder directamente a endpoints de API, el backend rechazará operaciones no autorizadas con error 403.

• **Guard en Frontend**: El editor de documentos valida la autoría antes de permitir modificaciones, redirigiendo a usuarios no autorizados.

• **Separación de Flujos**: El flujo de documentos con cliente asignado (donde abogados sí pueden editar) se mantiene separado del flujo de minutas/plantillas.

• **Sin Escalación de Privilegios**: Crear una copia no otorga ningún permiso sobre el documento original.

---

### Cambios Transversales en la Aplicación

La implementación de este requerimiento genera cambios que impactan otros módulos de la plataforma:

#### Manual de Usuario
• **Sección de Minutas**: Actualizar descripción de "Plantillas creadas" a "Plantillas de todos los abogados".
• **Pestañas de Abogado**: Describir la nueva visibilidad de minutas de colegas.
• **Acciones de Documentos**: Agregar documentación sobre "Crear Copia de minuta ajena".
• **Formalizar desde Mis Documentos**: Reflejar el uso de minutas de otros abogados como base.

#### Dashboard / Panel de Control
• **Sin cambios requeridos**: El botón "Nueva Minuta" y la lista de documentos recientes funcionan correctamente con la nueva lógica.

#### Listados de Documentos
• **Nueva columna**: Agregar "Creado por" en las tablas de documentos.
• **Menú de acciones**: Restringir opciones según autoría del documento.
• **Componente de Cards**: Aplicar las mismas restricciones en la vista de tarjetas.

#### Backend - Serializer
• **Nuevo campo**: Agregar `created_by_name` para mostrar el nombre del creador (actualmente solo se retorna el ID).

#### Backend - Protección de Endpoints
• **Endpoint de actualización**: Agregar validación de autoría para minutas.
• **Endpoint de eliminación**: Agregar validación de autoría para minutas.

#### Editor de Documentos
• **Validación de acceso**: Verificar autoría antes de permitir edición de minutas.
• **Redirección**: Redirigir a usuarios no autorizados al dashboard.

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los abogados puedan visualizar y copiar minutas de sus colegas desde cualquier dispositivo, manteniendo las restricciones de edición consistentes independientemente de la plataforma utilizada.

• La restricción actual es únicamente de frontend (el getter filtra por creador), por lo que el cambio principal es remover ese filtro y agregar las protecciones de seguridad en backend.

• La funcionalidad de "Crear una Copia" ya existe en la plataforma y funciona correctamente; solo se necesita asegurar que esté visible para no creadores.

• Es crítico implementar las validaciones de backend para evitar que usuarios malintencionados realicen operaciones no autorizadas llamando directamente a la API.

• **Importante**: La implementación de este requerimiento incluye la actualización del manual de usuario para reflejar la nueva funcionalidad de visibilidad compartida.

---

## Análisis de Esfuerzo y Estimación de Precio

### Clasificación de Dificultad: **MEDIO**

| Indicador | Presente |
|-----------|----------|
| Modificación de permisos/visibilidad | ✅ |
| Validaciones de seguridad backend | ✅ |
| Cambios en múltiples componentes UI | ✅ |
| Nuevo campo en serializer | ✅ |
| Lógica condicional en menús | ✅ |
| Guards de navegación | ✅ |
| Reutilización de funcionalidad existente | ✅ |