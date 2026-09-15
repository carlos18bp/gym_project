---
name: "full-audit"
description: "Auditoría integral one-shot del VPS (repo + servidor + proyectos). Orquesta 12 fases, emite veredicto 🟢/🟡/🔴 y deja reporte markdown en docs/audits/. Con --all corre en TODOS los VPS del fleet (via tailscale) y resume el veredicto por host."
---

## Cuándo usar cuál (familia de auditoría)

| Skill | Úsala cuando | Cadencia típica |
|---|---|---|
| `$full-audit` | Veredicto integral 🟢/🟡/🔴 del VPS o del fleet (`--all`): configs, drift, envs, timers, health, email — 12 fases automatizadas, ~4 min | Post-cambio grande, post-incidente, trimestral |
| `$server-diagnostic` | Informe profundo por las 15 buenas prácticas con score y recomendaciones por proyecto — más narrativo y granular que full-audit | Semanal automático (cron) / a demanda |
| `$vuln-audit` | Dependencias y CVEs de UN proyecto (pip + npm), con updates aplicados | Por proyecto, mensual o ante CVE |

No se orquestan entre sí (cada una es independiente); full-audit NO corre a las otras dos.


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

## Cómo invocar este skill

Gating ($output-protocol §4): (1) flags explícitos → ejecutar directo, sin
menú; (2) intención clara por la sesión (p.ej. "auditá todo el fleet") →
proponer el comando en una línea y esperar confirmación; (3) sin argumentos /
intención difusa → UNA sola AskUserQuestion con Q1+Q2 fusionadas en una
llamada; (4) nunca en modo fleet/headless/cron ni dentro de un barrido.

**Q1 — Alcance** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Este VPS (Recommended) | audit rápido read-only (~3-4 min) del host actual, email en dry-run | `bash scripts/audits/full-audit.sh` |
| --all-vps (fleet) | los 3 VPS vía tailscale (~10-12 min), exit = el PEOR de los hosts; reenvía los add-ons de Q2 a cada VPS | `bash scripts/audits/full-audit.sh --all-vps` |

**Q2 — Add-ons** (`multiSelect: true` — se agregan al alcance elegido en Q1):

| label | description | preview |
|---|---|---|
| --with-backup-test | restaura DE VERDAD un backup: crea y dropea DBs `_restoretest` (lento, ~5-10 min extra) | `bash scripts/audits/full-audit.sh --with-backup-test` |
| --send-email | ENVÍA email real (heartbeat + live-test), cooldown 1h del pipeline — nunca Recommended | `bash scripts/audits/full-audit.sh --send-email` |

**Qué NO se pregunta:** `--quiet` y los `--skip-env-check` /
`--skip-memorymax` / `--skip-timers` — tuning simétrico al default (recortar
output / saltear una fase es decisión que se tipea a propósito, no menú).

## Ejecución

```bash
bash scripts/audits/full-audit.sh $ARGUMENTS
```

Flags útiles:
- sin flags → audit rápido (~3-4 min) de ESTE VPS, dry-run de email, sin backup test
- **`--all-vps`** (alias: `--all`) → **fleet-wide**: corre la auditoría en TODOS los VPS (local directo, remotos
  via `tailscale ssh`), reenvía el resto de flags, imprime un **resumen fleet** (VPS →
  veredicto) y el exit es el PEOR de los hosts. ~3-4 min por VPS (⇒ ~10-12 min los 3).
  Cada host deja su reporte en su propio `docs/audits/`. Si Tailscale pide auth, muestra el
  link y hay que autorizar + re-correr. Combinable: `--all --quiet`, `--all --skip-timers`, etc.
- `--with-backup-test` → incluye restore real (lento, ~10 min)
- `--send-email` → heartbeat real + email-live-test (requiere cooldown 1h en el pipeline)
- `--quiet` → solo veredicto final a stdout
- `--skip-env-check` / `--skip-memorymax` / `--skip-timers` → saltear fase específica

## Veredicto (exit code)

Exit codes del script subyacente — el output final de la skill los mapea al
veredicto canónico de $output-protocol:

- `0` → 🟢 full-audit OK (todas las fases OK)
- `1` → 🟡 full-audit OK con N warning(s) (al menos una fase con warnings)
- `2` → 🔴 full-audit — N error(es), revisar arriba (al menos una con errores)

---

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos
(reglas de gating de $output-protocol §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| --all-vps fleet completo (Recommended) | misma auditoría en los 3 VPS vía tailscale, read-only (~10-12 min) | `bash scripts/audits/full-audit.sh --all-vps` |
| --with-backup-test | restore real: crea/dropea DBs `_restoretest` (~5-10 min) | `bash scripts/audits/full-audit.sh --with-backup-test` |
| --send-email | ENVÍA email real (heartbeat + live-test); cooldown 1h — nunca Recommended | `bash scripts/audits/full-audit.sh --send-email` |
| Abrir el reporte | leer el markdown que esta corrida dejó en docs/audits/ | `open docs/audits/<fecha>-<alias>-full-audit.md` |

## Output final

Reportar siguiendo $output-protocol. Plantilla específica de esta skill
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
