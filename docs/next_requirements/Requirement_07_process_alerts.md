# Requirement Document / Documento de Requerimiento

---

## 7. Alertas y Notificaciones en Procesos Jurídicos

---

### Descripción

Actualmente, el módulo de Procesos Jurídicos no cuenta con un sistema de alertas que notifique a los abogados y clientes sobre fechas importantes relacionadas con los estados procesales. Los usuarios deben revisar manualmente cada proceso para identificar fechas próximas, lo que puede resultar en el olvido de audiencias, vencimientos de términos y otras fechas críticas del proceso judicial.

No existe un mecanismo automatizado que envíe recordatorios previos a las fechas registradas en los estados procesales, dejando la responsabilidad del seguimiento completamente en manos de los usuarios.

Esta carencia puede resultar en la pérdida de oportunidades procesales, incumplimiento de términos legales y afectación de los intereses de los clientes.

---

### Propuesta de Mejora

Implementar un sistema de alertas automáticas para procesos jurídicos que notifique a abogados y clientes antes de las fechas importantes de los estados procesales:

#### Alertas Automáticas por Estado Procesal
• **Creación Automática**: Cada vez que se crea un proceso o se agrega un nuevo estado procesal, el sistema genera automáticamente una alerta asociada.

• **Recordatorios Fijos**: Se envían recordatorios en dos momentos predefinidos: 3 días antes y 1 día antes de la fecha del estado procesal.

• **Enfoque en Último Estado**: Las alertas se generan para el último estado procesal registrado, que típicamente representa la próxima fecha importante del proceso.

#### Personalización de la Alerta
• **Descripción Personalizable**: El abogado puede editar la descripción de la alerta para incluir información relevante específica (ej: "Audiencia de conciliación - Llevar documentos originales").

• **Activación/Desactivación**: El abogado puede activar o desactivar la alerta según sea necesario.

• **Descripción Auto-generada**: Si el abogado no personaliza, el sistema genera una descripción basada en el estado procesal y la fecha.

#### Notificación Multicanal
• **Email**: Envío de correo electrónico con los detalles del proceso, estado procesal, fecha y descripción de la alerta.

• **Notificación In-App**: Creación de notificación en el Centro de Notificaciones para seguimiento dentro de la plataforma.

• **Múltiples Destinatarios**: Tanto el abogado asignado como todos los clientes del proceso reciben las notificaciones.

#### Visualización de Alertas
• **En Formulario de Proceso**: Sección de configuración de alerta visible junto al último estado procesal.

• **En Detalle de Proceso**: Indicador visual que muestra si el proceso tiene una alerta activa.

• **En Historial**: Las alertas se muestran junto a los estados procesales en el modal de historial.

---

### Beneficios Esperados

• **Prevención de Incumplimientos**: Los recordatorios anticipados evitan que se pasen por alto fechas críticas del proceso.

• **Mejor Preparación**: Con 3 días de anticipación, abogados y clientes tienen tiempo para prepararse adecuadamente.

• **Comunicación Proactiva**: Los clientes se mantienen informados sobre las fechas importantes de sus procesos sin necesidad de preguntar.

• **Reducción de Estrés**: El sistema automatizado elimina la necesidad de recordar manualmente cada fecha.

• **Trazabilidad**: El historial de notificaciones enviadas queda registrado en el Centro de Notificaciones.

• **Personalización**: Los abogados pueden agregar contexto relevante a cada alerta según las particularidades del proceso.

• **Cobertura Automática**: No se requiere acción manual para activar alertas; se crean automáticamente con cada estado procesal.

---

### Flujo de Operación

#### 1. Creación de Proceso con Estados Procesales
   ○ El abogado crea un nuevo proceso jurídico.
   ○ Agrega uno o más estados procesales con sus fechas correspondientes.
   ○ El sistema crea automáticamente una alerta para cada estado procesal.
   ○ La alerta del último estado se muestra en la interfaz para posible personalización.

