# Security Audit — April 2026

**Scope**: backend (Django 5 / DRF), frontend (Vue 3 / Vite), CI / infra / dependencies.
**Repo**: `gym_project_staging` at commit on branch `release-june-2026-c`.
**Audit date**: 2026-04-30.
**Methodology**: four parallel read-only Explore passes (backend, frontend, deps/CI, IDOR sweep across 42 endpoints), then targeted fixes for confirmed Critical and High findings.

---

## 1. Executive summary

| Severity | Count | Mitigated in this PR | Documented for follow-up |
|---|---|---|---|
| Critical | 6 | 5 | 1 (JWT in localStorage) |
| High | 7 | 6 | 1 (multi-firm legal_request semantics) |
| Medium | ~10 | 0 | all |
| Low | ~8 | 0 | all |

**Top remediations shipped**:
1. Removed `debug_signature` endpoint that leaked `WOMPI_INTEGRITY_KEY`.
2. Closed two confirmed IDOR holes in `process.py` (anyone could mutate / upload to any case).
3. Hardened DRF defaults: `IsAuthenticated` is now the default; rate limiting on auth endpoints.
4. JWT rotation + blacklist (refresh token life cycle, no more zombie tokens).
5. DOMPurify wrapper for the five `v-html` sites (rich-document preview / user guide / search highlight).
6. Gitleaks pre-commit hook so future secret leaks are blocked at commit time.

**Top remediations the repo owner must complete**:
1. Rotate every credential in `backend/.env` as a hygiene measure (git history is clean — never committed — but the file lives on the staging host on disk; see Annex A).
2. Provision the missing `/var/backups/gym_project_staging` directory (current backup job has been failing with `EACCES` since 2026-04-26).
3. Decide the multi-firm policy for `update_legal_request_status` (single-firm cooperative vs. ownership check, see High-2).
4. Migrate JWT storage on the SPA from `localStorage` to `httpOnly` cookies (out of scope for this PR; see Critical-6).

---

## 2. Critical findings

### C-1. `debug_signature` endpoint exposed `WOMPI_INTEGRITY_KEY`

**Status**: Mitigated.
**File**: `backend/gym_app/views/subscription.py:35-65` (now removed).
**Route removed**: `POST /api/subscriptions/debug-signature/`.
**Impact**: any unauthenticated request received the raw Wompi integrity key plus the SHA-256 concatenation recipe, letting an attacker forge valid payment signatures.
**Fix**: deleted the view body and unregistered the URL. The legitimate `generate_signature` (line 68+) requires `IsAuthenticated` and is the only signature endpoint left.
**Verify**: `grep -rn "debug_signature\|debug-signature" backend/` returns no results.

### C-2 & C-3. IDOR in `update_process` and `update_case_file`

**Status**: Mitigated.
**Files**: `backend/gym_app/views/process.py:156, 282`.
**Impact**: any authenticated user (any role) could `PUT /api/update_process/<any-pk>/` to overwrite case data, or `POST /api/update_case_file/` with any `processId` to drop arbitrary files into other firms' cases. The view used `get_object_or_404(Process, pk=pk)` with no ownership check.
**Fix**:
- New helpers `_is_gym_staff(user)` and `_user_can_access_process(user, process)` (case-insensitive role check, since legacy data uses both `Lawyer` and `lawyer`).
- `update_process`: restricted to gym staff (`is_staff` / `is_superuser` / `is_gym_lawyer` / `role in {lawyer, admin}`). Listed clients now get 403; this matches the dynamic-document permission model.
- `update_case_file`: requires gym staff or membership (lawyer assigned, or one of the listed clients).
- `process_list`: was leaking *every* process to any non-Client/Lawyer role due to a case-mismatch bug (`'Client'` vs `'client'`). Non-staff non-clients now correctly receive an empty list.

**Tests**: 13 new tests in `backend/gym_app/tests/views/test_process_idor.py` cover unrelated client, listed client, basic, corporate_client, and gym_lawyer paths. All pass.

### C-4. v-html without sanitization (5 sites)

**Status**: Mitigated.
**Files**:
- `frontend/src/components/dynamic_document/cards/modals/DocumentPreviewModal.vue:14`
- `frontend/src/components/dynamic_document/common/DocumentPreviewModal.vue:19`
- `frontend/src/components/utils/HighlightText.vue:2`
- `frontend/src/views/user_guide/components/ModuleGuide.vue:38, 140`

