import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for the reopen-rejected-document flow (lawyer side).
 * A rejected document lives on the "Dcs. Archivados" tab; from its actions
 * modal the lawyer can read the rejection reason and reopen it via
 * "Editar y reenviar para firma" (correction mode).
 */

function buildLawyerDocs(userId) {
  return [
    buildMockDocument({
      id: 701,
      title: "Contrato Rechazado",
      state: "Rejected",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        {
          id: 1,
          signer_id: userId,
          signer_email: "e2e@example.com",
          signer_name: "E2E Lawyer",
          signed: true,
        },
        {
          id: 2,
          signer_id: userId + 1,
          signer_email: "client@example.com",
          signer_name: "Cliente Test",
          signed: false,
          rejected: true,
          rejection_comment: "Datos incorrectos",
        },
      ],
    }),
    buildMockDocument({
      id: 702,
      title: "Minuta Borrador",
      state: "Draft",
      createdBy: userId,
    }),
  ];
}

async function setupLawyerDashboard(page, userId) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: buildLawyerDocs(userId),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
}

async function openRejectedDocumentActions(page) {
  await page.getByTestId("lawyer-tab-archived-documents").click();
  const row = page.getByTestId("signatures-list-row-701");
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
}

test("lawyer sees rejected document in archived documents section", { tag: ['@flow:sign-reopen', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  await setupLawyerDashboard(page, 8400);

  await page.getByTestId("lawyer-tab-archived-documents").click();

  const row = page.getByTestId("signatures-list-row-701");
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText("Contrato Rechazado")).toBeVisible();
  await expect(row.getByText("Rechazado", { exact: true })).toBeVisible();
  // The Draft minuta must NOT leak into the archived (Rejected/Expired) tab.
  await expect(page.getByText("Minuta Borrador")).toHaveCount(0);
});

test("rejected document exposes its rejection reason from the actions modal", { tag: ['@flow:sign-reopen', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  await setupLawyerDashboard(page, 8401);

  await openRejectedDocumentActions(page);

  await page.getByTestId("document-action-viewRejectionReason").click();

  await expect(page.getByRole("heading", { name: "Motivo del rechazo" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Datos incorrectos")).toBeVisible();
});

test("lawyer reopens rejected document via editar y reenviar para firma", { tag: ['@flow:sign-reopen', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  await setupLawyerDashboard(page, 8402);

  await openRejectedDocumentActions(page);

  const reopenAction = page.getByTestId("document-action-editAndResend");
  await expect(reopenAction).toBeVisible();
  await reopenAction.click();

  await page.waitForURL("**/dynamic_document_dashboard/document/use/correction/701/**", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Contrato Rechazado" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Guardar y reenviar para firma" })).toBeVisible();
});

test("draft and rejected documents live on their respective tabs", { tag: ['@flow:sign-reopen', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  await setupLawyerDashboard(page, 8403);

  // Default "Minutas" tab (Draft/Published scope) shows only the draft.
  await expect(page.getByText("Minuta Borrador")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Contrato Rechazado")).toHaveCount(0);

  // Archived tab (Rejected/Expired scope) shows only the rejected document.
  await page.getByTestId("lawyer-tab-archived-documents").click();
  await expect(page.getByTestId("signatures-list-row-701")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Minuta Borrador")).toHaveCount(0);
});
