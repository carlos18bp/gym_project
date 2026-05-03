---
auto_execution_mode: 2
description: Auditoría integral del VPS (repo + servidor + proyectos) con veredicto 🟢/🟡/🔴
---

# Auditoría integral — full-audit

Ejecuta la auditoría completa del servidor, repo y proyectos usando el orquestador canónico `scripts/audits/full-audit.sh`.

## Qué hace

Orquesta 12 validadores en secuencia y consolida el resultado en un reporte markdown con veredicto ejecutivo. **Read-only por defecto** — solo modifica estado con `--with-backup-test` (crea/dropea DBs `_restoretest`) o `--send-email` (envía ping real con cooldown).

## Fases

1. `ops-verify` — integridad del toolkit
2. `verify-state` — drift SHA256 repo ↔ servidor
3. `reconcile-projects-yml` — coherencia `projects.yml` ↔ systemd/MySQL/sockets/logs
4. `validate-project-envs` — `.env` por proyecto vs templates + secretos
5. `verify-memorymax-sync` — `MemoryMax` YAML ↔ systemd
6. `verify-timers-inventory` — timers/crons declarados ↔ activos
7. `post-deploy-check` — health endpoints
8. `dependency-check` — cadena nginx→socket→gunicorn→Django→MySQL→Redis
9. `quick-status` — snapshot de recursos
10. `email-heartbeat` (dry-run o real) — pipeline de notificaciones
11. `email-live-test` (dry-run o real) — TEST vivo del pipeline
12. `test-backup-restore` (solo con `--with-backup-test`, ~5-10 min)

## Ejecución

```bash
# Audit rápido, read-only, sin backup test ni email real (~3-4 min)
bash scripts/audits/full-audit.sh

# Audit completo con restore real y email vivo (~15 min)
bash scripts/audits/full-audit.sh --with-backup-test --send-email

# Solo el veredicto final al terminal
bash scripts/audits/full-audit.sh --quiet
```

Flags disponibles: `--with-backup-test`, `--send-email`, `--quiet`, `--skip-env-check`, `--skip-memorymax`, `--skip-timers`.

## Veredicto (exit code)

- `0` → 🟢 TODO EN ORDEN
- `1` → 🟡 OPERATIVO con warnings
- `2` → 🔴 CRÍTICO

## Entregables

- **Log crudo:** `/tmp/full-audit-<timestamp>.log`
- **Reporte markdown:** `docs/audits/YYYY-MM-DD-<alias>-full-audit.md`

## Pasos

1. Verificar que estás parado en el root del repo (`/home/ryzepeck/webapps/ops/vps`).
2. Ejecutar el orquestador con los flags deseados.
3. Una vez termine, abrir el reporte generado en `docs/audits/` y reportar al usuario: veredicto global, fases fallidas/warn con sus resúmenes, y próximos pasos si el veredicto no es 🟢.
4. Si hay 🔴 o 🟡, abrir el log crudo y proponer remediaciones priorizadas.
