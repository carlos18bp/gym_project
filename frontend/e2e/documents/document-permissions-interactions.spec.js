import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — useDocumentPermissions.js (40.88%) + DocumentPermissionsManager.vue.
 *
 * Exercises the permissions composable logic through the UI:
 * - Loading clients and roles
 * - Public access toggle
 * - Client visibility/usability checkbox toggling
 * - Role-based permission toggles
 * - Client search filtering
 * - Permissions summary rendering
 *
 * Access: Draft doc → ActionsModal → "Permisos" → DocumentPermissionsModal
 *         → DocumentPermissionsManager (which uses useDocumentPermissions).
 */

const LAWYER_ID = 27000;

const MOCK_CLIENTS = [
  { id: 1, user_id: 1, full_name: "Carlos Pérez", email: "carlos@example.com", role: "client" },
  { id: 2, user_id: 2, full_name: "María López", email: "maria@example.com", role: "client" },
  { id: 3, user_id: 3, full_name: "José García", email: "jose@example.com", role: "corporate_client" },
];

const MOCK_ROLES = {
  roles: [
    { code: "client", display_name: "Cliente", description: "Usuarios regulares", user_count: 2, can_be_granted_permissions: true, has_automatic_access: false },
    { code: "corporate_client", display_name: "Cliente Corporativo", description: "Usuarios corporativos", user_count: 1, can_be_granted_permissions: true, has_automatic_access: false },
  ],
};

async function setupWithClients(page) {
  const docs = [
    buildMockDocument({ id: 701, title: "Minuta Con Permisos", state: "Draft", createdBy: LAWYER_ID }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId: LAWYER_ID, role: "lawyer", hasSignature: true, documents: docs,
  });

  // Override the clients and roles endpoints with actual data
  await page.route("**/api/dynamic-documents/permissions/clients/", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ clients: MOCK_CLIENTS }),
    });
  });
  await page.route("**/api/dynamic-documents/permissions/roles/", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(MOCK_ROLES),
    });
  });

  // Override document permissions endpoint
  await page.route("**/api/dynamic-documents/*/permissions/", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          is_public: false,
          visibility_permissions: [],
          usability_permissions: [],
          active_roles: { visibility_roles: [], usability_roles: [] },
        }),
      });
    } else {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ message: "ok" }),
      });
    }
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: LAWYER_ID, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

async function openPermissionsModal(page) {
  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Click document row to open ActionsModal
  // quality: allow-fragile-selector (positional access on filtered set)
  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10000 });

  // Click "Permisos"
  await page.getByRole("button", { name: "Permisos" }).click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).not.toBeVisible({ timeout: 5000 });

  // Wait for permissions modal
  await expect(page.getByRole("button", { name: "Guardar Permisos" })).toBeVisible({ timeout: 15000 });
}

// ---------- Client list rendering ----------

test.describe("Permissions modal renders client list", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {
  // quality: allow-fragile-test-data (mock client email in permissions test double)
  test("shows available clients with names and emails", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    await setupWithClients(page);
    await openPermissionsModal(page);

    // Client names should be visible
    await expect(page.getByText("Carlos Pérez")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("María López")).toBeVisible();
    await expect(page.getByText("José García")).toBeVisible();

    // Emails should be visible
    await expect(page.getByText("carlos@example.com")).toBeVisible();
  });

  test("shows role-based permissions section with role names", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    await setupWithClients(page);
    await openPermissionsModal(page);

    // Role names from MOCK_ROLES should be visible
    await expect(page.getByText("Cliente").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Cliente Corporativo")).toBeVisible();
  });
});

// ---------- Public access toggle ----------

test.describe("Permissions modal public access toggle", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {
  test("toggling public access hides individual permissions", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    await setupWithClients(page);
    await openPermissionsModal(page);

    // Clients should be visible initially (not public)
    await expect(page.getByText("Carlos Pérez")).toBeVisible({ timeout: 5000 });

    // Click the public access toggle button
    // quality: allow-fragile-selector (positional access on filtered set)
    const publicToggle = page.locator("button").filter({ has: page.locator("span.rounded-full") }).first();
    await publicToggle.click();

    // "Documento público" notice should appear
    await expect(page.getByText("Documento público")).toBeVisible({ timeout: 5000 });

    // Individual client list should be hidden when public
    await expect(page.getByText("Carlos Pérez")).toBeHidden();
  });
});

// ---------- Client visibility checkbox ----------

test.describe("Permissions modal client visibility toggle", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {
  test("checking visibility checkbox for a client shows permissions summary", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    await setupWithClients(page);
    await openPermissionsModal(page);

    await expect(page.getByText("Carlos Pérez")).toBeVisible({ timeout: 5000 });

    // Click the "Ver" checkbox for the first client
    const visibilityCheckbox = page.locator("input#visibility_1");
    await visibilityCheckbox.check();

    // Permissions summary should appear with the client name
    await expect(page.getByText(/Pueden ver/).first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------- Client search filtering ----------

test.describe("Permissions modal client search", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {
  test("searching filters the client list", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    await setupWithClients(page);
    await openPermissionsModal(page);

    await expect(page.getByText("Carlos Pérez")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("María López")).toBeVisible();

    // Search for "María"
    const searchInput = page.getByPlaceholder("Buscar por nombre o email...");
    await searchInput.fill("María");

    // Only María should be visible
    await expect(page.getByText("María López")).toBeVisible();
    await expect(page.getByText("Carlos Pérez")).toBeHidden();
  });

  test("search with no results shows empty message", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    await setupWithClients(page);
    await openPermissionsModal(page);

    await expect(page.getByText("Carlos Pérez")).toBeVisible({ timeout: 5000 });

    const searchInput = page.getByPlaceholder("Buscar por nombre o email...");
    await searchInput.fill("ZZZZNOEXISTE");

    // "No se encontraron clientes" message should appear
    await expect(page.getByText("No se encontraron clientes")).toBeVisible({ timeout: 5000 });
  });
});

// ---------- Role-based permissions toggle ----------

test.describe("Permissions modal role visibility toggle", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {
  test("checking role visibility shows role permissions summary", { tag: ['@flow:docs-permissions', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    await setupWithClients(page);
    await openPermissionsModal(page);

    // Wait for roles to load
    await expect(page.getByText("Cliente Corporativo")).toBeVisible({ timeout: 5000 });

    // Click the "Ver" checkbox for "client" role
    const roleVisCheckbox = page.locator("input#role_visibility_client");
    await roleVisCheckbox.check();

    // Role permissions summary should appear
    await expect(page.getByText("Resumen de Permisos por Rol")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Roles que pueden ver/).first()).toBeVisible();
  });
});
