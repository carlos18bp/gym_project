import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockUser,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Custom mock that extends base document mocks with tag-related endpoints.
 */
async function installDocumentTagsMocks(page, { userId, documents, tags }) {
  const user = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });
  const tagList = [...tags];
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };

    // Documents
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // Tags LIST
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: JSON.stringify(tagList) };

    // Tag CREATE
    if (apiPath === "dynamic-documents/tags/create/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      const newTag = { id: 800 + tagList.length, name: body.name, color_id: body.color_id ?? 1 };
      tagList.push(newTag);
      return { status: 201, contentType: "application/json", body: JSON.stringify(newTag) };
    }

    // Tag DELETE
    if (apiPath.match(/^dynamic-documents\/tags\/\d+\/delete\/$/) && route.request().method() === "DELETE") {
      const tagId = Number(apiPath.match(/dynamic-documents\/tags\/(\d+)\/delete/)[1]);
      const idx = tagList.findIndex((t) => t.id === tagId);
      if (idx !== -1) tagList.splice(idx, 1);
      return { status: 204, contentType: "application/json", body: "" };
    }

    // Folders, permissions, misc
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

test("lawyer opens tag filter on document list and sees available tags", async ({ page }) => {
  const userId = 8100;

  const tags = [
    { id: 501, name: "Laboral", color_id: 0 },
    { id: 502, name: "Civil", color_id: 1 },
  ];

  const documents = [
    buildMockDocument({ id: 3001, title: "Contrato Laboral", state: "Draft", createdBy: userId, tags: [tags[0]] }),
    buildMockDocument({ id: 3002, title: "Demanda Civil", state: "Published", createdBy: userId, tags: [tags[1]] }),
    buildMockDocument({ id: 3003, title: "Minuta Sin Tag", state: "Draft", createdBy: userId, tags: [] }),
  ];

  await installDocumentTagsMocks(page, { userId, documents, tags });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Click Minutas tab
  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText("Contrato Laboral")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Demanda Civil")).toBeVisible();

  // Open the tag filter dropdown (HeadlessUI Menu with "Etiqueta" button)
  await page.getByRole("button", { name: "Etiqueta" }).click();

  // Tags should be listed in the dropdown as menu items
  await expect(page.getByRole("menuitem", { name: "Todos" })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("menuitem", { name: "Laboral" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Civil" })).toBeVisible();

  // Select "Laboral" tag to filter
  await page.getByRole("menuitem", { name: "Laboral" }).click();
});

test("lawyer filters documents by tag and only matching docs appear", async ({ page }) => {
  const userId = 8101;

  const tags = [
    { id: 511, name: "Urgente", color_id: 3 },
  ];

  const documents = [
    buildMockDocument({ id: 3010, title: "Doc Urgente", state: "Draft", createdBy: userId, tags: [tags[0]] }),
    buildMockDocument({ id: 3011, title: "Doc Normal", state: "Published", createdBy: userId, tags: [] }),
  ];

  await installDocumentTagsMocks(page, { userId, documents, tags });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText("Doc Urgente")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Doc Normal")).toBeVisible();

  // Open the tag filter and select "Urgente"
  await page.getByRole("button", { name: "Etiqueta" }).click();
  await page.getByRole("menuitem", { name: "Urgente" }).click();

  // Only the tagged document should remain visible
  await expect(page.getByText("Doc Urgente")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Doc Normal")).toHaveCount(0, { timeout: 5_000 });
});

test("lawyer resets tag filter by selecting Todos", async ({ page }) => {
  const userId = 8102;

  const tags = [
    { id: 601, name: "Especial", color_id: 0 },
  ];

  const documents = [
    buildMockDocument({ id: 3020, title: "Doc Especial", state: "Draft", createdBy: userId, tags: [tags[0]] }),
    buildMockDocument({ id: 3021, title: "Doc Generico", state: "Published", createdBy: userId, tags: [] }),
  ];

  await installDocumentTagsMocks(page, { userId, documents, tags });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText("Doc Especial")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Doc Generico")).toBeVisible();

  // Filter by "Especial" tag
  await page.getByRole("button", { name: "Etiqueta" }).click();
  await page.getByRole("menuitem", { name: "Especial" }).click();

  // Only tagged doc visible
  await expect(page.getByText("Doc Especial")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Doc Generico")).toHaveCount(0, { timeout: 5_000 });

  // Reset filter by selecting "Todos"
  await page.getByRole("button", { name: "Especial" }).click();
  await page.getByRole("menuitem", { name: "Todos" }).click();

  // Both docs should be visible again
  await expect(page.getByText("Doc Especial")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Doc Generico")).toBeVisible({ timeout: 5_000 });
});
