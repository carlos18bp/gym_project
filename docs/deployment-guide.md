# Deployment Guide — gym_project

Complete guide to deploy the application from `master` to a production server.

---

## Architecture Overview

```
Browser  ──HTTPS──▶  Nginx (443)  ──Unix socket──▶  Gunicorn  ──▶  Django
                        │
                        ├── /static/  →  staticfiles/  (served directly)
                        ├── /media/   →  media/        (served directly)
                        └── /*        →  Gunicorn      (proxied)
```

**Components:**
- **Nginx** — reverse proxy, SSL termination, static file serving
- **Gunicorn** — WSGI server running Django
- **Huey + Redis** — background task queue (backups, reports, garbage collection)
- **MySQL** — database
- **Let's Encrypt** — SSL certificates (auto-renewed by Certbot)

---

## Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| Ubuntu/Debian | 22.04+ |
| Python | 3.12+ |
| Node.js | 22.13+ |
| MySQL | 8.0+ |
| Redis | 6.0+ |
| Nginx | 1.18+ |
| Certbot | Latest |

---

## Initial Deployment (First Time)

### Step 1: Clone the repository

```bash
git clone https://github.com/carlos18bp/gym_project.git /home/ryzepeck/webapps/gym_project
cd /home/ryzepeck/webapps/gym_project
```

### Step 2: Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Create backend `.env`

```bash
cp .env.example .env
nano .env
```

Fill in **all** production values. Critical variables:

```ini
DJANGO_ENV=production
DJANGO_SECRET_KEY=<generate: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DJANGO_ALLOWED_HOSTS=gmconsultoresjuridicos.com,www.gmconsultoresjuridicos.com,145.223.120.121

DB_ENGINE=django.db.backends.mysql
DB_NAME=gym_intranet
DB_USER=Naxcar
DB_PASSWORD=<your-password>
DB_HOST=localhost
DB_PORT=3306

EMAIL_HOST_USER=avisos@gymconsultoresjuridicos.com
EMAIL_HOST_PASSWORD=<your-app-password>
DEFAULT_FROM_EMAIL=G&M Consultores Juridicos <avisos@gymconsultoresjuridicos.com>

GOOGLE_CLIENT_ID=<your-google-client-id>

CORS_ALLOWED_ORIGINS=https://gmconsultoresjuridicos.com,https://www.gmconsultoresjuridicos.com
CSRF_TRUSTED_ORIGINS=https://gmconsultoresjuridicos.com,https://www.gmconsultoresjuridicos.com

REDIS_URL=redis://localhost:6379/1
```

See `backend/.env.example` for the full list of variables.

### Step 4: Run migrations

```bash
source venv/bin/activate
python manage.py migrate
```

### Step 5: Build the frontend

```bash
cd ../frontend
npm ci
cp .env.example .env
nano .env
```

Set the frontend environment variables:

```ini
VITE_GOOGLE_CLIENT_ID=<same-client-id-as-backend>
VITE_APP_DOMAIN=https://www.gmconsultoresjuridicos.com
```

Then build:

```bash
npm run build
```

This generates:
- Compiled assets in `backend/static/frontend/`
- Django template at `backend/gym_app/templates/index.html`

### Step 6: Collect static files

```bash
cd ../backend
source venv/bin/activate
python manage.py collectstatic --noinput
```

This copies all static files (frontend build + Django admin) to `staticfiles/`.

### Step 7: Install systemd services

```bash
# Gunicorn socket + service
sudo cp scripts/systemd/gunicorn.socket /etc/systemd/system/gym_intranet.socket
sudo cp scripts/systemd/gunicorn.service /etc/systemd/system/gym_intranet.service

# Huey task queue
sudo cp scripts/systemd/huey.service /etc/systemd/system/gym-project-huey.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now gym_intranet.socket
sudo systemctl enable --now gym_intranet.service
sudo systemctl enable --now gym-project-huey
```

### Step 8: Configure Nginx

