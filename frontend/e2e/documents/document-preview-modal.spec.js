import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

const buildLawyerAuth = ({ userId }) => ({
  token: "e2e-token",
  userAuth: {
    id: userId,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
});

async function openMinutasTab(page, { userId, documents }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    documents,
  });

  await setAuthLocalStorage(page, buildLawyerAuth({ userId }));
  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Minutas" }).click();
}

function getDocumentRow(page, title) {
  return page.locator("tbody tr").filter({ hasText: title });
}

async function openDocumentActionsModal(page, title) {
  const row = getDocumentRow(page, title);
  await expect(row).toBeVisible();
  await row.click();
  await expect(
    page.getByRole("heading", { name: "Acciones del Documento" })
  ).toBeVisible();
}

test.describe("DocumentPreviewModal", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("lawyer opens document preview and sees title and content", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3000;
    const docTitle = "Contrato de Prueba";
    const docContent = "<p>Este es el contenido del contrato de prueba.</p>";

    await openMinutasTab(page, {
      userId,
      documents: [
        buildMockDocument({
          id: 201,
          title: docTitle,
          state: "Draft",
          createdBy: userId,
          content: docContent,
        }),
      ],
    });

    await openDocumentActionsModal(page, docTitle);

    // Click Previsualización to open DocumentPreviewModal
    await page.getByRole("button", { name: "Previsualización" }).click();

    // Verify the preview modal renders with title and content
    const previewHeading = page.getByRole("heading", {
      name: /Previsualización del Documento/,
    });
    await expect(previewHeading).toBeVisible();
    await expect(previewHeading).toContainText(docTitle);
    await expect(
      page.getByText("Este es el contenido del contrato de prueba.")
    ).toBeVisible();
  });

  test("lawyer closes document preview modal via close button", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3001;
    const docTitle = "Minuta para Cerrar";

    await openMinutasTab(page, {
      userId,
      documents: [
        buildMockDocument({
          id: 202,
          title: docTitle,
          state: "Published",
          createdBy: userId,
          content: "<p>Contenido de la minuta</p>",
        }),
      ],
    });

    await openDocumentActionsModal(page, docTitle);
    await page.getByRole("button", { name: "Previsualización" }).click();

    await expect(
      page.getByRole("heading", { name: /Previsualización del Documento/ })
    ).toBeVisible();

    // Close the preview modal via the X button
    const previewHeading = page.getByRole("heading", {
      name: /Previsualización del Documento/,
    });
    const closeButton = previewHeading
      .locator("xpath=ancestor::div[1]")
      .getByRole("button");
    await closeButton.click();

    // Verify the preview modal is dismissed
    await expect(
      page.getByRole("heading", { name: /Previsualización del Documento/ })
    ).toHaveCount(0);
  });

  test("preview shows empty state for document without content", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3002;
    const docTitle = "Documento Sin Contenido";

    await openMinutasTab(page, {
      userId,
      documents: [
        buildMockDocument({
          id: 203,
          title: docTitle,
          state: "Draft",
          createdBy: userId,
          content: "",
        }),
      ],
    });

    await openDocumentActionsModal(page, docTitle);
    await page.getByRole("button", { name: "Previsualización" }).click();

    // Modal should still render with the document title even if content is empty
    const previewHeading = page.getByRole("heading", {
      name: /Previsualización del Documento/,
    });
    await expect(previewHeading).toBeVisible();
    await expect(previewHeading).toContainText(docTitle);
  });

  test("preview renders HTML content correctly", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3003;
    const docTitle = "Documento con HTML";
    const htmlContent =
      "<h3>Cláusula Primera</h3><p>Las partes acuerdan lo siguiente:</p><ul><li>Punto uno</li><li>Punto dos</li></ul>";

    await openMinutasTab(page, {
      userId,
      documents: [
        buildMockDocument({
          id: 204,
          title: docTitle,
          state: "Published",
          createdBy: userId,
          content: htmlContent,
        }),
      ],
    });

    await openDocumentActionsModal(page, docTitle);
    await page.getByRole("button", { name: "Previsualización" }).click();

    await expect(
      page.getByRole("heading", { name: /Previsualización del Documento/ })
    ).toBeVisible();

    // Verify that the rendered HTML includes expected text elements
    await expect(page.getByText("Cláusula Primera")).toBeVisible();
    await expect(
      page.getByText("Las partes acuerdan lo siguiente:")
    ).toBeVisible();
    await expect(page.getByText("Punto uno")).toBeVisible();
    await expect(page.getByText("Punto dos")).toBeVisible();
  });

  test("preview modal shows document title in heading", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3004;
    const docTitle = "Minuta Título Encabezado";

    await openMinutasTab(page, {
      userId,
      documents: [
        buildMockDocument({
          id: 205,
          title: docTitle,
          state: "Published",
          createdBy: userId,
          content: "<p>Contenido verificación título</p>",
        }),
      ],
    });

    await openDocumentActionsModal(page, docTitle);
    await page.getByRole("button", { name: "Previsualización" }).click();

    // The heading should contain the document title
    const heading = page.getByRole("heading", { name: /Previsualización del Documento/ });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(docTitle);

    // Content should also be rendered
    await expect(page.getByText("Contenido verificación título")).toBeVisible();
  });
});