**Impact**: TinyMCE-authored content was rendered raw in document previews; one author (lawyer) could embed `<script>` or `onerror=` payloads that fired when another user previewed the doc. Same risk for user-guide content stored server-side.
**Fix**:
- Added DOMPurify `^3.4.1` dependency.
- New composable `frontend/src/composables/useSafeHtml.js` exporting `sanitizeHtml(value)`.
- Each `v-html` now binds to a sanitized `computed` (or wraps inline). `HighlightText.vue` additionally HTML-escapes the source text before applying the highlight regex, since the highlight wrapper was the only intentional markup.
- 8 unit tests in `frontend/test/composables/useSafeHtml.test.js` cover script tags, `onerror` attributes, `javascript:` URIs, iframes, null/undefined.

### C-5. No secret-scanning at commit time

**Status**: Mitigated.
**File**: `.pre-commit-config.yaml`.
**Impact**: `.env` was never committed (verified via `git log --all --full-history -- backend/.env frontend/.env`), but no automated control was in place to keep it that way. Any developer could `git add` a config file with hardcoded keys.
**Fix**: added gitleaks `v8.21.2` as the first hook. Smoke-tested with synthetic GitHub PAT (`ghp_…`) and Stripe key (`sk_live_…`) — both detected and blocked. Existing repo passes the all-files scan.
**Run locally**: `pre-commit run gitleaks --all-files`.

### C-6. Backup job failing on staging (operational, not code)

**Status**: Documented — requires `sudo` on host.
**File**: `backend/logs/backups.log` shows daily `[Errno 13] Permission denied: '/var/backups/gym_project_staging'` since 2026-04-26.
**Impact**: no backups have been produced for ~5 days. If a corruption or ransomware event hit MySQL today, the last clean snapshot is older than 5 days.
**Fix (manual, host-side)**:
```bash
sudo mkdir -p /var/backups/gym_project_staging
sudo chown ryzepeck:www-data /var/backups/gym_project_staging
sudo chmod 750 /var/backups/gym_project_staging
sudo systemctl restart gym-project-huey
```
Verify next morning: `tail backend/logs/backups.log`.

### C-7 (deferred). JWT stored in `localStorage`

**Status**: Documented, NOT mitigated in this PR.
**Files**: `frontend/src/stores/auth/auth.js:12, 94, 95`, `frontend/src/stores/services/request_http.js:39`.
**Impact**: any XSS sink that survives DOMPurify (or any future regression) can read the access + refresh tokens via `localStorage.getItem("token")`. We mitigated the known XSS sinks in C-4, but localStorage-stored JWTs make every future XSS into a session takeover.
**Why deferred**: moving to `httpOnly` cookies requires:
- Backend: configure DRF to read JWT from cookie, set CSRF for state-changing requests, adjust `CORS_ALLOW_CREDENTIALS` and `Set-Cookie` flags.
- Frontend: rewrite `request_http.js` (no Authorization header, send cookies with `withCredentials`), rewrite `auth.js` (no token persistence), rewrite refresh flow.
- A full E2E sweep to make sure every authenticated flow still works.

This is its own focused PR. Tracked in this report; do not roll into the security-hardening batch.

---

## 3. High findings

### H-1. No rate limiting on auth endpoints — Mitigated

**Files**: `backend/gym_app/views/userAuth.py` (sign_in, sign_on, send_passcode, send_verification_code, google_login, verify_passcode_and_reset_password) + `backend/gym_project/settings.py`.
**Fix**: DRF `DEFAULT_THROTTLE_CLASSES = [AnonRateThrottle, ScopedRateThrottle]`. Three named scopes:
- `auth_login` → 10/min (sign_in, google_login)
- `auth_passcode` → 5/min (send_passcode, verify_passcode_and_reset_password)
- `auth_signup` → 5/min (sign_on, send_verification_code)

reCAPTCHA already partially mitigated brute force; the throttle is defense-in-depth and protects flows where captcha verification is mocked or bypassed.
**Tests**: `backend/gym_app/tests/views/test_throttling_auth.py` hammers each endpoint and asserts 429 after the configured rate. Conftest auto-clears the cache between tests so rate state doesn't bleed across.

### H-2. `update_legal_request_status` — verify business model — DEFERRED

**File**: `backend/gym_app/views/legal_request.py:563`.
**Issue**: any user with `role='lawyer'` can update the status of *any* legal request. This is intentional for a single-firm cooperative model, but a regression risk for a multi-firm scenario.
**Action requested from owner**: confirm "single firm" or "multi firm". If single, document and close. If multi, add an `assigned_to` / `firm` filter and reopen.

