---
name: migrate-project
description: "Migra un proyecto Django entre VPS del fleet (20 pasos: git clone, creds, snapshot, systemd+nginx deploy, SSL emit, cutover). Per-project, no whole-VPS. v1.3 con deploy automático de systemd units (paso 16) + nginx site (paso 17) + SSL cert chicken-and-egg handler (paso 19) + auto-cleanup mysql-users.env post-cutover (paso 20.9). Reducción ~30 min de manual work por migración."
argument-hint: "<project_name> <target_vps_alias> [--check|--apply|--cutover --confirm-downtime|--rollback]"
allowed-tools: Bash, Read, Edit
---

## Qué hace esta skill

Migra un proyecto Django entre dos VPS del fleet (origin → target) componiendo los scripts existentes vía `FORCE_SINGLE_PROJECT` + `FORCE_PROJECTS` env vars. NO migra un VPS completo (para eso usar `docs/migration-runbook.md`).

**Casos de uso típicos:**
- Mover un proyecto de un VPS saturado a uno nuevo
- Desacoplar un cliente de un host compartido a un VPS dedicado
- Rebalancear el fleet por requisitos de hardware (memoria, disco)

## Host de invocación

El orquestador detecta automáticamente dónde corre:

| Host | Comportamiento |
|---|---|
| Dev workstation | Pivot rsync: origin → dev → target |
| Target VPS (destino) | Directo: origin → target (más eficiente, menos hops) |
| Origin VPS (origen) | **ABORTA** (no migrar desde adentro del origin) |
| Otro host con SSH a ambos | Asume rol pivot, como dev |

La detección usa `resolve_server_alias` + `is_dev_machine` de `scripts/lib/bootstrap-common.sh`.

## Entorno requerido

**Pre-requisitos en target:**
- Bootstrap aplicado (`bootstrap.sh --apply` ya corrido — default desde
  2026-05-19 ya skipea Phase 4.5-4.9; el runtime del proyecto migrado
  llega por este script vía `FORCE_SINGLE_PROJECT`, no por bootstrap.sh)
- nginx + letsencrypt directories presentes
- `config/credentials/servers/<target_alias>/mysql-users.env` existe (puede estar vacío)
- SSH alias funcional desde el host de invocación (Tailscale o `~/.ssh/config`)

**Pre-requisitos en projects.yml:**
- El proyecto existe en `projects.yml` con `server: <origin>` correcto
- Opcionalmente, declarar `extra_paths:` (dirs custom fuera de MEDIA_PATH) y `extra_packages:` (apt packages no-en-packages.list)

## Modos

| Modo | Qué hace | ¿Downtime? |
|---|---|---|
| `--check` | Preflight + dry-run report de los 16 pasos. Sin mutaciones. | No |
| `--apply` | Pasos 1-15: snapshot + transfer + clone + DB + media + bootstrap en target. Services en origin SIGUEN VIVOS. Idempotente. | No |
| `--cutover --confirm-downtime` | Paso 16: stop origin → final delta dump → start target → DNS guidance → smoke tests → commit `projects.yml` flip | **Sí, ≤5 min HTTP / ≈0 min si SSL blue-green** |
| `--rollback` | Restart origin services, deja target en warm spare. DNS flip back es manual. | Reversión |

## Flujo recomendado

```bash
# 1. Preflight (cualquier momento, sin riesgo)
bash scripts/maintenance/migrate-project.sh --check mimittos_project vps-projectapp-prod

# 2. Apply (sin downtime; target queda en warm spare)
bash scripts/maintenance/migrate-project.sh --apply mimittos_project vps-projectapp-prod

# 3. Cutover (ventana acordada con stakeholders)
bash scripts/maintenance/migrate-project.sh --cutover --confirm-downtime \
     mimittos_project vps-projectapp-prod

# 4. Si algo falla post-cutover:
bash scripts/maintenance/migrate-project.sh --rollback mimittos_project vps-projectapp-prod
```

---

