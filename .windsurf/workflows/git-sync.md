---
auto_execution_mode: 2
description: "Sync current branch (default: current repo from cwd; pass --all-repos (repos de este host) o --all-vps (fleet); --all es error)"
---
Sync the current local branch with its remote counterpart using fetch + pull --rebase.

> **⚠️ How to invoke**:
> - Sin argumento: `/git-sync` → opera sobre el repo git del **directorio
>   actual (cwd)**, resuelto con `git rev-parse --show-toplevel`; **NO se
>   asume `vps-ops-toolkit`**. Ignorá el estado del hook `SessionStart`
>   (siempre reporta el toolkit) para decidir el target — lo manda el cwd.
> - Con `--all-repos`: itera sobre `LOCAL_PROJECTS` del host
>   + `vps-ops-toolkit`. No acepta nombres de proyecto individuales —
>   para un repo específico, lanzá Claude desde ese repo (o `cd` a él).

Phase 0 — Resolución de la lista de repos:

```bash
ARGS_RAW="${ARGUMENTS:-}"
OPS_ROOT="$HOME/webapps/vps-ops-toolkit"
ALL_VPS=0; ALL_REPOS=0
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
        MODE_LABEL="--all-repos (${#REPOS[@]} repos)"; ALL_REPOS=1 ;;
    "--all-vps")
        # Eje fleet: delega en propagate-toolkit-commit.sh tras sincronizar local.
        cd "$OPS_ROOT"; REPOS=("vps-ops-toolkit"); REPO_DIR_OVERRIDE="$OPS_ROOT"
        MODE_LABEL="--all-vps (toolkit, local + fleet)"; ALL_VPS=1 ;;
    "--all")
        echo "❌ ERROR: --all es ambiguo y quedó retirado."
        echo "   ¿Todos los repos de ESTE host? → --all-repos"
        echo "   ¿El toolkit en TODOS los VPS?  → --all-vps"
        exit 2 ;;

    *) echo "❌ ERROR: argumento desconocido '$ARGS_RAW'. Válido: (vacío) | --all-repos | --all-vps"; exit 2 ;;
esac
if [ -n "${REPO_DIR_OVERRIDE:-}" ]; then VALID_REPOS=("${REPOS[@]}"); else
VALID_REPOS=()
for r in "${REPOS[@]}"; do
    [ -d "$HOME/webapps/$r/.git" ] && VALID_REPOS+=("$r") || echo "⏭️  $r — skip"
done
fi
echo "🔧 Modo: $MODE_LABEL — repos: ${#VALID_REPOS[@]}"; printf '   - %s\n' "${VALID_REPOS[@]}"
```

**Iteración**: los `Steps` siguientes se ejecutan una vez por cada repo en
`VALID_REPOS`. Resolver `REPO_DIR` según el modo — **las variables de Phase 0
no persisten entre bloques bash, así que el modo default se reancla al cwd**:
```bash
# Modo default (sin --all): reanclar SIEMPRE desde el cwd — robusto entre
# bloques y sin caer al fallback ~/webapps/ ni al toolkit si se perdió la var.
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "❌ ERROR: el cwd dejó de ser un repo git — abortando (no asumo ~/webapps ni el toolkit)."; exit 2; }
cd "$REPO_DIR"
echo "═══ 🎯 Repo objetivo: $REPO_DIR ($(git -C "$REPO_DIR" branch --show-current)) ═══"
```
```bash
# Modo --all: Claude itera VALID_REPOS y entra a cada repo bajo ~/webapps/
REPO_DIR="$HOME/webapps/$REPO"; cd "$REPO_DIR"
echo "═══ 🎯 Repo objetivo: $REPO_DIR ($(git -C "$REPO_DIR" branch --show-current)) ═══"
```
Si una iteración falla (conflicto, etc.), reportar y continuar con el
siguiente repo; no abortar el loop. En modo default no hay loop real.

Steps (ejecutar **una vez por repo** en `VALID_REPOS`):

1. **Verificar `gh` CLI + auth** — `command -v gh && gh auth status`. Si falla, abortar con instrucción: `sudo bash ~/webapps/vps-ops-toolkit/scripts/bootstrap/install-github-cli.sh --apply && gh auth login`.

2. **Stash inspection** — `git stash list`. Para cada stash existente, calcular edad y probar `git stash apply --check`. Marcar:
   - `VIEJO` si edad >30 días → sugerir `git stash drop stash@{N}` en next steps.
   - `OBSOLETO` si `apply --check` falla (cambios ya commiteados) → sugerir drop.
   - **Nunca** ejecutar `git stash drop` automáticamente — solo sugerir.

