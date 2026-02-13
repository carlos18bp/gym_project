import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * Auth edge cases:
 * - Token expiration redirects to sign_in
 * - Google OAuth callback route renders sign-in page
 * - Invalid credentials show error notification
 * - Sign-in with missing email/password shows validation warning
 * - Authenticated user visiting sign_in is redirected to dashboard
 */

async function installAuthEdgeCaseMocks(page, { scenario = "default", userId = 9500 } = {}) {
  const user = {
    id: userId,
    first_name: "Test",
    last_name: "User",
    email: "test@example.com",
    role: "client",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: true,
    is_gym_lawyer: false,
    has_signature: false,
  };

  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Token validation — behavior depends on scenario
    if (apiPath === "validate_token/") {
      if (scenario === "expired_token") {
        return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "token_expired" }) };
      }
      if (scenario === "authenticated") {
        return { status: 200, contentType: "application/json", body: "{}" };
      }
      // Default: unauthenticated
      return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };
    }

    // Sign in
    if (apiPath === "sign_in/") {
      if (scenario === "invalid_credentials") {
        return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid_credentials" }) };
      }
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "e2e-token-new", user }),
      };
    }

    // Google login
    if (apiPath === "google_login/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "e2e-google-token", user, created: false }),
      };
    }

    // Users
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };

    // Dashboard endpoints
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

function bypassCaptcha(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#email") || document.querySelector("form");
    let comp = el && el.__vueParentComponent;

    while (
      comp &&
      !(
        (comp.setupState && "captchaToken" in comp.setupState) ||
        (comp.ctx && "captchaToken" in comp.ctx) ||
        (comp.proxy && "captchaToken" in comp.proxy)
      )
    ) {
      comp = comp.parent;
    }

    if (!comp) throw new Error("Unable to bypass captcha: captchaToken not found");

    const handler =
      (comp.setupState && comp.setupState.onCaptchaVerified) ||
      (comp.ctx && comp.ctx.onCaptchaVerified) ||
      (comp.proxy && comp.proxy.onCaptchaVerified);

    if (typeof handler === "function") {
      handler("e2e-captcha-token");
      return;
    }

    const tokenCandidate =
      (comp.setupState && comp.setupState.captchaToken) ||
      (comp.ctx && comp.ctx.captchaToken) ||
      (comp.proxy && comp.proxy.captchaToken);

    if (tokenCandidate && typeof tokenCandidate === "object" && "value" in tokenCandidate) {
      tokenCandidate.value = "e2e-captcha-token";
      return;
    }

    throw new Error("Unable to bypass captcha");
  });
}

test("expired token redirects protected route to sign_in", async ({ page }) => {
  await installAuthEdgeCaseMocks(page, { scenario: "expired_token" });

  // Set an expired token in localStorage
  await setAuthLocalStorage(page, {
    token: "expired-token",
    userAuth: { id: 9500, role: "client", is_profile_completed: true },
  });

  // Try to access a protected route
  await page.goto("/dashboard");

  // Should be redirected to sign_in since token is expired (401)
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible();
});

test("Google OAuth callback route renders sign-in page", async ({ page }) => {
  await installAuthEdgeCaseMocks(page, { scenario: "default" });

  await page.goto("/auth/google/callback");

  // Should render the sign-in page (same component as SignIn)
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("O continuar con")).toBeVisible();
});

test("sign-in with invalid credentials shows error notification", async ({ page }) => {
  await installAuthEdgeCaseMocks(page, { scenario: "invalid_credentials" });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  // Fill in credentials
  await page.locator("#email").fill("wrong@example.com");
  await page.locator("#password").fill("wrongpass");

  // Bypass captcha
  await bypassCaptcha(page);

  // Click sign in
  await page.getByRole("button", { name: /Iniciar sesión/i }).click();

  // Should show error notification (SweetAlert)
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("inválidas");
});

test("sign-in without captcha shows validation warning", async ({ page }) => {
  await installAuthEdgeCaseMocks(page, { scenario: "default" });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  // Fill email and password but do NOT bypass captcha
  await page.locator("#email").fill("test@example.com");
  await page.locator("#password").fill("password123");

  // Click sign in without captcha verification
  await page.getByRole("button", { name: /Iniciar sesión/i }).click();

  // Should show warning about captcha
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("robot");
});

test("sign-in page shows terms and privacy policy links", async ({ page }) => {
  await installAuthEdgeCaseMocks(page, { scenario: "default" });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  // Should show legal links
  await expect(page.getByText("Condiciones de uso")).toBeVisible();
  await expect(page.getByText("Aviso de privacidad")).toBeVisible();

  // Should show registration link
  await expect(page.getByText("¿Nuevo en G&M?")).toBeVisible();
  await expect(page.getByText("Registrarse.")).toBeVisible();

  // Should show forgot password link
  await expect(page.getByText("¿Olvidaste tu contraseña?")).toBeVisible();
});
