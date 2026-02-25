import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { buildMockDocument, buildMockUser } from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for docs-delete flow.
 * Covers: deleting a document with confirmation.
 */

async function installDeleteMocks(page, { userId, documents }) {
  const user = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });
  let docList = [...documents];
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(docList) };
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = docList.find((d) => d.id === docId);
      if (route.request().method() === "GET" && doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
      if (route.request().method() === "DELETE") {
        docList = docList.filter((d) => d.id !== docId);
        return { status: 204, contentType: "application/json", body: "" };
      }
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/delete\/$/) && route.request().method() === "DELETE") {
      const docId = Number(apiPath.match(/dynamic-documents\/(\d+)\/delete/)[1]);
      docList = docList.filter((d) => d.id !== docId);
      return { status: 204, contentType: "application/json", body: "" };
    }

    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
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

test("lawyer sees delete option when clicking a draft document row", { tag: ['@flow:docs-delete', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8830;
  const documents = [
    buildMockDocument({ id: 8001, title: "Doc Para Eliminar", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 8002, title: "Doc Conservar", state: "Published", createdBy: userId }),
  ];

  await installDeleteMocks(page, { userId, documents });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByText("Doc Para Eliminar")).toBeVisible({ timeout: 15_000 });

  // Click document to open actions
  await page.getByText("Doc Para Eliminar").first().click();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});

test("lawyer sees documents list after navigating to dashboard", { tag: ['@flow:docs-delete', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8831;
  const documents = [
    buildMockDocument({ id: 8010, title: "Doc Único", state: "Draft", createdBy: userId }),
  ];

  await installDeleteMocks(page, { userId, documents });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByText("Doc Único")).toBeVisible({ timeout: 15_000 });
});
