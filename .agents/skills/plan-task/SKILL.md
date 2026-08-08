---
name: plan-task
description: "Wrapper parametrizado de `/plan` — recibe en `$ARGUMENTS` la descripción explícita de la tarea/feature/refactor/bug a planear y produce un plan decision-complete sin volver a preguntar el alcance al usuario."
argument-hint: "<descripción de la tarea a planear, en lenguaje natural>"
---

# Plan Task — Wrapper parametrizado de `/plan`

## Goal
Aplicar el workflow `/plan` sobre una tarea cuya descripción ya viene completa en los argumentos. Producir un plan que otro agente o ingeniero pueda implementar sin tomar nuevas decisiones de producto o arquitectura, **sin pedir al usuario que repita el alcance** que ya entregó como parámetro.

## Inputs
- `$ARGUMENTS` (obligatorio): descripción de la tarea a planear. Puede ser una sola línea ("agregar dark mode al panel admin") o un párrafo con criterios de aceptación, archivos involucrados, restricciones, etc.
- Si `$ARGUMENTS` está vacío, **no proceder**: pedir al usuario que reinvoque el skill incluyendo la tarea.

## Constraints
- **Solo planeación, no implementación.** No editar archivos del repo durante la ejecución de este skill.
- No volver a preguntar al usuario datos que ya estén en `$ARGUMENTS` o que se puedan derivar leyendo el repo.
- Cumplir las reglas del repo: respetar los archivos guía del proyecto (`AGENTS.md`, `CLAUDE.md`, `docs/`, etc.) si existen.
- No tocar memory files ni `tasks/` salvo que el plan mismo sea sobre metodología/runtime.

## Workflow
1. **Parseo del input.** Tratar `$ARGUMENTS` como la especificación canónica de la tarea. Extraer (si están presentes): objetivo, archivos/áreas mencionadas, restricciones, criterios de aceptación.
2. **Inspección del repo.** Buscar evidencia: archivos referenciados en `$ARGUMENTS`, patrones existentes (patrones existentes del proyecto), tests relacionados. Usar Explore agents en paralelo si el alcance toca >2 áreas.
3. **Mapeo del cambio.** Data flow afectado, APIs, manejo de estado, superficie de tests, migraciones.
4. **Decisiones implícitas.** Si hay tradeoffs no resueltos, elegir el camino que mejor se alinee con las convenciones existentes y dejarlo registrado en *Assumptions/Defaults*. Solo preguntar al usuario si la decisión es de **producto** y no se puede derivar.
5. **Plan final** según la plantilla de `/plan` (regla de alias del protocolo).

## Rules
- Este skill no implementa ni commitea. Si el usuario quiere ejecutar el plan, debe invocar `/implement` después.
- Reusar utilidades, composables y servicios existentes antes de proponer código nuevo (regla de oro).
- No proponer cambios a migraciones existentes; sí proponer migraciones nuevas si el plan lo requiere.

## Ejemplos de invocación
- `/plan-task agregar paginación server-side al listado principal (20 por página, mantener filtros actuales)`
- `/plan-task refactor: extraer la lógica de cálculo de totales a un módulo reutilizable, sin cambiar la UI`
- `/plan-task bug: cuando el usuario edita un diagnóstico y no toca el campo X, el backend lo está sobrescribiendo a null. Investigar y planear el fix.`

---

## Output final

Reportar siguiendo [[_output-protocol]]. Misma plantilla que `/plan`.
