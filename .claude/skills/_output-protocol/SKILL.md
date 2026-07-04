---
name: _output-protocol
description: "Contrato compartido del bloque final de respuesta de toda skill operacional del fleet. Importado por las skills bajo workflows/.claude/. No invocable directamente."
disable-model-invocation: true
---

# Output protocol — bloque final estándar

> Este archivo NO es una skill invocable. Es la fuente canónica del formato
> final con el que toda skill operacional del fleet cierra su ejecución. Las
> skills lo referencian con `[[_output-protocol]]` en su sección "Output final".

## Por qué existe

El operador corre la misma skill (`/init-fleet`, `/full-audit`, `/server-diagnostic`,
`/git-status-report`, etc.) en múltiples hosts a lo largo del día. Si cada
skill cierra de forma distinta, leer "qué OK / qué falta" tarda más y se
escapan signals. El protocolo unifica:

- **Veredicto** en una línea — captable en <1 segundo
- **Tabla** de dimensiones con emoji por estado — escaneable
- **Next steps** con comando exacto — copy-paste sin interpretación

## Estructura obligatoria

Toda skill cierra con estas tres secciones, en este orden:

### 1. Veredicto (una línea)

Un solo emoji + frase corta. Umbrales **derivados de la tabla** (sección 2):

| Veredicto | Cuándo (regla exacta) |
|---|---|
| `🟢 <skill> OK` | Todas las celdas de la tabla son ✅ (cero ⚠️, cero ❌) |
| `🟡 <skill> OK con N warning(s)` | ≥1 celda ⚠️, cero ❌ — completó, no bloquea |
| `🔴 <skill> — N error(es), revisar arriba` | ≥1 celda ❌ — algo falló inesperadamente |
| `⏸️ <skill> — pausa manual pendiente` | Flujo normal pero requiere operador (OAuth, admin console, otra dev) |
| `🚫 <skill> — REFUSED (<razón>)` | Safety gate intencional rechazó la operación (prod detectada, intent peligroso) — **no es error**, es decisión segura |
| `⏭️ <skill> — N/A o saltado` | No aplica al contexto (skip-flag pasado, ya en estado correcto) |

### 2. Tabla de dimensiones

```markdown
| Dimensión | Estado | Detalle |
|---|---|---|
| <fase / aspecto> | <emoji> | <una frase, ≤80 chars> |
```

Códigos de emoji (para celdas de la tabla):

| Emoji | Significado |
|---|---|
| ✅ | done — completado correctamente |
| ⚠️ | warning — completado con observaciones, no bloquea |
| ❌ | error — falló, requiere acción |
| ⏭️ | skipped — saltado por flag, no-aplica, o protegido |
| ℹ️ | info — informativo, sin estado binario |
| 🚫 | refused — bloqueado por safety gate (decisión segura, no fue error) |
| ⏸️ | paused — esperando intervención manual del operador (OAuth, admin console) |
| 🟢🟡🔴 | reservados para el VEREDICTO; **nunca** en celdas individuales |

Regla de longitud: **≤80 chars por celda** (no por tabla). Una tabla puede
tener N filas mientras cada celda cumpla la regla.

Si la skill corrió en múltiples hosts/proyectos, agregar columna `host` o
`proyecto` ANTES de `Dimensión`.

**Si la tabla supera 15 filas**, agregar sección `### Top 3 acciones prioritarias`
ENTRE el veredicto y la tabla — listando los 3 items más críticos con su
comando exacto. El operador lee el Top 3 primero; la tabla queda como detalle
profundizable.

### 3. Pendientes / next steps (omitir si no aplica)

```markdown
## Next steps
- `<comando exacto a copiar>` — qué hace
- (manual, operador) <instrucción concreta>
- (otro VPS / cron / otra dev) <instrucción + dónde se ejecuta>
```

Cada bullet debe ser **accionable sin interpretación**: comando exacto + dónde
correrlo + qué actor lo hace.

## Reglas

- **Idioma:** español. Términos técnicos en inglés cuando son canónicos
  (`commit`, `rebase`, `chmod`, `staging`, `lifecycle`).
- **Sin prosa redundante** después de la tabla. Nada de "En resumen, todo
  está OK excepto..." — la tabla ya lo dice.
- **Sin headers tipo "Phase 1", "Step 2"** en el reporte final — categorizar
  por **tema**, no por orden de ejecución.
- **Cada celda de estado** se navega en <1 segundo: un emoji + ≤80 chars de
  detalle. Si necesitas más texto, partir en filas.
- **Comandos exactos**, no parafraseados. `bash scripts/foo.sh --apply` sí;
  "correr el script de foo en modo apply" no.
- **No repetir info** que ya está en la tabla. Next steps son acciones, no
  resúmenes.

## Ejemplo (skill /init-fleet, modo apply, dev)

```markdown
🟡 init-fleet OK con 2 warning(s)

| Dimensión | Estado | Detalle |
|---|---|---|
| setup-dev-machine | ✅ | git alias, prompt, statusline OK |
| tailscale install/enable | ✅ | tailscaled enabled, versión 1.78.1 |
| tailscale auth | ⏸️ | requiere `sudo tailscale up --ssh` (browser OAuth) |
| add-self registry | ⏭️ | depende de auth previa |
| ssh-fleet backup | ⏭️ | flag --include-ssh no pasado |
| ssh-fleet-check | ⚠️ | 1 VPS no responde Tailscale (vps-gym) |

## Next steps
- `sudo tailscale up --ssh` — completar OAuth en browser de la dev
- `bash scripts/bootstrap/init-fleet.sh --apply` — re-correr tras auth
- (admin console) Disable key expiry para esta dev en https://login.tailscale.com/admin/machines
```

## Cómo referenciar este protocolo desde una skill

Al final de cada skill `.md`:

```markdown
## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill:

| Dimensión | Estado | Detalle |
|---|---|---|
| <fase específica> | ✅/⚠️/❌ | ... |
| ... | | |

## Next steps (si aplica)
- <comando exacto>
```

Skills que ya tienen tablas ricas (server-diagnostic, repo-cleanup,
fix-broken-tests) conservan su estructura — solo se aseguran de:
1. Usar el set canónico de emojis (✅⚠️❌⏭️ℹ️🚫⏸️ + 🟢🟡🔴 solo para veredicto).
2. Cerrar con veredicto en una línea.
3. Listar next steps con comando exacto.

## Skills alias

Una skill que es wrapper/alias de otra (ej. `debugme` → `debug`, `plan-task` →
`plan`) **NO duplica** la plantilla del Output final. Su sección final dice:

```markdown
## Output final

Reportar siguiendo [[_output-protocol]]. Misma plantilla que `/<skill-base>`.
```

Eso evita drift entre la skill base y el alias: si la base cambia su tabla,
el alias hereda el cambio automáticamente sin re-edición.
