import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * Deep coverage for cards/index.js (20.8%), menuGroupHelpers.js (2.9%),
 * menuOptionsHelper.js, HierarchicalMenu.vue (26.3%),
 * BaseDocumentCard.vue (31.3%), DocumentCard.vue (13.6%),
 * FolderCard.vue (24.3%), UseDocumentCard.vue (11.9%).
 *
 * Strategy: trigger DocumentActionsModal with documents in various states
 * to exercise all menu option groups (editing, downloads, communication,
 * states, signatures, actions). Also test folder detail card rendering.
 */

const lawyerAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

test("Published document actions show download, email, and draft options in published path", async ({ page }) => {
  const userId = 9810;

  const doc = buildMockDocument({
    id: 601,
    title: "Contrato Publicado Full",
    state: "Published",
    createdBy: userId,
    content: "<p>Contenido del contrato publicado.</p>",
    tags: [{ id: 1, name: "Civil", color: "#3B82F6" }],
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

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Published lawyer doc should show grouped actions covering multiple menu groups:
  // Downloads group
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar Word" })).toBeVisible();
  // Communication group
  await expect(page.getByRole("button", { name: "Enviar por Email" })).toBeVisible();
  // States group
  await expect(page.getByRole("button", { name: "Mover a Borrador" })).toBeVisible();
  // Actions group
  await expect(page.getByRole("button", { name: "Previsualización" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear una Copia" })).toBeVisible();
});

test("Draft document with signature shows edit, publish, permissions, copy, preview options", async ({ page }) => {
  const userId = 9811;

  const doc = buildMockDocument({
    id: 602,
    title: "Borrador Firma Deep",
    state: "Draft",
    createdBy: userId,
    content: "<p>Borrador con firma.</p>",
    variables: [{ name_en: "client", name_es: "Cliente", field_type: "input", value: "", tooltip: "" }],
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

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Draft in legal-documents context shows an "Editar" submenu group with children
  // The modal flattens children into separate buttons
  await expect(page.getByRole("button", { name: "Actualizar nombre" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar documento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permisos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previsualización" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear una Copia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gestionar Membrete" })).toBeVisible();
});

test("folder detail modal shows document cards inside folder and folder detail rendering", async ({ page }) => {
  const userId = 9812;

  const docs = [
    buildMockDocument({ id: 603, title: "Doc en Carpeta A", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 604, title: "Doc en Carpeta B", state: "Published", createdBy: userId }),
  ];

  const folders = [
    buildMockFolder({ id: 301, name: "Carpeta Profunda", colorId: 3, documents: docs }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
    folders,
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");

  // Switch to Carpetas tab
  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Carpetas" }).click();

  // Click on folder to open detail modal
  await expect(page.getByText("Carpeta Profunda")).toBeVisible();
  await page.getByText("Carpeta Profunda", { exact: true }).click();

  // Folder detail modal should show documents
  await expect(page.getByRole("heading", { name: "Carpeta Profunda" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Doc en Carpeta A")).toBeVisible();
  await expect(page.getByText("Doc en Carpeta B")).toBeVisible();

  // Should show "Agregar documentos" button
  await expect(page.getByRole("button", { name: "Agregar documentos" }).first()).toBeVisible();
});

test("client Completed doc shows edit submenu, download, formalize, delete, and preview options", async ({ page }) => {
  const userId = 9813;

  const doc = buildMockDocument({
    id: 605,
    title: "Documento Menu Full",
    state: "Completed",
    createdBy: 100,
    assignedTo: userId,
    content: "<p>Contenido completo para menú.</p>",
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  await expect(page.getByText("Documento Menu Full")).toBeVisible({ timeout: 10_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Client Completed: editing submenu
  await expect(page.getByRole("button", { name: "Editar Formulario" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar Documento" })).toBeVisible();

  // Formalize option should be enabled for Completed docs
  const formalizeBtn = page.getByRole("button", { name: "Formalizar y Agregar Firmas" });
  await expect(formalizeBtn).toBeVisible();
  await expect(formalizeBtn).toBeEnabled();

  // Download options
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();

  // Actions group
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
});

test("client Progress document shows disabled formalize and disabled download options", async ({ page }) => {
  const userId = 9814;

  const doc = buildMockDocument({
    id: 606,
    title: "Doc Progreso Menu",
    state: "Progress",
    createdBy: 100,
    assignedTo: userId,
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  await expect(page.getByText("Doc Progreso Menu")).toBeVisible({ timeout: 10_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Completar should be visible (simple edit for Progress)
  await expect(page.getByRole("button", { name: "Completar" })).toBeVisible();

  // Formalize should be disabled for Progress docs
  const formalizeBtn = page.getByRole("button", { name: "Formalizar y Agregar Firmas" });
  await expect(formalizeBtn).toBeVisible();
  await expect(formalizeBtn).toBeDisabled();

  // Download PDF should be visible but disabled for Progress
  const downloadBtn = page.getByRole("button", { name: "Descargar PDF" });
  await expect(downloadBtn).toBeVisible();
  await expect(downloadBtn).toBeDisabled();

  // Preview should be visible
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
});
