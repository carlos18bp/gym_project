# Iniciar sesión con Microsoft (Outlook)

**Entrega:** Release Agosto 2026
**Requerimiento:** Integración de Autenticación con Outlook (Microsoft)

> **En una frase:** ahora, además de Google, los usuarios pueden iniciar sesión y registrarse con su cuenta de **Microsoft** (Outlook, Hotmail, Live o Microsoft 365) con un solo clic, sin crear ni recordar otra contraseña.

Este documento tiene **dos partes**:

- **Parte A — Guía de usuario:** cómo se usa el nuevo botón.
- **Parte B — Configuración previa (Azure):** el paso a paso para obtener el identificador de aplicación de Microsoft (`Client ID`) y coordinarlo con G&M. **El botón no funcionará hasta completar la Parte B.**

---

## Parte A — Guía de usuario

### 1. ¿Qué es y para qué sirve?

Se agregó un nuevo botón **"Continuar con Microsoft"**, ubicado **debajo** del botón de Google, en todas las pantallas de acceso. Permite:

- **Entrar o registrarse** usando una cuenta de Microsoft personal (Outlook.com, Hotmail, Live) o corporativa (Microsoft 365 / Azure AD).
- **Sin contraseña adicional:** Microsoft valida la identidad; la plataforma nunca ve tu contraseña.
- **Una sola cuenta por correo:** si ya te habías registrado con Google usando ese mismo correo, puedes entrar con Microsoft y llegas a la misma cuenta.

El botón aparece en cuatro lugares: **Iniciar sesión**, **Crear cuenta**, y en las pantallas de **inicio de sesión y registro durante la compra de una suscripción**.

### 2. Antes de empezar

- Sirve para **cualquier rol** (abogado, cliente, cliente corporativo o básico).
- Necesitas una cuenta de Microsoft (personal o corporativa).
- **Importante:** la configuración de Azure (Parte B) debe estar lista. Si aún no se ha configurado, el botón abrirá la ventana de Microsoft pero el acceso no se completará.

### 3. Paso a paso para probarlo

**3a. Iniciar sesión con Microsoft (usuario existente)**

1. Ve a la pantalla de **Iniciar sesión**.
2. Verás dos opciones sociales: **Google** y **Microsoft**.
3. Haz clic en **"Continuar con Microsoft"**.
4. Se abre una **ventana emergente de Microsoft**; ingresa tu correo y contraseña de Microsoft (o usa tu método habitual, como huella o PIN).
5. Autoriza el acceso si Microsoft lo solicita.
6. Serás **redirigido automáticamente al Dashboard**.

**3b. Registrarse con Microsoft (usuario nuevo)**

1. Ve a la pantalla de **Crear cuenta**.
2. Haz clic en **"Continuar con Microsoft"** y completa la ventana de Microsoft.
3. El sistema detecta que es tu primera vez y **crea tu cuenta automáticamente** con tu nombre y correo.
4. Entras directo al Dashboard. Puedes completar tu perfil después si lo deseas.

**3c. Durante la compra de una suscripción**

1. En el flujo de compra, cuando se te pida iniciar sesión o registrarte, elige **"Continuar con Microsoft"**.
2. Completa la autenticación; el sistema te lleva al **checkout** para terminar la compra.

**3d. Si cancelas o hay un error**

1. Si cierras la ventana de Microsoft sin terminar, verás el aviso **"Autenticación con Microsoft cancelada"** y permaneces en la misma pantalla.
2. Si ocurre otro error, verás un mensaje indicando que el inicio de sesión no se completó. Puedes intentar de nuevo o usar otro método.

### 4. Cómo sabes que funcionó

- **Acceso correcto:** tras autenticarte en la ventana de Microsoft, llegas al **Dashboard**.
- **Registro automático:** si era tu primera vez, tu cuenta queda creada con tu nombre y correo de Microsoft.
- **Mismo correo, distinto proveedor:** si ese correo ya existía (por ejemplo, registrado antes con Google), entras a la misma cuenta sin duplicarla.
- **Cancelación:** si cierras la ventana, ves "Autenticación con Microsoft cancelada" y sigues en la pantalla de acceso.

---

## Parte B — Configuración previa (Azure) y coordinación con G&M

> Esta parte es para **el administrador / el equipo técnico** y la **coordinación con G&M**. El resultado final es un dato llamado **"Application (Client) ID"** que G&M debe entregarnos para activar el botón.

### B0. ¿Qué cuenta de Microsoft usar?

Para registrar la aplicación se necesita **una** cuenta de Microsoft. Hay dos caminos válidos — elige uno con G&M:

- **Opción 1 — Microsoft 365 corporativo de G&M (recomendada):** si G&M ya tiene Microsoft 365 / correo corporativo de Microsoft, conviene usar una cuenta de **administrador** de ese entorno. Es lo más ordenado y seguro (permite la verificación de correo descrita en el paso B5).
- **Opción 2 — Cuenta Microsoft gratuita nueva:** si G&M no usa Microsoft 365, se puede crear una **cuenta gratuita** de Microsoft solo para registrar la aplicación. Crea la cuenta en **https://signup.live.com** y continúa con los mismos pasos.

> A partir de aquí, **los pasos son iguales para ambas opciones**.

