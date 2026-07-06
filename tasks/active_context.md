# Active Context — G&M Internal Management Tool

## 1. Current State

The application is **feature-complete** with all 18 major features implemented, tested, and operational:

- User management with JWT + Google OAuth + reCAPTCHA
- Process management with stages, case files, and recent tracking
- Dynamic documents with full editor, variables, permissions, tags, folders, relationships, letterhead, PDF/Word export
- Electronic signatures with draw/upload, request/sign/reject/archive workflow
- Organizations with invitations, memberships, posts, and corporate requests
- Legal requests with file attachments, responses, and email notifications
- Subscription billing via Wompi with automated Huey tasks
- Dashboard with activity feed, recent items, and Excel reports
- Intranet, legal updates, PWA support, and interactive user guide
- Automated backups, query profiling (django-silk), and test quality gate
- **SECOP Public Procurement** ✅: Socrata API integration, process listing/detail, classifications, alerts, saved views, Excel export, professional UI/UX
- **Servicios y Trámites** ✅: catálogo de servicios, formularios dinámicos por etapas, guardado en borrador, radicado `AÑO-CONSECUTIVO`, PDF automático, notificaciones por correo, bandeja de solicitudes para abogados/admin y seguimiento para clientes
- **Notification Center (Req #5)** ✅: `Notification` model + `notification_service` (`create_notification`/`create_bulk_notifications`/`get_unread_count`), in-app center with categories (`signature_*`, `process_alert`, `general`), priorities, snooze, archive, deep-link via `link_type`/`link_id`.
- **Process Alerts (Req #7)** ✅: `StageAlert` (OneToOne with `Stage`, CASCADE), auto-created for ALL stages on `create_process`/`update_process` (last stage gets user-config, others get defaults), daily Huey task at 14:00 UTC sends 3-day & 1-day reminders via email + in-app, configurable recipients (`notify_clients`).

### Codebase Metrics (verified 2026-07-16 post quality-initiative, + Guided Tour deltas)

| Metric | Count |
|--------|-------|
| Backend model files | 15 |
| Backend model classes | 55 (54 models.Model subclasses + User via AbstractUser; UserManager excluded) |
| Backend view files | 30 |
| Backend serializer files | 13 |
| Backend URL patterns | 196 |
| Backend test files | 96 (3049 tests) |
| Backend Huey periodic tasks | 11 |
| Frontend Vue components | 112 (117 → 111 after unused-component cleanup `9ec8737`, +1 `InfoTooltip`) |
| Frontend view pages | 44 |
| Frontend Pinia store files | 44 |
| Frontend composables | 15 |
| Frontend unit test files | 197 |
| Frontend E2E spec files | 199 |
| Frontend E2E flows (flow-definitions.json) | 151 — **151/151 covered (100%)** |

---

## 2. Recent Focus Areas

- **Phased quality initiative (2026-07-16)** — 20+ commits on `release-august-2026-c`:
  - **Memory Bank refreshed** (drift 04-07 → 16-07 closed) + `USER_FLOW_MAP` matrix resynced.
  - **Backend coverage** (fresh baseline 96.22%): 10 batches — `signature_notification_service` 82→98%, `views/notification` →100%, `utils/documents` letterhead/snapshot edges, `views/secop` →98%, `process_alert_tasks` →99%, `service_tramite` serializer →95%, process alert validation/badge, prefetched permission chain, formalize/correct race 409s + audit PDF variants, Word-export table guards. Migrations excluded via `.coveragerc`.
  - **Bugs fixed**: 4 MySQL-only test failures (collation sorts + `action_type` overflow, `31c7249`) and a real 500 — renaming a SECOP saved view to a duplicate name (RESOLVED-019, `d781e7f`).
  - **Frontend unit coverage** (baseline 89.22%): 8 batches — 13 files 0%→100% (`msal_config`, `ScheduleAppointment`, user_guide×5, `DirectoryList`, `IntranetGyM`, `SignaturesList`, `DocumentTagsManager`, store shim) + `App.vue` 98%. Jest-only babel plugin (`test/babel/vite-meta-env.cjs`) unlocks `import.meta` — `DocumentEditor.vue` is now testable.
  - **Quality gate STRICT: score 100, 0 errors, exit 0** (`83f0eed`) — 236 docstrings added, imports sorted, 13 assertion-less tests converted to plain asserts; warnings 17→13 (rest pre-date the session).
  - **E2E flow coverage 150/150 (100%)**: `process-alert-configure` got its dedicated spec (data-testids added to ProcessForm alert controls) and `process-alerts` completed 3/3 specs (`3746a43`). flow-definitions v1.9.4.
  - **Fake data refreshed** (delete + create completed after clearing two v2-schema landmines: orphan `gym_app_documentpaymentrecord` rows and `gym_app_user.is_archived` missing DB default — see lessons-learned). Post-seed counts verified: 34 users, 86 processes/249 stages (1 StageAlert each), 1190 documents, 60 legal requests, 30 SECOP, 6 services/24 requests, 9 subscriptions, 264 notifications. Next coverage targets: `DocumentEditor.vue` (909 stmts, 0%), large partials (`DocumentListTable` 75.9%, `SignaturesListTable` 77.4%), 13 pre-existing gate warnings.

- **PDF/WeasyPrint overhaul + UI zoom + cleanup (2026-07-07 → 2026-07-15)**:
  - **Dynamic-document PDF stack migrated to WeasyPrint** (`2d390fa`): exports now match the editor rendering. Root sequence: 500 crash on editor-created tables fixed with markup normalization (`2ba6d77`), duplicated PDF stylesheet consolidated into a shared builder in `gym_app/utils/documents.py` consumed by both `document_views.py` and `signature_views.py` (`65c48ce`), then rendering switched from xhtml2pdf to WeasyPrint 63.1. xhtml2pdf remains for service/trámite PDFs + fake-data command. Details in `error-documentation.md` → RESOLVED-018.
  - **Global app zoom** (`cc92301`): `frontend/src/style.css` forces 80% desktop / 75% mobile zoom for a wider UI — pixel-based test assertions see zoomed geometry.
  - **Unused frontend components removed** (`9ec8737`): components 117 → 111; 3 orphan unit test suites deleted.
  - **Quality gate false positives fixed** (`c054df1`): `pytest.raises` now counts as assertion; commands test area recognized (`scripts/quality/backend_analyzer.py`).
  - **Ops**: rotated logs gitignored (`6cba400`); deploy-and-check skill hardened + prod `DJANGO_SETTINGS_MODULE` fix synced from toolkit (`3da7668`, `b0d9c7b`); task-queue docs corrected celery→huey (`1a66b4f`).
- **Guided Tour / Interactive Onboarding — Req #4 (2026-07-06, branch `release-august-2026-c-v2`)**:
  - **Backend**: `TourProgress` model (`models/tour_progress.py`, migration `0067`, `unique_together user+module_name`, explicit `completed_at` refreshed per completion, `STALE_AFTER_DAYS = 30` + `is_stale` property — the 30-day rule lives on the backend clock). Endpoints `GET /api/tour-progress/?module=` → `never|recent|stale` and `POST /api/tour-progress/complete/` (`update_or_create`), both JWT + user-scoped. Registered in admin (Notifications section) and wiped by `delete_fake_data` (no create seeder — the empty state IS the correct demo state). 17 pytest tests.
  - **Frontend core**: `driver.js ^1.6` (new dep). `shared/tours/` — `dynamic_documents_steps.js` (lawyer 10 / client 7 steps, Spanish copy, conditional pending-signatures closing step via `usePendingSignatures().hasPending`), `index.js` module registry (extensible to Procesos/Solicitudes), `tour.css` (brand-styled popover, plain CSS since driver.js renders into `<body>`). `useGuidedTour` composable: status fetch (fail-safe: empty/unknown response → no-op, which keeps the ~60 existing document E2E specs green with their `{}` mock fallback), auto-start on `never` (~500ms), SweetAlert2 re-offer on `stale` (declining also POSTs to reset the clock), tab switching via injected `setActiveTab` callback (driver.js global `onNextClick`/`onPrevClick` overrides + `nextTick` + rAF), visibility-aware dual desktop/mobile `data-tour` selectors (`offsetParent` check), `desktopOnly` steps dropped under md.
  - **Gotcha (caught by E2E)**: driver.js only fires `onDestroyed` after the first highlight transition (~400ms) settles — an early "Omitir guía"/✕ click closed the tour without POSTing. Fix: `completeOnce()` (idempotent) called directly from the skip/close handlers, with `onDestroyed` as backstop.
  - **Dashboard integration**: `data-tour` attrs on tabs nav + tab buttons + 4 action buttons (desktop AND mobile variants share values), "?" help button in `ModuleHeader` `#actions` slot (relaunch anytime), auto-trigger at the END of `onMounted` (after the pending-signatures redirect; suppressed on `?tab=`/`?lawyerTab=` deep links), new `InfoTooltip.vue` (group-hover pattern) beside the desktop action buttons.
  - **Tests/docs**: 28 Jest (composable 16, steps config, InfoTooltip) + `docs-guided-tour-flow.spec.js` (6 E2E tests incl. tab auto-switch assertion, skip POST, help-button relaunch, stale modal, mobile short tour). Flow `docs-guided-tour` (P2) in `flow-definitions.json` v1.9.4 (150→151 flows) + `USER_FLOW_MAP.md` v1.9.4. User guide section `guided-tour` in `user_guide/content/documents.js` (all roles).

- **Memory Bank refresh + E2E flow-map reconciliation (2026-07-04)**:
  - **Methodology refresh** (`/methodology-setup`): realigned drifted counts and stack versions across `architecture.md`, `technical.md`, `tasks_plan.md`, and this file to the verified codebase (model classes 55→54; backend tests →92; components →117; composables 11→14; routes 66→67; unit tests →177; E2E specs →195; Django 5.0.6→5.2.14, DRF →3.17.1, Vue →3.5, Vite →6.4.2, Playwright →1.60). Created the two missing Memory Bank dirs `docs/literature/` and `tasks/rfc/`.
  - **E2E flow-map reconciliation** (`/e2e-user-flows-check`): retagged `process-alert-recipients.spec.js` `@flow:process-alert-configure`→`@flow:process-alerts` (it exercises the display indicator, not the toggle) — `process-alerts` had been a false-`missing`, `process-alert-configure` a false-`covered`. Added `knownGaps` to `process-alert-configure` + `service-admin-edit`; flipped the stale `legal-files-*` ❌→✅ markers in `USER_FLOW_MAP.md` and regenerated its coverage matrix from `flow-definitions.json`.
  - **Roles**: confirmed **5 roles** (`admin` + 4 client-facing: `client`, `lawyer`, `corporate_client`, `basic`); the "4 roles" phrasing elsewhere refers to the client-facing set only.

- **Release Agosto 2026 (worked in June) — two requirements, on branch `release-august-2026-c`, deployed to staging**:
  - **Minutas shared visibility** ✅ (commit `d595ae0`): removed the per-creator restriction so every lawyer sees/manages all minutas (Draft/Published). Added serializer field `created_by_name` (informational, `select_related('created_by')` → no N+1), a "Creado por" column gated by `isLawyerMinutasContext`, a "Todas / Solo mías" toggle (`onlyMine` reuses the backend `lawyer_id` param), and creator-name search. Replaced the orphaned `getDocumentsByLawyerId` getter with `allMinutas`. Tests: backend serializer/view, store + component unit. Flow `minutas-shared-visibility` (P2) registered.
  - **Microsoft/Outlook login** ✅ (commit `0494ec5`): `outlook_login` endpoint mirroring `google_login`, server-side ID token verification (`_verify_microsoft_id_token` via cached `PyJWKClient`, multi-tenant `common` authority). **nOAuth hardening**: email trusted only when verified (`xms_edov` true, the personal-accounts tenant, or `MICROSOFT_TRUSTED_TENANTS` allowlist); `preferred_username` never used as identity. Frontend uses `@azure/msal-browser` (`msal_config.js`, `login_with_outlook.js`, `OutlookLoginButton.vue`, 4 auth views, `/auth/outlook/callback`). Tests: backend (`TestOutlookLogin` + `TestVerifyMicrosoftIdToken`), frontend unit, E2E (`outlook-login-flow.spec.js`). Flow `auth-login-outlook` (P1) registered. **Pending operator step**: set `MICROSOFT_CLIENT_ID`/`VITE_MICROSOFT_CLIENT_ID` and enable the `xms_edov` optional claim in Azure (or `MICROSOFT_TRUSTED_TENANTS`).

- **Hotfix 2026-06-11 — client editor blocked on documents with orphan `{{tokens}}` (RESOLVED-016)**:
  - **Bug**: 53 documents of coordinacion@estrategiaypoder.com could not be text-edited by the client — the `DocumentEditor.vue` integrity guard counted raw `{{...}}` tokens in saved content vs rendered `variable-protected` spans and reverted every keystroke when an orphan token (content `{{Numero_ contrato}}` vs variable `Numero_contrato`, typo inherited from an old version of template 580) never produced a span.
  - **Fix**: protection logic extracted to `shared/document_utils.js` (`replaceVariablesWithProtectedSpans` now protects orphan tokens too, shown as `[token]`; `countProtectedVariableSpans`); guard baseline switched to `initialProtectedCount` captured at load. New backend command `repair_orphan_variable_tokens` (dry-run default, `--apply`) rewrites whitespace-mismatched tokens to the exact variable name.
  - **Tests**: 8 pytest (command) + 8 Jest (new helpers) + regression on `document_utils`/`DocumentForm`/`DocumentVariablesConfig` suites — all green. Details in `docs/methodology/error-documentation.md` → RESOLVED-016.

- **Sprint 2026-04-29 — `isLawyerLike` propagation + User Guide refresh**:
  - **Bug fix**: "Continuar" button missing in TinyMCE editor for `Nueva Minuta` and `Editar` flows. Root causes: (a) `toolbar` config passed as array combined with `toolbar_mode: 'wrap'` and custom `setup` buttons caused the `save/continue/return` slots to drop silently in TinyMCE 7 cloud; (b) `isClient` predicate in `DocumentEditor.vue` checked `role === 'lawyer'` only, so users with `is_staff=true` and `role='client'` passed the route guard but lost the button. Fix: revert toolbar to single string + align `isClient` with the lawyer-guard predicate.
  - **`isLawyerLike` getter**: Centralized in `frontend/src/stores/auth/user.js` as the single source of truth (lawyer / admin / is_staff / is_superuser). Five inlined callsites refactored to consume it: `router/index.js` (route guard), `views/dynamic_document/DocumentEditor.vue`, `views/dynamic_document/Dashboard.vue`, `client/UseDocumentTable.vue`, `composables/document-variables/useDocumentPermissions.js`, `composables/document-variables/useDocumentTags.js`, `cards/menuOptionsHelper.js`.
  - **User Guide audit + refresh**: New module `admin_staff` covering admin/staff/superuser capabilities with `isLawyerLike` explanation. Existing modules updated: `documents.js` (new sections "Botones del Editor según tu Rol" + "Modos del DocumentForm" + explicit "Continuar" step), `secop.js` (alert frequency options + lawyer-only sync trigger), `services_tramites.js` (status lifecycle table DRAFT→OPEN→IN_STUDY→IN_PROGRESS→ANSWERED→FINALIZED + tracking format `YYYY-NNNNN` + inbox filter coverage). Manual infrastructure: `getters.js` `roleMatches` helper aliases `admin` → lawyer modules + admin-only modules; `UserGuideMain.vue` maps `is_staff/is_superuser/role==='admin'` to synthetic `admin` role.
  - **Methodology docs**: `lessons-learned.md` adds "`isLawyerLike` Predicate — Single Source of Truth" subsection. `product_requirement_docs.md` adds Admin role row + "Role Hierarchy — `lawyer-like` Predicate" subsection. Future role gating must consume the getter.

- **Legal Files Alerts (Req #6) audit + remediation + simplify + E2E coverage (2026-04-28)**:
  - **Audit verdict**: implementation was ~75% complete — endpoint, model, hooks, Huey daily task, composable, SlideBar pulse, Dashboard auto-redirect were correct. **7 spec gaps closed**:
    - **B5** `notify_signature_reopened` was sending email; matrix says in-app only → email block removed.
    - **B6** Daily reminder did not exclude documents created in the last 24h → `cutoff = now - 24h` filter added to both queries (outer `signer_id` distinct + per-user pending fetch).
    - **F5** Pulse on `SignaturesListTable.vue` was infinite (`animate-pulse` with no timeout) → added `PULSE_DURATION_MS = 8000` with `setTimeout` in `onMounted` and cleanup in `onBeforeUnmount`.
    - **F6** `auth.logout()` did not clear `sessionStorage.pendingSignaturesAlerted` → flag now removed on logout.
    - **F8 (surfaced by E2E spec)** `Dashboard.vue` auto-redirect was overriding explicit `?tab=`/`?lawyerTab=` URL params, contradicting the spec section "Respeto a Parámetros Explícitos" → guard `hasExplicitTabParam` added at `views/dynamic_document/Dashboard.vue:1066-1080` so the auto-redirect is suppressed when the URL has a tab param.
  - **Simplify pass on the patch**: fixed N+1 in `notify_daily_pending_reminders` (was looping `User.objects.get(id=user_id)` per user — replaced with `User.objects.filter(id__in=user_ids).exclude(email__isnull=True).exclude(email='')`); exported `PENDING_SIGNATURES_ALERTED_KEY` constant from `composables/usePendingSignatures.js` and reused in `auth.js` to remove stringly-typed duplication; removed redundant `isPulseActive.value = true` in `onMounted` (ref already initializes to `true`).
  - **Tests added (all green)**: 6 backend tests in `test_signature_notification_service.py` (progress, expired, reopened-no-email, daily reminder excludes/skips/aggregates) + new `test/composables/usePendingSignatures.test.js` (6 tests) + 1 sessionStorage-cleanup test in `test/stores/auth/auth.test.js`. **3 new E2E specs (5 tests, all passing in Desktop Chrome)**: `legal-files-menu-pulse.spec.js`, `legal-files-auto-redirect.spec.js`, `legal-files-table-pulse.spec.js`. Total: 12/12 backend + 28/28 frontend unit + 5/5 E2E.
  - **Flows registered** in `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.js`, and `docs/USER_FLOW_MAP.md`: `legal-files-menu-pulse` (P1), `legal-files-auto-redirect` (P2), `legal-files-table-pulse` (P2). Total flows: 145 → 148. Signatures module: 9 → 12 flows.
  - **Test infrastructure**: extended `frontend/e2e/helpers/dynamicDocumentMocks.js` with `pendingSignaturesCount` parameter and mock for `dynamic-documents/pending-signatures-count/`. Added `data-testid="signatures-list-row-{id}"` to `SignaturesListTable.vue` rows and `pending-signatures-indicator-mobile`/`pending-signatures-count-mobile` to `SlideBar.vue` mobile spans (desktop testids already existed).

- **Notification Center audit + simplify pass (2026-04-28)**:
  - **Audit context**: a prior plan claimed 2 bugs and 4 missing backend test files in the Notification Center. Line-by-line verification refuted **all 5 claims** — the deep-link param mismatch did not exist (`NotificationsList.vue:280` already used `id`), `NotificationSummaryCard.vue` already handled `service_request`, `service_tramite_notifications.py` already created in-app notifications, and the 4 backend test files already existed (332 + 116 + 76 + 141 LOC, plus an extra `test_service_tramite_notifications.py` of 363 LOC).
  - **Real gap discovered**: `ServiceRequestDetail.vue` had no pulse/highlight effect for deep-link from notifications (Process and Document had it; service_request was the only one missing).
  - **Implemented**: 5s `animate-pulse` highlight on `ServiceRequestDetail.vue` with `clearTimeout` cleanup on `onUnmounted` to avoid stale `router.replace` after the user navigates away. Both `NotificationsList.vue:280` and `NotificationSummaryCard.vue:78` now pass `query: { highlight: notif.link_id }` for service_request (parity with process/document).
  - **Simplify pass**: extracted duplicated `link_type` if/else-if chain from `NotificationsList.vue` and `NotificationSummaryCard.vue` into a single `navigateToNotificationTarget(router, notif)` action on `stores/notification.js`. Parallelized `NotificationSummaryCard` mount fetches with `Promise.all`. Added change-detection guard in `fetchUnreadCount` to skip wasted reactive re-renders during 60s polling when the count hasn't changed.
  - **New tests**: 4 frontend unit suites (47 tests across `notification.js` store, `NotificationBell.vue`, `NotificationsList.vue`, `NotificationSummaryCard.vue`) + 14 tests for `ServiceRequestDetail.vue` (incl. 3 highlight pulse tests with spy on `setTimeout`/`clearTimeout` to verify timer cleanup) + 4 E2E (bell+badge, empty state, list+tabs, **service request pulse + URL cleanup verification**). All green. Backend tests already existed and were verified as passing.
  - Implements planned feature **#5 Notification Center**.

- **Process Alerts audit + fixes (2026-04-28)**:
  - **Audit verified 6 issues** in the StageAlert implementation: (1) StageAlert was created only for the LAST stage instead of ALL stages, (2) `process.stages.clear()` left orphan `Stage` rows because `Process.stages` is a `ManyToManyField`, (3) N+1 in `process_list` due to missing `'stages__alert'` in `prefetch_related`, (4) UI did not show recipient info (`notify_clients`), (5) duplicate `send_template_email` import, (6) zero backend test coverage.
  - **Fixes applied** (`backend/gym_app/views/process.py`, `process_alert_tasks.py`, `frontend/src/views/process/ProcessDetail.vue`, `frontend/src/components/process/ProcessHistoryModal.vue`): extracted `_create_stage_alerts(created_stages, main_data)` helper, wrapped stage replacement in `transaction.atomic()`, used `Prefetch('stages', queryset=Stage.objects.order_by('id').select_related('alert'))` to keep prefetch effective, added recipient text to alert indicator + tooltip computed (`alertTitle`).
  - **Tests added**: `tests/models/test_stage_alert.py` (9), `tests/tasks/test_process_alert_tasks.py` (11), `tests/views/test_process_alerts.py` (5), plus `e2e/process/process-alert-recipients.spec.js` (3) — total 28 new tests, all green; 41/41 existing process tests still pass (no regressions).

- **User Guide gap audit (2026-04-22)**: Systematic comparison of `frontend/src/stores/user_guide/` content (10 modules, 65 sections, ~2.8k lines) against real system (63 routes, 181 backend endpoints). Critical gaps: **SECOP** and **Servicios y Trámites** are entire modules missing from `modules.js` despite being full features in production. Also: outdated tab labels (`Firmados` vs real `Dcs. Formalizados` post commit d60eeb4), missing sections (variables-config, document-permissions, user-signature, payment-method-update, payment-history, featured-services), and inaccurate `appointments` content describing features that don't exist (Calendly iframe only). Full plan in `tasks/user_guide_gap_audit.md`.

- **Sprint Abril 2026 — Servicios y Trámites: 11 mejoras (2026-04-15)**:
  - **1.1 ServicesAdmin — Vista previa de icono**: Campo `icon_image_url` en `editor` reactive, miniatura 80×80px con gradiente, validación 5MB.
  - **1.2 ServicesAdmin — Validación exhaustiva**: Nueva función `validateEditor()` cubre nombre, etapas, campos, claves duplicadas, opciones de selección, extensiones de archivo.
  - **1.3 ServicesAdmin — Manejo de errores**: Bloque `catch` extrae `error.response.data` y muestra mensaje específico del backend.
  - **1.4 ServiceDetail — Help text reposicionado**: `field.help_text` ahora aparece ANTES del input (después del label) para mejor UX.
  - **1.5 ServiceDetail — UI archivos múltiples**: Tarjetas con icono, nombre truncado, tamaño formateado, botón `×` eliminar individual, contador X/10, input deshabilitado al alcanzar límite, selección incremental.
  - **1.6 PDF — Rediseño corporativo**: Header «G&M CONSULTORES JURIDICOS», metadatos inline, secciones con subrayado azul #5B7C99, aviso aclaratorio legal en bloque gris, footer corporativo.
  - **1.7 Navegación — ServicesHub.vue**: Nuevo componente unifica «Servicios» y «Mis Solicitudes» con tabs desktop + dropdown mobile. Prop `embedded` en ServicesList/MyServiceRequests. Router redirects legacy paths. Menú lateral simplificado (1 ítem).
  - **1.8 Header azul corporativo**: `ModuleHeader` integrado en ServicesHub con título «Servicios y Solicitudes».
  - **1.9 Emails — Sin emojis**: Eliminado div circular con emoji de `notification.html` y `.mjml`. Removidos campos `"icon"` de contextos Python.
  - **1.10 Emails — Estado destacado**: Estado en `<strong style='font-weight:700;text-transform:uppercase'>`. Fix crítico: `|safe` agregado al `{{message}}` en ambas plantillas (Django auto-escapa HTML sin este filtro).
  - **1.11 Emails — Archivos adjuntos**: `notify_service_request_status_change` recopila archivos de la respuesta más reciente del abogado y los pasa como `attachments`. Llamada movida DESPUÉS del `refetch` para garantizar que `lawyer_responses__files` estén disponibles.
  - **Archivos afectados**: `ServicesAdmin.vue`, `ServiceDetail.vue`, `service_request_pdf.html`, `ServicesHub.vue` (nuevo), `ServicesList.vue`, `MyServiceRequests.vue`, `SlideBar.vue`, `router/index.js`, `ServiceDetail.vue`, `ServiceRequestDetail.vue`, `notification.html`, `notification.mjml`, `service_tramite_notifications.py`, `service_tramite.py`.

- **Codex configuration normalization (2026-04-09)**:
  - **Repo config simplified**: Reduced `.codex/config.toml` to project-scoped settings that materially change behavior (`model`, reasoning effort, approval policy, sandbox mode, web search).
  - **Skills auto-discovery confirmed**: Codex reads `.agents/skills/` from the repository root automatically — no installer needed. `scripts/install-codex-skills.sh` was removed.
  - **User-level cleanup completed**: Removed duplicate repo-managed `gym-*` symlinks from `~/.codex/skills`; system skills under `~/.codex/skills/.system` remain untouched.
  - **Scope boundary preserved**: No Claude or Windsurf configuration was changed as part of this normalization.

- **In-Place Document Formalization (2026-04-08)**:
  - **Problem**: Formalization created a copy of the document instead of transitioning the same document, causing duplication, title modification (`_firma` suffix), and user confusion.
  - **New `formalize_document` endpoint**: `POST /api/dynamic-documents/{id}/formalize/` — transitions Completed → PendingSignatures on the same document. No copy, no title change, creates DocumentSignature records for selected signers.
  - **New `correct_document` endpoint**: `POST /api/dynamic-documents/{id}/correct/` — combines content update + signature reopening into a single atomic call for Rejected/Expired documents (previously required two separate HTTP calls).
  - **Optimistic locking**: Both endpoints use `filter(state=...).update()` instead of `select_for_update()` — no row lock held during signer validation. Returns 409 on concurrent state conflicts.
  - **Frontend**: New `formalizeDocument` and `correctDocument` store actions. `DocumentForm.vue` formalize and correction branches refactored to use single-endpoint calls.
  - **Tests**: 30 new backend tests (16 formalize + 14 correct) covering happy path, validation, permissions, optimistic lock mechanism, title preservation, same-document-ID verification.
  - Implements planned feature #12 (In-Place Formalize) from `docs/next_requirements/`.

- **Servicios y Trámites module implemented (2026-04-08)**:
  - **Backend models**: `Service`, `ServiceStage`, `ServiceField`, `ServiceRequest`, `ServiceRequestSequence`, `ServiceRequestAnswer`, file/response models; includes yearly sequential tracking number format `YYYY-00001`.
  - **Backend APIs**: service catalog (featured + list + detail), admin service management, draft/save/submit flow, my requests, inbox requests, request detail, lawyer/admin status management, and secure file/PDF downloads.
  - **Document + notifications**: PDF generation with submission summary and legal note; email notifications for submission and status updates to requester/managers.
  - **Seed data**: migration seeds initial `Registro Marcario` service with 4 stages and required fields/files.
  - **Frontend**: new `services_tramites` store, dashboard featured services grid, services list/detail, my requests, inbox, request detail, and admin builder view; router + sidebar role-based navigation integrated.
  - **Testing**: backend tests added for create/list/submit/manage/permissions and oversized attachment validation; feature test suite passing.

- **Dynamic Documents N+1 Query Fix (2026-03-29)**:
  - **Root cause**: Silk profiling reported 170–255 DB queries per request on `GET /api/dynamic-documents/` and related signature endpoints.
  - **Fix 1 — Shared helper**: Created `get_optimized_document_queryset()` in `document_views.py` — single source of truth for all `select_related`/`prefetch_related` calls needed by `DynamicDocumentSerializer`.
  - **Fix 2 — Tags N+1**: Changed `prefetch_related('tags')` → `Prefetch('tags', queryset=Tag.objects.select_related('created_by'))` to eliminate per-tag lazy-load of `created_by` FK.
  - **Fix 3 — Queryset-level visibility filter**: Replaced post-serialization `filter_documents_by_visibility` decorator with `apply_visibility_filter()` using Q objects — eliminates redundant DB round-trip for non-lawyers.
  - **Fix 4 — Signature views**: Refactored `get_pending_signatures`, `get_user_pending_documents_full`, `get_user_archived_documents`, `get_user_signed_documents` to use the shared helper + `apply_visibility_filter` instead of per-document `can_view()` calls with zero prefetch.
  - **Fix 5 — Detail view**: Added missing prefetches (`visibility_permissions`, `usability_permissions`, `relationships_as_*`) via shared helper.
  - **Fix 6 — List serializer**: Created `DynamicDocumentListSerializer` excluding `content` field for list endpoints (reduces payload).
  - **Expected result**: ~10 queries per request (down from 170–255). All 846 dynamic document tests pass (2 pre-existing sort failures unrelated).
- **SECOP Module — Stale data fix (2026-03-20)**:
  - **Root cause**: SECOP API (datos.gov.co) returns 26 records marked "Abierto" with publication dates from Jan 2023 and closing dates from Jan–Feb 2023 — all expired. The SECOPClient `_build_query` had no publication date floor, and the sync service had no post-sync stale cleanup.
  - **Fix 1 — API filter**: Added `DEFAULT_PUBLICATION_LOOKBACK_DAYS = 730` (~2 years) to `SECOPClient`. `_build_query` now always appends `fecha_de_publicacion_del >= '<floor>'` to exclude old records at the API level.
  - **Fix 2 — Post-sync cleanup**: Added `close_stale_processes()` static method to `SECOPSyncService` that marks "Abierto" processes with past `closing_date` as "Cerrado". Called automatically at the end of every `synchronize()`.
  - **DB cleanup**: Ran `close_stale_processes()` on staging DB → 24 stale processes closed, 2 remain "Abierto" (null `closing_date`).
  - **Tests**: 6 new tests added (3 client query + 1 sync integration + 4 close_stale_processes edge cases). All 51 SECOP service tests passing.
- **SECOP Module — Deep code review, bug fixes & UI/UX overhaul**:
  - **Backend bug fixes**: Fixed `is_open` filter logic (BUG-1), `page_size` crash on invalid input (BUG-2), normalized role check (BUG-3), `SavedViewSerializer` duplicate name 500→400 (BUG-4), datetime parsing regex (EDGE-1), shared filter helper to eliminate duplication (EDGE-2), `prefetch_related` for N+1 query (EDGE-3), `bulk_update` for alert notifications (EDGE-4)
  - **Second review bug fixes (2026-03-19)**: Fixed serializer N+1 query using Python iteration over prefetch cache (ISSUE-004), alert `evaluate_process` false positives for None `base_price` (ISSUE-005), `_parse_date` returning string instead of `datetime.date` (ISSUE-006), `secop_my_classified` missing `prefetch_related` and `page_size` (ISSUE-007), `exportExcel` blob URL memory leak (ISSUE-008)
  - **UI/UX redesign**: All 8 SECOP components + 2 views redesigned with gradient headers, rounded-xl cards, ring borders, skeleton loading, terciary bg chips, improved empty states, consistent design system, and `data-testid` attributes throughout
  - **Store fix**: Added `ordering` param to `exportExcel` action (EDGE-8), debounced filter watcher, `URL.revokeObjectURL` in export, `page_size` from API response
  - **Backend tests**: 120/120 passing (33 models + 27 services + 7 alert service + 15 serializers + 30 views + 8 tasks)
  - **Frontend unit tests**: 53/53 passing (27 store + 26 components) — fixed 13 failures from UI text/class changes
  - **E2E improvements**: Eliminated all `waitForLoadState("networkidle")` from 8 spec files, replaced with `data-testid` waits
  - **Fake data**: Validated idempotency (`update_or_create`, `random.seed(42)`) and business rule compliance
  - **SECOP Saved Views**: Added ability to edit existing saved views (rename and update filters) — requested by user (2026-03-22)
- **SECOP UNSPSC filter (2026-03-26)**: Migrated UNSPSC filter from single-select to multi-select with union behavior combined with keyword search. Affected: `SavedViewsList.vue`, `SavedViewModal.vue`, `secop/index.js` store, `SecopList.vue`, `SecopDetail.vue`. +3 E2E specs added to SECOP suite.
- **E2E/Flow coverage audit (2026-03-26)**: Added `secop-edit-saved-view` flow (P3) to flow-definitions, USER_FLOW_MAP, and flow-tags. Created `secop-edit-saved-view-flow.spec.js` (4 tests). Fixed all 12 SECOP spec files to use inline `@flow:` tags (coverage scanner requires literal strings, not JS constants). **Flow coverage: 123/123 (100%).** Quality gate: 99/100.
- **E2E coverage audit — 100% flow coverage achieved (2026-03-19)**:
  - **Flow coverage: 107/107 covered**, 0 failing, 0 missing, 0 unmapped
  - **Quality Gate: 100/100** — 0 errors, 0 warnings, 0 infos
- **Previous E2E audit (2026-03-18)**: 4-phase audit that deepened P1 gaps, added missing P2 specs, split `router_guards` test, removed all 9 `knownGaps`
- **Memory Bank Windsurf adaptation**: Adapted methodology rules from Cursor format to Windsurf-compatible paths
- **Test quality gate**: Custom analyzer integrated with pre-commit and GitHub Actions CI
- **E2E flow coverage**: Playwright E2E tests with flow definitions and coverage reporting

---

## 3. Active Decisions & Considerations

| Decision | Status | Context |
|----------|--------|---------|
| 12 planned features in `docs/next_requirements/` | 5 complete (#4 Guided Tour, #5 Notification Center, #6 Legal Files Alerts via signature_notification_service, #7 Process Alerts via process_alert_tasks + StageAlert, #12 In-Place Formalize; #8 Outlook Auth also shipped in Release Agosto 2026) | Remaining: Reassignment, minutas, preview, marketplace, optional signature, contract execution |
| Memory Bank methodology | ✅ Complete | Persistent documentation for AI context fully set up and adapted for Windsurf |
| Large file modularization | Under consideration | `user_guide.js` (143KB), `reports.py` (74KB) could be split |

---

## 4. Development Environment Summary

| Component | Detail |
|-----------|--------|
| Backend | Django 5.2.14 + DRF 3.17.1, SQLite (dev), Python 3.12 |
| Frontend | Vue 3.5 + Vite 6 + Pinia + TailwindCSS 3, Node 22.13.0 |
| Task Queue | Huey 2.5.2 (immediate mode in dev, Redis in prod) |
| Testing | pytest, Jest 29, Playwright |
| CI | GitHub Actions (test quality gate on PR/push) |
| Pre-commit | Ruff lint + test quality gate |

---

## 5. Next Steps

0. **Phased quality initiative IN PROGRESS (2026-07-16)** — running on `release-august-2026-c`: Memory Bank refresh (✅ this update) → new-feature-checklist audit → e2e-user-flows-check → fake-data-refresh (staging) → iterative backend/frontend-unit coverage to 100% → quality gate strict → iterative E2E flow coverage. Plan: `~/.claude/plans/ejecuta-en-un-plan-sequential-koala.md`.
1. **SECOP Module** ✅ — Fully complete: implementation, bug fixes, UI/UX redesign, backend tests (120), frontend tests (53), E2E (22 tests across 8 specs), fake data validated, 12/12 flows registered in `flow-definitions.json` and `USER_FLOW_MAP.md` (all ✅)
   - **Remaining**: Live data sync verification (`python manage.py sync_secop`) — requires SECOP API access
   - **Fixed (2026-03-19)**: E2E `secop-alert-create-flow.spec.js` — 2 `data-testid` mismatches (`alert-form` → `alert-form-modal`, `alert-name-input` → `alert-name`)
2. **Review and prioritize** the 12 planned features in `docs/next_requirements/`
3. **Address tech debt** — Clean up backup files, modularize large files
4. **Continue test coverage** — Maintain and expand backend/frontend/E2E test suites
5. **Production hardening** — Log rotation, secret key enforcement, backup verification
