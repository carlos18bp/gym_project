import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDashboardNavApiMocks } from "../helpers/dashboardNavMocks.js";

/**
 * Deep coverage for dashboard widgets:
 * - UserWelcomeCard.vue (65.5%)
 * - QuickActionButtons.vue (78.9%)
 * - RecentProcessList.vue (75.7%)
 * - RecentDocumentsList.vue (50%)
 */

test("lawyer dashboard shows welcome card and quick action buttons", async ({ page }) => {
  const userId = 9830;

  await installDashboardNavApiMocks(page, { userId, role: "lawyer", isGymLawyer: true });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // UserWelcomeCard should show active processes count
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // QuickActionButtons for lawyer
  await expect(page.getByText("Todos los Procesos")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Radicar Proceso")).toBeVisible();
  await expect(page.getByText("Nueva Minuta")).toBeVisible();
  await expect(page.getByText("Radicar Informe")).toBeVisible();

  // Feed section should be present
  await expect(page.getByText("Feed")).toBeVisible();
});

test("lawyer dashboard shows recent documents section with empty state", async ({ page }) => {
  const userId = 9831;

  await installDashboardNavApiMocks(page, { userId, role: "lawyer", isGymLawyer: true });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // RecentDocumentsList renders with a delay — wait for it
  await expect(page.getByRole("heading", { name: "Documentos Recientes", exact: true })).toBeVisible({ timeout: 15_000 });
  // Empty state since no recent documents are mocked
  await expect(page.getByRole("heading", { name: "No hay documentos recientes" })).toBeVisible({ timeout: 10_000 });
});

test("client dashboard renders welcome card with client-specific quick actions", async ({ page }) => {
  const userId = 9832;

  await installDashboardNavApiMocks(page, { userId, role: "client", isGymLawyer: false });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dashboard");

  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // Client quick actions — use first() since "Mis Procesos" may appear in sidebar too
  await expect(page.getByText("Mis Procesos").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Agendar Cita").first()).toBeVisible();
});
