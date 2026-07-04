---
auto_execution_mode: 2
description: "Conecta este host al tailnet del fleet: corre tailscale up, te muestra la URL de login para autorizar en el browser, y verifica la conexion. Idempotente: si ya esta conectado solo reporta."
---

# Tailscale Connect

Conecta **el host actual** al tailnet del fleet de punta a punta y **te devuelve
el link de login en la respuesta** para que lo autorices en el browser, luego
verifica que la conexión quedó arriba. Es el complemento operativo de
[[bootstrap-tailscale-fleet]]: aquél *imprime* el comando `tailscale up` y delega
el OAuth; **este skill lo corre, scrapea la URL, espera tu aprobación y verifica**.

> **⚠️ Cómo invocar**:
> - `/tailscale-connect` → conecta este host (o reporta si ya está conectado).
> - `/tailscale-connect --check` → sólo diagnóstico read-only (Phase 0), no conecta.
> - Opera **siempre sobre el host donde corre la sesión** (identificado por
>   `hostname -s`). NUNCA usa `tailscale ssh` contra otro VPS — este skill es
>   local-only.

## Cuándo usarla

- Workstation nueva o VPS recién provisionado que todavía no está en el tailnet.
- Tras un `tailscale down` / logout / expiración de key: reconectar rápido.
- Cuando querés el link de auth servido en la respuesta en vez de tipear el
  `tailscale up` a mano y copiar la URL de la terminal.

Para **auditar** el tailnet, **registrar** el nodo en `expected-nodes.yml`, o el
onboarding completo bimodal, usá [[bootstrap-tailscale-fleet]] / [[init-fleet]].

## Diferencia con [[bootstrap-tailscale-fleet]]

| Aspecto | tailscale-connect (este) | bootstrap-tailscale-fleet |
|---|---|---|
| Corre `tailscale up` | **Sí** (background + captura URL) | No, sólo lo imprime |
| Muestra el link en la respuesta | **Sí** | No |
| Espera aprobación + verifica | **Sí** | No (delega al operador) |
| Toca el registry / admin console | No | Sí (`--add-self`, `--audit`) |
| Alcance | Sólo el host local | Bimodal dev/VPS + fleet |

## Procedimiento (lo que Claude ejecuta)

### Phase 0 — Identificar host + preflight (read-only)

1. `hostname -s` → mapear a alias: `srv571894`→vps-projectapp-staging,
   `srv1681495`→vps-projectapp-prod, `srv614758`→vps-gym. Dev machine si
   `is_dev_machine` (helper de `scripts/lib/bootstrap-common.sh`).
2. Decidir el flag de conexión: **dev** → `tailscale up --ssh`; **VPS** →
   `tailscale up --ssh --hostname=$(hostname -s)`.
3. Preflight:
   - Instalado? `command -v tailscale`
   - Daemon? `systemctl is-active --quiet tailscaled`
   - **Ya conectado?** `tailscale status >/dev/null 2>&1`
4. **Corto-circuito idempotente**: si ya está conectado, reportar el estado
   (`tailscale ip -4 | head -1` + nombre de nodo) y **terminar** — no re-autentica.
   Si el arg es `--check`, terminar acá siempre (sólo diagnóstico).

### Phase 1 — Install + enable (sólo si falta)

```bash
curl -fsSL https://tailscale.com/install.sh | sh     # si no está instalado
sudo systemctl enable --now tailscaled                # si el daemon no corre
```

### Phase 2 — Conectar + capturar el enlace

`tailscale up` **bloquea** hasta que autorices en el browser, así que se corre en
**background** y se le scrapea la URL:

1. Lanzar en background (Bash `run_in_background`), redirigiendo a un logfile en
   el scratchpad, el comando decidido en Phase 0:
   ```bash
   sudo tailscale up --ssh [--hostname=$(hostname -s)]   # > <scratch>/tsup.log 2>&1
   ```
2. Detectar el prompt de auth y extraer la URL del logfile (mismo patrón que
   `scripts/maintenance/propagate-toolkit-commit.sh`):
   - prompt: `grep -qiE 'to authenticate, visit|requires an additional check'`
   - URL: `grep -oE 'https://login\.tailscale\.com/[A-Za-z0-9/._-]+' <log> | head -1`
   - usar un `until grep ... <log>` en background (o `Monitor`) para detectar la
     URL apenas aparece (~1-2s).
3. **Mostrar la URL en la respuesta** (esto es el "me lo da en su respuesta"):
   > Abrí este link en el browser y autorizá con la cuenta Google del fleet
   > (`core.paginaswebscolombia@gmail.com`): **`<URL>`**
   > (En un VPS: abrilo en el browser de tu **dev**, no en el del VPS.)

