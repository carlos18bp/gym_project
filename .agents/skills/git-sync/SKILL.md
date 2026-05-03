---
name: git-sync
description: "Sync the current branch with its remote: fetch, pull with rebase, and resolve conflicts if any arise."
disable-model-invocation: true
allowed-tools: Bash
---

# Git Sync

Sync the current local branch with its remote counterpart. Handles dirty working trees, incoming commits, and merge conflicts.

---

## Phase 1 — Inspect current state

Run these commands to understand the current situation:

```bash
git status
git branch -vv
git log --oneline -5
```

**Rules:**
- If `git status` shows uncommitted changes: **warn the user** and offer to stash first with `git stash`, then `git stash pop` after syncing. Do not proceed without their confirmation.
- Show the current branch name and its remote tracking branch (`origin/<branch>`).
- If there is no upstream tracking branch set, run: `git branch --set-upstream-to=origin/<branch> <branch>` before continuing.

---

## Phase 2 — Fetch & preview incoming changes

```bash
git fetch origin
```

Then preview what is coming from remote before pulling:

```bash
git log --oneline HEAD..origin/<current-branch> --
```

- If the output is empty: the branch is **already up to date** — report this and stop.
- If there are incoming commits: list them and proceed to Phase 3.

---

## Phase 3 — Pull with rebase

```bash
git pull --rebase origin <current-branch>
```

**If the rebase completes cleanly** — skip to Phase 5.

**If the rebase stops with conflicts** — proceed to Phase 4.

---

## Phase 4 — Conflict resolution (only if rebase conflicts)

1. Run `git status` to identify all conflicted files.
2. For each conflicted file:
   - Read the file and show the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Explain what **our side** (local) contains vs what **their side** (remote) contains.
   - Resolve the conflict by editing the file to keep the correct code (remove markers).
3. Stage resolved files:
   ```bash
   git add <resolved-file>
   ```
4. Continue the rebase:
   ```bash
   git rebase --continue
   ```
5. Repeat steps 1–4 until the rebase completes.

**If the conflict is too complex to auto-resolve:** stop, show the conflict in full, and ask the user how to proceed. Never guess on conflict resolution.

---

## Phase 5 — Confirmation

Show the final state after syncing:

```bash
git log --oneline -5
git status
```

Report:
- ✅ Branch name and remote it was synced with
- ✅ Number of commits pulled from remote
- ✅ Number of conflicts resolved (if any)
- ✅ Whether stash was restored (if stash was used)
- ✅ Current working tree status

---

## Safety rules

- **Never** run `git reset --hard` or `git push --force` without explicit user confirmation.
- **Never** resolve a conflict by blindly keeping one side — always inspect both sides.
- **Never** commit during this workflow — this skill only syncs, not commits.
- If in doubt about a conflict, stop and ask the user.
