# Requirement Document / Documento de Requerimiento

---

## 1. Reasignación de Datos de Abogado y Módulo de Administración

---

### Descripción

Actualmente, la plataforma no cuenta con un mecanismo que permita transferir los procesos jurídicos y documentos dinámicos de un abogado a otro. Esto genera problemas operativos cuando un abogado deja la firma, se ausenta temporalmente, o cuando es necesario redistribuir la carga de trabajo entre el equipo legal.

La ausencia de esta funcionalidad obliga a realizar cambios manuales en la base de datos o a mantener activos a abogados que ya no trabajan en la firma, lo cual representa un riesgo de seguridad y dificulta la gestión administrativa del despacho.

Adicionalmente, no existe un rol de "administrador de gestión" que permita a usuarios autorizados realizar estas operaciones sin necesidad de intervención técnica.

---

### Propuesta de Mejora

Implementar un módulo de administración que permita a usuarios con permisos especiales (rol de gestor/administrador) reasignar procesos y documentos de un abogado a otro, con las siguientes características:

#### Gestión de Permisos
• **Nuevo rol de Gestor (Manager)**: Crear un permiso especial que habilite el acceso al módulo de administración y reasignación de datos.

• **Control de Acceso**: Solo usuarios con el permiso de gestor podrán visualizar y utilizar las funcionalidades de reasignación.

#### Funcionalidad de Reasignación
• **Selección de Abogado Origen**: Permitir seleccionar el abogado cuyos datos serán transferidos mediante un listado de abogados activos.

• **Selección de Abogado Destino**: Permitir seleccionar el abogado que recibirá los procesos y documentos, excluyendo automáticamente al abogado origen de las opciones.

• **Vista Previa de Datos**: Mostrar un resumen detallado de todos los procesos y documentos que serán transferidos antes de ejecutar la acción.

• **Reasignación Selectiva**: Permitir transferir todos los elementos o seleccionar individualmente cuáles procesos y documentos se desean reasignar.

• **Reasignación en Bloque**: Opción de seleccionar todos los elementos con un solo clic para transferencias masivas.

#### Selector de Abogado en Formulario de Procesos
• **Nuevo Campo de Selección**: Agregar un selector de abogado en el formulario de creación/edición de procesos, permitiendo asignar un proceso a cualquier abogado activo.

• **Valor por Defecto**: El abogado que está creando el proceso aparecerá preseleccionado automáticamente.

• **Flexibilidad de Asignación**: Permite que un abogado cree un proceso y lo asigne directamente a otro colega desde el momento de la creación.

#### Protección de Documentos Sensibles
• **Exclusión Automática de Documentos en Proceso de Firma**: Los documentos que se encuentren en estados de "Pendiente de Firmas", "Completamente Firmado" o "Rechazado" NO serán elegibles para transferencia, protegiendo la integridad de los procesos de firma electrónica.

• **Indicador Visual**: Mostrar claramente qué documentos no pueden ser transferidos y la razón.

#### Archivado de Abogados
• **Opción de Archivar**: Al realizar la reasignación, ofrecer la opción de archivar al abogado origen (en lugar de eliminarlo), preservando el historial y la trazabilidad.

• **Exclusión de Listados**: Los abogados archivados no aparecerán en los listados activos de la plataforma pero sus datos históricos permanecerán intactos.

• **Bloqueo de Acceso**: Los usuarios archivados no podrán iniciar sesión en la plataforma (ni por login tradicional ni por Google), garantizando que las cuentas desactivadas permanezcan inaccesibles.

• **Exclusión de Notificaciones**: Los abogados archivados no recibirán notificaciones por correo electrónico del sistema.

#### Preservación de Auditoría
• **Creador Original Intacto**: El campo que indica quién creó originalmente el documento NO será modificado, manteniendo la trazabilidad completa para efectos de auditoría.

• **Registro de Actividad**: Cada reasignación generará un registro en el historial de actividades para ambos abogados (origen y destino).

---

### Beneficios Esperados

• **Continuidad Operativa**: Garantiza que los procesos y documentos de un abogado que deja la firma o se ausenta puedan ser atendidos sin interrupciones por otro miembro del equipo.

• **Gestión Eficiente del Equipo**: Facilita la redistribución de carga de trabajo entre abogados según las necesidades del despacho.

• **Asignación Flexible desde el Inicio**: Permite asignar procesos a cualquier abogado desde el momento de su creación, no solo al abogado que lo crea.

• **Seguridad Mejorada**: Permite desactivar completamente el acceso de abogados que ya no trabajan en la firma, bloqueando su inicio de sesión y removiéndolos de las notificaciones.

