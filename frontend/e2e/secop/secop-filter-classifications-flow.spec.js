import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";

const LAWYER_AUTH = {
  token: "e2e-secop-filter-token",
  userAuth: {
    id: 9901,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
};

test.describe("SECOP Filter Classifications Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer filters classified processes by INTERESTING status", {
    tag: ["@flow:secop-filter-classifications", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Switch to My Classifications tab
    await page.getByTestId("tab-classified").click();
    await expect(page.getByTestId("classification-status-filter")).toBeVisible();

    // Select INTERESTING filter
    await page.getByTestId("filter-classification-status").selectOption("INTERESTING");

    // Wait for filtered results — only INTERESTING classification should appear
    await expect(page.getByText("Alcaldía de Medellín")).toBeVisible();
    // APPLIED process should not be visible
    await expect(page.getByText("Gobernación del Valle")).not.toBeVisible();
  });

  test("lawyer filters classified processes by APPLIED status", {
    tag: ["@flow:secop-filter-classifications", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Switch to My Classifications tab
    await page.getByTestId("tab-classified").click();
    await expect(page.getByTestId("classification-status-filter")).toBeVisible();

    // Select APPLIED filter
    await page.getByTestId("filter-classification-status").selectOption("APPLIED");

    // Wait for filtered results — only APPLIED classification should appear
    await expect(page.getByText("Gobernación del Valle")).toBeVisible();
    // INTERESTING process should not be visible
    await expect(page.getByText("Alcaldía de Medellín")).not.toBeVisible();
  });

  test("lawyer clears filter to show all classifications", {
    tag: ["@flow:secop-filter-classifications", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Switch to My Classifications tab
    await page.getByTestId("tab-classified").click();

    // First apply a filter
    await page.getByTestId("filter-classification-status").selectOption("INTERESTING");
    await expect(page.getByText("Alcaldía de Medellín")).toBeVisible();

    // Clear filter — select "Todos los estados"
    await page.getByTestId("filter-classification-status").selectOption("");

    // Both classified processes should be visible
    await expect(page.getByText("Alcaldía de Medellín")).toBeVisible();
    await expect(page.getByText("Gobernación del Valle")).toBeVisible();
  });

  test("lawyer sees empty state when no classifications match filter", {
    tag: ["@flow:secop-filter-classifications", "@module:secop", "@priority:P3", "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Switch to My Classifications tab
    await page.getByTestId("tab-classified").click();

    // Select UNDER_REVIEW — no mock data has this status
    await page.getByTestId("filter-classification-status").selectOption("UNDER_REVIEW");

    // Should show empty state or zero results
    await expect(page.getByText("Alcaldía de Medellín")).not.toBeVisible();
    await expect(page.getByText("Gobernación del Valle")).not.toBeVisible();
  });
});
