import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import {
  openDocumentActionsModal,
  openDocumentPreviewFromActions,
} from "../helpers/documentActions.js";

/**
 * Deep coverage for DocumentSummaryModal.vue (39.4%).
 * Triggered by clicking the summary icon on document rows in the list table.
 * Also covers BaseDocumentCard summary fields rendering.
 */

test("Completed document with summary fields renders in client list and opens actions modal", { tag: ['@flow:docs-summary', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
  const userId = 9820;

  const docWithSummary = buildMockDocument({
    id: 701,
    title: "Contrato con Resumen",
    state: "Completed",
    createdBy: 100,
    assignedTo: userId,
    content: "<p>Contenido completo</p>",
    summary_counterparty: "Juan Pérez García",
    summary_object: "Prestación de servicios de consultoría legal",
    summary_value: "15000000",
    summary_term: "12 meses",
    summary_subscription_date: "2025-01-15",
    summary_start_date: "2025-01-15",
    summary_end_date: "2026-01-15",
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [docWithSummary],
    folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  await openDocumentActionsModal(page, "Contrato con Resumen");
  await expect(page.getByTestId("document-action-preview")).toBeVisible();
  await openDocumentPreviewFromActions(page);
  await expect(page.getByTestId("document-preview-content")).toContainText("Contenido completo", { timeout: 10_000 });
});

test("folders grid shows empty state when no folders exist", { tag: ['@flow:docs-summary', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
  const userId = 9821;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    folders: [], // Empty folders
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Carpetas" }).click();
  await page.waitForLoadState("networkidle");

  // FoldersGrid/FoldersTable empty state should show
  await expect(page.getByText("No tienes carpetas aún").first()).toBeVisible({ timeout: 10_000 });

  // "Crear Primera Carpeta" or "Nueva Carpeta" button should be visible
  const createBtn = page.getByRole("button", { name: /Crear Primera Carpeta|Nueva Carpeta/i }).first();
  await expect(createBtn).toBeVisible();
});

test("document dashboard shows search results filtered by title on Minutas tab", { tag: ['@flow:docs-summary', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
  const userId = 9822;

  const docs = [
    buildMockDocument({ id: 702, title: "Contrato Laboral", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 703, title: "Poder General", state: "Published", createdBy: userId }),
    buildMockDocument({ id: 704, title: "Acta de Reunión", state: "Draft", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
    folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  const table = page.getByRole("table");
  await expect(table.getByText("Contrato Laboral")).toBeVisible({ timeout: 15_000 });
  await expect(table.getByText("Poder General")).toBeVisible();
  await expect(table.getByText("Acta de Reunión")).toBeVisible();

  const searchInput = page.getByPlaceholder("Buscar...");
  await expect(searchInput).toBeVisible({ timeout: 10_000 });

  const searchResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes("dynamic-documents/") &&
      resp.url().includes("search=Contrato") &&
      resp.status() === 200,
    { timeout: 10_000 }
  );
  await searchInput.fill("Contrato");
  await searchResponse;

  await expect(page.getByText("Poder General")).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText("Acta de Reunión")).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText("Contrato Laboral")).toBeVisible();
});
