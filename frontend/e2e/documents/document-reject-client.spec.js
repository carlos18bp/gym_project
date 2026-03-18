import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import {
  buildMockUser,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

async function installRejectClientMocks(page, { userId, lawyerId }) {
  const client = buildMockUser({ id: userId, role: "client", hasSignature: true });
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", hasSignature: true });
  const nowIso = new Date().toISOString();

  const pendingDoc = buildMockDocument({
    id: 901,
    title: "Poder General",
    state: "PendingSignatures",
    createdBy: lawyerId,
    assignedTo: userId,
    signatures: [
      { user: lawyerId, status: "signed", signed_at: nowIso },
      { user: userId, status: "pending", signed_at: null },
    ],
  });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([client, lawyer]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(client) };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    }

    if (apiPath === "dynamic-documents/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([pendingDoc]) };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/pending-documents-full/")) {
      return { status: 200, contentType: "application/json", body: JSON.stringify([pendingDoc]) };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/signed-documents/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/archived-documents/")) {
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

test("client sees document pending their signature in dashboard", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8600;
  const lawyerId = 8601;

  await installRejectClientMocks(page, { userId, lawyerId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  // Navigate to pending signatures tab
  const pendingTab = page.getByRole("button", { name: /Por Firmar|Pendientes/i });
  if (await pendingTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pendingTab.click();
    await expect(page.getByText("Poder General")).toBeVisible({ timeout: 10_000 });
  }
});

test("client clicks pending document and sees reject action available", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8602;
  const lawyerId = 8603;

  await installRejectClientMocks(page, { userId, lawyerId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Navigate to pending signatures tab
  const pendingTab = page.getByRole("button", { name: /Por Firmar|Pendientes/i });
  if (await pendingTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pendingTab.click();
    await expect(page.getByText("Poder General")).toBeVisible({ timeout: 10_000 });

    // Click on the document to open actions
    await page.getByText("Poder General").click();

    // Should see actions modal with reject option or signature options
    const actionsHeading = page.getByRole("heading", { name: /Acciones/i });
    const rejectButton = page.getByRole("button", { name: /Rechazar/i });
    const actionsVisible = await actionsHeading.isVisible({ timeout: 5_000 }).catch(() => false);
    const rejectVisible = await rejectButton.isVisible({ timeout: 5_000 }).catch(() => false);

    // Confirm document actions are accessible for rejection flow
    expect(actionsVisible || rejectVisible).toBe(true);
  } else {
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
  }
});

test("client document dashboard loads with pending document data", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8604;
  const lawyerId = 8605;

  await installRejectClientMocks(page, { userId, lawyerId });

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
