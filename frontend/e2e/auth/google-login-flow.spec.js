import { test, expect } from "../helpers/test.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for login_with_google.js auth flow.
 *
 * Coverage focus:
 * - Existing user login via Google
 * - Login failure handling
 * - New user registration via Google
 */

function buildGoogleUser({ id, email, firstName, lastName, role, isProfileCompleted }) {
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

async function installGoogleAuthMocks(page, { scenario = "existing_user_success" }) {
  const existingUser = buildGoogleUser({
    id: 7301,
    email: "google.lawyer@example.com",
    firstName: "Google",
    lastName: "Lawyer",
    role: "lawyer",
    isProfileCompleted: true,
  });

  const newUser = buildGoogleUser({
    id: 7302,
    email: "new.google.user@example.com",
    firstName: "New",
    lastName: "User",
    role: "basic",
    isProfileCompleted: false,
  });

  const currentUser = scenario === "new_user_success" ? newUser : existingUser;
  const contactUser = buildGoogleUser({
    id: 7303,
    email: "contact.user@example.com",
    firstName: "Contact",
    lastName: "User",
    role: "client",
    isProfileCompleted: true,
  });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "google_login/" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON?.() || {};

      if (!payload.credential) {
        return {
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error_message: "Google credential is required." }),
        };
      }

      if (scenario === "existing_user_success") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            refresh: "google-refresh-token-existing",
            access: "google-access-token-existing",
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
            refresh: "google-refresh-token-new",
            access: "google-access-token-new-user",
            user: newUser,
            created: true,
          }),
        };
      }

      return {
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error_message: "Invalid Google token." }),
      };
    }

    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([currentUser, contactUser]),
      };
    }

    if (apiPath === `users/${currentUser.id}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentUser),
      };
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

async function triggerGoogleLogin(page, credential = "e2e-google-credential") {
  await page.evaluate((googleCredential) => {
    const element = document.querySelector("#email") || document.querySelector("form");
    let component = element && element.__vueParentComponent;

    while (
      component &&
      !(
        (component.setupState && typeof component.setupState.handleLoginWithGoogle === "function") ||
        (component.ctx && typeof component.ctx.handleLoginWithGoogle === "function") ||
        (component.proxy && typeof component.proxy.handleLoginWithGoogle === "function")
      )
    ) {
      component = component.parent;
    }

    if (!component) {
      throw new Error("Unable to find Google login handler");
    }

    const handler =
      (component.setupState && component.setupState.handleLoginWithGoogle) ||
      (component.ctx && component.ctx.handleLoginWithGoogle) ||
      (component.proxy && component.proxy.handleLoginWithGoogle);

    handler({ credential: googleCredential });
  }, credential);
}

test.describe.configure({ timeout: 90_000 });

test("google login signs in existing user and redirects to dashboard", async ({ page }) => {
  await installGoogleAuthMocks(page, { scenario: "existing_user_success" });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  await triggerGoogleLogin(page);

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 15_000 })
    .toBe("google-access-token-existing");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.email).toBe("google.lawyer@example.com");
  expect(userAuth.role).toBe("lawyer");

  await expect
    .poll(() => page.evaluate(() => window.location.pathname), { timeout: 45_000 })
    .toBe("/dashboard");
});

test("google login failure shows error and keeps user on sign in", async ({ page }) => {
  await installGoogleAuthMocks(page, { scenario: "login_failure" });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  await triggerGoogleLogin(page, "invalid-google-credential");

  const errorDialog = page.locator(".swal2-popup");
  await expect(errorDialog).toBeVisible({ timeout: 15_000 });
  await expect(errorDialog).toContainText("Error durante el inicio de sesión");

  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  await expect(page).toHaveURL(/\/sign_in/);
});

test("google login from sign on stores new user session and redirects", async ({ page }) => {
  await installGoogleAuthMocks(page, { scenario: "new_user_success" });

  await page.goto("/sign_on");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 15_000 });

  await triggerGoogleLogin(page);

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 15_000 })
    .toBe("google-access-token-new-user");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.email).toBe("new.google.user@example.com");
  expect(userAuth.is_profile_completed).toBe(false);

  await expect
    .poll(() => page.evaluate(() => window.location.pathname), { timeout: 45_000 })
    .toBe("/dashboard");
});