### H-3. `process_list` returned all rows for non-Client/Lawyer roles — Mitigated

Folded into C-2 fix. Non-Client/Lawyer roles now receive `Process.objects.none()` instead of the unfiltered queryset.

### H-4. `fields = '__all__'` in serializers (mass-assignment surface) — Mitigated

**Files**:
- `backend/gym_app/serializers/process.py` (Case, CaseFile, Stage, Process)
- `backend/gym_app/serializers/legal_request.py` (LegalRequestType, LegalDiscipline, LegalRequestFiles)
- `backend/gym_app/serializers/user.py` (UserSerializer)
- `backend/gym_app/serializers/corporate_request.py` (CorporateRequestType, CorporateRequestFiles, CorporateRequestResponse, CorporateRequest)

Each `__all__` was replaced by an explicit field list. UserSerializer kept its existing exposure for SPA backward compatibility (with comment warning that admin flags must not be trusted from the client) but now requires a deliberate edit to add new fields. 393 existing tests still pass.

### H-5. No `DEFAULT_PERMISSION_CLASSES` on DRF — Mitigated

**File**: `backend/gym_project/settings.py`.
**Fix**: default is now `IsAuthenticated`. Eight previously-implicit public endpoints (sign_in / sign_on / send_passcode / send_verification_code / google_login / verify_passcode_and_reset_password / get_wompi_config / wompi_webhook) opt in explicitly with `@permission_classes([AllowAny])`. Verified by grep that every `@api_view` in `backend/gym_app/views/` now has an explicit `@permission_classes`.

### H-6. SIMPLE_JWT had no rotation, no blacklist — Mitigated

**File**: `backend/gym_project/settings.py`.
**Fix**:
- `ACCESS_TOKEN_LIFETIME` reduced from 1 day to 2 hours.
- `REFRESH_TOKEN_LIFETIME = 7 days`.
- `ROTATE_REFRESH_TOKENS = True`, `BLACKLIST_AFTER_ROTATION = True`.
- `rest_framework_simplejwt.token_blacklist` added to INSTALLED_APPS.
- Migration `token_blacklist` applied (12 migrations).

**User impact**: deploying this forces a relogin for any session whose access token is older than 2 h. Communicate the deploy window in #engineering.

### H-7. Pre-commit lacked secret + SAST scanning — Partially mitigated

C-5 added gitleaks. Bandit / semgrep / ruff-S rules are recommended but out of scope; documented in §6.

---

## 4. Medium findings (documented, not mitigated)

| ID | File:line | Description |
|---|---|---|
| M-1 | `backend/gym_app/views/dynamic_documents/document_views.py:1243` | `.docx` upload validates extension + size but not ZIP magic. Document.from_docx fails late. |
| M-2 | `backend/gym_app/views/subscription.py:185, captcha.py:64, services/secop_client.py:122, tasks.py:87` | `requests.*` calls don't pass `verify=True` explicitly (default is True, so this is hardening, not a vulnerability). |
| M-3 | `backend/gym_project/settings.py:25` | `SECRET_KEY` default value contains the literal `django-insecure-`. Prod requires env override (`settings_prod.py:15`), but dev would silently use the insecure default. |
| M-4 | `frontend/vite.config.js:53` | E2E coverage build emits sourcemaps; verify `npm run build` (production) does not. |
| M-5 | `frontend/src/views/dynamic_document/DocumentEditor.vue:136-147` | TinyMCE variable protection uses inline `onmousedown`/`onselectstart` handlers. If `variable.name_es` ever contains a quote, it can break out of the attribute. Sanitize at insert time. |
| M-6 | `backend/gym_project/settings.py:290-348` | Logging has no filter for sensitive values (passwords, tokens). Add a `logging.Filter` that redacts `password`, `token`, `Authorization`, `secret`, `api_key`. |
| M-7 | `frontend/index.html` | No CSP `<meta>` and no CSP header at nginx. |
| M-8 | `scripts/systemd/huey.service:14` | Hardcodes `Environment="DJANGO_ENV=production"` which overrides the staging `.env`. Verify intent. |
| M-9 | `frontend/package.json:29-54` | All deps use caret ranges. `package-lock.json` is committed so installs reproduce, but consider exact pins for the security-critical few (axios, vue, vue-router). |
| M-10 | `.github/workflows/ci.yml:491` | `marocchino/sticky-pull-request-comment@v2` not pinned to SHA. |

---

## 5. Low findings (documented)

