# Systemd Services Installation

## Huey Task Queue

Huey processes background tasks: automated backups, Silk garbage collection, and weekly query reports.

### Installation

1. Copy the service file (adjust paths first):

   ```bash
   sudo cp scripts/systemd/huey.service /etc/systemd/system/gym-project-huey.service
   ```

2. Edit the service file to match your environment:

   ```bash
   sudo nano /etc/systemd/system/gym-project-huey.service
   ```

   Replace:
   - `[user]` → your system user (e.g., `www-data`)
   - `[group]` → your system group (e.g., `www-data`)
   - `/path/to/project/backend` → absolute path to the backend directory
   - `/path/to/venv/bin/python` → absolute path to the virtualenv Python

3. Enable and start:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable gym-project-huey
   sudo systemctl start gym-project-huey
   ```

4. Verify:

   ```bash
   sudo systemctl status gym-project-huey
   journalctl -u gym-project-huey -f
   ```

### Scheduled Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `scheduled_backup` | Days 1 & 21, 3:00 AM | DB and media backup with cleanup |
| `silk_garbage_collection` | Daily, 4:00 AM | Clean Silk data older than 7 days |
| `weekly_slow_queries_report` | Mondays, 8:00 AM | Performance report to logs |

### Prerequisites

- Redis must be running (`sudo systemctl status redis`)
- The `.env` file must exist in the backend directory with `DJANGO_ENV=production`
- Backup directory must exist with correct permissions:

  ```bash
  sudo mkdir -p /var/backups/gym_project
  sudo chown [user]:[group] /var/backups/gym_project
  sudo chmod 750 /var/backups/gym_project
  ```
