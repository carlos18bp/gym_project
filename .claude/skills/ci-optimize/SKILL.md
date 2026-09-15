---
name: ci-optimize
description: "Mide, analiza y optimiza los tiempos del CI de un proyecto. Default read-only: reconstruye la línea de tiempo del run, identifica el job que realmente cierra (la cola, no el más grande), separa montaje de trabajo, y calcula el número óptimo de shards con una regla de parada explícita — cuándo dejar de shardear porque otro bloque pasó a ser el cuello. Con --apply escribe el cambio (matriz de shards, job de merge de coverage, flags de paralelismo) en la rama de sesión y abre PR. Nunca mergea."
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, AskUserQuestion, EnterWorktree
argument-hint: "[--apply (escribe el cambio y abre PR)] [--runs=N (default 3, cuántos runs promediar)] [--job=<nombre> (analizar un job puntual en vez de todo el run)]"
---

# ci-optimize — Medir, analizar y optimizar los tiempos del CI

> **⚠️ How to invoke** — **manual-only** (`disable-model-invocation: true`):
> ninguna sesión la auto-invoca. Consume llamadas a la API de GitHub y descarga
> artifacts; se corre cuando el operador quiere mirar tiempos.
> - Sin argumentos → **auditoría read-only**: mide, diagnostica y prescribe. No
>   escribe nada.
> - `--apply` → además aplica el cambio prescrito en un worktree de sesión y abre
>   PR. **Nunca mergea** — eso es del operador o de `[[merge-queue]]`.

## Goal

Bajar el tiempo de un CI **eligiendo bien qué tocar**. El valor de esta skill no
está en shardear: está en decir **qué NO shardear**, porque la respuesta obvia
suele gastar esfuerzo en cambios que no mueven el número.

Dos hallazgos medidos que la motivan (projectapp, ago-2026, CI de 71-73 min → 15):

1. **El conteo de tests no predice el tiempo.** Un directorio tenía el 29% de los
   tests y el 9% del tiempo; otro el 18% y el 43%. Repartir por cantidad —o por
   dominio de negocio, que sigue al conteo— arma shards desbalanceados 3 a 1, y
   el más lento marca el reloj igual.
2. **Optimizar lo que no es la cola rinde cero.** Subir un job de 4 a 6 shards lo
   mejoró de 13.4 a 11.7 min y **el run total se movió 13 segundos**, porque otro
   bloque ya era el que cerraba.

## Inputs

- `$ARGUMENTS` (opcional). Valores aceptados, combinables:
  - vacío → auditoría read-only del run más reciente de la rama por defecto.
  - `--apply` → aplicar el cambio prescrito. Fase de escritura.
  - `--runs=N` → promediar N runs en vez de 1 (default 3). Un solo run mezcla el
    cambio con la varianza entre runners; con N≥3 se distingue señal de ruido.
  - `--job=<nombre>` → saltar el diagnóstico del run y analizar ese job.
- Cualquier otro valor: abortar pidiendo uno de los aceptados.

## Constraints (no negociables)

- **Default read-only.** Sin `--apply` no se escribe nada: ni workflows, ni
  scripts, ni commits. Sólo lecturas por `gh` y artifacts a `/tmp`.
- **Nunca se mide con un pipe.** `comando | tail` devuelve el exit status de
  `tail`, no del comando: un gate rojo se reporta verde. Toda medición redirige a
  archivo y lee `$?` aparte. Es un error ya cometido en producción.
- **La métrica durable es el tiempo del JOB, no el del run.** El total del run
  mezcla el cambio con la disponibilidad de runners: en un pool saturado un job
  puede esperar 25 min en cola antes de arrancar. Se reportan los dos, y se
  atribuye la mejora **sólo** al job.
- **Branching (sólo `--apply`):** protocolo por sesión — worktree propio bajo
  `~/webapps/.wt/<repo>/` con slug `ci-optimize`, rama `ci/<DDMMYYYY>-ci-optimize`,
  cortada de la BASE que resuelve la coordenada. Push + PR al primer push con
  `Sesión:`/`Intención:` en el body. La skill **PARA con el PR abierto**.
- **Un cambio por entrega.** Después de cada optimización la cola se mueve de
  lugar; encimar dos cambios sin medir en el medio hace imposible atribuir cuál
  sirvió.

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): (1) flags explícitos → ejecutar directo, sin
menú; (2) intención clara en la sesión («¿por qué tarda tanto el CI?») → proponer
el comando en una línea y esperar confirmación; (3) sin argumentos e intención
difusa → UNA `AskUserQuestion` (Q1); (4) nunca en cron/headless ni dentro de un
barrido fleet.

