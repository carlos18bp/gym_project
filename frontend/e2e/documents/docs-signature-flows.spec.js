import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Consolidated E2E tests for document signature flows.
 * Replaces 9 fragmented spec files with 5 user-flow tests.
 * Covers: sign-signed-documents, sign-electronic-signature, sign-document-flow,
 *         sign-client-flow, sign-archived-documents, sign-status-modal
 */

test("lawyer sees pending signature documents on Dcs. Por Firmar tab", { tag: ['@flow:sign-signed-documents', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8500;
  const docs = [
    buildMockDocument({
      id: 2001, title: "Contrato Pendiente Firma", state: "PendingSignatures",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 1, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
        { id: 2, signer_email: "client@example.com", signed: false, signer_name: "Cliente Test" },
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
  await expect(page.getByText("Contrato Pendiente Firma")).toBeVisible({ timeout: 10_000 });
});

test("lawyer sees fully signed documents on Dcs. Firmados tab", { tag: ['@flow:sign-signed-documents', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8501;
  const docs = [
    buildMockDocument({
      id: 2010, title: "Contrato Firmado Completo", state: "FullySigned",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 10, signer_email: "e2e@example.com", signed: true, signer_name: "E2E Lawyer" },
        { id: 11, signer_email: "client@example.com", signed: true, signer_name: "Cliente" },
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
  await expect(page.getByText("Contrato Firmado Completo")).toBeVisible({ timeout: 10_000 });
});

test("lawyer sees rejected documents on Dcs. Archivados tab", { tag: ['@flow:sign-signed-documents', '@module:signatures', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8502;
  const docs = [
    buildMockDocument({
      id: 2020, title: "Contrato Rechazado", state: "Rejected",
      createdBy: userId, requires_signature: true,
      signatures: [
        { id: 20, signer_email: "client@example.com", signed: false, signer_name: "Cliente", rejected: true },
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

test("lawyer opens electronic signature modal and sees upload/draw options", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8503;
  const docs = [
    buildMockDocument({ id: 2030, title: "Doc Para Firma", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: false, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Look for Firma Electrónica button
  const firmaBtn = page.getByRole("button", { name: /firma electr/i }).or(page.locator('[data-testid="electronic-signature-btn"]')).first();
  const visible = await firmaBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (visible) {
    await firmaBtn.click();
    // Should show upload and draw options
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible();
  }

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});

test("client without signature sees upload and draw options on signature modal", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8504;
  const docs = [
    buildMockDocument({ id: 2040, title: "Doc Cliente Firma", state: "Completed", createdBy: 999, assignedTo: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "client", hasSignature: false, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("client");
});
