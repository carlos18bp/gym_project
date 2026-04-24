---
name: git-sync
description: "Sync the current branch with its parent branch (main/master): fetch, rebase onto parent, and resolve conflicts if any arise. Also pulls the current branch's own remote first."
disable-model-invocation: true
allowed-tools: Bash
---

# Git Sync

Rebase the current branch onto its parent (`main` / `master`) so it picks up work that teammates have merged. Also pulls the current branch's own remote first, handles dirty working trees, and walks through any rebase conflicts.

---

## Phase 1 — Inspect current state

```bash
git status
git branch -vv
git log --oneline -5
```

**Rules:**
- If `git status` shows uncommitted changes: **warn the user** and offer to stash first with `git stash`, then `git stash pop` after syncing. Do not proceed without their confirmation.
- Note the current branch name and its upstream (if any).

---

## Phase 2 — Detect the parent branch

Auto-detect the default branch of `origin` via:

```bash
git symbolic-ref --short refs/remotes/origin/HEAD
```

This returns something like `origin/main` or `origin/master`. Strip the `origin/` prefix — that's the **parent branch**.

**Fallbacks, in order:**
1. If `origin/HEAD` is not set, try `git show-ref --verify --quiet refs/remotes/origin/main` → parent is `main`.
2. Else try `git show-ref --verify --quiet refs/remotes/origin/master` → parent is `master`.
3. If neither exists: **stop** and report to the user — the skill cannot guess.

Remember the resolved parent branch name for the remaining phases.

---

## Phase 3 — Fetch all remote refs

```bash
git fetch origin
```

This updates both `origin/<parent>` and `origin/<current-branch>` locally.

---

## Phase 4 — Sync the current branch with its own remote

**Skip this phase** if the current branch **is** the parent (handled in Phase 5) or if there is no upstream configured.

Otherwise, preview incoming commits from the current branch's own remote:

```bash
git log --oneline HEAD..origin/<current-branch> --
```

- If empty: nothing to pull from own remote — continue to Phase 5.
- If there are commits: pull with rebase:
  ```bash
  git pull --rebase origin <current-branch>
  ```

If this rebase stops with conflicts → Phase 6. When it finishes cleanly, continue to Phase 5.

---

## Phase 5 — Rebase against the parent branch

**Case A — current branch IS the parent (`main`/`master`):**

```bash
git pull --rebase origin <parent>
```

Then skip to Phase 7.

**Case B — current branch is a feature branch:**

Preview what the parent has that this branch doesn't:

```bash
git log --oneline HEAD..origin/<parent> --
```

- If empty: already up to date with parent — skip to Phase 7.
- If there are commits: rebase onto the parent:
  ```bash
  git rebase origin/<parent>
  ```

If the rebase stops with conflicts → Phase 6.

---

## Phase 6 — Conflict resolution (only if a rebase stops with conflicts)

1. Run `git status` to identify all conflicted files.
2. For each conflicted file:
   - Read the file and show the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Explain what **our side** (the branch being rebased) contains vs what **their side** (the incoming commit) contains.
   - Resolve the conflict by editing the file to keep the correct code (remove markers).
3. Stage resolved files:
   ```bash
   git add <resolved-file>
   ```
4. Continue the rebase:
   ```bash
   git rebase --continue
   ```
5. Repeat until the rebase completes.

**If the conflict is too complex to auto-resolve:** stop, show the conflict in full, and ask the user how to proceed. Never guess on conflict resolution.

---

## Phase 7 — Confirmation

```bash
git log --oneline -8
git status
```

Report:
- Current branch and the parent branch used
- Commits pulled from the current branch's own remote (if any)
- Commits brought in from the parent branch (if any)
- Number of conflicts resolved (if any)
- Whether stash was restored (if stash was used)
- Current working tree status

---

## Safety rules

- **Never** run `git reset --hard` or `git push --force` without explicit user confirmation.
- **Never** resolve a conflict by blindly keeping one side — always inspect both sides.
- **Never** commit during this workflow — this skill only syncs, not commits.
- If the parent branch cannot be detected, stop and ask the user.
- If in doubt about a conflict, stop and ask the user.
