import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

// quality: allow-test-too-long (complex cross-role E2E flow requiring extensive setup and validation)

// quality: allow-too-many-assertions (complex cross-role E2E flow with multiple checkpoints)

async function closeSuccessDialog(page, expectedText) {
  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText(expectedText);
  await page.getByRole("button", { name: /^(OK|Aceptar)$/i }).click();
}

test("cross-role: corporate invites client, client accepts, corporate stats and members update", { tag: ['@flow:org-cross-invite-flow', '@module:organizations', '@priority:P1', '@role:shared'] }, async ({ page }) => {
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
  await expect(page.getByRole("button", { name: "Invitar Miembro" })).toBeVisible({ timeout: 15_000 });

  // Baseline pending invitations (from seed org)
  const pendingInvitesStat = page.locator('dt:has-text("Invitaciones Pendientes") + dd');
  await expect(pendingInvitesStat).toHaveText("1");

  await page.getByRole("button", { name: "Invitar Miembro" }).click();
  await expect(page.getByText("Invitar Nuevo Miembro")).toBeVisible();

  const inviteDialog = page.locator('[role="dialog"]').filter({ hasText: "Invitar Nuevo Miembro" });
  await inviteDialog.locator('input[id="email"]').fill("client@example.com");
  await inviteDialog.locator('textarea[id="message"]').fill("Invitación E2E");

  await inviteDialog.getByRole("button", { name: "Enviar Invitación" }).click();
  await closeSuccessDialog(page, "Invitación enviada exitosamente");

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
  const invitationsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Invitaciones")');
  await expect(invitationsTab).toBeVisible({ timeout: 15_000 });
  await expect(invitationsTab).toContainText("1");
  await invitationsTab.click();

  await expect(page.locator('h2:has-text("Invitaciones Recibidas")')).toBeVisible();
  const invitationCard = page
    .getByRole("heading", { name: "Acme Corp" })
    .locator("xpath=ancestor::div[.//button][1]");
  await expect(invitationCard.getByRole("button", { name: "Aceptar" })).toBeVisible();

  await invitationCard.getByRole("button", { name: "Aceptar" }).click();
  await closeSuccessDialog(page, "Invitación aceptada exitosamente");

  await expect(invitationCard.locator('span:has-text("Aceptada")')).toBeVisible();

  // Membership should now appear
  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")').click();
  await expect(page.getByText("No perteneces a ninguna organización")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Anuncios de Organizaciones" })).toBeVisible();
  await expect(page.getByText("Acme Corp", { exact: true })).not.toHaveCount(0);

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
