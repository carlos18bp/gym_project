# Error Documentation — G&M Internal Management Tool

## Known Issues

### [ISSUE-004] Prefetch_related cached filtering requires `.all()` in Python code
- **Context**: When using `prefetch_related`, filtering the related queryset in Python without `.all()` bypasses the prefetch cache and issues a new DB query.
- **Workaround**: Always call `.all()` on the prefetched relation before filtering in Python (e.g., `document.signatures.all().filter(...)`).
- **Fixed in**: SECOP second review (2026-03-19) — serializer N+1 query resolved using Python iteration over prefetch cache.

### [ISSUE-009] SECOP sync stale "Abierto" records from 2023
- **Context**: SECOP API (datos.gov.co) returns 26 records marked "Abierto" with publication dates from Jan 2023 and closing dates from Jan–Feb 2023 — all expired. The `SECOPClient._build_query` had no publication date floor, and sync service had no post-sync stale cleanup.
- **Fix 1 — API filter**: Added `DEFAULT_PUBLICATION_LOOKBACK_DAYS = 730` (~2 years) to `SECOPClient`. `_build_query` now appends `fecha_de_publicacion_del >= '<floor>'`.
- **Fix 2 — Post-sync cleanup**: Added `close_stale_processes()` static method to `SECOPSyncService` — marks "Abierto" processes with past `closing_date` as "Cerrado". Called at end of every `synchronize()`.
- **DB cleanup done**: 24 stale processes closed, 2 remain "Abierto" (null `closing_date`).

### [ISSUE-debug-log] Debug.log Growth
- **Context**: `debug.log` grows unbounded in production, consuming disk space. Currently 6.7MB+ and gitignored.
- **Workaround**: Log rotation not yet configured. Manual deletion possible. Track with ops task.

---

## Resolved Issues

### [RESOLVED-001] E2E bypassCaptcha relies on `window.__e2eCaptchaVerified` flag
- **Context**: E2E tests needed to bypass Google reCAPTCHA during automated testing. Relying on Vue internals for captcha state was unreliable across versions.
- **Resolution**: The `bypassCaptcha` helper sets `window.__e2eCaptchaVerified` flag via a `grecaptcha` stub. This is now the stable, version-independent approach.

### [RESOLVED-002] SECOP alert false positives for `None` base_price
- **Context**: `evaluate_process` in SECOPAlertService raised errors or produced false positives when `base_price` was `None`.
- **Resolution**: Added explicit null guards for `base_price` in budget range comparisons (2026-03-19).

### [RESOLVED-003] `_parse_date` returning string instead of `datetime.date`
- **Context**: `_parse_date` in SECOP sync service returned a string instead of a `datetime.date` object, causing downstream comparison failures.
- **Resolution**: Fixed return type; now always returns `datetime.date` or `None` (2026-03-19).

### [RESOLVED-004] SECOP `secop_my_classified` missing `prefetch_related` and `page_size`
- **Context**: The `secop_my_classified` endpoint lacked `prefetch_related`, causing N+1 queries, and crashed on invalid `page_size` input.
- **Resolution**: Added `prefetch_related`, guarded `page_size` with `int()` try/except (2026-03-19).

### [RESOLVED-005] E2E `exportExcel` blob URL memory leak
- **Context**: `exportExcel` in SECOP store created a blob URL via `URL.createObjectURL` but never revoked it, causing memory leaks in long-running E2E sessions.
- **Resolution**: Added `URL.revokeObjectURL` call after `a.click()` in the export action (2026-03-19).

### [RESOLVED-006] `SavedViewSerializer` duplicate name returning 500
- **Context**: Creating a saved view with a duplicate name (unique_together on user+name) raised an unhandled IntegrityError returning HTTP 500.
- **Resolution**: Added unique_together validation in serializer `validate()` method, now returns HTTP 400 (2026-03-19).

