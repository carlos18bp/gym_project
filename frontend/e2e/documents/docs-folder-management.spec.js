import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { buildMockDocument, buildMockFolder, buildMockUser } from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Consolidated E2E tests for docs-folders flow.
 *
 * NOTE (flow gap): the Carpetas tab has NO search input in the real UI —
 * Dashboard only renders a search box inside the document tables, and
 * FolderManagement receives a `searchQuery` prop that nothing feeds on that
 * tab. The former "folders table can be searched" test was therefore
 * unfalsifiable and has been replaced by the delete-folder flow, which is
 * reachable from the row menu.
 */

async function installFolderMocks(page, { userId, role = "lawyer", documents, folders }) {
  const user = buildMockUser({ id: userId, role, hasSignature: true });
  const folderList = [...folders];
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // Folder LIST
    if (apiPath === "dynamic-documents/folders/" && route.request().method() === "GET") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(folderList) };
    }
    // Folder CREATE
    if (apiPath === "dynamic-documents/folders/create/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      const newFolder = { id: 960 + folderList.length, name: body.name || "New Folder", color_id: body.color_id ?? 0, documents: [], document_ids: [], created_at: nowIso };
      folderList.push(newFolder);
      return { status: 201, contentType: "application/json", body: JSON.stringify(newFolder) };
    }
    // Folder UPDATE
    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/update\/$/) && (route.request().method() === "PATCH" || route.request().method() === "PUT")) {
      const folderId = Number(apiPath.match(/dynamic-documents\/folders\/(\d+)\/update/)[1]);
      const body = route.request().postDataJSON?.() || {};
      const idx = folderList.findIndex((f) => f.id === folderId);
      if (idx !== -1) {
        if (body.name) folderList[idx].name = body.name;
        if (body.color_id !== undefined) folderList[idx].color_id = body.color_id;
        if (body.document_ids !== undefined) folderList[idx].document_ids = body.document_ids;
        return { status: 200, contentType: "application/json", body: JSON.stringify(folderList[idx]) };
      }
    }
    // Folder DELETE
    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/delete\/$/) && route.request().method() === "DELETE") {
      const folderId = Number(apiPath.match(/dynamic-documents\/folders\/(\d+)\/delete/)[1]);
      const idx = folderList.findIndex((f) => f.id === folderId);
      if (idx !== -1) folderList.splice(idx, 1);
      return { status: 204, contentType: "application/json", body: "" };
    }
    // Folder detail
    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/$/)) {
      const folderId = Number(apiPath.match(/dynamic-documents\/folders\/(\d+)\//)[1]);
      const folder = folderList.find((f) => f.id === folderId);
      if (folder) return { status: 200, contentType: "application/json", body: JSON.stringify(folder) };
    }

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

test("lawyer sees existing folders on Carpetas tab", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7600;
  const documents = [
    buildMockDocument({ id: 6001, title: "Contrato Base", state: "Published", createdBy: userId }),
  ];
  const folders = [
    buildMockFolder({ id: 401, name: "Contratos", documents: [documents[0]], colorId: 0 }),
    buildMockFolder({ id: 402, name: "Poderes", documents: [], colorId: 2 }),
  ];

  await installFolderMocks(page, { userId, documents, folders });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByTestId("lawyer-tab-folders").click();

  await expect(page.getByRole("row", { name: /Contratos/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("row", { name: /Poderes/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Contratos/ }).getByText("1 documento", { exact: true })).toBeVisible();
});

test("lawyer creates a new folder via modal", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7601;
  const documents = [
    buildMockDocument({ id: 6010, title: "Doc Alpha", state: "Draft", createdBy: userId }),
  ];

  await installFolderMocks(page, { userId, documents, folders: [] });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByTestId("lawyer-tab-folders").click();

  await page.getByRole("button", { name: "Nueva Carpeta" }).click();
  await expect(page.getByRole("heading", { name: "Nueva Carpeta" })).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Nombre de la carpeta").fill("Carpeta E2E");

  const createRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/dynamic-documents/folders/create/") &&
      request.method() === "POST"
  );
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await createRequest;

  // Success notification (blocking SweetAlert) confirms the creation.
  await expect(page.getByText("Carpeta creada exitosamente")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  await expect(page.getByRole("heading", { name: "Nueva Carpeta" })).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole("row", { name: /Carpeta E2E/ })).toBeVisible({ timeout: 10_000 });
});

test("lawyer clicks folder to view its documents", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7602;
  const documents = [
    buildMockDocument({ id: 6020, title: "Doc en Carpeta", state: "Published", createdBy: userId }),
  ];
  const folders = [
    buildMockFolder({ id: 410, name: "Mi Carpeta", documents: [documents[0]], colorId: 1 }),
  ];

  await installFolderMocks(page, { userId, documents, folders });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByTestId("lawyer-tab-folders").click();

  await expect(page.getByRole("row", { name: /Mi Carpeta/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("row", { name: /Mi Carpeta/ }).click();

  const detailsModal = page.getByTestId("folder-details-modal");
  await expect(detailsModal).toBeVisible({ timeout: 10_000 });
  await expect(detailsModal.getByRole("heading", { name: "Mi Carpeta" })).toBeVisible();
  await expect(detailsModal.getByText("Doc en Carpeta")).toBeVisible();
  await expect(detailsModal.getByText("1 documento", { exact: true })).toBeVisible();
});

test("client sees folders on Carpetas tab", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 7603;
  const documents = [
    buildMockDocument({ id: 6030, title: "Doc Asignado", state: "Completed", createdBy: 999, assignedTo: userId }),
  ];
  const folders = [
    buildMockFolder({ id: 420, name: "Carpeta Cliente", documents: [documents[0]], colorId: 0 }),
  ];

  await installFolderMocks(page, { userId, role: "client", documents, folders });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByTestId("client-tab-folders").click();

  await expect(page.getByRole("row", { name: /Carpeta Cliente/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("row", { name: /Carpeta Cliente/ }).click();

  const detailsModal = page.getByTestId("folder-details-modal");
  await expect(detailsModal).toBeVisible({ timeout: 10_000 });
  await expect(detailsModal.getByText("Doc Asignado")).toBeVisible();
});

test("empty folders section shows appropriate message", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7604;
  const documents = [
    buildMockDocument({ id: 6040, title: "Doc Sin Carpeta", state: "Draft", createdBy: userId }),
  ];

  await installFolderMocks(page, { userId, documents, folders: [] });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByTestId("lawyer-tab-folders").click();

  await expect(page.getByRole("heading", { name: "No tienes carpetas aún" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Crear Primera Carpeta" })).toBeVisible();
});

test("lawyer deletes a folder from the row menu", { tag: ['@flow:docs-folders', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 7605;
  const folders = [
    buildMockFolder({ id: 430, name: "Contratos Laborales", documents: [], colorId: 0 }),
    buildMockFolder({ id: 431, name: "Poderes Especiales", documents: [], colorId: 1 }),
    buildMockFolder({ id: 432, name: "Demandas", documents: [], colorId: 2 }),
  ];
  const documents = [
    buildMockDocument({ id: 6050, title: "Doc", state: "Draft", createdBy: userId }),
  ];

  await installFolderMocks(page, { userId, documents, folders });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByTestId("lawyer-tab-folders").click();

  await expect(page.getByRole("row", { name: /Demandas/ })).toBeVisible({ timeout: 15_000 });

  // Delete uses a native confirm() dialog — accept it when it fires.
  page.once("dialog", (dialog) => dialog.accept());

  await page.getByRole("row", { name: /Demandas/ }).getByRole("button").click();
  const deleteRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/dynamic-documents/folders/432/delete/") &&
      request.method() === "DELETE"
  );
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await deleteRequest;

  // Two success notifications fire in sequence (store + component); dismiss both.
  await expect(page.getByText("Carpeta eliminada exitosamente")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText('Carpeta "Demandas" eliminada correctamente')).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  await expect(page.getByRole("row", { name: /Demandas/ })).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("row", { name: /Contratos Laborales/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Poderes Especiales/ })).toBeVisible();
});
