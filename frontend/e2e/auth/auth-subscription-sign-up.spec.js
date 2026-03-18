import { test, expect } from "../helpers/test.js";
import { mockApi } from "../helpers/api.js";
import { bypassCaptcha } from "../helpers/captcha.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

function buildMockUser({ id, role = "client" }) {
  return {
    id,
    first_name: "E2E",
    last_name: "Subscriber",
    email: `sub-${id}@example.com`,
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: true,
    is_gym_lawyer: false,
    has_signature: false,
  };
}

async function installSubscriptionSignUpMocks(page, { userId, signUpResponse = "success" }) {
  const user = buildMockUser({ id: userId });
  const nowIso = new Date().toISOString();
  let isLoggedIn = false;

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    if (apiPath === "google-captcha/verify/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      };
    }

    if (apiPath === "validate_token/") {
      if (isLoggedIn) {
        return { status: 200, contentType: "application/json", body: "{}" };
      }
      return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };
    }

    if (apiPath === "sign_on/send_verification_code/" && route.request().method() === "POST") {
      if (signUpResponse === "email_exists") {
        return {
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "El correo electrónico ya está registrado" }),
        };
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Verification code sent successfully." }),
      };
    }

    if (apiPath === "sign_on/" && route.request().method() === "POST") {
      if (signUpResponse === "invalid_passcode") {
        return {
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "invalid_passcode" }),
        };
      }

      isLoggedIn = true;
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "e2e-access-token", user }),
      };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    }

    if (apiPath === "subscriptions/current/") {
      return { status: 404, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "subscriptions/wompi-config/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ public_key: "pub_test_123", currency: "COP" }),
      };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }),
      };
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

    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}

const alertDialog = (page) => page.getByRole("dialog");

async function dismissAlertIfVisible(page, timeout = 10_000) {
  const confirmButton = page.getByRole("button", { name: /^(ok|aceptar|confirmar|si|sí)$/i });
  if (await confirmButton.isVisible({ timeout }).catch(() => false)) {
    await confirmButton.click();
  }
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll(".swal2-container").forEach((el) => el.remove());
    document.body.classList.remove("swal2-shown", "swal2-height-auto");
    document.querySelectorAll("[aria-hidden]").forEach((el) => el.removeAttribute("aria-hidden"));
  });
}

test("subscription sign-up page renders form with all required fields", { tag: ['@flow:auth-subscription-signup', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 8000;

  await installSubscriptionSignUpMocks(page, { userId });

  await page.goto("/subscription/sign_up?plan=cliente");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Regístrate para completar tu suscripción")).toBeVisible();

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#email")).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#first_name")).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#last_name")).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#password")).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#confirm_password")).toBeVisible();

  await expect(page.getByText("políticas de privacidad")).toBeVisible();
  await expect(page.getByText("Inicia sesión aquí")).toBeVisible();
  await expect(page.getByText("Volver a planes")).toBeVisible();
});

test("subscription sign-up sends verification code and completes registration", { tag: ['@flow:auth-subscription-signup', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 8001;

  await installSubscriptionSignUpMocks(page, { userId });

  await page.goto("/subscription/sign_up?plan=cliente");
  await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible({ timeout: 15_000 });

  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#email").fill("new-user@example.com");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#first_name").fill("Test");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#last_name").fill("User");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#password").fill("SecurePass1!");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#confirm_password").fill("SecurePass1!");

  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#privacy-policy").check();

  await bypassCaptcha(page);

  const registerBtn = page.getByRole("button", { name: "Registrarse" });
  await expect(registerBtn).toBeEnabled({ timeout: 10_000 });
  await registerBtn.click();

  await expect(alertDialog(page)).toBeVisible({ timeout: 10_000 });
  await dismissAlertIfVisible(page);

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#passcode")).toBeVisible({ timeout: 10_000 });

  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#passcode").fill("123456");
  await page.getByRole("button", { name: "Verificar y crear cuenta" }).click();

  // Dismiss success notification so it doesn't block navigation
  await dismissAlertIfVisible(page, 5_000);

  await expect(page).toHaveURL(/checkout/, { timeout: 15_000 });
});

test("subscription sign-up with existing email shows error", { tag: ['@flow:auth-subscription-signup', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 8002;

  await installSubscriptionSignUpMocks(page, { userId, signUpResponse: "email_exists" });

  await page.goto("/subscription/sign_up?plan=basico");
  await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible({ timeout: 15_000 });

  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#email").fill("existing@example.com");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#first_name").fill("Existing");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#last_name").fill("User");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#password").fill("Pass123!");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#confirm_password").fill("Pass123!");

  // quality: allow-fragile-selector (stable application ID)
  await page.locator("#privacy-policy").check();

  await bypassCaptcha(page);

  const registerBtn = page.getByRole("button", { name: "Registrarse" });
  await expect(registerBtn).toBeEnabled({ timeout: 10_000 });
  await registerBtn.click();

  await expect(alertDialog(page)).toContainText("ya está registrado", { timeout: 10_000 });
});
