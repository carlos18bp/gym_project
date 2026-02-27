# Outlook (Microsoft) Authentication Integration

Add a "Sign in with Outlook/Microsoft" button alongside the existing Google OAuth button across all auth views, reusing the same backend pattern (get-or-create user + JWT).

---

## Current Architecture Summary

| Layer | Google Auth Flow |
|-------|-----------------|
| **Frontend lib** | `vue3-google-login` (npm) — provides `<GoogleLogin>` component + `decodeCredential()` |
| **Shared helper** | `src/shared/login_with_google.js` — decodes credential, POSTs to `/api/google_login/`, calls `authStore.login()` |
| **Views using it** | `SignIn.vue`, `SignOn.vue`, `SubscriptionSignIn.vue`, `SubscriptionSignUp.vue` |
| **Backend endpoint** | `POST /api/google_login/` (`userAuth.google_login`) — receives `{email, given_name, family_name, picture}`, does `get_or_create(User)`, returns JWT |
| **Token strategy** | Frontend decodes Google's JWT client-side via `decodeCredential()`, sends **plain user data** (not the raw token) to Django. Django trusts that data without signature verification. |

> **Security note (pre-existing):** The current Google flow sends decoded user claims without backend token verification. The Microsoft implementation should follow the same pattern for consistency, but this is flagged as a future improvement for both providers.

---

## Approach: `@azure/msal-browser` + mirrored backend view

### Why this approach
- **`@azure/msal-browser`** is Microsoft's official SPA auth library (~3.x). It handles the OAuth2/OIDC popup or redirect flow and returns an ID token with claims (`email`, `name`, `given_name`, `family_name`, `picture`).
- No Vue-specific wrapper needed — we can use it directly via a composable/helper, mirroring the `login_with_google.js` pattern.
- Backend stays simple: a new `outlook_login` view that mirrors `google_login` (same `get_or_create` + JWT pattern).

