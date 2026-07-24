# Test Audit — 2026-07-24

**Mode:** report-only (Phases 0–4). **No test file was created, modified, or deleted.**
**Repo:** `gym_project_staging` · **Branch:** `release-august-2026-c-v2` (clean, 0 behind base/master).
**Gate:** `test_quality_gate.py --semantic-rules strict` over the whole corpus.
**AST bridge:** available (node v22.13.0 + `@babel/parser`) → **full fidelity**, all JS-AST rules ran.

## Why this audit exists

Commits `7c3af01` (adopt the canonical test quality core) and `7395579` (block new
junk tests in CI, grandfather the existing debt) introduced the gate and a
grandfather list, `.junk-baseline.json`, holding **553 pre-existing junk findings**.
Those stay *warnings* under the baseline, so the gate reports **score 98 / passed**.
The 98 measures *"no new junk"*, not *"tests verify behavior"*. This audit reads the
whole corpus with eyes open and assigns each finding a verdict.

---

## 1. Inventory

| Layer | Files (fs / gate) | Tests (gate) | Errors | Warnings | Info |
|---|---|---|---|---|---|
| Backend pytest | 101 / 101 | 3,149 | 0 | **4** | 60 |
| Frontend unit (Jest) | 207 / 205 | 2,277 | 0 | **382** | 0 |
| Frontend E2E (Playwright) | 204 / 204 | 631 | 0 | **171** | 0 |
| **Total** | **512 / 510** | **6,057** | **0** | **557** | **60** |

Gate score **98**, status **passed**. (fs = filesystem count; gate = files the gate
scanned — it skips 2 unit files with no conforming test + a handful of helper-only
backend fns. Backend also has 582 `Test*` classes but only **16** `parametrize`
uses — see §6.)

## 2. The grandfathered debt (what the 98 hides)

`.junk-baseline.json` = **553** findings, all warnings, **97% frontend**:

| Layer | Baselined findings |
|---|---|
| frontend-unit | 382 |
| frontend-e2e | 171 |
| backend | **0** |

The 553 = every warning **except** the 4 `too_many_assertions`
(371 + 81 + 73 + 14 + 14). Separately, the code already carries **553 in-code
`quality: allow-*` markers** (dominated by `fragile_locator` **515**) — an
already-acknowledged KEEP population, not counted below, but a latent concern: 515
E2E locators are tolerated as fragile.

## 3. Class breakdown (7 audit classes)

| # | Class | Signal | Count | Concentration | Default verdict |
|---|---|---|---|---|---|
| 1 | No interaction | `no_user_interaction` | 73 | e2e | REWRITE · DELETE if flow covered elsewhere |
| 2 | Lying tag | `flow_tag_mismatch` | 81 | e2e | REWRITE |
| 3 | Weak assertion | `weak_assertion` | 371 | **unit** | REWRITE |
| 3b | Non-deterministic | `global_state_leak` (info) | 60 | unit | REWRITE (determinism) |
| 3c | Over-asserting | `too_many_assertions` | 4 | mixed | REWRITE (split) |
| 4 | Duplicate | `duplicate_coverage` | 14 | unit + e2e | MERGE |
| 5 | Tests the mock | `mock_call_contract_only` | 1 (allow-marked) | unit | KEEP (marked) |
| 6 | Impl-coupled | `implementation_coupling` | 4 (allow-marked) | unit | KEEP (marked) |
| 7 | No subject | constants / barrels / re-exports | **0** | — | n/a |

No class-7 (no-subject) tests were detected — nothing tests a constant/barrel. The
"tests the mock" (1) and "implementation-coupled" (4) findings already carry
`allow-*` markers with reasons → they stay KEEP.

## 4. Flow coverage (authoritative after Phase 3 reconciliation)

**164 flows** (the "168" was phantom: 15 duplicate SECOP headings + 11 non-conforming
headings in the map — now reconciled; JSON was already authoritative).

| Status | Count |
|---|---|
| covered | 140 |
| partial | 0 |
| **junk-only** | **20** |
| **missing** | **4** |
| declaring `outcomes` schema | **0 / 164** |

**20 junk-only flows** (report green, but every tagged test is disqualified by
`no_user_interaction`/`flow_tag_mismatch` — actively misleading, top priority):

