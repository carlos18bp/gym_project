import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client without memberships: 'Mis Solicitudes' tab is disabled and 403 does not break dashboard", async ({ page }) => {
  const userId = 3530;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: false,
    includeInvitation: false,
    myRequestsScenario: "forbidden",
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

  // Should show organizations empty state
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  const orgsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")');
  const requestsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Mis Solicitudes")');
  const invitationsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Invitaciones")');

  await expect(orgsTab).toBeEnabled();
  await expect(invitationsTab).toBeEnabled();

  // Requests tab should be disabled when there are no memberships
  await expect(requestsTab).toBeDisabled();

  // Clicking disabled tab should not switch the view
  await requestsTab.click({ force: true });
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  // Invitations should still be reachable
  await invitationsTab.click();
  await expect(page.locator('h2:has-text("Invitaciones Recibidas")')).toBeVisible();
  await expect(page.getByText("No tienes invitaciones")).toBeVisible();
});
