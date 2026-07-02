---
name: git-commit
description: "Inspect git changes, generate a professional commit message with FEAT/FIX/DOCS prefix, and execute git add + commit + push. Defaults to the current repo (cwd). Cuando el repo del cwd es vps-ops-toolkit, tras un push exitoso propaga el commit al resto del fleet (otros VPS + dev si está prendida) vía Tailscale (ON por defecto, --no-propagate para saltar); un repo de proyecto nunca se propaga. Pass --all to iterate over LOCAL_PROJECTS + toolkit on this host."
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[--all (itera repos locales del host)] [--no-propagate (no sincroniza el toolkit al fleet)]"
---

> **⚠️ How to invoke**:
> - Sin argumento: `/git-commit` → opera sobre el repo git del **directorio
>   actual (cwd)** — el repo desde el que se lanzó Claude Code. Se resuelve
>   con `git rev-parse --show-toplevel`; **NO se asume `vps-ops-toolkit`**.
>   ⚠️ **Ignorá el estado del hook `SessionStart`** (siempre reporta el
>   toolkit) para decidir el target — el target lo manda el cwd, no ese reporte.
> - Con `--all`: `/git-commit --all` → itera sobre `LOCAL_PROJECTS` del
>   host + `vps-ops-toolkit`. En cada repo: si está clean, SKIP; si tiene
>   cambios, generar mensaje propio y commit+push independiente.
> - Con `--no-propagate`: salta la propagación del toolkit al fleet (útil
>   offline / sin Tailscale). Combinable con `--all`.
>
> No acepta nombres de proyecto individuales — para operar en un repo
> específico, lanzá Claude Code desde ese repo (o `cd` a él antes de invocar).
>
> **Propagación al fleet (ON por defecto, sólo cuando el repo es
> `vps-ops-toolkit`):** tras commit+push exitoso del toolkit, este skill corre
> la **Phase 2** que sincroniza la copia del repo en los otros entornos (otros
> VPS del fleet + dev machine si está prendida) vía Tailscale SSH. Si el repo
> del cwd es un proyecto (no el toolkit), o los repos de proyecto del modo
> `--all`, **NO se propagan** (viven en un solo VPS cada uno).

## Phase 0 — Resolución de la lista de repos

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"

# Parseo de flags (orden libre, combinables).
ALL=0
PROPAGATE=1   # ON por defecto; --no-propagate lo apaga.
for tok in $ARGS_RAW; do
    case "$tok" in
        --all)          ALL=1 ;;
        --no-propagate) PROPAGATE=0 ;;
        *)
            echo "❌ ERROR: argumento desconocido '$tok'."
            echo "   Válidos: --all (todos los locales) | --no-propagate (no sincroniza el toolkit al fleet)."
            exit 2
            ;;
    esac
done

if (( ALL == 1 )); then
    source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
    PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
    REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
    MODE_LABEL="--all (${#REPOS[@]} repos)"
else
    # Default: el repo del cwd (donde se lanzó Claude Code), no un hardcode.
    REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
        echo "❌ ERROR: el directorio actual no es un repo git."
        echo "   Lanzá Claude Code desde el repo a commitear (o cd a él), o usá --all."
        exit 2
    }
    cd "$REPO_ROOT"                        # anclar el cwd al top del repo
    REPOS=("$(basename "$REPO_ROOT")")
    REPO_DIR_OVERRIDE="$REPO_ROOT"
    MODE_LABEL="default (repo actual: ${REPOS[0]} → $REPO_ROOT)"
fi
(( PROPAGATE == 1 )) && MODE_LABEL+=" | propagación: ON" || MODE_LABEL+=" | propagación: OFF (--no-propagate)"
export PROPAGATE

if [ -n "${REPO_DIR_OVERRIDE:-}" ]; then
    # Modo default: el repo actual ya fue validado por git rev-parse
    VALID_REPOS=("${REPOS[@]}")
else
    VALID_REPOS=()
    for r in "${REPOS[@]}"; do
        if [ -d "$HOME/webapps/$r/.git" ]; then
            VALID_REPOS+=("$r")
        else
            echo "⏭️  $r — dir no existe o no es repo git (skip)"
        fi
    done
fi

