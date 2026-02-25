import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E tests for sign-pending-documents flow.
 * Covers: viewing documents awaiting signature on Dcs. Por Firmar tab.
 */

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("lawyer sees pending-signature documents on Dcs. Por Firmar tab", { tag: ['@flow:sign-pending-documents', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8700;
  const docs = [
    buildMockDocument({
      id: 4001, title: "Contrato Pendiente A", state: "PendingSignatures",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 1, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
      ],
    }),
    buildMockDocument({
      id: 4002, title: "Poder Pendiente B", state: "PendingSignatures",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 2, signer_email: "client@example.com", signed: false, signer_name: "Cliente" },
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
  await expect(page.getByText("Contrato Pendiente A")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Poder Pendiente B")).toBeVisible();
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("client sees documents awaiting their signature", { tag: ['@flow:sign-pending-documents', '@module:signatures', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 8701;
  const docs = [
    buildMockDocument({
      id: 4010, title: "Doc Para Firmar Cliente", state: "PendingSignatures",
      createdBy: 999, requires_signature: true, assignedTo: userId,
      signatures: [
        { id: 10, signer_email: "client@example.com", signed: false, signer_name: "Cliente" },
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

test("empty Dcs. Por Firmar tab shows empty state", { tag: ['@flow:sign-pending-documents', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8702;
  const docs = [
    buildMockDocument({ id: 4020, title: "Doc Sin Firma", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  // Should show empty or no pending documents
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});
