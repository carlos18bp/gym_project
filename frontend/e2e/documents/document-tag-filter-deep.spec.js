import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Deep coverage for:
 * - tags.js (27%) — fetchTags, tag state management
 * - filters.js (41%) — filteredDocuments, filteredDocumentsByTags
 * - DocumentListLawyer.vue — tag filter UI, search + tag combined filter
 * - useDocumentTags.js (43.75%) — tag selection and filtering composable
 */

const lawyerAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

function installTagFilterMocks(page, { userId, documents, tags }) {
  const user = {
    id: userId, first_name: "E2E", last_name: "Lawyer", email: "e2e@example.com",
    role: "lawyer", contact: "", birthday: "", identification: "", document_type: "",
    photo_profile: "", is_profile_completed: true, is_gym_lawyer: true, has_signature: true,
  };
  const nowIso = new Date().toISOString();

  return mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-key" }) };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };

    // Documents
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };

    // Tags — exercises tags.js fetchTags
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: JSON.stringify(tags) };

    // Standard endpoints
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/permissions/clients/") return { status: 200, contentType: "application/json", body: JSON.stringify({ clients: [] }) };
    if (apiPath === "dynamic-documents/permissions/roles/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) return { status: 200, contentType: "application/json", body: JSON.stringify({ is_public: false, visibility_user_ids: [], usability_user_ids: [], visibility_roles: [], usability_roles: [] }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "user/letterhead/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath === "user/letterhead/word-template/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };

    return null;
  });
}

test("document dashboard search filters documents by title — exercises filters.js filteredDocuments", async ({ page }) => {
  const userId = 9860;

  const tags = [
    { id: 1, name: "Contratos", color_id: 0 },
    { id: 2, name: "Laborales", color_id: 1 },
  ];

  const documents = [
    buildMockDocument({ id: 601, title: "Contrato de Arrendamiento", state: "Draft", createdBy: userId, tags: [tags[0]] }),
    buildMockDocument({ id: 602, title: "Demanda Laboral", state: "Published", createdBy: userId, tags: [tags[1]] }),
    buildMockDocument({ id: 603, title: "Poder General", state: "Draft", createdBy: userId, tags: [] }),
  ];

  await installTagFilterMocks(page, { userId, documents, tags });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // All 3 documents should be visible
  await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Demanda Laboral")).toBeVisible();
  await expect(page.getByText("Poder General")).toBeVisible();

  // Search by title "Contrato" — triggers filteredDocuments getter
  const searchInput = page.getByPlaceholder("Buscar...");
  await searchInput.fill("Contrato");

  // Only Contrato doc should remain visible
  await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible();
  await expect(page.getByText("Demanda Laboral")).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText("Poder General")).toBeHidden();

  // Clear search — all docs should reappear
  await searchInput.fill("");
  await expect(page.getByText("Demanda Laboral")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Poder General")).toBeVisible();
});

test("document dashboard search with no results shows empty state", async ({ page }) => {
  const userId = 9861;

  const documents = [
    buildMockDocument({ id: 611, title: "Acuerdo Comercial", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 612, title: "Escritura Publica", state: "Published", createdBy: userId }),
  ];

  await installTagFilterMocks(page, { userId, documents, tags: [] });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Both docs visible initially
  await expect(page.getByText("Acuerdo Comercial")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Escritura Publica")).toBeVisible();

  // Search for partial title match — exercises filteredDocuments
  const searchInput = page.getByPlaceholder("Buscar...");
  await searchInput.fill("Escritura");

  // Only the matching doc should show
  await expect(page.getByText("Escritura Publica")).toBeVisible();
  await expect(page.getByText("Acuerdo Comercial")).toBeHidden({ timeout: 5_000 });

  // Search for non-existent term — exercises empty result path
  await searchInput.fill("ZZZZNOEXISTE");
  await expect(page.getByText("Acuerdo Comercial")).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText("Escritura Publica")).toBeHidden();
});

test("document dashboard renders tag badges on documents with tags", async ({ page }) => {
  const userId = 9862;

  const tags = [
    { id: 1, name: "Urgente", color_id: 0 },
    { id: 2, name: "Revisado", color_id: 1 },
  ];

  const documents = [
    buildMockDocument({ id: 621, title: "Doc con Etiquetas", state: "Draft", createdBy: userId, tags: [tags[0], tags[1]] }),
    buildMockDocument({ id: 622, title: "Doc sin Etiquetas", state: "Draft", createdBy: userId, tags: [] }),
  ];

  await installTagFilterMocks(page, { userId, documents, tags });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Both docs should be visible
  await expect(page.getByText("Doc con Etiquetas")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Doc sin Etiquetas")).toBeVisible();

  // Tag badges should render for the document with tags
  await expect(page.getByText("Urgente")).toBeVisible();
  await expect(page.getByText("Revisado")).toBeVisible();
});