#### 2. Configuración de Alerta (Opcional)
   ○ En el formulario de proceso, debajo del último estado procesal, aparece la sección de alerta.
   ○ El abogado ve los días de recordatorio (1 día y 3 días antes) como información.
   ○ Puede editar la descripción de la alerta para agregar detalles relevantes.
   ○ Puede desactivar la alerta si no desea recibir notificaciones para este estado.
   ○ Si no hace cambios, la alerta usa la descripción auto-generada y permanece activa.

#### 3. Actualización de Estados Procesales
   ○ El abogado agrega un nuevo estado procesal al proceso existente.
   ○ El sistema crea automáticamente una alerta para el nuevo estado.
   ○ La interfaz muestra la configuración de alerta para el nuevo último estado.
   ○ Las alertas de estados anteriores permanecen pero ya no se envían (solo el último estado genera notificaciones).

#### 4. Envío de Recordatorio (3 Días Antes)
   ○ Todos los días a las 9:00 AM, el sistema ejecuta la tarea de verificación de alertas.
   ○ Identifica procesos cuyo último estado procesal tiene fecha en exactamente 3 días.
   ○ Verifica que la alerta esté activa y no se haya enviado el recordatorio de 3 días.
   ○ Envía email al abogado y a todos los clientes del proceso.
   ○ Crea notificación in-app para cada destinatario con categoría "process_alert".
   ○ Marca la alerta como notificada (3 días).

#### 5. Envío de Recordatorio (1 Día Antes)
   ○ El mismo proceso se repite para alertas con fecha en exactamente 1 día.
   ○ El sistema verifica que no se haya enviado el recordatorio de 1 día.
   ○ Envía email y crea notificación in-app.
   ○ Marca la alerta como notificada (1 día).

#### 6. Visualización en Detalle de Proceso
   ○ Al ver el detalle de un proceso, si el último estado tiene alerta activa, se muestra un indicador visual (ícono de campana).
   ○ En el modal de historial de estados procesales, se muestra la información de la alerta junto al estado correspondiente.

#### 7. Proceso Cerrado (Estado "Fallo")
   ○ Cuando el último estado de un proceso es "Fallo", el proceso se considera cerrado.
   ○ No se envían alertas para procesos cerrados.
   ○ La tarea Celery filtra automáticamente estos procesos.

---

### Contenido de las Notificaciones

#### Email de Recordatorio

**Asunto**: Recordatorio: [Nombre del Proceso] - [Estado Procesal] en [X] día(s)

**Contenido**:
- Nombre del proceso (referencia y subcaso)
- Estado procesal actual
- Fecha programada
- Descripción de la alerta (personalizada o auto-generada)
- Enlace directo al proceso en la plataforma

#### Notificación In-App

- **Título**: Recordatorio de Proceso
- **Mensaje**: [Nombre del proceso] - [Estado procesal] programado para [Fecha]
- **Categoría**: process_alert
- **Navegación**: Click lleva al detalle del proceso

---

### Validaciones y Reglas de Negocio

• **Fecha Requerida para Alerta**: Solo se envían alertas para estados procesales que tienen fecha asignada.

• **Solo Último Estado**: Aunque todos los estados tienen alerta asociada, solo se procesan las alertas del último estado de cada proceso.

• **Procesos Activos**: No se envían alertas para procesos cuyo último estado es "Fallo" (proceso cerrado).

• **No Duplicación**: Los flags notified_3_days y notified_1_day evitan envíos duplicados.

• **Días Fijos**: Los días de recordatorio (1 y 3) no son configurables por el usuario; son valores fijos del sistema.

• **Reemplazo de Estados**: Al actualizar un proceso, los estados anteriores se eliminan y se crean nuevos con sus respectivas alertas.

---

### Consideraciones de Seguridad

• **Autenticación en Endpoints**: Los endpoints de proceso requieren usuario autenticado.

