import { test, expect } from "../helpers/test.js";
import { mockApi } from "../helpers/api.js";
import { bypassCaptcha } from "../helpers/captcha.js";

function buildMockUser({ id, role }) {
  return {
    id,
    first_name: "E2E",
    last_name: "User",
    email: "e2e@example.com",
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: false,
    has_signature: false,
  };
}

async function installSubscriptionSignInMocks(page, { signInResponse = "success", userId = 900 } = {}) {
  const me = buildMockUser({ id: userId, role: "client" });
  const nowIso = new Date().toISOString();
  let isLoggedIn = false;

  await mockApi(page, async ({ route, apiPath }) => {
    // Captcha site key
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    // Captcha verify
    if (apiPath === "google-captcha/verify/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      };
    }

    // Token validation — starts unauthenticated, becomes valid after login
    if (apiPath === "validate_token/") {
      if (isLoggedIn) {
        return { status: 200, contentType: "application/json", body: "{}" };
      }
      return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };
    }

    // Sign in
    if (apiPath === "sign_in/") {
      if (signInResponse === "success") {
        isLoggedIn = true;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access: "e2e-token-new",
            user: me,
          }),
        };
      }
      if (signInResponse === "invalid_credentials") {
        return {
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Credenciales inválidas" }),
        };
      }
    }

    // Users (needed after login for dashboard redirect)
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([me]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(me) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }

    // Subscriptions (for checkout page after redirect)
    if (apiPath === "subscriptions/current/") {
      return { status: 404, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "subscriptions/wompi-config/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ public_key: "pub_test_key" }) };
    }

    // Dashboard auxiliary
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "create-activity/") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };
    }
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}

test("subscription sign-in page renders form with email, password, and plan link", async ({ page }) => {
  await installSubscriptionSignInMocks(page);

  await page.goto("/subscription/sign_in?plan=cliente");

  // Page heading
  await expect(page.getByRole("heading", { name: "Inicia sesión para continuar" })).toBeVisible({ timeout: 15_000 });

  // Form fields
  await expect(page.locator('[id="email"]')).toBeVisible();
  await expect(page.locator('[id="password"]')).toBeVisible();

  // Submit button
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();

  // "Volver a planes" link
  await expect(page.getByText("Volver a planes")).toBeVisible();

  // "¿No tienes cuenta?" registration link
  await expect(page.getByText("¿No tienes cuenta?")).toBeVisible();
  await expect(page.getByText("Regístrate aquí")).toBeVisible();
});

test("user signs in successfully and is redirected to checkout", async ({ page }) => {
  const userId = 901;

  await installSubscriptionSignInMocks(page, { signInResponse: "success", userId });

  await page.goto("/subscription/sign_in?plan=basico");

  await expect(page.locator('[id="email"]')).toBeVisible({ timeout: 15_000 });

  // Fill credentials
  await page.locator('[id="email"]').fill("e2e@example.com");
  await page.locator('[id="password"]').fill("Password123!");

  // Bypass captcha verification
  await bypassCaptcha(page, { rootSelector: '[id="email"]' });

  // Submit
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // Should show success notification
  const successDialog = page.locator('[class~="swal2-popup"]');
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText("exitoso");
  await page.locator('[class~="swal2-confirm"]').click();

  // Should redirect to checkout with the plan
  await expect(page).toHaveURL(/checkout/, { timeout: 15_000 });
});

test("user sees error notification on invalid credentials", async ({ page }) => {
  const userId = 902;

  await installSubscriptionSignInMocks(page, { signInResponse: "invalid_credentials", userId });

  await page.goto("/subscription/sign_in?plan=cliente");

  await expect(page.locator('[id="email"]')).toBeVisible({ timeout: 15_000 });

  // Fill invalid credentials
  await page.locator('[id="email"]').fill("wrong@example.com");
  await page.locator('[id="password"]').fill("WrongPassword!");

  // Bypass captcha
  await bypassCaptcha(page, { rootSelector: '[id="email"]' });

  // Submit
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // Should show error notification about invalid credentials
  const errorDialog = page.locator('[class~="swal2-popup"]');
  await expect(errorDialog).toBeVisible({ timeout: 15_000 });
  await expect(errorDialog).toContainText(/inválidas|error/i);
  await page.locator('[class~="swal2-confirm"]').click();

  // Should remain on sign-in page (not redirected)
  await expect(page).toHaveURL(/\/subscription\/sign_in/);
  await expect(page.locator('[id="email"]')).toBeVisible();
});
