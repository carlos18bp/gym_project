# Tasks Plan — G&M Internal Management Tool

## 1. Feature Status

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | User Management (JWT, Google OAuth, reCAPTCHA, profiles) | ✅ Complete | 3 models, 2 view files, 1 serializer |
| 2 | Process Management (cases, stages, files, recent) | ✅ Complete | 5 models, 1 view file, 1 serializer |
| 3 | Dynamic Documents (editor, variables, permissions, tags, folders, relationships, letterhead, PDF/Word export) | ✅ Complete | 9 models, 5 view files (sub-package), 1 serializer |
| 4 | Electronic Signatures (draw/upload, request/sign/reject/archive, PDF generation) | ✅ Complete | Integrated into dynamic documents |
| 5 | Organizations (CRUD, invitations, memberships, posts) | ✅ Complete | 4 models, 2 view files, 1 serializer |
| 6 | Legal Requests (create, files, responses, status tracking, emails) | ✅ Complete | 5 models, 1 view file, 1 serializer |
| 7 | Corporate Requests (client/corporate sides, responses, dashboard stats) | ✅ Complete | 4 models, 1 view file, 1 serializer |
| 8 | Subscriptions & Payments (Wompi, recurring billing, webhook) | ✅ Complete | 2 models, 1 view file, 1 serializer, 1 task file |
| 9 | Dashboard & Activity Feed (recent items, reports, Excel export) | ✅ Complete | 4 dashboard stores, 1 reports package (5 domain modules) |
| 10 | Intranet (legal documents, profiles, facturation) | ✅ Complete | 2 models, 1 view file, 1 serializer |
| 11 | Legal Updates | ✅ Complete | 1 model, 1 view file, 1 serializer |
| 12 | PWA Support (service worker, install prompts, offline page) | ✅ Complete | vite-plugin-pwa, 3 PWA components |
| 13 | User Guide (interactive, module-based, role-specific) | ✅ Complete — extended 2026-04-22 | 8 view files, 1 store (sub-module pattern: index, modules, getters, 6 content files). Audit + extension in `tasks/user_guide_gap_audit.md`: added modules **SECOP** (`content/secop.js`, 6 sections) and **Servicios y Trámites** (`content/services_tramites.js`, 8 sections); added sections `featured-services`, `variables-config`, `document-permissions`, `user-signature`, `payment-method-update`, `payment-history`; corrected tab labels to `Dcs. Por Firmar / Dcs. Formalizados / Dcs. Archivados` (commit `d60eeb4`); rewrote appointments section to match real Calendly-only implementation. QuickLinksCard updated with SECOP/Services per role. Tests: 17/17 passing (2 new tests covering SECOP+Services registration and search). |
| 14 | Automated Backups (daily, retention, manual trigger) | ✅ Complete | Huey periodic task |
| 15 | Query Profiling (django-silk, opt-in, GC, weekly reports) | ✅ Complete | Huey periodic tasks + management command |
| 16 | Test Quality Gate (backend + frontend + E2E, CI integration) | ✅ Complete | Custom analyzer + GitHub Actions |
| 17 | SECOP Public Procurement (Socrata API, classifications, alerts, Excel export) | ✅ Complete | 6 models, 1 view file, 1 serializer, 3 services, 1 task file, 6 components, 2 views, 1 store. Backend: 120 tests passing. Frontend: 53 unit tests passing. E2E: 8 spec files with data-testid selectors. UI/UX redesign applied. Fake data command idempotent. |
| 18 | Servicios y Trámites (catálogo, formularios por etapas, radicado, PDF, bandejas por rol) | ✅ Complete | 9 models, 1 view file, 1 serializer, 2 services (PDF + notifications), 1 template PDF, 2 migrations (schema + seed Registro Marcario), 7 frontend views (incl. ServicesHub.vue), 1 store, 1 dashboard component, sidebar/router integration, backend tests passing. Sprint Abril 2026: 11 mejoras (admin icon preview, validación, errores, help_text UX, multi-file UI, PDF rediseño, tabs navigation, header corporativo, emails sin emojis, estado destacado, adjuntos automáticos) |

---

## 2. Planned Features (from docs/next_requirements/)