**Caveat sudo**: si `sudo` pide password y no es passwordless, el comando en
background cuelga. Fallback: mostrar el comando exacto para que lo corras vos con
el prefijo `! sudo tailscale up …` en el prompt, y continuar en Phase 3. (En los
hosts del fleet sudo suele ser passwordless — los scripts de bootstrap lo asumen.)

### Phase 3 — Esperar aprobación + verificar

1. El operador abre el link y autoriza. Al autorizar, el `tailscale up` en
   background **sale 0** → llega la notificación de completion del harness (ese es
   el "wait" natural). Como red de seguridad, poll acotado:
   `until tailscale status >/dev/null 2>&1; do sleep 3; done` (tope ~3 min).
2. Verificar (triada de `scripts/diagnostics/tailscale-fleet-check.sh`):
   - `tailscale status` sale 0
   - `tailscale ip -4 | head -1` devuelve una IP `100.x`
   - nodo: `tailscale status --json | jq -r '.Self.DNSName // "" | split(".")[0]'`
   - (VPS) ssh cap habilitado:
     `tailscale status --self --json | grep -q '"https://tailscale.com/cap/ssh"'`
3. Next steps a sugerir:
   - Si el nodo **no** está en `config/tailscale/expected-nodes.yml`:
     `/bootstrap-tailscale-fleet --add-self` para registrarlo.
   - (VPS) recordatorio manual: *Disable key expiry* en el admin console
     (https://login.tailscale.com/admin/machines) — el Free plan no expone API.

## Comandos de referencia

```bash
# Preflight / gate "estoy conectado?"
tailscale status >/dev/null 2>&1 && echo connected || echo not-connected
tailscale ip -4 | head -1

# Conectar (elige según host)
sudo tailscale up --ssh                          # dev workstation
sudo tailscale up --ssh --hostname=$(hostname -s)  # VPS

# Verificación post-auth
tailscale status
tailscale status --json | jq -r '.Self.DNSName // "" | split(".")[0]'
tailscale status --self --json | grep -q '"https://tailscale.com/cap/ssh"' && echo ssh-ok
```

## Guardrails

- **Local-only**: opera exclusivamente sobre el host de la sesión. NUNCA
  `tailscale ssh ryzepeck@vps-X` — este skill no salta a otros VPS.
- **Idempotente**: ya-conectado ⇒ sólo reporta, no re-autentica.
- **No toca** el registry (`expected-nodes.yml`) ni el admin console — eso es de
  [[bootstrap-tailscale-fleet]]. Sólo instala/enablea/autentica el `tailscaled`
  local.
- Identificá el host ANTES de decidir `--hostname` (regla CLAUDE.md "identificar
  el host antes de llamar a Tailscale").

## Códigos de salida

- `0` — conectado y verificado (o ya estaba conectado).
- `1` — pausa manual pendiente (URL mostrada, esperando autorización del operador).
- `2` — error (install falló, daemon no arranca, verificación no pasa tras auth).

## Output final

Reportar siguiendo [[_output-protocol]]. Plantilla específica de esta skill:

🟢 tailscale-connect OK — <host> conectado (IP 100.x, nodo <nombre>) — todas las celdas ✅
⏸️ tailscale-connect — pausa manual pendiente — URL de login mostrada, esperando OAuth del operador
🔴 tailscale-connect — N error(es), revisar arriba — install/daemon falló o verificación no pasó
⏭️ tailscale-connect — N/A o saltado — `--check`, o ya estaba conectado

| Dimensión | Estado | Detalle |
|---|---|---|
| Host / alias | ℹ️ | `hostname -s` + alias resuelto |
| tailscale instalado + daemon | ✅/❌ | versión + `tailscaled` activo |
| Autenticación | ✅/⏸️ | conectado / esperando OAuth (URL mostrada) |
| Verificación (status + IP + ssh cap) | ✅/⚠️/❌ | IP `100.x` + nodo + ssh cap |
| Registro en expected-nodes.yml | ℹ️ | presente / sugerir `--add-self` |

## Next steps (si aplica)
- (manual, operador) abrir la URL de login y autorizar con la cuenta del fleet.
- `/bootstrap-tailscale-fleet --add-self` — registrar el nodo en el repo.
- (admin console) *Disable key expiry* si es un VPS.

## Referencias

- Skill de onboarding/audit/registry: [[bootstrap-tailscale-fleet]]
- Entry-point de host nuevo: [[init-fleet]]
- Diagnóstico standalone: [`scripts/diagnostics/tailscale-fleet-check.sh`](../../scripts/diagnostics/tailscale-fleet-check.sh)
- Patrón de captura de URL: [`scripts/maintenance/propagate-toolkit-commit.sh`](../../scripts/maintenance/propagate-toolkit-commit.sh)
- CLAUDE.md sección "Acceso al fleet desde dev"
- Tailscale SSH docs: https://tailscale.com/kb/1193/tailscale-ssh/
