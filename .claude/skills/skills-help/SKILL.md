---
name: skills-help
description: "Lista en una tabla las skills disponibles del proyecto con su alcance en una frase. Default: skills propias de .claude/skills. Con --all agrega plugins/globales. Respeta una lista de exclusión editable (ignore.txt). Acepta un término de filtro."
allowed-tools: Bash, Read
argument-hint: "[--all] [filtro]"
---

# Skills Help — catálogo de skills

¿No te acordás qué skills tenés o para qué sirve cada una? Esta skill escanea las
skills del proyecto y las lista en una **tabla** con un alcance **breve** (una
frase) por cada una. Es dinámica: lee el frontmatter en vivo, así las skills
nuevas aparecen solas y ninguna queda hardcodeada/obsoleta.

> **⚠️ How to invoke**:
> - `/skills-help` → tabla de las skills del proyecto (`.claude/skills/`).
> - `/skills-help --all` → además, plugins/globales y comandos built-in.
> - `/skills-help test` → solo las skills cuyo nombre/descripción matchee "test".
> - `/skills-help --all coverage` → combinable: `--all` + filtro.
>
> Claude Code substituye `$ARGUMENTS` con los flags/términos pasados (vacío si se omiten).

---

## Phase 0 — Discovery

```bash
set -o pipefail
ARGS="$ARGUMENTS"
PROJECT_DIR=$(pwd)
SKILLS_DIR="$PROJECT_DIR/.claude/skills"
IGNORE_FILE="$SKILLS_DIR/skills-help/ignore.txt"

# Flag --all y término de filtro (lo que quede tras quitar los flags conocidos).
ALL=false
case "$ARGS" in *--all*) ALL=true;; esac
FILTER=$(printf '%s\n' "$ARGS" | sed -E 's/--all//g; s/^[[:space:]]+//; s/[[:space:]]+$//')

[ -d "$SKILLS_DIR" ] || { echo "❌ No encuentro $SKILLS_DIR — ¿estás en la raíz del repo?"; exit 1; }

echo "✅ Discovery OK:"
echo "  SKILLS_DIR: $SKILLS_DIR"
echo "  --all:      $ALL"
echo "  filtro:     ${FILTER:-<ninguno>}"
echo "  ignore:     $([ -f "$IGNORE_FILE" ] && echo "$IGNORE_FILE" || echo "<ausente>")"
```

---

## Phase 1 — Scan skills del proyecto + lista de exclusión

Por cada `.claude/skills/<name>/SKILL.md`: extrae `name`, `description` y si es
slash-only (`disable-model-invocation: true`). Salta las ignoradas y, si hay
filtro, las que no matcheen. Emite filas crudas `name \t slash \t description`
para que Claude las renderice en Phase 3.

```bash
# --- Cargar lista de exclusión: ignores implícitos + ignore.txt del usuario ---
# Implícitos: _output-protocol (no invocable). El usuario agrega más en ignore.txt.
IGNORED=$'\n_output-protocol\n'
if [ -f "$IGNORE_FILE" ]; then
  # una skill por línea; '#' = comentario; se ignoran líneas vacías.
  while IFS= read -r line; do
    line="${line%%#*}"; line="$(printf '%s' "$line" | tr -d '[:space:]')"
    [ -n "$line" ] && IGNORED="$IGNORED$line"$'\n'
  done < "$IGNORE_FILE"
fi
is_ignored() { printf '%s' "$IGNORED" | grep -qxF "$1"; }

# --- Extraer frontmatter de cada skill ---
RAW=""; n_listed=0; n_ignored=0
for f in "$SKILLS_DIR"/*/SKILL.md; do
  [ -f "$f" ] || continue
  fm=$(awk 'NR==1&&/^---/{f=1;next} /^---/{if(f)exit} f' "$f")
  name=$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p' | head -1 | tr -d '"')
  [ -z "$name" ] && name=$(basename "$(dirname "$f")")
  desc=$(printf '%s\n' "$fm" | sed -n 's/^description:[[:space:]]*//p' | head -1 | sed 's/^"//; s/"[[:space:]]*$//')
  slash=""; printf '%s\n' "$fm" | grep -qiE '^disable-model-invocation:[[:space:]]*true' && slash="⚡"

  if is_ignored "$name"; then n_ignored=$((n_ignored+1)); continue; fi
  # Filtro (case-insensitive sobre nombre+descripción)
  if [ -n "$FILTER" ]; then
    printf '%s %s' "$name" "$desc" | grep -qiF "$FILTER" || continue
  fi
  RAW="$RAW$name"$'\t'"$slash"$'\t'"$desc"$'\n'
  n_listed=$((n_listed+1))
done

echo "=== SKILLS_PROYECTO (name <TAB> slash <TAB> description) ==="
printf '%s' "$RAW" | sort -f
echo "=== /SKILLS_PROYECTO  (listadas=$n_listed, ignoradas=$n_ignored) ==="

[ -f "$IGNORE_FILE" ] || cat <<EOF

ℹ️  No existe lista de exclusión. Para ocultar skills del listado, creá:
    $IGNORE_FILE
    (una skill por línea; '#' para comentarios)
EOF
```

