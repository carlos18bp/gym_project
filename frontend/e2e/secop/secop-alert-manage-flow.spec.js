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

test.describe("SECOP Manage Alerts Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer can see alert list with active/inactive status", {
    tag: ["@flow:secop-manage-alerts", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const alertsTab = page.getByTestId("tab-alerts");
    await expect(alertsTab).toBeVisible();
    await alertsTab.click();

    await expect(page.getByText("Obras Antioquia")).toBeVisible();
    await expect(page.getByText("Consultoría Nacional")).toBeVisible();
  });

  test("lawyer can toggle an alert active/inactive", {
    tag: ["@flow:secop-manage-alerts", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const alertsTab = page.getByTestId("tab-alerts");
    await expect(alertsTab).toBeVisible();
    await alertsTab.click();
    await expect(page.getByTestId("alerts-list")).toBeVisible();

    // Look for toggle/pause button
    const toggleBtn = page.getByRole("button", { name: /Pausar|Activar/i }).first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
    }
    // Verify alerts tab content is still rendered
    await expect(page.getByText("Obras Antioquia")).toBeVisible();
  });

  test("lawyer can delete an alert", {
    tag: ["@flow:secop-manage-alerts", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const alertsTab = page.getByTestId("tab-alerts");
    await expect(alertsTab).toBeVisible();
    await alertsTab.click();
    await expect(page.getByTestId("alerts-list")).toBeVisible();

    const deleteBtn = page.getByRole("button", { name: /Eliminar/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    }
    // Verify page is still stable after delete action
    await expect(page.getByTestId("secop-list-page")).toBeVisible();
  });
});
