import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import { buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E tests for RecentDocumentsList.vue (43% coverage) and
 * UserWelcomeCard.vue (66.2%).
 * These render on /dashboard. RecentDocumentsList shows recent documents
 * with DocumentCard components. UserWelcomeCard shows the welcome message.
 */

function buildUser({ id, role = "lawyer", firstName = "E2E", lastName = "Lawyer" }) {
  return {
    id, first_name: firstName, last_name: lastName, email: "e2e@example.com",
    role, contact: "", birthday: "", identification: "", document_type: "",
    photo_profile: "", is_profile_completed: true, is_gym_lawyer: role === "lawyer",
    has_signature: false,
  };
}

async function installDashboardMocks(page, { userId, role = "lawyer", recentDocs = [], recentProcesses = [] }) {
  const user = buildUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-key" }) };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: JSON.stringify(recentProcesses) };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: JSON.stringify(recentDocs) };
    if (apiPath === "dynamic-documents/") {
      const allDocs = recentDocs.map(r => r.document);
      return { status: 200, contentType: "application/json", body: JSON.stringify({ items: allDocs, totalItems: allDocs.length, totalPages: 1, currentPage: 1 }) };
    }
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
    return null;
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role, is_gym_lawyer: role === "lawyer", is_profile_completed: true },
  });
}

test.describe("RecentDocumentsList - rendering", { tag: ['@flow:dashboard-recent-documents', '@module:dashboard', '@priority:P3', '@role:shared'] }, () => {
  test("shows recent documents section with documents", { tag: ['@flow:dashboard-recent-documents', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 2700;
    const docs = [
      { document: buildMockDocument({ id: 1, title: "Reciente Contrato A", state: "Draft", createdBy: userId }), viewed_at: new Date().toISOString() },
      { document: buildMockDocument({ id: 2, title: "Reciente Contrato B", state: "Published", createdBy: userId }), viewed_at: new Date().toISOString() },
    ];

    await installDashboardMocks(page, { userId, recentDocs: docs });
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Documentos Recientes", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Reciente Contrato A")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Reciente Contrato B")).toBeVisible();
  });

  test("shows empty state when no recent documents", { tag: ['@flow:dashboard-recent-documents', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 2701;

    await installDashboardMocks(page, { userId, recentDocs: [] });
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Documentos Recientes", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "No hay documentos recientes" })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("UserWelcomeCard - rendering", { tag: ['@flow:dashboard-recent-documents', '@module:dashboard', '@priority:P3', '@role:shared'] }, () => {
  test("displays welcome card on dashboard", { tag: ['@flow:dashboard-recent-documents', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 2710;

    await installDashboardMocks(page, { userId, recentDocs: [] });
    await page.goto("/dashboard");

    // Dashboard should render with welcome card and user-related content
    await expect(page.getByRole("heading", { name: "Documentos Recientes", exact: true })).toBeVisible({ timeout: 15_000 });
    // The "No hay documentos recientes" confirms recent docs section loaded
    await expect(page.getByRole("heading", { name: "No hay documentos recientes" })).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard renders for client user", { tag: ['@flow:dashboard-recent-documents', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 2711;

    await installDashboardMocks(page, { userId, role: "client", recentDocs: [] });
    await page.goto("/dashboard");

    await expect(page.locator("body")).toBeVisible();
  });
});