### B1. Entrar al portal de Microsoft Entra (Azure)

1. Abre **https://entra.microsoft.com** e inicia sesión con la cuenta elegida en B0.
2. En el menú, entra a **Identidad → Aplicaciones → Registros de aplicaciones** (en inglés: *Identity → Applications → App registrations*).

### B2. Registrar la aplicación

1. Haz clic en **"Nuevo registro"** (*New registration*).
2. **Nombre:** algo identificable, por ejemplo `GM Consultores - Login web`.
3. **Tipos de cuenta admitidos:** selecciona **"Cuentas en cualquier directorio organizativo y cuentas personales de Microsoft"** (*Accounts in any organizational directory and personal Microsoft accounts*). Esto permite tanto cuentas corporativas como personales.
4. Por ahora **no** completes el campo "URI de redirección" (lo haremos en B3).
5. Haz clic en **"Registrar"**.

### B3. Configurar la plataforma y las URLs de redirección

1. En la aplicación recién creada, ve a **Autenticación** (*Authentication*).
2. Haz clic en **"Agregar una plataforma"** (*Add a platform*) y elige **"Aplicación de página única (SPA)"** (*Single-page application*).
3. Agrega las siguientes **URI de redirección** (todas las que apliquen):
   - **Producción:** `https://www.gmconsultoresjuridicos.com/auth/outlook/callback` y `https://gmconsultoresjuridicos.com/auth/outlook/callback`
   - **Staging (pruebas):** `https://gmconsultoresjuridicos.projectapp.co/auth/outlook/callback`
   - **Desarrollo local (opcional):** `http://localhost:5173/auth/outlook/callback`
4. Guarda los cambios.

> ⚠️ Las URLs deben coincidir **exactamente** (incluido `https://` y la ruta `/auth/outlook/callback`). En producción deben ser **HTTPS**.

### B4. Habilitar los tokens de ID

1. Dentro de **Autenticación**, busca la sección **"Concesión implícita y flujos híbridos"** (*Implicit grant and hybrid flows*).
2. Marca la casilla **"Tokens de ID"** (*ID tokens*).
3. Guarda.

### B5. (Seguridad) Habilitar el dato de "correo verificado"

Por seguridad agregamos una validación que **solo acepta correos verificados** (para evitar suplantación de cuentas). Para que las cuentas **corporativas** funcionen, hay que habilitar un dato adicional en el token:

1. Ve a **Configuración del token** (*Token configuration*).
2. Haz clic en **"Agregar notificación opcional"** (*Add optional claim*).
3. Elige el tipo **"ID"** y marca la notificación **`xms_edov`** (indica que el correo está verificado).
4. Guarda.

> **Alternativa:** si no es posible habilitar `xms_edov`, G&M puede entregarnos el **"Id. de directorio (inquilino)"** (*Directory / tenant ID*) de su organización para autorizarlo como confiable de nuestro lado. Las cuentas personales (Outlook.com/Hotmail/Live) **no** requieren este paso.

### B6. Obtener el "Application (Client) ID"

1. Ve a la pantalla **"Información general"** (*Overview*) de la aplicación.
2. Copia el valor **"Id. de aplicación (cliente)"** (*Application (client) ID*). Es un código con forma de `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
3. (Opcional) Copia también el **"Id. de directorio (inquilino)"** si elegiste la alternativa del paso B5.

> ℹ️ El **Client ID NO es una contraseña ni un secreto**: es un identificador público y es seguro compartirlo por correo. Es el **único dato indispensable** que G&M debe entregarnos.

### B7. Qué necesitamos que G&M nos entregue (checklist de coordinación)

- ✅ El **Application (Client) ID** (obligatorio).
- ✅ Confirmación de qué opción se usó (B0: corporativa o cuenta nueva).
- ✅ Si se eligió la alternativa de B5: el **Directory (tenant) ID**.
- ✅ Confirmación de que se registraron las **URLs de redirección** del paso B3.

### B8. Qué hacemos nosotros con ese dato (nota interna)

Una vez recibido el Client ID, nuestro equipo lo configura en el entorno:

- Backend: `MICROSOFT_CLIENT_ID` (y, si aplica, `MICROSOFT_TRUSTED_TENANTS` con el tenant ID).
- Frontend: `VITE_MICROSOFT_CLIENT_ID` y `VITE_APP_DOMAIN`.

No se requiere nada más de parte de G&M.

### B9. Cómo validar que la configuración quedó lista

1. Entra a la pantalla de **Iniciar sesión**.
2. Haz clic en **"Continuar con Microsoft"**.
3. Debe abrirse la ventana de Microsoft y, al autenticarte, llegar al **Dashboard**.
4. Si el correo de la cuenta no se puede verificar (configuración de Azure incompleta), el sistema lo **rechaza con un mensaje claro** en lugar de dejar entrar — eso es intencional, por seguridad.

---

> **Notas finales**
> - Esta versión inicial **no** trae la foto de perfil de Microsoft (requiere una integración adicional que queda para una mejora futura).
> - La función está disponible tanto en la versión web como en la app móvil (PWA).
> - El acceso con Google sigue funcionando igual; Microsoft es una opción adicional, no un reemplazo.
