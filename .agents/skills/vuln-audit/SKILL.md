---
name: "vuln-audit"
description: "Audita vulnerabilidades y dependencias en backend (Python) y frontend (npm). Default report-first: escanea (pip-audit + npm audit + outdated) y arma el plan de bumps SIN escribir nada. Con --apply (o vía el menú post-reporte) aplica los updates patch+minor del plan respetando pins, verifica con checks mínimos y deja 3 commits limpios (frontend deps, backend deps, audit-report.md)."
---

## Cuándo usar cuál (familia de auditoría)

| Skill | Úsala cuando | Cadencia típica |
|---|---|---|
| `$full-audit` | Veredicto integral 🟢/🟡/🔴 del VPS o del fleet (`--all`): configs, drift, envs, timers, health, email — 12 fases automatizadas, ~4 min | Post-cambio grande, post-incidente, trimestral |
| `$server-diagnostic` | Informe profundo por las 15 buenas prácticas con score y recomendaciones por proyecto — más narrativo y granular que full-audit | Semanal automático (cron) / a demanda |
| `$vuln-audit` | Dependencias y CVEs de UN proyecto (pip + npm): default arma el plan sin tocar nada; los bumps se aplican con `--apply` | Por proyecto, mensual o ante CVE |

No se orquestan entre sí (cada una es independiente); full-audit NO corre a las otras dos.


# vuln-audit — Vulnerability & Dependency Audit (multi-stack)

## Goal
Replicar de forma automática el flujo manual de auditoría que vive en `audit-report.md` de los proyectos del repo, en dos niveles:

- **Default (report-first, read-only):** escanear vulns + outdated y construir el **plan de bumps** como tabla (paquete · versión actual → propuesta · severidad · tipo patch/minor/major · riesgo), **sin escribir NADA** — ni archivos, ni installs sobre el proyecto, ni commits.
- **`--apply` (o selección en el menú post-reporte):** aplicar los bumps **patch+minor** del plan dentro del major actual respetando pins existentes, verificar con checks mínimos y dejar **3 commits separados** en la rama de trabajo (frontend deps → backend deps → reporte).

## Inputs
- `$ARGUMENTS` (opcional). Valores aceptados (combinables):
  - vacío → auditar `backend/` **y** `frontend/`.
  - `backend` → solo Python.
  - `frontend` → solo npm.
  - `--apply` → además de auditar, aplicar los bumps del plan (fase de escritura). Sin él, la corrida es **solo auditoría**.
- Cualquier otro valor: abortar con mensaje pidiendo uno de los aceptados.

## Constraints (no negociables)
- **Default read-only.** Sin `--apply`, la skill NO modifica nada: ni `package.json`/`package-lock.json`, ni `requirements.txt`, ni `audit-report.md`, ni commits, ni ramas. Solo snapshots a `/tmp` y el plan en la respuesta.
- **Branching (solo `--apply`):** sigue el `git-branch-protocol` del `CLAUDE.md` base del proyecto. Si la rama actual es `main`/`master`, busca rama feature activa y haz checkout; si no hay ninguna, crea `chore/<DDMMYYYY>-vuln-audit` (prefijo `chore` porque son dep bumps). Si ya estás en rama feature válida, continúa ahí. Detalle operativo en la Fase 0.
- **No `git push`.** Los 1–3 commits quedan locales; el operador empuja cuando decida y reporta el `PR URL` siguiendo la sección 9 del `git-branch-protocol`.
- **Working tree debe estar limpio** antes de aplicar (`git status` sin cambios). Si no lo está, abortar el `--apply`; la auditoría read-only puede correr igual (no toca el tree).
- **Solo patch + minor** dentro del major actual. **Nunca** `npm audit fix --force`, **nunca** un bump que cruce major (incluye `0.x → 0.y` con `y > x`).
- **Respetar pins** del proyecto (`requirements.txt` con `<X.Y` o `>=A,<B`; constraints documentados en `CLAUDE.md`/`AGENTS.md`).
- **Nunca correr la suite completa** de tests. Solo `pytest --collect-only` + 1 slice mínimo (regla "never run the full suite" de los `CLAUDE.md`).
- **Nunca** `git reset --hard`, **nunca** `--no-verify` en commits.
- **Sin `Co-Authored-By: Claude`** ni footers de atribución de IA en los commits (regla explícita en los `CLAUDE.md` del repo).
- Si un pre-commit hook falla, investigar y arreglar la causa raíz; no bypass.

## Cómo invocar este skill

