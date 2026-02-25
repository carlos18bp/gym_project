import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("corporate_client invite member increments pending invitations stat", { tag: ['@flow:org-invite-members', '@module:organizations', '@priority:P1', '@role:corporate'] }, async ({ page }) => {
  const userId = 4400;

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

  await expect(page.locator('h1:has-text("Panel Corporativo")')).toBeVisible();

  // Baseline: 1 pending invitation (from mock org)
  await expect(page.locator('dt:has-text("Invitaciones Pendientes") + dd')).toHaveText("1");

  await page.getByRole("button", { name: "Invitar Miembro" }).click();
  await expect(page.getByText("Invitar Nuevo Miembro")).toBeVisible();

  const inviteDialog = page.locator('[role="dialog"]').filter({ hasText: "Invitar Nuevo Miembro" });
  await inviteDialog.locator("#email").fill("new-client@example.com"); // quality: allow-fragile-selector (stable DOM id)
  await inviteDialog.locator("#message").fill("Mensaje E2E"); // quality: allow-fragile-selector (stable DOM id)

  await inviteDialog.getByRole("button", { name: "Enviar Invitación" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 }); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(page.locator(".swal2-title")).toHaveText("Invitación enviada exitosamente"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (class selector targets stable UI structure)

  await expect(inviteDialog).toHaveCount(0);

  // Stats should be refreshed by the parent handler and reflect +1
  await expect(page.locator('dt:has-text("Invitaciones Pendientes") + dd')).toHaveText("2");
});
