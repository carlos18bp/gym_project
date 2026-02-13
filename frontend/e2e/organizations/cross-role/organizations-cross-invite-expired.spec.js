import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate sends expired invitation and client cannot accept/reject", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4720;
  const clientUserId = 4721;
  const clientEmail = "expired-client@example.com";

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    startWithOrganizations: true,
    clientUserId,
    clientUserEmail: clientEmail,
    startWithClientMemberships: false,
    sentInvitationScenario: "expired",
  });

  // Step 1: corporate sends invitation
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: corporateUserId,
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
  await expect(page.getByText("Invitar Nuevo Miembro")).toBeVisible();

  const inviteDialog = page.locator('[role="dialog"]').filter({ hasText: "Invitar Nuevo Miembro" });
  await inviteDialog.locator("#email").fill(clientEmail);
  await inviteDialog.locator("#message").fill("Invitación expirada E2E");

  await inviteDialog.getByRole("button", { name: "Enviar Invitación" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Invitación enviada exitosamente");
  await page.locator(".swal2-confirm").click();

  // Still increments pending in current behavior
  await expect(pendingInvitesStat).toHaveText("2");

  // Step 2: client sees invitation as expired (no accept/reject)
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: clientUserId,
      role: "client",
      is_gym_lawyer: false,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Client",
      email: clientEmail,
    },
  });

  await page.goto("/organizations_dashboard");
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();

  const invitationsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Invitaciones")');
  await expect(invitationsTab).toContainText("1");

  await invitationsTab.click();
  await expect(page.locator('h2:has-text("Invitaciones Recibidas")')).toBeVisible();

  const invitationCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await expect(invitationCard).toBeVisible();

  // Should be expired and not allow responding
  await expect(invitationCard.getByText("Esta invitación ha expirado")).toBeVisible();
  await expect(invitationCard.getByRole("button", { name: "Aceptar" })).toHaveCount(0);
  await expect(invitationCard.getByRole("button", { name: "Rechazar" })).toHaveCount(0);

  // Client did not gain membership
  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")').click();
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();
});
