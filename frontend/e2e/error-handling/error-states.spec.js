import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import { bypassCaptcha } from "../helpers/captcha.js";
import { installForgetPasswordApiMocks } from "../helpers/forgetPasswordMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for error handling and error states.
 *
 * Every scenario drives the form that produces the failing request, so the
 * assertion is on what the user sees *after* the API answers (notification,
 * cleared field, retry succeeding) rather than on a pre-rendered page.
 */

function buildMockUser({ id, role }) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: "e2e@example.com",
    role,
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
  };
}

/**
 * Sign-in mocks with a configurable failure status. The session is stateful:
 * validate_token only succeeds once sign_in has returned 200.
 */
async function installSignInMocks(page, { signInStatus = 200, userId = 4200 } = {}) {
  const user = buildMockUser({ id: userId, role: "lawyer" });
  const nowIso = new Date().toISOString();
  let isLoggedIn = false;

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "google-captcha/verify/") return { status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) };

    if (apiPath === "validate_token/") {
      if (isLoggedIn) return { status: 200, contentType: "application/json", body: "{}" };
      return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };
    }

    if (apiPath === "sign_in/" && route.request().method() === "POST") {
      if (signInStatus !== 200) {
        return { status: signInStatus, contentType: "application/json", body: JSON.stringify({ detail: "request rejected" }) };
      }
      isLoggedIn = true;
      return { status: 200, contentType: "application/json", body: JSON.stringify({ access: "e2e-recovered-token", user }) };
    }

    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

async function fillSignInForm(page) {
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="email"]').fill("e2e@example.com");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="password"]').fill("SecurePass1!");
  await bypassCaptcha(page);
}

test.describe("error handling: 404 not found", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, () => {
  test("non-existent route shows 404 or redirects", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    // audit: load-only flow (router catch-all guard: loading the unknown URL is
    // itself the behaviour under test)
    await page.goto("/non-existent-page-xyz");

    await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible();
  });

  test("unknown email on the password reset form surfaces the 404 error", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await installForgetPasswordApiMocks(page, { sendPasscodeStatus: 404 });

    await page.goto("/forget_password");
    await expect(page.getByRole("heading", { name: "No te preocupes, vamos ayudarte" })).toBeVisible({ timeout: 15_000 });

    // quality: allow-fragile-selector (stable application ID)
    await page.locator('[id="email"]').fill("ghost-user@example.com");
    await bypassCaptcha(page);
    await page.getByRole("button", { name: /Enviar código/ }).click();

    // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Usuario no encontrado", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/forget_password/);
  });
});

test.describe("error handling: 401 unauthorized", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, () => {
  test("expired token redirects to login", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 4010;
    const user = buildMockUser({ id: userId, role: "lawyer" });

    await mockApi(page, async ({ route, apiPath }) => {
      // Return 401 for token validation
      if (apiPath === "validate_token/") {
        return { status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Token expired" }) };
      }

      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

      return null;
    });

    await setAuthLocalStorage(page, {
      token: "expired-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    // audit: load-only flow (route guard: the redirect on load is the behaviour)
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible();
  });

  test("missing token redirects to login", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    // audit: load-only flow (route guard: the redirect on load is the behaviour)
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible();
  });
});

test.describe("error handling: 403 forbidden", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, () => {
  test("sign-in forbidden by the API shows the generic error notification", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await installSignInMocks(page, { signInStatus: 403, userId: 4020 });

    await page.goto("/sign_in");
    await fillSignInForm(page);

    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // 403 is neither 401 nor 400, so the catch-all branch is what the user sees
    // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Error en el inicio de sesión", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/sign_in/);
    expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  });
});

test.describe("error handling: 500 server error", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, () => {
  test("sign-in answered with 500 clears the password and keeps the form usable", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await installSignInMocks(page, { signInStatus: 500, userId: 4030 });

    await page.goto("/sign_in");
    await fillSignInForm(page);

    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Error en el inicio de sesión", { timeout: 10_000 });

    // The failed attempt wipes the password so the user must retype it
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator('[id="password"]')).toHaveValue("");
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator('[id="email"]')).toHaveValue("e2e@example.com");
  });
});

