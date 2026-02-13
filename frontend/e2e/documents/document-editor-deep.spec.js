import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDocumentEditorApiMocks,
  installTinyMceCloudStub,
} from "../helpers/documentEditorMocks.js";

/**
 * Deep coverage for DocumentEditor.vue:
 * - Client editor view with protected variables
 * - Lawyer "Continuar" flow to variables config
 * - Empty content guard (save/continue blocked)
 * - "Regresar" button navigates back
 */

test("lawyer editor shows Continue and Return buttons", async ({ page }) => {
  const userId = 9300;
  const documentId = 301;

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "lawyer",
    documentId,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/dynamic_document_dashboard/lawyer/editor/edit/${documentId}`);

  // All three toolbar buttons should be visible for lawyers
  await expect(page.getByRole("button", { name: "Guardar como borrador" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Regresar" })).toBeVisible();
});

test("lawyer clicks Regresar and navigates back to dashboard", async ({ page }) => {
  const userId = 9301;
  const documentId = 302;

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "lawyer",
    documentId,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/dynamic_document_dashboard/lawyer/editor/edit/${documentId}`);
  await expect(page.getByRole("button", { name: "Regresar" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Regresar" }).click();

  await expect(page).toHaveURL(/\/dynamic_document_dashboard/, { timeout: 10_000 });
});

test("lawyer clicks Continuar and navigates to variables config", async ({ page }) => {
  const userId = 9302;
  const documentId = 303;

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "lawyer",
    documentId,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/dynamic_document_dashboard/lawyer/editor/edit/${documentId}`);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Continuar" }).click();

  // Should navigate to variables config
  await expect(page).toHaveURL(/\/variables-config/, { timeout: 10_000 });
});

test("client editor shows Guardar button instead of Continuar", async ({ page }) => {
  const userId = 9303;
  const documentId = 304;

  const clientDoc = {
    id: documentId,
    title: "Contrato Cliente",
    state: "Progress",
    created_by: 100,
    assigned_to: userId,
    code: `DOC-${documentId}`,
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    content: "<p>Texto del contrato con {{nombre_cliente}} y {{fecha}}</p>",
    variables: [
      { name_en: "nombre_cliente", name_es: "Nombre del cliente", value: "Juan Pérez", field_type: "input", tooltip: "", select_options: null, summary_field: "none", currency: null },
      { name_en: "fecha", name_es: "Fecha", value: "2026-01-15", field_type: "input", tooltip: "", select_options: null, summary_field: "none", currency: null },
    ],
  };

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "client",
    documentId,
    document: clientDoc,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto(`/dynamic_document_dashboard/client/editor/edit/${documentId}`);

  // Client should see "Guardar" (not "Guardar como borrador")
  await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Regresar" })).toBeVisible();

  // Client should NOT see "Guardar como borrador"
  await expect(page.getByRole("button", { name: "Guardar como borrador" })).toHaveCount(0);
});

test("lawyer saving empty document shows warning notification", async ({ page }) => {
  const userId = 9304;
  const documentId = 305;

  const emptyDoc = {
    id: documentId,
    title: "Doc Vacío",
    state: "Draft",
    created_by: userId,
    assigned_to: null,
    code: `DOC-${documentId}`,
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    content: "",
    variables: [],
  };

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "lawyer",
    documentId,
    document: emptyDoc,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/dynamic_document_dashboard/lawyer/editor/edit/${documentId}`);
  await expect(page.getByRole("button", { name: "Guardar como borrador" })).toBeVisible({ timeout: 15_000 });

  // TinyMCE stub returns empty content by default for empty docs
  await page.evaluate(() => {
    if (window.tinymce && window.tinymce.activeEditor) {
      window.tinymce.activeEditor.getContent = () => "";
    }
  });

  await page.getByRole("button", { name: "Guardar como borrador" }).click();

  // Should show warning about empty document
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("vacío");
});
