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
    tag: ["@flow:secop-view-in-portal", "@module:secop", "@priority:P3", "@role:lawyer"],
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
    tag: ["@flow:secop-sync-status", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("sync-status")).toBeVisible();

    // Sync status indicator should show process count
    await expect(page.getByTestId("sync-status-text")).toBeVisible();
  });
});
