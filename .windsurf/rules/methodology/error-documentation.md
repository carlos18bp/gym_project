---
trigger: model_decision
description: Error documentation and known issues tracking. Reference when debugging, fixing bugs, or encountering recurring issues.
---

# Error Documentation — GymProject

This file tracks known errors, their context, and resolutions. When a reusable fix or correction is found during development, document it here to avoid repeating the same mistake.

---

## Format

```
### [ERROR-NNN] Short description
- **Date**: YYYY-MM-DD
- **Context**: Where/when this error occurs
- **Root Cause**: Why it happens
- **Resolution**: How to fix it
- **Files Affected**: List of files
```

---

## Known Issues

### [ISSUE-001] Backup composable file left in codebase
- **Date**: 2026-03-17 (discovered during deep-dive)
- **Context**: `frontend/src/composables/document-variables/useDocumentPermissions_backup.js` exists alongside the actual `useDocumentPermissions.js`
- **Root Cause**: Leftover from a refactor — developer created backup before editing, never cleaned up
- **Resolution**: Safe to delete `useDocumentPermissions_backup.js`. Verify no imports reference it first: `grep -r "useDocumentPermissions_backup" frontend/src/`
- **Files Affected**: `frontend/src/composables/document-variables/useDocumentPermissions_backup.js`

### [ISSUE-002] Empty check_tags.py in backend root
- **Date**: 2026-03-17 (discovered during deep-dive)
- **Context**: `backend/check_tags.py` is 0 bytes — serves no purpose
- **Root Cause**: Likely a debugging/scratch file that was committed accidentally
- **Resolution**: Safe to delete
- **Files Affected**: `backend/check_tags.py`

### [ISSUE-003] Unbounded debug.log growth
- **Date**: 2026-03-17 (discovered during deep-dive)
- **Context**: `backend/debug.log` is 6.7MB and growing. Logging config uses `WatchedFileHandler` without rotation. File is already in `.gitignore` (not a git issue).
- **Root Cause**: No log rotation configured in `settings.py` LOGGING config
- **Resolution**: Switch to `RotatingFileHandler` with `maxBytes` and `backupCount`, or configure system-level logrotate
- **Files Affected**: `backend/gym_project/settings.py` (LOGGING config)

### [ISSUE-004] SECOP serializer N+1 query — `.filter()` on prefetched manager
- **Date**: 2026-03-19
- **Context**: `SECOPProcessListSerializer.get_my_classification` used `obj.classifications.filter(user=request.user).first()` which creates a new DB query per process even though the view prefetches classifications
- **Root Cause**: Django's `.filter()` on a prefetched related manager creates a fresh queryset, bypassing the prefetch cache
- **Resolution**: Iterate `obj.classifications.all()` in Python and match `c.user_id == user_id`. The `.all()` call uses the prefetch cache.
- **Key Lesson**: When using `prefetch_related`, always access prefetched data via `.all()` and filter in Python, or use `Prefetch` with `to_attr`
- **Files Affected**: `backend/gym_app/serializers/secop.py`

### [ISSUE-005] SECOP alert `evaluate_process` false positives for budget-less processes
- **Date**: 2026-03-19
- **Context**: `SECOPAlert.evaluate_process` skipped the budget range check entirely when `process.base_price` was `None`, allowing processes without budget info to match alerts with budget criteria
- **Root Cause**: The guard `if process.base_price:` is falsy for `None`, so the entire budget block was skipped
- **Resolution**: Changed to check `if self.min_budget or self.max_budget:` first, then return `False` if `process.base_price is None`
- **Files Affected**: `backend/gym_app/models/secop.py`

### [ISSUE-006] SECOP `_parse_date` returned string instead of `datetime.date` object
- **Date**: 2026-03-19
- **Context**: `SECOPSyncService._parse_date` returned a raw string like `"2023-01-21"` instead of a proper `datetime.date` object
- **Root Cause**: Method just split the string on `T` and returned it, unlike `_parse_datetime` which properly uses `parse_datetime`
- **Resolution**: Added `django.utils.dateparse.parse_date` call to return a proper `date` object
- **Files Affected**: `backend/gym_app/services/secop_sync_service.py`

### [ISSUE-007] SECOP `secop_my_classified` missing `prefetch_related` and `page_size`
- **Date**: 2026-03-19
- **Context**: The `secop_my_classified` view didn't prefetch classifications (causing N+1) and omitted `page_size` from the paginated response (inconsistent with `secop_process_list`)
- **Root Cause**: Omission during initial implementation
- **Resolution**: Added `.prefetch_related('classifications')` to queryset and `page_size` to response dict. Updated frontend store to read `page_size` from response instead of hardcoding `20`.
- **Files Affected**: `backend/gym_app/views/secop.py`, `frontend/src/stores/secop/index.js`

