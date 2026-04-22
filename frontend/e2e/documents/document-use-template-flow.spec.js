import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("UseDocumentCard: template selection and use flow", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, () => {
  test("client can view published templates in Nuevo Documento section", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 900;

    const docs = [
      buildMockDocument({
        id: 201,
        title: "Plantilla Contrato",
        state: "Published",
        createdBy: 999, // lawyer
        assignedTo: null,
      }),
      buildMockDocument({
        id: 202,
        title: "Plantilla Poder",
        state: "Published",
        createdBy: 999,
        assignedTo: null,
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on Nuevo Documento button
    await page.getByRole("button", { name: "Nuevo Documento" }).click();

    // Verify templates are visible
    await expect(page.getByText("Plantilla Contrato")).toBeVisible();
    await expect(page.getByText("Plantilla Poder")).toBeVisible();
  });

  test("client can select a template via actions modal and see name input", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 901;

    const docs = [
      buildMockDocument({
        id: 301,
        title: "Plantilla de Prueba",
        state: "Published",
        createdBy: 999,
        assignedTo: null,
        variables: [
          { name_en: "name", name_es: "Nombre", field_type: "input", value: "" },
        ],
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();
    await expect(page.getByText("Plantilla de Prueba")).toBeVisible();

    // Click on the template row → actions modal opens
    await page.getByText("Plantilla de Prueba", { exact: true }).click();
    await expect(page.getByTestId("document-actions-modal")).toBeVisible();

    // Click "Usar plantilla" in the actions modal
    await page.getByTestId("document-action-useTemplate").click();

    // Name input should appear
    const nameInput = page.locator("#document-name"); // quality: allow-fragile-selector (stable DOM id)
    await expect(nameInput).toBeVisible();
  });

  test("client can preview template with formatted variables", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 904;

    const docs = [
      buildMockDocument({
        id: 501,
        title: "Plantilla Preview",
        state: "Published",
        createdBy: 999,
        assignedTo: null,
        content: "<p>Hola {{ name }}, su contrato es por {{ unknown_field }}</p>",
        variables: [
          { name_en: "name", name_es: "Nombre", field_type: "input", value: "" },
        ],
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();
    await expect(page.getByText("Plantilla Preview")).toBeVisible();

    // Click on the template row → actions modal opens
    await page.getByText("Plantilla Preview", { exact: true }).click();
    await expect(page.getByTestId("document-actions-modal")).toBeVisible();

    // Click "Previsualización" in the actions modal
    await page.getByTestId("document-action-preview").click();

    // Dashboard.vue and UseDocumentTable.vue both mount DocumentPreviewModal
    // keyed on the shared showPreviewModal state, so two instances exist in DOM.
    await expect(page.getByTestId("document-preview-modal").first()).toBeVisible();
    await expect(page.getByTestId("document-preview-heading").first()).toContainText("Plantilla Preview");

    // Known variable should appear as pill with Spanish name
    const previewContent = page.getByTestId("document-preview-content").first();
    await expect(previewContent).toContainText("Nombre");

    // Unknown variable should appear as bracketed text
    await expect(previewContent).toContainText("[unknown_field]");
  });

  test("client can go back from template selection", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 902;

    const docs = [
      buildMockDocument({
        id: 401,
        title: "Plantilla Alpha",
        state: "Published",
        createdBy: 999,
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();
    await expect(page.getByRole("button", { name: "Volver a Mis Documentos" })).toBeVisible();

    // Click back button
    await page.getByRole("button", { name: "Volver a Mis Documentos" }).click();

    // Should be back to main view
    await expect(page.getByRole("button", { name: "Nuevo Documento" })).toBeVisible();
  });

  test("client sees empty state when no templates available", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 903;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();

    // Should show the templates view (may be empty or show back button)
    await expect(page.getByRole("button", { name: "Volver a Mis Documentos" })).toBeVisible();
  });
});
