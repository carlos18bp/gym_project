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

  // The published minuta is listed on the default Minutas tab
  const docRow = page.getByRole("table").getByText("Contrato Original");
  await expect(docRow).toBeVisible({ timeout: 15_000 });

  // Clicking the row opens the actions modal with the copy option
  await docRow.click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("document-action-copy")).toBeVisible();
});

test("lawyer duplicates a document and the copy appears as Draft in the list", { tag: ['@flow:docs-duplicate', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8701;

  await installDuplicateDocMocks(page, { userId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Open the actions modal for the original document
  const docRow = page.getByRole("table").getByText("Contrato Original");
  await expect(docRow).toBeVisible({ timeout: 15_000 });
  await docRow.click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Trigger "Crear una Copia" — a confirmation dialog appears
  await page.getByTestId("document-action-copy").click();
  // quality: allow-fragile-selector (third-party SweetAlert2 component class)
  await expect(page.locator('[class~="swal2-popup"]')).toContainText("¿Deseas crear una copia", { timeout: 10_000 });

  // Confirming fires the create request against dynamic-documents/create/
  const createRequest = page.waitForRequest(
    (req) => req.url().includes("dynamic-documents/create/") && req.method() === "POST",
    { timeout: 10_000 }
  );
  // quality: allow-fragile-selector (third-party SweetAlert2 component class)
  await page.locator(".swal2-confirm").click();
  await createRequest;

  // Success notification confirms the copy was created
  // quality: allow-fragile-selector (third-party SweetAlert2 component class)
  await expect(page.locator('[class~="swal2-popup"]')).toContainText("Copia creada exitosamente", { timeout: 10_000 });
  // quality: allow-fragile-selector (third-party SweetAlert2 component class)
  await page.locator(".swal2-confirm").click();

  // After the refresh, the duplicated Draft document is listed alongside the original
  await expect(page.getByRole("table").getByText("Contrato Original (copia)")).toBeVisible({ timeout: 15_000 });
});
