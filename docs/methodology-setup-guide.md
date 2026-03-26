# Methodology Setup and Documentation Project Guide — Claude Code

Guía para implementar el sistema de Memory Bank en Claude Code (migrado desde Windsurf).

---

## ¿Qué es el Memory Bank?

Un sistema de documentación persistente que mantiene contexto del proyecto para el AI, con 3 workflows principales:

* **Plan** → `/project:plan` — Planificación con clarificación de requisitos, formulación de solución y validación
* **Implement** → `/project:implement` — Implementación iterativa con análisis de dependencias y testing obligatorio
* **Debug** → `/project:debug` — Debugging read-only con diagnóstico estructurado en 4 fases

---

## Diferencias clave vs Windsurf

| Concepto | Windsurf | Claude Code |
|----------|----------|-------------|
| Reglas always-on | `.windsurf/rules/*.md` con trigger | `CLAUDE.md` (raíz, `backend/`, `frontend/`) — se cargan automáticamente |
| Workflows invocables | `.windsurf/workflows/*.md` | `.claude/skills/<nombre>/SKILL.md` — se invocan con `/project:nombre` |
| Modos (Plan/Implement) | `model_decision` trigger | **Invocación proactiva** — Claude puede invocar skills automáticamente cuando el contexto coincide con la `description` |
| Control de invocación | `auto_execution_mode` | `disable-model-invocation: true` en frontmatter — bloquea invocación proactiva |
| Datos de metodología | `.windsurf/rules/methodology/` | `docs/methodology/` y `tasks/` |
| Configuración del proyecto | Scattered en rules | Concentrada en `CLAUDE.md` raíz |

---

## Skills vs Commands (por qué skills)

Claude Code soporta dos sistemas de workflows invocables:

| Aspecto | Commands (legacy) | Skills (actual) |
|---------|-------------------|-----------------|
| Ubicación | `.claude/commands/<nombre>.md` | `.claude/skills/<nombre>/SKILL.md` |
| Invocación | Solo manual (`/project:nombre`) | Manual **o proactiva** (Claude decide usar el skill cuando el contexto coincide) |
| Frontmatter | Solo `description` | `name`, `description`, `disable-model-invocation`, `allowed-tools`, `argument-hint`, `user-invocable`, `context`, `agent`, `effort`, `model` |
| Archivos de soporte | No | Sí — archivos adicionales junto al `SKILL.md` |
| Precedencia | Menor | Mayor — si ambos existen con el mismo nombre, el skill gana |

**Recomendación**: Usar siempre skills. Commands siguen funcionando pero son legacy.

### Invocación proactiva

Cuando `disable-model-invocation` está omitido o es `false`, Claude puede decidir usar el skill automáticamente cuando la `description` coincide con lo que el usuario pide. Esto es equivalente al `model_decision` trigger de Windsurf.

**Ejemplo**: Si el usuario dice "tengo este error...", Claude puede invocar automáticamente `/project:debug` porque la description del skill dice *"Use when the user reports a bug, error, or unexpected behavior"*.

### Bloqueo de invocación proactiva

Skills peligrosos (deploy, git-commit, creación de contenido en producción) usan `disable-model-invocation: true` para que **solo el usuario** pueda invocarlos manualmente.

---

## Paso 1: Crear estructura de directorios

```bash
# Directorios de documentación (Memory Bank data)
mkdir -p docs/methodology
mkdir -p docs/literature
mkdir -p tasks/rfc

# Directorios de Claude Code skills
mkdir -p .claude/skills
```

---

## Paso 2: Crear CLAUDE.md (3 archivos)

Claude Code carga automáticamente `CLAUDE.md` del directorio donde trabajas. Se usan 3 niveles:

| Archivo | Contenido | Equivalente Windsurf |
|---------|-----------|---------------------|
| `CLAUDE.md` (raíz) | Identidad del proyecto, reglas generales, seguridad, Memory Bank, estructura de directorio, testing, lessons-learned, error-docs | `rules.md` + `memory.md` + `directory-structure.md` + `security-rules.md` + `lessons-learned.md` + `error-documentation.md` (todos Always On) |
| `backend/CLAUDE.md` | Django/DRF rules, i18n backend, testing backend | `django-python-cursor-rules.md` + secciones backend de `i18n-rules.md` y `testing-quality-standards.md` |
| `frontend/CLAUDE.md` | Framework rules (Vue/Nuxt o React/Next.js), Tailwind, Jest, Playwright, i18n frontend, SEO, coverage standards | `nuxtjs-vue-*.md` o `nextjs-*.md` + `tailwind-rules.md` + `jest-testing-rules.md` + `playwright-cursor-rules.md` + `seo-rules.md` + `coverage-report-standard.md` + `e2e-flow-coverage-standard.md` |

