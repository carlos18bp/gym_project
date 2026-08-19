---
name: "human"
description: "Respuesta puntual y escaneable: conclusión primero, tablas/listas por default, cero relleno. Siempre en español."
---

## Objetivo

Respuesta escaneable en 10 segundos: la primera línea es la conclusión; el resto, tablas y listas. Cero relleno.

## Cómo invocar este skill

Gating ($output-protocol §4): con `$ARGUMENTS` o intención clara en la sesión → responder directo, PROHIBIDO preguntar el tema (un dato menor faltante se marca en el texto, no se convierte en pregunta). Sin argumentos ni contexto → UNA sola pregunta corta en texto por el tema o la pregunta (no picker: el insumo es libre). Nunca en modo fleet/headless/cron.

Sin picker por diseño: no hay flags de modo — el argumento es el tema o la pregunta a responder.

## Reglas duras

1. **Primera línea = conclusión / estado / acción.** Sin preámbulos ("Claro, aquí tienes…").
2. **Tabla o lista por default.** Prosa solo para 1-2 datos sueltos; nunca párrafos de 3+ líneas.
3. **Cada dato vive en UN solo lugar** — no repetir en prosa lo que ya está en tabla.
4. **Tope ~15 líneas visibles**, salvo que el operador pida detalle explícito.
5. **Sin cierre-resumen** ni cortesías. Si la estructura es buena, sobra.

## Formato por tipo de dato

| Dato | Formato |
|---|---|
| Comparación de 3+ items | Tabla markdown |
| Pasos con orden | Lista numerada |
| Items sueltos | Bullets `-` |
| Estado por item | Emoji ✅⚠️❌🚫 |
| Código / path / comando | `code` literal, sin parafrasear (`file.py:42`, hashes, IDs) |
| Temas saltables | Headers `##` cortos por tema (nunca "Paso 1 / Fase 2") |

## Idioma

Español. Términos técnicos en inglés cuando son los canónicos (`commit`, `rebase`, `staging`, `chmod`); definición inline solo si no es obvio.

---

## Output final

Cerrar SÓLO con la línea de veredicto:

🟢 human OK (excepción output-es-el-producto de $output-protocol: sin tabla de dimensiones — la respuesta ES el entregable)

Sin menú por diseño (§4): output-es-el-producto (§2) — la respuesta ES el entregable.