## Por qué clone es el primer paso (v1.1)

En v1 (orden original) el snapshot de DB+media+extras era el primer acto
en origin. Eso significaba que cualquier falla en la fase de target —
deploy key no autorizado, mysql-users.env mal poblado, paquete apt
inexistente — aparecía **DESPUÉS** de haber gastado 30-60 min en un
snapshot pesado que tal vez no se iba a usar.

v1.1 invierte el orden: **clone es el primer acto de modificación**.
Failure modes operativos comunes (auth GitHub, repo no clonable) se
detectan en ≤10s, no después de un round-trip de varios GB de media.

Además, la lectura de credenciales DB (`DB_USER`, `DB_PASSWORD`) ya
no requiere el snapshot completo — son 2 líneas que se leen vía
`ssh origin sudo grep ... backend/.env` en paso 5 (KB-scale lectura).
Esto desbloquea hacer `setup-mysql.sh` en paso 8 antes del snapshot
pesado en paso 12.

---

## Los 20 pasos (v1.3)

### Paso 1 — Preflight SSH/Tailscale + repo version check

Verifica conectividad SSH a origin y target. Después chequea que ambos
hosts tengan la versión del repo con `FORCE_SINGLE_PROJECT` implementado
en `scripts/lib/project-definitions.sh`. Si alguno tiene versión vieja,
aborta con instrucción de `git pull` (Hardening D v1.1).

### Paso 2 — Target bootstrap status

Confirma que el target tiene `/etc/nginx/nginx.conf`, `/etc/letsencrypt/`,
y `certbot` instalado. Si no, aborta con instrucción de correr
`bootstrap.sh --apply` primero (default skipea Phase 4.5-4.9, que es lo
correcto para preparar un target de migración).

### Paso 3 — DNS pre-check

`dig +short A <domain>` resuelve el dominio del proyecto. Captura TTL y
avisa si > 300s (recomendación: bajar a 60s al menos 24h antes del
cutover).

### Paso 4 — Clone project repo en target (PRIMER acto de modificación)

```bash
FORCE_SINGLE_PROJECT=<proj> FORCE_PROJECTS=<proj> \
bash scripts/bootstrap/clone-projects.sh --apply
```

Usa el deploy key existente. `FORCE_SINGLE_PROJECT` permite clonar aunque
`projects.yml` aún diga `server: <origin>` (el flip de `server:` se hace
en paso 18 cutover).

**v1.1 insight:** movido desde paso 10 al inicio para fail-fast en auth
de GitHub (≤10s vs ≤30min después del snapshot).

### Paso 5 — Read DB creds + payment keys DEL REPO (single source of truth)

```bash
grep -E '^(DB_USER|DB_PASSWORD|WOMPI_*|STRIPE_*|PAYPAL_*)\s*=' \
  config/credentials/projects/<proj>/prod.env
```

Lectura local del repo (`config/credentials/projects/<proj>/<env>.env`),
que es el source-of-truth desde 2026-05-17 (Fase 4 de centralización de
credenciales). Sin SSH, sin file I/O remoto.

Si el archivo no existe → falla con instrucción de correr
`sync-credentials.sh capture --env=prod --apply` primero.

**v1.2 insight:** el repo ES la fuente de verdad. Antes (v1.1) leíamos
el `.env` runtime de origin via SSH; eso funcionaba pero ignoraba que el
repo ya tenía la misma información, y si live-vs-repo drift existía,
quién ganaba era ambiguo.

### Paso 6 — Build/append `mysql-users.env` del target

Si `config/credentials/servers/<target>/mysql-users.env` no existe en
target, lo **bootstrapea** con `BACKUP_USER` + `BACKUP_USER_PASSWORD`
desde `config/credentials/global/backup-env`.

Después appendea `DB_USER_<PROJ>` y `DB_PASSWORD_<PROJ>` (leídos del paso
5) marcados con `# migration-temp:<proj>`.

