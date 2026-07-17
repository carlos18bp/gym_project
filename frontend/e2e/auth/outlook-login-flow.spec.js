import { test, expect } from "../helpers/test.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for login_with_outlook.js auth flow (Microsoft/Outlook).
 *
 * Coverage focus:
 * - Existing user login via Microsoft
 * - Login failure handling (rejected token)
 * - New user registration via Microsoft
 *
 * The real Microsoft popup is replaced by the `window.__e2eOutlookAuth` seam in
 * msal_config.js; the backend is mocked at the network layer.
 */

function buildUser({ id, email, firstName, lastName, role, isProfileCompleted }) {
  return {
    id,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    is_profile_completed: isProfileCompleted,
    is_gym_lawyer: role === "lawyer",
    has_signature: role === "lawyer",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
  };
}

const existingUser = buildUser({
  id: 8401,
  email: "ms.lawyer@example.com",
  firstName: "Microsoft",
  lastName: "Lawyer",
  role: "lawyer",
  isProfileCompleted: true,
});

const newUser = buildUser({
  id: 8402,
  email: "new.ms.user@example.com",
  firstName: "New",
  lastName: "User",
  role: "basic",
  isProfileCompleted: false,
});

async function installOutlookAuthMocks(page, { scenario = "existing_user_success" }) {
  const currentUser = scenario === "new_user_success" ? newUser : existingUser;

  // Inject the popup stub before the app loads. Cancellation/failure scenarios
  // still resolve an ID token here; the backend mock decides the outcome.
  await page.addInitScript(() => {
    window.__e2eOutlookAuth = () => Promise.resolve({ idToken: "e2e-ms-id-token" });
  });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "outlook_login/" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON?.() || {};

      if (!payload.id_token) {
        return {
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error_message: "Microsoft ID token is required." }),
        };
      }

      if (scenario === "existing_user_success") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            refresh: "ms-refresh-existing",
            access: "ms-access-token-existing",
            user: existingUser,
            created: false,
          }),
        };
      }

      if (scenario === "new_user_success") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            refresh: "ms-refresh-new",
            access: "ms-access-token-new-user",
            user: newUser,
            created: true,
          }),
        };
      }

      return {
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error_message: "No se pudo verificar el correo de tu cuenta de Microsoft.",
        }),
      };
    }

    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([currentUser]) };
    }

    if (apiPath === `users/${currentUser.id}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(currentUser) };
    }

    if (apiPath === `users/${currentUser.id}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: currentUser.has_signature }),
      };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: new Date().toISOString() }),
      };
    }

    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "processes/") {
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

async function triggerOutlookLogin(page) {
  const button = page.getByTestId("outlook-login-button");
  await expect(button).toBeVisible({ timeout: 15_000 });
  await button.click();
}

test.describe.configure({ timeout: 90_000 });

test("outlook login signs in existing user and redirects to dashboard", { tag: ['@flow:auth-login-outlook', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installOutlookAuthMocks(page, { scenario: "existing_user_success" });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  await triggerOutlookLogin(page);

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 15_000 })
    .toBe("ms-access-token-existing");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.email).toBe("ms.lawyer@example.com");
  expect(userAuth.role).toBe("lawyer");

  await expect
    .poll(() => page.evaluate(() => window.location.pathname), { timeout: 45_000 })
    .toBe("/dashboard");
});

test("outlook login failure shows error and keeps user on sign in", { tag: ['@flow:auth-login-outlook', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installOutlookAuthMocks(page, { scenario: "login_failure" });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  await triggerOutlookLogin(page);

  const errorDialog = page.locator(".swal2-popup"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(errorDialog).toBeVisible({ timeout: 15_000 });
  await expect(errorDialog).toContainText("Error durante el inicio de sesión con Microsoft");

  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  await expect(page).toHaveURL(/\/sign_in/);
});

test("outlook login from sign on stores new user session and redirects", { tag: ['@flow:auth-login-outlook', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installOutlookAuthMocks(page, { scenario: "new_user_success" });

  await page.goto("/sign_on");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 15_000 });

  await triggerOutlookLogin(page);

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 15_000 })
    .toBe("ms-access-token-new-user");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.email).toBe("new.ms.user@example.com");
  expect(userAuth.is_profile_completed).toBe(false);

  await expect
    .poll(() => page.evaluate(() => window.location.pathname), { timeout: 45_000 })
    .toBe("/dashboard");
});
