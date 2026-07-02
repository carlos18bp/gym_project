---
name: human
description: "Respuesta puntual y escaneable: conclusión primero, tablas/listas por default, cero relleno. Siempre en español."
argument-hint: "[topic or question]"
---

## Objetivo

Respuesta escaneable en 10 segundos: la primera línea es la conclusión; el resto, tablas y listas. Cero relleno.

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

## Input

$ARGUMENTS
