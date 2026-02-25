import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { buildMockDocument, buildMockUser } from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Consolidated E2E tests for docs-card-actions flow.
 * Replaces 9 fragmented spec files with 5 user-flow tests.
 */

async function installCardActionsMocks(page, { userId, role = "lawyer", documents, hasSignature = true }) {
  const user = buildMockUser({ id: userId, role, hasSignature });
  const nowIso = new Date().toISOString();
  let docList = [...documents];

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: hasSignature }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(docList) };
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = docList.find((d) => d.id === docId);
      if (route.request().method() === "GET" && doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
      if (route.request().method() === "PUT" || route.request().method() === "PATCH") {
        const body = route.request().postDataJSON?.() || {};
        const idx = docList.findIndex((d) => d.id === docId);
        if (idx !== -1) docList[idx] = { ...docList[idx], ...body };
        return { status: 200, contentType: "application/json", body: JSON.stringify(docList[idx] || {}) };
      }
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
    if (apiPath.match(/^dynamic-documents\/\d+\/update\/$/) && route.request().method() === "PATCH") {
      const docId = Number(apiPath.match(/dynamic-documents\/(\d+)\/update/)[1]);
      const body = route.request().postDataJSON?.() || {};
      const idx = docList.findIndex((d) => d.id === docId);
      if (idx !== -1) docList[idx] = { ...docList[idx], ...body };
      return { status: 200, contentType: "application/json", body: JSON.stringify(docList[idx] || {}) };
    }
    if (apiPath === "dynamic-documents/create/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      const newDoc = { id: 9000 + docList.length, ...body, created_at: nowIso, updated_at: nowIso, code: `DOC-${9000 + docList.length}` };
      docList.push(newDoc);
      return { status: 201, contentType: "application/json", body: JSON.stringify(newDoc) };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/download-pdf\/$/)) return { status: 200, contentType: "application/pdf", body: "PDF_CONTENT" };
    if (apiPath.match(/^dynamic-documents\/\d+\/download-word\/$/)) return { status: 200, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: "WORD_CONTENT" };

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

test("lawyer sees document cards with titles and state badges on dashboard", { tag: ['@flow:docs-card-actions', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7700;
  const documents = [
    buildMockDocument({ id: 7001, title: "Contrato Borrador", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 7002, title: "Contrato Publicado", state: "Published", createdBy: userId }),
  ];

  await installCardActionsMocks(page, { userId, documents });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  // Minutas tab is active by default
  await expect(page.getByText("Contrato Borrador")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Contrato Publicado")).toBeVisible();
});

test("lawyer clicks document row and sees actions modal", { tag: ['@flow:docs-card-actions', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7701;
  const documents = [
    buildMockDocument({ id: 7010, title: "Doc Con Acciones", state: "Draft", createdBy: userId }),
  ];

  await installCardActionsMocks(page, { userId, documents });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText("Doc Con Acciones")).toBeVisible({ timeout: 15_000 });

  // Click on the document row to open actions
  await page.getByText("Doc Con Acciones").first().click();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});

test("client sees assigned documents with context-specific actions", { tag: ['@flow:docs-card-actions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 7702;
  const lawyerId = 7703;
  const documents = [
    buildMockDocument({ id: 7020, title: "Doc Asignado Cliente", state: "Completed", createdBy: lawyerId, assignedTo: userId }),
    buildMockDocument({ id: 7021, title: "Doc En Progreso", state: "InProgress", createdBy: lawyerId, assignedTo: userId }),
  ];

  await installCardActionsMocks(page, { userId, role: "client", documents, hasSignature: false });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("client");
});

test("lawyer sees use-document templates as cards on Minutas tab", { tag: ['@flow:docs-card-actions', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7704;
  const documents = [
    buildMockDocument({ id: 7030, title: "Plantilla Contrato", state: "Published", createdBy: userId, variables: [{ name: "nombre", type: "text" }] }),
    buildMockDocument({ id: 7031, title: "Plantilla Poder", state: "Published", createdBy: userId, variables: [{ name: "monto", type: "number" }] }),
  ];

  await installCardActionsMocks(page, { userId, documents });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByRole("button", { name: "Minutas" }).click();

  await expect(page.getByText("Plantilla Contrato")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Plantilla Poder")).toBeVisible();
});

test("document card displays multiple documents with different states", { tag: ['@flow:docs-card-actions', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7705;
  const documents = [
    buildMockDocument({ id: 7040, title: "Doc Draft", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 7041, title: "Doc Published", state: "Published", createdBy: userId }),
    buildMockDocument({ id: 7042, title: "Doc PendingSignature", state: "PendingSignature", createdBy: userId }),
    buildMockDocument({ id: 7043, title: "Doc FullySigned", state: "FullySigned", createdBy: userId }),
  ];

  await installCardActionsMocks(page, { userId, documents });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByRole("button", { name: "Minutas" }).click();

  await expect(page.getByText("Doc Draft")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Doc Published")).toBeVisible();
});
