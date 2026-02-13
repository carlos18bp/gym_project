import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: client responds to request and corporate sees response + response_count", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4990;
  const clientUserId = 4991;
  const clientEmail = "cross-client-reply@example.com";

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

  // Step 1: client creates request
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
  await dialog.locator("#title").fill("Solicitud Cross Client Reply E2E");
  await dialog.locator("#description").fill("Descripción Cross Client Reply E2E");

  await dialog.getByRole("button", { name: "Enviar Solicitud" }).click();
  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await page.locator(".swal2-confirm").click();

  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();

  const createdClientCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6001" })
    .first();
  await expect(createdClientCard).toBeVisible();
  await expect(createdClientCard.getByText(/0 respuestas/)).toBeVisible();

  // Step 2: client replies from request detail
  await createdClientCard.getByRole("button", { name: "Ver Detalle" }).click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=6001/);

  const responseForm = page
    .locator("form")
    .filter({ has: page.locator("textarea#response") })
    .first();
  const responseTextarea = responseForm.locator("textarea#response");
  const sendResponseButton = responseForm.locator('button[type="submit"]');

  await expect(responseTextarea).toBeVisible();
  await responseTextarea.fill("Respuesta del cliente Cross Role E2E");
  await expect(sendResponseButton).toContainText(/Enviar Respuesta|Enviando/);
  await expect(sendResponseButton).toBeEnabled();
  await sendResponseButton.click();

  await expect(page.getByText("Respuesta del cliente Cross Role E2E")).toBeVisible();
  await expect(page.getByText("Conversación (1 respuestas)")).toBeVisible();

  // Step 3: corporate sees updated response_count and response in detail
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
  await expect(corporateReqCard.getByText(/1 respuestas/)).toBeVisible();

  await corporateReqCard.getByRole("button", { name: /Ver Detalle|Detalle/ }).first().click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=6001/);

  await expect(page.getByText("Respuesta del cliente Cross Role E2E")).toBeVisible();
  await expect(page.getByText("Conversación (1 respuestas)")).toBeVisible();
});
