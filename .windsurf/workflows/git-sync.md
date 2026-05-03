---
auto_execution_mode: 2
description: Sync current branch with remote
---
Sync the current local branch with its remote counterpart using fetch + pull --rebase.

Steps:
1. Run `git status` and `git branch -vv` to inspect current state.
2. If there are uncommitted changes, warn me and offer to stash first.
3. Run `git fetch origin` then preview incoming commits with `git log --oneline HEAD..origin/<branch>`.
4. If up to date, report and stop.
5. Run `git pull --rebase origin <branch>`.
6. If conflicts arise, show both sides of each conflict and resolve them (ask me if unsure).
7. Show final `git log --oneline -5` and `git status`.

Safety rules:
- Never run `git reset --hard` or `git push --force` without my confirmation.
- Never resolve conflicts by blindly keeping one side.
- This workflow only syncs, never commits.
