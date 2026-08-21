import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";

const LAWYER_AUTH = {
  token: "e2e-secop-token",
  userAuth: {
    id: 9901,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
};

test.describe("SECOP Portal & Sync Status Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("process detail shows Ver en SECOP link to external portal", {
    tag: ['@flow:secop-view-in-portal', '@module:secop', '@priority:P3', '@role:lawyer', '@outcome:display'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Navigate to detail
    await page.getByText("Ministerio de Transporte").click();
    await expect(page).toHaveURL(/\/secop\/\d+/);
    await expect(page.getByTestId("detail-title")).toBeVisible();

    // Verify external link exists
    const secopLink = page.getByTestId("detail-secop-link");
    await expect(secopLink).toBeVisible();
    await expect(secopLink).toHaveAttribute("href", /community\.secop\.gov\.co/);
  });

  test("sync status shows last successful sync time and process count", {
    tag: ['@flow:secop-sync-status', '@module:secop', '@priority:P3', '@role:lawyer', '@outcome:display'],
  }, async ({ page }) => {
    // quality: allow-no-interaction (SyncStatus renders straight from GET secop/sync/;
    // its only control is the Sincronizar button, covered by
    // @flow:secop-trigger-sync in secop-admin-sync-flow.spec.js)
    await page.goto("/secop");
    await expect(page.getByTestId("sync-status")).toBeVisible();

    // Mock reports 150 indexed processes synced 6 hours ago
    await expect(page.getByTestId("sync-status-text")).toHaveText("150 procesos");
    await expect(page.getByTestId("sync-status")).toContainText("hace 6h");
  });

  test("sync status exposes a safe failure indicator", {
    tag: ['@flow:secop-sync-status', '@module:secop', '@priority:P3', '@role:lawyer', '@outcome:failure'],
  }, async ({ page }) => {
    // quality: allow-no-interaction (failure visibility is a server-driven display outcome)
    const lastSuccess = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    await page.route("**/api/secop/sync/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          last_success: { id: 1, status: "SUCCESS", finished_at: lastSuccess },
          recent: [{
            id: 2,
            status: "FAILED",
            error_message: "403 Client Error: private diagnostic",
          }],
          total_processes: 150,
        }),
      });
    });

    await page.goto("/secop");

    await expect(page.getByTestId("sync-status-text")).toHaveText("Error de sincronización");
    await expect(page.getByTestId("sync-status")).toContainText("último éxito hace 3d");
    await expect(page.getByTestId("sync-status")).not.toContainText("private diagnostic");
  });
});
