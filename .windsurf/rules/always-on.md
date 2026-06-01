---
description: Reglas base del fleet — siempre activas. Sincronizadas desde vps-ops-toolkit/workflows/.windsurf/base/rules/.
trigger: always_on
---

<!-- fleet-base:begin v=1 -->
# Reglas base del fleet — G__PROJECT_LABEL__M Staging

## Convencion de lenguaje

- Documentacion, comentarios y mensajes de commit en **ingles**.
- Codigo, identificadores y nombres de variable en **ingles**.
- Mensajes de error visibles al usuario en el idioma del proyecto.

## Session start

Al inicio de cada sesion, antes de editar archivos: hacer `git fetch` y
revisar el estado del repo. Si la copia local esta atrasada o sucia, hacer
sync (rebase contra parent branch) antes de cambiar archivos. Nunca usar
`git pull --force`, `git reset --hard` o stash automatico para "resolver"
diferencias.

## Comportamiento general del agente

- No hacer cambios destructivos sin confirmacion.
- Investigar antes de borrar archivos/directorios desconocidos.
- Para acciones que afectan estado compartido (push, deploy, mensajes a
  servicios externos), pedir confirmacion explicita salvo autorizacion
  previa documentada.

<!-- fleet-base:end -->
