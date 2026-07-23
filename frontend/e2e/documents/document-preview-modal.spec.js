import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import {
  closeDocumentPreview,
  openDocumentActionsModal,
  openDocumentPreviewFromActions,
} from "../helpers/documentActions.js";

const buildLawyerAuth = ({ userId }) => ({
  token: "e2e-token",
  userAuth: {
    id: userId,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
});

async function setupLawyerDashboard(page, { userId, documents }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
    documents,
    folders: [],
  });

  await setAuthLocalStorage(page, buildLawyerAuth({ userId }));
  await page.goto("/dynamic_document_dashboard");
}

test.describe("DocumentPreviewModal", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("lawyer opens document preview and sees title and content", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3000;
    const docId = 201;
    const docTitle = "Contrato de Prueba";
    const docContent = "<p>Este es el contenido del contrato de prueba.</p>";

    await setupLawyerDashboard(page, {
      userId,
      documents: [
        buildMockDocument({
          id: docId,
          title: docTitle,
          state: "Draft",
          createdBy: userId,
          content: docContent,
        }),
      ],
    });

    await openDocumentActionsModal(page, docTitle);
    await expect(page.getByTestId("document-preview-modal")).toBeHidden();

    // Regression guard for fix 1.3: opening the preview must hit the document
    // detail endpoint so we receive the full `content` (the list serializer
    // omits it for performance). If the fetch disappears we're back to the
    // pre-fix behaviour where content never loads.
    const detailRequest = page.waitForRequest(
      (req) =>
        req.url().includes(`dynamic-documents/${docId}/`) &&
        req.method() === "GET",
      { timeout: 10_000 }
    );
    await page.getByTestId("document-action-preview").click();
    await detailRequest;
    await expect(page.getByTestId("document-preview-modal")).toBeVisible({ timeout: 10_000 });

    const previewHeading = page.getByTestId("document-preview-heading");
    await expect(previewHeading).toBeVisible({ timeout: 10_000 });
    await expect(previewHeading).toContainText(docTitle);
    await expect(
      page.getByTestId("document-preview-content")
    ).toContainText("Este es el contenido del contrato de prueba.", { timeout: 10_000 });
  });

  test("lawyer closes document preview modal via close button", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3001;
    const docTitle = "Minuta para Cerrar";

    await setupLawyerDashboard(page, {
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
    await openDocumentPreviewFromActions(page);
    await closeDocumentPreview(page);
    await expect(page.getByTestId("document-preview-modal")).toBeHidden();
  });

  test("preview shows empty state for document without content", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3002;
    const docTitle = "Documento Sin Contenido";

    await setupLawyerDashboard(page, {
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
    await openDocumentPreviewFromActions(page);
    const previewHeading = page.getByTestId("document-preview-heading");
    await expect(previewHeading).toBeVisible({ timeout: 10_000 });
    await expect(previewHeading).toContainText(docTitle);
  });

  test("preview renders HTML content correctly", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3003;
    const docTitle = "Documento con HTML";
    const htmlContent =
      "<h3>Cláusula Primera</h3><p>Las partes acuerdan lo siguiente:</p><ul><li>Punto uno</li><li>Punto dos</li></ul>";

    await setupLawyerDashboard(page, {
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
    await expect(page.getByTestId("document-preview-content")).toBeHidden();

    await page.getByTestId("document-action-preview").click();

    await expect(page.getByTestId("document-preview-heading")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("document-preview-content")).toContainText("Cláusula Primera");
    await expect(page.getByTestId("document-preview-content")).toContainText("Las partes acuerdan lo siguiente:");
    await expect(page.getByTestId("document-preview-content")).toContainText("Punto uno");
    await expect(page.getByTestId("document-preview-content")).toContainText("Punto dos");
  });

  test("preview modal shows document title in heading", { tag: ['@flow:docs-preview', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 3004;
    const docTitle = "Minuta Título Encabezado";

    await setupLawyerDashboard(page, {
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
    await expect(page.getByTestId("document-preview-heading")).toBeHidden();

    await page.getByTestId("document-action-preview").click();

    const heading = page.getByTestId("document-preview-heading");
    await expect(heading).toBeVisible({ timeout: 10_000 });
    await expect(heading).toContainText(docTitle);
    await expect(page.getByTestId("document-preview-content")).toContainText("Contenido verificación título", { timeout: 10_000 });
  });
});
