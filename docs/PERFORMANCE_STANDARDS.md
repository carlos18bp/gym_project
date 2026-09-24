# Estándar de Rendimiento (fleet)

<!-- standard_version: 1.0.0 -->
**Versión:** 1.0.0 · **Vigente desde:** 2026-09-14 · **Canónico:** `vps-ops-toolkit/workflows/testing/PERFORMANCE_STANDARDS.md`

> Esta copia (`<proyecto>/docs/PERFORMANCE_STANDARDS.md`) la escribe
> `scripts/maintenance/sync-test-quality-core.sh` y **se sobrescribe en cada sync**.
> Lo que difiere por proyecto se declara en `.testquality.yml` con claves `performance_*`
> (§9) — nunca editando este archivo. Lo consume la skill `/perf-pass` (≤3 candidatos
> por corrida); la verificación la hace `/qa` bajo `TESTING_QUALITY_STANDARDS.md`.
> El hardware para el que se optimiza vive en `config/perf/compute-profile.yml` del toolkit.

---

## 1. Propósito y alcance

**Rendimiento** = el mismo resultado (los mismos datos, el mismo contrato, las mismas
reglas) producido con **menos trabajo por request, por tarea o por página**, medido contra
los recursos reales del host que sirve el proyecto. Una mejora de rendimiento cambia
**cómo se computa** una respuesta; nunca cambia **qué** responde.

### Regla LÍMITES (pass/fail del diff)

| Puede cambiar | No puede cambiar (→ observación) |
|---|---|
| Forma de la consulta ORM: `select_related` / `prefetch_related` / `only` / `defer` / `annotate` / `exists` / `values` / `iterator`, y el punto de evaluación del queryset | El shape de la respuesta: campos, orden semántico, status codes, URLs, el `page_size` por default de un contrato |
| `SerializerMethodField` → `source=` o anotación que produce **el mismo valor** | Reglas de negocio, validaciones, permisos, filtros u orden con significado |
| Cap de `max_page_size` en un contrato **ya paginado** | Paginar una lista plana (es cambio de contrato) |
| `Meta.indexes` + migración **aditiva** (`makemigrations` + `sqlmigrate` como evidencia; jamás `migrate` desde un worktree) | Alterar columnas o constraints, borrar índices, migraciones de datos |
| Cache con invalidación explícita: `cached_property`, cache de bajo nivel de valores derivados, per-view en rutas públicas read-only; LocMem o el Redis **ya configurado** (`cache_redis_db`) | Activar `CACHES` hacia Redis en un proyecto sin `cache_redis_db` (→ `infra/redis`); tocar `settings*.py` fuera del bloque `CACHES` |
| Chunking / `bulk_create` / `bulk_update` / `iterator()` en tareas, con el mismo resultado | La semántica o el schedule de una tarea |
| Lazy routes, `import()` dinámico, `computed`/`useMemo`/`v-memo`, dedupe de fetch, `loading="lazy"`, virtualización que la librería ya provee | Dependencias nuevas (`requirements*`, `package.json`), rediseño, copy, flujo |
| `docs/PERFORMANCE_STANDARDS.md` (copia canónica) y las claves `performance_*` de `.testquality.yml` | `config/systemd`, `config/nginx`, `config/mysql`, `config/redis`, `projects.yml`, `*.test.*`, `*.spec.*`, `tests/`, cualquier archivo fuera de los `paths` del candidato |

Otras reglas de alcance:

- **Una corrida = como máximo 3 candidatos**; un cupo que no se puede aplicar no se rellena
  con otro. Lo que se ve de paso lo anota el scout en el ledger, nunca se "arregla ya que
  estoy".
- **La infraestructura se observa, no se toca.** `apply-server-optimization.sh` fue retirado
  a propósito; workers, `MemoryMax`, `CPUQuota`, nginx, MySQL y Redis van al reporte como
  observación con puntero a `docs/capacity-runbook.md` y a `bootstrap.sh --check`, para el
  operador.
- **La verificación es un test de presupuesto** (§6) que escribe y corre `/qa`; esta skill
  no se aprueba sola.

---

## 2. Perfil de cómputo y presupuestos derivados

