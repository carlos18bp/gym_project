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
  await expect(page.getByTestId("document-preview-modal")).toHaveCount(0);
}
