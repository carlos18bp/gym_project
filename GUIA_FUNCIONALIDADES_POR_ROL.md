# Manual Completo de Funcionalidades - G&M Abogados

## 📋 Índice

1. [Introducción](#introducción)
2. [Roles del Sistema](#roles-del-sistema)
3. [Módulos por Rol](#módulos-por-rol)
4. [Funcionalidades Detalladas](#funcionalidades-detalladas)
5. [Tabla Comparativa de Permisos](#tabla-comparativa-de-permisos)
6. [Implementación Técnica](#implementación-técnica)

---

## Introducción

Este documento consolida toda la información sobre funcionalidades, roles y permisos de la plataforma G&M Abogados. Incluye mapeo técnico, funcionalidades por rol y guía de implementación.

**Fecha**: Noviembre 21, 2025  
**Versión**: 1.0.0  
**Estado**: Producción

---

## Roles del Sistema

### 4 Roles Principales

1. **Lawyer (Abogado)**
   - Gestión completa de procesos, clientes y documentos
   - Acceso a todos los módulos excepto Organizaciones
   - Puede radicar procesos y gestionar solicitudes

2. **Client (Cliente)**
   - Consulta de procesos propios
   - Solicitud de servicios legales
   - Uso de documentos asignados
   - Agendamiento de citas

3. **Corporate Client (Cliente Corporativo)**
   - Todas las funciones de Cliente
   - Gestión completa de Organizaciones
   - Creación de solicitudes corporativas

4. **Basic (Básico)**
   - Acceso limitado a funcionalidades esenciales
   - Sin firma electrónica ni membrete
   - Solo lectura en la mayoría de módulos

### Bandera Especial

- **is_gym_lawyer**: Abogados de la firma G&M con acceso a Intranet

---

## Módulos por Rol

### LAWYER (Abogado)

#### Módulos Disponibles (8)
1. ✅ **Dashboard** - Panel principal
2. ✅ **Directorio** - Listado de usuarios (EXCLUSIVO)
3. ✅ **Procesos** - Gestión completa
4. ✅ **Archivos Jurídicos** - Crear y gestionar documentos
5. ✅ **Gestión de Solicitudes** - Administrar solicitudes (EXCLUSIVO)
6. ✅ **Intranet G&M** - Portal interno (solo is_gym_lawyer)
7. ❌ **Agendar Cita** - No disponible
8. ❌ **Organizaciones** - No disponible

### CLIENT (Cliente)

#### Módulos Disponibles (6)
1. ✅ **Dashboard** - Panel principal
2. ✅ **Procesos** - Solo lectura de procesos propios
3. ✅ **Archivos Jurídicos** - Usar documentos asignados
4. ✅ **Solicitudes** - Crear solicitudes (EXCLUSIVO)
5. ✅ **Agendar Cita** - Programar citas
6. ✅ **Organizaciones** - Ver organizaciones (solo lectura)

### CORPORATE CLIENT (Cliente Corporativo)

#### Módulos Disponibles (7)
1. ✅ **Dashboard** - Panel principal
2. ✅ **Procesos** - Solo lectura de procesos propios
3. ✅ **Archivos Jurídicos** - Usar documentos asignados
4. ✅ **Solicitudes** - Crear solicitudes
5. ✅ **Agendar Cita** - Programar citas
6. ✅ **Organizaciones** - Gestión completa (EXCLUSIVO)

### BASIC (Básico)

#### Módulos Disponibles (5)
1. ✅ **Dashboard** - Panel simplificado
2. ✅ **Procesos** - Solo lectura (sin solicitar info)
3. ✅ **Archivos Jurídicos** - Usar documentos (sin firma)
4. ✅ **Solicitudes** - Crear y ver solicitudes
5. ✅ **Agendar Cita** - Programar citas

---

## Funcionalidades Detalladas

### 1. DASHBOARD (Inicio)

**Disponible para**: Todos los roles

#### Componentes:
- **Tarjeta de Bienvenida**
  - Saludo personalizado
  - Contador de procesos activos
  - Botón de acción rápida contextual

- **Feed de Actividad**
  - Historial cronológico de acciones
  - Scroll infinito
  - Tipos: Creación/actualización de procesos, firma de documentos, creación de minutas

- **Botones de Acción Rápida**
  - Lawyer: Todos los Procesos, Radicar Proceso, Nueva Minuta, Radicar Informe
  - Client: Mis Procesos, Agendar Cita, Nueva Solicitud

- **Actualizaciones Legales**
  - Noticias del sector jurídico
  - Cambios legislativos

- **Elementos Recientes**
  - Últimos 5 procesos visualizados
  - Últimos 5 documentos editados

---

### 2. DIRECTORIO

**Disponible para**: Solo Lawyers

#### Funcionalidades:
- **Búsqueda Avanzada**
  - Por nombre, apellido, email, identificación, rol
  - Búsqueda en tiempo real

- **Información Visible**
  - Foto de perfil
  - Nombre completo
  - Rol (badge con color)
  - Email de contacto
  - Click para ver procesos del usuario

---

### 3. PROCESOS

**Disponible para**: Todos los roles (con diferentes permisos)

#### Pestañas:

**Para Lawyers:**
1. **Mis Procesos** - Casos asignados
2. **Todos los Procesos** - Vista completa del sistema (EXCLUSIVO)
3. **Procesos Archivados** - Casos finalizados

**Para Clients:**
1. **Mis Procesos** - Solo casos propios
2. **Procesos Archivados** - Casos finalizados

#### Funcionalidades:

**Sistema de Filtros:**
- Búsqueda por: referencia, demandante, demandado, autoridad, cliente
- Filtro por Tipo de Caso (Civil, Penal, Laboral, Familia, etc.)
- Filtro por Autoridad (Juzgados, Tribunales, Cortes)
- Filtro por Etapa Procesal (Admisión, Pruebas, Alegatos, Sentencia)
- Botón "Limpiar" para resetear filtros
- Ordenamiento: Más recientes / Nombre A-Z
- Contador de resultados

**Radicar Proceso (Solo Lawyers):**
- Formulario completo con validación
- Combobox con búsqueda para Tipo de Proceso
- Selección de Cliente y Abogado responsable
- Campos: Demandante, Demandado, Autoridad, Referencia, Subclase
- Subida de múltiples archivos
- Definición de etapa procesal inicial

**Detalle de Proceso:**
- Información completa del caso
- Timeline visual de etapas con burbujas interactivas
- Expediente digital:
  - Tabla de archivos del caso
  - Búsqueda de documentos
  - Descarga individual
  - Paginación (10 por página)

**Solicitar Información (Clients):**
- Botón en detalle del proceso
- Formulario pre-llenado
- Envío directo al abogado responsable

---

### 4. ARCHIVOS JURÍDICOS

**Disponible para**: Todos los roles (con diferentes permisos)

#### Pestañas para Lawyers (5):
1. **Minutas** - Documentos creados (Published, Draft, Progress, Completed)
2. **Documentos por Firmar** - Estado PendingSignatures
3. **Documentos Firmados** - Estado FullySigned
4. **Documentos de Clientes (Completados)** - Finalizados por clientes
5. **Documentos de Clientes (En Progreso)** - En proceso de completado

#### Pestañas para Clients (5):
1. **Carpetas** - Documentos organizados
2. **Mis Documentos** - Documentos asignados
3. **Usar Documento** - Completar plantillas
4. **Documentos por Firmar** - Pendientes de firma
5. **Documentos Firmados** - Archivo final

#### 10 Acciones sobre Documentos (Lawyers):
1. 👁️ **Ver/Editar** - Abrir en editor TinyMCE
2. 📋 **Duplicar** - Crear copia del documento
3. 👤 **Asignar a Cliente** - Enviar a cliente
4. ⚙️ **Configurar Variables** - Definir campos dinámicos
5. 🏷️ **Gestionar Etiquetas** - Organizar con tags
6. 🗑️ **Eliminar** - Borrar con confirmación
7. 📄 **Descargar PDF** - Exportar versión final
8. 📁 **Mover a Carpeta** - Organizar jerárquicamente
9. ✍️ **Firmar** - Agregar firma electrónica
10. 👀 **Vista Previa** - Ver sin editar

#### Funcionalidades Especiales:

**Firma Electrónica** (NO para Basic):
- Dibujar firma con mouse/touch
- Subir imagen de firma
- Guardar firma para uso futuro
- Trazabilidad completa: fecha, hora, IP, método
- Múltiples firmantes por documento

**Membrete Global** (NO para Basic):
- Subir logo/imagen de encabezado
- Configurar texto de encabezado y pie
- Vista previa en tiempo real
- Aplicar a todos los documentos nuevos

**Sistema de Carpetas**:
- Crear carpetas personalizadas
- Mover documentos entre carpetas
- Vista grid o tabla
- Búsqueda dentro de carpetas

**Sistema de Etiquetas** (Solo Lawyers):
- Crear etiquetas con colores
- Filtrar por etiquetas
- Múltiples etiquetas por documento
- Ejemplos: Contratos, Poderes, Demandas, Tutelas

**Variables Dinámicas**:
- 6 tipos de campos: texto, textarea, número, fecha, email, select
- Tooltips explicativos
- Validación en tiempo real
- Configuración por variable

---

### 5. SOLICITUDES LEGALES

**Disponible para**: Todos los roles (diferentes vistas)

#### Para Clients (Crear Solicitud):
- Formulario con tipo y disciplina
- Descripción detallada (mínimo 50 caracteres)
- Adjuntar múltiples archivos (PDF, DOC, DOCX, JPG, PNG)
- Número automático: SOL-YYYY-NNN
- Estados: Pendiente, En Revisión, Respondida, Cerrada

#### Para Lawyers (Gestión de Solicitudes):
- Ver todas las solicitudes del sistema
- Filtrar por estado y rango de fechas
- Cambiar estado de solicitud
- Thread de conversación completo
- Responder con mensajes
- Eliminar solicitudes
- Descargar archivos adjuntos

#### Thread de Conversación:
- Mensajes ordenados cronológicamente
- Indicador de remitente (Cliente/Abogado)
- Fecha y hora de cada mensaje
- Agregar archivos adicionales
- Historial completo

---

### 6. AGENDAR CITA

**Disponible para**: Client, Corporate Client, Basic

#### Funcionalidades:
- Integración con Calendly
- Calendario interactivo con disponibilidad en tiempo real
- Tipos de cita: Consulta inicial, Asesoría, Seguimiento, Revisión
- Formulario con datos de contacto
- Confirmación automática por email
- Agregar a calendario personal (Google, Outlook, iCal)
- Recordatorios automáticos

---

### 7. ORGANIZACIONES

**Disponible para**: Client (lectura), Corporate Client (gestión completa)

#### Para Corporate Client:
**Crear y Gestionar Organización:**
- Nombre y descripción
- Imágenes de perfil y portada
- Gestionar miembros del equipo
- Enviar invitaciones por email
- Ver invitaciones pendientes
- Crear solicitudes corporativas
- Publicar anuncios internos
- Estadísticas de la organización

**Gestión de Miembros:**
- Invitar por email
- Ver miembros activos
- Remover miembros
- Asignar roles
- Estados de invitación: Pendiente, Aceptada, Rechazada, Expirada

#### Para Client:
- Ver organizaciones donde es miembro
- Aceptar/rechazar invitaciones
- Ver publicaciones
- Consultar solicitudes corporativas
- Ver otros miembros

---

### 8. INTRANET G&M

**Disponible para**: Solo Lawyers con is_gym_lawyer = true

#### Secciones:

**Perfil de la Firma:**
- Banner: Seguridad, Confianza, Tranquilidad
- Imagen de portada y logo
- Número de miembros
- Invitaciones pendientes
- Fecha de creación
- Botón ver organigrama

**Radicar Informe:**
- Formulario completo de facturación:
  - No. Contrato
  - Fecha Inicial y Final del período
  - Concepto de Pago
  - Valor a Cobrar
  - Adjuntar: Informe de Actividades (PDF)
  - Adjuntar: Cuenta de Cobro/Factura (PDF)
  - Adjuntar: Anexos adicionales
  - Observaciones
- Validación de campos y fechas

**Procedimientos G&M:**
- Búsqueda en tiempo real
- Resaltado de coincidencias
- Links a documentos externos
- Categorías: Administrativos, Operativos, Mercadeo, Comerciales

**Organigrama G&M:**
- Modal con imagen completa
- Jerarquía de la firma
- Roles y responsabilidades

---

## Tabla Comparativa de Permisos

| Funcionalidad | Lawyer | Client | Corporate | Basic |
|--------------|--------|--------|-----------|-------|
| **Dashboard** | ✅ Completo | ✅ Completo | ✅ Completo | ✅ Limitado |
| **Directorio** | ✅ | ❌ | ❌ | ❌ |
| **Ver Procesos** | ✅ Todos | ✅ Propios | ✅ Propios | ✅ Propios |
| **Crear Procesos** | ✅ | ❌ | ❌ | ❌ |
| **Solicitar Info Proceso** | ❌ | ✅ | ✅ | ❌ |
| **Crear Documentos** | ✅ | ❌ | ❌ | ❌ |
| **Usar Documentos** | ✅ | ✅ | ✅ | ✅ |
| **Firma Electrónica** | ✅ | ✅ | ✅ | ❌ |
| **Membrete** | ✅ | ✅ | ✅ | ❌ |
| **Crear Solicitudes** | ❌ | ✅ | ✅ | ✅ |
| **Gestionar Solicitudes** | ✅ | ❌ | ❌ | ❌ |
| **Agendar Cita** | ❌ | ✅ | ✅ | ✅ |
| **Ver Organizaciones** | ❌ | ✅ | ✅ | ✅ |
| **Gestionar Organizaciones** | ❌ | ❌ | ✅ | ❌ |
| **Intranet G&M** | ✅ Solo GYM | ❌ | ❌ | ❌ |
| **PWA Instalar** | ✅ | ✅ | ✅ | ✅ |

---

## Implementación Técnica

### Estructura Frontend

#### Rutas Principales (`/router/index.js`)
```javascript
/dashboard - Dashboard
/directory_list - Directorio (requiresLawyer)
/process_list - Lista de Procesos
/process_detail/:id - Detalle de Proceso
/process_form - Radicar Proceso (requiresLawyer)
/dynamic_document_dashboard - Archivos Jurídicos
/legal_requests - Solicitudes/Gestión
/schedule_appointment - Agendar Cita
/organizations_dashboard - Organizaciones
/intranet_g_y_m - Intranet (requiresLawyer + is_gym_lawyer)
/user_guide - Manual de Usuario
```

#### Componentes Clave

**SlideBar** (`/components/layouts/SlideBar.vue`):
- Filtrado dinámico de navegación por rol
- Elimina opciones según rol en `onMounted`
- Lógica especial para is_gym_lawyer

**Stores** (`/stores/`):
- `auth/user.js` - Gestión de usuarios y roles
- `auth/auth.js` - Autenticación
- `user_guide.js` - Contenido del manual

### Estructura Backend

#### Modelos Principales (`/backend/gym_app/models/`)

**User** (`user.py`):
- Roles: 'basic', 'client', 'corporate_client', 'lawyer'
- Campo: is_gym_lawyer (Boolean)
- Campos: email, first_name, last_name, contact, birthday, identification

**Process** (`process.py`):
- Relaciones: client, lawyer, case, stages, case_files
- Campos: authority, plaintiff, defendant, ref

**DynamicDocument** (`dynamic_document.py`):
- Estados: Published, Draft, Progress, Completed, PendingSignatures, FullySigned
- Relaciones: created_by, assigned_to, tags
- Campos: title, content, variables

**LegalRequest** (`legal_request.py`):
- Estados: PENDING, IN_REVIEW, RESPONDED, CLOSED
- Número automático: SOL-YYYY-NNN
- Relaciones: user, request_type, discipline, files, responses

**Organization** (`organization.py`):
- Relación: corporate_client (limit_choices_to 'corporate_client')
- Campos: title, description, profile_image, cover_image
- Métodos: get_member_count, get_pending_invitations_count

### Guards y Permisos

**Router Guards** (`router/index.js`):
```javascript
requiresAuth: true - Requiere autenticación
requiresLawyer: true - Solo abogados
```

**Filtrado en SlideBar**:
- Clientes: Elimina "Radicar Proceso", "Directorio", "Intranet G&M"
- Abogados no GYM: Elimina "Intranet G&M"
- Abogados: Elimina "Organizaciones", "Agendar Cita"

### Manual de Usuario

**Ubicación**: `/user_guide`

**Componentes**:
- `UserGuideMain.vue` - Vista principal
- `GuideNavigation.vue` - Navegación lateral
- `ModuleGuide.vue` - Contenido del módulo
- `SearchGuide.vue` - Búsqueda
- `ExampleModal.vue` - Ejemplos paso a paso
- `RoleInfoCard.vue` - Info del rol
- `QuickLinksCard.vue` - Enlaces rápidos

**Store** (`user_guide.js`):
- 8 módulos completos
- 28 secciones detalladas
- 3 ejemplos con modales
- Filtrado automático por rol
- Búsqueda en tiempo real

**Características**:
- Enlaces de WhatsApp integrados
- Ejemplos interactivos con pasos, tips y errores comunes
- Botón "Volver" en secciones
- Responsive completo
- Búsqueda con resultados en tiempo real

---

## Estadísticas del Sistema

### Contenido Documentado
- **Módulos**: 8 módulos principales
- **Secciones**: 28 secciones detalladas
- **Funcionalidades**: 200+ funcionalidades mapeadas
- **Pestañas**: 13 pestañas explicadas
- **Acciones**: 10 acciones sobre documentos
- **Roles**: 4 roles cubiertos
- **Ejemplos**: 3 ejemplos completos

### Archivos del Proyecto
- **Vistas**: 11 vistas principales
- **Componentes**: 100+ componentes
- **Stores**: 8+ stores Pinia
- **Modelos Backend**: 10+ modelos Django
- **Rutas**: 15+ rutas principales

---

## Notas Importantes

### Restricciones por Rol
- **Basic**: Sin firma electrónica, sin membrete, sin solicitar info en procesos
- **Client/Corporate**: Solo lectura en procesos, no pueden crear/editar
- **Lawyer**: No acceso a Organizaciones ni Agendar Cita
- **is_gym_lawyer**: Requerido para acceder a Intranet G&M

### Flujos Importantes
1. **Radicar Proceso**: Lawyer crea → Cliente ve → Cliente puede solicitar info
2. **Documentos**: Lawyer crea con variables → Asigna a cliente → Cliente completa → Lawyer revisa
3. **Solicitudes**: Cliente crea → Lawyer gestiona → Thread de conversación → Cierre
4. **Organizaciones**: Corporate crea → Invita miembros → Miembros aceptan → Solicitudes corporativas

---

**Documento Consolidado**: Nov 21, 2025  
**Versión**: 1.0.0  
**Estado**: ✅ Completo y Actualizado
