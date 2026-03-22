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

test.describe("SECOP Export Excel Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer can see export button on process list", {
    tag: ["@flow:secop-export-excel", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Verify export button is visible
    const exportBtn = page.getByTestId("secop-export-btn");
    await expect(exportBtn).toBeVisible();
  });

  test("lawyer can trigger Excel export", {
    tag: ["@flow:secop-export-excel", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    const exportBtn = page.getByTestId("secop-export-btn");
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();
    // Verify page is stable after export action
    await expect(page.getByText("Ministerio de Transporte")).toBeVisible();
  });
});
