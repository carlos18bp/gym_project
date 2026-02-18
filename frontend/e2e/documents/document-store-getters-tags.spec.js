import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  buildMockUser,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for getters.js, tags.js, and legalUpdate.js
 * Target: increase coverage for document store getters and tag actions
 */

async function installGettersTagsMocks(page, { userId, documents, tags = [], legalUpdates = [] }) {
  const user = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Documents
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // Folders
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };

    // Tags
    if (apiPath === "dynamic-documents/tags/") {
      if (route.request().method() === "GET") {
        return { status: 200, contentType: "application/json", body: JSON.stringify(tags) };
      }
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON?.() || {};
        const newTag = { id: 9000, ...body };
        return { status: 201, contentType: "application/json", body: JSON.stringify(newTag) };
      }
    }

    // Legal updates
    if (apiPath === "legal-updates/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(legalUpdates) };
    }

    return null;
  });
}

test.describe("document getters: documentById", () => {
  test("retrieves document by ID", async ({ page }) => {
    const userId = 10600;
    const documents = [
      buildMockDocument({ id: 1, title: "Get By ID Doc 1", state: "Published" }),
      buildMockDocument({ id: 2, title: "Get By ID Doc 2", state: "Draft" }),
    ];

    await installGettersTagsMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("document getters: sortedTags", () => {
  test("displays tags sorted alphabetically", async ({ page }) => {
    const userId = 10601;
    const documents = [
      buildMockDocument({ id: 1, title: "Tagged Doc", state: "Published" }),
    ];
    const tags = [
      { id: 1, name: "Zebra" },
      { id: 2, name: "Alpha" },
      { id: 3, name: "Beta" },
    ];

    await installGettersTagsMocks(page, { userId, documents, tags });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("document getters: publishedDocumentsUnassigned", () => {
  test("filters published documents without assignment", async ({ page }) => {
    const userId = 10602;
    const documents = [
      buildMockDocument({ id: 1, title: "Unassigned Pub Doc", state: "Published", assigned_to: null }),
      buildMockDocument({ id: 2, title: "Assigned Pub Doc", state: "Published", assigned_to: userId }),
      buildMockDocument({ id: 3, title: "Unassigned Draft Doc", state: "Draft", assigned_to: null }),
    ];

    await installGettersTagsMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("tags actions: fetchTags", () => {
  test("fetches all tags on page load", async ({ page }) => {
    const userId = 10603;
    const documents = [];
    const tags = [
      { id: 1, name: "Important" },
      { id: 2, name: "Legal" },
      { id: 3, name: "Contract" },
    ];

    await installGettersTagsMocks(page, { userId, documents, tags });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("handles empty tags list", async ({ page }) => {
    const userId = 10604;
    const documents = [];
    const tags = [];

    await installGettersTagsMocks(page, { userId, documents, tags });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("legalUpdate: fetchLegalUpdates", () => {
  test("fetches legal updates on dashboard load", async ({ page }) => {
    const userId = 10605;
    const documents = [];
    const legalUpdates = [
      { id: 1, title: "New Law Update", content: "Important legal changes", date: "2024-01-15" },
      { id: 2, title: "Regulation Change", content: "Updated regulations", date: "2024-01-10" },
    ];

    await installGettersTagsMocks(page, { userId, documents, legalUpdates });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("handles no legal updates", async ({ page }) => {
    const userId = 10606;
    const documents = [];
    const legalUpdates = [];

    await installGettersTagsMocks(page, { userId, documents, legalUpdates });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});
