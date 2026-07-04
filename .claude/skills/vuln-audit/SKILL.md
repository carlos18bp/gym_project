---
name: vuln-audit
description: "Audita vulnerabilidades y dependencias en backend (Python) y frontend (npm), aplica updates patch+minor respetando pins, verifica con checks mínimos y deja 3 commits limpios (frontend deps, backend deps, audit-report.md)."
argument-hint: "[backend|frontend]  # vacío = ambas superficies"
---

# vuln-audit — Vulnerability & Dependency Audit (multi-stack)

## Goal
Replicar de forma automática el flujo manual de auditoría que vive en `audit-report.md` de los proyectos del repo: escanear vulns + outdated, planear bumps **patch+minor** dentro del major actual respetando pins existentes, aplicar, verificar con checks mínimos y dejar **3 commits separados** en la rama actual (frontend deps → backend deps → reporte).

## Inputs
- `$ARGUMENTS` (opcional). Valores aceptados:
  - vacío → auditar `backend/` **y** `frontend/`.
  - `backend` → solo Python.
  - `frontend` → solo npm.
- Cualquier otro valor: abortar con mensaje pidiendo uno de los tres.

## Constraints (no negociables)
- **Branching:** sigue el `git-branch-protocol` del `CLAUDE.md` base del proyecto. Si la rama actual es `main`/`master`, busca rama feature activa y haz checkout; si no hay ninguna, crea `chore/<DDMMYYYY>-vuln-audit` (prefijo `chore` porque son dep bumps). Si ya estás en rama feature válida, continúa ahí. Detalle operativo en la Fase 0.
- **No `git push`.** Los 1–3 commits quedan locales; el operador empuja cuando decida y reporta el `PR URL` siguiendo la sección 9 del `git-branch-protocol`.
- **Working tree debe estar limpio** antes de empezar (`git status` sin cambios). Si no lo está, abortar.
- **Solo patch + minor** dentro del major actual. **Nunca** `npm audit fix --force`, **nunca** un bump que cruce major (incluye `0.x → 0.y` con `y > x`).
- **Respetar pins** del proyecto (`requirements.txt` con `<X.Y` o `>=A,<B`; constraints documentados en `CLAUDE.md`/`AGENTS.md`).
- **Nunca correr la suite completa** de tests. Solo `pytest --collect-only` + 1 slice mínimo (regla "never run the full suite" de los `CLAUDE.md`).
- **Nunca** `git reset --hard`, **nunca** `--no-verify` en commits.
- **Sin `Co-Authored-By: Claude`** ni footers de atribución de IA en los commits (regla explícita en los `CLAUDE.md` del repo).
- Si un pre-commit hook falla, investigar y arreglar la causa raíz; no bypass.

## Detección de entorno (Fase 0)
1. `git status --porcelain` → si imprime cualquier línea, abortar con: "Working tree no está limpio. Commitea o stashea antes de correr vuln-audit."
2. **Aplicar `git-branch-protocol` del `CLAUDE.md` base** (resolver rama de trabajo antes de cualquier commit):
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
4. Si `$ARGUMENTS == "backend"` y no hay backend → abortar. Idem para frontend.
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
Ejecutar solo si `$ARGUMENTS` ∈ {"", "frontend"} y `frontend/package.json` existe.

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

3. **Aplicar updates:**
   ```bash
   npm audit fix          # SIN --force
   npx --yes npm-check-updates -u --target minor
   npm install
   ```

4. **Manejo de ERESOLVE:** si `npm install` falla con `ERESOLVE`:
   - Identificar el paquete ofensor del mensaje de error.
   - Editar `package.json` para revertir ese paquete a la última versión que respete las peer deps actuales (típicamente, retroceder 1 minor o quedarse en la versión previa al `ncu`).
   - `npm install` de nuevo.
   - Registrar el caso en la sección `Rollbacks` del reporte.
   - Si el reintento falla otra vez, abortar con error claro.

5. **Verificar:**
   ```bash
   npm audit               # capturar totales
   npm run build
   ```
   Si `npm run build` falla:
   - Si ya se hizo commit, `git reset --soft HEAD~1`.
   - Reportar el error y abortar.

6. **Commit (sin Co-Authored-By, sin footers de IA):**
   ```bash
   git add frontend/package.json frontend/package-lock.json
   git commit -m "deps(frontend): apply patch+minor updates"
   ```
   Si `npm install` no produjo cambios en `package.json`/`package-lock.json`, **no commitear**; registrar en el reporte que no había updates aplicables.

7. **Capturar el snapshot final** (`npm audit --json` post-update) para la sección `Updates Applied` del reporte.

## Fase 2 — Backend
Ejecutar solo si `$ARGUMENTS` ∈ {"", "backend"} y `backend/requirements.txt` existe.

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

5. **Aplicar:** editar `requirements.txt` con las nuevas versiones (mantener el operador del pin: si era `==`, sigue `==<nuevo>`; si era rango, ajustar el floor sin tocar el techo). Luego:
   ```bash
   pip install -r requirements.txt
   pip-audit --format json > /tmp/${PROJ}-pip-audit-final.json || true
   ```

6. **Verificar (regla "minimal CLAUDE.md"):**
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

7. **Commit:**
   ```bash
   git add backend/requirements.txt
   git commit -m "deps(backend): apply patch+minor updates"
   ```
   Si `requirements.txt` no cambió, no commitear.

## Fase 3 — Reporte y commit final
Siempre se ejecuta (incluso si una fase no produjo updates: el reporte lo refleja).

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
Si al correr el skill no hay vulns ni outdated relevantes:
- No hacer commits de deps.
- Generar igual el `audit-report.md` indicando "No updates applicable" en cada sección.
- Hacer el commit del reporte solo si su contenido cambió respecto al existente.

## Ejemplos de invocación
- `/vuln-audit` — auditar y aplicar en backend + frontend.
- `/vuln-audit frontend` — solo npm.
- `/vuln-audit backend` — solo pip.

---

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de `/vuln-audit`:

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
