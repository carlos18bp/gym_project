---
name: server-diagnostic-report
description: "Run a comprehensive 13-phase server diagnostic report for the gym_project production server, scoring each phase 1-10 with prioritized action items."
disable-model-invocation: true
allowed-tools: Bash
---

# Server Diagnostic Report — GM Consultores Jurídicos

Run a comprehensive diagnostic of the production server. Execute each phase sequentially, collecting real data via SSH or system commands. Present findings in the structured format below.

> **Target server**: srv614758 (Hostinger VPS)
> **Project**: gym_project — www.gmconsultoresjuridicos.com
> **Server path**: `/home/ryzepeck/webapps/gym_project`
> **Services**: `gym_intranet` (Gunicorn), `gym-project-huey` (Huey task queue)

---

## Output Format

Start with an **Executive Summary** table scoring each phase 1–10 with status emoji (🟢 ≥7, 🟡 5–6, 🔴 ≤4), then present each phase in detail.

---

## Phase 0 — System Baseline

Collect and display:
- **OS**: `lsb_release -d`, `uname -r`, `hostname`
- **CPU**: `nproc`, `lscpu | grep "Model name"`
- **RAM**: `free -h` (total, used, available, swap)
- **Disk**: `df -h /` and `df -i /`
- **Uptime & Load**: `uptime`
- **Critical services status**: nginx, mysql, redis-server, cron, ssh, fail2ban, ufw
- **Failed units**: `systemctl --failed`
- **Active projects**: Check which projects under `/home/ryzepeck/webapps/` have running systemd services

---

## Phase 1 — Log Management

Check:
- Logrotate configs for gym_project (`/etc/logrotate.d/`)
- Journald limits (`/etc/systemd/journald.conf`)
- Journal disk usage: `journalctl --disk-usage`
- Total size of `/var/log/`
- Any log files > 100MB without rotation
- Django log configuration in settings

Score criteria: logrotate configured ✅, journald limited ✅, no oversized logs ✅, Django logs rotated ✅

---

## Phase 2 — RAM & Workers

Check:
- `free -h` and `/proc/pressure/memory`
- Gunicorn worker processes: `ps aux | grep gunicorn`
- Per-worker memory usage
- Systemd service limits: `systemctl show gym_intranet -p MemoryMax,CPUQuota,TasksMax,OOMScoreAdjust`
- Same for `gym-project-huey`
- Current memory usage vs limits: `systemctl status gym_intranet`, `systemctl status gym-project-huey`
- Calculate recommended workers: `(2 × CPU_CORES + 1)` and `(available_RAM / avg_worker_MB)`

Score criteria: workers sized correctly ✅, MemoryMax set ✅, no swap pressure ✅, OOM protection ✅

---

## Phase 3 — Disk Management

Check:
- `df -h` all partitions
- `du -sh /home/ryzepeck/webapps/*/` — size per project
- Breakdown of gym_project: media/, venv/, staticfiles/, logs/
- Check for `gym_project_temp` or other stale directories
- Large files in `/var/backups/`
- Candidates for cleanup (node_modules in prod, stale temps, old backups)

Score criteria: disk < 80% ✅, no stale projects ✅, media size reasonable ✅, cleanup candidates identified

---

## Phase 4 — Automatic Updates

Check:
- `dpkg -l | grep unattended-upgrades`
- `systemctl status unattended-upgrades`
- APT periodic config: `cat /etc/apt/apt.conf.d/20auto-upgrades`
- Allowed origins: `grep -v "^//" /etc/apt/apt.conf.d/50unattended-upgrades | grep -A5 "Allowed-Origins"`
- Pending reboot: `test -f /var/run/reboot-required && echo "REBOOT NEEDED" || echo "No reboot needed"`

---

## Phase 5 — Per-Project Resource Limits

For each active service (gym_intranet, gym-project-huey):
- `systemctl show <service> -p MemoryMax,CPUQuota,TasksMax,LimitNOFILE,OOMScoreAdjust`
- Current usage vs limits
- Evaluate if limits are appropriate

---

## Phase 6 — Monitoring & Alerts

Check:
- Health endpoint: `curl -s -o /dev/null -w "%{http_code}" https://www.gmconsultoresjuridicos.com/api/health/`
- Existence of monitoring scripts in `~/scripts/`
- Cron jobs that do health checks
- External monitoring (UptimeRobot, etc.) — check if configured
- Sentry or error tracking integration in Django settings
- Systemd `OnFailure=` handlers

Score criteria: health endpoint exists ✅, external monitoring ✅, error tracking ✅, automated alerts ✅

---

## Phase 7 — Backups

Check:
- `ls -lah /var/backups/gym_project/`
- django-dbbackup config in settings
- Cron/script that triggers backups
- Backup frequency and retention
- Whether offsite backup exists
- Database size: `SELECT table_schema, ROUND(SUM(data_length + index_length)/1024/1024, 2) AS size_mb FROM information_schema.tables GROUP BY table_schema;`

Score criteria: automated backup ✅, recent backup exists ✅, offsite backup ✅, restore tested ✅

---

## Phase 8 — Maintenance Cron Jobs

Check:
- `/etc/cron.d/gym-maintenance` or equivalent
- `crontab -l` for user crontabs
- `systemctl list-timers --all`
- Expected tasks: backup, logrotate, SSL renewal, clearsessions, MySQL optimize, media backup, health check

---

## Phase 9 — Health Scripts

Check:
- Scripts in `~/scripts/`: list with sizes
- What each script does (read first 5 lines or description)
- Whether they run automatically or manually only

---

## Phase 10 — Max-Requests (Anti Memory Leak)

Check:
- Gunicorn `--max-requests` and `--max-requests-jitter` in service file
- Current worker memory and uptime to detect memory leaks
- Any worker consistently growing in memory

---

## Phase 11 — Slow Query Detection

Check:
- MySQL slow query log config: `SHOW VARIABLES LIKE 'slow_query%'; SHOW VARIABLES LIKE 'long_query_time'; SHOW VARIABLES LIKE 'log_queries_not_using_indexes';`
- Recent slow queries: `tail -50 /var/log/mysql/mysql-slow.log`
- Django Silk status (if installed): check for `silk` in INSTALLED_APPS and table sizes

---

## Phase 12 — Periodic Checklist

Assess evidence of regular maintenance:
- Last system update
- Last service restart
- Last backup
- Last disk space check
- Last log review
- Last restore test
- Last security audit

---

## Phase 13 — Security (Bonus)

Check:
- UFW status: `sudo ufw status verbose`
- Fail2ban jails: `sudo fail2ban-client status`
- SSH config: `grep -E "^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config`
- Django DEBUG setting (from .env or settings)
- .env file permissions: `ls -la /home/ryzepeck/webapps/gym_project/backend/.env /home/ryzepeck/webapps/gym_project/frontend/.env`
- SSL certificate expiry: `echo | openssl s_client -servername gmconsultoresjuridicos.com -connect gmconsultoresjuridicos.com:443 2>/dev/null | openssl x509 -noout -dates`

---

## Final Output

After all phases, produce:

1. **Executive Summary Table** — All 13 phases with scores and status
2. **Top 10 Priority Actions** — Ranked by priority (🔴 Critical → 🟠 High → 🟡 Medium) with estimated effort
3. **Per-Project Summary** — Status of each project found on the server
4. **Timestamp** — When the diagnostic was generated