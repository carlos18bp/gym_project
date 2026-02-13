import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSignedDocumentsApiMocks,
  buildMockSignedDocument,
} from "../helpers/signedDocumentsMocks.js";

test("lawyer can view signed documents list", async ({ page }) => {
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
});