| # | Requirement | Plan Document | Status |
|---|------------|---------------|--------|
| 1 | Process Reassignment | `Plan_01_reassignment.md` / `Requirement_01_reassignment.md` | 📋 Planned |
| 2 | Minutas (Meeting Minutes) | `Plan_02_minutas.md` / `Requirement_02_minutas.md` | 📋 Planned |
| 3 | Document Preview | `Plan_03_preview.md` / `Requirement_03_preview.md` | 📋 Planned |
| 4 | Guided Tour | `Plan_04_guided_tour.md` / `Requirement_04_guided_tour.md` | 📋 Planned |
| 5 | Notification Center | `Plan_05_notification_center.md` / `Requirement_05_notification_center.md` | 📋 Planned |
| 6 | Legal Files Alerts | `Plan_06_legal_files_alerts.md` / `Requirement_06_legal_files_alerts.md` | 📋 Planned |
| 7 | Process Alerts | `Plan_07_process_alerts.md` / `Requirement_07_process_alerts.md` | 📋 Planned |
| 8 | Outlook Auth Integration | `Plan_08_outlook_auth.md` / `Requirement_08_outlook_auth.md` | 📋 Planned |
| 9 | Marketplace | `Plan_09_marketplace.md` / `Requirement_09_marketplace.md` | 📋 Planned |
| 10 | Optional Signature | `Plan_10_firma_opcional.md` / `Requirement_10_firma_opcional.md` | 📋 Planned |
| 11 | Contract Execution | `Plan_11_contract_execution.md` / `Requirement_11_contract_execution.md` | 📋 Planned |
| 12 | In-Place Formalize | `Plan_12_in_place_formalize.md` / `Requirement_12_in_place_formalize.md` | ✅ Complete |

---

## 3. Known Issues & Tech Debt

| # | Issue | Severity | Area |
|---|-------|----------|------|
| 1 | SQLite used in development — limited concurrent write support | Low | Backend / Dev only |
| 2 | `DJANGO_SECRET_KEY` has insecure default in settings.py | Medium | Security (dev only, overridden in production) |
| 3 | `debug.log` is 6.7MB — already gitignored but no log rotation configured | Low | Operations |

---

## 4. Testing Status

### Backend Tests (76 files)

| Directory | File Count | Purpose |
|-----------|------------|--------|
| `tests/models/` | 18 | Model unit tests |
| `tests/serializers/` | 10 | Serializer tests |
| `tests/views/` | 32 | API view tests (incl. formalize + correct endpoint tests) |
| `tests/utils/` | 7 | Utility function tests |
| `tests/tasks/` | 3 | Huey task tests |
| `tests/services/` | 3 | Service layer tests |
| `tests/commands/` | 3 | Management command tests |

### Frontend Unit Tests (167 files)

| Directory | Purpose |
|-----------|---------|
| `test/stores/` | Pinia store tests |
| `test/components/` | Component tests |
| `test/composables/` | Composable tests |
| `test/views/` | View component tests |
| `test/router/` | Router tests |
| `test/animations/` | Animation tests |
| `test/shared/` | Shared utility tests |
| `test/scripts/` | Script tests |
| `test/e2e/` | E2E helper tests |
| `test/utils/` | Utility tests |
| `test/data_sample/` | Test data samples |

### Frontend E2E Tests (179 spec files) — **138/138 flow coverage**

| Directory | Specs | Flows Covered |
|-----------|-------|---------------|
| `e2e/auth/` | 11 | Login, registration, password reset, Google OAuth |
| `e2e/dashboard/` | 11 | Dashboard interactions |
| `e2e/documents/` | 38 | Document CRUD, editor, permissions, tags, folders, relationships, letterhead, formalize-in-place, correct |
| `e2e/organizations/` | 50 | Organization CRUD, invitations, memberships, posts, corporate requests, cross-role flows |
| `e2e/process/` | 11 | Process CRUD, case files, search, history |
| `e2e/legal-requests/` | 10 | Legal request creation, management, responses |
| `e2e/secop/` | 12 | SECOP browse, classify, alerts, saved views (create/edit/delete/favorites), export, sync, UNSPSC multi-select |
| `e2e/signatures/` | 7 | Signature flows, pending/archived documents |
| `e2e/subscriptions/` | 7 | Checkout, cancellation, payment updates |
| `e2e/intranet/` | 3 | Intranet page interactions |
| `e2e/profile/` | 2 | Profile completion, updates |
| `e2e/basic-user/` | 1 | Basic user restrictions |
| `e2e/checkout/` | 1 | Checkout flow |
| `e2e/directory/` | 1 | Directory listing |
| `e2e/electronic-signature/` | 1 | Electronic signature modal |
| `e2e/error-handling/` | 1 | Error handling flows |
| `e2e/misc/` | 1 | Miscellaneous flows |
| `e2e/policies/` | 1 | Policy page navigation |
| `e2e/router-guards/` | 1 | Auth and role guard testing |
| `e2e/schedule/` | 1 | Appointment scheduling |
| `e2e/user-guide/` | 1 | User guide navigation |