### [RESOLVED-007] E2E SECOP alert `data-testid` mismatches
- **Context**: `secop-alert-create-flow.spec.js` referenced `alert-form` and `alert-name-input` but components used `alert-form-modal` and `alert-name`.
- **Resolution**: Updated selectors in the E2E spec to match actual component `data-testid` attributes (2026-03-19).

### [RESOLVED-008] Service creation fails silently when select fields have no options
- **Context**: Admin service creation form allowed creating select_single/select_multiple fields without defining options. Frontend sent `options: []` (empty array), Django model validation rejected it, but error message "No fue posible guardar el servicio" provided no details.
- **Root Cause**: `buildPayload()` in `ServicesAdmin.vue` converted empty `options_text` to `[]` instead of `null`. Model `clean()` method raised `ValidationError` for empty options, but catch block showed generic error.
- **Resolution** (2026-04-15):
  1. **Preventive validation**: Added `validateEditor()` function that validates all required fields before submission, including checking that select fields have at least one option and file fields have allowed extensions.
  2. **Null vs empty array**: Modified `buildPayload()` to send `null` instead of `[]` when options/extensions text is empty (lines 426-431).
  3. **Improved error messages**: Enhanced catch block to extract and display specific error details from backend response (lines 475-489).
  4. **Duplicate key detection**: Added validation to prevent duplicate field keys within the same stage.
- **Affected file**: `frontend/src/views/services/ServicesAdmin.vue`

### [RESOLVED-009] Service icon image preview missing in admin form
- **Context**: Admin service edit form did not show preview of existing service icon image. When editing a service with an icon, the file input appeared empty with no visual indication that an image was already uploaded. The image worked correctly in service cards but was not visible in the admin form.
- **Root Cause**: The `editor` reactive state did not include `icon_image_url`, and `mapServiceToEditor()` did not capture the image URL from the service object.
- **Resolution** (2026-04-15):
  1. **Added image URL to editor state**: Included `icon_image_url: null` in the editor reactive object.
  2. **Updated state management**: Modified `resetEditor()` and `mapServiceToEditor()` to handle `icon_image_url`.
  3. **Added image preview UI**: Created preview section that displays current image in a styled card above the file input (lines 88-114).
  4. **File validation**: Added 5MB maximum file size validation in `onIconSelected()` with user notification on exceed.
  5. **Accept attribute**: Restricted file input to `accept="image/*"` for better UX.
- **UX improvements**: Users can now see the current image when editing, with clear indication that selecting a new file will replace it.
- **Affected file**: `frontend/src/views/services/ServicesAdmin.vue`

### [RESOLVED-010] Admin role showing "Archivos Jurídicos" menu item incorrectly
- **Context**: Admin role users could see "Archivos Jurídicos" (Dynamic Documents) menu item in sidebar, but this is a lawyer-only feature. Clicking the menu item caused confusion as Admin users don't have permissions to view most documents.
- **Root Cause**: The navigation filter for `isAdmin` in `SlideBar.vue` (line 427) did not include "Archivos Juridicos" in the exclusion list, allowing the menu item to appear for Admin users.
- **Resolution** (2026-04-15):
  - Added `navItem.name !== "Archivos Juridicos"` to the admin navigation filter (line 433).
  - Verified backend permission checks exist: all dynamic document endpoints use `@permission_classes([IsAuthenticated])` with role-based decorators (`@require_lawyer_only`, `@require_lawyer_or_owner`) and `apply_visibility_filter()` function that restricts non-lawyer access.
  - Backend already correctly limits Admin access to only documents where they are creator, signer, have explicit permission, or document is public.
- **Note**: This fix only affects menu visibility. Backend security was already correct. No relation to Services module.
- **Affected file**: `frontend/src/components/layouts/SlideBar.vue`

