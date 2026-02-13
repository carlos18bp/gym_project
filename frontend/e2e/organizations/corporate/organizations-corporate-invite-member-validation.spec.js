import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client invite member: validation error shows inline and stats do not change", async ({ page }) => {
  test.setTimeout(60_000);

  const userId = 4900;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
    sentInvitationScenario: "validation_error",
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

  const pendingInvitesStat = page.locator('dt:has-text("Invitaciones Pendientes") + dd');
  await expect(pendingInvitesStat).toHaveText("1");

  await page.getByRole("button", { name: "Invitar Miembro" }).click();
  const inviteDialog = page.locator('[role="dialog"]').filter({ hasText: "Invitar Nuevo Miembro" });
  await expect(page.getByRole("heading", { name: "Invitar Nuevo Miembro" })).toBeVisible();

  // Must be syntactically valid to avoid native HTML5 validation blocking submit
  await inviteDialog.locator("#email").fill("bad-email@example.com");
  await inviteDialog.getByRole("button", { name: "Enviar Invitación" }).click();

  // Error should be rendered under the email field
  await expect(inviteDialog.getByText("Email del cliente no válido")).toBeVisible();

  // No success SweetAlert
  await expect(page.locator(".swal2-title")).toHaveCount(0);

  // Stats should not change
  await expect(pendingInvitesStat).toHaveText("1");
});