El perfil sale de `config/perf/compute-profile.yml` (toolkit) y se imprime **siempre** antes
de la Fase 1 de `/perf-pass`. Los presupuestos se derivan con las fórmulas de abajo a partir
del perfil + `projects.yml` (`memory_max`) + la unit de systemd del proyecto
(`config/systemd/<gunicorn_service>.service` y su `.override.conf`; sin unit, la base
`generic-resource-limits.override.conf`: 2 workers × 1 thread, `CPUQuota=55%`,
`MemoryMax=700M`). El helper `scripts/perf/perf-ledger.sh --profile <proyecto>` los calcula;
no se recomputan a mano.

| Presupuesto | Fórmula | Ejemplo `projectapp` (4 vCPU / 15 GB, 2×1, 40 %, 350M) |
|---|---|---|
| Slots del proyecto | `slots = workers × threads` | 2 |
| CPU por request bajo saturación | `cpu_req = min(CPUQuota/100, vcpu) / slots` core | 0.2 core |
| CPU por request (ms) | `≤ cpu_req × wall_target` · wall_target: API **500 ms**, página/SSR **1000 ms** | ≤ 100 ms · ≤ 200 ms |
| RPS sostenible | `rps = slots / service_s`; contra nginx `limit_req` (`api` 5 r/s, `general` 10 r/s por IP): `service_s ≤ slots / (rate × IPs concurrentes)` | 4 IPs ⇒ service ≤ 0.1 s |
| RAM por worker | `worker_mb = MemoryMax / (workers + 1)`; transitorio por request `≤ 0.25 × worker_mb` | ≈ 116 MB ⇒ ≤ 29 MB |
| Filas materializables por request | `rows_max = 0.25 × worker_mb × 1024 / 2 KB` (supuesto: 2 KB por fila) — un `.all()` sin cota que pueda superarlo al techo del dataset es **bloqueante** | ≈ 14 k filas |
| Headroom del host | `ram_gb − reserved(os, redis) − buffer_pool − Σ MemoryMax(otras units del host) − MemoryMax(proyecto)`; `< 0` ⇒ observación `infra/systemd` | informativo |
| Queries por request | listado `≤ 6` · detalle `≤ 4` · mutación `≤ 8` · **invariante de constancia**: `Q(1 fila) == Q(N filas)` | — |
| Filas por página | `page_size_max ≤ 100` (cap; el default del contrato no se toca) | — |
| Índice requerido | columna de `filter()`/`order_by()` de un listado cuya tabla alcanza `≥ 10 000` filas al techo | — |
| Tarea (Huey/Celery con worker = 1) | `task_s ≤ 30` · periódica: `Σ tareas del período ≤ 0.5 × período` · transacción abierta `≤ 5 s` — la cola es serial: una tarea larga es la cola parada | — |
| Payload API | página JSON `≤ 256 KB` sin comprimir | — |
| SPA estática | JS inicial `≤ 300 KB` gz · chunk de ruta `≤ 150 KB` gz · imagen `≤ 200 KB` con `loading="lazy"` | — |
| SSR Next (`frontend_service`, 25 % / 300M) | `≤ 50 ms` CPU por página · `≤ 2` fetch secuenciales · estático o `revalidate` donde el dato lo permite | — |

Todos los `wall_target`, KB y segundos son **supuestos del estándar** (overridables en §9):
se imprimen en la declaración de cómputo y se copian a `assumptions:` del registro.

---

## 3. Categorías e invariantes

`category` es un string plano `<capa>/<hoja>`; el orden de la tabla es el orden canónico
(desempate del top 3 y de impresión). Id de candidato: `P-<capa>-<hoja>-NN`.