**Por qué un marker temp:** mientras `projects.yml` diga
`server: <origin>` (hasta paso 18 cutover), `build-mysql-users-env.sh`
no incluiría al proyecto al regenerar limpio. El marker documenta que
es un append provisional. Después del cutover (server: flip), el
operador re-corre:

```bash
bash scripts/maintenance/build-mysql-users-env.sh --server=<target> --apply
```

…que regenera `mysql-users.env` desde el source-of-truth, eliminando el
marker.

**Importante:** después del append, el operador debe commitear +
pushear el archivo y correr `git pull` en target antes de continuar
(paso 8 lo hace inline al inicio de setup-mysql).

### Paso 7 — Install `extra_packages` en target

```bash
sudo apt-get install -y ${EXTRA_PACKAGES[$proj]}
```

Ejemplo: mimittos requiere `ffmpeg` para procesar audios de usuarios
(pydub depende de ffmpeg a nivel sistema, no en `packages.list`).

### Paso 8 — `setup-mysql.sh` en target

Crea DB vacía + user + grants. Hace `git pull --ff-only` al inicio para
que el `mysql-users.env` del paso 6 (commiteado y pusheado por el
operador) esté disponible.

```bash
FORCE_SINGLE_PROJECT=<proj> FORCE_PROJECTS=<proj> \
sudo bash scripts/bootstrap/setup-mysql.sh --apply
```

### Paso 9 — Capture project envs en origin

```bash
FORCE_SINGLE_PROJECT=<proj> \
sudo bash scripts/maintenance/capture-project-envs.sh --apply --out=<dir>
```

Captura `backend/.env`, `frontend/.env*` y variantes underscore
(`.env_development`, `.env_production`). Detecta `db.sqlite3` huérfano
y emite warn (decisión manual si copiarlo).

### Paso 10 — Transfer envs origin → target (lightweight, <100KB)

`rsync` con `--rsync-path="sudo rsync"` para leer/escribir los .env
root-owned. Decisión automática por `HOST_ROLE`:
- `target` (corriendo EN target): `origin → here` directo
- `dev`/`other`: `origin → pivot → target`

### Paso 11 — Restore project envs en target

```bash
FORCE_SINGLE_PROJECT=<proj> \
sudo bash scripts/maintenance/restore-project-envs.sh --apply --from=<dir>
```

Después detecta conflictos de Redis DB slot y emite warn con el comando
sed exacto (NO muta automáticamente — bugs de slot son silenciosos y
catastróficos).

### Paso 12 — Snapshot DB + media + extras en origin (HEAVY)

```bash
FORCE_SINGLE_PROJECT=<proj> FORCE_PROJECTS=<proj> \
bash scripts/maintenance/backup-mysql-and-media.sh
```

Genera (gracias a las extensiones del schema 2026-05-18):
- `db/<proj_db>.sql.gz`
- `apps/<proj>-<media_basename>.tar.gz`
- `apps/<proj>-extras.tar.gz` si `EXTRA_PATHS[$proj]` no vacío
- `SHA256SUMS`

Es el paso pesado del flow. Tiempo proporcional a media + DB size
(~30s mimittos, ~5min projectapp).

### Paso 13 — Transfer snapshot origin → target (HEAVY)

`rsync` del backup dir owned por ryzepeck (no necesita
`--rsync-path="sudo rsync"`). Verifica `SHA256SUMS` en el pivot si
HOST_ROLE != target.

### Paso 14 — Restore DB + media + extras en target

```bash
FORCE_SINGLE_PROJECT=<proj> FORCE_PROJECTS=<proj> \
sudo bash scripts/bootstrap/restore-from-backup.sh --apply --from=<dir>
```

Importa DB, extrae media tarball, y extrae extras tarball (kore
`data/exports`, projectapp `content/`).

### Paso 15 — venv + pip + frontend build + systemd

```bash
FORCE_SINGLE_PROJECT=<proj> FORCE_PROJECTS=<proj> \
sudo bash scripts/bootstrap/setup-project-environments.sh --apply
```

