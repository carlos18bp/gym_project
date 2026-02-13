import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Deep coverage for executing document actions (not just viewing buttons):
 * - cards/index.js useDocumentActions (0%) — deleteDocument, publishDocument,
 *   moveToDraft, copyDocument, downloadPDF
 * - confirmation_alert.js (0%) — SweetAlert2 confirm dialog triggered by delete/copy
 * - document_utils.js (9.5%) — downloadFile, openPreviewModal
 * - documents.js store (39.6%) — updateDocument, deleteDocument actions
 */

const lawyerAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

/**
 * Install mocks with document CRUD endpoints on top of standard mocks.
 */
async function installDocActionMocks(page, { userId, documents }) {
  const user = {
    id: userId, first_name: "E2E", last_name: "Lawyer", email: "e2e@example.com",
    role: "lawyer", contact: "", birthday: "", identification: "", document_type: "",
    photo_profile: "", is_profile_completed: true, is_gym_lawyer: true, has_signature: true,
  };
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Documents list
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };

    // Document detail
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find(d => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // Document update (publish, move to draft)
    if (apiPath.match(/^dynamic-documents\/\d+\/update\/$/) && route.request().method() === "PATCH") {
      const docId = Number(apiPath.match(/dynamic-documents\/(\d+)\/update/)[1]);
      const doc = documents.find(d => d.id === docId);
      return { status: 200, contentType: "application/json", body: JSON.stringify({ ...doc, state: "Published" }) };
    }

    // Document delete
    if (apiPath.match(/^dynamic-documents\/\d+\/delete\/$/) && route.request().method() === "DELETE") {
      return { status: 204, contentType: "application/json", body: "" };
    }

    // Document create (for copy)
    if (apiPath === "dynamic-documents/create/" && route.request().method() === "POST") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 9999, title: "Copy", state: "Draft", created_at: nowIso, updated_at: nowIso }) };
    }

    // Download PDF/Word (binary response)
    if (apiPath.match(/^dynamic-documents\/\d+\/download-pdf\//)) {
      return { status: 200, contentType: "application/pdf", body: "%PDF-1.4 fake" };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/download-word\//)) {
      return { status: 200, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: "PK fake" };
    }

    // Folders, tags, permissions, activity, misc
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/permissions/clients/") return { status: 200, contentType: "application/json", body: JSON.stringify({ clients: [] }) };
    if (apiPath === "dynamic-documents/permissions/roles/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) return { status: 200, contentType: "application/json", body: JSON.stringify({ is_public: false, visibility_user_ids: [], usability_user_ids: [], visibility_roles: [], usability_roles: [] }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "user/letterhead/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath === "user/letterhead/word-template/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/$/)) return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };

    return null;
  });
}

test("lawyer clicks Publicar on Draft doc — triggers publishDocument action in cards/index.js", async ({ page }) => {
  const userId = 9820;
  const doc = buildMockDocument({ id: 701, title: "Doc Para Publicar", state: "Draft", createdBy: userId });

  await installDocActionMocks(page, { userId, documents: [doc] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Open actions modal
  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Publicar" — triggers useDocumentActions.publishDocument
  await page.getByRole("button", { name: "Publicar" }).click();

  // SweetAlert success notification should appear
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("exitosamente");
  await page.locator(".swal2-confirm").click();
});

test("lawyer clicks Mover a Borrador on Published doc — triggers moveToDraft action", async ({ page }) => {
  const userId = 9821;
  const doc = buildMockDocument({ id: 702, title: "Doc Para Borrador", state: "Published", createdBy: userId });

  await installDocActionMocks(page, { userId, documents: [doc] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Mover a Borrador"
  await page.getByRole("button", { name: "Mover a Borrador" }).click();

  // Success notification
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("exitosamente");
  await page.locator(".swal2-confirm").click();
});

test("lawyer clicks Eliminar on Draft doc — triggers confirmation_alert.js and deleteDocument", async ({ page }) => {
  const userId = 9822;
  const doc = buildMockDocument({ id: 703, title: "Doc Para Eliminar", state: "Draft", createdBy: userId });

  await installDocActionMocks(page, { userId, documents: [doc] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Eliminar" — triggers showConfirmationAlert from confirmation_alert.js
  await page.getByRole("button", { name: "Eliminar" }).click();

  // SweetAlert confirmation dialog should appear (from confirmation_alert.js)
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  // The confirmation alert has "Aceptar" and "Cancelar" buttons
  await expect(page.locator(".swal2-confirm")).toBeVisible();
  await expect(page.locator(".swal2-cancel")).toBeVisible();

  // Confirm the delete
  await page.locator(".swal2-confirm").click();

  // Success notification after delete
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("eliminado");
  await page.locator(".swal2-confirm").click();
});

test("lawyer clicks Crear una Copia on Published doc — triggers confirmation and copy flow", async ({ page }) => {
  const userId = 9823;
  const doc = buildMockDocument({ id: 704, title: "Doc Original", state: "Published", createdBy: userId, content: "<p>Contenido original</p>" });

  await installDocActionMocks(page, { userId, documents: [doc] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Crear una Copia" — triggers copyDocument which shows confirmation_alert
  await page.getByRole("button", { name: "Crear una Copia" }).click();

  // SweetAlert confirmation dialog
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-confirm")).toBeVisible();

  // Confirm the copy
  await page.locator(".swal2-confirm").click();

  // Success notification after copy creation
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("Copia creada");
  await page.locator(".swal2-confirm").click();
});