test.describe("error handling: network errors", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, () => {
  test("dropped sign-in request shows the error and stores no session", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await installSignInMocks(page, { userId: 4040 });
    // Registered after the base mocks so it wins: the transport itself fails.
    await page.route("**/api/sign_in/", (route) => route.abort("failed"));

    await page.goto("/sign_in");
    await fillSignInForm(page);

    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Error en el inicio de sesión", { timeout: 10_000 });
    expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
    await expect(page).toHaveURL(/\/sign_in/);
  });

  test("app recovers from temporary network failure", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await installSignInMocks(page, { userId: 4041 });
    // Only the first submission is dropped; the retry reaches the API.
    await page.route("**/api/sign_in/", (route) => route.abort("failed"), { times: 1 });

    await page.goto("/sign_in");
    await fillSignInForm(page);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
    const errorPopup = page.locator('[class~="swal2-popup"]');
    await expect(errorPopup).toContainText("Error en el inicio de sesión", { timeout: 10_000 });
    // quality: allow-fragile-selector (SweetAlert2 confirm button, precedent in suite)
    await page.locator('[class~="swal2-confirm"]').click();
    await expect(errorPopup).toBeHidden();

    // The user retypes the wiped password and submits again — now it goes through
    // quality: allow-fragile-selector (stable application ID)
    await page.locator('[id="password"]').fill("SecurePass1!");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem("token"))).toBe("e2e-recovered-token");
  });
});

test.describe("error handling: form validation errors", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, () => {
  test("form shows validation errors for invalid input", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await mockApi(page, async ({ apiPath }) => {
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
      if (apiPath === "validate_token/") return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };
      return null;
    });

    await page.goto("/sign_in");
    await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

    // Submitting the empty form surfaces the client-side validation error
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Email is required", { timeout: 10_000 });

    // The user stays on the sign-in page
    await expect(page).toHaveURL(/\/sign_in/);
  });

  test("form shows server validation errors", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await mockApi(page, async ({ route, apiPath }) => {
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
      if (apiPath === "google-captcha/verify/") return { status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) };
      if (apiPath === "validate_token/") return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };

      // Reject the credentials at the API boundary
      if (apiPath === "sign_in/" && route.request().method() === "POST") {
        return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "Credenciales inválidas" }) };
      }

      return null;
    });

    await page.goto("/sign_in");
    await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

    // Fill in invalid credentials and submit
    // quality: allow-fragile-selector (stable application ID)
    await page.locator('[id="email"]').fill("invalid@example.com");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator('[id="password"]').fill("wrongpassword");
    await bypassCaptcha(page);

    const submitBtn = page.getByRole("button", { name: "Iniciar sesión" });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // The 401 surfaces the invalid-credentials notification and the user
    // remains on the sign-in page
    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Credenciales inválidas", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/sign_in/);
  });
});

test.describe("error handling: timeout errors", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, () => {
  test("slow sign-in response keeps the submit button in its loading state", { tag: ['@flow:misc-error-handling', '@module:misc', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const slowResponse = { access: "e2e-recovered-token", user: buildMockUser({ id: 4200, role: "lawyer" }) };

    await installSignInMocks(page, { userId: 4200 });
    // The session becomes valid as soon as the delayed sign-in answers, so the
    // dashboard guard lets the user through.
    await page.route("**/api/validate_token/", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    );
    // Hold the answer back so the in-flight UI state is observable.
    await page.route("**/api/sign_in/", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(slowResponse),
      });
    });

    await page.goto("/sign_in");
    await fillSignInForm(page);

    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // While the request is in flight the button reports progress and is locked
    const submitButton = page.getByRole("button", { name: "Validando credenciales..." });
    await expect(submitButton).toBeVisible({ timeout: 5_000 });
    await expect(submitButton).toBeDisabled();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });
});
