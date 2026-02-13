import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client can create an organization from the empty state", async ({ page }) => {
  const userId = 4200;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "corporate_client",
      is_gym_lawyer: false,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Corporate",
      email: "corp@example.com",
    },
  });

  await page.goto("/organizations_dashboard");

  await expect(page.locator('h1:has-text("Panel Corporativo")')).toBeVisible();

  // Starts with no organizations
  await expect(page.getByText("No tienes organizaciones creadas")).toBeVisible();

  // Stats card should reflect 0
  await expect(page.locator('dt:has-text("Organizaciones") + dd')).toHaveText("0");

  await page.getByRole("button", { name: "Crear Organización" }).click();

  await expect(page.getByRole("heading", { name: "Crear Nueva Organización" })).toBeVisible();

  await page.locator("input#title").fill("Org E2E");
  await page.locator("textarea#description").fill("Descripción organización E2E");

  await page.getByRole("button", { name: "Crear Organización" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Organización creada exitosamente");
  await page.locator(".swal2-confirm").click();

  // Modal should close and new organization should appear
  await expect(page.getByRole("heading", { name: "Crear Nueva Organización" })).toHaveCount(0);
  await expect(page.locator('h3:has-text("Org E2E")')).toBeVisible();

  // Stats updated
  await expect(page.locator('dt:has-text("Organizaciones") + dd')).toHaveText("1");
});
