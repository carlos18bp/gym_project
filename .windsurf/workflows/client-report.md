---
description: "Gestiona los reportes de cambios del proyecto para el cliente en docs/reports/. Default: crea reporte de la sesión actual; --list tabula existentes; --find busca por tema."
auto_execution_mode: 1
---

# Client Report — reportes de cambios para el cliente

Cada entrega al cliente se documenta con un **reporte de cambios**: un markdown
en español, **no técnico**, que cita textualmente lo que el cliente reportó,
explica qué se hizo y le da una guía paso a paso para validarlo él mismo. Esta
skill crea esos reportes con el formato estándar del fleet, y también los lista
y los busca.

**Convención de almacenamiento (fleet-wide):**
- Carpeta: `docs/reports/` — **versionada en git** (a diferencia de `docs/tmp/`,
  que es para borradores efímeros y está gitignorada).
- Nombre: `<Tema_En_Snake_Case>_DDMMYYYY.md` — la fecha SIEMPRE como **postfijo**
  y SIEMPRE obtenida de `date +%d%m%Y`, nunca asumida.
  Ej.: `Reporte_Respuestas_Reunion_22062026.md`.
- Un reporte por entrega/revisión. Si el mismo tema se re-entrega el mismo día,
  sufijo `_R2`, `_R3` antes de la fecha.

> **⚠️ How to invoke**:
> - `/client-report` → crea el reporte de lo hecho en **esta sesión**.
> - `/client-report enfócate solo en el módulo X y omite Y` → crear, con instrucciones libres.
> - `/client-report --list` → tabla concisa de los reportes existentes.
> - `/client-report --find notificaciones` → busca reportes donde se tocó ese tema.
>
> Claude Code substituye `$ARGUMENTS` con los flags/término pasados (vacío si se omiten).

---

## Phase 0 — Args & discovery

```bash
set -o pipefail
ARGS="$ARGUMENTS"
REPORTS_DIR="docs/reports"

MODE="create"
case "$ARGS" in
  --list*) MODE="list";;
  --find*) MODE="find";;
esac
FIND_TERM=$(printf '%s\n' "$ARGS" | sed -E 's/^--find[[:space:]]*//')
FREEFORM=$(printf '%s\n' "$ARGS" | sed -E 's/^--(list|find)[[:space:]]*.*$//')

# La fecha SIEMPRE del sistema — regla del fleet, nunca asumirla.
FECHA=$(date +%d%m%Y)
FECHA_LEGIBLE=$(LC_ALL=es_ES.UTF-8 date '+%d de %B de %Y' 2>/dev/null || date '+%d/%m/%Y')

# Guard: docs/reports debe estar versionado. Si algún proyecto lo ignora, avisar.
git check-ignore -q "$REPORTS_DIR" 2>/dev/null \
  && echo "⚠️  $REPORTS_DIR está gitignored en este proyecto — corregir .gitignore antes de crear el reporte."

echo "MODE=$MODE  FECHA=$FECHA  REPORTS_DIR=$REPORTS_DIR"
[ -d "$REPORTS_DIR" ] && ls -1 "$REPORTS_DIR"/*.md 2>/dev/null | head -30 || echo "(sin reportes aún)"
```

---

## Phase 1 — `--list` (solo MODE=list)

Extrae de cada reporte su título y los puntos atendidos, para que Claude los
tabule.

```bash
for f in "$REPORTS_DIR"/*.md; do
  [ -f "$f" ] || continue
  title=$(sed -n 's/^# //p' "$f" | head -1)
  echo "=== $f | $title"
  grep -E '^#{2,3} [0-9]' "$f" | sed -E 's/^#+[[:space:]]*/  - /'
done
```

Claude renderiza UNA tabla concisa:

| Reporte | Fecha | Qué se atendió |
|---|---|---|

- `Reporte`: nombre del archivo (con backticks).
- `Fecha`: derivada del postfijo `DDMMYYYY` del nombre (formato `DD/MM/YYYY`).
- `Qué se atendió`: resumen de los títulos de los puntos, **≤ 1 frase por
  reporte** (agrupa: "espaciado PDF, preview archivados, tabs dashboard…").

> No uses el veredicto 🟢/🟡/🔴 — en modo `--list` la tabla ES la salida.

---

## Phase 2 — `--find <descripción>` (solo MODE=find)

```bash
[ -z "$FIND_TERM" ] && { echo "❌ --find requiere una descripción. Ej: /client-report --find notificaciones"; exit 1; }
for f in "$REPORTS_DIR"/*.md; do
  [ -f "$f" ] || continue
  grep -qiF "$FIND_TERM" "$f" || continue
  echo "=== MATCH: $f"
  grep -inE '^#{2,3} ' "$f" | grep -iF "$FIND_TERM" || echo "  (match en el cuerpo, no en títulos de puntos)"
done
```

Claude reporta cada reporte que matchea con: archivo, fecha y **qué puntos**
tratan el tema (número + título + estado ✅/⏭️/⚠️). Si el término literal no
arroja resultados, reintenta el grep con raíces/sinónimos evidentes del término
(ej. "notificación" → "notificacion", "alerta") antes de declarar "sin
resultados".

