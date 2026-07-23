import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { LEGAL_FILES_AUTO_REDIRECT } from "../helpers/flow-tags.js";

/**
 * E2E for legal-files-auto-redirect (Req #6).
 *
 * Verifies that the first visit of the session to the document Dashboard —
 * reached the way a user reaches it, from the sidebar — auto-selects the
 * "Dcs. Por Firmar" tab when there are pending signatures, but that explicit
 * URL params (?tab=, ?lawyerTab=) override the auto-redirect.
 */

function buildPendingDoc(userId, id, title) {
  return buildMockDocument({
    id,
    title,
    state: "PendingSignatures",
    createdBy: 7777,
    requires_signature: true,
    assignedTo: userId,
    signatures: [
      {
        id: id * 10,
        signer_email: "e2e@example.com",
        signed: false,
        signer_name: "E2E User",
      },
    ],
  });
}

test(
  "first post-login visit with pending signatures auto-selects Dcs. Por Firmar tab",
  { tag: [...LEGAL_FILES_AUTO_REDIRECT, "@role:lawyer"] },
  async ({ page }) => {
    const userId = 9101;
    const docs = [buildPendingDoc(userId, 5001, "Contrato Pendiente Auto")];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      pendingSignaturesCount: 1,
      documents: docs,
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

    // Enter the module the way the user does — from the sidebar, with no tab
    // hint in the URL, so the auto-redirect is the only thing that can select
    // the pending-signatures tab.
    await page.goto("/dashboard");
    await page.getByText("Archivos Juridicos").first().waitFor({ timeout: 15_000 });
    await expect(page.getByText("Contrato Pendiente Auto")).toHaveCount(0);

    await page.getByText("Archivos Juridicos").first().click();

    await expect(page).toHaveURL(/\/dynamic_document_dashboard$/, { timeout: 15_000 });
    await expect(page.getByText("Contrato Pendiente Auto")).toBeVisible({
      timeout: 15_000,
    });
  }
);

test(
  "explicit ?tab= URL param overrides auto-redirect",
  { tag: [...LEGAL_FILES_AUTO_REDIRECT, "@role:client"] },
  async ({ page }) => {
    const userId = 9102;
    const docs = [buildPendingDoc(userId, 5002, "Contrato Pendiente Override")];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: true,
      pendingSignaturesCount: 1,
      documents: docs,
    });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: userId,
        role: "client",
        is_gym_lawyer: false,
        is_profile_completed: true,
      },
    });

    await page.goto("/dynamic_document_dashboard?tab=signed-documents");

    // quality: disable fragile_locator ("Archivos Juridicos" appears in both nav and page heading; .first() targets whichever resolves first)
    await page
      .getByText("Archivos Juridicos")
      .first()
      .waitFor({ timeout: 15_000 });

    // The pending document should NOT be visible because ?tab=signed-documents
    // overrides the auto-redirect to "Dcs. Por Firmar".
    await expect(page.getByText("Contrato Pendiente Override")).toBeHidden({
      timeout: 5_000,
    });
  }
);
