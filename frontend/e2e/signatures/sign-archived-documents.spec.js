import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E tests for sign-archived-documents flow.
 * Covers: viewing rejected/expired documents on Dcs. Archivados tab.
 */

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("lawyer sees rejected documents on Dcs. Archivados tab", { tag: ['@flow:sign-archived-documents', '@module:signatures', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8710;
  const docs = [
    buildMockDocument({
      id: 4101, title: "Contrato Rechazado", state: "Rejected",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 30, signer_email: "client@example.com", signed: false, signer_name: "Cliente", rejected: true },
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
  await expect(page.getByText("Contrato Rechazado")).toBeVisible({ timeout: 10_000 });
});

// quality: allow-fragile-test-data (mock signer email in signature test double)
test("lawyer sees expired documents on Dcs. Archivados tab", { tag: ['@flow:sign-archived-documents', '@module:signatures', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8711;
  const docs = [
    buildMockDocument({
      id: 4110, title: "Contrato Expirado", state: "Expired",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 31, signer_email: "client@example.com", signed: false, signer_name: "Cliente" },
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
  await expect(page.getByText("Contrato Expirado")).toBeVisible({ timeout: 10_000 });
});