---

## Phase 3 — Crear el reporte (MODE=create, default)

1. **Insumos.** La fuente primaria es el **contexto de la sesión actual** (lo que
   se implementó/arregló en esta conversación). Confirma contra el repo con
   `git log --oneline -20` (y `git show --stat <sha>` si hace falta). Si hay
   `$FREEFORM`, respétalo (alcance, énfasis, omisiones). **Nunca inventes
   cambios que no se hicieron**; si un punto quedó a medias, márcalo ⚠️ Parcial
   o 🔄 En curso — el reporte es un compromiso con el cliente.
2. **Clasifica cada punto**: tipo (🐞 bug / 💡 requerimiento-mejora / ❓ duda
   aclarada) y estado (✅ Atendido / ⏭️ Fuera de alcance / ⚠️ Parcial / 🔄 En curso).
3. **Redacta** con la plantilla de abajo. Reglas de estilo:
   - Español, **no técnico**: nada de nombres de funciones, endpoints ni jerga.
     Los módulos y botones se nombran como los ve el usuario ("Archivos
     Jurídicos", "Previsualizar"), no como se llaman en el código.
   - Si existe el texto original del cliente (correo, reporte de bugs, acta),
     cítalo **textualmente** en el blockquote del punto.
   - "Cómo validar que funciona" siempre en **pasos numerados** accionables.
   - "Antes de probar necesitas": rol requerido, datos previos, y desde qué
     vista se empieza.
4. **Escribe el archivo**:

```bash
mkdir -p "$REPORTS_DIR"
# <Tema_En_Snake_Case> lo decide Claude según el contenido (corto, descriptivo).
OUT="$REPORTS_DIR/<Tema_En_Snake_Case>_${FECHA}.md"
# Si ya existe, sufijo de revisión: <Tema>_R2_${FECHA}.md, _R3, …
```

5. **NO commitees automáticamente.** El operador decide cuándo y cómo (o usa
   `/git-commit`). Sí sugiere el commit en Next steps.

---

## Plantilla del reporte (usar literal, ajustando contenido)

```markdown
# Reporte de cambios — <contexto de la entrega> (<fecha legible>)

> <1–3 líneas de contexto: de dónde salen estos puntos (correo, reunión,
> reporte de bugs), proyecto y ambiente donde se pueden probar.>

**Convenciones:**
- 🐞 = bug reportado
- 💡 = requerimiento / mejora de UX
- ❓ = duda del cliente que se aclara
- ✅ Atendido | ⏭️ Fuera de alcance | ⚠️ Parcial | 🔄 En curso

**Para todas las pruebas:** <requisito global: ambiente, tipo de cuenta.>

---

## Resumen rápido

| Clasificación | Cantidad |
|---|---:|
| ✅ Atendido | N |
| ⏭️ Fuera de alcance | N |
| **Total puntos** | **N** |

| # | Punto | Estado |
|---|---|---|
| 1 | <título corto> | ✅ Atendido |

---

## 1. ✅ Atendido — 🐞 <Título del punto>

> **Observación del cliente:** "<cita textual>"

**Qué se hizo:** <explicación no técnica. Si ayuda, usar el par
**Antes:** / **Ahora:** para contrastar comportamiento.>

**Antes de probar necesitas:**
- <rol con el que ingresar>
- <datos o estado previo necesario>
- <vista/módulo donde empezar>

**Cómo validar que funciona:**
1. <paso>
2. <paso>
3. <resultado esperado observable>

---

## Cierre

| Categoría | Total puntos | ✅ Atendidos | ⚠️ Parciales | ⏭️ Fuera de alcance |
|---|---|---|---|---|
| <categoría> | N | N | N | N |
| **TOTAL** | **N** | **N** | **N** | **N** |

<Frase de cierre: quedamos atentos a dudas/ajustes.>
```

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟢 client-report OK — <archivo> creado
| Dimensión | Estado | Detalle |
|---|---|---|
| Phase 0 — Args | ✅ | MODE=create, fecha DDMMYYYY del sistema |
| Phase 3 — Insumos | ✅ | N puntos (sesión + git log) |
| Plantilla | ✅ | citas textuales + validación paso a paso |
| Git | ⚠️ | sin commitear (decisión del operador) |

## Next steps
- `git add docs/reports/<archivo> && git commit -m "docs(reports): ..."`

Report path: docs/reports/<archivo>.md
```

- En modo **create**, la ÚLTIMA línea de la respuesta es SIEMPRE la literal
  `Report path: docs/reports/<archivo>.md`.
- En modos `--list`/`--find` no hay veredicto: la tabla/los matches SON la salida.

---

## Notas de fleet

- Fuente canónica: `vps-ops-toolkit/workflows/.claude/client-report.md`. Las
  copias en `.agents/skills/` y `.windsurf/` difieren solo en frontmatter.
- La convención `docs/reports/` + `_DDMMYYYY` es fleet-wide: aplica igual en
  todos los proyectos que reciben esta skill.
- `docs/tmp/` sigue siendo el espacio de borradores (gitignorado); lo que se
  entrega al cliente vive en `docs/reports/` y se commitea.
