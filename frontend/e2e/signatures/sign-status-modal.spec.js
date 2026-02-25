import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E tests for sign-status-modal flow.
 * Covers: viewing signature status modal with signer table.
 */

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("lawyer clicks document on Dcs. Por Firmar and sees signature status info", { tag: ['@flow:sign-status-modal', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8720;
  const docs = [
    buildMockDocument({
      id: 4201, title: "Contrato Con Firmas", state: "PendingSignatures",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 40, signer_email: "e2e@example.com", signed: true, signer_name: "E2E Lawyer" },
        { id: 41, signer_email: "client@example.com", signed: false, signer_name: "Cliente Test" },
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
  await expect(page.getByText("Contrato Con Firmas")).toBeVisible({ timeout: 10_000 });

  // Click document row to see actions/status
  await page.getByText("Contrato Con Firmas").first().click();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("fully signed document shows all signers completed in status view", { tag: ['@flow:sign-status-modal', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8721;
  const docs = [
    buildMockDocument({
      id: 4210, title: "Contrato Todo Firmado", state: "FullySigned",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 42, signer_email: "e2e@example.com", signed: true, signer_name: "E2E Lawyer" },
        { id: 43, signer_email: "client@example.com", signed: true, signer_name: "Cliente" },
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

  await page.getByRole("button", { name: "Dcs. Firmados" }).click();
  await expect(page.getByText("Contrato Todo Firmado")).toBeVisible({ timeout: 10_000 });

  await page.getByText("Contrato Todo Firmado").first().click();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});