**Nota**: En Windsurf se necesitaban archivos separados con triggers. En Claude Code, todo el contenido always-on se consolida en `CLAUDE.md`. No condensar — mantener detalle completo.

### Secciones obligatorias del CLAUDE.md raíz

```markdown
# [Nombre del Proyecto] — Claude Code Configuration

## Project Identity
- Name, Domain, Stack, Server path, Services, Settings module

## General Rules
- Split responses, suggest improvements (S1, S2, S3)

## Security Rules — OWASP / Secrets / Input Validation
- (contenido completo de security-rules.md)

## Memory Bank System
- Tabla de 7 core files con paths y propósitos
- Diagrama Mermaid de dependencias
- Cuándo leer / cuándo actualizar

## Directory Structure
- Diagrama Mermaid del proyecto

## Testing Rules
- Constraints (nunca full suite, máx 20 tests, activar venv)
- Quality standards

## Lessons Learned — [Proyecto]
- (contenido de lessons-learned.md)

## Error Documentation — [Proyecto]
- (contenido de error-documentation.md)
```

---

## Paso 3: Crear skills en `.claude/skills/`

Los workflows de Windsurf se convierten en skills. Cada skill es un **directorio** con un archivo `SKILL.md`. Se invocan con `/project:nombre`.

### Categorías de skills

#### A. Methodology skills — Claude PUEDE invocar proactivamente

Estos skills NO llevan `disable-model-invocation`, lo que permite que Claude los use automáticamente cuando detecta que el contexto coincide con la `description`.

| Skill | Directorio | Descripción | `argument-hint` |
|-------|-----------|-------------|-----------------|
| `plan` | `.claude/skills/plan/SKILL.md` | Planificación: leer docs → clarificar → formular → validar | `"[description of the feature or problem to plan]"` |
| `implement` | `.claude/skills/implement/SKILL.md` | Implementación: analizar → planear → cambiar → testear → loop | `"[description of what to implement]"` |
| `debug` | `.claude/skills/debug/SKILL.md` | Debug read-only: capturar → analizar → recomendar → plan verificación | `"[description of the bug, error message, or unexpected behavior]"` |
| `methodology-setup` | `.claude/skills/methodology-setup/SKILL.md` | Inicializar/refrescar Memory Bank | — |

#### B. Test/coverage skills — Claude PUEDE invocar (safe, read-only analysis)

| Skill | Directorio |
|-------|-----------|
| `test-quality-gate` | `.claude/skills/test-quality-gate/SKILL.md` |
| `backend-test-coverage` | `.claude/skills/backend-test-coverage/SKILL.md` |
| `frontend-unit-test-coverage` | `.claude/skills/frontend-unit-test-coverage/SKILL.md` |
| `frontend-e2e-test-coverage` | `.claude/skills/frontend-e2e-test-coverage/SKILL.md` |
| `e2e-user-flows-check` | `.claude/skills/e2e-user-flows-check/SKILL.md` |
| `new-feature-checklist` | `.claude/skills/new-feature-checklist/SKILL.md` |

#### C. Git skill — Solo invocación manual del usuario

| Skill | Directorio | `disable-model-invocation` | `allowed-tools` |
|-------|-----------|:-:|---|
| `git-commit` | `.claude/skills/git-commit/SKILL.md` | **true** | `Bash` |

#### D. Deploy skills — Solo invocación manual del usuario

| Skill | Directorio | `disable-model-invocation` | `allowed-tools` | `argument-hint` |
|-------|-----------|:-:|---|---|
| `deploy-and-check` | `.claude/skills/deploy-and-check/SKILL.md` | **true** | `Bash` | — |
| `deploy-staging` | `.claude/skills/deploy-staging/SKILL.md` | **true** | `Bash` | `"[branch-name, e.g. release/march-2026]"` |

#### E. Skills únicos por proyecto (si aplica)

| Skill | Proyecto | `disable-model-invocation` | `allowed-tools` |
|-------|---------|:-:|---|
| `blog-ai-weekly` | projectapp | **true** | `Bash, WebSearch, WebFetch` |
| `server-diagnostic-report` | gym_project | **true** | `Bash` |

### Formato de un SKILL.md

```yaml
---
name: nombre-del-skill
description: "Descripción que Claude usa para decidir cuándo invocar el skill proactivamente. Incluir contexto de cuándo usarlo."
disable-model-invocation: true  # Solo para skills peligrosos — omitir para skills seguros
allowed-tools: Bash              # Opcional — restringe qué herramientas puede usar
argument-hint: "[hint text]"     # Opcional — autocomplete hint para el usuario
---

# Título

(contenido del workflow — sin auto_execution_mode, sin trigger,
sin referencias a use_mcp_tool, read_file, grep_search de Windsurf)
```

