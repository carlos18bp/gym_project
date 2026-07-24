import { expect } from "./test.js";

export async function openDocumentActionsModal(page, title) {
  const row = page.getByRole("table").getByText(title);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 15_000 });
}

export async function openDocumentPreviewFromActions(page) {
  const previewAction = page.getByTestId("document-action-preview");
  await expect(previewAction).toBeVisible({ timeout: 10_000 });
  await previewAction.click();
  await expect(page.getByTestId("document-preview-modal")).toBeVisible({ timeout: 10_000 });
}

export async function closeDocumentPreview(page) {
  await page.getByTestId("document-preview-close").click();
  await expect(page.getByTestId("document-preview-modal")).toBeHidden();
}

/**
 * Drive the real formalize entry point from the dashboard: "Mis Documentos"
 * tab → document row → actions modal → "Formalizar y Agregar Firmas".
 * Leaves the page on DocumentForm in formalize mode.
 */
export async function openFormalizeFromMyDocuments(page, title) {
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  await openDocumentActionsModal(page, title);
  const formalizeAction = page.getByTestId("document-action-formalize");
  await expect(formalizeAction).toBeEnabled({ timeout: 10_000 });
  await formalizeAction.click();
  await expect(page.getByTestId("formalize-signature-type-normal")).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Drive the real correction entry point: "Dcs. Archivados" tab → document row
 * → actions modal → "Editar y reenviar para firma". Leaves the page on
 * DocumentForm in correction mode.
 */
export async function openCorrectionFromArchived(page, title) {
  await page.getByRole("button", { name: /Archivados/i }).click();
  await openDocumentActionsModal(page, title);
  const resendAction = page.getByTestId("document-action-editAndResend");
  await expect(resendAction).toBeEnabled({ timeout: 10_000 });
  await resendAction.click();
  await expect(page.getByTestId("correction-signature-due-date")).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Pick a signer in formalize mode through the search dropdown, so the
 * "Formalizar" button leaves its disabled state the way a user unlocks it.
 */
export async function selectFormalizeSigner(page, { query, userId }) {
  await page.getByTestId("formalize-signer-search").fill(query);
  await page.getByTestId(`formalize-signer-option-${userId}`).click();
  await expect(page.getByText("Firmantes seleccionados:")).toBeVisible();
}

/**
 * Pick a recipient in formalize mode (issuer_only / informative types).
 */
export async function selectFormalizeRecipient(page, { query, userId }) {
  await page.getByTestId("formalize-recipient-search").fill(query);
  await page.getByTestId(`formalize-recipient-option-${userId}`).click();
  await expect(page.getByText("Destinatarios seleccionados:")).toBeVisible();
}
