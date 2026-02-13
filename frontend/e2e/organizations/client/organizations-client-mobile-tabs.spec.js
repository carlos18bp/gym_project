import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client mobile tabs dropdown switches sections and respects disabled state", async ({ page }) => {
  const userId = 3550;

  await page.setViewportSize({ width: 375, height: 800 });

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: false,
    includeInvitation: true,
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

  const mobileTabsButton = page.locator("button#current-tab");
  await expect(mobileTabsButton).toBeVisible();
  await expect(mobileTabsButton).toContainText("Mis Organizaciones");

  // Open dropdown and switch to Invitations
  await mobileTabsButton.click();

  const invitationsOption = page.getByRole("button", { name: /Invitaciones/ }).first();
  await expect(invitationsOption).toBeVisible();
  await expect(invitationsOption).toContainText("1");
  await invitationsOption.click();

  await expect(mobileTabsButton).toContainText("Invitaciones");
  await expect(page.locator('h2:has-text("Invitaciones Recibidas")')).toBeVisible();
  await expect(page.locator('h3:has-text("Acme Corp")')).toBeVisible();

  // Open dropdown and verify Requests is disabled (no memberships)
  await mobileTabsButton.click();

  const requestsOption = page.getByRole("button", { name: /Mis Solicitudes/ }).first();
  await expect(requestsOption).toBeVisible();
  await expect(requestsOption).toBeDisabled();

  // Even with force click, active tab should not change
  await requestsOption.click({ force: true });
  await expect(mobileTabsButton).toContainText("Invitaciones");
  await expect(page.locator('h2:has-text("Invitaciones Recibidas")')).toBeVisible();

  // Switch back to Organizations
  const orgsOption = page.getByRole("button", { name: /Mis Organizaciones/ }).first();
  await orgsOption.click();

  await expect(mobileTabsButton).toContainText("Mis Organizaciones");
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();
});