Gating ($output-protocol §4): si el operador pasó cualquier argumento
(`backend`/`frontend`/`--apply`) → ejecutar directo, sin menú. Si la intención
es clara por la sesión (p.ej. acaba de llegar el aviso de un CVE puntual) →
proponer el comando en una línea y esperar confirmación. Sin argumentos → UNA
sola `AskUserQuestion` con Q1+Q2 fusionadas. Nunca preguntar en modo
fleet/headless/cron ni dentro de un barrido.

**Q1 — Modo** (selección única):

| label | description | preview |
|---|---|---|
| Auditar *(Recommended)* | read-only: escanea y arma el plan de bumps, no escribe nada | `$vuln-audit` |
| Aplicar (`--apply`) | aplica upgrades de dependencias — puede romper builds; corre tests después | `$vuln-audit --apply` |

**Q2 — Capa** (selección única):

| label | description | preview |
|---|---|---|
| Ambas *(Recommended)* | backend (pip-audit) + frontend (npm audit) | `$vuln-audit` |
| Sólo backend | pip-audit + pip outdated sobre el venv | `$vuln-audit backend` |
| Sólo frontend | npm audit + npm outdated | `$vuln-audit frontend` |

**Qué NO se pregunta:** no hay más flags que estos dos ejes. Los majors nunca
tienen opción de aplicarse (no existe flag; se evalúan aparte vía el menú
post-reporte), y el `git push` + PR no se ofrece pre-run — queda al operador
tras un `--apply` (ver `## Acciones disponibles`).

## Detección de entorno (Fase 0)
0. Parsear `$ARGUMENTS`: superficie (vacío/`backend`/`frontend`) y `APPLY=true` si trae `--apply`. Sin `--apply` la corrida es **solo auditoría**: los pasos marcados "(solo `--apply`)" en todas las fases se saltan.
1. (solo `--apply`) `git status --porcelain` → si imprime cualquier línea, abortar con: "Working tree no está limpio. Commitea o stashea antes de correr vuln-audit --apply."
2. (solo `--apply`) **Aplicar `git-branch-protocol` del `CLAUDE.md` base** (resolver rama de trabajo antes de cualquier commit):
   - `CURRENT=$(git rev-parse --abbrev-ref HEAD)`.
   - Guardar `WORK_BRANCH_CREATED=false` (se pondrá `true` si la skill crea rama nueva).
   - Si `CURRENT` ∈ {`main`, `master`}:
     - `git fetch --quiet --prune`.
     - Listar feature branches remotas:
       ```bash
       git branch -r | grep -vE 'origin/(HEAD|main|master|release-)' | sed 's@^[[:space:]]*origin/@@' | sort -u
       ```
     - Si hay **una sola** → `git checkout <esa>` y `git pull --rebase origin <esa>`. Comunicar al usuario: "Hay rama feature activa `<X>`, voy a commitear ahí."
     - Si hay **varias** → preguntar al usuario en cuál commitear; no asumir.
     - Si hay **cero** → `TODAY=$(date +%d%m%Y); git checkout -b chore/${TODAY}-vuln-audit` y marcar `WORK_BRANCH_CREATED=true`.
   - Si `CURRENT` ya es una rama feature válida (no `main`/`master`): continuar ahí sin tocar la rama.
3. Detectar superficies:
   - Frontend: `[ -f frontend/package.json ]`.
   - Backend: `[ -f backend/requirements.txt ]`.
4. Si la superficie pedida es `backend` y no hay backend → abortar. Idem para frontend.
5. Detectar venv (en orden, usar el primero que exista):
   - `backend/.venv/bin/activate`
   - `backend/venv/bin/activate`
   - Si ninguno existe y se va a auditar backend, abortar pidiendo crear el venv.
6. Detectar rama base remota: `git remote show origin | grep "HEAD branch"` o probar `origin/main` y `origin/master`. Guardar como `BASE_BRANCH`.
7. Capturar `BASE_SHA = git merge-base HEAD origin/$BASE_BRANCH` (short).
8. Leer `CLAUDE.md` y `AGENTS.md` raíz si existen, para detectar:
   - Pin policies adicionales (ej. "cryptography pinned <44.0").
   - Slice de test mínimo recomendado.
   - Cualquier comando custom (ej. `source .venv/bin/activate && cd backend && pytest …`).
9. Definir `PROJ = $(basename $(pwd))` para nombrar archivos en `/tmp`.

## Fase 1 — Frontend
Ejecutar solo si la superficie ∈ {ambas, `frontend`} y `frontend/package.json` existe.
Los pasos 1–2 son la auditoría (siempre); del 3 en adelante es la aplicación (solo `--apply`).