### [RESOLVED-011] Help text appearing after input field in service request forms
- **Context**: In service request forms, the help text (`field.help_text`) that provides guidance to users appeared after the input field, making it difficult for users to understand what information to provide before attempting to fill out the field.
- **Root Cause**: The `help_text` element in `ServiceDetail.vue` was positioned after all input/select/textarea/file elements (line 163-165), instead of immediately after the field label.
- **Resolution** (2026-04-15):
  - Moved `help_text` block to appear immediately after the field label and before the input element (now at lines 89-91).
  - Updated styling from `text-gray-500 mt-2` to `text-gray-600 mb-3` for better readability and proper spacing with the input below.
  - New logical reading flow: Label → Help text → Input → Validation errors.
- **UX improvements**: Users now see the description/guidance before attempting to fill the field, reducing errors and improving form comprehension. Especially beneficial for fields with specific format requirements or complex instructions.
- **Affected file**: `frontend/src/views/services/ServiceDetail.vue`

### [RESOLVED-012] Poor UX for multiple file uploads in service request forms
- **Context**: When uploading multiple files in service request forms, users faced several issues: no way to remove individual files after selection, no visual feedback on file count/limits, and need to re-select all files if one was wrong. Users were resorting to creating compressed folders (.zip) which posed security risks (could contain .exe or malicious files).
- **Root Cause**: The file input only showed a simple list of selected files without controls. The `onFileSelected` function replaced all files instead of adding to the list, and there was no limit enforcement or individual file removal capability.
- **Resolution** (2026-04-15):
  1. **Enhanced file list UI**: Each selected file now displays in a card with file icon, name, size, and individual delete button (lines 177-206).
  2. **File counter**: Shows "Archivos seleccionados (3/10)" to indicate current count vs limit.
  3. **10-file limit**: Added `MAX_FILES_LIMIT = 10` constant and `maxFilesForField()` function. Input disables when limit is reached.
  4. **Incremental file selection**: Modified `onFileSelected()` to append files instead of replacing (lines 379-383).
  5. **Individual file removal**: Added `removeFile()` function to delete specific files from the list (lines 341-353).
  6. **File size display**: Added `formatFileSize()` helper to show human-readable sizes (KB/MB).
  7. **Visual feedback**: Input grays out and shows message when limit is reached.
  8. **Improved existing files display**: Changed from simple list to cards with icons for better consistency.
- **Security benefit**: By providing better multi-file support and limiting to 10 files with specific extensions (.pdf, .docx, .png, etc.), users no longer need to use compressed folders that could contain malicious executables.
- **Affected file**: `frontend/src/views/services/ServiceDetail.vue`

