import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client can create a corporate request from modal and see it in My Requests", async ({ page }) => {
  const userId = 3200;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
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

  // Open the modal
  const newRequestButton = page.getByRole("button", { name: "Nueva Solicitud" }).first();
  await expect(newRequestButton).toBeEnabled();
  await expect(newRequestButton).not.toHaveAttribute("title", /Debes ser miembro/);
  await newRequestButton.click();

  await expect(page.getByText("Nueva Solicitud Corporativa")).toBeVisible();

  const dialog = page.locator('[role="dialog"]').filter({ hasText: "Nueva Solicitud Corporativa" });

  await dialog.locator("select#organization").selectOption("1");
  await dialog.locator("select#request_type").selectOption("1");
  await dialog.locator("#title").fill("Solicitud E2E");
  await dialog.locator("#description").fill("Descripción E2E");
  await dialog.locator("select#priority").selectOption("HIGH");

  await dialog.getByRole("button", { name: "Enviar Solicitud" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Solicitud enviada exitosamente");
  await page.locator(".swal2-confirm").click();

  // After creation, the dashboard sets the active tab to "requests".
  // Assert the requests section and the created request card.
  await expect(page.locator('h2:has-text("Mis Solicitudes Corporativas")')).toBeVisible();
  const createdCard = page.locator('div:has-text("CORP-REQ-6001")').first();
  await expect(createdCard).toBeVisible();
  await expect(createdCard.getByText("Solicitud E2E")).toBeVisible();
  await expect(createdCard.locator('span:has-text("Alta")')).toBeVisible();
});
