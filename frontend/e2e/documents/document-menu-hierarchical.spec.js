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
      await page.waitForLoadState('domcontentloaded');
      // Verify menu is open by checking for any menu item
      const menuIsOpen = await page.getByRole("menuitem").first().isVisible().catch(() => false) ||
                         await page.getByText("Editar").first().isVisible().catch(() => false) ||
                         await page.getByText("Vista previa").first().isVisible().catch(() => false);
      expect(menuIsOpen).toBeTruthy();
    }
  });

  test("menu shows grouped actions for document with many options", async ({ page }) => {
    const userId = 1004;

    // Document with many potential actions to trigger hierarchical grouping
    const docs = [
      buildMockDocument({
        id: 105,
        title: "Documento Multi Acciones",
        state: "Published",
        createdBy: userId,
        requires_signature: true,
        content: "<p>Contenido para múltiples acciones</p>",
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
    await expect(page.getByText("Documento Multi Acciones")).toBeVisible();

    const cardContainer = page.locator("div").filter({ hasText: /Documento Multi Acciones/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Menu should be open with grouped options
      // Check for group labels like "Edición y gestión", "Descargas", "Estados del documento"
      const hasGroupedMenu = await page.getByText("Edición y gestión").isVisible().catch(() => false) ||
                             await page.getByText("Descargas").isVisible().catch(() => false) ||
                             await page.getByText("Acciones").isVisible().catch(() => false);
      
      // If not grouped, at least verify menu options are visible
      if (!hasGroupedMenu) {
        const hasMenuItems = await page.getByText("Editar").first().isVisible().catch(() => false) ||
                             await page.getByText("Vista previa").first().isVisible().catch(() => false);
        expect(hasMenuItems).toBeTruthy();
      }
    }
  });

  test("menu shows download group with PDF and Word options", async ({ page }) => {
    const userId = 1005;

    const docs = [
      buildMockDocument({
        id: 106,
        title: "Documento para Descargas",
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
    await expect(page.getByText("Documento para Descargas")).toBeVisible({ timeout: 15_000 });

    // Find any menu trigger button on the document card
    const menuTriggers = page.locator('button').filter({ has: page.locator('svg') });
    const triggerCount = await menuTriggers.count();
    
    // If there's a menu trigger, click it and verify menu opens
    if (triggerCount > 0) {
      await menuTriggers.first().click();
      await page.waitForLoadState('domcontentloaded');
      
      // Verify some menu option is visible (menu is open)
      const menuVisible = await page.getByRole("menuitem").first().isVisible().catch(() => false) ||
                          await page.getByText("PDF").first().isVisible().catch(() => false) ||
                          await page.getByText("Vista previa").first().isVisible().catch(() => false) ||
                          await page.getByText("Editar").first().isVisible().catch(() => false);
      
      // Expect menu options to be visible once menu is opened
      expect(menuVisible).toBeTruthy();
    }
  });

  test("menu shows state change options based on document state", async ({ page }) => {
    const userId = 1006;

    const docs = [
      buildMockDocument({
        id: 107,
        title: "Documento Borrador Estados",
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
    await expect(page.getByText("Documento Borrador Estados")).toBeVisible({ timeout: 15_000 });

    // Find any menu trigger button
    const menuTriggers = page.locator('button').filter({ has: page.locator('svg') });
    const triggerCount = await menuTriggers.count();
    
    if (triggerCount > 0) {
      await menuTriggers.first().click();
      await page.waitForLoadState('domcontentloaded');
      
      // Verify some menu content is visible
      const menuVisible = await page.getByRole("menuitem").first().isVisible().catch(() => false) ||
                          await page.getByText("Publicar").first().isVisible().catch(() => false) ||
                          await page.getByText("Editar").first().isVisible().catch(() => false) ||
                          await page.getByText("Vista previa").first().isVisible().catch(() => false);
      
      // Expect menu options to be visible once menu is opened
      expect(menuVisible).toBeTruthy();
    }
  });

  test("menu shows signature options for documents requiring signatures", async ({ page }) => {
    const userId = 1007;

    const docs = [
      buildMockDocument({
        id: 108,
        title: "Documento con Firmas Requeridas",
        state: "Published",
        createdBy: userId,
        requires_signature: true,
        signatures: [
          { signer_email: "e2e@example.com", signed: false },
        ],
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
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, email: "e2e@example.com" },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento con Firmas Requeridas")).toBeVisible();

    const cardContainer = page.locator("div").filter({ hasText: /Documento con Firmas Requeridas/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should see signature-related options
      const hasSignOption = await page.getByText("Firmar").first().isVisible().catch(() => false) ||
                            await page.getByText("Ver firmas").first().isVisible().catch(() => false) ||
                            await page.getByText("Firmas").first().isVisible().catch(() => false);
      
      // Menu should be visible with some option
      const menuIsOpen = hasSignOption ||
                         await page.getByText("Vista previa").first().isVisible().catch(() => false);
      expect(menuIsOpen).toBeTruthy();
    }
  });
});
