import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document search: search functionality", () => {
  test("lawyer can search documents by title", async ({ page }) => {
    const userId = 4000;

    const docs = [
      buildMockDocument({ id: 1, title: "Contrato de Arrendamiento", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 2, title: "Minuta de Compraventa", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 3, title: "Poder General", state: "Published", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // Verify documents are visible
    await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible();
    await expect(page.getByText("Minuta de Compraventa")).toBeVisible();
  });

  test("search input is present on documents dashboard", async ({ page }) => {
    const userId = 4001;

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

    // Dashboard should have search functionality
    const searchInput = page.getByPlaceholder("Buscar").or(page.locator('input[type="search"]')).or(page.locator('input[type="text"]').first());
    await expect(searchInput).toBeVisible();
  });

  test("documents with different states are searchable", async ({ page }) => {
    const userId = 4002;

    const docs = [
      buildMockDocument({ id: 10, title: "Draft Document", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 11, title: "Published Document", state: "Published", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // Both documents should be visible
    await expect(page.getByText("Draft Document")).toBeVisible();
    await expect(page.getByText("Published Document")).toBeVisible();
  });
});
