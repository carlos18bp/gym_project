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
