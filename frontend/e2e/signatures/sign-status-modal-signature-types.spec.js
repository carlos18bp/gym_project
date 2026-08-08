import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — sign-status-modal signature_type + rejection behavior.
 *
 * Complements sign-status-modal.spec.js (which only opens the actions modal)
 * by asserting the signer-row label matrix rendered by
 * DocumentSignaturesModal.getSignatureStatusLabel:
 *   - signature_type 'issuer_only'  → issuer: "Firmado"/"Pendiente de Firma", others: "Informado"
 *   - signature_type 'informative'  → issuer: "Emitido", others: "Informado"
 *   - signer.rejected === true      → "Rechazado" (overrides signature_type)
 * Plus the header badge and completion-label text driven by signature_type.
 */

async function setupDashboard(page, { userId, docs }) {
  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });

  // DocumentSignaturesModal tries pending-documents-full first; return an
  // empty list so the component falls back to the per-id detail endpoint
  // that installDynamicDocumentApiMocks already serves.
  await page.route(`**/api/dynamic-documents/user/${userId}/pending-documents-full/`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

/**
 * Walk the dashboard down to the document actions modal — the state right
 * before the action under test. Each test fires the
 * "Ver estado de firmas" click itself so the transition it asserts is the
 * direct result of an action in its own body.
 */
async function openDocumentActions(page, { tab, docTitle }) {
  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: tab }).click();
  await expect(page.getByText(docTitle)).toBeVisible({ timeout: 10_000 });

  await page.getByText(docTitle).first().click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });

  await expect(
    page.getByRole("heading", { name: "Estado de Formalización del Documento" })
  ).toHaveCount(0);
}

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("issuer_only document shows 'Solo firma del emisor' badge and 'Pendiente de Firma' label for unsigned issuer", { tag: ['@flow:sign-status-modal', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8730;
  const docs = [
    buildMockDocument({
      id: 4301, title: "Contrato Issuer Only", state: "PendingSignatures",
      createdBy: userId, requires_signature: true, signature_type: "issuer_only",
      signatures: [
        { id: 50, signer: userId, signer_email: "e2e@example.com", signer_name: "E2E Lawyer", signed: false, is_creator: true },
      ],
    }),
  ];

  await setupDashboard(page, { userId, docs });
  await openDocumentActions(page, { tab: "Dcs. Por Firmar", docTitle: "Contrato Issuer Only" });

  await page.getByTestId("document-action-viewSignatures").click();
  await expect(
    page.getByRole("heading", { name: "Estado de Formalización del Documento" })
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("Solo firma del emisor")).toBeVisible();
  await expect(page.getByText("Pendiente de Firma", { exact: true })).toBeVisible();
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("issuer_only document shows 'Firmado' for issuer once signed and 'Informado' for recipient", { tag: ['@flow:sign-status-modal', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8733;
  const recipientId = 99003;
  const docs = [
    buildMockDocument({
      id: 4304, title: "Issuer Only Firmado", state: "FullySigned",
      createdBy: userId, requires_signature: true, signature_type: "issuer_only",
      signatures: [
        { id: 80, signer: userId, signer_email: "e2e@example.com", signer_name: "E2E Lawyer", signed: true, signed_at: "2026-04-05T10:00:00Z", is_creator: true },
        { id: 81, signer: recipientId, signer_email: "recipient@example.com", signer_name: "Destinatario", signed: true, signed_at: "2026-04-05T10:00:00Z", is_creator: false },
      ],
    }),
  ];

  await setupDashboard(page, { userId, docs });
  await openDocumentActions(page, { tab: "Dcs. Formalizados", docTitle: "Issuer Only Firmado" });

  await page.getByTestId("document-action-viewSignatures").click();
  await expect(
    page.getByRole("heading", { name: "Estado de Formalización del Documento" })
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("Firmado", { exact: true })).toBeVisible();
  await expect(page.getByText("Informado", { exact: true })).toBeVisible();
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("informative document shows 'Emitido' for issuer and 'Informado' for other participants", { tag: ['@flow:sign-status-modal', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8731;
  const otherSigner = 99001;
  const docs = [
    buildMockDocument({
      id: 4302, title: "Circular Informativa", state: "FullySigned",
      createdBy: userId, requires_signature: true, signature_type: "informative",
      signatures: [
        { id: 60, signer: userId, signer_email: "e2e@example.com", signer_name: "E2E Lawyer", signed: true, signed_at: "2026-04-01T12:00:00Z", is_creator: true },
        { id: 61, signer: otherSigner, signer_email: "client@example.com", signer_name: "Cliente Participante", signed: true, signed_at: "2026-04-02T12:00:00Z", is_creator: false },
      ],
    }),
  ];

  await setupDashboard(page, { userId, docs });
  await openDocumentActions(page, { tab: "Dcs. Formalizados", docTitle: "Circular Informativa" });

  await page.getByTestId("document-action-viewSignatures").click();
  await expect(
    page.getByRole("heading", { name: "Estado de Formalización del Documento" })
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("Documento informativo")).toBeVisible();
  await expect(page.getByText("Documento formalizado (informativo)")).toBeVisible();
  await expect(page.getByText("Emitido", { exact: true })).toBeVisible();
  await expect(page.getByText("Informado", { exact: true })).toBeVisible();
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("rejected signer shows 'Rechazado' label even when signature_type is informative", { tag: ['@flow:sign-status-modal', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8732;
  const otherSigner = 99002;
  const docs = [
    buildMockDocument({
      id: 4303, title: "Informativa Rechazada", state: "Rejected",
      createdBy: userId, requires_signature: true, signature_type: "informative",
      signatures: [
        { id: 70, signer: userId, signer_email: "e2e@example.com", signer_name: "E2E Lawyer", signed: true, signed_at: "2026-04-03T12:00:00Z", is_creator: true },
        { id: 71, signer: otherSigner, signer_email: "client@example.com", signer_name: "Cliente Participante", signed: false, rejected: true, rejected_at: "2026-04-04T10:00:00Z", is_creator: false },
      ],
    }),
  ];

  await setupDashboard(page, { userId, docs });
  await openDocumentActions(page, { tab: "Dcs. Archivados", docTitle: "Informativa Rechazada" });

  await page.getByTestId("document-action-viewSignatures").click();
  await expect(
    page.getByRole("heading", { name: "Estado de Formalización del Documento" })
  ).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("Rechazado", { exact: true })).toBeVisible();
});
