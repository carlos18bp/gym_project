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

  test("changing the page size re-queries the SECOP list", {
    tag: ['@flow:secop-list-browse', '@module:secop', '@priority:P2', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Starting point: the first page renders with the seeded processes
    await expect(page.getByText("Ministerio de Transporte")).toBeVisible();
    await expect(page.getByText("INVIAS")).toBeVisible();
    await expect(page.getByText("Alcaldía de Medellín")).toBeVisible();
    await expect(page.getByTestId("page-size-selector")).toHaveValue("20");

    const pageSizeRequest = page.waitForRequest((request) =>
      request.url().includes("/api/secop/processes/") && request.url().includes("page_size=50")
    );

    await page.getByTestId("page-size-selector").selectOption("50");

    // Transition: the list is re-fetched with the new page size
    await pageSizeRequest;
    await expect(page.getByTestId("page-size-selector")).toHaveValue("50");
    await expect(page.getByTestId("secop-result-count")).toBeVisible();
  });

  test("lawyer can navigate to process detail page", {
    tag: ['@flow:secop-process-detail', '@module:secop', '@priority:P2', '@role:lawyer'],
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

  // NOTE: a "lawyer can view sync status indicator" test used to live here. It
  // was an exact duplicate of the sync-status test in secop-portal-sync-flow
  // (same route, same testids), so it was removed instead of rewritten.

  test("lawyer can expand advanced filters and see UNSPSC filter", {
    tag: ['@flow:secop-list-browse', '@module:secop', '@priority:P2', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Advanced filters are hidden by default — toggle them open
    await page.getByTestId("toggle-advanced-filters").click();
    await expect(page.getByTestId("advanced-filters")).toBeVisible();

    // UNSPSC filter should now be visible
    await expect(page.getByTestId("filter-unspsc")).toBeVisible();
  });
});