```bash
sudo cp scripts/nginx/gym_project.conf /etc/nginx/sites-available/gym_intranet
sudo ln -s /etc/nginx/sites-available/gym_intranet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 9: Set up SSL (if not already done)

```bash
sudo certbot --nginx -d gmconsultoresjuridicos.com -d www.gmconsultoresjuridicos.com
```

### Step 10: Verify

```bash
sudo systemctl status gym_intranet
sudo systemctl status gym-project-huey
curl -I https://www.gmconsultoresjuridicos.com
```

---

## Update Deployment (Future Deploys)

Run these commands every time you want to deploy a new version:

```bash
cd /home/ryzepeck/webapps/gym_project
git pull origin master

# Backend: dependencies + migrations
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate

# Frontend: build
cd ../frontend
npm ci
npm run build

# Collect static + restart services
cd ../backend
source venv/bin/activate
python manage.py collectstatic --noinput
sudo systemctl restart gym_intranet
sudo systemctl restart gym-project-huey
```

---

## Troubleshooting

### Check service logs

```bash
# Gunicorn
sudo journalctl -u gym_intranet -f

# Huey
sudo journalctl -u gym-project-huey -f

# Nginx
sudo tail -f /var/log/nginx/error.log
```

### Common issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 502 Bad Gateway | Gunicorn not running or socket permission issue | `sudo systemctl restart gym_intranet` and check logs |
| Redirect loop | Missing `SECURE_PROXY_SSL_HEADER` or Nginx not sending `X-Forwarded-Proto` | Verify `settings_prod.py` has the header and Nginx config has `proxy_set_header X-Forwarded-Proto $scheme` |
| Static files 404 | `collectstatic` not run after build | Run `python manage.py collectstatic --noinput` |
| Google Login 401 | Client ID mismatch between frontend and backend | Ensure `VITE_GOOGLE_CLIENT_ID` (frontend `.env`) and `GOOGLE_CLIENT_ID` (backend `.env`) are identical |
| SPA routes show 500 | Django template not generated | Run `npm run build` (includes template generation) |

### Verify configuration

```bash
# Check Django settings are loading correctly
cd /home/ryzepeck/webapps/gym_project/backend
source venv/bin/activate
python manage.py check --deploy

# Check socket is active
sudo systemctl status gym_intranet.socket
file /run/gym_intranet.sock
```

---

## File Structure (Production)

```
/home/ryzepeck/webapps/gym_project/
├── backend/
│   ├── .env                          ← secrets (NOT in git)
│   ├── gym_project/
│   │   ├── settings.py               ← main settings (reads from .env)
│   │   ├── settings_prod.py          ← production overrides
│   │   └── settings_dev.py           ← development overrides
│   ├── gym_app/
│   │   └── templates/
│   │       └── index.html            ← generated by build ({% static %} tags)
│   ├── static/
│   │   └── frontend/                 ← Vite build output (NOT in git)
│   ├── staticfiles/                  ← collectstatic output (NOT in git)
│   ├── media/                        ← user uploads
│   ├── venv/                         ← Python virtualenv
│   └── requirements.txt
├── frontend/
│   ├── .env                          ← VITE_* variables (NOT in git)
│   ├── .env.example
│   ├── src/
│   ├── scripts/
│   │   └── generate-django-template.cjs
│   └── package.json
├── scripts/
│   ├── systemd/
│   │   ├── gunicorn.service
│   │   ├── gunicorn.socket
│   │   └── huey.service
│   └── nginx/
│       └── gym_project.conf
└── docs/
    └── deployment-guide.md           ← this file
```

---

## Security Checklist

- [ ] `DJANGO_ENV=production` is set in `.env`
- [ ] `DJANGO_SECRET_KEY` is a strong random key (not the default insecure one)
- [ ] `DEBUG=False` (enforced by `settings_prod.py`)
- [ ] All credentials are in `.env`, not in code
- [ ] `.env` files are in `.gitignore`
- [ ] SSL is active (HTTPS only)
- [ ] `SECURE_PROXY_SSL_HEADER` is configured (prevents redirect loops)
- [ ] `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` are set
- [ ] Google Client ID matches between frontend and backend `.env`
- [ ] Firewall allows only ports 80, 443, and SSH
