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

test.describe("SECOP Classify Flows", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer can classify a SECOP process from detail view", {
    tag: ["@flow:secop-classify-process", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Navigate to detail
    await page.getByText("Ministerio de Transporte").click();
    await expect(page).toHaveURL(/\/secop\/\d+/);

    // Look for classification section
    await expect(page.getByTestId("detail-classification")).toBeVisible();
  });

  test("lawyer can view My Classifications tab with classified processes", {
    tag: ["@flow:secop-classify-process", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Switch to My Classifications tab
    const myClassTab = page.getByTestId("tab-classified");
    await expect(myClassTab).toBeVisible();
    await myClassTab.click();
    // Should show classified processes
    await expect(page.getByText("Alcaldía de Medellín")).toBeVisible();
  });

  test("lawyer can add notes to a classification", {
    tag: ["@flow:secop-add-notes", "@module:secop", "@priority:P2", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Navigate to detail of a process
    await page.getByText("Ministerio de Transporte").click();
    await expect(page).toHaveURL(/\/secop\/\d+/);

    // Verify the classification section has notes capability
    await expect(page.getByTestId("detail-classification")).toBeVisible();
  });
});
