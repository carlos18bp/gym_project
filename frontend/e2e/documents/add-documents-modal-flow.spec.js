import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * Regression coverage for fix 1.5 — AddDocumentsModal uses a table layout
 * (not a grid of cards). Opened from FolderDetailsModalTable → "Agregar
 * documentos". The table must expose columns Documento / Estado / Etiquetas.
 */

test.describe("AddDocumentsModal table view", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:lawyer'] }, () => {
  test("lawyer opens AddDocumentsModal from folder and sees table headers", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9800;
    const availableDoc = buildMockDocument({
      id: 9801,
      title: "Contrato Disponible Para Carpeta",
      state: "Completed",
      createdBy: userId,
      assignedTo: userId,
    });

    const folder = buildMockFolder({
      id: 9810,
      name: "Carpeta Destino",
      colorId: 1,
      documents: [],
    });

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      documents: [availableDoc],
      folders: [folder],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: userId,
        role: "lawyer",
        is_gym_lawyer: true,
        is_profile_completed: true,
      },
    });

    await page.goto("/dynamic_document_dashboard");

    // Open Carpetas tab and click the folder → FolderDetailsModalTable opens.
    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByText("Carpeta Destino")).toBeVisible({ timeout: 10_000 });
    await page.getByText("Carpeta Destino", { exact: true }).click();

    await expect(page.getByTestId("folder-details-modal")).toBeVisible({ timeout: 10_000 });

    // Click "Agregar documentos" (empty-state button since the folder has no docs).
    await page
      .getByTestId("folder-details-modal")
      .getByRole("button", { name: /Agregar documentos/i })
      .first()
      .click();

    const modal = page.getByTestId("add-documents-modal");
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Regression assertion: table headers for Documento / Estado / Etiquetas
    // must be present (columnheader role). This guards against reverting to
    // the old card-grid layout.
    await expect(modal.getByRole("columnheader", { name: "Documento" })).toBeVisible();
    await expect(modal.getByRole("columnheader", { name: "Estado" })).toBeVisible();
    await expect(modal.getByRole("columnheader", { name: "Etiquetas" })).toBeVisible();

    // Card-grid layout would use role="article" or similar; ensure nothing
    // of the sort is present inside the modal.
    await expect(modal.getByRole("article")).toHaveCount(0);
  });
});