### [RESOLVED-013] Basic PDF design for service request documents lacking professional appearance
- **Context**: The automatically generated PDF for service requests had a basic appearance with simple gray borders and tables, lacking corporate branding and professional visual design. It also lacked a clear legal disclaimer explaining that the document is informational only and does not constitute contract acceptance.
- **Root Cause**: The PDF template (`service_request_pdf.html`) used minimal styling with generic gray borders and simple table layouts, without corporate colors or professional design elements.
- **Resolution** (2026-04-15):
  1. **Corporate header**: Added "G&M CONSULTORES JURIDICOS" header in blue (#5B7C99) with horizontal line separator.
  2. **Document title**: Service name appears as subtitle in gray below the corporate header.
  3. **Inline meta information**: Changed from table format to inline format with separators: "No. Radicado: XXX | Fecha: YYY | Solicitante: ZZZ — G&M".
  4. **Section titles with blue underline**: Each stage/section now has a title with 2px blue (#5B7C99) bottom border instead of gray box.
  5. **Field layout as table**: Fields displayed as `Label | Value` using table-cell display for proper alignment.
  6. **Legal reminder**: Added centered italic text "Esta solicitud está sujeta a estudio y revisión por parte del abogado asignado."
  7. **Disclaimer box**: Added highlighted disclaimer with gray background (#F3F4F6) and blue left border explaining informational nature of document.
  8. **Footer**: Added "Documento generado automáticamente - Confidencial - G&M Consultores Jurídicos - Página 1" footer.
  9. **Color scheme**: Corporate colors throughout - Blue #5B7C99 for headers/borders, various grays for text hierarchy.
  10. **Typography improvements**: Adjusted font sizes (10pt body, 12pt section titles, 14pt company name) and line heights for better readability.
  11. **Reduced margins**: Changed from 2cm to 1.5cm for more content space.
- **Design benefits**: Professional corporate appearance, clear visual hierarchy, improved readability, legal clarity through prominent disclaimer.
- **Affected file**: `backend/gym_app/templates/service_request_pdf.html`

### [RESOLVED-014] Services navigation split across two separate menu items causing menu clutter
- **Context**: The sidebar menu had "Servicios" and "Mis Solicitudes" as two separate menu items, causing navigation clutter and lack of visual consistency with other sections (SECOP, Archivos Jurídicos) that use tabs. Additionally, these views lacked the blue corporate header present in other sections.
- **Root Cause**: Services and service requests were implemented as separate routes (`/services` and `/service_requests/my`) without unified navigation, and views used simple gray headers instead of ModuleHeader component.
- **Resolution** (2026-04-15):
  1. **Created unified hub**: New `ServicesHub.vue` component that combines both views with tab navigation (similar to SECOP and Archivos Jurídicos pattern).
  2. **Added corporate header**: Implemented blue ModuleHeader with title "Servicios y Solicitudes" and subtitle.
  3. **Tab navigation**: Desktop tabs and mobile dropdown to switch between "Servicios" and "Mis Solicitudes".
  4. **Embedded mode**: Modified `ServicesList.vue` and `MyServiceRequests.vue` to support `embedded` prop that hides standalone headers when rendered within hub.
  5. **Router consolidation**: Unified `/services` route to point to `services_hub`, added redirects for backwards compatibility (`/service_requests/my`, `/my_requests`, `/services_list`).
  6. **Query param support**: Tab selection via `?tab=my-requests` query parameter for deep linking.
  7. **Menu cleanup**: Removed "Mis Solicitudes" item from sidebar, updated all role filters (admin, basic user).
  8. **Updated internal links**: Modified links in `ServiceDetail.vue` and `ServiceRequestDetail.vue` to use new unified route.
- **UX benefits**: Cleaner sidebar menu (1 item instead of 2), consistent blue header across all sections, intuitive tab navigation, better organization.
- **Affected files**: 
  - Created: `frontend/src/views/services/ServicesHub.vue`
  - Modified: `frontend/src/views/services/ServicesList.vue`, `frontend/src/views/services/MyServiceRequests.vue`, `frontend/src/router/index.js`, `frontend/src/components/layouts/SlideBar.vue`, `frontend/src/views/services/ServiceDetail.vue`, `frontend/src/views/services/ServiceRequestDetail.vue`

### [RESOLVED-015] Service request notification emails with emojis, unclear status, and missing attachments
- **Context**: Service request notification emails had three issues: (1) emojis/icons that don't render well in all email clients, (2) status updates not visually emphasized, and (3) lawyer response files not attached to notification emails, forcing users to log in to download them.
- **Root Cause**: (1) Template used emoji unicode characters in HTML which don't render consistently across email clients, (2) status label displayed as plain text without HTML formatting, (3) `notify_service_request_status_change` function didn't include attachments parameter and was called before lawyer_responses were loaded.
- **Resolution** (2026-04-15):
  1. **Removed emojis from template**: Deleted the circular icon div containing `{{icon|default:"🔔"}}` from `notification.html` for cleaner, more professional appearance.
  2. **Removed icon fields from Python**: Eliminated `"icon": "📌"` and `"icon": "📬"` from notification contexts in `service_tramite_notifications.py`.
  3. **Highlighted status with HTML**: Changed status message to use inline HTML: `<strong style='font-weight: 700; text-transform: uppercase; color: #1f2937;'>{status_label}</strong>` for bold, uppercase rendering.
  4. **Added attachment logic**: Modified `notify_service_request_status_change` to fetch latest lawyer response files and build attachments list with file paths.
  5. **Reordered notification call**: Moved `notify_service_request_status_change` call in `service_tramite.py` to execute after `_request_queryset()` refetch, ensuring `lawyer_responses__files` are prefetched.
  6. **File validation**: Added checks for file existence (`os.path.isfile`) before adding to attachments list to prevent errors.
- **Email improvements**: Professional appearance without emoji dependency, status prominently displayed in **BOLD UPPERCASE**, clients receive response files directly in email without needing to log in.
- **Affected files**: `backend/gym_app/templates/emails/notification/notification.html`, `backend/gym_app/services/service_tramite_notifications.py`, `backend/gym_app/views/service_tramite.py`

### [RESOLVED-016] Client editor reverted every keystroke on documents with orphan {{tokens}} (text editing blocked)
- **Context** (2026-06-11): Clients could not edit the free text of 53 existing documents (assigned to coordinacion@estrategiaypoder.com) in the client document editor, while newly created documents worked fine. Reported after a lawyer edited a variable in the source template.
- **Root Cause**: The editor's integrity guard (`DocumentEditor.vue`, `input` handler) compared the count of raw `{{...}}` tokens in the saved content against the count of `variable-protected` spans rendered in the editor, restoring the full original content whenever spans < tokens. The 53 documents inherited a token typo from an older version of template 580 («Formato Prórroga- Adición CPS- E&P»): content said `{{Numero_ contrato}}` (stray space) while the variable list said `Numero_contrato`. The orphan token never produced a protected span, so the guard reverted every keystroke forever. The lawyer's later template fix only benefited new documents (content+variables are copied at creation; there is no template→document propagation).
- **Resolution** (2026-06-11):
  1. **Shared protection helpers**: extracted `replaceVariablesWithProtectedSpans` / `countProtectedVariableSpans` / `buildProtectedVariableSpan` into `frontend/src/shared/document_utils.js`. Orphan tokens (no matching variable) are now ALSO wrapped in protected spans (shown as `[token]`), so they cannot be edited and the span count stays consistent.
  2. **Consistent guard baseline**: the `input` guard now compares against `initialProtectedCount` (spans produced at load time) instead of re-counting raw `{{...}}` tokens in the original content.
  3. **Data repair command**: new `python manage.py repair_orphan_variable_tokens` (dry-run by default, `--apply` to write, filters `--assigned-to` / `--ids`) rewrites orphan tokens to the matching variable name when they differ only by internal whitespace; unmatched tokens are reported, never guessed.
- **Affected files**: `frontend/src/shared/document_utils.js`, `frontend/src/views/dynamic_document/DocumentEditor.vue`, `backend/gym_app/management/commands/repair_orphan_variable_tokens.py`
- **Prevention idea (open)**: validate on template save that every `{{token}}` in content has a matching variable; template 525 («Pagaré y carta de instrucciones») still contains a fragmented token `Numero_Pagare</span>` with the same risk pattern.

### [RESOLVED-017] Mis-tagged E2E spec masked process-alert coverage (false-red + false-green)
- **Context** (2026-07-04): The flow-coverage report showed `process-alerts` (the alert **display** indicator flow) as `missing`, while `process-alert-configure` (the interactive `notify_clients` toggle) showed as `covered` — yet no spec actually exercised the toggle.
- **Root Cause**: `frontend/e2e/process/process-alert-recipients.spec.js` verifies the display indicator + history-modal badge (read-only, on `/process_detail`), but every `test()` was tagged `@flow:process-alert-configure`. Coverage status is a pure function of the `@flow:` tag, so the display flow was left with zero tags (false-`missing`) and the config flow inherited a passing spec that never touched the toggle (false-`covered`).
- **Resolution** (2026-07-04): retagged the spec `@flow:process-alert-configure` → `@flow:process-alerts` (the flow it truly drives). `process-alerts` now reports `covered`; `process-alert-configure` correctly reports `missing` and carries a `knownGaps` note in `flow-definitions.json` (its toggle spec is pending `data-testid` + ProcessForm mocking). Also corrected stale `legal-files-*` ❌→✅ markers in `docs/USER_FLOW_MAP.md` (they are covered via `flow-tags.js` constants) and regenerated the coverage matrix from `flow-definitions.json`.
- **Affected files**: `frontend/e2e/process/process-alert-recipients.spec.js`, `frontend/e2e/flow-definitions.json`, `docs/USER_FLOW_MAP.md`
- **Prevention idea**: a mis-pointed tag is invisible without cross-checking spec intent vs flow id; consider a CI assertion that every flow with `expectedSpecs > 0` has ≥1 tagging spec, and review `knownGaps` flows periodically.

### [RESOLVED-020] Admin dashboard rendered blank — RouterLink to dead route name `services_list`
- **Context** (2026-07-22): surfaced while adding an E2E test that enters the reassignment module via the dashboard quick action — the first E2E to render the dashboard as admin.
- **Root Cause**: `FeaturedServicesGrid.vue`'s "Ver todos" link targeted `{ name: 'services_list' }`, a route name removed when the services hub replaced the old list (commit `970ac1b` kept only the nameless `/services_list` path redirect). vue-router throws on resolving an unknown name inside `RouterLink`'s setup; the throw aborts the dashboard re-render triggered when the admin profile loads, wiping the whole body. Lawyer/client dashboards partially survived because their assertions target content rendered before the failing component.
- **Resolution** (commit `984f07b`): link now targets `{ name: 'services_hub' }`. Regression: `data-reassignment-flow.spec.js` (5 tests), `dashboard-lawyer-view.spec.js`, `FeaturedServicesGrid.test.js` all green.
- **Affected files**: `frontend/src/components/dashboard/FeaturedServicesGrid.vue`

### [RESOLVED-019] Renaming a SECOP saved view to a duplicate name returned 500
- **Context** (2026-07-16): surfaced while writing coverage tests for the saved-view PATCH endpoint.
- **Root Cause**: `SavedViewSerializer` has no duplicate-name validation on **update** — creation intentionally upserts by `(user, name)` via `update_or_create`, but the PATCH path calls `instance.save()` straight into the MySQL unique constraint → `IntegrityError` 500. RESOLVED-006 had only addressed the creation flow.
- **Resolution** (commit `d781e7f`): `validate_name` rejects duplicates **only when `self.instance` is set** (rename), preserving create-upsert semantics. Regression test `TestSecopSavedViewEdit::test_patch_duplicate_name_returns_400`.
- **Affected files**: `backend/gym_app/serializers/secop.py`, `backend/gym_app/tests/views/test_secop_views.py`

### [RESOLVED-018] PDF export 500 on editor-created tables + editor/PDF rendering mismatch
- **Context** (2026-07-07): Exporting a dynamic document to PDF returned HTTP 500 when the content contained tables created in the TinyMCE editor; exports also rendered differently from the editor (spacing, table borders).
- **Root Cause**: xhtml2pdf could not handle the editor's table markup, and its CSS subset diverged from what the browser editor showed. The PDF stylesheet was additionally duplicated across `document_views.py` and `signature_views.py`, so fixes drifted apart.
- **Resolution** (commits `2ba6d77`, `65c48ce`, `2d390fa`): dynamic-document PDF rendering migrated to **WeasyPrint 63.1** with a shared stylesheet/HTML builder consolidated in `backend/gym_app/utils/documents.py`; editor-created table markup is normalized before rendering. Both `document_views.py` and `signature_views.py` consume the shared builder. xhtml2pdf remains only for service/trámite PDFs (`services/service_tramite_pdf.py`).
- **Affected files**: `backend/gym_app/utils/documents.py`, `backend/gym_app/views/dynamic_documents/document_views.py`, `backend/gym_app/views/dynamic_documents/signature_views.py`, `backend/requirements.txt`
- **Tests**: `backend/gym_app/tests/utils/test_document_utils.py` (builder + table normalization), regression updates in `test_dynamic_document.py` / `test_dynamic_document_signatures.py`.
