import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for the client document-rejection flow.
 * A document pending the client's signature lives on "Dcs. Por Firmar";
 * from its actions modal the client can reject it with a comment, which
 * moves it to "Dcs. Archivados" as Rejected.
 */

function buildPendingDoc(userId, lawyerId) {
  return buildMockDocument({
    id: 901,
    title: "Poder General",
    state: "PendingSignatures",
    createdBy: lawyerId,
    assignedTo: userId,
    requires_signature: true,
    signatures: [
      {
        id: 11,
        signer_id: lawyerId,
        signer_email: "lawyer@example.com",
        signer_name: "Abogado",
        signed: true,
      },
      {
        id: 12,
        signer_id: userId,
        signer_email: "e2e@example.com",
        signer_name: "E2E Client",
        signed: false,
      },
    ],
  });
}

async function setupClientDashboard(page, { userId, lawyerId }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: true,
    documents: [buildPendingDoc(userId, lawyerId)],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByTestId("client-tab-pending-signatures")).toBeVisible({ timeout: 15_000 });
}

async function setupClientPendingTab(page, { userId, lawyerId }) {
  await setupClientDashboard(page, { userId, lawyerId });
  await page.getByTestId("client-tab-pending-signatures").click();
  await expect(page.getByTestId("signatures-list-row-901")).toBeVisible({ timeout: 15_000 });
}

test("client opens the pending signatures tab and finds their document", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  await setupClientDashboard(page, { userId: 8600, lawyerId: 8601 });
  await expect(page.getByTestId("signatures-list-row-901")).toBeHidden();

  await page.getByTestId("client-tab-pending-signatures").click();

  const row = page.getByTestId("signatures-list-row-901");
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("Poder General")).toBeVisible();
  await expect(row.getByText("Pendiente", { exact: true })).toBeVisible();
});

test("client clicks pending document and sees sign and reject actions", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  await setupClientPendingTab(page, { userId: 8602, lawyerId: 8603 });

  await page.getByTestId("signatures-list-row-901").click();

  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("document-action-sign")).toBeVisible();
  await expect(page.getByTestId("document-action-reject")).toBeVisible();
});

test("client rejects pending document and it moves to archived tab", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:client', '@outcome:success'] }, async ({ page }) => {
  const userId = 8604;
  await setupClientPendingTab(page, { userId, lawyerId: 8605 });

  await page.getByTestId("signatures-list-row-901").click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("document-action-reject").click();

  await expect(page.getByRole("heading", { name: "Rechazar documento" })).toBeVisible({ timeout: 10_000 });
  await page
    .getByPlaceholder("Describe brevemente por qué no estás de acuerdo con el documento...")
    .fill("No estoy de acuerdo con la cláusula tercera");

  const rejectRequest = page.waitForRequest(
    (request) =>
      request.url().includes(`/api/dynamic-documents/901/reject/${userId}/`) &&
      request.method() === "POST"
  );
  await page.getByRole("button", { name: "Rechazar documento" }).click();
  await rejectRequest;

  // Success notification (blocking SweetAlert) confirms the rejection.
  await expect(page.getByText("Documento rechazado correctamente.")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  // The dashboard auto-switches to "Dcs. Archivados" and the stateful mock
  // now serves the document as Rejected — it must appear with that badge.
  const archivedRow = page.getByTestId("signatures-list-row-901");
  await expect(archivedRow.getByText("Rechazado", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(archivedRow.getByText("Poder General")).toBeVisible();
});

test("client reject submission failure shows an error and keeps the modal open", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:client', '@outcome:failure'] }, async ({ page }) => {
  const userId = 8606;
  await setupClientPendingTab(page, { userId, lawyerId: 8607 });

  // Override the reject endpoint to fail server-side (registered after
  // setupClientPendingTab's mocks, so this later handler wins for the click below).
  await page.route(`**/api/dynamic-documents/901/reject/${userId}/`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal error" }),
      });
      return;
    }
    await route.fallback();
  });

  await page.getByTestId("signatures-list-row-901").click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("document-action-reject").click();

  await expect(page.getByRole("heading", { name: "Rechazar documento" })).toBeVisible({ timeout: 10_000 });
  const reasonInput = page.getByPlaceholder(
    "Describe brevemente por qué no estás de acuerdo con el documento..."
  );
  await reasonInput.fill("No estoy de acuerdo con la cláusula tercera");

  await page.getByRole("button", { name: "Rechazar documento" }).click();

  // Failure notification — the app must not silently swallow the error.
  await expect(page.getByText("Error al rechazar el documento.")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  // Modal stays open for retry, with the typed reason preserved (not discarded).
  await expect(page.getByRole("heading", { name: "Rechazar documento" })).toBeVisible();
  await expect(reasonInput).toHaveValue("No estoy de acuerdo con la cláusula tercera");
});