- `settings_dev.py:6` `ALLOWED_HOSTS = [..., '*']` — development only.
- `settings.py:51-53` `ENABLE_SILK` default off, but if an env enables it in prod the dashboard at `/silk/` is `is_staff`-gated only.
- `subscription.py:107` logs first 20 chars of `WOMPI_INTEGRITY_KEY` — prefer redaction.
- Multiple `window.location.href = '/internal/route'` in the SPA — should be `router.push`. Not a vulnerability (paths are static), but a code-smell.
- `nginx/gym_project.conf` does not set rate-limit zones or `X-*` security headers (Django middleware adds them, but defense-in-depth at the edge is preferred).
- `User` serializer still exposes `is_staff`, `is_superuser`, `is_active` to the SPA. Documented in code with a warning comment that these must not be trusted server-side from client input.
- No `SECURITY.md` at repo root.
- `debug.log` permissions `664` — group `www-data` can read application logs.

---

## 6. Recommendations beyond this PR

1. **httpOnly cookie for JWT**: see C-7. Single biggest remaining lift for SPA security.
2. **Bandit / semgrep in CI**: add a `python -m bandit -r backend/gym_app -ll` step. Bandit will catch shell-injection and weak-crypto patterns the audit didn't enumerate exhaustively.
3. **Ruff with security rules**: enable `select = ["S"]` (Bandit-equivalent) in `pyproject.toml`.
4. **`detect-secrets` baseline**: complement gitleaks with detect-secrets if you want a maintained allowlist for false positives in fixtures.
5. **CSP**: roll out a strict-but-warming policy (`Content-Security-Policy-Report-Only` first) so TinyMCE / Vue inline styles don't break.
6. **Periodic `npm audit` / `pip audit` in CI**: schedule weekly via `/schedule`.
7. **Penetration test** focused on the dynamic document permission decorators — the audit confirmed they look correct, but this is the most permission-dense area of the codebase.

---

## Annex A — Credentials to rotate (manual)

`backend/.env` was never committed (verified — git history is clean), but the values exist in plaintext on the staging host and may have been read by anyone with shell access there. Rotate as standard hygiene, on the cadence that matches each provider's blast radius.

| Variable | Where to rotate | Notes |
|---|---|---|
| `DJANGO_SECRET_KEY` | regenerate locally with `python -c "import secrets; print(secrets.token_urlsafe(50))"`, update `.env`, restart gunicorn | Invalidates all signed cookies / one-shot signed URLs. Expected and OK. |
| `DB_PASSWORD` | MySQL: `ALTER USER 'Naxcar'@'localhost' IDENTIFIED BY '…';` then update `.env` and restart | Coordinate with backups job restart. |
| `EMAIL_HOST_PASSWORD` | Gmail account → app passwords → revoke `qqkonucyrihfgfpv` and create a new one | Old one is a Gmail app password, easy to revoke without locking the account. |
| `REDIS_URL` password | Redis ACL or `requirepass` on the host, restart `gym-project-huey` and `gunicorn` | The Huey queue drains briefly during the swap — pick a low-traffic window. |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA admin → site → reset secret. Update `.env` *and* `frontend/.env` site key if you're rotating both. | Site key is public, secret is server-only. |
| `GOOGLE_CLIENT_ID` / secret | Google Cloud Console → OAuth 2.0 Client IDs → reset secret | Coordinate with frontend `VITE_GOOGLE_CLIENT_ID`. |
| `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_INTEGRITY_KEY` / `WOMPI_EVENTS_KEY` | Wompi merchant dashboard → API keys → rotate | High priority because of the now-removed debug_signature exposure. Do this even though the endpoint is gone. |
| `SECOP_APP_TOKEN` / `SECOP_APP_SECRET` | datos.gov.co Socrata → reset app token | Low blast radius (read-only public data). |

After all rotations, restart in this order: `redis` → `gunicorn` (`sudo systemctl restart gym_intranet`) → `huey` (`sudo systemctl restart gym-project-huey`). Tail `backend/logs/backups.log` and `backend/debug.log` for 5 minutes to catch missed config.

---

## Annex B — Public endpoints (no auth required)

