import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — docs-permissions persistence contract.
 *
 * Complements document-permissions-interactions.spec.js (which only covers
 * UI toggling) by asserting the FE ↔ BE contract for the unified
 * `dynamic-documents/<id>/permissions/manage/` endpoint:
 *  - existing permissions GET pre-populates the summary
 *  - saving after a grant sends the expected payload shape with user_ids
 */

const LAWYER_ID = 27100;

const MOCK_CLIENTS = [
  { id: 1, user_id: 11, full_name: "Carlos Pérez", email: "carlos@example.com", role: "client" },
  { id: 2, user_id: 12, full_name: "María López", email: "maria@example.com", role: "client" },
];

const MOCK_ROLES = {
  roles: [
    { code: "client", display_name: "Cliente", description: "Usuarios regulares", user_count: 2, can_be_granted_permissions: true, has_automatic_access: false },
  ],
};

async function setup(page, { existingPermissions = null, capturedManagePayload = null } = {}) {
  const docs = [
    buildMockDocument({ id: 711, title: "Minuta Persistencia Permisos", state: "Draft", createdBy: LAWYER_ID }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId: LAWYER_ID, role: "lawyer", hasSignature: true, documents: docs,
  });

  await page.route("**/api/dynamic-documents/permissions/clients/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ clients: MOCK_CLIENTS }) });
  });
  await page.route("**/api/dynamic-documents/permissions/roles/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ROLES) });
  });

  await page.route("**/api/dynamic-documents/*/permissions/", async (route) => {
    const body = existingPermissions ?? {
      is_public: false,
      visibility_permissions: [],
      usability_permissions: [],
      active_roles: { visibility_roles: [], usability_roles: [] },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.route("**/api/dynamic-documents/*/permissions/manage/", async (route) => {
    if (capturedManagePayload) capturedManagePayload.body = route.request().postDataJSON?.() || null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: LAWYER_ID, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

async function openDocumentActions(page) {
  await page.goto("/dynamic_document_dashboard");
  const row = page.getByRole("table").getByText("Minuta Persistencia Permisos");
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });
}

async function openPermissionsModal(page) {
  await openDocumentActions(page);
  await page.getByRole("button", { name: "Permisos" }).click();
  await expect(page.getByRole("button", { name: "Guardar Permisos" })).toBeVisible({ timeout: 15_000 });
}

// quality: allow-fragile-test-data (mock client email in permissions test double)
test("existing visibility permission pre-populates the summary when modal opens", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const existingPermissions = {
    is_public: false,
    visibility_permissions: [
      { user_id: 11, full_name: "Carlos Pérez", email: "carlos@example.com" },
    ],
    usability_permissions: [],
    active_roles: { visibility_roles: [], usability_roles: [] },
  };

  await setup(page, { existingPermissions });
  await openDocumentActions(page);
  await expect(page.getByText(/Pueden ver/)).toHaveCount(0);

  await page.getByRole("button", { name: "Permisos" }).click();

  await expect(page.getByRole("button", { name: "Guardar Permisos" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Pueden ver/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Pueden ver/).first().locator("..")).toContainText("Carlos Pérez");
});

// quality: allow-fragile-test-data (mock client email in permissions test double)
test("saving after granting visibility POSTs manage endpoint with that user_id", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const captured = { body: null };
  await setup(page, { capturedManagePayload: captured });
  await openPermissionsModal(page);

  await expect(page.getByText("Carlos Pérez")).toBeVisible({ timeout: 10_000 });

  // Grant visibility to Carlos. Store normalizes id := user_id, so the
  // checkbox id mirrors user_id, not the raw client-record id.
  await page.locator("input#visibility_11").check();

  const saveResponse = page.waitForResponse(
    (res) => res.url().includes("/permissions/manage/") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Guardar Permisos" }).click();
  await saveResponse;

  expect(captured.body).toMatchObject({
    is_public: false,
    visibility: { user_ids: [11] },
  });
  expect(Array.isArray(captured.body.usability?.user_ids)).toBe(true);
});