- **P1 (4):** `auth-login-google`, `auth-login-outlook`, `service-fill-form`, `service-submit-request`
- **P2 (9):** `auth-idle-logout`, `auth-router-guards`, `legal-files-auto-redirect`, `process-case-file-upload`, `process-edit`, `profile-complete`, `secop-create-alert`, `service-admin-edit`, `service-save-draft`
- **P3 (6):** `secop-apply-saved-view`, `secop-keyword-tags`, `secop-save-view`, `secop-saved-view-favorites`, `secop-sync-status`, `service-admin-form-validation`
- **P4 (1):** `misc-offline`
- By module: **secop 6, services 5, auth 4**, processes 2, profile/signatures/misc 1 each.

**4 missing flows:** `process-alerts`, `process-alert-configure` (both were falsely
marked "closed 16-07" — zero qualifying evidence, likely a lost `@flow:` tag),
`minutas-columns`, `minutas-shared-visibility`. Also **14 untagged tests** and **18
modules** whose only declared outcome is `success`.

## 5. Triage — Phase 5 batches (QUEUED, not executed)

Smallest blast radius first; each batch commits alone (`TEST: audit batch N — <class>`),
runs touched files + module regression only, stops on first regression.

| Batch | Class | Count | Skill | Named targets (representative) |
|---|---|---|---|---|
| 1 | DELETE no-subject | 0 | — | none found → skip |
| 2 | MERGE duplicate_coverage | 14 | test-audit `--apply` | `SendDocument.test.js` (6 → one `it.each`); 8 singletons (`SendDocumentModal`, `UseDocumentByClient`, `CreateEditFolderModal`, `AllMembersModal`, `stores/auth/user`, `views/policies/TermsOfUse`, `views/user_guide/RoleInfoCard`) — merge into the stronger-assertion sibling |
| 3 | REWRITE weak_assertion | 371 | frontend-unit-test-coverage + test-quality-gate P3/P4 | stores (161): `corporate_requests` **26**, `dynamic_document/documents` **22**, `organizations` **20**, `organization_posts` **15**, `secop-status-branches` **12**; components (188): `BaseDocumentCard` **14**, `menuOptionsHelper`/`SlideBar` **9** each |
| 3b | REWRITE global_state_leak | 60 | test-quality-gate P1/P3 | unit determinism/leak sweep (info-level) |
| 4 | REWRITE no_user_interaction + flow_tag_mismatch + no_data_assertion | 73 + 81 + 14 | frontend-e2e-test-coverage | **junk-only flows first**: `basic-restrictions` (8 no-int), `router-guards` (4), `policies-navigation` (4); `outlook-login` (3 tag), `secop-alert-create`/`secop-keyword-tags`/`secop-saved-view-favorites`/`secop-saved-views` (3 each), `electronic-signature-modal` (3); `secop-edit-saved-view` (3 no-data) |
| — | ADD missing backend coverage | — | backend-test-coverage | `ActivityFeed` model (no dedicated test); the 2 falsely-"closed" process-alert flows |

**DELETE vs REWRITE rule for class 1/2:** an e2e test whose flow is one of the 20
**junk-only** flows has *no* alternate coverage → it must be **REWRITTEN** (deleting
would drop the flow to `missing`). Only `no_user_interaction` tests whose flow is
otherwise `covered` are DELETE candidates.

### Coverage before/after (expected, and intended)

Rewriting the 20 junk-only flows **removes fraudulent credit** — covered will fall
from **140** toward **~120**, and those 20 flows surface as honestly `missing`/pending
until real interactions land. **The drop is the point**, not a regression. Register
the 4 `missing` + the 20 junk-only in `docs/USER_FLOW_MAP.md` before any DELETE.

## 6. Backend — different debt (no gate junk)

Backend carries **0** baselined findings (4 warnings + 60 info only). Its debt is not
junk but:
- **Missing coverage:** `ActivityFeed` model has no dedicated backend test (frontend
  covers it). `dashboard × backend` is NA-by-design (the one endpoint lives under
  corporate-requests and is tested there).
- **Duplication risk:** 582 `Test*` classes, only **16** `parametrize` — many
  near-identical class methods that should become `pytest.mark.parametrize` tables
  (the backend analogue of `duplicate_coverage`).

