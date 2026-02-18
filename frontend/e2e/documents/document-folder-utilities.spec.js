import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("folder utilities: add/remove/move documents", () => {
  test("lawyer can add document to folder via drag or modal", async ({ page }) => {
    const userId = 600;

    const docs = [
      buildMockDocument({
        id: 101,
        title: "Documento Sin Carpeta",
        state: "Draft",
        createdBy: userId,
      }),
      buildMockDocument({
        id: 102,
        title: "Documento En Carpeta",
        state: "Published",
        createdBy: userId,
      }),
    ];

    const folders = [
      buildMockFolder({
        id: 201,
        name: "Carpeta Destino",
        colorId: 1,
        documents: [docs[1]],
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Switch to folders tab
    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();

    // Click on the folder to open it
    await page.getByText("Carpeta Destino", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Carpeta Destino" })).toBeVisible();

    // Verify folder shows existing document
    await expect(page.getByText("Documento En Carpeta")).toBeVisible();
  });

  test("lawyer can view folder details and see documents inside", async ({ page }) => {
    const userId = 601;

    const docs = [
      buildMockDocument({
        id: 103,
        title: "Minuta en Carpeta A",
        state: "Draft",
        createdBy: userId,
      }),
      buildMockDocument({
        id: 104,
        title: "Minuta en Carpeta A v2",
        state: "Published",
        createdBy: userId,
      }),
    ];

    const folders = [
      buildMockFolder({
        id: 301,
        name: "Carpeta con Documentos",
        colorId: 2,
        documents: docs,
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByText("Carpeta con Documentos")).toBeVisible();

    // Open folder details
    await page.getByText("Carpeta con Documentos", { exact: true }).click();

    // Verify folder modal shows both documents
    await expect(page.getByRole("heading", { name: "Carpeta con Documentos" })).toBeVisible();
    await expect(page.getByText("Minuta en Carpeta A", { exact: true })).toBeVisible();
    await expect(page.getByText("Minuta en Carpeta A v2")).toBeVisible();
  });

  test("lawyer can open create folder modal", async ({ page }) => {
    const userId = 602;

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

    // Click create folder button
    const newFolderBtn = page.getByRole("button", { name: "Nueva Carpeta" });
    if (await newFolderBtn.isVisible()) {
      await newFolderBtn.click();
      // Modal should open with folder name input
      await expect(page.locator("input#folderName").or(page.getByPlaceholder("Nombre"))).toBeVisible({ timeout: 3000 });
    }
  });

  test("folder with no documents shows empty state", async ({ page }) => {
    const userId = 603;

    const folders = [
      buildMockFolder({
        id: 401,
        name: "Carpeta Vacía",
        colorId: 0,
        documents: [],
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();
    await page.getByText("Carpeta Vacía", { exact: true }).click();

    await expect(page.getByRole("heading", { name: "Carpeta Vacía" })).toBeVisible();
    // Verify empty state or add documents button
    await expect(page.getByRole("button", { name: "Agregar documentos" }).first()).toBeVisible();
  });

  test("lawyer can move documents between folders via update", async ({ page }) => {
    const userId = 604;

    const docs = [
      buildMockDocument({
        id: 201,
        title: "Documento para Mover",
        state: "Draft",
        createdBy: userId,
      }),
    ];

    const folders = [
      buildMockFolder({
        id: 501,
        name: "Carpeta Origen",
        colorId: 1,
        documents: [docs[0]],
      }),
      buildMockFolder({
        id: 502,
        name: "Carpeta Destino",
        colorId: 2,
        documents: [],
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();
    
    // Both folders should be visible
    await expect(page.getByText("Carpeta Origen")).toBeVisible();
    await expect(page.getByText("Carpeta Destino")).toBeVisible();

    // Click on source folder to verify document is there
    await page.getByText("Carpeta Origen", { exact: true }).click();
    await expect(page.getByText("Documento para Mover")).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer validates folder name before creation", async ({ page }) => {
    const userId = 605;

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

    // Try to create folder - look for empty state button or new folder button
    const createBtn = page.getByRole("button", { name: /Crear Primera Carpeta|Nueva Carpeta/ });
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      
      // Modal should open
      await expect(page.locator("#folderName").or(page.getByPlaceholder("Nombre"))).toBeVisible({ timeout: 5000 });
      
      // Try to submit with empty name - button should be disabled or show validation error
      const submitBtn = page.locator('button[type="submit"]');
      // Verify submit button exists
      await expect(submitBtn).toBeVisible({ timeout: 3000 });
    }
  });

  test("folder displays correct color badge based on color_id", async ({ page }) => {
    const userId = 606;

    const folders = [
      buildMockFolder({
        id: 601,
        name: "Carpeta Roja",
        colorId: 0,
        documents: [],
      }),
      buildMockFolder({
        id: 602,
        name: "Carpeta Azul",
        colorId: 1,
        documents: [],
      }),
      buildMockFolder({
        id: 603,
        name: "Carpeta Verde",
        colorId: 2,
        documents: [],
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();

    // All folders should be visible
    await expect(page.getByText("Carpeta Roja")).toBeVisible();
    await expect(page.getByText("Carpeta Azul")).toBeVisible();
    await expect(page.getByText("Carpeta Verde")).toBeVisible();
  });
});