**Q1 — Alcance** (`multiSelect: false`):

| label | description | preview |
|---|---|---|
| Sólo medir y diagnosticar (Recommended) | read-only: línea de tiempo, la cola real, montaje vs trabajo y el N óptimo con su regla de parada. No escribe nada | `/ci-optimize` |
| Medir sobre varios runs | igual, promediando 3 runs para separar la señal de la varianza entre runners | `/ci-optimize --runs=3` |
| Aplicar el cambio prescrito | escribe la matriz / el job de merge / los flags en un worktree de sesión y abre PR. No mergea | `/ci-optimize --apply` |

**Qué NO se pregunta:** el número de shards no se elige a dedo — sale de la regla
de parada de la Fase 3, y ofrecerlo como opción invita justamente al error que la
skill existe para evitar. `--job=<nombre>` es tuning: se tipea.

---

## La metodología

El orden importa. Cada fase decide si la siguiente tiene sentido, y saltarse una
es cómo se termina optimizando algo que no mueve el número.

### Fase 0 — Encontrar la cola, no el job más grande

El camino crítico es **la cadena de jobs que cierra el run**, no el job de mayor
duración. Un job de 40 minutos que arranca al principio y termina antes que el
resto no le cuesta nada al reloj.

```bash
gh run list --workflow=ci.yml --limit 5 --json databaseId,status,conclusion,createdAt,updatedAt
```

Con el `<run-id>` elegido (escribilo literal en el comando siguiente — dentro de
un worktree no se computan valores en bash):

```bash
gh run view <run-id> --json jobs -q '.jobs[] | "\(.startedAt) \(.completedAt) \(.name)"'
```

Se ordena por `completedAt` y se leen tres cosas:

- **quién cierra** (la cola) y **por cuánto margen** sobre el segundo;
- **el encolado**: `startedAt` del job menos `createdAt` del run. Un encolado
  grande significa pool saturado, y eso NO lo arregla shardear;
- **los bloques**: jobs que ya vienen en matriz cuentan como un bloque, y lo que
  importa es cuándo cierra el último de ellos más su job de merge.

> **Si la cola tiene menos de ~2 min de margen sobre el segundo bloque, PARÁ.**
> Optimizarla mueve el run hasta el segundo bloque y nada más. El reporte lo dice
> y propone atacar los dos juntos o ninguno.

### Fase 1 — Montaje contra trabajo (el go/no-go del sharding)

Desglose por step del job de la cola:

```bash
gh run view <run-id> --json jobs -q '.jobs[] | select(.name=="<job>") | .steps[] | "\(.startedAt) \(.completedAt) \(.name)"'
```

Se suma el **costo fijo** (checkout, setup del toolchain, instalación de
dependencias, cualquier step previo al comando de test) contra el **trabajo**
(el step que corre la suite):

| Montaje / job | Veredicto |
|---|---|
| **≥ 30%** | Shardear es mal negocio: se paga N veces y la curva se aplana enseguida. Atacar el montaje primero (caché, deps, trabajo muerto) |
| **10-30%** | Shardear sirve pero con N chico; medir el costo fijo real antes (Fase 3) |
| **< 10%** | Divide limpio |

**Antes de shardear, buscar trabajo muerto.** Es la palanca más barata y la más
frecuente: un step que prepara algo que la suite no usa. Caso medido: un
`manage.py migrate` que migraba una base que pytest nunca abre —crea la suya—,
33 s tirados en cada corrida y N×33 s después de shardear.

**Y revisar la utilización de cores**, que suele ser una línea: jest arranca con
`cores − 1` salvo que se le diga otra cosa. Comprobalo dividiendo la suma de
duraciones por el reloj del step: si da ~3 en un runner de 4 cores, sobra un core.
`--maxWorkers=100%` dio −16% en un caso real.

> **Orden de preferencia: trabajo muerto → utilización de cores → sharding.** El
> sharding es el más invasivo y el único que necesita gates de correctitud.

### Fase 2 — La unidad de reparto, medida y no supuesta

**Nunca repartir por cantidad de tests, por módulo ni por dominio de negocio.**
Las tres correlacionan entre sí y ninguna correlaciona con el tiempo.

