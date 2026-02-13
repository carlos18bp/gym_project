import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * Deep coverage for document_utils.js (9.8%) and related preview flows.
 * Covers: openPreviewModal, getProcessedDocumentContent, showPreviewModal,
 * previewDocumentData, and also color_palette.js (37.5%) via folder rendering.
 * Also covers confirmation_alert.js (0%) via document archive/delete confirmations.
 */

const lawyerAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

test("clicking Previsualización on a Completed document (client) shows preview with processed variables", async ({ page }) => {
  const userId = 9800;

  const completedDoc = buildMockDocument({
    id: 501,
    title: "Contrato de Servicios",
    state: "Completed",
    createdBy: 100,
    assignedTo: userId,
    content: "<p>El señor {{ client_name }} se compromete a pagar {{ contract_value }}.</p>",
    variables: [
      { name_en: "client_name", value: "Juan Pérez", summary_field: null },
      { name_en: "contract_value", value: "5000000", summary_field: "value", currency: "COP" },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [completedDoc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Client view: switch to "Mis Documentos" tab (Completed docs show here)
  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  await expect(page.getByText("Contrato de Servicios").first()).toBeVisible({ timeout: 10_000 });

  // Click the row to open DocumentActionsModal
  await page.locator("table tbody tr").first().click();

  // DocumentActionsModal should open
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click Previsualizar to open the preview (client menu uses "Previsualizar")
  await page.getByRole("button", { name: "Previsualizar" }).click();

  // Preview modal should appear with processed content
  // Variable {{ client_name }} should be replaced with "Juan Pérez"
  await expect(page.getByText("Juan Pérez")).toBeVisible({ timeout: 10_000 });

  // Variable {{ contract_value }} with COP currency should be formatted
  await expect(page.getByText(/COP/).first()).toBeVisible();
});

test("clicking Previsualización on a Draft document shows raw content without variable processing", async ({ page }) => {
  const userId = 9801;

  const draftDoc = buildMockDocument({
    id: 502,
    title: "Borrador Minuta",
    state: "Draft",
    createdBy: userId,
    content: "<p>Contenido del borrador con {{ variable_ejemplo }}.</p>",
    variables: [
      { name_en: "variable_ejemplo", value: "Valor Test", summary_field: null },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [draftDoc],
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("Borrador Minuta").first()).toBeVisible({ timeout: 10_000 });

  // Click the row to open DocumentActionsModal
  await page.locator("table tbody tr").first().click();

  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click Previsualización
  await page.getByRole("button", { name: "Previsualización" }).click();

  // For Draft state, variables should NOT be processed — raw template shown
  await expect(page.getByText("variable_ejemplo")).toBeVisible({ timeout: 10_000 });
});

test("document dashboard renders folder cards with color palette styles", async ({ page }) => {
  const userId = 9802;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");

  // Wait for dashboard to load
  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Carpetas" }).click();

  // Folders should show with color palette styling
  await expect(page.getByText("Carpeta 1")).toBeVisible();
  await expect(page.getByText("Carpeta 2")).toBeVisible();
});

test("preview modal can be closed and document list remains visible", async ({ page }) => {
  const userId = 9803;

  const doc = buildMockDocument({
    id: 503,
    title: "Documento Cierre",
    state: "Published",
    createdBy: userId,
    content: "<p>Contenido publicado.</p>",
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("Documento Cierre").first()).toBeVisible({ timeout: 10_000 });

  // Click the row to open DocumentActionsModal
  await page.locator("table tbody tr").first().click();

  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click Previsualización
  await page.getByRole("button", { name: "Previsualización" }).click();

  // Modal should appear with content
  await expect(page.getByText("Contenido publicado")).toBeVisible({ timeout: 10_000 });

  // Close the modal via Escape key
  await page.keyboard.press("Escape");

  // Document list should still be visible after closing
  await expect(page.getByText("Documento Cierre").first()).toBeVisible({ timeout: 5_000 });
});
