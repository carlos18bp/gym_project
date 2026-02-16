import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client can use 'Ver Detalles' to highlight organization posts section", async ({ page }) => {
  const userId = 3700;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "client",
      is_gym_lawyer: false,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Client",
      email: "client@example.com",
    },
  });

  await page.goto("/organizations_dashboard");
  await page.waitForLoadState("networkidle");

  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();

  const organizationCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await expect(organizationCard).toBeVisible();

  // Ensure we're scrolled away from the posts section so the click must scroll back to it.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.wheel(0, 1400);

  const scrollBefore = await page.evaluate(() => window.scrollY);

  await organizationCard.getByRole("button", { name: "Ver Detalles" }).click();

  // The dashboard adds a highlight ring for 2 seconds.
  const highlighted = page
    .locator(".ring-2.ring-blue-500.ring-offset-2")
    .filter({ hasText: "Acme Corp" })
    .first();
  await expect(highlighted).toBeVisible({ timeout: 3_000 });
  await expect(highlighted).toContainText("Acme Corp");

  // Wait for smooth scroll to have an effect.
  await expect.poll(async () => {
    const y = await page.evaluate(() => window.scrollY);
    if (scrollBefore === 0) return true;
    return y < scrollBefore;
  }).toBeTruthy();

  // Ensure the highlighted element is at least partially in the viewport.
  await expect.poll(async () => {
    return highlighted.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
  }).toBeTruthy();
});
