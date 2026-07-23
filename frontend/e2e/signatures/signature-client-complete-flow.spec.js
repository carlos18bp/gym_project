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
      { id: 1, user: lawyerId, signer_email: lawyer.email, signer_name: `${lawyer.first_name} ${lawyer.last_name}`, signed: true, status: "signed", signed_at: nowIso },
      { id: 2, user: userId, signer_email: client.email, signer_name: `${client.first_name} ${client.last_name}`, signed: false, status: "pending", signed_at: null },
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

test("client reaches the documents dashboard from the sidebar", { tag: ['@flow:sign-client-flow', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8300;
  const lawyerId = 8301;

  await installSignatureClientMocks(page, { userId, lawyerId, hasSignature: false });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dashboard");
  await page.getByText("Archivos Juridicos").first().waitFor({ timeout: 15_000 });

  // The documents module is not mounted yet
  await expect(page.getByRole("button", { name: "Dcs. Por Firmar" })).toHaveCount(0);

  await page.getByText("Archivos Juridicos").first().click();

  await expect(page).toHaveURL(/\/dynamic_document_dashboard/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Dcs. Por Firmar" })).toBeVisible({ timeout: 15_000 });
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

  // Navigate to the pending documents tab
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 10_000 });
  // The signature status column shows the document as pending
  await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();
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

  // Navigate to the pending documents tab
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 10_000 });

  // Click on the pending document row to open the actions modal
  await page.getByText("Contrato de Arrendamiento").click();

  // Should see document actions including sign option
  await expect(page.getByRole("button", { name: /Firmar documento/i })).toBeVisible({ timeout: 10_000 });
});

test("client without signature is prompted to create one when signing", { tag: ['@flow:sign-client-flow', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8304;
  const lawyerId = 8305;

  await installSignatureClientMocks(page, { userId, lawyerId, hasSignature: false });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true, has_signature: false },
  });

  await page.goto("/dynamic_document_dashboard");

  // Open the pending document and try to sign it
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 10_000 });
  await page.getByText("Contrato de Arrendamiento").click();
  await page.getByRole("button", { name: /Firmar documento/i }).click();

  // Without a registered signature the app warns and offers to create one
  await expect(page.getByText("Para firmar documentos necesitas tener una firma registrada.")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  await expect(page.getByText("¿Deseas crear una firma electrónica ahora?")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Aceptar" }).click();

  // Accepting opens the electronic signature modal with the creation options
  await expect(page.getByRole("heading", { name: "Firma Electrónica", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Dibujar firma" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Subir imagen" })).toBeVisible();
});
