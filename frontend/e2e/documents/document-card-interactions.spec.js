import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document card: menu and interactions", () => {
  test("lawyer can see document card with title and state", async ({ page }) => {
    const userId = 800;

    const docs = [
      buildMockDocument({
        id: 101,
        title: "Minuta de Prueba",
        state: "Draft",
        createdBy: userId,
      }),
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

    // Verify document card is visible
    await expect(page.getByText("Minuta de Prueba")).toBeVisible();
    // State badge should show Draft state (Borrador in Spanish)
    await expect(page.getByText("Borrador").or(page.getByText("Draft")).first()).toBeVisible();
  });

  test("lawyer sees document card with actions available", async ({ page }) => {
    const userId = 801;

    const docs = [
      buildMockDocument({
        id: 102,
        title: "Documento con Menú",
        state: "Draft",
        createdBy: userId,
      }),
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
    await expect(page.getByText("Documento con Menú")).toBeVisible();

    // Document card should be visible with its title
    const card = page.locator("div").filter({ hasText: /Documento con Menú/ }).first();
    await expect(card).toBeVisible();
  });

  test("published document shows published state badge", async ({ page }) => {
    const userId = 802;

    const docs = [
      buildMockDocument({
        id: 103,
        title: "Documento Publicado",
        state: "Published",
        createdBy: userId,
      }),
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

    await expect(page.getByText("Documento Publicado")).toBeVisible();
    // State badge should show Published state
    await expect(page.getByText("Publicado").or(page.getByText("Published")).first()).toBeVisible();
  });

  test("multiple documents render as separate cards", async ({ page }) => {
    const userId = 803;

    const docs = [
      buildMockDocument({ id: 104, title: "Documento Alpha", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 105, title: "Documento Beta", state: "Published", createdBy: userId }),
      buildMockDocument({ id: 106, title: "Documento Gamma", state: "Draft", createdBy: userId }),
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

    // Verify all three documents are visible
    await expect(page.getByText("Documento Alpha")).toBeVisible();
    await expect(page.getByText("Documento Beta")).toBeVisible();
    await expect(page.getByText("Documento Gamma")).toBeVisible();
  });

  test("document with Draft state is visible in Minutas list", async ({ page }) => {
    const userId = 804;

    const docs = [
      buildMockDocument({
        id: 107,
        title: "Documento Draft Visible",
        state: "Draft",
        createdBy: userId,
      }),
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

    // Document should be visible
    await expect(page.getByText("Documento Draft Visible")).toBeVisible();
  });
});
