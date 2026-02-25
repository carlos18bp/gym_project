import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("dashboard: lawyer view", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, () => {
  test("lawyer sees dashboard after login", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8000;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard should load
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("lawyer dashboard has navigation tabs", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8001;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Navigation tabs should be present
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible();
  });

  test("lawyer can access Minutas section", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8002;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
  });

  test("lawyer can access Carpetas section", { tag: ['@flow:dashboard-welcome-card', '@module:dashboard', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 8003;

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
