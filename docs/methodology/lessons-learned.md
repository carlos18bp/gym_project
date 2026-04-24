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
- Permissions and views are scoped based on these roles
- Role guard in Vue Router: `requiresLawyer: true` redirects client/basic/corporate to dashboard

---

## Linting & Testing

### Ruff for Backend, Jest/Playwright for Frontend
- Backend: **Ruff** for linting, **pytest** for testing
- Frontend: **Jest** for unit tests, **Playwright** for E2E tests
- Backend test markers: `edge`, `contract`, `integration`, `rest`
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
