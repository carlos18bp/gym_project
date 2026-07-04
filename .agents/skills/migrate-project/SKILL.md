---
name: migrate-project
description: "Migra un proyecto Django entre VPS del fleet (per-project, no whole-VPS). 20 pasos con tres gates: --check (preflight), --apply (clone + setup + snapshot + transfer + systemd + nginx + SSL emit, sin downtime), --cutover --confirm-downtime (DNS flip + projects.yml flip + auto-cleanup mysql-users.env). v1.3 con deploy automático de systemd units, nginx site y SSL cert via emit-project-ssl-cert.sh helper."
argument-hint: "<project_name> <target_vps_alias> [--check|--apply|--cutover --confirm-downtime|--rollback]"
allowed-tools: Bash, Read, Edit
---

Argumentos recibidos: **$ARGUMENTS**

Si `$ARGUMENTS` no incluye `<project_name>` y `<target_vps_alias>`, pedir al usuario antes de continuar.

## Qué hace

Migra un proyecto Django entre dos VPS del fleet (origin → target) componiendo los scripts existentes vía `FORCE_SINGLE_PROJECT` + `FORCE_PROJECTS` env vars. No migra un VPS completo (para eso usar `docs/migration-runbook.md`).

## Modos

| Modo | Acción | Downtime |
|---|---|---|
| `--check` | Preflight + dry-run report | No |
| `--apply` | Pasos 1-15: snapshot + transfer + clone + DB + bootstrap en target. Services en origin SIGUEN VIVOS | No |
| `--cutover --confirm-downtime` | Paso 16: stop origin → final delta dump → start target → DNS guidance → smoke tests → commit projects.yml flip | Sí, ≤5 min HTTP / ≈0 min con SSL blue-green |
| `--rollback` | Restart origin services, deja target en warm spare | Reversión |

## Host de invocación

Detecta automáticamente:
- Dev workstation → pivot rsync origin → dev → target
- Target VPS → directo origin → target (más eficiente)
- Origin VPS → ABORTA (no migrar desde adentro del origin)

## Documentación canónica

Skill completo en `workflows/.claude/migrate-project.md`. Runbook con edge cases (twin staging, db.sqlite3 huérfano, Redis slot, frontend port collision) en `docs/migrate-project-runbook.md`.

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill
(migra UN proyecto origin → target; el veredicto nombra ambos hosts):

🟢 migrate-project <proj> <origin> → <target> OK — todas las celdas ✅
🟡 migrate-project <proj> <origin> → <target> OK con N warning(s) — ≥1 ⚠️ (blue-green, redis slot, port)
🔴 migrate-project <proj> <origin> → <target> — N error(es), revisar arriba — ≥1 ❌
⏸️ migrate-project <proj> <origin> → <target> — pausa manual pendiente — DNS flip / confirmar downtime
🚫 migrate-project <proj> <origin> → <target> — REFUSED (<razón>) — invocado desde origin VPS o repo viejo
⏭️ migrate-project <proj> <origin> → <target> — N/A o saltado — modo `--check` (dry-run)

| Dimensión | Estado | Detalle |
|---|---|---|
| Preflight (SSH + bootstrap + DNS) | ✅ | conectividad origin/target, target listo, TTL DNS |
| Clone + DB creds | ✅ | repo clonado en target, mysql-users.env poblado |
| MySQL setup | ✅ | extra_packages instalados + DB/usuario creados |
| Transfer de envs | ✅ | .env capturados en origin y restaurados en target |
| Snapshot + restore de datos | ✅ | DB + media + extra_paths transferidos al target |
| Runtime build | ✅ | venv + pip + frontend build en target |
| Systemd + nginx deploy | ✅ | units + nginx site (enable diferido a SSL) |
| Propagación de skills | ✅ | project_skills sincronizados en target |
| SSL emit + nginx enable | ✅ | cert emitido (certbot HTTP-01), site enabled |
| Cutover | ✅ | stop origin, delta dump, DNS flip, smoke, projects.yml flip |

Sustituciones por modo/estado:
- `--check` → veredicto ⏭️; cada dimensión reporta el plan (sin mutar).
- `--apply` → fila **Cutover** en ⏭️ (services en origin vivos; target en warm spare).
- Warnings (⚠️, veredicto 🟡): payment keys detectadas (blue-green recomendado),
  redis slot conflict, frontend port collision, `db.sqlite3` huérfano.
- Invocado desde el origin VPS o repo desactualizado → 🚫/❌ (safety gate / abort).

## Next steps
- (manual, operador) cambiar el A record del dominio a la IP del target en el panel DNS
- `bash scripts/maintenance/migrate-project.sh --rollback <proj> <target>` — si los smoke tests fallan post-cutover
- (otro VPS, origin) `ssh <origin> 'sudo systemctl disable <gunicorn_svc> <huey_svc>'` — deshabilitar services en origin tras validar
- (manual, ≥7d) `rm -rf /home/ryzepeck/backups/vps/<UTC>` — borrar el snapshot pesado en origin
- `git add projects.yml config/credentials/servers/<target>/mysql-users.env && git commit && git push` — commitear el flip de `server:` + cleanup de mysql-users.env
