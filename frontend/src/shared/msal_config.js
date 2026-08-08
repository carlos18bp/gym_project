import { LogLevel, PublicClientApplication } from "@azure/msal-browser";

// Application domain, reused from the Google OAuth setup for the redirect URI.
const domain = import.meta.env.VITE_APP_DOMAIN || "http://localhost:5173";

// Verbose MSAL logging is opt-in: always on in dev, and switchable in deployed
// environments with VITE_MSAL_DEBUG=true so a failing popup can be diagnosed
// from the browser console without shipping noisy logs by default.
const msalDebugEnabled =
  Boolean(import.meta.env.DEV) || import.meta.env.VITE_MSAL_DEBUG === "true";

/**
 * MSAL configuration for Microsoft (Entra ID) authentication.
 *
 * The "common" authority supports both personal Microsoft accounts
 * (Outlook.com, Hotmail, Live) and work/school accounts (Microsoft 365 /
 * Azure AD). The redirect URI must be registered as a "SPA" platform in the
 * Azure App Registration, and is served as a minimal static page (not the SPA)
 * so the popup does not boot the whole application before MSAL closes it.
 */
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: `${domain}/auth/outlook/callback`,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Verbose,
      piiLoggingEnabled: false,
      loggerCallback: (level, message, containsPii) => {
        if (!msalDebugEnabled || containsPii) return;
        console.log(`[msal] ${message}`);
      },
    },
  },
};

/**
 * Scopes requested during login. `openid`, `profile` and `email` are the
 * standard OpenID Connect scopes required to obtain an ID token with the
 * user's email and display name.
 *
 * `prompt: "select_account"` mirrors the Google button's `select-account`:
 * without it Microsoft silently reuses the browser's existing session and the
 * user never gets to choose which account to sign in with.
 */
export const loginRequest = {
  scopes: ["openid", "profile", "email"],
  prompt: "select_account",
};

// MSAL stores its "an interaction is running" flag under
// `msal.<clientId>.interaction.status` in sessionStorage. When an interaction
// is orphaned (double click, tab reload, popup that never reports back) the
// flag survives and every later loginPopup() throws `interaction_in_progress`
// until the tab is closed.
const INTERACTION_STATUS_KEY_PATTERN = /^msal\..*interaction\.status$/;
const MSAL_CACHE_KEY_PREFIX = "msal.";

const forEachSessionStorageKey = (callback) => {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  const storage = window.sessionStorage;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  keys.forEach((key) => callback(key, storage));
};

/**
 * Remove a leftover `interaction_in_progress` flag from a previous, orphaned
 * MSAL interaction so the user is not locked out of the login button.
 */
export function clearStaleMsalInteraction() {
  forEachSessionStorageKey((key, storage) => {
    if (INTERACTION_STATUS_KEY_PATTERN.test(key)) storage.removeItem(key);
  });
}

/**
 * Drop every MSAL cache entry. Called on logout so a stale Microsoft session
 * does not leak into the next user of the same browser tab.
 */
export function clearMsalCache() {
  forEachSessionStorageKey((key, storage) => {
    if (key.startsWith(MSAL_CACHE_KEY_PREFIX)) storage.removeItem(key);
  });
}

let msalInstancePromise = null;

/**
 * Lazily create and initialize the MSAL PublicClientApplication.
 *
 * Instantiation is deferred so the app does not fail to load when the
 * Microsoft client ID is not configured. MSAL v3+ requires `initialize()` to
 * be awaited before any other API call.
 *
 * The *promise* is memoized, not just the instance: two rapid clicks would
 * otherwise both enter this function and build two PublicClientApplication
 * objects racing over the same sessionStorage.
 *
 * @returns {Promise<PublicClientApplication>} The initialized MSAL instance.
 */
export async function getMsalInstance() {
  if (!msalInstancePromise) {
    msalInstancePromise = (async () => {
      if (!msalConfig.auth.clientId) {
        throw new Error(
          "VITE_MICROSOFT_CLIENT_ID is not configured; Microsoft login is unavailable."
        );
      }

      const instance = new PublicClientApplication(msalConfig);
      await instance.initialize();
      // Settles any interaction left pending by a previous page load and lets
      // MSAL clean up its temporary cache entries.
      await instance.handleRedirectPromise();
      return instance;
    })();

    // A failed initialization must not be cached: the next click should retry.
    msalInstancePromise.catch(() => {
      msalInstancePromise = null;
    });
  }

  return msalInstancePromise;
}

let pendingSignIn = null;

const runSignIn = async () => {
  const instance = await getMsalInstance();

  try {
    return await instance.loginPopup(loginRequest);
  } catch (error) {
    if (error?.errorCode !== "interaction_in_progress") throw error;

    // The blocking interaction belongs to a popup that never completed, so
    // clear the stale flag and retry once instead of leaving the tab stuck.
    clearStaleMsalInteraction();
    return instance.loginPopup(loginRequest);
  }
};

/**
 * Open the Microsoft sign-in popup and return the authentication result.
 *
 * Concurrent calls share a single in-flight popup: MSAL allows only one
 * interaction at a time, so a second click reuses the running one instead of
 * throwing `interaction_in_progress`.
 *
 * @returns {Promise<import("@azure/msal-browser").AuthenticationResult>}
 *          The MSAL authentication result, including the raw `idToken`.
 */
export async function signInWithMicrosoft() {
  // E2E seam: tests inject `window.__e2eOutlookAuth` to stand in for the real
  // Microsoft popup (which Playwright cannot drive), mirroring the Google login
  // and captcha bypass hooks. No effect in production where it is undefined.
  if (typeof window !== "undefined" && typeof window.__e2eOutlookAuth === "function") {
    return window.__e2eOutlookAuth();
  }

  if (pendingSignIn) return pendingSignIn;

  pendingSignIn = runSignIn().finally(() => {
    pendingSignIn = null;
  });

  return pendingSignIn;
}