Crea venv, instala dependencias, builds frontend (si aplica), corre
`collectstatic` y deploya systemd units. **Deja services STOPPED** —
origin sigue sirviendo tráfico.

### Paso 16 — Deploy systemd units para el proyecto (v1.3 NEW)

Despliega los .service / .socket / .timer + drop-ins del proyecto desde
`config/systemd/` al `/etc/systemd/system/` del target + `daemon-reload`.

Files iterados (cuando existen en el repo):
- `<gunicorn_svc>.service`, `<gunicorn_svc>.socket`
- `<huey_svc>.service`
- `<proj_kebab>-clearsessions.{service,timer}`
- `<proj_kebab>-dbbackup.{service,timer}`
- Drop-ins: `<gunicorn_svc>.environment.conf`, `<gunicorn_svc>.override.conf` (MemoryMax), `<huey_svc>.override.conf`

Reemplaza el manual work descubierto durante kore (~9 `sudo install`
manuales + `daemon-reload`).

### Paso 17 — Deploy nginx site para el proyecto (v1.3 NEW, NO enable todavía)

```bash
sudo install -m 644 config/nginx/sites-available/<proj> /etc/nginx/sites-available/<proj>
```

**Importante:** NO crea el symlink a `sites-enabled/` aún. El cert no
existe todavía → si enable + reload nginx ahora, falla por `ssl_certificate`
refs missing. El enable se hace en paso 19 después del cert emit.

### Paso 18 — Propagar project_skills

```bash
bash scripts/maintenance/sync-shared-skills.sh --apply --project=<proj>
```

Sincroniza las skills custom declaradas en `project_skills:` al
`.claude/` del nuevo proyecto en target.

### Paso 19 — Emit SSL cert + enable nginx site (v1.3 EXPANDED)

Invoca el helper nuevo `scripts/bootstrap/emit-project-ssl-cert.sh <proj>`
que maneja el chicken-and-egg de cert + site:

1. Pre-create `/etc/letsencrypt/options-ssl-nginx.conf` si missing (EFF standard content)
2. Pre-generate `/etc/letsencrypt/ssl-dhparams.pem` si missing (`openssl dhparam 2048`)
3. Skip si cert ya existe para el dominio primario
4. Si necesita emitir:
   - Disable site temporal (rm sites-enabled symlink) + reload nginx
   - `certbot --nginx -d <primary> -d <san1> ...` (HTTP-01 challenge)
   - Re-enable site (ln -sf) + reload nginx
5. Reporta cert path + expiry

Si `SSL_STRATEGY` (decidido en paso 5) es `blue-green-recommended`, este
paso warneea — el operator puede abortar y hacer blue-green manual (capture
letsencrypt en origin → restore en target) en vez de HTTP-01 con downtime.

### Paso 20 — CUTOVER (ventana de downtime)

Sólo se ejecuta con `--cutover --confirm-downtime`:

1. **Stop** `<gunicorn_svc>` + `<huey_svc>` en origin (downtime starts).
2. **Final delta mysqldump** en origin via `mysqldump --defaults-file=/etc/mysql/debian.cnf` → rsync a target → import en target (captura escrituras durante la ventana de pasos 4-19).
3. **Start** services en target.
4. **DNS flip guidance**: imprime IP del target, espera confirmación del operador (operador cambia A record en panel DNS).
5. **Dig loop** hasta resolver target (timeout 5 min).
6. **Emit SSL** vía certbot HTTP-01 (solo si paso 19 lo defirió por blue-green).
7. **Smoke tests**: `curl -fsS https://<domain>/`, `systemctl is-active`.
8. **Commit `projects.yml`**: flip de `server: <origin>` → `<target>` (el skill hace el `awk` surgical; commit + push manual).
9. **(v1.3 NEW) Auto-cleanup `mysql-users.env`**: corre `build-mysql-users-env.sh --server=<target> --apply` para regenerar el archivo limpio sin marker `migration-temp:<proj>`. Reporta diff; commit + push manual.

