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

test.describe("SECOP Browse Flows", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer can view SECOP process list with pagination info", {
    tag: ["@flow:secop-list-browse", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Verify list page renders with processes
    await expect(page.getByText("Ministerio de Transporte")).toBeVisible();
    await expect(page.getByText("INVIAS")).toBeVisible();
    await expect(page.getByText("Alcaldía de Medellín")).toBeVisible();

    // Verify result count is shown
    await expect(page.getByTestId("secop-result-count")).toBeVisible();
  });

  test("lawyer can navigate to process detail page", {
    tag: ["@flow:secop-process-detail", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Click on a process row to navigate to detail
    await page.getByText("Ministerio de Transporte").click();

    // Verify detail page renders
    await expect(page).toHaveURL(/\/secop\/\d+/);
    await expect(page.getByText("CO1.REQ.E2E001")).toBeVisible();
    await expect(page.getByText("Bogotá D.C.").first()).toBeVisible();
  });

  test("lawyer can view sync status indicator", {
    tag: ["@flow:secop-sync-status", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("sync-status")).toBeVisible();

    // Verify sync status shows process count
    await expect(page.getByTestId("sync-status-text")).toBeVisible();
  });
});
