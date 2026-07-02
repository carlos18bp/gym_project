---
name: git-commit
description: "Inspect git changes, generate a professional commit message with FEAT/FIX/DOCS prefix, and execute git add + commit + push. Defaults to the current repo (cwd); pass --all to iterate over LOCAL_PROJECTS + toolkit on this host."
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[--all (opcional — itera todos los repos locales del host)]"
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
>
> No acepta nombres de proyecto individuales — para operar en un repo
> específico, lanzá Claude Code desde ese repo (o `cd` a él antes de invocar).

## Phase 0 — Resolución de la lista de repos

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"

case "$ARGS_RAW" in
    "")
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
        ;;
    "--all")
        source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
        PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
        REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
        MODE_LABEL="--all (${#REPOS[@]} repos)"
        ;;
    *)
        echo "❌ ERROR: argumento desconocido '$ARGS_RAW'."
        echo "   Válido: (vacío) → repo actual  |  --all → todos los locales."
        exit 2
        ;;
esac

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

Las instrucciones (inspect → analyze → generate message → add + commit +
push) se ejecutan **una vez por cada repo** en `VALID_REPOS`. Antes de empezar
cada iteración, resolver `REPO_DIR` según el modo — **las variables de Phase 0
no persisten entre bloques bash, así que el modo default se reancla al cwd**:

**Modo default (sin `--all`)** — hay un solo repo, el del cwd:

```bash
# Reanclar SIEMPRE desde el cwd. Robusto entre bloques bash y sin caer al
# fallback ~/webapps/ ni al toolkit si una variable se perdió.
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
- Si hay cambios → inspeccionar diff de ESE repo, generar mensaje
  FEAT/FIX/DOCS propio basado en SUS cambios, ejecutar `git add` selectivo
  + `git commit` + `git push`.
- Si `git push` falla → marcar como "commit OK, push pendiente" y continuar
  con el siguiente. No abortar el loop.

En modo default (sin `--all`), `VALID_REPOS` contiene solo el repo actual
(resuelto desde el cwd), no hay loop real.

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