| category | Qué es un hallazgo | `--apply` |
|---|---|---|
| `backend/queries` | N+1, falta de `select_related`/`prefetch_related`, `.all()` sin cota, `count()`/`len()` en loop, queryset evaluado más de una vez | sí |
| `backend/serializers` | `SerializerMethodField` que consulta por instancia, anidados sin prefetch, agregados en Python que debían ser `annotate` | sí |
| `backend/views` | Sin cap de `page_size`, trabajo pesado síncrono dentro del request, `only`/`defer` ausentes en listados anchos, export sin `iterator()`, N requests donde bastaba 1 | sí |
| `backend/indexes` | Columna de `filter`/`order_by` de un listado sin índice, con la tabla sobre el umbral al techo | sí (sólo aditivo) |
| `backend/tasks` | Tarea que excede el presupuesto y bloquea la cola serial, periódica que barre tablas enteras, transacción larga | sí |
| `backend/caching` | Valor derivado recomputado en cada request cuando existe invalidación clara | sí (condicionado a LÍMITES) |
| `frontend/views` | Cascadas de fetch en mount, fetch duplicado entre componentes, over-fetch de listas, SSR sin `revalidate`/estático posible | sí |
| `frontend/components` | Recomputar en template, watchers pesados, listas grandes sin memoización/virtualización ya disponible | sí |
| `frontend/stores` | Refetch por navegación, sin dedupe, reactividad de todo el store, arrays sin cota | sí |
| `frontend/assets` | Rutas sin lazy, dependencia pesada importada entera, imágenes sin lazy/tamaño, chunk inicial sobre presupuesto | sí |
| `infra/gunicorn` · `infra/nginx` · `infra/mysql` · `infra/redis` · `infra/systemd` · `infra/host` | workers/threads/timeout · proxy_cache/gzip/`limit_req`/`$request_time` · buffer pool/`long_query_time` · `cache_redis_db` para un proyecto sin `CACHES` · `MemoryMax`/`CPUQuota` · palancas 4-5 del capacity runbook | **observación** — el helper rechaza `applied` en `infra/*` |

---

## 4. Clasificación de hallazgos

**Caso (regla exacta, en este orden):**

1. `worst` = todos los slots del proyecto ocupados (CPU por request = `cpu_req`) y el dataset
   al `performance_dataset_ceiling` del modelo principal del camino. Sin techo declarado:
   10× el conteo actual **leído sólo en staging/dev** (el `.env` de un worktree apunta a la
   DB de producción: jamás `COUNT`/`EXPLAIN` desde ahí); sin DB accesible: 10 000 filas,
   marcado `(default-estándar)`.
2. Diseñar el fix para `worst` y pasarlo por LÍMITES.
3. Si el fix para `worst` exige algo fuera de LÍMITES (infra, reescritura async, cambio de
   esquema no aditivo, cambio de contrato) ⇒ `case: conservative`: carga = actual ×2 (RPS del
   traffic report; sin dato: "2 usuarios concurrentes (default-estándar)"), dataset = actual o
   declarado. Se aplica el fix acotado, `assumptions:` lleva esos números con su fuente y
   `escalation:` describe el cambio que alcanzaría `worst` (observación para el operador).
4. Si ni el conservador entra en LÍMITES ⇒ el candidato queda `diagnosed` con
   `why_pending: fuera-de-LÍMITES` (+ `escalation`); nunca `--apply`.

**Severidad:** `bloqueante` = al caso `worst` el camino satura los slots, supera `rows_max` o
`worker_mb`, excede `--timeout 30`, bloquea la cola de tareas o crece sin cota con el dataset ·
`mayor` = supera un presupuesto pero acotado (N+1 limitado por `page_size`, índice ausente con
tabla bajo el umbral) · `menor` = dentro de presupuesto pero evitable.

**Confianza:** `measured` = la evidencia incluye un `cmd:` cuya salida está citada en el
reporte · `inferred` = sólo `file:line`.

**Esfuerzo:** `S` (un archivo, sin migración) · `M` (varios archivos o una migración aditiva)
· `L` (toca varias capas o exige test nuevo de fixture grande). Es una clase, no una métrica.

**Clase del hallazgo:** `corregible` (categoría con `--apply`, dentro de LÍMITES, dentro de
`paths`) · `observación` (infra, cambio funcional, archivo compartido con otro dueño) ·
`no-cubierto` (el estándar no lo contempla ⇒ §7).

---

## 5. Evidencia aceptada

