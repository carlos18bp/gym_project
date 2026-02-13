import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockCorporateRequest,
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client can add a response in request detail and response_count updates in list", async ({ page }) => {
  test.setTimeout(60_000);

  const userId = 4800;

  const org = buildMockOrganization({
    id: 20,
    title: "Acme Corp",
    description: "Org A",
    memberCount: 2,
    pendingInvitationsCount: 0,
  });

  const req = buildMockCorporateRequest({
    id: 7100,
    requestNumber: "CORP-REQ-7100",
    status: "PENDING",
    priority: "MEDIUM",
    title: "Solicitud con respuesta",
    description: "Necesito una respuesta",
    organizationId: org.id,
    organizationTitle: org.title,
    clientFullName: "Client One",
    clientEmail: "client@example.com",
    responseCount: 0,
    daysSinceCreated: 1,
  });

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
    seedOrganizations: [org],
    seedReceivedRequests: [req],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
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
  await expect(page.getByRole("heading", { name: "Solicitudes Recibidas" })).toBeVisible();

  const reqCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-7100" })
    .first();

  await expect(reqCard).toBeVisible();
  await expect(reqCard.getByText(/0 respuestas/)).toBeVisible();

  // Open detail
  await reqCard.getByRole("button", { name: /Ver Detalle|Detalle/ }).first().click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=7100/);

  await expect(page.getByRole("heading", { name: "Solicitud con respuesta" })).toBeVisible();
  await expect(page.getByText("Solicitud CORP-REQ-7100")).toBeVisible();

  // Conversation starts empty
  await expect(page.getByText("Conversación (0 respuestas)")).toBeVisible();

  await page.locator("textarea#response").fill("Respuesta corporativa E2E");
  await page.getByRole("button", { name: "Enviar Respuesta" }).click();

  await expect(page.getByText("Respuesta corporativa E2E")).toBeVisible();
  await expect(page.getByText("Conversación (1 respuestas)")).toBeVisible();

  // Back to list
  await page.getByRole("button", { name: "Volver" }).click();

  await expect(page.getByRole("heading", { name: "Solicitudes Recibidas" })).toBeVisible();

  const updatedCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-7100" })
    .first();
  await expect(updatedCard).toBeVisible();
  await expect(updatedCard.getByText(/1 respuestas/)).toBeVisible();
});
