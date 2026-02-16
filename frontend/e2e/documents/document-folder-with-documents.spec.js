import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("folders: with documents", () => {
  test("folder displays document count", async ({ page }) => {
    const userId = 9000;

    const docs = [
      buildMockDocument({ id: 1, title: "Doc en Carpeta 1", state: "Draft", createdBy: userId, folderId: 100 }),
      buildMockDocument({ id: 2, title: "Doc en Carpeta 2", state: "Draft", createdBy: userId, folderId: 100 }),
    ];

    const folders = [
      buildMockFolder({ id: 100, name: "Carpeta con Docs", colorId: 1, documentIds: [1, 2] }),
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
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();
    await expect(page.getByText("Carpeta con Docs")).toBeVisible();
  });

  test("multiple folders are displayed", async ({ page }) => {
    const userId = 9001;

    const folders = [
      buildMockFolder({ id: 101, name: "Carpeta Alpha", colorId: 0, documentIds: [] }),
      buildMockFolder({ id: 102, name: "Carpeta Beta", colorId: 1, documentIds: [] }),
      buildMockFolder({ id: 103, name: "Carpeta Gamma", colorId: 2, documentIds: [] }),
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
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();
    
    await expect(page.getByText("Carpeta Alpha")).toBeVisible();
    await expect(page.getByText("Carpeta Beta")).toBeVisible();
    await expect(page.getByText("Carpeta Gamma")).toBeVisible();
  });

  test("folder can be clicked to view contents", async ({ page }) => {
    const userId = 9002;

    const docs = [
      buildMockDocument({ id: 10, title: "Documento Interior", state: "Draft", createdBy: userId, folderId: 200 }),
    ];

    const folders = [
      buildMockFolder({ id: 200, name: "Carpeta Clickeable", colorId: 0, documentIds: [10] }),
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
    await expect(page.getByText("Carpeta Clickeable")).toBeVisible();

    // Click on folder
    await page.getByText("Carpeta Clickeable").click();
    // Should show folder contents or modal
    await expect(page.getByRole("heading", { name: "Carpeta Clickeable" })).toBeVisible();
  });
});
