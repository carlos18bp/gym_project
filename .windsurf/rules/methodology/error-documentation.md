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