1. **Snapshot inicial:**
   ```bash
   cd frontend
   npm audit --json > /tmp/${PROJ}-npm-audit.json || true
   npm outdated --json > /tmp/${PROJ}-npm-outdated.json || true
   ```
   `npm outdated` retorna exit 1 cuando hay outdated; eso es esperado, no es error.

2. **Parsear:**
   - De `npm-audit.json`: lista de paquetes con `{package, severity, notes}` y totales `{critical, high, moderate, low}`.
   - De `npm-outdated.json`: por cada paquete `{current, wanted, latest}`. Marcar `skip_major = true` si `latest` cruza el major de `current` (incluye `0.x → 0.y` con `y > x`, o `0.x → 1.x`).

   **Corte report-first:** sin `--apply`, la fase termina acá — lo parseado
   alimenta la tabla del plan (Fase 3) y no se toca `package.json` ni se corre
   ningún install.

3. (solo `--apply`) **Aplicar updates:**
   ```bash
   npm audit fix          # SIN --force
   npx --yes npm-check-updates -u --target minor
   npm install
   ```

4. (solo `--apply`) **Manejo de ERESOLVE:** si `npm install` falla con `ERESOLVE`:
   - Identificar el paquete ofensor del mensaje de error.
   - Editar `package.json` para revertir ese paquete a la última versión que respete las peer deps actuales (típicamente, retroceder 1 minor o quedarse en la versión previa al `ncu`).
   - `npm install` de nuevo.
   - Registrar el caso en la sección `Rollbacks` del reporte.
   - Si el reintento falla otra vez, abortar con error claro.

5. (solo `--apply`) **Verificar:**
   ```bash
   npm audit               # capturar totales
   npm run build
   ```
   Si `npm run build` falla:
   - Si ya se hizo commit, `git reset --soft HEAD~1`.
   - Reportar el error y abortar.

6. (solo `--apply`) **Commit (sin Co-Authored-By, sin footers de IA):**
   ```bash
   git add frontend/package.json frontend/package-lock.json
   git commit -m "deps(frontend): apply patch+minor updates"
   ```
   Si `npm install` no produjo cambios en `package.json`/`package-lock.json`, **no commitear**; registrar en el reporte que no había updates aplicables.

7. (solo `--apply`) **Capturar el snapshot final** (`npm audit --json` post-update) para la sección `Updates Applied` del reporte.

## Fase 2 — Backend
Ejecutar solo si la superficie ∈ {ambas, `backend`} y `backend/requirements.txt` existe.
Los pasos 1–4 son la auditoría (siempre); del 5 en adelante es la aplicación (solo `--apply`).

1. **Activar venv** (el detectado en Fase 0):
   ```bash
   source backend/.venv/bin/activate || source backend/venv/bin/activate
   ```

2. **Asegurar pip-audit:**
   ```bash
   pip show pip-audit >/dev/null 2>&1 || pip install pip-audit
   ```
   Si la instalación falla, abortar limpio.

3. **Snapshot inicial:**
   ```bash
   cd backend
   pip-audit --format json > /tmp/${PROJ}-pip-audit.json
   pip list --outdated --format json > /tmp/${PROJ}-pip-outdated.json
   ```

4. **Construir el plan:**
   - Parsear `requirements.txt` línea por línea: capturar pin actual de cada paquete (`==X.Y.Z`, `>=A,<B`, sin pin, etc.).
   - Para cada paquete outdated:
     - Calcular `target` = última versión `latest` que **no cruce el major actual** y **respete el pin existente** (ej. si pin es `<44.0`, target ≤ 43.x).
     - Si `target == current`, no hay update aplicable → marcar como skip.
   - Para cada paquete con vulns que solo se arreglan en majors saltados o fuera del pin: marcarlo como **remaining** en el reporte (no intentar el bump).

   **Corte report-first:** sin `--apply`, la fase termina acá — el plan
   alimenta la tabla de Fase 3 y no se edita `requirements.txt` ni se
   instala nada en el venv (más allá del propio `pip-audit`).

5. (solo `--apply`) **Aplicar:** editar `requirements.txt` con las nuevas versiones (mantener el operador del pin: si era `==`, sigue `==<nuevo>`; si era rango, ajustar el floor sin tocar el techo). Luego:
   ```bash
   pip install -r requirements.txt
   pip-audit --format json > /tmp/${PROJ}-pip-audit-final.json || true
   ```

