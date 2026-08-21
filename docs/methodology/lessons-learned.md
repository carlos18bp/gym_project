# Lessons Learned — G&M Internal Management Tool

## Language & UI Conventions

### Spanish UI, English Documentation
- All user-facing text in the frontend is in **Spanish**
- All code comments, documentation, and commit messages are in **English**

---

## Code Style & Conventions

### No TypeScript; ES Modules with `.js` Extensions
- The frontend does not use TypeScript
- All JavaScript files use ES Modules with `.js` extensions

### Composition API / `<script setup>` Style
- Vue components use Composition API with `<script setup>` syntax
- This is the preferred pattern for all new components

### Four User Roles
- The system defines four user roles: `client`, `lawyer`, `basic`, `corporate_client`
- A fifth role `admin` exists in `ROLE_CHOICES` for elevated users
- Permissions and views are scoped based on these roles
- Role guard in Vue Router: `requiresLawyer: true` redirects non-lawyer-like users to dashboard

### `isLawyerLike` Predicate — Single Source of Truth
- Defined as a getter on `frontend/src/stores/auth/user.js`: returns true for `role === 'lawyer'`, `role === 'admin'`, `is_staff`, or `is_superuser`
- **Always consume the getter**, never inline the predicate. Inlining caused the editor to drop the "Continuar" button for `is_staff` users with `role='client'` (the route guard accepted them, but the editor checked role-only)
- Callsites that consume it (lock-step): `router/index.js` (route guard `requiresLawyer`), `views/dynamic_document/DocumentEditor.vue` (`isClient`), `views/dynamic_document/Dashboard.vue`, `client/UseDocumentTable.vue`, `composables/document-variables/useDocumentPermissions.js`, `composables/document-variables/useDocumentTags.js`, `cards/menuOptionsHelper.js`
- The user manual (`stores/user_guide/`) maps these users to a synthetic `'admin'` role via `roleMatches` so they see lawyer modules + an admin-only module

---

## Linting & Testing

### Ruff for Backend, Jest/Playwright for Frontend
- Backend: **Ruff** for linting, **pytest** for testing
- Frontend: **Jest** for unit tests, **Playwright** for E2E tests
- Backend test markers actually applied (verified 2026-07-24): `django_db` 995, `edge` 151, `contract` 64, `integration` 60. `rest` is declared in `pytest.ini` but used **0** times — don't cite it as a live marker.
- E2E flow coverage tracking with custom Playwright reporters and `flow-definitions.json`

### Test Execution Constraints
- **Never run the full test suite** — always specify files
- Maximum 20 tests per batch, 3 commands per cycle
- Backend: activate venv first — `source venv/bin/activate && pytest path/to/test_file.py -v`
- Use `E2E_REUSE_SERVER=1` when dev server is already running

### Test Quality Standards
- One behavior per test — no conjunctions in test names
- Assert observable outcomes (status codes, DB state, rendered UI)
- No conditionals in test body — use parameterization
- Follow AAA pattern: Arrange → Act → Assert
- Mock only at system boundaries (external APIs, clock, email)

### Coverage Is the Readout, Not the Goal
- A coverage percentage measures which lines a test *touched*, not whether the test would *fail if the behavior broke*. A spec that renders a component and asserts `#app` exists lifts coverage while verifying nothing.
- The coverage skills (`backend-test-coverage`, `frontend-unit-test-coverage`, `frontend-e2e-test-coverage`) exist to close *behavioral* gaps — write the assertion that goes red on a real regression first, and let coverage move as a side effect.
- This framing is now enforced mechanically: the junk detectors below fail tests that raise coverage without observable assertions.

### Test-Quality Gate: `.testquality.yml` Thresholds & Junk Baseline (2026-07-23/24)
- The canonical test-quality core (`7c3af01`) reads a per-project `.testquality.yml`. Key thresholds: `max_test_lines 50`, `max_assertions_per_test 7`, `min_test_lines 3`, `max_timeout_ms 100`, and `banned_tokens: batch / coverage / cov / deep` (a test named `*_batch`/`*_coverage*` is a junk smell — name it after the behavior instead).
- Existing debt is grandfathered in `.junk-baseline.json` (**553** findings: frontend-unit 382, frontend-e2e 171, backend 0). CI blocks only NEW junk; the baseline is warning-only and **may only ever shrink** — never append to it to silence a fresh finding.
- Run the gate scoped with `--include-file <path>` or `--include-glob <glob>`. Current gate score **98** with 557 warnings (dominated by weak_assertion 371 and flow_tag_mismatch 81).