• **Trazabilidad Completa**: Preserva el historial de quién creó cada documento, cumpliendo con requisitos de auditoría y transparencia.

• **Autonomía Administrativa**: Elimina la necesidad de intervención técnica para realizar transferencias de datos entre abogados.

• **Protección de Integridad**: Evita la transferencia accidental de documentos en procesos de firma activos, protegiendo la validez legal de las firmas electrónicas.

• **Reducción de Errores**: La vista previa y las validaciones automáticas minimizan el riesgo de reasignaciones incorrectas.

---

### Flujo de Operación

#### 1. Acceso al Módulo de Administración
   ○ El usuario con permisos de gestor (manager) inicia sesión en la plataforma.
   ○ En el menú lateral aparece una nueva sección "Administración" visible únicamente para usuarios con este permiso.
   ○ El usuario selecciona la opción "Reasignación de Datos".

#### 2. Selección de Abogados
   ○ Se presenta un formulario con dos campos desplegables:
     - **Abogado Origen**: Lista de abogados activos que tienen procesos o documentos asignados.
     - **Abogado Destino**: Lista de abogados activos, excluyendo al abogado seleccionado como origen.
   ○ El sistema valida que ambas selecciones sean válidas y diferentes.

#### 3. Vista Previa de Datos a Transferir
   ○ Al seleccionar el abogado origen, el sistema muestra automáticamente:
     - **Tabla de Procesos**: Listado de todos los procesos jurídicos asignados al abogado, con checkbox para selección individual y opción "Seleccionar todos".
     - **Tabla de Documentos Elegibles**: Listado de documentos que pueden ser transferidos, con checkbox para selección individual y opción "Seleccionar todos".
     - **Documentos No Elegibles**: Indicador informativo mostrando los documentos que NO pueden ser transferidos (en estados de firma) y la razón.
   ○ El usuario puede revisar cada elemento antes de proceder.

#### 4. Selección de Elementos a Transferir
   ○ El usuario marca los procesos y documentos que desea reasignar.
   ○ Puede utilizar la opción "Seleccionar todos" para transferencias masivas.
   ○ Opcionalmente, puede marcar la casilla "Archivar abogado origen al completar".

#### 5. Confirmación de Reasignación
   ○ Al hacer clic en "Reasignar", se muestra un modal de confirmación con el resumen:
     - Número de procesos a transferir.
     - Número de documentos a transferir.
     - Nombre del abogado destino.
     - Indicador si el abogado origen será archivado.
   ○ El usuario debe confirmar la acción para proceder.

#### 6. Ejecución y Resultado
   ○ El sistema ejecuta la transferencia de manera atómica (todo o nada).
   ○ Se registra la actividad en el historial de ambos abogados.
   ○ Si se seleccionó archivar, el abogado origen queda marcado como archivado.
   ○ Se muestra un mensaje de éxito con el resumen de la operación completada:
     - "Se han transferido X procesos y Y documentos al abogado [Nombre]. El abogado [Nombre Origen] ha sido archivado."

#### 7. Verificación Post-Transferencia
   ○ El abogado destino puede ver inmediatamente los procesos y documentos transferidos en su panel.
   ○ El abogado origen (si no fue archivado) ya no verá los elementos transferidos en su listado.
   ○ Los registros de actividad reflejan la transferencia realizada.

---

### Validaciones y Reglas de Negocio

• **Abogados Diferentes**: No se permite seleccionar el mismo abogado como origen y destino.

• **Destino Activo**: El abogado destino debe estar activo (no archivado).

• **Pertenencia de Datos**: Solo se pueden transferir procesos y documentos que realmente pertenezcan al abogado origen.

• **Estados de Documentos**: Documentos en estados "Pendiente de Firmas", "Completamente Firmado" o "Rechazado" son excluidos automáticamente.

• **Transacción Atómica**: Si ocurre algún error durante la transferencia, ningún cambio se aplica (todo o nada).

• **Protección contra Eliminación**: Los abogados con procesos asignados no pueden ser eliminados del sistema, solo archivados.

• **Inicialización de Gestión**: Los documentos nuevos tendrán automáticamente asignado el campo de gestión al abogado que los crea.

• **Visibilidad de Documentos**: Los abogados mantienen acceso de visualización/edición a todos los documentos (según permisos de rol), pero el filtro "Mis Documentos" solo muestra los creados o gestionados por ellos.

---

### Consideraciones de Seguridad

• **Permiso Exclusivo**: Solo usuarios con el rol de gestor pueden acceder a esta funcionalidad.

