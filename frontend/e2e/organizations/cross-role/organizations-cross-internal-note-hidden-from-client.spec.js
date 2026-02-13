import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate internal note is not visible to client", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 5020;
  const clientUserId = 5021;
  const clientEmail = "cross-internal-note-client@example.com";

  const seededOrg = buildMockOrganization({
    id: 1,
    title: "Acme Corp",
    description: "Org para nota interna",
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
  await dialog.locator("#title").fill("Solicitud Nota Interna E2E");
  await dialog.locator("#description").fill("Descripción Nota Interna E2E");

  await dialog.getByRole("button", { name: "Enviar Solicitud" }).click();
  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await page.locator(".swal2-confirm").click();

  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();

  // Step 2: corporate adds INTERNAL note
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

  await corporateReqCard.getByRole("button", { name: /Ver Detalle|Detalle/ }).first().click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=6001/);

  const internalNoteText = "Nota interna: solo corporate";

  await page.locator("textarea#response").fill(internalNoteText);
  await page
    .locator('label:has-text("Nota interna") input[type="checkbox"]')
    .check();
  await page.getByRole("button", { name: "Enviar Respuesta" }).click();

  await expect(page.getByText(internalNoteText)).toBeVisible();
  await expect(page.getByText("Nota Interna", { exact: true })).toBeVisible();
  await expect(page.getByText("Conversación (1 respuestas)")).toBeVisible();

  // Step 3: client should NOT see internal note (filtered) and counts remain 0
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

  const clientReqCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6001" })
    .first();
  await expect(clientReqCard).toBeVisible();
  await expect(clientReqCard.getByText(/0 respuestas/)).toBeVisible();

  await clientReqCard.getByRole("button", { name: "Ver Detalle" }).click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=6001/);

  await expect(page.getByText(internalNoteText)).toHaveCount(0);
  await expect(page.getByText("Nota Interna", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No hay respuestas aún")).toBeVisible();
  await expect(page.getByText("Conversación (0 respuestas)")).toBeVisible();
});
