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

Exit codes del script subyacente — el output final de la skill los mapea al
veredicto canónico de [[_output-protocol]]:

- `0` → 🟢 full-audit OK (todas las fases OK)
- `1` → 🟡 full-audit OK con N warning(s) (al menos una fase con warnings)
- `2` → 🔴 full-audit — N error(es), revisar arriba (al menos una con errores)

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill
(una fila por fase auditada; `### Resumen ejecutivo` da el conteo y los paths
de los entregables antes de la tabla):

```markdown
🟢 full-audit OK — <alias>
✨ Todo en orden — no hay acciones pendientes.

### Resumen ejecutivo
- Conteo: ✅ N · ⚠️ M · ❌ K · ⏭️ J  (total: 12 fases)
- Reporte: docs/audits/<YYYY-MM-DD>-<alias>-full-audit.md
- Log:     /tmp/full-audit-<timestamp>.log

| Dimensión | Estado | Detalle |
|---|---|---|
| ops-verify | ✅ | toolkit íntegro |
| verify-state | ✅ | sin drift SHA256 repo↔servidor |
| reconcile-projects-yml | ✅ | projects.yml ↔ systemd/MySQL coherente |
| validate-project-envs | ✅ | .env vs templates + secretos OK |
| verify-memorymax-sync | ✅ | MemoryMax sync projects.yml↔systemd |
| verify-timers-inventory | ✅ | timers declarados ↔ activos |
| post-deploy-check | ✅ | health endpoints todos 200 |
| dependency-check | ✅ | cadena nginx→socket→gunicorn→DB→Redis |
| quick-status | ✅ | recursos OK (mem/swap/disco/servicios) |
| email-heartbeat | ✅ | pipeline dry-run OK (sin --send-email) |
| email-live-test | ⏭️ | requiere --send-email |
| test-backup-restore | ⏭️ | requiere --with-backup-test (~10 min) |
```

Mapeo exit code → veredicto: `0`→🟢, `1`→🟡, `2`→🔴. Si hay ⚠️/❌ en alguna
fase: omitir la línea ✨, anteponer `### Top 3 acciones prioritarias` con los 3
items más críticos + su comando exacto (`bash scripts/maintenance/sync-X.sh
--apply` o `sudo systemctl restart <svc>`), y cerrar con `## Next steps`.
**No duplicar** el `print_summary` del script bash: la skill referencia el
reporte markdown que `full-audit.sh` deja en `docs/audits/`.
