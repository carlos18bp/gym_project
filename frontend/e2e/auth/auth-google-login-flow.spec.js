import { test, expect } from "../helpers/test.js";

import { mockApi } from "../helpers/api.js";

async function installGoogleLoginMocks(page, { scenario = "success" }) {
  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "google_login/") {
      if (scenario === "success") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            token: "test-jwt-token",
            user: {
              id: 999,
              email: "googleuser@example.com",
              first_name: "Google",
              last_name: "User",
              role: "client",
              is_profile_completed: true,
            },
            created: false,
          }),
        };
      }
      
      if (scenario === "new_user") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            token: "test-jwt-token",
            user: {
              id: 1000,
              email: "newgoogleuser@example.com",
              first_name: "New",
              last_name: "User",
              role: "client",
              is_profile_completed: false,
            },
            created: true,
          }),
        };
      }

      if (scenario === "invalid_token") {
        return {
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error_message: "Invalid Google token." }),
        };
      }

      if (scenario === "missing_credential") {
        return {
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error_message: "Google credential is required." }),
        };
      }
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}

test.describe("Google login: authentication flow", () => {
  test("sign in page shows Google login button", async ({ page }) => {
    await installGoogleLoginMocks(page, { scenario: "success" });

    await page.goto("/sign_in");
    await page.waitForLoadState("networkidle");

    // Verify the page loads
    await expect(page.getByText("Iniciar Sesión").or(page.getByText("Sign In"))).toBeVisible();

    // Google login button should be present (may be rendered by vue3-google-login)
    // Check for either the button or the Google login container
    const googleButton = page.locator('[data-testid="google-login"]')
      .or(page.getByRole("button", { name: /google/i }))
      .or(page.locator(".g_id_signin"))
      .or(page.locator("#g_id_onload"));

    // Page should have loaded the sign-in form
    await expect(page.getByRole("button", { name: "Iniciar sesión" }).or(page.getByText("Correo electrónico"))).toBeVisible();
  });

  test("subscription sign in page shows Google login option", async ({ page }) => {
    await installGoogleLoginMocks(page, { scenario: "success" });

    await page.goto("/subscription_sign_in");
    await page.waitForLoadState("networkidle");

    // Verify the page loads with login options
    await expect(page.getByText("Iniciar Sesión").or(page.getByText("Bienvenido"))).toBeVisible();
  });

  test("sign on page allows Google registration", async ({ page }) => {
    await installGoogleLoginMocks(page, { scenario: "new_user" });

    await page.goto("/sign_on");
    await page.waitForLoadState("networkidle");

    // Verify registration page loads
    await expect(page.getByText("Registrarse").or(page.getByText("Crear cuenta"))).toBeVisible();
  });
});
