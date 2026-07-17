import { PublicClientApplication } from "@azure/msal-browser";

// Application domain, reused from the Google OAuth setup for the redirect URI.
const domain = import.meta.env.VITE_APP_DOMAIN || "http://localhost:5173";

/**
 * MSAL configuration for Microsoft (Entra ID) authentication.
 *
 * The "common" authority supports both personal Microsoft accounts
 * (Outlook.com, Hotmail, Live) and work/school accounts (Microsoft 365 /
 * Azure AD). The redirect URI must be registered as a "SPA" platform in the
 * Azure App Registration.
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
};

/**
 * Scopes requested during login. `openid`, `profile` and `email` are the
 * standard OpenID Connect scopes required to obtain an ID token with the
 * user's email and display name.
 */
export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

let msalInstance = null;

/**
 * Lazily create and initialize the MSAL PublicClientApplication.
 *
 * Instantiation is deferred so the app does not fail to load when the
 * Microsoft client ID is not configured. MSAL v3+ requires `initialize()` to
 * be awaited before any other API call.
 *
 * @returns {Promise<PublicClientApplication>} The initialized MSAL instance.
 */
export async function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
}

/**
 * Open the Microsoft sign-in popup and return the authentication result.
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

  const instance = await getMsalInstance();
  return instance.loginPopup(loginRequest);
}
