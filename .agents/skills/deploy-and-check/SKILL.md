---
name: deploy-and-check
description: "Deploy latest master/main to the production server with pre-deploy checks, build, restart, and post-deploy verification."
disable-model-invocation: true
allowed-tools: Bash
---

> Ejecutar estos pasos conectado al servidor de producción vía SSH.
> Ruta base: `/home/ryzepeck/webapps/azurita`
> NO ejecutar en local.

# Deploy azurita to Production

Run these steps on the production server at `/home/ryzepeck/webapps/azurita` to deploy the latest `main` branch.

## Pre-Deploy

1. Quick status snapshot before deploy:
```bash
bash /home/ryzepeck/webapps/ops/vps/scripts/diagnostics/quick-status.sh
```

## Deploy Steps

2. Pull the latest code from main:
```bash
cd /home/ryzepeck/webapps/azurita && git pull origin main
```

3. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/azurita && source venv/bin/activate && pip install -r requirements.txt && DJANGO_ENV=production python manage.py migrate
```

4. Build the frontend (Vue 3 Vite SPA):
```bash
npm --prefix /home/ryzepeck/webapps/azurita/advent-calendar ci && npm --prefix /home/ryzepeck/webapps/azurita/advent-calendar run build
```

5. Collect static files:
```bash
cd /home/ryzepeck/webapps/azurita && source venv/bin/activate && DJANGO_ENV=production python manage.py collectstatic --noinput
```

6. Restart services:
```bash
sudo systemctl restart azurita && sudo systemctl restart azurita-huey
```

## Post-Deploy Verification

7. Run post-deploy check for azurita:
```bash
bash /home/ryzepeck/webapps/ops/vps/scripts/deployment/post-deploy-check.sh azurita
```
Expected: PASS on all checks, FAIL=0.

8. If something fails, check the logs:
```bash
sudo journalctl -u azurita.service --no-pager -n 30
sudo journalctl -u azurita-huey.service --no-pager -n 30
sudo tail -20 /var/log/nginx/error.log
```

## Architecture Reference

- **Domain**: `azurita.projectapp.co` / `www.azurita.projectapp.co`
- **Backend**: Django (`azurita_project` module), `DJANGO_SETTINGS_MODULE=azurita_project.settings`; production mode activated by `DJANGO_ENV=production` in server `.env`
- **Frontend**: Vue 3 Vite SPA (`advent-calendar/`) → `static/frontend/` + Django `index` catch-all view
- **Services**: `azurita.service` (Gunicorn), `azurita-huey.service`
- **Nginx**: `/etc/nginx/sites-available/azurita`
- **Socket**: `/home/ryzepeck/webapps/azurita/azurita.sock`
- **Static**: `/home/ryzepeck/webapps/azurita/staticfiles/`

## Cleanup

9. Remove `node_modules` to save disk space (frontend already compiled):
```bash
rm -rf /home/ryzepeck/webapps/azurita/advent-calendar/node_modules
```

## Notes

- VPS operations scripts live in `/home/ryzepeck/webapps/ops/vps/scripts/`.
- Frontend uses `npm run build` (Vite) which emits assets to `static/frontend/`.
- `manage.py` defaults to `DJANGO_SETTINGS_MODULE=azurita_project.settings`. Production settings are activated by `DJANGO_ENV=production` (read by python-decouple from the server `.env` file). Never pass `azurita_project.settings_prod` as the settings module — it is not a standalone module, it is auto-imported by `settings.py`.