- **Mínimo por hallazgo:** ≥1 `file:line` leído en ESTA corrida + ≥1 `cmd:` reproducible.
- `cmd:` válidos: `pytest … -k budget` con `CaptureQueriesContext`; `manage.py sqlmigrate`;
  `EXPLAIN` sobre la query dominante **en staging/dev**; una línea de
  `backend/logs/silk-reports/*.log` o del slow log de MySQL; `du -sh` / stats del build
  (`.output/`, `.next/`); `grep -c` de fetch en un árbol.
- **Prohibido como evidencia:** `curl -w '%{time_total}'` y cualquier medición de tiempo
  sin control de carga; aserciones de tiempo en tests (flaky por diseño); números tomados
  "de memoria" o de un reporte de otra corrida sin re-inventariar.
- Las salidas (conteos, tamaños, líneas) se citan **sólo en el reporte inmutable**
  `docs/audits/<fecha>-<proyecto>-perf-<slug>.md`, sección "Mediciones". El ledger guarda
  el puntero y los comandos, nunca los números (contrato anti-métricas del helper).

---

## 6. Cómo se declara un presupuesto en tests

El presupuesto es un test de comportamiento bajo `TESTING_QUALITY_STANDARDS.md` (actúa,
afirma un valor concreto, nombra el bug). Idioma canónico del fleet (projectapp,
`backend/content/tests/views/test_proposal_detail_queries.py`):

```python
from django.db import connection
from django.test.utils import CaptureQueriesContext

MAX_LIST_QUERIES = 6            # presupuesto del estándar §2 (listado)


def test_document_list_query_budget_is_constant(client, admin_user, fifty_documents_with_distinct_owners):
    client.force_login(admin_user)
    with CaptureQueriesContext(connection) as one:
        client.get("/api/admin/documents/?page_size=1")
    with CaptureQueriesContext(connection) as fifty:
        client.get("/api/admin/documents/?page_size=50")
    # bug que atrapa: N+1 en DocumentSerializer.get_owner_name (P-backend-queries-03)
    assert len(fifty) == len(one)
    assert len(fifty) <= MAX_LIST_QUERIES
```

Reglas: la fixture crea **owners distintos** (si comparten instancia, la cache del prefetch
oculta el N+1) · función con fixture `db`, no `TestCase` (el `SAVEPOINT` entra en el conteo)
· el presupuesto se declara como constante nombrada `MAX_*_QUERIES` para que `--record-qa`
lo detecte · frontend unit: `expect(fetchSpy).toHaveBeenCalledTimes(1)` sobre el store o la
vista · nunca `time.perf_counter()` ni `expect(duration).toBeLessThan(...)`.

---

## 7. Cuando el estándar no cubre un caso · versionado

- Se registra como `observación` con clase `no-cubierto`, evidencia §5 y una **propuesta de
  extensión del estándar por PR al toolkit** (`workflows/testing/PERFORMANCE_STANDARDS.md`).
  Nunca criterios locales en el proyecto: esta copia se pisa en cada sync.
- **`standard_version`** (semver, encabezado): patch = redacción · minor = técnica o categoría
  nueva · **major = cambio de una fórmula de §2 o de las severidades**. El ledger guarda la
  versión con la que se trabajó cada candidato; una versión major nueva invalida los
  `verified` anteriores (se re-inventarían). Una **recalibración del perfil de cómputo** tiene
  el mismo efecto sobre los registros con snapshot anterior (`stale`).

---

## 8. Anti-patrones

