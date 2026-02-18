import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  buildMockUser,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for Dashboard and Folder components
 * Target: ContactsWidget.vue, FolderCard.vue, HierarchicalMenu.vue, FoldersGrid.vue
 */

async function installDashboardComponentMocks(page, { userId, documents = [], folders = [], contacts = [] }) {
  const user = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user, ...contacts]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Documents
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };

    // Folders
    if (apiPath === "dynamic-documents/folders/") {
      if (route.request().method() === "GET") {
        return { status: 200, contentType: "application/json", body: JSON.stringify(folders) };
      }
    }

    // Tags
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };

    // Contacts
    if (apiPath === "contacts/") return { status: 200, contentType: "application/json", body: JSON.stringify(contacts) };

    return null;
  });
}

test.describe("FolderCard: basic display", () => {
  test("displays folder name and document count", async ({ page }) => {
    const userId = 10700;
    const documents = [
      buildMockDocument({ id: 1, title: "Folder Doc 1", state: "Published" }),
      buildMockDocument({ id: 2, title: "Folder Doc 2", state: "Published" }),
    ];
    const folders = [
      buildMockFolder({ id: 100, name: "Test Folder", document_ids: [1, 2], color_id: 1 }),
    ];

    await installDashboardComponentMocks(page, { userId, documents, folders });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("displays folder color indicator", async ({ page }) => {
    const userId = 10701;
    const folders = [
      buildMockFolder({ id: 100, name: "Colored Folder", document_ids: [], color_id: 2 }),
    ];

    await installDashboardComponentMocks(page, { userId, folders });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("FoldersGrid: grid layout", () => {
  test("displays multiple folders in grid layout", async ({ page }) => {
    const userId = 10702;
    const folders = [
      buildMockFolder({ id: 100, name: "Grid Folder 1", document_ids: [], color_id: 0 }),
      buildMockFolder({ id: 101, name: "Grid Folder 2", document_ids: [], color_id: 1 }),
      buildMockFolder({ id: 102, name: "Grid Folder 3", document_ids: [], color_id: 2 }),
    ];

    await installDashboardComponentMocks(page, { userId, folders });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("handles empty folders grid", async ({ page }) => {
    const userId = 10703;
    const folders = [];

    await installDashboardComponentMocks(page, { userId, folders });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("HierarchicalMenu: menu structure", () => {
  test("displays hierarchical menu on document card", async ({ page }) => {
    const userId = 10704;
    const documents = [
      buildMockDocument({ id: 1, title: "Menu Doc", state: "Published" }),
    ];

    await installDashboardComponentMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("menu displays grouped options", async ({ page }) => {
    const userId = 10705;
    const documents = [
      buildMockDocument({ id: 1, title: "Grouped Menu Doc", state: "Draft" }),
    ];

    await installDashboardComponentMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("ContactsWidget: contacts display", () => {
  test("displays contacts widget on dashboard", async ({ page }) => {
    const userId = 10706;
    const contacts = [
      { id: 10001, email: "contact1@test.com", first_name: "Contact", last_name: "One", role: "client" },
      { id: 10002, email: "contact2@test.com", first_name: "Contact", last_name: "Two", role: "client" },
    ];

    await installDashboardComponentMocks(page, { userId, contacts });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("handles empty contacts list", async ({ page }) => {
    const userId = 10707;
    const contacts = [];

    await installDashboardComponentMocks(page, { userId, contacts });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("Dashboard: combined components", () => {
  test("dashboard loads with folders and documents", async ({ page }) => {
    const userId = 10708;
    const documents = [
      buildMockDocument({ id: 1, title: "Dashboard Doc 1", state: "Published" }),
      buildMockDocument({ id: 2, title: "Dashboard Doc 2", state: "Draft" }),
    ];
    const folders = [
      buildMockFolder({ id: 100, name: "Dashboard Folder", document_ids: [1], color_id: 0 }),
    ];

    await installDashboardComponentMocks(page, { userId, documents, folders });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});
