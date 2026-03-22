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
| 9 | Dashboard & Activity Feed (recent items, reports, Excel export) | ✅ Complete | 4 dashboard stores |
| 10 | Intranet (legal documents, profiles, facturation) | ✅ Complete | 2 models, 1 view file, 1 serializer |
| 11 | Legal Updates | ✅ Complete | 1 model, 1 view file, 1 serializer |
| 12 | PWA Support (service worker, install prompts, offline page) | ✅ Complete | vite-plugin-pwa, 3 PWA components |
| 13 | User Guide (interactive, module-based, role-specific) | ✅ Complete | 8 view files, 2 store files |
| 14 | Automated Backups (daily, retention, manual trigger) | ✅ Complete | Huey periodic task |
| 15 | Query Profiling (django-silk, opt-in, GC, weekly reports) | ✅ Complete | Huey periodic tasks + management command |
| 16 | Test Quality Gate (backend + frontend + E2E, CI integration) | ✅ Complete | Custom analyzer + GitHub Actions |
| 17 | SECOP Public Procurement (Socrata API, classifications, alerts, Excel export) | ✅ Complete | 6 models, 1 view file, 1 serializer, 3 services, 1 task file, 6 components, 2 views, 1 store. Backend: 120 tests passing. Frontend: 53 unit tests passing. E2E: 8 spec files with data-testid selectors. UI/UX redesign applied. Fake data command idempotent. |

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
| 12 | In-Place Formalize | `Plan_12_in_place_formalize.md` / `Requirement_12_in_place_formalize.md` | 📋 Planned |

---

## 3. Known Issues & Tech Debt

| # | Issue | Severity | Area |
|---|-------|----------|------|
| 1 | `useDocumentPermissions_backup.js` exists in composables — leftover backup file | Low | Frontend cleanup |
| 2 | SQLite used in development — limited concurrent write support | Low | Backend / Dev only |
| 3 | `DJANGO_SECRET_KEY` has insecure default in settings.py | Medium | Security (dev only, overridden in production) |
| 4 | `user_guide.js` store is 143KB — very large single file | Medium | Frontend maintainability |
| 5 | `user_guide_updates.js` store is 28KB — could be modularized | Low | Frontend maintainability |
| 6 | `reports.py` view is 74KB — very large single file | Medium | Backend maintainability |
| 7 | `check_tags.py` in backend root is empty (0 bytes) | Low | Cleanup |
| 8 | `debug.log` is 6.7MB — already gitignored but no log rotation configured | Low | Operations |

---

## 4. Testing Status

### Backend Tests (63 files)

| Directory | File Count | Purpose |
|-----------|------------|--------|
| `tests/models/` | 16 | Model unit tests |
| `tests/serializers/` | 9 | Serializer tests |
| `tests/views/` | 29 | API view tests |
| `tests/utils/` | 7 | Utility function tests |
| `tests/tasks/` | 2 | Huey task tests |
| `tests/commands/` | 0 | Directory exists, no tests yet |

### Frontend Unit Tests (150 files)

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

### Frontend E2E Tests (158 spec files) — **107/107 flow coverage**

| Directory | Specs | Flows Covered |
|-----------|-------|---------------|
| `e2e/auth/` | 11 | Login, registration, password reset, Google OAuth |
| `e2e/dashboard/` | 11 | Dashboard interactions |
| `e2e/documents/` | 37 | Document CRUD, editor, permissions, tags, folders, relationships, letterhead |
| `e2e/organizations/` | 50 | Organization CRUD, invitations, memberships, posts, corporate requests, cross-role flows |
| `e2e/process/` | 11 | Process CRUD, case files, search, history |
| `e2e/legal-requests/` | 10 | Legal request creation, management, responses |
| `e2e/signatures/` | 7 | Signature flows, pending/archived documents |
| `e2e/subscriptions/` | 7 | Checkout, cancellation, payment updates |
| `e2e/intranet/` | 3 | Intranet page interactions |
| `e2e/profile/` | 2 | Profile completion, updates |
| `e2e/checkout/` | 1 | Checkout flow |
| `e2e/directory/` | 1 | Directory listing |
| `e2e/electronic-signature/` | 1 | Electronic signature modal |
| `e2e/error-handling/` | 1 | Error handling flows |
| `e2e/misc/` | 1 | Miscellaneous flows |
| `e2e/policies/` | 1 | Policy page navigation |
| `e2e/router-guards/` | 1 | Auth and role guard testing |
| `e2e/schedule/` | 1 | Appointment scheduling |
| `e2e/user-guide/` | 1 | User guide navigation |

> **E2E Flow Coverage (2026-03-19):** `flow-definitions.json` has 107 flows, `USER_FLOW_MAP.md` has 117 entries (including sub-flows). All 107 defined flows are covered (0 failing, 0 missing). Quality Gate: 100/100.

---

## 5. Documentation Status

| Document | Path | Status |
|----------|------|--------|
| README | `README.md` | ✅ Comprehensive (913 lines) |
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
| 1 | Modularize `user_guide.js` (143KB) into sub-modules like dynamic_document store | Medium | Medium |
| 2 | Modularize `reports.py` (74KB) into domain-specific report generators | Medium | Medium |
| 3 | Add S3/cloud storage option for media files and backups | Low | High |
| 4 | Implement WebSocket for real-time notifications | Medium | High |
| 5 | Add database connection pooling for production | Low | Low |
| 6 | Remove `useDocumentPermissions_backup.js` and `check_tags.py` | Low | Low |
| 7 | Add log rotation for `debug.log` | Low | Low |
| 8 | Consider TypeScript migration for frontend | Low | Very High |
