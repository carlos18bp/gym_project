import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { buildMockOrganization, installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: client creates request and corporate sees it in received requests", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4950;
  const clientUserId = 4951;
  const clientEmail = "cross-client@example.com";

  const seededOrg = buildMockOrganization({
    id: 1,
    title: "Acme Corp",
    description: "Organización de prueba para E2E",
    memberCount: 2,
    pendingInvitationsCount: 0,
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

  // Step 1: client creates a request from UI
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

  const newRequestButton = page.getByRole("button", { name: "Nueva Solicitud" }).first();
  await expect(newRequestButton).toBeEnabled();
  await newRequestButton.click();

  await expect(page.getByText("Nueva Solicitud Corporativa")).toBeVisible();

  const dialog = page.locator('[role="dialog"]').filter({ hasText: "Nueva Solicitud Corporativa" });

  await dialog.locator("select#organization").selectOption("1");
  await dialog.locator("select#request_type").selectOption("1");
  await dialog.locator("#title").fill("Solicitud Cross E2E");
  await dialog.locator("#description").fill("Descripción Cross E2E");
  await dialog.locator("select#priority").selectOption("HIGH");

  await dialog.getByRole("button", { name: "Enviar Solicitud" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Solicitud enviada exitosamente");
  await page.locator(".swal2-confirm").click();

  // Client should land on requests tab and see the created request
  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();
  const createdCard = page.locator('div:has-text("CORP-REQ-6001")').first();
  await expect(createdCard).toBeVisible();
  await expect(createdCard.getByText("Solicitud Cross E2E")).toBeVisible();

  // Step 2: corporate sees the request in received requests
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

  const totalRequestsStat = page.locator('dt:has-text("Total Solicitudes") + dd');
  await expect(totalRequestsStat).toHaveText("1");

  await expect(page.getByRole("heading", { name: "Solicitudes Recibidas" })).toBeVisible();
  await expect(page.getByText("CORP-REQ-6001")).toBeVisible();
  await expect(page.getByText("Solicitud Cross E2E")).toBeVisible();
  await expect(page.getByText(clientEmail)).toBeVisible();
});
