---
auto_execution_mode: 2
description: Deploy latest master to production server
---

# Deploy to Production

Run these steps on the production server at `/home/ryzepeck/webapps/gym_project` to deploy the latest `master` branch.

## Steps

// turbo
1. Pull the latest code from master:
```bash
cd /home/ryzepeck/webapps/gym_project && git pull origin master
```

2. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/gym_project/backend && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate
```

3. Build the frontend (requires nvm for Node 22.13.0):
```bash
bash -c 'export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use; cd /home/ryzepeck/webapps/gym_project/frontend && npm ci && npm run build'
```

4. Collect static files:
```bash
cd /home/ryzepeck/webapps/gym_project/backend && source venv/bin/activate && python manage.py collectstatic --noinput
```

5. Restart services:
```bash
sudo systemctl restart gym_intranet && sudo systemctl restart gym-project-huey
```

// turbo
6. Verify services are running:
```bash
sudo systemctl is-active gym_intranet && sudo systemctl is-active gym-project-huey && curl -s -o /dev/null -w "%{http_code}" https://www.gmconsultoresjuridicos.com
```
Expected output: `active`, `active`, `200`.

7. If something fails, check the logs:
```bash
sudo journalctl -u gym_intranet --no-pager -n 30
sudo journalctl -u gym-project-huey --no-pager -n 30
sudo tail -20 /var/log/nginx/error.log
```
