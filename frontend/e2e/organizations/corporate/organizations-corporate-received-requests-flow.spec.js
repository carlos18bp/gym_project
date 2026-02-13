import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockCorporateRequest,
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client received requests: filters, view detail, and update status", async ({ page }) => {
  const userId = 4700;

  const orgA = buildMockOrganization({
    id: 10,
    title: "Acme Corp",
    description: "Org A",
    memberCount: 2,
    pendingInvitationsCount: 0,
  });

  const orgB = buildMockOrganization({
    id: 11,
    title: "Beta LLC",
    description: "Org B",
    memberCount: 1,
    pendingInvitationsCount: 0,
  });

  const now = Date.now();

  const requests = [
    buildMockCorporateRequest({
      id: 6001,
      requestNumber: "CORP-REQ-6001",
      status: "PENDING",
      priority: "URGENT",
      title: "Urgente: Contrato",
      description: "Revisar contrato urgente",
      organizationId: orgA.id,
      organizationTitle: orgA.title,
      clientFullName: "Client One",
      clientEmail: "client@example.com",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
      daysSinceCreated: 2,
    }),
    buildMockCorporateRequest({
      id: 6002,
      requestNumber: "CORP-REQ-6002",
      status: "IN_REVIEW",
      priority: "MEDIUM",
      title: "Consulta general",
      description: "Consulta de seguimiento",
      organizationId: orgA.id,
      organizationTitle: orgA.title,
      clientFullName: "Client Two",
      clientEmail: "client2@example.com",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString(),
      daysSinceCreated: 5,
    }),
    buildMockCorporateRequest({
      id: 6003,
      requestNumber: "CORP-REQ-6003",
      status: "RESPONDED",
      priority: "LOW",
      title: "Solicitud simple",
      description: "Algo simple",
      organizationId: orgB.id,
      organizationTitle: orgB.title,
      clientFullName: "Client Three",
      clientEmail: "client3@example.com",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 1).toISOString(),
      daysSinceCreated: 1,
    }),
  ];

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
    seedOrganizations: [orgA, orgB],
    seedReceivedRequests: requests,
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

  // Should render all requests
  await expect(page.getByText("CORP-REQ-6001")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6002")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6003")).toBeVisible();

  // Filter by status
  await page.selectOption("select#status-filter", "PENDING");
  await expect(page.getByText("CORP-REQ-6001")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6002")).toHaveCount(0);
  await expect(page.getByText("CORP-REQ-6003")).toHaveCount(0);

  // Clear status filter
  await page.selectOption("select#status-filter", "");

  // Filter by priority
  await page.selectOption("select#priority-filter", "URGENT");
  await expect(page.getByText("CORP-REQ-6001")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6002")).toHaveCount(0);
  await expect(page.getByText("CORP-REQ-6003")).toHaveCount(0);
  await page.selectOption("select#priority-filter", "");

  // Filter by organization
  await page.selectOption("select#organization-filter", String(orgB.id));
  await expect(page.getByText("CORP-REQ-6003")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6001")).toHaveCount(0);

  // Search by title
  await page.selectOption("select#organization-filter", "");
  await page.locator("#search").fill("Urgente");
  await expect(page.getByText("CORP-REQ-6001")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6002")).toHaveCount(0);

  // Reset filters
  await page.locator("#search").fill("texto-que-no-existe");
  await expect(page.getByText("No se encontraron solicitudes")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar Filtros" }).click();
  await expect(page.getByText("CORP-REQ-6001")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6002")).toBeVisible();
  await expect(page.getByText("CORP-REQ-6003")).toBeVisible();

  // View detail from a card
  const req1Card = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6001" })
    .first();
  await req1Card.getByRole("button", { name: /Ver Detalle|Detalle/ }).first().click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=6001/);

  // Go back to list (same route, just clear tab)
  await page.goto("/organizations_dashboard");

  // Update status from card menu
  const req2Card = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6002" })
    .first();
  await req2Card.getByRole("button", { name: /Cambiar Estado|Estado/ }).click();
  await req2Card.getByRole("button", { name: /Resuelta/ }).click();

  const updatedReq2Card = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6002" })
    .first();
  await expect(
    updatedReq2Card.locator("span.bg-green-100.text-green-800").filter({ hasText: "Resuelta" })
  ).toBeVisible();
});