| Endpoint | Method | Justification | Throttle |
|---|---|---|---|
| `/api/sign_in/` | POST | Login flow | `auth_login` 10/min |
| `/api/sign_on/` | POST | Signup flow | `auth_signup` 5/min |
| `/api/sign_on/send_verification_code/` | POST | Signup email verification | `auth_signup` 5/min |
| `/api/send_passcode/` | POST | Password reset request | `auth_passcode` 5/min |
| `/api/verify_passcode_and_reset_password/` | POST | Password reset confirm | `auth_passcode` 5/min |
| `/api/google_login/` | POST | Google ID-token sign-in | `auth_login` 10/min |
| `/api/subscriptions/wompi-config/` | GET | Returns `WOMPI_PUBLIC_KEY` (public by design) | `anon` 60/min |
| `/api/subscriptions/webhook/` | POST | Wompi → us. HMAC-validated (`hmac.compare_digest`) on `X-Wompi-Signature`. | `anon` 60/min |
| `/api/google-captcha/site-key/` | GET | Returns the public site key | `anon` 60/min |
| `/api/google-captcha/verify/` | POST | Server-side reCAPTCHA verification | `anon` 60/min |
| `/api/health/` | GET | Liveness probe | `anon` 60/min |

---

## Annex C — IDOR sweep results (42 endpoints)

| File | Endpoints audited | Confirmed IDOR | Probable IDOR | Safe |
|---|---|---|---|---|
| `organization.py` | 9 | 0 | 0 | 9 (filter by `corporate_client=request.user`) |
| `legal_request.py` | 6 | 0 | 1 (H-2 status update) | 5 |
| `corporate_request.py` | 6 | 0 | 0 | 6 |
| `secop.py` | 11 | 0 | 0 | 11 (saved views / classifications filter by `user=request.user`; process list is intentionally public data) |
| `process.py` | 5 | 2 (C-2, C-3) | 1 (H-3) | 2 |
| `dynamic_documents/document_views.py` + `permissions.py` | 5 | 0 | 0 | 5 (decorators `@require_document_visibility`, `@require_document_usability`) |
| `subscription.py` | 2 | 0 | 0 | 2 |

After this PR, all confirmed IDOR holes are closed. H-2 awaits a business-model decision.

---

## Annex D — Files changed in this PR

**New**:
- `docs/security/SECURITY_AUDIT_2026_04.md` (this document)
- `frontend/src/composables/useSafeHtml.js`
- `frontend/test/composables/useSafeHtml.test.js`
- `backend/gym_app/tests/views/test_process_idor.py` (13 tests)
- `backend/gym_app/tests/views/test_throttling_auth.py` (3 tests)

**Modified**:
- `backend/gym_app/views/subscription.py` (removed `debug_signature`, public endpoints opt in to `AllowAny`)
- `backend/gym_app/urls.py` (unregistered debug-signature route)
- `backend/gym_app/views/process.py` (`_is_gym_staff`, `_user_can_access_process`, ownership checks)
- `backend/gym_app/views/userAuth.py` (`AllowAny` + scoped throttle subclasses)
- `backend/gym_app/serializers/{process,legal_request,user,corporate_request}.py` (explicit fields)
- `backend/gym_project/settings.py` (DRF defaults, throttling, SIMPLE_JWT rotation, token_blacklist app)
- `backend/gym_app/tests/conftest.py` (autouse cache reset)
- `backend/gym_app/tests/views/test_process.py` (lawyer-sees-all semantics, mock target updated)
- `frontend/package.json` + `frontend/package-lock.json` (DOMPurify)
- `frontend/src/components/dynamic_document/cards/modals/DocumentPreviewModal.vue`
- `frontend/src/components/dynamic_document/common/DocumentPreviewModal.vue`
- `frontend/src/components/utils/HighlightText.vue`
- `frontend/src/views/user_guide/components/ModuleGuide.vue`
- `.pre-commit-config.yaml`

**Migration applied**:
- `python manage.py migrate token_blacklist` (12 migrations from `rest_framework_simplejwt.token_blacklist`)

---

## Annex E — How to verify locally

```bash
# Backend — full suite, IDOR, throttling, serializers
cd backend && source venv/bin/activate
pytest gym_app/tests/views/test_process_idor.py -v
pytest gym_app/tests/views/test_throttling_auth.py -v
pytest gym_app/tests/serializers/ gym_app/tests/views/test_process.py gym_app/tests/views/test_user_auth.py gym_app/tests/views/test_user_auth_views.py -q

# Frontend — sanitizer + regression
cd ../frontend
npm test -- test/composables/useSafeHtml.test.js
npm test -- test/components/dynamic_document/common/DocumentPreviewModal.test.js

# Pre-commit — gitleaks scan
cd ..
pre-commit run gitleaks --all-files

# Endpoint smoke
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/subscriptions/debug-signature/ \
  -H 'Content-Type: application/json' -d '{"reference":"x","amount_in_cents":1000}'
# Expect: 404
```
