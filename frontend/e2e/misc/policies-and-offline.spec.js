import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * Minimal mock for pages that don't require auth or heavy API interaction.
 */
async function installMinimalMocks(page) {
  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "validate_token/") return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };
    return null;
  });
}

test("privacy policy page renders with correct heading and content sections", async ({ page }) => {
  await installMinimalMocks(page);

  await page.goto("/policies/privacy_policy");
  await page.waitForLoadState("domcontentloaded");

  // Main heading
  await expect(page.getByText("Política de Privacidad").first()).toBeVisible({ timeout: 15_000 });

  // Content sections
  await expect(page.getByText("Introducción").first()).toBeVisible();
  await expect(page.getByText("G&M Consultores Juridicos SAS")).toBeVisible();
});

test("no connection page renders offline message", async ({ page }) => {
  await installMinimalMocks(page);

  await page.goto("/no_connection");

  await expect(page.getByRole("heading", { name: "¡Parece que no hay internet!" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Revisa tu conexión para seguir navegando")).toBeVisible();
});
