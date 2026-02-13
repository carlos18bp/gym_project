import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate updates request status and client sees updated status", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4980;
  const clientUserId = 4981;
  const clientEmail = "cross-status-client@example.com";

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

  // Step 1: client creates a request
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

  await page.getByRole("button", { name: "Nueva Solicitud" }).first().click();
  await expect(page.getByText("Nueva Solicitud Corporativa")).toBeVisible();

  const dialog = page.locator('[role="dialog"]').filter({ hasText: "Nueva Solicitud Corporativa" });
  await dialog.locator("select#organization").selectOption("1");
  await dialog.locator("select#request_type").selectOption("1");
  await dialog.locator("#title").fill("Solicitud Cross Status E2E");
  await dialog.locator("#description").fill("Descripción Cross Status E2E");

  await dialog.getByRole("button", { name: "Enviar Solicitud" }).click();
  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await page.locator(".swal2-confirm").click();

  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();
  const clientCreatedCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6001" })
    .first();
  await expect(clientCreatedCard).toBeVisible();
  await expect(
    clientCreatedCard.locator("span.bg-yellow-100.text-yellow-800").filter({ hasText: "Pendiente" })
  ).toBeVisible();

  // Step 2: corporate updates status to RESOLVED
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

  const corporateReqCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6001" })
    .first();
  await expect(corporateReqCard).toBeVisible();

  await corporateReqCard.getByRole("button", { name: /Cambiar Estado|Estado/ }).click();
  await corporateReqCard.getByRole("button", { name: /Resuelta/ }).click();

  await expect(
    corporateReqCard.locator("span.bg-green-100.text-green-800").filter({ hasText: "Resuelta" })
  ).toBeVisible();

  // Step 3: client sees updated status in list and detail
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

  const desktopTabs = page.locator('nav[aria-label="Tabs"]');
  await desktopTabs.getByRole("button", { name: /Mis Solicitudes/ }).first().click();

  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();

  const updatedClientCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6001" })
    .first();
  await expect(updatedClientCard).toBeVisible();
  await expect(
    updatedClientCard.locator("span.bg-green-100.text-green-800").filter({ hasText: "Resuelta" })
  ).toBeVisible();

  await updatedClientCard.getByRole("button", { name: "Ver Detalle" }).click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=6001/);
  await expect(page.locator("span.bg-green-100.text-green-800").filter({ hasText: "Resuelta" })).toBeVisible();
});
