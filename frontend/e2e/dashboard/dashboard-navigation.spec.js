import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDashboardNavApiMocks } from "../helpers/dashboardNavMocks.js";

test("dashboard loads and sidebar navigation works (processes, legal requests, dynamic documents)", async ({ page }) => {
  const userId = 1300;

  await installDashboardNavApiMocks(page, {
    userId,
    role: "lawyer",
    isGymLawyer: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto("/dashboard");

  // Smoke: dashboard should render welcome card
  await expect(page.getByText("Procesos activos")).toBeVisible();

  const sidebar = page.locator("div.lg\\:fixed.lg\\:inset-y-0");

  // Sidebar navigation items (desktop)
  await sidebar.getByRole("link", { name: "Procesos", exact: true }).click();
  await expect(page).toHaveURL(/\/process_list/);
  await expect(page.getByPlaceholder("Buscar procesos...")).toBeVisible();

  await sidebar.getByRole("link", { name: "Gestión de Solicitudes", exact: true }).click();
  await expect(page).toHaveURL(/\/legal_requests/);
  await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();
  await expect(page.getByText("REQ-1001")).toBeVisible();

  await sidebar.getByRole("link", { name: "Archivos Juridicos", exact: true }).click();
  await expect(page).toHaveURL(/\/dynamic_document_dashboard/);
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
});