| Anti-patrón | Problema | Solución |
|---|---|---|
| **Optimizar para un host imaginario** | Presupuestos derivados de 4 vCPU cuando el proyecto sirve desde 1 core | La declaración de cómputo se imprime siempre; el perfil sale del `server:` real |
| **Quitar campos "para que vuele"** | Cambio de contrato disfrazado de rendimiento | LÍMITES: `select_related`/anotación con el mismo valor; el shape no se toca |
| **`workers 2 → 4` como fix** | Infra; duplica RAM y no arregla la query | Observación `infra/gunicorn` con puntero al capacity runbook |
| **`curl -w time_total` como prueba** | Sin control de carga ni dataset; no reproducible | Test de presupuesto §6 corrido por `/qa` |
| **Anotar "bajó de 800 ms a 120 ms" en el ledger** | Un número guardado se vuelve objetivo | Reporte inmutable; el helper rechaza unidades en `problem`/`strategy` |
| **"Ya que estoy" en el módulo vecino** | Rompe la comparabilidad y el alcance | El scout lo anota como candidato; otra corrida |
| **Cache sin invalidación** | Datos stale = bug funcional | Sólo con invalidación explícita o TTL corto justificado en `assumptions` |
| **`@cache_page` en vistas con permisos por usuario** | Fuga de datos entre usuarios | Cache de bajo nivel por clave de usuario o ninguna |
| **Índice "por las dudas"** | Escrituras más lentas, migración innecesaria | Sólo con `filter`/`order_by` medido y tabla sobre el umbral |
| **Migración corrida desde el worktree** | El `.env` enlazado apunta a producción | Sólo `makemigrations` + `sqlmigrate`; el `migrate` es del deploy |
| **Prefetch de todo** | RAM por request sobre `req_mb` | Prefetch de lo que el serializer consume; `only()` en listados anchos |
| **Test que mide tiempo** | Flaky en CI y en el VPS chico | Conteo de queries, de fetch o de filas — nunca segundos |

---

## 9. Overrides por proyecto (`.testquality.yml`)

Sólo **claves planas** (el parser del core no soporta mappings anidados). Todo es opcional:
omitir = defaults de este estándar. Precedencia: flag de la skill > `.testquality.yml` > estándar.
El quality gate IGNORA estas claves; las lee `scripts/perf/perf-ledger.sh`.

```yaml
# --- Performance (consumido por /perf-pass; el quality gate lo IGNORA) ---
# performance_dataset_ceiling: ["content.Document=200000", "accounts.User=5000"]   # filas al peor caso por modelo; falta = 10x actual
# performance_query_budget_default: 6          # listado (§2)
# performance_query_budget_detail: 4
# performance_query_budget_mutation: 8
# performance_page_size_max: 100
# performance_task_budget_s: 30
# performance_payload_kb: 256
# performance_bundle_kb: ["initial=300", "route=150"]   # gz
# performance_index_threshold_rows: 10000
# performance_paths: ["documents=backend/content/views/documents.py,backend/content/serializers/documents.py,frontend/pages/panel/documents"]  # acota inventario y guard del diff por módulo
# performance_exclude: ["reports=export batch ya asíncrono"]                       # fuera de alcance, con razón (se reporta ⏭️)
# performance_project_doc: docs/methodology/performance-standard.md              # contrato CÓMO del proyecto; este estándar fija el QUÉ
# performance_host_override: vps-projectapp-staging                              # fuerza el perfil (id de config/perf/compute-profile.yml); sólo para simular otro host
# performance_budget_tests: ["backend/content/tests/views/test_proposal_detail_queries.py"]   # tests de presupuesto existentes que la Fase 1 corre
# performance_silk_reports: backend/logs/silk-reports                            # dónde leer las señales de Silk cuando existen
```

- `performance_host_override` es para **simular** (p. ej. "¿cómo se comporta en el host
  chico?"); el perfil real de deploy sigue siendo el del `server:` de `projects.yml`.
- Un `performance_dataset_ceiling` menor al conteo actual se rechaza (el techo nunca es menor
  que la realidad).

---

## 10. Quick Reference

| Qué | Valor |
|---|---|
| Perfil de cómputo | `config/perf/compute-profile.yml` · `perf-ledger.sh --profile <proyecto>` |
| Queries por request | listado 6 · detalle 4 · mutación 8 · `Q(1) == Q(N)` |
| Página | cap 100 |
| Tarea | ≤ 30 s · transacción ≤ 5 s · Σ periódicas ≤ 0.5 × período |
| Payload / bundle | 256 KB JSON · 300 KB gz inicial · 150 KB gz por ruta · 200 KB por imagen |
| Casos | `worst` primero; `conservative` sólo con `escalation` |
| Evidencia | `file:line` + `cmd:`; números sólo en el reporte |
| Verificación | test de presupuesto (§6) escrito y corrido por `/qa` |
| Ledger | `config/perf-ledger/<codebase>.yml` · `scripts/perf/perf-ledger.sh` |
