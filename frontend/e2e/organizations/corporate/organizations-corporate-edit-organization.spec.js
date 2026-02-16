import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client can edit an organization", async ({ page }) => {
  const userId = 4300;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
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
  await page.waitForLoadState("networkidle");

  await expect(page.locator('h1:has-text("Panel Corporativo")')).toBeVisible();
  await expect(page.locator('h3:has-text("Acme Corp")')).toBeVisible();

  // Open edit modal from the organization header
  const orgCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await orgCard.getByRole("button", { name: "Editar" }).click();

  await expect(page.getByRole("heading", { name: "Editar Organización" })).toBeVisible();

  await page.locator("input#title").fill("Acme Corp Editada");
  await page.locator("textarea#description").fill("Descripción editada E2E");
  await page.locator("input#inactive").check();

  await page.getByRole("button", { name: "Guardar Cambios" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Organización actualizada exitosamente");
  await page.locator(".swal2-confirm").click();

  // Modal should close and card should reflect changes
  await expect(page.getByRole("heading", { name: "Editar Organización" })).toHaveCount(0);
  await expect(page.locator('h3:has-text("Acme Corp Editada")')).toBeVisible();
  await expect(page.getByText("Descripción editada E2E")).toBeVisible();
});
