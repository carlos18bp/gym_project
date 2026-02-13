import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate responds to client request and client sees response + response_count", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4970;
  const clientUserId = 4971;
  const clientEmail = "cross-response-client@example.com";

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
  await dialog.locator("#title").fill("Solicitud Cross Response E2E");
  await dialog.locator("#description").fill("Descripción Cross Response E2E");

  await dialog.getByRole("button", { name: "Enviar Solicitud" }).click();
  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await page.locator(".swal2-confirm").click();

  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();
  const createdCard = page.locator('div.bg-white.shadow.rounded-lg.border').filter({ hasText: "CORP-REQ-6001" }).first();
  await expect(createdCard).toBeVisible();

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

  const reqCard = page.locator('div.bg-white.shadow.rounded-lg.border').filter({ hasText: "CORP-REQ-6001" }).first();
  await expect(reqCard).toBeVisible();
  await expect(reqCard.getByText(/0 respuestas/)).toBeVisible();

  await reqCard.getByRole("button", { name: /Ver Detalle|Detalle/ }).first().click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=6001/);

  await page.locator("textarea#response").fill("Respuesta Cross Role E2E");
  await page.getByRole("button", { name: "Enviar Respuesta" }).click();

  await expect(page.getByText("Respuesta Cross Role E2E")).toBeVisible();
  await expect(page.getByText("Conversación (1 respuestas)")).toBeVisible();

  await page.getByRole("button", { name: "Volver" }).click();
  const updatedReqCard = page.locator('div.bg-white.shadow.rounded-lg.border').filter({ hasText: "CORP-REQ-6001" }).first();
  await expect(updatedReqCard.getByText(/1 respuestas/)).toBeVisible();

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
  const myRequestsTab = desktopTabs.getByRole("button", { name: /Mis Solicitudes/ }).first();
  await myRequestsTab.click();

  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();

  const updatedClientCard = page.locator('div.bg-white.shadow.rounded-lg.border').filter({ hasText: "CORP-REQ-6001" }).first();
  await expect(updatedClientCard).toBeVisible();
  await expect(updatedClientCard.getByText(/1 respuestas/)).toBeVisible();

  await updatedClientCard.getByRole("button", { name: "Ver Detalle" }).click();
  await expect(page.getByText("Respuesta Cross Role E2E")).toBeVisible();
  await expect(page.getByText("Conversación (1 respuestas)")).toBeVisible();
});
