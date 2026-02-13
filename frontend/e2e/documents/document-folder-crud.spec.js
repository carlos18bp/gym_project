import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  buildMockFolder,
  buildMockUser,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Custom mock installer that adds folder CRUD endpoints on top of the
 * standard dynamic-document mocks. We build it inline so that create /
 * update / delete are handled in the same handler — no route-ordering issues.
 */
async function installFolderCrudMocks(page, { userId, role, documents, folders }) {
  const user = buildMockUser({ id: userId, role, hasSignature: true });
  const folderList = [...folders]; // mutable copy
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    // --- Auth & users ---
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    }

    // --- Documents ---
    if (apiPath === "dynamic-documents/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // --- Folder CREATE ---
    if (apiPath === "dynamic-documents/folders/create/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      const newFolder = {
        id: 950 + folderList.length,
        name: body.name || "New Folder",
        color_id: body.color_id ?? 0,
        documents: [],
        document_ids: [],
        created_at: nowIso,
      };
      folderList.push(newFolder);
      return { status: 201, contentType: "application/json", body: JSON.stringify(newFolder) };
    }

    // --- Folder UPDATE ---
    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/update\/$/) && route.request().method() === "PATCH") {
      const folderId = Number(apiPath.match(/dynamic-documents\/folders\/(\d+)\/update/)[1]);
      const body = route.request().postDataJSON?.() || {};
      const idx = folderList.findIndex((f) => f.id === folderId);
      if (idx !== -1) {
        if (body.name) folderList[idx].name = body.name;
        if (body.color_id !== undefined) folderList[idx].color_id = body.color_id;
        if (body.document_ids !== undefined) {
          folderList[idx].document_ids = body.document_ids;
          folderList[idx].documents = documents.filter((d) => body.document_ids.includes(d.id));
        }
      }
      const updated = folderList[idx] || { id: folderId, name: "unknown", documents: [], document_ids: [], color_id: 0, created_at: nowIso };
      return { status: 200, contentType: "application/json", body: JSON.stringify(updated) };
    }

    // --- Folder DELETE ---
    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/delete\/$/) && route.request().method() === "DELETE") {
      const folderId = Number(apiPath.match(/dynamic-documents\/folders\/(\d+)\/delete/)[1]);
      const idx = folderList.findIndex((f) => f.id === folderId);
      if (idx !== -1) folderList.splice(idx, 1);
      return { status: 204, contentType: "application/json", body: "" };
    }

    // --- Folder LIST ---
    if (apiPath === "dynamic-documents/folders/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(folderList) };
    }

    // --- Folder DETAIL ---
    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/$/)) {
      const folderId = Number(apiPath.match(/dynamic-documents\/folders\/(\d+)\//)[1]);
      const folder = folderList.find((f) => f.id === folderId);
      if (folder) return { status: 200, contentType: "application/json", body: JSON.stringify(folder) };
    }

    // --- Tags, permissions, activity, misc ---
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
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

test("lawyer creates a new folder with name and color via modal", async ({ page }) => {
  const userId = 9500;

  await installFolderCrudMocks(page, {
    userId,
    role: "lawyer",
    documents: [],
    folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });

  // Empty state should show
  await expect(page.getByText("No tienes carpetas aún")).toBeVisible({ timeout: 10_000 });

  // Click "Crear Primera Carpeta" button from the empty state
  await page.getByRole("button", { name: /Crear Primera Carpeta/ }).click();

  // Modal should open with "Nueva Carpeta" heading
  await expect(page.getByRole("heading", { name: "Nueva Carpeta" })).toBeVisible({ timeout: 10_000 });

  // Fill folder name
  await page.locator("#folderName").fill("Contratos Laborales");

  // Submit the form — the button text is "Crear" when not editing
  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  await submitBtn.click();

  // Success notification from store (SweetAlert)
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("exitosamente");
  await page.locator(".swal2-confirm").click();

  // Folder should now appear in the table
  await expect(page.getByText("Contratos Laborales")).toBeVisible({ timeout: 10_000 });
});

test("lawyer edits a folder name via context menu", async ({ page }) => {
  const userId = 9501;

  const folders = [
    buildMockFolder({ id: 851, name: "Carpeta Original", colorId: 0 }),
  ];

  await installFolderCrudMocks(page, {
    userId,
    role: "lawyer",
    documents: [],
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByText("Carpeta Original")).toBeVisible({ timeout: 15_000 });

  // Open context menu (ellipsis button on the folder row)
  await page.locator("table tbody tr").first().locator("button").click();

  // Click "Editar" from the menu
  await page.getByText("Editar", { exact: true }).click();

  // Modal should open with "Editar Carpeta" heading
  await expect(page.getByRole("heading", { name: "Editar Carpeta" })).toBeVisible({ timeout: 10_000 });

  // Clear and fill new name
  await page.locator("#folderName").clear();
  await page.locator("#folderName").fill("Carpeta Renombrada");

  // Submit
  await page.getByRole("button", { name: "Actualizar" }).click();

  // Success notification
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("exitosamente");
  await page.locator(".swal2-confirm").click();
});

test("lawyer deletes a folder via context menu", async ({ page }) => {
  const userId = 9502;

  const folders = [
    buildMockFolder({ id: 861, name: "Carpeta a Eliminar", colorId: 2 }),
    buildMockFolder({ id: 862, name: "Carpeta Permanente", colorId: 1 }),
  ];

  await installFolderCrudMocks(page, {
    userId,
    role: "lawyer",
    documents: [],
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByText("Carpeta a Eliminar")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Carpeta Permanente")).toBeVisible();

  // Accept the native confirm dialog before clicking delete
  page.on("dialog", (dialog) => dialog.accept());

  // Open context menu on the first folder row
  await page.locator("table tbody tr").first().locator("button").click();

  // Click "Eliminar"
  await page.getByText("Eliminar", { exact: true }).click();

  // The FolderManagement confirm() + store deleteFolder() produce two notifications:
  // 1. Store's showNotification("Carpeta eliminada exitosamente")
  // 2. FolderManagement's showNotification after store success
  // Wait for the first SweetAlert
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await page.locator(".swal2-confirm").click();

  // If a second notification appears, dismiss it too
  const secondPopup = page.locator(".swal2-popup");
  if (await secondPopup.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.locator(".swal2-confirm").click();
  }

  // Deleted folder should no longer be visible, but the other remains
  await expect(page.getByText("Carpeta Permanente")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Carpeta a Eliminar")).toHaveCount(0, { timeout: 5_000 });
});

test("lawyer removes a document from a folder via folder details", async ({ page }) => {
  const userId = 9503;

  const docs = [
    buildMockDocument({ id: 7001, title: "Doc para Remover", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 7002, title: "Doc que Queda", state: "Published", createdBy: userId }),
  ];

  const folders = [
    buildMockFolder({ id: 871, name: "Carpeta con Docs", documents: [docs[0], docs[1]] }),
  ];

  await installFolderCrudMocks(page, {
    userId,
    role: "lawyer",
    documents: docs,
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByText("Carpeta con Docs")).toBeVisible({ timeout: 15_000 });

  // Click folder to open details modal
  await page.getByText("Carpeta con Docs").click();

  // Both docs should be visible in folder details
  await expect(page.getByText("Doc para Remover")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Doc que Queda")).toBeVisible();

  // Open context menu on the first document row inside the modal and click "Quitar de carpeta"
  const modalTable = page.locator(".fixed").filter({ hasText: "Carpeta con Docs" });
  const firstDocRow = modalTable.locator("table tbody tr").first();
  await firstDocRow.locator("button").click();
  await page.getByText("Quitar de carpeta").click();

  // Success notification for document removal
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await page.locator(".swal2-confirm").click({ timeout: 10_000 });
});