> **E2E Flow Coverage (2026-04-08):** `flow-definitions.json` has 138 flows, `USER_FLOW_MAP.md` has 138 unique flows. All 138 flows covered (0 missing). Fixed: 2 specs using imported flow-tags (invisible to scanner), 1 naming mismatch (service-my-requests → service-view-my-requests), 4 missing service flow tags added.

---

## 5. Documentation Status

| Document | Path | Status |
|----------|------|--------|
| README | `README.md` | ✅ Comprehensive (913 lines) |
| Codex Setup | `docs/CODEX_SETUP.md` | ✅ Updated — skills auto-discovered from `.agents/skills/`, install script removed |
| Codex Methodology Guide | `docs/CODEX_METHODOLOGY_GUIDE.md` | ✅ Updated — removed install step, reflects auto-discovery model |
| Codex Migration Map | `docs/CODEX_MIGRATION_MAP.md` | ✅ Updated — removed install script references |
| Architecture Standard | `docs/DJANGO_VUE_ARCHITECTURE_STANDARD.md` | ✅ Complete |
| Testing Quality Standards | `docs/TESTING_QUALITY_STANDARDS.md` | ✅ Complete |
| Test Quality Gate Reference | `docs/TEST_QUALITY_GATE_REFERENCE.md` | ✅ Complete |
| Coverage Report Standard | `docs/BACKEND_AND_FRONTEND_COVERAGE_REPORT_STANDARD.md` | ✅ Complete |
| E2E Flow Coverage Standard | `docs/E2E_FLOW_COVERAGE_REPORT_STANDARD.md` | ✅ Complete |
| Functional Guide by Role | `docs/FUNCTIONAL_GUIDE_BY_ROLE.md` | ✅ Complete |
| User Flow Map | `docs/USER_FLOW_MAP.md` | ✅ Complete |
| Global Rules Guidelines | `docs/GLOBAL_RULES_GUIDELINES.md` | ✅ Complete |
| Deployment Guide | `docs/deployment-guide.md` | ✅ Complete |
| Subscription API | `backend/SUBSCRIPTION_API.md` | ✅ Complete |
| Subscription Setup | `backend/SUBSCRIPTION_SETUP.md` | ✅ Complete |
| Wompi Signature Debug | `backend/WOMPI_SIGNATURE_DEBUG.md` | ✅ Complete |
| Requirement Template | `docs/Requirement_template.md` | ✅ Complete |
| Requirements & Prices Mapping | `docs/Requirements_prices_mapping.md` | ✅ Complete |
| Next Requirements (12 plans + 12 requirements) | `docs/next_requirements/` | ✅ Complete |
| Memory Bank (PRD) | `docs/methodology/product_requirement_docs.md` | ✅ Complete |
| Memory Bank (Technical) | `docs/methodology/technical.md` | ✅ Complete |
| Memory Bank (Architecture) | `docs/methodology/architecture.md` | ✅ Complete |

---

## 6. Potential Improvements

| # | Improvement | Priority | Effort |
|---|------------|----------|--------|
| 1 | Add S3/cloud storage option for media files and backups | Low | High |
| 2 | Implement WebSocket for real-time notifications | Medium | High |
| 3 | Add database connection pooling for production | Low | Low |
| 4 | Add log rotation for `debug.log` | Low | Low |
| 5 | Consider TypeScript migration for frontend | Low | Very High |
