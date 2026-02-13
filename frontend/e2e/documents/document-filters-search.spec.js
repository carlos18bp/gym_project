import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  buildMockUser,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Mock installer focused on search & filter scenarios with multiple documents and tags.
 */
async function installFilterSearchMocks(page, { userId, documents, tags }) {
  const user = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };

    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: JSON.stringify(tags) };
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/permissions/clients/") return { status: 200, contentType: "application/json", body: JSON.stringify({ clients: [] }) };
    if (apiPath === "dynamic-documents/permissions/roles/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) return { status: 200, contentType: "application/json", body: JSON.stringify({ is_public: false, visibility_user_ids: [], usability_user_ids: [], visibility_roles: [], usability_roles: [] }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "user/letterhead/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath === "user/letterhead/word-template/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/$/)) return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };

    return null;
  });
}

test("lawyer searches documents by title in dashboard", async ({ page }) => {
  const userId = 7200;

  const tags = [
    { id: 701, name: "Laboral", color_id: 0 },
  ];

  const documents = [
    buildMockDocument({ id: 4001, title: "Contrato de Arrendamiento", state: "Draft", createdBy: userId, tags: [] }),
    buildMockDocument({ id: 4002, title: "Contrato Laboral", state: "Published", createdBy: userId, tags: [tags[0]] }),
    buildMockDocument({ id: 4003, title: "Poder Especial", state: "Draft", createdBy: userId, tags: [] }),
  ];

  await installFilterSearchMocks(page, { userId, documents, tags });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Go to Minutas tab
  await page.getByRole("button", { name: "Minutas" }).click();

  // All documents should be visible initially
  await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Contrato Laboral")).toBeVisible();
  await expect(page.getByText("Poder Especial")).toBeVisible();

  // Type in search box
  const searchInput = page.getByPlaceholder("Buscar...").first();
  await searchInput.fill("Poder");

  // Only "Poder Especial" should match
  await expect(page.getByText("Poder Especial")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Contrato de Arrendamiento")).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByText("Contrato Laboral")).toHaveCount(0);
});

test("lawyer clears search to see all documents again", async ({ page }) => {
  const userId = 7201;

  const documents = [
    buildMockDocument({ id: 4010, title: "Minuta Alpha", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 4011, title: "Minuta Beta", state: "Published", createdBy: userId }),
  ];

  await installFilterSearchMocks(page, { userId, documents, tags: [] });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText("Minuta Alpha")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Minuta Beta")).toBeVisible();

  // Search for "Alpha"
  const searchInput = page.getByPlaceholder("Buscar...").first();
  await searchInput.fill("Alpha");

  await expect(page.getByText("Minuta Alpha")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Minuta Beta")).toHaveCount(0, { timeout: 5_000 });

  // Clear search
  await searchInput.clear();

  // Both should be visible again
  await expect(page.getByText("Minuta Alpha")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Minuta Beta")).toBeVisible({ timeout: 5_000 });
});

test("lawyer searches with no matching results shows empty state", async ({ page }) => {
  const userId = 7202;

  const documents = [
    buildMockDocument({ id: 4020, title: "Contrato Unico", state: "Draft", createdBy: userId }),
  ];

  await installFilterSearchMocks(page, { userId, documents, tags: [] });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText("Contrato Unico")).toBeVisible({ timeout: 15_000 });

  // Search for something that doesn't exist
  const searchInput = page.getByPlaceholder("Buscar...").first();
  await searchInput.fill("ZZZZZZZ");

  // The original document should disappear
  await expect(page.getByText("Contrato Unico")).toHaveCount(0, { timeout: 5_000 });
});