• **Registro de Auditoría**: Todas las acciones de reasignación quedan registradas con fecha, hora y usuario que ejecutó la acción.

• **Preservación de Datos**: El archivado de abogados no elimina ningún dato histórico, solo oculta al usuario de los listados activos.

• **Integridad de Firmas**: Los documentos en proceso de firma electrónica están protegidos contra reasignación accidental.

• **Bloqueo de Acceso Completo**: Los usuarios archivados no pueden autenticarse por ningún método (login tradicional o Google OAuth).

• **Protección de Cascada**: El cambio en el comportamiento de eliminación de procesos previene la pérdida accidental de datos si se intenta eliminar un abogado.

• **Campos de Auditoría Intactos**: El campo que registra quién creó originalmente un documento nunca se modifica, garantizando trazabilidad completa.

---

### Cambios Transversales en la Aplicación

La implementación de este requerimiento genera cambios que impactan otros módulos de la plataforma, los cuales deben ser actualizados para mantener la coherencia del sistema:

#### Manual de Usuario
• **Nueva sección**: Agregar documentación sobre el módulo de Administración y Reasignación de Datos.
• **Contenido del módulo**: Incluir secciones sobre selección de abogados, vista previa, ejecución de reasignación, archivado y restricciones.
• **Capturas de pantalla**: Añadir imágenes del nuevo módulo y sus funcionalidades.
• **Roles aplicables**: Documentar que esta funcionalidad está disponible solo para usuarios con rol de gestor.

#### Dashboard / Panel de Control
• **Botón de acceso rápido**: Agregar botón "Reasignar Datos" visible solo para usuarios con permiso de gestor.
• **Indicadores para gestores**: Mostrar métricas relevantes como abogados activos vs archivados.

#### Formulario de Procesos
• **Nuevo selector de abogado**: Agregar campo de selección para asignar el proceso a cualquier abogado activo.
• **Comportamiento por defecto**: El abogado logueado aparece preseleccionado.
• **Modo edición**: En edición de proceso existente, mostrar el abogado asignado actualmente.

#### Filtros de Documentos
• **Filtro "Mis Documentos"**: Actualizar para considerar tanto documentos creados como documentos reasignados al abogado.
• **Lógica de filtrado**: Incluir documentos donde el abogado es creador O gestor asignado.

#### Sistema de Autenticación
• **Bloqueo de login**: Usuarios archivados no pueden iniciar sesión (login tradicional y Google).
• **Mensaje de error**: Mostrar mensaje apropiado cuando un usuario archivado intenta acceder.

#### Sistema de Notificaciones
• **Exclusión de archivados**: Los abogados archivados no reciben notificaciones por correo electrónico.
• **Filtro actualizado**: Agregar verificación de estado archivado en el envío de notificaciones.

#### Panel de Administración (Django Admin)
• **Nuevos campos visibles**: Mostrar `is_archived` e `is_manager` en la lista y formulario de usuarios.
• **Filtros adicionales**: Permitir filtrar usuarios por estado archivado y permiso de gestor.
• **Campo managed_by**: Visible en la administración de documentos dinámicos.

#### Directorio de Abogados
• **Exclusión de archivados**: Los abogados archivados no aparecen en selectores de asignación (formularios de proceso, documentos, etc.).

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los usuarios con permisos de gestor puedan realizar reasignaciones de datos desde cualquier dispositivo, manteniendo la consistencia operativa y facilitando la gestión administrativa del despacho independientemente de la plataforma utilizada.

• La funcionalidad de archivado es reversible: un administrador podría reactivar a un abogado archivado si fuera necesario en el futuro.

• Se recomienda capacitar a los usuarios gestores sobre el uso correcto de esta funcionalidad, especialmente en lo relacionado con la protección de documentos en proceso de firma.

• Los cambios en los permisos de usuario (asignar/remover rol de gestor) deben ser realizados por un administrador del sistema.

• **Importante**: La implementación de este requerimiento incluye la actualización del manual de usuario y los ajustes necesarios en el dashboard para reflejar las nuevas funcionalidades.

---

## Análisis de Esfuerzo y Estimación de Precio

### Clasificación de Dificultad: **MEDIO-ALTO**

| Indicador | Presente |
|-----------|----------|
| CRUD con historial | ✅ |
| Múltiples roles de usuario | ✅ |
| Transacciones atómicas | ✅ |
| Validaciones complejas | ✅ |
| Vista previa dinámica | ✅ |
| Cambios en modelo de datos | ✅ |
| Interfaz multi-paso | ✅ |
| Integración con sistema existente | ✅ |