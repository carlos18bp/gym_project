import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Deep coverage for document download actions:
 * - documents.js store (39.6%) — downloadPDF, downloadWord actions
 * - document_utils.js (9.5%) — downloadFile utility
 * - cards/index.js useDocumentActions — downloadPDFDocument, downloadWordDocument
 * - LetterheadModal.vue (41.6%) — letterhead image upload flow
 */

const lawyerAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

async function installDownloadMocks(page, { userId, documents }) {
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
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-key" }) };
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };

    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find(d => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // Download endpoints — return fake binary content
    if (apiPath.match(/^dynamic-documents\/\d+\/download-pdf\//)) {
      return { status: 200, contentType: "application/pdf", body: "%PDF-1.4 fake-pdf-content" };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/download-word\//)) {
      return { status: 200, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: "PK fake-word" };
    }

    // Update endpoint for state changes
    if (apiPath.match(/^dynamic-documents\/\d+\/update\/$/) && route.request().method() === "PATCH") {
      const docId = Number(apiPath.match(/dynamic-documents\/(\d+)\/update/)[1]);
      const doc = documents.find(d => d.id === docId);
      return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // Letterhead upload endpoint
    if (apiPath === "user/letterhead/" && route.request().method() === "POST") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, image_url: "/media/letterhead.png" }) };
    }
    if (apiPath === "user/letterhead/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath === "user/letterhead/word-template/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/$/)) return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };

    // Standard misc endpoints
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/permissions/clients/") return { status: 200, contentType: "application/json", body: JSON.stringify({ clients: [] }) };
    if (apiPath === "dynamic-documents/permissions/roles/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) return { status: 200, contentType: "application/json", body: JSON.stringify({ is_public: false, visibility_user_ids: [], usability_user_ids: [], visibility_roles: [], usability_roles: [] }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "download", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test("lawyer clicks Descargar PDF on Published document — triggers downloadPDF store action", async ({ page }) => {
  const userId = 9840;
  const doc = buildMockDocument({ id: 901, title: "Doc Descargar PDF", state: "Published", createdBy: userId });

  await installDownloadMocks(page, { userId, documents: [doc] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Open actions modal
  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Intercept download to prevent actual file download dialog
  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);

  // Click "Descargar PDF" — triggers useDocumentActions.downloadPDFDocument → store.downloadPDF → document_utils.downloadFile
  await page.getByRole("button", { name: "Descargar PDF" }).click();

  // Success notification (from store's downloadPDF action)
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("exitosamente");
  await page.locator(".swal2-confirm").click();
});

test("lawyer clicks Descargar Word on Published document — triggers downloadWord store action", async ({ page }) => {
  const userId = 9841;
  const doc = buildMockDocument({ id: 902, title: "Doc Descargar Word", state: "Published", createdBy: userId });

  await installDownloadMocks(page, { userId, documents: [doc] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Descargar Word" — triggers useDocumentActions.downloadWordDocument → store.downloadWord
  await page.getByRole("button", { name: "Descargar Word" }).click();

  // Success notification
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("exitosamente");
  await page.locator(".swal2-confirm").click();
});

test("lawyer opens Global Letterhead modal and sees both PDF and Word template sections", async ({ page }) => {
  const userId = 9842;

  await installDownloadMocks(page, { userId, documents: [] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Click Membrete Global button
  await page.getByRole("button", { name: "Membrete Global" }).first().click();

  // Verify the Global Letterhead modal opens with both sections
  await expect(page.getByRole("heading", { name: "Gestión de Membrete Global para PDF" })).toBeVisible({ timeout: 10_000 });

  // PDF letterhead section — empty state
  await expect(page.getByText("Sin Membrete para PDF")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("No tienes una imagen de membrete global configurada")).toBeVisible();

  // Upload section visible
  await expect(page.getByText("Subir Membrete de imagen para PDF")).toBeVisible();

  // Word template section
  await expect(page.getByText(/Plantilla Word/)).toBeVisible();
});
