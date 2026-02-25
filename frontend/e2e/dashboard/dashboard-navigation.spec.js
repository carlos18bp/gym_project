import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDashboardNavApiMocks } from "../helpers/dashboardNavMocks.js";

test("dashboard loads and sidebar navigation works (processes, legal requests, dynamic documents)", { tag: ['@flow:dashboard-navigation', '@module:dashboard', '@priority:P2', '@role:shared'] }, async ({ page }) => {
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
  await page.waitForLoadState("networkidle");

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

test("client dashboard loads and shows sidebar with correct navigation items", { tag: ['@flow:dashboard-navigation', '@module:dashboard', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 1301;

  await installDashboardNavApiMocks(page, {
    userId,
    role: "client",
    isGymLawyer: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // Client dashboard should render
  await expect(page.locator("body")).toBeVisible();

  const sidebar = page.locator("div.lg\\:fixed.lg\\:inset-y-0");

  // Client should see Archivos Juridicos link
  await sidebar.getByRole("link", { name: "Archivos Juridicos", exact: true }).click();
  await expect(page).toHaveURL(/\/dynamic_document_dashboard/);
});
