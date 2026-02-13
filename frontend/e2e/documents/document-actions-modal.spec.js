import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer clicks a Draft document row and sees actions modal with edit, publish, delete options", async ({ page }) => {
  const userId = 9100;

  const docs = [
    buildMockDocument({
      id: 3001,
      title: "Minuta Borrador Alpha",
      state: "Draft",
      createdBy: userId,
      tags: [{ id: 1, name: "Civil", color: "#3B82F6" }],
      variables: [{ name_es: "Nombre", name_en: "Name", tooltip: "", field_type: "text", value: "" }],
    }),
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

  // Click the document row to open DocumentActionsModal
  await page.locator('table tbody tr').first().click();

  // Verify the modal opens with heading and document title in subtitle
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Verify action buttons for a Draft lawyer document
  await expect(page.getByRole("button", { name: "Previsualización" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permisos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear una Copia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gestionar Membrete" })).toBeVisible();
});

test("lawyer clicks a Published document row and sees download/draft options", async ({ page }) => {
  const userId = 9101;

  const docs = [
    buildMockDocument({
      id: 3011,
      title: "Contrato Publicado Beta",
      state: "Published",
      createdBy: userId,
      content: "<p>Contenido del contrato</p>",
    }),
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

  await page.locator('table tbody tr').first().click();

  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Published documents should show "Mover a Borrador" and download options
  await expect(page.getByRole("button", { name: "Mover a Borrador" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar Word" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar por Email" })).toBeVisible();

});

test("client clicks a Progress document and sees complete and delete actions", async ({ page }) => {
  const userId = 9102;

  const docs = [
    buildMockDocument({
      id: 3021,
      title: "Mi Documento en Progreso",
      state: "Progress",
      createdBy: 100,
      assignedTo: userId,
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
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Client default tab is 'Carpetas' — switch to 'Mis Documentos'
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  await expect(page.getByText("Mi Documento en Progreso")).toBeVisible({ timeout: 15_000 });

  await page.locator('table tbody tr').first().click();

  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Client Progress document should have Completar, Eliminar, Previsualizar
  await expect(page.getByRole("button", { name: "Completar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();

  // Formalizar should be present but disabled for Progress documents
  const formalizeBtn = page.getByRole("button", { name: "Formalizar y Agregar Firmas" });
  await expect(formalizeBtn).toBeVisible();
  await expect(formalizeBtn).toBeDisabled();
});

test("client clicks a Completed document and sees edit submenu and formalize option", async ({ page }) => {
  const userId = 9103;

  const docs = [
    buildMockDocument({
      id: 3031,
      title: "Documento Completado Cliente",
      state: "Completed",
      createdBy: 100,
      assignedTo: userId,
      content: "<p>Contenido completo</p>",
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
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Client default tab is 'Carpetas' — switch to 'Mis Documentos'
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  await expect(page.getByText("Documento Completado Cliente")).toBeVisible({ timeout: 15_000 });

  await page.locator('table tbody tr').first().click();

  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Completed client documents should have:
  // - Edit submenu with "Editar Formulario" and "Editar Documento"
  await expect(page.getByRole("button", { name: "Editar Formulario" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar Documento" })).toBeVisible();

  // - Formalizar enabled for Completed documents
  const formalizeBtn = page.getByRole("button", { name: "Formalizar y Agregar Firmas" });
  await expect(formalizeBtn).toBeVisible();
  await expect(formalizeBtn).toBeEnabled();

  // - Download options
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
});