3. Run `git status` and `git branch -vv` to inspect current state.

4. If there are uncommitted changes, warn me and offer to stash first.

5. **Resolver parent + PR target** — `git fetch origin`, detectar `PARENT` (`origin/HEAD` o fallback main/master), listar PRs abiertos con `gh pr list --state open --json ...`. Política del fleet: **máx 1 PR (release), máx 2 con error**; si hay >2, emitir warning.
   - Si `CURRENT == PARENT` o `CURRENT ∈ heads_PRs_abiertos` → `TARGET=origin/$PARENT`.
   - Si 1 PR abierto y `CURRENT` no es el head → `TARGET=origin/<head-del-PR>` (rebase apilado).
   - Si 2 PRs y `CURRENT` no coincide → exit 2, operador decide.
   - Si >2 PRs → fallback a `origin/$PARENT`.
   - Reportar `TARGET` + razón explícita ANTES del rebase.

6. Preview con `git log --oneline HEAD..$TARGET`. Si vacío, up to date — reportar y stop.

7. **Rebase contra `TARGET`**: `git pull --rebase origin $PARENT` (si current==parent) o `git rebase $TARGET` (feature branch).

8. If conflicts arise, show both sides of each conflict and resolve them (ask me if unsure).

9. Show final `git log --oneline -5` and `git status`.

Safety rules:
- Never run `git reset --hard` or `git push --force` without my confirmation.
- Never resolve conflicts by blindly keeping one side.
- This workflow only syncs, never commits.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/git-sync`:

```markdown
🟢 git-sync OK — <repo> @ <SHA>
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| gh CLI + auth | ✅ | gh <version>, autenticado |
| Phase 0.5 — Stash inspection | ✅ | 0 stashes existentes |
| Phase 1 — Inspect | ✅ | working tree clean |
| Phase 2 — Parent + PR target | ✅ | <N> PRs abiertos → target=<TARGET> |
| Phase 3 — Fetch | ✅ | <N> commits nuevos |
| Phase 4 — Own remote sync | ⏭️ | current es parent (n/a) o sin upstream |
| Phase 5 — Rebase | ✅ | fast-forward o N commits rebased |
| Phase 6 — Conflictos | ⏭️ | sin conflictos |
| Phase 7 — Estado final | ✅ | branch up to date con TARGET |
```

Casos con acción pendiente (omitir línea ✨, agregar `## Next steps`):

- **Stashes obsoletos/viejos detectados** (⚠️ en Phase 0.5):
  ```markdown
  ## Next steps
  - `git stash drop stash@{0}` — OBSOLETO (apply --check falla)
  - `git stash drop stash@{1}` — VIEJO (>30 días, mensaje: <msg>)
  ```

- **>2 PRs abiertos** (⚠️ en Phase 2 PR target):
  ```markdown
  ## Next steps
  - (operador) revisar PRs abiertos: #X, #Y, #Z. Política del fleet: máx 2.
  ```

- **2 PRs abiertos y current branch no coincide** (❌ Phase 2 — exit):
  ```markdown
  ## Next steps
  - `git checkout <rama-PR-objetivo>` — decidir contra cuál PR rebasear y re-invocar.
  ```

- **Conflictos durante rebase** (❌ Phase 6):
  ```markdown
  ## Next steps
  - (manual, operador) Resolver conflictos en: <archivos>
  - `git add <archivos resueltos> && git rebase --continue`
  - O abortar: `git rebase --abort`
  ```

En modo `--all` (loop sobre repos), el reporte agrega columna `Repo` antes
de `Dimensión` y se considera tabla grande (>15 filas) — agregar
`### Resumen ejecutivo` con conteo y `### Top 3 acciones prioritarias`.

---

## Fleet (`--all-vps`)

Si `ALL_VPS=1`, **después** de sincronizar el/los repo(s) local(es), delegá en el
orquestador multi-host (Tailscale). El toolkit rebasa contra `origin/master`; un
repo de proyecto contra **su propio upstream (`@{u}`)**, nunca cross-branch.

```bash
REPOS_FLAG="--repos=toolkit"
[ "${ALL_REPOS:-0}" = "1" ] && REPOS_FLAG="--repos=all"
bash "$OPS_ROOT/scripts/maintenance/propagate-toolkit-commit.sh" --apply "$REPOS_FLAG"
```

`exit 75` = pausa de auth de Tailscale: mostrale el link al operador, esperá la
autorización y re-corré (idempotente). Precondición: el local debe estar pusheado.
Conflicto remoto ⇒ `rebase --abort` + reporte; working tree intacto.