6. (solo `--apply`) **Verificar (regla "minimal CLAUDE.md"):**
   ```bash
   python manage.py check                  # debe imprimir "0 issues"
   pytest --collect-only -q                # debe colectar sin errores
   ```
   Slice mínimo:
   - Si `CLAUDE.md` lista comandos de test ejemplares, usar el primero.
   - Si no, ejecutar el primer `tests/test_*.py` que se encuentre (`find . -path '*/tests/test_*.py' | head -1`).
   - Si no hay tests, omitir el slice y registrar en `Verification Results`.

   Si cualquier verificación falla:
   - Si ya se hizo commit, `git reset --soft HEAD~1`.
   - Reportar el comando que falló y abortar.

7. (solo `--apply`) **Commit:**
   ```bash
   git add backend/requirements.txt
   git commit -m "deps(backend): apply patch+minor updates"
   ```
   Si `requirements.txt` no cambió, no commitear.

## Fase 3 — Plan / Reporte

### Modo default (sin `--apply`) — el plan en la respuesta, nada escrito

Consolidar lo parseado en Fases 1–2 en **la tabla del plan de bumps** (esto ES
el entregable de la corrida default; se muestra en la respuesta, no se escribe
ningún archivo ni commit):

| Paquete | Superficie | Actual → Propuesta | Severidad (vulns) | Tipo | Riesgo |
|---|---|---|---|---|---|
| ... | frontend/backend | `X.Y.Z` → `X.Y.W` | critical/high/moderate/low/— | patch / minor / **major (skip)** | breve: pin techo, peer deps, breaking changes conocidos |

- Los **majors se listan igual**, marcados `major (skip)` — no se aplican nunca
  en esta skill, pero el operador debe verlos para evaluarlos aparte.
- `Riesgo`: una frase por paquete (qué podría romper el bump o por qué se saltea).
- La aplicación queda para `--apply` o para la selección en el menú post-reporte.

### Modo `--apply` — reporte y commit final
Se ejecuta siempre que hubo `--apply` (incluso si una fase no produjo updates: el reporte lo refleja).

1. **Generar `audit-report.md`** en la raíz del proyecto, sobrescribiendo si existe. Plantilla:

   ```markdown
   # Vulnerability Audit & Dependency Update Report

   **Branch:** <git rev-parse --abbrev-ref HEAD>
   **Date:** <YYYY-MM-DD>
   **Base:** <BASE_BRANCH> @ <BASE_SHA>
   **Scope:** patch + minor updates only (no major version bumps)

   ## Summary

   | Surface  | Vulns (initial) | Outdated (initial) |
   |----------|-----------------|--------------------|
   | Frontend | <total / breakdown por severity> | <count> |
   | Backend  | <total across N packages>        | <count> |

   ---

   ## Frontend — `npm audit` (initial)
   Source: `/tmp/<PROJ>-npm-audit.json`

   | Package | Severity | Notes |
   |---|---|---|
   | ...  | ...       | ...    |

   **Totals:** <crit>/<high>/<mod>/<low>.

   ## Frontend — `npm outdated` (initial)
   Source: `/tmp/<PROJ>-npm-outdated.json`

   - <pkg>: <current> → <wanted> → <latest>  *(skip si major)*

   ---

   ## Backend — `pip-audit` (initial)
   Source: `/tmp/<PROJ>-pip-audit.json`

   | Package | Current | Vulns | Min in-major fix |
   |---|---|---|---|

   ## Backend — `pip list --outdated` (initial)
   Source: `/tmp/<PROJ>-pip-outdated.json`

   - <pkg> <current> → <latest> *(constrained / major bump skipped si aplica)*

   ---

   ## Plan

   ### Frontend
   - <bumps planeados>

   ### Backend
   - <bumps planeados, respetando pins>

   ## Updates Applied

   ### Frontend (commit `deps(frontend): apply patch+minor updates`)
   - <pkg> <old> -> <new>
   - Final `npm audit`: <totales>.
   - Remaining outdated (majors saltados intencionalmente): <lista>.

   ### Backend (commit `deps(backend): apply patch+minor updates`)
   - <pkg> <old> -> <new>
   - `pip-audit` final: <total remaining> en <N> paquetes (todos requieren majors saltados o están fuera de pin).

   ## Rollbacks
   - <si hubo, descripción + razón. Si no, "Ninguno.">

   ## Verification Results

   ### Frontend
   - `npm audit`: <totales>.
   - `npm run build`: <success / detalle>.

   ### Backend
   - `python manage.py check`: <output resumido>.
   - `pytest --collect-only`: <N tests collected, errors>.
   - Slice: `<comando>`: <N passed>.
   ```

   Si una superficie no se auditó (por `$ARGUMENTS`), omitir sus secciones.

