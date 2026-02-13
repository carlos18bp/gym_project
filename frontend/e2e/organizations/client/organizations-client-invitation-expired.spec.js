import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client sees an expired organization invitation and cannot accept or reject", async ({ page }) => {
  const userId = 3520;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: false,
    includeInvitation: true,
    invitationScenario: "expired",
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

  // Invitations tab badge should be 1 pending (expired invitation is still status=PENDING)
  // UI count filters only by status, not by is_expired.
  const invitationsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Invitaciones")');
  await expect(invitationsTab).toContainText("1");

  await invitationsTab.click();
  await expect(page.locator('h2:has-text("Invitaciones Recibidas")')).toBeVisible();

  const invitationCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();

  await expect(invitationCard.getByText("Esta invitación ha expirado")).toBeVisible();
  await expect(invitationCard.getByRole("button", { name: "Aceptar" })).toHaveCount(0);
  await expect(invitationCard.getByRole("button", { name: "Rechazar" })).toHaveCount(0);

  // Should not gain membership
  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")').click();
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();
});
