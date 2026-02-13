import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate invites client, client rejects, corporate pending decrements and client gains no membership", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4710;
  const clientUserId = 4711;
  const clientEmail = "new-client@example.com";

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    startWithOrganizations: true,
    clientUserId,
    clientUserEmail: clientEmail,
    startWithClientMemberships: false,
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
  const totalMembersStat = page.locator('dt:has-text("Miembros Totales") + dd');

  await expect(pendingInvitesStat).toHaveText("1");
  await expect(totalMembersStat).toHaveText("2");

  await page.getByRole("button", { name: "Invitar Miembro" }).click();
  await expect(page.getByText("Invitar Nuevo Miembro")).toBeVisible();

  const inviteDialog = page.locator('[role="dialog"]').filter({ hasText: "Invitar Nuevo Miembro" });
  await inviteDialog.locator("#email").fill(clientEmail);
  await inviteDialog.locator("#message").fill("Invitación E2E");

  await inviteDialog.getByRole("button", { name: "Enviar Invitación" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Invitación enviada exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(pendingInvitesStat).toHaveText("2");

  // Step 2: client rejects invitation
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
  await expect(invitationCard.getByRole("button", { name: "Rechazar" })).toBeVisible();

  await invitationCard.getByRole("button", { name: "Rechazar" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Invitación rechazada exitosamente");
  await page.locator(".swal2-confirm").click();

  // Invitation is no longer pending and no accept/reject actions remain
  await expect(invitationCard.locator('span:has-text("Rechazada")')).toBeVisible();
  await expect(invitationCard.getByRole("button", { name: "Aceptar" })).toHaveCount(0);
  await expect(invitationCard.getByRole("button", { name: "Rechazar" })).toHaveCount(0);
  await expect(invitationsTab).toContainText("0");

  // Client did NOT gain membership
  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")').click();
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();
  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toHaveCount(0);

  const newRequestButton = page.getByRole("button", { name: "Nueva Solicitud" }).first();
  await expect(newRequestButton).toBeDisabled();

  // Step 3: back to corporate and verify pending decremented and members unchanged
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

  await expect(pendingInvitesStat).toHaveText("1");
  await expect(totalMembersStat).toHaveText("2");

  // Ensure rejected client is not listed as a member
  await page.getByRole("button", { name: /Miembros Totales/ }).click();
  const allMembersDialog = page.locator('[role="dialog"]').filter({ hasText: "Todos los Miembros" });
  await expect(allMembersDialog).toHaveCount(1);
  await expect(allMembersDialog.getByText(clientEmail, { exact: true })).toHaveCount(0);
});
