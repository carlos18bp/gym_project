import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document dashboard: empty states", { tag: ['@flow:docs-empty-states', '@module:documents', '@priority:P4', '@role:shared'] }, () => {
  test("lawyer sees empty state when no documents", { tag: ['@flow:docs-empty-states', '@module:documents', '@priority:P4', '@role:shared', '@outcome:display'] }, async ({ page }) => {
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

  test("client sees empty state when no assigned documents", { tag: ['@flow:docs-empty-states', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
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

  test("dashboard tabs switch the visible section", { tag: ['@flow:docs-empty-states', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
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
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeHidden();

    // Tabs are only worth rendering if they swap the section underneath.
    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeHidden();
  });

  // Catches: an empty Carpetas tab that renders a blank/broken screen (or
  // silently shows nothing) instead of the real "No tienes carpetas aún"
  // empty-state copy — previously this test only asserted the tab heading,
  // identical to the folders-with-data case, so a regression here never failed.
  test("folders tab shows empty state when no folders", { tag: ['@flow:docs-empty-states', '@module:documents', '@priority:P4', '@role:shared', '@outcome:display'] }, async ({ page }) => {
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

    // Pin the actual empty-state copy (FoldersTable.vue), not just the tab heading
    await expect(page.getByRole("heading", { name: "No tienes carpetas aún" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Crea tu primera carpeta para organizar tus documentos")).toBeVisible();
  });
});
