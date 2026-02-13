import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer clicks Estado de las firmas and sees DocumentSignaturesModal with signer table", async ({ page }) => {
  const userId = 9900;
  const userEmail = "e2e@example.com";

  const docs = [
    buildMockDocument({
      id: 10001,
      title: "Contrato con Firmantes",
      state: "PendingSignatures",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 1, signer_email: userEmail, signed: false, signer_name: "E2E Lawyer" },
        { id: 2, signer_email: "client@example.com", signed: true, signer_name: "Cliente Test", signed_at: "2025-06-01T10:00:00Z" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  // Mock the pending-documents-full endpoint used by DocumentSignaturesModal
  await page.route(`**/api/dynamic-documents/user/${userId}/pending-documents-full/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: 10001,
        title: "Contrato con Firmantes",
        state: "PendingSignatures",
        requires_signature: true,
        total_signatures: 2,
        completed_signatures: 1,
        signers: [
          { signature_id: 1, signer_name: "E2E Lawyer", signer_email: userEmail, signed: false, rejected: false, signed_at: null, rejected_at: null, is_current_user: true },
          { signature_id: 2, signer_name: "Cliente Test", signer_email: "client@example.com", signed: true, rejected: false, signed_at: "2025-06-01T10:00:00Z", rejected_at: null, is_current_user: false },
        ],
      }]),
    });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, email: userEmail },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Por Firmar
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato con Firmantes")).toBeVisible({ timeout: 10_000 });

  // Click the document row to open actions modal
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Estado de las firmas"
  await page.getByRole("button", { name: "Estado de las firmas" }).click();

  // Wait for actions modal to close
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).not.toBeVisible({ timeout: 5_000 });

  // DocumentSignaturesModal should open
  const sigModal = page.locator('div.fixed').filter({ hasText: 'Estado de firmas del documento' });
  await expect(sigModal.getByText("Estado de firmas del documento")).toBeVisible({ timeout: 15_000 });

  // Should show signer rows — one Firmado, one Pendiente (scoped to modal)
  await expect(sigModal.getByText("Firmado", { exact: true })).toBeVisible();
  await expect(sigModal.getByText("Pendiente", { exact: true }).first()).toBeVisible();

  // Should show "Cerrar" button in footer
  await expect(sigModal.getByRole("button", { name: "Cerrar" })).toBeVisible();
});

test("lawyer sees Firmar and Rechazar buttons when user is a pending signer", async ({ page }) => {
  const userId = 9901;
  const userEmail = "e2e@example.com";

  const docs = [
    buildMockDocument({
      id: 10011,
      title: "Doc Para Firmar",
      state: "PendingSignatures",
      createdBy: 100,
      requires_signature: true,
      signatures: [
        { id: 1, signer_email: userEmail, signed: false, signer_name: "E2E Lawyer" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  // Mock the pending-documents-full endpoint used by DocumentSignaturesModal
  await page.route(`**/api/dynamic-documents/user/${userId}/pending-documents-full/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: 10011,
        title: "Doc Para Firmar",
        state: "PendingSignatures",
        requires_signature: true,
        total_signatures: 1,
        completed_signatures: 0,
        signers: [
          { signature_id: 1, signer_name: "E2E Lawyer", signer_email: userEmail, signed: false, rejected: false, signed_at: null, rejected_at: null, is_current_user: true },
        ],
      }]),
    });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, email: userEmail },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Por Firmar and open document
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Doc Para Firmar")).toBeVisible({ timeout: 10_000 });

  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Estado de las firmas" }).click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).not.toBeVisible({ timeout: 5_000 });

  await expect(page.getByText("Estado de firmas del documento")).toBeVisible({ timeout: 15_000 });

  // Current user is a pending signer — should see Firmar and Rechazar buttons in the modal footer
  const modal = page.locator('div.fixed').filter({ hasText: 'Estado de firmas del documento' });
  await expect(modal.getByRole("button", { name: "Firmar documento" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Rechazar documento" })).toBeVisible();
});