Las duraciones salen del artifact que el CI **ya produce** — no hay que
instrumentar nada:

| Runner | Artifact | De dónde sale la duración |
|---|---|---|
| pytest | `pytest-results.xml` (junit, `--junitxml`) | `time` de cada `<testcase>`. **Ojo:** pytest no emite el atributo `file`; la ruta se deriva del `classname` punteado, tomando el último segmento que arranca con `test_` (las clases son `Test*` con mayúscula, así que no hay ambigüedad) |
| jest | `jest-results.json` (`--json --outputFile`) | `endTime - startTime` por suite |
| playwright | blob/json report | duración por spec |
| vitest | reporter json | idem jest |

```bash
gh run download <run-id> -n <artifact> -D /tmp/ci-optimize
```

Se agrega **por archivo** y se reparte con bin-packing *longest-processing-time*
(el archivo más pesado al shard más liviano). Con distribuciones planas —lo
habitual: mediana de segundos, sin outliers que dominen— queda a pocos puntos del
óptimo sin necesidad de ninguna dependencia.

Un archivo nuevo, sin peso registrado, entra con la **mediana**: no puede quedar
afuera del reparto.

### Fase 3 — El N óptimo y su regla de parada

Modelo: **`t(N) = fijo + trabajo / N`**

`fijo` **se mide, no se asume**. Tiene dos partes:

- el montaje del job (Fase 1);
- el **costo fijo interno del runner**: crear la base de test, correr las
  migraciones, importar módulos. Se obtiene comparando la suma de los tiempos por
  shard contra el trabajo total: el exceso es `N × fijo_interno`. En el caso
  medido dio ~41 s por shard, más 44 s de montaje ≈ **1.1 min**.

> ### La regla de parada
>
> **`N_opt` es el menor N tal que `t(N)` cae por debajo del bloque que le sigue
> en la cola.**
>
> Pasado ese punto: el reloj no mejora —cierra otro bloque—, los runner-minutes
> crecen linealmente (`N × fijo`) y aumenta la presión de cola, que es lo que
> hace que los jobs esperen. Un shard de más no es gratis: es peor.

Se reporta la curva completa para que la decisión sea visible:

| N | t(N) | runner-min | gana vs N−1 |
|---|---|---|---|

Y se marca la fila donde `t(N)` cruza por debajo del segundo bloque, con el
margen de holgura. **Conviene un N con ~2 min de margen**, no el mínimo exacto:
las suites crecen, y volver a shardear cuesta más que haber tomado uno más desde
el principio.

### Fase 4 — Aplicar (`--apply`)

Sólo con `--apply`. Worktree de sesión primero (bloque pre-entry, corre en el
clon principal):

```bash
# pre-entry: corre en el clon principal, antes de EnterWorktree
bash "$HOME/webapps/vps-ops-toolkit/scripts/maintenance/session-worktree.sh" create ci ci-optimize
```

Y entrar: `EnterWorktree path=$HOME/webapps/.wt/<repo>/ci-optimize`.

**Los tres gates de correctitud, no negociables.** Shardear rompe en silencio;
sin estos tres, el verde miente:

1. **Completitud** — cada archivo descubierto cae en **exactamente un** shard, y
   un guard lo verifica en el propio CI. El modo de fallo real de un corte por
   rutas no es un test que falla: es un test que **deja de correr**. Si el corte
   se hace con listas explícitas, el último shard debe ser catch-all por
   construcción (`--ignore` de los otros) para que un archivo nuevo no se caiga.
2. **Identidad del agregado** — tras combinar, el conteo de tests, el tiempo
   total de ejecución y el porcentaje de coverage deben coincidir con el baseline
   de un solo job. Mismos números, repartidos entre runners.
3. **El gate se muda al agregado** — un piso de coverage por shard mide una
   fracción del código y falla siempre. Se combina primero y se exige después, en
   un job de merge.

**El job de merge** replica el patrón que el repo ya tenga para sus shards de E2E
(`download-artifact` con `pattern:` + `merge-multiple`, luego el comando de
agregación). Debe **conservar el nombre y la forma del artifact** que publicaba el
job único, o los consumidores aguas abajo —el resumen de coverage, el comentario
del PR— dejan de encontrarlo.

**Nombres de artifact:** usar `${{ strategy.job-index }}` y no `matrix.shard`.
`upload-artifact@v4` exige nombres únicos y un shard `"1/4"` lleva una barra.