### Gate/Skill Tooling Defects Found 2026-07-24 (report-only, not yet fixed)
- `scripts/maintenance/resolve-work-coordinate.sh` — referenced by the `test-audit` skill (and `merge-when-green`) — **does not exist in this repo**. Any skill step that shells out to it will fail; resolve the work coordinate manually until the script is added.
- The three coverage skills (`backend-test-coverage`, `frontend-unit-test-coverage`, `frontend-e2e-test-coverage`) document a gate invocation with a **`--files` flag that does not exist**. The real flags are `--include-file` / `--include-glob` (see `scripts/test_quality_gate.py`). Substitute them when following those skills.

---

## Architecture Patterns

### Domain-Split Models
- Models are split into sub-packages under `backend/gym_app/models/`
- Each domain area has its own model file: user, process, dynamic_document, organization, legal_request, corporate_request, subscription, intranet_gym, legal_update, secop, password_code, email_verification_code

### Complex Pinia Stores with Sub-Module Pattern
- Complex stores (dynamic_document, organizations) use sub-module pattern
- Sub-modules: `state.js`, `getters.js`, `actions.js` / domain files (e.g., `folders/`, `filters.js`, `permissions.js`)
- Simple domains use single `index.js`

### SlideBar Layout Wrapper
- All authenticated routes use the `SlideBar` layout wrapper component
- Provides consistent navigation sidebar for logged-in users
- Route meta: `{ requiresAuth: true }` for guard enforcement

### Two Task Files + SECOP Tasks
- `gym_app/tasks.py` — business logic tasks (subscription billing, cancellation)
- `gym_project/tasks.py` — infrastructure tasks (backups, silk GC, slow query reports)
- `gym_app/secop_tasks.py` — SECOP sync, alert evaluation, daily/weekly summary emails

### Service Layer for External API Calls
- Complex external integrations use a `services/` sub-package
- SECOP has three services: `secop_client.py` (API fetching), `secop_sync_service.py` (sync logic), `secop_alert_service.py` (alert matching)

### SECOP Public API Authentication Must Degrade Safely
- `SECOP_APP_TOKEN` is an optional rate-limit credential, not a requirement for the public dataset
- If Socrata rejects a configured token with 401/403, retry once without `X-App-Token` and keep subsequent pages anonymous for that client run
- Never log the token or pass raw backend diagnostics to the frontend; expose a safe failed state and retain the last successful timestamp
- Put the concurrency lock on `sync_secop_data`, not only on its periodic wrapper, so scheduled and manual entry points share the same guard
- Treat `SyncLog` as the authoritative UI state; local timers can control polling cadence but must never claim that a sync completed

### Views Sub-Package for Complex Domains
- Dynamic documents uses a `views/dynamic_documents/` sub-package to manage endpoint complexity

---

## Build & Deployment

### Frontend Build: Vite + Django Template Generation
- Frontend built with Vite (`npm run build`)
- Build script `scripts/generate-django-template.cjs` converts Vite output into a Django-compatible template
- Django serves the SPA template for all non-API routes via `SPAView`

---

## Known Patterns & Gotchas

### SweetAlert2 Selector
- Use `[class~="swal2-popup"]` to target SweetAlert2 popups in tests and styles
- The `swal2-popup` class is not the only class on the element, so exact-match selectors fail

### SECOP Alert Evaluations — Null Budget Guards
- SECOP alert evaluations require explicit null checks for `base_price` ranges
- Always guard: `if process.base_price is not None` before budget comparisons

### Prefetch_related and `.all()`
- When filtering prefetched querysets in Python, you **must** use `.all()` on the cached relation
- Direct filtering (`.filter()` without `.all()`) bypasses the prefetch cache and hits the database
- Example: `document.signatures.all().filter(signed=True)` — not `document.signatures.filter(signed=True)`

### E2E: `@flow:` Tags Must Be Inline in Spec Files
- The coverage scanner performs a **text search** for literal `@flow:<id>` strings in `*.spec.js` files
- Importing tag constants from `flow-tags.js` (e.g. `SECOP_LIST_BROWSE`) and spreading them in `tag:` arrays is **NOT detected** — the scanner does not resolve JS imports
- Always write tags inline: `tag: ['@flow:secop-list-browse', '@module:secop', '@priority:P2', '@role:lawyer']`
- The `flow-tags.js` constants are still useful for type safety in other contexts, but must not be the sole source of `@flow:` strings in spec files

