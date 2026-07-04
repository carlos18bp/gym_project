---
description: Migra un proyecto Django entre VPS del fleet (per-project, no whole-VPS). 20 pasos con tres gates (--check, --apply, --cutover). v1.3 con deploy automático de systemd units (paso 16) + nginx site (paso 17) + SSL cert chicken-and-egg handler vía emit-project-ssl-cert.sh (paso 19) + auto-cleanup mysql-users.env post-cutover (paso 20.9). Reducción ~30 min de manual work por migración vs v1.2.
---

# Migrate Project — Per-project migration entre VPS del fleet

Migra un proyecto Django entre dos VPS del fleet (origin → target). NO migra un VPS completo (para eso usar `docs/migration-runbook.md`).

## Cuándo usar

- Mover un proyecto de un VPS saturado a uno nuevo.
- Desacoplar un cliente de un host compartido a un VPS dedicado.
- Rebalancear el fleet por requisitos de hardware (memoria, disco).

## Modos

```bash
# Preflight, no muta nada
bash scripts/maintenance/migrate-project.sh --check <project> <target_vps>

# Snapshot + transfer + setup en target (sin downtime)
bash scripts/maintenance/migrate-project.sh --apply <project> <target_vps>

# Cutover (downtime ≤ 5 min)
bash scripts/maintenance/migrate-project.sh --cutover --confirm-downtime <project> <target_vps>

# Rollback (DNS flip back es manual)
bash scripts/maintenance/migrate-project.sh --rollback <project> <target_vps>
```

## Pre-requisitos

| Pre-requisito | Cómo verificar |
|---|---|
| Target VPS bootstrapped | `ssh <target> 'test -f /etc/nginx/nginx.conf && test -d /etc/letsencrypt/live'` |
| `mysql-users.env` existe en target | `cat config/credentials/servers/<target>/mysql-users.env` |
| SSH alias funcional | `ssh <origin> hostname; ssh <target> hostname` |
| `projects.yml` lista el proyecto con `server: <origin>` correcto | `grep -A2 "name: <project>" projects.yml` |

## Documentación canónica

Skill completo en `workflows/.claude/migrate-project.md`. Runbook complementario con edge cases en `docs/migrate-project-runbook.md`.

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