---

## Edge cases conocidos

### Twin staging co-ubicado

Si el proyecto tiene un staging twin en el mismo VPS (caso `kore_project` + `kore_project_staging` en `srv571894`), correr la skill **dos veces** — una por environment. NO hay modo bulk. El operador decide el orden (recomendación: staging primero, validar, después prod).

### `db.sqlite3` huérfano

Si origin tiene `backend/db.sqlite3` además de MySQL (caso `projectapp`), la skill emite warn pero NO copia automáticamente. Casos:
- Si es runtime de silk → ignorar (silk lo regenera en target)
- Si tiene state real → copiar manual: `scp <origin>:/home/ryzepeck/webapps/<proj>/backend/db.sqlite3 <target>:/home/ryzepeck/webapps/<proj>/backend/`

### Redis DB slot conflict

Si el `redis_db: N` del proyecto colisiona con otro proyecto ya residente en target, la skill emite warn pero NO muta. El operador decide:
- Reasignar slot del proyecto migrado (sed sobre `HUEY_REDIS_URL` en `.env`)
- Reasignar slot del otro proyecto (más invasivo)

### Frontend port collision

Si el proyecto tiene frontend service (mimittos puerto 3002, tuhuella 3001, xpandia 3003, vastago 3004) y el puerto está tomado en target, la skill emite warn en paso 2 (preflight). El operador reasigna manualmente en el `frontend/.env` antes de continuar.

### Pago en producción (downtime impacta cobros)

Para proyectos con Wompi/Stripe/PayPal PROD activos (mimittos, kore, otros), usar el flujo SSL blue-green (paso 15). Si el operador no lo configura, el downtime de HTTPS (~2 min mientras certbot emite HTTP-01) puede causar transacciones rechazadas.

---

## Rollback

Si los smoke tests fallan post-cutover o se descubre un bug crítico:

```bash
bash scripts/maintenance/migrate-project.sh --rollback <project> <target_vps>
```

Esto:
1. Reinicia services en origin (gunicorn + huey).
2. Detiene services en target (warm spare).
3. Imprime instrucción manual para DNS flip back.

Datos escritos en target durante la ventana de cutover **se pierden** (riesgo aceptable porque la ventana son minutos). El operador hace DNS flip back en el panel del provider.

---

## Verificación end-to-end

### `--check` smoke test (runnable hoy)

```bash
bash scripts/maintenance/migrate-project.sh --check mimittos_project vps-projectapp-prod
bash scripts/maintenance/migrate-project.sh --check kore_project    vps-projectapp-prod
bash scripts/maintenance/migrate-project.sh --check projectapp      vps-projectapp-prod
```

Esperado: 0 errores. Warnings esperados:
- `mimittos`: payment keys detectadas → blue-green recomendado
- `kore`: payment keys detectadas → blue-green recomendado
- `projectapp`: ninguna (sin payment processor)

### Primera migración real recomendada: `mimittos_project`

Caso más simple del set analizado: sin twin staging, sin `extra_paths`, sólo `extra_packages: [ffmpeg]`. DB pequeña (37 KB gz), media chica (2.7 MB gz).

---

## Output final

Cierra siguiendo `[[_output-protocol]]`: veredicto + tabla por paso + next steps.

Ejemplo de cierre exitoso:

```
🟢 migrate-project mimittos_project → vps-projectapp-prod OK

| Paso | Status |
|---|---|
| 1. Preflight SSH       | ✅ |
| 2. Target bootstrap    | ✅ |
| ... (todos los pasos)  | ✅ |
| 16. Cutover            | ✅ |

Next steps:
  - Validar smoke tests adicionales (audio upload UI)
  - Borrar snapshot en origin después de 7d: rm -rf /home/ryzepeck/backups/vps/<UTC>
  - Disable services en origin: ssh <origin> 'sudo systemctl disable <gunicorn> <huey>'
```