### Prerequisites (Azure Portal)
1. Register a **Single Page Application** in [Microsoft Entra ID (Azure AD)](https://entra.microsoft.com) > App registrations.
2. Set **Supported account types** to: `Accounts in any organizational directory and personal Microsoft accounts` (to allow Outlook.com / Hotmail / Live accounts).
3. Add **Redirect URI** as type **SPA**: `http://localhost:3000/auth/outlook/callback` (dev) and `https://www.gmconsultoresjuridicos.com/auth/outlook/callback` (prod).
4. Note the **Application (client) ID** — this is the `clientId` for MSAL config.
5. Under **Authentication > Implicit grant and hybrid flows**, enable **ID tokens**.

---

## Implementation Plan

### Step 1 — Frontend: Install `@azure/msal-browser`
- `npm install @azure/msal-browser` in `frontend/`.

### Step 2 — Frontend: Create MSAL config + helper
- **New file:** `src/shared/msal_config.js`
  - Export MSAL `Configuration` object with `clientId`, `authority` (`https://login.microsoftonline.com/common`), and `redirectUri`.
  - Use env variable or same `isDevelopment` pattern as `main.js` for redirect URI.
- **New file:** `src/shared/login_with_outlook.js`
  - Initialize `PublicClientApplication` singleton.
  - Export `loginWithOutlook(router, authStore)`:
    1. Call `msalInstance.loginPopup({ scopes: ['openid', 'profile', 'email', 'User.Read'] })`.
    2. Extract `email`, `name` (split into given/family), and `picture` from the returned `account` / `idTokenClaims`.
    3. POST to `/api/outlook_login/` with `{email, given_name, family_name}`.
    4. Call `authStore.login(response.data)` and redirect.
  - Export `loginWithOutlookForSubscription(router, authStore, route)` variant (redirects to checkout instead of dashboard).

### Step 3 — Frontend: Add Outlook button to auth views
Modify these 4 views to add a Microsoft/Outlook sign-in button **below** the existing `<GoogleLogin>`:

1. **`SignIn.vue`** — Add Outlook button + import `loginWithOutlook`.
2. **`SignOn.vue`** — Same pattern.
3. **`SubscriptionSignIn.vue`** — Uses checkout redirect variant.
4. **`SubscriptionSignUp.vue`** — Uses checkout redirect variant.

**Button design:** A styled button with the Microsoft logo (SVG inline), text "Continuar con Outlook", matching the visual weight of the Google button.

### Step 4 — Frontend: Add router callback route
- Add `/auth/outlook/callback` route in `src/router/index.js` (mirrors the existing `/auth/google/callback` pattern).

### Step 5 — Backend: New `outlook_login` view
- **File:** `backend/gym_app/views/userAuth.py`
- New function `outlook_login(request)` — nearly identical to `google_login`:
  - Receives `{email, given_name, family_name}` via POST.
  - Normalizes email (`strip().lower()`).
  - `User.objects.get_or_create(email=email, defaults={...})`.
  - Returns `{refresh, access, user, created}`.
  - No profile picture handling initially (Microsoft Graph API requires an extra API call; can add later).

### Step 6 — Backend: Register URL
- **File:** `backend/gym_app/urls.py`
- Add `path('outlook_login/', userAuth.outlook_login, name='outlook_login')` to `sign_in_sign_on_urls`.

### Step 7 — Backend: Update `sign_in` error message
- Update the BUG-11 message in `sign_in` to also mention Outlook:
  - From: `"This account was created with Google..."`
  - To: `"This account was created with Google or Outlook..."`

### Step 8 — Settings / Environment
- Add `MICROSOFT_CLIENT_ID` to `settings.py` (from env var, with a default for dev).
- This is only needed if we later add backend token validation; for now the frontend holds the client ID.

### Step 9 — Tests

#### Backend tests (pytest)
- **New file:** `backend/gym_app/tests/views/test_outlook_login.py`
  - `test_outlook_login_existing_user` — 200, returns JWT + user data, `created=False`.
  - `test_outlook_login_new_user` — 200, creates user, `created=True`.
  - `test_outlook_login_no_email` — 400 error.
  - `test_outlook_login_empty_email_after_strip` — 400 error.
  - `test_outlook_login_normalizes_email` — verifies email lowercased.

#### Frontend unit tests (Jest)
- **New file:** `src/shared/__tests__/login_with_outlook.test.js`
  - Mock `@azure/msal-browser` and axios.
  - Test: successful login calls POST and `authStore.login`.
  - Test: MSAL popup failure shows notification.

#### E2E tests (Playwright)
- **New file:** `e2e/auth/auth-outlook-login.spec.js`
  - Mock `/api/outlook_login/` API response.
  - Verify button is visible on SignIn and SignOn pages.
  - (MSAL popup itself cannot be fully E2E tested without a real Microsoft account, so focus on API mock + redirect behavior.)

---

## Files Changed (Summary)

| File | Action |
|------|--------|
| `frontend/package.json` | Add `@azure/msal-browser` dependency |
| `frontend/src/shared/msal_config.js` | **New** — MSAL configuration |
| `frontend/src/shared/login_with_outlook.js` | **New** — Outlook login helper |
| `frontend/src/views/auth/SignIn.vue` | Add Outlook button |
| `frontend/src/views/auth/SignOn.vue` | Add Outlook button |
| `frontend/src/views/auth/SubscriptionSignIn.vue` | Add Outlook button |
| `frontend/src/views/auth/SubscriptionSignUp.vue` | Add Outlook button |
| `frontend/src/router/index.js` | Add `/auth/outlook/callback` route |
| `backend/gym_app/views/userAuth.py` | Add `outlook_login` view, update BUG-11 message |
| `backend/gym_app/urls.py` | Add `outlook_login` URL |
| `backend/gym_app/tests/views/test_outlook_login.py` | **New** — backend tests |
| `frontend/src/shared/__tests__/login_with_outlook.test.js` | **New** — frontend unit tests |
| `frontend/e2e/auth/auth-outlook-login.spec.js` | **New** — E2E tests |

---

## Open Questions / Decisions Needed

1. **Azure App Registration:** Do you already have a Microsoft Entra ID (Azure AD) app registration, or do I need to guide you through creating one? The `clientId` is required before the frontend can work.
2. **Button label:** "Continuar con Outlook" vs "Continuar con Microsoft" — which do you prefer?
3. **Profile picture:** Microsoft Graph requires an extra authenticated API call (`GET /me/photo/$value`) to fetch the user's photo. Should we implement this now or defer?
4. **Backend token verification:** The current Google flow trusts decoded client-side claims. Should we add proper server-side ID token validation for Microsoft (and eventually Google too), or keep the same trust model?