### [ISSUE-008] Frontend `exportExcel` memory leak — missing `URL.revokeObjectURL`
- **Date**: 2026-03-19
- **Context**: The `exportExcel` store action created a blob URL for download but never revoked it
- **Root Cause**: `URL.revokeObjectURL()` call was missing after `link.click()`
- **Resolution**: Added `URL.revokeObjectURL(objectUrl)` after the download link is clicked and removed
- **Files Affected**: `frontend/src/stores/secop/index.js`

### [ISSUE-009] SECOP API returns stale "Abierto" records from 2023
- **Date**: 2026-03-20
- **Context**: All 26 records in the staging DB had `status='Abierto'` with `publication_date` from Jan 2023 and `closing_date` from Jan–Feb 2023 — all long expired. These came from the real SECOP API (datos.gov.co dataset `bt96-ncis`), not fake data.
- **Root Cause**: Two gaps: (1) `SECOPClient._build_query` only filtered by `estado_del_procedimiento='Abierto'` with no publication date floor, so the API returned any record SECOP marked as open regardless of age. (2) `SECOPSyncService.synchronize` had no post-sync validation to close processes with expired `closing_date`.
- **Resolution**: (1) Added `DEFAULT_PUBLICATION_LOOKBACK_DAYS = 730` to `SECOPClient` — `_build_query` now always appends `fecha_de_publicacion_del >= '<2y ago>'`. (2) Added `close_stale_processes()` static method to `SECOPSyncService` that marks "Abierto" processes with past `closing_date` as "Cerrado", called at the end of every `synchronize()`. (3) Ran cleanup on staging DB: 24 stale → Cerrado.
- **Key Lesson**: External APIs can have stale/inconsistent data. Always apply defensive date filters at the query level AND validate data quality post-sync.
- **Files Affected**: `backend/gym_app/services/secop_client.py`, `backend/gym_app/services/secop_sync_service.py`

---

## Resolved Issues

### [RESOLVED-001] E2E bypassCaptcha timeout — Vue internals dependency
- **Date**: 2025-07-17
- **Context**: All 9 auth E2E tests (`auth-login-attempts`, `auth-sign-on`, `auth-subscription-sign-in`, `auth-subscription-sign-up`) timed out at `bypassCaptcha()` → `page.waitForFunction()` with `TimeoutError: Timeout 10000ms exceeded`.
- **Root Cause**: `bypassCaptcha` walked Vue's internal component tree (`el.__vueParentComponent`, `comp.setupState`, `comp.setupState.__v_raw`) to detect when `captchaToken` was set. These internals are guarded by `NODE_ENV !== "production" || __VUE_PROD_DEVTOOLS__` and changed across Vue 3.5 reactivity rewrites (proxyRefs behavior). 6+ prior fix attempts failed, confirming the approach was fundamentally unreliable.
- **Resolution**: Replaced all Vue-internals traversal with a `window.__e2eCaptchaVerified` flag set by the `grecaptcha` stub in `test.js`. The stub fires the `@verify` callback via microtask and sets the window flag; `bypassCaptcha` simply waits for the flag. Zero dependency on Vue internals.
- **Key Lesson**: Never rely on Vue internal properties (`__vueParentComponent`, `setupState`, `__v_raw`) in E2E tests. Use DOM attributes or window-level flags for cross-version stability.
- **Files Affected**: `frontend/e2e/helpers/captcha.js`, `frontend/e2e/helpers/test.js`

### [RESOLVED-002] E2E auth tests crash — "Target page, context or browser has been closed"
- **Date**: 2025-07-18
- **Context**: All 9 auth E2E tests (`auth-login-attempts`, `auth-sign-on`, `auth-subscription-sign-in`, `auth-subscription-sign-up`) failed with `Error: expect.toBeVisible: Target page, context or browser has been closed` after the page loaded and form was filled but before button interaction.
- **Root Cause**: `vue3-google-login` inserts a `<script src="https://accounts.google.com/gsi/client">` tag. The test fixture aborted this request via `page.route()`. The library's internal loader (`h()`) rejected its Promise, but the caller (`w()`) chained with `.then()` **without `.catch()`**, producing an **unhandled Promise rejection** that crashed the page context in CI's headless Chromium. Additionally, CI lacked `VITE_GOOGLE_CLIENT_ID`, causing the `GoogleLogin` component to throw synchronously on mount.
- **Resolution**: Two changes in `frontend/e2e/helpers/test.js`: (1) Added a `window.google.accounts.id` stub in `addInitScript` with frozen no-op methods (`initialize`, `renderButton`, etc.) so `vue3-google-login` finds the API ready. (2) Split the route handler — reCAPTCHA scripts are still aborted, but GSI scripts are **fulfilled** with empty JS (`route.fulfill({ status: 200, body: '/* gsi stub */' })`). This makes the library's `load` event fire, sets `apiLoaded = true`, and it calls our stub methods. Zero unhandled rejections.
- **Key Lesson**: When blocking third-party scripts in E2E tests, prefer `route.fulfill()` with a stub over `route.abort()` to avoid unhandled Promise rejections in libraries that load scripts dynamically without proper error handling.
- **Files Affected**: `frontend/e2e/helpers/test.js`
