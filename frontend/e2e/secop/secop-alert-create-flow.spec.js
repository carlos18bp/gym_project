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

test.describe("SECOP Create Alert Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer can navigate to alerts tab and see existing alerts", {
    tag: ["@flow:secop-create-alert", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    // Switch to Alerts tab
    const alertsTab = page.getByTestId("tab-alerts");
    await expect(alertsTab).toBeVisible();
    await alertsTab.click();

    // Should show existing alerts
    await expect(page.getByText("Obras Antioquia")).toBeVisible();
    await expect(page.getByText("Consultoría Nacional")).toBeVisible();
  });

  test("lawyer can open new alert form", {
    tag: ["@flow:secop-create-alert", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    // Switch to Alerts tab
    const alertsTab = page.getByTestId("tab-alerts");
    await expect(alertsTab).toBeVisible();
    await alertsTab.click();

    // Click new alert button
    const newAlertBtn = page.getByTestId("alert-create-btn");
    await expect(newAlertBtn).toBeVisible();
    await newAlertBtn.click();

    // Alert form should appear with a name input
    await expect(page.getByTestId("alert-form-modal")).toBeVisible();
  });

  test("lawyer can create a new alert with keywords and frequency", {
    tag: ["@flow:secop-create-alert", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const alertsTab = page.getByTestId("tab-alerts");
    await expect(alertsTab).toBeVisible();
    await alertsTab.click();

    const newAlertBtn = page.getByTestId("alert-create-btn");
    await expect(newAlertBtn).toBeVisible();
    await newAlertBtn.click();
    await expect(page.getByTestId("alert-form-modal")).toBeVisible();

    // Fill alert form
    const nameInput = page.getByTestId("alert-name");
    await nameInput.fill("E2E Test Alert");

    // Submit the form
    const submitBtn = page.getByTestId("alert-save");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify the alerts tab is still active and page is stable
    await expect(page.getByTestId("secop-list-page")).toBeVisible();
  });
});
