---
auto_execution_mode: 2
description: Deploy latest master to production server
---

# Deploy to Production

Run these steps on the production server at `/home/ryzepeck/webapps/gym_project` to deploy the latest `master` branch.

- **Domain**: https://www.gmconsultoresjuridicos.com
- **Stack**: Django + Gunicorn + Nginx + MySQL 8 + Redis + Huey
- **Services**: `gym_intranet` (Gunicorn), `gym-project-huey` (task queue)

---

## Phase 1 — Pre-deploy checks

// turbo
1. Verify server health before deploying:
```bash
bash ~/scripts/quick-status.sh
```
If any service is down or disk >85%, **stop and fix before deploying**.

// turbo
2. Check current git status (ensure working directory is clean):
```bash
cd /home/ryzepeck/webapps/gym_project && git status
```
Expected: `nothing to commit, working tree clean`. If there are uncommitted changes, stash or commit them first.

---

## Phase 2 — Pull & build

// turbo
3. Pull the latest code from master:
```bash
cd /home/ryzepeck/webapps/gym_project && git pull origin master
```

4. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/gym_project/backend && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate
```

5. Build the frontend (requires nvm for Node 22.13.0):
```bash
bash -c 'export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use; cd /home/ryzepeck/webapps/gym_project/frontend && npm ci && npm run build'
```

6. Collect static files:
```bash
cd /home/ryzepeck/webapps/gym_project/backend && source venv/bin/activate && python manage.py collectstatic --noinput
```

---

## Phase 3 — Restart services

7. Restart Gunicorn and Huey:
```bash
sudo systemctl restart gym_intranet && sudo systemctl restart gym-project-huey
```

---

## Phase 4 — Post-deploy verification

// turbo
8. Verify services are active:
```bash
sudo systemctl is-active gym_intranet && sudo systemctl is-active gym-project-huey
```
Expected: `active`, `active`.

// turbo
9. Run the post-deploy check script (services, health endpoint, SSL, migrations, static files, recent errors):
```bash
bash ~/scripts/post-deploy-check.sh
```
Expected: `DEPLOY VERIFICATION PASSED — All checks OK`. If it fails, go to Phase 5.

// turbo
10. Verify the health endpoint directly:
```bash
curl -s https://www.gmconsultoresjuridicos.com/api/health/ | python3 -m json.tool
```
Expected: `{"app": "ok", "database": "ok", "redis": "ok"}` with HTTP 200.

---

## Phase 5 — Troubleshooting (only if something fails)

11. Check Gunicorn logs:
```bash
sudo journalctl -u gym_intranet --no-pager -n 50
```

12. Check Huey logs:
```bash
sudo journalctl -u gym-project-huey --no-pager -n 50
```

13. Check Nginx error log:
```bash
sudo tail -30 /var/log/nginx/error.log
```

14. Check Django debug log:
```bash
tail -50 /home/ryzepeck/webapps/gym_project/backend/debug.log
```

15. If services won't start, check systemd details:
```bash
sudo systemctl status gym_intranet --no-pager -l
sudo systemctl status gym-project-huey --no-pager -l
```

---

## Phase 6 — Full diagnostic (optional, recommended weekly)

16. Run the full 12-practice server diagnostic with scoring:
```bash
bash ~/scripts/full-diagnostic.sh
```
This checks: logs, RAM, disk, updates, limits, monitoring, backups, cron, scripts, max-requests, slow queries, security, and SSL.
