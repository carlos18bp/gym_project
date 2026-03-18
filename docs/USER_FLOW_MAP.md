# Mapa de Flujos de Navegabilidad — G&M Abogados

Documento exhaustivo que mapea todos los flujos end-to-end que un usuario puede realizar en la plataforma, organizados por rol, con ramificaciones para cada variante de formulario o camino alternativo.

**Fecha:** March 18, 2026  
**Versión:** 1.1.0  
**Fuentes:** `src/router/index.js`, `src/views/`, `src/components/`, `e2e/flow-definitions.json`, `docs/FUNCTIONAL_GUIDE_BY_ROLE.md`

---

## Tabla de Contenido

1. [Roles del Sistema](#roles-del-sistema)
2. [Convenciones](#convenciones)
3. [Flujos Compartidos (sin rol)](#flujos-compartidos-sin-rol)
4. [Flujos — Lawyer](#flujos--lawyer)
5. [Flujos — Client](#flujos--client)
6. [Flujos — Corporate Client](#flujos--corporate-client)
7. [Flujos — Basic](#flujos--basic)
8. [Flujos — Lawyer G&M (is_gym_lawyer)](#flujos--lawyer-gm-is_gym_lawyer)
9. [Resumen de Cobertura E2E](#resumen-de-cobertura-e2e)

---

## Roles del Sistema

| Rol | Descripción | Módulos exclusivos |
|-----|-------------|-------------------|
| **Lawyer** | Gestión completa de procesos, clientes y documentos | Directorio, Gestión de Solicitudes |
| **Client** | Ver procesos propios, solicitar servicios, usar documentos | Solicitudes (crear), Agendar Cita, Organizaciones (lectura) |
| **Corporate Client** | Todo de Client + gestión completa de Organizaciones | Organizaciones (CRUD completo) |
| **Basic** | Acceso limitado, sin firma electrónica ni membrete | — |
| **Lawyer G&M** | Lawyer con `is_gym_lawyer=true`, acceso a Intranet | Intranet G&M |

---

## Convenciones

- **Ramificaciones:** `├──` variante intermedia, `└──` última variante
- **Flow ID:** alineado con `e2e/flow-definitions.json` cuando existe
- **Prioridad:** P1 (crítico) → P4 (cosmético)
- **Cobertura E2E:** ✅ cubierto | ⚠️ parcial | ❌ sin cobertura

---

## Flujos Compartidos (sin rol)

### auth-login-email: Iniciar sesión con email
- **Módulo:** auth | **Prioridad:** P1 | **Ruta:** `/sign_in` | **E2E:** ✅
- **Descripción:** Usuario inicia sesión con correo y contraseña

**Pasos:**
1. Navega a `/sign_in`
2. Ingresa email y contraseña
3. Completa reCAPTCHA
4. Click "Iniciar Sesión"

**Ramificaciones:**
- ├── **Éxito:** Redirect a `/dashboard`
- ├── **Credenciales inválidas:** Mensaje de error, permanece en `/sign_in`
- └── **Bloqueo progresivo** (→ auth-login-attempts): Tras 3 intentos → espera 60s, luego 120s, 240s...

---

### auth-login-google: Iniciar sesión con Google
- **Módulo:** auth | **Prioridad:** P1 | **Ruta:** `/sign_in` | **E2E:** ✅
- **Descripción:** Usuario accede mediante OAuth con cuenta de Google

**Pasos:**
1. Navega a `/sign_in`
2. Click "Continuar con Google"
3. Selecciona cuenta Google en popup
4. Autoriza acceso

**Ramificaciones:**
- ├── **Usuario existente:** Redirect a `/dashboard`
- ├── **Usuario nuevo:** Se crea cuenta automáticamente → redirect a `/dashboard`
- └── **Error token/popup cerrado:** Mensaje de error

---

### auth-register: Registrar nueva cuenta
- **Módulo:** auth | **Prioridad:** P1 | **Ruta:** `/sign_on` | **E2E:** ✅
- **Descripción:** Crear cuenta nueva con verificación de email por passcode

**Pasos:**
1. Navega a `/sign_on`
2. Llena formulario: nombre, apellido, email, contraseña, confirmar contraseña
3. Acepta políticas de privacidad
4. Completa reCAPTCHA
5. Click "Registrarse" → envía passcode al email
6. Ingresa código de verificación recibido
7. Click "Verificar" → cuenta creada

**Ramificaciones:**
- ├── **Registro con formulario:** Paso 1 (datos) → Paso 2 (passcode) → Registro completo
- ├── **Registro con Google:** Click "Continuar con Google" → misma lógica que auth-login-google
- ├── **Email ya registrado (409):** Notificación de email duplicado
- ├── **Passcode inválido:** Mensaje de error
- └── **Email cambiado después de enviar passcode:** Advertencia, debe regenerar código

---

### auth-forgot-password: Recuperar contraseña
- **Módulo:** auth | **Prioridad:** P2 | **Ruta:** `/forget_password` | **E2E:** ✅
- **Descripción:** Restablecer contraseña olvidada

**Pasos:**
1. Navega a `/forget_password`
2. Ingresa email registrado
3. Click "Enviar código"
4. Ingresa código de verificación
5. Crea nueva contraseña + confirmación
6. Contraseña actualizada → redirect a `/sign_in`

---

### auth-subscription-signin: Login vía suscripción
- **Módulo:** auth | **Prioridad:** P1 | **Ruta:** `/subscription/sign_in` | **E2E:** ✅
- **Descripción:** Login desde flujo de suscripción, redirige a checkout con plan seleccionado

**Pasos:**
1. Usuario no autenticado selecciona plan en `/subscriptions`
2. Redirect a `/subscription/sign_in?plan=<plan>`
3. Ingresa email, contraseña, reCAPTCHA
4. Click "Iniciar Sesión"
5. Redirect a `/checkout/<plan>`

**Ramificaciones:**
- ├── **Éxito:** Redirect a checkout con plan preservado
- ├── **Error credenciales:** Mensaje de error, permanece en form
- └── **Link a registro:** Navega a `/subscription/sign_up?plan=<plan>`

---

### auth-subscription-signup: Registro vía suscripción
- **Módulo:** auth | **Prioridad:** P1 | **Ruta:** `/subscription/sign_up` | **E2E:** ✅
- **Descripción:** Registro desde flujo de suscripción, redirige a checkout

**Pasos:**
1. Navega a `/subscription/sign_up?plan=<plan>`
2. Mismo formulario que auth-register (datos + passcode)
3. Cuenta creada → redirect a `/checkout/<plan>`

---

### auth-logout: Cerrar sesión
- **Módulo:** auth | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Cierre manual de sesión

**Pasos:**
1. Click en nombre de usuario en sidebar
2. Selecciona "Cerrar Sesión"
3. Limpieza de sesión local → redirect a `/sign_in`

---

### auth-idle-logout: Cierre por inactividad
- **Módulo:** auth | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Cierre automático tras 15 minutos sin actividad

**Pasos:**
1. Usuario deja de interactuar (mouse, teclado, scroll, touch)
2. Tras 15 minutos → cierre automático de sesión
3. Redirect a `/sign_in`

---

### auth-login-attempts: Protección contra accesos no autorizados
- **Módulo:** auth | **Prioridad:** P2 | **Ruta:** `/sign_in` | **E2E:** ✅
- **Descripción:** Bloqueo progresivo tras intentos fallidos

**Ramificaciones:**
- ├── **3 intentos fallidos:** Bloqueo 60 segundos
- ├── **4 intentos fallidos:** Bloqueo 120 segundos
- └── **5+ intentos fallidos:** Bloqueo 240 segundos (progresivo)

---

### auth-router-guards: Guardias de navegación
- **Módulo:** auth | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Protección de rutas por autenticación y rol

**Ramificaciones:**
- ├── **Ruta `requiresAuth` sin sesión:** Redirect a `/sign_in`
- ├── **Ruta `requiresLawyer` con rol client/basic/corporate:** Redirect a `/dashboard`
- └── **Ruta raíz `/`:** Autenticado → `/dashboard`, No autenticado → `/sign_in`

---

### subscriptions-view-plans: Ver planes de suscripción
- **Módulo:** subscriptions | **Prioridad:** P2 | **Ruta:** `/subscriptions` | **E2E:** ✅
- **Descripción:** Comparar planes y seleccionar uno

**Pasos:**
1. Navega a `/subscriptions`
2. Ve 3 planes en grid

**Ramificaciones al seleccionar plan:**
- ├── **Plan Básico** (gratuito): `selectPlan('basico')`
- ├── **Plan Cliente** ($59.900/mes): `selectPlan('cliente')`
- └── **Plan Corporativo** ($149.900/mes): `selectPlan('corporativo')`

**Ramificaciones por autenticación:**
- ├── **Autenticado:** Redirect directo a `/checkout/<plan>`
- └── **No autenticado:** Redirect a `/subscription/sign_in?plan=<plan>`

---

### subscriptions-checkout-free: Checkout plan gratuito
- **Módulo:** subscriptions | **Prioridad:** P1 | **Ruta:** `/checkout/basico` | **E2E:** ✅
- **Descripción:** Activar plan gratuito sin pago

**Pasos:**
1. Navega a `/checkout/basico`
2. Ve resumen del plan (precio: Gratuito)
3. **No se muestra formulario de tarjeta** (`planDetails.amountInCents === 0`)
4. Click "Confirmar Suscripción"
5. Plan activado inmediatamente

---

### subscriptions-checkout-paid: Checkout plan pago
- **Módulo:** subscriptions | **Prioridad:** P1 | **Ruta:** `/checkout/<plan>` | **E2E:** ✅
- **Descripción:** Pagar suscripción con tarjeta vía Wompi

**Pasos:**
1. Navega a `/checkout/cliente` o `/checkout/corporativo`
2. Ve resumen del plan con precio
3. **Se muestra formulario de tarjeta** (`planDetails.amountInCents > 0`):
   - Nombre del titular
   - Número de tarjeta
   - Mes/Año de expiración
   - CVC
4. Click "Guardar método de pago" → tokenización Wompi
5. Ve confirmación "Método de pago guardado"
6. Click "Confirmar Suscripción"
7. Plan activado

**Ramificaciones:**
- ├── **Tokenización exitosa:** Muestra badge verde "Método de pago guardado" + botón "Cambiar"
- ├── **Error de tokenización:** Mensaje de error, puede reintentar
- └── **Cambiar tarjeta:** Click "Cambiar" → limpia datos y muestra formulario de nuevo

---

### subscriptions-management: Gestión de suscripción
- **Módulo:** subscriptions | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Cancelar o mejorar plan actual

**Ramificaciones:**
- ├── **Cancelar:** Plan activo hasta fin de período → transición automática a plan gratuito
- └── **Upgrade:** Seleccionar plan superior → completar pago → beneficios activados inmediatamente

---

### subscriptions-cancel: Cancelar suscripción
- **Módulo:** subscriptions | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Cancelar suscripción activa, plan vigente hasta fin de período, transición a plan gratuito

**Pasos:**
1. En gestión de suscripción, click "Cancelar suscripción"
2. Modal de confirmación
3. Plan permanece activo hasta fin del período de facturación
4. Al expirar → transición automática a plan gratuito

---

### subscriptions-update-payment: Actualizar método de pago
- **Módulo:** subscriptions | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Cambiar tarjeta de pago en suscripción activa vía tokenización Wompi

**Pasos:**
1. En gestión de suscripción, click "Cambiar método de pago"
2. Formulario de tarjeta (nombre, número, expiración, CVC)
3. Tokenización vía Wompi
4. Confirmación de actualización

---

### profile-view-edit: Ver y editar perfil
- **Módulo:** profile | **Prioridad:** P2 | **Ruta:** N/A (modal desde sidebar) | **E2E:** ✅
- **Descripción:** Actualizar información personal

**Pasos:**
1. Click en nombre en sidebar → menú → "Perfil"
2. Modal muestra datos actuales
3. Click "Editar"
4. Modifica: nombre, apellido, contacto, identificación, fecha nacimiento, foto
5. Click "Guardar"

---

### profile-complete: Completar perfil (primer login)
- **Módulo:** profile | **Prioridad:** P2 | **Ruta:** N/A (modal automático) | **E2E:** ✅
- **Descripción:** Modal obligatorio si perfil está incompleto

**Ramificaciones:**
- ├── **Perfil incompleto:** Modal aparece automáticamente al entrar al dashboard
- └── **Perfil completo:** No se muestra modal

---

### misc-policies: Políticas y páginas informativas
- **Módulo:** misc | **Prioridad:** P4 | **Ruta:** `/policies/privacy_policy`, `/policies/terms_of_use` | **E2E:** ✅
- **Descripción:** Páginas estáticas de políticas de privacidad y términos de uso

---

### misc-pwa-install: Instalar PWA
- **Módulo:** misc | **Prioridad:** P4 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Prompt de instalación de la app como PWA

---

### user-guide-navigation: Navegación del Manual de Usuario
- **Módulo:** user-guide | **Prioridad:** P3 | **Ruta:** `/user_guide` | **E2E:** ✅
- **Descripción:** Navegación por módulos, filtrado por rol, búsqueda y quick links

---

### auth-edge-cases: Casos borde de autenticación
- **Módulo:** auth | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Token expirado, OAuth callback, credenciales inválidas, captcha

**Ramificaciones:**
- ├── **Token expirado:** Sesión se cierra → redirect a `/sign_in`
- ├── **OAuth callback error:** Mensaje de error → permanece en login
- ├── **Credenciales inválidas:** Error inline + no limpia formulario
- └── **reCAPTCHA no completado:** Botón deshabilitado

---

### misc-error-handling: Manejo de errores
- **Módulo:** misc | **Prioridad:** P3 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Páginas de error 404, 401, 403, 500, errores de red

**Ramificaciones:**
- ├── **Sin conexión:** Redirect a `/no_connection`
- ├── **Ruta no encontrada:** Redirect a `/sign_in` (catch-all)
- └── **Error en router guard:** Redirect a `/sign_in`

---

## Flujos — Lawyer

### dashboard-welcome-card: Tarjeta de bienvenida
- **Módulo:** dashboard | **Prioridad:** P2 | **Ruta:** `/dashboard` | **E2E:** ✅
- **Descripción:** Panel principal con saludo, estadísticas y acciones rápidas

**Contenido para Lawyer:**
- Saludo personalizado con nombre
- Contador de procesos activos
- Botones de acción rápida: Todos los Procesos, Radicar Proceso, Nueva Minuta, Radicar Informe

---

### dashboard-activity-feed: Feed de actividad
- **Módulo:** dashboard | **Prioridad:** P2 | **Ruta:** `/dashboard` | **E2E:** ✅
- **Descripción:** Historial cronológico de acciones con scroll infinito

**Tipos de actividad:**
- Creación/actualización de procesos
- Firma de documentos
- Creación de minutas
- Edición de contenido de documentos
- Rechazo de documentos y correcciones reenviadas
- Actualización de perfil

---

### dashboard-legal-updates: Actualizaciones legales
- **Módulo:** dashboard | **Prioridad:** P3 | **Ruta:** `/dashboard` | **E2E:** ✅
- **Descripción:** Carrusel con noticias del sector legal

**Ramificaciones (solo admin/lawyer):**
- ├── **Ver actualizaciones:** Carrusel con título, contenido y enlaces
- ├── **Crear actualización:** Formulario con título + contenido + estado (activo/inactivo)
- ├── **Editar actualización:** Modificar datos existentes
- └── **Eliminar actualización:** Confirmación + eliminación

---

### dashboard-reports: Generar reporte
- **Módulo:** dashboard | **Prioridad:** P2 | **Ruta:** `/dashboard` | **E2E:** ✅
- **Descripción:** Generar reporte Excel de actividad

**Pasos:**
1. Click en botón de reportes en dashboard
2. Selecciona rango de fechas (inicio, fin)
3. Click "Generar"
4. Descarga archivo Excel

---

### dashboard-recent-documents: Documentos recientes
- **Módulo:** dashboard | **Prioridad:** P3 | **Ruta:** `/dashboard` | **E2E:** ✅
- **Descripción:** Últimos 5 procesos y documentos visitados

---

### dashboard-quick-actions: Acciones rápidas del dashboard
- **Módulo:** dashboard | **Prioridad:** P3 | **Ruta:** `/dashboard` | **E2E:** ✅
- **Descripción:** Accesos directos contextuales filtrados por rol

---

### dashboard-navigation: Navegación del sidebar
- **Módulo:** dashboard | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Menú lateral filtrado por rol con navegación a todos los módulos

**Ramificaciones por rol (sidebar):**
- ├── **Lawyer:** Dashboard, Directorio, Procesos, Documentos, Gestión de Solicitudes, Manual de Usuario
- ├── **Lawyer G&M:** Todo de Lawyer + Intranet G&M
- ├── **Client:** Dashboard, Procesos, Documentos, Solicitudes, Agendar Cita, Organizaciones, Manual de Usuario
- ├── **Corporate Client:** Igual que Client
- └── **Basic:** Igual que Client

---

### dashboard-folder-components: Carpetas y contactos en dashboard
- **Módulo:** dashboard | **Prioridad:** P3 | **Ruta:** `/dashboard` | **E2E:** ✅
- **Descripción:** Pestañas de carpetas y contactos rápidos en el dashboard

---

### directory-search: Buscar en directorio
- **Módulo:** directory | **Prioridad:** P2 | **Ruta:** `/directory_list` | **E2E:** ✅
- **Descripción:** Buscar y consultar usuarios del sistema (solo Lawyer)

**Pasos:**
1. Navega a `/directory_list`
2. Usa barra de búsqueda (nombre, email, identificación, rol)
3. Click en tarjeta de usuario → modal con info + procesos
4. Click "Ver proceso" → navega al detalle
5. O click "Ver todos en Procesos" → lista filtrada

---

### process-list-view: Ver lista de procesos
- **Módulo:** processes | **Prioridad:** P1 | **Ruta:** `/process_list` | **E2E:** ✅
- **Descripción:** Lista de procesos con tabs y filtros

**Tabs para Lawyer:**
- ├── **Mis Procesos:** Casos asignados
- ├── **Todos los Procesos:** Vista completa del sistema (exclusivo Lawyer)
- └── **Procesos Archivados:** Casos finalizados

**Filtros disponibles:**
- Búsqueda texto: referencia, demandante, demandado, autoridad, cliente
- Filtro por Tipo de Caso: Civil, Penal, Laboral, Familia, Administrativo, etc.
- Filtro por Autoridad: Juzgados, Tribunales, Cortes
- Filtro por Etapa Procesal: Admisión, Pruebas, Alegatos, Sentencia
- Ordenamiento: Más recientes / Nombre A-Z

---

### process-create: Radicar proceso
- **Módulo:** processes | **Prioridad:** P1 | **Ruta:** `/process_form/create` | **E2E:** ✅
- **Descripción:** Crear nuevo proceso judicial (solo Lawyer)

**Pasos:**
1. Click "Radicar Proceso"
2. Llena formulario:
   - **Tipo de caso** (Combobox con búsqueda)
   - Subcaso (texto libre)
   - Demandante, Demandado
   - Autoridad, Referencia/Radicado
   - **Clientes** (multi-select con búsqueda)
   - Abogado responsable
   - **Etapas procesales** (tabla dinámica, agregar N etapas con fecha)
   - Archivos del expediente (upload múltiple)
3. Click "Guardar"

**Ramificaciones — Tipo de caso:**
- ├── **Civil:** Subclases específicas (Ordinario, Ejecutivo, etc.)
- ├── **Penal:** Subclases específicas
- ├── **Laboral:** Subclases específicas
- ├── **Familia:** Subclases específicas
- └── **Otros tipos:** Administrativo, Constitucional, etc.

**Ramificaciones — Clientes:**
- ├── **Un solo cliente:** Selección simple
- └── **Múltiples clientes:** Multi-select, tabla con lista de seleccionados + botón eliminar

**Ramificaciones — Etapas procesales:**
- ├── **Con fecha definida:** Usuario selecciona fecha del calendario
- ├── **Sin fecha:** Sistema usa fecha actual por defecto
- ├── **Agregar etapa:** Botón "+" añade fila a la tabla
- └── **Eliminar etapa:** Botón trash (deshabilitado para primera etapa)

**Ramificaciones — Archivos:**
- ├── **Sin archivos:** Formulario se envía sin adjuntos
- └── **Con archivos:** Drag & drop o selección manual, múltiples archivos

---

### process-edit: Editar proceso
- **Módulo:** processes | **Prioridad:** P2 | **Ruta:** `/process_form/edit/:process_id` | **E2E:** ✅
- **Descripción:** Editar proceso existente (precarga datos)

Mismas ramificaciones que process-create, con datos precargados.

---

### process-detail: Ver detalle de proceso
- **Módulo:** processes | **Prioridad:** P1 | **Ruta:** `/process_detail/:process_id` | **E2E:** ✅
- **Descripción:** Información completa del caso

**Contenido:**
- Avatar del cliente con nombre y rol
- Tarjeta de información: tipo, autoridad, radicado, partes
- Barra de progreso tipo chevron (Inicio → Etapa Actual → Fin)
- Botón "Histórico Procesal" → modal con timeline de etapas
- Tarjeta de expediente digital: tabla de archivos, búsqueda, descarga individual, paginación (10/página)
- Botón "Ver usuarios" → modal con todos los clientes asociados

---

### process-case-file-upload: Subir archivos al expediente
- **Módulo:** processes | **Prioridad:** P2 | **Ruta:** `/process_detail/:process_id` | **E2E:** ✅
- **Descripción:** Upload múltiple de archivos al expediente digital

---

### process-search: Buscar procesos
- **Módulo:** processes | **Prioridad:** P3 | **Ruta:** `/process_list` | **E2E:** ✅
- **Descripción:** Búsqueda por texto en la lista de procesos

---

### process-history: Histórico procesal
- **Módulo:** processes | **Prioridad:** P2 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Modal con timeline de etapas procesales ordenadas cronológicamente

---

### process-form-validation: Validación del formulario de procesos
- **Módulo:** processes | **Prioridad:** P2 | **Ruta:** `/process_form/*` | **E2E:** ✅
- **Descripción:** Validación de campos requeridos, habilitación de botón guardar, agregar/eliminar etapas

---

### docs-dashboard-lawyer: Dashboard de documentos (Lawyer)
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** `/dynamic_document_dashboard` | **E2E:** ✅
- **Descripción:** Vista principal de documentos para abogados

**Tabs disponibles:**
1. **Minutas** — Plantillas creadas (Published, Draft)
2. **Mis Documentos** — Documentos propios (completados y en progreso)
3. **Carpetas** — Organización en carpetas personalizadas
4. **Dcs. Por Firmar** — Estado PendingSignatures
5. **Dcs. Firmados** — Estado FullySigned
6. **Dcs. Archivados** — Rechazados y Expirados (Rejected, Expired)
7. **Dcs. Clientes (Completados)** — Finalizados por clientes
8. **Dcs. Clientes (En Progreso)** — En proceso de completado

**Acciones en la barra superior:**
- Botón "Firma Electrónica" → modal de configuración de firma
- Botón "Membrete Global" → configuración de encabezado/pie
- Botón "Nueva Minuta" (solo en tab Minutas) → modal nombre → editor
- Botón "Nuevo Documento" (solo en tab Mis Documentos) → seleccionar plantilla

---

### docs-create-template: Crear minuta (plantilla)
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** `/dynamic_document_dashboard/lawyer/editor/create/:title` | **E2E:** ✅
- **Descripción:** Crear nueva plantilla de documento

**Pasos:**
1. Click "Nueva Minuta"
2. Modal: ingresa nombre de la minuta
3. Abre editor TinyMCE
4. Redacta contenido con formato enriquecido
5. Inserta variables con sintaxis `{{nombreVariable}}`
6. Guardar como Draft o Published

---

### docs-editor: Editor de documentos
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** `/dynamic_document_dashboard/lawyer/editor/edit/:id` | **E2E:** ✅
- **Descripción:** Editar contenido de documento en TinyMCE

**Ramificaciones por contexto:**
- ├── **Editar minuta (Lawyer):** Editor completo, puede modificar todo
- ├── **Editar documento completado por cliente:** Variables protegidas (subrayadas amarillo), solo contenido libre editable
- └── **Vista de solo lectura:** Preview sin edición

---

### docs-variables-config: Configurar variables
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** `/dynamic_document_dashboard/lawyer/variables-config` | **E2E:** ✅
- **Descripción:** Definir tipo y comportamiento de cada variable del documento

**Campos por variable:**
- Nombre (ES/EN)
- Tooltip explicativo
- **Tipo de campo** (field_type) — ver ramificaciones
- Clasificación (summary_field)
- Moneda (si clasificación = value)

**Ramificaciones — Tipo de campo (field_type):**
- ├── **input:** Texto simple, una línea
- ├── **text_area:** Texto largo, múltiples líneas
- ├── **number:** Numérico con formato de miles y moneda opcional
- ├── **date:** Selector de fecha del calendario
- ├── **email:** Input con validación de formato email
- └── **select:** Dropdown con opciones personalizadas (opciones separadas por coma)

**Ramificaciones — Clasificación (summary_field):**
- ├── **none:** Sin clasificación especial
- ├── **title:** Usuario/Contraparte
- ├── **subscription_date:** Fecha de suscripción (auto-ajusta field_type a date)
- ├── **start_date:** Fecha de inicio (auto-ajusta field_type a date)
- ├── **end_date:** Fecha de fin (auto-ajusta field_type a date)
- └── **value:** Valor monetario (auto-ajusta field_type a number) + selector de moneda (COP, USD, EUR)

---

### docs-use-template: Usar documento (DocumentForm)
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** `/dynamic_document_dashboard/document/use/:mode/:id/:title` | **E2E:** ✅
- **Descripción:** Formulario para completar documentos con campos variables

**Ramificaciones — Modo del formulario (route.params.mode):**
- ├── **creator:** Llenar documento nuevo desde plantilla. Botones: "Guardar progreso" + "Generar"
- ├── **editor:** Editar borrador existente. Botones: "Guardar cambios como Borrador" + "Completar y Generar"
- ├── **formalize:** Agregar firmas a documento completado. Botones: "Formalizar y Agregar Firmas". Sección adicional: seleccionar firmantes + fecha límite de firma + gestionar asociaciones
- └── **correction:** Corregir documento rechazado/expirado y reenviar. Botón: "Guardar y reenviar para firma"

**Ramificaciones — Campos variables (6 tipos):**
- ├── **input** (`field_type='input'`): `<input type="text">`
- ├── **text_area** (`field_type='text_area'`): `<textarea>` (ocupa ancho completo)
- ├── **number** (`field_type='number'`): Input numérico con prefijo de moneda si `variable.currency` existe
- ├── **date** (`field_type='date'`): `<input type="date">` con calendario
- ├── **email** (`field_type='email'`): `<input type="email">` con validación
- └── **select** (`field_type='select'`): `<select>` con opciones de `variable.select_options`

**Ramificaciones — Modo formalize (firmantes):**
- ├── **Buscar firmante:** Input de búsqueda por nombre/email → dropdown con resultados
- ├── **Agregar firmante:** Click en usuario → se añade a lista numerada
- ├── **Remover firmante:** Botón eliminar en cada firmante
- └── **Fecha límite:** Input date con mínimo = fecha actual

---

### docs-permissions: Asignar documentos a clientes
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Configurar permisos de acceso al documento

---

### docs-card-actions: Acciones sobre documentos
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A (menú contextual) | **E2E:** ✅
- **Descripción:** Menú de acciones disponibles por documento

**Acciones (10):**
1. 👁️ Ver/Editar → abre editor
2. 📋 Duplicar → crea copia
3. 👤 Asignar a Cliente → modal permisos
4. ⚙️ Configurar Variables → ruta variables-config
5. 🏷️ Gestionar Etiquetas → modal tags
6. 🗑️ Eliminar → confirmación
7. 📄 Descargar PDF → export directo
8. 📁 Mover a Carpeta → modal selección carpeta
9. ✍️ Firmar → flujo de firma
10. 👀 Vista Previa → modal readonly

**Acciones adicionales en Archivados:**
- ↩️ Editar y reenviar para firma (documentos Rejected/Expired)
- ✏️ Editar contenido (documentos completados por clientes)

---

### sign-electronic-signature: Firma electrónica
- **Módulo:** signatures | **Prioridad:** P1 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Crear y guardar firma electrónica

**Ramificaciones — Método de firma:**
- ├── **Dibujar:** Canvas con mouse o touch → dibujar firma
- └── **Subir imagen:** Seleccionar archivo de imagen escaneada

---

### sign-document-flow: Firmar documento
- **Módulo:** signatures | **Prioridad:** P1 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Proceso de firma de un documento pendiente

**Ramificaciones:**
- ├── **Firmar:** Aplica firma guardada → actualiza estado (parcial o FullySigned si es último firmante)
- └── **Rechazar** (→ sign-reject): Modal con campo motivo opcional → documento pasa a Rejected

---

### sign-reject: Rechazar documento
- **Módulo:** signatures | **Prioridad:** P1 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Rechazar documento con motivo

**Pasos:**
1. Click "Rechazar documento"
2. Modal con campo de motivo (opcional)
3. Confirmar rechazo
4. Documento pasa a estado Rejected → pestaña Archivados

---

### sign-reopen: Reabrir documento rechazado
- **Módulo:** signatures | **Prioridad:** P1 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Abogado reabre documento Rejected/Expired para corrección

**Pasos:**
1. En Dcs. Archivados, click "Editar y reenviar para firma"
2. Abre DocumentForm en modo `correction`
3. Corrige contenido
4. Click "Guardar y reenviar para firma"
5. Documento vuelve a PendingSignatures

---

### docs-state-transitions: Estados y transiciones de documentos
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Ciclo de vida del documento

**Diagrama de estados:**
```
Draft → Published (publicar minuta)
Published → Progress (cliente empieza a llenar)
Progress → Completed (cliente termina de llenar)
Completed → PendingSignatures (formalizar con firmas)
PendingSignatures → FullySigned (todos firmaron)
PendingSignatures → Rejected (algún firmante rechazó)
PendingSignatures → Expired (pasó fecha límite)
Rejected → PendingSignatures (abogado corrige y reenvía)
Expired → PendingSignatures (abogado corrige y reenvía)
```

---

### docs-tags: Gestionar etiquetas
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Crear, editar y asignar etiquetas de colores

---

### docs-folders: Gestionar carpetas
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** `/dynamic_document_dashboard` (tab Carpetas) | **E2E:** ✅
- **Descripción:** Organizar documentos en carpetas

**Acciones:**
- Crear carpeta (nombre + color)
- Mover documentos a carpeta
- Ver contenido (grid o tabla)
- Editar nombre/descripción
- Eliminar carpeta (con confirmación)

---

### docs-folder-crud: Document folder CRUD
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** `/dynamic_document_dashboard` (tab Carpetas) | **E2E:** ✅
- **Descripción:** Folder list rendering, empty folders state, create/edit folder modal

---

### docs-letterhead: Membrete global
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Configurar encabezado y pie de página global

---

### docs-send-email: Enviar documento por email
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Enviar documento a un email con anexos opcionales

**Pasos:**
1. Click acción "Enviar por email"
2. Modal: ingresa email destinatario
3. Opcionalmente adjunta archivos adicionales
4. Click "Enviar"

---

### docs-download: Descargar documento
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Exportar documento como PDF o Word

---

### docs-duplicate: Duplicar documento
- **Módulo:** documents | **Prioridad:** P3 | **Ruta:** N/A | **E2E:** ✅

---

### docs-delete: Eliminar documento
- **Módulo:** documents | **Prioridad:** P3 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Eliminar con confirmación (solo documentos Draft)

---

### docs-preview: Previsualizar documento
- **Módulo:** documents | **Prioridad:** P3 | **Ruta:** N/A (modal) | **E2E:** ✅

---

### docs-key-fields: Campos clave del documento
- **Módulo:** documents | **Prioridad:** P3 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Modal con información clave sin abrir documento completo

**Tipos de campo clave:**
- ├── **title:** Usuario/Contraparte
- ├── **value:** Valor monetario con moneda
- ├── **subscription_date / start_date / end_date:** Fechas formateadas
- └── **none:** No se muestra en el modal

---

### docs-relationships: Asociar documentos
- **Módulo:** documents | **Prioridad:** P3 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Vincular documentos relacionados entre sí

**Ramificaciones por estado:**
- ├── **Documento Completed:** Puede crear y eliminar asociaciones
- ├── **Documento en firma (PendingSignatures):** Asociaciones de solo lectura
- └── **Minuta (Draft/Published):** No tiene opción de asociaciones

---

### docs-form-interactions: Interacciones en formularios de documentos
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Campos, botones, validación y tipos de campo en formularios de documentos

---

### docs-form-field-types: Document form field types
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Rendering 6 field types (input, textarea, number, date, email, select), currency prefix, generate button state, cancel navigation, select options

---

### docs-filters: Filtros y búsqueda en documentos
- **Módulo:** documents | **Prioridad:** P2 | **Ruta:** `/dynamic_document_dashboard` | **E2E:** ✅
- **Descripción:** Filtros avanzados, búsqueda por texto, menús jerárquicos de documentos

---

### docs-summary: Resumen de documento
- **Módulo:** documents | **Prioridad:** P3 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Modal de resumen con campos clave del documento (alias de docs-key-fields)

---

### docs-list-table: Tabla de documentos
- **Módulo:** documents | **Prioridad:** P3 | **Ruta:** `/dynamic_document_dashboard` | **E2E:** ✅
- **Descripción:** Ordenamiento, export, interacciones de tabla en la lista de documentos

---

### docs-empty-states: Estados vacíos
- **Módulo:** documents | **Prioridad:** P4 | **Ruta:** `/dynamic_document_dashboard` | **E2E:** ✅
- **Descripción:** UI cuando no hay documentos, carpetas, tags u otros elementos

---

### docs-multiple: Renderizado múltiple
- **Módulo:** documents | **Prioridad:** P4 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Renderizado correcto con múltiples documentos simultáneos

---

### docs-profile-navigation: Navegación documentos-perfil
- **Módulo:** documents | **Prioridad:** P4 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Navegación entre documentos y perfil de usuario

---

### sign-pending-documents: Documentos pendientes de firma
- **Módulo:** signatures | **Prioridad:** P2 | **Ruta:** `/dynamic_document_dashboard` (tab Por Firmar) | **E2E:** ✅
- **Descripción:** Lista de documentos esperando firma del usuario

---

### sign-signed-documents: Documentos firmados
- **Módulo:** signatures | **Prioridad:** P2 | **Ruta:** `/dynamic_document_dashboard` (tab Firmados) | **E2E:** ✅
- **Descripción:** Lista de documentos completamente firmados

---

### sign-archived-documents: Documentos archivados (firma)
- **Módulo:** signatures | **Prioridad:** P3 | **Ruta:** `/dynamic_document_dashboard` (tab Archivados) | **E2E:** ✅
- **Descripción:** Documentos rechazados y expirados

---

### sign-status-modal: Modal de estado de firmantes
- **Módulo:** signatures | **Prioridad:** P2 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Modal con estado de cada firmante (Pendiente, Firmado, Rechazado)

---

### legal-management-lawyer: Gestión de solicitudes (Lawyer)
- **Módulo:** legal-requests | **Prioridad:** P1 | **Ruta:** `/legal_requests` | **E2E:** ✅
- **Descripción:** Ver y gestionar todas las solicitudes

**Acciones:**
- Filtrar por estado (Pendiente, En Revisión, Respondida, Cerrada) y rango de fechas
- Cambiar estado de solicitud
- Responder con mensajes (thread)
- Eliminar solicitudes
- Descargar archivos adjuntos

---

### legal-response-thread: Thread de conversación
- **Módulo:** legal-requests | **Prioridad:** P1 | **Ruta:** `/legal_request_detail/:id` | **E2E:** ✅
- **Descripción:** Mensajería bidireccional cliente-abogado

---

### legal-add-files: Agregar archivos a solicitud
- **Módulo:** legal-requests | **Prioridad:** P2 | **Ruta:** N/A (modal) | **E2E:** ✅
- **Descripción:** Modal para subir archivos adicionales a una solicitud existente

---

### legal-status-update: Actualizar estado de solicitud
- **Módulo:** legal-requests | **Prioridad:** P2 | **Ruta:** `/legal_request_detail/:id` | **E2E:** ✅
- **Descripción:** Cambiar estado y eliminar solicitudes (Lawyer)

---

### legal-lawyer-modals: Modales de gestión de solicitudes
- **Módulo:** legal-requests | **Prioridad:** P3 | **Ruta:** N/A (modales) | **E2E:** ✅
- **Descripción:** StatusUpdateModal y DeleteConfirmModal para gestión de solicitudes

---

## Flujos — Client

> El Client hereda los flujos compartidos y tiene acceso a los siguientes flujos específicos.

### dashboard (Client): Panel principal
- **Módulo:** dashboard | **Prioridad:** P2 | **Ruta:** `/dashboard` | **E2E:** ✅

**Diferencias con Lawyer:**
- Botones de acción rápida: Mis Procesos, Agendar Cita, Nueva Solicitud
- Sin botón "Radicar Proceso" ni "Radicar Informe"

---

### process-list-view (Client): Ver procesos
- **Módulo:** processes | **Prioridad:** P1 | **Ruta:** `/process_list` | **E2E:** ✅

**Tabs para Client:**
- ├── **Mis Procesos:** Solo procesos propios
- └── **Procesos Archivados:** Casos finalizados propios

**No tiene** tab "Todos los Procesos".

---

### process-detail (Client): Detalle con solicitar información
- **Módulo:** processes | **Prioridad:** P1 | **Ruta:** `/process_detail/:process_id` | **E2E:** ✅
- **Descripción:** Misma vista que Lawyer + botón "Solicitar Información"

**Ramificación exclusiva Client:**
- └── **Solicitar Información:** Botón en detalle → formulario pre-llenado → envía al abogado responsable

---

### docs-dashboard-client: Dashboard de documentos (Client)
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** `/dynamic_document_dashboard` | **E2E:** ✅

**Tabs para Client:**
1. **Minutas** — Plantillas disponibles para usar
2. **Mis Documentos** — Documentos asignados y completados
3. **Carpetas** — Documentos organizados por carpetas
4. **Dcs. Por Firmar** — Pendientes de firma
5. **Dcs. Firmados** — Archivo final

---

### docs-use-template (Client): Completar documento
- **Módulo:** documents | **Prioridad:** P1 | **Ruta:** `/dynamic_document_dashboard/document/use/:mode/:id/:title` | **E2E:** ✅
- **Descripción:** Seleccionar plantilla publicada y llenar campos variables

**Pasos:**
1. En tab "Minutas", click "Usar" en plantilla publicada
2. Formulario con campos variables (6 tipos de campo — ver docs-variables-config)
3. **Guardar progreso** (queda como borrador) o **Generar** (completa el documento)

**Ramificaciones — Acción final:**
- ├── **Guardar progreso:** Estado Progress, puede continuar después
- └── **Generar/Completar:** Estado Completed, abogado puede revisar

---

### sign-client-flow: Firmar documento (Client)
- **Módulo:** signatures | **Prioridad:** P1 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Cliente firma o rechaza documento pendiente

**Ramificaciones:**
- ├── **Firmar:** Aplica firma electrónica (dibujar o imagen guardada)
- └── **Rechazar:** Modal con motivo → documento pasa a Rejected

---

### legal-create-request: Crear solicitud legal
- **Módulo:** legal-requests | **Prioridad:** P1 | **Ruta:** `/legal_request_create` | **E2E:** ✅
- **Descripción:** Enviar nueva consulta legal

**Pasos:**
1. Navega a "Solicitudes" → "Nueva Solicitud"
2. **Tipo de solicitud** (Combobox): Consulta, Asesoría, Revisión, Representación, etc.
3. **Disciplina legal** (Combobox): Civil, Penal, Laboral, Familia, Administrativo, etc.
4. Descripción detallada (mínimo 50 caracteres)
5. Anexos opcionales (upload múltiple: PDF, DOCX, JPG, PNG — max 30MB)
6. Click "Enviar" → número auto-generado SOL-YYYY-NNN

**Ramificaciones — Tipo de solicitud:**
- ├── **Consulta:** Consulta general
- ├── **Asesoría:** Asesoría especializada
- ├── **Revisión:** Revisión de documentos
- └── **Representación:** Representación legal

**Ramificaciones — Disciplina legal:**
- ├── **Civil**
- ├── **Penal**
- ├── **Laboral**
- ├── **Familia**
- └── **Administrativo** (y otros)

**Ramificaciones — Anexos:**
- ├── **Sin anexos:** Formulario se envía solo con descripción
- ├── **Con archivos:** Drag & drop o selección manual, múltiples archivos
- └── **Agregar más archivos:** Botón "Agregar más" después de subir primeros

---

### legal-list-client: Ver mis solicitudes
- **Módulo:** legal-requests | **Prioridad:** P1 | **Ruta:** `/legal_requests` | **E2E:** ✅

---

### legal-detail-client: Detalle de solicitud
- **Módulo:** legal-requests | **Prioridad:** P1 | **Ruta:** `/legal_request_detail/:id` | **E2E:** ✅
- **Descripción:** Info + thread de conversación + agregar archivos

---

### org-client-view: Ver organizaciones (Client)
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Ver organizaciones donde es miembro (lectura)

**Contenido:**
- Lista de organizaciones
- Posts de la organización
- Otros miembros
- Solicitudes corporativas

---

### org-client-invitations: Gestionar invitaciones
- **Módulo:** organizations | **Prioridad:** P1 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Aceptar, rechazar o ver invitaciones expiradas

**Ramificaciones:**
- ├── **Aceptar:** Se une a la organización → gana acceso a posts, miembros, solicitudes
- ├── **Rechazar:** No se une → invitación desaparece
- └── **Expirada:** No puede actuar → mensaje informativo

---

### org-client-requests: Solicitudes dentro de organización
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Crear solicitud corporativa y ver respuestas

---

### org-client-leave: Salir de organización
- **Módulo:** organizations | **Prioridad:** P3 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Confirmación + pierde acceso a la organización

---

### schedule-appointment: Agendar cita
- **Módulo:** schedule | **Prioridad:** P2 | **Ruta:** `/schedule_appointment` | **E2E:** ✅
- **Descripción:** Agendar cita con abogado vía Calendly

**Ramificaciones — Tipo de cita:**
- ├── **Consulta inicial**
- ├── **Asesoría**
- ├── **Seguimiento**
- └── **Revisión**

---

## Flujos — Corporate Client

> Hereda **todos** los flujos de Client, más los siguientes exclusivos.

### org-create: Crear organización
- **Módulo:** organizations | **Prioridad:** P1 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Crear nueva organización empresarial

**Pasos:**
1. Click "Nueva Organización"
2. Formulario: nombre + descripción
3. Subir imagen de perfil + imagen de portada
4. Click "Crear"

---

### org-edit: Editar organización
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Actualizar información y portada

---

### org-invite-members: Invitar miembros
- **Módulo:** organizations | **Prioridad:** P1 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Enviar invitaciones por email

**Ramificaciones:**
- ├── **Email válido (usuario existe):** Invitación enviada → estado Pendiente
- ├── **Email válido (usuario no existe):** Invitación enviada → puede registrarse
- ├── **Email ya es miembro:** Mensaje de error
- └── **Email inválido:** Validación de formulario falla

**Estados de invitación:**
- ├── **Pendiente:** Esperando respuesta
- ├── **Aceptada:** Usuario se unió
- ├── **Rechazada:** Usuario declinó
- └── **Expirada:** Tiempo límite excedido

---

### org-members-list: Ver y gestionar miembros
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Lista de miembros con acción de remover

---

### org-posts-management: Gestionar publicaciones
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** CRUD completo de publicaciones internas

**Ramificaciones — Crear publicación:**
- ├── **Visible para clientes:** Sí → clientes miembros la ven
- └── **Visible para clientes:** No → solo corporate ve la publicación

**Ramificaciones — Acciones sobre publicación:**
- ├── **Fijar (pin):** Sube al tope de la lista
- ├── **Desfijar (unpin):** Vuelve a orden cronológico
- ├── **Editar:** Modificar título, contenido, visibilidad
- ├── **Cambiar estado:** Activar/desactivar publicación
- └── **Eliminar:** Confirmación + eliminación

---

### org-posts-visibility: Visibilidad de publicaciones
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Control de qué ven los clientes miembros

---

### org-corporate-requests: Solicitudes recibidas
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Ver y responder solicitudes de miembros

**Ramificaciones:**
- ├── **Responder:** Mensaje en thread visible para el solicitante
- ├── **Nota interna:** Mensaje visible solo para corporate (oculto al cliente)
- └── **Cambiar estado:** Pendiente → En Revisión → Respondida → Cerrada

---

### org-request-detail: Detalle de solicitud corporativa
- **Módulo:** organizations | **Prioridad:** P3 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Vista detallada de una solicitud corporativa con thread y archivos

---

### org-cross-invite-flow: Flujo cross-role de invitación
- **Módulo:** organizations | **Prioridad:** P1 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Corporate invita → Client acepta/rechaza → stats se actualizan

---

### org-cross-request-flow: Flujo cross-role de solicitudes
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Client crea solicitud → Corporate responde → Client ve respuesta

---

### org-cross-member-management: Gestión cross-role de miembros
- **Módulo:** organizations | **Prioridad:** P2 | **Ruta:** N/A | **E2E:** ✅
- **Descripción:** Remover miembro, desactivar org → client pierde acceso

---

### org-store-actions: Organization store actions
- **Módulo:** organizations | **Prioridad:** P3 | **Ruta:** `/organizations_dashboard` | **E2E:** ✅
- **Descripción:** Corporate client loads organizations dashboard and triggers store actions (load, invite)

---

## Flujos — Basic

> Hereda flujos compartidos con **restricciones específicas**.

### basic-restrictions: Restricciones de usuario básico
- **Módulo:** auth | **Prioridad:** P3 | **Ruta:** N/A | **E2E:** ⚠️
- **Descripción:** Funcionalidades limitadas con botones deshabilitados

**Restricciones:**
- ❌ **Firma electrónica:** No disponible, botón deshabilitado con tooltip
- ❌ **Membrete global:** No disponible
- ❌ **Solicitar información de proceso:** No disponible
- ✅ **Usar documentos:** Puede completar formularios (sin firma)
- ✅ **Crear solicitudes:** Igual que Client
- ✅ **Agendar cita:** Igual que Client
- ✅ **Organizaciones:** Vista lectura igual que Client

---

## Flujos — Lawyer G&M (is_gym_lawyer)

> Hereda **todos** los flujos de Lawyer, más los siguientes exclusivos.

### intranet-main: Intranet G&M — página principal
- **Módulo:** intranet | **Prioridad:** P2 | **Ruta:** `/intranet_g_y_m` | **E2E:** ✅
- **Descripción:** Portal interno exclusivo para abogados G&M

**Secciones:**
- Perfil de la firma (banner, logo, stats)
- Botón "Radicar Informe"
- Procedimientos G&M (búsqueda)
- Organigrama (modal con imagen)

---

### intranet-facturation-form: Facturation form field interactions
- **Módulo:** intranet | **Prioridad:** P2 | **Ruta:** `/intranet_g_y_m` (modal) | **E2E:** ✅
- **Descripción:** Save button validation, file upload (input + drag-and-drop), successful submission, close modal

---

### intranet-interactions: Interacciones en Intranet
- **Módulo:** intranet | **Prioridad:** P3 | **Ruta:** `/intranet_g_y_m` | **E2E:** ✅

#### Radicar informe
**Pasos:**
1. Click "Radicar Informe"
2. Formulario:
   - No. Contrato
   - Fecha inicial del período
   - Fecha final del período
   - Concepto de pago
   - Valor a cobrar

**Ramificaciones — Anexos (3 tipos):**
- ├── **Informe de Actividades:** PDF obligatorio
- ├── **Cuenta de Cobro/Factura:** PDF obligatorio
- └── **Anexos adicionales:** Múltiples archivos opcionales

3. Observaciones (texto libre)
4. Click "Enviar"

#### Buscar procedimientos
- Búsqueda en tiempo real con highlight amarillo de coincidencias
- Click en documento → descarga directa (blob, sin pantalla en blanco)

#### Ver organigrama
- Modal con imagen de jerarquía de la firma

---

### Form-Level Test Coverage (Unit + E2E)

The following forms and modals have dedicated unit and/or E2E tests covering field rendering, validation, submission, file uploads, and edge cases.

#### Intranet Module

| Component | Unit Tests | E2E Tests | Scenarios Covered |
|-----------|-----------|-----------|-------------------|
| `FacturationForm.vue` | 14 | 4 | Field rendering, save button validation, submit success/error/exception, file upload (input + drag-and-drop), unsupported file type, file size limit, file removal, close modal |

#### Dynamic Documents Module

| Component | Unit Tests | E2E Tests | Scenarios Covered |
|-----------|-----------|-----------|-------------------|
| `DocumentForm.vue` | 13 | 4 | 6 field types (input, textarea, number, date, email, select), currency prefix, tooltip, validation errors, generate button state, save progress, cancel navigation, loading state, editor mode |
| `DocumentVariablesConfig.vue` | 16 | 2 | Variable sections, name_es input, field type selector, summary classification, currency selector (conditional), select options input, draft/publish buttons, validation (empty name, missing options), draft skips validation, auto-adjust field type, duplicate classification reset |
| `EditDocumentModal.vue` | 14 | — | Name input, save button validation, close/overlay dismiss, edit vs create mode, update name (success/error), submit navigation (lawyer/client), showEditorButton toggle |
| `SendDocumentModal.vue` | 13 | — | Email input, send button validation (empty/invalid/valid), close/overlay dismiss, file upload (input + drag-and-drop), unsupported file type, file size limit, submit with sendEmail, file removal |
| `UseDocumentByClient.vue` | 13 | — | Name input, continue button validation, close dismiss, creator/editor route navigation, update name (success/error), edit mode UI, error when no document |
| `SendDocument.vue` (layout) | 9 | — | Email input, send button states, close emits closeEmailModal, file upload, unsupported type, submit with sendEmail, drag-and-drop |
| `CreateEditFolderModal.vue` | 15 | 2 | Folder name input, color selection, create/edit mode titles, submit button state, cancel/overlay close, create/update store calls, pre-fill in edit mode, form reset on visibility change |
| `SearchBarAndFilterBy.vue` | 8 | — | Search input rendering, icon, emit on input, empty initial state, default/auxiliary slots, multiple inputs, clear emits empty |

---

## Resumen de Cobertura E2E

| Módulo | Flujos totales | ✅ Cubierto | ⚠️ Parcial | ❌ Sin cobertura |
|--------|---------------|------------|-----------|------------------|
| Auth | 11 | 11 | 0 | 0 |
| Subscriptions | 6 | 6 | 0 | 0 |
| Profile | 2 | 2 | 0 | 0 |
| Dashboard | 8 | 8 | 0 | 0 |
| Directory | 1 | 1 | 0 | 0 |
| Processes | 8 | 8 | 0 | 0 |
| Documents | 33 | 33 | 0 | 0 |
| Signatures | 11 | 11 | 0 | 0 |
| Legal Requests | 10 | 10 | 0 | 0 |
| Organizations | 15 | 15 | 0 | 0 |
| Schedule | 1 | 1 | 0 | 0 |
| Intranet | 4 | 4 | 0 | 0 |
| Basic | 1 | 0 | 1 | 0 |
| Misc | 4 | 4 | 0 | 0 |
| User Guide | 1 | 1 | 0 | 0 |
| **Total** | **116** | **115** | **1** | **0** |

> **Nota:** El flujo `basic-restrictions` tiene cobertura parcial — las pruebas E2E aún no cubren escenarios con rol basic.

---

**Documento generado:** March 18, 2026  
**Versión:** 1.2.0  
**Estado:** ✅ Completo