### E2E: A Mis-Pointed `@flow:` Tag Silently Distorts Coverage
- Coverage status is a pure function of which `@flow:<id>` a spec carries, so a tag pointing at the **wrong** flow-id causes two silent errors at once: the flow it *should* tag reads as `missing` (false-red) and the flow it *does* tag reads as `covered` even though nothing exercises it (false-green)
- Seen 2026-07-04: `process-alert-recipients.spec.js` tested the alert **display** indicator but was tagged `@flow:process-alert-configure` (the interactive toggle). Retagging to `@flow:process-alerts` fixed both and exposed that the toggle flow genuinely has no spec (now a declared `knownGap`)
- When a flow has both a display and an interactive half, tag each spec by the half it actually drives; record the untested half via `knownGaps` in `flow-definitions.json` instead of leaving a false-green

### SECOP UNSPSC Filter: Advanced Filters Toggle Required
- The UNSPSC multi-select filter (`data-testid="filter-unspsc"`) in `SecopList.vue` is inside an "advanced filters" panel
- The panel is **hidden by default** — must click `data-testid="toggle-advanced-filters"` first, then `data-testid="advanced-filters"` becomes visible
- Tests that interact with UNSPSC on the list page must toggle advanced filters first

### SECOP SavedViewModal UNSPSC Field is Plain Text Input
- The UNSPSC field in `SavedViewModal.vue` (`data-testid="saved-view-filter-unspsc"`) is a plain `<input type="text">`, not a `MultiSelectDropdown`
- Use `.fill("72101500")` to interact with it — dropdown click/option selection patterns do NOT apply here
- The `MultiSelectDropdown` is used for UNSPSC on the main list page (`SecopList.vue`), not in the modal

### E2E: Avoid `waitForLoadState("networkidle")`
- `networkidle` is flaky in Playwright — avoid entirely
- Use `data-testid` attribute waits instead: `page.locator('[data-testid="my-element"]').waitFor()`
- All SECOP E2E specs were migrated away from networkidle (2026-03-19)

### E2E: `bypassCaptcha` uses `window.__e2eCaptchaVerified`
- E2E captcha bypass relies on `window.__e2eCaptchaVerified = true` via a `grecaptcha` stub
- Do NOT rely on Vue component internals for captcha state — this approach is version-stable

### UNSPSC Filter: Multi-Select + Union with Keywords
- SECOP UNSPSC filter uses multi-select (multiple values allowed)
- UNSPSC filter results are **unioned** with keyword search results, not intersected
- Implemented in `SecopList.vue`, `secop/index.js` store, `SavedViewModal.vue`, `SavedViewsList.vue`

### Optimistic Locking for State Transitions
- For document state transitions (formalize, correct), use `filter(pk=..., state='Expected').update(...)` instead of `select_for_update()`
- Returns 0 rows if state was changed concurrently — respond with 409 Conflict
- Avoids holding row locks during validation; `@transaction.atomic` still ensures atomicity of multi-step operations
- Applied pattern: `formalize_document` (Completed → PendingSignatures), `correct_document` (Rejected/Expired → PendingSignatures)

### Single-Endpoint State Transitions
- Prefer dedicated endpoints for state transitions (e.g., `formalize_document`, `correct_document`) over multi-step frontend flows (update + reopen)
- Pattern follows `reopen_document_signatures` — single POST that validates state, mutates fields, and returns serialized result
- Benefits: atomic from client perspective, cleaner error handling, consistent with existing patterns

### Fake Data: Idempotency via `update_or_create` + `random.seed(42)`
- All management commands for fake data use `update_or_create` to be idempotent
- `random.seed(42)` ensures deterministic data generation across runs
- SECOP fake data validated as compliant with all business rules

### `is_open` Filter on SECOP
- The `is_open` filter in SECOP views was initially inverted — only processes with `closing_date` in the future are "open"
- Always check date comparison direction when implementing date-based open/closed filters

### `page_size` Crash Protection
- Always guard `page_size` query param with `int()` try/except — invalid strings cause unhandled crashes
- Pattern: `page_size = int(request.query_params.get('page_size', 10))`

### Blob URL Memory Leak in Export
- `URL.createObjectURL` must always be followed by `URL.revokeObjectURL` after triggering download
- Failure to revoke accumulates leaked blob URLs in long-running sessions (E2E, heavy users)

### SavedView Duplicate Name: Serializer-Level Validation
- Unique constraints (user+name) must be validated in the serializer `validate()` method
- Django ORM raises `IntegrityError` at DB level (500) unless caught at serializer level (400)

