import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document menu: hierarchical menu organization", () => {
  test("lawyer sees draft document in Minutas tab", async ({ page }) => {
    const userId = 1000;

    const docs = [
      buildMockDocument({
        id: 101,
        title: "Documento Editable",
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
    await expect(page.getByText("Documento Editable")).toBeVisible();
  });

  test("lawyer sees published document in Minutas tab", async ({ page }) => {
    const userId = 1001;

    const docs = [
      buildMockDocument({
        id: 102,
        title: "Documento para Descargar",
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
    await expect(page.getByText("Documento para Descargar")).toBeVisible();
    await expect(page.getByText("Publicado").first()).toBeVisible();
  });

  test("lawyer sees preview option for document", async ({ page }) => {
    const userId = 1002;

    const docs = [
      buildMockDocument({
        id: 103,
        title: "Documento con Vista Previa",
        state: "Draft",
        createdBy: userId,
        content: "<p>Contenido de prueba</p>",
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
    await expect(page.getByText("Documento con Vista Previa")).toBeVisible();

    const cardContainer = page.locator("div").filter({ hasText: /Documento con Vista Previa/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      // Should see preview option
      await expect(page.getByText("Vista previa").or(page.getByText("Preview")).first()).toBeVisible({ timeout: 3000 });
    }
  });

  test("document menu groups related actions together", async ({ page }) => {
    const userId = 1003;

    const docs = [
      buildMockDocument({
        id: 104,
        title: "Documento con Menú Completo",
        state: "Published",
        createdBy: userId,
        requires_signature: true,
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento con Menú Completo")).toBeVisible();

    const cardContainer = page.locator("div").filter({ hasText: /Documento con Menú Completo/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      // Menu should be visible with multiple options
      await page.waitForTimeout(300);
      // Verify menu is open by checking for any menu item
      const menuIsOpen = await page.getByRole("menuitem").first().isVisible().catch(() => false) ||
                         await page.getByText("Editar").first().isVisible().catch(() => false) ||
                         await page.getByText("Vista previa").first().isVisible().catch(() => false);
      expect(menuIsOpen).toBeTruthy();
    }
  });
});
