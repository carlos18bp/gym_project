---
name: full-audit
description: "Auditoría integral one-shot del VPS (repo + servidor + proyectos). Orquesta 12 fases, emite veredicto 🟢/🟡/🔴 y deja reporte markdown en docs/audits/."
argument-hint: "[--with-backup-test] [--send-email] [--quiet] [--skip-env-check] [--skip-memorymax] [--skip-timers]"
allowed-tools: Bash
---

# Auditoría integral — full-audit

Ejecuta la auditoría completa del servidor, repo y proyectos usando el orquestador canónico `scripts/audits/full-audit.sh`.

## Qué hace

Orquesta en secuencia los validadores del repo y consolida el resultado en un reporte markdown con veredicto ejecutivo. **Read-only por defecto** — solo modifica estado con `--with-backup-test` (crea/dropea DBs `_restoretest`) o `--send-email` (envía ping real con cooldown).

### 12 fases ejecutadas

1. `ops-verify.sh` — integridad del toolkit
2. `verify-state.sh` — drift SHA256 repo ↔ servidor
3. `reconcile-projects-yml.sh` — coherencia `projects.yml` ↔ systemd/MySQL/sockets/logs
4. `validate-project-envs.sh` — `.env` por proyecto vs templates + secretos
5. `verify-memorymax-sync.sh` — `MemoryMax` `projects.yml` ↔ systemd
6. `verify-timers-inventory.sh` — timers/crons declarados ↔ activos
7. `post-deploy-check.sh` — health endpoints
8. `dependency-check.sh` — cadena nginx→socket→gunicorn→Django→MySQL→Redis
9. `quick-status.sh` — snapshot de recursos
10. `email-heartbeat.sh` — pipeline de notificaciones (dry-run si no se pasa `--send-email`)
11. `email-live-test.sh` — TEST vivo del pipeline (solo con `--send-email`)
12. `test-backup-restore.sh` — solo con `--with-backup-test` (lento, ~5-10 min)

## Ejecución

```bash
bash scripts/audits/full-audit.sh $ARGUMENTS
```

Flags útiles:
- sin flags → audit rápido (~3-4 min), dry-run de email, sin backup test
- `--with-backup-test` → incluye restore real (lento, ~10 min)
- `--send-email` → heartbeat real + email-live-test (requiere cooldown 1h en el pipeline)
- `--quiet` → solo veredicto final a stdout
- `--skip-env-check` / `--skip-memorymax` / `--skip-timers` → saltear fase específica

## Veredicto (exit code)

- `0` → 🟢 TODO EN ORDEN (todas las fases OK)
- `1` → 🟡 OPERATIVO con warnings (al menos una fase con warnings)
- `2` → 🔴 CRÍTICO (al menos una fase con errores)

## Entregables

El script deja automáticamente:
- **Log crudo:** `/tmp/full-audit-<timestamp>.log`
- **Reporte markdown:** `docs/audits/YYYY-MM-DD-<alias>-full-audit.md` (se sobreescribe en cada corrida; el anterior se mueve a `.bak.md`)

## Interpretación del resultado

Después de ejecutar, revisar el reporte generado y comunicar al usuario:
1. Veredicto global (🟢/🟡/🔴)
2. Fases con estado distinto a OK, con exit code y resumen de la última línea relevante
3. Línea base de recursos (hostname, uptime, memoria, swap, disco, servicios fallidos)
4. Próximos pasos si el veredicto no es 🟢

Si hay 🔴 o 🟡, abrir el log crudo (`/tmp/full-audit-<ts>.log`) para el detalle y proponer remediaciones priorizadas.