## 7. Tooling & methodology defects found (report-only — NOT patched)

These live in fleet-synced files (source: `vps-ops-toolkit`) or are project bugs;
record for the owner, don't patch locally.

1. **`scripts/maintenance/resolve-work-coordinate.sh` missing** — `test-audit` Phase 0
   calls it; the directory doesn't exist. Coordinate resolved manually (release branch).
2. **`--files` gate flag is bogus** — `backend-/frontend-unit-/frontend-e2e-test-coverage`
   skills invoke `test_quality_gate.py --files <f>`, which argparse-errors. Real flags:
   `--include-file` / `--include-glob`.
3. **`create_legal_requests.py:86` cwd-relative path** — hardcodes `media/example_files/`,
   so `create_fake_data` only works with cwd=`backend/`; the `fake-data-refresh` skill
   runs `manage.py` **without** `cd`-ing into `CMD_DIR`, so a by-the-book invocation
   fails midway. Fix: resolve via `settings.MEDIA_ROOT`/`BASE_DIR`, or `cd` in the skill.
4. **`outcomes` schema unadopted (methodology headline):** 0 / 164 flows declare
   `outcomes` — all still on legacy `expectedSpecs`. The flow audit therefore only
   evaluates the `success` class; 18 modules show `outcome_gaps` (no `error`/`failure`
   signal). Migrating is a distinct hardening step (do not auto-generate — it invents
   unreviewed requirements).

---

🟡 **test-audit OK — 553 baselined junk findings + 20 junk-only flows over 6,057 tests; report-only, nothing written to the corpus**

### Top 3 acciones prioritarias
1. **20 flows `junk-only`** (secop 6 / services 5 / auth 4) reportan verde sin cubrir nada — REWRITE con interacción real (batch 4). Prioridad sobre todo lo demás.
2. **371 `weak_assertion`** concentrados en `frontend/test/stores` (161) y `components` (188) — REWRITE por patrón, empezando por `corporate_requests`/`documents`/`organizations` (batch 3).
3. **14 `duplicate_coverage`** — MERGE sin pérdida de cobertura, `SendDocument.test.js` (6) primero (batch 2).

| Dimensión | Estado | Detalle |
|---|---|---|
| Preflight | ✅ | `.testquality.yml` leído, tree limpio, coordenada = release branch |
| AST bridge | ✅ | node v22.13 + `@babel/parser` → fidelidad completa, reglas AST corrieron |
| Inventario | ℹ️ | backend 101/3149 · unit 205/2277 · e2e 204/631 · score 98, 557 warn, 0 err |
| Clase 1 sin interacción | ⚠️ | 73 (e2e) → REWRITE / DELETE-si-cubierto |
| Clase 2 tag mentiroso | ⚠️ | 81 (e2e) → REWRITE |
| Clase 3 assert débil | ⚠️ | 371 (unit) → REWRITE + 60 leak + 4 over-assert |
| Clase 4 duplicados | ⚠️ | 14 → MERGE (0 pérdida de cobertura) |
| Clases 5–7 | ℹ️ | mock-only 1 + impl-coupled 4 ya con `allow-*` → KEEP; no-subject 0 |
| Flows | ⚠️ | 164: 140 cubiertos / **20 junk-only** / 4 missing / 0 con `outcomes` |
| Backend | ℹ️ | 0 junk; deuda = cobertura faltante (`ActivityFeed`) + 582 clases/16 parametrize |
| Defectos de tooling | ⚠️ | 4 hallazgos (resolve-coordinate, `--files`, seeder cwd, `outcomes` sin adoptar) |
| Aplicación | ⏭️ | modo report-only: **no se escribió nada al corpus de tests** |

### Next steps
- `/test-audit --apply` — proponer los lotes de limpieza (batch 2 → 3 → 4) para aprobación por lote.
- `/frontend-e2e-test-coverage` — cerrar los 20 flows junk-only con interacción real (empezar por P1: auth/service login+form).
- `/frontend-unit-test-coverage` — REWRITE de `weak_assertion` por patrón en `stores/` y `components/`.
- (toolkit owner) corregir los 4 defectos de tooling del §7.
- (opcional) migrar los 164 flows al schema `outcomes` para recuperar señal de `error`/`failure`/`display`.