**Referencias de implementación** (projectapp, ya en `main`): `scripts/ci/backend-shard-plan.py`
mide y emite los pesos; `backend-shard-files.py` reparte y verifica completitud
con `--check N`; `backend-merge-shards.py` combina coverage y funde los junit en
un `<testsuite>` único con los contadores sumados.

**Lo que el sharding destapa.** Fixtures de sesión que asumían la suite completa.
Caso real: una `autouse` de scope sesión que consultaba la base moría en una
selección compuesta sólo por tests que no tocan la base — inalcanzable con un job
único, a un comando de distancia con shards. Si un shard falla en `setup` y no en
un test, mirá ahí antes que al reparto.

### Fase 5 — Verificar y re-medir

Con el CI del PR ya cerrado:

- **Identidad del agregado**: mismo conteo de tests, mismo tiempo total sumado,
  mismo porcentaje de coverage que el baseline. Un conteo menor con más shards es
  la señal de que algo dejó de correr, no de que anduvo más rápido.
- **La mejora atribuible**: el tiempo del **job**, comparado contra el baseline.
- **El total del run**, reportado aparte y con la advertencia de contención si el
  encolado cambió entre las dos corridas.
- **Dónde quedó la cola ahora.** Se movió. El reporte nombra al nuevo cuello y su
  margen, que es el insumo de la próxima corrida de esta skill.

---

## Trampas medidas

| Trampa | Cómo se manifiesta | Qué hacer |
|---|---|---|
| Pipe a `tail` | El gate se reporta verde estando rojo: `$?` es el de `tail` | Redirigir a archivo, leer `$?` aparte |
| Pool ocioso vs saturado | El run baja 30% y parece mérito del cambio; era que no había cola | Atribuir por tiempo de JOB; reportar el encolado |
| Conteo como proxy | Shards desbalanceados 3 a 1 con un reparto que en teoría era perfecto | Medir del junit/json, nunca contar |
| Pesos viejos | El reparto predice ±0% y sale ±20% | Regenerar los pesos desde el run más reciente de la rama |
| Varianza entre runners | Dos shards con el mismo peso difieren 30% | Es normal: son máquinas distintas. No re-balancear por eso; usar `--runs=3` |

---

## Acciones disponibles

Tras el reporte, si la sesión es interactiva y NO hubo flags explícitos (§4):

| Opción (label) | description (costo/efecto) | preview (comando exacto) |
|---|---|---|
| Aplicar el cambio prescrito | escribe la matriz / el job de merge / los flags en un worktree de sesión y abre PR; no mergea | `/ci-optimize --apply` |
| Medir sobre 3 runs | separa la señal de la varianza entre runners antes de decidir | `/ci-optimize --runs=3` |
| Analizar otro job | el diagnóstico completo de un job puntual, saltando el del run | `/ci-optimize --job=<nombre>` |
| Ver el run en el browser | inspección manual de la línea de tiempo | `gh run view <run-id> --web` |

Blocklist §4: **nunca** se ofrece `gh pr merge` ni `/merge-when-green` — esta
skill cierra con el PR abierto y el merge es del operador o de `[[merge-queue]]`.
Tampoco `/deploy-and-check`, que es manual-only.

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica:

```markdown
🟢 ci-optimize OK

| Dimensión | Estado | Detalle |
|---|---|---|
| Run analizado | ✅ | <run-id> · <duración> · encolado <N> min |
| Cola del run | ✅ | <job> cierra en T+<N>, margen <M> sobre <segundo bloque> |
| Montaje vs trabajo | ✅ | <N>s de montaje sobre <M> min de trabajo (<P>%) |
| Palanca elegida | ✅ | <trabajo muerto / cores / sharding> — <por qué> |
| N óptimo | ✅ | <N> shards · t(N)=<X> min · cruza bajo <bloque> con <M> min de holgura |
| Aplicado | ⏭️ | read-only (sin --apply) |
```

Con `--apply`, las filas de escritura reemplazan la última:

```markdown
| Gates de correctitud | ✅ | completitud N/N · agregado idéntico · piso movido al merge |
| PR | ✅ | #<n> — <url> |
| Mejora medida | ✅ | job <antes> → <después> · run <antes> → <después> |
| Nueva cola | ℹ️ | <job> con <N> min — insumo de la próxima corrida |
```

## Next steps

- `/ci-optimize` — volver a medir tras el merge: la cola se movió.
- (si quedó ⏸️) el bloque que ahora cierra el run, con su margen.
