# Reporte de cambios — Jornada de calidad y renovación del ambiente de pruebas (16 de julio de 2026)

> Esta entrega corresponde a una jornada interna de calidad sobre la plataforma, dentro de la preparación del release de agosto 2026. No introduce funcionalidades nuevas visibles: corrige una falla puntual del módulo SECOP, renueva por completo los datos de prueba del ambiente de revisión y amplía de forma significativa las verificaciones automáticas que protegen todo lo ya entregado. Todo se puede revisar en el ambiente de pruebas.

**Convenciones:**
- 🐞 = bug reportado
- 💡 = requerimiento / mejora de UX
- ❓ = duda del cliente que se aclara
- ✅ Atendido | ⏭️ Fuera de alcance | ⚠️ Parcial | 🔄 En curso

**Ambiente de pruebas:** `https://gmconsultoresjuridicos.projectapp.co`. Iniciá sesión en `https://gmconsultoresjuridicos.projectapp.co/sign_in` con una cuenta de abogado.

**Para todas las pruebas:** los datos del ambiente de pruebas fueron renovados en esta jornada (ver punto 2), así que vas a encontrar usuarios, procesos y documentos de ejemplo recién generados. Si tenías datos propios cargados en staging, fueron reemplazados por el juego de datos nuevo.

---

## Resumen rápido

| Clasificación | Cantidad |
|---|---:|
| ✅ Atendido | 3 |
| **Total puntos** | **3** |

| # | Punto | Estado |
|---|---|---|
| 1 | Error al renombrar una vista guardada en SECOP | ✅ Atendido |
| 2 | Renovación completa de los datos del ambiente de pruebas | ✅ Atendido |
| 3 | Ampliación de las verificaciones automáticas de calidad | ✅ Atendido |

---

## 1. ✅ Atendido — 🐞 Error al renombrar una vista guardada en SECOP

> **Observación:** detectado internamente durante la jornada de calidad — al renombrar una vista guardada de filtros SECOP usando un nombre que ya existía, la plataforma respondía con un error genérico en lugar de un mensaje claro.

**Qué se hizo:** **Antes:** si renombrabas una de tus vistas guardadas con el mismo nombre de otra vista tuya, aparecía un error del sistema sin explicación. **Ahora:** la plataforma lo detecta y muestra el mensaje "Ya existe una vista guardada con ese nombre", sin perder nada de lo que tenías.

**Dónde se ve / URL:** `https://gmconsultoresjuridicos.projectapp.co/secop` — módulo **SECOP** → panel de **Vistas guardadas**.

**Antes de probar necesitas:**
- Una cuenta de abogado.
- Dos vistas guardadas tuyas en SECOP (si no tenés, creá dos guardando filtros distintos con los nombres que quieras, por ejemplo "Vista A" y "Vista B").
- Empezar desde `https://gmconsultoresjuridicos.projectapp.co/secop`.

**Cómo validar que funciona:**
1. Abre `https://gmconsultoresjuridicos.projectapp.co/secop` (si no iniciaste sesión, primero te llevará al login).
2. En el panel de **Vistas guardadas**, usá la opción de **editar** (ícono de lápiz) sobre la vista "Vista B".
3. Cambiale el nombre a "Vista A" (el nombre de tu otra vista) y guardá.
4. Resultado esperado: aparece el mensaje **"Ya existe una vista guardada con ese nombre."** y la vista conserva su nombre original — ya no aparece ningún error del sistema.
5. Renombrala ahora a un nombre libre (por ejemplo "Vista C") y guardá: el cambio se aplica normalmente.

---

## 2. ✅ Atendido — 💡 Renovación completa de los datos del ambiente de pruebas

> **Observación:** el ambiente de pruebas venía acumulando datos de ejemplo desiguales entre módulos, lo que dificultaba revisar los flujos completos.

**Qué se hizo:** se borraron y volvieron a generar todos los datos de ejemplo del ambiente de pruebas, con un juego de datos coherente entre módulos: 34 usuarios de distintos roles, 86 procesos con sus estados y alertas, más de mil documentos jurídicos, 60 solicitudes legales, 30 procesos SECOP, 6 servicios con 24 solicitudes, 9 suscripciones y las notificaciones asociadas. Esto deja el ambiente listo para revisar cualquier módulo con datos realistas.

**Dónde se ve / URL:** `https://gmconsultoresjuridicos.projectapp.co/dashboard` — se nota en toda la plataforma.

**Antes de probar necesitas:**
- Una cuenta de abogado.
- Nada más: los datos ya están cargados.

**Cómo validar que funciona:**
1. Abre `https://gmconsultoresjuridicos.projectapp.co/dashboard`.
2. Recorré los módulos del menú lateral (**Procesos**, **Archivos Jurídicos**, **SECOP**, **Servicios**): cada uno muestra listados poblados con datos de ejemplo recientes.
3. Resultado esperado: ningún módulo aparece vacío ni con datos inconsistentes.

---

## 3. ✅ Atendido — 💡 Ampliación de las verificaciones automáticas de calidad

> **Observación:** como parte de la preparación del release de agosto, se reforzó la batería de pruebas automáticas que protege la plataforma contra regresiones (que algo que ya funcionaba se rompa con un cambio nuevo).

**Qué se hizo:** se agregaron más de 200 verificaciones automáticas nuevas que cubren casos límite y de error en firmas electrónicas, notificaciones, alertas de procesos, SECOP, servicios y exportación de documentos. Con esto, el **100% de los flujos de usuario de la plataforma (150 de 150)** queda cubierto por pruebas automáticas que se ejecutan antes de cada entrega, y la auditoría interna de calidad de pruebas alcanzó la calificación máxima en su modo más estricto. Además se corrigieron 4 verificaciones que fallaban solo en el ambiente real. Este trabajo no cambia lo que ves en pantalla: reduce el riesgo de que futuras entregas rompan algo existente.

**Dónde se ve / URL:** no aplica — es trabajo interno de calidad; su efecto es la estabilidad general de la plataforma.

**Antes de probar necesitas:** no aplica.

**Cómo validar que funciona:** no requiere validación del cliente. Queda registrado en el historial del proyecto (26 cambios publicados el 16/07/2026) y se reflejará en la estabilidad de las próximas entregas.

---

## Cierre

| Categoría | Total puntos | ✅ Atendidos | ⚠️ Parciales | ⏭️ Fuera de alcance |
|---|---|---|---|---|
| Correcciones (🐞) | 1 | 1 | 0 | 0 |
| Mejoras internas (💡) | 2 | 2 | 0 | 0 |
| **TOTAL** | **3** | **3** | **0** | **0** |

Quedamos atentos a cualquier duda o ajuste. El ambiente de pruebas queda con datos frescos, ideal para revisar los módulos del release de agosto (login con Microsoft y minutas compartidas, reportados el 23/06).
