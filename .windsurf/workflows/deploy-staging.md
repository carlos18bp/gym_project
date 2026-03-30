---
auto_execution_mode: 2
description: Deploy a release branch to the staging server for client UAT
---

# Deploy to Staging

Run these steps on the staging server at `/home/ryzepeck/webapps/gym_project_staging` to deploy a release branch for client testing/UAT.

- **Domain**: https://gmconsultoresjuridicos.projectapp.co
- **Stack**: Django + Gunicorn + Nginx + MySQL 8 + Redis + Huey
- **Services**: `gym_staging` (Gunicorn), `gym-staging-huey` (task queue)

> **⚠️ How to invoke**: Specify the branch in your chat message when calling this workflow.
> Example: `/deploy-staging` deploy branch `release/march-2026`
> If no branch is specified, Cascade will ask before proceeding.
>
> Cascade will substitute `$BRANCH` in all commands below with the provided branch name.

---

## Phase 1 — Pre-deploy checks

// turbo
1. Verify staging server health before deploying:
```bash
bash ~/scripts/quick-status.sh
```
If any service is down or disk >85%, **stop and fix before deploying**.

// turbo
2. Check current git status (ensure working directory is clean):
```bash
cd /home/ryzepeck/webapps/gym_project_staging && git status
```
Expected: `nothing to commit, working tree clean`. If there are uncommitted changes, stash or discard them first.

// turbo
3. Verify the target branch exists on remote:
```bash
cd /home/ryzepeck/webapps/gym_project_staging && git fetch origin && git branch -r | grep $BRANCH
```
If the branch doesn't exist, **stop — wrong branch name or not pushed yet**.

---

## Phase 2 — Pull & build

4. Checkout and pull the release branch:
```bash
cd /home/ryzepeck/webapps/gym_project_staging && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH
```

5. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/gym_project_staging/backend && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate
```

6. Build the frontend (requires nvm for Node 22.13.0) and remove node_modules afterwards:
```bash
bash -c 'export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use; cd /home/ryzepeck/webapps/gym_project_staging/frontend && npm ci && npm run build && rm -rf node_modules'
```
> `rm -rf node_modules` runs only if the build succeeds. Frees ~200–500 MB of disk space.

6b. (Optional) Verify node_modules were removed:
```bash
ls /home/ryzepeck/webapps/gym_project_staging/frontend/node_modules 2>/dev/null && echo "WARNING: node_modules still present" || echo "OK: node_modules removed"
```

7. Collect static files:
```bash
cd /home/ryzepeck/webapps/gym_project_staging/backend && source venv/bin/activate && python manage.py collectstatic --noinput
```

---

## Phase 3 — Restart services

8. Restart Gunicorn and Huey for staging:
```bash
sudo systemctl restart gym_staging && sudo systemctl restart gym-staging-huey
```

---

## Phase 4 — Post-deploy verification

// turbo
9. Verify staging services are active:
```bash
sudo systemctl is-active gym_staging && sudo systemctl is-active gym-staging-huey
```
Expected: `active`, `active`.

// turbo
10. Verify the staging health endpoint:
```bash
curl -s https://gmconsultoresjuridicos.projectapp.co/api/health/ | python3 -m json.tool
```
Expected: `{"app": "ok", "database": "ok", "redis": "ok"}` with HTTP 200.

// turbo
11. Confirm the deployed branch matches the expected release:
```bash
cd /home/ryzepeck/webapps/gym_project_staging && git log --oneline -1
```
Verify the commit matches the latest on `$BRANCH`.

---

## Phase 5 — Troubleshooting (only if something fails)

12. Check Gunicorn logs:
```bash
sudo journalctl -u gym_staging --no-pager -n 50
```

13. Check Huey logs:
```bash
sudo journalctl -u gym-staging-huey --no-pager -n 50
```

14. Check Nginx error log:
```bash
sudo tail -30 /var/log/nginx/error.log
```

15. Check Django debug log:
```bash
tail -50 /home/ryzepeck/webapps/gym_project_staging/backend/debug.log
```

16. If services won't start, check systemd details:
```bash
sudo systemctl status gym_staging --no-pager -l
sudo systemctl status gym-staging-huey --no-pager -l
```

---

## Phase 6 — Notify client (optional)

17. Once verification passes, notify the client that the staging environment is ready for UAT at:
    - **URL**: https://gmconsultoresjuridicos.projectapp.co
    - **Branch deployed**: `$BRANCH`
    - **Date**: (current date)

---

## Notes

- **This workflow does NOT merge to master.** It only deploys a release branch to staging for client approval.
- After client approval, use `/deploy-and-check` to deploy master to production (after merging the release branch).
- The branch is specified at invocation time in the chat message — no need to edit this file per release.
- Staging uses a **separate database and `.env`** from production — client testing will not affect production data.
