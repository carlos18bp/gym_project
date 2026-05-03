---
description: Deploy latest master to production server for candle_project
---

# Deploy candle_project to Production

Run these steps on the production server at `/home/ryzepeck/webapps/candle_project` to deploy the latest `master` branch.

## Pre-Deploy

// turbo
1. Quick status snapshot before deploy:
```bash
bash /home/ryzepeck/webapps/ops/vps/scripts/diagnostics/quick-status.sh
```

## Deploy Steps

// turbo
2. Pull the latest code from master:
```bash
cd /home/ryzepeck/webapps/candle_project && git pull origin master
```

3. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/candle_project/backend && source venv/bin/activate && pip install -r requirements.txt && DJANGO_SETTINGS_MODULE=candle_project.settings_prod python manage.py migrate
```

4. Build the frontend (Vue + Vite SPA):
```bash
cd /home/ryzepeck/webapps/candle_project/frontend && npm ci --legacy-peer-deps && npm run build
```

5. Collect static files:
```bash
cd /home/ryzepeck/webapps/candle_project/backend && source venv/bin/activate && DJANGO_SETTINGS_MODULE=candle_project.settings_prod python manage.py collectstatic --noinput
```

6. Restart services:
```bash
sudo systemctl restart candle_project && sudo systemctl restart candle-project-huey
```

## Post-Deploy Verification

// turbo
7. Run post-deploy check for candle_project:
```bash
bash /home/ryzepeck/webapps/ops/vps/scripts/deployment/post-deploy-check.sh candle_project
```
Expected: PASS on all checks, FAIL=0.

8. If something fails, check the logs:
```bash
sudo journalctl -u candle_project --no-pager -n 30
sudo journalctl -u candle-project-huey --no-pager -n 30
sudo tail -20 /var/log/nginx/error.log
```

9. (Optional) Full server diagnostic with score:
```bash
bash /home/ryzepeck/webapps/ops/vps/scripts/diagnostics/full-diagnostic.sh
```

## Verification Scripts Reference

| Script | Purpose | When to use |
|--------|---------|-------------|
| `bash /home/ryzepeck/webapps/ops/vps/scripts/diagnostics/quick-status.sh` | Snapshot rápido: RAM, disco, servicios, SSL | Pre-deploy, sanity check |
| `bash /home/ryzepeck/webapps/ops/vps/scripts/diagnostics/full-diagnostic.sh` | Diagnóstico completo con score | Auditorías, debugging profundo |
| `bash /home/ryzepeck/webapps/ops/vps/scripts/deployment/post-deploy-check.sh candle_project` | Verificación post-deploy | Después de cada deploy |

## Architecture Reference

- **Domain**: `sensescandlesbykate.com` / `www.sensescandlesbykate.com`
- **Backend**: Django (`candle_project` module), settings selected via `DJANGO_SETTINGS_MODULE=candle_project.settings_prod` in systemd unit
- **Frontend**: Vue.js + Vite SPA → `backend/static/frontend/` + Django template `candle_app/templates/index.html`
- **Services**: `candle_project.service` (Gunicorn via socket), `candle_project.socket`, `candle-project-huey.service`
- **Nginx**: `/etc/nginx/sites-available/candle_project`
- **Socket**: `/run/candle_project.sock`
- **Static**: `/home/ryzepeck/webapps/candle_project/backend/staticfiles/`
- **Media**: `/home/ryzepeck/webapps/candle_project/backend/media/`
- **Resource limits**: MemoryMax=512MB, CPUQuota=50%, OOMScoreAdjust=250

## Notes

- VPS operations scripts live in `/home/ryzepeck/webapps/ops/vps/scripts/`.
- Frontend `npm ci` requires `--legacy-peer-deps` due to peer dependency conflicts.
- `DJANGO_SETTINGS_MODULE=candle_project.settings_prod` must be set for migrate and collectstatic commands (manage.py defaults to settings_dev).
- If MemoryMax is hit during deploy, the service will be killed and restarted automatically.
