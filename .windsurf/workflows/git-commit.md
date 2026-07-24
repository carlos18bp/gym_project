---
auto_execution_mode: 2
description: "Create git commit and push (default: current repo from cwd; pass --all-repos to iterate over LOCAL_PROJECTS + toolkit on this host; --all-vps y --all son error (no hay modo fleet))"
---

> **⚠️ How to invoke**:
> - Sin argumento: `/git-commit` → opera sobre el repo git del **directorio
>   actual (cwd)**, resuelto con `git rev-parse --show-toplevel`; **NO se
>   asume `vps-ops-toolkit`**. Ignorá el estado del hook `SessionStart`
>   (siempre reporta el toolkit) para decidir el target — lo manda el cwd.
> - Con `--all-repos`: itera sobre `LOCAL_PROJECTS` del
>   host + `vps-ops-toolkit`. Repos clean → SKIP; con cambios → mensaje
>   propio + commit + push independiente.

Phase 0 — Resolución de la lista de repos:

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"
case "$ARGS_RAW" in
    "")
        REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "❌ ERROR: el directorio actual no es un repo git."; exit 2; }
        cd "$REPO_ROOT"        # anclar el cwd al top del repo
        REPOS=("$(basename "$REPO_ROOT")"); REPO_DIR_OVERRIDE="$REPO_ROOT"
        MODE_LABEL="default (repo actual: ${REPOS[0]} → $REPO_ROOT)" ;;
    "--all-repos")
        source "$OPS_ROOT/scripts/lib/bootstrap-common.sh"
        PROJECT_DEFS_QUIET=1 source "$OPS_ROOT/scripts/lib/project-definitions.sh"
        REPOS=("${LOCAL_PROJECTS[@]}" "vps-ops-toolkit")
        MODE_LABEL="--all-repos (${#REPOS[@]} repos)" ;;
    "--all-vps")
        echo "❌ ERROR: git-commit NO tiene modo fleet."
        echo "   No se commitea a ciegas en clones de otros VPS (pueden estar dirty o"
        echo "   en rama de release). Para el eje fleet: /git-sync --all-vps"
        exit 2 ;;
    "--all")
        echo "❌ ERROR: --all es ambiguo y quedó retirado."
        echo "   ¿Todos los repos de ESTE host? → --all-repos"
        exit 2 ;;
    *) echo "❌ ERROR: argumento desconocido '$ARGS_RAW'. Válido: (vacío) o --all"; exit 2 ;;
esac
if [ -n "${REPO_DIR_OVERRIDE:-}" ]; then VALID_REPOS=("${REPOS[@]}"); else
VALID_REPOS=()
for r in "${REPOS[@]}"; do
    [ -d "$HOME/webapps/$r/.git" ] && VALID_REPOS+=("$r") || echo "⏭️  $r — skip"
done
fi
echo "🔧 Modo: $MODE_LABEL — repos: ${#VALID_REPOS[@]}"; printf '   - %s\n' "${VALID_REPOS[@]}"
```

**Iteración**: las instrucciones (inspect → analyze → message → add +
commit + push) se ejecutan una vez por cada repo en `VALID_REPOS`. Resolver
`REPO_DIR` según el modo — **las variables de Phase 0 no persisten entre
bloques bash, así que el modo default se reancla al cwd**:
```bash
# Modo default (sin --all): reanclar SIEMPRE desde el cwd — sin caer al
# fallback ~/webapps/ ni al toolkit si se perdió la var.
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "❌ ERROR: el cwd dejó de ser un repo git — abortando (no asumo ~/webapps ni el toolkit)."; exit 2; }
cd "$REPO_DIR"
echo "═══ 🎯 Repo objetivo: $REPO_DIR ($(git -C "$REPO_DIR" branch --show-current)) ═══"
```
```bash
# Modo --all: Claude itera VALID_REPOS y entra a cada repo bajo ~/webapps/
REPO_DIR="$HOME/webapps/$REPO"; cd "$REPO_DIR"
echo "═══ 🎯 Repo objetivo: $REPO_DIR ($(git -C "$REPO_DIR" branch --show-current)) ═══"
```
Si un repo está clean (`git status --porcelain` vacío) → SKIP silencioso. Si
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

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill:

🟢 git-commit OK   (🟡 si el push quedó pendiente o un host requiere sync manual; ⏸️ si Tailscale pide auth (exit 75); ⏭️ si no había cambios)

| Dimensión | Estado | Detalle |
|---|---|---|
| Cambios inspeccionados | ✅ | `git status` + `git diff` revisados |
| Commit creado | ✅ | FEAT/FIX/DOCS según el diff — `git commit -m "..."` |
| Push | ✅ | `git push` al upstream OK |
| Propagación al fleet | ✅ | sólo si el repo es vps-ops-toolkit; ver tabla por host |

En `--all` anteponer una columna `repo` (un bloque de filas por repo). Un repo de
proyecto (no el toolkit) marca "Propagación al fleet" como ⏭️ (no se propaga).

Propagación del toolkit — una fila por host:

| Host | Estado | Detalle |
|---|---|---|
| vps-projectapp-prod | ✅ | `SYNCED <sha>` |
| vps-gym | ✅ | `SYNCED <sha>` |
| dev | ⏭️ | `UNREACHABLE` (apagada) |

## Next steps
- (host con `CONFLICT_NEEDS_MANUAL_SYNC`) correr `/git-sync` en ese host — divergencia real
- (si el push quedó pendiente) resolver upstream/conflicto y `git push`