---
name: git-commit
description: "Inspect git changes, generate a professional commit message with FEAT/FIX/DOCS prefix, and execute git add + commit + push."
disable-model-invocation: true
allowed-tools: Bash
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

## Output final

Reportar siguiendo [[_output-protocol]] al cerrar:

1. **Veredicto** (una línea):
   - 🟢 `git-commit OK — <prefix>: pushed to <remote>/<branch>`
   - 🟡 `git-commit OK — commit creado, push pendiente (sin remote)`
   - ⏭️ `git-commit — nada que commitear`
   - 🔴 `git-commit — falló <add|commit|push>, revisar arriba`

2. **Tabla**:

| Dimensión | Estado | Detalle |
|---|---|---|
| Files staged | ✅ | `<archivos exactos>` |
| Commit message | ℹ️ | `<FEAT/FIX/DOCS: ...>` |
| Commit | ✅ / ❌ | `<sha corto>` |
| Push | ✅ / ⏭️ / ❌ | `<remote>/<branch>` o N/A |

3. **Next steps** — solo si push falló o quedan changes sin stage.
