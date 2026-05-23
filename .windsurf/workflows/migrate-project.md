---
description: Migra un proyecto Django entre VPS del fleet (per-project, no whole-VPS). 18 pasos con tres gates (--check, --apply, --cutover). v1.1 reordena con git clone como primer acto de modificación + inline DB credential read via SSH (sin esperar al snapshot pesado) + 3 bug fixes (sudo en payment probe, rsync sudo, delta dump perms) + version check del repo en origin/target.
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
