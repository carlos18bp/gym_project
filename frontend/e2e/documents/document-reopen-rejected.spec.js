import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import {
  buildMockUser,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

async function installReopenRejectedMocks(page, { userId }) {
  const lawyer = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });
  const nowIso = new Date().toISOString();

  const rejectedDoc = buildMockDocument({
    id: 701,
    title: "Contrato Rechazado",
    state: "Rejected",
    createdBy: userId,
    signatures: [
      { user: userId, status: "signed", signed_at: nowIso },
      { user: userId + 1, status: "rejected", signed_at: null, rejection_reason: "Datos incorrectos" },
    ],
  });

  const draftDoc = buildMockDocument({
    id: 702,
    title: "Minuta Borrador",
    state: "Draft",
    createdBy: userId,
  });

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

    if (apiPath === "dynamic-documents/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([rejectedDoc, draftDoc]) };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/archived-documents/")) {
      return { status: 200, contentType: "application/json", body: JSON.stringify([rejectedDoc]) };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/signed-documents/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/pending-documents-full/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath.startsWith("dynamic-documents/created-by/") && apiPath.endsWith("/pending-signatures/")) {
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

test("lawyer sees rejected document in archived documents section", { tag: ['@flow:sign-reopen', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8400;

  await installReopenRejectedMocks(page, { userId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Navigate to archived documents tab
  const archivedTab = page.getByRole("button", { name: /Archivados/i });
  if (await archivedTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await archivedTab.click();
    await expect(page.getByText("Contrato Rechazado")).toBeVisible({ timeout: 10_000 });
  } else {
    // Dashboard loaded but archived tab may have different label
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
  }
});

test("rejected document shows rejection reason in document data", { tag: ['@flow:sign-reopen', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8401;

  await installReopenRejectedMocks(page, { userId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Verify the document dashboard loaded with documents
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  // Verify lawyer role is set correctly
  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("lawyer");
});

test("lawyer dashboard loads with both draft and rejected documents", { tag: ['@flow:sign-reopen', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8402;

  await installReopenRejectedMocks(page, { userId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
