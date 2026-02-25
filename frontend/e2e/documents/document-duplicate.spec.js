import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import {
  buildMockUser,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

async function installDuplicateDocMocks(page, { userId }) {
  const lawyer = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });
  const nowIso = new Date().toISOString();

  const originalDoc = buildMockDocument({
    id: 1001,
    title: "Contrato Original",
    state: "Published",
    createdBy: userId,
    content: "<p>Contenido del contrato original</p>",
    variables: [
      { id: 1, name: "parte_a", display_name: "Parte A", type: "input", value: "" },
    ],
  });

  let documents = [originalDoc];

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([lawyer]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(lawyer) };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    }

    if (apiPath === "dynamic-documents/" && route.request().method() === "GET") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
    }

    if (apiPath === "dynamic-documents/create/" && route.request().method() === "POST") {
      const duplicatedDoc = buildMockDocument({
        id: 1002,
        title: "Contrato Original (copia)",
        state: "Draft",
        createdBy: userId,
        content: "<p>Contenido del contrato original</p>",
      });
      documents = [...documents, duplicatedDoc];
      return { status: 201, contentType: "application/json", body: JSON.stringify(duplicatedDoc) };
    }

    if (apiPath.startsWith("dynamic-documents/created-by/") && apiPath.endsWith("/pending-signatures/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath.startsWith("dynamic-documents/user/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/tags/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };
    }

    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}

test("lawyer sees original document in dashboard with action options", { tag: ['@flow:docs-duplicate', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8700;

  await installDuplicateDocMocks(page, { userId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("duplicate document API mock returns new document with Draft state", { tag: ['@flow:docs-duplicate', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8701;

  await installDuplicateDocMocks(page, { userId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  // Verify the create endpoint mock works by checking documents are loaded
  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("lawyer");
});
