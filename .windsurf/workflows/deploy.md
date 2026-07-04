---
description: Deploy latest main to production server for azurita
---

# Deploy azurita to Production

Run these steps on the production server at `/home/ryzepeck/webapps/azurita` to deploy the latest `main` branch.

## Pre-Deploy

// turbo
1. Quick status snapshot before deploy:
```bash
bash /home/ryzepeck/webapps/vps-ops-toolkit/scripts/diagnostics/quick-status.sh
```

## Deploy Steps

// turbo
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

## Architecture Reference

- **Domain**: `azurita.projectapp.co`
- **Backend**: Django (`azurita_project` module), settings via `DJANGO_SETTINGS_MODULE=azurita_project.settings`
- **Frontend**: Vue 3 Vite SPA (`advent-calendar/`) → `static/frontend/` + Django `index` catch-all view
- **Services**: `azurita.service` (Gunicorn), `azurita-huey.service`
- **Nginx**: `/etc/nginx/sites-available/azurita`
- **Socket**: `/home/ryzepeck/webapps/azurita/azurita.sock`
- **Database**: SQLite (`backend/db.sqlite3`)
- **Redis DB**: /6

## Notes

- VPS operations scripts live in `/home/ryzepeck/webapps/vps-ops-toolkit/scripts/`.
- azurita uses SQLite (lightweight project).
- `manage.py` is at the repo root; `venv/` is at the repo root too.
- WorkingDirectory for gunicorn is `/home/ryzepeck/webapps/azurita`.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/deploy` (azurita):

Línea de veredicto (elegir una):

- `🟢 deploy OK — azurita` — todos los pasos ✅, health check 200
- `🟡 deploy OK — azurita con N warning(s)` — desplegó, con observaciones
- `🔴 deploy — azurita, N error(es), revisar arriba` — un paso falló

| Dimensión | Estado | Detalle |
|---|---|---|
| git pull origin main | ✅ | HEAD en <short-sha>, working tree limpio |
| Backend deps (pip) | ✅ | requirements.txt instalado en venv |
| Build frontend (Vite) | ✅ | advent-calendar → static/frontend/ |
| Migraciones | ✅ | DJANGO_ENV=production migrate sin pendientes |
| collectstatic | ✅ | static files recolectados con --noinput |
| Restart services | ✅ | azurita.service + azurita-huey.service active |
| Health check | ✅ | azurita.projectapp.co responde 200 |

## Next steps
- `bash /home/ryzepeck/webapps/vps-ops-toolkit/scripts/diagnostics/quick-status.sh` — snapshot post-deploy
- (si 🔴) revisar `journalctl -u azurita -n 50` y re-correr el paso fallido
