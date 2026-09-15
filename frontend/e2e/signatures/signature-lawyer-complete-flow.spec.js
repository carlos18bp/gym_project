import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qg3kAAAAASUVORK5CYII=";

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

function buildMockDocument({ id, title, state, createdBy, signatures = [], variables = [] }) {
  const nowIso = new Date().toISOString();
  return {
    id,
    title,
    state,
    created_by: createdBy,
    assigned_to: null,
    code: `DOC-${id}`,
    tags: [],
    created_at: nowIso,
    updated_at: nowIso,
    content: "<p>Test document content</p>",
    variables,
    signatures,
    requires_signature: true,
    relationships_count: 0,
  };
}

async function installSignatureLawyerMocks(page, { userId, clientId, hasSignature = false }) {
  let currentHasSignature = hasSignature;
  const lawyer = buildMockUser({ id: userId, role: "lawyer", hasSignature: currentHasSignature });
  const client = buildMockUser({ id: clientId, role: "client" });
  const nowIso = new Date().toISOString();

  const doc = buildMockDocument({
    id: 501,
    title: "Contrato de Prestación de Servicios",
    state: "Published",
    createdBy: userId,
    signatures: [],
    variables: [
      { id: 1, name: "nombre_cliente", display_name: "Nombre del Cliente", type: "input", value: "" },
    ],
  });

  const pendingDoc = buildMockDocument({
    id: 502,
    title: "Poder Especial",
    state: "PendingSignatures",
    createdBy: userId,
    signatures: [
      // signer_email/signer_name/signed mirror the shape canSignDocument()
      // actually reads (menuOptionsHelper.js) — without them the "Firmar
      // documento" menu option never appears for this fixture (see
      // signature-client-complete-flow.spec.js:57-60 for the correct shape).
      { id: 1, user: userId, signer_email: lawyer.email, signer_name: `${lawyer.first_name} ${lawyer.last_name}`, signed: false, status: "pending", signed_at: null },
      { id: 2, user: clientId, signer_email: client.email, signer_name: `${client.first_name} ${client.last_name}`, signed: false, status: "pending", signed_at: null },
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
        body: JSON.stringify([
          { ...lawyer, has_signature: currentHasSignature },
          client,
        ]),
      };
    }

    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...lawyer, has_signature: currentHasSignature }),
      };
    }

    if (apiPath === `users/${userId}/signature/`) {
      if (!currentHasSignature) {
        return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
      }
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          has_signature: true,
          signature: { signature_image: `data:image/png;base64,${PNG_1X1_BASE64}`, method: "draw", created_at: nowIso },
        }),
      };
    }

    if (apiPath === `users/update_signature/${userId}/`) {
      currentHasSignature = true;
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) };
    }

    if (apiPath === "dynamic-documents/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([doc, pendingDoc]) };
    }

    if (apiPath.startsWith("dynamic-documents/created-by/") && apiPath.endsWith("/pending-signatures/")) {
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

    // Signing — stateful: flips the signer's own signature entry to signed
    // so the post-sign refetch (documentStore.init(true) -> "dynamic-documents/")
    // reflects a real mutation, not just the unchanged fixture default.
    const signMatch = apiPath.match(/^dynamic-documents\/(\d+)\/sign\/(\d+)\/$/);
    if (signMatch && route.request().method() === "POST") {
      const docId = Number(signMatch[1]);
      const signerId = Number(signMatch[2]);
      if (pendingDoc.id === docId) {
        const signature = pendingDoc.signatures.find((s) => s.user === signerId);
        if (signature) {
          signature.signed = true;
          signature.status = "signed";
          signature.signed_at = nowIso;
        }
      }
      return { status: 200, contentType: "application/json", body: JSON.stringify(pendingDoc) };
    }

    return null;
  });
}

test("lawyer sees signature modal with draw and upload options", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8200;
  const clientId = 8201;

  await installSignatureLawyerMocks(page, { userId, clientId, hasSignature: false });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Open the electronic signature modal from the dashboard header
  await page.getByRole("button", { name: "Firma Electrónica" }).click();

  // Without a stored signature the modal offers both creation methods
  await expect(page.getByRole("heading", { name: "Firma Electrónica", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Dibujar firma" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Subir imagen" })).toBeVisible();
});

test("lawyer sees pending signatures tab with documents awaiting signatures", { tag: ['@flow:sign-document-flow', '@module:signatures', '@priority:P1', '@role:lawyer', '@outcome:display'] }, async ({ page }) => {
  const userId = 8202;
  const clientId = 8203;

  await installSignatureLawyerMocks(page, { userId, clientId, hasSignature: true });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to the pending signatures tab
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();

  // The pending document is listed with its pending-signature status
  await expect(page.getByText("Poder Especial")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("signatures-list-row-502").getByText("Pendiente", { exact: true })).toBeVisible();
});

test("lawyer with no signature sees upload prompt in profile context", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8204;
  const clientId = 8205;

  await installSignatureLawyerMocks(page, { userId, clientId, hasSignature: false });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, has_signature: false },
  });

  await page.goto("/dynamic_document_dashboard");

  // Open the profile modal from the user menu
  await page.getByRole("button", { name: /Open user menu|E2E Lawyer/i }).click();
  await page.getByText("Perfil").click();

  const profileModal = page.locator("#viewProfileModal"); // quality: allow-fragile-selector (stable DOM id)
  await expect(profileModal).toBeVisible({ timeout: 10_000 });

  // The profile exposes the electronic signature entry point
  await profileModal.getByRole("button", { name: "Firma electrónica" }).click();

  // Without a stored signature the modal prompts to add one (draw or upload)
  await expect(page.getByText("Añadir firma electrónica")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Dibujar firma" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Subir imagen" })).toBeVisible();
});

test("lawyer as a required signer completes the sign action", { tag: ['@flow:sign-document-flow', '@module:signatures', '@priority:P1', '@role:lawyer', '@outcome:success'] }, async ({ page }) => {
  const userId = 8206;
  const clientId = 8207;

  await installSignatureLawyerMocks(page, { userId, clientId, hasSignature: true });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByTestId("signatures-list-row-502")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("signatures-list-row-502").click();
  await page.getByRole("button", { name: /Firmar documento/i }).click();

  // Confirmation dialog (SweetAlert2 default confirm button is "Aceptar").
  await expect(
    page.getByText('¿Estás seguro de que deseas firmar el documento "Poder Especial"?')
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Aceptar" }).click();

  // Blocking "processing" toast is awaited by the app — the sign POST does not
  // fire until this is dismissed.
  await expect(page.getByText("Procesando firma del documento...")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  // Outcome: the sign POST succeeded and the app confirms with the real title.
  await expect(page.getByText('¡Documento "Poder Especial" firmado correctamente!')).toBeVisible({
    timeout: 10_000,
  });
});
