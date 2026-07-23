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

  test("Excel export carries the active search filter", {
    tag: ['@flow:secop-export-excel', '@module:secop', '@priority:P3', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Starting point: filter the list before exporting it
    await page.getByTestId("secop-search").fill("transporte");
    await expect(page.getByTestId("secop-search")).toHaveValue("transporte");

    const exportRequest = page.waitForRequest((request) =>
      request.url().includes("/api/secop/export/")
    );

    await page.getByTestId("secop-export-btn").click();

    // Transition: the export request is emitted with the active filter
    const request = await exportRequest;
    expect(new URL(request.url()).searchParams.get("search")).toBe("transporte");
  });

  test("lawyer can trigger Excel export", {
    tag: ['@flow:secop-export-excel', '@module:secop', '@priority:P3', '@role:lawyer'],
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
