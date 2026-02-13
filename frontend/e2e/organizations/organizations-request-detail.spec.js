import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../helpers/organizationsDashboardMocks.js";

test("corporate client can open request detail, reply, and update status", async ({ page }) => {
  const userId = 2100;

  await installOrganizationsDashboardApiMocks(page, { userId, role: "corporate_client" });

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
  await expect(page.getByRole("heading", { name: "Panel Corporativo" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Ver Detalle" }).click();
  await expect(page).toHaveURL(/\/organizations_dashboard\?tab=request-detail&id=\d+/);

  await expect(page.getByText("Solicitud CORP-REQ-5001")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detalles de la Solicitud" })).toBeVisible();

  await page.locator("#response").fill("Respuesta E2E");
  await page.getByRole("button", { name: "Enviar Respuesta" }).click();

  await expect(page.locator('h3:has-text("Conversación")')).toContainText("(1 respuestas)");
  await expect(page.getByText("Respuesta E2E")).toBeVisible();

  await page.selectOption("select#status", "IN_REVIEW");

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Estado actualizado exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(page.locator("span.bg-blue-100.text-blue-800").filter({ hasText: "En Revisión" })).toBeVisible();
});
