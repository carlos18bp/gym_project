---
description: Reglas base del fleet — siempre activas. Sincronizadas desde vps-ops-toolkit/workflows/.windsurf/base/rules/.
trigger: always_on
---

<!-- fleet-base:begin v=1 -->
# Reglas base del fleet — G&M Staging

## Convencion de lenguaje

- Codigo, identificadores y nombres de variable: **ingles**.
- Mensajes de commit: **ingles** (Conventional Commits).
- Docs operativos, skills y reportes: **espanol** (terminos tecnicos en ingles donde son de uso corriente).
- Mensajes de error visibles al usuario final: idioma del proyecto.

## Session start

Al inicio de cada sesion, antes de editar archivos: hacer `git fetch` y
revisar el estado del repo. Si la copia local esta atrasada o sucia, hacer
sync (rebase contra parent branch) antes de cambiar archivos. Nunca usar
`git pull --force`, `git reset --hard` o stash automatico para "resolver"
diferencias.

<!-- git-branch-protocol:begin -->
## Reglas de trabajo con Git: ramas y commits

- **Nunca** commitear directo sobre `main`/`master` (protegidas; el push se rechaza).
- **Default: REUTILIZAR la rama abierta**, no crear una nueva. Convencion del fleet:
  maximo 1 PR feature activo por proyecto; cada pieza de trabajo es un COMMIT mas
  sobre esa rama, no una rama nueva. Solo se crea rama estando en `main`/`master`
  sin ninguna rama abierta.
- **(Fleet) Coordenada de trabajo:** si existe `~/webapps/vps-ops-toolkit/projects.yml`,
  correr antes de commitear:
  `bash ~/webapps/vps-ops-toolkit/scripts/maintenance/resolve-work-coordinate.sh --check <proyecto>`.
  `host_status=wrong-host` → PARAR y avisar (el trabajo va en otro clon);
  `resolved_branch` release → checkout a esa rama y commitear ahi;
  `matches_yml=no` o `yml-stale` → avisar al operador (refresh del yml desde el toolkit).
- **Buscar rama abierta:** `gh pr list --state open` (o `git branch -r` sin
  main/master/release-*). UNA → checkout y commitear ahi; VARIAS → preguntar;
  NINGUNA → crear con formato `<prefijo>/<DDMMYYYY>-<descripcion-corta>`
  (prefijos feat/fix/docs/refactor/test/chore/style/perf/ci/hotfix; fecha de
  `date +%d%m%Y`, nunca asumida; kebab-case ≤5 palabras).
- **Cierre:** mensajes Conventional Commits; tras un push que crea rama nueva,
  reportar la URL del PR (`PR URL: <url>`).
<!-- git-branch-protocol:end -->

## Comportamiento general del agente

- No hacer cambios destructivos sin confirmacion.
- Investigar antes de borrar archivos/directorios desconocidos.
- Para acciones que afectan estado compartido (push, deploy, mensajes a
  servicios externos), pedir confirmacion explicita salvo autorizacion
  previa documentada.

<!-- fleet-base:end -->
