import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";
import { installDashboardNavApiMocks } from "../helpers/dashboardNavMocks.js";

test.describe("dashboard: lawyer view", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, () => {
  test("lawyer replaces the welcome card profile photo", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8000;

    await installDashboardNavApiMocks(page, { userId, role: "lawyer", isGymLawyer: true });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");

    // Starting point: the welcome card is rendered with its photo editor
    await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Editar foto de perfil" })).toBeVisible();

    const profileUpdate = page.waitForRequest(
      (request) =>
        request.url().includes(`/api/update_profile/${userId}/`) &&
        request.method() === "PUT"
    );

    await page.getByTestId("photo-file-input").setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });

    // Transition: the profile update request is emitted and confirmed to the user
    await profileUpdate;
    await expect(page.getByText("Foto de perfil actualizada correctamente")).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer returns to the welcome card through the sidebar Inicio link", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8001;

    await installDashboardNavApiMocks(page, { userId, role: "lawyer", isGymLawyer: true });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    // Starting point: the lawyer is on the process list, not on the dashboard
    await page.goto("/process_list");
    await expect(page.getByPlaceholder("Buscar procesos...")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Procesos activos")).toHaveCount(0);

    // quality: allow-fragile-selector (the desktop sidebar has no role/testid of its own; this is the established locator across dashboard specs)
    const sidebar = page.locator("div.lg\\:fixed.lg\\:inset-y-0");
    await sidebar.getByRole("link", { name: "Inicio", exact: true }).click();

    // Transition: the dashboard welcome card takes over
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Miembro desde")).toBeVisible();
  });

  test("lawyer can access Minutas section", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8002;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
  });

  test("lawyer can access Carpetas section", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8003;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();
  });
});
