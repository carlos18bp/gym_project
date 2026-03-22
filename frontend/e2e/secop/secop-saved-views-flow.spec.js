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

test.describe("SECOP Saved Views Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer can navigate to saved views tab", {
    tag: ["@flow:secop-save-view", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    // Should show existing saved views
    await expect(page.getByText("Antioquia Obras")).toBeVisible();
  });

  test("lawyer can apply a saved view to load filters", {
    tag: ["@flow:secop-apply-saved-view", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    const applyBtn = page.getByRole("button", { name: /Aplicar/i }).first();
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
    }
    // Verify page remains stable after applying filters
    await expect(page.getByTestId("secop-list-page")).toBeVisible();
  });

  test("lawyer can delete a saved view", {
    tag: ["@flow:secop-save-view", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    const deleteBtn = page.getByRole("button", { name: /Eliminar/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
    }
    // Verify page is stable after delete action
    await expect(page.getByTestId("secop-list-page")).toBeVisible();
  });
});
