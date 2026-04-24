import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { openDocumentActionsModal } from "../helpers/documentActions.js";

/**
 * Regression coverage for fix 1.4 — Letterhead management is locked for
 * documents in the signature workflow (PendingSignatures / FullySigned).
 *
 * The guard lives in menuOptionsHelper.js (signatures context): the "Gestionar
 * Membrete" action must not appear in the DocumentActionsModal for locked docs
 * in the signatures tabs. The LetterheadModal also renders a locked banner and
 * hides the upload dropzone as a defense-in-depth measure.
 */

const buildLawyerAuth = ({ userId }) => ({
  token: "e2e-token",
  userAuth: {
    id: userId,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
});

test.describe("Letterhead locked for signed documents", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, () => {
  test("lawyer PendingSignatures doc in Dcs. Por Firmar tab hides letterhead action", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9700;
    const docTitle = "Contrato Pendiente de Firma";

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      documents: [
        buildMockDocument({
          id: 9701,
          title: docTitle,
          state: "PendingSignatures",
          createdBy: userId,
          requires_signature: true,
          content: "<p>Contenido del contrato</p>",
        }),
      ],
      folders: [],
    });

    await setAuthLocalStorage(page, buildLawyerAuth({ userId }));
    await page.goto("/dynamic_document_dashboard");

    // Navigate to "Dcs. Por Firmar" tab (signatures context).
    await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
    await openDocumentActionsModal(page, docTitle);

    // Preview is always available → sanity check the modal rendered.
    await expect(page.getByTestId("document-action-preview")).toBeVisible({ timeout: 10_000 });

    // Regression: "Gestionar Membrete" must NOT be present for locked docs
    // in the signatures context.
    await expect(page.getByTestId("document-action-letterhead")).toHaveCount(0);
  });

  test("lawyer FullySigned doc in Dcs. Formalizados tab hides letterhead action", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9702;
    const docTitle = "Contrato Firmado Completo";

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      documents: [
        buildMockDocument({
          id: 9703,
          title: docTitle,
          state: "FullySigned",
          createdBy: userId,
          requires_signature: true,
          content: "<p>Contenido final del contrato</p>",
        }),
      ],
      folders: [],
    });

    await setAuthLocalStorage(page, buildLawyerAuth({ userId }));
    await page.goto("/dynamic_document_dashboard");

    await page.getByRole("button", { name: "Dcs. Formalizados" }).click();
    await openDocumentActionsModal(page, docTitle);

    await expect(page.getByTestId("document-action-preview")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("document-action-letterhead")).toHaveCount(0);
  });
});
