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

**Línea cálida tras 🟢 (obligatoria en caso verde):**

Cuando el veredicto es `🟢 <skill> OK` (todas las celdas ✅, sin warnings ni
errores), agregar inmediatamente debajo, una línea adicional:

```
✨ Todo en orden — no hay acciones pendientes.
```

Esta línea **reemplaza** la sección `## Next steps` en el caso verde (ver
regla en sección 3). Es la confirmación explícita de "todo pasó" — el
operador la lee y sabe que no hay tareas residuales sin tener que escanear la
tabla entera.

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

**Si la tabla supera 15 filas**, agregar un bloque `### Resumen ejecutivo`
seguido de `### Top 3 acciones prioritarias` ENTRE el veredicto y la tabla:

```markdown
### Resumen ejecutivo
- Conteo: ✅ N · ⚠️ M · ❌ K · ⏭️ J  (total: T filas)

### Top 3 acciones prioritarias
1. `<comando exacto>` — qué hace
2. ...
3. ...
```

El conteo permite captar de un vistazo qué tan lejos está el reporte del
verde. El Top 3 lista los items críticos con su comando exacto. El operador
lee Resumen → Top 3 → tabla detallada, en ese orden de prioridad.

### 3. Pendientes / next steps (condicional)

Regla **condicional** según el estado de la tabla:

- Si la tabla tiene **≥1 celda en ⚠️ / ❌ / ⏸️**, la sección `## Next steps`
  es **obligatoria**, con al menos un bullet por cada celda no-✅ (comando
  exacto, instrucción manual, o referencia al actor que la ejecuta).
- Si **todas las celdas son ✅** (caso 🟢), **omitir** `## Next steps` y usar
  la línea cálida `✨ Todo en orden — no hay acciones pendientes.` (definida
  en la sección 1).
- Si todas las celdas son ⏭️ / ℹ️ / 🚫 (skip o refused sin error), agregar
  `## Next steps` solo si hay seguimiento accionable; si no, omitirla.

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

## Ejemplos

### Ejemplo A — caso verde (todo OK)

```markdown
🟢 git-status-report OK
✨ Todo en orden — no hay acciones pendientes.

| Proyecto | Estado | Detalle |
|---|---|---|
| mimittos_project | ✅ | clean, en sync con origin/master |
| kore_project | ✅ | clean, en sync con origin/master |
| projectapp | ✅ | clean, en sync con origin/master |
```

(Sin `## Next steps` — la línea cálida la reemplaza.)

### Ejemplo B — caso con warnings (operacional, requiere acción)

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

### Ejemplo C — caso con tabla grande (>15 filas)

```markdown
🟡 full-audit OK con 4 warning(s)

### Resumen ejecutivo
- Conteo: ✅ 14 · ⚠️ 4 · ❌ 0 · ⏭️ 2  (total: 20 filas)

### Top 3 acciones prioritarias
1. `bash scripts/maintenance/sync-credentials.sh deploy --apply --env=staging` — sync .env mimittos
2. `sudo systemctl restart fernando-aragon-huey` — huey en failed state
3. (manual, operador) renovar SSL kore.cloud — vence en 12 días

| Dimensión | Estado | Detalle |
|---|---|---|
| ... | | (tabla completa de 20 filas) |

## Next steps
- (lista completa de las 4 acciones por warning)
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
