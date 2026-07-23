import { test, expect } from "../../helpers/test.js";
import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("corporate client sees organization dashboard with management options", { tag: ['@flow:org-create', '@module:organizations', '@priority:P1', '@role:corporate'] }, async ({ page }) => {
  const userId = 9300;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "corporate_client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations_dashboard");
  await expect(page.getByRole("heading", { name: "Panel Corporativo", level: 1 })).toBeVisible({ timeout: 15_000 });

  // The organization card renders with its management actions
  await expect(page.getByRole("heading", { name: "Acme Corp" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invitar Miembro" })).toBeVisible();
});

test("corporate client can access organization settings area", { tag: ['@flow:org-edit', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
  const userId = 9301;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "corporate_client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations_dashboard");
  await expect(page.getByRole("heading", { name: "Panel Corporativo", level: 1 })).toBeVisible({ timeout: 15_000 });

  // The Editar button opens the settings modal pre-filled with the org data
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Editar Organización" })).toBeVisible({ timeout: 10_000 });
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#title")).toHaveValue("Acme Corp");
});