• **Autorización**: Solo el abogado asignado puede modificar la configuración de alertas.

• **Destinatarios Validados**: Las notificaciones solo se envían a usuarios asociados al proceso (abogado y clientes).

• **Información Controlada**: Los emails no incluyen información sensible del proceso más allá de lo necesario para el recordatorio.

---

### Cambios Transversales en la Aplicación

La implementación de este requerimiento genera cambios que impactan otros módulos de la plataforma:

#### Backend - Modelo
• **StageAlert**: Nuevo modelo con campos para descripción, estado activo, y flags de notificación.
• **Relación OneToOne**: Cada Stage tiene una alerta asociada.
• **Migración**: Crear tabla y campos necesarios.

#### Backend - Serializers
• **StageAlertSerializer**: Nuevo serializer para la alerta.
• **StageSerializer**: Modificar para incluir alerta nested.

#### Backend - Views
• **create_process**: Hook para crear StageAlert automáticamente al crear estados.
• **update_process**: Hook para crear StageAlert al reemplazar estados, usar descripción custom si se proporciona.

#### Backend - Tarea Celery
• **process_alert_tasks.py**: Nueva tarea para verificar y enviar alertas diariamente.
• **Celery Beat**: Configurar schedule para ejecución a las 9:00 AM.

#### Frontend - Formulario de Proceso
• **ProcessForm.vue**: Nueva sección de configuración de alerta debajo del último estado procesal.
• **formData.stages**: Extender para incluir datos de alerta en el último elemento.

#### Frontend - Detalle de Proceso
• **ProcessDetail.vue**: Indicador visual de alerta activa.
• **ProcessHistoryModal**: Mostrar información de alerta junto a estados.

#### Manual de Usuario
• **Nueva Sección**: Documentar sistema de alertas de procesos.
• **Instrucciones**: Explicar configuración de alertas y recordatorios.

---

### Dependencias con Otros Módulos

| Módulo | Relación |
|--------|----------|
| **Centro de Notificaciones** | **REQUIERE** el modelo Notification y notification_service para crear notificaciones in-app con categoría 'process_alert'. Debe implementarse primero. |
| **Alertas de Archivos Jurídicos** | Independientes. Ambos usan el mismo notification_service pero no tienen dependencia directa. Comparten la hora de ejecución de tareas Celery (9:00 AM). |

**Nota**: Este módulo tiene una dependencia con el Centro de Notificaciones (Requerimiento #5). La implementación debe esperar a que estén disponibles el modelo Notification y el servicio notification_service.

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los abogados puedan configurar alertas y que todos los usuarios reciban las notificaciones desde cualquier dispositivo.

• Los días de recordatorio (1 y 3 días antes) son valores fijos del sistema y no son configurables por el usuario. Esta decisión simplifica la experiencia y garantiza consistencia.

• Las alertas se crean automáticamente para TODOS los estados procesales, pero solo se procesan las del último estado. Esto permite que si se agrega un nuevo estado, automáticamente ese se convierte en el foco de las alertas.

• La tarea Celery se ejecuta a las 9:00 AM, la misma hora que los recordatorios de firma. Considerar el impacto en la carga del servidor si hay muchos procesos y documentos.

• **Prerrequisito**: El Centro de Notificaciones (Requerimiento #5) debe estar implementado antes de iniciar este desarrollo.

• **Importante**: La implementación de este requerimiento incluye la actualización del manual de usuario para documentar el sistema de alertas de procesos.

---

## Análisis de Esfuerzo y Estimación de Precio

### Clasificación de Dificultad: **MEDIO**

| Indicador | Presente |
|-----------|----------|
| Nuevo modelo backend | ✅ |
| Modificación de serializers existentes | ✅ |
| Hooks en views existentes | ✅ |
| Nueva tarea Celery | ✅ |
| Modificación de formulario frontend | ✅ |
| Modificación de vista de detalle | ✅ |
| Integración con servicio externo | ✅ |