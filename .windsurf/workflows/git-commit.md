---
auto_execution_mode: 2
description: "Create git commit and push (default: vps-ops-toolkit; pass --all to iterate over LOCAL_PROJECTS + toolkit on this host)"
---

> **⚠️ How to invoke**:
> - Sin argumento: `/git-commit` → opera SOLO en `~/webapps/vps-ops-toolkit/`.
> - Con `--all`: `/git-commit --all` → itera sobre `LOCAL_PROJECTS` del
>   host + `vps-ops-toolkit`. Repos clean → SKIP; con cambios → mensaje
>   propio + commit + push independiente.

Phase 0 — Resolución de la lista de repos:

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"
case "$ARGS_RAW" in
    "")
        REPOS=("vps-ops-toolkit"); MODE_LABEL="default (toolkit only)" ;;
    "--all")
        source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
        PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
        REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
        MODE_LABEL="--all (${#REPOS[@]} repos)" ;;
    *) echo "❌ ERROR: argumento desconocido '$ARGS_RAW'. Válido: (vacío) o --all"; exit 2 ;;
esac
VALID_REPOS=()
for r in "${REPOS[@]}"; do
    [ -d "$HOME/webapps/$r/.git" ] && VALID_REPOS+=("$r") || echo "⏭️  $r — skip"
done
echo "🔧 Modo: $MODE_LABEL — repos: ${#VALID_REPOS[@]}"; printf '   - %s\n' "${VALID_REPOS[@]}"
```

**Iteración**: las instrucciones (inspect → analyze → message → add +
commit + push) se ejecutan una vez por cada repo en `VALID_REPOS`. Si un
repo está clean (`git status --porcelain` vacío) → SKIP silencioso. Si
`git push` falla → marcar "commit OK, push pendiente" y continuar con el
siguiente. En modo default no hay loop real.

---

Run the following commands to inspect the current Git changes:

1. `git status`
2. `git diff`

Analyze the output of those commands and, based on our Change Implementation Guidelines, generate a concise, professional commit message in English.

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