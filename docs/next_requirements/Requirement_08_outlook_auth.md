# Requirement Document / Documento de Requerimiento

---

## 8. Integración de Autenticación con Outlook (Microsoft)

---

### Descripción

Actualmente, la plataforma ofrece únicamente la opción de iniciar sesión con Google como método de autenticación social. Los usuarios que prefieren utilizar sus cuentas de Microsoft (Outlook, Hotmail, Live) deben crear una cuenta tradicional con correo y contraseña, lo que añade fricción al proceso de registro e inicio de sesión.

Esta limitación excluye a un segmento importante de usuarios que utilizan servicios de Microsoft como su proveedor principal de correo electrónico, especialmente en entornos corporativos donde Microsoft 365 es la suite de productividad estándar.

La falta de esta opción puede resultar en abandono durante el proceso de registro o en la creación de cuentas duplicadas cuando los usuarios olvidan que ya se registraron con otro método.

---

### Propuesta de Mejora

Implementar la autenticación con Microsoft (Outlook) como método alternativo de inicio de sesión y registro, siguiendo el mismo patrón establecido con Google:

#### Botón de Autenticación Microsoft
• **Nueva Opción de Login**: Agregar un botón "Continuar con Outlook" junto al botón existente de Google en todas las vistas de autenticación.

• **Diseño Consistente**: El botón tendrá el mismo peso visual que el de Google, con el logo oficial de Microsoft y texto en español.

• **Ubicación Estratégica**: El botón se ubicará debajo del botón de Google, manteniendo la jerarquía visual actual.

#### Flujo de Autenticación
• **Ventana Emergente de Microsoft**: Al hacer clic, se abre una ventana de autenticación de Microsoft donde el usuario ingresa sus credenciales.

• **Cuentas Soportadas**: Compatible con cuentas personales (Outlook.com, Hotmail, Live) y cuentas corporativas (Microsoft 365, Azure AD).

• **Obtención de Datos**: Se obtienen automáticamente el correo electrónico y nombre del usuario desde Microsoft.

#### Integración con Sistema Existente
• **Mismo Patrón de Backend**: El endpoint de Microsoft sigue la misma lógica que Google: crear usuario si no existe, o iniciar sesión si ya existe.

• **Generación de JWT**: Se generan los mismos tokens de acceso y refresco que con otros métodos de autenticación.

• **Sin Contraseña Requerida**: Los usuarios autenticados con Microsoft no necesitan establecer una contraseña en la plataforma.

#### Vistas Afectadas
• **Inicio de Sesión**: Vista principal de login.
• **Registro**: Vista de creación de cuenta nueva.
• **Suscripción - Inicio de Sesión**: Login durante flujo de compra de suscripción.
• **Suscripción - Registro**: Registro durante flujo de compra de suscripción.

---

### Beneficios Esperados

• **Mayor Cobertura de Usuarios**: Permite el acceso a usuarios que prefieren o solo tienen cuentas de Microsoft.

• **Reducción de Fricción**: Elimina la necesidad de crear y recordar contraseñas adicionales para usuarios de Microsoft.

• **Compatibilidad Corporativa**: Facilita el acceso a clientes corporativos que utilizan Microsoft 365 como su plataforma empresarial.

• **Experiencia Consistente**: El flujo de autenticación es idéntico al de Google, manteniendo una experiencia de usuario predecible.

• **Menos Abandono en Registro**: Al ofrecer más opciones de autenticación social, se reduce la probabilidad de que usuarios abandonen el proceso.

• **Credenciales Seguras**: Microsoft maneja la autenticación, eliminando el riesgo de contraseñas débiles o reutilizadas.

---

### Flujo de Operación

#### 1. Inicio de Sesión con Microsoft (Usuario Existente)
   ○ El usuario accede a la vista de inicio de sesión.
   ○ Ve dos opciones de autenticación social: Google y Outlook/Microsoft.
   ○ Hace clic en "Continuar con Outlook".
   ○ Se abre una ventana emergente de Microsoft solicitando credenciales.
   ○ El usuario ingresa su correo y contraseña de Microsoft (o usa autenticación biométrica si está configurada).
   ○ Microsoft valida las credenciales y retorna la información del usuario.
   ○ El sistema verifica que el correo existe en la base de datos.
   ○ Se generan tokens JWT y el usuario es redirigido al dashboard.

#### 2. Registro con Microsoft (Usuario Nuevo)
   ○ El usuario accede a la vista de registro.
   ○ Hace clic en "Continuar con Outlook".
   ○ Completa la autenticación en la ventana de Microsoft.
   ○ El sistema detecta que el correo no existe en la base de datos.
   ○ Se crea automáticamente una nueva cuenta con los datos obtenidos de Microsoft (nombre, correo).
   ○ Se generan tokens JWT y el usuario es redirigido al dashboard.
   ○ El usuario puede completar su perfil posteriormente si lo desea.

#### 3. Autenticación durante Compra de Suscripción
   ○ El usuario está en el flujo de compra de una suscripción.
   ○ Se le solicita iniciar sesión o registrarse.
   ○ Selecciona "Continuar con Outlook".
   ○ Completa la autenticación con Microsoft.
   ○ El sistema crea la cuenta (si es nuevo) o inicia sesión (si existe).
   ○ El usuario es redirigido al checkout para completar la compra.

#### 4. Manejo de Cuenta Existente con Diferente Proveedor
   ○ Un usuario intenta iniciar sesión con Microsoft usando un correo que ya existe pero fue registrado con Google.
   ○ El sistema permite el acceso (el correo es el identificador único, no el proveedor).
   ○ Nota: Este comportamiento replica la lógica actual de Google.

