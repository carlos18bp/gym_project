import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate invites client, client accepts, corporate stats and members update", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4700;
  const clientUserId = 4701;

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    startWithOrganizations: true,
    clientUserId,
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

  // Baseline pending invitations (from seed org)
  const pendingInvitesStat = page.locator('dt:has-text("Invitaciones Pendientes") + dd');
  await expect(pendingInvitesStat).toHaveText("1");

  await page.getByRole("button", { name: "Invitar Miembro" }).click();
  await expect(page.getByText("Invitar Nuevo Miembro")).toBeVisible();

  const inviteDialog = page.locator('[role="dialog"]').filter({ hasText: "Invitar Nuevo Miembro" });
  await inviteDialog.locator("#email").fill("client@example.com");
  await inviteDialog.locator("#message").fill("Invitación E2E");

  await inviteDialog.getByRole("button", { name: "Enviar Invitación" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Invitación enviada exitosamente");
  await page.locator(".swal2-confirm").click();

  // Corporate stats should be refreshed by handler
  await expect(pendingInvitesStat).toHaveText("2");

  // Step 2: client sees invitation and accepts
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: clientUserId,
      role: "client",
      is_gym_lawyer: false,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Client",
      email: "client@example.com",
    },
  });

  await page.goto("/organizations_dashboard");
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();

  const invitationsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Invitaciones")');
  await expect(invitationsTab).toContainText("1");
  await invitationsTab.click();

  await expect(page.locator('h2:has-text("Invitaciones Recibidas")')).toBeVisible();
  const invitationCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await expect(invitationCard.getByRole("button", { name: "Aceptar" })).toBeVisible();

  await invitationCard.getByRole("button", { name: "Aceptar" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Invitación aceptada exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(invitationCard.locator('span:has-text("Aceptada")')).toBeVisible();

  // Membership should now appear
  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")').click();
  await expect(page.getByText("No perteneces a ninguna organización")).toHaveCount(0);
  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toBeVisible();
  await expect(page.locator('h3:has-text("Acme Corp")').first()).toBeVisible();

  // Step 3: back to corporate and verify stats decreased and members increased
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

  // Pending invitations should have decremented back
  await expect(pendingInvitesStat).toHaveText("1");

  // Members total should be clickable and show the client in AllMembers modal
  await page.getByRole("button", { name: /Miembros Totales/ }).click();
  const allMembersDialog = page.locator('[role="dialog"]').filter({ hasText: "Todos los Miembros" });
  await expect(allMembersDialog).toHaveCount(1);
  await expect(allMembersDialog.getByText("Todos los Miembros")).toBeVisible();
  await expect(allMembersDialog.getByText("client@example.com", { exact: true })).toBeVisible();
});
