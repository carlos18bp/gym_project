---
name: git-commit
description: "Inspect git changes, generate a professional commit message with FEAT/FIX/DOCS prefix, and execute git add + commit + push. Defaults to vps-ops-toolkit; pass --all to iterate over LOCAL_PROJECTS + toolkit on this host."
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[--all (opcional — itera todos los repos locales del host)]"
---

> **⚠️ How to invoke**:
> - Sin argumento: `/git-commit` → opera SOLO en `~/webapps/vps-ops-toolkit/`.
> - Con `--all`: `/git-commit --all` → itera sobre `LOCAL_PROJECTS` del
>   host + `vps-ops-toolkit`. En cada repo: si está clean, SKIP; si tiene
>   cambios, generar mensaje propio y commit+push independiente.
>
> No acepta nombres de proyecto individuales — si necesitás operar en un
> repo específico, `cd` primero o invocá git directo.

## Phase 0 — Resolución de la lista de repos

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"

case "$ARGS_RAW" in
    "")
        REPOS=("vps-ops-toolkit")
        MODE_LABEL="default (toolkit only)"
        ;;
    "--all")
        source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
        PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
        REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
        MODE_LABEL="--all (${#REPOS[@]} repos)"
        ;;
    *)
        echo "❌ ERROR: argumento desconocido '$ARGS_RAW'."
        echo "   Válido: (vacío) → vps-ops-toolkit  |  --all → todos los locales."
        exit 2
        ;;
esac

VALID_REPOS=()
for r in "${REPOS[@]}"; do
    if [ -d "$HOME/webapps/$r/.git" ]; then
        VALID_REPOS+=("$r")
    else
        echo "⏭️  $r — dir no existe o no es repo git (skip)"
    fi
done

echo "🔧 Modo: $MODE_LABEL — repos a procesar: ${#VALID_REPOS[@]}"
printf '   - %s\n' "${VALID_REPOS[@]}"
```

---

## Iteración sobre `VALID_REPOS`

Las instrucciones de abajo (inspect → analyze → generate message → add +
commit + push) se ejecutan **una vez por cada repo** en `VALID_REPOS`.
Antes de empezar cada iteración:

```bash
REPO_DIR="$HOME/webapps/$REPO"
cd "$REPO_DIR"
echo ""
echo "═══════════════════════════════════════════════"
echo "  $REPO  ($(git -C "$REPO_DIR" branch --show-current))"
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

En modo default (sin `--all`), `VALID_REPOS` contiene solo
`vps-ops-toolkit` y no hay loop real — el flujo corre una vez.

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
