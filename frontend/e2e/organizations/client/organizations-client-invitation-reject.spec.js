import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client can reject an organization invitation and does not gain membership", async ({ page }) => {
  const userId = 3500;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: false,
    includeInvitation: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
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
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  // Invitations tab should show 1 pending invitation
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

  // After refresh, the invitation is no longer pending.
  await expect(invitationCard.locator('span:has-text("Rechazada")')).toBeVisible();
  await expect(invitationCard.getByRole("button", { name: "Aceptar" })).toHaveCount(0);
  await expect(invitationCard.getByRole("button", { name: "Rechazar" })).toHaveCount(0);

  await expect(invitationsTab).toContainText("0");

  // Still no memberships
  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")').click();
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();
  await expect(page.getByText("Bienvenido a Acme Corp")).toHaveCount(0);
});
