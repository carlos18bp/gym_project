import { test, expect } from "../helpers/test.js";
import { installAuthSignInApiMocks } from "../helpers/authSignInMocks.js";
import { setAuthLocalStorage } from "../helpers/auth.js";

test("authenticated user can sign out and is redirected to sign_in", async ({ page }) => {
  const userId = 3000;

  await installAuthSignInApiMocks(page, {
    userId,
    role: "lawyer",
    signInStatus: 200,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Open HeadlessUI user menu dropdown (MenuButton with user name)
  const userMenuButton = page.getByRole("button", { name: /Open user menu|E2E Lawyer/i });
  await userMenuButton.click();

  // Click "Cerrar sesión" in the dropdown
  const signOutLink = page.getByText("Cerrar sesión");
  await expect(signOutLink).toBeVisible({ timeout: 5_000 });
  await signOutLink.click();

  // After sign out, should be on sign_in page
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });

  // Token should be cleared
  const token = await page.evaluate(() => localStorage.getItem("token"));
  expect(token === null || token === "null").toBeTruthy();
});

test("unauthenticated user accessing protected route is redirected to sign_in", async ({ page }) => {
  // Mock API to return 401 for token validation
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const apiPath = url.pathname.replace(/^\/api\//, "");

    if (apiPath === "validate_token/") {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      });
    }

    if (apiPath === "google-captcha/site-key/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  // Set an expired/invalid token
  await setAuthLocalStorage(page, {
    token: "expired-token",
    userAuth: { id: 999, role: "client" },
  });

  await page.goto("/dashboard");

  // Should be redirected to sign_in because token validation fails
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
});
