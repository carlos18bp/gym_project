import { test, expect } from "../helpers/test.js";

import { mockApi } from "../helpers/api.js";

async function installAuthMocks(page) {
  await mockApi(page, async ({ apiPath }) => {
    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }
    return null;
  });
}

test.describe("auth: sign in page", () => {
  test("sign in page displays login form", async ({ page }) => {
    await installAuthMocks(page);
    
    await page.goto("/sign_in");
    await page.waitForLoadState("networkidle");

    // Should see sign in page with form elements
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("sign in page has email input", async ({ page }) => {
    await installAuthMocks(page);
    
    await page.goto("/sign_in");
    await page.waitForLoadState("networkidle");

    // Email input should be present
    const emailInput = page.getByPlaceholder("Correo").or(page.locator('input[type="email"]')).or(page.getByLabel("Email"));
    await expect(emailInput).toBeVisible();
  });

  test("sign in page has password input", async ({ page }) => {
    await installAuthMocks(page);
    
    await page.goto("/sign_in");
    await page.waitForLoadState("networkidle");

    // Password input should be present
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
  });

  test("sign in page has submit button", async ({ page }) => {
    await installAuthMocks(page);
    
    await page.goto("/sign_in");
    await page.waitForLoadState("networkidle");

    // Submit button should be present
    const submitBtn = page.getByRole("button", { name: "Iniciar" }).or(page.getByRole("button", { name: "Ingresar" })).or(page.locator('button[type="submit"]'));
    await expect(submitBtn).toBeVisible();
  });

  test("sign in page loads successfully", async ({ page }) => {
    await installAuthMocks(page);
    
    await page.goto("/sign_in");
    await page.waitForLoadState("networkidle");

    // Page should load with form elements
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});
