import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client request detail: shows error state for 404 and allows going back", async ({ page }) => {
  const userId = 3570;

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

  // Unknown request id -> mock returns 404
  await page.goto("/organizations_dashboard?tab=request-detail&id=999999");

  await expect(page.getByText("Error al cargar la solicitud")).toBeVisible();

  // Back to dashboard
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();
});

test("client request detail: shows error state for 403 and allows going back", async ({ page }) => {
  const userId = 3571;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    seedMyRequests: "filters",
    myRequestDetailScenario: "forbidden",
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

  // Existing request id but detail endpoint is forced to 403
  await page.goto("/organizations_dashboard?tab=request-detail&id=6201");

  await expect(page.getByText("Error al cargar la solicitud")).toBeVisible();

  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();
});
