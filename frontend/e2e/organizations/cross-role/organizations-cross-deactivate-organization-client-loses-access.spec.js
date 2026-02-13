import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate deactivates organization and client loses membership access", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 5010;
  const clientUserId = 5011;
  const clientEmail = "cross-org-inactive-client@example.com";

  const seededOrg = buildMockOrganization({
    id: 1,
    title: "Acme Corp",
    description: "Org activa",
    memberCount: 2,
    pendingInvitationsCount: 0,
    isActive: true,
  });

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    clientUserId,
    clientUserEmail: clientEmail,
    startWithOrganizations: true,
    seedOrganizations: [seededOrg],
    seedReceivedRequests: [],
    startWithClientMemberships: true,
  });

  // Step 1: client has membership and can see organizations/posts area + requests enabled
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
  await expect(page.getByRole("heading", { name: "Acme Corp" }).first()).toBeVisible();

  const newRequestButton = page.getByRole("button", { name: "Nueva Solicitud" }).first();
  await expect(newRequestButton).toBeEnabled();

  const desktopTabs = page.locator('nav[aria-label="Tabs"]');
  const myRequestsTab = desktopTabs.getByRole("button", { name: /Mis Solicitudes/ }).first();
  await expect(myRequestsTab).toBeEnabled();

  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toBeVisible();

  // Step 2: corporate deactivates organization
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

  const orgCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await orgCard.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Editar Organización" })).toBeVisible();

  await page.locator("input#inactive").check();
  await page.getByRole("button", { name: "Guardar Cambios" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Organización actualizada exitosamente");
  await page.locator(".swal2-confirm").click();

  // Step 3: client loses membership access
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

  // Empty state for memberships
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  const newRequestButtonAfter = page.getByRole("button", { name: "Nueva Solicitud" }).first();
  await expect(newRequestButtonAfter).toBeDisabled();

  const desktopTabsAfter = page.locator('nav[aria-label="Tabs"]');
  const myRequestsTabAfter = desktopTabsAfter.getByRole("button", { name: /Mis Solicitudes/ }).first();
  await expect(myRequestsTabAfter).toBeDisabled();

  // Posts section should not be rendered without memberships
  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toHaveCount(0);
});
