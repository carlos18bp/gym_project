import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client my requests: list + filters + open detail + add response", async ({ page }) => {
  const userId = 3560;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    seedMyRequests: "filters",
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

  // Go to "Mis Solicitudes" tab
  const desktopTabs = page.locator('nav[aria-label="Tabs"]');
  const myRequestsTab = desktopTabs.getByRole("button", { name: /Mis Solicitudes/ }).first();
  await expect(myRequestsTab).toBeEnabled();
  await myRequestsTab.click();

  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();

  const alphaCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6201" })
    .first();
  const betaCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6202" })
    .first();
  const gammaCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "CORP-REQ-6203" })
    .first();

  // List shows all 3
  await expect(alphaCard).toBeVisible();
  await expect(betaCard).toBeVisible();
  await expect(gammaCard).toBeVisible();

  // Newest first (seed uses createdAtNewest for Alpha)
  const requestCards = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: /CORP-REQ-\d+/ });
  await expect(requestCards.first()).toContainText("CORP-REQ-6201");

  // Filter by status
  await page.locator("select#status-filter").selectOption("CLOSED");
  await expect(page.locator("div.bg-white.shadow.rounded-lg.border").filter({ hasText: "CORP-REQ-6201" })).toHaveCount(0);
  await expect(page.locator("div.bg-white.shadow.rounded-lg.border").filter({ hasText: "CORP-REQ-6203" })).toHaveCount(0);
  await expect(betaCard).toBeVisible();

  // Force no results by adding incompatible priority
  await page.locator("select#priority-filter").selectOption("URGENT");
  await expect(page.getByText("No se encontraron solicitudes")).toBeVisible();
  const clearFiltersBtn = page.getByRole("button", { name: "Limpiar Filtros" }).first();
  await expect(clearFiltersBtn).toBeVisible();
  await clearFiltersBtn.click();

  // Back to full list
  await expect(alphaCard).toBeVisible();
  await expect(betaCard).toBeVisible();
  await expect(gammaCard).toBeVisible();

  // Priority filter
  await page.locator("select#priority-filter").selectOption("URGENT");
  await expect(gammaCard).toBeVisible();
  await expect(page.locator("div.bg-white.shadow.rounded-lg.border").filter({ hasText: "CORP-REQ-6201" })).toHaveCount(0);
  await expect(page.locator("div.bg-white.shadow.rounded-lg.border").filter({ hasText: "CORP-REQ-6202" })).toHaveCount(0);

  // Clear priority filter
  await page.locator("select#priority-filter").selectOption("");

  // Search by title
  await page.locator("input#search").fill("alpha");
  await expect(alphaCard).toBeVisible();
  await expect(page.locator("div.bg-white.shadow.rounded-lg.border").filter({ hasText: "CORP-REQ-6202" })).toHaveCount(0);
  await expect(page.locator("div.bg-white.shadow.rounded-lg.border").filter({ hasText: "CORP-REQ-6203" })).toHaveCount(0);

  // Search no results -> clear filters
  await page.locator("input#search").fill("no-match-xyz");
  await expect(page.getByText("No se encontraron solicitudes")).toBeVisible();
  await clearFiltersBtn.click();

  // Open request detail from Alpha
  await expect(alphaCard).toBeVisible();
  await alphaCard.getByRole("button", { name: "Ver Detalle" }).click();

  // RequestDetailView is shown via ?tab=request-detail
  await expect(page.getByRole("heading", { name: "Alpha Solicitud" })).toBeVisible();
  await expect(page.getByText("Solicitud CORP-REQ-6201")).toBeVisible();

  // Add a response
  await expect(page.getByText("Conversación (0 respuestas)")).toBeVisible();
  await page.locator("textarea#response").fill("Respuesta E2E");
  await page.getByRole("button", { name: "Enviar Respuesta" }).click();

  await expect(page.getByText("Respuesta E2E")).toBeVisible();
  await expect(page.getByText("Conversación (1 respuestas)")).toBeVisible();

  // Back to dashboard
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();
});
