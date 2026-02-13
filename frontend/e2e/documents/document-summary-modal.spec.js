import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * Deep coverage for DocumentSummaryModal.vue (39.4%).
 * Triggered by clicking the summary icon on document rows in the list table.
 * Also covers BaseDocumentCard summary fields rendering.
 */

test("Completed document with summary fields renders in client list and opens actions modal", async ({ page }) => {
  const userId = 9820;

  const docWithSummary = buildMockDocument({
    id: 701,
    title: "Contrato con Resumen",
    state: "Completed",
    createdBy: 100,
    assignedTo: userId,
    content: "<p>Contenido completo</p>",
    summary_counterpart: "Juan Pérez García",
    summary_object: "Prestación de servicios de consultoría legal",
    summary_value: "15000000",
    summary_term: "12 meses",
    summary_subscription_date: "2025-01-15",
    summary_expiration_date: "2026-01-15",
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [docWithSummary],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Client: switch to Mis Documentos
  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  await expect(page.getByText("Contrato con Resumen")).toBeVisible({ timeout: 10_000 });

  // Click the row to open the DocumentActionsModal
  await page.locator("table tbody tr").first().click();

  // Actions modal should open with document title
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Verify Previsualizar action is available for Completed docs
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();

  // Click Previsualizar to open preview which triggers document_utils processing
  await page.getByRole("button", { name: "Previsualizar" }).click();

  // The preview modal should show the document content
  await expect(page.getByText("Contenido completo")).toBeVisible({ timeout: 10_000 });
});

test("folders grid shows empty state when no folders exist", async ({ page }) => {
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

  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Carpetas" }).click();

  // FoldersGrid/FoldersTable empty state should show
  await expect(page.getByText("No tienes carpetas aún").first()).toBeVisible({ timeout: 10_000 });

  // "Crear Primera Carpeta" or "Nueva Carpeta" button should be visible
  const createBtn = page.getByRole("button", { name: /Crear Primera Carpeta|Nueva Carpeta/i }).first();
  await expect(createBtn).toBeVisible();
});

test("document dashboard shows search results filtered by title on Minutas tab", async ({ page }) => {
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
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Minutas" }).click();

  // All 3 docs should be visible
  await expect(page.getByText("Contrato Laboral")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Poder General")).toBeVisible();
  await expect(page.getByText("Acta de Reunión")).toBeVisible();

  // Search for "Contrato"
  const searchInput = page.getByPlaceholder("Buscar...");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("Contrato");

  // Only "Contrato Laboral" should remain visible
  await expect(page.getByText("Contrato Laboral")).toBeVisible();
  await expect(page.getByText("Poder General")).toBeHidden();
  await expect(page.getByText("Acta de Reunión")).toBeHidden();
});