### reCAPTCHA v2 Tokens Are Single-Use
- Each token can be verified against Google `siteverify` **only once**; subsequent verifications return `success: false` with `timeout-or-duplicate`
- Tokens also expire ~2 minutes after the user solves the challenge
- In multi-step flows (e.g. registration: `send_verification_code` → `sign_on`), only the **first** step should call `verify_captcha`. The second step relies on the emailed passcode/token as its bot-proof gate
- E2E mocks (`authSignOnMocks.js`) always return `success: true`, so they cannot detect token-reuse bugs — validate in staging against the real Google endpoint
- If every step genuinely needs captcha, migrate to reCAPTCHA v3 (score-based, multi-action)

### PDF Export: WeasyPrint + Shared Stylesheet Builder (2026-07-07)
- Dynamic-document PDF exports render with **WeasyPrint** (not xhtml2pdf) so output matches the TinyMCE editor; editor-created tables must be normalized before rendering (xhtml2pdf 500'd on them)
- The PDF stylesheet/HTML builder lives ONCE in `backend/gym_app/utils/documents.py` — never re-inline styles in `document_views.py` or `signature_views.py`; both consume the shared builder
- xhtml2pdf is still used for service/trámite PDFs (`services/service_tramite_pdf.py`) — don't remove it from requirements

### Jest: ExampleModal.vue Renders Empty Under vue3-jest (open investigation)
- `src/views/user_guide/components/ExampleModal.vue` mounts to empty html under Jest with EVERY approach tried (2026-07-16): real @headlessui/vue + attachTo + flushes, VTU name-based stubs, and full `jest.mock('@headlessui/vue')`
- Symptom inside a fixture SFC: `import { TransitionRoot } from '@headlessui/vue'` is `undefined` in script-setup while `import * as hui` sees the mock keys — Vue warns "Invalid vnode type: undefined"
- `PostFormModal.vue` (identical script-setup + named headlessui imports + `as="template"` pattern) tests FINE with the stub recipe in `test/components/organizations/PostFormModal.test.js` — root difference not yet identified
- Before retrying, diff the two SFCs' compiled output (`@vue/vue3-jest`) rather than iterating on mount recipes

### Shared Staging DB Carries v2-Branch Migrations (fake-data refresh landmines)
- The staging MySQL DB is shared across branch checkouts; `release-august-2026-c-v2` migrations left schema this branch's ORM doesn't know:
  - `gym_app_documentpaymentrecord` (cuentas de cobro) — FK to DynamicDocument blocks `delete_fake_data`; fix: empty its rows (never drop the table, it belongs to the v2 feature)
  - `gym_app_user.is_archived` NOT NULL without DB default — every User INSERT from this branch failed with MySQL 1364; fixed 2026-07-16 by adding `DEFAULT 0` (harmless for v2: Django never relies on DB defaults)
- Diagnostic recipe: compare `information_schema.COLUMNS` (NOT NULL, no default) against `apps.get_models()` columns to find every landmine at once before reseeding
- `create_fake_data` must run **from `backend/`** — `create_legal_requests` reads the relative path `media/example_files/`

### Global App Zoom (80% desktop / 75% mobile)
- `frontend/src/style.css` applies a global `zoom` (commit `cc92301`, 2026-07-15) to widen the UI
- Pixel-based assertions (screenshots, `boundingBox()` checks) in E2E/unit tests see the zoomed geometry — prefer role/testid-based assertions over pixel math
- **Viewport units must be compensated.** CSS `zoom` scales the used value of lengths, but `vh`/`vw`/`dvh` resolve against the *unzoomed* viewport — so a bare `100vh` paints at only 80% (desktop) / 75% (phone) of the screen. Measured in Chrome 148 on a 900px viewport at `zoom: 0.8`: `100vh` → 720px, `100dvh` → 720px, `calc(100vh / var(--app-zoom))` → 900px
- Write every full-viewport length as `calc(100vh / var(--app-zoom, 1))`. The `*-screen` Tailwind utilities (`h-screen`, `min-h-screen`, `max-h-screen`, `w-screen`) already do this via `tailwind.config.js`; hand-written `vh`/`vw` values and lengths passed to JS libraries (e.g. the TinyMCE `height` option in `DocumentEditor.vue`) do not, and must divide explicitly
- `position: fixed; inset: 0` is **not** affected and needs no compensation — modal backdrops written that way already cover the full viewport
- `--app-zoom` is the single source of truth: `@media print` and the `@supports not (zoom: 1)` fallback reset the custom property rather than overriding `zoom` directly, so the compensated lengths stay correct in both cases
