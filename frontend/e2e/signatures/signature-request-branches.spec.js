import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * Branch coverage tests for signature request flow.
 * Tests different signature states, signer counts, and role-based views.
 */

/**
 * DocumentSignaturesModal first queries pending-documents-full and falls back
 * to the document detail endpoint. Return an empty list so the modal uses the
 * detail endpoint already handled by installDynamicDocumentApiMocks.
 * (same helper as sign-status-modal.spec.js)
 */
async function stubPendingDocumentsFull(page) {
  await page.route("**/api/dynamic-documents/user/*/pending-documents-full/", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

// Catches: a signature-status view that renders extra phantom signer rows
// for a single-signer document — the count assertion below fails if the
// document's lone signer somehow gets duplicated or a second row appears.
// quality: allow-fragile-test-data (mock signer email in signature test double)
test("document with a single signer shows exactly one signer in the formalization status view", { tag: ['@flow:sign-document-flow', '@module:signatures', '@priority:P1', '@role:lawyer', '@outcome:display'] }, async ({ page }) => {
  const userId = 9200;
  const docs = [
    buildMockDocument({
      id: 9201, title: "Contrato Un Firmante", state: "PendingSignatures",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 1, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await stubPendingDocumentsFull(page);
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato Un Firmante")).toBeVisible({ timeout: 10_000 });

  // Open the real signature status view (there is no separate "simplified"
  // view for single-signer documents — this is the only reachable surface).
  await page.getByText("Contrato Un Firmante").first().click();
  await page.getByRole("button", { name: "Estado de Formalización" }).click();

  const statusModal = page.getByTestId("document-signatures-modal");
  await expect(statusModal.getByRole("heading", { name: "Estado de Formalización del Documento" })).toBeVisible({ timeout: 10_000 });

  // Exactly the one seeded signer renders, with their real name/email/status
  await expect(statusModal.getByText("E2E Lawyer")).toBeVisible();
  await expect(statusModal.getByText("e2e@example.com")).toBeVisible();
  await expect(statusModal.getByText("Pendiente", { exact: true })).toHaveCount(1);
});

// Catches: a signature-status view that drops a signer row (e.g. only
// renders the current user, or collapses pending signers together) — each
// of the three seeded signers' name/email must render individually.
// quality: allow-fragile-test-data (mock signer emails in signature test double)
test("document with multiple signers shows all signers", { tag: ['@flow:sign-document-flow', '@module:signatures', '@priority:P1', '@role:lawyer', '@outcome:display'] }, async ({ page }) => {
  const userId = 9210;
  const docs = [
    buildMockDocument({
      id: 9211, title: "Contrato Multi Firmantes", state: "PendingSignatures",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 10, signer_email: "e2e@example.com", signed: true, signer_name: "E2E Lawyer" },
        { id: 11, signer_email: "client1@example.com", signed: false, signer_name: "Cliente 1" },
        { id: 12, signer_email: "client2@example.com", signed: false, signer_name: "Cliente 2" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await stubPendingDocumentsFull(page);
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato Multi Firmantes")).toBeVisible({ timeout: 10_000 });

  // Open the real signature status view and check every signer is listed
  await page.getByText("Contrato Multi Firmantes").first().click();
  await page.getByRole("button", { name: "Estado de Formalización" }).click();

  const statusModal = page.getByTestId("document-signatures-modal");
  await expect(statusModal.getByRole("heading", { name: "Estado de Formalización del Documento" })).toBeVisible({ timeout: 10_000 });

  await expect(statusModal.getByText("E2E Lawyer")).toBeVisible();
  await expect(statusModal.getByText("e2e@example.com")).toBeVisible();
  await expect(statusModal.getByText("Cliente 1")).toBeVisible();
  await expect(statusModal.getByText("client1@example.com")).toBeVisible();
  await expect(statusModal.getByText("Cliente 2")).toBeVisible();
  await expect(statusModal.getByText("client2@example.com")).toBeVisible();

  // One signed, two still pending — proves the per-signer status is real
  await expect(statusModal.getByText("Firmado", { exact: true })).toHaveCount(1);
  await expect(statusModal.getByText("Pendiente", { exact: true })).toHaveCount(2);
});

// Catches: a "Ver motivo del rechazo" action that opens but shows the wrong
// (or no) comment — the seeded rejection_comment must render verbatim.
// quality: allow-fragile-test-data (mock signer email in signature test double)
test("rejected document shows on archived tab with reject info", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9220;
  const docs = [
    buildMockDocument({
      id: 9221, title: "Contrato Rechazado Branch", state: "Rejected",
      createdBy: userId, requires_signature: true,
      // rejection_comment is the real signature-serializer field (see
      // backend/gym_app/models/dynamic_document.py DocumentSignature.rejection_comment);
      // menuOptionsHelper.js only shows "Ver motivo del rechazo" when it is set.
      signatures: [
        { id: 20, signer_email: "client@example.com", signed: false, signer_name: "Cliente", rejected: true, rejection_comment: "No estoy de acuerdo con los términos" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Dcs. Archivados" }).click();
  await expect(page.getByText("Contrato Rechazado Branch")).toBeVisible({ timeout: 10_000 });

  // Open the reject-info action and check the real comment renders
  await page.getByText("Contrato Rechazado Branch").first().click();
  await page.getByRole("button", { name: "Ver motivo del rechazo" }).click();

  await expect(page.getByRole("heading", { name: "Motivo del rechazo" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("No estoy de acuerdo con los términos")).toBeVisible();
});