2. **Commit del reporte:**
   ```bash
   git add audit-report.md
   git commit -m "docs: vulnerability audit report (<YYYY-MM-DD>)"
   ```

3. **Resultado final esperado:**
   - 1 a 3 commits nuevos en la rama de trabajo (la actual si era feature, o `chore/<DDMMYYYY>-vuln-audit` recién creada en Fase 0).
   - Working tree limpio.
   - `audit-report.md` actualizado.
   - **Sin `git push`** (queda al operador, según el `git-branch-protocol`).

## Idempotencia
- Corrida default: siempre re-escanea y re-muestra el plan; como no escribe nada, repetirla es gratis.
- En `--apply`, si no hay vulns ni outdated relevantes:
  - No hacer commits de deps.
  - Generar igual el `audit-report.md` indicando "No updates applicable" en cada sección.
  - Hacer el commit del reporte solo si su contenido cambió respecto al existente.

## Ejemplos de invocación
- `$vuln-audit` — auditar backend + frontend y mostrar el plan (read-only).
- `$vuln-audit frontend` — solo npm, solo plan.
- `$vuln-audit backend` — solo pip, solo plan.
- `$vuln-audit --apply` — aplicar patch+minor del plan en ambas superficies (commits separados).
- `$vuln-audit backend --apply` — aplicar solo en Python.

---

## Acciones disponibles

Tras el reporte del plan (corrida default, sin `--apply`), si la sesión es
interactiva y NO hubo flags explícitos (reglas de gating de
$output-protocol §4), ofrecer vía AskUserQuestion:

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Aplicar patch+minor del plan (commits separados) (Recommended) | aplica los bumps del plan respetando pins, verifica (build / check / collect-only) y deja 1–3 commits locales — sin push | `$vuln-audit --apply` |
| Sólo backend / sólo frontend | re-corre la auditoría acotada a una superficie | `$vuln-audit backend` · `$vuln-audit frontend` |
| Evaluar los majors saltados (plan detallado por paquete) | analiza breaking changes, esfuerzo y orden sugerido de cada major — no aplica nada | análisis en la respuesta (read-only) |
| Push + PR de los commits | sólo tras un `--apply`: empuja la rama y abre el PR | `git push -u origin <rama> && gh pr create` |

## Output final

Reportar siguiendo $output-protocol. Plantilla específica de `$vuln-audit`.

**Corrida default (report-first):** el veredicto acompaña a la tabla del plan
de Fase 3 (que es el cuerpo del reporte):

```markdown
🟢 vuln-audit OK — plan de bumps listo (read-only, nada escrito)

| Dimensión | Estado | Detalle |
|---|---|---|
| Frontend — npm audit | ✅ | C/H/M/L: <totales>, N outdated |
| Backend — pip-audit | ✅ | N vulns en M paquetes, K outdated |
| Plan de bumps | ✅ | X patch+minor aplicables, Y majors saltados |
| Escrituras | ✅ | ninguna (default report-first) |
```

**Corrida `--apply`:**

```markdown
🟢 vuln-audit OK
✨ Todo en orden — no hay acciones pendientes.

| Dimensión | Estado | Detalle |
|---|---|---|
| Working tree limpio | ✅ | git status sin cambios al iniciar |
| Branch resuelta | ✅ | git-branch-protocol aplicado |
| Frontend — npm audit | ✅ | C/H/M/L: <antes> → <después>, build OK |
| Frontend — patch+minor | ✅ | N bumps aplicados, sin --force, sin ERESOLVE |
| Backend — pip-audit | ✅ | N vulns: <antes> → <después>, pins respetados |
| Backend — patch+minor | ✅ | N bumps aplicados, check + collect-only OK |
| audit-report.md | ✅ | reporte generado, 1–3 commits locales |
```

Si una superficie no aplicó (sin `package.json` o sin `requirements.txt`,
sin updates aplicables, o `$ARGUMENTS` excluyó la superficie), usar ⏭️.

Si ERESOLVE forzó rollback, build falló, pip-audit deja vulns remaining por
majors saltados, o algún verify (`manage.py check`, `pytest --collect-only`,
slice mínimo) falló → reemplazar ✅ por ⚠️/❌, omitir la línea ✨ y agregar
`## Next steps` con los paquetes pendientes (mayors a evaluar, ERESOLVE
manual, etc.) y el `git push -u origin <rama>` + PR.
