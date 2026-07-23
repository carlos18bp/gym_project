import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

  installSignedDocumentsApiMocks,
  buildMockSignedDocument,
} from "../helpers/signedDocumentsMocks.js";

test("lawyer can view signed documents list", { tag: ['@flow:sign-signed-documents', '@module:signatures', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 1700;

  const documents = [
    buildMockSignedDocument({
      id: 8001,
      title: "Contrato Firmado E2E",
      createdBy: userId,
      signatures: [
        { signer_email: "client@example.com", signed: true },
        { signer_email: "lawyer@example.com", signed: true },
      ],
    }),
  ];

  await installSignedDocumentsApiMocks(page, {
    userId,
    role: "lawyer",
    documents,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto("/dynamic_document_dashboard/signed-documents");

  await expect(page.getByText("Contrato Firmado E2E")).toBeVisible();
  await expect(page.getByText("Completamente firmado")).toBeVisible();
  await expect(page.getByText("2/2")).toBeVisible();

  // The card menu is what turns the list into a working surface: opening it
  // must reveal the actions a fully-signed document earns.
  const card = page.locator('[data-document-id="8001"]'); // quality: allow-fragile-selector (data attribute is the card's stable hook)
  await expect(page.getByText("Descargar Doc. Formalizado")).toBeHidden();
  await card.getByRole("button").first().click();
  await expect(page.getByText("Descargar Doc. Formalizado")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Previsualizar")).toBeVisible();
});

test("lawyer sees multiple signed documents with different signature counts", { tag: ['@flow:sign-signed-documents', '@module:signatures', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 1701;

  const documents = [
    buildMockSignedDocument({
      id: 8011,
      title: "Acuerdo Comercial",
      createdBy: userId,
      signatures: [
        { signer_email: "a@example.com", signed: true },
        { signer_email: "b@example.com", signed: true },
        { signer_email: "c@example.com", signed: true },
      ],
    }),
    buildMockSignedDocument({
      id: 8012,
      title: "Poder Notarial",
      createdBy: userId,
      signatures: [
        { signer_email: "d@example.com", signed: true },
      ],
    }),
  ];

  await installSignedDocumentsApiMocks(page, {
    userId,
    role: "lawyer",
    documents,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard/signed-documents");

  await expect(page.getByText("Acuerdo Comercial")).toBeVisible();
  await expect(page.getByText("3/3")).toBeVisible();
  await expect(page.getByText("Poder Notarial")).toBeVisible();
  await expect(page.getByText("1/1")).toBeVisible();

  // Each card must drive its OWN document: opening the second card's menu
  // exposes actions scoped to it, not to the first one.
  const secondCard = page.locator('[data-document-id="8012"]'); // quality: allow-fragile-selector (data attribute is the card's stable hook)
  await secondCard.getByRole("button").first().click();
  await expect(secondCard.getByText("Descargar Doc. Formalizado")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-document-id="8011"]').getByText("Descargar Doc. Formalizado")).toBeHidden(); // quality: allow-fragile-selector (data attribute is the card's stable hook)
});


test("lawyer downloads the signatures certificate PDF of a formalized document", { tag: ['@flow:sign-download-signatures-pdf', '@module:signatures', '@priority:P3', '@role:shared'] }, async ({ page }) => {
  const userId = 1700;

  const documents = [
    buildMockSignedDocument({
      id: 8001,
      title: "Contrato Firmado E2E",
      createdBy: userId,
      signatures: [
        { signer_email: "client@example.com", signed: true },
        { signer_email: "lawyer@example.com", signed: true },
      ],
    }),
  ];

  await installSignedDocumentsApiMocks(page, { userId, role: "lawyer", documents });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard/signed-documents");
  await expect(page.getByText("Contrato Firmado E2E")).toBeVisible();

  const card = page.locator('[data-document-id="8001"]');
  await expect(card).toBeVisible();
  await card.getByRole("button").first().click();

  const pdfRequest = page.waitForRequest((request) =>
    request.url().includes("/api/dynamic-documents/8001/generate-signatures-pdf/")
  );
  await page.getByText("Descargar Doc. Formalizado").click();
  await pdfRequest;
});