#### 5. Error de Autenticación
   ○ Si el usuario cancela la ventana de Microsoft o hay un error de conexión.
   ○ Se muestra una notificación indicando que la autenticación no fue completada.
   ○ El usuario puede intentar nuevamente o usar otro método de autenticación.

---

### Requisitos Previos (Configuración Azure)

Para implementar esta funcionalidad, se requiere configuración en el portal de Microsoft Azure:

| Paso | Descripción |
|------|-------------|
| 1 | Registrar aplicación en Microsoft Entra ID (Azure AD) |
| 2 | Configurar tipo de cuenta: "Cuentas en cualquier directorio organizacional y cuentas personales de Microsoft" |
| 3 | Agregar URI de redirección tipo SPA para desarrollo y producción |
| 4 | Obtener el Application (Client) ID |
| 5 | Habilitar tokens de ID en configuración de autenticación |

---

### Validaciones y Reglas de Negocio

• **Correo como Identificador**: El correo electrónico es el identificador único del usuario, independientemente del proveedor de autenticación usado.

• **Normalización de Correo**: El correo se normaliza (minúsculas, sin espacios) antes de buscar o crear el usuario.

• **Datos Mínimos Requeridos**: Se requiere al menos el correo electrónico del usuario; nombre es opcional pero preferido.

• **Sin Foto de Perfil Inicial**: La foto de perfil de Microsoft no se obtiene automáticamente en esta primera versión (requiere llamada adicional a Microsoft Graph API).

• **Sesión Única**: El inicio de sesión con Microsoft genera la misma sesión que cualquier otro método de autenticación.

---

### Consideraciones de Seguridad

• **Autenticación Delegada**: Microsoft maneja toda la validación de credenciales; la plataforma nunca ve la contraseña del usuario.

• **Ventana Emergente Segura**: La autenticación ocurre en el dominio de Microsoft, protegiendo las credenciales.

• **Patrón Existente**: Se sigue el mismo modelo de confianza establecido con Google (claims decodificados en cliente).

• **HTTPS Requerido**: Las URIs de redirección en producción deben usar HTTPS.

• **Tokens JWT Propios**: Después de la autenticación con Microsoft, se generan tokens JWT propios de la plataforma para las sesiones.

---

### Cambios Transversales en la Aplicación

La implementación de este requerimiento genera cambios que impactan otros módulos de la plataforma:

#### Frontend - Nueva Dependencia
• **@azure/msal-browser**: Librería oficial de Microsoft para autenticación en aplicaciones SPA.

#### Frontend - Nuevos Archivos
• **msal_config.js**: Configuración de MSAL con clientId, authority y redirectUri.
• **login_with_outlook.js**: Helper que maneja el flujo de autenticación y comunicación con backend.

#### Frontend - Vistas de Autenticación
• **SignIn.vue**: Agregar botón de Outlook.
• **SignOn.vue**: Agregar botón de Outlook.
• **SubscriptionSignIn.vue**: Agregar botón de Outlook con redirección a checkout.
• **SubscriptionSignUp.vue**: Agregar botón de Outlook con redirección a checkout.

#### Frontend - Router
• **index.js**: Agregar ruta de callback `/auth/outlook/callback`.

#### Backend - Vista de Autenticación
• **userAuth.py**: Nuevo endpoint `outlook_login` que replica la lógica de `google_login`.

#### Backend - URLs
• **urls.py**: Registrar nueva ruta `outlook_login/`.

#### Backend - Mensajes de Error
• **userAuth.py**: Actualizar mensaje de error para cuentas creadas con autenticación social, mencionando tanto Google como Outlook.

#### Manual de Usuario
• **Nueva Sección**: Documentar la opción de inicio de sesión con Microsoft/Outlook.
• **Capturas de Pantalla**: Mostrar el nuevo botón y el flujo de autenticación.

---

### Decisiones Pendientes

| Tema | Opciones | Recomendación |
|------|----------|---------------|
| Etiqueta del botón | "Continuar con Outlook" vs "Continuar con Microsoft" | "Continuar con Microsoft" (más inclusivo) |
| Foto de perfil | Implementar ahora vs diferir | Diferir (requiere API adicional de Microsoft Graph) |
| Verificación de token en backend | Implementar validación de firma vs confiar en claims | Mantener patrón actual (consistencia con Google) |

---

### Notas Importantes

• Este desarrollo debe realizarse tanto para la aplicación web como para la aplicación móvil, garantizando que los usuarios puedan autenticarse con Microsoft desde cualquier dispositivo.

• Se requiere acceso al portal de Microsoft Azure para crear el registro de aplicación antes de iniciar el desarrollo. El cliente debe proporcionar o crear las credenciales necesarias.

• La implementación sigue el mismo patrón de seguridad establecido con Google. Una mejora futura podría incluir validación de tokens en el backend para ambos proveedores.

• La foto de perfil de Microsoft no está incluida en esta versión inicial ya que requiere una llamada adicional a Microsoft Graph API con autenticación separada.

• **Importante**: La implementación de este requerimiento incluye la actualización del manual de usuario para documentar el nuevo método de autenticación.

---

## Análisis de Esfuerzo y Estimación de Precio

### Clasificación de Dificultad: **MEDIO**

| Indicador | Presente |
|-----------|----------|
| Nueva librería externa | ✅ |
| Nuevo endpoint backend | ✅ |
| Modificación de múltiples vistas | ✅ |
| Configuración externa requerida | ✅ |
| Patrón existente a seguir | ✅ |
| Nueva ruta de router | ✅ |