import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document dashboard: multiple documents", () => {
  test("lawyer sees multiple documents in list", async ({ page }) => {
    const userId = 6000;

    const docs = [
      buildMockDocument({ id: 1, title: "Documento Uno", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 2, title: "Documento Dos", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 3, title: "Documento Tres", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 4, title: "Documento Cuatro", state: "Draft", createdBy: userId }),
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

    // All documents should be visible
    await expect(page.getByText("Documento Uno")).toBeVisible();
    await expect(page.getByText("Documento Dos")).toBeVisible();
    await expect(page.getByText("Documento Tres")).toBeVisible();
    await expect(page.getByText("Documento Cuatro")).toBeVisible();
  });

  test("documents show correct state badges", async ({ page }) => {
    const userId = 6001;

    const docs = [
      buildMockDocument({ id: 10, title: "Draft Doc", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 11, title: "Published Doc", state: "Published", createdBy: userId }),
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

    // Should see both documents
    await expect(page.getByText("Draft Doc")).toBeVisible();
    await expect(page.getByText("Published Doc")).toBeVisible();

    // Should see state badges
    await expect(page.getByText("Borrador").first()).toBeVisible();
    await expect(page.getByText("Publicado").first()).toBeVisible();
  });

  test("lawyer can navigate between Minutas and Carpetas tabs", async ({ page }) => {
    const userId = 6002;

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

    // Click Minutas tab
    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();

    // Click Carpetas tab
    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();

    // Go back to Minutas
    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
  });
});
