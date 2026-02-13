import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client can filter and search in My Requests", async ({ page }) => {
  const userId = 3400;

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

  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Solicitudes")').click();
  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();

  await expect(page.locator("text=CORP-REQ-6201")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6202")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6203")).toBeVisible();

  await page.locator("select#status-filter").selectOption("CLOSED");
  await expect(page.locator("text=CORP-REQ-6202")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6201")).toHaveCount(0);
  await expect(page.locator("text=CORP-REQ-6203")).toHaveCount(0);

  await page.locator("select#status-filter").selectOption("");
  await page.locator("select#priority-filter").selectOption("URGENT");
  await expect(page.locator("text=CORP-REQ-6203")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6201")).toHaveCount(0);
  await expect(page.locator("text=CORP-REQ-6202")).toHaveCount(0);

  await page.locator("select#priority-filter").selectOption("");
  await page.locator("input#search").fill("alpha");
  await expect(page.locator("text=CORP-REQ-6201")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6202")).toHaveCount(0);
  await expect(page.locator("text=CORP-REQ-6203")).toHaveCount(0);

  await page.locator("input#search").fill("CORP-REQ-6203");
  await expect(page.locator("text=CORP-REQ-6203")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6201")).toHaveCount(0);
  await expect(page.locator("text=CORP-REQ-6202")).toHaveCount(0);

  await page.locator("input#search").fill("");
  await page.locator("select#status-filter").selectOption("RESOLVED");

  await expect(page.locator("text=No se encontraron solicitudes")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar Filtros" }).click();

  await expect(page.locator("select#status-filter")).toHaveValue("");
  await expect(page.locator("select#priority-filter")).toHaveValue("");
  await expect(page.locator("input#search")).toHaveValue("");

  await expect(page.locator("text=CORP-REQ-6201")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6202")).toBeVisible();
  await expect(page.locator("text=CORP-REQ-6203")).toBeVisible();
});