echo "🔧 Modo: $MODE_LABEL — repos a procesar: ${#VALID_REPOS[@]}"
printf '   - %s\n' "${VALID_REPOS[@]}"
```

---

## Iteración sobre `VALID_REPOS`

Las instrucciones de abajo (inspect → analyze → generate message → add +
commit + push) se ejecutan **una vez por cada repo** en `VALID_REPOS`.
Antes de empezar cada iteración, resolver `REPO_DIR` según el modo — **las
variables de Phase 0 no persisten entre bloques bash, así que el modo default
se reancla al cwd en vez de leer una variable perdida**:

**Modo default (sin `--all`)** — hay un solo repo, el del cwd:

```bash
# Reanclar SIEMPRE desde el cwd. Es robusto entre bloques bash (el cwd
# persiste y el modo default nunca sale del repo) y NO cae al fallback
# ~/webapps/ ni al toolkit si una variable se perdió.
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "❌ ERROR: el cwd dejó de ser un repo git — abortando (no asumo ~/webapps ni el toolkit)."
    exit 2
}
cd "$REPO_DIR"
echo ""
echo "═══════════════════════════════════════════════"
echo "  🎯 Repo objetivo: $REPO_DIR  ($(git -C "$REPO_DIR" branch --show-current))"
echo "═══════════════════════════════════════════════"
```

**Modo `--all`** — Claude itera `VALID_REPOS` y entra a cada repo bajo
`~/webapps/<repo>`:

```bash
REPO_DIR="$HOME/webapps/$REPO"
cd "$REPO_DIR"
echo ""
echo "═══════════════════════════════════════════════"
echo "  🎯 Repo objetivo: $REPO_DIR  ($(git -C "$REPO_DIR" branch --show-current))"
echo "═══════════════════════════════════════════════"
```

**Política por iteración**:
- Si `git status --porcelain` está vacío → SKIP silencioso (registrar en
  summary como "0 cambios"). No generar mensaje ni intentar commit.
- Si hay cambios → inspeccionar el diff de ESE repo, generar un mensaje
  FEAT/FIX/DOCS propio basado en SUS cambios (no agregado entre repos),
  ejecutar `git add` selectivo + `git commit` + `git push`.
- Si `git push` falla (no upstream, conflict remoto, etc.) → marcar el
  repo como "commit OK, push pendiente" y continuar con el siguiente.
  No abortar el loop.

En modo default (sin `--all`), `VALID_REPOS` contiene solo el repo actual
(resuelto desde el cwd) y no hay loop real — el flujo corre una vez.

---

Run the following commands to inspect the current Git changes:

1. `git status`
2. `git diff`

Analyze the output of those commands and generate a concise, professional commit message in English.

Format rules:
- Use `FEAT: [description]` if I added new tests, features, or enhancements.
- Use `FIX: [description]` if I fixed a bug or a failing test.
- Use `DOCS: [description]` if I only updated documentation (for example README, comments, or docstrings).

Then execute the necessary Git commands to stage, commit, and push the changes.

Execution rules:
- First, run the exact `git add` command(s) needed to stage only the relevant files.
- Then run: `git commit -m "[message]"`
- Finally, run: `git push`

Output rules:
1. Show the exact `git add` command(s) you will run.
2. Show the exact `git commit -m "[message]"` command before running it.
3. Show the exact `git push` command before running it.
4. Then execute all commands.
5. If there is nothing to commit, clearly say so and do not run commit or push.
6. If `git push` requires a specific remote or branch, detect it and use the correct command.

---

## Phase 2 — Propagación del toolkit al fleet (ON por defecto)

Esta fase sincroniza la copia de **`vps-ops-toolkit`** en los otros entornos del
fleet (los otros VPS + la dev machine **si está prendida**) con el commit que
acabás de pushear, vía Tailscale SSH. Corre el **core de `git-sync`** en cada
host remoto (`git fetch` + `git rebase --autostash` sobre el upstream).

**Cuándo corre** — sólo si TODAS se cumplen:
- El repo commiteado es **`vps-ops-toolkit`** (default con cwd en el toolkit, o
  la iteración `--all` del toolkit). Un repo de proyecto — sea el del cwd en
  modo default, o los de `--all` — **NUNCA** se propaga (viven en un solo VPS
  cada uno). El script `propagate-toolkit-commit.sh` siempre propaga el toolkit
  sin importar el cwd, así que este gate es responsabilidad de la skill.
- Se hizo un commit real **y** `git push` tuvo éxito en esta corrida.
- `PROPAGATE == 1` (es decir, NO se pasó `--no-propagate`).

Si el push falló (no upstream, conflicto remoto) o no hubo cambios → **saltar**
esta fase (no hay nada nuevo en el remoto que jalar). El commit ya hecho nunca
se revierte por una falla de propagación.

**Ejecución (mediada por vos, igual que la generación del mensaje):**

1. **Guard obligatorio** — confirmar que el repo commiteado ES el toolkit antes
   de propagar (self-contained; en modo default el cwd puede ser un proyecto):
   ```bash
   if [ "$(basename "$(git rev-parse --show-toplevel)")" != "vps-ops-toolkit" ]; then
       echo "⏭️  Repo no-toolkit ($(basename "$(git rev-parse --show-toplevel)")) — sin propagación al fleet."
   else
       bash "$HOME/webapps/vps-ops-toolkit/scripts/maintenance/propagate-toolkit-commit.sh" --apply
   fi
   ```
2. **Si el exit code es `75`** (Tailscale pide autorización interactiva): el
   script ya imprimió un link `https://login.tailscale.com/...`. **Mostrale el
   link tal cual al operador**, pedile que lo abra y autorice con la cuenta del
   fleet, y **esperá su confirmación**. Luego **re-ejecutá el mismo comando**
   (es idempotente; los hosts ya sincronizados reportan al instante). Repetí
   hasta que el exit code deje de ser `75`. Una sola autorización habilita TODOS
   los VPS de la ventana de re-auth.
   - **NO** caigas a `ssh` directo, **NO** abortes, **NO** asumas que un VPS
     está caído. Es el flujo normal de auth de Tailscale (ver CLAUDE.md
     "Flujo de auth de Tailscale SSH").
3. Reportá el resumen por host del script:
   - `SYNCED <sha>` → host actualizado.
   - `CONFLICT_NEEDS_MANUAL_SYNC` → ese host tiene divergencia real; quedó con su
     working tree intacto (rebase abortado). Reportalo como host que requiere
     `git-sync` manual; **no** bloquea el éxito del commit ya hecho.
   - `UNREACHABLE` → host inalcanzable (dev apagada, VPS caído); warning, seguí.

En modo `--no-propagate`, omití esta fase por completo y decílo en el resumen.
