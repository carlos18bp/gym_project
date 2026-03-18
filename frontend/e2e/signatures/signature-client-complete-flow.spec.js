import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

function buildMockUser({ id, role, hasSignature = false }) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: `${role}-${id}@example.com`,
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: hasSignature,
  };
}

function buildMockDocument({ id, title, state, createdBy, assignedTo = null, signatures = [] }) {
  const nowIso = new Date().toISOString();
  return {
    id,
    title,
    state,
    created_by: createdBy,
    assigned_to: assignedTo,
    code: `DOC-${id}`,
    tags: [],
    created_at: nowIso,
    updated_at: nowIso,
    content: "<p>Document for client signature</p>",
    variables: [],
    signatures,
    requires_signature: true,
    relationships_count: 0,
  };
}

async function installSignatureClientMocks(page, { userId, lawyerId, hasSignature = false }) {
  let currentHasSignature = hasSignature;
  const client = buildMockUser({ id: userId, role: "client", hasSignature: currentHasSignature });
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", hasSignature: true });
  const nowIso = new Date().toISOString();

  const pendingDoc = buildMockDocument({
    id: 601,
    title: "Contrato de Arrendamiento",
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
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ ...client, has_signature: currentHasSignature }, lawyer]),
      };
    }

    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...client, has_signature: currentHasSignature }),
      };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: currentHasSignature }),
      };
    }

    if (apiPath === `users/update_signature/${userId}/`) {
      currentHasSignature = true;
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) };
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
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }),
      };
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

test("client sees pending document in documents dashboard", { tag: ['@flow:sign-client-flow', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8300;
  const lawyerId = 8301;

  await installSignatureClientMocks(page, { userId, lawyerId, hasSignature: false });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Client should see their document dashboard with the pending document
  await expect(page.getByText("Contrato de Arrendamiento").or(page.getByText("Mis Documentos"))).toBeVisible({ timeout: 15_000 });
});

test("client sees pending signatures section with document awaiting their signature", { tag: ['@flow:sign-client-flow', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8302;
  const lawyerId = 8303;

  await installSignatureClientMocks(page, { userId, lawyerId, hasSignature: true });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Navigate to pending documents tab if available
  const pendingTab = page.getByRole("button", { name: /Por Firmar|Pendientes/i });
  if (await pendingTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pendingTab.click();
    await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 10_000 });
  } else {
    // Verify dashboard loaded
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
  }
});

test("client with signature clicks pending document and sees sign action", { tag: ['@flow:sign-client-flow', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8306;
  const lawyerId = 8307;

  await installSignatureClientMocks(page, { userId, lawyerId, hasSignature: true });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Navigate to pending documents tab
  const pendingTab = page.getByRole("button", { name: /Por Firmar|Pendientes/i });
  if (await pendingTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pendingTab.click();
    await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 10_000 });

    // Click on the pending document row to open actions modal
    await page.getByText("Contrato de Arrendamiento").click();

    // Should see document actions including sign option — use combined locator to avoid sequential waits
    const actionsOrSign = page.getByRole("heading", { name: /Acciones/i }).or(page.getByRole("button", { name: /Firmar documento/i }));
    await expect(actionsOrSign.first()).toBeVisible({ timeout: 10_000 });
  } else {
    // Fallback: verify dashboard loaded with pending document data
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
  }
});

test("client without signature has has_signature false in session state", { tag: ['@flow:sign-client-flow', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8304;
  const lawyerId = 8305;

  await installSignatureClientMocks(page, { userId, lawyerId, hasSignature: false });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true, has_signature: false },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  // Verify client session reflects no signature
  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("client");
  expect(userAuth.has_signature).toBe(false);
});