---

## Phase 2 — (solo con `--all`) plugins / globales

Best-effort: cuenta skills de plugins en disco. La lista limpia y deduplicada la
completa Claude desde las skills disponibles de la sesión (Phase 3).

```bash
if [ "$ALL" = true ]; then
  echo "=== PLUGINS_DISCO (best-effort, puede haber duplicados por versión) ==="
  # dedupe por nombre de carpeta de skill
  find "$HOME/.claude/plugins" -path '*/skills/*/SKILL.md' 2>/dev/null \
    | awk -F/ '{print $(NF-1)}' | sort -u | sed 's/^/  - /'
  echo "=== /PLUGINS_DISCO ==="
  echo "ℹ️  --all activo: Claude debe COMPLETAR esta sección con las skills de"
  echo "    plugins (superpowers:*, code-review, frontend-design, deep-research, …)"
  echo "    y comandos built-in (/loop, /verify, /run, /schedule, …) que conoce de"
  echo "    la lista de skills disponibles de la sesión, respetando el ignore.txt."
fi
```

---

## Phase 3 — Render (tabla)

Con los datos crudos de Phase 1 (y Phase 2 si `--all`), Claude arma la salida:

1. **Agrupar** las skills del proyecto en categorías legibles (no hay campo de
   categoría en el frontmatter — agrupá por propósito). Buckets sugeridos:
   - **Entorno & dev local** (dev-up, dev-down, fake-data-refresh, …)
   - **Deploy · git · fleet** (deploy-and-check, git-sync, git-commit, full-audit, repo-cleanup, …)
   - **Tests & cobertura** (backend/frontend/e2e coverage, fix-broken-tests, test-quality-gate, new-feature-checklist, …)
   - **Planning & desarrollo** (plan, plan-task, implement, debug, debugme, …)
   - **Auditoría & mapas** (view-map-audit, vuln-audit, playwright-validation, …)
   - **Contenido & usuario** (proposal-create, blog-ai-weekly, user-walkthrough, human, methodology-setup, …)
   - **Otras** (cualquiera que no encaje — nunca dejes una skill afuera)
2. Una **tabla por categoría** con columnas: `| Skill | | Alcance |`
   - `Skill`: ``/nombre`` (con backticks).
   - 2ª columna: el badge `⚡` si es slash-only, vacío si no.
   - `Alcance`: **una frase, ≤80 chars** resumida de la descripción (recortá; no
     pegues la descripción entera).
3. **Leyenda**: `⚡ = solo por slash command (no se auto-invoca por el modelo)`.
4. Si `--all`: sección extra **"Plugins / globales"** con esas skills (de Phase 2 +
   contexto de sesión), mismo formato de tabla.
5. **Pie**: `N skills listadas · M ignoradas` y, si aplica, cómo editar la lista de
   exclusión (`$IGNORE_FILE`). Si no existe el ignore.txt, repetí el hint para crearlo.

> No uses el veredicto operacional 🟢/🟡/🔴 — esta skill es informativa; la
> tabla-catálogo ES la salida.

---

## Notas

- **Dinámica**: lee el frontmatter en vivo; skills nuevas aparecen automáticamente.
- **Lista de exclusión** editable por el usuario en `.claude/skills/skills-help/ignore.txt`
  (una skill por línea, `#` para comentarios). `_output-protocol` se ignora siempre.
- El `ignore.txt` es **local del proyecto** y NO forma parte del baseline del fleet,
  así que el sync de skills nunca lo pisa.
- `--all` agrega plugins/globales (best-effort en disco + contexto de sesión).
- Funciona en cualquier proyecto del fleet (solo necesita `.claude/skills/`).

---

## Notas de fleet

- Fuente canónica: `vps-ops-toolkit/workflows/.claude/skills-help.md`. Las versiones
  en `.windsurf/` y `.agents/skills/` son copias (distintas por frontmatter).
- El `ignore.txt` NO se distribuye por el sync (no está en el baseline): es por-proyecto.
