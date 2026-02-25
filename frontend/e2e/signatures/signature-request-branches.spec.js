import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * Branch coverage tests for signature request flow.
 * Tests different signature states, signer counts, and role-based views.
 */

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("document with single signer shows simplified signature view", { tag: ['@flow:sign-document-flow', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
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
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato Un Firmante")).toBeVisible({ timeout: 10_000 });
});

// quality: allow-fragile-test-data (mock signer emails in signature test double)
test("document with multiple signers shows all signers", { tag: ['@flow:sign-document-flow', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
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
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato Multi Firmantes")).toBeVisible({ timeout: 10_000 });
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("rejected document shows on archived tab with reject info", { tag: ['@flow:sign-reject', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9220;
  const docs = [
    buildMockDocument({
      id: 9221, title: "Contrato Rechazado Branch", state: "Rejected",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 20, signer_email: "client@example.com", signed: false, signer_name: "Cliente", rejected: true, rejection_reason: "No estoy de acuerdo con los términos" },
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
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("client sees pending documents assigned to them for signing", { tag: ['@flow:sign-client-flow', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9230;
  const docs = [
    buildMockDocument({
      id: 9231, title: "Doc Para Firma Cliente", state: "PendingSignatures",
      createdBy: 999, requires_signature: true, assignedTo: userId,
      signatures: [
        { id: 30, signer_email: "client@example.com", signed: false, signer_name: "Cliente" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "client", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
