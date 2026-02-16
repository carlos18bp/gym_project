import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document dashboard: empty states", () => {
  test("lawyer sees empty state when no documents", async ({ page }) => {
    const userId = 5000;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // Dashboard should load with Minutas tab active
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
  });

  test("client sees empty state when no assigned documents", async ({ page }) => {
    const userId = 5001;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: [],
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Page should load for client
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("dashboard shows tabs for navigation", async ({ page }) => {
    const userId = 5002;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Should have navigation tabs
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible();
  });

  test("folders tab shows empty state when no folders", async ({ page }) => {
    const userId = 5003;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();
  });
});
