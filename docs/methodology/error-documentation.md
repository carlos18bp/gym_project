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
