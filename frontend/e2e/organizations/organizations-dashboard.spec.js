import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("corporate client can load organizations dashboard and invite a member", { tag: ['@flow:org-store-actions', '@module:organizations', '@priority:P3', '@role:shared'] }, async ({ page }) => {
  const userId = 2100;

  await installOrganizationsDashboardApiMocks(page, { userId, role: "corporate_client" });

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
  await expect(page).toHaveURL(/\/organizations_dashboard/);

  // Basic smoke for the page
  await expect(page.getByRole("heading", { name: "Organizaciones", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Panel Corporativo" })).toBeVisible();

  // Ensure the mock organization is rendered
  await expect(page.getByRole("heading", { name: "Acme Corp" })).toBeVisible();

  // Open invite modal
  await page.getByRole("button", { name: "Invitar Miembro" }).click();
  await expect(page.getByText("Invitar Nuevo Miembro")).toBeVisible();

  const inviteDialog = page.locator('[role="dialog"]').filter({ hasText: "Invitar Nuevo Miembro" });
  await inviteDialog.locator("#email").fill("client@example.com"); // quality: allow-fragile-selector (stable DOM id)

  await inviteDialog.getByRole("button", { name: "Enviar Invitación" }).click();

  // SweetAlert2 success
  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 }); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(page.locator(".swal2-title")).toHaveText("Invitación enviada exitosamente"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (class selector targets stable UI structure)

  // The parent component closes the invite modal when the invitation is created.
  await expect(inviteDialog).toHaveCount(0);
  await expect(page.locator('button:has-text("Invitar Miembro")').first()).toBeVisible(); // quality: allow-fragile-selector (positional selector for first matching element)
});
