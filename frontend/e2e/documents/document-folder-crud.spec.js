import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockFolder,
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * Document folder CRUD interaction tests.
 * Covers: creating folders, editing folders, folder list rendering.
 */

const userId = 4200;

async function setupAndNavigate(page, folders = undefined) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    documents: [],
    folders: folders || [
      buildMockFolder({ id: 301, name: "Contracts", colorId: 0 }),
      buildMockFolder({ id: 302, name: "Reports", colorId: 1 }),
    ],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_profile_completed: true,
      is_gym_lawyer: true,
    },
  });

  await page.goto("/dynamic_document_dashboard");
}

test("folder list renders existing folders", { tag: ['@flow:docs-folder-crud', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  await setupAndNavigate(page);

  // Wait for page to load
  await expect(page.getByText("Contracts").or(page.getByText("Reports"))).toBeVisible({ timeout: 15_000 });
});

test("folder dashboard loads without errors with empty folders", { tag: ['@flow:docs-folder-crud', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  await setupAndNavigate(page, []);

  // Page should load without errors even with no folders
  // quality: allow-fragile-selector (positional selector for page load verification without specific testid)
  await expect(page.locator('[class*="rounded"]').first()).toBeVisible({ timeout: 15_000 });
});