### Campos de frontmatter disponibles

| Campo | Tipo | Requerido | Descripción |
|-------|------|:-:|-------------|
| `name` | string | ✅ | Nombre del skill (debe coincidir con el directorio) |
| `description` | string | ✅ | Descripción usada para invocación proactiva y autocompletado |
| `disable-model-invocation` | bool | No | `true` = solo el usuario puede invocar. Omitir = Claude puede invocar proactivamente |
| `allowed-tools` | string | No | Lista de herramientas permitidas (e.g., `Bash`, `Bash, WebSearch`) |
| `argument-hint` | string | No | Hint de autocomplete para argumentos |
| `user-invocable` | bool | No | `false` = el usuario no puede invocar directamente (solo Claude). Default: `true` |
| `context` | string | No | Archivos a incluir como contexto adicional |
| `agent` | bool | No | `true` = ejecutar en un subagente |
| `effort` | string | No | Nivel de esfuerzo de razonamiento |
| `model` | string | No | Override del modelo para este skill |

### Variable `$ARGUMENTS`

Los skills soportan sustitución de argumentos con `$ARGUMENTS`. Útil para deploy-staging:

```yaml
---
name: deploy-staging
description: "Deploy a release branch to the staging server for client UAT. Pass the branch name as argument."
disable-model-invocation: true
allowed-tools: Bash
argument-hint: "[branch-name, e.g. release/march-2026]"
---

Deploy branch `$ARGUMENTS` to staging...
```

Uso: `/project:deploy-staging release/march-2026`

---

## Paso 4: Inicializar Memory Files

Invocar el skill:

```
/project:methodology-setup
```

Esto hará un deep-dive del codebase y creará/actualizará los 7 archivos core:

| # | Archivo | Contenido |
|---|---------|-----------|
| 1 | `docs/methodology/product_requirement_docs.md` | PRD: overview, problemas, features, usuarios, reglas de negocio |
| 2 | `docs/methodology/technical.md` | Stack con versiones, dev setup, env config, design patterns, testing strategy |
| 3 | `docs/methodology/architecture.md` | Diagramas Mermaid: sistema, request flow, ER, deployment, workflows actuales |
| 4 | `tasks/tasks_plan.md` | Estado de features, issues conocidos, status de testing con conteos exactos |
| 5 | `tasks/active_context.md` | Estado actual, foco reciente, decisiones activas, próximos pasos |
| 6 | `docs/methodology/error-documentation.md` | Errores conocidos y resoluciones |
| 7 | `docs/methodology/lessons-learned.md` | Patrones de arquitectura, convenciones, workflow, testing insights |

---

## Paso 5: Verificar y corregir

Después de la inicialización, revisar cada archivo:

* ¿La arquitectura descrita es correcta?
* ¿El stack técnico está completo con versiones?
* ¿Los requisitos reflejan el producto?
* ¿Los conteos (modelos, componentes, tests) son exactos?

Editar manualmente lo que no sea correcto. Estos archivos son la memoria persistente.

---

## Estructura final del proyecto

```
tu-proyecto/
├── .claude/
│   └── skills/
│       ├── plan/
│       │   └── SKILL.md                  ← /project:plan (proactivo)
│       ├── implement/
│       │   └── SKILL.md                  ← /project:implement (proactivo)
│       ├── debug/
│       │   └── SKILL.md                  ← /project:debug (proactivo)
│       ├── methodology-setup/
│       │   └── SKILL.md                  ← /project:methodology-setup (proactivo)
│       ├── git-commit/
│       │   └── SKILL.md                  ← /project:git-commit (manual only)
│       ├── test-quality-gate/
│       │   └── SKILL.md                  ← /project:test-quality-gate (proactivo)
│       ├── backend-test-coverage/
│       │   └── SKILL.md                  ← (proactivo)
│       ├── frontend-unit-test-coverage/
│       │   └── SKILL.md                  ← (proactivo)
│       ├── frontend-e2e-test-coverage/
│       │   └── SKILL.md                  ← (proactivo)
│       ├── e2e-user-flows-check/
│       │   └── SKILL.md                  ← (proactivo)
│       ├── new-feature-checklist/
│       │   └── SKILL.md                  ← (proactivo)
│       ├── deploy-staging/
│       │   └── SKILL.md                  ← /project:deploy-staging (manual only)
│       └── deploy-and-check/
│           └── SKILL.md                  ← /project:deploy-and-check (manual only)
│
├── CLAUDE.md                              ← Reglas always-on (identidad, seguridad,
│                                            memory bank, estructura, testing,
│                                            lessons-learned, error-docs)
├── backend/
│   ├── CLAUDE.md                          ← Django/DRF rules (auto-loaded in backend/)
│   └── ...
├── frontend/
│   ├── CLAUDE.md                          ← Vue/React rules (auto-loaded in frontend/)
│   └── ...
│
├── docs/
│   ├── methodology/                       ← Memory Bank data del proyecto
│   │   ├── architecture.md
│   │   ├── technical.md
│   │   ├── product_requirement_docs.md
│   │   ├── error-documentation.md
│   │   └── lessons-learned.md
│   └── literature/                        ← Papers, investigaciones
│
├── tasks/
│   ├── rfc/                               ← RFCs por feature
│   ├── active_context.md                  ← Foco actual, próximos pasos
│   └── tasks_plan.md                      ← Backlog, progreso, issues
│
└── ... (resto del proyecto)
```

