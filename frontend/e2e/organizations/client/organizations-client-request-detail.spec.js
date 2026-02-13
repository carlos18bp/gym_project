import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client can open request detail from My Requests and add a response", async ({ page }) => {
  const userId = 3300;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    seedMyRequests: true,
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

  // Go to My Requests
  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Solicitudes")').click();
  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();

  // Open the seeded request detail
  const seededCard = page.locator('div:has-text("CORP-REQ-6100")').first();
  await expect(seededCard).toBeVisible();
  await seededCard.getByRole("button", { name: "Ver Detalle" }).click();

  // RequestDetailView
  await expect(page.locator('h1:has-text("Solicitud Semilla E2E")')).toBeVisible();
  await expect(page.getByText("Solicitud CORP-REQ-6100")).toBeVisible();
  await expect(page.locator('span:has-text("Pendiente")')).toBeVisible();
  await expect(page.locator('span:has-text("Alta")')).toBeVisible();

  // Add a response
  await page.locator("textarea#response").fill("Respuesta E2E");
  await page.getByRole("button", { name: "Enviar Respuesta" }).click();

  await expect(page.locator('h3:has-text("Conversación")')).toContainText("1");
  await expect(page.getByText("Respuesta E2E")).toBeVisible();
  const responseCard = page.locator("div").filter({ hasText: "Respuesta E2E" }).first();
  await expect(responseCard.getByText("Cliente", { exact: true })).toBeVisible();

  // Back to dashboard
  await page.getByRole("button", { name: "Volver" }).first().click();
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();
});