---

## Uso diario de workflows

### Planificar nueva feature

```
/project:plan Quiero agregar [descripción de la feature].
```

O simplemente describir lo que quieres planificar — Claude puede invocar el skill `plan` proactivamente si detecta que necesitas planificación.

### Implementar

```
/project:implement Implementa [tarea específica].
```

### Debuggear

```
/project:debug Tengo este error: [error/stack trace].
```

O simplemente pegar el error — Claude puede invocar `debug` proactivamente al detectar un stack trace o mensaje de error.

### Actualizar memoria después de cambios significativos

```
update memory files
```

### Inicializar metodología en proyecto nuevo

```
/project:methodology-setup
```

### Hacer commit

```
/project:git-commit
```

### Deploy a staging

```
/project:deploy-staging release/march-2026
```

### Deploy a producción

```
/project:deploy-and-check
```

---

## Tips importantes

1. **`active_context.md` es el más importante** — actualizarlo al final de cada sesión para mantener continuidad entre conversaciones.

2. **`error-documentation.md` crece con el tiempo** — cada error resuelto se documenta para evitar repetirlo.

3. **`lessons-learned.md` captura patrones** — convenciones de código, decisiones de arquitectura, gotchas del proyecto. Su contenido también va en `CLAUDE.md` para que siempre esté cargado.

4. **Los skills compartidos son idénticos entre proyectos** — los 11 skills base (plan, implement, debug, methodology-setup, git-commit, test-quality-gate, backend-test-coverage, frontend-unit-test-coverage, frontend-e2e-test-coverage, e2e-user-flows-check, new-feature-checklist) son idénticos. Solo los deploy skills y skills únicos varían por proyecto.

5. **Claude Code carga `CLAUDE.md` automáticamente** — no necesitas decir "sigue la metodología". Las reglas siempre-on ya están inyectadas. Solo invoca los skills cuando necesites un workflow específico.

6. **Subdirectory `CLAUDE.md` se carga por contexto** — cuando trabajas en `backend/`, se carga `backend/CLAUDE.md` automáticamente. Mismo para `frontend/`.

7. **Invocación proactiva es la ventaja clave** — a diferencia de commands, los skills de metodología (plan, implement, debug) pueden ser invocados automáticamente por Claude cuando el contexto coincide. Esto elimina la necesidad de invocar manualmente el workflow correcto en muchas situaciones.

8. **`disable-model-invocation: true` para operaciones peligrosas** — deploy, git-commit, y cualquier skill que modifique producción o haga push a remoto debe tener este flag. Solo el usuario puede invocarlos con `/project:nombre`.

9. **`allowed-tools` restringe el sandbox** — skills como git-commit y deploy solo necesitan `Bash`. Skills como blog-ai-weekly necesitan `Bash, WebSearch, WebFetch`. No dar herramientas innecesarias.

---

## Inventario de skills por proyecto (referencia)

| Proyecto | Skills | Específicos |
|----------|:------:|-------------|
| **projectapp** | 13 | 11 shared + `deploy-and-check` + `blog-ai-weekly` |
| **gym_project** | 14 | 11 shared + `deploy-and-check` + `deploy-staging` + `server-diagnostic-report` |
| **kore_project** | 13 | 11 shared + `deploy-and-check` + `deploy-staging` |
| **fernando_aragon_project** | 13 | 11 shared + `deploy-and-check` + `deploy-staging` |
| **tuhuella_project** | 12 | 11 shared + `deploy-staging` |
| **candle_project** | 12 | 11 shared + `deploy-staging` |
| **base_django_vue_feature** | 12 | 11 shared + `deploy-staging` |
| **base_django_react_next_feature** | 12 | 11 shared + `deploy-staging` |
| **Total** | **101** | |
